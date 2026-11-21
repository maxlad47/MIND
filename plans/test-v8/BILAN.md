# MIND — Règles v8 : corrections et nouveau test

Document de travail du 20/11/2026, **relancé le 21/11/2026** après les décisions sur les points ouverts (§5), hors mission. Règles appliquées : `REGLES.md` **v8** (version de référence, complétée le 21/11) et `data/exercices.json` v2.

## 1. En bref

- **Les remarques du coach du test v7** (50 profils, `plans/test-50/`) sont toutes traitées. La plupart l'étaient déjà dans la v8 du 19/11 ; 6 ne l'étaient pas (Q09, Q13, Q23, Q24, Q31, Q46) et sont maintenant dans les règles. Vérification faite en relançant ces 50 profils avec le script v8.
- **Le nouveau test a trouvé 10 autres défauts de règles**, corrigés aussitôt (§2.2). Exemple : un marathon accepté alors que la sortie longue ne dépassait pas 1 h 52.
- **A, B, C recalculés en v8** : A 9/10, B 7/10, C 8/10 (§3). A et C retrouvent tes principaux v6.
- **50 nouveaux profils, construits pour couvrir tous les cas** (§4) : **40 bons, 10 à retoucher, 0 à refuser, note moyenne 7,9/10** (le 20/11 : 37, 13, 7,8). Les 10 « à retoucher » sont sûrs et limités par les choix du profil (2 ou 3 sorties, 30 min par jour, 1 seul jour, matériel, exclusions) ; l'appli le signale.
- **Relance du 21/11** (§5) : R04, R18 et R35 passent à « bon » ; R13 montre que l'extension de E10 aux débutants n'aide pas : elle est retirée.

## 2. Changements de règles

### 2.1 V8 du 19/11 (d'après les avis de coach du test v7)

