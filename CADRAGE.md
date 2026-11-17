# MIND — Document de cadrage

## 1. Objectif
Une application mobile installable, sans store, qui crée et fait évoluer des programmes
d'entraînement **course à pied et musculation**, avec un design sobre et premium.
Sa différence : gérer la course et la muscu **ensemble**, et **expliquer chaque choix**.
Principe : **l'utilisateur dit ses choix, l'appli s'adapte.** S'il ne sait pas, l'appli propose.

## 2. Public et contraintes
- 4 à 5 utilisateurs (profils fictifs A, B, C, quelques proches). Testeurs réels.
- Téléphone (iPhone et Android). Installation par « Ajouter à l'écran d'accueil ».
- Zéro coût : pas de store, pas de serveur, pas d'abonnement.
- Pas de compte. Données stockées sur le téléphone, avec export / import de sauvegarde.
- iPhone : les données de Safari et celles de l'appli installée sont séparées → l'appli invite à
  l'installer **avant** de remplir le profil.
- Premier lancement en 3 questions (objectif, jours, chrono), reporté à V5 ; en V1, formulaire simple. Le reste du profil est pré-rempli
  par défaut et modifiable ensuite.

## 3. Ce que fait la V finale (V6, partagée au groupe)

### Profil
- Prénom, objectif(s), date de course (si objectif course), jours disponibles (modifiables
  à tout moment), temps disponible par jour, chrono 5 ou 10 km (recommandé ; sans chrono, règle N7), volume de course
  actuel, régularité. Style musical : réintroduit avec la musique, après V6.
- Nombre de séances de course et de muscu voulues, organisation muscu (ou « je ne sais pas »).
- Niveau en muscu, équipement (salle / maison avec haltères / poids du corps),
  charges actuelles (facultatif).
- **Zones à travailler en premier** : règlent l'ordre des suggestions. Le profil ne demande pas le sexe.

### Objectifs
- Course : 10 km, semi, marathon, ou **pas de course prévue**
  (garder la forme / courir plus / courir plus vite).
- Muscu : force pure, force + esthétique, hypertrophie, tonification.
- Objectif prioritaire choisi en cas de cumul course + muscu : il sert à arbitrer les conflits.

### Musculation
- Bibliothèque d'exercices (`data/exercices.json`) avec : niveau d'usage
  (classique / complémentaire / spécifique), famille de mouvement, peut être principal, matériel,
  muscle principal (M10, M22), haut / bas du corps (M17), polyarticulaire / isolation (M5).
- Chaque groupe musculaire : **prioritaire / secondaire (renfo) / exclu**.
- L'utilisateur choisit son **mouvement principal** ; les autres exercices de la même
  famille deviennent ses assistances.
- Organisations au choix : full body, haut / bas, push / pull / jambes, push / pull / haut,
  haut / bas / full body.
- Exercices exclus « jamais » ou préférés, réglables dans les paramètres.
- Séances construites à partir de **séances modèles validées par Max**.
- Saisie en salle : « comme prévu » en un geste, ou correction de la série concernée.
- Progression automatique (voir `REGLES.md`).

### Course
- Plans par objectif, en phases (fondation, développement, spécifique, affûtage).
- Allures calculées depuis le chrono 5-10 km, **chacune expliquée en une phrase**.
- Tests de référence au choix : 6 minutes, 5 km, course réelle.
- EF prescrite en **distance OU durée**, jamais d'allure, consigne au ressenti.
- Familles de séances avec variantes (distance, allure, récup, type de récup, structure).
- **Format montre** compact pour recopier la séance sur la Garmin.
- Après séance : **Respectée / Modifier / Pas faite** + RPE.

### Commun
- Temps disponible : 30 / 45 / 60 / 90 min et plus (2 h à 3 h pour la sortie longue marathon).
- RPE global (1-10) sur chaque séance, charge hebdomadaire (RPE × durée), alertes de charge.
- Placement automatique des séances sur les jours choisis (règles P et J).
- Jour doublé uniquement à la demande de l'utilisateur.
- Bouton « Je fais une pause » et reprise adaptée.
- Carte **« Pourquoi cette séance ? »** sur chaque séance.
- Séances modifiables avant et après réalisation.

## 4. Plus tard (hors V6)
- Trail (dénivelé).
- Format course / marche pour grands débutants (sans chrono).
- Séances fun composées par l'utilisateur (règles F déjà écrites).
- Bouton « conditions difficiles » (règle A4 déjà écrite).
- Liens vers des playlists Spotify par type de séance.
- Organisation muscu libre (l'utilisateur compose chaque séance).
- Envoi de séances entre amis.
- Création de playlists Spotify selon la durée et le style.
- Export direct vers Garmin (faisabilité à vérifier).
- IA / coach.
- Récap mensuel « façon Replay », carte de partage.

**Toute nouvelle idée va d'abord dans cette liste.** On ne la sort qu'une fois la mission
en cours terminée, et après discussion.

## 5. Choix techniques
| Élément | Choix |
|---|---|
| Format | PWA installable |
| Code | React + Vite |
| Style | CSS simple |
| Structure | Règles d'entraînement dans `src/moteur/` (fonctions simples, sans affichage) ; l'interface affiche leurs résultats |
| Données | Stockage local du téléphone + export / import. Clés préfixées `mind_`, numéro de version des données |
| Tests | Vitest, sur le moteur, avec profils fictifs A, B, C |
| Hébergement | GitHub Pages (dépôt public `maxlad47/MIND`, adresse `maxlad47.github.io/MIND/`) |
| Outils de travail | VS Code + Claude Code + Git / GitHub Desktop. Aucun outil externe au départ |

## 6. Design
- Fond **clair**, ton **épuré et premium**, inspiration **Apple Music** (pas une appli sportive classique).
- Une séance = une « pochette » : grand titre, durée ou distance, couleur du type.
- Peu d'éléments par écran, typographie forte, animations courtes.
- Couleur toujours accompagnée du nom ou d'une icône (daltonisme).

| Type | Couleur |
|---|---|
| Fractionné, séries effectives | Rouge vif |
| Séries back-off | Rouge pastel |
| Sortie longue | Vert pastel |
| Endurance fondamentale, échauffement, récupération | Bleu |

## 7. Modèle de séance
1. Échauffement (avec gammes avant le fractionné)
2. 2-3 accélérations (course) ou séries de montée en charge (muscu)
3. Corps de séance
4. Retour au calme libre

## 8. Sécurité et responsabilité
- Mention au premier lancement : MIND n'est pas un avis médical ; en cas de douleur, on arrête.
- Les plans générés respectent toujours les plafonds de sécurité (`REGLES.md`, section S).
- Avertissements clairs (plan trop court, volume trop haut). Les modifications de l'utilisateur
  sont acceptées après confirmation. Seule exception de refus fort : marathon sans volume suffisant (C9),
  non levable.
