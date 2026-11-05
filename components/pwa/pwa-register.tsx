'use client'

import { useEffect } from 'react'

/**
 * Service Worker Registration Component
 * Registers public/sw.js and listens for updates.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    // Only register service worker in supported browser environments
    const registerSw = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        })

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available, inform the worker to activate if desired
              newWorker.postMessage({ type: 'SKIP_WAITING' })
            }
          })
        })
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

