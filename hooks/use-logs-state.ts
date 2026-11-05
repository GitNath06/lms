'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  createPracticalLog,
  updatePracticalLog,
  deletePracticalLog as deletePracticalLogAction,
  getPracticalLogs,
} from '@/app/actions/logs'
import { getNepalDateStr } from '@/lib/nepali-date'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { DEFAULT_HOLIDAYS, isDateWithinHoliday } from '@/lib/master-data'
import { getCachedData, setCachedData } from '@/lib/cache/client-query-cache'

export interface PracticalLogRecord {
  id: string
  sessionId: string
  date: string // e.g. "2083-05-15" or "2026-09-02"
  dayKey: string
  slotId: string
  timeSlot: string
  subjectCode: string
  subjectTitle: string
  grade: string
  teacher: string
  lab: string
  labId?: string
  isDualLab?: boolean
  secondaryLab?: string
  secondaryLabId?: string
  coTeacher?: string
  status: 'conducted' | 'skipped'
  topicLearned?: string
  totalStudents: number
  presentStudents: number
  absentStudents: number
  absentRolls?: number[]
  remarks?: string
  skipReason?: string
  createdAt: string
  updatedAt?: string
  isSynced?: boolean
}

function formatLogSubject(code?: string, title?: string): string {
  if (!code && !title) return 'Practical Session'
  if (!code) return title!
  if (!title) return code
  return title.toLowerCase().startsWith(code.toLowerCase()) ? title : `${code} - ${title}`
}

const STORAGE_KEY = 'lmr_practical_logs'
const OUTBOX_KEY = 'lmr_practical_logs_outbox'

// Outbox helpers
function getPendingOutbox(): PracticalLogRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(OUTBOX_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch { }
  return []
}

function savePendingOutbox(queue: PracticalLogRecord[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(queue))
    queueMicrotask(() => {
      window.dispatchEvent(new CustomEvent('sync-status-changed', { detail: { pendingCount: queue.length } }))
    })
  } catch { }
}

function addToOutbox(record: PracticalLogRecord) {
  const current = getPendingOutbox()
  const filtered = current.filter(
    (item) => !(item.id === record.id || (item.sessionId === record.sessionId && item.date === record.date))
  )
  savePendingOutbox([...filtered, { ...record, isSynced: false }])
}

function removeFromOutbox(id: string, sessionId?: string, date?: string) {
  const current = getPendingOutbox()
  const filtered = current.filter((item) => {
    if (item.id === id) return false
    if (sessionId && date && item.sessionId === sessionId && item.date === date) return false
    return true
  })
  savePendingOutbox(filtered)
}

export interface CachedLogsPayload {
  logs: PracticalLogRecord[]
  totalCount: number
  conductedCount: number
  skippedCount: number
}

