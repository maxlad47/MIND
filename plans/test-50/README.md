# MIND — Règles v7 testées sur 50 profils

Document de travail du 19/11/2026, **hors mission**. Règles appliquées : `REGLES.md` **v7** (la v6 et la v7 se retrouvent dans le commit `ddde9cd` ; référence actuelle : v8) et `data/exercices.json` v2.

## Ce qui a été fait

1. **REGLES.md réécrit en v7** : mêmes codes et mêmes valeurs validées. Les 24 limites du test v6 sont traitées, le texte est plus court (408 lignes contre 448, tableau des changements compris) et un tableau « Changements v6 → v7 » ouvre le fichier. Nouveau code **E** (contrôles du profil). Aucun garde-fou n'a été retiré : S1-S9, C9 non levable, 80 % de facile.
2. **50 nouveaux profils** : **Q01-Q35 tirés au hasard** (graine fixe 20261119, aucune retouche à la main, c'est le formulaire v7 qui corrige) et **Q36-Q50 cas limites** choisis pour tester les nouvelles règles (C5 « finir », C9 sur les 3 distances, muscu seule, poids du corps, expert, 7 jours sur 7, renfo sans muscu, exclusions, force + course, E3).
3. **Plans calculés par un script qui applique les règles v7 une par une** (outil de développement, dans `plans/test-50/outils/`, pas le moteur de l'appli). Chaque décision renvoie son code (U8). C'est aussi un test : **si une règle manque, le script ne peut pas décider**. Sur les 50 profils, il n'est jamais resté bloqué. Les défauts de logique qu'il a révélés pendant la mise au point ont été corrigés dans REGLES.md (voir le bilan, §3).
4. **Chaque plan a été relu à la main** et reçoit un avis de coach.

## Lire un programme

- Tableau **Profil / Proposition**, allures, **calendrier complet** (volume, sortie longue, qualités), **semaine détaillée** (placement, séances de course, séances de muscu, séries par groupe).
- « **Ce que les règles ont décidé ou signalé** » : la liste des messages de l'appli, avec leur code et leur statut (bloquant, conseil, proposé).
- **Avis de coach** : 2-3 phrases.
- Hypothèses du test, à cause du papier : le jour doublé (J6) est « supposé » choisi par l'utilisateur ; sans chrono, le résultat du test 6 min est supposé (indiqué) ; en cas de délai très court (C5), l'utilisateur est supposé accepter le plan « finir » ; la semaine détaillée est une semaine normale du développement (ou la plus représentative).
- Volumes en minutes. W1 = lundi 23/11/2026. EF prescrite en km (A3), allure interne jamais affichée.
