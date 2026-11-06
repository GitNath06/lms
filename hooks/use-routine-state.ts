'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  MasterRoutineItem,
  computeCombinedTimeRange,
  cleanSubjectTitle,
} from '@/lib/master-data'
import {
  getSchedules,
  createSchedule,
  updateSchedule as updateScheduleAction,
  mergeSchedules as mergeSchedulesAction,
  unmergeSchedule as unmergeScheduleAction,
  deleteSchedule as deleteScheduleAction,
  resetSchedulesToMaster as resetSchedulesToMasterAction,
  updateScheduleStatus,
} from '@/app/actions/schedules'
import { parseSlotTimeRange, sortSessionsChronologically } from '@/lib/utils'
import { broadcastSync, subscribeToSync } from '@/lib/sync-bus'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { fetchWithClientCache, invalidateCacheByPrefix, getCachedData, setCachedData } from '@/lib/cache/client-query-cache'

const STORAGE_KEY = 'lab_master_routine_2083_v6'
const ROUTINE_OUTBOX_KEY = 'lab_pending_schedules_outbox_v1'

export function deduplicateRoutines(items: MasterRoutineItem[]): MasterRoutineItem[] {
  if (!Array.isArray(items)) return []
  const seen = new Set<string>()
  const result: MasterRoutineItem[] = []
  for (const item of items) {
    if (!item || !item.id || seen.has(item.id)) continue
    seen.add(item.id)
    result.push(item)
  }
  return sortSessionsChronologically(result)
}

function formatRoutineSubject(code?: string, title?: string): string {
  if (!code && !title) return 'Practical Session'
  if (!code) return title!
  if (!title) return code
  return title.toLowerCase().startsWith(code.toLowerCase()) ? title : `${code} - ${title}`
}

// Schedule Outbox Helpers
function getPendingRoutineOutbox(): MasterRoutineItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(ROUTINE_OUTBOX_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {}
  return []
}

function savePendingRoutineOutbox(queue: MasterRoutineItem[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(ROUTINE_OUTBOX_KEY, JSON.stringify(queue))
    queueMicrotask(() => {
      window.dispatchEvent(new CustomEvent('sync-status-changed', { detail: { pendingSchedulesCount: queue.length } }))
    })
  } catch {}
}

function addRoutineToOutbox(session: MasterRoutineItem) {
  const current = getPendingRoutineOutbox()
  const filtered = current.filter((s) => s.id !== session.id)
  savePendingRoutineOutbox([...filtered, session])
}

function removeRoutineFromOutbox(id: string) {
  const current = getPendingRoutineOutbox()
  savePendingRoutineOutbox(current.filter((s) => s.id !== id))
}

