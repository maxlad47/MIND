import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Garde-fou (CADRAGE §5) : le moteur n'a pas d'affichage, il ne doit importer ni React ni le DOM.
const dossier = dirname(fileURLToPath(import.meta.url))
const fichiers = readdirSync(dossier).filter((f) => f.endsWith('.js') && !f.endsWith('.test.js'))

describe('garde-fou moteur', () => {
  it('ne contient aucun import de React', () => {
    for (const fichier of fichiers) {
      const contenu = readFileSync(join(dossier, fichier), 'utf8')
      expect(contenu, fichier).not.toMatch(/from\s+['"]react(-dom)?['"]/)
    }
  })
})
