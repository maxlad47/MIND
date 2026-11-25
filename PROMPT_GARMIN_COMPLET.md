# MIND — Garmin complet : courses importées, bilan après séance, allure et FC, liaison par clé personnelle, pas et sommeil

Ce prompt **remplace** `PROMPT_GARMIN.md` et `PROMPT_GARMIN_PERSONAL.md`. Exécute tout d'une traite.

## Avant de commencer

- Lis `README.md`, puis :
  - moteur : `src/engine/types.ts` (`Session`, `RunPlan`, `RunLog`, `Checkin`), `src/engine/adapt.ts`, `src/engine/libre.ts`, `src/engine/formats.ts` ;
  - données : `src/lib/store.ts` (`logRun`, `addCheckin`, `runDailyJobs`, `notify`, `addExtraSession`, `clientSessions`), `src/lib/remote.ts` ;
  - écrans : `src/pages/SessionPage.tsx` (`RunEditor`), `src/pages/Today.tsx`, `src/pages/ProfilePage.tsx`, `src/pages/ClientDetail.tsx`, `src/ui/kit.tsx` ;
  - IA : `shared/ai-core.ts` ;
  - Supabase : `supabase/setup.sql`, `supabase/functions/` (dont `daily-cron` et `_cors.ts`), `supabase/migrations/0003_cron.sql`.
