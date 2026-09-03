'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  MASTER_ROUTINE,
  MASTER_TIME_SLOTS,
  MasterRoutineItem,
  computeCombinedTimeRange
} from '@/lib/master-data'
import {
  getSchedules,
  createSchedule,
  mergeSchedules as mergeSchedulesAction,
  unmergeSchedule as unmergeScheduleAction,
  deleteSchedule as deleteScheduleAction,
} from '@/app/actions/schedules'

const STORAGE_KEY = 'lab_master_routine_2083_v6'
const ROUTINE_OUTBOX_KEY = 'lab_pending_schedules_outbox_v1'

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
    window.dispatchEvent(new CustomEvent('sync-status-changed', { detail: { pendingSchedulesCount: queue.length } }))
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
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed) && parsed.length > 0) return parsed
        }
      } catch (e) {}
    }
    return MASTER_ROUTINE
  })
  const [isLoaded, setIsLoaded] = useState(false)
  const isFlushingRef = useRef(false)

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
          lab_id: item.labKey === 'comp' ? 'comp' : item.labKey === 'phys' ? 'phys' : item.labKey === 'chem' ? 'chem' : item.labKey === 'bio' ? 'bio' : 'elec',
          subject_name: `${item.subjectCode} - ${item.subjectTitle}`,
          batch_name: item.grade,
          day_key: item.dayKey,
          slot_id: item.slotId,
          span: item.span || 1,
          start_time: item.timeSlot.split(' - ')[0] || '10:10',
          end_time: item.timeSlot.split(' - ')[1] || '11:00',
          metadata: {
            teacher: item.teacher,
            labName: item.lab,
            studentsCount: item.defaultStudents,
          },
        })

        if (res && res.success) {
          removeRoutineFromOutbox(item.id)
        }
      }
    } catch (err) {
      console.warn('Error flushing routine outbox:', err)
    } finally {
      isFlushingRef.current = false
    }
  }, [])

  // Persist helper
  const persistRoutines = useCallback((updater: MasterRoutineItem[] | ((prev: MasterRoutineItem[]) => MasterRoutineItem[])) => {
    setRoutines((prev) => {
      const updated = typeof updater === 'function' ? updater(prev) : updater
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
          window.dispatchEvent(new Event('routine-updated'))
        }
      } catch (e) {
        console.error('Failed to save routine', e)
      }
      return updated
    })
  }, [])

  // Load from Supabase with fallback to localStorage and pending outbox merge
  const loadRemoteSchedules = useCallback(async () => {
    try {
      await flushRoutineOutbox()

      const dbSchedules = await getSchedules()
      if (dbSchedules && dbSchedules.length > 0) {
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
        const pendingIds = new Set(pending.map((p) => p.id))

        const mappedRemote: MasterRoutineItem[] = dbSchedules
          .filter((s: any) => !pendingIds.has(s.id))
          .map((s: any) => {
            const labKey = s.lab_id || (s.labs?.type?.includes('comp') ? 'comp' : s.labs?.type?.includes('phys') ? 'phys' : s.labs?.type?.includes('chem') ? 'chem' : s.labs?.type?.includes('bio') ? 'bio' : 'elec')
            const isComp = labKey === 'comp'
            const isPhys = labKey === 'phys'
            const isChem = labKey === 'chem'
            const isBio = labKey === 'bio'

            return {
              id: s.id,
              day: DAY_NAME_MAP[s.day_key] || 'Sunday',
              dayKey: s.day_key || 'sun',
              timeSlot: `${s.start_time} - ${s.end_time}`,
              slotId: s.slot_id || 't2',
              span: s.span || 1,
              subjectCode: s.subject_name.split(' ')[0] || 'PRAC',
              subjectTitle: s.subject_name,
              grade: s.batch_name || 'Class 12',
              gradeKey: 'class-12',
              teacher: s.metadata?.teacher || s.profiles?.full_name || 'Assigned Faculty',
              lab: s.metadata?.labName || s.labs?.name || 'Laboratory',
              labKey,
              defaultStudents: s.metadata?.studentsCount || 36,
              category: isComp ? 'Computer' : isPhys ? 'Physics' : isChem ? 'Chemistry' : isBio ? 'Biology' : 'General',
              dotColor: isComp ? 'bg-indigo-500' : isPhys ? 'bg-amber-500' : isChem ? 'bg-emerald-500' : isBio ? 'bg-teal-500' : 'bg-cyan-500',
              badgeColor: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
              accentColor: 'border-l-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 text-zinc-950 dark:text-zinc-50',
            }
          })

        // Merge: un-synced offline schedules take priority
        const merged = [...pending, ...mappedRemote]
        persistRoutines(merged)
        setIsLoaded(true)
        return
      }
    } catch (e) {
      console.warn('Using local routine storage:', e)
    }

    // Local fallback
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRoutines(parsed)
        }
      }
    } catch (e) {} finally {
      setIsLoaded(true)
    }
  }, [flushRoutineOutbox, persistRoutines])

  useEffect(() => {
    loadRemoteSchedules()

    const handleOnline = () => {
      flushRoutineOutbox()
      loadRemoteSchedules()
    }

    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [flushRoutineOutbox, loadRemoteSchedules])

  // Listen to external updates across tabs
  useEffect(() => {
    const handleUpdate = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          setRoutines(JSON.parse(saved))
        }
      } catch (e) {}
    }

    window.addEventListener('routine-updated', handleUpdate)
    return () => window.removeEventListener('routine-updated', handleUpdate)
  }, [])

  // Operations backed by Server Actions + Optimistic State + Outbox
  const addSession = async (session: MasterRoutineItem) => {
    persistRoutines((prev) => [...prev, session])
    addRoutineToOutbox(session)

    if (navigator.onLine) {
      try {
        const res = await createSchedule({
          lab_id: session.labKey === 'comp' ? 'comp' : session.labKey === 'phys' ? 'phys' : session.labKey === 'chem' ? 'chem' : session.labKey === 'bio' ? 'bio' : 'elec',
          subject_name: `${session.subjectCode} - ${session.subjectTitle}`,
          batch_name: session.grade,
          day_key: session.dayKey,
          slot_id: session.slotId,
          span: session.span || 1,
          start_time: session.timeSlot.split(' - ')[0] || '10:10',
          end_time: session.timeSlot.split(' - ')[1] || '11:00',
          metadata: {
            teacher: session.teacher,
            labName: session.lab,
            studentsCount: session.defaultStudents,
          },
        })
        if (res && res.success) {
          removeRoutineFromOutbox(session.id)
        }
      } catch (e) {
        console.warn('Network offline, routine queued in outbox:', e)
      }
    }
  }

  const deleteSession = async (sessionId: string) => {
    removeRoutineFromOutbox(sessionId)
    persistRoutines((prev) => prev.filter((r) => r.id !== sessionId))
    try {
      await deleteScheduleAction(sessionId)
    } catch (e) {
      console.warn('Server sync for deleteSession skipped:', e)
    }
  }

  const extendSession = (sessionId: string, additionalSpan: number = 1) => {
    persistRoutines((prev) =>
      prev.map((r) => {
        if (r.id === sessionId) {
          const newSpan = (r.span || 1) + additionalSpan
          const newTimeSlot = computeCombinedTimeRange(r.slotId, newSpan)
          const updated = {
            ...r,
            span: newSpan,
            timeSlot: newTimeSlot,
          }
          addRoutineToOutbox(updated)
          return updated
        }
        return r
      })
    )
  }

  const mergeSession = async (
    sessionId: string,
    nextSessionId?: string,
    mergedCode?: string,
    mergedTitle?: string,
    mergedGrade?: string,
    mergedTeacher?: string
  ) => {
    persistRoutines((prev) => {
      const current = prev.find((r) => r.id === sessionId)
      if (!current) return prev

      if (nextSessionId) {
        const next = prev.find((r) => r.id === nextSessionId)
        if (next) {
          const combinedSpan = (current.span || 1) + (next.span || 1)
          const combinedTimeSlot = computeCombinedTimeRange(current.slotId, combinedSpan)
          const combinedCode = mergedCode || `${current.subjectCode} + ${next.subjectCode}`
          const combinedTitle = mergedTitle || `${current.subjectTitle} & ${next.subjectTitle}`
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

          addRoutineToOutbox(mergedItem)

          return prev
            .filter((r) => r.id !== nextSessionId)
            .map((r) => (r.id === sessionId ? mergedItem : r))
        }
      }

      // Single session extend fallback
      const newSpan = (current.span || 1) + 1
      const updated = {
        ...current,
        span: newSpan,
        timeSlot: computeCombinedTimeRange(current.slotId, newSpan),
      }
      addRoutineToOutbox(updated)
      return prev.map((r) => (r.id === sessionId ? updated : r))
    })

    try {
      await mergeSchedulesAction(sessionId, nextSessionId, {
        subject_name: mergedTitle,
        batch_name: mergedGrade,
      })
    } catch (e) {
      console.warn('Server sync for mergeSession skipped:', e)
    }
  }

  const unmergeSession = async (sessionId: string) => {
    persistRoutines((prev) => {
      const current = prev.find((r) => r.id === sessionId)
      if (!current || (current.span || 1) <= 1) return prev

      const originalSlot = MASTER_TIME_SLOTS.find((t) => t.id === current.slotId)
      const unmerged: MasterRoutineItem = {
        ...current,
        span: 1,
        timeSlot: originalSlot?.label || '10:10 - 11:00',
        subjectCode: current.mergedParts ? current.mergedParts[0].subjectCode : current.subjectCode.split(' + ')[0],
        subjectTitle: current.mergedParts ? current.mergedParts[0].subjectTitle : current.subjectTitle.split(' & ')[0],
        grade: current.mergedParts ? current.mergedParts[0].grade : current.grade.split(' & ')[0],
        teacher: current.mergedParts ? current.mergedParts[0].teacher : current.teacher.split(' & ')[0],
        mergedParts: undefined,
      }

      addRoutineToOutbox(unmerged)
      return prev.map((r) => (r.id === sessionId ? unmerged : r))
    })

    try {
      await unmergeScheduleAction(sessionId)
    } catch (e) {
      console.warn('Server sync for unmergeSession skipped:', e)
    }
  }

  const resetToMaster = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ROUTINE_OUTBOX_KEY)
      savePendingRoutineOutbox([])
    }
    persistRoutines(MASTER_ROUTINE)
  }

  return {
    routines,
    isLoaded,
    addSession,
    deleteSession,
    extendSession,
    mergeSession,
    unmergeSession,
    resetToMaster,
    flushRoutineOutbox,
  }
}
