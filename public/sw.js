/* Duit Kara service worker: aplikasi tetap terbuka saat sinyal jelek, data terakhir tetap tampil. */
const VERSION = 'dk-v1'
const SHELL = `${VERSION}-shell`
const DATA = `${VERSION}-data`

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(['/', '/manifest.webmanifest', '/icon.svg', '/icon-192.png'])))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (!k.startsWith(VERSION)) await caches.delete(k)
    await self.clients.claim()
  })())
})

const networkFirst = async (req, cacheName) => {
  const cache = await caches.open(cacheName)
  try {
    const res = await fetch(req)
    if (res.ok) cache.put(req, res.clone())
    return res
  } catch (err) {
    const hit = await cache.match(req)
    if (hit) return hit
    throw err
  }
}

const staleWhileRevalidate = async (req) => {
  const cache = await caches.open(SHELL)
  const hit = await cache.match(req)
  const fresh = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res }).catch(() => hit)
  return hit || fresh
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  // Halaman (SPA): coba jaringan dulu, kalau offline pakai index terakhir
  if (req.mode === 'navigate') {
    e.respondWith(networkFirst(req, SHELL).catch(() => caches.match('/')))
    return
  }
  // File aplikasi (JS/CSS/gambar/font) dari domain sendiri & Google Fonts
  if (url.origin === location.origin || url.host.endsWith('fonts.googleapis.com') || url.host.endsWith('fonts.gstatic.com')) {
    e.respondWith(staleWhileRevalidate(req))
    return
  }
  // Data Supabase (baca saja): jaringan dulu, cadangan dari cache saat offline
  if (url.host.endsWith('.supabase.co') && (url.pathname.startsWith('/rest/v1/') || url.pathname.startsWith('/storage/v1/object/sign/'))) {
    e.respondWith(networkFirst(req, DATA))
  }
})
