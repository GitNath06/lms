'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  assignSubstitute,
  getSubstitutions,
  cancelSubstitution as cancelSubAction,
  FacultySubstitutionRecord,
} from '@/app/actions/substitutions'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'

const STORAGE_KEY = 'lab_teacher_substitutions_v1'
const OUTBOX_KEY = 'lab_pending_teacher_substitutions_outbox_v1'

function getPendingOutbox(): FacultySubstitutionRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(OUTBOX_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {}
  return []
}

function savePendingOutbox(queue: FacultySubstitutionRecord[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(queue))
    queueMicrotask(() => {
      window.dispatchEvent(
        new CustomEvent('sync-status-changed', {
          detail: { pendingSubstitutionsCount: queue.length },
        })
      )
    })
  } catch {}
}

function addToOutbox(record: FacultySubstitutionRecord) {
  const current = getPendingOutbox()
  const filtered = current.filter((item) => item.id !== record.id)
  savePendingOutbox([...filtered, record])
}

function removeFromOutbox(id: string) {
  const current = getPendingOutbox()
  savePendingOutbox(current.filter((item) => item.id !== id))
}

export function useSubstitutionState() {
  const [substitutions, setSubstitutions] = useState<FacultySubstitutionRecord[]>([])

  const isFlushingRef = useRef(false)

  // Flush Outbox Queue to Supabase
  const flushOutbox = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.onLine) return
    if (!isSupabaseConfigured()) return
    if (isFlushingRef.current) return

    const pending = getPendingOutbox()
    if (pending.length === 0) return

    isFlushingRef.current = true
    try {
      for (const item of pending) {
        const res = await assignSubstitute({
          id: item.id,
          schedule_id: item.schedule_id,
          date: item.date,
          slot_id: item.slot_id,
          lab_id: item.lab_id,
          original_teacher_id: item.original_teacher_id,
          original_teacher_name: item.original_teacher_name,
          substitute_teacher_id: item.substitute_teacher_id,
          substitute_teacher_name: item.substitute_teacher_name,
          reason: item.reason || undefined,
        })

        if (res && res.success) {
          removeFromOutbox(item.id)
        }
      }
    } catch (err) {
      console.warn('Error flushing substitution outbox:', err)
    } finally {
      isFlushingRef.current = false
    }
  }, [])

  const persistSubstitutions = useCallback(
    (updater: FacultySubstitutionRecord[] | ((prev: FacultySubstitutionRecord[]) => FacultySubstitutionRecord[])) => {
      setSubstitutions((prev) => {
        const updated = typeof updater === 'function' ? updater(prev) : updater
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
            queueMicrotask(() => {
              window.dispatchEvent(new Event('substitutions-updated'))
            })
          }
        } catch (e) {}
        return updated
      })
    },
    []
  )

  const loadRemoteSubstitutions = useCallback(async () => {
    try {
      await flushOutbox()
      const remote = await getSubstitutions()
      if (remote && remote.length > 0) {
        const pending = getPendingOutbox()
        const pendingIds = new Set(pending.map((p) => p.id))
        const mappedRemote = remote.filter((r) => !pendingIds.has(r.id))
        const merged = [...pending, ...mappedRemote]
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
        } catch {}
        setSubstitutions(merged)
        return
      }
    } catch (e) {
      console.warn('Using local substitutions cache:', e)
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) setSubstitutions(parsed)
      }
    } catch (e) {}
  }, [flushOutbox, persistSubstitutions])

  useEffect(() => {
    loadRemoteSubstitutions()

    const handleOnline = () => {
      flushOutbox()
      loadRemoteSubstitutions()
    }
    window.addEventListener('online', handleOnline)

    if (isSupabaseConfigured()) {
      try {
        const supabase = createClient()
        const channelName = `substitutions-feed-${Math.random().toString(36).substring(2, 8)}`
        const channel = supabase
          .channel(channelName)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'teacher_substitutions' }, () => {
            loadRemoteSubstitutions()
          })
          .subscribe()

        return () => {
          window.removeEventListener('online', handleOnline)
          supabase.removeChannel(channel)
        }
      } catch {}
    }

    return () => window.removeEventListener('online', handleOnline)
  }, [flushOutbox, loadRemoteSubstitutions])

  const assignProxy = async (data: {
    schedule_id?: string | null
    date: string
    slot_id: string
    lab_id: string
    original_teacher_id: string
    original_teacher_name: string
    substitute_teacher_id: string
    substitute_teacher_name: string
    reason?: string
  }): Promise<{ success: boolean; error?: string }> => {
    const record: FacultySubstitutionRecord = {
      id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      ...data,
      reason: data.reason || 'Official Proxy Duty',
      status: 'assigned',
      created_at: new Date().toISOString(),
    }

    // 1. Optimistic local update
    persistSubstitutions((prev) => [record, ...prev.filter((s) => !(s.schedule_id === data.schedule_id && s.date === data.date))])

    // 2. Queue in outbox
    addToOutbox(record)

    // 3. Attempt server action
    if (navigator.onLine) {
      const res = await assignSubstitute(data)
      if (res.success) {
        removeFromOutbox(record.id)
        return { success: true }
      } else {
        // Rollback optimistic update if server action detected conflict
        persistSubstitutions((prev) => prev.filter((s) => s.id !== record.id))
        removeFromOutbox(record.id)
        return { success: false, error: res.error }
      }
    }

    return { success: true }
  }

  const cancelProxy = async (id: string) => {
    removeFromOutbox(id)
    persistSubstitutions((prev) => prev.filter((s) => s.id !== id))
    try {
      await cancelSubAction(id)
    } catch (e) {}
  }

  const getSubForSession = (scheduleId: string, dateStr: string) => {
    return substitutions.find((s) => s.schedule_id === scheduleId && s.date === dateStr && s.status === 'assigned')
  }

  return {
    substitutions,
    assignProxy,
    cancelProxy,
    getSubForSession,
    flushOutbox,
  }
}
