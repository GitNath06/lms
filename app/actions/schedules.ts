'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { recordAuditEvent } from '@/lib/audit'
import { getPgPool } from '@/lib/db'
import { MASTER_ROUTINE } from '@/lib/master-data'
import { parseSlotTimeRange } from '@/lib/utils'

type ScheduleInsert = Database['public']['Tables']['schedules']['Insert']
type LabRow = Database['public']['Tables']['labs']['Row']

const DEFAULT_LABS: LabRow[] = [
  { id: 'comp', name: 'Computer Lab 01', type: 'computer_lab', capacity: 40, status: 'Operational', is_active: true },
  { id: 'phys', name: 'Physics Laboratory', type: 'physics_lab', capacity: 38, status: 'Operational', is_active: true },
  { id: 'chem', name: 'Chemistry Laboratory', type: 'chemistry_lab', capacity: 40, status: 'Operational', is_active: true },
  { id: 'bio', name: 'Biology Laboratory', type: 'biology_lab', capacity: 35, status: 'Operational', is_active: true },
]

const SLOT_ORDER = ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10']

function getSlotRange(startSlotId: string, span: number = 1): { start: number; end: number } {
  const startIdx = SLOT_ORDER.indexOf(startSlotId)
  const safeStart = startIdx === -1 ? 0 : startIdx
  return {
    start: safeStart,
    end: safeStart + (span || 1) - 1,
  }
}

function rangesOverlap(r1: { start: number; end: number }, r2: { start: number; end: number }): boolean {
  return r1.start <= r2.end && r1.end >= r2.start
}

// 1. Fetch or Seed Labs
export async function getLabs(): Promise<LabRow[]> {
  if (!isSupabaseConfigured()) {
    return DEFAULT_LABS
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('labs')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (!error && data && data.length > 0) {
      return data as LabRow[]
    }

    return DEFAULT_LABS
  } catch (e) {
    return DEFAULT_LABS
  }
}

// 2. Fetch Schedules
export async function getSchedules(filters?: { dayKey?: string; labId?: string }) {
  if (!isSupabaseConfigured()) {
    return []
  }

  try {
    const supabase = await createClient()

    let query = supabase
      .from('schedules')
      .select(`
        *,
        labs (id, name, code, type),
        profiles (id, full_name)
      `)
      .order('start_time', { ascending: true })

    if (filters?.dayKey) {
      query = query.eq('day_key', filters.dayKey)
    }

    if (filters?.labId && filters.labId !== 'all') {
      query = query.eq('lab_id', filters.labId)
    }

    const { data, error } = await query

    if (error || !data || data.length === 0) {
      return []
    }

    return (data as any[]) || []
  } catch (e) {
    return []
  }
}

