# MIND — Avancement et plan jusqu'à la V1 testable

Document de travail. Code de V1-M0 à V1-M4 écrit et publié sur GitHub Pages ; restent les tests sur téléphones (section 11).

Légende « qui » : **Max** = action de Max · **Claude** = action de Claude Code (modèle indiqué selon MISSIONS.md).
« État » : vocabulaire défini dans CLAUDE.md. Le suivi détaillé appartient à Max (MISSIONS.md).
Version de référence des règles : **REGLES.md v8** (20/11/2026). Un seul fichier de règles ; anciennes versions dans Git.

---

## 1. Périmètre V1 (résumé)

1. La V1 pose le socle technique et les données. Elle ne génère encore aucun entraînement.
2. Inclus : modèle de données versionné (V1-M0), projet React + Vite avec `src/moteur/` vide et Vitest (V1-M1).
3. Inclus : publication sur GitHub Pages, installation sur l'écran d'accueil, message « Nouvelle version disponible » (V1-M2).
4. Inclus : profil utilisateur rempli par un formulaire simple avec valeurs par défaut, enregistré et modifiable (V1-M3).
5. Inclus : sauvegarde export / import avec rappel, restauration testée sur un autre téléphone (V1-M4).
6. Prérequis : V0-M5 (documents, fait). V0-M6 (plans papier) bloque seulement l'étape 2, pas le reste de V1.
7. Hors V1 : premier lancement en 3 questions (V5-M3), mention santé (V5-M4), génération muscu, plans de course, saisie en salle, retour après séance, style musical.
8. Critère de V1 testable : l'appli s'installe sur iPhone et Android depuis `maxlad47.github.io/MIND/`, le profil persiste après fermeture, et une sauvegarde restaure le profil sur un autre téléphone.
9. Hébergement : pas de compte, pas de serveur, données locales uniquement.
10. Aucune IA dans l'appli (DECISIONS.md, 16/11/2026).

---

## 2. Points flous ou contradictoires

### Tranchés par Max le 16/11/2026

- **Chrono et débutant** : N7 s'applique sans chrono (EF uniquement, test 6 min en semaine 1). La table N s'applique dès qu'un chrono 10 km existe. Le débutant suit la même règle.
- **Test 6 min et allures** : VMA = distance en km × 10. Chrono 10 km estimé = 10 ÷ (0,90 × VMA), 85 % pour un coureur rouillé ou débutant. Autres distances par Riegel. Formule et source dans A1 et T3.
- **Back-off** : M21 s'applique (M1 et M2 seulement). M20 réécrit.
- **« Sans agent »** : pas d'agent IA dans l'appli. Claude Code reste un outil de développement.
- **Dépôt GitHub** : `maxlad47/MIND`, créé par Max lui-même. Claude initialise git en local.
- **Style musical** : retiré du profil V1 et de CADRAGE §3 ; réintroduit avec la musique (après V6).
- **Séances modèles muscu** : Claude rédige le premier jet, Max corrige.
- **Refus fort** : C9 non levable. S et P5 bloquantes mais levables avec confirmation explicite. Liste unique dans REGLES U7.
- **Sortie longue avec blocs** : reste une sortie longue ; ses blocs rapides comptent dans S2 et S2b.
- **Profil V1** : formulaire simple avec valeurs par défaut. Premier lancement en 3 questions reporté à V5.
- **Données de test** : ~~profils fictifs A, B, C uniquement~~ → profils A, B, C réels anonymisés, chronos conservés (17/11/2026) ; vérification manuelle avant chaque publication.
- **Noms dans le dépôt public** : prénoms remplacés dans CADRAGE §2 et MISSIONS V3-M6.
- **V0-M6** : statut à confirmer par Max ; bloque seulement l'étape 2.
- **Version de référence** : REGLES.md v5. La demande « v4 » est corrigée.
- **V0-M0 à V0-M4** : non suivies dans MISSIONS.md, ne bloquent pas V1. Aucun statut inventé.
- **Étape 10** : reste hors mission.
- **V5-M4** (mention santé) : Sonnet.
- **Volume** : retiré des règles de niveau. Le niveau dépend du chrono 10 km (table N) et de l'ajustement N2.
- **Règles de CLAUDE.md** : pas de commit ni push sans demande ; anonymat du dépôt public. Acceptées.
- **Modèle de données (étape 4)** : stockage local ; semaines du lundi ; charge recalculée, non stockée ; import par remplacement avec copie de sécurité automatique ; palier machine 2,5 kg par défaut ; migrations dans `src/donnees/`. Validé.

### Encore ouverts

Aucun point ouvert de décision.

---

## 3. Plan d'étapes jusqu'à la V1 testable

Ordre (décision de Max) : étapes 2 et 3 en parallèle de l'étape 4 ; étapes 4 et 5 indépendantes. Les étapes 6 à 9 suivent l'étape 4 ; l'étape 6 suit aussi 5b.

| # | Étape | Mission | Modèle | État | Qui |
|---|---|---|---|---|---|
| 0 | Trancher les points flous | hors mission | — | Fait (16/11/2026) | Max a tranché ; Claude a reporté dans les documents |
| 1 | Créer CLAUDE.md et aligner les missions | V0-M5 | Opus | Fait (16/11/2026, version corrigée à v5) | Claude a rédigé ; Max a validé |
| 2 | Tester les règles à la main sur les profils fictifs A, B, C et produire les plans papier | V0-M6 | Opus | Validé Max (18/11/2026) : plans A, B, C version 3 dans `plans/` (section 14) | Max confirme le statut ; Claude aide à produire les plans |
| 3 | Ajouter `data/exercices.json` | V0-M7 | Sonnet (fait en Opus sur demande de Max) | Validé Max (17/11/2026) | Claude rédige, Max valide le contenu |
| 4 | Définir le modèle de données : profil, plan, séances, historique, charges, version, clés `mind_`, dates en texte | V1-M0 | Opus | Validé Max (schéma 16/11/2026, code 17/11/2026) | Claude propose, Max valide |
| 5 | Créer le dépôt GitHub `maxlad47/MIND` | hors mission | — | Fait (Max, 16/11/2026) | Max le crée lui-même |
| 5b | Initialiser git en local | hors mission | — | Fait : `git init` sur `main`, remote `origin` ajouté, aucun commit, aucun push | Claude |
| 6 | Projet React + Vite, `src/moteur/`, Vitest | V1-M1 | Sonnet | Validé Max (17/11/2026) | Claude développe ; Max vérifie que l'appli démarre et que `npm test` passe |
| 7 | GitHub Pages, PWA, message « Nouvelle version disponible » | V1-M2 | Sonnet | Validé Max (17/11/2026) : publiée sur `maxlad47.github.io/MIND/`, installée sur iPhone et Android, restauration entre deux téléphones et bandeau de mise à jour testés | Claude développe ; Max installe sur iPhone et Android |
| 8 | Profil utilisateur (formulaire simple, valeurs par défaut) | V1-M3 | Sonnet | Validé Max (17/11/2026) | Claude développe ; Max teste la persistance |
| 9 | Sauvegarde export / import + rappel | V1-M4 | Sonnet | Validé Max (17/11/2026) | Claude développe ; Max teste la restauration sur un autre téléphone |
| 10 | Retouches et validation de V1 | hors mission | Haiku | À faire | Claude corrige les retouches ; Max valide le critère de V1 |

