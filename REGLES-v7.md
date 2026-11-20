# MIND — Règles d'entraînement

**Version 7 — 19/11/2026 (remplacée par la v8, copie conservée).** Réécriture de la v6 (copie intégrale : `REGLES-v6.md`) après le test sur 30 profils (`plans/test-30/BILAN.md`). Mêmes codes, mêmes valeurs validées ; trous comblés, contradictions levées, texte raccourci. Chaque règle a un code ; une règle absente **n'existe pas** : Claude Code demande.

**Statut des règles (U7)** : par défaut **bloquante** (un plan généré ne la viole jamais). **Conseil** : affiché, pas appliqué. **Proposée** : l'appli propose, l'utilisateur décide.

## Changements v6 → v7

| Code | Changement | Constat du test (n°) |
|---|---|---|
| **E** (nouveau) | Contrôles du profil : jour de sortie longue, capacité, séances / jours, organisation, questions à poser, muscu seule | 1, 2, 4, 12, 24 |
| N3, E3 | Volume de départ = le plus petit entre déclaré et capacité, **avec message** | 1 |
| N8 (N6 fusionnée) | Intenses limitées aussi par le volume (< 150 min → 1 ; < 90 min → qualité douce) | 13 |
| V7 (nouveau) | Durée et progression des qualités (travail rapide par famille, du début à la fin de la phase) | 5, 11 |
| C14 | Pic = durées réelles ; pic ≤ départ → volume maintenu ; hausse répartie moitié sortie longue, moitié EF | 5, 11 |
| C4, C5, C16 | Au moins 1 semaine spécifique ; délai très court défini pour les 3 distances ; plan « finir » défini | 14 |
| C6, C2 | Affûtage semi = 1 semaine | 24 |
| C8 | 4 sous-objectifs (dont « muscu seule »), rotation des qualités, plafond, sortie unique toujours facile | 6, 16 |
| C9 | Minimum de sorties et de volume pour **les 3 distances**, moment du contrôle, porte de sortie | 6, 15 |
| U5 | Lourd = polyarticulaire jambes prescrit « lourd » (force, force + esthétique, hypertrophie), sauf s'il est prescrit en léger | 17 |
| P2 | Pas de jambes lourdes le jour de la sortie longue non plus | 19 |
| P7, P12, P13 | Sans sortie longue, la plus longue sortie joue son rôle ; jour de la qualité et de la muscu définis | — |
| M6 | Principal selon le type de séance, chaîne de repli par matériel, prioritaire d'abord, exclusion sautée ; lest des tractions | 3, 21 |
| M8, M32 | Complémentaires automatiques quand aucun classique n'est possible | 7, 8 |
| M12 | « Jambes » = quadriceps, ischios, fessiers (pas les mollets) ; renfo sans séance de muscu | 10, 18 |
| M20, M22 | Prioritaire : jusqu'à 4 séries par accessoire ; plafond M22 pour tous, principal compris | 8, 20 |
| M23 | Durée de série par objectif ; le temps fixe le nombre d'exercices (tableau supprimé) | — |
| M26 | Organisations possibles selon le nombre de séances ; le formulaire ne propose qu'elles | 2 |
| M11, M27 | Avertissements : muscle sans exercice, exclusion à risque pour un coureur, renfo proposé sans course | 23 |
| J5 | Une valeur par case (plus de fourchette) | 9 |
| S5 | Reprise après allégée : niveau d'avant + hausse prévue | doc |
| P5 | Refus du repos : conseil fort au-delà de 7 séances | 22 |
| P8 → M33 | Muscu en fin de prépa regroupée | — |

---

## U — Unités et définitions

