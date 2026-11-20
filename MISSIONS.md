# MIND — Missions

Une session = une mission. Le suivi détaillé (statuts, retours) est tenu par Max à part.

Version de référence des règles : **REGLES.md v8** (voir CLAUDE.md). Modèles : Opus (conception, règles), Sonnet (développement), Haiku (retouches). « — » = tâche humaine, sans modèle.

Note : V0-M0 à V0-M4 ne sont pas suivies dans ce fichier et ne bloquent pas V1.

| Mission | Tâche | Modèle | Critère de fin |
|---|---|---|---|
| V0-M5 | Rédiger CLAUDE.md, CADRAGE.md, REGLES.md, DECISIONS.md, MISSIONS.md | Opus | Validés par Max et présents dans le dépôt (REGLES.md v5) |
| V0-M6 | Tester les règles à la main sur 3 profils | Opus | Plans papier crédibles pour les profils A, B, C, **anonymisés** (aucun prénom dans le dépôt, chronos conservés : décision de Max du 17/11/2026 ; vérification manuelle avant chaque publication), calculés à la main depuis REGLES.md et `data/exercices.json` (V0-M7 d'abord), réutilisables comme résultats attendus des tests. Inclut une semaine placée (règles P et J) par profil |
| V0-M7 | Ajouter `data/exercices.json` | Sonnet | Fichier dans le dépôt ; chaque exercice a : niveau d'usage, famille, peut être principal, matériel, muscle principal, haut / bas du corps, polyarticulaire / isolation |
| V1-M0 | Modèle de données (profil, plan, séances, historique, charges) | Opus | Plan des données validé, avec numéro de version et clés `mind_`. Le plan généré et le réalisé sont enregistrés ; seules les semaines à venir sont recalculées (J2). Dates stockées en texte `AAAA-MM-JJ` ; le moteur reçoit « aujourd'hui » en paramètre |
| V1-M1 | Créer le projet React + Vite, dossier `src/moteur/` | Sonnet | L'appli démarre en local, Vitest fonctionne |
| V1-M2 | Publier sur GitHub Pages, installer sur l'écran d'accueil | Sonnet | Installée sur iPhone et Android depuis `maxlad47.github.io/MIND/` ; message « Nouvelle version disponible » quand une mise à jour est publiée ; invitation à installer avant de remplir le profil (iPhone) |
| V1-M3 | Profil utilisateur (formulaire simple, valeurs par défaut ; premier lancement en 3 questions reporté à V5-M3) | Sonnet | Profil enregistré et modifiable |
| V1-M4 | Sauvegarde export / import + rappel | Sonnet | Restauration testée sur un autre téléphone |
| V2-M1 | Séances modèles muscu (Claude rédige le premier jet, Max corrige) | Opus | Push, pull, jambes, full body, haut, renfo coureur validés |
| V2-M2a | Génération muscu : choix des exercices | Opus | Exercices crédibles selon organisation, priorités, équipement |
| V2-M2b | Génération muscu : séries, charges, back-off | Opus | Conforme à M20-M23, séances crédibles pour les profils A et B |
| V2-M3 | Saisie en salle | Sonnet | Une série se note en un geste |
| V2-M4 | Progression + calibrage charge max | Opus | Conforme aux règles M16-M19, M24, M25 |
| V2-M5 | Test réel en salle (2 semaines) | — | Retours notés |
| V3-M1 | Familles et variantes de course | Opus | Bibliothèque course validée |
| V3-M2 | Allures + explications + tests | Opus | Chaque allure a sa phrase « pourquoi » ; tests T1-T6 |
| V3-M3a | Plan 10 km | Opus | Conforme aux règles C et S |
| V3-M3b | Plan semi | Opus | Conforme aux règles C et S |
| V3-M3c | Plan marathon | Opus | Conforme aux règles C, S, C9 |
| V3-M3d | Plan sans course prévue | Opus | Conforme à C8 et S |
| V3-M4 | Format montre + saisie après séance | Sonnet | Recopiée sur la montre en < 1 min |
| V3-M6 | Test du plan marathon | — | Validé par un testeur extérieur au développement |
| V4-M1 | Placement dans la semaine + répartition | Opus | Semaines correctes pour les 3 profils (règles P et J) |
| V4-M2 | Temps disponible | Sonnet | Séance adaptée sans rogner l'échauffement |
| V4-M3 | RPE, charge hebdo, ajustements, pauses | Opus | Ajustements expliqués (K, R, Z) |
| V4-M5 | Test complet | — | Aucun retour bloquant |
| V5-M1 | Design final | Sonnet | Validé par Max ; couleurs fixées pour seuil, allure spécifique, côtes et accessoires muscu |
| V5-M3 | Premier lancement | Sonnet | Premier plan en 3 questions (objectif, jours, chrono), reste du profil par défaut ; sans chrono → test 6 min en semaine 1 (N7) |
| V5-M4 | Mention santé | Sonnet | Affichée au premier lancement |
| V6-M1 | Partager la version au groupe | — | Les 3 testeurs l'utilisent au quotidien |

Reportées après V6 (voir CADRAGE, section 4) : V3-M5 séances fun, V4-M4 conditions difficiles,
V5-M2 liens Spotify.
