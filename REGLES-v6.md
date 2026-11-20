# MIND — Règles d'entraînement

Chaque règle a un code. Une règle absente ici **n'existe pas** : Claude Code doit demander.
Les valeurs sont des points de départ, à valider par Max sur les 3 profils (mission V0-M6).
Version 6 — décisions de Max du 17/11/2026 : C9 (seuil abaissé à 3 h), C13 (préparation longue avant un 10 km), M12 (renfo coureur en option), U5 (lourd = RPE visé ≥ 7), M20b (RPE visé), M17b (progression en léger) ; 18/11/2026 : M19 (calibrage au RPE, suivi des charges au choix), M22 (volume selon le nombre de séances), M23 (le temps limite), M13 (arbitrage), U7, S3 (sans %), S3b (supprimée), U9 (sortie longue ≥ 60 min), J8 (sortie de plus proposée), A3 (EF en distance par défaut), C13 (étendue au semi et au marathon), C14 (hausse calculée sur la prépa), N3b (sortie longue de départ), P10 (jour de sortie longue choisi), N8 (intenses selon le nombre de sorties), C15 (contenu des phases), C16, S5 (qualités en allégée), M6 (un principal par séance), M9, M12 (renfo réparti), M26 (3 séances), M32 (choix des exercices) ; 18/11/2026 (suite) : C14 (pic), J6 (jour doublé choisi par l'utilisateur), P11 (jour de l'EF), M6 (pas de principal jambes la veille d'une qualité ou de la sortie longue ; tractions strictes et leur schéma, assistées si aucune traction possible), C3 et C6 (affûtage marathon 2 semaines), C11 (semaine de course), RPE de l'exercice entier (M16, M17b, M19, M20b, R2). Détail dans DECISIONS.md.
Version 5 — décisions de Max du 16/11/2026 : N7 et table N (chrono), T3 et A1 (test 6 min, formule et source), M20 (back-off). Détail dans DECISIONS.md.
Version 3 — corrections des contradictions avec Max le 16/11/2026 (S3, S3b, C9, P7, P8, J5, N2, N7, A5, M17, C6).
Version 4 — revue technique du 16/11/2026 : contradictions (S8, S1/U6, M16), trous (C11, C12, M22, M31…),
risques coaching (M23, S2b, A5/R1), statut des règles (U7).
Les valeurs marquées *(à valider par Max)* sont nouvelles : elles s'appliquent tant que Max ne les a pas changées.

---

## U — Unités et définitions
| Code | Règle |
|---|---|
| U1 | Le **volume de course se compte en minutes**. Chaque séance garde sa prescription naturelle : EF en durée ou en distance (A3), fractionné en distance (5×1000 m) ou en durée (30/30, 3×10'). |
| U2 | Conversion distance → minutes pour les calculs : allure prévue de la séance. Pour l'EF : allure interne = allure marathon + 1'00, **jamais affichée** (A3). |
| U3 | **Séance intense** : VMA courte, VMA longue, seuil, côtes, fartlek structuré, allure spécifique 10 km, semi ou marathon, test (T). Une sortie longue avec blocs ou fin rapide **reste une sortie longue** ; ses blocs rapides comptent dans S2 et S2b, et ses minutes rapides sortent du volume facile (S4). *(Validé par Max, 16/11/2026.)* Une séance fun est classée selon son contenu. |
| U4 | **Volume facile** (S4) : EF, sortie longue facile, échauffement, récups trottées, retour au calme. |
| U5 | **Jambes lourdes** (P2) : séance contenant un polyarticulaire jambes (familles squat, charnière de hanche, fentes, presse, extension de hanche dont hip thrust) prescrit à **RPE visé ≥ 7** (M20b). En dessous de RPE 7, l'exercice n'est pas lourd. Ne comptent jamais : renfo coureur, mollets, gainage, isolation. *(Validé par Max, 17/11/2026 : le « lourd » dépend de l'intensité, pas du mouvement.)* |
| U6 | **Semaine normale** : ni allégée, ni affûtage, ni pause, **et volume de course réalisé ≥ 75 % du prévu** *(à valider par Max)*. Une semaine sous 75 % n'est pas normale : elle ne sert pas de base à S1, S5 ni S8 ; la semaine suivante repart de la dernière semaine normale (sans +10 %). |
| U7 | **Statut des règles** : **bloquante** (un plan généré ne la viole jamais), **conseil** (affiché, pas appliqué par le moteur), **proposée** (l'appli propose, l'utilisateur décide). Par défaut, une règle est bloquante. Conseils : P4, F5, M22 (secondaires sous leur fourchette), S3 (sortie longue > 50 %), P7 quand l'utilisateur a choisi le jour de sortie longue (P10), P1, P2 et P7 quand l'utilisateur maintient son jour doublé (J6). Proposées : K3, K4, T4, C5, C8 (fin de cycle), J8, N8 (2e qualité à 3 sorties). **Liste unique des règles levables** : bloquantes levables avec confirmation explicite : S (via S9), P5. **Non levable** : C9. *(Validé par Max, 16/11/2026.)* |
| U9 | **Sortie longue** = sortie facile d'**au moins 60 min**. Tant que la plus longue sortie de la semaine fait moins de 60 min, il n'y a pas de sortie longue : les sorties faciles sont des EF, et les règles propres à la sortie longue (P7 J+2, S3, S8, S2b) ne s'appliquent pas. *(Validé par Max, 18/11/2026.)* |
| U8 | Chaque décision du moteur renvoie les **codes des règles appliquées** (ex. `["S3", "P7"]`) : ils servent à la carte « Pourquoi cette séance ? » et aux tests. |

---

## S — Plafonds de sécurité (jamais dépassés par un plan généré)
| Code | Règle |
|---|---|
| S1 | Volume de course : +10 % maximum par rapport à la **dernière semaine normale** (U6). Base de calcul = le **plus petit** entre volume prévu et volume réalisé de cette semaine. |
| S2 | 2 séances de course intenses maximum par semaine (séance fun et test compris). Une sortie longue avec blocs rapides compte dans ces 2. *(Validé par Max, 16/11/2026.)* |
| S2b | Sortie longue avec **plus de 30 min** de blocs rapides (allure marathon, fin rapide) : **1 seule autre séance intense** cette semaine-là *(à valider par Max)*. Elle reste une sortie longue pour P7 et S3. |
| S3 | **Sortie longue (U9) limitée par sa progression, pas par un % du volume** *(réécrite par Max, 18/11/2026)* : au plus +15 min par rapport à la dernière sortie longue d'une semaine normale (S8) ; volume de la semaine au plus +10 % (S1) ; au plus la **sortie longue max** de la course préparée (tableau C1-C3) ; plafond absolu **3 h**. **Conseil** (U7) : sortie longue au-delà de **50 %** du volume de la semaine → l'appli le signale, sans bloquer. |
| S3b | ~~Marathon, phase spécifique : sorties longues clés jusqu'à 50 % du volume, 3 à 4 fois~~ → **supprimée** (18/11/2026) : S3 n'a plus de plafond en % |
| S4 | Environ 80 % du volume de course en intensité facile (U4) |
| S5 | Semaine allégée toutes les 4 semaines (**3 semaines normales + 1 allégée**), course et muscu ensemble. Le compteur avance d'une semaine par semaine calendaire, normale (U6) ou non ; il repart après une pause (Z6). Course : −40 % du volume de la dernière semaine normale ; les qualités gardent leur contenu et leur intensité avec **moins de fractions** (ex. 5 × 1000 m → 3 × 1000 m) *(validé par Max, 18/11/2026)*. Muscu : −40 % de séries, charges conservées. Reprise au **niveau de la dernière semaine normale**, puis +10 % ensuite. |
| S5b | Si semaine allégée et affûtage tombent ensemble, l'affûtage la remplace (pas les deux à la suite) |
| S6 | L'échauffement n'est jamais raccourci pour gagner du temps |
| S7 | Affûtage obligatoire avant une course (voir C6) |
| S8 | Une sortie longue ne dépasse pas de plus de **15 min** la **dernière sortie longue d'une semaine normale** (U6). Après une semaine allégée, la reprise se fait donc au niveau d'avant l'allègement (S5), pas depuis la sortie allégée. |
| S9 | Modification par l'utilisateur au-delà d'un plafond : avertissement clair + confirmation, puis acceptée. La semaine suivante revient dans les plafonds, sans prendre le dépassement comme base. |

---

## N — Niveau du coureur
| Niveau | Chrono 10 km | Séances intenses / sem. |
|---|---|---|
| Débutant | 60'00 et plus | 1 |
| Intermédiaire | 50'00 à 59'59 | 1 (2 si N6) |
| Confirmé | 42'00 à 49'59 | 2 |
| Avancé | 36'00 à 41'59 | 2 |
| Expert | moins de 36'00 | 2 |

- N1 : un chrono 5 km est converti en équivalent 10 km avec la formule de A1.
- N2 : pas de course régulière depuis 6 mois → un niveau en dessous (un débutant reste débutant).
- N3 : le volume de départ = volume actuel déclaré (4 dernières semaines), en km ou en minutes au choix (km convertis par U2).
- N3b : **sortie longue de départ** = la plus longue sortie déclarée des 4 dernières semaines (question facultative du profil, km ou minutes) si elle fait au moins 60 min (U9) ; sinon, ou sans réponse, pas de sortie longue au départ : elle apparaît quand l'EF la plus longue atteint 60 min. *(Validé par Max, 18/11/2026.)*
- N4 : le niveau change **uniquement avec un nouveau chrono** (test T ou course réelle). Le RPE ajuste les allures (A5), pas le niveau.
- N5 : seuils identiques pour tous.
- N6 : intermédiaire → 2 séances intenses si au moins 3 sorties par semaine et régulier depuis 6 mois.
- N8 : **séances intenses selon le nombre de sorties** *(validé par Max, 18/11/2026)* : **3 sorties ou moins → 1 séance intense au plus** (ex. 3 sorties : 1 qualité + 1 EF + 1 sortie longue) ; **4 sorties et plus → table N**. La sortie longue compte comme une sortie. **Proposition** (U7) : avec 3 sorties et un niveau à 2 intenses (table N, N6), l'appli propose une **2e qualité** à la place de l'EF **à partir de la phase de développement** ; l'utilisateur accepte ou non.
- N7 : **sans chrono** (ni 5 km ni 10 km), le profil est en niveau débutant et ne fait que de l'EF. Un test 6 minutes (T3) est programmé en semaine 1. La table ci-dessus s'applique **dès qu'un chrono 10 km existe** (ou un chrono 5 km converti, N1). Le débutant suit la même règle : sans chrono, EF uniquement ; avec chrono, la table s'applique. *(Validé par Max, 16/11/2026.)*

---

## T — Tests de référence
| Code | Règle |
|---|---|
| T1 | 3 tests au choix : **6 minutes à fond** (donne la VMA), **5 km à fond** sur terrain plat, **course réelle** de 5 ou 10 km |
| T2 | Test conseillé par défaut : 6 minutes si chrono de plus de 6 mois ou N2 ; sinon 5 km. L'utilisateur peut en choisir un autre. |
| T3 | Test 6 minutes : VMA (km/h) = distance parcourue (km) × 10, car 6 min = 0,1 h. Chrono 10 km estimé = 10 km ÷ (0,90 × VMA), soit **85 %** de la VMA au lieu de 90 % pour un coureur rouillé ou débutant. Vérification : 1 500 m en 6 min → VMA 15 km/h → 10 km à 13,5 km/h → **44'27"**. Ce chrono estimé sert ensuite de référence pour A1. *(Validé par Max, 16/11/2026.)* |
| T4 | Test proposé : fin de la phase de fondation ; ensuite toutes les 6-8 semaines (tous les 2 mois en « courir plus vite ») ; quand les allures ont gagné 10 s/km (A5) ; fin de semaine 2 si le chrono du profil a plus de 6 mois ; après une pause de 4 semaines ou plus (Z1) ; à la demande. |
| T5 | Le test **remplace** la séance qualité de la semaine et compte comme intense. Jamais en semaine allégée ni en affûtage. Une course réelle compte comme test. L'utilisateur peut décaler ou refuser → allures du dernier chrono. |
| T6 | Résultat : allures recalculées et niveau vérifié, expliqués en une phrase. |
| T7 | Test prévu (T4) sur une semaine allégée ou d'affûtage → décalé à la **première semaine normale suivante**. Si cette semaine est déjà en affûtage, le test est remplacé par la course elle-même (T5). |

---

## C — Plans de course
| Code | Objectif | Durée conseillée | Fondation | Développement | Spécifique + affûtage | Sortie longue max |
|---|---|---|---|---|---|---|
| C1 | 10 km | 8-12 sem. | 30 % | 40 % (VMA) | 30 %, affûtage 1 sem. | 1 h 15-1 h 30 |
| C2 | Semi | 10-14 sem. | 30 % | 35 % (seuil + VMA) | 35 %, affûtage 1-2 sem. | 1 h 45-2 h |
| C3 | Marathon | 16-20 sem. | 35 % | 30 % (seuil) | 35 %, affûtage 2 sem. | 2 h 45-3 h |

- La sortie longue max est une **cible** : la sortie longue y monte (S3, S8) sans la dépasser. Si elle n'est pas atteinte avant la phase spécifique, l'appli l'explique et peut proposer une sortie de plus (J8).
- C15 : **contenu des phases** *(validé par Max, 18/11/2026)*. Familles du tableau V ; la **première** de chaque case est la qualité par défaut quand une seule est permise (N, N8).

| Phase | 10 km (C1) | Semi (C2) | Marathon (C3) |
|---|---|---|---|
| Préparation (C13) | côtes | côtes | côtes |
| Fondation | côtes, puis fartlek structuré | côtes, puis seuil | côtes, puis seuil |
| Développement | VMA longue, puis VMA courte | seuil, puis VMA longue | seuil, puis VMA longue |
| Spécifique | allure 10 km, puis VMA longue | allure semi, puis seuil | allure marathon, puis seuil |
| Affûtage | allure 10 km raccourcie | allure semi raccourcie | allure marathon raccourcie |

  Sortie longue (U9) : fondation facile ; développement progressive ; spécifique fin rapide (10 km), blocs allure semi (semi), blocs allure marathon (marathon, S2b). Une sortie longue avec blocs ou fin rapide **compte comme intense** (U3, S2) : si le nombre de séances intenses permis (N, N8) est déjà atteint par les qualités, **elle reste facile**.
- C16 : **arrondi des phases** : nombre de semaines de chaque phase (en %) arrondi à l'entier le plus proche ; l'écart va à la phase de développement (ex. C1 sur 12 semaines → 4 / 4 / 4). *(Validé par Max, 18/11/2026.)*
- C4 : durée plus courte que conseillée → phases compressées (affûtage conservé)
  + note d'avertissement. Plan accepté.
- C5 : délai très court (ex. marathon < 6 sem.) → proposer un objectif « finir » ou une
  distance plus courte. L'utilisateur décide.
- C6 : affûtage = volume de course −30 à −50 % **par rapport à la dernière semaine normale**, intensité conservée.
  Progression *(à valider par Max)* : 1 semaine → −40 % ; 2 semaines → −30 % puis −50 %. La course compte dans le volume de sa semaine.
  Muscu pendant tout l'affûtage : comme une semaine allégée (−40 % de séries, charges conservées).
- C7 : tests de référence : voir T.
- C8 : **pas de course prévue** :
  - garder la forme : volume stable, variété, S5 ;
  - courir plus : +10 %/sem. jusqu'au plafond choisi par l'utilisateur ;
  - courir plus vite : volume stable, une séance qualité en rotation, test tous les 2 mois.
  - Toutes les 4-6 semaines : proposer de continuer, changer ou se fixer une course.
- C9 : marathon avec moins de **3 h** de course par semaine *(abaissé de 4 h à 3 h par Max, 17/11/2026)* ou moins de **3 sorties** par semaine →
  **refus fort** : l'appli propose d'abord un plan « monter le volume », puis le marathon.
  Non levable (U7) : l'utilisateur ne peut pas passer outre.
- C10 : la date de course est obligatoire pour un objectif 10 km, semi ou marathon.
- C11 : **après la course** *(à valider par Max)* :

| Course | Récupération | Contenu |
|---|---|---|
| 10 km | 1 semaine | EF uniquement, −50 % du volume de la dernière semaine normale |
| Semi | 2 semaines | Semaine 1 : EF, −50 %. Semaine 2 : EF, −30 % |
| Marathon | 3 semaines | Semaine 1 : repos ou EF très court (≤ 30 min). Semaine 2 : EF, −50 %. Semaine 3 : EF, −30 %. Aucune séance intense |

  **La semaine de la course est la semaine 1 de la récupération** : la course, plus le contenu de la semaine 1 (marathon : au plus 30 min d'EF en plus de la course). *(Validé par Max, 18/11/2026.)*
  Muscu : semaine 1 = semaine allégée ; jambes lourdes (U5) en entretien pendant toute la récupération ; le cycle de force (P8, M24) reprend **à la fin de la récupération**.
  En fin de récupération, l'appli propose : nouvelle course, « pas de course prévue » (C8) ou changement d'objectif (Z5).
  La récupération compte comme une semaine non normale (U6) ; ensuite reprise à **80 % de la dernière semaine normale avant l'affûtage**, puis S1.
- C12 : **collisions de calendrier**, ordre de priorité : affûtage > récupération après course (C11) > semaine allégée (S5) > test (T7) > progression normale.
- C14 : **hausse du volume dans une prépa** *(validé par Max, 18/11/2026)* : la hausse est **calculée sur la durée de la prépa**, pas fixe.
  - **Volume de pic** = sortie longue max de la course (la plus grande entre le bas de la fourchette C1-C3 et la sortie longue de départ N3b, sans dépasser le haut de la fourchette ni le temps maximal de sortie longue de l'utilisateur ; validé par Max, 18/11/2026) + les autres sorties à leur durée maximale (temps du jour).
  - Le volume monte **régulièrement** du volume de départ (N3) au volume de pic, atteint à la **fin de la phase de développement** ; hausse hebdomadaire = écart restant ÷ semaines normales restantes, **au plus +10 %** (S1), au plus +5 % en préparation (C13).
  - Pic impossible à atteindre avec +10 % → le plan monte au maximum permis, l'appli l'explique, et J8 peut proposer une sortie de plus.
  - Hors course : C8 (« garder la forme » : **volume stable, aucune hausse** ; « courir plus » : +10 %/sem.).
- C13 : **préparation longue** : course plus lointaine que le seuil ci-dessous → phase de préparation, volume **+5 % par semaine au maximum**, **1 séance intense** par semaine, puis le plan de la course sur ses dernières semaines. Les plafonds S s'appliquent aussi. *(10 km validé par Max le 17/11/2026 ; étendu au semi et au marathon le 18/11/2026.)*

| Course | Seuil | Plan sur les dernières semaines |
|---|---|---|
| 10 km | plus de 12 semaines | C1 sur 12 semaines |
| Semi | plus de 14 semaines | C2 sur 14 semaines |
| Marathon | plus de 20 semaines | C3 sur 20 semaines |

---

## A — Allures
- A1 : chronos prédits avec la formule de Riegel (1981) : T(D2) = T(D1) × (D2 / D1)^1,06, depuis le chrono
  de référence. Pour le marathon, exposant **1,08** (choix de MIND, à valider par Max).
  Chrono de référence issu d'un test 6 minutes : voir T3 (chrono 10 km estimé = 10 ÷ (0,90 × VMA)). *(Validé par Max, 16/11/2026.)*

| Séance | Allure de référence |
|---|---|
| VMA courte (200-400 m, 30/30) | Allure 3 km prédite |
| VMA longue (800-1500 m) | Allure 5 km prédite |
| Allure 10 km | Chrono de référence |
| Seuil | Allure 15 km prédite |
| Allure semi / marathon | Prédites |
| Côtes | Au ressenti |
| EF | Jamais affichée (U2 pour le calcul interne) |

- A2 : chaque allure affiche une phrase : **d'où elle vient → ce qu'elle développe →
  pourquoi pas plus vite ni plus lent**.
- A3 : **EF** prescrite en distance OU en durée, jamais les deux, **jamais d'allure**.
  Par défaut *(validé par Max, 18/11/2026)* : **en distance arrondie au km** si l'utilisateur a un chrono (ex. « 10 km EF ») ; **en durée** sans chrono (N7) ou si l'utilisateur le préfère (réglage du profil).
  Une séance dure le temps de son contenu, **au plus** le temps disponible du jour (D1, D2) : elle ne « remplit » jamais ce temps.
  Consigne : « Tu dois pouvoir parler en phrases complètes. »
- A4 : « conditions difficiles » (chaleur, vent, dénivelé) → allures ralenties ou au ressenti,
  avec une phrase d'explication. *(Fonction reportée après V6.)*
- A5 : 2 séances de suite du même type courues au moins **5 s/km** plus vite que prévu, avec
  RPE ≤ RPE visé (A6) → allures de ce type **3 s/km plus rapides**. Maximum **10 s/km** plus rapide entre deux tests,
  ensuite un test est proposé (T4). L'allure réelle vient du champ facultatif de « Respectée » ou de « Modifier » (R1) ;
  une séance sans allure saisie ne compte pas pour A5.
- A6 : RPE visé par type de séance :

| Séance | RPE visé |
|---|---|
| EF | 3-4 |
| Sortie longue | 4-5 |
| Allure marathon | 6 |
| Seuil, allure semi | 7 |
| Allure 10 km, VMA longue | 8 |
| VMA courte, côtes | 8-9 |

---

## V — Variété des séances de course
| Famille | Exemples de variantes |
|---|---|
| VMA courte | 10×400, 15×200, 30/30, pyramide 200-400-600-400-200 |
| VMA longue | 5×1000, 4×1200, 6×800, 3×1500 |
| Seuil | 3×10', 2×15', 4×2 km, 20' continu |
| Allure spécifique | blocs allure 10 km / semi / marathon |
| Côtes | 10×30", 6×1' |
| Fartlek structuré | 8×(1' vite / 1' souple) |
| Sortie longue | facile, progressive, fin rapide, blocs allure marathon, vallonnée |

- V1 : dans un bloc, la **famille** reste la même, la **variante** change.
- V2 : même variante pas reproposée avant 3-4 semaines. Les classiques (ex. 5×1000) reviennent
  comme repères.
  Rotation **déterministe** (ordre fixe selon le numéro de semaine), jamais de tirage au hasard.
- V3 : variantes de charge équivalente pour une même place dans le plan.
- V4 : leviers de variation : effort (distance/durée), allure, nombre, durée de récup,
  **type de récup** (arrêt, marche, trot, active EF), structure.
- V5 : échauffement avec gammes avant tout fractionné.
- V6 : pas de fartlek libre.

## F — Séances fun (hors programme) — *reportées après V6*
- F1 : formats : alternance, progressif, pyramide, blocs, côtes. 2-3 curseurs.
- F2 : allures calculées et expliquées comme une séance normale.
- F3 : comptée dans la charge hebdo et dans S2.
- F4 : séance fun intense → la séance intense suivante devient un footing ou est décalée.
- F5 : séance fun mal placée (ex. veille de sortie longue) → signalée, jamais interdite.

---

## M — Musculation
### Objectifs
| Code | Objectif | Répétitions | Repos |
|---|---|---|---|
| M1 | Force pure | 3-5 | 3-5 min |
| M2 | Force + esthétique | 6-8 | 2-3 min |
| M3 | Hypertrophie | 8-12 | 1 min 30-2 min |
| M4 | Tonification | 12-20 | 45 s-1 min 30 |

Identique pour tous.

### Construction de séance
- M5 : ordre : mouvement principal → back-off → assistances → accessoires (polyarticulaires avant isolation).
- M6 : **un mouvement principal par séance**, choisi par l'utilisateur parmi les exercices
  « Peut être principal = Oui ». Il est **figé pendant un cycle de force** (M24).
  Proposition par défaut *(validé par Max, 18/11/2026)* : le premier polyarticulaire d'un muscle prioritaire ; sinon développé couché, tractions, rowing, en alternant d'une séance à l'autre. Une séance placée **toujours la veille** d'une qualité ou de la sortie longue (P2) ne reçoit pas de principal jambes, qui ne pourrait jamais être lourd (U5) : elle prend le premier principal d'un autre groupe prioritaire, sinon du haut du corps. *(Validé par Max, 18/11/2026.)*
  **Tractions** *(validé par Max, 18/11/2026)* : tractions strictes au poids du corps dès que l'utilisateur en fait au moins une ; **tractions assistées à la machine** seulement s'il n'en fait aucune. Le nombre de tractions strictes est demandé dans le profil quand les tractions sont proposées. Schéma propre aux tractions strictes, **à la place de la fourchette de l'objectif** (M2-M4) :
  - moins de 5 tractions strictes : **3 à 4 séries au maximum** de répétitions ; passage à 4 × 5 quand une série atteint 5 ;
  - 5 ou plus : **4 × 5**, puis 4 × 6, 4 × 7… : +1 répétition à la séance suivante quand le **RPE de l'exercice** (l'ensemble de ses séries, pas une seule série) est **inférieur à 7** ;
  - plafond **4 × 12** ; le lest viendra plus tard (pas de règle aujourd'hui).
- M7 : les autres exercices de la **même famille** deviennent ses assistances.
- M8 : par défaut, seuls les exercices **classiques** sont proposés. Complémentaires = alternatives.
  Spécifiques = seulement dans leur contexte (ex. bloc renfo coureur).
- M9 : groupe musculaire **prioritaire** → plus de volume (M22), en début de séance ;
  **secondaire** → renfo, fin de séance ; **exclu** → jamais. Quand tous les muscles sont secondaires, seul l'ordre M5 s'applique *(validé par Max, 18/11/2026)*.
- M10 : exercice exclu → remplacé par un autre du même muscle principal.
- M11 : tous les exercices d'un muscle coché exclus → avertir l'utilisateur.
- M12 : « **Renfo coureur** » est une **option** à cocher, qui s'ajoute à l'objectif muscu (M1-M4) ; ce n'est pas un objectif.
  Cochée par défaut si objectif course (désactivable, avec explication). Option cochée :
  - un bloc renfo coureur s'ajoute aux séances ;
  - si aucun muscle des jambes n'est prioritaire, la semaine ne contient **aucun exercice de jambes lourdes** (U5) : les jambes sont travaillées par le renfo coureur, et les polyarticulaires jambes restent possibles **en léger seulement (RPE visé ≤ 6**, ex. 4×10 au squat à RPE 5 ; progression M17b) ;
  - si un muscle des jambes est prioritaire, les jambes lourdes restent et le renfo coureur s'ajoute.
  *(Validé par Max, 17/11/2026.)*
  Le bloc renfo coureur **compte dans le nombre d'exercices** (M23), en fin de séance, **réparti** sur les séances de la semaine (1 à 2 exercices par séance) *(validé par Max, 18/11/2026)*.
- M13 : le **minimum prioritaire** M22 est impossible dans le temps disponible (M23, D5) → l'appli le dit et propose un arbitrage : **moins de groupes prioritaires**, ou **une séance de muscu de plus**. L'utilisateur décide. *(Précisé par Max, 18/11/2026.)* Un secondaire sous sa fourchette ne déclenche pas M13 (conseil, M22).
- M14 : échauffement muscu = séries de montée en charge calculées (ex. 50 %, 70 %, 85 %).
- M15 : hypertrophie : rotation des variantes possible, base stable sur plusieurs semaines.

- M32 : **choix entre plusieurs exercices possibles** : d'abord les préférés (M31), puis le muscle prioritaire (M9), puis l'ordre de `data/exercices.json`. Un exercice n'est **pas répété dans la semaine**, sauf le mouvement principal. *(Validé par Max, 18/11/2026.)*

### Volume
- M20 : séries par exercice :

| Place dans la séance | Séries |
|---|---|
| Mouvement principal | 3-5 |
| Back-off | 2 (M1 et M2 seulement, voir M21 ; 0 pour M3 et M4) |
| Assistances | 3 |
| Accessoires | 2-3 |

- M20b : **RPE visé seulement sur les exercices « durs »**, ceux dont l'intensité doit être dosée *(logique validée par Max, 17/11/2026 ; valeurs à valider par Max)*. Les autres exercices n'ont **pas de RPE visé** (ex. un curl en fin de séance).
  **Le RPE, visé comme noté, porte toujours sur l'exercice entier (toutes ses séries), jamais sur une seule série.** *(Validé par Max, 18/11/2026.)*

| Objectif | Exercices avec RPE visé | RPE visé |
|---|---|---|
| Force pure (M1) | Mouvement principal, back-off compris (unité de mesure du travail, M16) | 7-9 |
| Force + esthétique (M2) | Mouvement principal, back-off compris | 6-9 |
| Hypertrophie (M3) | Mouvement principal et assistances polyarticulaires | 6-8 |
| Tonification (M4) | Aucune | — |
| Jambes en léger (M12) | Plafond, pas une cible : polyarticulaires jambes | ≤ 6 |

  *(Valeurs validées par Max, 17/11/2026.)* Semaine de calibrage : ~7 (M19).
  **Choix de la valeur dans la fourchette** : le RPE visé monte au fil du bloc de 4 semaines (S5), du **bas** de la fourchette en semaine 1 au **haut** juste avant la semaine allégée (ex. hypertrophie : 6 → 7 → 8, puis allégée). *(Validé par Max, 17/11/2026.)*
  **Le RPE mesure la difficulté (proximité de l'échec), pas la charge** : un RPE 8 en force (3-5 reps, charge lourde) n'est pas la même charge qu'un RPE 8 en hypertrophie (8-12 reps). La charge se calcule toujours depuis la fourchette de répétitions de l'objectif (M1-M4) ; un RPE ne se compare pas d'un objectif à l'autre. Un polyarticulaire jambes à RPE visé < 7 n'est pas « lourd » (U5).
- M21 : back-off seulement en M1 et M2, à partir du niveau muscu intermédiaire : 2 séries à
  −10 à −15 % de la charge principale, +2 répétitions. Supprimés en premier si le temps manque (D5).
- M22 : séries par muscle et par semaine, **selon le nombre de séances de muscu** *(validé par Max, 18/11/2026 : tableau prudent, ~5 séries max par séance pour un prioritaire, ~3 pour un secondaire)* :

| Séances muscu / sem. | Prioritaire | Secondaire | Exclu |
|---|---|---|---|
| 1 | 4-6 | 2-3 | 0 |
| 2 | 8-10 | 4-6 | 0 |
| 3 et plus | 12-16 | 6-8 | 0 |

  **Statut** : le minimum **prioritaire est bloquant** (sinon M13). La fourchette **secondaire est une cible** : remplie après les prioritaires, dans l'ordre des zones (M30) ; un secondaire sous sa fourchette est signalé en **conseil** (U7), sans bloquer.
  **Comptage** : une série compte **1** pour le **muscle principal** de l'exercice (`data/exercices.json`), 0 pour les autres
  muscles *(à valider par Max ; règle simple, pas de demi-série)*. Les séries de montée en charge (M14) ne comptent pas ; les back-off comptent.
- M23 : nombre d'exercices selon le temps **et l'objectif** (les temps de repos M1-M4 changent tout) :

| Temps | Force pure (M1) | Force + esthétique (M2) | Hypertrophie / tonification (M3, M4) |
|---|---|---|---|
| 30 min | 2 | 3 | 3 |
| 45 min | 3 | 3-4 | 4 |
| 60 min | 4 | 5 | 5-6 |
| 90 min et plus | 5-6 | 6-7 | 6-8 |

  *(À valider par Max.)* Le moteur vérifie la durée estimée (séries × (temps d'exécution + repos) + montée en charge) ;
  si elle dépasse le temps choisi → D5.
  **Ce tableau est la proposition de départ ; la vraie limite est le temps** *(validé par Max, 18/11/2026)* : tant que la durée estimée tient dans le temps choisi, le moteur ajoute des exercices pour approcher les séries M22.

### Progression
| Code | Objectif | Méthode | On monte | On bloque |
|---|---|---|---|---|
| M16 | Force | Départ à 80 % de la charge max estimée, +2,5 %/sem. Répétitions : 5 (80-85 %), 4 (87,5 %), 3 (≥ 90 %) | Fin de semaine si RPE du principal (exercice entier) ≤ 8 | RPE 9 ou 10 → charge maintenue |
| M17 | Force + esthétique / Hypertrophie | Double progression | Haut de fourchette atteint → +2,5 kg **haut du corps** / +5 kg **bas du corps** à la barre ; autre matériel : palier M25 (M25 prime). Retour bas de fourchette | Idem |
| M18 | Tonification | Reps puis charge | 20 reps sur toutes les séries → + 1 palier M25, retour à 12 reps | Idem |

- M17b : **jambes en léger** (M12, RPE visé ≤ 6) : répétitions fixes ; charge **+1 palier M25** quand le RPE de l'exercice est **≤ 5**, sinon charge maintenue. *(Validé par Max, 17/11/2026 ; RPE de l'exercice, 18/11/2026.)*
- M16b : charges calculées en % **arrondies au palier M25 inférieur** (ex. 82,5 % de 100 kg = 82,5 kg → 82,5 kg à la barre ;
  avec des haltères de 2 en 2 kg, 33 kg → 32 kg).
- M16c : force pure **sans barre** (haltères, machine) → double progression M17 sur la fourchette **4-6 reps** au lieu des %.
  Force pure **au poids du corps** → M25 (lest ou variante plus dure), fourchette 3-5 reps. *(À valider par Max.)*

- M19 : **calibrage au RPE et suivi des charges au choix** *(validé par Max, 18/11/2026)* :
  - **Semaine 1 = calibrage** : aucune charge prescrite. Chaque exercice dur (M20b) indique des répétitions et un RPE visé ~7 ; l'utilisateur choisit sa charge pour l'atteindre. Jamais de test 1RM.
  - **Suivi au choix, exercice par exercice** (« suivre » oui / non), **jamais obligatoire**, même pour le mouvement principal (ex. force au développé couché et au squat, pas au soulevé de terre). Exercice suivi : l'utilisateur note charge et répétitions, et le RPE de chaque exercice dur.
  - **Exercice suivi** : charge max estimée depuis la meilleure série d'un exercice dur de la semaine de calibrage, avec le RPE de cet exercice, formule d'Epley corrigée par le RPE : charge max = charge × (1 + (reps + (10 − RPE)) / 30). Ex. : 8 reps à 80 kg à RPE 8 → 80 × (1 + 10/30) ≈ 107 kg. Charges et progression ensuite calculées (M16-M18, M16b, M25).
  - **Exercice non suivi** : répétitions (et RPE visé des exercices durs) seulement ; la charge reste au ressenti, sans progression calculée. En force pure non suivie, M16 s'applique en **RPE** (répétitions M16, RPE visé M20b) au lieu des %.
  - **Suivi coché plus tard** : la semaine où l'exercice devient suivi sert de calibrage pour lui seul.
- M24 : cycle de force = **8 semaines** (2 blocs de 4 avec semaine allégée). En fin de cycle :
  charge max réestimée depuis les dernières séries, nouveau cycle à 80 % ; l'utilisateur peut
  garder ou changer son mouvement principal.
- M25 : paliers (modifiables dans les paramètres) :

| Matériel | Progression |
|---|---|
| Barre | 2,5 kg (5 kg bas du corps, M17) |
| Haltères | Plus petit palier dispo, 2 kg par défaut |
| Machine | Une plaque |
| Poids du corps | Reps jusqu'au haut de fourchette → lest +2,5 kg ; sans lest → variante plus dure |
| Assisté (élastique, machine) | Moins d'assistance |

### Choix de l'utilisateur
- M26 : organisation choisie par l'utilisateur : full body ; haut / bas ; push / pull / jambes ;
  push / pull / haut (sans jambes) ; haut / bas / full body ; « je ne sais pas ».
  « Je ne sais pas » → proposition : 1-2 séances full body ; 3 séances full body ×3 ou haut /
  jambes / full body ; 4 séances haut / bas ×2 ; 5-6 séances push / pull / jambes.
  À 3 séances *(validé par Max, 18/11/2026)* : **full body ×3** si les jambes sont en léger (M12) ; **haut / jambes / full body** si un muscle des jambes est prioritaire.
- M27 : organisation sans jambes + objectif course → renfo coureur proposé quand même (désactivable).
- M28 : niveau muscu : débutant (< 6 mois), intermédiaire (6 mois-2 ans), confirmé (> 2 ans).
  Sert aux propositions par défaut et à M21.
- M29 : équipement (salle complète / maison avec haltères / poids du corps) → seuls les
  exercices faisables avec ce matériel sont proposés.
- M30 : « Quelles zones veux-tu travailler en premier ? » règle l'ordre des suggestions
  (remplace le critère du sexe).
- M31 : exercices **« jamais »** → M10. Exercices **« préférés »** → choisis en premier parmi les exercices de même muscle
  principal et de même place dans la séance (M5), même s'ils sont complémentaires (M8). Un exercice spécifique préféré
  reste réservé à son contexte. Un préféré ne remplace jamais le mouvement principal choisi (M6).

---

## P — Placement dans la semaine
| Code | Règle |
|---|---|
| P1 | Jamais deux séances de course intenses à la suite |
| P2 | Pas de jambes lourdes (U5) la veille d'une séance qualité ou de la sortie longue |
| P3 | Haut du corps : n'importe quel jour |
| P4 | Jambes lourdes + qualité le même jour : course d'abord, muscu ensuite. **Conseil** (U7) : « ≥ 6 h entre les deux » est affiché, l'appli ne connaît pas l'heure des séances |
| P5 | Au moins un jour de repos par semaine, sauf refus explicite |
| P6 | Règles impossibles avec les jours ou les choix de l'utilisateur → expliquer et proposer un arbitrage qui protège d'abord l'objectif prioritaire |
| P7 | Ordre de placement : sortie longue → qualité 1 → qualité 2 → EF → muscu. Écart minimum **J+2** entre la sortie longue et toute séance qualité, avant comme après (ex. sortie longue dimanche → qualités possibles du mardi au vendredi) ; qualité 2 à ≥ 48 h de qualité 1 (ex. mardi + jeudi) |
| P10 | **Jour de la sortie longue choisi par l'utilisateur** (profil), modifiable à tout moment (replanification J2). Par défaut : dimanche. Si ce jour empêche l'écart J+2 de P7 (ex. sortie longue dimanche, qualité lundi), le plan **respecte le choix** et affiche un **conseil** (U7) ; P7 reste bloquant pour tout placement choisi par le moteur. *(Validé par Max, 18/11/2026.)* |
| P11 | **Jour de l'EF** : parmi les jours encore possibles, celui dont l'écart avec la séance intense ou la sortie longue la plus proche est le plus grand ; à égalité, le plus tôt dans la semaine. Un jour doublé (J6) reçoit une course en priorité. *(Validé par Max, 18/11/2026.)* |
| P8 | Objectif course prioritaire : jambes en « secondaire » les 3 dernières semaines. Le cycle de force (M24) est **mis en pause** : mouvement principal jambes gardé en entretien (charges conservées, −40 % de séries), reprise du cycle après la récupération (C11) |
| P9 | Méthode de placement : le moteur essaie les placements possibles (recherche avec retour arrière) ; les règles bloquantes éliminent, les conseils et P7 départagent. Placement **déterministe** : mêmes entrées → même semaine |

## J — Jours et répartition
| Code | Règle |
|---|---|
| J1 | Jours choisis à l'inscription, modifiables à tout moment |
| J2 | Changement de jours → replanification à partir d'aujourd'hui (passé et phase inchangés) |
| J3 | Aucune séance hors des jours choisis |
| J4 | Maximum 1 course + 1 muscu par jour ; jamais 2 courses ni 2 muscu |
| J5 | L'utilisateur **choisit** son nombre de séances de course et de muscu. « Je ne sais pas » → proposition selon les tableaux ci-dessous. L'objectif prioritaire sert uniquement aux arbitrages (P6). |
| J6 | Plus de séances que de jours (choix de l'utilisateur ou proposition J5) → l'appli demande s'il veut doubler un jour, et lequel. Une proposition J5 qui dépasse le nombre de jours l'annonce clairement (« dont 1 jour doublé ») ; l'utilisateur accepte ou réduit. Chaque séance garde sa durée par défaut. Sinon, l'utilisateur choisit la séance qui saute ; l'appli conseille une séance de l'objectif secondaire. **Le jour doublé est celui que choisit l'utilisateur.** S'il oblige le plan à enfreindre une règle de placement (P1, P2, P7), l'appli affiche un message (conseil, U7) qui nomme la règle et propose un jour qui l'évite ; si l'utilisateur garde son jour, le plan le respecte. J4, les plafonds S et C9 restent bloquants. *(Validé par Max, 18/11/2026.)* |
| J7 | Contrôles sur les choix : au plus 2 séances par jour (J4), P5, C9, S2. En cas de conflit → P6. |
| J8 | Le nombre de sorties choisi est un **maximum**, jamais dépassé. L'appli peut **proposer** une sortie de plus (règle proposée, U7) quand la sortie longue max de la course (C1-C3) n'est pas atteinte **4 semaines avant la phase spécifique**. Refus → le plan s'adapte avec les sorties prévues ; pas de nouvelle proposition avant 4 semaines. *(Validé par Max, 18/11/2026.)* |

Propositions par défaut (J5) :

| Jours dispo | Course prioritaire (course / muscu) | Muscu prioritaire (muscu / course) |
|---|---|---|
| 2 | 2 / 0-1 | 2 / 0-1 |
| 3 | 3 / 1-2 | 3 / 1-2 |
| 4 | 3-4 / 2 | 4 / 2 |
| 5 | 4 / 2 | 4-5 / 2 |
| 6 | 4-5 / 2-3 | 5 / 2-3 |

Muscu prioritaire : la course reste surtout en EF, 1 séance qualité maximum.

## D — Temps disponible
- D1 : choix fixes 30 / 45 / 60 / 90 min (+ 2 h / 2 h 30 / 3 h pour la sortie longue).
- D2 : temps par défaut par jour + bouton « je n'ai que X min » le jour même.
- D3 : le corps de séance s'adapte ; l'échauffement garde son minimum (S6).
- D4 : sous ~25 min, proposer un autre type de séance (ex. footing) plutôt qu'un fractionné.
- D5 : muscu courte → moins d'exercices (M23), back-off supprimés en premier.

## R — Retour après séance
- R1 : boutons **Respectée** (un geste) / **Modifier** (champs pré-remplis) / **Pas faite**.
  Sur « Respectée », un champ **allure moyenne** facultatif (course, hors EF) permet A5 sans passer par « Modifier ».
- R2 : RPE global 1-10 après chaque séance. En muscu, **+ RPE de chaque exercice dur** (M20b), mouvement principal compris
  (sert à M16, M17b, M19 ; toujours l'exercice entier, jamais une série). Pas de fréquence cardiaque ni VFC.
- R3 : Modifier = seulement ce qui a changé (allure, nombre, type de récup, distance, série).
- R4 : Pas faite → proposer décaler / fusionner / sauter.
- R5 : récup changée en plus facile → la prochaine séance similaire part de cette récup, puis
  revient **d'un cran par séance réussie** (RPE ≤ visé). Type : arrêt → marche → trot → active EF.
  Durée : on revient de la moitié de l'écart à chaque séance.
- R6 : répétitions non terminées + RPE élevé → charge maintenue.
- R7 : chaque ajustement est expliqué en une phrase.

## K — Charge
- K1 : charge d'une séance = RPE global × durée (minutes).
- K2 : charge hebdo = somme des séances (course + muscu + fun).
- K3 : charge de la semaine > **+30 %** par rapport à la moyenne des 4 dernières semaines →
  l'appli propose d'alléger la semaine suivante.
- K4 : RPE ≥ RPE visé + 2, deux fois de suite sur le même type de séance → l'appli propose
  d'alléger la prochaine séance de ce type (allure, nombre ou récup).
- K5 : K3 et K4 sont toujours **proposés et expliqués**, jamais automatiques.
- K6 : **démarrage à froid** : K3 n'est actif qu'après **4 semaines** d'historique saisi ; avant, aucune alerte K3.
  Après une pause (Z1), la moyenne de K3 ne compte que les semaines saisies.

## Z — Pauses et changement d'objectif
- Z1 : reprise après une pause :

| Durée | Course | Muscu |
|---|---|---|
| 1 semaine | Volume de la dernière semaine normale | Mêmes charges |
| 2-3 semaines | −30 %, puis +10 %/sem. | Charges −10 % |
| 4 semaines et plus | Test (T) + plan recalculé | Nouveau calibrage (M19) |

- Z2 : après une maladie, première semaine en EF uniquement.
- Z3 : course prévue et temps restant trop court → C4 / C5.
- Z4 : bouton « Je fais une pause » (avec date de reprise si connue). Après 7 jours sans
  saisie, l'appli demande : « Tu as fait une pause ? »
- Z5 : changement d'objectif → nouveau plan à partir d'aujourd'hui ; volume réel, allures,
  charges et historique conservés ; phase de départ selon l'objectif et le temps restant.
- Z6 : pause et compteurs *(à valider par Max)* :

| Durée | Compteur de semaine allégée (S5) | Cycle de force (M24) |
|---|---|---|
| 1 semaine | Continue (la pause compte comme semaine allégée si elle tombait à sa place) | Continue où il en était |
| 2-3 semaines | Repart à zéro à la reprise | Reprend au début du bloc de 4 en cours |
| 4 semaines et plus | Repart à zéro | Nouveau cycle après calibrage (M19) |