| Code | Règle |
|---|---|
| U1 | Le **volume de course se compte en minutes**. Chaque séance garde sa prescription naturelle : EF en distance ou en durée (A3), fractionné en distance (5 × 1000 m) ou en durée (30/30, 3 × 10'). |
| U2 | Conversion km → minutes : allure prévue de la séance ; pour l'EF, allure interne = allure marathon prédite + 1'00, **jamais affichée**. Sans chrono, le volume se déclare en minutes (E2). |
| U3 | **Séance intense** : VMA courte, VMA longue, seuil, côtes, fartlek structuré, allure spécifique 10 km / semi / marathon, test (T). Une sortie longue avec blocs ou fin rapide **reste une sortie longue**, compte comme intense (S2) et ses minutes rapides sortent du volume facile (S4). |
| U4 | **Volume facile** (S4) : EF, sortie longue facile, échauffement, récupérations trottées, retour au calme. |
| U5 | **Jambes lourdes** (P2) : séance avec un polyarticulaire jambes (familles squat, charnière de hanche, fentes, presse, extension de hanche) en **force, force + esthétique ou hypertrophie**, sauf s'il est prescrit **en léger** (RPE visé ≤ 6, M12). Jamais lourds : tonification, renfo coureur, mollets, gainage, isolation. |
| U6 | **Semaine normale** : ni allégée, ni affûtage, ni récupération, ni pause, et volume réalisé ≥ 75 % du prévu. Seule une semaine normale sert de base à S1, S5 et S8. |
| U7 | **Statuts** (voir en tête). **Conseils** : P4, P5 (refus), P7 (jour de sortie longue choisi, J6 maintenu), P1 et P2 (J6 maintenu), S3 (> 50 %), M11, M22 (secondaires), E9. **Proposées** : C5, C8 (fin de cycle), J8, K3, K4, N8 (2e qualité), T4. **Levables avec confirmation** : S (via S9), P5. **Non levable** : C9. |
| U8 | Chaque décision du moteur renvoie les **codes des règles appliquées** (carte « Pourquoi cette séance ? », tests). |
| U9 | **Sortie longue** = sortie facile d'**au moins 60 min**. En dessous, c'est une EF ; S3, S8 et S2b ne s'appliquent pas (pour P7, voir P7). Une sortie longue en distance est arrondie au km **supérieur** si cela tient dans le temps choisi, sinon au km inférieur. |

---

## E — Profil : contrôles et questions *(nouveau en v7)*

| Code | Règle |
|---|---|
| E1 | Le **jour de sortie longue** se choisit parmi les jours disponibles. Défaut : dimanche, sinon samedi, sinon le dernier jour disponible. |
| E2 | Volume des 4 dernières semaines en **km ou en minutes** ; **sans chrono, en minutes seulement**. |
| E3 | **Capacité de course** = temps de sortie longue (au plus la sortie longue max de la course, S3) + (sorties − 1) × temps du jour. Volume déclaré > capacité → message chiffré (« Tu déclares 4 h, tes séances en contiennent 3 h 10 ») avec trois choix : plus de temps par séance, une sortie de plus, ou départ à la capacité (défaut). |
| E4 | **Séances et jours** : sorties ≤ jours ; muscu ≤ jours ; sorties + muscu ≤ 2 × jours (J4). Le formulaire bloque au maximum possible et l'affiche. |
| E5 | **Organisation muscu** : le formulaire ne propose que les organisations possibles pour le nombre de séances (M26). |
| E6 | **Questions posées seulement quand elles servent** : plus longue sortie récente (N3b) ; date du chrono (T2) ; nombre de tractions strictes (si des tractions sont possibles, M6) ; plafond de volume (« courir plus », C8 ; défaut : la capacité) ; jour doublé (J6) ; EF en durée plutôt qu'en distance (A3). |
| E7 | **Muscu seule** : objectif « pas de course » + 0 sortie. Aucune règle de course ne s'applique (ni N7, ni test). |
| E8 | **Course seule** : objectif muscu « aucun ». Si le renfo coureur reste coché, M12 s'applique sans séance de muscu. |
| E9 | **Réponses surprenantes** (conseil) : plus de 2 h en moyenne par sortie, ou plus de 4 h par semaine en niveau débutant, ou « pas régulier » avec un volume stable → l'appli demande confirmation, sans bloquer. |

---

## S — Plafonds de sécurité (jamais dépassés par un plan généré)

| Code | Règle |
|---|---|
| S1 | Volume de course : **+10 % maximum** par rapport à la dernière semaine normale (base = le plus petit entre prévu et réalisé). |
| S2 | **2 séances intenses maximum** par semaine (test et sortie longue à blocs compris). |
| S2b | Sortie longue avec **plus de 30 min** de blocs rapides → 1 seule autre séance intense cette semaine. |
| S3 | **Sortie longue** : au plus +15 min par rapport à la dernière sortie longue normale (S8), au plus la sortie longue max de la course (C1-C3), plafond absolu **3 h**. Conseil au-delà de **50 %** du volume de la semaine. |
| S4 | Environ **80 %** du volume en intensité facile. |
| S5 | **Semaine allégée** toutes les 4 semaines (3 normales + 1 allégée), course et muscu ensemble ; le compteur avance chaque semaine calendaire et repart après une pause (Z6). Course : −40 % du volume de la dernière semaine normale ; qualités : même contenu, **−40 % de travail rapide** (V7). Muscu : −40 % de séries, charges conservées. **Reprise** : niveau de la dernière semaine normale **plus la hausse prévue** de la semaine. |
| S5b | Allégée et affûtage ensemble → l'affûtage la remplace ; une allégée juste avant l'affûtage devient normale (jamais les deux à la suite). |
| S6 | L'échauffement n'est jamais raccourci pour gagner du temps. |
| S7 | Affûtage obligatoire avant une course (C6). |
| S8 | Une sortie longue ne dépasse pas de plus de **15 min** la dernière sortie longue d'une semaine normale (la sortie allégée ne sert pas de base). |
| S9 | Dépassement voulu par l'utilisateur : avertissement + confirmation ; la semaine suivante revient dans les plafonds sans prendre le dépassement comme base. |

---

## N — Niveau du coureur

| Niveau | Chrono 10 km | Séances intenses (table N) |
|---|---|---|
| Débutant | 60'00 et plus | 1 |
| Intermédiaire | 50'00 à 59'59 | 1 (2 si régulier depuis 6 mois) |
| Confirmé | 42'00 à 49'59 | 2 |
| Avancé | 36'00 à 41'59 | 2 |
| Expert | moins de 36'00 | 2 |

- N1 : un chrono 5 km est converti en 10 km par A1.
- N2 : pas de course régulière depuis 6 mois → un niveau en dessous (un débutant reste débutant).
- N3 : **volume de départ** = volume déclaré (moyenne des 4 dernières semaines), **au plus la capacité** (E3).
- N3b : **sortie longue de départ** = plus longue sortie récente si ≥ 60 min (U9), au plus le temps de sortie longue choisi (message si elle le dépasse) ; sinon pas de sortie longue au départ : elle apparaît quand la plus longue sortie atteint 60 min.
- N4 : le niveau change **seulement avec un nouveau chrono** (test ou course). Le RPE ajuste les allures (A5), pas le niveau.
- N7 : **sans chrono** → débutant, EF seulement, **test 6 min en semaine 1** (T3) ; la table s'applique dès le résultat.
- N8 : **séances intenses de la semaine** = table N, puis on prend la plus petite valeur parmi :
  - 3 sorties ou moins → **1** ;
  - volume de la semaine < **150 min** → **1** ;
  - préparation (C13) ou muscu prioritaire (J5) → **1** ;
  - sortie unique → **0** (C8, C9) ;
  - volume < **90 min** → la qualité est **douce** : fartlek structuré ou côtes courtes, jamais de VMA (C15).

  **Proposée** : quand la table donne 2 mais que la limite « 3 sorties » ramène à 1, l'appli propose une 2e qualité à la place de l'EF, à partir du développement (course) ou de la semaine 5 (C8).

---

## T — Tests de référence

| Code | Règle |
|---|---|
| T1 | Tests : **6 min à fond** (VMA), **5 km à fond** sur plat, **course réelle** de 5 ou 10 km. |
| T2 | Conseillé : 6 min si le chrono a plus de 6 mois, sans chrono ou si N2 ; sinon 5 km. |
| T3 | Test 6 min : VMA (km/h) = distance (km) × 10. Chrono 10 km estimé = 10 ÷ (0,90 × VMA), **0,85** pour un débutant ou un coureur rouillé. Ex. : 1 500 m → VMA 15 → 44'27". |
| T4 | Test proposé : fin de fondation ; puis toutes les 8 semaines ; quand les allures ont gagné 10 s/km (A5) ; en semaine 2 si le chrono a plus de 6 mois ; après une pause ≥ 4 semaines ; à la demande. |
| T5 | Le test **remplace** la qualité de la semaine et compte comme intense. Une course réelle compte comme test. Refus ou report → allures du dernier chrono. |
| T6 | Résultat : allures et niveau recalculés, expliqués en une phrase. |
| T7 | Test prévu sur une semaine allégée ou d'affûtage → première semaine normale suivante ; en affûtage, la course remplace le test. |

---

## C — Plans de course

| Code | Course | Durée conseillée | Fondation | Développement | Spécifique (affûtage compris) | Affûtage | Sortie longue max |
|---|---|---|---|---|---|---|---|
| C1 | 10 km | 8-12 sem. | 30 % | 40 % | 30 % | 1 sem. | 1 h 15-1 h 30 |
| C2 | Semi | 10-14 sem. | 30 % | 35 % | 35 % | 1 sem. | 1 h 45-2 h |
| C3 | Marathon | 16-20 sem. | 35 % | 30 % | 35 % | 2 sem. | 2 h 45-3 h |

- C4 : **durée plus courte que conseillée** → phases compressées avec avertissement : l'affûtage reste, **au moins 1 semaine spécifique hors affûtage**, le reste en développement puis fondation ; hausse du volume **+5 %/sem. au plus** (pas le temps d'absorber plus).
- C5 : **délai très court** — 10 km < 4 semaines, semi < 6, marathon < 8 → l'appli **propose** (U7) : un plan « **finir** » (pas de fondation ni de développement ; la sortie longue monte de +15 min par semaine vers sa cible, et le volume avec elle dans la limite de S1 ; 1 qualité par semaine à l'allure de la course ; affûtage) ou une distance plus courte. Si l'utilisateur garde le plan normal → C4.
- C6 : **affûtage** = volume −40 % (1 semaine) ou −30 % puis −50 % (2 semaines) par rapport à la dernière semaine normale ; intensité conservée, travail rapide au début de la fourchette V7. La course compte dans le volume de sa semaine. Muscu : M33.
- C8 : **pas de course prévue** — sous-objectifs :

