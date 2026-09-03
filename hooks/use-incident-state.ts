'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  reportIncident,
  updateIncidentStatus,
  escalateIncidentToHOD,
  getIncidents,
  getNotifications,
  markNotificationRead as markNotifReadAction,
  type LabIncidentRecord,
  type LabNotificationRecord,
} from '@/app/actions/incidents'

export type { LabIncidentRecord, LabNotificationRecord }
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'

const INCIDENTS_KEY = 'lab_incidents_v1'
const NOTIFS_KEY = 'lab_notifications_v1'
const OUTBOX_KEY = 'lab_pending_incidents_outbox_v1'

function getPendingOutbox(): LabIncidentRecord[] {
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

function savePendingOutbox(queue: LabIncidentRecord[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(queue))
    window.dispatchEvent(
      new CustomEvent('sync-status-changed', {
        detail: { pendingIncidentsCount: queue.length },
      })
    )
  } catch {}
}

function addToOutbox(record: LabIncidentRecord) {
  const current = getPendingOutbox()
  const filtered = current.filter((item) => item.id !== record.id)
  savePendingOutbox([...filtered, record])
}

function removeFromOutbox(id: string) {
  const current = getPendingOutbox()
  savePendingOutbox(current.filter((item) => item.id !== id))
}

export function useIncidentState() {
  const [incidents, setIncidents] = useState<LabIncidentRecord[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(INCIDENTS_KEY)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed) && parsed.length > 0) return parsed
        }
      } catch (e) {}
    }
    return []
  })

  const [notifications, setNotifications] = useState<LabNotificationRecord[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(NOTIFS_KEY)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed) && parsed.length > 0) return parsed
        }
      } catch (e) {}
    }
    return []
  })

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
        const res = await reportIncident({
          id: item.id,
          lab_id: item.lab_id,
          schedule_id: item.schedule_id,
          date: item.date,
          session_label: item.session_label,
          subject_name: item.subject_name,
          subject_teacher_name: item.subject_teacher_name,
          batch_name: item.batch_name,
          title: item.title,
          incident_type: item.incident_type,
          severity: item.severity,
          equipment_name: item.equipment_name,
          quantity: item.quantity,
          student_rolls: item.student_rolls,
          is_fined: item.is_fined,
          fine_amount: item.fine_amount,
          resolution_notes: item.resolution_notes || undefined,
          reported_by: item.reported_by,
        })

        if (res && res.success) {
          removeFromOutbox(item.id)
        }
      }
    } catch (err) {
      console.warn('Error flushing incidents outbox:', err)
    } finally {
      isFlushingRef.current = false
    }
  }, [])

  const persistIncidents = useCallback(
    (updater: LabIncidentRecord[] | ((prev: LabIncidentRecord[]) => LabIncidentRecord[])) => {
      setIncidents((prev) => {
        const updated = typeof updater === 'function' ? updater(prev) : updater
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem(INCIDENTS_KEY, JSON.stringify(updated))
            queueMicrotask(() => {
              window.dispatchEvent(new Event('incidents-updated'))
            })
          }
        } catch (e) {}
        return updated
      })
    },
    []
  )

  const persistNotifs = useCallback(
    (updater: LabNotificationRecord[] | ((prev: LabNotificationRecord[]) => LabNotificationRecord[])) => {
      setNotifications((prev) => {
        const updated = typeof updater === 'function' ? updater(prev) : updater
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem(NOTIFS_KEY, JSON.stringify(updated))
            queueMicrotask(() => {
              window.dispatchEvent(new Event('notifications-updated'))
            })
          }
        } catch (e) {}
        return updated
      })
    },
    []
  )

  const loadRemoteData = useCallback(async () => {
    try {
      await flushOutbox()
      const [remoteInc, remoteNotifs] = await Promise.all([getIncidents(), getNotifications()])

      if (remoteInc && remoteInc.length > 0) {
        const pending = getPendingOutbox()
        const pendingIds = new Set(pending.map((p) => p.id))
        const filteredRemote = remoteInc.filter((r) => !pendingIds.has(r.id))
        const merged = [...pending, ...filteredRemote]
        try {
          localStorage.setItem(INCIDENTS_KEY, JSON.stringify(merged))
        } catch {}
        setIncidents(merged)
      }

      if (remoteNotifs && remoteNotifs.length > 0) {
        try {
          localStorage.setItem(NOTIFS_KEY, JSON.stringify(remoteNotifs))
        } catch {}
        setNotifications(remoteNotifs)
      }
    } catch (e) {
      console.warn('Using local incidents cache:', e)
    }
  }, [flushOutbox])

  useEffect(() => {
    loadRemoteData()

    const handleOnline = () => {
      flushOutbox()
      loadRemoteData()
    }
    window.addEventListener('online', handleOnline)

    if (isSupabaseConfigured()) {
      try {
        const supabase = createClient()
        const channelName = `incidents-feed-${Math.random().toString(36).substring(2, 8)}`
        const channel = supabase
          .channel(channelName)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'lab_incidents' }, () => {
            loadRemoteData()
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'lab_notifications' }, () => {
            loadRemoteData()
          })
          .subscribe()

        return () => {
          window.removeEventListener('online', handleOnline)
          supabase.removeChannel(channel)
        }
      } catch {}
    }

    return () => window.removeEventListener('online', handleOnline)
  }, [flushOutbox, loadRemoteData])

  // Cross-tab sync
  useEffect(() => {
    const handleUpdate = () => {
      try {
        const savedInc = localStorage.getItem(INCIDENTS_KEY)
        if (savedInc) setIncidents(JSON.parse(savedInc))
        const savedNotifs = localStorage.getItem(NOTIFS_KEY)
        if (savedNotifs) setNotifications(JSON.parse(savedNotifs))
      } catch (e) {}
    }

    window.addEventListener('incidents-updated', handleUpdate)
    window.addEventListener('notifications-updated', handleUpdate)
    return () => {
      window.removeEventListener('incidents-updated', handleUpdate)
      window.removeEventListener('notifications-updated', handleUpdate)
    }
  }, [])

  // Action: File new incident
  const logIncident = async (data: Omit<LabIncidentRecord, 'id' | 'created_at' | 'status' | 'escalated_to_hod' | 'fine_paid'> & { id?: string }) => {
    const recordId = data.id || `inc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
    const isCritical = data.severity === 'major_critical'

    const newRecord: LabIncidentRecord = {
      ...data,
      id: recordId,
      status: isCritical ? 'escalated_to_hod' : 'reported',
      escalated_to_hod: isCritical,
      fine_paid: false,
      created_at: new Date().toISOString(),
    }

    // 1. Optimistic save
    persistIncidents((prev) => [newRecord, ...prev])

    // Generate local notifications optimistically
    const localNotifs: LabNotificationRecord[] = [
      {
        id: `notif-${Date.now()}-local-admin`,
        incident_id: recordId,
        target_role: 'super_admin',
        target_lab_id: data.lab_id,
        title: `${isCritical ? '🚨 ' : ''}Incident: ${data.equipment_name}`,
        message: `${data.title} in ${data.lab_id.toUpperCase()} Lab (${data.batch_name})`,
        severity: isCritical ? 'critical' : 'warning',
        is_read: false,
        created_at: new Date().toISOString(),
      },
    ]
    if (isCritical) {
      localNotifs.push({
        id: `notif-${Date.now()}-local-hod`,
        incident_id: recordId,
        target_role: 'hod',
        target_lab_id: data.lab_id,
        title: `🚨 HOD Alert: Major Damage in ${data.lab_id.toUpperCase()}`,
        message: `Major incident requiring HOD decision: ${data.title}`,
        severity: 'critical',
        is_read: false,
        created_at: new Date().toISOString(),
      })
    }
    persistNotifs((prev) => [...localNotifs, ...prev])

    // 2. Queue in outbox
    addToOutbox(newRecord)

    // 3. Attempt server action if online
    if (navigator.onLine) {
      try {
        const res = await reportIncident(data)
        if (res && res.success) {
          removeFromOutbox(recordId)
        }
      } catch (e) {
        console.warn('Network offline, incident queued in outbox:', e)
      }
    }

    return newRecord
  }

  // Action: Escalate to HOD
  const escalateToHOD = async (id: string, reason: string) => {
    persistIncidents((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              status: 'escalated_to_hod',
              escalated_to_hod: true,
              escalation_reason: reason,
              escalated_at: new Date().toISOString(),
            }
          : i
      )
    )

    const targetItem = incidents.find((i) => i.id === id)
    if (targetItem) {
      const hodNotif: LabNotificationRecord = {
        id: `notif-${Date.now()}-hod-esc`,
        incident_id: id,
        target_role: 'hod',
        target_lab_id: targetItem.lab_id,
        title: `⚡ HOD Escalation: ${targetItem.equipment_name}`,
        message: `Escalated for HOD Intervention: "${reason}". Session: ${targetItem.session_label}.`,
        severity: 'critical',
        is_read: false,
        created_at: new Date().toISOString(),
      }
      persistNotifs((prev) => [hodNotif, ...prev])
    }

    if (navigator.onLine) {
      await escalateIncidentToHOD(id, reason)
    }
  }

  // Action: Resolve or change status (Under Repair, Replaced, Resolved)
  const resolveIncident = async (
    id: string,
    data: {
      status: 'under_repair' | 'replaced' | 'resolved'
      resolution_notes?: string
      resolved_by: string
      fine_paid?: boolean
      fine_receipt_no?: string
    }
  ) => {
    persistIncidents((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              status: data.status,
              resolution_notes: data.resolution_notes || i.resolution_notes,
              resolved_by: data.resolved_by,
              resolved_at: new Date().toISOString(),
              fine_paid: typeof data.fine_paid === 'boolean' ? data.fine_paid : i.fine_paid,
              fine_receipt_no: data.fine_receipt_no || i.fine_receipt_no,
            }
          : i
      )
    )

    if (navigator.onLine) {
      await updateIncidentStatus(id, data)
    }
  }

  // Action: Mark notification read
  const markAsRead = async (id: string) => {
    persistNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
    if (navigator.onLine) {
      await markNotifReadAction(id)
    }
  }

  const markAllAsRead = async () => {
    persistNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  return {
    incidents,
    notifications,
    unreadCount,
    logIncident,
    escalateToHOD,
    resolveIncident,
    markAsRead,
    markAllAsRead,
    flushOutbox,
  }
}