// 3. Create / Book a Schedule Slot with Conflict Checking
export async function createSchedule(data: {
  lab_id: string
  teacher_id?: string | null
  subject_name: string
  batch_name: string
  day_key: string
  slot_id: string
  span?: number
  start_time: string
  end_time: string
  metadata?: any
}) {
  if (!isSupabaseConfigured()) {
    revalidatePath('/schedules')
    revalidatePath('/')
    return { success: true }
  }

  try {
    const supabase = await createClient()

    // Validate target lab status server-side (blocking booking if Under Maintenance or Inactive)
    const { data: targetLab } = await (supabase
      .from('labs') as any)
      .select('id, name, status, is_active')
      .eq('id', data.lab_id)
      .maybeSingle()

    if (targetLab) {
      if (targetLab.status === 'Under Maintenance') {
        return {
          error: `Booking Rejected: "${targetLab.name || data.lab_id}" is currently Under Maintenance and cannot be booked for practical sessions.`,
        }
      }
      if (!targetLab.is_active || targetLab.status === 'Inactive') {
        return {
          error: `Booking Rejected: "${targetLab.name || data.lab_id}" is currently Inactive / Decommissioned.`,
        }
      }
    }

    const secondaryLabId = data.metadata?.secondary_lab_id || data.metadata?.secondaryLabKey
    if (secondaryLabId) {
      if (secondaryLabId === data.lab_id) {
        return {
          error: 'Booking Rejected: Primary and secondary laboratories cannot be the same facility.',
        }
      }
      const { data: secLab } = await (supabase
        .from('labs') as any)
        .select('id, name, status, is_active')
        .eq('id', secondaryLabId)
        .maybeSingle()

      if (secLab) {
        if (secLab.status === 'Under Maintenance') {
          return {
            error: `Booking Rejected: Secondary laboratory "${secLab.name || secondaryLabId}" is currently Under Maintenance and cannot be booked for practical sessions.`,
          }
        }
        if (!secLab.is_active || secLab.status === 'Inactive') {
          return {
            error: `Booking Rejected: Secondary laboratory "${secLab.name || secondaryLabId}" is currently Inactive / Decommissioned.`,
          }
        }
      }
    }

    // 3-Way Multi-Period Span Conflict Detection (Room, Teacher, Batch)
    const targetRange = getSlotRange(data.slot_id, data.span || 1)

    const { data: daySchedules } = await supabase
      .from('schedules')
      .select('id, lab_id, teacher_id, subject_name, batch_name, slot_id, span, metadata')
      .eq('day_key', data.day_key)
      .neq('status', 'cancelled')

    const activeDaySchedules = (daySchedules as any[]) || []
    for (const existing of activeDaySchedules) {
      const existRange = getSlotRange(existing.slot_id || 't1', existing.span || 1)
      if (rangesOverlap(targetRange, existRange)) {
        const existSecLabId = existing.metadata?.secondary_lab_id || existing.metadata?.secondaryLabKey
        // 1. Room / Facility Collision (Primary or Secondary lab)
        const primaryCollides = existing.lab_id === data.lab_id || existSecLabId === data.lab_id
        const secondaryCollides = secondaryLabId && (existing.lab_id === secondaryLabId || existSecLabId === secondaryLabId)
        if (primaryCollides || secondaryCollides) {
          const conflictingLab = primaryCollides ? data.lab_id : secondaryLabId
          return {
            error: `Facility Collision: Laboratory (${conflictingLab}) is already reserved for "${existing.subject_name}" (${existing.batch_name}) during Period ${existing.slot_id?.toUpperCase() || ''}.`,
          }
        }
        // 2. Faculty / Teacher Collision
        const sameTeacherId = data.teacher_id && existing.teacher_id && data.teacher_id === existing.teacher_id
        const reqTeacherName = data.metadata?.teacher?.trim()?.toLowerCase()
        const existTeacherName = existing.metadata?.teacher?.trim()?.toLowerCase()
        const sameTeacherName = reqTeacherName && existTeacherName && reqTeacherName === existTeacherName
        if (sameTeacherId || sameTeacherName) {
          return {
            error: `Faculty Collision: ${data.metadata?.teacher || 'The assigned teacher'} is already conducting "${existing.subject_name}" in another laboratory during this period.`,
          }
        }
        // 3. Student Class Batch Collision
        const reqBatch = data.batch_name?.trim()?.toLowerCase()
        const existBatch = existing.batch_name?.trim()?.toLowerCase()
        if (reqBatch && existBatch && (reqBatch === existBatch || reqBatch.includes(existBatch) || existBatch.includes(reqBatch))) {
          return {
            error: `Class Batch Collision: Student group "${data.batch_name}" is already scheduled for "${existing.subject_name}" in another lab during this period.`,
          }
        }
      }
    }

    const scheduleStatus = data.metadata?.status || (data as any).status || 'scheduled'

    const payload: ScheduleInsert = {
      lab_id: data.lab_id,
      teacher_id: data.teacher_id || null,
      subject_name: data.subject_name,
      batch_name: data.batch_name,
      day_key: data.day_key,
      slot_id: data.slot_id,
      span: data.span || 1,
      start_time: data.start_time,
      end_time: data.end_time,
      is_merged: (data.span || 1) > 1,
      status: scheduleStatus,
      metadata: data.metadata || null,
    }

    const { data: newSchedule, error } = await (supabase
      .from('schedules') as any)
      .insert(payload)
      .select()
      .single()

    if (error) {
      return { error: error.message }
    }

    // If a teacher submits a slot request, notify Super Admin & Lab Incharge
    if (scheduleStatus === 'requested') {
      const teacherName = data.metadata?.teacher || 'Subject Teacher'
      const notifId1 = `notif-slot-req-${Date.now()}-admin`
      const notifId2 = `notif-slot-req-${Date.now()}-incharge`
      try {
        await supabase.from('lab_notifications').insert([
          {
            id: notifId1,
            target_role: 'super_admin',
            title: `Slot Booking Request: ${teacherName}`,
            message: `${teacherName} has requested a practical session for "${data.subject_name}" (${data.batch_name}) on ${data.day_key.toUpperCase()} Period ${data.slot_id.toUpperCase()}.`,
            severity: 'info',
            is_read: false,
          },
          {
            id: notifId2,
            target_role: 'lab_incharge',
            title: `Slot Booking Request: ${teacherName}`,
            message: `${teacherName} has requested a practical session for "${data.subject_name}" (${data.batch_name}) on ${data.day_key.toUpperCase()} Period ${data.slot_id.toUpperCase()}.`,
            severity: 'info',
            is_read: false,
          },
        ] as any)
      } catch {}
    }

    revalidatePath('/schedules')
    revalidatePath('/')

    await recordAuditEvent({
      action: 'CREATE',
      entityType: 'schedule',
      entityId: newSchedule?.id || data.slot_id,
      entityLabel: `${data.subject_name} (${data.batch_name}) • ${data.day_key.toUpperCase()} ${data.slot_id.toUpperCase()}`,
      after: {
        lab_id: data.lab_id,
        teacher_id: data.teacher_id,
        subject_name: data.subject_name,
        batch_name: data.batch_name,
        day_key: data.day_key,
        slot_id: data.slot_id,
        start_time: data.start_time,
        end_time: data.end_time,
        is_multi_lab: Boolean(data.metadata?.is_multi_lab || data.metadata?.secondary_lab_id),
        secondary_lab_id: data.metadata?.secondary_lab_id || null,
      },
      metadata: { operation: 'create_schedule_slot' },
    })

    return { success: true, schedule: newSchedule }
  } catch (e) {
    return { success: true }
  }
}