| Sous-objectif | Volume | Qualité (N8) |
|---|---|---|
| Garder la forme | stable | rotation : fartlek, côtes, seuil, VMA longue |
| Courir plus | +10 %/sem. (S1) jusqu'au plafond (E6) | même rotation |
| Courir plus vite | stable | rotation : VMA courte, seuil, VMA longue, côtes ; test toutes les 8 semaines (T4) |
| Muscu seule | 0 sortie (E7) | — |

  Rotation : une famille par semaine, dans l'ordre, selon le numéro de semaine (V2). Une **sortie unique est toujours facile** (EF ou sortie longue) ; « plus vite » avec 1 sortie → message « 2 sorties minimum pour progresser ». Toutes les 8 semaines, l'appli propose de continuer, de changer ou de se fixer une course.
- C9 : **minimum pour préparer une course** (non levable) :

| Course | Sorties | Volume | Temps de sortie longue |
|---|---|---|---|
| 10 km | 2 | — | 1 h |
| Semi | 2 (3 conseillées) | 90 min | 1 h 30 |
| Marathon | 3 | 180 min | 2 h 30 |

  Contrôlé sur le volume atteignable au début du plan : fin de préparation (C13) s'il y en a une, sinon volume de départ + 2 semaines à +10 % ; la capacité (E3) doit aussi le permettre. Sous le minimum → **refus** avec trois portes de sortie chiffrées : « passe à X sorties / X min par séance », une distance plus courte, ou « courir plus » (C8) jusqu'au minimum puis la course si le délai le permet encore.
