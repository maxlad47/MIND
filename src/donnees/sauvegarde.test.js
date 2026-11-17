import { describe, expect, it } from 'vitest'
import {
  CLES,
  ErreurImport,
  ErreurValidation,
  ErreurVersion,
  creerDepot,
  creerStockageMemoire,
  lireCollection,
  lireEtat,
  profilVide,
  reglagesParDefaut,
} from './index.js'
import { DELAI_RAPPEL_JOURS, exporterDonnees, importerDonnees, rappelExportNecessaire } from './sauvegarde.js'

function nouveau() {
  const stockage = creerStockageMemoire()
  return { stockage, depot: creerDepot(stockage) }
}

function depotRempli(prenom = 'Source') {
  const { stockage, depot } = nouveau()
  depot.ecrire(CLES.version, { schema_version: 1 })
  depot.ecrire(CLES.profil, { ...profilVide(), prenom, jours_dispo: ['lun'] })
  depot.ecrire(CLES.chronos, [
    { id: 'c1', date: '2026-11-01', source: 'declare', distance_m: 10000, temps_s: 3000, vma_kmh: null, chrono_10km_estime_s: 3000, niveau: null },
  ])
  depot.ecrire(CLES.reglages, { ...reglagesParDefaut(), groupes_statut: { dos: 'exclu' } })
  return { stockage, depot }
}

const fichier = (donnees, extra = {}) =>
  JSON.stringify({ application: 'MIND', date_export: '2026-11-17', donnees, ...extra })

describe('export', () => {
  it('contient version et collections présentes, sans la copie de sécurité, avec la date', () => {
    const { depot } = depotRempli()
    depot.ecrire(CLES.sauvegardePrecedente, { ancienne: true })
    const { contenu, nomFichier } = exporterDonnees(depot, '2026-11-17')
    const f = JSON.parse(contenu)
    expect(nomFichier).toBe('mind-sauvegarde-2026-11-17.json')
    expect(f).toMatchObject({ application: 'MIND', date_export: '2026-11-17' })
    expect(Object.keys(f.donnees).sort()).toEqual([CLES.chronos, CLES.profil, CLES.reglages, CLES.version].sort())
    expect(f.donnees[CLES.profil].prenom).toBe('Source')
  })

  it('enregistre la date d’export, y compris dans le fichier exporté', () => {
    const { depot } = depotRempli()
    const { contenu } = exporterDonnees(depot, '2026-11-17')
    expect(lireCollection(depot, CLES.reglages).derniere_export).toBe('2026-11-17')
    expect(JSON.parse(contenu).donnees[CLES.reglages].derniere_export).toBe('2026-11-17')
  })
})

