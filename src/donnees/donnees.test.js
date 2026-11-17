import { describe, expect, it } from 'vitest'
import {
  CLES,
  ErreurValidation,
  ErreurVersion,
  creerDepot,
  creerCopieSecurite,
  creerStockageMemoire,
  ecrireCollection,
  initialiserDonnees,
  lireCollection,
  lireEtat,
  profilVide,
  reglagesParDefaut,
} from './index.js'
import { migrer } from './migrations/index.js'

function nouveauDepot() {
  const stockage = creerStockageMemoire()
  return { stockage, depot: creerDepot(stockage) }
}

describe('lecture et écriture de collections', () => {
  it('renvoie la valeur par défaut tant que rien n’est écrit', () => {
    const { depot } = nouveauDepot()
    expect(lireCollection(depot, CLES.profil)).toEqual(profilVide())
    expect(lireCollection(depot, CLES.seances)).toEqual([])
    expect(lireCollection(depot, CLES.reglages)).toEqual(reglagesParDefaut())
  })

  it('le profil écrit est relu à l’identique (persistance)', () => {
    const { stockage, depot } = nouveauDepot()
    const profil = { ...profilVide(), prenom: 'Test', date_course: '2027-04-18', jours_dispo: ['lun', 'jeu'] }
    ecrireCollection(depot, CLES.profil, profil)
    // Nouveau dépôt sur le même stockage : simule la fermeture puis la réouverture de l'appli.
    expect(lireCollection(creerDepot(stockage), CLES.profil)).toEqual(profil)
  })

  it('refuse une écriture invalide sans rien écrire', () => {
    const { stockage, depot } = nouveauDepot()
    ecrireCollection(depot, CLES.profil, { ...profilVide(), prenom: 'Test', niveau_muscu: 'debutant' })
    const avant = stockage.getItem(CLES.profil)
    expect(() => ecrireCollection(depot, CLES.profil, { ...profilVide(), prenom: 'Test', niveau_muscu: 'dieu' })).toThrow(
      ErreurValidation,
    )
    expect(stockage.getItem(CLES.profil)).toBe(avant)
  })
})