| Code | Changement | Profils du test v7 |
|---|---|---|
| E10 | Qualité en moins de 45 min (intermédiaire ou plus) → 45 min proposées le jour de la qualité | Q03, Q34 |
| E11 | Sorties de moins de 25 min en moyenne, ou sortie unique de plus d'1 h 30 → autre répartition proposée | Q06, Q08, Q38 |
| E12 | Au plus 6 / 7 / 8 séances par semaine (débutant / intermédiaire / au-delà), retrait sur l'objectif secondaire | Q11, Q28, Q44 |
| E13 | Au plus un muscle prioritaire par séance de muscu | Q22, Q30 |
| C5 | Plan « finir » appelé « plan court » à partir de confirmé ; sortie longue max annoncée | Q25, Q36 |
| C8 | « Garder la forme » : 1 qualité au plus | Q02 |
| C9 | 10 km : 60 min par semaine au moins | Q24 |
| C13 | Préparation en rotation côtes, fartlek, seuil | Q09, Q35 |
| C14 | Pic au plus départ × 1,6 (ou + 60 min) ; message quand une qualité remplace une sortie facile | Q12, Q14, Q29, Q39 |
| C15 | Débutant : fartlek une semaine sur deux ; marathon : allure marathon dès le développement | Q17, Q23, Q43 |
| M8 | Spécifique en dernier recours | Q04, Q07, Q42 |
| M16c, M23 | Force au poids du corps (ou trop courte) → hypertrophie proposée | Q04, Q20, Q22, Q50 |
| M22 | Débutant en muscu : secondaires à 2 / 3 / 4 séries | Q01 |
| M32 | Pas deux exercices de la même famille dans une séance (sauf l'assistance du principal) | Q44 |
| P5 | Jour de repos gardé, quitte à doubler un jour | Q19 |

### 2.2 Ajouts du 20/11

| Code | Changement | Trouvé par |
|---|---|---|
| E14 (nouveau) | 3 séances de muscu ou plus de moins de 45 min → une séance de moins, de 45 min, proposée | Q09 (v7) |
| C14 | Débutant : sortie longue cible = bas de la fourchette (semi 1 h 45, marathon 2 h 45) | Q13 (v7) |
| P7 | Écart J+2 impossible avec la sortie longue → la qualité voisine passe au seuil (fartlek pour un débutant), jamais de VMA, côtes ni allure 10 km | Q23 (v7), R08 |
| M23 | Séance de muscu de 75 min au plus | Q24 (v7), R18, R25 |
| M11 | Abdos ajoutés aux groupes clés d'un coureur ; en cas d'exclusion, version légère proposée (1 exercice, 2 séries) | Q31, Q46 (v7), R49 |
| M23 | Force : 60 min par séance au moins (force + esthétique : 45 min), sinon hypertrophie proposée | Q20 (v7), R45 |
| C9 | Contrôle aussi la **sortie longue atteignable** avant la course (1 h / 1 h 30 / 2 h 30) | Q39 (v7) : marathon accepté avec 1 h 52 de sortie longue |
| C14 | La hausse va d'abord à la sortie longue tant qu'elle est sous le minimum C9 ; de même pour la future sortie longue quand il n'y en a pas encore | Q39 (v7), R07 (10 km refusé à tort) |
| C14, C8 | Débutant : hausse de +5 % par semaine au plus | R01, R34, R37 |
| C8 | « Courir plus » : 1 qualité au plus (aussi après un refus C9) ; sortie longue au plus 1 h 30 (ou la sortie longue de départ) | R25, R27, R35, R38 |
| C14 | La sortie longue ne baisse jamais : si la semaine ne tient pas sous S1, c'est la 2e qualité qui saute | R27 |
| E10 | Seulement à partir de 120 min par semaine ; marathon : 45 min pour toutes les sorties de semaine | R10, R26 |
| V7 | VMA longue : au moins 3 fractions, sinon 800 m puis 600 m | R02, R07 |
| J8 | Sortie de plus proposée aussi quand la sortie longue dépasse 55 % du volume | B, C, R16, R22, R26… |
| P13 | Deux séances jambes (ou bas) le plus espacées possible | R45, R46 |

Le script de test a aussi été corrigé sur deux points qui ne sont pas des règles : le jour doublé choisi par l'utilisateur reçoit bien une course (P11, profil A), et le message C8 « 2 sorties minimum pour progresser » s'affiche.

## 3. Profils A, B, C en v8

Programmes complets : `A.md`, `B.md`, `C.md`. Ils remplaceront les plans papier v6 (`plans/plan-A.md`, `plan-B.md`, `plan-C.md`) si tu les valides.

| Profil | Cas testé | Note | Verdict | Pourquoi (en une phrase) |
|---|---|---|---|---|
| A | Profil A (10 km prioritaire, hypertrophie 3 séances) | **9/10** | Bon | Très bon plan de 10 km : 2 semaines de préparation, une VMA longue qui monte (4 × 1000 m en 4'02), une sortie longue stable à 15 km et un volume de +20 % sans à-coup. |
| B | Profil B (10 km débutant, jambes et dos prioritaires) | **7/10** | À retoucher | Base saine pour un débutant : VMA courte (3 × 800 m) une semaine sur deux, fartlek l'autre semaine, sortie longue de 10 km. |
| C | Profil C (marathon, tonification 3 séances) | **8/10** | Bon | Préparation marathon sérieuse et identique à ton plan v6 au pic (≈ 284 min, sortie longue de 28 km puis 3 h) : 7 semaines de préparation en rotation (côtes, fartlek, seuil), seuil puis allure marathon, affûtage de 2 semaines. |

**Ce qui change par rapport à tes plans v6 validés :**
- **A** : même semaine (EF + muscu le lundi doublé, VMA longue le mercredi, sortie longue de 15 km le dimanche). Principaux : développé couché, tractions, développé militaire, comme ton plan v6 (M6 du 21/11).
- **B** : la qualité alterne VMA et fartlek (C15 débutant). En muscu, **E13 garde 2 prioritaires** (quadriceps, ischios) au lieu de 4 : dos et fessiers passent en secondaires (gardée le 21/11).
- **C** : même pic (≈ 284 min, sortie longue de 28 km puis 3 h). Le principal « pull » est le rowing barre, comme ton plan v6 ; les tractions assistées restent dans la séance haut.

## 4. Les 50 nouveaux profils

Construits à la main pour couvrir tous les cas : 10 km (12), semi (10), marathon (9), garder la forme (5), courir plus (5), courir plus vite (5), muscu seule (4) ; délais très courts, courts, normaux et longs ; sans chrono, débutant à expert, chrono 5 ou 10 km, pas régulier ; 0 à 6 sorties et « je ne sais pas » ; 1 à 7 jours, jours qui se suivent, refus du repos ; 30 à 90 min ; les 5 objectifs muscu, 3 équipements, toutes les organisations, prioritaires et exclusions. Propositions supposées acceptées (E10, E11, E12, E14, M16c / M23, C5) ; exclusions maintenues ; refus C9 maintenus.

| Verdict | v7 (anciens 50) | **v8 (nouveaux 50)** |
|---|---|---|
| Bon (8-10) | 31 | **40** |
| À retoucher (6-7) | 19 | **10** |
| À refuser (5 ou moins) | 0 | **0** |
| Note moyenne | — | **7,9 / 10** |

| Profil | Cas testé | Note | Verdict | Pourquoi (en une phrase) |
|---|---|---|---|---|
| R01 | 10 km, délai normal, débutant, 3 sorties, sans muscu | **8/10** | Bon | Bon plan pour un débutant : fartlek une semaine sur deux, VMA courte (3 × 800 m), hausse limitée à +5 % par semaine (100 → 134 min). |
| R02 | 10 km, délai normal, intermédiaire, 3 sorties, tonification 1 | **8/10** | Bon | Course propre : VMA longue en 3 × 800 m (assez de fractions), sortie longue qui finit à 1 h 18. |
| R03 | 10 km, délai normal, confirmé, 4 sorties, force 2 | **8/10** | Bon | Bon plan de 10 km pour un confirmé : 2 qualités (VMA longue et courte, 48 h d'écart), sortie longue de 1 h 25, 89 % de facile. |
| R04 | 10 km, délai normal, expert, 5 sorties, sans muscu | **8/10** | Bon | Les 2 qualités d'un expert sont justes (5 × 1000 m, 7 × 400 m). |
| R05 | 10 km dans 3 semaines (C5 « finir »), intermédiaire | **8/10** | Bon | À 3 semaines du 10 km, le plan « finir » est exactement ce qu'il faut : allure 10 km deux fois, une sortie longue d'1 h 03, puis l'affûtage. |
| R06 | 10 km dans 6 semaines (C4 compressé), avancé | **8/10** | Bon | Délai court bien géré (C4) : hausse limitée à +5 %, test en semaine 2, 2 qualités puis l'allure 10 km. |
| R07 | 10 km dans 26 semaines (C13 préparation), débutant sans chrono | **8/10** | Bon | Débutant sans chrono, 26 semaines : test 6 min, 14 semaines de préparation en rotation à +5 %, et la sortie la plus longue devient une vraie sortie longue (1 h) avant le plan 10 km. |
| R08 | 10 km avec 2 sorties sur deux jours qui se suivent (P7) | **7/10** | À retoucher | Deux jours qui se suivent : la qualité de la veille passe au seuil (P7 v8) et la sortie longue reste facile, c'est la bonne réponse. |
| R09 | 10 km avec 1 sortie (C9 : refus) | **8/10** | Bon | Refus juste : on ne prépare pas un 10 km avec une seule sortie. |
| R10 | 10 km, très petit volume (40 min/sem.) : C9 volume | **8/10** | Bon | Refus juste (40 min par semaine). |
| R11 | Semi, délai normal, intermédiaire régulier, 4 sorties (2 qualités possibles) | **8/10** | Bon | Bon plan de semi : seuil + VMA longue, sortie longue jusqu'à 2 h, +35 % de volume en 7 semaines, 85 % de facile. |
| R12 | Semi, délai normal, confirmé, 3 sorties, hypertrophie 2 | **9/10** | Bon | Plan très équilibré : seuil puis allure semi, sortie longue de 1 h 57, 89 % de facile, et 2 full body complets avec la muscu prioritaire. |
| R13 | Semi, débutant pas régulier, 3 sorties, 30 min par jour | **7/10** | À retoucher | Plan sûr pour un débutant pas régulier : fartlek une semaine sur deux, sortie longue qui monte à 1 h 40. |
| R14 | Semi dans 5 semaines (C5), avancé (« plan court ») | **8/10** | Bon | « Plan court » à 5 semaines du semi pour un avancé : allure semi chaque semaine, sortie longue jusqu'à 1 h 41, puis l'affûtage. |
| R15 | Semi dans 30 semaines (C13 longue préparation), confirmé, 4 sorties | **8/10** | Bon | Très longue préparation (16 semaines) enfin variée (côtes, fartlek, seuil en rotation) puis 2 qualités. |
| R16 | Semi avec 2 sorties, 45 min par jour et 1 h 30 de sortie longue | **6/10** | À retoucher | Le semi passe le minimum C9, mais avec 2 sorties et une sortie longue plafonnée à 1 h 30 (sous la cible d'1 h 45), le plan est juste : 65 % du volume dans la sortie longue. |
| R17 | Semi avec sortie longue limitée à 1 h (C9 : refus) | **8/10** | Bon | Refus juste : 1 h de sortie longue ne prépare pas un semi. |
| R18 | Semi, expert, 6 sorties, 7 jours sur 7, musculation 1 | **8/10** | Bon | Plan d'expert solide (seuil 3 × 10', 7 × 1000 m, 89 % de facile) et le jour de repos est gardé (P5). |
| R19 | Semi, volume déclaré trop grand pour le temps (E3) | **8/10** | Bon | E3 fait son travail : 330 min déclarées, 210 possibles, départ à la capacité. |
| R20 | Marathon, délai normal, confirmé, 4 sorties | **9/10** | Bon | Très bon plan de marathon : seuil + allure marathon, sortie longue de 3 h en spécifique, +27 % de volume, affûtage de 2 semaines. |
| R21 | Marathon, avancé, 5 sorties, hypertrophie 2 | **9/10** | Bon | Plan d'avancé exemplaire : 5 sorties, 2 qualités, sortie longue de 31 km, 86 % de facile, et la séance jambes placée après le seuil (P2). |
| R22 | Marathon, intermédiaire, 3 sorties, première fois | **7/10** | À retoucher | Premier marathon correct, mais avec 3 sorties la sortie longue de 2 h 45-3 h fait 58 % de la semaine. |
| R23 | Marathon dans 6 semaines (C5), confirmé | **8/10** | Bon | « Plan court » marathon à 6 semaines : allure marathon chaque semaine, sortie longue jusqu'à 2 h 31, affûtage. |
| R24 | Marathon dans 32 semaines (C13), débutant | **8/10** | Bon | Débutant qui prépare un marathon en 32 semaines : préparation variée, hausse à +5 %, sortie longue limitée au bas de la fourchette (2 h 45, C14 v8). |
| R25 | Marathon avec 2 sorties (C9 : refus) | **8/10** | Bon | Refus juste (2 sorties pour un marathon). |
| R26 | Marathon avec 30 min en semaine (E10) | **6/10** | À retoucher | Avec 45 min proposées en semaine (E10) et 4 sorties conseillées (C9), l'appli dit ce qu'il faut, mais un marathon sur 3 sorties dont une sortie longue de 2 h 42 (63 %) reste déséquilibré. |
| R27 | Marathon depuis un petit volume (140 min) : C9 en fin de préparation | **8/10** | Bon | Refus défendable : 140 min par semaine ne donnent que 162 min en fin de préparation, sous les 3 h du minimum marathon. |
| R28 | Marathon, expert, 6 sorties, refus du repos, force 2 | **8/10** | Bon | Plan d'expert crédible (6 sorties, sortie longue de 36 km, 90 % de facile). |
| R29 | Garder la forme, débutant, 2 sorties, tonification 2 | **8/10** | Bon | « Garder la forme » d'un débutant au poids du corps : une qualité douce, 2 full body de 30 min. |
| R30 | Garder la forme, confirmé, 4 sorties, hypertrophie 3 | **9/10** | Bon | Très bon plan d'entretien : 1 qualité en rotation, 96 % de facile, push / pull / jambes complets (6-7 séries par groupe), jambes le lendemain de la sortie longue. |
| R31 | Garder la forme, 1 sortie, muscu prioritaire 3 séances | **8/10** | Bon | Muscu prioritaire bien servie : pecs et dos à 15 séries, push / pull / haut. |
| R32 | Garder la forme, 3 sorties très courtes (E11) | **8/10** | Bon | E11 regroupe 3 sorties de 20 min en 2 sorties de 30 min : c'est mieux. |
| R33 | Garder la forme, sans chrono, « je ne sais pas » partout | **8/10** | Bon | Avec « je ne sais pas » partout et sans chrono : test en semaine 1, 3 sorties proposées puis regroupées (E11), une séance de muscu. |
| R34 | Courir plus, débutant, 3 sorties, sans muscu | **8/10** | Bon | Débutant qui veut courir plus : +5 % par semaine (90 → 115 min) et une seule qualité, c'est prudent et juste. |
| R35 | Courir plus, intermédiaire, 4 sorties, hypertrophie 2 | **8/10** | Bon | Une seule qualité, et la hausse est maintenant plafonnée à +30 % sur le cycle (150 → 195 min, C8) au lieu de +60 % : c'est le rythme que je donnerais à un intermédiaire. |
| R36 | Courir plus avec une sortie unique de 1 h 45 (E11) | **8/10** | Bon | La sortie unique d'1 h 45 est répartie en 2 sorties (E11) : bonne décision. |
| R37 | Courir plus, débutant, 4 sorties + force 3 (E12 charge totale) | **8/10** | Bon | E12 retire une séance de force (7 → 6 séances pour un débutant) et la hausse reste à +5 % : la charge totale est enfin raisonnable. |
| R38 | Courir plus, avancé, plafond de volume fixé (E6) | **8/10** | Bon | Plafond de volume atteint en 3 semaines puis tenu, une qualité en rotation : plan d'entretien solide pour un avancé. |
| R39 | Courir plus vite, intermédiaire, 3 sorties | **8/10** | Bon | « Plus vite » bien construit : rotation VMA courte, seuil, VMA longue, côtes ; muscu prioritaire haut / bas complète. |
| R40 | Courir plus vite, expert, 5 sorties (2 qualités) | **9/10** | Bon | Plan d'expert pour progresser : 2 qualités, sortie longue d'1 h 44, 86 % de facile. |
| R41 | Courir plus vite avec 1 sortie et 1 seul jour (C8, E4) | **7/10** | À retoucher | Un seul jour : une sortie facile et un full body au poids du corps. |
| R42 | Courir plus vite, débutant, 30 min par jour | **8/10** | Bon | Débutant, 30 min par jour : qualités courtes et douces (seuil 2 × 6'), 87 % de facile. |
| R43 | Courir plus vite, confirmé, 4 sorties, force + esthétique 2 | **8/10** | Bon | « Plus vite » avec 4 sorties : rotation des qualités, volume stable ; force + esthétique en 2 séances complètes. |
| R44 | Muscu seule, débutant, 3 séances, salle | **8/10** | Bon | Débutant en muscu : 3 full body légers (10-13 séries, 30-38 min) au bas de la fourchette (M22 v8). |
| R45 | Muscu seule, confirmé, force 4 séances, 45 min | **8/10** | Bon | La force en 45 min devient de l'hypertrophie (M23) et les séances alternent bas / haut / bas / haut (P13 v8) : bon plan. |
| R46 | Muscu seule, 6 séances, push / pull / jambes × 2 | **8/10** | Bon | Push / pull / jambes × 2 bien espacés (jambes lundi et jeudi), épaules et fessiers prioritaires à 15-16 séries. |
| R47 | Muscu seule au poids du corps, force demandée (M16c) | **7/10** | À retoucher | La force au poids du corps devient de l'hypertrophie, c'est juste. |
| R48 | 10 km, maison avec haltères, fessiers et ischios prioritaires | **7/10** | À retoucher | Course propre. |
| R49 | Semi, exclusion du dos et des abdos (M11) | **7/10** | À retoucher | Plan de semi propre. |
| R50 | 10 km, muscu prioritaire 4 séances, 1 jour de course choisi = jour de sortie longue absent | **7/10** | À retoucher | La muscu prioritaire en 4 séances est riche (dos 12, pecs 11). |

## 5. Points ouverts du 20/11, tranchés le 21/11

Décisions prises avec l'avis d'un coach (demande de Max), appliquées dans `REGLES.md`, détail dans `DECISIONS.md`, puis vérifiées en relançant le test. Les programmes de ce dossier sont ceux de la relance.

| # | Décision | Résultat de la relance |
|---|---|---|
| 1 | **C14** : une EF dure au plus 75 % de la sortie longue (30 min au moins) ; **J8** propose plus de temps de sortie longue ou une sortie de plus | R04 : EF de 18 à 14 km, la sortie longue redevient la plus longue (7 → 8). R18 : EF à la limite, crédible pour un expert (7 → 8) |
| 2 | **C8** « courir plus » : au plus +30 % par cycle de 8 semaines, **ou +30 min si c'est plus** (ajouté à la relance : sans ce plancher, R10 restait sous le minimum de son 10 km) | R35 : 150 → 195 min au lieu de 242 (7 → 8). R27 : 196 min, au-dessus du minimum marathon |
| 3 | **E10 pour les débutants (semi, marathon) : essayé puis retiré** | R13 : la qualité de 45 min prenait la hausse à la sortie longue (1 h 30 au lieu de 1 h 40). Ce coureur est limité par +5 % par semaine, pas par le temps |
| 4 | **C9** marathon : 4 sorties conseillées (3 restent le minimum) | Conseil affiché pour C, R22, R26 |
| 5 | **E13** gardée : un prioritaire par séance | B inchangé |
| 6 | **M6** : full body avec jambes en léger → haut, pull, épaules ; pull sans traction stricte → rowing barre, tractions assistées en 1er exercice de dos | A : développé couché, tractions, développé militaire (= v6). C : rowing barre (= v6). 2 full body (R08, R12, R15, R25…) : un principal de poussée et un de tirage au lieu d'un squat léger |

Constats d'origine (20/11) :

| # | Constat | Profils | Proposition |
|---|---|---|---|
| 1 | Quand la sortie longue est limitée par le temps choisi, les EF deviennent aussi longues qu'elle | R04, R18 | EF au plus 75 % de la sortie longue ; le reste va à une proposition (plus de temps de sortie longue ou une sortie de plus) |
| 2 | « Courir plus » peut faire +60 % en 8 semaines (+10 % par semaine) | R35 | Plafond par cycle de 8 semaines (ex. +30 %) |
| 3 | Un débutant qui prépare un semi ou un marathon avec 30 min en semaine | R13 | Étendre E10 aux débutants pour le semi et le marathon |
| 4 | Marathon ou semi au minimum de sorties : sortie longue à 58-65 % de la semaine | R16, R22, R26 | Déjà proposé (J8 > 55 %). Faut-il aller plus loin, par exemple 4 sorties conseillées pour un marathon (C9) ? |
| 5 | E13 réduit les prioritaires de B de 4 à 2 | B | Garder, ou permettre 2 prioritaires par séance s'ils sont dans la même zone |
| 6 | Principaux de A et C différents des plans v6 validés | A, C | Valider les principaux v7/v8, ou revenir aux tiens |

## 6. Ce qui reste à faire

- ~~Ta relecture des programmes relancés~~ : A, B, C validés par Max le 21/11 et copiés dans `plans/plan-*.md`.
- Ensuite : formulaire (E1-E14) ; `MODELE_DONNEES` (RPE par exercice) ; les programmes de ce test serviront de résultats attendus pour les tests du moteur.
