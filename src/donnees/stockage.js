import { ErreurDonnees } from './erreurs.js'

// Stockage en mémoire : mêmes méthodes que localStorage. Sert aux tests et de repli.
export function creerStockageMemoire() {
  const valeurs = new Map()
  return {
    getItem: (cle) => (valeurs.has(cle) ? valeurs.get(cle) : null),
    setItem: (cle, valeur) => {
      valeurs.set(cle, String(valeur))
    },
    removeItem: (cle) => {
      valeurs.delete(cle)
    },
  }
}

// localStorage s'il est utilisable (il peut être absent ou bloqué : navigation privée, données bloquées).
export function stockageNavigateur() {
  try {
    const stockage = globalThis.localStorage
    const sonde = 'mind__sonde'
    stockage.setItem(sonde, '1')
    stockage.removeItem(sonde)
    return stockage
  } catch {
    return null
  }
}

// Dépôt : lit et écrit du JSON sous des clés `mind_`.
export function creerDepot(stockage) {
  return {
    // Renvoie undefined si la clé est absente. Lève ErreurDonnees si le contenu est illisible.
    lire(cle) {
      const brut = stockage.getItem(cle)
      if (brut === null) return undefined
      try {
        return JSON.parse(brut)
      } catch {
        throw new ErreurDonnees(`Données illisibles : ${cle}`)
      }
    },
    ecrire(cle, valeur) {
      stockage.setItem(cle, JSON.stringify(valeur))
    },
    supprimer(cle) {
      stockage.removeItem(cle)
    },
  }
}
