import { describe, expect, it } from 'vitest'
import { ErreurDonnees } from './erreurs.js'
import { creerDepot, creerStockageMemoire, stockageNavigateur } from './stockage.js'

describe('dépôt', () => {
  it('écrit puis relit une valeur JSON', () => {
    const depot = creerDepot(creerStockageMemoire())
    depot.ecrire('mind_test', { a: 1, liste: ['x'] })
    expect(depot.lire('mind_test')).toEqual({ a: 1, liste: ['x'] })
  })

  it('renvoie undefined pour une clé absente', () => {
    const depot = creerDepot(creerStockageMemoire())
    expect(depot.lire('mind_absente')).toBeUndefined()
  })

  it('supprime une clé', () => {
    const depot = creerDepot(creerStockageMemoire())
    depot.ecrire('mind_test', 1)
    depot.supprimer('mind_test')
    expect(depot.lire('mind_test')).toBeUndefined()
  })

  it('lève ErreurDonnees si le contenu est illisible', () => {
    const stockage = creerStockageMemoire()
    stockage.setItem('mind_profil', '{pas du json')
    const depot = creerDepot(stockage)
    expect(() => depot.lire('mind_profil')).toThrow(ErreurDonnees)
  })
})

describe('stockageNavigateur', () => {
  it('renvoie null quand localStorage est absent (environnement Node)', () => {
    expect(stockageNavigateur()).toBeNull()
  })
})
