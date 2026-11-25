# MIND — Formats de séance (séries différentes, supersets, circuits, EMOM/AMRAP), minuteur de repos et renfo coureur

Lis d'abord `README.md`, puis :
- moteur : `src/engine/types.ts` (`SessionExercise`, `SetLog`, `TemplateExercise`, `SessionTemplate`, `Exercise`, `Equipment`, `Pattern`), `src/engine/exercises.ts`, `src/engine/strength.ts`, `src/engine/running.ts`, `src/engine/combine.ts`, `src/engine/adapt.ts` ;
- données : `src/lib/store.ts` (`logSet`, `unlogSet`, `finishStrength`, `lastPerformance`) ;
- écrans : `src/pages/SessionPage.tsx`, l'éditeur de séances modèles du mode libre, `src/pages/Progress.tsx` et `src/pages/Onboarding.tsx`.

## Objectif

Aujourd'hui, un exercice ne peut être que « N séries identiques » (ex. 4 × 8–10, repos 2 min). Les clients doivent pouvoir saisir et suivre des formats plus riches. Le cas réel qui sert de référence : un client fait au développé couché **3 séries de « 1 rep lourde, puis tout de suite 6 reps plus légères »**, ce qui est impossible à saisir aujourd'hui.

Trois volets :
1. **Formats de séance**, en mode libre comme en mode généré.
2. **Minuteur de repos**.
3. **Renfo coureur** généré par MIND pour les coureurs, et intégré aux séances muscu des programmes mixtes.

## 1. Le modèle : deux briques

### Brique A : des séries différentes à l'intérieur d'un exercice
- Un exercice peut avoir une **liste de séries prévues**, chacune avec sa cible : reps (fixe ou fourchette) **ou durée** en secondes, charge facultative (absolue en kg, ou **relative en %** de la partie lourde ou de la première série), RIR facultatif.
- Une série peut se découper en **parties enchaînées**. Chaque partie a sa cible et un `restAfterSec` (0 = enchaîné ; 10–20 s pour le rest-pause).
- Les **séries identiques actuelles restent le cas par défaut**. `sets`, `repMin`, `repMax` et `rir` continuent de fonctionner tels quels, et un exercice sans série détaillée s'affiche et se saisit exactement comme aujourd'hui. Ajoute la nouvelle structure en **champ facultatif**, aussi bien sur `SessionExercise` que sur `TemplateExercise`. Les programmes déjà enregistrés en local et dans Supabase ne doivent pas casser.
- `SetLog` reçoit l'indice de la partie (ex. `part?: number`) et, si besoin, `seconds?` pour les exercices en durée.

### Brique B : des exercices regroupés
- Une séance peut regrouper des exercices en **groupes**, avec `kind` parmi :
  - `superset` : 2 exercices ;
  - `triset` : 3 exercices ;
  - `circuit` : N exercices × N tours ;
  - `emom` : chaque minute, un exercice ou une alternance, pendant N minutes ;
  - `amrap` : le maximum de tours en N minutes ;
  - `chrono` : « pour le temps », finir le travail le plus vite possible.
- Paramètres d'un groupe : nombre de tours, repos entre exercices, repos entre tours, durée totale (EMOM, AMRAP).
- Un exercice hors groupe reste un exercice seul, comme aujourd'hui.

### Exercices
- Ajouter la notion d'**unité** (reps ou secondes) et de **« par côté »** pour les exercices unilatéraux.
- Ajouter `'elastique'` à `Equipment`.
- Ajouter à la bibliothèque une vingtaine d'exercices de renfo coureur, avec `contra` et `alts` cohérents :
  - gainage : planche, planche latérale, Copenhague, dead bug, bird dog ;
  - force : pont fessier unilatéral, hip thrust, step-up, squat bulgare, fente arrière, fente marchée, chaise, nordic, mollets debout en excentrique, mollets genou fléchi ;
  - pliométrie : squat jump, bonds alternés, skipping, pogo jumps, sauts latéraux ;
  - élastique : monster walk, abduction.
- Mettre à jour le seed d'exercices Supabase si la bibliothèque y est dupliquée (`scripts/gen-seed.ts`, `supabase/seed.sql`).

## 2. Les formats tout faits (saisie)

Dans l'éditeur de séances modèles et dans l'ajout ou la modification d'exercice en séance, un sélecteur **« Format »** préremplit la structure, que le client ajuste ensuite :

| Format | Préremplissage |
|---|---|
| Classique | N × reps, comme aujourd'hui |
| Pyramide | Reps qui descendent (12/10/8/6), charge qui monte |
| Série lourde + séries allégées | 1 série lourde de 3 à 5 reps, puis 3 séries à −10/−15 % |
| Dégressive | Une série = 3 parties enchaînées, −20 % à chaque partie |
| Rest-pause | Une série = 3 parties à la même charge, 15 s entre elles |
| Combo | Une partie lourde courte, puis une partie plus légère, enchaînées. Défaut : 1 rep lourde → 6 reps à −20 %, 3 séries |
| Superset / Triset / Circuit / EMOM / AMRAP / Chrono | On choisit les exercices du groupe, puis les tours, les repos et la durée |

