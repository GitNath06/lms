'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getServerUserScope } from '@/lib/context/user-scope'
import { dispatchIncidentEmailAlert } from '@/app/actions/notifications'

export interface LabIncidentRecord {
  id: string
  lab_id: string
  schedule_id?: string | null
  date: string // YYYY-MM-DD
  session_label: string
  subject_name: string
  subject_teacher_name: string
  batch_name: string
  title: string
  circumstances?: string | null
  incident_type: 'breakage' | 'malfunction' | 'chemical_hazard' | 'burnt_apparatus' | 'missing' | 'other' | string
  severity: 'minor' | 'moderate' | 'major_critical'
  equipment_name: string
  quantity: number
  student_rolls?: string | null
  is_fined?: boolean
  fine_amount?: number
  fine_paid?: boolean
  fine_receipt_no?: string | null
  status: 'reported' | 'escalated_to_hod' | 'under_repair' | 'replaced' | 'resolved'
  escalated_to_hod: boolean
  escalation_reason?: string | null
  escalated_at?: string | null
  resolution_notes?: string | null
  resolved_by?: string | null
  resolved_at?: string | null
  reported_by: string
  reported_by_id?: string | null
  created_at?: string
}

export interface LabNotificationRecord {
  id: string
  incident_id?: string | null
  target_role: 'super_admin' | 'lab_incharge' | 'hod' | 'teacher' | 'all'
  target_lab_id?: string | null
  title: string
  message: string
  severity: 'info' | 'warning' | 'critical'
  is_read: boolean
  created_at: string
}

