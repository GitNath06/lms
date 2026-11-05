'use client'

import { useSyncExternalStore, useCallback, useEffect, useRef } from 'react'
import { subscribeToSync, type SyncDomain } from '@/lib/sync-bus'
import { saveQuerySnapshot, getAllUserSnapshots } from '@/lib/offline/offline-store'

/**
 * High-Performance In-Memory Client SWR Store
 * Delivers 0ms instantaneous UI hydration on tab switching with silent background revalidation.
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  inFlight?: Promise<T>
  error?: Error | null
}

const memoryCache = new Map<string, CacheEntry<any>>()
const subscribers = new Set<() => void>()
const inFlightPromises = new Map<string, Promise<any>>()

function notifySubscribers() {
  subscribers.forEach((listener) => {
    try {
      listener()
    } catch (e) {
      console.warn('Query cache subscriber error:', e)
    }
  })
}

export function getCachedQuery<T>(key: string): T | undefined {
  return memoryCache.get(key)?.data as T | undefined
}

export function setCachedQuery<T>(key: string, data: T): void {
  const existing = memoryCache.get(key)
  memoryCache.set(key, {
    data,
    timestamp: Date.now(),
    inFlight: undefined,
    error: null,
  })
  notifySubscribers()

  // Write-through persistence to IndexedDB asynchronously for offline resilience
  if (typeof window !== 'undefined') {
    try {
      const activeUser = memoryCache.get('auth:current-user-profile')?.data
      const uid = activeUser?.id || 'anonymous'
      saveQuerySnapshot(uid, key, data).catch(() => {})
    } catch {}
  }
}

/**
 * Restores query snapshots from IndexedDB into memory on cold start (<25ms).
 */
export async function hydrateCacheFromIndexedDB(uid: string): Promise<number> {
  if (typeof window === 'undefined' || !uid) return 0
  try {
    const snapshots = await getAllUserSnapshots(uid)
    const keys = Object.keys(snapshots)
    keys.forEach((key) => {
      if (!memoryCache.has(key)) {
        memoryCache.set(key, {
          data: snapshots[key],
          timestamp: Date.now() - 30_000,
          inFlight: undefined,
          error: null,
        })
      }
    })
    if (keys.length > 0) {
      notifySubscribers()
    }
    return keys.length
  } catch (err) {
    console.warn('[Cache] IDB hydration failed:', err)
    return 0
  }
}

export const getCachedData = getCachedQuery
export const setCachedData = setCachedQuery
export function invalidateCacheByPrefix(prefix: string): void {
  invalidateQueryCache(prefix, { purge: true })
}

export interface FetchWithClientCacheOptions {
  staleTimeMs?: number // Default: 60,000ms (1 minute)
  force?: boolean // If true, bypasses stale check and fetches fresh
}

/**
 * Executes an async fetcher with in-memory caching and in-flight promise deduplication.
 * - If cache is fresh (< staleTimeMs), returns cached data in 0ms without network call.
 * - If multiple components call this concurrently for the same key, shares 1 single in-flight Promise.
 */
export async function fetchWithClientCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: FetchWithClientCacheOptions = {}
): Promise<T> {
  const { staleTimeMs = 60_000, force = false } = options

  ensureSyncBusBridge()

  // 1. Return fresh cached data in 0ms if available
  if (!force) {
    const entry = memoryCache.get(key)
    if (entry && entry.data !== undefined) {
      const isFresh = entry.timestamp > 0 && Date.now() - entry.timestamp <= staleTimeMs
      if (isFresh) {
        return entry.data as T
      }
    }
  }

  // 2. Return identical in-flight promise if a request for this exact key is already running
  if (inFlightPromises.has(key)) {
    return inFlightPromises.get(key) as Promise<T>
  }

  // 3. Initiate single fetch and deduplicate parallel calls
  const promise = (async () => {
    try {
      const freshData = await fetcher()
      setCachedQuery(key, freshData)
      return freshData
    } finally {
      inFlightPromises.delete(key)
    }
  })()

  inFlightPromises.set(key, promise)
  return promise
}

export function isCachedQueryStale(key: string, ttlMs = 0): boolean {
  const entry = memoryCache.get(key)
  if (!entry) return true
  if (entry.timestamp === 0) return true
  return Date.now() - entry.timestamp > ttlMs
}

export function invalidateQueryCache(
  pattern?: string | RegExp,
  options?: { purge?: boolean }
): void {
  const purge = options?.purge ?? false
  if (!pattern) {
    memoryCache.clear()
  } else if (typeof pattern === 'string') {
    for (const key of Array.from(memoryCache.keys())) {
      if (key.startsWith(pattern) || key.includes(pattern)) {
        if (purge) {
          memoryCache.delete(key)
        } else {
          const entry = memoryCache.get(key)
          if (entry) {
            entry.timestamp = 0 // mark stale
          }
        }
      }
    }
  } else if (pattern instanceof RegExp) {
    for (const key of Array.from(memoryCache.keys())) {
      if (pattern.test(key)) {
        if (purge) {
          memoryCache.delete(key)
        } else {
          const entry = memoryCache.get(key)
          if (entry) {
            entry.timestamp = 0 // mark stale
          }
        }
      }
    }
  }
  notifySubscribers()
}