### Critère de sortie de V1

- Installée sur iPhone et Android depuis `maxlad47.github.io/MIND/`.
- Le profil reste après fermeture de l'appli et après une mise à jour.
- Une sauvegarde exportée depuis un téléphone est restaurée sur un autre, à l'identique.
- Le message de mise à jour s'affiche quand une nouvelle version est publiée.
- Vitest passe sur le moteur (même vide).

---

## 4. Prochaine étape

Jalons 3, 4 et 5 validés par Max (17/11/2026). Le critère de sortie de V1 est rempli ; il reste l'étape 10 (retouches et validation finale de V1).
**V0-M6 (étape 2) validée par Max le 18/11/2026.** Aucune mission en cours : la suivante attend le choix de Max.
Retouches de design depuis, hors mission, déjà commitées : couleur de la barre d'état alignée sur le fond (`2fe32be`), puis fond orange pastel (essai) et mode sombre (`db1d81b`). Validées par Max (17/11/2026).
Étapes 2 et 3 validées. Reste l'étape 10 (retouches et validation de V1).

---

## 5. Ce qui attend Max

- V1-M2 : l'invitation à installer avant de remplir le profil (iPhone, CADRAGE §2) n'est pas codée. À ajouter, ou à retirer du critère.
- Valider le choix Vite 8, React 19 et Vitest 5 (versions installées par npm).

---

## 6. Alignement des documents

### Corrections faites (16/11/2026)

- **REGLES.md** : U3 mis à jour (la sortie longue avec blocs reste une sortie longue ; ses blocs comptent dans S2 et S2b). U7 : liste unique des règles levables. C9 : non levable. S2 : une sortie longue avec blocs compte dans les 2 séances.
- **CADRAGE.md** : §2 « profils fictifs A, B, C » à la place des prénoms ; §3 « style musical » retiré, avec la mention « réintroduit avec la musique, après V6 » ; §8 C9 non levable.
- **MISSIONS.md** : en-tête avec version de référence (v5) et modèles ; note sur V0-M0 à V0-M4 ; V0-M6 sur profils fictifs avec vérification manuelle ; V1-M3 avec formulaire et valeurs par défaut ; V2-M1 avec Claude qui rédige le premier jet et Max qui corrige ; V3-M6 « un testeur extérieur au développement » ; V5-M4 en Sonnet.
- **DECISIONS.md** : en-tête sur la version de référence ; lignes datées pour les décisions de Max (version, volume, style musical, C9, S2, dépôt public).
- **CLAUDE.md** : créé. Il cite REGLES.md v5 ; aucune mention de v4.

### Contradictions F à I : traitées (validées par Max, appliquées)

- F : CADRAGE §2 indique que le premier lancement en 3 questions est reporté à V5.
- G : CADRAGE §3 indique « chrono recommandé ; sans chrono, règle N7 ».
- H : « profils fictifs » remplace « profils anonymes » dans CADRAGE §5 et CLAUDE.md.
- I : les lignes historiques de DECISIONS.md remplacées sont barrées, avec renvoi à la ligne qui les remplace.

### Contradictions restantes : aucune connue

### Vérifié, sans correction

- Les modèles assignés sont identiques dans AVANCEMENT.md, MISSIONS.md et DECISIONS.md.
- La version de référence est REGLES.md v5 partout (CLAUDE.md, MISSIONS.md, DECISIONS.md, AVANCEMENT.md).
- Le nom du dépôt est `maxlad47/MIND` partout.

## 7. Étape 6 : projet React + Vite, Vitest (V1-M1)

**Sous-étape 5b (git local)** : `git init` sur `main`, remote `origin` = `https://github.com/maxlad47/MIND.git`. Aucun commit, aucun push.

**Sous-étape 6a (scaffold)** : Vite + React en template JavaScript, créé dans un dossier temporaire (hors du projet), puis copié à la racine.
- Contrôle de collision avant copie : aucun fichier existant n'a été écrasé. Les `.md` existants sont intacts.
- Non copié : `README.md` du template (texte générique).
- Supprimés (démo du template) : `App.css`, `src/assets/`, `public/icons.svg`.
- Conservé : `public/favicon.svg` (logo Vite, à remplacer plus tard).

**Sous-étape 6b (configuration)** :
- `package.json` : nom `mind`, version 0.1.0, scripts `dev`, `build`, `lint`, `preview`, `test` (`vitest run`). Types TypeScript retirés (projet JavaScript).
- Versions installées : Node 26.13.0, npm 11.20.0, React 19.3.1, Vite 8.3.8, Vitest 5.1.0.
- `vite.config.js` : plugin React, Vitest en environnement Node (le moteur n'a pas d'affichage).
- `.gitignore` du template conservé (`node_modules`, `dist`, `.DS_Store`).