Le cas de référence doit se saisir en moins de 30 secondes : Développé couché → Format « Combo » → 3 séries → 1 rep, puis 6 reps à −20 % (préremplis).

## 3. Pendant la séance (`SessionPage.tsx`)

- **L'écran guide l'ordre** :
  - superset : « Superset · Tour 2/4 », A2 puis B2, puis repos ;
  - circuit : « Tour 2/3 · 3/5 Fentes arrière » ;
  - EMOM : « Minute 4/12 · Pogo jumps ×20 » avec décompte ;
  - AMRAP : décompte global et compteur de tours ;
  - chrono : chronomètre.
- **Saisie** :
  - séries et parties : kg et reps pour chaque partie, la charge relative précalculée à partir de la partie lourde saisie (arrondie à 0,5 kg, modifiable) ;
  - circuits et renfo : un bouton **« Tour N fait »** suffit, les charges et reps par exercice restent facultatives ;
  - AMRAP : nombre de tours (et reps de la dernière, facultatif) ;
  - chrono : temps final.
- **« La dernière fois »** s'affiche partie par partie (« 1 × 100 kg + 6 × 80 kg »). Mets à jour `lastPerformance` en conséquence.
- **Fin de séance du mode libre** : la détection « Tu as changé N choses, les garder pour tes prochains … ? » doit couvrir les changements de format, de groupes et de parties.

## 4. Minuteur de repos

- Il **démarre automatiquement** quand une série, une partie ou un tour est validé, avec le bon repos :
  - le `restAfterSec` de la partie (enchaîné = pas de minuteur, mais un signal « Enchaîne ») ;
  - le repos entre exercices d'un groupe ;
  - le repos après le groupe ou entre les tours ;
  - le `restSec` de l'exercice.
- Il s'affiche en bandeau compact au-dessus de la barre d'onglets, en verre dépoli (`.glass`). Boutons −15 s, +15 s et Passer. La séance reste accessible en dessous.
- Il **se base sur un horodatage de fin**, pas sur un compteur : quand l'iPhone verrouille l'écran ou met l'app en arrière-plan, le temps restant est juste au retour. Il survit à un rechargement de la page.
- Fin du repos : un son court, si le son est autorisé et l'app au premier plan, et une animation visuelle. **iOS Safari ne gère pas la vibration** (`navigator.vibrate`) : utilise-la seulement si elle existe, sans en dépendre.
- Un réglage dans le Profil permet de couper le son.

## 5. Ce que fait MIND en mode « programme généré » (`strength.ts`)

Règles, couvertes par des tests :
- **Séance courte** (`maxMinutes` ≤ 60) dont le volume prévu ne tient pas dans le temps : grouper des **exercices opposés en supersets** (poussée/tirage horizontal, poussée/tirage vertical, biceps/triceps, extension/flexion de jambe), en recalculant l'estimation de durée. Ne jamais mettre deux exercices lourds et techniques de jambes en superset (squat + soulevé de terre).
- **Hypertrophie, niveau intermédiaire ou avancé** : une **dégressive sur la dernière série** de 1 ou 2 exercices d'isolation par séance, jamais sur un polyarticulaire lourd. Pas de dégressive pendant les semaines allégées.
- **Force, niveau intermédiaire ou avancé** : l'exercice principal passe en **série lourde + séries allégées**.
- **Débutant** : séries classiques uniquement.
- EMOM, AMRAP et chrono ne sont **jamais** générés pour la muscu : ils sont réservés au mode libre.
- Les garde-fous (`guardrails.ts`) s'appliquent toujours, et les zones contre-indiquées restent respectées.

**Progression** :
- La double progression automatique reste réservée aux **séries classiques**.
- Pour une série lourde, un combo ou une dégressive : si toutes les parties atteignent leurs reps cibles avec le RIR visé, MIND propose +2,5 kg sur la partie lourde (+1 kg sur haltères ou isolation). Les parties relatives suivent automatiquement.
- En mode libre, cette suggestion n'apparaît que si « Suggestions de charge » est activé.

**Stats (`Progress.tsx`)** :
- le volume (tonnage) compte toutes les parties ;
- l'estimation du max utilise la meilleure partie, donc la rep lourde d'un combo compte ;
- les tours de circuit et les AMRAP s'affichent sans fausser le tonnage.

## 6. Renfo coureur (`running.ts`, `combine.ts`, formulaire)

### Formulaire, partie course
- « Ajouter du renfo coureur ? » : Non / 1 fois par semaine / 2 fois par semaine.
- Si oui, le **matériel** : « À la maison, sans matériel » / « À la maison, avec élastique et haltères » / « En salle ».
- Valeurs par défaut : désactivé pour un programme existant, **proposé à 1 fois par semaine** pour un nouveau programme course.

