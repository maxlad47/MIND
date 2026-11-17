// Logique du formulaire de profil (V1-M3), sans affichage : conversion formulaire <-> données,
// validation et enregistrement. L'écran (src/ecrans/Profil.jsx) ne fait qu'afficher.
//
// État du formulaire : uniquement des textes (comme les champs HTML). « Non renseigné » = ''.

import {
  CLES,
  STATUT_GROUPE_DEFAUT,
  dateDuJour,
  ecrireCollection,
  estDateValide,
  lireCollection,
  profilVide,
  valider,
} from '../donnees/index.js'
import { GROUPES_MUSCULAIRES } from './groupes.js'

const OBJECTIFS_AVEC_COURSE = ['10km', 'semi', 'marathon']
const DISTANCE_CHRONO_M = 10000

export const estCourseVisee = (objectifCourse) => OBJECTIFS_AVEC_COURSE.includes(objectifCourse)

// ---------- Durées « mm:ss » ou « h:mm:ss » ----------

// Renvoie { vide: true }, { secondes } ou { erreur }.
export function lireDuree(texte) {
  const brut = String(texte ?? '').trim()
  if (brut === '') return { vide: true }
  const parties = brut.split(':')
  if (parties.length < 2 || parties.length > 3 || !parties.every((p) => /^\d+$/.test(p))) {
    return { erreur: 'Format attendu : mm:ss ou h:mm:ss (ex. 52:30)' }
  }
  const nombres = parties.map(Number)
  const [h, m, s] = nombres.length === 3 ? nombres : [0, ...nombres]
  if (s > 59 || (nombres.length === 3 && m > 59)) return { erreur: 'Minutes et secondes : 0 à 59' }
  const secondes = h * 3600 + m * 60 + s
  return secondes > 0 ? { secondes } : { erreur: 'Le temps doit être supérieur à 0' }
}