// Global hook subscription to sync bus events to invalidate cache
let syncBusSubscribed = false
function ensureSyncBusBridge() {
  if (syncBusSubscribed || typeof window === 'undefined') return
  syncBusSubscribed = true

  subscribeToSync('all', (detail) => {
    const domain = detail?.domain as SyncDomain
    if (!domain) return

    switch (domain) {
      case 'infrastructure':
      case 'settings':
      case 'holidays':
        invalidateQueryCache('bootstrap')
        invalidateQueryCache('infrastructure')
        break
      case 'schedule':
      case 'schedules':
        invalidateQueryCache('schedules')
        invalidateQueryCache('bootstrap')
        break
      case 'logs':
        invalidateQueryCache('logs')
        break
      case 'workstations':
      case 'assistance':
        invalidateQueryCache('workstation')
        invalidateQueryCache('floor')
        invalidateQueryCache('seat-plan')
        invalidateQueryCache('live-session')
        break
      case 'incidents':
        invalidateQueryCache('incidents')
        break
      default:
        invalidateQueryCache(domain)
        break
    }
  })
}

export interface UseClientQueryOptions<T> {
  staleTimeMs?: number // Default: 60,000ms (1 minute)
  enabled?: boolean
  initialData?: T
  onSuccess?: (data: T) => void
}

export interface ClientQueryResult<T> {
  data: T | undefined
  isLoading: boolean
  isRevalidating: boolean
  error: Error | null
  revalidate: () => Promise<T | undefined>
  mutate: (newData: T | ((prev: T | undefined) => T)) => void
}

/**
 * Primary React hook for SWR query execution with 0ms instantaneous rendering.
 */
export function useClientQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: UseClientQueryOptions<T> = {}
): ClientQueryResult<T> {
  const { staleTimeMs = 60000, enabled = true, initialData, onSuccess } = options
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess

  useEffect(() => {
    ensureSyncBusBridge()
  }, [])

  // Subscribe to external store
  const subscribe = useCallback((onStoreChange: () => void) => {
    subscribers.add(onStoreChange)
    return () => {
      subscribers.delete(onStoreChange)
    }
  }, [])

  // Synchronous snapshot getter for React 18/19 tear-free consistency
  const getSnapshot = useCallback(() => {
    const entry = memoryCache.get(key)
    return entry?.data !== undefined ? entry.data : initialData
  }, [key, initialData])

  const getServerSnapshot = useCallback(() => {
    return initialData
  }, [initialData])

  const data = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  // Determine state
  const entry = memoryCache.get(key)
  const isCached = entry !== undefined && entry.data !== undefined
  const isStale = !entry || Date.now() - entry.timestamp > staleTimeMs
  const isRevalidating = Boolean(entry?.inFlight)
  const isLoading = enabled && !isCached && isRevalidating
  const error = entry?.error || null

  const revalidate = useCallback(async (): Promise<T | undefined> => {
    if (!enabled) return undefined
    const currentEntry = memoryCache.get(key)

    // Deduplicate in-flight promises
    if (currentEntry?.inFlight) {
      return currentEntry.inFlight
    }

    const promise = fetcherRef
      .current()
      .then((freshData) => {
        memoryCache.set(key, {
          data: freshData,
          timestamp: Date.now(),
          inFlight: undefined,
          error: null,
        })
        notifySubscribers()
        onSuccessRef.current?.(freshData)
        return freshData
      })
      .catch((err) => {
        const existing = memoryCache.get(key)
        memoryCache.set(key, {
          data: existing?.data,
          timestamp: existing?.timestamp || 0,
          inFlight: undefined,
          error: err instanceof Error ? err : new Error(String(err)),
        })
        notifySubscribers()
        throw err
      })

    memoryCache.set(key, {
      data: currentEntry?.data !== undefined ? currentEntry.data : initialData,
      timestamp: currentEntry?.timestamp || 0,
      inFlight: promise,
      error: null,
    })
    notifySubscribers()

    return promise
  }, [key, enabled, initialData])

  // Trigger background revalidation when stale or on mount
  useEffect(() => {
    if (!enabled) return
    const current = memoryCache.get(key)
    const needsFetch = !current || Date.now() - current.timestamp > staleTimeMs

    if (needsFetch && !current?.inFlight) {
      revalidate().catch(() => {
        // Error captured in state
      })
    }
  }, [key, enabled, staleTimeMs, revalidate])

  const mutate = useCallback(
    (newData: T | ((prev: T | undefined) => T)) => {
      const current = memoryCache.get(key)?.data
      const resolved = typeof newData === 'function' ? (newData as any)(current) : newData
      setCachedQuery(key, resolved)
    },
    [key]
  )

  return {
    data,
    isLoading: isLoading && data === undefined,
    isRevalidating,
    error,
    revalidate,
    mutate,
  }
}