**Sous-étape 6c (écran et moteur)** :
- `src/App.jsx` : écran « MIND ». `src/index.css` : fond clair, titre centré.
- `src/moteur/index.js` : module vide, sans affichage (V1).
- `src/moteur/moteur.test.js` : test de fumée.
- `src/moteur/garde.test.js` : garde-fou. Échoue si un fichier de `src/moteur/` importe React ou react-dom (CADRAGE §5).

**Vérifications** :
- `npm test` : 2 fichiers, 2 tests, tous passent.
- `npm run build` : réussi (16 modules, bundle de 219 Ko, 69 Ko gzip).
- `npm run dev` : serveur démarré sur `localhost:5173`. La page a le titre « MIND », et le module `App.jsx` contient le titre « MIND ». Le serveur a été arrêté après vérification.
- **Limite** : je n'ai pas ouvert la page dans un navigateur. Le rendu visuel reste à confirmer par Max.

**Non fait, volontairement** : aucun commit, aucun push, pas de PWA ni de GitHub Pages (étape 7), pas de `src/donnees/` (étape 4, à créer avec V1-M0).

Arrêt conformément à ta demande. J'attends ta vérification.

---

## 8. Jalon 6 : V1-M0, code de la couche de données

Ordre de ta consigne : jalon 1 (5b) et jalon 2 (étape 6) étaient déjà faits ; jalon 6 (V1-M0) passe avant les jalons 3 et 4, dont il dépend. Correspondance avec les étapes de ce document : jalon 3 = étape 8 (V1-M3), jalon 4 = étape 9 (V1-M4), jalon 5 = étape 7 (V1-M2).

**Revérification des jalons 1 et 2** : remote `origin` = `https://github.com/maxlad47/MIND.git`, branche `main`, aucun commit, aucun push. `.gitignore` contient `.DS_Store`, `node_modules`, `dist`.

**Créé dans `src/donnees/`** (aucun fichier `.md` de cadrage modifié) :
- `constantes.js` : préfixe `mind_`, `VERSION_SCHEMA = 1`, les 11 clés de MODELE_DONNEES.md, `CLES_EXPORT` (toutes sauf `mind_sauvegarde_precedente`), jours, statuts de groupe (défaut « secondaire »).
- `dates.js` : `estDateValide` (texte AAAA-MM-JJ, date réelle, bissextiles comprises).
- `stockage.js` : dépôt JSON sur un stockage passé en paramètre, stockage en mémoire pour les tests, `stockageNavigateur()` (renvoie `null` si localStorage est absent ou bloqué).
- `schema.js` : validation de `mind_version`, `mind_profil`, `mind_chronos`, `mind_reglages` (champs, listes de valeurs, dates) ; forme générale pour les autres collections ; valeurs par défaut (paliers selon M25, machine 2,5 kg) ; `statutGroupe` (« secondaire » si non renseigné ; « exclu » seulement si choisi).
- `migrations/index.js` : registre vide (schéma initial = version 1) et `migrer()`, un numéro de version par migration.
- `index.js` : `lireCollection`, `ecrireCollection` (valide avant d'écrire), `lireEtat`, `initialiserDonnees` (création de `mind_version` ; refus si les données sont plus récentes que l'appli ; migration en mémoire, validation, puis écriture).
- 4 fichiers de tests (36 tests), dont : persistance (relecture par un nouveau dépôt), écriture invalide sans effet, version trop récente sans écriture, migration dans l'ordre, migration manquante ou invalide sans effet sur les données.

**Vérifications** : `npm test` : 6 fichiers, 38 tests passent. `npm run lint` : aucune alerte. `npm run build` : réussi. `src/donnees/` n'est pas encore utilisé par l'écran : le profil arrive au jalon 3.

**Points à trancher avant le jalon 3** (je ne les devine pas) :
1. **« Niveau »** : s'agit-il du niveau de muscu (débutant / intermédiaire / confirmé, M28) ? Le niveau de course se déduit du chrono (table N) et ne se saisit pas (N4). Je propose le niveau de muscu.
2. **Liste des groupes musculaires** : elle n'existe nulle part. Elle viendra de `data/exercices.json` (V0-M7, non créé). Je propose une liste provisoire dans le code, à aligner sur V0-M7, ou d'attendre V0-M7.
3. **Valeurs par défaut non décidées** (jours disponibles, temps par jour, nombre de séances, organisation et équipement muscu, objectifs) : je laisse « non renseigné » sauf avis contraire. Indique-moi les valeurs voulues.
4. **Chrono 10 km optionnel** : sans chrono, N7 s'applique (débutant, EF uniquement). Avec chrono, j'enregistre un chrono `declare` dans `mind_chronos` et son identifiant dans `chrono_ref_id`. Le niveau de course (table N) est une règle du moteur, pas encore écrite : le champ `niveau` reste `null` en V1. Acceptable ?
5. **Copie de sécurité avant migration** : ta décision couvre l'import seulement. Une migration est calculée en mémoire et validée avant d'écrire, sans copie. Veux-tu aussi une copie avant migration ?

**À noter** : Node 26 affiche un avertissement expérimental sur `localStorage` pendant les tests. Il est sans effet.

Arrêt après le jalon 6, conformément à ta consigne. J'attends ta validation.

---

## 9. Jalon 3 : V1-M3, formulaire de profil

**Décisions de Max appliquées (17/11/2026)** : niveau = niveau de muscu (M28), pas de saisie du niveau de course ; liste de groupes musculaires provisoire dans le code ; valeurs par défaut « non renseigné » ; chrono 10 km optionnel enregistré en `declare` dans `mind_chronos`, `niveau` à `null`, sans chrono N7 s'applique ; copie de sécurité `mind_sauvegarde_precedente` avant toute migration et avant tout import, exclue de l'export.

**Créé** (aucun fichier de cadrage modifié) :
- `src/profil/formulaire.js` : logique sans affichage (données ↔ formulaire, validation, enregistrement). `groupes.js` : liste provisoire de 10 groupes (à aligner sur V0-M7). `options.js` : libellés.
- `src/ecrans/Profil.jsx` : le formulaire. `src/App.jsx` : ouvre le stockage, appelle `initialiserDonnees`, affiche un message clair si le stockage est bloqué, si les données sont plus récentes que l'appli ou illisibles. `src/index.css` : style sobre.
- `src/donnees/index.js` : `creerCopieSecurite(depot, cause, date)` (une seule copie, remplacée à chaque fois ; contient date, cause, version et toutes les données exportables). `initialiserDonnees` l'appelle avant d'écrire une migration, après validation du résultat (migration en échec = pas de copie, données intactes). Le jalon 4 réutilisera la même fonction avant l'import. `dateDuJour()` ajoutée à `dates.js`.

