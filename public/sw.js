/**
 * LabSync LIMS — Next.js 16 RSC-Aware Enterprise Service Worker
 * 
 * Features:
 * 1. Strict non-GET bypass: Server Actions use POST and are never touched.
 * 2. Next.js 16 RSC Flight Payload caching with dynamic _rsc hash normalization.
 * 3. 2,500ms Network-first timeout fallback for offline page navigation.
 * 4. Cache-first strategy for static bundles, fonts, and brand assets.
 */

const CACHE_STATIC = 'labsync-static-v1'
const CACHE_PAGES = 'labsync-pages-v1'

const PRECACHE_ASSETS = [
  '/offline.html',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/maskable-icon-512x512.png',
  '/icons/apple-touch-icon.png',
]

// Normalize Next.js 16 RSC Flight request URLs by removing transient _rsc query params
function normalizeRscUrl(urlStr) {
  try {
    const url = new URL(urlStr)
    if (url.searchParams.has('_rsc')) {
      url.searchParams.delete('_rsc')
    }
    return url.toString()
  } catch {
    return urlStr
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS)
    }).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((k) => k !== CACHE_STATIC && k !== CACHE_PAGES)
          .map((k) => caches.delete(k))
      )
    }).then(() => self.clients.claim())
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('fetch', (event) => {
  const req = event.request

  // INVARIANT 1: Strict non-GET bypass (Next.js Server Actions use POST)
  if (req.method !== 'GET') {
    return
  }

  const url = new URL(req.url)

  // Skip chrome-extension, internal schemes, and analytics/telemetry if any
  if (!url.protocol.startsWith('http')) {
    return
  }

  const isRsc = req.headers.get('RSC') === '1' || url.searchParams.has('_rsc')
  const isNavigation = req.mode === 'navigate'

  // STRATEGY A: Static bundles, fonts, and media -> Cache First with Network Fallback
  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico')

  if (isStaticAsset) {
    event.respondWith(
      caches.open(CACHE_STATIC).then(async (cache) => {
        const cached = await cache.match(req)
        if (cached) return cached

        try {
          const networkRes = await fetch(req)
          if (networkRes.ok) {
            cache.put(req, networkRes.clone())
          }
          return networkRes
        } catch {
          return new Response(null, { status: 404, statusText: 'Asset not found offline' })
        }
      })
    )
    return
  }

  // STRATEGY B: Navigation and Next.js 16 RSC Flight Requests -> Network First with 2,500ms Timeout Fallback
  if (isNavigation || isRsc) {
    const normalizedKey = normalizeRscUrl(req.url)

    event.respondWith(
      new Promise((resolve) => {
        let timedOut = false

        // 2,500ms timeout timer for weak/dead Wi-Fi inside laboratory buildings
        const timer = setTimeout(async () => {
          timedOut = true
          const pageCache = await caches.open(CACHE_PAGES)
          const cached = await pageCache.match(normalizedKey) || await pageCache.match(req)
          if (cached) {
            resolve(cached)
          } else if (isNavigation) {
            const staticCache = await caches.open(CACHE_STATIC)
            const offlinePage = await staticCache.match('/offline.html')
            resolve(offlinePage || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } }))
          }
        }, 2500)

        fetch(req)
          .then(async (networkRes) => {
            clearTimeout(timer)
            if (networkRes.ok) {
              const cacheCopy = networkRes.clone()
              const pageCache = await caches.open(CACHE_PAGES)
              // Cache against both the exact request and normalized RSC key
              pageCache.put(normalizedKey, cacheCopy)
            }
            if (!timedOut) {
              resolve(networkRes)
            }
          })
          .catch(async () => {
            clearTimeout(timer)
            if (!timedOut) {
              const pageCache = await caches.open(CACHE_PAGES)
              const cached = await pageCache.match(normalizedKey) || await pageCache.match(req)
              if (cached) {
                resolve(cached)
              } else if (isNavigation) {
                const staticCache = await caches.open(CACHE_STATIC)
                const offlinePage = await staticCache.match('/offline.html')
                resolve(offlinePage || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } }))
              } else {
                resolve(new Response(JSON.stringify({ error: 'Offline network failure' }), {
                  status: 503,
                  headers: { 'Content-Type': 'application/json' },
                }))
              }
            }
          })
      })
    )
    return
  }
})

