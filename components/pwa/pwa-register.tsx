'use client'

import { useEffect } from 'react'

/**
 * Service Worker Registration & Pre-Warming Component
 * Registers public/sw.js, purges legacy caches, auto-activates waiting workers,
 * and pre-warms core routes into labsync-html-v2 and labsync-rsc-v2.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    // Client-side purge of legacy caches
    if ('caches' in window) {
      window.caches.delete('labsync-pages-v1').catch(() => {})
      window.caches.delete('labsync-static-v1').catch(() => {})
      window.caches.delete('labsync-rsc-v1').catch(() => {})
    }

    const prewarmRoutes = () => {
      if (!navigator.onLine) return
      const coreRoutes = [
        '/',
        '/computer-lab',
        '/schedules',
        '/records',
        '/profile',
        '/maintenance',
      ]

      const idleCb = window.requestIdleCallback || ((cb: () => void) => setTimeout(cb, 1500))
      idleCb(() => {
        for (const route of coreRoutes) {
          // Fetch HTML document
          fetch(route, { headers: { Accept: 'text/html' }, cache: 'no-cache' }).catch(() => {})
          // Fetch RSC flight payload
          fetch(`${route}?_rsc=1`, { headers: { RSC: '1' }, cache: 'no-cache' }).catch(() => {})
        }
      })
    }

    const registerSw = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        })

        // If a worker is already waiting, activate it immediately
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' })
        }

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: 'SKIP_WAITING' })
            }
          })
        })

        prewarmRoutes()
      } catch (err) {
        console.warn('[PWA] Service worker registration failed:', err)
      }
    }

    if (document.readyState === 'complete') {
      registerSw()
    } else {
      window.addEventListener('load', registerSw, { once: true })
    }
  }, [])

  return null
}
