# MIND — Modèle de données (étape 4 / V1-M0)

**Statut : validé par Max (16/11/2026), y compris le défaut des groupes non cochés (§4).**
Aucun fichier de code n'a été créé à ce stade. Chaque champ indique la règle (REGLES.md) ou la mission (MISSIONS.md) qui le justifie.

---

## 0. Principes

| Principe | Choix | Justification |
|---|---|---|
| Stockage | Une clé JSON par collection, préfixe `mind_`, dans le stockage local du téléphone (validé) | CADRAGE §5 ; V1-M0 |
| Numéro de version | Clé `mind_version`, champ `schema_version` (entier, valeur initiale 1). Toute modification du schéma incrémente ce numéro et ajoute une migration | CADRAGE §5 ; V1-M0 |
| Dates | Texte `AAAA-MM-JJ`, sans heure | V1-M0 (dates en texte) ; P4 (l'appli ne connaît pas l'heure des séances) |
| « Aujourd'hui » | Passé en paramètre au moteur, jamais lu directement dans le moteur | V1-M0 ; testabilité avec Vitest |
| Semaine | Identifiée par un numéro de semaine (compteur depuis le début du plan) et la date de son lundi. Semaines commençant le lundi (validé) | S5 (compteur) ; V2-M1, P9 (rotation déterministe) |
| Passé figé | Une semaine antérieure à aujourd'hui n'est jamais recalculée ; seules les semaines à venir le sont | J2 ; V1-M0 |
| Unités | Distances en mètres ; durées en minutes (volume de course) ; allures en secondes par km ; chronos en secondes entières ; charges en kg | U1, U2, A2, N, M16b |
| Données statiques | Bibliothèque d'exercices (`data/exercices.json`) et règles (`src/moteur/`) ne sont pas stockées dans `mind_` : elles font partie de l'appli | V0-M7 ; CADRAGE §5 |
| Charge de séance | Recalculée (RPE × durée), jamais stockée (validé) | K1 |

---

## 1. Clés

| Clé | Contenu | Justification |
|---|---|---|
| `mind_version` | Version du schéma | V1-M0 ; CADRAGE §5 |
| `mind_profil` | Réponses du formulaire de profil | V1-M3 ; CADRAGE §3 |
| `mind_chronos` | Historique des chronos et tests (ajout seulement) | N1, N4, T1-T6 |
| `mind_plan` | Plans générés (un seul actif à la fois) | V1-M0 ; Z5 |
| `mind_semaines` | Semaines du plan, avec volume prévu et réalisé | S1, S5, U6, J2 |
| `mind_seances` | Séances : prévu et réalisé | V1-M0 (plan généré et réalisé enregistrés) |
| `mind_charges` | Charges par exercice | M16-M19, M24 |
| `mind_bilans` | Bilan hebdomadaire (charge, saisie) | K1-K6, U6, Z1 |
| `mind_pauses` | Pauses et maladies | Z1-Z6 |
| `mind_reglages` | Paramètres modifiables (paliers, exclusions, zones) | M9, M12, M25, M31, C8 |
| `mind_sauvegarde_precedente` | Copie de sécurité automatique, une seule, créée avant chaque import et avant chaque migration. Exclue de l'export | Import avec remplacement et copie de sécurité (validé) ; copie aussi avant migration (décision de Max, 17/11/2026) ; V1-M4 |

---

## 2. Détail des champs

### `mind_version`

| Champ | Type | Rôle | Justification |
|---|---|---|---|
| `schema_version` | entier | Version du schéma. Valeur initiale : 1 | V1-M0 ; CADRAGE §5 |

### `mind_profil` (formulaire simple avec valeurs par défaut)

