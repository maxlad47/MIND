// @ts-nocheck — Service worker MIND : cache hors-ligne minimal + notifications Web Push.
// Le domaine github.io est partagé avec d'autres projets : on ne touche qu'aux caches « mind-… ».
const CACHE = 'mind-v3'
const scope = (path) => new URL(path, self.registration.scope).href
const precache = (self.__WB_MANIFEST || []).map((e) => scope(e.url))

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(precache)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('mind-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.open(CACHE).then((c) => c.match(scope('index.html')))))
    return
  }
  e.respondWith(caches.open(CACHE).then((c) => c.match(req)).then((hit) => hit || fetch(req).then((res) => {
    const copy = res.clone()
    caches.open(CACHE).then((c) => c.put(req, copy))
    return res
  })))
})

self.addEventListener('push', (e) => {
  const d = e.data ? e.data.json() : { title: 'MIND', body: '' }
  e.waitUntil(self.registration.showNotification(d.title, { body: d.body, icon: scope('icon-192.png'), badge: scope('icon-192.png'), data: { url: d.url || scope('./') } }))
})
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || scope('./')
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((list) => {
    for (const c of list) if ('focus' in c) { c.navigate(url); return c.focus() }
    return self.clients.openWindow(url)
  }))
})
