# MIND — Journal des décisions

Chaque décision importante est notée ici, datée. Ce qui est noté ici n'est pas rediscuté
sans raison nouvelle.

Version de référence des règles : **REGLES.md v8** (voir CLAUDE.md). Les mentions de versions antérieures ci-dessous sont historiques ; les anciennes versions se retrouvent dans l'historique Git (v6 validée et v7 : commit `ddde9cd`, fichiers `REGLES-v6.md` et `REGLES-v7.md`).

| Date | Décision |
|---|---|
| 16/11/2026 | Projet langues abandonné, remplacé par MIND (course + musculation) |
| 16/11/2026 | PWA sur GitHub Pages plutôt qu'Expo : pas de store, pas de frais |
| 16/11/2026 | Pas de compte ni de serveur ; données locales + export / import |
| 16/11/2026 | Pas d'IA dans l'appli pour l'instant |
| 16/11/2026 | Démarrage sans outil externe (Ponytail, Graphify, Hermes…). ~~ni agent~~ → précisé : voir la ligne « Claude Code » ci-dessous |
| 16/11/2026 | Trail reporté après la version partagée |
| 16/11/2026 | Objectifs : 10 km, semi, marathon, pas de course prévue, force, force + esthétique, hypertrophie, tonification |
| 16/11/2026 | ~~Le sexe ne change que l'ordre des suggestions~~ → remplacé : l'utilisateur choisit ses zones à travailler en premier ; le sexe n'est plus demandé |
| 16/11/2026 | Muscles : prioritaire / secondaire / exclu |
| 16/11/2026 | Mouvement principal choisi par l'utilisateur ; même famille = assistances |
| 16/11/2026 | Niveaux d'usage des exercices : classique / complémentaire / spécifique |
| 16/11/2026 | EF en distance OU durée, sans allure ; chaque allure expliquée |
| 16/11/2026 | Pas de fartlek libre ; séances fun composées par l'utilisateur |
| 16/11/2026 | Saisie après séance : Respectée / Modifier / Pas faite + RPE |
| 16/11/2026 | ~~Niveau du coureur déduit du chrono 5-10 km + volume + régularité~~ → remplacé par « Volume retiré des règles de niveau » (décisions de Max) |
| 16/11/2026 | Jours choisis par l'utilisateur ; max 1 course + 1 muscu par jour |
| 16/11/2026 | Design clair, épuré, premium, inspiré d'Apple Music ; couleurs par intensité |
| 16/11/2026 | Musique : liens Spotify par type de séance ; création de playlists plus tard |
| 16/11/2026 | Construction par missions V0 → V6 ; V6 = version partagée au groupe |
| 16/11/2026 | Tout changement important est discuté avec Max avant d'être fait |
| 16/11/2026 | Modèle par mission : Opus (conception, règles), Sonnet (développement), Haiku (retouches) |
| 16/11/2026 | ~~Dépôt nommé `MIND-` pour l'instant~~ → renommé `maxlad47/MIND` avant la publication |
| 16/11/2026 | **Revue des règles (v2)** : |
| 16/11/2026 | Volume de course compté en minutes ; prescription naturelle par séance (U1, U2) |
| 16/11/2026 | Définition de la séance intense ; allure marathon = qualité ; sortie longue avec blocs = sortie longue (U3) |
| 16/11/2026 | Sortie longue marathon jusqu'à 40 % en phase spécifique, progression +15 min max (S3b, S8) |
| 16/11/2026 | Après semaine allégée : reprise au niveau de la dernière semaine normale, puis +10 % (S5) |
| 16/11/2026 | Semaine allégée muscu = −40 % de séries, charges gardées ; l'affûtage remplace la semaine allégée |
| 16/11/2026 | Plans générés jamais au-delà des plafonds S ; modification utilisateur acceptée après confirmation (S9) |
| 16/11/2026 | ~~Marathon sous 3 h ou 3 sorties par semaine : refus fort, forçable (C9)~~ → remplacé par « C9 non levable » (décisions de Max, 2e série) |
| 16/11/2026 | Allures par formule de Riegel (exposant 1,08 pour le marathon) + RPE visé par type (A1, A6) |
| 16/11/2026 | ~~Chrono obligatoire~~ → remplacé par « Chrono : N7 s'applique sans chrono » (ligne du 16/11, décisions de Max). Niveau modifié uniquement par un nouveau chrono ; boutons « Trop facile / Juste / Trop dur » supprimés |
| 16/11/2026 | Tests au choix : 6 minutes, 5 km, course réelle (section T) |
| 16/11/2026 | L'utilisateur choisit son nombre de séances et son organisation muscu ; l'appli propose seulement s'il ne sait pas (J5, M26) |
| 16/11/2026 | Jour doublé uniquement à la demande ; l'utilisateur choisit la séance qui saute (J6) |
| 16/11/2026 | Volume muscu, back-off, cycle de force de 8 semaines, paliers par matériel (M20-M25) |
| 16/11/2026 | RPE global + RPE de la dernière série du mouvement principal en muscu (R2) |
| 16/11/2026 | Alertes de charge proposées, jamais automatiques (K3-K5) |
| 16/11/2026 | Règles de pause et de changement d'objectif (section Z) |
| 16/11/2026 | Profil : date de course, niveau muscu, équipement, charges facultatives |
| 16/11/2026 | Règles dans `src/moteur/`, séparées de l'interface |
| 16/11/2026 | Mission « Modèle de données » ajoutée ; données versionnées, clés préfixées `mind_` |
| 16/11/2026 | ~~Tests avec profils anonymes A, B, C (dépôt public) ; plans papier V0-M6 = résultats attendus~~ → remplacé par « Plans et données de test : profils fictifs A, B, C uniquement » (décisions de Max, 2e série) |
| 16/11/2026 | Séances fun, conditions difficiles et liens Spotify reportés après V6 |
| 16/11/2026 | Missions V2-M2 et V3-M3 découpées |
| 16/11/2026 | **Revue des contradictions (v3 des règles)** : |
| 16/11/2026 | Sortie longue plafonnée selon le nombre de sorties : 2 → 50 %, 3 → 40 %, 4 → 35 %, 5+ → 30 % (S3) |
| 16/11/2026 | Marathon : refus fort sous 4 h/semaine (C9) ; sorties longues clés jusqu'à 50 % en phase spécifique (S3b) |
| 16/11/2026 | Écart sortie longue ↔ qualité = J+2 minimum, avant comme après (P7) |
| 16/11/2026 | Proposition par défaut qui dépasse les jours : annoncée « dont 1 jour doublé », l'utilisateur accepte ou réduit (J5, J6) |
| 16/11/2026 | 3 dernières semaines avant course : cycle de force en pause, principal jambes en entretien (P8, M24) |
| 16/11/2026 | Muscu pendant l'affûtage = semaine allégée (C6) |
| 16/11/2026 | Premier lancement en 3 questions ; sans chrono → test 6 min en semaine 1 (N7) |
| 16/11/2026 | Corrections de rédaction : N2 (débutant reste débutant), A5 (« plus rapide »), M17 (M25 prime hors barre) |
| 16/11/2026 | Exercices : + muscle principal, haut / bas du corps, polyarticulaire / isolation |
| 16/11/2026 | Technique : plan et réalisé enregistrés, dates en texte, « aujourd'hui » passé au moteur, message de mise à jour, installation avant profil sur iPhone |
| 16/11/2026 | Couleurs manquantes (seuil, allure spécifique, côtes, accessoires) tranchées en V5-M1 |
| 16/11/2026 | **Décisions de Max (points flous)** : |
| 16/11/2026 | Chrono : N7 s'applique sans chrono (EF uniquement, test 6 min en semaine 1) ; la table N s'applique dès qu'un chrono 10 km existe. Débutant : même règle (REGLES N7) |
| 16/11/2026 | Test 6 min : VMA = distance en km × 10 ; chrono 10 km estimé = 10 ÷ (0,90 × VMA) ; autres distances par Riegel. Formule et source dans REGLES A1 et T3 |
| 16/11/2026 | Back-off : M21 s'applique (M1 et M2 seulement), M20 réécrit en conséquence |
| 16/11/2026 | « Sans agent » précisé : pas d'agent IA dans l'appli ; Claude Code reste un outil de développement |
| 16/11/2026 | Dépôt GitHub `maxlad47/MIND` créé par Max lui-même (étape 5) ; Claude initialise git en local |
| 16/11/2026 | **Décisions de Max (2e série)** : |
| 16/11/2026 | Style musical retiré du profil V1 ; réintroduit avec la musique (après V6) |
| 16/11/2026 | Séances modèles muscu : Claude rédige le premier jet, Max corrige (V2-M1) |
| 16/11/2026 | Refus fort : seul C9 est non levable. S et P5 sont bloquantes mais levables avec confirmation explicite. Liste unique dans REGLES U7. Remplace la mention « forçable (C9) » de la ligne du 16/11 sur le marathon |
| 16/11/2026 | Sortie longue avec blocs rapides : compte dans les 2 séances intenses max de S2 |
| 16/11/2026 | Version de référence : **REGLES.md v5**. La demande initiale « v4 » est corrigée : l'en-tête réel du fichier est v5 |
| 16/11/2026 | V0-M0 à V0-M4 : non suivies dans MISSIONS.md, ne bloquent pas V1. Aucun statut inventé |
| 16/11/2026 | Étape 10 du plan (checkpoint V1) : reste hors mission |
| 16/11/2026 | V5-M4 (mention santé) : Haiku → Sonnet |
| 16/11/2026 | CLAUDE.md : pas de commit ni push sans demande explicite ; anonymat du dépôt public. Acceptées |
| 16/11/2026 | Volume retiré des règles de niveau : le niveau dépend du chrono 10 km (table N) et de l'ajustement N2. Remplace la ligne du 16/11 « niveau déduit du chrono + volume + régularité » |
| 16/11/2026 | « Style musical » : retiré du profil V1 (CADRAGE §3) ; réintroduit avec la musique, après V6 |
| 16/11/2026 | C9 non levable (remplace « forçable ») ; sortie longue avec blocs : reste une sortie longue, ses blocs comptent dans S2 et S2b |
| 16/11/2026 | Dépôt public : prénoms remplacés par « profils fictifs A, B, C » (CADRAGE §2) et « un testeur extérieur au développement » (MISSIONS V3-M6). Dépôt : `maxlad47/MIND` |
| 16/11/2026 | Version de référence : REGLES.md v5 (décision A) |
| 16/11/2026 | V1 : profil rempli par un formulaire simple avec valeurs par défaut ; premier lancement en 3 questions reporté à V5 |
| 16/11/2026 | ~~Plans et données de test : profils fictifs A, B, C uniquement ; vérification manuelle avant chaque publication~~ → remplacé par « Profils A, B, C = personnes réelles anonymisées, chronos conservés » (17/11/2026) |
| 16/11/2026 | V0-M6 : statut à confirmer par Max ; bloque seulement l'étape 2 du plan |
| 16/11/2026 | Ordre : étapes 2 et 3 en parallèle de l'étape 4 ; étapes 4 et 5 indépendantes |
| 16/11/2026 | **Modèle de données validé** (MODELE_DONNEES.md) : stockage local ; semaines commençant le lundi ; charge de séance recalculée, non stockée |
| 16/11/2026 | Import : remplacement de toutes les données, précédé d'une copie de sécurité automatique |
| 16/11/2026 | Palier machine par défaut : 2,5 kg, ajustable par l'utilisateur |
| 16/11/2026 | Migrations de données dans `src/donnees/`, un numéro de version par migration |
| 16/11/2026 | ~~Groupe musculaire non coché : « exclu » (validé par Max)~~ → remplacé par « Groupe non coché : secondaire » (ligne suivante) |
| 16/11/2026 | **Groupe musculaire non coché : « secondaire »** (décision de Max, remplace « exclu »). « Exclu » reste un choix explicite (M11). Aucune règle de REGLES.md modifiée |
| 16/11/2026 | **Étape 6 : projet en JavaScript** (décision de Max), Vite + React, Vitest. Scaffold dans un dossier temporaire puis copie. Aucun `.md` écrasé |
| 16/11/2026 | git local initialisé sur `main`, remote `origin` ajouté, sans commit ni push (décision de Max) |
| 17/11/2026 | **Copie de sécurité `mind_sauvegarde_precedente` avant toute migration et avant tout import** (décision de Max), exclue de l'export. Remplace « import seulement » |
| 17/11/2026 | Prénom obligatoire dans le formulaire et le validateur (décision de Max) ; option « Hypertrophie » affichée « Hypertrophie et esthétisme » (affichage seulement) |
| 17/11/2026 | Rappel d'export : bandeau après 30 jours sans export, champ `derniere_export` dans `mind_reglages` (décision de Max) |
| 17/11/2026 | Pas d'écran de restauration de la copie de sécurité en V1 (décision de Max) ; jalons 3 et 4 validés |
| 17/11/2026 | V1-M1, V1-M2 et retouches de design (fond orange pastel, mode sombre) validées par Max ; tests sur iPhone et Android faits |
| 17/11/2026 | **Profils A, B, C = trois personnes réelles jugées par Max**, anonymisées sous A, B, C : aucun prénom ni lien de parenté dans le dépôt, **chronos conservés**. Remplace « profils fictifs A, B, C uniquement » (raison nouvelle : Max doit pouvoir juger les plans). Dates de course fictives |
| 17/11/2026 | **REGLES.md v6** : C9 abaissé de 4 h à 3 h de course par semaine ; nouvelle règle C13 (préparation longue avant un 10 km) |
| 17/11/2026 | Profil sans objectif prioritaire avec une course visée : Max choisit la course comme prioritaire (profil A). Pas de règle « à égalité » |
| 17/11/2026 | Profils A et C : aucun groupe exclu ; renfo coureur = **option** cochée en plus de l'objectif muscu (pas un objectif comme M1-M4) ; pas de jambes lourdes (U5, ex. squat lourd) dans leur semaine. **M12 réécrite** (REGLES v6, validée par Max) : option ; sans jambes prioritaires → aucune jambe lourde ; jambes prioritaires → jambes lourdes + renfo |
| 17/11/2026 | V0-M6 : les séances viennent de l'application (règles + `data/exercices.json`), pas d'un choix libre de Claude → V0-M7 avant les plans papier. Les plans restent calculés à la main (résultats attendus des tests) |
| 17/11/2026 | V0-M7 faite en Opus (demande de Max, au lieu de Sonnet). `data/exercices.json` v1 : 76 exercices, champs du critère + `id`, `nom`, `contexte`, `mesure` ; table `equipements` (M29). Contenu à valider par Max (AVANCEMENT §13) |
| 17/11/2026 | **U5 réécrite** : jambes lourdes = polyarticulaire jambes (hip thrust compris) à RPE visé ≥ 7 ; en dessous, pas lourd. **M20b** : RPE visé seulement sur les séries « dures » (force : principal + back-off ; hypertrophie : 2 premières séries des polyarticulaires ; tonification : aucune ; autres séries sans RPE). Valeurs (Max) : force 7-9, force + esthétique 6-9, hypertrophie 6-8. Le RPE mesure la difficulté, pas la charge : un même RPE ne se compare pas entre objectifs. **M17b** : jambes en léger, +1 palier si RPE dernière série ≤ 5. M12 : jambes en léger (RPE ≤ 6) permises sans jambes prioritaires (décisions de Max) |
| 17/11/2026 | M20b : le RPE visé monte au fil du bloc de 4 semaines (bas de fourchette en semaine 1, haut avant la semaine allégée). Hypertrophie : 2 premières séries du principal **et** des polyarticulaires (décisions de Max) |
| 17/11/2026 | Soulevé de terre (classique) : muscle principal = **dos**, ischios en secondaire (correction de Max). Zone « bas » et famille charnière de hanche conservées. Roumain : ischios |
| 18/11/2026 | **M19 réécrite** : semaine 1 = calibrage au RPE (aucune charge prescrite) ; suivi des charges au choix par exercice, jamais obligatoire ; charge max = charge × (1 + (reps + 10 − RPE) / 30) (Epley corrigée RPE) ; exercice non suivi = reps + RPE, charge au ressenti ; suivi coché plus tard = calibrage de cet exercice (décisions de Max) |
| 18/11/2026 | **M22** : séries par muscle selon le nombre de séances (1 : 4-6 / 2-3 ; 2 : 8-10 / 4-6 ; 3+ : 12-16 / 6-8), tableau prudent ; minimum prioritaire bloquant, secondaire = cible (conseil, U7). **M23** : le temps limite, le tableau est un départ. **M13** : arbitrage = moins de prioritaires ou une séance de plus, l'utilisateur décide (décisions de Max) |
| 18/11/2026 | **S3 réécrite** : sortie longue limitée par sa progression (S8, S1), la sortie longue max de la course et 3 h, plus de plafond en % ; conseil au-delà de 50 %. **S3b supprimée**. **U9** : sortie longue = sortie facile ≥ 60 min. **J8** : nombre de sorties = maximum ; sortie de plus proposée (cible non atteinte 4 semaines avant la phase spécifique), jamais imposée. **A3** : EF en distance arrondie au km par défaut (durée sans chrono ou sur préférence) ; une séance dure son contenu, au plus le temps du jour (décisions de Max) |
| 18/11/2026 | **C13 étendue** : semi > 14 semaines → préparation puis C2 sur 14 ; marathon > 20 semaines → préparation puis C3 sur 20. Volume déclaré : en km ou en minutes au choix de l'utilisateur (km convertis par U2). Profil C : 180 min déclarées, C9 passe (décisions de Max) |
| 18/11/2026 | **C14** : hausse du volume calculée sur la durée de la prépa, jusqu'au volume de pic (sortie longue max + autres sorties à leur durée max) atteint en fin de développement, au plus +10 %/sem. ; « garder la forme » : volume stable. **P10** : jour de sortie longue choisi par l'utilisateur, modifiable à tout moment ; J+2 non respecté → conseil. **N3b** : sortie longue de départ = plus longue sortie déclarée si ≥ 60 min (décisions de Max) |
| 18/11/2026 | **N8** : 3 sorties ou moins → 1 séance intense au plus (1 qualité + EF + sortie longue) ; 4 sorties et plus → table N. Avec 3 sorties et un niveau à 2 intenses, 2e qualité proposée à partir du développement (décision de Max, option B avec proposition) |
| 18/11/2026 | **C15** : contenu des phases par course (préparation, fondation, développement, spécifique, affûtage) et variante de sortie longue par phase ; sortie longue à blocs = intense, reste facile si le quota N / N8 est atteint (décision de Max) |
| 18/11/2026 | **C16** (arrondi des phases), **S5** (qualités en allégée : moins de fractions), **M26** (3 séances : full body ×3 si jambes en léger, sinon haut / jambes / full body), **M6** (un principal par séance, proposition par défaut), **M32** (choix des exercices : préférés, prioritaire, ordre du fichier ; pas de répétition dans la semaine), **M9** (tout secondaire → ordre M5), **M12** (renfo compté dans M23, réparti). Principaux : A développé couché, tractions, développé militaire ; B squat, soulevé de terre roumain, hip thrust ; C développé couché, rowing, développé épaules (décisions de Max) |
| 18/11/2026 | **Questions restantes de V0-M6 (plans v2)** : **C14** pic = la plus grande entre le bas de la cible C1-C3 et la sortie longue de départ (N3b), sans dépasser le haut (A-Q1) ; **J6** le jour doublé est celui de l'utilisateur ; s'il enfreint une règle de placement (P1, P2, P7), message (conseil, U7) avec un jour qui l'évite, choix maintenu si l'utilisateur le veut ; J4, S et C9 restent bloquants (A-Q4) ; **P11** jour de l'EF = le plus grand écart avec la séance intense ou la sortie longue la plus proche, à égalité le plus tôt (A-Q5) ; **M6** pas de principal jambes sur une séance toujours veille de qualité ou de sortie longue → principal dos le samedi pour B (B4) ; **C3** affûtage marathon = 2 semaines, ligne « 3 semaines » retirée de C6 (C-Q2) ; **C11** la semaine de la course est la semaine 1 de la récupération (C7). Plans A, B, C en version 3 (décisions de Max) |
| 18/11/2026 | **M6 tractions** : tractions au poids du corps comme principal seulement au-delà de **4 tractions strictes** ; sinon (ou sans réponse) principal = tractions assistées à la machine, devenues « principal possible » (`data/exercices.json` v2). Profil B : tractions assistées le samedi (B5, décision de Max). Fourchette propre aux tractions strictes : évoquée par Max, à définir. **Précisé le même jour** (remplace le seuil de 4) : tractions strictes dès qu'une est possible, assistées seulement sinon ; schéma propre : < 5 → 3-4 séries au maximum, ≥ 5 → 4 × 5 puis +1 rep quand le RPE **de l'exercice** (toutes ses séries) est < 7, plafond 4 × 12 ; lest plus tard. Tractions strictes : A 8, B 2 (décisions de Max) |
| 18/11/2026 | **RPE toujours sur l'exercice entier**, jamais sur une série (visé comme noté) : M20b (exercices durs, plus de « 2 premières séries »), M16, M17b, M19 (Epley avec le RPE de l'exercice), R2 (RPE de chaque exercice dur). Remplace les mentions « dernière série » et « séries dures » (décision de Max) |
| 18/11/2026 | **V0-M6 validée par Max** : plans papier A, B, C version 3 (`plans/`), résultats attendus des tests du moteur |
| 19/11/2026 | **REGLES.md v7 (à valider par Max)** : réécriture de la v6 demandée par Max après le test sur 30 profils (« simplifier au maximum, rester cohérent, optimiser »). Copie de la v6 : `REGLES-v6.md` (dans le commit `ddde9cd`, retirée ensuite). Mêmes codes et valeurs validées ; nouveau code **E** (contrôles du profil) ; N6 fusionnée dans N8 (intenses limitées par le volume) ; V7 (durée et progression des qualités) ; C14 (pic réel, répartition de la hausse) ; C4, C5, C16 (au moins 1 semaine spécifique, délai court pour 3 distances, plan « finir ») ; C6 (affûtage semi 1 semaine) ; C8 (4 sous-objectifs dont muscu seule, rotation) ; C9 (minimum pour les 3 distances) ; U5 et M12 (lourd / léger, mollets hors « jambes ») ; P2 (jour de sortie longue) ; P12, P13 ; M6 (principal par type de séance, lest des tractions) ; M8, M20, M22, M23, M26 ; J5 (une valeur par case) ; S5 (reprise) ; P8 → M33. Plans A, B, C restent la **référence v6** jusqu'à leur recalcul |
| 20/11/2026 | **REGLES.md v8, version de référence** (« la V8 est prête », Max). Corrections de la v7 d'après les avis de coach du test sur 50 profils (`plans/test-50/`) : **E10** qualité en moins de 45 min (intermédiaire ou plus) → 45 min proposées le jour de la qualité (Q03, Q34) ; **E11** sorties trop courtes (< 25 min en moyenne) ou sortie unique > 1 h 30 → autre répartition proposée (Q06, Q08, Q38) ; **E12** séances par semaine au plus 6 / 7 / 8 selon le niveau, retrait sur l'objectif secondaire (Q11, Q28, Q44) ; **E13** au plus un muscle prioritaire par séance de muscu (Q22, Q30) ; **C8** « garder la forme » : 1 qualité au plus (Q02) ; **C9** 10 km : 60 min par semaine au moins (Q24) ; **C5** plan « finir » appelé « plan court » à partir de confirmé, sortie longue max annoncée (Q25, Q36) ; **C13** préparation en rotation côtes, fartlek, seuil (Q09, Q35) ; **C14** pic au plus départ × 1,6 (ou départ + 60 min), message quand une qualité remplace une sortie facile (Q12, Q14, Q29, Q39) ; **C15** débutant : fartlek une semaine sur deux ; marathon : allure marathon dès le développement (Q17, Q23, Q43) ; **M8** spécifique en dernier recours (Q04, Q07, Q42) ; **M16c, M23** force au poids du corps ou en moins de 45 min → hypertrophie proposée (Q04, Q20, Q22, Q50) ; **M22** débutant en muscu : secondaires 2 / 3 / 4 séries (Q01) ; **M32** pas deux exercices de la même famille dans une séance, sauf l'assistance du principal (Q44) ; **P5** jour de repos gardé, quitte à doubler un jour (Q19). Convention des tests papier : E10, E11, E12, M16c / M23, C5 et J8 supposées acceptées, 2e qualité N8 refusée, refus C9 maintenu. **Un seul fichier de règles** : `REGLES-v6.md` et `REGLES-v7.md` retirés, historique dans Git. Plans A, B, C calculés en v6 : à recalculer |
