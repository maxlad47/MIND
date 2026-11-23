# MIND — Mode libre (« J'ai déjà mon programme »)

Lis d'abord `README.md`, puis `src/engine/types.ts`, `src/lib/store.ts`, `src/lib/remote.ts`, `src/pages/Onboarding.tsx`, `src/pages/SessionPage.tsx`, `src/pages/Today.tsx`, `src/pages/Coach.tsx`, `src/pages/ClientDetail.tsx` et `src/ui/kit.tsx`.

## Objectif

Certains clients ont déjà leur programme : ils veulent seulement utiliser MIND comme carnet d'entraînement. Le **mode libre** leur permet de :

- créer leurs propres **séances modèles** (ex. Push, Pull, Legs) ;
- les placer dans leur semaine ;
- saisir leurs séances avec le même écran que d'habitude, en voyant ce qu'ils ont fait la dernière fois.

Dans ce mode, MIND ne génère aucun programme. Il aide à suivre le programme du client.

Cette version couvre **la muscu seulement**. Pour la course, le client saisit une sortie libre (km, temps, ressenti, comme `logRun` aujourd'hui).

## Ce qu'il faut construire

### 1. Le choix au formulaire (`Onboarding.tsx`)
- Nouvelle **première étape** : « MIND me crée mon programme » (par défaut, le parcours actuel ne change pas) ou « J'ai déjà mon programme ».
- En mode libre, le client répond uniquement aux étapes identité (prénom, date de naissance, sexe, poids, taille) et blessures. Toutes les étapes de génération sont sautées, via le mécanisme `when` des étapes.
- À la fin, il arrive sur **« Mes séances »** : un état vide qui le guide pour créer sa première séance modèle, puis pour régler son planning.
- Ajouter `mode?: 'genere' | 'libre'` au `Questionnaire` et au `Program`. **Absent = `'genere'`**, pour que les programmes existants (en local et dans Supabase) restent compatibles.

### 2. Les séances modèles (nouvel écran « Mes séances » + éditeur en `Sheet`)
- Une séance modèle contient : un nom, une liste d'exercices ordonnés, et pour chaque exercice les séries, `repMin`–`repMax`, le repos, un RIR visé (facultatif) et une note (facultative).
- Le client peut ajouter des exercices avec `ExercisePicker`, les réordonner par glisser-déposer (`@dnd-kit`, déjà installé), dupliquer ou supprimer une séance, et la renommer.
- **Exercice perso** : depuis le sélecteur, « Créer un exercice » demande un nom et un muscle principal (`Muscle`). Il est suivi comme les autres : charges, dernière performance, graphiques. Il n'a pas d'alternatives automatiques.
  - Ses ids doivent être reconnaissables (ex. préfixe `custom:`).
  - Chaque endroit qui résout un `exerciseId` (nom, muscle, Progress, lastPerformance…) doit gérer ces exercices sans planter.
  - Fais un `grep` des usages de la bibliothèque avant de choisir où stocker les exercices perso.
- Chaque séance modèle reçoit une pochette `Cover` (seed = id du modèle, teinte muscu violette).

### 3. Le planning (deux modes au choix, avec un `Segmented`)
- **Jours fixes** : chaque jour de la semaine est associé à un modèle, ou reste en repos (ex. lun = Push, mer = Pull, ven = Legs).
- **À la suite** : le client coche ses jours d'entraînement et ordonne ses modèles. MIND les enchaîne A → B → C → A… ; un PPL fait 4×/sem tourne donc tout seul.
  - En rotation, **une séance manquée ne consomme pas son tour** : les séances futures encore `prevue` sont recalculées à partir du dernier modèle fait.
  - En jours fixes, une séance manquée reste simplement manquée.
- Les séances sont générées comme de vraies `Session` dans `Program.weeks`, avec la phase `'Musculation'` et `light: false`. Ainsi `Today`, `ProgramPage`, `WeekStrip`, `SessionPage` et `Progress` fonctionnent sans modification.
- **Pas de fin de cycle.** La fenêtre est glissante : générer environ 4 semaines d'avance et prolonger dans `runDailyJobs`.
- Modifier un modèle ou le planning met à jour **seulement les séances futures `prevue` sans aucune série saisie**. Les séances passées ou faites ne bougent jamais.

### 4. Pendant et après la séance (`SessionPage.tsx`)
- C'est le même écran qu'aujourd'hui, avec la dernière performance déjà affichée.
- **Suggestion de charge** : un interrupteur « Suggestions de charge » dans le Profil, **désactivé par défaut**. Activé, il remplit `targetKg` avec la logique de double progression déjà présente dans le moteur (`strength.ts` / `adapt.ts`) : réutilise-la, ne la recode pas. Désactivé, aucune charge cible n'est affichée.
  - Stocke ce réglage sans migration SQL, par exemple dans le programme.
- **En fin de séance**, si la séance diffère de son modèle (exercice ajouté, retiré, remplacé ou réordonné, séries, reps ou repos changés), afficher une `Sheet` : « Tu as changé N choses. Les garder pour tes prochains {nom} ? » avec la liste des changements.
  - **Oui** : le modèle et les séances futures sont mis à jour.
  - **Non** : le changement reste ponctuel.
  - Les charges saisies ne comptent pas comme des changements.
- **« Séance en plus »** : un bouton sur `Today`. Le client choisit un de ses modèles ou part d'une séance vide, datée d'aujourd'hui (marquer la séance, ex. `extra: true`).
  - Elle compte dans les stats.
  - Elle ne décale pas le planning et ne fait pas avancer la rotation.

### 5. Ce que MIND ne fait PAS en mode libre
- **Aucune réorganisation automatique** : pas de décalage des séances manquées, pas de semaine allégée, pas de remplacement automatique d'exercice, pas de `startNextCycle`.
  - Vérifie `runDailyJobs`, `adapt.ts`, `acceptAdaptation`, `finishStrength` et le `WarningBanner` : chacun doit ignorer les programmes en mode libre ou s'y adapter.
- Ce qui reste actif :
  - les alertes coach : douleur au check-in, « décroche » après 7 jours sans séance, commentaires ;
  - l'analyse du dimanche, en simple bilan, sans suggestion qui touche à la structure du programme.

### 6. Côté coach
- Badge **« Libre »** sur le client dans `Coach.tsx` et dans `ClientDetail.tsx`.
- Depuis la fiche client, le coach ouvre les séances modèles et le planning du client et peut les **modifier** avec le même éditeur. Le client reçoit une notification (`notify`) : « Max a modifié ta séance Push ».

### 7. Passer d'un mode à l'autre (Profil côté client, fiche client côté coach)
- **Libre → MIND** : ouvre le formulaire en mode génération, pré-rempli.
  - Les charges de référence (squat, développé couché, soulevé de terre, développé militaire) sont estimées à partir de l'historique quand les exercices correspondent.
  - L'ancien programme passe en `archive`.
- **MIND → Libre** : propose « Partir de mon programme actuel ». MIND crée un modèle par séance distincte de la semaine en cours et le planning en jours fixes correspondant, pour que le client n'ait rien à ressaisir. Option : partir de zéro.
- Dans les deux sens, **l'historique des séances et des charges est conservé** : `lastPerformance` et Progress doivent continuer à trouver les anciennes séances.

## Contraintes

- **Synchronisation Supabase** : les données sont des enregistrements JSON génériques (`records` avec un `kind`, voir `supabase/setup.sql` et `src/lib/remote.ts`). **Aucune migration SQL n'est nécessaire.** Suis le schéma de sync existant : soit les modèles vivent dans le `Program`, soit tu ajoutes un nouveau `kind` dans `remote.ts`. Choisis la solution la plus simple et vérifie que le coach reçoit bien les changements en temps réel.
- **Compatibilité** : un programme sans `mode` fonctionne exactement comme aujourd'hui.
- **Tests** :
  - les 79 tests existants restent verts ;
  - `npm run typecheck` et `npm run build` passent ;
  - ajouter des tests Vitest pour la génération du planning : jours fixes, rotation 3 modèles sur 3 jours, PPL 4×/sem en rotation (la semaine 2 commence par Pull), séance manquée en rotation, modification d'un modèle propagée seulement aux séances futures vierges, détection des différences séance/modèle, séance en plus sans effet sur la rotation, bascule MIND → Libre.
- **Scripts e2e** (`scripts/e2e*.mjs`) : la nouvelle première étape du formulaire va les décaler, donc mets-les à jour. Ne renomme pas les classes CSS sur lesquelles ils s'appuient (`.bg-surface.rounded-2xl.p-3\.5` dans Onboarding, `.bg-surface2.rounded-xl.p-3` dans ExercisePicker).
- **Design** : reste dans le style « Apple Music » existant. Utilise les tokens de `src/index.css` et le kit `src/ui/kit.tsx` (`Page`, `Sheet`, `Button`, `Chip`, `Segmented`, `EmptyState`, `Toggle`), des zones tactiles ≥ 44 px, les thèmes clair et sombre. Passe `node scripts/audit-ui.mjs` sur les nouveaux écrans.
- **Démo** : ajoute dans `src/lib/seed.ts` un client démo en mode libre : Nina, PPL 4×/sem en rotation, 3 semaines d'historique avec des charges qui progressent, un exercice perso. Elle doit être visible côté coach et avoir son propre compte démo (`nina@demo.mind` / `mind1234`).
- Interface 100 % en français.

## Hors périmètre (V2, ne pas coder)
- Import d'un programme collé en texte ou pris en photo, transformé en séances modèles par Claude (nécessite les fonctions serveur IA).
- Séances de course modèles (fractionné perso).

## Livraison
Ne me demande aucune validation : tranche seul les points ambigus. À la fin, donne-moi :
- l'URL locale et l'URL réseau (pour l'iPhone) du serveur de dev ;
- la liste courte des choix faits par défaut ;
- le résultat des tests.

Commite sur `main`, **sans pousser** : je teste d'abord en local.
