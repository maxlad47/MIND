// Schéma et validation des collections (MODELE_DONNEES.md, V1-M0).
// Les champs dont aucune valeur par défaut n'est décidée valent null (« non renseigné »).

import { CLES, JOURS, STATUT_GROUPE_DEFAUT, STATUTS_GROUPE, VERSION_SCHEMA } from './constantes.js'
import { estDateValide } from './dates.js'

const estObjet = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)
const estEntierPositif = (v) => Number.isInteger(v) && v > 0
const estNombrePositif = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0

const enumere = (valeurs) => (v) => (valeurs.includes(v) ? null : `doit valoir : ${valeurs.join(', ')}`)
const chaine = (v) => (typeof v === 'string' ? null : 'doit être un texte')
const entierPositif = (v) => (estEntierPositif(v) ? null : 'doit être un entier positif')
const entierNonNegatif = (v) => (Number.isInteger(v) && v >= 0 ? null : 'doit être un entier supérieur ou égal à 0')
const date = (v) => (estDateValide(v) ? null : 'doit être une date AAAA-MM-JJ valide')
const booleen = (v) => (typeof v === 'boolean' ? null : 'doit être vrai ou faux')

// ---------- Profil (MODELE_DONNEES §2, mind_profil) ----------

const CHAMPS_PROFIL = {
  prenom: chaine,
  objectif_course: enumere(['10km', 'semi', 'marathon', 'pas_de_course']),
  pas_de_course_type: enumere(['garder_forme', 'courir_plus', 'courir_plus_vite']),
  objectif_muscu: enumere(['force', 'force_esthetique', 'hypertrophie', 'tonification', 'aucun']),
  objectif_prioritaire: enumere(['course', 'muscu']),
  date_course: date,
  jours_dispo: (v) =>
    Array.isArray(v) && v.every((j) => JOURS.includes(j)) && new Set(v).size === v.length
      ? null
      : `doit être une liste de jours sans doublon parmi : ${JOURS.join(', ')}`,
  temps_par_jour_min: entierPositif,
  nb_seances_course: entierNonNegatif,
  nb_seances_muscu: entierNonNegatif,
  organisation_muscu: enumere([
    'full_body',
    'haut_bas',
    'ppj',
    'ppH',
    'haut_bas_fb',
    'je_ne_sais_pas',
  ]),
  niveau_muscu: enumere(['debutant', 'intermediaire', 'confirme']),
  equipement: enumere(['salle', 'maison_halteres', 'poids_du_corps']),
  chrono_ref_id: chaine,
  volume_declare_4sem_min: (v) =>
    Array.isArray(v) && v.length === 4 && v.every((n) => Number.isInteger(n) && n >= 0)
      ? null
      : 'doit être une liste de 4 entiers (minutes par semaine)',
  course_reguliere_depuis: date,
  // Champs prévus pour plus tard (MODELE_DONNEES §2) : acceptés, non saisis en V1.
  premier_lancement_termine: booleen,
  mention_sante_vue: booleen,
}

export function profilVide() {
  const profil = {}
  for (const champ of Object.keys(CHAMPS_PROFIL)) profil[champ] = null
  profil.jours_dispo = []
  return profil
}

function validerProfil(valeur) {
  if (!estObjet(valeur)) return ['doit être un objet']
  const erreurs = []
  // Le prénom est obligatoire (décision de Max, 17/11/2026) : aucune sauvegarde antérieure à tolérer.
  if (typeof valeur.prenom !== 'string' || valeur.prenom.trim() === '') {
    erreurs.push('prenom : obligatoire')
  }
  for (const [champ, contenu] of Object.entries(valeur)) {
    const verifier = CHAMPS_PROFIL[champ]
    if (!verifier) {
      erreurs.push(`${champ} : champ inconnu`)
      continue
    }
    if (contenu === null || contenu === undefined) continue
    const message = verifier(contenu)
    if (message) erreurs.push(`${champ} : ${message}`)
  }
  return erreurs
}

// ---------- Chronos (mind_chronos) ----------

const SOURCES_CHRONO = ['declare', 'test_6min', 'test_5km', 'course_reelle']
const NIVEAUX_COURSE = ['debutant', 'intermediaire', 'confirme', 'avance', 'expert']

function validerChronos(valeur) {
  if (!Array.isArray(valeur)) return ['doit être une liste']
  const erreurs = []
  valeur.forEach((chrono, i) => {
    if (!estObjet(chrono)) {
      erreurs.push(`[${i}] doit être un objet`)
      return
    }
    const verifs = [
      ['id', typeof chrono.id === 'string' && chrono.id !== '', 'doit être un texte non vide'],
      ['date', estDateValide(chrono.date), 'doit être une date AAAA-MM-JJ valide'],
      ['source', SOURCES_CHRONO.includes(chrono.source), `doit valoir : ${SOURCES_CHRONO.join(', ')}`],
      ['distance_m', estEntierPositif(chrono.distance_m), 'doit être un entier positif'],
      ['temps_s', estEntierPositif(chrono.temps_s), 'doit être un entier positif'],
      [
        'vma_kmh',
        chrono.vma_kmh == null || estNombrePositif(chrono.vma_kmh),
        'doit être un nombre positif ou null',
      ],
      [
        'chrono_10km_estime_s',
        chrono.chrono_10km_estime_s == null || estEntierPositif(chrono.chrono_10km_estime_s),
        'doit être un entier positif ou null',
      ],
      [
        'niveau',
        chrono.niveau == null || NIVEAUX_COURSE.includes(chrono.niveau),
        `doit valoir : ${NIVEAUX_COURSE.join(', ')} ou null`,
      ],
    ]
    for (const [champ, ok, message] of verifs) if (!ok) erreurs.push(`[${i}] ${champ} : ${message}`)
  })
  return erreurs
}

