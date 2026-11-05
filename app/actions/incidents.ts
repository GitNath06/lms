'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getServerUserScope } from '@/lib/context/server-user-scope'
import { dispatchIncidentEmailAlert } from '@/app/actions/notifications'
import { isValidUuid } from '@/lib/utils'
import { uploadIncidentPhotoToStorage } from '@/lib/storage/supabase-storage'
import { getPgPool } from '@/lib/db'

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
  photo_url?: string | null
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
  metadata?: Record<string, any> | null
  created_at: string
}

const IN_MEMORY_INCIDENTS: LabIncidentRecord[] = []
const IN_MEMORY_NOTIFICATIONS: LabNotificationRecord[] = []

declare global {
  var __INCIDENT_RECORDS_STORE__: any[] | undefined
  var __LAB_NOTIFICATIONS__: LabNotificationRecord[] | undefined
}

function getIncStore(): LabIncidentRecord[] {
  if (!globalThis.__INCIDENT_RECORDS_STORE__) {
    globalThis.__INCIDENT_RECORDS_STORE__ = [...IN_MEMORY_INCIDENTS]
  }
  return globalThis.__INCIDENT_RECORDS_STORE__ as LabIncidentRecord[]
}

function getNotifStore(): LabNotificationRecord[] {
  if (!globalThis.__LAB_NOTIFICATIONS__) {
    globalThis.__LAB_NOTIFICATIONS__ = [...IN_MEMORY_NOTIFICATIONS]
  }
  return globalThis.__LAB_NOTIFICATIONS__
}