**Comportement du formulaire** :
- Champs : prénom, objectif course (+ sous-objectif si « pas de course », + date de course si 10 km / semi / marathon), objectif muscu, priorité, jours, temps par jour, nombre de séances course et muscu, organisation, niveau muscu, équipement, statut des groupes (prioritaire / secondaire / exclu, « secondaire » par défaut), chrono 10 km (`mm:ss` ou `h:mm:ss`), volume des 4 dernières semaines (4 valeurs ou aucune), date de début de régularité.
- **Retouches après ton premier test (17/11/2026)** : prénom obligatoire (MODELE_DONNEES.md aligné le 17/11/2026 sur ton accord ; le validateur de `src/donnees/` l'exige aussi depuis le jalon 4, aucune sauvegarde antérieure n'existant) ; la liste des groupes musculaires n'apparaît que si tu réponds « Oui » à « Des muscles en priorité ou des exclusions ? » (« Non » : tous les groupes restent « secondaire »). Option « Hypertrophie » renommée « Hypertrophie et esthétisme » (affichage seulement, valeur stockée inchangée).
- Hors prénom, tout est facultatif : un formulaire avec le seul prénom s'enregistre (valeurs « non renseigné »). La date de course (C10) est signalée comme nécessaire au plan, mais n'empêche pas d'enregistrer. Je n'ai ajouté aucune règle de cohérence qui n'existe pas dans REGLES.md.
- Écriture tout ou rien : si un champ est invalide, rien n'est écrit et les champs fautifs sont signalés.
- Chrono : `mind_chronos` est en ajout seulement. Un chrono modifié s'ajoute et devient la référence ; le même chrono réenregistré ne crée pas de doublon ; un champ vidé retire la référence, l'historique reste. Date du chrono = jour de l'enregistrement.
- Seuls les statuts de groupe différents de « secondaire » sont stockés.

**Vérifications** : `npm test` : 8 fichiers, 68 tests passent (30 nouveaux : formulaire, persistance après relecture par un nouveau dépôt, chrono, validation sans effet d'écriture, rendu de l'écran avec profil enregistré, copie de sécurité avant migration). `npm run lint` : aucune alerte. `npm run build` : réussi.
- **Limite** : je n'ai pas ouvert l'écran dans un navigateur. Les tests de l'écran sont un rendu côté serveur (pas de clic simulé, pas de bibliothèque de test ajoutée). Le comportement réel (saisie, enregistrement, rechargement) est à confirmer par ton test.

**À tester** (http://localhost:5173, `npm run dev`) :
1. Remplir quelques champs dont un chrono (`52:30`), cliquer « Enregistrer » : message « Profil enregistré ».
2. Recharger la page (Cmd+R) : tout est retrouvé, y compris le chrono et les statuts de groupes.
3. Saisir un chrono `52` ou une date impossible : message d'erreur, rien ne change après rechargement.
4. Choisir « Pas de course visée » : le sous-objectif apparaît et la date de course disparaît.
5. Sur téléphone (même réseau) : lisibilité et clavier numérique.

**À signaler (je n'ai pas modifié ces fichiers, comme le veut CLAUDE.md)** : ta décision étend la copie de sécurité aux migrations. MODELE_DONNEES.md (§1 ligne `mind_sauvegarde_precedente`, §3 « Import ») et DECISIONS.md ne mentionnent que l'import. Correction proposée : ajouter « et avant chaque migration » dans MODELE_DONNEES.md §1 et §3, et une ligne datée du 17/11/2026 dans DECISIONS.md. Dis-moi si je l'applique.

Arrêt après le jalon 3, conformément à ta consigne. J'attends ton test.

---

## 10. Jalon 4 : V1-M4, export / import et rappel

**Décisions de Max appliquées (17/11/2026)** : prénom obligatoire aussi dans le validateur (aucune sauvegarde antérieure à tolérer) ; rappel = bandeau après 30 jours sans export (ou jamais exporté, une fois un profil enregistré), avec un champ `derniere_export` dans `mind_reglages`.

**Créé** :
- `src/donnees/sauvegarde.js` : `exporterDonnees`, `importerDonnees`, `rappelExportNecessaire`. `src/donnees/erreurs.js` : `ErreurImport`. `dates.js` : `joursEntre`.
- `src/ecrans/Sauvegarde.jsx` : boutons « Exporter ma sauvegarde » et « Importer une sauvegarde » (confirmation avant remplacement). `App.jsx` : bandeau de rappel, rechargement du formulaire après un import.
- `MODELE_DONNEES.md` : ligne `derniere_export` ajoutée à `mind_reglages` (champ facultatif, **sans changement de version du schéma**, donc sans migration).

**Comportement** :
- **Export** : fichier `mind-sauvegarde-AAAA-MM-JJ.json` = `{ application: "MIND", date_export, donnees: { mind_version, … } }`, toutes les clés présentes sauf `mind_sauvegarde_precedente`. La date d'export est enregistrée avant l'export, donc elle figure dans le fichier (une restauration ne déclenche pas de rappel superflu).
- **Import (remplacement)** : refus si le fichier est illisible, d'un autre format, avec une clé inconnue (copie de sécurité comprise) ou une version absente ; refus si sa version est plus récente que l'appli ; migration en mémoire si plus ancienne ; validation de chaque collection ; puis copie de sécurité (`cause: import`) et remplacement. Les collections absentes du fichier sont supprimées. Tant que tout n'est pas valide, rien n'est écrit et aucune copie n'est faite. Si l'écriture échoue en cours de route (stockage plein), l'état d'avant est rétabli.
- **Écart avec MODELE_DONNEES.md §3** : l'ordre décrit est copie, migration, validation. Le mien est validation, copie, remplacement : même garantie (données intactes en cas d'échec) sans créer de copie inutile. À aligner dans le texte si tu valides.
- **Rappel** : pas de bandeau tant qu'aucun profil n'est enregistré.

**Vérifications** : `npm test` : 10 fichiers, 91 tests passent (aller-retour export / import vers un dépôt vide, remplacement complet, copie de sécurité unique, 8 cas de refus sans effet, migration à l'import, rétablissement après échec d'écriture, rappel à 29 et 30 jours). Lint sans alerte, build réussi.
- **Limite** : je n'ai pas testé le téléchargement ni le sélecteur de fichier dans un navigateur, ni sur téléphone (les tests d'écran sont un rendu côté serveur). Sur iPhone, le téléchargement d'un Blob peut se comporter différemment : à vérifier.

