# MIND — Test des règles v8

Document de travail du 20/11/2026, hors mission. Règles : `REGLES.md` v8 ; exercices : `data/exercices.json` v2.

- `BILAN.md` : changements de règles, A/B/C, notes des 50 programmes, points ouverts.
- `A.md`, `B.md`, `C.md` : profils A, B, C (AVANCEMENT §12), anonymes.
- `R01.md` à `R50.md` : 50 profils fictifs construits pour couvrir tous les cas.
- `outils/` : `profils_v8.py` (profils), `moteur8.py` (applique les règles une par une, outil de développement, pas le moteur de l'appli), `rendu8.py` (programmes), `avis_v8.py` (avis du coach et notes), `digest.py` (résumé de relecture).

Relancer : `python3 outils/profils_v8.py && python3 outils/avis_v8.py && python3 outils/rendu8.py . profils_r50.json avis_v8.json && python3 outils/rendu8.py . profils_abc.json avis_v8.json`.