// 4. Merge Consecutive Schedules
export async function mergeSchedules(
  scheduleId: string,
  nextScheduleId?: string,
  mergedData?: {
    subject_name?: string
    batch_name?: string
    teacher_id?: string
  }
) {
  if (!isSupabaseConfigured()) {
    revalidatePath('/schedules')
    revalidatePath('/')
    return { success: true }
  }

  try {
    const supabase = await createClient()

    const { data: primary } = await supabase
      .from('schedules')
      .select('*')
      .eq('id', scheduleId)
      .single()

    if (!primary) {
      return { error: 'Primary schedule not found' }
    }

    const primaryObj = primary as any

    if (nextScheduleId) {
      const { data: secondary } = await supabase
        .from('schedules')
        .select('*')
        .eq('id', nextScheduleId)
        .single()

      if (secondary) {
        const secondaryObj = secondary as any
        const combinedSpan = (primaryObj.span || 1) + (secondaryObj.span || 1)

        // Update primary schedule to merged state
        const { error: updateError } = await (supabase
          .from('schedules') as any)
          .update({
            is_merged: true,
            span: combinedSpan,
            subject_name: mergedData?.subject_name || `${primaryObj.subject_name} + ${secondaryObj.subject_name}`,
            batch_name: mergedData?.batch_name || primaryObj.batch_name,
            teacher_id: mergedData?.teacher_id || primaryObj.teacher_id,
            metadata: {
              merged_with: secondaryObj.id,
              original_parts: [primaryObj, secondaryObj],
            },
          })
          .eq('id', scheduleId)

        if (updateError) return { error: updateError.message }

        // Delete/archive secondary slot
        await supabase.from('schedules').delete().eq('id', nextScheduleId)

        await recordAuditEvent({
          action: 'UPDATE',
          entityType: 'schedule',
          entityId: scheduleId,
          entityLabel: `Merged Slot: ${mergedData?.subject_name || primaryObj.subject_name}`,
          before: {
            is_merged: false,
            span: primaryObj.span || 1,
            subject_name: primaryObj.subject_name,
          },
          after: {
            is_merged: true,
            span: combinedSpan,
            subject_name: mergedData?.subject_name || `${primaryObj.subject_name} + ${secondaryObj.subject_name}`,
          },
          metadata: { operation: 'merge_schedules', nextScheduleId },
        })
      }
    } else {
      // Extend single slot
      const newSpan = (primaryObj.span || 1) + 1
      await (supabase
        .from('schedules') as any)
        .update({
          is_merged: true,
          span: newSpan,
        })
        .eq('id', scheduleId)

      await recordAuditEvent({
        action: 'UPDATE',
        entityType: 'schedule',
        entityId: scheduleId,
        entityLabel: `Extended Duration: ${primaryObj.subject_name}`,
        before: { span: primaryObj.span || 1 },
        after: { span: newSpan },
        metadata: { operation: 'extend_schedule_span' },
      })
    }

    revalidatePath('/schedules')
    revalidatePath('/')
    return { success: true }
  } catch (e) {
    return { success: true }
  }
}