**À tester** (http://localhost:5173) :
1. Enregistrer un profil, cliquer « Exporter » : un fichier `mind-sauvegarde-….json` est téléchargé.
2. Modifier le prénom, puis « Importer » ce fichier : confirmation, puis le prénom d'origine revient dans le formulaire.
3. Importer un fichier quelconque (ex. une image ou un .json étranger) : message d'erreur, rien ne change.
4. Bandeau de rappel : visible dès qu'un profil existe sans export ; disparaît après un export.
5. Restauration sur un autre appareil : exporter ici, ouvrir l'appli ailleurs (même navigateur impossible, donc autre profil de navigateur ou téléphone une fois publiée à l'étape 7), importer, comparer.

**Non fait, volontairement** : aucun écran pour restaurer la copie de sécurité (elle existe en stockage mais rien ne l'utilise encore). À décider si tu en veux un en V1.

Arrêt après le jalon 4. J'attends ton test.

---

## 11. Jalon 5 : V1-M2, PWA et GitHub Pages

**Corrections de documents appliquées (17/11/2026, accord de Max)** : MODELE_DONNEES.md (§1 : copie de sécurité aussi avant migration ; §3 : ordre de l'import aligné sur le code, et paragraphe « Migration au démarrage ») ; DECISIONS.md (4 lignes datées : copie de sécurité, prénom et libellé hypertrophie, rappel d'export, pas d'écran de restauration en V1).

**Créé** :
- `vite.config.js` : `base: '/MIND/'` (adresse de publication) et plugin de service worker. **Conséquence : en développement, l'adresse devient http://localhost:5173/MIND/.**
- `pwa/sw.template.js` + `pwa/plugin.js` : au build, produisent `dist/sw.js` avec une version calculée à partir des noms de fichiers (qui contiennent déjà le hash du contenu) : la version change si, et seulement si, le code change.
- `src/pwa.js` : enregistrement du service worker et détection d'une nouvelle version (production seulement). `src/ecrans/BandeauMiseAJour.jsx` : bandeau « Nouvelle version disponible » avec le bouton « Mettre à jour » (la page se recharge une fois la nouvelle version active).
- `public/manifest.webmanifest`, `public/icones/` (192, 512, maskable 512, icône iOS 180) et `public/favicon.svg` : un « M » blanc sur fond sombre, à la place du logo Vite. `index.html` : liens du manifeste, icône iOS, couleur de thème, mode plein écran iOS.
- `.github/workflows/deploy.yml` : à chaque push sur `main` : `npm ci`, lint, tests, build, publication sur Pages.

**Comportement** : l'appli est mise en cache à la première visite et s'ouvre ensuite hors ligne. Une nouvelle version s'installe en arrière-plan mais ne remplace l'ancienne que quand tu cliques sur « Mettre à jour » (jamais au milieu d'une saisie). Les données (localStorage) ne sont jamais touchées par le cache. Pas de bibliothèque ajoutée.

**Vérifications** : `npm test` : 11 fichiers, 94 tests passent (dont 3 sur la détection de mise à jour). Lint sans alerte. Build réussi ; `vite preview` sert `/MIND/`, `sw.js`, `manifest.webmanifest` et les icônes avec les bons types ; `index.html` pointe vers `/MIND/…`.
- **Limites** : je n'ai ouvert aucun navigateur. Le service worker, l'installation sur l'écran d'accueil, le mode hors ligne et le bandeau de mise à jour ne sont donc pas vérifiés en réel. Le workflow GitHub ne peut pas être testé avant le premier push (il utilise Node 22 ; ton poste est en Node 26).
- **Anonymat (CLAUDE.md règle 8)** : recherche automatique de ton nom, de ton prénom, de ton e-mail et de chemins locaux dans tout le dépôt (hors `node_modules`, `dist`, `.git`) : aucune occurrence. Le nom `maxlad47` apparaît comme nom du dépôt, comme prévu. La vérification manuelle avant publication reste la tienne.

**À faire, dans l'ordre** :
1. **Test local de la PWA** : `npm run build` puis `npm run preview`, ouvrir http://localhost:4173/MIND/ dans Chrome. Onglet Application (outils de développement) : manifeste sans erreur, service worker « activated ». Cocher « Offline » et recharger : l'appli s'ouvre. Chrome propose aussi « Installer ».
2. **Premier commit et push** : dis-moi « commit et push » quand tu as relu les fichiers ; je ne le fais pas avant. Le premier push demandera ton authentification GitHub (le trousseau macOS est configuré).
3. **Activer Pages** (toi, sur github.com) : dépôt `maxlad47/MIND` > Settings > Pages > Source = « GitHub Actions ». Relancer le workflow s'il a échoué avant l'activation (onglet Actions).
4. **Installer sur téléphone** depuis `https://maxlad47.github.io/MIND/` : iPhone (Safari) : Partager > Sur l'écran d'accueil. Android (Chrome) : menu > Installer l'application.
5. **Tester la restauration** : exporter sur un téléphone, importer sur l'autre.
6. **Tester le bandeau de mise à jour** : après une modification publiée, rouvrir l'appli installée ; le bandeau doit apparaître (parfois à la deuxième ouverture).

Arrêt après le code du jalon 5, conformément à ta consigne. Aucun commit, aucun push.

---

## 12. V0-M6 : profils A, B, C (fixés par Max le 17/11/2026)

Personnes réelles anonymisées : aucun prénom ni lien dans le dépôt, chronos conservés. Dates de course fictives. Volumes déclarés identiques sur les 4 dernières semaines.

| | A | B | C |
|---|---|---|---|
| Objectif course | 10 km, 01/03/2027 ; course prioritaire | 10 km, 01/03/2027 | Marathon, 01/06/2027 ; montée en volume d'abord (C9) |
| Chrono 10 km | 42'00 (confirmé) | 60'00 (débutant) | 44'00 (confirmé) |
| Course | 3 sorties, 30 km/sem. | 2 sorties, **15 km/sem. (10 + 5, corrigé le 18/11/2026)** | 3 sorties d'1 h (**180 min/sem.**, déclaré en minutes : C9 passe dès W1), 30 km/sem. ; sortie longue au-delà d'1 h permise |
| Régulier depuis 6 mois | Oui | Oui | Oui |
| Muscu | 3 séances, hypertrophie (M3), > 2 ans, salle | 2 séances, hypertrophie (M3), < 6 mois, salle | 3 séances, tonification (M4) + renfo coureur, > 2 ans, salle |
| Organisation | « Je ne sais pas » (M26) | « Je ne sais pas » | « Je ne sais pas » |
| Groupes | Aucun exclu ; option renfo coureur, pas de jambes lourdes (voir « Ouvert ») | Prioritaires : quadriceps, ischios, fessiers, dos | Aucun exclu ; option renfo coureur, pas de jambes lourdes |
| Jours | Lun (2 séances), mer, ven, sam, dim | Lun, mer, sam, dim | Lun, mar, jeu, ven, sam, dim |
| Temps par séance | 1 h ; sortie longue 1 h-1 h 30 | 1 h ; sortie longue 1 h-1 h 30 | 45 min (course : 1 h) |

**Ce que donnent déjà les règles** : A et C confirmés → 2 séances intenses (N) ; B débutant → 1. A et B : 14 semaines avant la course → C13 (2 semaines de préparation, puis C1 sur 12). C : 3 h/sem. = seuil C9 v6 atteint.

**Ordre** : V0-M7 (`data/exercices.json`) d'abord, puis les plans papier, calculés à la main depuis REGLES.md v6 et la bibliothèque.

**Ouvert** :
- Renfo coureur (A et C) : pas de groupe exclu ; renfo coureur en **option** cochée en plus de l'objectif muscu, et pas de squat lourd dans la semaine (Max, 17/11/2026). M12 réécrite en conséquence (REGLES v6, validée par Max). B : jambes prioritaires → jambes lourdes conservées + renfo. À faire plus tard : case « Renfo coureur » dans le formulaire (le champ `renfo_coureur` existe déjà).
- C : 6 jours disponibles sur 7 ; le mercredi reste libre, P5 est respecté.

---

## 13. V0-M7 : `data/exercices.json`

**Créé** :
- `data/exercices.json` : version 1, **76 exercices** (40 classiques, 25 complémentaires, 11 spécifiques « renfo coureur »), et la table `equipements` (M29) : salle = tout ; maison avec haltères = haltères + poids du corps ; poids du corps = poids du corps.
- Champs par exercice (critère de MISSIONS.md) : `niveau_usage`, `famille`, `principal_possible`, `materiel` (M25), `muscle_principal` (clés de `src/profil/groupes.js`), `zone` (haut / bas, M17), `type` (polyarticulaire / isolation). En plus : `id`, `nom`, `contexte` (`renfo_coureur` pour un spécifique, sinon `null`, M8) et `mesure` (voir ci-dessous).
- `src/donnees/exercices.test.js` : 13 contrôles (champs, valeurs, M6, M7, M8, M10-M11, M12, M17, M29, U5). Il a trouvé un trou à la première exécution (famille « presse » sans assistance), corrigé par l'ajout de la presse à une jambe.
- `src/profil/groupes.js` : commentaire mis à jour (liste alignée, plus « provisoire »).

**Vérifications** : `npm test` : 12 fichiers, 107 tests passent. Lint sans alerte. Build réussi.

**Choix validés par Max (17/11/2026)** :
1. **Champ `mesure` (`reps` / `duree`)**, absent du critère : le gainage se compte en secondes, pas en répétitions.
2. **Abdos en zone « haut »** : le critère ne prévoit que haut / bas (sans effet pratique : M17 ne joue qu'à la barre).
3. **Soulevé de terre : muscle principal = dos** (correction de Max, 17/11/2026 : exercice de dos, ischios en secondaire, non comptés par M22). Zone « bas » conservée (M17, +5 kg), famille charnière de hanche (U5). Le soulevé de terre roumain reste en ischios.
4. ~~Hip thrust hors jambes lourdes~~ → **tranché par Max (17/11/2026)** : le « lourd » dépend de l'intensité, pas du mouvement. U5 réécrite (polyarticulaire jambes, hip thrust compris, lourd si RPE visé ≥ 7), M20b (RPE visé seulement sur les séries « dures »), M17b (progression en léger). Valeurs de RPE visé validées (force 7-9, force + esthétique 6-9, hypertrophie 6-8).
5. **Renfo coureur** : 11 exercices au poids du corps ou aux haltères (montées sur banc, fentes arrière, squat sur une jambe, soulevé de terre sur une jambe, nordic curl, pont fessier sur une jambe, abduction, mollets excentriques, corde à sauter, dead bug, gainage dynamique). Ils sont dans les familles squat / fentes / charnière, mais **ne comptent pas comme jambes lourdes** (U5 exclut le renfo coureur).
6. **Équipement « poids du corps » seul** : biceps et triceps sans exercice classique possible → l'appli avertira (M11). Sans effet sur A, B, C (tous en salle).

---

## 14. V0-M6 : plans papier (validés par Max le 18/11/2026)

**Créé** : `plans/README.md` (conventions, choix provisoires G1-G13), `plans/plan-A.md`, `plans/plan-B.md`, `plans/plan-C.md`. Chaque plan : entrées, paramètres calculés (niveau, volume, allures), calendrier semaine par semaine, une semaine détaillée (placement P / J, séances course et muscu), contrôle des règles. Aucun prénom ni lien dans ces fichiers.

**Constats principaux, à trancher par Max** :
1. **M22 et M23 incompatibles** pour tous les profils (G13) : 10 groupes à 6 séries minimum ne tiennent pas dans le nombre d'exercices M23. B est très loin (M13 déclenchée, arbitrage non défini).
2. **Sortie longue plafonnée** par S3 quand les autres sorties sont limitées au temps par jour : B 60 min (cible C1 non atteinte), C 2 h 00 (cible C3 2 h 45-3 h non atteinte).
3. **C9 refuse C de 2 minutes** au départ (178 min < 180) ; levé dès W2.
4. Règles absentes : hausse de volume visée (G1), contenu des phases (G4), jour de la sortie longue (G5), mouvement principal (G9), marathon plus de 20 semaines à l'avance (C3).
5. S4 a forcé à réduire les fractions de C en W22 : le moteur doit vérifier S4 avant de fixer les fractions.

**Non fait** : plans des semaines autres que la semaine détaillée ; charges (aucune déclarée, M19).


**Relecture point par point (18/11/2026)** :
- **Charges** : M19 réécrite (calibrage au RPE en semaine 1, suivi des charges au choix, Epley corrigée RPE). Les plans n'ont plus de « charges à calibrer » : la semaine 1 s'écrit en reps + RPE. À prévoir en V2 : un indicateur « suivi » par exercice dans le modèle de données (`mind_charges` ou `mind_reglages`), sans changement avant V2.
- **M22 / M23 (G13)** : tranché. M22 selon le nombre de séances (tableau prudent), minimum prioritaire seul bloquant ; M23 = proposition, le temps limite ; M13 précisé. Les sections muscu des plans seront recalculées une fois tous les points revus.
- **Pour plus tard (après V2)** : demi-série pour le muscle secondaire d'un exercice (champ « muscle secondaire » dans `data/exercices.json`) ; superséries. Notés à la demande de Max, sans date.
- **Sortie longue et durées** : tranché. S3 sans plafond en % (progression + cible de course + 3 h, conseil > 50 %), S3b supprimée, U9 (sortie longue ≥ 60 min), J8 (sortie de plus proposée, jamais imposée), A3 (EF en distance par défaut, séance = durée de son contenu). À prévoir : réglage « EF en durée » dans le profil (formulaire, `mind_reglages`).
- **C9 et unité du volume** : tranché. C retenu à 180 min (minutes déclarées) → C9 passe dès W1. C13 étendue au semi (> 14 semaines) et au marathon (> 20 semaines). À prévoir : le formulaire accepte le volume **en km ou en minutes** au choix de l'utilisateur (km convertis par U2 si un chrono existe ; sans chrono, minutes).
- **Volume, jour et départ de la sortie longue (G1, G5, G6)** : tranché. C14 (hausse calculée sur la prépa), P10 (jour choisi par l'utilisateur, conseil si J+2 non respecté), N3b (sortie longue de départ déclarée). À prévoir dans le formulaire : jour de sortie longue, plus longue sortie récente (km ou min).
- **Profils, sortie longue (18/11/2026)** : plus longue sortie récente A 15 km (≈ 86 min → sortie longue de départ, N3b), B 10 km (≈ 77 min → sortie longue de départ) ; volume de B corrigé par Max : **15 km/sem. (10 + 5) ≈ 116 min**, C 8 km (≈ 48 min < 60 → pas de sortie longue au départ). Jour de sortie longue : dimanche pour les trois (P10).
- **Intenses et nombre de sorties** : tranché, N8 (option B avec proposition de 2e qualité dès le développement). A et C : 1 qualité + 1 EF + sortie longue par défaut.
- **Contenu des phases (G4)** : tranché, C15.
- **G3, G7 à G12** : tranchés (C16, S5, M26, M6, M32, M9, M12). Mouvements principaux : A développé couché / tractions / développé militaire ; B squat / soulevé de terre roumain / hip thrust ; C développé couché / rowing / développé épaules. **Tous les choix provisoires G1-G13 sont tranchés : plans à recalculer.**
- **Plans version 2 (18/11/2026)** : A, B, C recalculés avec toutes les règles revues. M22 tenu pour A et C (10 groupes à 6 séries ou plus) ; B : prioritaires à 8-9, secondaires en conseil, plus de M13. Questions restantes : A Q1 (pic si sortie longue de départ > bas de la cible, appliqué), Q4 (2e qualité + lundi doublé), Q5 (jour de l'EF) ; B4 (principal du samedi jamais lourd, P2) ; C Q2 (affûtage 2 ou 3 semaines), C7 (semaine de course = récupération 1).
- **Plans version 3 (18/11/2026)** : réponses de Max appliquées. Règles : C14 (pic), J6 (jour doublé choisi par l'utilisateur, message si une règle de placement est enfreinte, choix maintenu), P11 (jour de l'EF), M6 (pas de principal jambes la veille d'une qualité ou de la sortie longue), C3 et C6 (affûtage marathon 2 semaines), C11 (semaine de course = récupération 1), U7 (liste des conseils). A : 2e qualité avec lundi doublé → VMA longue lundi + VMA courte mercredi, message J6. B : principal du samedi = tractions (M6), soulevé de terre roumain en léger, dos 8 séries. C : inchangé, sauf les renvois.
- **B5 tranchée (18/11/2026)** : tractions assistées « principal possible » (`data/exercices.json` v2, test mis à jour, 107 tests passent) ; tractions au poids du corps au-delà de 4 tractions strictes (M6). B : tractions assistées le samedi.
- **Tractions (18/11/2026)** : strictes dès une possible, assistées sinon ; schéma propre (< 5 : 3-4 séries au max ; ≥ 5 : 4 × 5 → 4 × 12, +1 rep si RPE de l'exercice < 7) ; lest à définir plus tard. A-Q7 tranchée. A-Q6 et B6 tranchées : A 8 tractions strictes (4 × 5), B 2 (4 séries au max + 2 séries de tirage horizontal, dos 9).
- **RPE (18/11/2026)** : toujours sur l'exercice entier, jamais sur une série (M16, M17b, M19, M20b, R2). Conséquence à prévoir : MODELE_DONNEES ne stocke que `rpe_principal` ; il faudra un RPE par exercice dur (changement du modèle validé, à soumettre à Max avant le moteur).
- **V0-M6 « Validé Max » (18/11/2026).** Ensuite, relecture des plans v3 par Max → V0-M6 « Validé Max ». À prévoir dans le formulaire : choix du jour doublé (J6), nombre de tractions strictes (M6).

---

## 15. Test des règles sur 30 profils (hors mission, 18/11/2026)

Demandé par Max. **Fait**, à relire par Max. Aucune règle modifiée.
- `plans/test-30/` : `README.md` (méthode, choix provisoires H1-H10), `P01.md` à `P30.md` (20 profils tirés au hasard, graine fixe, + 10 cas limites ; tableau profil / proposition, calendrier, semaine détaillée, constats, avis de coach), `BILAN.md` (verdicts et 24 constats classés), `outils/` (scripts de tirage et de calcul, données).
- Verdict de coach : 9 plans bons, 14 à retoucher, 7 à refuser.
- Constats principaux : volume déclaré > contenu possible (9 profils, sans règle) ; organisation muscu incompatible avec le nombre de séances ; M6 (principal par défaut) ; plus de séances que de jours accepté ; durée des qualités sans règle et pic C14 inatteignable ; aucun minimum de sorties pour 10 km / semi ; bibliothèque au poids du corps trop pauvre avec M8.
- Incohérences signalées, non corrigées : libellé `ppH` dans `src/profil/options.js` (« haut-bas ») contre M26 (« sans jambes ») ; S5 (« reprise au niveau ») contre les plans A-C (reprise + hausse).
- PDF envoyé par mail à Max (hors dépôt).

---

## 16. Règles v7 et test sur 50 profils (hors mission, 19/11/2026)

Demandé par Max (« simplifier au maximum, rester cohérent, optimiser »). **Fait, à valider par Max.**
- `REGLES-v6.md` : copie intégrale de la v6 (commit `ddde9cd`, retirée le 20/11/2026).
- `REGLES.md` **v7** : mêmes codes et valeurs validées ; tableau des changements en tête ; nouveau code **E** (contrôles du profil) ; N6 fusionnée dans N8 ; nouvelles V7, P12, P13, M33 ; C4, C5, C8, C9, C14, M6, M8, M12, M20, M22, M23, M26, J5 réécrites. Ligne datée dans DECISIONS.md.
- `plans/test-50/` : `README.md`, `Q01.md` à `Q50.md` (35 tirés au hasard, graine fixe, + 15 cas limites), `BILAN.md`, `outils/` (script qui applique la v7 règle par règle, profils, avis).
- Verdict de coach : 31 bons, 19 à retoucher, 0 à refuser (v6 : 9 / 14 / 7). Les 24 constats du test v6 sont réglés ou améliorés.
- Reste à trancher (v8) : plafond de hausse sur une prépa, temps minimal conseillé pour les qualités et pour la force, longue préparation plate, charge totale par niveau, « garder la forme » à 1 qualité, deux variantes du même mouvement, volume muscu débutant (BILAN §4).
- À prévoir après validation : formulaire (E1-E9), libellé `ppH` dans `src/profil/options.js`, MODELE_DONNEES (RPE par exercice + nouveaux champs), recalcul des plans A, B, C (référence v6 jusque-là).
- Points ouverts de la session précédente toujours en attente : les 6 incohérences de documents signalées le 18/11.
- PDF envoyé par mail à Max (hors dépôt). Rien n'est commité.

---

## 17. Règles v8, un seul fichier (hors mission, 20/11/2026)

- **Commit `ddde9cd`** : état du 17 au 19/11 sauvegardé tel quel (v6 validée, v7, brouillon v8, `data/exercices.json`, plans A/B/C, tests 30 et 50 profils).
- **REGLES.md v8 = version de référence** (Max : « la V8 est prête »). Le fichier ne contient plus que les règles en vigueur : tableau des changements et renvois aux copies retirés. Liste des changements v7 → v8 : ligne du 20/11/2026 dans `DECISIONS.md`.
- **`REGLES-v6.md` et `REGLES-v7.md` supprimés** : un seul fichier de règles, anciennes versions dans l'historique Git. CLAUDE.md, MISSIONS.md, DECISIONS.md et `plans/test-50/README.md` alignés sur la v8.
- **Fait le même jour (demande de Max : corriger les règles d'après les remarques du coach, refaire examiner, A/B/C d'abord, 50 nouveaux profils notés sur 10, rapport par mail)** :
  - REGLES.md v8 complétée (6 remarques v7 restantes + 10 défauts trouvés par le nouveau test) ; ligne datée dans DECISIONS.md.
  - `plans/test-v8/` : `BILAN.md`, `README.md`, `A.md`, `B.md`, `C.md`, `R01.md` à `R50.md` (50 profils construits pour couvrir tous les cas), `outils/` (`moteur8.py`, `rendu8.py`, `profils_v8.py`, `avis_v8.py`).
  - Verdict : A 9/10, B 7/10, C 8/10 ; 50 profils : 37 bons, 13 à retoucher, 0 à refuser, moyenne 7,8/10. Les anciens 50 profils (test v7) relancés en v8 pour vérifier que leurs remarques sont traitées.
  - **À trancher par Max** : 6 points ouverts (`plans/test-v8/BILAN.md` §5), dont E13 qui réduit les prioritaires de B, et les principaux de A et C différents des plans v6.
  - Rapport envoyé par mail à Max (PDF hors dépôt). Rien n'est commité depuis `7536923`.
- Plans papier A, B, C (`plans/plan-*.md`) : encore en v6 ; les versions v8 sont dans `plans/test-v8/`, à valider par Max.
- **21/11/2026 : les 6 points ouverts sont tranchés** (Max : « selon l'avis d'un coach expert, applique-les ») : C14 (EF ≤ 75 % de la sortie longue), J8, C8 (+30 % par cycle de 8 semaines), E10 (semi et marathon à tout niveau), C9 (4 sorties conseillées pour un marathon), E13 gardée, M6 (A : développé militaire ; C : rowing barre). Détail : `DECISIONS.md` (21/11). Les programmes de `plans/test-v8/` datent d'avant ces décisions : à recalculer si Max le demande.
