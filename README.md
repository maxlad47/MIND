# MIND

Application web (PWA) de **génération et de suivi de programmes sportifs** : musculation, course à pied, ou les deux.
Elle s'installe sur l'écran d'accueil de l'iPhone et s'utilise comme une app native. Interface 100 % en français (kg, km, min/km).

> **Deux modes.** Sans clés Supabase : mode local (démo, données sur l'appareil). Avec `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` : comptes et données en ligne, avec synchronisation (`src/lib/remote.ts`) et vue coach en temps réel.
> **Pour publier : suis [MISE_EN_LIGNE.md](MISE_EN_LIGNE.md)** (GitHub Pages + Supabase, `supabase/setup.sql`).

---

## 1. Lancer l'app sur ton ordinateur

Il faut [Node.js](https://nodejs.org) (version 20 ou plus). Dans un terminal, depuis le dossier du projet :

```bash
npm install      # une seule fois
npm run dev      # lance l'app
```

Le terminal affiche deux adresses :

- `Local` → pour ouvrir sur l'ordinateur (ex. `http://localhost:5180`) ;
- `Network` → pour ouvrir **sur l'iPhone** (ex. `http://192.168.1.67:5180`). L'iPhone doit être sur le même Wi-Fi que l'ordinateur.

### Comptes de démonstration

Sur l'écran de connexion, deux boutons ouvrent la démo :

| Compte | Email | Mot de passe |
|---|---|---|
| Coach (Max) | `coach@mind.app` | `mind1234` |
| Client (Camille, muscu + semi-marathon) | `camille@demo.mind` | `mind1234` |
| Client en **mode libre** (Nina, PPL 4×/semaine en rotation) | `nina@demo.mind` | `mind1234` |

Trois autres clients sont visibles côté coach : Hugo (force, douleur à l'épaule), Léa (marathon) et Théo (qui décroche).
N'importe qui peut aussi **créer un compte** : il apparaît automatiquement dans la liste des clients du coach.
Le bouton « Réinitialiser les données de démo » (Profil) remet tout à zéro.

## 2. Ajouter MIND à l'écran d'accueil de l'iPhone

1. Ouvre l'adresse de l'app dans **Safari**.
2. Touche le bouton **Partager** (carré avec une flèche vers le haut).
3. Choisis **« Sur l'écran d'accueil »**, puis **Ajouter**.
4. Ouvre MIND depuis l'icône : elle s'affiche en plein écran, sans barre Safari.

> Les **notifications** sur iPhone demandent iOS 16.4 ou plus, l'app ajoutée à l'écran d'accueil, et une adresse en **HTTPS** (donc l'app déployée en ligne, pas l'adresse locale `http://`).

## 3. Les tests du moteur

```bash
npm test           # moteur (bibliothèque, allures, 5 profils types, adaptations), mode libre, formats, renfo, minuteur, store, synchronisation
npm run typecheck  # vérification TypeScript
```

Profils testés : débutant hypertrophie 3×/sem · intermédiaire force 4×/sem avec douleur à l'épaule · marathon dans 16 semaines (4 sorties, 3:45) · 10 km dans 5 semaines (préparation trop courte) · mixte 3 muscu + 2 course, priorité course.

## 4. Comment ça marche

```
src/engine/    Moteur de règles (TypeScript pur, sans interface) — fonctionne seul, sans IA
  exercises.ts   ~100 exercices de salle (muscle, schéma de mouvement, zones contre-indiquées, alternatives)
  strength.ts    split, volumes par muscle, reps, double progression, cycle de 8 semaines
  running.ts     allures (VMA, Riegel), phases Base→Affûtage, volumes ≤ +10 %/sem, séances détaillées
  combine.ts     placement dans la semaine + règles anti-conflit muscu/course
  adapt.ts       séances manquées, charges selon les reps réussies, allures, fatigue/douleur, analyse hebdo
  guardrails.ts  limites absolues (jamais dépassées, même par l'IA)
src/lib/       Données (store local), IA, notifications
src/pages/     Écrans
shared/        Code IA partagé avec les Edge Functions
supabase/      Schéma SQL, sécurité (RLS), fonctions serveur
```

### Mode libre (« J'ai déjà mon programme »)

Au premier écran du formulaire, le client choisit entre « MIND me crée mon programme » (défaut) et « J'ai déjà mon programme ». En mode libre, MIND ne génère rien : il sert de carnet d'entraînement.

- **Séances modèles** (Push, Pull, Legs…) : exercices ordonnés par glisser-déposer, séries, reps min–max, repos, poids de départ et note facultatifs. Exercices perso possibles (ids `custom:…`, suivis comme les autres, sans alternatives automatiques).
- **Planning** : *jours fixes* (un modèle par jour) ou *à la suite* (jours cochés + ordre des modèles, MIND enchaîne A → B → C → A…). En rotation, une séance manquée ne consomme pas son tour.
- Les séances sont de vraies `Session` dans `Program.weeks` (phase `Musculation`), sur une **fenêtre glissante** de 4 semaines prolongée à chaque ouverture (`runDailyJobs`). Modifier un modèle ou le planning ne met à jour que les séances futures prévues sans aucune série saisie.
- **Fin de séance** : si la séance diffère de son modèle, MIND propose de garder les changements. **Séance en plus** (bouton sur Aujourd'hui) : n'avance pas la rotation. Sortie de course libre : km, temps, ressenti.
- **Suggestions de charge** (Profil, désactivées par défaut) : double progression du moteur (`nextLoad`, `src/engine/adapt.ts`).
- **Mixer les deux** : *muscu libre + course MIND* (dans le formulaire libre, « Un plan de course avec MIND ? ») : le plan de course est généré et adapté par MIND (séances clés manquées déplacées, VMA, allègement sur douleur), dans les mêmes semaines que le carnet ; la muscu libre n'est jamais touchée. *Muscu MIND + course libre* : bouton « Sortie libre » sur Aujourd'hui (km, temps, ressenti).
- Aucun décalage automatique, aucune semaine allégée, aucun remplacement d'exercice. Restent actifs : alertes douleur / « décroche » / commentaires, et un bilan du dimanche sans suggestion de structure.
- **Passer d'un mode à l'autre** (Profil, ou fiche client côté coach) : l'ancien programme est archivé, l'historique (`lastPerformance`, Progrès) est conservé.
- **Données** : tout vit dans l'enregistrement `Program` (`mode`, `libre`), donc synchronisé avec le coach comme le reste ; aucune migration SQL. Code : `src/engine/libre.ts` (pur), écrans `src/ui/free.tsx`.

### Formats de séance, minuteur de repos et renfo coureur

Un exercice n'est plus limité à « N séries identiques » (qui reste le cas par défaut : un ancien programme, un ancien modèle ou un ancien `SetLog` s'affichent et se saisissent exactement comme avant).

- **Séries différentes et parties enchaînées** (`plan` sur `SessionExercise` / `TemplateExercise`, facultatif) : chaque série prévue a ses parties (reps ou durée, charge en **kg** (prioritaire) ou **relative en %** de la partie lourde, `restAfterSec` : 0 = enchaîné, 15 s en rest-pause). `SetLog` reçoit `part` et `seconds`. Le sélecteur **« Format »** préremplit : Classique · Pyramide (12/10/8/6) · Série lourde + séries allégées · Dégressive · Rest-pause · **Combo** (défaut : 1 rep lourde → 6 reps à −20 %, 3 séries). La charge relative se précalcule depuis la partie lourde saisie (arrondi 0,5 kg, modifiable).
- **Groupes d'exercices** (`Session.groups`, `SessionTemplate.groups`) : superset, triset, circuit, EMOM, AMRAP, chrono, avec tours, repos entre exercices, repos entre tours et durée. L'écran guide l'ordre (« Superset · Tour 2/4 », « A2 puis B2, puis repos » ; « Tour 2/3 · 3/5 Fentes arrière » ; « Minute 4/12 · Pogo jumps ×20 » ; décompte AMRAP et chronomètre qui survivent à un rechargement : tout se déduit d'un horodatage de départ). Étiquettes **A1/A2, B1/B2** (lettre = exercice, chiffre = tour) et liseré de couleur par type de groupe.
- **Minuteur de repos** (`src/lib/rest.ts`, bandeau `src/ui/rest.tsx`) : démarre à la validation d'une série, d'une partie ou d'un tour avec le bon repos (`restAfter` dans `src/engine/formats.ts`) ; enchaîné = signal « Enchaîne » sans minuteur. Il se base sur un **horodatage de fin** (écran verrouillé, retour d'arrière-plan, rechargement), −15 s / +15 s / Passer, son court à la fin si l'app est au premier plan (réglage dans le Profil), vibration seulement si elle existe (iOS Safari n'en a pas).
- **Génération (`strength.ts`)** : séance courte (≤ 60 min) dont le volume ne tient pas → supersets d'exercices opposés (jamais squat + soulevé de terre) ; hypertrophie intermédiaire / avancé → dégressive sur la dernière série d'1 ou 2 isolations (pas en semaine allégée) ; force intermédiaire / avancé → série lourde + séries allégées sur l'exercice principal ; **débutant : séries classiques uniquement** ; EMOM, AMRAP et chrono ne sont jamais générés. Progression d'une série lourde / combo / dégressive : toutes les parties atteignent leurs reps cibles → +2,5 kg sur la partie lourde (+1 kg haltères ou isolation) ; la double progression reste réservée aux séries classiques.
- **Renfo coureur** (`src/engine/renfo.ts`) : question « Ajouter du renfo coureur ? » (Non / 1 / 2 fois par semaine, matériel : sans matériel / élastique et haltères / salle ; désactivé pour un programme existant, 1 fois par semaine proposé pour un nouveau). Course seule : un **circuit de 20 à 30 min** (échauffement mobilité, 4 à 6 exercices × 2 à 4 tours) qui suit les phases (Base : gainage et force ; Développement : + 1 à 2 pliométries ; Spécifique : entretien ; Affûtage : volume ÷ 2, **aucune pliométrie à moins de 10 jours de la course, aucun renfo dans les 3 derniers jours**), +1 tour ou reps/durée en hausse toutes les 2 semaines, allégé avec les semaines allégées. Placement (`combine.ts`) : après une séance de qualité le même jour, ou un jour sans course ; **jamais la veille de la sortie longue ni d'une séance de qualité** (sinon la séance saute avec un `PlanWarning`). Programme mixte : pas de séance à part, 2 ou 3 exercices de coureur ajoutés à la fin des séances de muscu (bas du corps, full body), sans dépasser `maxMinutes`. Course en mode libre : deux modèles « Renfo coureur » tout faits dans « Mes séances ».
- **Données** : tout vit dans les enregistrements JSON existants (`Program`, `Session`, `SessionTemplate`), aucune migration SQL. La bibliothèque compte ~20 exercices de plus (`unit` secondes, `perSide`, `Equipment` « elastique », `renfo: true` = jamais choisi par le générateur de muscu) ; `supabase/seed.sql` est régénéré par `scripts/gen-seed.ts`.