// 5. Unmerge / Split Session
export async function unmergeSchedule(scheduleId: string) {
  if (!isSupabaseConfigured()) {
    revalidatePath('/schedules')
    revalidatePath('/')
    return { success: true }
  }

  try {
    const supabase = await createClient()

    const { data: schedule } = await supabase
      .from('schedules')
      .select('*')
      .eq('id', scheduleId)
      .single()

    if (!schedule) return { error: 'Schedule not found' }

    await (supabase
      .from('schedules') as any)
      .update({
        is_merged: false,
        span: 1,
      })
      .eq('id', scheduleId)

    await recordAuditEvent({
      action: 'UPDATE',
      entityType: 'schedule',
      entityId: scheduleId,
      entityLabel: `Split / Unmerged: ${(schedule as any).subject_name}`,
      before: { is_merged: true, span: (schedule as any).span || 2 },
      after: { is_merged: false, span: 1 },
      metadata: { operation: 'unmerge_schedule' },
    })

    revalidatePath('/schedules')
    revalidatePath('/')
    return { success: true }
  } catch (e) {
    return { success: true }
  }
}

// 6. Delete / Cancel Schedule
export async function deleteSchedule(scheduleId: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    revalidatePath('/schedules')
    revalidatePath('/admin')
    revalidatePath('/')
    return { success: true }
  }

  try {
    const supabase = await createClient()

    // 1. Fetch pre-state for audit record
    const { data: beforeData } = await (supabase.from('schedules') as any)
      .select('*')
      .eq('id', scheduleId)
      .maybeSingle()

    // 2. Perform DB deletion
    const { error, count } = await (supabase.from('schedules') as any)
      .delete({ count: 'exact' })
      .eq('id', scheduleId)

    if (error) {
      console.error('[DATABASE ERROR] Delete schedule failed:', error)
      return { success: false, error: error.message }
    }

    if (count === 0) {
      console.warn('[DATABASE WARNING] No row was deleted from public.schedules for ID:', scheduleId)
    }

    revalidatePath('/schedules')
    revalidatePath('/admin')
    revalidatePath('/')

    // 3. Record DELETE audit event
    await recordAuditEvent({
      action: 'DELETE',
      entityType: 'schedule',
      entityId: scheduleId,
      entityLabel: beforeData?.subject_name
        ? `${beforeData.subject_name} • ${(beforeData.day_key || '').toUpperCase()}`
        : `Timetable Slot #${scheduleId}`,
      before: beforeData || { schedule_id: scheduleId },
      metadata: { operation: 'delete_schedule_slot' },
    })

    return { success: true }
  } catch (e: any) {
    console.error('[DATABASE ERROR] Delete schedule exception:', e)
    return { success: false, error: e?.message || 'Failed to delete schedule' }
  }
}

