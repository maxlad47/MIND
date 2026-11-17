import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { creerDepot, creerStockageMemoire } from '../donnees/index.js'
import { enregistrerProfil, formulaireVide } from '../profil/formulaire.js'
import Profil from './Profil.jsx'

describe('écran Profil', () => {
  it('affiche le formulaire vide avec « Non renseigné »', () => {
    const html = renderToString(<Profil depot={creerDepot(creerStockageMemoire())} />)
    expect(html).toContain('Profil')
    expect(html).toContain('Non renseigné')
    expect(html).toContain('Enregistrer')
    expect(html).not.toContain('Date de la course') // pas de course visée
    expect(html).toContain('Des muscles en priorité ou des exclusions ?')
    expect(html).not.toContain('Ischio-jambiers') // liste masquée tant que la réponse est « non »
  })

  it('réaffiche le profil enregistré après rechargement', () => {
    const stockage = creerStockageMemoire()
    enregistrerProfil(creerDepot(stockage), {
      ...formulaireVide(),
      prenom: 'Camille',
      objectif_course: '10km',
      date_course: '2027-03-01',
      chrono_10km: '48:15',
    })
    const html = renderToString(<Profil depot={creerDepot(stockage)} />)
    expect(html).toContain('Camille')
    expect(html).toContain('Date de la course')
    expect(html).toContain('2027-03-01')
    expect(html).toContain('48:15')
  })

  it('affiche la liste des muscles quand des statuts sont enregistrés', () => {
    const stockage = creerStockageMemoire()
    const form = { ...formulaireVide(), prenom: 'Camille', groupes_actif: true }
    form.groupes_statut.dos = 'prioritaire'
    enregistrerProfil(creerDepot(stockage), form)
    expect(renderToString(<Profil depot={creerDepot(stockage)} />)).toContain('Ischio-jambiers')
  })
})