| Champ | Type | Rôle | Justification |
|---|---|---|---|
| `prenom` | texte, obligatoire dans le formulaire (décision de Max, 17/11/2026) | Affichage | CADRAGE §3 (Profil) |
| `objectif_course` | `10km` / `semi` / `marathon` / `pas_de_course` | Objectif course | CADRAGE §3 ; C1-C3, C8 |
| `pas_de_course_type` | `garder_forme` / `courir_plus` / `courir_plus_vite` / null | Sous-objectif sans course | C8 |
| `objectif_muscu` | `force` / `force_esthetique` / `hypertrophie` / `tonification` / `aucun` | Objectif muscu | CADRAGE §3 ; M1-M4 |
| `objectif_prioritaire` | `course` / `muscu` | Arbitrage en cas de conflit | CADRAGE §3 ; P6, J5 |
| `date_course` | date ou null | Date de la course visée | C10 (obligatoire pour 10 km, semi, marathon) |
| `jours_dispo` | liste de jours (`lun` à `dim`) | Jours d'entraînement, modifiables à tout moment | J1, J3 |
| `temps_par_jour_min` | entier (30, 45, 60, 90, …) | Temps par défaut | D1, D2 |
| `nb_seances_course` | entier | Nombre voulu de séances de course | J5 |
| `nb_seances_muscu` | entier | Nombre voulu de séances de muscu | J5 |
| `organisation_muscu` | `full_body` / `haut_bas` / `ppj` / `ppH` / `haut_bas_fb` / `je_ne_sais_pas` | Organisation muscu | M26 |
| `niveau_muscu` | `debutant` / `intermediaire` / `confirme` | Propositions par défaut, progression | M28, M21 |
| `equipement` | `salle` / `maison_halteres` / `poids_du_corps` | Exercices proposés | M29 |
| `chrono_ref_id` | identifiant (`mind_chronos`) ou null | Chrono de référence actif | N1, N4, N7 |
| `volume_declare_4sem_min` | liste de 4 entiers (minutes par semaine) | Volume de départ | N3, U1 |
| `course_reguliere_depuis` | date ou null | Ancienneté de la régularité | N2 (6 mois) ; CADRAGE §3 (régularité) |

Champs prévus pour plus tard, non saisis en V1 :
- `premier_lancement_termine` (booléen) : V5-M3.
- `mention_sante_vue` (booléen) : V5-M4.
- `style_musical` : réintroduit avec la musique, après V6 (décision de Max).

### `mind_chronos` (ajout seulement, jamais modifié)

| Champ | Type | Rôle | Justification |
|---|---|---|---|
| `id` | texte | Identifiant | Technique |
| `date` | date | Date du chrono ou du test | N4 (le niveau change avec un nouveau chrono) |
| `source` | `declare` / `test_6min` / `test_5km` / `course_reelle` | Origine du chrono | T1, T5 |
| `distance_m` | entier | Distance du chrono | N1 |
| `temps_s` | entier | Temps en secondes | N1, A1 |
| `vma_kmh` | nombre ou null | VMA, pour un test 6 min seulement | T3 : VMA (km/h) = distance (km) × 10 |
| `chrono_10km_estime_s` | entier | Chrono 10 km de référence pour A1 | T3 : 10 km ÷ (0,90 × VMA), 0,85 pour un coureur rouillé ou débutant |
| `niveau` | `debutant` / `intermediaire` / `confirme` / `avance` / `expert` | Niveau déduit | N ; N4 |

### `mind_plan`

