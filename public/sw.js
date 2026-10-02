// RideUp service worker: shows trip notifications sent by the server (web push).
// Deliberately does no offline caching, so deploys are never served stale.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { title: 'RideUp', body: event.data?.text() } }
  event.waitUntil(self.registration.showNotification(data.title || 'RideUp', {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag,
    renotify: Boolean(data.tag),
    data: { url: data.url || '/' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = all.find((c) => new URL(c.url).origin === self.location.origin)
    if (existing) { await existing.focus(); return existing.navigate(url) }
    return self.clients.openWindow(url)
  })())
})
