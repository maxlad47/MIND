import { describe, expect, it } from 'vitest'
import { CLES, creerDepot, creerStockageMemoire, lireCollection, lireEtat, profilVide } from '../donnees/index.js'
import {
  chargerFormulaire,
  convertirFormulaire,
  enregistrerProfil,
  formaterDuree,
  formulaireVide,
  lireDuree,
} from './formulaire.js'

const OPTIONS = { aujourdhui: '2026-11-17', genererId: () => 'chrono-1' }

function nouveau() {
  const stockage = creerStockageMemoire()
  return { stockage, depot: creerDepot(stockage) }
}

function formulaireComplet() {
  return {
    ...formulaireVide(),
    prenom: 'Test',
    objectif_course: 'semi',
    objectif_muscu: 'force_esthetique',
    objectif_prioritaire: 'course',
    date_course: '2027-04-18',
    jours_dispo: ['lun', 'mer', 'sam'],
    temps_par_jour_min: '60',
    nb_seances_course: '3',
    nb_seances_muscu: '2',
    organisation_muscu: 'haut_bas',
    niveau_muscu: 'intermediaire',
    equipement: 'salle',
    chrono_10km: '52:30',
    volume_declare_4sem_min: ['120', '130', '140', '150'],
    course_reguliere_depuis: '2026-01-05',
  }
}

describe('durées', () => {
  it('lit mm:ss et h:mm:ss', () => {
    expect(lireDuree('52:30')).toEqual({ secondes: 3150 })
    expect(lireDuree('1:02:03')).toEqual({ secondes: 3723 })
    expect(lireDuree('  ')).toEqual({ vide: true })
  })
  it('refuse les formats invalides', () => {
    for (const mauvais of ['52', 'abc', '52:75', '1:75:00', '00:00', '5:3:2:1', '-5:00']) {
      expect(lireDuree(mauvais).erreur, mauvais).toBeTruthy()
    }
  })
  it('formate sans perte', () => {
    expect(formaterDuree(3150)).toBe('52:30')
    expect(formaterDuree(3723)).toBe('1:02:03')
    expect(lireDuree(formaterDuree(3150)).secondes).toBe(3150)
  })
})

describe('formulaire vide', () => {
  it('valeurs par défaut : non renseigné, question des muscles sur « non », groupes « secondaire »', () => {
    const form = formulaireVide()
    expect(form.groupes_actif).toBe(false)
    expect(form.objectif_course).toBe('')
    expect(Object.values(form.groupes_statut).every((s) => s === 'secondaire')).toBe(true)
  })
  it('le prénom est obligatoire : rien n’est écrit sans prénom', () => {
    const { stockage, depot } = nouveau()
    for (const prenom of ['', '   ']) {
      const resultat = enregistrerProfil(depot, { ...formulaireVide(), prenom }, OPTIONS)
      expect(resultat.ok).toBe(false)
      expect(resultat.erreurs.prenom).toBeTruthy()
    }
    expect(stockage.getItem(CLES.profil)).toBeNull()
  })
  it('avec le seul prénom : le reste vaut « non renseigné », sans chrono, sans groupe stocké', () => {
    const { depot } = nouveau()
    expect(enregistrerProfil(depot, { ...formulaireVide(), prenom: ' Test ' }, OPTIONS)).toEqual({ ok: true })
    expect(lireCollection(depot, CLES.profil)).toMatchObject({ ...profilVide(), prenom: 'Test', premier_lancement_termine: null, mention_sante_vue: null })
    expect(lireCollection(depot, CLES.chronos)).toEqual([])
    expect(lireCollection(depot, CLES.reglages).groupes_statut).toEqual({})
  })
})

