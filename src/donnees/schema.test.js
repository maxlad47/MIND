import { describe, expect, it } from 'vitest'
import { CLES, CLES_EXPORT } from './constantes.js'
import { profilVide, reglagesParDefaut, statutGroupe, valeurParDefaut, valider } from './schema.js'

describe('profil', () => {
  it('le prénom est obligatoire : le profil vide (valeur de lecture par défaut) n’est pas écrivable', () => {
    expect(valider(CLES.profil, profilVide()).join(' ')).toContain('prenom')
    expect(valider(CLES.profil, { ...profilVide(), prenom: '  ' })).not.toEqual([])
    expect(valider(CLES.profil, { ...profilVide(), prenom: 'Test' })).toEqual([])
  })

  it('accepte un profil renseigné', () => {
    const profil = {
      ...profilVide(),
      prenom: 'Test',
      objectif_course: 'semi',
      date_course: '2027-03-14',
      jours_dispo: ['mar', 'jeu', 'sam'],
      niveau_muscu: 'debutant',
      chrono_ref_id: 'chrono-1',
    }
    expect(valider(CLES.profil, profil)).toEqual([])
  })

  it('refuse une valeur hors liste', () => {
    const erreurs = valider(CLES.profil, { ...profilVide(), prenom: 'Test', niveau_muscu: 'dieu' })
    expect(erreurs.join(' ')).toContain('niveau_muscu')
  })

  it('refuse une date mal formée ou inexistante', () => {
    expect(valider(CLES.profil, { ...profilVide(), date_course: '14/03/2027' })).not.toEqual([])
    expect(valider(CLES.profil, { ...profilVide(), date_course: '2027-02-30' })).not.toEqual([])
  })

  it('refuse un jour en double, un jour inconnu et un champ inconnu', () => {
    expect(valider(CLES.profil, { ...profilVide(), jours_dispo: ['lun', 'lun'] })).not.toEqual([])
    expect(valider(CLES.profil, { ...profilVide(), jours_dispo: ['lundi'] })).not.toEqual([])
    expect(valider(CLES.profil, { ...profilVide(), couleur: 'bleu' })).not.toEqual([])
  })

  it('refuse un profil qui n’est pas un objet', () => {
    expect(valider(CLES.profil, [])).not.toEqual([])
    expect(valider(CLES.profil, 'x')).not.toEqual([])
  })
})

describe('réglages', () => {
  it('les valeurs par défaut sont valides', () => {
    expect(valider(CLES.reglages, reglagesParDefaut())).toEqual([])
  })

  it('palier machine par défaut : 2,5 kg (décision de Max) ; autres paliers selon M25', () => {
    const { paliers } = reglagesParDefaut()
    expect(paliers.machine_kg).toBe(2.5)
    expect(paliers.barre_kg).toBe(2.5)
    expect(paliers.barre_bas_kg).toBe(5)
    expect(paliers.halteres_kg).toBe(2)
  })

  it('un groupe non renseigné vaut « secondaire » ; « exclu » est un choix explicite', () => {
    const reglages = { ...reglagesParDefaut(), groupes_statut: { dos: 'exclu', pectoraux: 'prioritaire' } }
    expect(statutGroupe(reglages, 'epaules')).toBe('secondaire')
    expect(statutGroupe(reglages, 'dos')).toBe('exclu')
    expect(statutGroupe(reglages, 'pectoraux')).toBe('prioritaire')
    expect(statutGroupe(reglagesParDefaut(), 'jambes')).toBe('secondaire')
  })

  it('refuse un statut de groupe inconnu et un palier non positif', () => {
    const base = reglagesParDefaut()
    expect(valider(CLES.reglages, { ...base, groupes_statut: { dos: 'ignore' } })).not.toEqual([])
    expect(valider(CLES.reglages, { ...base, paliers: { ...base.paliers, machine_kg: 0 } })).not.toEqual([])
  })
})

describe('chronos', () => {
  const chrono = {
    id: 'chrono-1',
    date: '2026-11-01',
    source: 'declare',
    distance_m: 10000,
    temps_s: 3000,
    vma_kmh: null,
    chrono_10km_estime_s: 3000,
    niveau: 'intermediaire',
  }

  it('accepte un chrono 10 km déclaré', () => {
    expect(valider(CLES.chronos, [chrono])).toEqual([])
  })

  it('refuse un chrono incomplet ou mal formé', () => {
    expect(valider(CLES.chronos, [{ ...chrono, date: '01/11/2026' }])).not.toEqual([])
    expect(valider(CLES.chronos, [{ ...chrono, source: 'inconnue' }])).not.toEqual([])
    expect(valider(CLES.chronos, [{ ...chrono, temps_s: -5 }])).not.toEqual([])
    expect(valider(CLES.chronos, {})).not.toEqual([])
  })
})

describe('version et valeurs par défaut', () => {
  it('valide mind_version', () => {
    expect(valider(CLES.version, { schema_version: 1 })).toEqual([])
    expect(valider(CLES.version, { schema_version: 0 })).not.toEqual([])
    expect(valider(CLES.version, {})).not.toEqual([])
  })

  it('refuse une clé inconnue', () => {
    expect(valider('mind_inconnue', [])).not.toEqual([])
  })

  it('chaque clé a une valeur par défaut valide', () => {
    for (const cle of Object.values(CLES)) {
      if (cle === CLES.sauvegardePrecedente) continue // pas de copie tant qu'aucun import n'a eu lieu
      if (cle === CLES.profil) continue // le prénom est obligatoire : le profil vide n'est qu'une valeur de lecture
      expect(valider(cle, valeurParDefaut(cle)), cle).toEqual([])
    }
  })

  it('derniere_export : date valide ou null, champ facultatif', () => {
    const base = reglagesParDefaut()
    expect(valider(CLES.reglages, { ...base, derniere_export: '2026-11-17' })).toEqual([])
    expect(valider(CLES.reglages, { ...base, derniere_export: 'hier' })).not.toEqual([])
    const { derniere_export: _omis, ...sans } = base
    expect(valider(CLES.reglages, sans)).toEqual([])
  })

  it('l’export exclut la copie de sécurité', () => {
    expect(CLES_EXPORT).not.toContain(CLES.sauvegardePrecedente)
    expect(CLES_EXPORT).toContain(CLES.version)
    expect(CLES_EXPORT).toContain(CLES.profil)
  })

  it('toutes les clés sont préfixées mind_', () => {
    for (const cle of Object.values(CLES)) expect(cle.startsWith('mind_')).toBe(true)
  })
})