// ---------- Réglages (mind_reglages) ----------

const PALIERS = ['barre_kg', 'barre_bas_kg', 'halteres_kg', 'machine_kg', 'poids_du_corps_lest_kg']

// Valeurs par défaut : M25 (barre 2,5 ; bas du corps 5 ; haltères 2 ; lest 2,5) et décision de Max
// pour la machine (2,5 kg, ajustable).
export function reglagesParDefaut() {
  return {
    paliers: {
      barre_kg: 2.5,
      barre_bas_kg: 5,
      halteres_kg: 2,
      machine_kg: 2.5,
      poids_du_corps_lest_kg: 2.5,
    },
    groupes_statut: {},
    exercices_jamais: [],
    exercices_preferes: [],
    renfo_coureur: null,
    plafond_volume_min: null,
    derniere_export: null,
  }
}

// Statut d'un groupe musculaire : « secondaire » s'il n'a pas été renseigné (décision de Max).
export function statutGroupe(reglages, muscle) {
  return reglages?.groupes_statut?.[muscle] ?? STATUT_GROUPE_DEFAUT
}

const listeDeTextes = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string')

function validerReglages(valeur) {
  if (!estObjet(valeur)) return ['doit être un objet']
  const erreurs = []
  const attendus = Object.keys(reglagesParDefaut())
  for (const champ of Object.keys(valeur)) {
    if (!attendus.includes(champ)) erreurs.push(`${champ} : champ inconnu`)
  }
  const { paliers, groupes_statut: groupes } = valeur
  if (!estObjet(paliers)) {
    erreurs.push('paliers : doit être un objet')
  } else {
    for (const palier of PALIERS) {
      if (!estNombrePositif(paliers[palier])) erreurs.push(`paliers.${palier} : doit être un nombre positif`)
    }
    for (const champ of Object.keys(paliers)) {
      if (!PALIERS.includes(champ)) erreurs.push(`paliers.${champ} : champ inconnu`)
    }
  }
  if (!estObjet(groupes)) {
    erreurs.push('groupes_statut : doit être un objet')
  } else {
    for (const [muscle, statut] of Object.entries(groupes)) {
      if (!STATUTS_GROUPE.includes(statut)) {
        erreurs.push(`groupes_statut.${muscle} : doit valoir : ${STATUTS_GROUPE.join(', ')}`)
      }
    }
  }
  if (!listeDeTextes(valeur.exercices_jamais)) erreurs.push('exercices_jamais : doit être une liste de textes')
  if (!listeDeTextes(valeur.exercices_preferes)) erreurs.push('exercices_preferes : doit être une liste de textes')
  if (valeur.renfo_coureur != null && typeof valeur.renfo_coureur !== 'boolean') {
    erreurs.push('renfo_coureur : doit être vrai, faux ou null')
  }
  if (valeur.derniere_export != null && !estDateValide(valeur.derniere_export)) {
    erreurs.push('derniere_export : doit être une date AAAA-MM-JJ valide ou null')
  }
  if (valeur.plafond_volume_min != null && !estEntierPositif(valeur.plafond_volume_min)) {
    erreurs.push('plafond_volume_min : doit être un entier positif ou null')
  }
  return erreurs
}

// ---------- Version, autres collections, point d'entrée ----------

function validerVersion(valeur) {
  if (!estObjet(valeur)) return ['doit être un objet']
  return Number.isInteger(valeur.schema_version) && valeur.schema_version >= 1
    ? []
    : ['schema_version : doit être un entier supérieur ou égal à 1']
}

// Collections dont le détail est défini aux missions suivantes (plan, séances, charges, bilans, pauses) :
// en V1, on vérifie seulement la forme générale.
const validerListe = (valeur) => (Array.isArray(valeur) ? [] : ['doit être une liste'])
const validerSauvegarde = (valeur) => (estObjet(valeur) ? [] : ['doit être un objet'])

const VALIDATEURS = {
  [CLES.version]: validerVersion,
  [CLES.profil]: validerProfil,
  [CLES.chronos]: validerChronos,
  [CLES.plan]: validerListe,
  [CLES.semaines]: validerListe,
  [CLES.seances]: validerListe,
  [CLES.charges]: validerListe,
  [CLES.bilans]: validerListe,
  [CLES.pauses]: validerListe,
  [CLES.reglages]: validerReglages,
  [CLES.sauvegardePrecedente]: validerSauvegarde,
}

// Renvoie la liste des erreurs (vide si la valeur est valide).
export function valider(cle, valeur) {
  const verificateur = VALIDATEURS[cle]
  if (!verificateur) return [`clé inconnue : ${cle}`]
  return verificateur(valeur)
}

// Valeur d'une collection qui n'a jamais été écrite.
export function valeurParDefaut(cle) {
  switch (cle) {
    case CLES.version:
      return { schema_version: VERSION_SCHEMA }
    case CLES.profil:
      return profilVide()
    case CLES.reglages:
      return reglagesParDefaut()
    case CLES.sauvegardePrecedente:
      return null
    default:
      return []
  }
}