- C10 : date de course obligatoire pour 10 km, semi et marathon.
- C11 : **après la course** (la semaine de course est la semaine 1 de récupération) :

| Course | Récupération | Contenu |
|---|---|---|
| 10 km | 1 semaine | EF seulement, −50 % du volume de la dernière semaine normale |
| Semi | 2 semaines | S1 : EF, −50 %. S2 : EF, −30 % |
| Marathon | 3 semaines | S1 : repos ou EF ≤ 30 min en plus de la course. S2 : EF, −50 %. S3 : EF, −30 %. Aucune intense |

  Ensuite : reprise à 80 % de la dernière semaine normale avant l'affûtage, puis S1 ; l'appli propose nouvelle course, C8 ou changement d'objectif (Z5).
- C12 : **collisions** : affûtage > récupération > allégée > test > progression normale.
- C13 : **préparation longue** : course plus lointaine que le seuil → préparation (volume +5 %/sem. au plus, 1 qualité : côtes, fartlek si volume < 90 min), puis le plan de la course sur ses dernières semaines.

| Course | Seuil | Plan sur les dernières semaines |
|---|---|---|
| 10 km | > 12 semaines | C1 sur 12 |
| Semi | > 14 semaines | C2 sur 14 |
| Marathon | > 20 semaines | C3 sur 20 |

- C14 : **volume du plan**
  - **Sortie longue cible** = la plus grande entre le bas de la fourchette C1-C3 et la sortie longue de départ, sans dépasser le haut ni le temps de sortie longue choisi.
  - **Volume de pic** = sortie longue cible + EF au temps du jour + qualités à leur durée réelle (V7), atteint en fin de développement, puis maintenu en spécifique.
  - **Hausse** = écart restant ÷ semaines normales restantes, au plus +10 % (S1), +5 % en préparation (C13).
  - **Répartition de la hausse** : les qualités prennent d'abord leur propre hausse (V7) ; le reste va pour moitié à la sortie longue (S8, cible), pour moitié aux EF (temps du jour) ; ce qui ne rentre pas d'un côté va de l'autre ; ce qui ne rentre nulle part est perdu (message, J8).
  - **Pic ≤ départ** → volume maintenu ; la progression passe par le contenu des qualités (V7).
  - **La sortie longue ne baisse pas** d'une semaine normale à l'autre ; si les qualités grandissent plus vite que la hausse, les EF raccourcissent (30 min au moins).
  - **Une EF ne dépasse jamais la sortie longue.** Quand les EF l'ont rattrapée, la sortie longue continue de monter jusqu'au haut de la fourchette (S8).
  - **Sans sortie longue** (U9) : la sortie du jour de sortie longue reçoit une part et demie du volume facile, chaque EF une part ; elle devient sortie longue en atteignant 60 min.
- C15 : **contenu des phases** — la première famille est la qualité par défaut quand une seule est permise (N8) ; volume < 90 min → fartlek (N8).

| Phase | 10 km | Semi | Marathon |
|---|---|---|---|
| Préparation | côtes | côtes | côtes |
| Fondation | côtes, puis fartlek | côtes, puis seuil | côtes, puis seuil |
| Développement | VMA longue, puis VMA courte | seuil, puis VMA longue | seuil, puis VMA longue |
| Spécifique | allure 10 km, puis VMA longue | allure semi, puis seuil | allure marathon, puis seuil |
| Affûtage | allure 10 km | allure semi | allure marathon |

  Sortie longue : fondation facile ; développement progressive ; spécifique fin rapide (10 km), blocs allure semi (semi), blocs allure marathon (marathon). Une sortie longue à blocs compte comme intense : si le quota N8 est déjà pris par les qualités, **elle reste facile**.