export function useLogsState() {
  const [logs, setLogs] = useState<PracticalLogRecord[]>(() => {
    const cached = getCachedData<CachedLogsPayload>(`logs:list:${getNepalDateStr()}`)
    return cached?.logs || []
  })
  const [logCounts, setLogCounts] = useState(() => {
    const cached = getCachedData<CachedLogsPayload>(`logs:list:${getNepalDateStr()}`)
    return {
      totalCount: cached?.totalCount ?? 0,
      conductedCount: cached?.conductedCount ?? 0,
      skippedCount: cached?.skippedCount ?? 0,
    }
  })
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    const cached = getCachedData<CachedLogsPayload>(`logs:list:${getNepalDateStr()}`)
    return !cached
  })
  const [hasFetchedOnce, setHasFetchedOnce] = useState<boolean>(() => {
    const cached = getCachedData<CachedLogsPayload>(`logs:list:${getNepalDateStr()}`)
    return Boolean(cached)
  })

  const [isSyncing, setIsSyncing] = useState<boolean>(false)
  const isSyncingRef = useRef(false)

  // Load from localStorage on mount (prevents SSR hydration mismatch)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLogs(parsed)
        }
      }
    } catch { }
  }, [])

  // Flush Outbox Queue to Supabase
  const flushOutbox = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.onLine) return
    if (!isSupabaseConfigured()) return
    if (isSyncingRef.current) return

    const pending = getPendingOutbox()
    if (pending.length === 0) return

    isSyncingRef.current = true
    setIsSyncing(true)

    try {
      for (const item of pending) {
        const res = await createPracticalLog({
          id: item.id,
          schedule_id: item.sessionId,
          lab_id: item.labId || item.lab,
          date: item.date,
          period_label: item.timeSlot,
          subject_name: formatLogSubject(item.subjectCode, item.subjectTitle),
          batch_group: item.grade,
          practical_title: item.topicLearned || item.subjectTitle,
          total_students: item.totalStudents,
          present_students: item.presentStudents,
          absent_students: item.absentStudents,
          absent_rolls: item.absentRolls,
          remarks: item.remarks,
          status: item.status,
          skip_reason: item.skipReason,
          topic_learned: item.topicLearned,
        })

        if (res && res.success) {
          removeFromOutbox(item.id, item.sessionId, item.date)
          // Mark local copy as synced
          setLogs((prev) =>
            prev.map((l) => (l.id === item.id || (l.sessionId === item.sessionId && l.date === item.date) ? { ...l, isSynced: true } : l))
          )
        } else if (res && !res.success) {
          // Remove fatally rejected items (duplicate, holiday, validation) to prevent stuck outbox
          removeFromOutbox(item.id, item.sessionId, item.date)
        }
      }
    } catch (err) {
      console.warn('Error flushing logs outbox:', err)
    } finally {
      isSyncingRef.current = false
      setIsSyncing(false)
    }
  }, [])

  // Persist helper (asynchronous dispatch to prevent React setState-in-render collisions)
  const persistLogs = useCallback(
    (updater: PracticalLogRecord[] | ((prev: PracticalLogRecord[]) => PracticalLogRecord[])) => {
      setLogs((prev) => {
        const updated = typeof updater === 'function' ? updater(prev) : updater
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
          }
        } catch (e) {
          console.error('Failed to save logs', e)
        }
        return updated
      })

      if (typeof window !== 'undefined') {
        queueMicrotask(() => {
          window.dispatchEvent(new Event('logs-updated'))
        })
      }
    },
    []
  )

  // Load from Supabase on mount and merge with local un-synced outbox
  const loadRemoteLogs = useCallback(async () => {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/login')) {
      return
    }

    setIsLoading(true)
    try {
      // First attempt to flush any pending offline logs
      await flushOutbox()

      const todayStr = getNepalDateStr()
      const cacheKey = `logs:list:${todayStr}`
      const remoteLogs = await getPracticalLogs({ effectiveDate: todayStr })
      const rawList: any[] = Array.isArray(remoteLogs) ? remoteLogs : (remoteLogs as any)?.logs || []
      const totalCount = typeof (remoteLogs as any)?.totalCount === 'number' ? (remoteLogs as any).totalCount : rawList.length
      const conductedCount = typeof (remoteLogs as any)?.conductedCount === 'number' ? (remoteLogs as any).conductedCount : rawList.filter((l: any) => l.status !== 'skipped').length
      const skippedCount = typeof (remoteLogs as any)?.skippedCount === 'number' ? (remoteLogs as any).skippedCount : rawList.filter((l: any) => l.status === 'skipped').length

      setLogCounts({ totalCount, conductedCount, skippedCount })

      if (rawList && rawList.length > 0) {
        const pending = getPendingOutbox()
        const pendingKeySet = new Set(pending.map((p) => `${p.sessionId}_${p.date}`))
        const pendingIdSet = new Set(pending.map((p) => p.id))

        const mappedRemote: PracticalLogRecord[] = rawList
          .filter((l: any) => !pendingIdSet.has(l.id) && !pendingKeySet.has(`${l.schedule_id}_${l.date}`))
          .map((l: any) => ({
            id: l.id,
            sessionId: l.schedule_id || `log-${l.id}`,
            date: typeof l.date === 'string'
              ? (l.date.includes('T') ? l.date.split('T')[0] : l.date)
              : l.date instanceof Date
              ? `${l.date.getFullYear()}-${String(l.date.getMonth() + 1).padStart(2, '0')}-${String(l.date.getDate()).padStart(2, '0')}`
              : String(l.date || ''),
            dayKey: 'mon',
            slotId: 't2',
            timeSlot: l.period_label,
            subjectCode: l.subject_name.split(' ')[0] || 'SUBJ',
            subjectTitle: l.subject_name,
            grade: l.batch_group,
            teacher: l.profiles?.full_name || 'Assigned Faculty',
            lab: l.labs?.name || 'Laboratory',
            labId: l.lab_id || l.labs?.id || 'comp',
            status: l.status || 'conducted',
            topicLearned: l.practical_title,
            totalStudents: l.total_students,
            presentStudents: l.present_students,
            absentStudents: l.absent_students,
            absentRolls: l.absent_rolls || [],
            remarks: l.remarks || undefined,
            skipReason: l.skip_reason || undefined,
            createdAt: l.created_at,
            isSynced: true,
          }))

        // Merge: pending local outbox takes priority over remote stale records
        const merged = [...pending, ...mappedRemote]
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
          }
        } catch { }
        setLogs(merged)
        setCachedData(cacheKey, {
          logs: merged,
          totalCount,
          conductedCount,
          skippedCount,
        })
        return
      }
    } catch (e) {
      console.warn('Using local logs store fallback:', e)
    } finally {
      setIsLoading(false)
      setHasFetchedOnce(true)
    }

    // Local fallback
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLogs(parsed)
        }
      }
    } catch (e) { }
  }, [flushOutbox])

  useEffect(() => {
    loadRemoteLogs()

    // Listen to online events to immediately flush outbox
    const handleOnline = () => {
      flushOutbox()
      loadRemoteLogs()
    }

    window.addEventListener('online', handleOnline)

    // Realtime subscription on practical_logs
    if (isSupabaseConfigured()) {
      try {
        const supabase = createClient()
        const channelName = `practical-logs-feed-${Math.random().toString(36).substring(2, 8)}`
        const channel = supabase
          .channel(channelName)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'practical_logs' }, () => {
            loadRemoteLogs()
          })
          .subscribe()

        return () => {
          window.removeEventListener('online', handleOnline)
          supabase.removeChannel(channel)
        }
      } catch { }
    }

    return () => {
      window.removeEventListener('online', handleOnline)
    }
  }, [flushOutbox, loadRemoteLogs])

  // Cross-tab and same-tab sync
  useEffect(() => {
    const handleUpdate = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          const parsed = JSON.parse(saved)
          setLogs((prev) => {
            // Bail out if data is identical to avoid cascading re-renders
            if (prev.length === parsed.length && JSON.stringify(prev) === saved) {
              return prev
            }
            return parsed
          })
        }
      } catch (e) { }
    }

    window.addEventListener('logs-updated', handleUpdate)
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) handleUpdate()
    })

    return () => {
      window.removeEventListener('logs-updated', handleUpdate)
      window.removeEventListener('storage', handleUpdate as any)
    }
  }, [])

  // Save new log record (Optimistic UI + Outbox Queue + Server Action Persistence)
  const saveLog = async (logData: Omit<PracticalLogRecord, 'id' | 'createdAt'> & { id?: string }) => {
    // Prohibit recording logs on institutional holidays (automatic cancellation)
    if (DEFAULT_HOLIDAYS.some((h) => isDateWithinHoliday(logData.date, h))) {
      console.warn(`[LMR] Rejected log save on institutional holiday: ${logData.date}`)
      return null
    }
    const labKey =
      logData.labId ||
      (logData.lab?.toLowerCase().includes('comp')
        ? 'comp'
        : logData.lab?.toLowerCase().includes('phys')
          ? 'phys'
          : logData.lab?.toLowerCase().includes('chem')
            ? 'chem'
            : logData.lab?.toLowerCase().includes('bio')
              ? 'bio'
              : 'elec')

    const newRecord: PracticalLogRecord = {
      ...logData,
      labId: labKey,
      id: logData.id || `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      isSynced: false,
    }

    // 1. Immediately update optimistic UI & localStorage
    persistLogs((prev) => {
      const filtered = prev.filter(
        (l) => !(l.sessionId === logData.sessionId && l.date === logData.date)
      )
      return [newRecord, ...filtered]
    })

    // 2. Add to offline outbox queue
    addToOutbox(newRecord)

    // 3. Attempt immediate server action sync if online
    if (navigator.onLine && isSupabaseConfigured()) {
      try {
        const res = await createPracticalLog({
          id: newRecord.id,
          schedule_id: logData.sessionId,
          lab_id: labKey,
          date: logData.date,
          period_label: logData.timeSlot,
          subject_name: formatLogSubject(logData.subjectCode, logData.subjectTitle),
          batch_group: logData.grade,
          practical_title: logData.topicLearned || logData.subjectTitle,
          total_students: logData.totalStudents,
          present_students: logData.presentStudents,
          absent_students: logData.absentStudents,
          absent_rolls: logData.absentRolls,
          remarks: logData.remarks,
          status: logData.status,
          skip_reason: logData.skipReason,
          topic_learned: logData.topicLearned,
        })

        if (res && res.success) {
          removeFromOutbox(newRecord.id, logData.sessionId, logData.date)
          newRecord.isSynced = true
          persistLogs((prev) =>
            prev.map((l) => (l.id === newRecord.id ? { ...l, isSynced: true } : l))
          )
        } else if (res && !res.success) {
          removeFromOutbox(newRecord.id, logData.sessionId, logData.date)
        }
      } catch (e) {
        console.warn('Network offline, queued in outbox for automatic sync:', e)
      }
    }

    return newRecord
  }

  // Modify / Update existing log record
  const updateLog = async (logId: string, updatedData: Partial<PracticalLogRecord>) => {
    persistLogs((prev) =>
      prev.map((l) => {
        if (l.id === logId) {
          const updated = {
            ...l,
            ...updatedData,
            updatedAt: new Date().toISOString(),
            isSynced: false,
          }
          addToOutbox(updated)
          return updated
        }
        return l
      })
    )

    if (navigator.onLine && isSupabaseConfigured()) {
      try {
        const res = await updatePracticalLog(logId, {
          practical_title: updatedData.topicLearned,
          present_students: updatedData.presentStudents,
          total_students: updatedData.totalStudents,
          absent_students: updatedData.absentStudents,
          remarks: updatedData.remarks,
          status: updatedData.status,
          skip_reason: updatedData.skipReason,
        })
        if (res && res.success) {
          removeFromOutbox(logId)
          persistLogs((prev) =>
            prev.map((l) => (l.id === logId ? { ...l, isSynced: true } : l))
          )
        }
      } catch (e) {
        console.warn('Update queued in outbox for retry:', e)
      }
    }
  }

  // Delete a log record
  const deleteLog = async (logId: string) => {
    removeFromOutbox(logId)
    persistLogs((prev) => prev.filter((l) => l.id !== logId))
    try {
      await deletePracticalLogAction(logId)
    } catch (e) {
      console.warn('Server sync for deleteLog skipped:', e)
    }
  }

  // Get log record for a specific session and date
  const getLogForSession = (sessionId: string, dateStr?: string) => {
    const targetDate = dateStr || getNepalDateStr()
    return logs.find((l) => l.sessionId === sessionId && l.date === targetDate)
  }

  return {
    logs,
    logCounts,
    totalCount: logCounts.totalCount,
    conductedCount: logCounts.conductedCount,
    skippedCount: logCounts.skippedCount,
    saveLog,
    updateLog,
    deleteLog,
    getLogForSession,
    isSyncing,
    flushOutbox,
    isLoading,
    hasFetchedOnce,
    refreshLogs: loadRemoteLogs,
  }
}