| Champ | Type | Rôle | Justification |
|---|---|---|---|
| `id` | texte | Identifiant | Technique |
| `actif` | booléen | Un seul plan actif | Z5 |
| `objectif_course`, `objectif_muscu` | copie du profil à la génération | Traçabilité | Z5 (changement d'objectif) |
| `phase_depart` | `fondation` / `developpement` / `specifique` / `affutage` | Phase au départ | C1-C3, Z5 |
| `date_generation` | date | Date de calcul (« aujourd'hui ») | V1-M0 |
| `regles_version` | texte (`REGLES v6`) | Version des règles utilisée | Traçabilité ; CLAUDE.md (alignement) |

### `mind_semaines`

| Champ | Type | Rôle | Justification |
|---|---|---|---|
| `id` | texte | Identifiant | Technique |
| `numero` | entier | Compteur depuis le début du plan | S5 ; V2 (rotation déterministe) |
| `lundi` | date | Premier jour de la semaine | V1-M0 ; semaines du lundi (validé) |
| `plan_id` | identifiant | Plan auquel elle appartient | Z5 |
| `phase` | `fondation` / `developpement` / `specifique` / `affutage` / `recuperation` / `pause` | Phase | C1-C3, C11 |
| `type` | `normale` / `allegee` / `affutage` / `recuperation` / `pause` | Type de semaine | U6, S5, C6, C11, Z6 |
| `volume_course_prevu_min` | entier | Volume de course prévu | S1, C6 |
| `volume_course_realise_min` | entier | Volume réalisé | U6 (≥ 75 %), S1 |
| `est_normale` | booléen | Calculé à la fermeture de la semaine | U6 (base de S1, S5, S8) |
| `cycle_force_id` | identifiant ou null | Cycle de force en cours | M24, P8, Z6 |
| `figee` | booléen | Vrai une fois la semaine passée | J2 |

### `mind_seances` (un enregistrement par séance)

| Champ | Type | Rôle | Justification |
|---|---|---|---|
| `id` | texte | Identifiant | Technique |
| `date` | date | Jour de la séance | J3 ; V1-M0 |
| `semaine_id` | identifiant | Semaine | S5, P7 |
| `discipline` | `course` / `muscu` | Type de séance | CADRAGE §3 |
| `type_course` | `ef` / `vma_courte` / `vma_longue` / `seuil` / `allure_specifique` / `cotes` / `fartlek_structure` / `sortie_longue` / `test` | Famille | U3, U4, V1 |
| `variante` | texte (ex. `5x1000`) | Variante de la famille | V1-V4 |
| `prescription` | `{mode: duree\|distance, valeur}` | Prescription naturelle | U1, A3 |
| `allure_cible_s_km` | entier ou null | Allure de référence (interne pour l'EF, jamais affichée) | A1, A2, U2 |
| `rpe_vise` | intervalle (ex. `3-4`) | RPE visé | A6 |
| `recuperation` | `{type: arret\|marche\|trot\|active_ef, duree_s}` | Récupération | V4, R5 |
| `temps_dispo_min` | entier | Temps disponible ce jour | D1, D2 |
| `muscu` | objet (voir ci-dessous) | Contenu muscu | M5, M14, M20 |
| `regles` | liste de codes (ex. `["S3","P7"]`) | Règles appliquées | U8 ; CADRAGE §3 (« Pourquoi cette séance ? ») |
| `explications` | liste de phrases | Explications | R7, A2 |
| `statut` | `prevue` / `respectee` / `modifiee` / `pas_faite` | Résultat | R1, R4 |
| `realise` | objet (voir ci-dessous) | Saisie après séance | R1-R3 |
| `champs_modifies` | liste | Ce qui a changé | R3 |
| `depassement_confirme` | `{regle, date}` ou null | Plafond dépassé et confirmé | S9 |
| `ajustements` | liste de `{regle, phrase}` | Ajustements expliqués | R7, K5 |

Objet `muscu` :
- `objectif` : `M1` à `M4` ; `echauffement` : liste de `{pct, charge_kg}` (M14).
- `exercices` : liste de `{exercice_id, role, series, reps, charge_kg, repos_s}`. `role` vaut `principal`, `back_off`, `assistance`, `accessoire` ou `renfo_coureur` (M5, M7, M12, M20).

Objet `realise` :
- `date_saisie` (date), `duree_min`, `distance_m`, `allure_moyenne_s_km` (facultatif, R1).
- `rpe_global` (1-10, R2), `rpe_principal` (muscu, R2 ; sert à M16).
- `series` : liste de `{exercice_id, reps, charge_kg}` (V2-M3 : saisie en un geste).

### `mind_charges` (un enregistrement par exercice)

| Champ | Type | Rôle | Justification |
|---|---|---|---|
| `exercice_id` | texte | Référence à `data/exercices.json` | V0-M7 |
| `charge_actuelle_kg` | nombre ou null | Charge déclarée ou dernière charge | CADRAGE §3 (charges facultatives) ; M16 |
| `estimation_source` | `{reps, charge_kg, date}` ou null | Base du calcul de charge max | M19 (« X reps à Y kg ») |
| `charge_max_estimee_kg` | nombre | Charge max estimée | M19, M24 |
| `cycle_force_id` | identifiant ou null | Cycle en cours | M24 |
| `historique` | liste de `{date, charge_kg, reps}` | Dernières séances | M17 (double progression) ; M16 |

### `mind_bilans` (une entrée par semaine)

| Champ | Type | Rôle | Justification |
|---|---|---|---|
| `semaine_id` | identifiant | Semaine | K2 |
| `charge_hebdo` | entier | Somme des charges de séances | K2 (K1 : RPE × durée, recalculée) |
| `nb_seances_prevues` / `nb_seances_saisies` | entiers | Saisie | K6 (seules les semaines saisies comptent) |
| `saisie_complete` | booléen | Vrai si toutes les séances sont saisies | K6 ; Z1 |
| `alertes` | liste de `{regle: K3\|K4, phrase, acceptee}` | Alertes proposées, jamais automatiques | K3-K5 |

### `mind_pauses`

| Champ | Type | Rôle | Justification |
|---|---|---|---|
| `id` | texte | Identifiant | Technique |
| `debut` | date | Début de la pause | Z4 |
| `fin_prevue` | date ou null | Date de reprise, si connue | Z4 |
| `type` | `pause` / `maladie` | Type | Z2 (une semaine d'EF après maladie) |

La durée (Z1, Z6) et la question « Tu as fait une pause ? » après 7 jours (Z4) se calculent à partir de `mind_seances`. Elles ne sont pas stockées.

### `mind_reglages`

| Champ | Type | Rôle | Justification |
|---|---|---|---|
| `paliers` | objet `{barre_kg, barre_bas_kg, halteres_kg, machine_kg, poids_du_corps_lest_kg}` | Paliers de progression. `machine_kg` vaut **2,5 par défaut**, ajustable par l'utilisateur (validé) | M25 (modifiables) ; M16b |
| `groupes_statut` | objet `{muscle: prioritaire / secondaire / exclu}` | Priorités par groupe. Valeur d'un groupe non coché : **« secondaire »** (validé par Max). « Exclu » est un choix explicite | M9, M11, M30 |
| `exercices_jamais` | liste d'identifiants | Exclusions | M31, M10 |
| `exercices_preferes` | liste d'identifiants | Préférences | M31 |
| `renfo_coureur` | booléen | Renforcement pour coureur | M12, M27 |
| `plafond_volume_min` | entier ou null | Plafond choisi pour « courir plus » | C8 |
| `derniere_export` | date ou null | Date du dernier export, pour le rappel de sauvegarde (bandeau après 30 jours). Champ facultatif, sans changement de version du schéma | V1-M4 (décision de Max, 17/11/2026) |

---

## 3. Export, import et migrations

- **Export** (V1-M4) : un fichier JSON contenant `mind_version` et toutes les clés `mind_*`, sauf `mind_sauvegarde_precedente`, avec la date d'export. (CADRAGE §2 : export / import.)
- **Import** (validé : remplacement, précédé d'une copie de sécurité automatique) :
  1. Lire `schema_version`. Si elle est plus récente que l'appli, refuser avec un message.
  2. Appliquer les migrations en mémoire si la version est plus ancienne.
  3. Valider chaque collection. Tant que tout n'est pas valide, rien n'est écrit et aucune copie n'est faite.
  4. Copier les données actuelles dans `mind_sauvegarde_precedente` (une seule copie, remplacée à chaque import ou migration), puis remplacer les données. Si l'écriture échoue en cours de route, l'état d'avant est rétabli.
  Si une étape échoue, les données actuelles restent intactes. (Ordre aligné sur le code le 17/11/2026, avec l'accord de Max.)
- **Migration au démarrage** : mêmes étapes (migration en mémoire, validation, copie de sécurité, écriture). Décision de Max du 17/11/2026 : la copie est faite avant toute migration, pas seulement avant un import.
- **Migrations** (validé : dossier `src/donnees/`, un numéro de version par migration) : un fichier par migration, nommé par son numéro de version. Le schéma initial est la version 1.

---

## 4. Groupe musculaire non coché : « secondaire » (décision de Max)

Décision : un groupe non coché vaut **« secondaire »** (renfo, fin de séance, M9). « Exclu » reste un choix explicite de l'utilisateur, cohérent avec M11 (« un muscle coché » est exclu). Aucune règle de REGLES.md n'est modifiée.

Motif : un défaut « exclu » aurait donné un plan muscu sans aucun groupe travaillé (M9, M22) et ne respectait pas les valeurs par défaut de V1-M3.

---

## 5. Hors périmètre

- Synchronisation entre téléphones : hors périmètre (pas de serveur, CADRAGE §2). Chaque téléphone a ses données ; l'export sert au transfert.