- C16 : **arrondi des phases** à l'entier le plus proche ; l'écart va au développement ; au moins 1 semaine spécifique hors affûtage (C4).

---

## A — Allures

- A1 : chronos prédits par Riegel, T2 = T1 × (D2 / D1)^1,06 depuis le chrono 10 km de référence ; exposant **1,08** pour le marathon.

| Séance | Allure | RPE visé (A6) |
|---|---|---|
| VMA courte (200-400 m, 30/30) | 3 km prédit | 8-9 |
| VMA longue (800-1500 m) | 5 km prédit | 8 |
| Allure 10 km | chrono de référence | 8 |
| Seuil | 15 km prédit | 7 |
| Allure semi | semi prédit | 7 |
| Allure marathon | marathon prédit | 6 |
| Côtes, fartlek | ressenti | 8-9 / 7 |
| Sortie longue | facile | 4-5 |
| EF | jamais affichée | 3-4 |

- A2 : chaque allure affiche une phrase : d'où elle vient → ce qu'elle développe → pourquoi pas plus vite ni plus lent.
- A3 : **EF** en distance arrondie au km (avec chrono) ou en durée (sans chrono, ou si l'utilisateur le préfère), jamais d'allure. Consigne : « Tu dois pouvoir parler en phrases complètes. » Une séance dure le temps de son contenu, au plus le temps du jour.
- A4 : conditions difficiles (chaleur, vent, dénivelé) → au ressenti. *(Reportée après V6.)*
- A5 : 2 séances de suite du même type courues ≥ 5 s/km plus vite que prévu avec RPE ≤ visé → allures de ce type −3 s/km ; au plus −10 s/km entre deux tests, puis test proposé (T4). Seules les séances avec allure saisie comptent.

---

## V — Séances de course

| Famille | Variantes |
|---|---|
| VMA courte | 10 × 400, 15 × 200, 30/30, pyramide 200-400-600-400-200 |
| VMA longue | 5 × 1000, 4 × 1200, 6 × 800, 3 × 1500 |
| Seuil | 3 × 10', 2 × 15', 4 × 2 km, 20' continu |
| Allure spécifique | blocs allure 10 km / semi / marathon |
| Côtes | 10 × 30″, 6 × 1' |
| Fartlek structuré | 8 × (1' vite / 1' souple) |
| Sortie longue | facile, progressive, fin rapide, blocs allure marathon, vallonnée |

- V1 : dans un bloc, la famille reste, la variante change. V2 : rotation **déterministe** selon le numéro de semaine ; même variante pas avant 3-4 semaines. V3 : variantes de charge équivalente. V4 : leviers : distance, allure, nombre, récupération (arrêt, marche, trot, EF), structure. V5 : gammes avant tout fractionné. V6 : pas de fartlek libre.
- V7 : **durée et progression d'une qualité** *(nouveau en v7)* — séance = échauffement **15 min** + travail + récupérations + retour au calme **10 min** (10 + 5 si le temps du jour est ≤ 30 min ou le volume de la semaine < 120 min). Une qualité ne dépasse pas **40 %** du volume de la semaine (au moins 25 min). Le **travail rapide** monte du **début** à la **fin** de la phase, semaine normale après semaine normale :

| Famille | Travail rapide (début → fin) | Récupération entre fractions |
|---|---|---|
| VMA courte | 6 → 12 min | même durée, trot |
| VMA longue | 10 → 24 min | moitié de la fraction, trot |
| Seuil | 15 → 30 min | 2', trot |
| Allure 10 km | 15 → 25 min | 2', trot |
| Allure semi | 20 → 40 min | 2', trot |
| Allure marathon | 20 → 45 min | 2', trot |
| Côtes | 4 → 10 min | descente trottée |
| Fartlek | 6 → 12 min | incluse (1' souple) |

  Débutant : au plus le milieu de la fourchette. Allégée : −40 % (S5). Affûtage : début de fourchette (C6). Séance trop longue pour le temps du jour → moins de travail, jamais moins d'échauffement (S6) ; travail sous le début de fourchette → fartlek court ou EF (D4).

## F — Séances fun *(reportées après V6)*
- F1 formats : alternance, progressif, pyramide, blocs, côtes. F2 allures calculées comme une séance normale. F3 comptée dans la charge et dans S2. F4 séance fun intense → la suivante devient un footing ou est décalée. F5 mal placée → signalée, jamais interdite (conseil).

---

## M — Musculation

### Objectifs et séances
| Code | Objectif | Reps | Repos | Durée d'une série (M23) |
|---|---|---|---|---|
| M1 | Force | 3-5 | 3-5 min | 4'30 |
| M2 | Force + esthétique | 6-8 | 2-3 min | 3'00 |
| M3 | Hypertrophie | 8-12 | 1'30-2' | 2'30 |
| M4 | Tonification | 12-20 | 45 s-1'30 | 1'45 |

- M5 : ordre : principal → back-off → assistances → polyarticulaires → isolation → renfo coureur.
- M6 : **un mouvement principal par séance**, choisi selon le **type de séance**, premier disponible avec le matériel (M29) et non exclu :

| Type de séance | Principal par défaut (chaîne de repli) |
|---|---|
| Haut / push | développé couché barre → développé couché haltères → pompes |
| Pull | tractions strictes (≥ 1) → tractions assistées (machine) → rowing barre → rowing haltère → rowing inversé |
| Jambes / bas | squat barre → goblet squat → fentes bulgares haltères → fentes bulgares au poids du corps |
| Full body | séance 1 : haut ; séance 2 : jambes ; séance 3 : pull ; séance 4 : haut |

  - Un **muscle prioritaire** de la zone de la séance qui a un exercice « principal possible » passe en premier (ex. fessiers → hip thrust, ischios → soulevé de terre roumain, épaules → développé militaire).
  - Le principal jambes passe **en léger** (RPE ≤ 6, sans back-off) si les jambes sont en léger (M12), ou si la séance tombe la veille d'une qualité ou de la sortie longue, ou le jour de la sortie longue (P2).
  - L'utilisateur peut changer (M31). Le principal est figé pendant un cycle de force (M24).
- M6b : **tractions strictes** : moins de 5 → 3-4 séries au maximum ; 5 ou plus → 4 × 5, puis +1 rep quand le RPE de l'exercice est < 7 ; à 4 × 12 → **lest +2,5 kg et retour à 4 × 5**. Ce schéma remplace la fourchette de l'objectif.
- M7 : les autres exercices de la même famille sont les assistances du principal.
- M8 : exercices **classiques** par défaut ; un **complémentaire** est pris automatiquement quand aucun classique n'est possible pour un muscle (matériel, exclusion, M32) ; spécifiques seulement dans leur contexte (renfo coureur).
- M9 : **prioritaire** → plus de volume, en début de séance ; **secondaire** → après ; **exclu** → jamais.
- M10 : exercice exclu (« jamais ») → remplacé par un autre du même muscle.
- M11 : **avertissements** (conseil) : muscle sans aucun exercice possible (exclusions ou matériel) ; exclusion du dos, des quadriceps, des ischios ou des fessiers avec un objectif course.
- M12 : **renfo coureur** = option, cochée par défaut avec un objectif course. Muscles des jambes = **quadriceps, ischios, fessiers** (pas les mollets).
  - Aucun muscle des jambes prioritaire → polyarticulaires jambes **en léger** seulement (RPE visé ≤ 6, M17b) ; le renfo travaille les jambes.
  - Un muscle des jambes prioritaire → jambes lourdes permises, renfo en plus.
  - Le renfo compte dans les séries et la durée (1'30 la série), 1-2 exercices en fin de séance, répartis sur la semaine.
  - **Sans séance de muscu** : 2 exercices de renfo (≈ 10 min) après 2 EF par semaine.
- M13 : **minimum prioritaire impossible** dans le temps (M22, M23) → l'appli le dit et propose moins de prioritaires ou une séance de plus ; l'utilisateur décide.
- M14 : échauffement = séries de montée en charge (50 %, 70 %, 85 %), ≈ 5 min, pour le principal seulement.
- M15 : hypertrophie : variantes possibles, base stable sur plusieurs semaines.

### Volume
- M20 : séries par exercice : principal 3-5 ; back-off 2 (M21) ; assistances 3 ; autres 2-3, **jusqu'à 4 pour un muscle prioritaire**.
- M20b : **RPE visé** seulement sur les exercices durs, **toujours sur l'exercice entier** :

| Objectif | Exercices avec RPE visé | RPE visé |
|---|---|---|
| Force (M1) | principal + back-off | 7-9 |
| Force + esthétique (M2) | principal + back-off | 6-9 |
| Hypertrophie (M3) | principal + polyarticulaires | 6-8 |
| Tonification (M4) | aucun | — |
| Jambes en léger (M12) | polyarticulaires jambes | ≤ 6 (plafond) |

  Le RPE visé monte dans le bloc de 4 semaines : bas de fourchette en semaine 1, haut juste avant l'allégée. Semaine de calibrage : ~7 (M19). Le RPE mesure la difficulté, pas la charge.
- M21 : back-off seulement en M1 et M2, à partir du niveau intermédiaire, sur un principal **lourd** : 2 séries à −10 à −15 %, +2 reps. Supprimés en premier si le temps manque (D5).
- M22 : **séries par muscle et par semaine** (une série compte pour le muscle principal de l'exercice ; back-off compris, montée en charge non) :

| Séances / sem. | Prioritaire | Secondaire |
|---|---|---|
| 1 | 4-6 | 2-3 |
| 2 | 8-10 | 4-6 |
| 3 et plus | 12-16 | 6-8 |

  Minimum prioritaire **bloquant** (sinon M13) ; secondaire = cible (conseil). Le **haut de fourchette** vaut pour tous les muscles, **principal compris** : en cas de dépassement, on retire d'abord les autres exercices de ce muscle.
- M23 : **durée** = séries × durée d'une série (tableau M1-M4 ; renfo 1'30) + 5 min de montée en charge. Le moteur ajoute des exercices tant que la durée tient dans le temps choisi : d'abord jusqu'au **bas** de la fourchette M22 pour tous les muscles (prioritaires en premier), puis les prioritaires jusqu'au haut. Une séance dure son contenu, au plus le temps choisi ; au-delà → D5.

### Progression
| Code | Objectif | Méthode | On monte | On bloque |
|---|---|---|---|---|
| M16 | Force | 80 % de la charge max estimée, +2,5 %/sem. ; 5 reps (80-85 %), 4 (87,5 %), 3 (≥ 90 %) | RPE de l'exercice ≤ 8 | RPE 9-10 → charge maintenue |
| M17 | Force + esthétique, hypertrophie | double progression : haut de fourchette atteint → +2,5 kg haut du corps / +5 kg bas du corps à la barre, sinon palier M25 ; retour bas de fourchette | idem | idem |
| M18 | Tonification | 20 reps sur toutes les séries → +1 palier, retour à 12 | idem | idem |

- M16b : charges en % arrondies au palier inférieur (M25). M16c : force sans barre → double progression sur 4-6 reps ; **au poids du corps** → variante plus dure ou lest (M25), sur 3-5 reps, et conseil : « la force au poids du corps est limitée, l'hypertrophie est plus efficace ».
- M17b : jambes en léger : reps fixes, +1 palier quand le RPE de l'exercice ≤ 5.
- M19 : **semaine 1 = calibrage** au RPE ~7, aucune charge prescrite, jamais de 1RM. Suivi des charges au choix par exercice. Exercice suivi : charge max = charge × (1 + (reps + 10 − RPE) / 30), puis M16-M18. Non suivi : reps + RPE visé, charge au ressenti (force non suivie : M16 en RPE). Suivi coché plus tard → calibrage de cet exercice.
- M24 : cycle de force = 8 semaines (2 blocs de 4) ; en fin de cycle, charge max réestimée, nouveau cycle à 80 %, principal gardé ou changé.
- M25 : paliers : barre 2,5 kg (5 kg bas du corps) ; haltères 2 kg ; machine une plaque ; assisté : moins d'assistance ; poids du corps : variante plus dure (pompes → pompes déclinées → pompes lestées ; squat → fentes bulgares → squat sur une jambe ; tractions et dips → lest).

### Choix de l'utilisateur
- M26 : **organisations possibles** (E5) ; « je ne sais pas » = défaut :

| Séances | Organisations (défaut en premier) |
|---|---|
| 1 | full body |
| 2 | full body × 2 ; haut / bas |
| 3 | full body × 3 si jambes en léger, sinon haut / jambes / full body ; push / pull / jambes ; push / pull / haut (sans jambes, seulement si aucun muscle des jambes n'est prioritaire) |
| 4 | haut / bas × 2 ; push / pull / jambes / full body |
| 5-6 | push / pull / jambes (× 2) |

- M27 : organisation sans jambes → renfo coureur proposé (désactivable), avec ou sans course.
- M28 : niveau muscu : débutant (< 6 mois), intermédiaire (6 mois-2 ans), confirmé (> 2 ans).
- M29 : équipement : salle (tout), maison avec haltères (haltères + poids du corps), poids du corps.
- M30 : zones à travailler en premier → ordre des suggestions.
- M31 : exercices « jamais » (M10) et « préférés » (pris en premier à place égale ; jamais à la place du principal choisi ; un spécifique préféré reste dans son contexte).
- M32 : **choix d'un exercice** : préférés, puis muscle prioritaire, puis ordre de `data/exercices.json`. Pas de répétition dans la semaine, sauf le principal ; si rien d'autre n'est possible → M8.
- M33 : **muscu et course** : affûtage et semaine 1 de récupération = semaine allégée (−40 % de séries) avec jambes en léger ; 3 dernières semaines avant une course prioritaire : jambes en secondaire, cycle de force en pause (principal jambes en entretien) jusqu'à la fin de la récupération (C11).

---

## P — Placement dans la semaine

| Code | Règle |
|---|---|
| P1 | Jamais deux séances intenses à la suite. |
| P2 | Pas de **jambes lourdes** (U5) **la veille** d'une qualité ou de la sortie longue, **ni le jour de la sortie longue**. Le jour d'une qualité : après la course (P4). |
| P3 | Haut du corps : n'importe quel jour. |
| P4 | Course et muscu le même jour : course d'abord. Conseil : « au moins 6 h entre les deux ». |
| P5 | Au moins un jour de repos par semaine. Refus explicite accepté ; au-delà de 7 séances, **conseil fort** à chaque refus. |
| P7 | Ordre de placement : sortie longue → qualité 1 → qualité 2 → EF → muscu. Écart **J+2** entre la sortie longue et toute qualité, avant et après ; 48 h entre deux qualités. Sans sortie longue (U9), la plus longue sortie joue son rôle. |
| P9 | Placement **déterministe** (mêmes entrées → même semaine), par essais successifs : les règles bloquantes éliminent, les conseils départagent. |
| P10 | **Jour de sortie longue** choisi par l'utilisateur (E1). S'il empêche l'écart J+2, le plan respecte le choix et affiche un conseil. |
| P11 | **Jour de l'EF** : le plus grand écart avec la séance intense ou la sortie longue la plus proche ; à égalité, le plus tôt. Un jour doublé reçoit une course en priorité. |
| P12 | **Jour de la qualité** : parmi les jours permis par P7, celui qui équilibre le mieux l'écart avec la sortie longue avant et après ; à égalité, le plus tôt. |
| P13 | **Jours de muscu** : d'abord les jours sans course, puis les jours doublés (J6). La séance jambes va sur un jour qui respecte P2 ; au besoin, l'appli propose de doubler un jour de qualité (muscu après la course, P4) ; sinon la séance passe en léger cette semaine (message). |

## J — Jours et répartition

- J1 : jours choisis à l'inscription, modifiables à tout moment. J2 : changement → replanification à partir d'aujourd'hui. J3 : aucune séance hors des jours choisis.
- J4 : au plus 1 course + 1 muscu par jour ; jamais 2 courses ni 2 muscu (E4).
- J5 : nombre de séances choisi par l'utilisateur ; « je ne sais pas » → proposition :

| Jours dispo | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| Course prioritaire : sorties | 1 | 2 | 3 | 3 | 4 | 4 | 5 |
| Course prioritaire : muscu (si objectif muscu) | 1 | 1 | 1 | 1 | 1 | 2 | 2 |
| Muscu prioritaire : muscu | 1 | 2 | 2 | 3 | 3 | 4 | 4 |

  Muscu prioritaire : sorties = jours − muscu, au moins le minimum C9 de la course (1 sans course, 0 en muscu seule), 1 qualité au plus (N8). Une proposition qui demande un jour doublé l'annonce (« dont 1 jour doublé »).
- J6 : plus de séances que de jours → l'utilisateur choisit le jour doublé. S'il enfreint P1, P2 ou P7 : message qui nomme la règle et propose un autre jour ; choix maintenu si l'utilisateur le veut. J4, S et C9 restent bloquants.
- J8 : le nombre de sorties est un **maximum**. L'appli **propose** une sortie de plus quand la sortie longue cible n'est pas atteinte 4 semaines avant le spécifique, ou quand la hausse C14 est perdue faute de place ; refus → pas de nouvelle proposition avant 4 semaines.

## D — Temps disponible
- D1 : 30 / 45 / 60 / 90 min par jour ; 1 h, 1 h 30, 2 h, 2 h 30, 3 h pour la sortie longue. D2 : bouton « je n'ai que X min » le jour même.
- D3 : le corps de séance s'adapte (V7), l'échauffement garde son minimum (S6). D4 : sous ~25 min, footing plutôt que fractionné.
- D5 : muscu trop longue → back-off retirés d'abord, puis le dernier exercice, jusqu'à tenir (M23).

## R — Retour après séance
- R1 : **Respectée** (un geste, allure moyenne facultative) / **Modifier** (champs pré-remplis, seulement ce qui a changé, R3) / **Pas faite** (R4 : décaler, fusionner, sauter).
- R2 : RPE global 1-10 après chaque séance ; en muscu, + RPE de chaque exercice dur (exercice entier). Pas de fréquence cardiaque.
- R5 : récupération rendue plus facile → la séance similaire suivante part de là, puis revient d'un cran par séance réussie. R6 : reps non terminées + RPE élevé → charge maintenue. R7 : chaque ajustement est expliqué en une phrase.

## K — Charge
- K1 : charge d'une séance = RPE × durée. K2 : charge hebdo = somme.
- K3 : semaine > +30 % de la moyenne des 4 précédentes → proposition d'alléger la suivante. K4 : RPE ≥ visé + 2 deux fois de suite sur un même type → proposition d'alléger. K5 : toujours proposés et expliqués. K6 : K3 actif après 4 semaines d'historique.

## Z — Pauses et changement d'objectif

| Durée de pause | Course (Z1) | Muscu (Z1) | Compteur allégée (Z6) | Cycle de force (Z6) |
|---|---|---|---|---|
| 1 semaine | volume de la dernière semaine normale | mêmes charges | continue | continue |
| 2-3 semaines | −30 %, puis +10 %/sem. | charges −10 % | repart à zéro | début du bloc en cours |
| 4 semaines et plus | test + plan recalculé | nouveau calibrage | repart à zéro | nouveau cycle |

- Z2 : après une maladie, 1re semaine en EF. Z3 : temps restant trop court → C4 / C5. Z4 : bouton « Je fais une pause » ; après 7 jours sans saisie, l'appli demande. Z5 : changement d'objectif → nouveau plan dès aujourd'hui, historique conservé.
