# MIND — Instructions de travail

## Projet

MIND est une PWA installable, sans store ni serveur, qui crée et fait évoluer des programmes d'entraînement course à pied et musculation, avec un design sobre et premium.

- **Stack** : React + Vite. Style en CSS simple.
- **Logique** : les règles d'entraînement sont dans `src/moteur/` (fonctions simples, sans affichage). L'interface affiche leurs résultats.
- **Tests** : Vitest, sur le moteur, avec les profils fictifs A, B, C.
- **Hébergement** : GitHub Pages, dépôt public `maxlad47/MIND`, adresse `maxlad47.github.io/MIND/`.
- **Données** : stockées sur le téléphone, avec export / import. Clés préfixées `mind_`, numéro de version des données.
- **Pas de compte, pas de serveur, pas d'IA dans l'appli.** Claude Code est un outil de développement uniquement.

## Fichiers de référence

| Fichier | Rôle |
|---|---|
| `CADRAGE.md` | Périmètre, public, choix techniques, design, contenu de la V6 (version partagée au groupe). |
| `REGLES.md` | Règles d'entraînement, chacune avec un code (U, S, N, T, C, A, V, F, M, P, J, D, R, K, Z). **Version de référence : v6.** Une règle absente n'existe pas : on demande. |
| `DECISIONS.md` | Journal daté des décisions. Une décision notée n'est pas rediscutée sans raison nouvelle. |
| `MISSIONS.md` | Liste des missions V0 à V6, avec modèle assigné et critère de fin. Seul fichier qui définit une mission. |
| `AVANCEMENT.md` | Plan jusqu'à la V1 testable, état des étapes, points ouverts. |

## Règles de travail

1. **Une étape à la fois.** Une session = une mission.
2. **Validation de Max avant tout changement important**, et avant de commencer une nouvelle étape.
3. **Aucun code avant la validation de l'étape 0** (points flous).
4. **`AVANCEMENT.md` est mis à jour à chaque étape.**
5. **Modèle par mission** : Opus pour la conception et les règles, Sonnet pour le développement, Haiku pour les retouches. Une mission marquée « — » est une tâche humaine, sans modèle.
6. **Ne pas modifier le contenu des règles** sans demande explicite de Max. Les corrections de références et de numérotation sont permises, après signalement.
7. **Ne pas commiter ni pousser** sans demande explicite.
8. **Anonymat** : aucun prénom ni chrono réel identifiable dans le dépôt public.

## Vocabulaire des statuts

`À faire` · `En cours` · `Partiel` · `Fait` · `Validé Max` · `Bloqué` · `Inconnu (à confirmer par Max)`

Les statuts sont tenus dans `AVANCEMENT.md`, pas dans `MISSIONS.md`.

## Alignement des documents

- **Version de référence des règles** : `REGLES.md` (actuellement v6). Les autres documents la citent sans la recopier. Les mentions de versions antérieures sont historiques.
- **Numérotation des missions** : `V<n>-M<k>`, avec des sous-lettres `a`, `b`, `c` pour les découpes. Une étape sans mission est marquée « hors mission ».
- **Quand une règle change** : vérifier dans l'ordre `REGLES.md` → `DECISIONS.md` (ligne datée) → `MISSIONS.md` (critère) → `AVANCEMENT.md`.
- **Toute incohérence trouvée** : la signaler à Max avec la correction proposée, avant de la corriger.