export async function reportIncident(data: Omit<LabIncidentRecord, 'id' | 'created_at' | 'status' | 'escalated_to_hod'> & { id?: string; reported_by_id?: string | null; resolved_by_id?: string | null; fine_paid?: boolean; photo_url?: string | null }): Promise<{ success: boolean; incident?: LabIncidentRecord; error?: string }> {
  try {
    const scope = await getServerUserScope()
    if (scope.isPending || scope.approvalStatus !== 'approved') {
      return { success: false, error: 'Unauthorized: Your account is pending institutional verification.' }
    }

    const recordId = data.id || `inc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
    const isCritical = data.severity === 'major_critical'
    const validReportedById = isValidUuid(data.reported_by_id) ? data.reported_by_id : null
    const validResolvedById = isValidUuid(data.resolved_by_id) ? data.resolved_by_id : null

    let finalPhotoUrl = data.photo_url || null
    if (finalPhotoUrl && (finalPhotoUrl.startsWith('data:image/') || !finalPhotoUrl.startsWith('http'))) {
      finalPhotoUrl = await uploadIncidentPhotoToStorage(recordId, finalPhotoUrl)
    }

    const newRecord: LabIncidentRecord = {
      ...data,
      id: recordId,
      photo_url: finalPhotoUrl,
      status: isCritical ? 'escalated_to_hod' : 'reported',
      escalated_to_hod: isCritical,
      escalation_reason: isCritical ? (data.escalation_reason || 'Critical equipment damage requiring immediate institutional inspection') : null,
      escalated_at: isCritical ? new Date().toISOString() : null,
      fine_paid: Boolean(data.fine_paid),
      created_at: new Date().toISOString(),
      reported_by_id: validReportedById,
    }

    // 1. Shared in-memory store (deduplicated by ID)
    const store = getIncStore()
    const existingIdx = store.findIndex((i) => i.id === recordId)
    if (existingIdx !== -1) {
      store[existingIdx] = newRecord
    } else {
      store.unshift(newRecord)
    }

    // Auto-generate notifications for roles
    const notifStore = getNotifStore()
    // Clean up any existing notifications for this incident to prevent duplicate alerts
    for (let i = notifStore.length - 1; i >= 0; i--) {
      if (notifStore[i].incident_id === recordId) {
        notifStore.splice(i, 1)
      }
    }

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
        id: `notif-${recordId}-admin`,
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
        id: `notif-${recordId}-incharge`,
        incident_id: recordId,
        target_role: 'lab_incharge',
        target_lab_id: data.lab_id,
        title: `Damage Reported in ${data.lab_id.toUpperCase()} Lab`,
        message: `${data.title} (${data.batch_name} • ${data.session_label}). Assigned to Lab In-Charge for repair or replacement triage.`,
        severity: isCritical ? 'critical' : data.severity === 'moderate' ? 'warning' : 'info',
        is_read: false,
        created_at: new Date().toISOString(),
      },
      {
        id: `notif-${recordId}-teacher`,
        incident_id: recordId,
        target_role: 'teacher',
        target_lab_id: data.lab_id,
        title: `Incident Report Submitted: ${data.title}`,
        message: `Your report for ${data.equipment_name || data.title} in ${labName} has been logged and queued for Lab In-Charge triage.`,
        severity: 'info',
        is_read: false,
        created_at: new Date().toISOString(),
      },
    ]

    // If critical or moderate, notify HOD as well
    if (isCritical || data.severity === 'moderate') {
      notifsToInsert.push({
        id: `notif-${recordId}-hod`,
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

    // 3. PostgreSQL Direct Connection Pool (guaranteed RLS-independent persistence)
    try {
      const pool = getPgPool()
      await pool.query(
        `INSERT INTO public.lab_incidents (
          id, lab_id, schedule_id, date, session_label, subject_name, subject_teacher_name,
          batch_name, title, circumstances, photo_url, incident_type, severity,
          equipment_name, quantity, student_rolls, is_fined, fine_amount, fine_paid,
          fine_receipt_no, status, escalated_to_hod, escalation_reason, escalated_at,
          resolution_notes, resolved_by, resolved_at, reported_by, reported_by_id, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          severity = EXCLUDED.severity,
          status = EXCLUDED.status,
          photo_url = COALESCE(EXCLUDED.photo_url, public.lab_incidents.photo_url),
          escalated_to_hod = EXCLUDED.escalated_to_hod,
          resolution_notes = EXCLUDED.resolution_notes;`,
        [
          newRecord.id, newRecord.lab_id, newRecord.schedule_id || null, newRecord.date, newRecord.session_label,
          newRecord.subject_name, newRecord.subject_teacher_name, newRecord.batch_name, newRecord.title,
          newRecord.circumstances || null, newRecord.photo_url || null, newRecord.incident_type, newRecord.severity,
          newRecord.equipment_name, newRecord.quantity, newRecord.student_rolls || null, newRecord.is_fined || false,
          newRecord.fine_amount || null, newRecord.fine_paid || false, newRecord.fine_receipt_no || null,
          newRecord.status, newRecord.escalated_to_hod, newRecord.escalation_reason || null, newRecord.escalated_at || null,
          newRecord.resolution_notes || null, newRecord.resolved_by || null, newRecord.resolved_at || null,
          newRecord.reported_by, validReportedById, newRecord.created_at
        ]
      )

      // Clear prior notifications if any and insert fresh notifications for this incident
      await pool.query(`DELETE FROM public.lab_notifications WHERE incident_id = $1`, [recordId])
      for (const n of notifsToInsert) {
        await pool.query(
          `INSERT INTO public.lab_notifications (id, incident_id, target_role, target_lab_id, title, message, severity, is_read, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO NOTHING;`,
          [n.id, n.incident_id, n.target_role, n.target_lab_id, n.title, n.message, n.severity, n.is_read, n.created_at]
        )
      }
    } catch (pgErr) {
      console.warn('PostgreSQL pool incident/notification direct write error:', pgErr)
    }

    // 4. Dual-Write to Supabase client if configured (for realtime socket triggers)
    if (isSupabaseConfigured()) {
      try {
        const supabase = await createClient()
        await (supabase.from('lab_incidents') as any).upsert({
          ...newRecord,
          reported_by_id: validReportedById,
          resolved_by_id: validResolvedById,
        }, { onConflict: 'id' })
      } catch (err) {
        console.warn('Supabase incident insert fallback active:', err)
      }
    }

    // 4. Exhaustive cache revalidation across all related routes
    revalidatePath('/records/incidents')
    revalidatePath('/incidents')
    revalidatePath('/records')
    revalidatePath('/print/incidents')
    revalidatePath('/schedules')
    revalidatePath('/admin')
    revalidatePath('/')

    // Non-blocking background email dispatch with Next.js after()
    after(async () => {
      await dispatchIncidentEmailAlert(newRecord, false).catch((err) =>
        console.error('[Mailer] Background incident alert failed:', err)
      )
    })

    return { success: true, incident: newRecord }
  } catch (e: any) {
    return { success: false, error: e.message || 'Failed to report incident' }
  }
}

export async function escalateIncidentToHOD(id: string, reason: string): Promise<{ success: boolean; error?: string }> {
  try {
    const scope = await getServerUserScope()
    if (scope.isPending || scope.approvalStatus !== 'approved') {
      return { success: false, error: 'Unauthorized: Your account is pending institutional verification.' }
    }

    const store = getIncStore()
    const item = store.find((i) => i.id === id)
    if (!item) return { success: false, error: 'Incident record not found' }

    const now = new Date().toISOString()
    item.status = 'escalated_to_hod'
    item.escalated_to_hod = true
    item.escalation_reason = reason
    item.escalated_at = now

    // Create high-priority HOD and Admin notifications
    const notifStore = getNotifStore()
    const hodNotif: LabNotificationRecord = {
      id: `notif-${id}-hod-esc`,
      incident_id: id,
      target_role: 'hod',
      target_lab_id: item.lab_id,
      title: `⚡ HOD Escalation: ${item.equipment_name} Issue`,
      message: `Escalated for HOD Intervention: "${reason}". Session: ${item.session_label} (${item.batch_name}).`,
      severity: 'critical',
      is_read: false,
      created_at: now,
    }
    const adminNotif: LabNotificationRecord = {
      id: `notif-${id}-admin-esc`,
      incident_id: id,
      target_role: 'super_admin',
      target_lab_id: item.lab_id,
      title: `🚨 Incident Escalated to HOD: ${item.title}`,
      message: `Safety/Breakage escalated to HOD: "${reason}". Action required.`,
      severity: 'critical',
      is_read: false,
      created_at: now,
    }

    // Clean up any prior escalation notif
    for (let i = notifStore.length - 1; i >= 0; i--) {
      if (notifStore[i].id === hodNotif.id || notifStore[i].id === adminNotif.id) {
        notifStore.splice(i, 1)
      }
    }
    notifStore.unshift(hodNotif)
    notifStore.unshift(adminNotif)

    // Direct PostgreSQL write
    try {
      const pool = getPgPool()
      await pool.query(
        `UPDATE public.lab_incidents 
         SET status = 'escalated_to_hod', escalated_to_hod = true, escalation_reason = $1, escalated_at = $2
         WHERE id = $3;`,
        [reason, now, id]
      )
      await pool.query(`DELETE FROM public.lab_notifications WHERE id IN ($1, $2);`, [hodNotif.id, adminNotif.id])
      for (const n of [hodNotif, adminNotif]) {
        await pool.query(
          `INSERT INTO public.lab_notifications (id, incident_id, target_role, target_lab_id, title, message, severity, is_read, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO NOTHING;`,
          [n.id, n.incident_id, n.target_role, n.target_lab_id, n.title, n.message, n.severity, n.is_read, n.created_at]
        )
      }
    } catch (pgErr) {
      console.warn('PostgreSQL pool escalation direct write error:', pgErr)
    }

    revalidatePath('/records/incidents')
    revalidatePath('/incidents')
    revalidatePath('/records')
    revalidatePath('/print/incidents')
    revalidatePath('/admin')
    revalidatePath('/')

    // Non-blocking background email dispatch with Next.js after()
    after(async () => {
      await dispatchIncidentEmailAlert(item, true).catch((err) =>
        console.error('[Mailer] Background HOD escalation alert failed:', err)
      )
    })

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
    const scope = await getServerUserScope()
    if (scope.isPending || scope.approvalStatus !== 'approved') {
      return { success: false, error: 'Unauthorized: Your account is pending institutional verification.' }
    }

    const store = getIncStore()
    const idx = store.findIndex((i) => i.id === id)
    const now = new Date().toISOString()
    if (idx !== -1) {
      store[idx] = {
        ...store[idx],
        status: data.status,
        resolution_notes: data.resolution_notes || store[idx].resolution_notes,
        resolved_by: data.resolved_by,
        resolved_at: now,
        fine_paid: typeof data.fine_paid === 'boolean' ? data.fine_paid : store[idx].fine_paid,
        fine_receipt_no: data.fine_receipt_no || store[idx].fine_receipt_no,
      }
    }

    // Direct PostgreSQL write
    try {
      const pool = getPgPool()
      await pool.query(
        `UPDATE public.lab_incidents 
         SET status = $1, resolution_notes = $2, resolved_by = $3, resolved_at = $4, fine_paid = $5, fine_receipt_no = $6
         WHERE id = $7;`,
        [data.status, data.resolution_notes || null, data.resolved_by, now, data.fine_paid || false, data.fine_receipt_no || null, id]
      )

      // If resolved, mark related incident notifications as read
      if (data.status === 'resolved') {
        await pool.query(
          `UPDATE public.lab_notifications 
           SET is_read = true 
           WHERE incident_id = $1;`,
          [id]
        )
      }
    } catch (pgErr) {
      console.warn('PostgreSQL pool incident update error:', pgErr)
    }

    if (isSupabaseConfigured()) {
      try {
        const supabase = await createClient()
        await (supabase.from('lab_incidents') as any).update({
          status: data.status,
          resolution_notes: data.resolution_notes,
          resolved_by: data.resolved_by,
          resolved_at: now,
          fine_paid: data.fine_paid,
          fine_receipt_no: data.fine_receipt_no,
        }).eq('id', id)
      } catch (e) { }
    }

    revalidatePath('/records/incidents')
    revalidatePath('/incidents')
    revalidatePath('/records')
    revalidatePath('/print/incidents')
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

  // 1. Direct PostgreSQL pool query (fast connection pool)
  try {
    const pool = getPgPool()
    let query = `
      SELECT id, title, incident_type, equipment_name, lab_id, session_label,
             subject_name, subject_teacher_name, batch_name, date,
             circumstances, quantity, severity, status, resolution_notes,
             escalated_to_hod, fine_paid, photo_url, reported_by,
             reported_by_id, resolved_by_id, resolved_at, created_at
      FROM public.lab_incidents
      WHERE 1=1
    `
    const params: any[] = []
    let pIdx = 1

    if (filters?.lab_id && filters.lab_id !== 'all') {
      query += ` AND lab_id = $${pIdx++}`
      params.push(filters.lab_id)
    }
    if (filters?.status && filters.status !== 'all') {
      query += ` AND status = $${pIdx++}`
      params.push(filters.status)
    }
    if (filters?.severity && filters.severity !== 'all') {
      query += ` AND severity = $${pIdx++}`
      params.push(filters.severity)
    }
    if (filters?.date) {
      query += ` AND date = $${pIdx++}`
      params.push(filters.date)
    }
    if (shouldScopeToMyData) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(scope.userId || '')
      if (isUuid) {
        const uIdx = pIdx++
        const nIdx = pIdx++
        query += ` AND (reported_by_id = $${uIdx}::uuid OR subject_teacher_name = $${nIdx} OR reported_by = $${nIdx})`
        params.push(scope.userId)
        params.push(scope.fullName || '')
      } else {
        const nIdx = pIdx++
        query += ` AND (subject_teacher_name = $${nIdx} OR reported_by = $${nIdx})`
        params.push(scope.fullName || '')
      }
    }

    query += ` ORDER BY created_at DESC LIMIT 100`

    const { rows } = await pool.query(query, params)
    if (rows && rows.length > 0) {
      return rows.map((r) => ({
        ...r,
        created_at: typeof r.created_at === 'string' ? r.created_at : new Date(r.created_at).toISOString(),
        date: typeof r.date === 'string' ? r.date.split('T')[0] : r.date ? new Date(r.date).toISOString().split('T')[0] : '',
      }))
    }
  } catch (pgErr) {
    console.warn('getIncidents pg query fallback:', pgErr)
  }

  const store = getIncStore()
  let list = [...store]

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      let query = supabase.from('lab_incidents').select('*').order('created_at', { ascending: false })

      if (filters?.lab_id && filters.lab_id !== 'all') query = query.eq('lab_id', filters.lab_id)
      if (filters?.status && filters.status !== 'all') query = query.eq('status', filters.status as any)
      if (filters?.severity && filters.severity !== 'all') query = query.eq('severity', filters.severity as any)
      if (filters?.date) query = query.eq('date', filters.date)

      if (shouldScopeToMyData) {
        query = query.or(
          `reported_by_id.eq.${scope.userId},subject_teacher_name.eq.${scope.fullName},reported_by.eq.${scope.fullName}`
        )
      }

      const { data, error } = await query
      if (!error && data) {
        // Deduplicate before returning
        const seenIds = new Set<string>()
        const deduped: LabIncidentRecord[] = []
        for (const item of data) {
          if (item && item.id && !seenIds.has(item.id)) {
            seenIds.add(item.id)
            deduped.push(item as LabIncidentRecord)
          }
        }
        return deduped
      }
    } catch (e) { }
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

  // Deduplicate in-memory list
  const seenIds = new Set<string>()
  const finalDeduped: LabIncidentRecord[] = []
  for (const item of list) {
    if (item && item.id && !seenIds.has(item.id)) {
      seenIds.add(item.id)
      finalDeduped.push(item)
    }
  }

  return finalDeduped
}

export async function getNotifications(role?: 'super_admin' | 'lab_incharge' | 'hod' | 'teacher'): Promise<LabNotificationRecord[]> {
  try {
    let effectiveRole = role
    if (!effectiveRole) {
      try {
        const scope = await getServerUserScope()
        if (scope.role) effectiveRole = scope.role as any
      } catch { }
    }

    const pool = getPgPool()
    let query = `
      SELECT id, incident_id, target_role, target_lab_id, title, message, severity, is_read, metadata, created_at
      FROM public.lab_notifications
    `
    const params: any[] = []
    if (effectiveRole) {
      if (effectiveRole === 'super_admin') {
        query += ` WHERE target_role IN ('super_admin', 'all')`
      } else if (effectiveRole === 'lab_incharge') {
        query += ` WHERE target_role IN ('lab_incharge', 'all')`
      } else if (effectiveRole === 'hod') {
        query += ` WHERE target_role IN ('hod', 'all')`
      } else if (effectiveRole === 'teacher') {
        query += ` WHERE target_role IN ('teacher', 'all')`
      }
    }
    query += ` ORDER BY created_at DESC LIMIT 60;`

    const { rows } = await pool.query(query, params)
    if (rows && rows.length > 0) {
      const seen = new Set<string>()
      const deduped: LabNotificationRecord[] = []
      for (const row of rows) {
        if (row && row.id && !seen.has(row.id)) {
          seen.add(row.id)
          deduped.push({
            id: row.id,
            incident_id: row.incident_id,
            target_role: row.target_role,
            target_lab_id: row.target_lab_id,
            title: row.title,
            message: row.message,
            severity: row.severity,
            is_read: Boolean(row.is_read),
            metadata: row.metadata || null,
            created_at: typeof row.created_at === 'string' ? row.created_at : new Date(row.created_at).toISOString(),
          })
        }
      }
      return deduped
    }
  } catch (err) {
    console.warn('PostgreSQL pool notifications query error, falling back:', err)
  }

  // Graceful fallback to memory store
  const store = getNotifStore()
  let list = [...store]
  if (role) {
    if (role === 'super_admin') {
      list = list.filter((n) => n.target_role === 'super_admin' || n.target_role === 'all')
    } else if (role === 'lab_incharge') {
      list = list.filter((n) => n.target_role === 'lab_incharge' || n.target_role === 'all')
    } else if (role === 'hod') {
      list = list.filter((n) => n.target_role === 'hod' || n.target_role === 'all')
    } else if (role === 'teacher') {
      list = list.filter((n) => n.target_role === 'teacher' || n.target_role === 'all')
    }
  }

  const seen = new Set<string>()
  const finalDeduped: LabNotificationRecord[] = []
  for (const notif of list) {
    if (notif && notif.id && !seen.has(notif.id)) {
      seen.add(notif.id)
      finalDeduped.push(notif)
    }
  }

  return finalDeduped
}

export async function markNotificationRead(id: string): Promise<{ success: boolean }> {
  const store = getNotifStore()
  const idx = store.findIndex((n) => n.id === id)
  if (idx !== -1) store[idx].is_read = true

  try {
    const pool = getPgPool()
    await pool.query(`UPDATE public.lab_notifications SET is_read = true WHERE id = $1;`, [id])
  } catch (e) {
    console.warn('Error marking notification read in pg pool:', e)
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      await (supabase.from('lab_notifications') as any).update({ is_read: true }).eq('id', id)
    } catch (e) { }
  }

  return { success: true }
}

export async function markAllNotificationsRead(role?: string): Promise<{ success: boolean }> {
  let effectiveRole = role
  if (!effectiveRole) {
    try {
      const scope = await getServerUserScope()
      if (scope.role) effectiveRole = scope.role
    } catch { }
  }

  const store = getNotifStore()
  store.forEach((n) => {
    if (!effectiveRole || n.target_role === effectiveRole || n.target_role === 'all') {
      n.is_read = true
    }
  })

  try {
    const pool = getPgPool()
    if (effectiveRole) {
      await pool.query(
        `UPDATE public.lab_notifications SET is_read = true WHERE is_read = false AND (target_role = $1 OR target_role = 'all');`,
        [effectiveRole]
      )
    } else {
      await pool.query(
        `UPDATE public.lab_notifications SET is_read = true WHERE is_read = false AND target_role = 'all';`
      )
    }
  } catch (e) {
    console.warn('Error marking all notifications read in pg pool:', e)
  }

  return { success: true }
}

export async function clearReadNotifications(role?: string): Promise<{ success: boolean; count: number }> {
  try {
    const pool = getPgPool()
    let q = 'DELETE FROM public.lab_notifications WHERE is_read = true'
    const params: any[] = []
    if (role) {
      q += ' AND (target_role = $1 OR target_role = \'all\')'
      params.push(role)
    }
    const res = await pool.query(q, params)
    return { success: true, count: res.rowCount || 0 }
  } catch (e) {
    console.warn('Error clearing read notifications in pg pool:', e)
    return { success: false, count: 0 }
  }
}