// 6b. Reset Schedules to Authoritative Master Routine
export async function resetSchedulesToMaster(): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const pool = getPgPool()
    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      // Ensure all 5 standard labs exist in public.labs
      const standardLabs = [
        { id: 'comp', name: 'Computer Engineering Lab 01', code: 'LAB-COMP-01', type: 'computer_lab', capacity: 40 },
        { id: 'phys', name: 'Physics Laboratory', code: 'LAB-PHYS-01', type: 'physics_lab', capacity: 38 },
        { id: 'chem', name: 'Chemistry Laboratory', code: 'LAB-CHEM-01', type: 'chemistry_lab', capacity: 40 },
        { id: 'bio', name: 'Biology & Life Sciences Lab', code: 'LAB-BIO-01', type: 'biology_lab', capacity: 35 },
        { id: 'elec', name: 'Electronics & Hardware Lab', code: 'LAB-ELEC-01', type: 'electronics_lab', capacity: 30 },
      ]
      for (const lab of standardLabs) {
        await client.query(`
          INSERT INTO public.labs (id, name, code, type, capacity, status, is_active)
          VALUES ($1, $2, $3, $4, $5, 'Operational', true)
          ON CONFLICT (id) DO NOTHING;
        `, [lab.id, lab.name, lab.code, lab.type, lab.capacity])
      }

      // Clear existing schedules table
      await client.query('DELETE FROM public.schedules;')

      // Re-seed all items from MASTER_ROUTINE
      for (const item of MASTER_ROUTINE) {
        const { startTime, endTime } = parseSlotTimeRange(item.timeSlot)
        const labId =
          item.labKey === 'comp'
            ? 'comp'
            : item.labKey === 'phys'
            ? 'phys'
            : item.labKey === 'chem'
            ? 'chem'
            : item.labKey === 'bio'
            ? 'bio'
            : 'elec'

        const subjectName = `${item.subjectCode} - ${item.subjectTitle}`
        const batchName = item.grade || 'Class 12'
        const span = item.span || 1
        const isMerged = Boolean(item.mergedParts && item.mergedParts.length > 0)
        const status = item.status || 'scheduled'
        const metadata = {
          teacher: item.teacher,
          labName: item.lab,
          studentsCount: item.defaultStudents,
          category: item.category,
          dotColor: item.dotColor,
          badgeColor: item.badgeColor,
          accentColor: item.accentColor,
          secondaryLab: item.secondaryLab,
          secondaryLabKey: item.secondaryLabKey,
          isDualLab: item.isDualLab,
          coTeacher: item.coTeacher,
          mergedParts: item.mergedParts,
        }

        await client.query(`
          INSERT INTO public.schedules (
            id, lab_id, subject_name, batch_name, start_time, end_time, slot_id, day_key, span, is_merged, status, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);
        `, [
          item.id,
          labId,
          subjectName,
          batchName,
          startTime,
          endTime,
          item.slotId,
          item.dayKey,
          span,
          isMerged,
          status,
          JSON.stringify(metadata),
        ])
      }

      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    await recordAuditEvent({
      action: 'UPDATE',
      entityType: 'policy',
      entityId: 'master_routine_reset',
      entityLabel: 'Master Timetable Schedule Reset',
      before: { status: 'custom_modified' },
      after: { status: 'restored_to_master_baseline', total_routines: MASTER_ROUTINE.length },
      metadata: { operation: 'reset_schedules_to_master' },
    })

    revalidatePath('/schedules')
    revalidatePath('/admin')
    revalidatePath('/')

    return { success: true, count: MASTER_ROUTINE.length }
  } catch (err: any) {
    console.error('[DATABASE ERROR] Reset schedules to master failed:', err)
    return { success: false, error: err?.message || 'Failed to reset schedules.' }
  }
}

