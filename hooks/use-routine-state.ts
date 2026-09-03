'use client'

import { useState, useEffect, useCallback } from 'react'
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

  // Load from Supabase with fallback to localStorage
  useEffect(() => {
    let isMounted = true

    async function loadRemoteSchedules() {
      try {
        const dbSchedules = await getSchedules()
        if (isMounted && dbSchedules && dbSchedules.length > 0) {
          // Map DB schedules to MasterRoutineItem format if needed
          const mapped: MasterRoutineItem[] = dbSchedules.map((s: any) => ({
            id: s.id,
            day: s.day_key === 'mon' ? 'Monday' : s.day_key === 'tue' ? 'Tuesday' : s.day_key === 'wed' ? 'Wednesday' : s.day_key === 'thu' ? 'Thursday' : 'Friday',
            dayKey: s.day_key || 'mon',
            timeSlot: `${s.start_time} - ${s.end_time}`,
            slotId: s.slot_id || 't2',
            span: s.span || 1,
            subjectCode: s.subject_name.split(' ')[0] || 'PRAC',
            subjectTitle: s.subject_name,
            grade: s.batch_name || 'Class 12',
            gradeKey: 'class-12',
            teacher: s.profiles?.full_name || 'Assigned Faculty',
            lab: s.labs?.name || 'Laboratory',
            labKey: s.labs?.type?.includes('comp') ? 'comp' : s.labs?.type?.includes('phys') ? 'phys' : 'chem',
            defaultStudents: 36,
            category: 'General',
            dotColor: s.labs?.type?.includes('comp') ? 'bg-indigo-400' : 'bg-cyan-400',
            badgeColor: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
            accentColor: 'border-l-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 text-zinc-950 dark:text-zinc-50',
          }))
          setRoutines(mapped)
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
        if (isMounted) setIsLoaded(true)
      }
    }

    loadRemoteSchedules()
    return () => {
      isMounted = false
    }
  }, [])

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

  // Operations backed by Server Actions + Optimistic State
  const addSession = async (session: MasterRoutineItem) => {
    persistRoutines((prev) => [...prev, session])
    try {
      await createSchedule({
        lab_id: session.labKey === 'comp' ? 'comp' : session.labKey === 'phys' ? 'phys' : 'chem',
        subject_name: `${session.subjectCode} - ${session.subjectTitle}`,
        batch_name: session.grade,
        day_key: session.dayKey,
        slot_id: session.slotId,
        span: session.span || 1,
        start_time: session.timeSlot.split(' - ')[0] || '10:10',
        end_time: session.timeSlot.split(' - ')[1] || '11:00',
      })
    } catch (e) {
      console.warn('Server sync for addSession skipped:', e)
    }
  }

  const deleteSession = async (sessionId: string) => {
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
          return {
            ...r,
            span: newSpan,
            timeSlot: newTimeSlot,
          }
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

          return prev
            .filter((r) => r.id !== nextSessionId)
            .map((r) => {
              if (r.id === sessionId) {
                return {
                  ...r,
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
              }
              return r
            })
        }
      }

      // Fallback: Extend single slot
      const newSpan = (current.span || 1) + 1
      const newTimeSlot = computeCombinedTimeRange(current.slotId, newSpan)
      return prev.map((r) => {
        if (r.id === sessionId) {
          return {
            ...r,
            span: newSpan,
            timeSlot: newTimeSlot,
            subjectTitle: mergedTitle || `${r.subjectTitle} (Extended Block)`,
          }
        }
        return r
      })
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
      const target = prev.find((r) => r.id === sessionId)
      if (!target) return prev

      const startIdx = MASTER_TIME_SLOTS.findIndex((t) => t.id === target.slotId)
      const startSlot = startIdx !== -1 ? MASTER_TIME_SLOTS[startIdx] : null
      const nextSlot = startIdx !== -1 && startIdx + 1 < MASTER_TIME_SLOTS.length ? MASTER_TIME_SLOTS[startIdx + 1] : null

      if (target.mergedParts || target.subjectCode.includes(' + ')) {
        const part1 = target.mergedParts?.[0]
        const part2 = target.mergedParts?.[1]

        const code1 = part1?.subjectCode || target.subjectCode.split(' + ')[0].trim()
        const code2 = part2?.subjectCode || target.subjectCode.split(' + ')[1]?.trim() || 'Practical'

        const title1 = part1?.subjectTitle || target.subjectTitle.split(' & ')[0].trim()
        const title2 = part2?.subjectTitle || target.subjectTitle.split(' & ')[1]?.trim() || 'Practical'

        const grade1 = part1?.grade || (target.grade.includes(' & ') ? target.grade.split(' & ')[0].trim() : target.grade)
        const grade2 = part2?.grade || (target.grade.includes(' & ') ? target.grade.split(' & ')[1].trim() : target.grade)

        const teacher1 = part1?.teacher || (target.teacher.includes(' & ') ? target.teacher.split(' & ')[0].trim() : target.teacher)
        const teacher2 = part2?.teacher || (target.teacher.includes(' & ') ? target.teacher.split(' & ')[1].trim() : target.teacher)

        const restoredFirst: MasterRoutineItem = {
          ...target,
          span: 1,
          timeSlot: startSlot?.label || target.timeSlot,
          subjectCode: code1,
          subjectTitle: title1,
          grade: grade1,
          teacher: teacher1,
          defaultStudents: part1?.students || Math.round((target.defaultStudents || 36) / 2),
          mergedParts: undefined,
        }

        const restoredSecond: MasterRoutineItem | null = nextSlot
          ? {
              id: `split-restored-${Date.now()}`,
              day: target.day,
              dayKey: target.dayKey,
              timeSlot: nextSlot.label,
              slotId: nextSlot.id,
              span: 1,
              subjectCode: code2,
              subjectTitle: title2,
              grade: grade2,
              gradeKey: target.gradeKey,
              teacher: teacher2,
              lab: target.lab,
              labKey: target.labKey,
              defaultStudents: part2?.students || Math.round((target.defaultStudents || 36) / 2),
              category: target.category,
              dotColor: target.dotColor,
              badgeColor: target.badgeColor,
              accentColor: target.accentColor,
              mergedParts: undefined,
            }
          : null

        return prev
          .map((r) => (r.id === sessionId ? restoredFirst : r))
          .concat(restoredSecond ? [restoredSecond] : [])
      }

      return prev.map((r) => {
        if (r.id === sessionId) {
          return {
            ...r,
            span: 1,
            timeSlot: startSlot?.label || r.timeSlot,
            subjectTitle: r.subjectTitle
              .replace(' (Extended Block)', '')
              .replace(' (Extended Practical)', '')
              .replace(' (Consolidated Block)', ''),
            mergedParts: undefined,
          }
        }
        return r
      })
    })

    try {
      await unmergeScheduleAction(sessionId)
    } catch (e) {
      console.warn('Server sync for unmergeSession skipped:', e)
    }
  }

  const updateSession = (updatedSession: MasterRoutineItem) => {
    persistRoutines((prev) =>
      prev.map((r) => (r.id === updatedSession.id ? updatedSession : r))
    )
  }

  const resetToMaster = () => {
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
    updateSession,
    resetToMaster,
  }
}