describe('import', () => {
  it('restaure à l’identique sur un autre appareil (export puis import)', () => {
    const { depot: source } = depotRempli()
    const { contenu } = exporterDonnees(source, '2026-11-17')
    const { depot: cible } = nouveau()
    const resultat = importerDonnees(cible, contenu, { aujourdhui: '2026-11-18' })
    expect(resultat).toEqual({ date_export: '2026-11-17', migre: false })
    expect(lireEtat(cible)).toEqual(lireEtat(source))
  })

  it('remplace tout : les collections absentes du fichier sont supprimées', () => {
    const { depot: cible } = depotRempli('Ancien')
    cible.ecrire(CLES.seances, [{ id: 's1' }])
    const { depot: source } = depotRempli('Nouveau')
    importerDonnees(cible, exporterDonnees(source, '2026-11-17').contenu)
    expect(cible.lire(CLES.profil).prenom).toBe('Nouveau')
    expect(cible.lire(CLES.seances)).toBeUndefined()
  })

  it('crée la copie de sécurité des données d’avant, une seule', () => {
    const { depot: cible } = depotRempli('Ancien')
    const { depot: source } = depotRempli('Nouveau')
    const { contenu } = exporterDonnees(source, '2026-11-17')
    importerDonnees(cible, contenu, { aujourdhui: '2026-11-18' })
    importerDonnees(cible, contenu, { aujourdhui: '2026-11-19' })
    const copie = cible.lire(CLES.sauvegardePrecedente)
    expect(copie).toMatchObject({ date: '2026-11-19', cause: 'import' })
    expect(copie.donnees[CLES.profil].prenom).toBe('Nouveau')
    const premiere = depotRempli('Ancien').depot
    importerDonnees(premiere, contenu, { aujourdhui: '2026-11-18' })
    expect(premiere.lire(CLES.sauvegardePrecedente).donnees[CLES.profil].prenom).toBe('Ancien')
  })

  it('la copie de sécurité d’une cible n’est pas exportée ni importée', () => {
    const { depot } = depotRempli()
    depot.ecrire(CLES.sauvegardePrecedente, { x: 1 })
    expect(JSON.parse(exporterDonnees(depot).contenu).donnees[CLES.sauvegardePrecedente]).toBeUndefined()
    const piege = fichier({ [CLES.version]: { schema_version: 1 }, [CLES.sauvegardePrecedente]: { x: 1 } })
    expect(() => importerDonnees(depot, piege)).toThrow(ErreurImport)
  })

  const refus = [
    ['fichier illisible', 'pas du json', ErreurImport],
    ['autre format JSON', JSON.stringify({ hello: 1 }), ErreurImport],
    ['date d’export absente', JSON.stringify({ application: 'MIND', donnees: { [CLES.version]: { schema_version: 1 } } }), ErreurImport],
    ['version absente', fichier({ [CLES.profil]: { ...profilVide(), prenom: 'X' } }), ErreurImport],
    ['clé inconnue', fichier({ [CLES.version]: { schema_version: 1 }, mind_autre: [] }), ErreurImport],
    ['version plus récente que l’appli', fichier({ [CLES.version]: { schema_version: 9 } }), ErreurVersion],
    ['profil invalide', fichier({ [CLES.version]: { schema_version: 1 }, [CLES.profil]: { ...profilVide(), prenom: 'X', niveau_muscu: 'dieu' } }), ErreurValidation],
    ['profil sans prénom', fichier({ [CLES.version]: { schema_version: 1 }, [CLES.profil]: profilVide() }), ErreurValidation],
  ]
  for (const [nom, contenu, classe] of refus) {
    it(`refuse : ${nom} (données actuelles intactes, pas de copie)`, () => {
      const { depot } = depotRempli('Intact')
      const etatAvant = lireEtat(depot)
      expect(() => importerDonnees(depot, contenu)).toThrow(classe)
      expect(lireEtat(depot)).toEqual(etatAvant)
      expect(depot.lire(CLES.sauvegardePrecedente)).toBeUndefined()
    })
  }

  it('fichier d’une version plus ancienne : migré puis importé', () => {
    const { depot } = nouveau()
    const migrations = [
      { vers: 2, appliquer: (etat) => ({ ...etat, [CLES.profil]: { ...etat[CLES.profil], prenom: 'Migre' } }) },
    ]
    const contenu = fichier({ [CLES.version]: { schema_version: 1 }, [CLES.profil]: { ...profilVide(), prenom: 'Vieux' } })
    expect(importerDonnees(depot, contenu, { migrations, versionCible: 2 }).migre).toBe(true)
    expect(depot.lire(CLES.profil).prenom).toBe('Migre')
    expect(depot.lire(CLES.version)).toEqual({ schema_version: 2 })
  })

  it('migration impossible : refus, données intactes', () => {
    const { depot } = depotRempli('Intact')
    const contenu = fichier({ [CLES.version]: { schema_version: 1 } })
    const etatAvant = lireEtat(depot)
    expect(() => importerDonnees(depot, contenu, { migrations: [], versionCible: 2 })).toThrow(ErreurImport)
    expect(lireEtat(depot)).toEqual(etatAvant)
  })

  it('écriture qui échoue en cours de route : état d’avant rétabli', () => {
    const { depot: source } = depotRempli('Nouveau')
    const { contenu } = exporterDonnees(source, '2026-11-17')
    const { stockage, depot } = depotRempli('Ancien')
    const etatAvant = lireEtat(depot)
    const setItem = stockage.setItem
    let ecritures = 0
    stockage.setItem = (cle, valeur) => {
      // La 1re écriture (copie de sécurité) passe ; la 3e (remplacement) échoue ; le rétablissement passe.
      ecritures += 1
      if (ecritures === 3) throw new Error('quota')
      setItem(cle, valeur)
    }
    expect(() => importerDonnees(depot, contenu)).toThrow(/rétablies/)
    expect(lireEtat(depot)).toEqual(etatAvant)
  })
})

describe('rappel d’export', () => {
  it('pas de rappel tant qu’aucun profil n’est enregistré', () => {
    expect(rappelExportNecessaire(nouveau().depot, '2026-11-17')).toBe(false)
  })
  it('profil enregistré, jamais exporté : rappel', () => {
    expect(rappelExportNecessaire(depotRempli().depot, '2026-11-17')).toBe(true)
  })
  it(`rappel à partir de ${DELAI_RAPPEL_JOURS} jours après le dernier export`, () => {
    const { depot } = depotRempli()
    exporterDonnees(depot, '2026-11-01')
    expect(rappelExportNecessaire(depot, '2026-11-30')).toBe(false) // 29 jours
    expect(rappelExportNecessaire(depot, '2026-12-01')).toBe(true) // 30 jours
  })
  it('un export remet le compteur à zéro', () => {
    const { depot } = depotRempli()
    exporterDonnees(depot, '2026-01-01')
    expect(rappelExportNecessaire(depot, '2026-11-17')).toBe(true)
    exporterDonnees(depot, '2026-11-17')
    expect(rappelExportNecessaire(depot, '2026-11-17')).toBe(false)
  })
})
