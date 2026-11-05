'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export interface UseWakeLockResult {
  isSupported: boolean
  isLocked: boolean
  request: () => Promise<boolean>
  release: () => Promise<void>
  error: Error | null
}

/**
 * Screen Wake Lock Hook
 * Prevents mobile display from dimming or locking while active laboratory sessions are running.
 * Gracefully degrades on unsupported browsers or battery-saver restrictions.
 */
export function useWakeLock(enabled: boolean = false): UseWakeLockResult {
  const [isLocked, setIsLocked] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)
  const sentinelRef = useRef<any>(null)
  const isSupported = typeof window !== 'undefined' && 'wakeLock' in navigator

  const request = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false
    try {
      if (sentinelRef.current && !sentinelRef.current.released) {
        return true
      }
      const sentinel = await (navigator as any).wakeLock.request('screen')
      sentinelRef.current = sentinel
      setIsLocked(true)
      setError(null)

      sentinel.addEventListener('release', () => {
        setIsLocked(false)
        sentinelRef.current = null
      })

      return true
    } catch (err: any) {
      // Common when tab is inactive, battery saver is active, or user rejected permission
      setError(err instanceof Error ? err : new Error(String(err)))
      setIsLocked(false)
      sentinelRef.current = null
      return false
    }
  }, [isSupported])

  const release = useCallback(async (): Promise<void> => {
    if (sentinelRef.current && !sentinelRef.current.released) {
      try {
        await sentinelRef.current.release()
      } catch (err) {
        // Ignore release failures
      } finally {
        sentinelRef.current = null
        setIsLocked(false)
      }
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      release()
      return
    }

    request()

    // Screen Wake Lock automatically releases when the tab is backgrounded;
    // reacquire lock as soon as the teacher returns to the tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled) {
        request()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      release()
    }
  }, [enabled, request, release])

  return {
    isSupported,
    isLocked,
    request,
    release,
    error,
  }
}

