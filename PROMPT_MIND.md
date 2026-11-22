# MIND — Prompt de création de l'application

> Prompt à donner à Claude Code dans un dossier vide. Commence par lire tout le document, propose un plan d'implémentation par étapes, puis construis l'application étape par étape en me montrant le résultat à chaque jalon.

---

## 1. Contexte et vision

Tu vas construire **MIND**, une application web de **génération et de suivi de programmes sportifs**. Elle s'installe sur l'écran d'accueil de l'iPhone (PWA) et s'utilise comme une app native.

- Je suis **coach sportif**. L'app sert à mes clients et à moi.
- Un client remplit un **formulaire d'entrée**. L'app génère aussitôt un programme personnalisé, visible tout de suite (je peux l'ajuster ensuite) :
  - **Musculation** seule (hypertrophie, force ou mixte),
  - **Course à pied** seule (10 km, semi-marathon, marathon),
  - **Musculation + course** combinées (ex. 3 séances de muscu + 2 de course par semaine).
- Le programme est **entièrement modifiable** par le client et par moi. Il **s'adapte automatiquement** aux performances, aux séances manquées et à la fatigue.
- L'app est **gratuite** pour mes clients (pas de paiement intégré).
- Interface **100 % en français**. Unités : kg, km, min/km.

---

## 2. Stack technique

| Élément | Choix |
|---|---|
| Front | React + TypeScript + Vite |
| Style | Tailwind CSS + composants maison (pas de librairie UI générique) |
| Animations | Framer Motion (transitions façon iOS, ressorts) |
| PWA | `vite-plugin-pwa` (manifest, service worker, icônes, `display: standalone`) |
| Backend / BDD / Auth | **Supabase** (Postgres, Auth email + magic link, Row Level Security, Edge Functions, cron) |
| IA | API Claude (modèle `claude-sonnet-5-5`), appelée **uniquement côté serveur** via une Supabase Edge Function |
| Notifications | Web Push (VAPID). Fonctionne sur iPhone iOS ≥ 16.4 quand l'app est ajoutée à l'écran d'accueil |
| Graphiques | Recharts |
| Glisser-déposer | dnd-kit (compatible tactile) |
| Tests | Vitest pour le moteur de génération |
| Hébergement | Vercel ou Netlify (front), Supabase (back) |

Contraintes :
- **Aucune clé secrète dans le front** : la clé Anthropic et la clé `service_role` Supabase restent dans les Edge Functions.
- Variables d'environnement documentées dans un `.env.example` : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `COACH_EMAIL`.
- Un `README.md` explique pas à pas, pour un non-développeur, comment créer le projet Supabase, lancer en local, déployer et ajouter l'app à l'écran d'accueil de l'iPhone.

---

## 3. Rôles et comptes

- **Inscription libre** : n'importe qui peut créer un compte (email + mot de passe, ou magic link). Chaque nouvel inscrit apparaît automatiquement dans ma liste de clients.
- **Rôle coach** : le compte dont l'email correspond à `COACH_EMAIL` reçoit le rôle `coach`. Tous les autres sont `client`.
- **Sécurité (RLS)** :
  - un client ne voit et ne modifie **que ses propres données** ;
  - le coach voit et modifie **les données de tous les clients**.
- Le coach a aussi accès à sa propre partie client s'il veut s'entraîner avec l'app (bascule « Espace coach / Mon entraînement »).

---

## 4. Formulaire d'entrée (onboarding)

Le formulaire suit le style Apple : **une question par écran**, grosses options cliquables, barre de progression, retour possible, sauvegarde automatique du brouillon. Il est modifiable plus tard depuis le Profil, ce qui propose de régénérer le programme.

### 4.1 Profil
- Prénom
- Date de naissance, sexe, poids (kg), taille (cm)
- Blessures et limitations : choix multiple par zone (épaule, coude, poignet, dos/lombaires, hanche, genou, cheville) + champ libre. **Ces données excluent ou remplacent automatiquement les exercices contre-indiqués.**
- Un court message invite à consulter un médecin en cas de doute avant de commencer.

### 4.2 Sports et fréquence
- Type de programme : Musculation / Course / Musculation + Course
- Nombre de séances par semaine **pour chaque sport** (muscu : 1 à 6 ; course : 2 à 6)
- **Jours disponibles** dans la semaine (L M M J V S D)
- Durée max par séance : 45 / 60 / 75 / 90 min
- Si les deux sports : **priorité** = Course / Musculation / Équilibré

### 4.3 Musculation
- Objectif : **Hypertrophie / Force / Mixte (powerbuilding)**
- Niveau déclaré : Débutant (< 1 an) / Intermédiaire (1–3 ans) / Avancé (> 3 ans)
- Données optionnelles : charges de travail récentes sur squat, développé couché, soulevé de terre, développé militaire (poids × reps). L'app en déduit un 1RM estimé (Epley).
- Split proposé automatiquement (voir 5.1), modifiable par le client à cet endroit.
- Matériel supposé : **salle de sport complète**.

### 4.4 Course
- Distance : **10 km / Semi-marathon / Marathon**
- **Date de la course** : l'app calcule le nombre de semaines de préparation
- Objectif : **Finir** ou **Chrono cible** (hh:mm:ss)
- Niveau déclaré + données optionnelles : VMA (km/h) et/ou un chrono récent (5 km, 10 km, semi, marathon, avec la date)
- Volume actuel : km par semaine et sortie la plus longue des 4 dernières semaines

---

## 5. Moteur de génération (hybride)

Architecture en **deux couches** :

1. **Moteur de règles déterministe** (TypeScript pur, dans `src/engine/`, sans dépendance UI, **couvert par des tests unitaires**). Il produit la structure complète du programme : semaines, séances, exercices, séries, reps, RIR, allures, volumes. Il doit fonctionner seul, même si l'IA est indisponible.
2. **Couche IA (Claude)**, via une Edge Function. Elle :
   - personnalise le programme généré (choix d'exercices selon les blessures et le profil, courte note explicative du coach pour chaque semaine) ;
   - produit l'analyse hebdomadaire et des **suggestions d'ajustement**.
   
   Elle répond **en JSON validé par un schéma (Zod)**. Si la réponse est invalide ou si l'appel échoue, on garde le résultat du moteur de règles. L'IA ne peut **jamais** sortir des garde-fous définis ci-dessous (volumes max, progression max, contre-indications).

### 5.1 Musculation

**Choix du split selon la fréquence** (proposé, modifiable) :
| Séances/sem | Split proposé |
|---|---|
| 1–2 | Full body |
| 3 | Full body ×3 (débutant) ou Haut / Bas / Full body |
| 4 | Haut / Bas ×2 |
| 5 | Haut / Bas + Push / Pull / Jambes |
| 6 | Push / Pull / Jambes ×2 |

**Paramètres par objectif** :
| | Hypertrophie | Force | Mixte |
|---|---|---|---|
| Polyarticulaires principaux | 6–10 reps, RIR 1–3 | 3–6 reps, RIR 1–3 (RPE 7–9) | 1er exercice en force (3–6 reps), le reste en hypertrophie |
| Accessoires / isolation | 10–15 reps (jusqu'à 20), RIR 0–2 | 6–10 reps, RIR 2 | 8–15 reps, RIR 1–2 |
| Repos | 90–180 s polyarticulaires, 60–90 s isolation | 3–5 min principaux, 2 min accessoires | selon le bloc |
| Volume hebdo par muscle | Débutant 8–10 séries, Inter 12–16, Avancé 16–20 | Plus bas en volume, priorité aux 4 mouvements de base | Intermédiaire entre les deux |

- La séance doit tenir dans la **durée max** choisie (estimation : temps par série + repos).
- **Progression : double progression + RIR**. Chaque exercice a une fourchette de reps. Quand **toutes les séries atteignent le haut de la fourchette au RIR cible**, la charge augmente (+2,5 kg haut du corps, +5 kg bas du corps, ou +2 à 5 %) et on repart du bas de la fourchette.
- **Cycle de 8 semaines** : semaines 1 à 7 en progression (RIR cible de 3 vers 1), **semaine 8 = décharge** (volume −40 à 50 %, RIR 4). En fin de cycle, l'app propose de générer le cycle suivant.
- **Bibliothèque d'exercices** (seed en base, environ 100 exercices de salle) avec pour chaque exercice : nom FR, muscle principal, muscles secondaires, schéma de mouvement (poussée horizontale, tirage vertical, squat, charnière de hanche…), matériel, niveau, **zones contre-indiquées**, liste d'alternatives, une consigne courte.
- **Remplacement d'exercice** : un tap propose des alternatives qui travaillent le **même muscle et le même schéma de mouvement**, en excluant celles contre-indiquées pour le client.

### 5.2 Course

**Calcul des allures** (affichées en **min/km**) :
- À partir de la VMA, ou d'une VMA estimée depuis un chrono récent (prédiction de Riegel pour comparer les distances).
- Sans donnée : allures prudentes selon le niveau déclaré + **séance test** en semaine 1 (test 6 min ou 5 km chrono) qui recalcule toutes les allures.

| Zone | % VMA |
|---|---|
| Récupération | 60–65 % |
| Endurance fondamentale (EF) | 65–75 % |
| Allure marathon | ~80 % |
| Allure semi | ~85 % |
| Seuil | 85–88 % |
| Allure 10 km | ~90 % |
| Fractionné VMA | 95–105 % |

**Durée de préparation** (calculée depuis la date de course) :
| Distance | Minimum | Idéal |
|---|---|---|
| 10 km | 6 sem | 8–10 sem |
| Semi | 8 sem | 10–12 sem |
| Marathon | 12 sem | 16–18 sem |

- Si la préparation est **trop courte** : alerte claire, puis proposition de passer en objectif « Finir » ou d'adapter le chrono.
- Si elle est **plus longue que l'idéal** : une phase de base (foncier) est ajoutée avant le plan spécifique.

**Structure** :
- Phases : **Base → Développement → Spécifique → Affûtage** (10 km : 1 sem ; semi : 1–2 sem ; marathon : 2–3 sem).
- Une **semaine allégée toutes les 3 à 4 semaines** (volume −20 à 30 %).
- Répartition **≈ 80 % en endurance facile / 20 % en intensité**.
- Progression du volume hebdomadaire **≤ 10 %** par semaine, en partant du volume actuel déclaré.
- Sortie longue max : 10 km → 14–16 km ; semi → 18–21 km ; marathon → 30–32 km (jamais plus de ~3 h).
- Types de séances : EF, sortie longue, fractionné VMA, seuil, allure spécifique, côtes, fartlek, récupération. Chaque séance détaille l'échauffement, le corps de séance (ex. « 6 × 1000 m à 4:15/km, récup 2 min trot ») et le retour au calme.
- Avec **2 sorties/semaine** : 1 séance de qualité + 1 sortie longue. Avec 3 ou plus : on ajoute de l'EF et une 2e séance de qualité selon le niveau.

**Objectif chrono** : l'app compare le chrono cible au chrono prédit depuis le niveau actuel. Si l'écart est irréaliste (ex. > 5–8 % plus rapide que la prédiction sur la durée de prépa), elle affiche un avertissement et propose un chrono réaliste. Le client garde le dernier mot.

### 5.3 Combinaison musculation + course

- La **priorité** choisie module les volumes :
  - **Course prioritaire** : volume jambes en muscu −30 à 50 %, haut du corps maintenu, pas de travail jusqu'à l'échec sur les jambes.
  - **Musculation prioritaire** : volume course réduit au minimum utile pour l'objectif, avec alerte si l'objectif course devient irréaliste.
  - **Équilibré** : compromis entre les deux.
- **Règles anti-conflit automatiques** lors du placement :
  - pas de séance lourde de jambes dans les **24 h avant** une séance de qualité (fractionné, seuil, allure spécifique) ni avant la **sortie longue** ;
  - pas de séance lourde de jambes le **lendemain** de la sortie longue ;
  - jamais 2 séances de qualité course consécutives ;
  - de préférence, jambes le même jour qu'une séance de qualité (course le matin, muscu le soir, au moins 6 h d'écart) ou le jour d'une EF ;
  - double séance le même jour seulement si le nombre de jours disponibles l'impose.
- En **semaine d'affûtage**, la muscu passe en entretien léger.

### 5.4 Placement dans la semaine
- L'app place automatiquement les séances sur les **jours disponibles** en respectant les règles ci-dessus.
- Le client (et le coach) peut **déplacer les séances par glisser-déposer**. Si le déplacement crée un conflit, un avertissement explique pourquoi et propose une alternative, mais on peut forcer.

---

## 6. Adaptation automatique

1. **Séance manquée** (non validée à la fin de la journée prévue) :
   - séance de qualité ou sortie longue → reprogrammée sur un jour libre de la même semaine **sans créer de conflit** ;
   - sinon, la séance la moins prioritaire saute (EF ou accessoires). On ne cumule jamais deux séances pour « rattraper ».
2. **Charges selon le RPE/RIR saisi** :
   - toutes les séries nettement plus faciles que la cible (RIR saisi ≥ cible + 2) → augmentation plus forte la séance suivante ;
   - séries plus dures (RIR < cible − 1) ou reps non atteintes → charge maintenue, ou −5 % après 2 échecs consécutifs.
3. **Allures recalculées** : nouveau chrono saisi, VMA mise à jour, ou sorties régulièrement plus rapides avec un ressenti facile → toutes les allures futures sont recalculées (avec confirmation).
4. **Fatigue / douleur** : un **check-in rapide avant la séance** (énergie 1–5, sommeil 1–5, courbatures 1–5, douleur oui/non + zone) :
   - score bas → séance allégée (volume −30 %, séance de qualité transformée en EF) ;
   - douleur sur une zone → exercices de cette zone remplacés, et le coach est notifié.
5. **Analyse hebdomadaire IA** (cron chaque dimanche soir) : résumé de la semaine + suggestions d'ajustement que le client ou le coach **accepte ou refuse**. Les suggestions ne s'appliquent jamais sans validation.

Chaque adaptation automatique laisse une trace visible (« Séance déplacée à jeudi car mardi non réalisé ») et peut être annulée.

---

## 7. Modification manuelle (coach et client)

Le coach **et** le client peuvent tout modifier :
- ajouter, supprimer ou remplacer un exercice ; changer séries, reps, charges, RIR et repos ;
- modifier une séance de course (distance, durée, blocs, allures) ;
- déplacer ou sauter une séance ;
- changer d'objectif ou de date de course, ce qui régénère la suite du programme en conservant l'historique.

Un **historique des modifications** indique qui a modifié quoi (coach ou client).

---

## 8. Séance en cours et saisie

### Musculation
- Liste des exercices de la séance. Pour chaque exercice, des lignes de séries : **poids, reps, RIR**, avec **les performances de la dernière fois affichées** à côté.
- Valider une série = un tap. La série suivante est préremplie.
- Bouton « Remplacer » sur chaque exercice (voir 5.1).
- Fin de séance : récap (tonnage, records battus, durée) et note de ressenti global.

### Course
- Détail de la séance avec les allures cibles.
- **Saisie manuelle** après la sortie : distance, durée, ressenti (1–10), commentaire. L'allure moyenne est calculée automatiquement.
- (V2 : import Strava / Apple Santé. Prévoir une table et une interface de « source » pour faciliter cet ajout plus tard.)

---

## 9. Suivi et statistiques (onglet Progrès)

- **Progression des charges et records** : courbe par exercice, 1RM estimé, records personnels (badge quand un record est battu).
- **Volume musculation** : séries par groupe musculaire et par semaine, tonnage hebdomadaire.
- **Course** : km par semaine, allure moyenne, sortie la plus longue, évolution des chronos et de la VMA.
- **Assiduité** : séances faites / prévues par semaine, série de semaines complètes.
- Filtres : 4 semaines / cycle en cours / tout.

---

## 10. Espace coach

- **Liste des clients** avec statut : actif / en retard / décroche (aucune séance depuis 7 jours), dernière séance, assiduité de la semaine, alertes (douleur signalée, suggestion IA en attente).
- **Fiche client** : profil, réponses au formulaire, programme complet modifiable, historique des séances, statistiques.
- **Commentaires** : le coach peut commenter une séance réalisée ou à venir. Le client reçoit une notification et peut répondre (fil de discussion par séance).

---

## 11. Notifications

- Rappel le jour d'une séance, à une heure choisie par le client dans le Profil.
- Notification quand le coach commente.
- Notification au coach quand un client signale une douleur.
- Un écran guide le client pour **ajouter MIND à l'écran d'accueil** (étape nécessaire sur iPhone pour recevoir les notifications), puis demande l'autorisation.

---

## 12. Design — inspiré d'Apple Music

### Principes
- **Thème clair / sombre automatique** selon le réglage de l'iPhone (`prefers-color-scheme`). Le sombre est le mode de référence : fond noir pur, surfaces gris très foncé.
- **Effets de flou et de transparence** (`backdrop-filter: blur`) sur la barre d'onglets, les barres de navigation et les feuilles modales.
- **Gros titres en gras** : titre de page de 34 px en gras qui se réduit en titre centré dans la barre de navigation au scroll, comme sur iOS. Police système : `-apple-system, "SF Pro Display", "SF Pro Text", system-ui`.
- **Grandes cartes visuelles** façon pochettes d'album : chaque séance et chaque programme a une « pochette » en **dégradé abstrait généré par code** (dégradé maillé ou formes floues, déterministe à partir de l'id de la séance), avec le titre en gros par-dessus.
- **Carrousels horizontaux** comme les rangées d'Apple Music (« Cette semaine », « À venir », « Records récents »).
- **Couleur par sport** :
  - Musculation : violet `#BF5AF2`
  - Course : orange `#FF9F0A`
  - Les dégradés des pochettes reprennent la couleur du sport ; une séance mixte (même jour) utilise les deux.
- Animations fluides (ressorts Framer Motion), feuilles modales qui glissent du bas, retour visuel au tap (léger rétrécissement).
- Respect des **safe areas** iPhone (encoche, barre home), `viewport-fit=cover`, aucune barre de défilement horizontale de page, zones tactiles ≥ 44 px.
- Icône d'app, `apple-touch-icon` et écrans de démarrage fournis. Le nom affiché sous l'icône est **MIND**.

### Navigation — client
Barre d'onglets en bas, translucide :
1. **Aujourd'hui** : grande carte de la séance du jour (bouton « Commencer »), check-in, prochaines séances en carrousel, dernier commentaire du coach.
2. **Programme** : vue semaine (glisser-déposer), navigation entre semaines, phase en cours (ex. « Semaine 5/12 · Développement »).
3. **Progrès** : statistiques et graphiques.
4. **Profil** : infos, formulaire modifiable, rappels, thème, déconnexion.

### Navigation — coach
Onglets : **Clients** · **Alertes** · **Mon entraînement** · **Profil**.

### États
Prévoir les états vides (pas encore de programme, pas encore de stats), de chargement (squelettes) et d'erreur, avec des messages en français clairs et bienveillants.

---

## 13. Modèle de données (indicatif)

- `profiles` : id, role (`coach`/`client`), prénom, date de naissance, sexe, poids, taille, blessures, heure de rappel
- `questionnaires` : réponses complètes du formulaire (versionnées)
- `programs` : client, type (muscu/course/mixte), objectifs, priorité, date de début, date de course, statut
- `program_weeks` : n° de semaine, phase, semaine allégée/décharge (oui/non), note IA
- `sessions` : semaine, date prévue, sport, type (ex. « Haut du corps », « Fractionné »), statut (prévue/faite/manquée/sautée), ordre
- `session_exercises` : séance, exercice, ordre, séries, fourchette de reps, RIR cible, repos, charge cible
- `set_logs` : exercice de séance, n° de série, poids, reps, RIR, horodatage
- `run_blocks` / `run_logs` : blocs prévus (distance/durée/allure) et réalisations (distance, durée, ressenti, source)
- `exercises` : bibliothèque (voir 5.1)
- `checkins` : énergie, sommeil, courbatures, douleur, zone
- `personal_records`
- `adaptations` : journal des adaptations automatiques et des suggestions IA (statut proposé/accepté/refusé, annulable)
- `edits_history` : qui a modifié quoi
- `comments` : séance, auteur, texte, parent
- `push_subscriptions`

Politiques RLS sur toutes les tables, conformes à la section 3.

---

## 14. Périmètre

### V1 (à livrer)
Tout ce qui est décrit ci-dessus.

### V2 (ne pas développer, mais ne pas bloquer)
Import Strava / Apple Santé / Garmin, mode hors connexion complet, suivi du poids et des mensurations, export PDF, fiches exercices avec vidéos, minuteur de repos, autres distances (5 km, trail), autres objectifs (perte de poids), nutrition.

---

## 15. Méthode de travail attendue

1. **Propose d'abord un plan** découpé en jalons et attends ma validation. Exemple :
   1. projet + PWA + design system ;
   2. Supabase (schéma, RLS, auth, rôles) ;
   3. formulaire d'entrée ;
   4. moteur muscu + tests ;
   5. moteur course + tests ;
   6. combinaison et placement ;
   7. séance en cours et saisie ;
   8. adaptations ;
   9. couche IA ;
   10. Progrès ;
   11. espace coach ;
   12. notifications ;
   13. déploiement.
2. À chaque jalon : code propre et typé, tests du moteur au vert, explication courte de ce qui a été fait et de **comment le tester sur mon iPhone**.
3. Le moteur de génération doit être testé sur des profils types, au minimum :
   - débutant hypertrophie 3×/sem ;
   - intermédiaire force 4×/sem avec douleur à l'épaule ;
   - marathon dans 16 semaines, 4 sorties, chrono 3:45 ;
   - 10 km dans 5 semaines (cas trop court) ;
   - mixte 3 muscu + 2 course, priorité course.
4. Si un point est ambigu, **pose-moi la question** au lieu de deviner.