### La couche IA (Claude)

L'IA personnalise le programme (note du coach pour chaque semaine, remplacements d'exercices) et produit l'analyse du dimanche avec des suggestions que le client ou le coach **accepte ou refuse**.

- Elle est appelée **uniquement côté serveur** : jamais de clé dans le navigateur.
- Ses réponses sont validées par un schéma (Zod) puis par les garde-fous du moteur. Si elle échoue, le résultat du moteur de règles est conservé.
- En local, crée un fichier `.env.local` à la racine avec `ANTHROPIC_API_KEY=sk-ant-...` : le serveur de développement relaie les appels à Claude (modèle `claude-sonnet-5-5`). Sans clé, l'app marche normalement avec le moteur de règles.

## 5. Mettre en ligne

### a) Supabase (base de données, comptes, fonctions serveur)

1. Crée un compte sur [supabase.com](https://supabase.com) puis un **nouveau projet**.
2. Dans **SQL Editor**, exécute dans l'ordre : `supabase/migrations/0001_schema.sql`, `0002_rls.sql`, puis `supabase/seed.sql` (bibliothèque d'exercices).
3. Dans `0001_schema.sql`, remplace `REMPLACER@VOTRE-EMAIL.COM` par **ton email de coach** : le compte qui s'inscrit avec cet email reçoit le rôle `coach`, tous les autres sont `client`.
4. **Authentication → Providers** : active Email (mot de passe + lien magique).
5. Installe la [CLI Supabase](https://supabase.com/docs/guides/cli), puis :
   ```bash
   supabase login
   supabase link --project-ref <PROJECT_REF>
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-... VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... COACH_EMAIL=ton@email.com
   supabase functions deploy ai-personalize ai-weekly-analysis daily-cron
   ```
   Les clés VAPID se génèrent avec `npx web-push generate-vapid-keys`.
6. Active les tâches planifiées avec `supabase/migrations/0003_cron.sql` (rappels de séance, analyse du dimanche soir).

### b) Variables d'environnement

Copie `.env.example` vers `.env.local` et remplis :

| Variable | Où | Rôle |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | front (publiques) | connexion à Supabase |
| `VITE_VAPID_PUBLIC_KEY` | front (publique) | abonnement aux notifications |
| `ANTHROPIC_API_KEY` | serveur uniquement | appels à Claude |
| `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY` | Edge Functions uniquement | envoi des notifications |
| `COACH_EMAIL` | Edge Functions / base | email du coach |

La clé `service_role` de Supabase et la clé Anthropic ne doivent **jamais** apparaître dans le front.

### c) Le site (Vercel ou Netlify)

1. Pousse le projet sur GitHub, puis « Import project » sur [vercel.com](https://vercel.com) (ou Netlify).
2. Commande de build : `npm run build` · dossier de sortie : `dist`.
3. Ajoute les variables `VITE_...` dans les réglages du projet.
4. Ouvre l'adresse HTTPS obtenue sur l'iPhone et suis la partie 2 ci-dessus.

> **Reste à faire pour la version en ligne :** brancher le front sur Supabase (remplacer `src/lib/store.ts`, qui stocke dans le navigateur, par des appels Supabase suivant les tables de `0001_schema.sql`). Le moteur, les écrans et la couche IA n'ont pas besoin de changer.

## 6. Design (refonte « Apple Music »)

- **Tokens** dans `src/index.css` : couleurs (sombre = référence, clair automatique ou choisi dans Profil), rayons, ombres, classes de typographie (`t-large` 34 px, `t-title2`…), verre dépoli (`.glass`, `.glass-strong`), retour au tap (`.tap`), zones tactiles élargies à 44 px (`.hit`), squelettes (`.skeleton`).
- **Kit** `src/ui/kit.tsx` : `Page` (gros titre → titre centré dans la barre au scroll, option `hero` pour une pochette pleine largeur), `TabBar` (icônes pleines quand actives), `Sheet` (feuille qui se tire par la poignée), `Button`, `Chip`, `Segmented`, `Ring` (anneaux), `StatTile`, `Toggle`, `EmptyState`/`ErrorState`/`PageSkeleton`, `SportIcon` (haltère + coureur).
- **Pochettes** `src/ui/cover.ts` : six compositions générées par code (aurore, soleil, anneaux, rayures, orbes, éventail), déterministes à partir de l'id, teintes violet/magenta (muscu) ou orange/rouge (course), grain léger. `<Cover seed sports>` les affiche.
- **Mouvement** `src/ui/motion.tsx` : écran de démarrage animé (une fois par session), glissement iOS vers les écrans de détail (`PagePush`), fondu entre onglets (`PageFade`). Les animations respectent « Réduire les animations » d'iOS.
- **Icône d'app et écrans de démarrage iOS** : `public/icon.svg`, puis `node scripts/icons.mjs` et `node scripts/splash.mjs`.
- **Contrôles visuels** : `node scripts/shots2.mjs dark|light` (captures dans `/tmp/shots/d`), `node scripts/shots3.mjs` (feuilles, glisser-déposer), `node scripts/audit-ui.mjs` (pas de scroll horizontal, zones tactiles ≥ 44 px).

## 7. V2 prévue (non bloquée)

Import Strava / Apple Santé / Garmin (la table `run_logs` a déjà une colonne `source`), mode hors connexion complet, suivi du poids et des mensurations, export PDF, vidéos d'exercices, minuteur de repos, autres distances et objectifs, nutrition.

- **RIR** : plus saisi ni affiché dans l'interface ; le champ reste en base (compatibilité) et vaut la cible de l'exercice, donc la progression ne dépend que des reps réussies.
