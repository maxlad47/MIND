# Plans papier — V0-M6

Plans des profils A, B, C (AVANCEMENT §12), calculés depuis `REGLES.md` **v8** et `data/exercices.json` v2 par l'outil de test `plans/test-v8/outils/moteur8.py`.
Ils serviront de **résultats attendus** aux tests du moteur. Rien n'y est choisi librement : chaque décision cite ses règles (U8).

État : **version v8 du 21/11/2026, validée par Max** (A 9/10, B 7/10, C 8/10 ; détail dans `plans/test-v8/BILAN.md`). Elle remplace la version 3 du 18/11 (règles v6), conservée dans l'historique Git. Les choix provisoires G1-G13 ci-dessous sont tous tranchés (historique).

## Conventions communes

- Semaine 1 (S1 du plan, notée **W1**) = lundi 23/11/2026. Semaines du lundi au dimanche (MODELE_DONNEES).
- Volume en **minutes** (U1). Les km déclarés sont convertis à l'allure EF interne = allure marathon prédite + 1'00 (U2, A1). Cette allure n'est jamais affichée (A3).
- Allures : Riegel depuis le chrono 10 km (A1), exposant 1,06 ; 1,08 pour le marathon. Arrondies à la seconde.
- Compteur de semaine allégée (S5) : W4, W8, W12, W16… (3 normales + 1 allégée) dès W1.
- Durées arrondies à la minute.

| Calendrier | W1 | W2 | W3 | W4 | W5 | W6 | W7 | W8 | W9 | W10 | W11 | W12 | W13 | W14 | W15 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Lundi | 23/11 | 30/11 | 07/12 | 14/12 | 21/12 | 28/12 | 04/01 | 11/01 | 18/01 | 25/01 | 01/02 | 08/02 | 15/02 | 22/02 | 01/03 |

Suite (profil C) : W16 08/03 · W17 15/03 · W18 22/03 · W19 29/03 · W20 05/04 · W21 12/04 · W22 19/04 · W23 26/04 · W24 03/05 · W25 10/05 · W26 17/05 · W27 24/05 · W28 31/05.

## Choix provisoires (règle absente) — à trancher par Max

| # | Trou | Choix provisoire appliqué |
|---|---|---|
| G1 | ~~Hausse de volume visée~~ → **tranché (18/11/2026)** : règle C14. | — |
| G2 | ~~Durée d'une séance = temps par jour~~ → **tranché (18/11/2026)** : une séance dure le temps de son contenu, au plus le temps du jour (A3) ; EF en distance arrondie au km. |
| G3 | ~~tranché~~ → **règle C16** (18/11/2026). | — |
| G4 | ~~Contenu des phases~~ → **tranché (18/11/2026)** : règle C15. | — |
| G5 | ~~Jour de la sortie longue~~ → **tranché (18/11/2026)** : règle P10. | — |
| G6 | ~~Sortie longue de départ~~ → **tranché (18/11/2026)** : règle N3b. | — |
| G7 | ~~tranché~~ → **règle S5** (18/11/2026). | — |
| G8 | ~~tranché~~ → **règle M26** (18/11/2026). | — |
| G9 | ~~tranché~~ → **règle M6** (18/11/2026). | — |
| G10 | ~~tranché~~ → **règle M32** (18/11/2026). | — |
| G11 | ~~tranché~~ → **règle M9** (18/11/2026). | — |
| G12 | ~~tranché~~ → **règle M12** (18/11/2026). | — |
| G13 | ~~Séries par muscle impossibles~~ → **tranché (18/11/2026)** : M22 selon le nombre de séances, M23 limité par le temps, M13 précisé. | — |