const IN_MEMORY_INCIDENTS: LabIncidentRecord[] = [
  {
    id: 'inc-seed-1',
    lab_id: 'chem',
    schedule_id: null,
    date: new Date().toISOString().split('T')[0],
    session_label: 'Period 2 & 3 (11:00 - 12:30)',
    subject_name: 'Chemistry - Acid Base Titration',
    subject_teacher_name: 'Dr. Prakash Adhikari',
    batch_name: 'Class 12C',
    title: 'Accidental breakage of 50ml glass burette while mounting on stand',
    incident_type: 'breakage',
    severity: 'moderate',
    equipment_name: '50ml Borosilicate Burette',
    quantity: 1,
    student_rolls: 'Roll 14, 28',
    status: 'reported',
    escalated_to_hod: false,
    resolution_notes: 'Clamp screw over-tightened during setup causing glass fracture. Glass cleared safely into hazardous waste bin.',
    reported_by: 'Dr. Prakash Adhikari',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
]

const IN_MEMORY_NOTIFICATIONS: LabNotificationRecord[] = [
  {
    id: 'notif-seed-1',
    incident_id: 'inc-seed-1',
    target_role: 'lab_incharge',
    target_lab_id: 'chem',
    title: 'Apparatus Breakage: 50ml Burette',
    message: 'Chemistry Lab: Glass burette broken during Period 2 & 3 (Class 12C). Safety cleared.',
    severity: 'warning',
    is_read: false,
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'notif-seed-2',
    incident_id: 'inc-seed-1',
    target_role: 'super_admin',
    target_lab_id: 'chem',
    title: 'Chemistry Lab Incident Logged',
    message: 'Class 12C practical session incident logged. Pending inspection and buffer store replacement.',
    severity: 'info',
    is_read: false,
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
]

function getIncStore(): LabIncidentRecord[] {
  if (!(globalThis as any).__LAB_INCIDENTS__) {
    ;(globalThis as any).__LAB_INCIDENTS__ = [...IN_MEMORY_INCIDENTS]
  }
  return (globalThis as any).__LAB_INCIDENTS__
}

function getNotifStore(): LabNotificationRecord[] {
  if (!(globalThis as any).__LAB_NOTIFICATIONS__) {
    ;(globalThis as any).__LAB_NOTIFICATIONS__ = [...IN_MEMORY_NOTIFICATIONS]
  }
  return (globalThis as any).__LAB_NOTIFICATIONS__
}

export async function reportIncident(data: Omit<LabIncidentRecord, 'id' | 'created_at' | 'status' | 'escalated_to_hod' | 'fine_paid'> & { id?: string }): Promise<{ success: boolean; incident?: LabIncidentRecord; error?: string }> {
  try {
    const recordId = data.id || `inc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
    const isCritical = data.severity === 'major_critical'

    const newRecord: LabIncidentRecord = {
      ...data,
      id: recordId,
      status: 'reported',
      escalated_to_hod: isCritical,
      fine_paid: false,
      created_at: new Date().toISOString(),
    }

    const store = getIncStore()
    const existingIdx = store.findIndex((i) => i.id === recordId)
    if (existingIdx !== -1) {
      store[existingIdx] = newRecord
    } else {
      store.unshift(newRecord)
    }

    // Auto-generate notifications for roles
    const notifStore = getNotifStore()
    const labName =
      data.lab_id === 'chem'
        ? 'Chemistry Laboratory'
        : data.lab_id === 'phys'
        ? 'Physics Laboratory'
        : data.lab_id === 'comp'
        ? 'Computer Laboratory'
        : `${data.lab_id.toUpperCase()} Lab`

    const notifsToInsert: LabNotificationRecord[] = [
      {
        id: `notif-${Date.now()}-admin`,
        incident_id: recordId,
        target_role: 'super_admin',
        target_lab_id: data.lab_id,
        title: `${isCritical ? '🚨 CRITICAL: ' : ''}${data.title}`,
        message: `${labName}: Reported by ${data.reported_by} during ${data.session_label} (${data.batch_name}). ${data.circumstances || ''}`,
        severity: isCritical ? 'critical' : data.severity === 'moderate' ? 'warning' : 'info',
        is_read: false,
        created_at: new Date().toISOString(),
      },
      {
        id: `notif-${Date.now()}-incharge`,
        incident_id: recordId,
        target_role: 'lab_incharge',
        target_lab_id: data.lab_id,
        title: `Damage Reported in ${data.lab_id.toUpperCase()} Lab`,
        message: `${data.title} (${data.batch_name} • ${data.session_label}). Assigned to Lab In-Charge for repair or replacement triage.`,
        severity: isCritical ? 'critical' : data.severity === 'moderate' ? 'warning' : 'info',
        is_read: false,
        created_at: new Date().toISOString(),
      },
    ]

    // If critical or moderate, notify HOD as well
    if (isCritical || data.severity === 'moderate') {
      notifsToInsert.push({
        id: `notif-${Date.now()}-hod`,
        incident_id: recordId,
        target_role: 'hod',
        target_lab_id: data.lab_id,
        title: `${isCritical ? '🚨 HOD ESCALATION: ' : 'HOD Notice: '}${data.title}`,
        message: `${labName}: ${data.batch_name} practical session damage reported. ${isCritical ? 'Immediate Head review and directive required.' : 'Logged in institutional register.'}`,
        severity: isCritical ? 'critical' : 'warning',
        is_read: false,
        created_at: new Date().toISOString(),
      })
    }

    notifsToInsert.forEach((n) => notifStore.unshift(n))

    // Write to Supabase if configured
    if (isSupabaseConfigured()) {
      try {
        const supabase = await createClient()
        await (supabase.from('lab_incidents') as any).upsert(newRecord, { onConflict: 'id' })
        await (supabase.from('lab_notifications') as any).insert(notifsToInsert)
      } catch (err) {
        console.warn('Supabase incident insert fallback active:', err)
      }
    }

    revalidatePath('/schedules')
    revalidatePath('/admin')
    revalidatePath('/')

    return { success: true, incident: newRecord }
  } catch (e: any) {
    return { success: false, error: e.message || 'Failed to report incident' }
  }
}

export async function escalateIncidentToHOD(id: string, reason: string): Promise<{ success: boolean; error?: string }> {
  try {
    const store = getIncStore()
    const item = store.find((i) => i.id === id)
    if (!item) return { success: false, error: 'Incident record not found' }

    item.status = 'escalated_to_hod'
    item.escalated_to_hod = true
    item.escalation_reason = reason
    item.escalated_at = new Date().toISOString()

    // Create high-priority HOD notification
    const notifStore = getNotifStore()
    const hodNotif: LabNotificationRecord = {
      id: `notif-${Date.now()}-hod-esc`,
      incident_id: id,
      target_role: 'hod',
      target_lab_id: item.lab_id,
      title: `⚡ HOD Escalation: ${item.equipment_name} Issue`,
      message: `Escalated for HOD Intervention: "${reason}". Session: ${item.session_label} (${item.batch_name}).`,
      severity: 'critical',
      is_read: false,
      created_at: new Date().toISOString(),
    }
    notifStore.unshift(hodNotif)

    if (isSupabaseConfigured()) {
      try {
        const supabase = await createClient()
        await (supabase.from('lab_incidents') as any).update({
          status: 'escalated_to_hod',
          escalated_to_hod: true,
          escalation_reason: reason,
          escalated_at: item.escalated_at,
        }).eq('id', id)
        await (supabase.from('lab_notifications') as any).insert([hodNotif])
      } catch (e) {}
    }

    revalidatePath('/admin')
    revalidatePath('/')

    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function updateIncidentStatus(
  id: string,
  data: {
    status: 'under_repair' | 'replaced' | 'resolved'
    resolution_notes?: string
    resolved_by: string
    fine_paid?: boolean
    fine_receipt_no?: string
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const store = getIncStore()
    const idx = store.findIndex((i) => i.id === id)
    if (idx === -1) return { success: false, error: 'Incident not found' }

    store[idx] = {
      ...store[idx],
      status: data.status,
      resolution_notes: data.resolution_notes || store[idx].resolution_notes,
      resolved_by: data.resolved_by,
      resolved_at: new Date().toISOString(),
      fine_paid: typeof data.fine_paid === 'boolean' ? data.fine_paid : store[idx].fine_paid,
      fine_receipt_no: data.fine_receipt_no || store[idx].fine_receipt_no,
    }

    if (isSupabaseConfigured()) {
      try {
        const supabase = await createClient()
        await (supabase.from('lab_incidents') as any).update({
          status: data.status,
          resolution_notes: data.resolution_notes,
          resolved_by: data.resolved_by,
          resolved_at: new Date().toISOString(),
          fine_paid: data.fine_paid,
          fine_receipt_no: data.fine_receipt_no,
        }).eq('id', id)
      } catch (e) {}
    }

    revalidatePath('/incidents')
    revalidatePath('/admin')
    revalidatePath('/')

    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function getIncidents(filters?: {
  lab_id?: string
  status?: string
  severity?: string
  date?: string
  view_mode?: 'my_data' | 'all'
}): Promise<LabIncidentRecord[]> {
  const scope = await getServerUserScope()
  const shouldScopeToMyData = !scope.isPrivileged || filters?.view_mode === 'my_data'

  const store = getIncStore()
  let list = [...store]

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      let query = supabase.from('lab_incidents').select('*').order('created_at', { ascending: false })

      if (filters?.lab_id && filters.lab_id !== 'all') query = query.eq('lab_id', filters.lab_id)
      if (filters?.status && filters.status !== 'all') query = query.eq('status', filters.status)
      if (filters?.severity && filters.severity !== 'all') query = query.eq('severity', filters.severity)
      if (filters?.date) query = query.eq('date', filters.date)

      if (shouldScopeToMyData) {
        query = query.or(
          `reported_by_id.eq.${scope.userId},subject_teacher_name.eq.${scope.fullName},reported_by.eq.${scope.fullName}`
        )
      }

      const { data, error } = await query
      if (!error && data && data.length > 0) {
        return data as LabIncidentRecord[]
      }
    } catch (e) {}
  }

  if (filters?.lab_id && filters.lab_id !== 'all') {
    list = list.filter((i) => i.lab_id === filters.lab_id)
  }
  if (filters?.status && filters.status !== 'all') {
    list = list.filter((i) => i.status === filters.status)
  }
  if (filters?.severity && filters.severity !== 'all') {
    list = list.filter((i) => i.severity === filters.severity)
  }
  if (filters?.date) {
    list = list.filter((i) => i.date === filters.date)
  }

  if (shouldScopeToMyData) {
    const teacherNames = [scope.fullName, scope.teacherProfile?.name].filter(Boolean).map((n) => n!.toLowerCase())
    list = list.filter((i) => {
      if (scope.userId && i.reported_by_id === scope.userId) return true
      const subjTeacher = (i.subject_teacher_name || '').toLowerCase()
      const rep = (i.reported_by || '').toLowerCase()
      return teacherNames.some((tn) => subjTeacher.includes(tn) || rep.includes(tn))
    })
  }

  return list
}

export async function getNotifications(role?: 'super_admin' | 'lab_incharge' | 'hod'): Promise<LabNotificationRecord[]> {
  const store = getNotifStore()
  let list = [...store]

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      let query = supabase.from('lab_notifications').select('*').order('created_at', { ascending: false })
      if (role) {
        query = query.or(`target_role.eq.${role},target_role.eq.super_admin`)
      }
      const { data, error } = await query
      if (!error && data && data.length > 0) {
        return data as LabNotificationRecord[]
      }
    } catch (e) {}
  }

  if (role) {
    list = list.filter((n) => n.target_role === role || n.target_role === 'super_admin')
  }

  return list
}

export async function markNotificationRead(id: string): Promise<{ success: boolean }> {
  const store = getNotifStore()
  const idx = store.findIndex((n) => n.id === id)
  if (idx !== -1) store[idx].is_read = true

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      await (supabase.from('lab_notifications') as any).update({ is_read: true }).eq('id', id)
    } catch (e) {}
  }

  return { success: true }
}