/**
 * Update an existing scheduled slot in PostgreSQL.
 * Fetches pre-state, applies changes, and records UPDATE audit event with structured diff.
 */
export async function updateSchedule(
  scheduleId: string,
  data: {
    lab_id?: string
    teacher_id?: string | null
    subject_name?: string
    batch_name?: string
    day_key?: string
    slot_id?: string
    span?: number
    start_time?: string
    end_time?: string
    status?: 'confirmed' | 'requested' | 'skipped' | 'scheduled'
    metadata?: any
  }
): Promise<{ success: boolean; schedule?: any; error?: string }> {
  if (!isSupabaseConfigured()) {
    revalidatePath('/schedules')
    revalidatePath('/')
    return { success: true }
  }

  try {
    const supabase = await createClient()

    // 1. Fetch before state
    const { data: beforeSchedule } = await (supabase
      .from('schedules') as any)
      .select('*')
      .eq('id', scheduleId)
      .maybeSingle()

    // 2. Perform DB update
    const updatePayload: any = {}
    if (data.lab_id !== undefined) updatePayload.lab_id = data.lab_id
    if (data.teacher_id !== undefined) updatePayload.teacher_id = data.teacher_id
    if (data.subject_name !== undefined) updatePayload.subject_name = data.subject_name
    if (data.batch_name !== undefined) updatePayload.batch_name = data.batch_name
    if (data.day_key !== undefined) updatePayload.day_key = data.day_key
    if (data.slot_id !== undefined) updatePayload.slot_id = data.slot_id
    if (data.span !== undefined) updatePayload.span = data.span
    if (data.start_time !== undefined) updatePayload.start_time = data.start_time
    if (data.end_time !== undefined) updatePayload.end_time = data.end_time
    if (data.status !== undefined) updatePayload.status = data.status
    if (data.metadata !== undefined) updatePayload.metadata = data.metadata

    let { data: updatedSchedule, error } = await (supabase
      .from('schedules') as any)
      .update(updatePayload)
      .eq('id', scheduleId)
      .select()
      .maybeSingle()

    // 🛡️ Fallback: If slot was a default preset not yet saved to PostgreSQL, upsert it!
    if (!beforeSchedule && !updatedSchedule && !error) {
      const upsertPayload = {
        id: scheduleId,
        lab_id: data.lab_id || 'comp',
        teacher_id: data.teacher_id || null,
        subject_name: data.subject_name || 'Practical Session',
        batch_name: data.batch_name || 'Class 12',
        day_key: data.day_key || 'sun',
        slot_id: data.slot_id || 't1',
        span: data.span || 1,
        start_time: data.start_time || '10:10',
        end_time: data.end_time || '11:00',
        status: data.status || 'scheduled',
        metadata: data.metadata || {},
      }
      const upsertRes = await (supabase
        .from('schedules') as any)
        .upsert(upsertPayload)
        .select()
        .maybeSingle()

      if (!upsertRes.error && upsertRes.data) {
        updatedSchedule = upsertRes.data
      }
    }

    if (error) {
      console.error('[LMR] Error updating schedule:', error)
      return { success: false, error: error.message }
    }

    const safeBefore = beforeSchedule || {
      id: scheduleId,
      subject_name: data.subject_name ? 'Default Timetable Slot' : 'Practical Session',
      slot_id: data.slot_id || 't1',
      day_key: data.day_key || 'sun',
    }
    const safeAfter = updatedSchedule || {
      ...safeBefore,
      ...updatePayload,
    }

    // 3. Record UPDATE audit event with structured diff
    await recordAuditEvent({
      action: 'UPDATE',
      entityType: 'schedule',
      entityId: scheduleId,
      entityLabel: `${data.subject_name || safeBefore?.subject_name || 'Timetable Slot'} • ${(data.day_key || safeBefore?.day_key || '').toUpperCase()}`,
      before: safeBefore,
      after: safeAfter,
      metadata: { operation: 'update_schedule_slot' },
    })

    revalidatePath('/schedules')
    revalidatePath('/')
    return { success: true, schedule: updatedSchedule }
  } catch (e: any) {
    console.error('Failed to update schedule:', e)
    return { success: false, error: e?.message || 'Failed to update schedule' }
  }
}