export function useRoutineState() {
  const [routines, setRoutines] = useState<MasterRoutineItem[]>(() => {
    const cached = getCachedData<MasterRoutineItem[]>('schedules:formatted')
    if (Array.isArray(cached) && cached.length > 0) return cached
    return []
  })
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    const cached = getCachedData<MasterRoutineItem[]>('schedules:formatted')
    return !cached || cached.length === 0
  })
  const [hasFetchedOnce, setHasFetchedOnce] = useState<boolean>(() => {
    const cached = getCachedData<MasterRoutineItem[]>('schedules:formatted')
    return Boolean(cached && cached.length > 0)
  })
  const [isLoaded, setIsLoaded] = useState(() => {
    const cached = getCachedData<MasterRoutineItem[]>('schedules:formatted')
    return Boolean(cached && cached.length > 0)
  })
  const isFlushingRef = useRef(false)

  // Load from localStorage on mount (preserves user deletions and modifications without phantom resurrection)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRoutines(deduplicateRoutines(parsed))
        }
      }
    } catch (e) {}
    setIsLoaded(true)
  }, [])

  // Flush Pending Schedules Outbox to Supabase
  const flushRoutineOutbox = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.onLine) return
    if (isFlushingRef.current) return

    const pending = getPendingRoutineOutbox()
    if (pending.length === 0) return

    isFlushingRef.current = true
    try {
      for (const item of pending) {
        const res = await createSchedule({
          id: item.id,
          lab_id: item.labKey || 'comp',
          teacher_id: item.teacherId || null,
          subject_name: formatRoutineSubject(item.subjectCode, item.subjectTitle),
          batch_name: item.grade,
          day_key: item.dayKey,
          slot_id: item.slotId,
          span: item.span || 1,
          start_time: parseSlotTimeRange(item.timeSlot).startTime,
          end_time: parseSlotTimeRange(item.timeSlot).endTime,
          class_subject_id: item.classSubjectId || null,
          academic_year_id: item.academicYearId || null,
          status: 'scheduled',
          metadata: {
            teacher: item.teacher,
            labName: item.lab,
            studentsCount: item.defaultStudents,
            status: item.status || 'confirmed',
          },
        })

        if (res && res.success) {
          removeRoutineFromOutbox(item.id)
        } else if (res && res.error) {
          console.warn('Routine outbox item rejected by server, removing from outbox queue:', res.error)
          removeRoutineFromOutbox(item.id)
        }
      }
    } catch (err) {
      console.warn('Error flushing routine outbox:', err)
    } finally {
      isFlushingRef.current = false
    }
  }, [])

  // Persist helper (sanitizes duplicates and dispatches async to prevent React render collisions)
  const persistRoutines = useCallback((updater: MasterRoutineItem[] | ((prev: MasterRoutineItem[]) => MasterRoutineItem[])) => {
    setRoutines((prev) => {
      const raw = typeof updater === 'function' ? updater(prev) : updater
      const updated = deduplicateRoutines(raw)
      try {
        invalidateCacheByPrefix('schedules:')
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
        }
      } catch (e) {
        console.error('Failed to save routine', e)
      }
      return updated
    })

    if (typeof window !== 'undefined') {
      queueMicrotask(() => {
        window.dispatchEvent(new Event('routine-updated'))
        broadcastSync('schedules', {})
      })
    }
  }, [])

  // Load from Supabase with fallback to localStorage and pending outbox merge
  const loadRemoteSchedules = useCallback(async () => {
    setIsLoading(true)
    try {
      try {
        await flushRoutineOutbox()

        const dbSchedules = await fetchWithClientCache('schedules:list', () => getSchedules(), { staleTimeMs: 60_000 })
        if (Array.isArray(dbSchedules)) {
          const DAY_NAME_MAP: Record<string, 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday'> = {
            sun: 'Sunday',
            mon: 'Monday',
            tue: 'Tuesday',
            wed: 'Wednesday',
            thu: 'Thursday',
            fri: 'Friday',
            sat: 'Saturday',
          }

          const pending = getPendingRoutineOutbox()
          const remoteMap = new Map<string, any>(dbSchedules.map((s: any) => [s.id, s]))

          // Automatically evict items from outbox if remote DB already has an updated authoritative status
          const validPending = pending.filter((p) => {
            const remoteItem = remoteMap.get(p.id)
            if (!remoteItem) return true
            const remoteStatus = remoteItem.metadata?.status || remoteItem.status
            if (remoteStatus && remoteStatus !== 'requested') return false
            return true
          })
          if (validPending.length !== pending.length) {
            savePendingRoutineOutbox(validPending)
          }

          const pendingIds = new Set(validPending.map((p) => p.id))

          const mappedRemote: MasterRoutineItem[] = dbSchedules
            .filter((s: any) => !pendingIds.has(s.id))
            .map((s: any) => {
              const labKey = s.lab_id || s.labs?.id || s.metadata?.labKey || 'comp'
              const labType = (s.labs?.type || labKey || '').toLowerCase()
              const isComp = labKey === 'comp' || labType.includes('comp')
              const isPhys = labKey === 'phys' || labType.includes('phys')
              const isChem = labKey === 'chem' || labType.includes('chem')

              return {
                id: s.id,
                day: DAY_NAME_MAP[s.day_key] || 'Sunday',
                dayKey: s.day_key || 'sun',
                timeSlot:
                  (s.span && s.span > 1 && s.slot_id)
                    ? computeCombinedTimeRange(s.slot_id, s.span)
                    : `${s.start_time} - ${s.end_time}`,
                slotId: s.slot_id || 't2',
                span: s.span || 1,
                subjectCode: (() => {
                  if (s.subject_code) return s.subject_code
                  const raw = s.subject_name || ''
                  const split = raw.match(/^([A-Za-z0-9_-]+)/)
                  return split ? split[1] : 'PRAC'
                })(),
                subjectTitle: (() => {
                  const raw = s.subject_name || 'Practical Session'
                  const code = s.subject_code || raw.match(/^([A-Za-z0-9_-]+)/)?.[1] || ''
                  return cleanSubjectTitle(code, raw) || raw
                })(),
                grade: s.batch_name || 'Class 12',
                gradeKey: 'class-12',
                teacher: s.teacher_name || s.profiles?.full_name || 'Unassigned Faculty',
                teacherId: s.resolved_teacher_id || s.teacher_id || s.profiles?.id || null,
                lab: s.labs?.name || 'Laboratory',
                labCode: s.labs?.code || s.metadata?.labCode,
                labKey,
                secondaryLab: s.metadata?.secondary_lab_name || s.metadata?.secondaryLab || undefined,
                secondaryLabKey: s.metadata?.secondary_lab_id || s.metadata?.secondaryLabKey || undefined,
                isDualLab: Boolean(s.metadata?.is_multi_lab || s.metadata?.isDualLab || s.metadata?.secondary_lab_id),
                coTeacher: s.metadata?.co_teacher || s.metadata?.coTeacher || undefined,
                classSubjectId: s.class_subject_id || null,
                academicYearId: s.academic_year_id || null,
                specificDate: (function(val: any) {
                  if (!val) return null
                  if (typeof val === 'string') return val.split('T')[0]
                  if (val instanceof Date) {
                    const y = val.getFullYear()
                    const m = String(val.getMonth() + 1).padStart(2, '0')
                    const d = String(val.getDate()).padStart(2, '0')
                    return `${y}-${m}-${d}`
                  }
                  return String(val).split('T')[0]
                })(s.specific_date || s.metadata?.specific_date),
                isAdHoc: Boolean(s.specific_date || s.metadata?.is_adhoc || s.id?.startsWith('adhoc-')),
                defaultStudents: s.metadata?.studentsCount || 36,
                category: isComp ? 'Computer' : isPhys ? 'Physics' : isChem ? 'Chemistry' : (s.labs?.name?.replace(/\s*Lab(oratory)?/i, '') || s.metadata?.category || 'General'),
                dotColor: isComp ? 'bg-indigo-500' : isPhys ? 'bg-amber-500' : isChem ? 'bg-emerald-500' : 'bg-cyan-500',
                badgeColor: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
                accentColor: 'border-l-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 text-zinc-950 dark:text-zinc-50',
                status: (s.metadata?.status === 'requested' || (s.metadata as any)?.status === 'skipped')
                  ? (s.metadata as any).status
                  : (s.status === 'scheduled' ? 'confirmed' : (s.status || s.metadata?.status || 'confirmed')),
                isSkipped: s.metadata?.is_skipped || s.status === 'skipped' || false,
                skippedReason: s.metadata?.skipped_reason || undefined,
                skippedBy: s.metadata?.skipped_by || undefined,
                requestedBy: s.metadata?.requested_by || undefined,
                declineReason: s.metadata?.decline_reason || undefined,
              }
            })

          // Remote database schedules ARE the authoritative source of truth.
          const scheduleMap = new Map<string, MasterRoutineItem>()
          for (const remoteItem of mappedRemote) {
            scheduleMap.set(remoteItem.id, remoteItem)
          }
          for (const pendingItem of validPending) {
            if ((pendingItem.status as any) === 'deleted') {
              scheduleMap.delete(pendingItem.id)
            } else {
              scheduleMap.set(pendingItem.id, pendingItem)
            }
          }
          const merged = deduplicateRoutines(Array.from(scheduleMap.values()))
          try {
            if (typeof window !== 'undefined') {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
            }
          } catch {}
          setCachedData('schedules:formatted', merged)
          setRoutines(merged)
          return
        }
      } catch (e: any) {
        if (e?.name !== 'AbortError' && !e?.message?.includes('Failed to fetch')) {
          console.warn('Using local routine storage:', e)
        }
      }

      // Local fallback only if offline / fetch threw
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed)) {
            setRoutines(deduplicateRoutines(parsed))
          }
        } else {
          setRoutines([])
        }
      } catch (e) {}
    } finally {
      setIsLoaded(true)
      setIsLoading(false)
      setHasFetchedOnce(true)
    }
  }, [flushRoutineOutbox])

  // Periodic polling & Supabase Realtime subscription
  useEffect(() => {
    loadRemoteSchedules()

    const handleOnline = () => {
      flushRoutineOutbox()
      loadRemoteSchedules()
    }

    window.addEventListener('online', handleOnline)

    // Periodic synchronization heartbeat (every 10 seconds)
    const syncInterval = setInterval(() => {
      if (typeof window !== 'undefined' && navigator.onLine) {
        loadRemoteSchedules()
      }
    }, 10000)

    // Real-time Supabase postgres_changes channel for schedules
    let channel: any = null
    if (isSupabaseConfigured()) {
      try {
        const supabase = createClient()
        const channelName = `schedules-realtime-${Math.random().toString(36).substring(2, 8)}`
        channel = supabase
          .channel(channelName)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'schedules',
            },
            () => {
              loadRemoteSchedules()
            }
          )
          .subscribe()
      } catch (err) {
        console.warn('Realtime subscription error for schedules:', err)
      }
    }

    return () => {
      clearInterval(syncInterval)
      window.removeEventListener('online', handleOnline)
      if (channel && isSupabaseConfigured()) {
        try {
          const supabase = createClient()
          supabase.removeChannel(channel)
        } catch {}
      }
    }
  }, [flushRoutineOutbox, loadRemoteSchedules])

  // Listen to external updates across tabs
  useEffect(() => {
    const handleUpdate = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed)) {
            const deduped = deduplicateRoutines(parsed)
            setRoutines((prev) => {
              if (prev.length === deduped.length && JSON.stringify(prev) === JSON.stringify(deduped)) {
                return prev
              }
              return deduped
            })
          }
        }
      } catch (e) {}
    }

    window.addEventListener('routine-updated', handleUpdate)
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) handleUpdate()
    })

    const unsub = subscribeToSync('schedules', (eventData) => {
      const payloadRoutines = eventData?.payload?.routines
      if (payloadRoutines && Array.isArray(payloadRoutines)) {
        const deduped = deduplicateRoutines(payloadRoutines)
        setRoutines((prev) => {
          if (prev.length === deduped.length && JSON.stringify(prev) === JSON.stringify(deduped)) {
            return prev
          }
          return deduped
        })
      } else {
        loadRemoteSchedules()
      }
    })

    return () => {
      window.removeEventListener('routine-updated', handleUpdate)
      window.removeEventListener('storage', handleUpdate as any)
      unsub()
    }
  }, [loadRemoteSchedules])

  // Operations backed by Server Actions + Optimistic State + Outbox
  const addSession = async (session: MasterRoutineItem): Promise<{ success: boolean; error?: string }> => {
    const effectiveSpan = session.span || 1
    const effectiveTimeSlot = (effectiveSpan > 1 && session.slotId)
      ? computeCombinedTimeRange(session.slotId, effectiveSpan)
      : (session.timeSlot || '10:10 - 11:00')

    const finalizedSession: MasterRoutineItem = {
      ...session,
      span: effectiveSpan,
      timeSlot: effectiveTimeSlot,
    }

    persistRoutines((prev) => {
      const filtered = prev.filter((r) => r.id !== finalizedSession.id)
      return [...filtered, finalizedSession]
    })
    addRoutineToOutbox(finalizedSession)

    if (navigator.onLine) {
      try {
        const parsedTimes = parseSlotTimeRange(effectiveTimeSlot)
        const res = await createSchedule({
          id: finalizedSession.id,
          lab_id: finalizedSession.labKey || 'comp',
          teacher_id: finalizedSession.teacherId || null,
          subject_name: formatRoutineSubject(finalizedSession.subjectCode, finalizedSession.subjectTitle),
          batch_name: finalizedSession.grade,
          day_key: finalizedSession.dayKey,
          slot_id: finalizedSession.slotId,
          span: effectiveSpan,
          start_time: parsedTimes.startTime,
          end_time: parsedTimes.endTime,
          class_subject_id: finalizedSession.classSubjectId || null,
          academic_year_id: finalizedSession.academicYearId || null,
          specific_date: finalizedSession.specificDate || null,
          status: 'scheduled',
          metadata: {
            teacher: finalizedSession.teacher,
            labName: finalizedSession.lab,
            studentsCount: finalizedSession.defaultStudents,
            secondary_lab_id: finalizedSession.secondaryLabKey || null,
            secondary_lab_name: finalizedSession.secondaryLab || null,
            is_multi_lab: Boolean(finalizedSession.isDualLab),
            co_teacher: finalizedSession.coTeacher || null,
            status: finalizedSession.status || 'confirmed',
            specific_date: finalizedSession.specificDate || null,
            is_adhoc: finalizedSession.isAdHoc || Boolean(finalizedSession.specificDate),
          },
        })
        if (res && res.success) {
          removeRoutineFromOutbox(finalizedSession.id)
          broadcastSync('schedules', { action: 'add', sessionId: finalizedSession.id })
          return { success: true }
        } else if (res && res.error) {
          console.error('[LMR] createSchedule rejected:', res.error)
          persistRoutines((prev) => prev.filter((r) => r.id !== finalizedSession.id))
          removeRoutineFromOutbox(finalizedSession.id)
          return { success: false, error: res.error }
        }
      } catch (e: any) {
        console.warn('Network offline, routine queued in outbox:', e)
        return { success: false, error: e?.message || 'Network error' }
      }
    }
    return { success: true }
  }

  const deleteSession = async (sessionId: string) => {
    removeRoutineFromOutbox(sessionId)
    persistRoutines((prev) => prev.filter((r) => r.id !== sessionId))

    if (navigator.onLine) {
      try {
        const res = await deleteScheduleAction(sessionId)
        if (res && res.success) {
          removeRoutineFromOutbox(sessionId)
          broadcastSync('schedules', { action: 'delete', sessionId })
        } else if (res && !res.success) {
          console.error('[DATABASE ERROR] Failed to delete schedule in database:', res.error)
        }
      } catch (e) {
        console.warn('Server sync for deleteSession failed:', e)
      }
    }
  }

  const updateSession = async (sessionId: string, updatedFields: Partial<MasterRoutineItem>) => {
    const current = routines.find((r) => r.id === sessionId)
    if (!current) return
    const updated: MasterRoutineItem = {
      ...current,
      ...updatedFields,
    }
    persistRoutines((prev) => prev.map((r) => (r.id === sessionId ? updated : r)))
    addRoutineToOutbox(updated)

    if (navigator.onLine) {
      try {
        const labId = updated.labKey || 'comp'

        const res = await updateScheduleAction(sessionId, {
          lab_id: labId,
          teacher_id: updated.teacherId || null,
          subject_name: formatRoutineSubject(updated.subjectCode, updated.subjectTitle),
          batch_name: updated.grade,
          day_key: updated.dayKey,
          slot_id: updated.slotId,
          span: updated.span || 1,
          start_time: parseSlotTimeRange(updated.timeSlot).startTime,
          end_time: parseSlotTimeRange(updated.timeSlot).endTime,
          class_subject_id: updated.classSubjectId || null,
          academic_year_id: updated.academicYearId || null,
          metadata: {
            teacher: updated.teacher,
            labName: updated.lab,
            studentsCount: updated.defaultStudents,
            secondary_lab_id: updated.secondaryLabKey,
            is_multi_lab: updated.isDualLab,
            status: updated.status || 'confirmed',
          },
        })
        if (res && res.success) {
          removeRoutineFromOutbox(sessionId)
          broadcastSync('schedules', { action: 'update', sessionId })
        }
      } catch (e) {
        console.warn('Network offline, update queued in outbox:', e)
      }
    }
  }

  const extendSession = async (sessionId: string, additionalSpan: number = 1) => {
    const current = routines.find((r) => r.id === sessionId)
    if (!current) return
    const newSpan = (current.span || 1) + additionalSpan
    const newTimeSlot = computeCombinedTimeRange(current.slotId, newSpan)
    const updated = {
      ...current,
      span: newSpan,
      timeSlot: newTimeSlot,
    }
    persistRoutines((prev) => prev.map((r) => (r.id === sessionId ? updated : r)))
    addRoutineToOutbox(updated)

    if (navigator.onLine) {
      try {
        const res = await updateScheduleAction(sessionId, {
          span: newSpan,
          start_time: parseSlotTimeRange(newTimeSlot).startTime,
          end_time: parseSlotTimeRange(newTimeSlot).endTime,
        })
        if (res && res.success) {
          removeRoutineFromOutbox(sessionId)
          broadcastSync('schedules', { action: 'extend', sessionId })
        }
      } catch (e) {
        console.warn('Server sync for extendSession skipped:', e)
      }
    }
  }

  const mergeSession = async (
    sessionId: string,
    nextSessionId?: string,
    mergedCode?: string,
    mergedTitle?: string,
    mergedGrade?: string,
    mergedTeacher?: string
  ) => {
    const current = routines.find((r) => r.id === sessionId)
    if (!current) return

    if (nextSessionId) {
      const next = routines.find((r) => r.id === nextSessionId)
      if (next) {
        const combinedSpan = (current.span || 1) + (next.span || 1)
        const combinedTimeSlot = computeCombinedTimeRange(current.slotId, combinedSpan)
        const isSameCode = Boolean(current.subjectCode === next.subjectCode)
        const isSameTitle = Boolean(current.subjectTitle === next.subjectTitle)
        const combinedCode =
          mergedCode || (isSameCode ? current.subjectCode : `${current.subjectCode} + ${next.subjectCode}`)
        const combinedTitle =
          mergedTitle || (isSameTitle ? current.subjectTitle : `${current.subjectTitle} & ${next.subjectTitle}`)
        const combinedGrade = mergedGrade || (current.grade === next.grade ? current.grade : `${current.grade} & ${next.grade}`)
        const combinedTeacher = mergedTeacher || (current.teacher === next.teacher ? current.teacher : `${current.teacher} & ${next.teacher}`)
        const combinedStudents = (current.defaultStudents || 36) + (next.defaultStudents || 36)

        const mergedItem: MasterRoutineItem = {
          ...current,
          span: combinedSpan,
          timeSlot: combinedTimeSlot,
          subjectCode: combinedCode,
          subjectTitle: combinedTitle,
          grade: combinedGrade,
          teacher: combinedTeacher,
          defaultStudents: combinedStudents,
          mergedParts: [
            {
              subjectCode: current.subjectCode,
              subjectTitle: current.subjectTitle,
              grade: current.grade,
              teacher: current.teacher,
              students: current.defaultStudents,
            },
            {
              subjectCode: next.subjectCode,
              subjectTitle: next.subjectTitle,
              grade: next.grade,
              teacher: next.teacher,
              students: next.defaultStudents,
            },
          ],
        }

        persistRoutines((prev) =>
          prev.filter((r) => r.id !== nextSessionId).map((r) => (r.id === sessionId ? mergedItem : r))
        )
        addRoutineToOutbox(mergedItem)

        try {
          const res = await mergeSchedulesAction(sessionId, nextSessionId, {
            subject_name: mergedTitle,
            batch_name: mergedGrade,
          })
          if (res && res.success) {
            removeRoutineFromOutbox(sessionId)
            if (nextSessionId) removeRoutineFromOutbox(nextSessionId)
            broadcastSync('schedules', { action: 'merge', sessionId })
          }
        } catch (e) {
          console.warn('Server sync for mergeSession skipped:', e)
        }
        return
      }
    }

    // Single session extend fallback
    const newSpan = (current.span || 1) + 1
    const updated = {
      ...current,
      span: newSpan,
      timeSlot: computeCombinedTimeRange(current.slotId, newSpan),
    }
    persistRoutines((prev) => prev.map((r) => (r.id === sessionId ? updated : r)))
    addRoutineToOutbox(updated)
  }

  const unmergeSession = async (sessionId: string) => {
    const current = routines.find((r) => r.id === sessionId)
    if (!current || (current.span || 1) <= 1) return

    let slotList: Array<{ id: string; label: string; name?: string }> = []
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('infrastructure_periods')
        if (saved) {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed) && parsed.length > 0) slotList = parsed
        }
      } catch (e) {}
    }
    const originalSlot = slotList.find((t) => t.id === current.slotId)
    const unmerged: MasterRoutineItem = {
      ...current,
      span: 1,
      timeSlot: originalSlot?.label || current.timeSlot.split('-')[0]?.trim() || '10:10 - 11:00',
      subjectCode: current.mergedParts ? current.mergedParts[0].subjectCode : current.subjectCode.split(' + ')[0],
      subjectTitle: current.mergedParts ? current.mergedParts[0].subjectTitle : current.subjectTitle.split(' & ')[0],
      grade: current.mergedParts ? current.mergedParts[0].grade : current.grade.split(' & ')[0],
      teacher: current.mergedParts ? current.mergedParts[0].teacher : current.teacher.split(' & ')[0],
      mergedParts: undefined,
    }

    persistRoutines((prev) => prev.map((r) => (r.id === sessionId ? unmerged : r)))
    addRoutineToOutbox(unmerged)

    try {
      const res = await unmergeScheduleAction(sessionId)
      if (res && res.success) {
        removeRoutineFromOutbox(sessionId)
        broadcastSync('schedules', { action: 'unmerge', sessionId })
      }
    } catch (e) {
      console.warn('Server sync for unmergeSession skipped:', e)
    }
  }

  const skipSession = async (sessionId: string, reason: string = 'Administrative cancellation', skippedBy: string = 'Administrator') => {
    const current = routines.find((r) => r.id === sessionId)
    const updated: MasterRoutineItem = current
      ? {
          ...current,
          status: 'skipped',
          isSkipped: true,
          skippedReason: reason,
          skippedBy,
        }
      : ({
          id: sessionId,
          status: 'skipped',
          isSkipped: true,
          skippedReason: reason,
          skippedBy,
        } as any)

    persistRoutines((prev) =>
      prev.map((r) =>
        r.id === sessionId
          ? {
              ...r,
              status: 'skipped',
              isSkipped: true,
              skippedReason: reason,
              skippedBy,
            }
          : r
      )
    )

    try {
      const res = await updateScheduleStatus(sessionId, {
        status: 'skipped',
        is_skipped: true,
        skipped_reason: reason,
        skipped_by: skippedBy,
      })
      if (res && res.success) {
        removeRoutineFromOutbox(sessionId)
        broadcastSync('schedules', { action: 'skip', sessionId })
      } else {
        addRoutineToOutbox(updated)
      }
    } catch (e) {
      console.warn('Server sync for skipSession skipped:', e)
      addRoutineToOutbox(updated)
    }
  }

  const unskipSession = async (sessionId: string) => {
    const current = routines.find((r) => r.id === sessionId)
    const updated: MasterRoutineItem = current
      ? {
          ...current,
          status: 'confirmed',
          isSkipped: false,
          skippedReason: undefined,
          skippedBy: undefined,
        }
      : ({
          id: sessionId,
          status: 'confirmed',
          isSkipped: false,
        } as any)

    persistRoutines((prev) =>
      prev.map((r) =>
        r.id === sessionId
          ? {
              ...r,
              status: 'confirmed',
              isSkipped: false,
              skippedReason: undefined,
              skippedBy: undefined,
            }
          : r
      )
    )

    try {
      const res = await updateScheduleStatus(sessionId, {
        status: 'confirmed',
        is_skipped: false,
      })
      if (res && res.success) {
        removeRoutineFromOutbox(sessionId)
        broadcastSync('schedules', { action: 'unskip', sessionId })
      } else {
        addRoutineToOutbox(updated)
      }
    } catch (e) {
      console.warn('Server sync for unskipSession skipped:', e)
      addRoutineToOutbox(updated)
    }
  }

  const requestSlotBooking = async (
    session: MasterRoutineItem,
    requestedBy: string
  ): Promise<{ success: boolean; error?: string }> => {
    const requestedSession: MasterRoutineItem = {
      ...session,
      status: 'requested',
      isSkipped: false,
      requestedBy,
    }

    if (navigator.onLine) {
      try {
        const res = await createSchedule({
          id: session.id,
          lab_id: session.labKey || 'comp',
          subject_name: formatRoutineSubject(session.subjectCode, session.subjectTitle),
          batch_name: session.grade,
          day_key: session.dayKey,
          slot_id: session.slotId,
          span: session.span || 1,
          teacher_id: session.teacherId || null,
          class_subject_id: session.classSubjectId || null,
          specific_date: session.specificDate || null,
          start_time: parseSlotTimeRange(session.timeSlot).startTime,
          end_time: parseSlotTimeRange(session.timeSlot).endTime,
          metadata: {
            teacher: session.teacher,
            labName: session.lab,
            studentsCount: session.defaultStudents,
            secondary_lab_id: session.secondaryLabKey || null,
            secondary_lab_name: session.secondaryLab || null,
            is_multi_lab: Boolean(session.isDualLab),
            co_teacher: session.coTeacher || null,
            status: 'requested',
            requested_by: requestedBy,
            specific_date: session.specificDate || null,
            is_adhoc: session.isAdHoc || Boolean(session.specificDate),
          },
        })
        if (res && res.error) {
          console.error('[LMR] requestSlotBooking rejected by server:', res.error)
          return { success: false, error: res.error }
        }
        if (res && res.success) {
          removeRoutineFromOutbox(requestedSession.id)
          persistRoutines((prev) => {
            const filtered = prev.filter((r) => r.id !== requestedSession.id)
            return [...filtered, requestedSession]
          })
          broadcastSync('schedules', { action: 'request', sessionId: requestedSession.id })
          return { success: true }
        }
      } catch (e: any) {
        console.warn('Network error during requestSlotBooking:', e)
        return { success: false, error: e?.message || 'Network error' }
      }
    } else {
      persistRoutines((prev) => {
        const filtered = prev.filter((r) => r.id !== requestedSession.id)
        return [...filtered, requestedSession]
      })
      addRoutineToOutbox(requestedSession)
      return { success: true }
    }
    return { success: true }
  }

  const approveSlotBooking = async (sessionId: string) => {
    removeRoutineFromOutbox(sessionId)
    persistRoutines((prev) =>
      prev.map((r) => (r.id === sessionId ? { ...r, status: 'confirmed', isSkipped: false } : r))
    )

    try {
      const res = await updateScheduleStatus(sessionId, { status: 'confirmed' })
      if (res && res.success) {
        removeRoutineFromOutbox(sessionId)
        broadcastSync('schedules', { action: 'approve', sessionId })
      }
    } catch (e) {
      console.warn('Server sync for approveSlotBooking skipped:', e)
    }
  }

  const rejectSlotBooking = async (sessionId: string, reason?: string) => {
    const finalReason = reason || 'Booking request declined by Lab Administration'
    removeRoutineFromOutbox(sessionId)
    persistRoutines((prev) =>
      prev.map((r) =>
        r.id === sessionId
          ? {
              ...r,
              status: 'skipped',
              isSkipped: true,
              declineReason: finalReason,
            }
          : r
      )
    )

    try {
      const res = await updateScheduleStatus(sessionId, {
        status: 'skipped',
        is_skipped: true,
        decline_reason: finalReason,
      })
      if (res && res.success) {
        removeRoutineFromOutbox(sessionId)
        broadcastSync('schedules', { action: 'reject', sessionId })
      }
    } catch (e) {
      console.warn('Server sync for rejectSlotBooking skipped:', e)
    }
  }

  const resetToMaster = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ROUTINE_OUTBOX_KEY)
      savePendingRoutineOutbox([])
    }
    try {
      const res = await resetSchedulesToMasterAction()
      if (res.success) {
        await loadRemoteSchedules()
        broadcastSync('schedules', { action: 'reset' })
      }
    } catch (e) {
      console.warn('Failed to reset remote database to master:', e)
    }
  }

  return {
    routines,
    isLoaded,
    isLoading,
    hasFetchedOnce,
    refreshSchedules: loadRemoteSchedules,
    addSession,
    updateSession,
    deleteSession,
    extendSession,
    mergeSession,
    unmergeSession,
    skipSession,
    unskipSession,
    requestSlotBooking,
    approveSlotBooking,
    rejectSlotBooking,
    resetToMaster,
    flushRoutineOutbox,
  }
}
