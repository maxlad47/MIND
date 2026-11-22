import { defineConfig } from 'vitest/config'
import { loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import { handleAI, type AIRoute } from './shared/ai-core'

/** Serveur de dev : relaie /api/ai/* vers Claude avec la clé lue côté serveur (.env.local). Jamais exposée au navigateur. */
function aiDev(apiKey: string | undefined): Plugin {
  return {
    name: 'mind-ai-dev',
    configureServer(server) {
      server.middlewares.use('/api/ai', (req, res) => {
        const route = (req.url ?? '').replace(/^\//, '').split('?')[0] as AIRoute
        if (req.method !== 'POST' || !['personalize', 'weekly'].includes(route)) { res.statusCode = 404; res.end(); return }
        let raw = ''
        req.on('data', (c) => (raw += c))
        req.on('end', async () => {
          let body: unknown = {}
          try { body = JSON.parse(raw || '{}') } catch { /* corps vide */ }
          const out = await handleAI(route, body, apiKey)
          res.statusCode = out.status === 503 ? 200 : out.status // pas de clé en local : réponse neutre, le moteur de règles prend le relais
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify(out.json))
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    base: './', // chemins relatifs : marche sur GitHub Pages (sous-dossier) comme en local
    resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
    server: { host: true, port: 5180 },
    plugins: [
      react(),
      tailwindcss(),
      aiDev(env.ANTHROPIC_API_KEY),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,ico}'] },
        registerType: 'autoUpdate',
        includeAssets: ['apple-touch-icon.png', 'icon.svg'],
        manifest: {
          name: 'MIND',
          short_name: 'MIND',
          description: 'Programmes de musculation et de course à pied',
          lang: 'fr',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#000000',
          theme_color: '#000000',
          id: 'mind-coaching',
          start_url: './',
          scope: './',
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
      }),
    ],
    test: { environment: 'node', include: ['src/**/*.test.ts'] },
  }
})