describe('enregistrement et persistance', () => {
  it('le profil enregistré est retrouvé après « rechargement » (nouveau dépôt, même stockage)', () => {
    const { stockage, depot } = nouveau()
    const form = formulaireComplet()
    form.groupes_actif = true
    form.groupes_statut.dos = 'prioritaire'
    form.groupes_statut.mollets = 'exclu'
    expect(enregistrerProfil(depot, form, OPTIONS)).toEqual({ ok: true })

    const apres = chargerFormulaire(creerDepot(stockage))
    expect(apres).toEqual(form)
  })

  it('chrono : enregistré en « declare » dans mind_chronos, niveau null, référencé par le profil', () => {
    const { depot } = nouveau()
    enregistrerProfil(depot, formulaireComplet(), OPTIONS)
    expect(lireCollection(depot, CLES.chronos)).toEqual([
      {
        id: 'chrono-1',
        date: '2026-11-17',
        source: 'declare',
        distance_m: 10000,
        temps_s: 3150,
        vma_kmh: null,
        chrono_10km_estime_s: 3150,
        niveau: null,
      },
    ])
    expect(lireCollection(depot, CLES.profil).chrono_ref_id).toBe('chrono-1')
  })

  it('sans chrono : aucun chrono créé, chrono_ref_id null (N7)', () => {
    const { depot } = nouveau()
    enregistrerProfil(depot, { ...formulaireComplet(), chrono_10km: '' }, OPTIONS)
    expect(lireCollection(depot, CLES.chronos)).toEqual([])
    expect(lireCollection(depot, CLES.profil).chrono_ref_id).toBeNull()
  })

  it('même chrono réenregistré : pas de doublon ; chrono modifié : ajout (jamais de modification)', () => {
    const { depot } = nouveau()
    let n = 0
    const options = { aujourdhui: '2026-11-17', genererId: () => `c${(n += 1)}` }
    enregistrerProfil(depot, formulaireComplet(), options)
    enregistrerProfil(depot, formulaireComplet(), options)
    expect(lireCollection(depot, CLES.chronos)).toHaveLength(1)
    enregistrerProfil(depot, { ...formulaireComplet(), chrono_10km: '50:00' }, options)
    const chronos = lireCollection(depot, CLES.chronos)
    expect(chronos.map((c) => c.temps_s)).toEqual([3150, 3000])
    expect(lireCollection(depot, CLES.profil).chrono_ref_id).toBe('c2')
  })

  it('chrono vidé : la référence est retirée, l’historique reste', () => {
    const { depot } = nouveau()
    enregistrerProfil(depot, formulaireComplet(), OPTIONS)
    enregistrerProfil(depot, { ...formulaireComplet(), chrono_10km: '' }, OPTIONS)
    expect(lireCollection(depot, CLES.profil).chrono_ref_id).toBeNull()
    expect(lireCollection(depot, CLES.chronos)).toHaveLength(1)
  })

  it('groupes : seuls les statuts hors « secondaire » sont stockés ; retour à « secondaire » les retire', () => {
    const { depot } = nouveau()
    const form = { ...formulaireVide(), prenom: 'Test', groupes_actif: true }
    form.groupes_statut.dos = 'prioritaire'
    enregistrerProfil(depot, form, OPTIONS)
    expect(lireCollection(depot, CLES.reglages).groupes_statut).toEqual({ dos: 'prioritaire' })
    form.groupes_statut.dos = 'secondaire'
    enregistrerProfil(depot, form, OPTIONS)
    expect(lireCollection(depot, CLES.reglages).groupes_statut).toEqual({})
  })

  it('réponse « non » à la question des muscles : aucun statut stocké, même si des statuts étaient choisis', () => {
    const { depot } = nouveau()
    const form = { ...formulaireComplet(), groupes_actif: true }
    form.groupes_statut.dos = 'prioritaire'
    enregistrerProfil(depot, form, OPTIONS)
    expect(lireCollection(depot, CLES.reglages).groupes_statut).toEqual({ dos: 'prioritaire' })
    enregistrerProfil(depot, { ...form, groupes_actif: false }, OPTIONS)
    expect(lireCollection(depot, CLES.reglages).groupes_statut).toEqual({})
    expect(chargerFormulaire(depot).groupes_actif).toBe(false)
  })

  it('conserve les paliers de réglages et les champs profil non saisis en V1', () => {
    const { depot } = nouveau()
    depot.ecrire(CLES.profil, { ...profilVide(), premier_lancement_termine: true })
    enregistrerProfil(depot, formulaireComplet(), OPTIONS)
    expect(lireCollection(depot, CLES.profil).premier_lancement_termine).toBe(true)
    expect(lireCollection(depot, CLES.reglages).paliers.machine_kg).toBe(2.5)
  })

  it('objectif sans course : sous-objectif gardé, date de course ignorée', () => {
    const conv = convertirFormulaire({
      ...formulaireComplet(),
      objectif_course: 'pas_de_course',
      pas_de_course_type: 'courir_plus',
    })
    expect(conv.profil.pas_de_course_type).toBe('courir_plus')
    expect(conv.profil.date_course).toBeNull()
    const avecCourse = convertirFormulaire({ ...formulaireComplet(), pas_de_course_type: 'courir_plus' })
    expect(avecCourse.profil.pas_de_course_type).toBeNull()
  })

  it('les données enregistrées ne contiennent pas la copie de sécurité dans l’état exporté', () => {
    const { depot } = nouveau()
    enregistrerProfil(depot, formulaireComplet(), OPTIONS)
    expect(Object.keys(lireEtat(depot))).not.toContain(CLES.sauvegardePrecedente)
  })
})

describe('validation : rien n’est écrit si le formulaire est invalide', () => {
  const cas = [
    ['prénom vide', { prenom: '' }, 'prenom'],
    ['date de course invalide', { date_course: '2027-02-31' }, 'date_course'],
    ['temps par jour = 0', { temps_par_jour_min: '0' }, 'temps_par_jour_min'],
    ['séances négatives ou texte', { nb_seances_muscu: 'deux' }, 'nb_seances_muscu'],
    ['chrono mal formé', { chrono_10km: '52' }, 'chrono_10km'],
    ['volume incomplet', { volume_declare_4sem_min: ['100', '', '', ''] }, 'volume_declare_4sem_min'],
    ['volume non numérique', { volume_declare_4sem_min: ['a', '1', '2', '3'] }, 'volume_declare_4sem_min'],
    ['régularité invalide', { course_reguliere_depuis: 'hier' }, 'course_reguliere_depuis'],
  ]
  for (const [nom, modif, champ] of cas) {
    it(nom, () => {
      const { stockage, depot } = nouveau()
      const resultat = enregistrerProfil(depot, { ...formulaireComplet(), ...modif }, OPTIONS)
      expect(resultat.ok).toBe(false)
      expect(resultat.erreurs[champ]).toBeTruthy()
      expect(stockage.getItem(CLES.profil)).toBeNull()
      expect(stockage.getItem(CLES.chronos)).toBeNull()
      expect(stockage.getItem(CLES.reglages)).toBeNull()
    })
  }
})
