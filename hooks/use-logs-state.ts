'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  createPracticalLog,
  updatePracticalLog,
  deletePracticalLog as deletePracticalLogAction,
  getPracticalLogs,
} from '@/app/actions/logs'

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
}

const STORAGE_KEY = 'lab_practical_logs_v1'

const INITIAL_MOCK_LOGS: PracticalLogRecord[] = [
  {
    id: 'log-seed-1',
    sessionId: 'mon-1',
    date: new Date().toISOString().split('T')[0],
    dayKey: 'mon',
    slotId: 't2',
    timeSlot: '10:10 - 11:00',
    subjectCode: 'COMP-12',
    subjectTitle: 'Computer Engineering Lab',
    grade: 'Class 12',
    teacher: 'Mr. R. Sharma',
    lab: 'Computer Lab',
    status: 'conducted',
    topicLearned: 'Implementation of Binary Search Trees in C++',
    totalStudents: 38,
    presentStudents: 36,
    absentStudents: 2,
    absentRolls: [14, 28],
    remarks: 'All workstations functioning properly. Students completed traversal exercise.',
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
]

export function useLogsState() {
  const [logs, setLogs] = useState<PracticalLogRecord[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed)) return parsed
        }
      } catch (e) {}
    }
    return INITIAL_MOCK_LOGS
  })

  // Load from Supabase on mount
  useEffect(() => {
    let isMounted = true

    async function loadRemoteLogs() {
      try {
        const remoteLogs = await getPracticalLogs()
        if (isMounted && remoteLogs && remoteLogs.length > 0) {
          const mapped: PracticalLogRecord[] = remoteLogs.map((l: any) => ({
            id: l.id,
            sessionId: l.schedule_id || `log-${l.id}`,
            date: l.date,
            dayKey: 'mon',
            slotId: 't2',
            timeSlot: l.period_label,
            subjectCode: l.subject_name.split(' ')[0] || 'SUBJ',
            subjectTitle: l.subject_name,
            grade: l.batch_group,
            teacher: l.profiles?.full_name || 'Assigned Faculty',
            lab: l.labs?.name || 'Laboratory',
            status: l.status || 'conducted',
            topicLearned: l.practical_title,
            totalStudents: l.total_students,
            presentStudents: l.present_students,
            absentStudents: l.absent_students,
            remarks: l.remarks || undefined,
            skipReason: l.skip_reason || undefined,
            createdAt: l.created_at,
          }))

          setLogs(mapped)
          return
        }
      } catch (e) {
        console.warn('Using local logs store:', e)
      }

      // Local fallback
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed)) {
            setLogs(parsed)
          }
        }
      } catch (e) {}
    }

    loadRemoteLogs()
    return () => {
      isMounted = false
    }
  }, [])

  const persistLogs = useCallback((updater: PracticalLogRecord[] | ((prev: PracticalLogRecord[]) => PracticalLogRecord[])) => {
    setLogs((prev) => {
      const updated = typeof updater === 'function' ? updater(prev) : updater
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
          window.dispatchEvent(new Event('logs-updated'))
        }
      } catch (e) {
        console.error('Failed to save logs', e)
      }
      return updated
    })
  }, [])

  // Cross-tab sync
  useEffect(() => {
    const handleUpdate = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          setLogs(JSON.parse(saved))
        }
      } catch (e) {}
    }

    window.addEventListener('logs-updated', handleUpdate)
    return () => window.removeEventListener('logs-updated', handleUpdate)
  }, [])

  // Save new log record (Optimistic UI + Server Action Persistence)
  const saveLog = async (logData: Omit<PracticalLogRecord, 'id' | 'createdAt'> & { id?: string }) => {
    const newRecord: PracticalLogRecord = {
      ...logData,
      id: logData.id || `log-${Date.now()}`,
      createdAt: new Date().toISOString(),
    }

    persistLogs((prev) => {
      const filtered = prev.filter(
        (l) => !(l.sessionId === logData.sessionId && l.date === logData.date)
      )
      return [newRecord, ...filtered]
    })

    // Server action sync
    try {
      await createPracticalLog({
        schedule_id: logData.sessionId,
        lab_id: logData.lab,
        date: logData.date,
        period_label: logData.timeSlot,
        subject_name: `${logData.subjectCode} - ${logData.subjectTitle}`,
        batch_group: logData.grade,
        practical_title: logData.topicLearned || logData.subjectTitle,
        total_students: logData.totalStudents,
        present_students: logData.presentStudents,
        absent_students: logData.absentStudents,
        remarks: logData.remarks,
        status: logData.status,
        skip_reason: logData.skipReason,
        topic_learned: logData.topicLearned,
      })
    } catch (e) {
      console.warn('Server sync for saveLog skipped:', e)
    }

    return newRecord
  }

  // Modify / Update existing log record
  const updateLog = async (logId: string, updatedData: Partial<PracticalLogRecord>) => {
    persistLogs((prev) =>
      prev.map((l) => {
        if (l.id === logId) {
          return {
            ...l,
            ...updatedData,
            updatedAt: new Date().toISOString(),
          }
        }
        return l
      })
    )

    try {
      await updatePracticalLog(logId, {
        practical_title: updatedData.topicLearned,
        present_students: updatedData.presentStudents,
        total_students: updatedData.totalStudents,
        absent_students: updatedData.absentStudents,
        remarks: updatedData.remarks,
        status: updatedData.status,
        skip_reason: updatedData.skipReason,
      })
    } catch (e) {
      console.warn('Server sync for updateLog skipped:', e)
    }
  }

  // Delete a log record
  const deleteLog = async (logId: string) => {
    persistLogs((prev) => prev.filter((l) => l.id !== logId))
    try {
      await deletePracticalLogAction(logId)
    } catch (e) {
      console.warn('Server sync for deleteLog skipped:', e)
    }
  }

  // Get log record for a specific session and date
  const getLogForSession = (sessionId: string, dateStr?: string) => {
    const targetDate = dateStr || new Date().toISOString().split('T')[0]
    return logs.find((l) => l.sessionId === sessionId && l.date === targetDate)
  }

  return {
    logs,
    saveLog,
    updateLog,
    deleteLog,
    getLogForSession,
  }
}
