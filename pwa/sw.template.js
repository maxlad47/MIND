// Service worker de MIND (V1-M2). Modèle : `pwa/plugin.js` le complète au build (version et liste des fichiers).
// - Les fichiers de l'appli sont mis en cache à l'installation : l'appli s'ouvre hors ligne.
// - Une nouvelle version s'installe en attente ; elle ne prend la main que sur demande de l'utilisateur
//   (message SKIP_WAITING envoyé par le bandeau « Nouvelle version disponible »).
// Les données de l'utilisateur sont dans localStorage : ce cache ne les touche jamais.

const VERSION = '__VERSION__'
const NOM_CACHE = `mind-${VERSION}`
const FICHIERS = __FICHIERS__

self.addEventListener('install', (evenement) => {
  evenement.waitUntil(caches.open(NOM_CACHE).then((cache) => cache.addAll(FICHIERS)))
})

self.addEventListener('activate', (evenement) => {
  evenement.waitUntil(
    caches
      .keys()
      .then((noms) => Promise.all(noms.filter((n) => n.startsWith('mind-') && n !== NOM_CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (evenement) => {
  if (evenement.data === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request
  if (requete.method !== 'GET' || new URL(requete.url).origin !== self.location.origin) return
  evenement.respondWith(
    caches.open(NOM_CACHE).then(async (cache) => {
      const trouve = await cache.match(requete, { ignoreSearch: true })
      if (trouve) return trouve
      if (requete.mode === 'navigate') {
        const accueil = await cache.match(new URL('./', self.registration.scope).href)
        if (accueil) return accueil
      }
      return fetch(requete)
    }),
  )
})
