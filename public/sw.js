const CACHE_STATIC = 'labsync-static-v2'
const CACHE_HTML = 'labsync-html-v2'
const CACHE_RSC = 'labsync-rsc-v2'

const PRECACHE_ASSETS = [
  '/offline.html',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/maskable-icon-512x512.png',
  '/icons/apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_STATIC)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  const validCaches = new Set([CACHE_STATIC, CACHE_HTML, CACHE_RSC])
  const isDev = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1'
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (!validCaches.has(key)) {
              return caches.delete(key)
            }
            if (isDev && key === CACHE_STATIC) {
              return caches.open(key).then((cache) =>
                cache.keys().then((requests) =>
                  Promise.all(
                    requests
                      .filter((r) => r.url.includes('/_next/'))
                      .map((r) => cache.delete(r))
                  )
                )
              )
            }
          })
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') { return }

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/_next/webpack-hmr') || url.pathname.startsWith('/api/')) return

  // Development safeguard: Never intercept or cache dynamic Next.js development chunks on localhost/127.0.0.1
  const isDev = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1'
  if (isDev && url.pathname.startsWith('/_next/')) return

  const isRscRequest =
    req.headers.get('RSC') === '1' ||
    req.headers.get('Next-Router-Prefetch') === '1' ||
    url.searchParams.has('_rsc')

  const isHtmlNavigation =
    !isRscRequest &&
    (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html'))

  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.match(/\.(woff2?|png|jpg|jpeg|svg|ico|css|js)$/)
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached
        return fetch(req).then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone()
            caches.open(CACHE_STATIC).then((c) => c.put(req, clone))
          }
          return res
        })
      })
    )
    return
  }

  if (isRscRequest) {
    if (req.headers.get('Next-Router-Prefetch') === '1') return
    const rscCacheKey = new Request(url.origin + url.pathname + '?__rsc_cache=1')
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone()
            caches.open(CACHE_RSC).then((c) => c.put(rscCacheKey, clone))
          }
          return res
        })
        .catch(async () => {
          const cachedRsc = await caches.open(CACHE_RSC).then((c) => c.match(rscCacheKey))
          return cachedRsc || Response.error()
        })
    )
    return
  }

  if (isHtmlNavigation) {
    const htmlCacheKey = new Request(url.origin + url.pathname)
    event.respondWith(
      fetch(req)
        .then((res) => {
          const contentType = res.headers.get('content-type') || ''
          if (res && res.status === 200 && contentType.includes('text/html')) {
            const clone = res.clone()
            caches.open(CACHE_HTML).then((c) => c.put(htmlCacheKey, clone))
          }
          return res
        })
        .catch(async () => {
          const htmlCache = await caches.open(CACHE_HTML)
          const cachedPage = await htmlCache.match(htmlCacheKey)
          if (cachedPage && (cachedPage.headers.get('content-type') || '').includes('text/html')) {
            return cachedPage
          }
          const cachedRoot = await htmlCache.match(new Request(url.origin + '/'))
          if (cachedRoot && (cachedRoot.headers.get('content-type') || '').includes('text/html')) {
            return cachedRoot
          }
          const offlineFallback = await caches.match('/offline.html')
          return (
            offlineFallback ||
            new Response('Offline Mode', { status: 503, headers: { 'Content-Type': 'text/html' } })
          )
        })
    )
  }
})