describe('initialiserDonnees', () => {
  it('première ouverture : écrit mind_version', () => {
    const { depot } = nouveauDepot()
    expect(initialiserDonnees(depot)).toEqual({ version: 1, cree: true, migre: false })
    expect(depot.lire(CLES.version)).toEqual({ schema_version: 1 })
  })

  it('même version : ne fait rien', () => {
    const { depot } = nouveauDepot()
    initialiserDonnees(depot)
    expect(initialiserDonnees(depot)).toEqual({ version: 1, cree: false, migre: false })
  })

  it('version plus récente que l’appli : refuse et n’écrit rien', () => {
    const { stockage, depot } = nouveauDepot()
    stockage.setItem(CLES.version, JSON.stringify({ schema_version: 9 }))
    stockage.setItem(CLES.profil, JSON.stringify({ prenom: 'intact' }))
    expect(() => initialiserDonnees(depot)).toThrow(ErreurVersion)
    expect(stockage.getItem(CLES.profil)).toBe(JSON.stringify({ prenom: 'intact' }))
    expect(JSON.parse(stockage.getItem(CLES.version)).schema_version).toBe(9)
  })

  it('version plus ancienne : applique les migrations dans l’ordre puis met à jour la version', () => {
    const { depot } = nouveauDepot()
    depot.ecrire(CLES.version, { schema_version: 1 })
    depot.ecrire(CLES.profil, { ...profilVide(), prenom: 'Avant' })
    const migrations = [
      { vers: 2, appliquer: (etat) => ({ ...etat, [CLES.profil]: { ...etat[CLES.profil], prenom: 'V2' } }) },
      { vers: 3, appliquer: (etat) => ({ ...etat, [CLES.profil]: { ...etat[CLES.profil], prenom: `${etat[CLES.profil].prenom}+V3` } }) },
    ]
    expect(initialiserDonnees(depot, { migrations, versionCible: 3 })).toEqual({
      version: 3,
      cree: false,
      migre: true,
    })
    expect(depot.lire(CLES.version)).toEqual({ schema_version: 3 })
    expect(depot.lire(CLES.profil).prenom).toBe('V2+V3')
  })

  it('migration réussie : copie de sécurité des données d’avant, hors export', () => {
    const { depot } = nouveauDepot()
    depot.ecrire(CLES.version, { schema_version: 1 })
    depot.ecrire(CLES.profil, { ...profilVide(), prenom: 'Avant' })
    const migrations = [
      { vers: 2, appliquer: (etat) => ({ ...etat, [CLES.profil]: { ...etat[CLES.profil], prenom: 'Apres' } }) },
    ]
    initialiserDonnees(depot, { migrations, versionCible: 2, aujourdhui: '2026-11-17' })
    const copie = depot.lire(CLES.sauvegardePrecedente)
    expect(copie).toMatchObject({ date: '2026-11-17', cause: 'migration', schema_version: 1 })
    expect(copie.donnees[CLES.profil].prenom).toBe('Avant')
    expect(depot.lire(CLES.profil).prenom).toBe('Apres')
    expect(Object.keys(lireEtat(depot))).not.toContain(CLES.sauvegardePrecedente)
  })

  it('migration en échec : aucune copie de sécurité créée', () => {
    const { depot } = nouveauDepot()
    depot.ecrire(CLES.version, { schema_version: 1 })
    expect(() => initialiserDonnees(depot, { migrations: [], versionCible: 2 })).toThrow()
    expect(depot.lire(CLES.sauvegardePrecedente)).toBeUndefined()
  })

  it('creerCopieSecurite remplace la copie précédente (une seule)', () => {
    const { depot } = nouveauDepot()
    depot.ecrire(CLES.version, { schema_version: 1 })
    depot.ecrire(CLES.profil, { ...profilVide(), prenom: 'A' })
    creerCopieSecurite(depot, 'import', '2026-11-17')
    depot.ecrire(CLES.profil, { ...profilVide(), prenom: 'B' })
    creerCopieSecurite(depot, 'import', '2026-11-18')
    const copie = depot.lire(CLES.sauvegardePrecedente)
    expect(copie.date).toBe('2026-11-18')
    expect(copie.donnees[CLES.profil].prenom).toBe('B')
    expect(copie.donnees[CLES.sauvegardePrecedente]).toBeUndefined()
  })

  it('migration manquante : erreur, données actuelles intactes', () => {
    const { stockage, depot } = nouveauDepot()
    depot.ecrire(CLES.version, { schema_version: 1 })
    depot.ecrire(CLES.profil, { ...profilVide(), prenom: 'Intact' })
    const avant = stockage.getItem(CLES.profil)
    expect(() => initialiserDonnees(depot, { migrations: [], versionCible: 2 })).toThrow()
    expect(stockage.getItem(CLES.profil)).toBe(avant)
    expect(depot.lire(CLES.version)).toEqual({ schema_version: 1 })
  })

  it('migration qui produit des données invalides : erreur, données actuelles intactes', () => {
    const { stockage, depot } = nouveauDepot()
    depot.ecrire(CLES.version, { schema_version: 1 })
    depot.ecrire(CLES.profil, { ...profilVide(), prenom: 'Intact' })
    const avant = stockage.getItem(CLES.profil)
    const migrations = [{ vers: 2, appliquer: (etat) => ({ ...etat, [CLES.profil]: { niveau_muscu: 'dieu' } }) }]
    expect(() => initialiserDonnees(depot, { migrations, versionCible: 2 })).toThrow(ErreurValidation)
    expect(stockage.getItem(CLES.profil)).toBe(avant)
    expect(depot.lire(CLES.version)).toEqual({ schema_version: 1 })
  })
})

describe('lireEtat et migrer', () => {
  it('lireEtat ne renvoie que les clés présentes, sans la copie de sécurité', () => {
    const { depot } = nouveauDepot()
    depot.ecrire(CLES.version, { schema_version: 1 })
    depot.ecrire(CLES.sauvegardePrecedente, { copie: true })
    expect(Object.keys(lireEtat(depot))).toEqual([CLES.version])
  })

  it('migrer ne touche pas à l’état d’origine', () => {
    const origine = { [CLES.profil]: { prenom: 'A' } }
    const resultat = migrer(origine, 1, 2, [
      { vers: 2, appliquer: (etat) => ({ ...etat, [CLES.profil]: { prenom: 'B' } }) },
    ])
    expect(origine[CLES.profil].prenom).toBe('A')
    expect(resultat[CLES.profil].prenom).toBe('B')
  })
})
