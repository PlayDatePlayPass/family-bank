/* family-bank build 7 */
self.addEventListener("install", (e) => self.skipWaiting())
self.addEventListener("activate", (e) => e.waitUntil(clients.claim()))
self.addEventListener("fetch", () => {})
