/* family-bank build 13 */
const BUILD = 13
const FONT_CACHE = `fb-fonts-${BUILD}`

self.addEventListener("install", (e) => {
  self.skipWaiting()
})
self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== FONT_CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})
self.addEventListener("fetch", (event) => {
  const req = event.request
  // Network-first for navigations so home-screen opens don't stick on old HTML
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(req)))
    return
  }
  // Cache-first for the bundled font files (hashed names) so text stays IBM Plex offline
  if (req.method === "GET") {
    const url = new URL(req.url)
    if (url.origin === self.location.origin && /\.woff2?$/.test(url.pathname)) {
      event.respondWith(
        (async () => {
          const cache = await caches.open(FONT_CACHE)
          const hit = await cache.match(req)
          if (hit) return hit
          const res = await fetch(req)
          if (res.ok) cache.put(req, res.clone())
          return res
        })(),
      )
    }
  }
})
