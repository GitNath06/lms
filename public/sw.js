/**
 * LabSync LIMS — Next.js 16 RSC-Aware Enterprise Service Worker (v2.0)
 * 
 * Strict Invariant Enforcement:
 * 1. NEVER share cache keys or storage buckets between HTML Document requests and RSC Flight requests.
 * 2. HTML Document navigations (mode: 'navigate') are stored in CACHE_HTML.
 * 3. Next.js 16 RSC Flight payloads (?_rsc=... or RSC: 1) are stored in CACHE_RSC.
 * 4. Offline document navigation NEVER falls back to an RSC text/x-component payload.
 * 5. Strict non-GET bypass: Server Actions use POST and are never touched.
 */

const CACHE_STATIC = 'labsync-static-v2'
const CACHE_HTML = 'labsync-html-v2'
const CACHE_RSC = 'labsync-rsc-v2'

const PRECACHE_ASSETS = [
  '/',
  '/offline.html',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/maskable-icon-512x512.png',
  '/icons/apple-touch-icon.png',
]

// Normalize RSC URLs by stripping transient Next.js _rsc query hashes
function getCleanUrlKey(urlStr) {
  try {
    const url = new URL(urlStr)
    url.searchParams.delete('_rsc')
    return url.origin + url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : '')
  } catch {
    return urlStr
  }
}
const normalizeRscUrl = getCleanUrlKey

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
          .filter((k) => k !== CACHE_STATIC && k !== CACHE_HTML && k !== CACHE_RSC)
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

  // Skip chrome-extension, internal schemes, and non-http(s)
  if (!url.protocol.startsWith('http')) {
    return
  }

  const isRsc = req.headers.get('RSC') === '1' || url.searchParams.has('_rsc')
  const isDocumentNavigation = req.mode === 'navigate' || (!isRsc && (req.headers.get('accept') || '').includes('text/html'))

  // STRATEGY A: Static bundles, fonts, and brand icons -> Cache First with Network Fallback
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

  // STRATEGY B: HTML Document Navigations -> CACHE_HTML (Never RSC, Never Raw Text)
  if (isDocumentNavigation && !isRsc) {
    const cleanUrlKey = url.origin + url.pathname

    event.respondWith(
      new Promise((resolve) => {
        let timedOut = false

        // 2,500ms timeout for weak laboratory Wi-Fi
        const timer = setTimeout(async () => {
          timedOut = true
          const htmlCache = await caches.open(CACHE_HTML)
          const cached = await htmlCache.match(cleanUrlKey) || await htmlCache.match(req)
          if (cached) {
            resolve(cached)
          } else {
            // Fall back to root App Shell or offline.html
            const appShell = await htmlCache.match('/')
            if (appShell) {
              resolve(appShell)
            } else {
              const staticCache = await caches.open(CACHE_STATIC)
              const offlinePage = await staticCache.match('/offline.html')
              resolve(offlinePage || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/html' } }))
            }
          }
        }, 2500)

        fetch(req)
          .then(async (networkRes) => {
            clearTimeout(timer)
            const contentType = networkRes.headers.get('content-type') || ''
            // Invariant: ONLY store genuine HTML in CACHE_HTML
            if (networkRes.ok && contentType.includes('text/html')) {
              const htmlCache = await caches.open(CACHE_HTML)
              htmlCache.put(cleanUrlKey, networkRes.clone())
              htmlCache.put(req, networkRes.clone())
            }
            if (!timedOut) {
              resolve(networkRes)
            }
          })
          .catch(async () => {
            clearTimeout(timer)
            if (!timedOut) {
              const htmlCache = await caches.open(CACHE_HTML)
              const cached = await htmlCache.match(cleanUrlKey) || await htmlCache.match(req)
              if (cached) {
                resolve(cached)
              } else {
                const appShell = await htmlCache.match('/')
                if (appShell) {
                  resolve(appShell)
                } else {
                  const staticCache = await caches.open(CACHE_STATIC)
                  const offlinePage = await staticCache.match('/offline.html')
                  resolve(offlinePage || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/html' } }))
                }
              }
            }
          })
      })
    )
    return
  }

  // STRATEGY C: Next.js 16 RSC Flight Requests -> CACHE_RSC (Separated Keying & Bucket)
  if (isRsc) {
    const cleanRscKey = getCleanUrlKey(req.url)

    event.respondWith(
      new Promise((resolve) => {
        let timedOut = false

        const timer = setTimeout(async () => {
          timedOut = true
          const rscCache = await caches.open(CACHE_RSC)
          const cached = await rscCache.match(cleanRscKey) || await rscCache.match(req)
          if (cached) {
            resolve(cached)
          } else {
            resolve(new Response(JSON.stringify({ error: 'RSC Flight payload offline miss' }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            }))
          }
        }, 2500)

        fetch(req)
          .then(async (networkRes) => {
            clearTimeout(timer)
            if (networkRes.ok) {
              const rscCache = await caches.open(CACHE_RSC)
              rscCache.put(cleanRscKey, networkRes.clone())
            }
            if (!timedOut) {
              resolve(networkRes)
            }
          })
          .catch(async () => {
            clearTimeout(timer)
            if (!timedOut) {
              const rscCache = await caches.open(CACHE_RSC)
              const cached = await rscCache.match(cleanRscKey) || await rscCache.match(req)
              if (cached) {
                resolve(cached)
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
