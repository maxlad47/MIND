# MIND — Test des règles sur 30 profils

Document de travail du 18/11/2026, **hors mission**. Règles appliquées : `REGLES.md` **v6** (revue du 18/11/2026) et `data/exercices.json` **v2**. Aucune règle n'a été modifiée : les écarts trouvés sont des **constats** et des **propositions**, à trancher par Max.

## Méthode

- **30 profils fictifs**. **P01-P20 tirés au hasard** (graine fixe 20261118, script reproductible), avec des retouches minimes quand une réponse est impossible dans le formulaire (jour de sortie longue hors des jours choisis, par exemple) ; chaque retouche est notée sous le titre. **P21-P30 sont des cas limites** choisis à la main (délai très court, sans chrono, C9, muscu seule, expert, poids du corps, reprise, 7 jours sur 7, exclusions, 30 min).
- Pour chaque profil : un **tableau profil / proposition**, les allures, le **calendrier** (prépa course) ou son résumé (sans course), **une semaine détaillée** avec les séances de course et de muscu, les **constats sur les règles** et mon **avis de coach**.
- Les chiffres (allures, volumes, calendriers) viennent d'un petit script d'aide qui applique A1, N, N3, U2, C13, C14, C16, S5, S8, C6 et C11. Le placement, la muscu et les avis sont faits à la main, règle par règle.
- Semaine 1 (W1) = lundi 23/11/2026. Volumes en minutes. EF jamais affichée en allure (allure interne indiquée pour les calculs).
- ⚠ = règle absente, ambiguë ou contradictoire : le plan applique un **choix provisoire** (Hn ci-dessous).

## Choix provisoires appliqués (règle absente)

| # | Trou | Choix appliqué |
|---|---|---|
| H1 | J5 donne une fourchette (2-3, 4-5, 0-1) | La valeur qui tient dans les jours choisis avec le moins de jours doublés |
| H2 | Affûtage semi « 1-2 semaines » (C2) | 2 semaines si le spécifique fait au moins 4 semaines, sinon 1 |
| H3 | Durée d'une séance de qualité | Au plus le temps du jour et 55 min, au moins 25 min (ou le volume de départ ÷ nombre de sorties) |
| H4 | Répartition du volume entre les séances | W1 : sortie longue = sortie longue de départ (N3b). La hausse va d'abord à la sortie longue (≤ +15 min, ≤ cible), puis aux EF (≤ temps du jour). Sans sortie longue déclarée : EF au temps du jour, la sortie du jour de sortie longue prend le reste |
| H5 | Rôle d'une sortie unique dans la semaine | Sortie longue facile (P16 : sortie longue à blocs, objectif « plus vite ») |
| H6 | Qualité hors course (C8) | Rotation par semaine : VMA courte, VMA longue, seuil, côtes |
| H7 | Volume déclaré supérieur à ce que les séances peuvent contenir | Départ au maximum possible |
| H8 | Jours doublés (J6 : choix de l'utilisateur) | Un choix plausible est supposé et noté « supposé » |
| H9 | Durée d'une série de muscu (D5, M23) | Comme les plans A-C : force 4'30, force + esthétique 3'05, hypertrophie 2'25, tonification 1'50, + 5 min de montée en charge |
| H10 | Organisation incompatible avec le nombre de séances (M26) | 1 séance → full body ; sinon les premières parties de l'organisation |
