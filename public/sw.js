/* family-bank build 9 */
const BUILD = 9
self.addEventListener("install", (e) => {
  self.skipWaiting()
})
self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})
self.addEventListener("fetch", (event) => {
  // Network-first for navigations so home-screen opens don't stick on old HTML
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request)),
    )
  }
})