export function formaterDuree(secondes) {
  if (!Number.isInteger(secondes) || secondes <= 0) return ''
  const h = Math.floor(secondes / 3600)
  const m = Math.floor((secondes % 3600) / 60)
  const s = secondes % 60
  const deux = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${deux(m)}:${deux(s)}` : `${deux(m)}:${deux(s)}`
}

// ---------- Données -> formulaire ----------

const texte = (valeur) => (valeur === null || valeur === undefined ? '' : String(valeur))

export function formulaireVide() {
  return {
    prenom: '',
    objectif_course: '',
    pas_de_course_type: '',
    objectif_muscu: '',
    objectif_prioritaire: '',
    date_course: '',
    jours_dispo: [],
    temps_par_jour_min: '',
    nb_seances_course: '',
    nb_seances_muscu: '',
    organisation_muscu: '',
    niveau_muscu: '',
    equipement: '',
    chrono_10km: '',
    volume_declare_4sem_min: ['', '', '', ''],
    course_reguliere_depuis: '',
    // « Des muscles en priorité ou des exclusions ? » : oui / non. Non = tous « secondaire ».
    groupes_actif: false,
    groupes_statut: Object.fromEntries(GROUPES_MUSCULAIRES.map((g) => [g.cle, STATUT_GROUPE_DEFAUT])),
  }
}

export function chronoDeReference(profil, chronos) {
  if (!profil.chrono_ref_id) return null
  return chronos.find((c) => c.id === profil.chrono_ref_id) ?? null
}

export function chargerFormulaire(depot) {
  const profil = lireCollection(depot, CLES.profil)
  const chronos = lireCollection(depot, CLES.chronos)
  const reglages = lireCollection(depot, CLES.reglages)
  const form = formulaireVide()
  for (const champ of [
    'prenom',
    'objectif_course',
    'pas_de_course_type',
    'objectif_muscu',
    'objectif_prioritaire',
    'date_course',
    'temps_par_jour_min',
    'nb_seances_course',
    'nb_seances_muscu',
    'organisation_muscu',
    'niveau_muscu',
    'equipement',
    'course_reguliere_depuis',
  ]) {
    form[champ] = texte(profil[champ])
  }
  form.jours_dispo = [...(profil.jours_dispo ?? [])]
  if (Array.isArray(profil.volume_declare_4sem_min)) {
    form.volume_declare_4sem_min = profil.volume_declare_4sem_min.map(texte)
  }
  const chrono = chronoDeReference(profil, chronos)
  form.chrono_10km = chrono ? formaterDuree(chrono.temps_s) : ''
  for (const g of GROUPES_MUSCULAIRES) {
    form.groupes_statut[g.cle] = reglages.groupes_statut?.[g.cle] ?? STATUT_GROUPE_DEFAUT
  }
  form.groupes_actif = Object.values(form.groupes_statut).some((s) => s !== STATUT_GROUPE_DEFAUT)
  return form
}

// ---------- Formulaire -> données ----------

function entier(valeur, { min = 0 } = {}) {
  const brut = String(valeur ?? '').trim()
  if (brut === '') return { vide: true }
  if (!/^\d+$/.test(brut) || Number(brut) < min) {
    return { erreur: min > 0 ? 'Entier positif attendu' : 'Entier attendu (0 ou plus)' }
  }
  return { valeur: Number(brut) }
}

function dateFacultative(valeur) {
  const brut = String(valeur ?? '').trim()
  if (brut === '') return { vide: true }
  return estDateValide(brut) ? { valeur: brut } : { erreur: 'Date invalide' }
}

// Convertit le formulaire. Renvoie { erreurs } (objet champ -> message) ou { profil, chronoSaisi, groupes }.
export function convertirFormulaire(form) {
  const erreurs = {}
  const profil = profilVide()

  // Le prénom est obligatoire (décision de Max, 17/11/2026).
  if (form.prenom.trim() === '') erreurs.prenom = 'Le prénom est obligatoire'
  else profil.prenom = form.prenom.trim()
  for (const champ of ['objectif_course', 'objectif_muscu', 'objectif_prioritaire', 'organisation_muscu', 'niveau_muscu', 'equipement']) {
    profil[champ] = form[champ] === '' ? null : form[champ]
  }
  // Sous-objectif : seulement sans course visée (C8). Date de course : seulement avec une course visée.
  profil.pas_de_course_type =
    form.objectif_course === 'pas_de_course' && form.pas_de_course_type !== '' ? form.pas_de_course_type : null

  if (estCourseVisee(form.objectif_course)) {
    const d = dateFacultative(form.date_course)
    if (d.erreur) erreurs.date_course = d.erreur
    else profil.date_course = d.valeur ?? null
  }
  const reguliere = dateFacultative(form.course_reguliere_depuis)
  if (reguliere.erreur) erreurs.course_reguliere_depuis = reguliere.erreur
  else profil.course_reguliere_depuis = reguliere.valeur ?? null

  profil.jours_dispo = [...form.jours_dispo]

  for (const [champ, min] of [
    ['temps_par_jour_min', 1],
    ['nb_seances_course', 0],
    ['nb_seances_muscu', 0],
  ]) {
    const n = entier(form[champ], { min })
    if (n.erreur) erreurs[champ] = n.erreur
    else profil[champ] = n.vide ? null : n.valeur
  }

  // Volume des 4 dernières semaines : les 4 valeurs ou aucune.
  const volumes = form.volume_declare_4sem_min.map((v) => entier(v))
  const remplis = volumes.filter((v) => !v.vide)
  if (volumes.some((v) => v.erreur)) {
    erreurs.volume_declare_4sem_min = 'Entiers attendus (minutes par semaine)'
  } else if (remplis.length > 0 && remplis.length < 4) {
    erreurs.volume_declare_4sem_min = 'Renseigne les 4 semaines, ou aucune'
  } else if (remplis.length === 4) {
    profil.volume_declare_4sem_min = volumes.map((v) => v.valeur)
  }

  const chrono = lireDuree(form.chrono_10km)
  if (chrono.erreur) erreurs.chrono_10km = chrono.erreur

  // Seuls les statuts choisis hors défaut sont stockés (absent = « secondaire »).
  const groupes = {}
  // Réponse « non » à la question : on ignore les statuts affichés, tous les groupes restent « secondaire ».
  for (const g of GROUPES_MUSCULAIRES) {
    const statut = form.groupes_actif ? (form.groupes_statut[g.cle] ?? STATUT_GROUPE_DEFAUT) : STATUT_GROUPE_DEFAUT
    if (statut !== STATUT_GROUPE_DEFAUT) groupes[g.cle] = statut
  }

  if (Object.keys(erreurs).length > 0) return { erreurs }
  return { profil, chronoSaisi: chrono.vide ? null : chrono.secondes, groupes }
}

// ---------- Enregistrement ----------

let compteur = 0
const genererIdParDefaut = () =>
  globalThis.crypto?.randomUUID?.() ?? `chrono_${Date.now()}_${(compteur += 1)}`

// Valide tout, puis écrit. Si quelque chose est invalide, rien n'est écrit.
// Renvoie { ok: true } ou { ok: false, erreurs }.
export function enregistrerProfil(depot, form, { aujourdhui = dateDuJour(), genererId = genererIdParDefaut } = {}) {
  const conversion = convertirFormulaire(form)
  if (conversion.erreurs) return { ok: false, erreurs: conversion.erreurs }

  const { profil, chronoSaisi, groupes } = conversion
  const existant = lireCollection(depot, CLES.profil)
  const chronos = lireCollection(depot, CLES.chronos)
  const reglages = lireCollection(depot, CLES.reglages)

  // Les champs non saisis en V1 (premier lancement, mention santé) sont conservés.
  const profilFinal = {
    ...existant,
    ...profil,
    premier_lancement_termine: existant.premier_lancement_termine ?? null,
    mention_sante_vue: existant.mention_sante_vue ?? null,
    chrono_ref_id: existant.chrono_ref_id ?? null,
  }

  // Chrono : mind_chronos est en ajout seulement. Un chrono différent du chrono de référence est ajouté ;
  // un champ vidé retire seulement la référence (l'historique reste). Niveau : null en V1.
  let chronosFinal = chronos
  if (chronoSaisi === null) {
    profilFinal.chrono_ref_id = null
  } else {
    const courant = chronoDeReference(existant, chronos)
    if (!courant || courant.temps_s !== chronoSaisi) {
      const chrono = {
        id: genererId(),
        date: aujourdhui,
        source: 'declare',
        distance_m: DISTANCE_CHRONO_M,
        temps_s: chronoSaisi,
        vma_kmh: null,
        chrono_10km_estime_s: chronoSaisi,
        niveau: null,
      }
      chronosFinal = [...chronos, chrono]
      profilFinal.chrono_ref_id = chrono.id
    }
  }

  // Les groupes hors de la liste provisoire (ajoutés plus tard) sont conservés tels quels.
  const connus = GROUPES_MUSCULAIRES.map((g) => g.cle)
  const autres = Object.fromEntries(
    Object.entries(reglages.groupes_statut ?? {}).filter(([cle]) => !connus.includes(cle)),
  )
  const reglagesFinal = { ...reglages, groupes_statut: { ...autres, ...groupes } }

  const ecritures = [
    [CLES.profil, profilFinal],
    [CLES.chronos, chronosFinal],
    [CLES.reglages, reglagesFinal],
  ]
  const erreurs = {}
  for (const [cle, valeur] of ecritures) {
    const details = valider(cle, valeur)
    if (details.length > 0) erreurs[cle] = details.join(' ; ')
  }
  if (Object.keys(erreurs).length > 0) return { ok: false, erreurs }

  for (const [cle, valeur] of ecritures) ecrireCollection(depot, cle, valeur)
  return { ok: true }
}