// 7. Update Schedule Status (e.g. 'confirmed', 'requested', 'skipped', with decline reason)
export async function updateScheduleStatus(scheduleId: string, data: {
  status: 'confirmed' | 'requested' | 'skipped' | 'scheduled'
  is_skipped?: boolean
  skipped_reason?: string
  skipped_by?: string
  decline_reason?: string
}) {
  if (!isSupabaseConfigured()) {
    revalidatePath('/schedules')
    revalidatePath('/')
    return { success: true }
  }

  try {
    const supabase = await createClient()

    const { data: existing } = await (supabase.from('schedules') as any)
      .select('*')
      .eq('id', scheduleId)
      .single()

    const currentMeta = (existing as any)?.metadata || {}
    const updatedMeta = {
      ...currentMeta,
      is_skipped: data.is_skipped ?? (data.status === 'skipped'),
      skipped_reason: data.skipped_reason || currentMeta.skipped_reason,
      skipped_by: data.skipped_by || currentMeta.skipped_by,
      decline_reason: data.decline_reason || currentMeta.decline_reason,
    }

    const { error } = await (supabase.from('schedules') as any)
      .update({
        status: data.status,
        metadata: updatedMeta,
      })
      .eq('id', scheduleId)

    if (error) return { error: error.message }

    const subjectName = (existing as any)?.subject_name || 'Practical Session'

    // Record UPDATE audit event for status change
    await recordAuditEvent({
      action: 'UPDATE',
      entityType: 'schedule',
      entityId: scheduleId,
      entityLabel: `${subjectName} (${data.status.toUpperCase()})`,
      before: {
        status: (existing as any)?.status || 'scheduled',
        is_skipped: currentMeta.is_skipped || false,
      },
      after: {
        status: data.status,
        is_skipped: updatedMeta.is_skipped,
        ...(data.skipped_reason ? { skipped_reason: data.skipped_reason } : {}),
        ...(data.decline_reason ? { decline_reason: data.decline_reason } : {}),
      },
      metadata: { operation: 'update_schedule_status' },
    })

    // If declined with reason, notify the teacher
    if (data.status === 'skipped' && data.decline_reason && currentMeta.teacher) {
      const notifId = `notif-slot-dec-${Date.now()}`
      try {
        await supabase.from('lab_notifications').insert([
          {
            id: notifId,
            target_role: 'teacher',
            title: `Slot Request Declined: ${subjectName}`,
            message: `Your booking request was declined. Reason: "${data.decline_reason}"`,
            severity: 'warning',
            is_read: false,
          },
        ] as any)
      } catch {}
    }

    // If approved, notify the teacher
    if (data.status === 'confirmed' && currentMeta.teacher) {
      const notifId = `notif-slot-app-${Date.now()}`
      try {
        await supabase.from('lab_notifications').insert([
          {
            id: notifId,
            target_role: 'teacher',
            title: `Slot Request Approved: ${subjectName}`,
            message: `Your booking request for ${subjectName} has been approved and confirmed.`,
            severity: 'info',
            is_read: false,
          },
        ] as any)
      } catch {}
    }

    revalidatePath('/schedules')
    revalidatePath('/')
    return { success: true }
  } catch (e: any) {
    return { error: e.message || 'Failed to update schedule status' }
  }
}
