import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { creerDepot, creerStockageMemoire } from '../donnees/index.js'
import Sauvegarde from './Sauvegarde.jsx'

describe('écran Sauvegarde', () => {
  it('propose l’export et l’import, et prévient que l’import remplace les données', () => {
    const html = renderToString(<Sauvegarde depot={creerDepot(creerStockageMemoire())} onExporte={() => {}} onImporte={() => {}} />)
    expect(html).toContain('Exporter ma sauvegarde')
    expect(html).toContain('Importer une sauvegarde')
    expect(html).toContain('remplace toutes les données actuelles')
  })
})