### Contenu
Un **circuit** de 20 à 30 minutes, avec échauffement (5 min de mobilité), 4 à 6 exercices × 2 à 4 tours, et des exercices filtrés par matériel et par zones contre-indiquées. Le contenu dépend de la phase :

| Phase | Contenu |
|---|---|
| Base | Gainage et force (fentes, squat bulgare, mollets en excentrique, pont fessier, Copenhague) |
| Développement | Mêmes bases + 1 ou 2 exercices de pliométrie (sauts, bonds, skipping, pogo) |
| Spécifique | Entretien : moins de tours, la pliométrie est conservée |
| Affûtage | Volume divisé par deux. **Aucune pliométrie dans les 10 jours avant la course.** Pas de renfo dans les 3 derniers jours |

- **Progression** : toutes les 2 semaines, +1 tour, ou reps et durée en hausse (ex. planche 30 s → 40 s → 50 s). Les semaines allégées du plan allègent aussi le renfo.
- **Placement (`combine.ts`)** : après une séance de qualité (VMA, seuil, spécifique, côtes) le même jour, ou un jour sans course. **Jamais la veille de la sortie longue, ni la veille d'une séance de qualité.** Si la semaine ne le permet pas, afficher un `PlanWarning`, comme pour les autres conflits de placement.
- La séance de renfo est une `Session` muscu (`kind` dédié, ex. `'renfo'`) affichée avec la teinte course. Sa durée compte dans la semaine.

### Programme mixte (muscu + course)
- Pas de séance de renfo à part.
- MIND ajoute **2 ou 3 exercices de coureur** dans les séances muscu existantes, de préférence en fin de séance de bas du corps ou de full body : mollets en excentrique, gainage latéral ou Copenhague, un exercice unilatéral si la séance n'en a pas.
- Ne pas dépasser `maxMinutes`, et respecter les règles anti-conflit muscu/course existantes.

### Course en mode libre, muscu générée (et inverse)
Le renfo s'attache à la partie **course générée par MIND**. Si la course est en mode libre, MIND ne génère pas de renfo, mais 2 modèles « Renfo coureur » tout faits sont proposés dans « Mes séances » : sans matériel, et avec élastique.

## Contraintes

- **Compatibilité totale** : un programme, un modèle ou un `SetLog` existant, sans les nouveaux champs, fonctionne et s'affiche comme avant.
- **Synchronisation Supabase** : les nouvelles structures vivent dans les records JSON existants. **Aucune migration SQL.**
- **Tests** :
  - les tests existants restent verts ; `npm run typecheck` et `npm run build` passent ;
  - ajouter des tests Vitest pour :
    - saisie et dernière performance du combo 1+6 ×3 ;
    - charges relatives arrondies ;
    - dégressive ;
    - ordre de passage d'un superset et d'un circuit ;
    - minuteur : bon repos selon la position, calcul depuis l'horodatage ;
    - règles de génération (superset si séance courte, dégressive en hypertrophie intermédiaire seulement, série lourde + séries allégées en force, rien chez le débutant) ;
    - progression d'un combo ;
    - tonnage et estimation du max avec parties ;
    - renfo : contenu par phase, aucune pliométrie à moins de 10 jours de la course, placement jamais la veille de la longue ou d'une séance de qualité, filtre matériel, compléments en programme mixte sans dépasser `maxMinutes` ;
    - compatibilité d'un ancien programme.
- **Scripts e2e** (`scripts/e2e*.mjs`) : mets-les à jour si le formulaire change, sans renommer les classes CSS sur lesquelles ils s'appuient (`.bg-surface.rounded-2xl.p-3\.5` dans Onboarding, `.bg-surface2.rounded-xl.p-3` dans ExercisePicker).
- **Design** :
  - style « Apple Music » existant (tokens `src/index.css`, kit `src/ui/kit.tsx`), clair et sombre, zones tactiles ≥ 44 px, `node scripts/audit-ui.mjs` ;
  - les groupes sont identifiables d'un coup d'œil : un liseré ou un cartouche commun, et des étiquettes A1/A2, B1/B2 ;
  - le format est affiché sous le nom de l'exercice (« Combo · 1 + 6 », « Dégressive · 3 parties »).
- **Démo (`src/lib/seed.ts`)** :
  - Nina (mode libre) : un combo 1+6 au développé couché et un superset ;
  - Hugo (force) : une série lourde + séries allégées ;
  - Léa (marathon) : le renfo coureur activé, 1 fois par semaine sans matériel ;
  - Camille (mixte) : les compléments de coureur dans ses séances muscu.
- Interface 100 % en français.

## Livraison
Ne me demande aucune validation : tranche seul les points ambigus. À la fin, donne-moi :
- l'URL locale et l'URL réseau (pour l'iPhone) ;
- la liste courte des choix faits par défaut ;
- le résultat des tests.

Commite sur `main`, **sans pousser**.