- **État du dépôt** : une tentative précédente a été interrompue. `fflate` et `fit-file-parser` sont déjà ajoutés à `package.json` et `package-lock.json` (non commités). Vérifie avec `git status` qu'il ne reste rien d'autre à moitié fait.
- **Ne commite jamais `supabase/setup.sql`** : il contient une modification locale (l'email du coach) qui ne doit pas partir sur le dépôt public.
- Pièges connus, issus de la mémoire du projet :
  - l'app utilise un `HashRouter` (les scripts e2e naviguent avec `base + '/#/app/...'`) ;
  - une séance de renfo coureur est `sport: 'muscu'`, `kind: 'renfo'` : ce n'est **pas** une course à rattacher ;
  - en mode libre, utilise `exerciseOf(id)` et passe par `syncFree` ; ne touche jamais aux séances futures à la main.

## Contexte

Le coach (Max) veut que les courses faites avec une montre Garmin arrivent toutes seules dans MIND.

**Ce que fait MIND quand une course arrive :**
1. il la **relie automatiquement à la séance de course prévue ce jour-là** ;
2. il la marque faite, avec la distance, le temps, l'allure, le cardio, l'allure par km et la FC ;
3. il ne reste au client que **deux réponses** : la séance a-t-elle été respectée (et sinon pourquoi), et son **RPE**.

**Les sources de données :**
- **Clé API personnelle Garmin (tier « Personal »)** : c'est la source **active**. Elle sert à trois comptes : Max (coach), son frère (prépa marathon) et sa compagne. Chacun crée sa clé et la colle une fois dans MIND. La clé est stockée **chiffrée côté serveur**, et une **synchro automatique** tourne toutes les 30 minutes. **C'est une décision du coach, à ne pas remettre en question.**
- **Accès officiel « Starter »** (OAuth, liaison en un clic) : demandé à Garmin, en attente de réponse. À **préparer, désactivé**.
- **Sans montre liée** : « Fait comme prévu » en une touche, saisie rapide (distance + temps), ou import d'un fichier .FIT.

Toutes les sources passent par **le même rattachement et le même bilan**.

## Documentation Garmin de la clé personnelle (vérifiée le 2026-11-23)

- **Création** : Garmin Connect (web) → réglages → « Personal API » (`connect.garmin.com/app/settings/personalApiToken`). La clé n'est **affichée qu'une fois**, et il n'y en a **qu'une à la fois** : en créer une nouvelle invalide l'ancienne.
- **Expiration** : au bout de **30, 90, 180 jours ou 1 an**, au choix à la création. Garmin envoie un email environ une semaine avant.
- **Jeton d'accès** : la clé ne s'utilise pas directement, elle sert à obtenir un jeton **valable 24 h** :
  `POST https://personal.connectapi.garmin.com/personalapitoken-service/personal-api/personal-api-key/token`
  avec l'en-tête `Authorization: ApiKey <clé>`.
  Il n'y a pas de jeton de rafraîchissement : on redemande un jeton avec la clé.
- **Accès** : en **lecture seule, en mode pull** (MIND va chercher, Garmin ne prévient pas). Activity (JSON et .FIT), Health (pas, sommeil…).
- **Limites d'appels** : non publiées. Garmin peut ralentir ou refuser sans préavis.
- **Documentation** : https://developer.garmin.com/gc-developer-program/personal/personal-api/ et https://developer.garmin.com/gc-developer-program/personal/personal-faq/ (avec un lien vers le Swagger des points d'accès).
  - **Lis-la pour les URL et les formats** des activités, des résumés quotidiens et du sommeil.
  - **N'invente aucun point d'accès.** Ce qui n'est pas vérifiable reste derrière un adaptateur, avec un `TODO(garmin)` et des réponses simulées dans les tests.

---

## Partie 1 : modèle, rattachement, affichage, bilan (indépendant de la source)

### 1.1 Une activité importée
- Nouveau type `ImportedRun` :
  - identifiants : `id` (stable), `clientId`, `source: 'garmin' | 'fit' | 'manuel'`, `externalId` (sert à l'idempotence : la même activité reçue deux fois ne crée jamais de doublon ; pour Garmin, c'est l'id d'activité Garmin, **identique quelle que soit la méthode de liaison**) ;
  - début : `startAt` (date et heure locales) ;
  - mesures : `km`, `seconds` (temps en mouvement s'il est disponible, sinon temps total), `avgPaceSec`, `avgHr?`, `maxHr?`, `elevationGain?` ;
  - tours : `laps?: { meters, seconds, avgPaceSec, avgHr? }[]` ;
  - allure par km : `splits?: { km, seconds, avgPaceSec, avgHr? }[]` (un par km entier, plus le dernier km partiel) ;
  - fréquence cardiaque : `hrSeries?: { t, hr }[]` (secondes depuis le départ, ramenées à un point toutes les 10 s pour rester léger dans les records JSON) ;
  - classification et rattachement : `activityType` (route, tapis, trail, piste…), `matchedSessionId?`, `status: 'a_rattacher' | 'rattachee' | 'ignoree'`.
- Ajouter `'garmin' | 'fit'` à `RunLog.source`.
- **Stockage** : un nouveau `kind` dans les `records` (voir `remote.ts`). Aucune migration pour les activités. Le coach les reçoit en temps réel comme le reste.

### 1.2 Rattachement automatique (fonction pure dans `src/engine/`, testée)
- `matchImportedRun(program, run)` renvoie la séance à rattacher, ou `undefined` :
  1. une séance **course** du même jour, `prevue`, sans `runLog` ; s'il y en a deux (matin et soir), on prend la plus proche par l'heure (`slot`) puis par la distance prévue ;
  2. sinon, une séance course `prevue` de la **veille ou du lendemain**, seulement si la distance est cohérente (±30 %). On note alors `movedFrom`, comme pour un déplacement ;
  3. sinon : une **sortie en plus** (réutilise `addExtraSession(..., 'course')`). Elle est faite, compte dans le volume et ne décale rien. C'est aussi le cas pour un client dont la course est en mode libre.
- Ne rattacher que la course (route, tapis, trail, piste). Le vélo, la marche, la muscu et le reste sont ignorés. Ne jamais rattacher à une séance `kind: 'renfo'`.
- Le rattachement remplit `runLog`, passe la séance en `faite` et **réutilise `logRun`**, y compris la proposition d'ajustement des allures.
- **Idempotence et déterminisme** : n'importe quel appareil, client ou coach, peut rattacher une activité `a_rattacher` sans jamais créer de doublon. Le résultat doit être le même quel que soit l'appareil.
- **Correction** : « Ce n'est pas cette séance » permet de la rattacher à une autre séance de la semaine, d'en faire une sortie en plus, ou de l'ignorer.

### 1.3 Sur la séance : prévu, réalisé, allure par km, fréquence cardiaque (visible par le client et le coach)
- **Prévu / réalisé** côte à côte : distance, durée, allure moyenne.
- **Tours de travail** : si des tours existent et que la séance prévue a des blocs (ex. 10 × 400 m), afficher les tours de travail face aux allures cibles. Détecter les tours de travail par leur allure, plus rapide que la récupération.
- **Allure par km** : des barres Recharts, une par km, avec l'allure cible en ligne horizontale. Couleur plus vive quand le km est plus rapide que la cible, plus terne quand il est plus lent. Une phrase de synthèse calculée, par exemple :
  - « Départ trop rapide : km 1 à 3 en 5:05, cible 5:30 » ;
  - « Régulier : ±6 s autour de 5:28 » ;
  - « Fin difficile : les 3 derniers km 15 s plus lents ».
- **Fréquence cardiaque** : une courbe sur la durée, avec les **zones en bandes de fond**, puis une barre « temps par zone » (Z1 à Z5, en minutes et en %).
  - Les zones sont en % de la **FC max**. C'est un champ du profil, modifiable par le client et par le coach. Par défaut, c'est la FC la plus haute vue dans les activités importées des 6 derniers mois. Sinon, 220 − âge, marqué « estimation ».
  - Seuils : Z1 < 70 %, Z2 70–80 %, Z3 80–87 %, Z4 87–93 %, Z5 > 93 %.
- **Pré-réponse de MIND**, en suggestion. Le client garde toujours le dernier mot :
  - « D'après ta montre : en partie respectée (2 tours sur 10 trop lents) » ;
  - EF ou récup avec plus de 20 % du temps en Z3 ou au-dessus : « Endurance trop intense : 34 % du temps au-dessus de Z2 ». Le coach voit aussi l'alerte sur la séance ;
  - sortie longue : la synthèse d'allure signale un départ trop rapide ou une fin difficile.
- **Sans données détaillées** (saisie rapide, ou activité sans points) : seulement les moyennes. **Jamais de graphique vide.**

### 1.4 Le bilan après séance (`Sheet`, même parcours pour toutes les sources)
- **Séance respectée ?** Trois réponses : « Oui » / « En partie » / « Non ».
- Si « En partie » ou « Non », **pourquoi ?** (plusieurs choix possibles, puces `Chip`) :
  - Trop difficile
  - Fatigue / mauvais sommeil
  - Douleur ou gêne : demander la **zone** (`Zone`) ; cela crée une alerte coach, comme la douleur au check-in
  - Manque de temps
  - Pas envie / motivation
  - Malade
  - Météo / terrain
  - Montre ou GPS en défaut
  - Autre (texte libre)
- **RPE de 1 à 10**, une échelle à touches de 44 px minimum, avec des repères en mots : 1 très facile, 3 facile, 5 moyen, 7 difficile, 9 très difficile, 10 maximal. C'est un champ à part (`rpe`), distinct de `feeling`.
- Ajouter à `RunLog` : `respected?: 'oui' | 'partiel' | 'non'`, `reasons?: string[]`, `reasonNote?`, `rpe?`.
- Tant que le bilan n'est pas rempli : une carte **« À compléter : ta sortie de 10,2 km »** sur `Today`, plus une notification dans l'app (`notify`).
- Ce bilan remplace la saisie manuelle actuelle d'une course.

### 1.5 Saisie sans montre liée (quelques secondes)
Sur une séance de course prévue, proposer trois entrées, dans cet ordre :
1. **« Fait comme prévu »** (bouton principal, une touche) : `km` et `seconds` sont remplis à partir du plan, puis le bilan s'ouvre directement.
2. **« Saisie rapide »** : distance (km) et temps (mm:ss ou h:mm:ss, clavier numérique). L'allure est calculée, puis on enchaîne sur le bilan.
3. **« Importer depuis ma montre (.FIT) »** : voir 1.7.

Les trois créent un `ImportedRun` et passent par le même rattachement et le même bilan.

### 1.6 Ce que MIND en fait (règles dans `adapt.ts`, toujours **proposées**, jamais appliquées seules)
- « Trop difficile » ou RPE ≥ 9 sur une séance de qualité, **deux fois en 14 jours** : proposer de recalculer les allures à la baisse (adaptation `allures` existante).
- « Douleur ou gêne » : alerte coach immédiate.
- « Pas envie / motivation » **trois fois en 21 jours** : alerte coach « motivation en baisse ».
- RPE ≤ 3 sur une sortie longue ou de qualité, **deux fois de suite**, avec la séance respectée : proposer une hausse prudente des allures.
- Ces règles ne s'appliquent pas à une course en mode libre, sauf les alertes coach.
- **Côté coach (`ClientDetail.tsx`)** : sur chaque séance, le respect, les raisons et le RPE. Plus une courbe du RPE sur les dernières semaines (Recharts).

### 1.7 Import d'un fichier .FIT
- Le bouton est sur une séance de course et sur `Today`.
- Accepter **le `.fit` et le `.zip`** tels que produits par « Exporter l'original » sur le site Garmin Connect. Décompresser avec `fflate`, prendre le premier `.fit`, et le lire avec `fit-file-parser`, dans le navigateur.
- Extraire : distance, temps, allure, FC, tours, heure de début, et les points (pour `splits` et `hrSeries`).
- Ajouter une aide pas à pas pour iPhone : Safari → connect.garmin.com → l'activité → ⚙︎ → « Exporter l'original » → choisir le fichier dans MIND.
- **Le même lecteur FIT** sert à la partie 2 : il est partagé entre le navigateur et l'Edge Function. Vérifie qu'il marche sous Deno ; sinon, extrais la logique dans `shared/`.

---

## Partie 2 : liaison par clé personnelle Garmin (active)

### 2.1 Activation, réservée par le coach
- Dans `ClientDetail.tsx`, un interrupteur « Autoriser la liaison Garmin par clé personnelle ». Désactivé par défaut. Le compte coach y a toujours droit.
- Une variable `VITE_GARMIN_PERSONAL=true` active toute la fonction. Mets-la dans `.env.production` et dans le mode de test décrit en partie 5.

### 2.2 Liaison (Profil → « Montre » → « Lier avec ma clé Garmin personnelle »)
- **Aide pas à pas pour iPhone** :
  1. Safari → connect.garmin.com.
  2. Réglages → Personal API.
  3. Créer une clé et **choisir « 1 an »**.
  4. Copier la clé, qui ne s'affiche qu'une fois.
  5. La coller dans MIND.
- Le client indique la durée choisie (1 an par défaut) : MIND calcule la date d'expiration.
- La clé est envoyée **une seule fois**, en HTTPS, à l'Edge Function `garmin-personal-link`, qui :
  1. vérifie l'utilisateur connecté et l'autorisation du coach ;
  2. **teste la clé** en demandant un jeton (refus clair si elle est invalide) ;
  3. la **chiffre** (AES-GCM avec `GARMIN_KEY_SECRET` dans les secrets Supabase, ou Supabase Vault si c'est plus simple) ;
  4. l'enregistre dans une table `integrations` (provider `garmin_personal`, date d'expiration, dernière synchro, statut) ;
  5. lance immédiatement une première synchro.
- **La clé ne revient jamais vers le navigateur**, n'est jamais écrite dans les logs et n'est jamais stockée dans `localStorage`.
- Affichage côté client : « ● Garmin liée · expire le 23/11/2027 · dernière synchro il y a 12 min », avec les boutons **Synchroniser** et **Délier**.
- « Délier » supprime la clé du serveur et rappelle de la supprimer aussi dans Garmin Connect.
- Le statut visible par l'app (liée, expiration, dernière synchro, erreur) vit hors de `integrations`, par exemple dans un record sans secret, pour que le client et le coach le voient en temps réel.

### 2.3 Synchronisation automatique (Edge Function `garmin-personal-sync`)
- **Déclenchement** :
  - **toutes les 30 minutes** par une tâche planifiée (suis le modèle de `daily-cron` et `0003_cron.sql`) ;
  - **à l'ouverture de l'app**, au plus une fois toutes les 5 minutes par utilisateur ;
  - par le bouton « Synchroniser ».
- **Pour chaque compte lié :**
  1. obtenir un jeton, réutilisé pendant sa validité et conservé chiffré ;
  2. récupérer **uniquement ce qui est nouveau depuis la dernière synchro** (au premier lien : les 14 derniers jours) ;
  3. pour chaque **activité de course**, écrire un `ImportedRun` (`source: 'garmin'`, `externalId` = id Garmin), en statut `a_rattacher`, avec les tours, le cardio, `splits` et `hrSeries`. Si le résumé JSON n'a pas les points détaillés, **télécharger le .FIT de l'activité** et réutiliser le lecteur de 1.7 ;
  4. pour chaque jour, écrire un record **« santé du jour »** : `date`, `steps`, `sleepMinutes`, et le score ou les phases de sommeil si Garmin les donne.
- **Idempotence** : relancer ne crée jamais de doublon.
- **Rattachement** : le serveur écrit seulement les `ImportedRun` ; le rattachement se fait côté app (1.2). Si tu juges plus fiable de le faire aussi côté serveur, garde le même code partagé dans `shared/`.
- **Modération** :
  - appels séquentiels, pas de parallélisme agressif ;
  - en cas de `429` ou d'erreur serveur, arrêt pour ce compte et nouvel essai au tour suivant ;
  - aucune boucle de nouvelles tentatives rapides.

### 2.4 Expiration et erreurs
- Notification au client **10 jours puis 2 jours** avant l'expiration (« Ta clé Garmin expire le … : crée-en une nouvelle et colle-la ici »). Le coach est prévenu aussi.
- En cas de `401` ou de clé expirée : statut « à renouveler », synchro arrêtée pour ce compte, notification au client et au coach. **Jamais d'erreur silencieuse.**

---

## Partie 3 : pas et sommeil (version simple)

- `Today` : une petite ligne « 8 412 pas · nuit 7 h 05 », si les données existent.
- Check-in : la question « sommeil » est **pré-remplie** à partir de la nuit Garmin. Le client peut la corriger.
- `ClientDetail` : les 7 derniers jours (pas et durée de sommeil), en petites barres Recharts.
- Les alertes basées sur le sommeil ou les pas viendront plus tard : n'en crée pas.

---

## Partie 4 : accès officiel Starter (préparé, désactivé)

- Une interface `RunProvider` dans `shared/` : `connect`, `callback`, `disconnect`, `sync` ou `receive`, et `parseActivity(payload) → ImportedRun`. Deux implémentations :
  - `garmin_personal` (partie 2, active) ;
  - `garmin` (OAuth Starter), avec tous les points non vérifiés marqués `TODO(garmin)`.
- Edge Functions `garmin-connect`, `garmin-callback` et `garmin-push` (réception des activités envoyées par Garmin : contrôle de l'origine, idempotence). **Elles sont écrites et testées avec des réponses simulées, mais pas déployées.**
- Profil : « Lier ma montre Garmin » (OAuth), masqué tant que `VITE_GARMIN_ENABLED` n'est pas à `true`.
- Passage de la clé perso à Starter : la clé perso est supprimée et le dédoublonnage par id Garmin évite tout double import.

---

## Contraintes

- **Pas d'IA** : les activités `garmin` et la santé du jour ne sont **jamais** envoyées aux appels Claude (`shared/ai-core.ts`, analyse du dimanche). L'analyse par règles reste autorisée. Mets ce filtre à **un seul endroit, testé**.
- **Sécurité** :
  - `integrations` est inaccessible à l'API publique (RLS activée, aucune politique de lecture ni d'écriture) ;
  - `service_role` et `GARMIN_KEY_SECRET` vivent seulement dans les secrets Supabase ;
  - le SQL va dans un fichier séparé, `supabase/garmin.sql` (table, tâche planifiée), à exécuter une fois.
- **Compatibilité** : les `RunLog` et programmes existants, sans les nouveaux champs, fonctionnent comme avant.
- **Tests** :
  - les tests existants restent verts ; `npm run typecheck` et `npm run build` passent ;
  - tests Vitest (et Deno pour les fonctions), avec des réponses Garmin simulées :
    - rattachement : même jour, matin et soir, veille ou lendemain cohérent, distance incohérente qui donne une sortie en plus, vélo ignoré, renfo jamais rattaché, doublon `externalId`, correction manuelle, course en mode libre ;
    - tours de travail ;
    - allure par km : splits, dernier km partiel, phrases de synthèse ;
    - FC : réduction de la série, temps par zone, FC max par défaut, alerte « EF trop intense » ;
    - pré-réponse « en partie » ;
    - les quatre règles d'adaptation ;
    - « Fait comme prévu » et saisie rapide ;
    - lecture .FIT et .zip (avec un petit `.fit` d'exemple dans `scripts/fixtures/`) ;
    - clé perso : chiffrement et déchiffrement, clé invalide refusée, coach non autorisé refusé, synchro incrémentale sans doublon, rappels J-10 et J-2, « à renouveler » sur `401`, arrêt sur `429` ;
    - pré-remplissage du sommeil ;
    - filtre « pas de données Garmin vers l'IA ».
- **Scripts e2e** (`scripts/e2e*.mjs`) : mets-les à jour si besoin, et ajoute un parcours « Fait comme prévu → bilan ». Ne renomme pas les classes CSS sur lesquelles ils s'appuient.
- **Design** : style « Apple Music » existant (tokens `src/index.css`, kit `src/ui/kit.tsx`, teinte course orange), clair et sombre, zones tactiles ≥ 44 px, `node scripts/audit-ui.mjs` sur les nouveaux écrans.
- **Démo (`src/lib/seed.ts`)** : pour Léa (marathon), quelques activités importées, avec allure par km et FC :
  - une EF déjà rattachée, avec son bilan rempli et l'alerte « EF trop intense » ;
  - un fractionné « à compléter » ;
  - une sortie longue avec un départ trop rapide ;
  - une sortie en plus ;
  - quelques jours de pas et de sommeil.
- Interface 100 % en français.

---

## Partie 5 : mise en service, en me guidant (je ne suis pas développeur)

1. **Fais toi-même tout ce qui ne demande pas mes identifiants** : installer la CLI Supabase (via `npx supabase` ou Homebrew), générer `GARMIN_KEY_SECRET`, préparer les commandes.
2. Pour ce qui demande **mon action**, donne-moi **une commande à la fois, prête à copier**, avec ce que je dois voir s'afficher :
   - `supabase login` ;
   - `supabase link` ;
   - `supabase secrets set …` ;
   - `supabase functions deploy garmin-personal-link garmin-personal-sync` ;
   - le SQL à coller dans le SQL Editor ;
   - l'activation de la tâche planifiée.
3. **Mode de test réel** : explique comment lancer l'app en local branchée sur le vrai Supabase (ex. `npm run dev -- --mode production`, qui lit `.env.production`), pour que je teste la liaison avec ma propre clé et ma montre avant de pousser.
4. **Ne me demande jamais de coller ma clé Garmin dans la conversation.** Je la colle uniquement dans MIND.
5. Ajoute une section « Garmin » à `MISE_EN_LIGNE.md` qui reprend ces étapes.

## Livraison
Ne me demande aucune validation : tranche seul les points ambigus. À la fin, donne-moi :
- l'URL locale et l'URL réseau (pour l'iPhone), en mode démo et en mode réel ;
- la liste courte des choix faits par défaut ;
- le résultat des tests ;
- **la liste exacte, dans l'ordre, de ce qu'il me reste à faire** pour que mon frère et ma compagne soient reliés.

Commite sur `main` (sans `supabase/setup.sql`). **Ne pousse pas** : je pousserai après avoir testé avec ma montre.
