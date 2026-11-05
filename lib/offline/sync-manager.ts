/**
 * LabSync LIMS — Resilient Offline Mutation Sync Manager
 * 
 * Features:
 * 1. Executes server mutations with auto-generated UUIDv4 idempotency keys.
 * 2. Catches network/timeout drops and queues mutations into IndexedDB outbox.
 * 3. Flushes mutations sequentially in FIFO order on 'online' and 'visibilitychange' events.
 * 4. Updates PWA home screen app icon badge count (navigator.setAppBadge).
 * 5. Provides reactive sync status subscription for the UI header pill.
 */

import {
  queueMutation,
  getPendingMutations,
  removeMutation,
  updateMutationAttempt,
  type MutationOutboxItem,
} from './offline-store'
import { createPracticalLog } from '@/app/actions/logs'
import { submitLiveSession } from '@/app/actions/live-session'

export interface SyncStatus {
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  lastSyncAt: number | null
}

const statusListeners = new Set<(status: SyncStatus) => void>()

let isSyncing = false
let lastSyncAt: number | null = null
let syncInitialized = false

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function getSyncStatusSnapshot(): SyncStatus {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
  return {
    isOnline,
    isSyncing,
    pendingCount: 0,
    lastSyncAt,
  }
}

function notifyStatus(pendingCount: number) {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
  const status: SyncStatus = {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncAt,
  }

  // Update App Badge
  if (typeof navigator !== 'undefined') {
    try {
      if (pendingCount > 0 && 'setAppBadge' in navigator) {
        ;(navigator as any).setAppBadge(pendingCount).catch(() => {})
      } else if ('clearAppBadge' in navigator) {
        ;(navigator as any).clearAppBadge().catch(() => {})
      }
    } catch {}
  }

  statusListeners.forEach((listener) => {
    try {
      listener(status)
    } catch (e) {
      console.warn('[SyncManager] Status listener error:', e)
    }
  })
}

export function subscribeToSyncStatus(listener: (status: SyncStatus) => void): () => void {
  statusListeners.add(listener)
  initSyncManager()
  // Immediate snapshot
  getPendingMutations().then((list) => {
    listener({
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      isSyncing,
      pendingCount: list.length,
      lastSyncAt,
    })
  }).catch(() => {})

  return () => {
    statusListeners.delete(listener)
  }
}

/**
 * Executes a single mutation action against the server.
 */
async function dispatchAction(actionType: string, payload: any): Promise<any> {
  switch (actionType) {
    case 'createPracticalLog':
      return await createPracticalLog(payload)
    case 'submitLiveSession':
      return await submitLiveSession(payload)
    default:
      throw new Error(`Unsupported offline action type: ${actionType}`)
  }
}

/**
 * Processes all pending mutations in the IndexedDB outbox.
 */
export async function flushMutationOutbox(): Promise<{ processed: number; errors: number }> {
  if (isSyncing || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return { processed: 0, errors: 0 }
  }

  isSyncing = true
  let processed = 0
  let errors = 0

  try {
    const queue = await getPendingMutations()
    notifyStatus(queue.length)

    if (queue.length === 0) {
      isSyncing = false
      lastSyncAt = Date.now()
      notifyStatus(0)
      return { processed: 0, errors: 0 }
    }

    for (const item of queue) {
      try {
        const payloadWithKey = {
          ...item.payload,
          idempotency_key: item.idempotencyKey,
        }

        const res = await dispatchAction(item.actionType, payloadWithKey)

        if (res?.success || res?.duplicateId) {
          await removeMutation(item.idempotencyKey)
          processed++
        } else {
          // If server explicitly returned validation or duplicate error
          if (res?.error && (res.error.includes('already exists') || res.error.includes('duplicate'))) {
            await removeMutation(item.idempotencyKey)
            processed++
          } else {
            await updateMutationAttempt(item.idempotencyKey, res?.error || 'Server rejected mutation')
            errors++
          }
        }
      } catch (err: any) {
        await updateMutationAttempt(item.idempotencyKey, err?.message || 'Network dispatch failure')
        errors++
        // Stop flushing if network dropped mid-sync
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          break
        }
      }
    }

    const remaining = await getPendingMutations()
    lastSyncAt = Date.now()
    notifyStatus(remaining.length)
  } finally {
    isSyncing = false
  }

  return { processed, errors }
}

/**
 * Resilient Mutation Invoker
 * 
 * Invokes a mutation with an idempotency key.
 * If offline or if the network request fails, saves into IndexedDB outbox and returns optimistic success.
 */
export async function executeResilientMutation<T = any>(
  actionType: string,
  payload: any,
  uid: string = 'current_user'
): Promise<{ success: boolean; queued?: boolean; log?: any; error?: string; idempotencyKey: string }> {
  const idempotencyKey = payload.idempotency_key || payload.idempotencyKey || generateUUID()
  const fullPayload = {
    ...payload,
    idempotency_key: idempotencyKey,
  }

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true

  if (!isOnline) {
    // Immediate outbox queueing
    await queueMutation({
      idempotencyKey,
      uid,
      actionType,
      payload: fullPayload,
    })
    const list = await getPendingMutations()
    notifyStatus(list.length)

    return {
      success: true,
      queued: true,
      idempotencyKey,
      log: {
        id: `offline-${idempotencyKey}`,
        ...fullPayload,
        is_offline_pending: true,
      },
    }
  }

  try {
    const res = await dispatchAction(actionType, fullPayload)
    if (res?.success) {
      return { ...res, idempotencyKey }
    }

    // If failed due to server business logic (e.g. validation), don't queue
    return { ...res, idempotencyKey }
  } catch (netErr: any) {
    // Network dropped mid-call -> fallback to IndexedDB outbox queue
    console.warn('[SyncManager] Network call failed. Queueing mutation to outbox:', netErr)
    await queueMutation({
      idempotencyKey,
      uid,
      actionType,
      payload: fullPayload,
    })
    const list = await getPendingMutations()
    notifyStatus(list.length)

    return {
      success: true,
      queued: true,
      idempotencyKey,
      log: {
        id: `offline-${idempotencyKey}`,
        ...fullPayload,
        is_offline_pending: true,
      },
    }
  }
}

/**
 * Initializes automatic background sync event listeners once in the browser.
 */
export function initSyncManager(): void {
  if (syncInitialized || typeof window === 'undefined') return
  syncInitialized = true

  // 1. Online / Offline listeners
  window.addEventListener('online', () => {
    flushMutationOutbox()
  })

  window.addEventListener('offline', () => {
    getPendingMutations().then((list) => notifyStatus(list.length)).catch(() => {})
  })

  // 2. Visibility change: flush when teacher opens or returns to app
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      flushMutationOutbox()
    }
  })

  // 3. Periodic flush every 30s
  setInterval(() => {
    if (navigator.onLine && !isSyncing) {
      flushMutationOutbox().catch(() => {})
    }
  }, 30_000)

  // Initial check on boot
  setTimeout(() => {
    flushMutationOutbox().catch(() => {})
  }, 1000)
}

