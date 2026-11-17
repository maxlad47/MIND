// Plugin Vite : produit `sw.js` à partir de `pwa/sw.template.js`.
// La version est un hash des noms de fichiers du build (qui contiennent déjà le hash de leur contenu) :
// elle change si, et seulement si, le code publié change. C'est ce qui déclenche « Nouvelle version disponible ».

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

export function genererServiceWorker() {
  const modele = readFileSync(new URL('./sw.template.js', import.meta.url), 'utf8')
  return {
    name: 'mind-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const fichiers = ['./', ...Object.keys(bundle).sort()]
      const statiques = ['manifest.webmanifest', 'favicon.svg', 'icones/icone-192.png', 'icones/icone-512.png', 'icones/icone-maskable-512.png', 'icones/apple-touch-icon.png']
      const html = bundle['index.html']
      const empreinte = createHash('sha256')
        .update(JSON.stringify(fichiers))
        .update(html && html.type === 'asset' ? String(html.source) : '')
        .digest('hex')
        .slice(0, 12)
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: modele.replace('__VERSION__', empreinte).replace('__FICHIERS__', JSON.stringify([...fichiers, ...statiques])),
      })
    },
  }
}
