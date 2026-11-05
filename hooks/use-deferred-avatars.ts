'use client'

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react'
import { getStudentAvatarsBatch } from '@/app/actions/students'

/**
 * Module-level persistent singleton avatar cache
 * Survives across component mounts and 10-second auto-sync polls without flickering.
 */
const avatarCache = new Map<string, string | null>()
const avatarSubscribers = new Set<() => void>()
let pendingQueue = new Set<string>()
let debounceTimeout: NodeJS.Timeout | null = null

function notifyAvatarSubscribers() {
  avatarSubscribers.forEach((fn) => {
    try {
      fn()
    } catch (e) {}
  })
}

function flushAvatarQueue() {
  if (pendingQueue.size === 0) return

  // Take up to 15 IDs per batch
  const batch = Array.from(pendingQueue).slice(0, 15)
  batch.forEach((id) => pendingQueue.delete(id))

  getStudentAvatarsBatch(batch)
    .then((result) => {
      let changed = false
      for (const id of batch) {
        const url = result[id] || null
        if (avatarCache.get(id) !== url) {
          avatarCache.set(id, url)
          changed = true
        }
      }
      if (changed) {
        notifyAvatarSubscribers()
      }

      // If there are more pending IDs in the queue, schedule next batch
      if (pendingQueue.size > 0) {
        debounceTimeout = setTimeout(flushAvatarQueue, 50)
      }
    })
    .catch((err) => {
      console.warn('Avatar batch fetch error:', err)
      // Set to null so we do not infinitely retry failed IDs
      batch.forEach((id) => avatarCache.set(id, null))
      notifyAvatarSubscribers()
    })
}

/**
 * Requests an avatar to be fetched in background if not already in memory.
 */
export function queueAvatarFetch(studentId: string): void {
  if (!studentId || avatarCache.has(studentId)) return
  pendingQueue.add(studentId)

  if (!debounceTimeout) {
    debounceTimeout = setTimeout(() => {
      debounceTimeout = null
      flushAvatarQueue()
    }, 50)
  }
}

/**
 * Hook to retrieve an avatar with singleton memory persistence and 0ms return if cached.
 */
export function useDeferredAvatar(studentId?: string | null, hasPhoto?: boolean): {
  avatarUrl: string | null
  isLoading: boolean
} {
  const subscribe = useCallback((onStoreChange: () => void) => {
    avatarSubscribers.add(onStoreChange)
    return () => {
      avatarSubscribers.delete(onStoreChange)
    }
  }, [])

  const getSnapshot = useCallback(() => {
    if (!studentId) return null
    return avatarCache.get(studentId) || null
  }, [studentId])

  const avatarUrl = useSyncExternalStore(subscribe, getSnapshot, () => null)

  useEffect(() => {
    if (studentId && hasPhoto && !avatarCache.has(studentId)) {
      queueAvatarFetch(studentId)
    }
  }, [studentId, hasPhoto])

  return {
    avatarUrl,
    isLoading: Boolean(studentId && hasPhoto && !avatarCache.has(studentId)),
  }
}

