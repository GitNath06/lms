'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { recordAuditEvent } from '@/lib/audit'
import { getPgPool } from '@/lib/db'
import { getServerUserScope } from '@/lib/context/server-user-scope'
import { computeCombinedTimeRange } from '@/lib/master-data'
import { parseSlotTimeRange, sortSessionsChronologically } from '@/lib/utils'
import { getSlotRange, slotRangesOverlap as rangesOverlap } from '@/lib/scheduling/conflict-engine'

function cleanMergedSubjectName(name?: string, fallbackPrimary?: string, fallbackSecondary?: string): string {
  if (name) {
    const trimmed = name.trim()
    const parts = trimmed.split(/\s*(?:&|\+)\s*/).map((p) => p.trim()).filter(Boolean)
    if (parts.length > 1 && new Set(parts).size === 1) {
      return parts[0]
    }
    return trimmed
  }
  if (fallbackPrimary && fallbackSecondary) {
    if (fallbackPrimary.trim() === fallbackSecondary.trim()) {
      return fallbackPrimary.trim()
    }
    return `${fallbackPrimary.trim()} & ${fallbackSecondary.trim()}`
  }
  return fallbackPrimary || ''
}

type ScheduleInsert = Database['public']['Tables']['schedules']['Insert']
type LabRow = Database['public']['Tables']['labs']['Row']

// 1. Fetch Active Labs
export async function getLabs(): Promise<LabRow[]> {
  try {
    const pool = getPgPool()
    const res = await pool.query(`
      SELECT id, name, code, capacity, type, status, is_active
      FROM public.labs
      WHERE is_active = true
      ORDER BY name ASC;
    `)
    return (res.rows as LabRow[]) || []
  } catch (e) {
    console.error('Failed to get labs:', e)
    return []
  }
}

// 2. Fetch Schedules with Dynamic Teacher Inheritance
export async function getSchedules(filters?: { dayKey?: string; labId?: string }) {
  try {
    const pool = getPgPool()
    let query = `
      SELECT 
        s.*,
        s.specific_date::text as specific_date,
        json_build_object('id', l.id, 'name', l.name, 'code', l.code, 'type', l.type) as labs,
        CASE 
          WHEN COALESCE(sp.id, csp.id) IS NOT NULL THEN
            json_build_object('id', COALESCE(sp.id, csp.id), 'full_name', COALESCE(sp.full_name, csp.full_name))
          ELSE NULL 
        END as profiles,
        COALESCE(sp.id, csp.id) as resolved_teacher_id,
        COALESCE(sp.full_name, csp.full_name) as teacher_name
      FROM public.schedules s
      LEFT JOIN public.labs l ON l.id = s.lab_id
      LEFT JOIN public.profiles sp ON sp.id = s.teacher_id
      LEFT JOIN public.class_subjects cs ON cs.id = s.class_subject_id
      LEFT JOIN public.profiles csp ON csp.id = cs.teacher_id
      WHERE 1=1
    `
    const params: any[] = []

    if (filters?.dayKey) {
      params.push(filters.dayKey)
      query += ` AND s.day_key = $${params.length}`
    }

    if (filters?.labId && filters.labId !== 'all') {
      params.push(filters.labId)
      query += ` AND (s.lab_id = $${params.length} OR s.metadata->>'secondary_lab_id' = $${params.length} OR s.metadata->>'secondaryLabKey' = $${params.length})`
    }

    query += ` ORDER BY s.start_time ASC;`

    const res = await pool.query(query, params)
    return sortSessionsChronologically((res.rows as any[]) || [])
  } catch (e) {
    console.error('Failed to get schedules:', e)
    return []
  }
}

// 3. Create / Book a Schedule Slot with Conflict Checking
export async function createSchedule(data: {
  id?: string
  lab_id: string
  teacher_id?: string | null
  subject_name: string
  batch_name: string
  day_key: string
  slot_id: string
  span?: number
  start_time: string
  end_time: string
  status?: string
  class_subject_id?: string | null
  academic_year_id?: string | null
  specific_date?: string | null
  metadata?: any
}) {
  const userScope = await getServerUserScope()
  if (userScope.approvalStatus !== 'approved') {
    return { error: 'Permission denied: Your account is pending verification and not approved for scheduling operations.' }
  }

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

    // Resolve class_subject_id and dual-write display snapshots
    let resolvedClassSubjectId = data.class_subject_id || null
    let targetClassId: string | null = null
    let resolvedAcademicYearId = data.academic_year_id || null
    let displaySubjectName = data.subject_name
    let displayBatchName = data.batch_name
    let resolvedTeacherId = userScope.role === 'teacher' ? userScope.userId : (data.teacher_id || null)

    if (resolvedClassSubjectId) {
      const { data: cs } = await supabase
        .from('class_subjects')
        .select(`
          id, class_id, subject_id, teacher_id, academic_year_id,
          classes:class_id ( id, name ),
          subjects:subject_id ( id, code, name )
        `)
        .eq('id', resolvedClassSubjectId)
        .maybeSingle()

      if (cs) {
        targetClassId = (cs as any).class_id
        resolvedAcademicYearId = (cs as any).academic_year_id
        if (!resolvedTeacherId && userScope.role !== 'teacher') resolvedTeacherId = (cs as any).teacher_id
        const sub = (cs as any).subjects
        const cls = (cs as any).classes
        if (sub?.code && sub?.name) {
          displaySubjectName = `${sub.code} - ${sub.name}`
        }
        if (cls?.name) {
          displayBatchName = cls.name
        }
      }
    } else {
      // Look up candidate class_subjects with strict relational matching (NO loose grade fuzzy-matching)
      if (!resolvedAcademicYearId) {
        const { data: currYear } = await supabase
          .from('academic_years')
          .select('id')
          .eq('is_current', true)
          .maybeSingle()
        resolvedAcademicYearId = currYear?.id || null
      }

      const norm = (s?: string | null) => (s ? s.trim().toLowerCase() : '')
      let csQuery = (supabase.from('class_subjects') as any)
        .select(`
          id, class_id, subject_id, teacher_id, academic_year_id,
          classes:class_id ( id, name, grade ),
          subjects:subject_id ( id, code, name )
        `)

      if (resolvedAcademicYearId) {
        csQuery = csQuery.eq('academic_year_id', resolvedAcademicYearId)
      }

      const { data: csList } = await csQuery

      if (csList && csList.length > 0) {
        const normBatch = norm(data.batch_name)
        const normSub = norm(data.subject_name)
        const cleanBatch = normBatch.replace(/[^a-z0-9]/g, '')
        const cleanSub = normSub.replace(/[^a-z0-9]/g, '')

        const matched = (csList as any[]).find((cs) => {
          const clsName = norm(cs.classes?.name)
          const clsId = norm(cs.class_id)
          const subCode = norm(cs.subjects?.code)
          const subName = norm(cs.subjects?.name)
          const cleanClsName = clsName.replace(/[^a-z0-9]/g, '')
          const cleanClsId = clsId.replace(/[^a-z0-9]/g, '')
          const cleanSubCode = subCode.replace(/[^a-z0-9]/g, '')

          // Strict alphanumeric class equality or exact prefix match (never match across sections/streams)
          const classMatch =
            normBatch === clsName ||
            normBatch === clsId ||
            (cleanBatch.length > 0 && cleanBatch === cleanClsName) ||
            (cleanBatch.length > 0 && cleanBatch === cleanClsId) ||
            (cleanClsName.length > 1 && cleanBatch.startsWith(cleanClsName))

          // Subject code or full subject title match
          const subjectMatch =
            (cleanSubCode.length > 0 && cleanSub.includes(cleanSubCode)) ||
            (subName.length > 0 && normSub.includes(subName))

          return classMatch && subjectMatch
        })

        if (matched) {
          resolvedClassSubjectId = matched.id
          targetClassId = matched.class_id
          resolvedAcademicYearId = matched.academic_year_id
          if (!resolvedTeacherId && userScope.role !== 'teacher') resolvedTeacherId = matched.teacher_id
          const sub = matched.subjects
          const cls = matched.classes
          if (sub?.code && sub?.name) {
            displaySubjectName = `${sub.code} - ${sub.name}`
          }
          if (cls?.name && !displayBatchName) {
            displayBatchName = cls.name
          }
        } else {
          resolvedClassSubjectId = null
          const { data: clsMatch } = await supabase
            .from('classes')
            .select('id, name')
            .or(`id.ilike.${data.batch_name},name.ilike.${data.batch_name}`)
            .limit(1)
            .maybeSingle()
          if (clsMatch) {
            targetClassId = clsMatch.id
            if (!displayBatchName) displayBatchName = clsMatch.name
          }
        }
      }
    }

    if (!resolvedClassSubjectId && targetClassId) {
      const { data: fallbackCs } = await supabase
        .from('class_subjects')
        .select('id, academic_year_id')
        .eq('class_id', targetClassId)
        .limit(1)
        .maybeSingle()
      if (fallbackCs) {
        resolvedClassSubjectId = fallbackCs.id
        if (!resolvedAcademicYearId) resolvedAcademicYearId = fallbackCs.academic_year_id || null
      }
    }

    // Safety lock: If user is a teacher, ensure teacher_id strictly matches the authenticated teacher ID
    if (userScope.role === 'teacher') {
      resolvedTeacherId = userScope.userId
    }

    // 3-Way Multi-Period Span Conflict Detection (Room, Teacher, Cohort)
    const targetRange = getSlotRange(data.slot_id, data.span || 1)

    const { data: daySchedules } = await supabase
      .from('schedules')
      .select('id, lab_id, teacher_id, subject_name, batch_name, slot_id, span, metadata, specific_date, class_subject_id, class_subjects(class_id)')
      .eq('day_key', data.day_key)
      .neq('status', 'cancelled')

    const activeDaySchedules = (daySchedules as any[]) || []
    for (const existing of activeDaySchedules) {
      if (data.id && existing.id === data.id) {
        continue;
      }
      if (existing.status === 'skipped' || existing.metadata?.status === 'rejected' || existing.metadata?.is_skipped) {
        continue;
      }
      if (existing.specific_date && data.specific_date) {
        const existDateStr = String(existing.specific_date).split('T')[0];
        const reqDateStr = String(data.specific_date).split('T')[0];
        if (existDateStr !== reqDateStr) {
          continue; // Different calendar dates do not collide
        }
      }
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
        const sameTeacherId = resolvedTeacherId && existing.teacher_id && resolvedTeacherId === existing.teacher_id
        const reqTeacherName = data.metadata?.teacher?.trim()?.toLowerCase()
        const existTeacherName = existing.metadata?.teacher?.trim()?.toLowerCase()
        const sameTeacherName = reqTeacherName && existTeacherName && reqTeacherName === existTeacherName
        if (sameTeacherId || sameTeacherName) {
          return {
            error: `Faculty Collision: ${data.metadata?.teacher || 'The assigned teacher'} is already conducting "${existing.subject_name}" in another laboratory during this period.`,
          }
        }
        // 3. Student Class Batch Collision (Exact Cohort Comparison - No Substring False Positives)
        const existClassId = (existing.class_subjects as any)?.class_id
        if (targetClassId && existClassId && targetClassId === existClassId) {
          return {
            error: `Class Batch Collision: Student cohort "${displayBatchName || data.batch_name}" is already scheduled for "${existing.subject_name}" in another lab during this period.`,
          }
        } else if (!targetClassId || !existClassId) {
          const reqBatch = (displayBatchName || data.batch_name)?.trim()?.toLowerCase()
          const existBatch = existing.batch_name?.trim()?.toLowerCase()
          if (reqBatch && existBatch && reqBatch === existBatch) {
            return {
              error: `Class Batch Collision: Student group "${data.batch_name}" is already scheduled for "${existing.subject_name}" in another lab during this period.`,
            }
          }
        }
      }
    }

    const VALID_PG_SESSION_STATUSES = new Set(['scheduled', 'in_progress', 'completed', 'cancelled'])
    const rawPgStatus = (data as any).status
    const pgStatus: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' =
      VALID_PG_SESSION_STATUSES.has(rawPgStatus) ? rawPgStatus : 'scheduled'

    const uiStatus = data.metadata?.status || ((data as any).status === 'requested' ? 'requested' : 'confirmed')

    const effectiveSpan = data.span || 1
    let startTime = data.start_time
    let endTime = data.end_time
    if (effectiveSpan > 1 && data.slot_id) {
      const combined = computeCombinedTimeRange(data.slot_id, effectiveSpan)
      const parsed = parseSlotTimeRange(combined)
      if (parsed.startTime) startTime = parsed.startTime
      if (parsed.endTime) endTime = parsed.endTime
    }

    const mergedMetadata = {
      ...(data.metadata || {}),
      status: uiStatus,
      is_adhoc: Boolean(data.specific_date || data.metadata?.is_adhoc),
    }

    const scheduleId = data.id || `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    const payload: ScheduleInsert = {
      id: scheduleId,
      lab_id: data.lab_id,
      teacher_id: resolvedTeacherId,
      subject_name: displaySubjectName,
      batch_name: displayBatchName,
      day_key: data.day_key,
      slot_id: data.slot_id,
      span: effectiveSpan,
      start_time: startTime,
      end_time: endTime,
      is_merged: effectiveSpan > 1,
      status: pgStatus,
      specific_date: data.specific_date || null,
      metadata: mergedMetadata,
      class_subject_id: resolvedClassSubjectId,
      academic_year_id: resolvedAcademicYearId,
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
    if (uiStatus === 'requested') {
      const teacherName = data.metadata?.teacher || 'Subject Teacher'
      const notifId1 = `notif-slot-req-${Date.now()}-admin`
      const notifId2 = `notif-slot-req-${Date.now()}-incharge`
      const sessId = newSchedule?.id || scheduleId
      try {
        const pool = getPgPool()
        const metaJson = JSON.stringify({
          schedule_id: sessId,
          slot_id: data.slot_id,
          day_key: data.day_key,
          specific_date: data.specific_date,
          action_url: `/schedules?focusSlotId=${sessId}`
        });
        await pool.query(
          `INSERT INTO public.lab_notifications (id, incident_id, target_role, title, message, severity, is_read, metadata, created_at)
           VALUES 
             ($1, NULL, 'super_admin', $2, $3, 'info', false, $4::jsonb, NOW()),
             ($5, NULL, 'lab_incharge', $6, $7, 'info', false, $4::jsonb, NOW())
           ON CONFLICT (id) DO NOTHING;`,
          [
            notifId1,
            `Slot Booking Request: ${teacherName}`,
            `${teacherName} has requested a practical session for "${data.subject_name}" (${data.batch_name}) on ${data.day_key.toUpperCase()} Period ${data.slot_id.toUpperCase()}.`,
            metaJson,
            notifId2,
            `Slot Booking Request: ${teacherName}`,
            `${teacherName} has requested a practical session for "${data.subject_name}" (${data.batch_name}) on ${data.day_key.toUpperCase()} Period ${data.slot_id.toUpperCase()}.`,
          ]
        )
      } catch (notifErr) {
        console.warn('Could not insert slot request notifications:', notifErr)
      }
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
  } catch (e: any) {
    console.error('Failed to create schedule:', e)
    return { error: e?.message || 'Failed to create schedule slot.' }
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
  const userScope = await getServerUserScope()
  if (userScope.approvalStatus !== 'approved') {
    return { error: 'Permission denied: Your account is not approved for session operations.' }
  }

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
        const computedTimeRange = computeCombinedTimeRange(primaryObj.slot_id, combinedSpan)
        const newEndTime = secondaryObj.end_time || parseSlotTimeRange(computedTimeRange).endTime
        const finalSubjectName = cleanMergedSubjectName(
          mergedData?.subject_name,
          primaryObj.subject_name,
          secondaryObj.subject_name
        )

        // Update primary schedule to merged state with combined span and correct end_time
        const { error: updateError } = await (supabase
          .from('schedules') as any)
          .update({
            is_merged: true,
            span: combinedSpan,
            end_time: newEndTime,
            subject_name: finalSubjectName,
            batch_name: mergedData?.batch_name || primaryObj.batch_name,
            teacher_id: mergedData?.teacher_id || primaryObj.teacher_id,
            metadata: {
              ...(primaryObj.metadata || {}),
              merged_with: secondaryObj.id,
              original_parts: [primaryObj, secondaryObj],
            },
          })
          .eq('id', scheduleId)

        if (updateError) return { error: updateError.message }

        // Delete secondary slot (preserved in metadata.original_parts)
        await supabase.from('schedules').delete().eq('id', nextScheduleId)

        await recordAuditEvent({
          action: 'UPDATE',
          entityType: 'schedule',
          entityId: scheduleId,
          entityLabel: `Merged Slot: ${finalSubjectName}`,
          before: {
            is_merged: false,
            span: primaryObj.span || 1,
            end_time: primaryObj.end_time,
            subject_name: primaryObj.subject_name,
          },
          after: {
            is_merged: true,
            span: combinedSpan,
            end_time: newEndTime,
            subject_name: finalSubjectName,
          },
          metadata: { operation: 'merge_schedules', nextScheduleId },
        })
      }
    } else {
      // Extend single slot
      const newSpan = (primaryObj.span || 1) + 1
      const computedTimeRange = computeCombinedTimeRange(primaryObj.slot_id, newSpan)
      const newEndTime = parseSlotTimeRange(computedTimeRange).endTime
      await (supabase
        .from('schedules') as any)
        .update({
          is_merged: true,
          span: newSpan,
          end_time: newEndTime,
        })
        .eq('id', scheduleId)

      await recordAuditEvent({
        action: 'UPDATE',
        entityType: 'schedule',
        entityId: scheduleId,
        entityLabel: `Extended Duration: ${primaryObj.subject_name}`,
        before: { span: primaryObj.span || 1, end_time: primaryObj.end_time },
        after: { span: newSpan, end_time: newEndTime },
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
  const userScope = await getServerUserScope()
  if (userScope.approvalStatus !== 'approved') {
    return { error: 'Permission denied: Your account is not approved for session operations.' }
  }

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

    const scheduleObj = schedule as any
    const originalParts = scheduleObj.metadata?.original_parts || []
    const primaryOriginal = originalParts[0]
    const secondaryOriginal = originalParts[1]

    const restoredEndTime =
      primaryOriginal?.end_time || parseSlotTimeRange(computeCombinedTimeRange(scheduleObj.slot_id, 1)).endTime
    const restoredSubjectName =
      primaryOriginal?.subject_name || scheduleObj.subject_name.split(' & ')[0].split(' + ')[0].trim()
    const restoredBatchName =
      primaryOriginal?.batch_name || scheduleObj.batch_name.split(' & ')[0].trim()

    // Restore primary schedule
    await (supabase
      .from('schedules') as any)
      .update({
        is_merged: false,
        span: 1,
        end_time: restoredEndTime,
        subject_name: restoredSubjectName,
        batch_name: restoredBatchName,
        metadata: {
          ...(scheduleObj.metadata || {}),
          merged_with: null,
          original_parts: null,
        },
      })
      .eq('id', scheduleId)

    // Restore secondary schedule if it existed
    if (secondaryOriginal) {
      await supabase.from('schedules').insert({
        id: secondaryOriginal.id,
        lab_id: secondaryOriginal.lab_id,
        teacher_id: secondaryOriginal.teacher_id,
        subject_name: secondaryOriginal.subject_name,
        batch_name: secondaryOriginal.batch_name,
        start_time: secondaryOriginal.start_time,
        end_time: secondaryOriginal.end_time,
        slot_id: secondaryOriginal.slot_id,
        day_key: secondaryOriginal.day_key,
        span: secondaryOriginal.span || 1,
        is_merged: false,
        status: secondaryOriginal.status || 'scheduled',
        metadata: secondaryOriginal.metadata || {},
        class_subject_id: secondaryOriginal.class_subject_id || null,
        academic_year_id: secondaryOriginal.academic_year_id || null,
      })
    }

    await recordAuditEvent({
      action: 'UPDATE',
      entityType: 'schedule',
      entityId: scheduleId,
      entityLabel: `Split / Unmerged: ${scheduleObj.subject_name}`,
      before: { is_merged: true, span: scheduleObj.span || 2, end_time: scheduleObj.end_time },
      after: { is_merged: false, span: 1, end_time: restoredEndTime },
      metadata: { operation: 'unmerge_schedule', restoredSecondaryId: secondaryOriginal?.id },
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
  const userScope = await getServerUserScope()
  if (userScope.approvalStatus !== 'approved') {
    return { success: false, error: 'Permission denied: Your account is pending verification and not approved for schedule deletion.' }
  }

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
  const userScope = await getServerUserScope()
  if (userScope.role !== 'super_admin' || userScope.approvalStatus !== 'approved') {
    return { success: false, error: 'Unauthorized: Resetting master schedules is restricted to approved Super Administrators.' }
  }

  try {
    const pool = getPgPool()
    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      // Ensure the 3 standard institutional labs exist in public.labs
      const standardLabs = [
        { id: 'comp', name: 'Computer Lab', code: 'COMP', type: 'computer_lab', capacity: 48 },
        { id: 'phys', name: 'Physics Lab', code: 'PHYS', type: 'physics_lab', capacity: 38 },
        { id: 'chem', name: 'Chemistry Lab', code: 'CHEM', type: 'chemistry_lab', capacity: 40 },
      ]
      for (const lab of standardLabs) {
        await client.query(`
          INSERT INTO public.labs (id, name, code, type, capacity, status, is_active)
          VALUES ($1, $2, $3, $4, $5, 'Operational', true)
          ON CONFLICT (id) DO NOTHING;
        `, [lab.id, lab.name, lab.code, lab.type, lab.capacity])
      }

      // Reset all schedules to default 'scheduled' status and clear skipped metadata
      const updateRes = await client.query(`
        UPDATE public.schedules
        SET status = 'scheduled',
            metadata = jsonb_set(
              COALESCE(metadata, '{}'::jsonb),
              '{is_skipped}',
              'false'::jsonb
            );
      `)

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
      after: { status: 'restored_to_master_baseline' },
      metadata: { operation: 'reset_schedules_to_master' },
    })

    revalidatePath('/schedules')
    revalidatePath('/admin')
    revalidatePath('/')

    return { success: true }
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
    class_subject_id?: string | null
    academic_year_id?: string | null
    status?: 'confirmed' | 'requested' | 'skipped' | 'scheduled'
    metadata?: any
  }
): Promise<{ success: boolean; schedule?: any; error?: string }> {
  const userScope = await getServerUserScope()
  if (userScope.approvalStatus !== 'approved') {
    return { success: false, error: 'Permission denied: Your account is not approved for timetable modifications.' }
  }

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
    if (data.status !== undefined) {
      const VALID_PG_SESSION_STATUSES = new Set(['scheduled', 'in_progress', 'completed', 'cancelled'])
      updatePayload.status = VALID_PG_SESSION_STATUSES.has(data.status as any) ? data.status : 'scheduled'
      updatePayload.metadata = {
        ...(updatePayload.metadata || beforeSchedule?.metadata || {}),
        status: data.status,
      }
    }
    if (data.metadata !== undefined) updatePayload.metadata = data.metadata

    if (data.class_subject_id !== undefined) {
      updatePayload.class_subject_id = data.class_subject_id
      if (data.class_subject_id) {
        const { data: cs } = await supabase
          .from('class_subjects')
          .select('id, academic_year_id, classes:class_id(name), subjects:subject_id(code, name)')
          .eq('id', data.class_subject_id)
          .maybeSingle()
        if (cs) {
          if (data.subject_name === undefined && (cs as any).subjects?.code) {
            updatePayload.subject_name = `${(cs as any).subjects.code} - ${(cs as any).subjects.name}`
          }
          if (data.batch_name === undefined && (cs as any).classes?.name) {
            updatePayload.batch_name = (cs as any).classes.name
          }
          if (data.academic_year_id === undefined && (cs as any).academic_year_id) {
            updatePayload.academic_year_id = (cs as any).academic_year_id
          }
        }
      }
    }
    if (data.academic_year_id !== undefined) updatePayload.academic_year_id = data.academic_year_id

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
        subject_name: updatePayload.subject_name || data.subject_name || 'Practical Session',
        batch_name: updatePayload.batch_name || data.batch_name || 'Class 12',
        day_key: data.day_key || 'sun',
        slot_id: data.slot_id || 't1',
        span: data.span || 1,
        start_time: data.start_time || '10:10',
        end_time: data.end_time || '11:00',
        status: (data.status && ['scheduled', 'in_progress', 'completed', 'cancelled'].includes(data.status)) ? data.status : 'scheduled',
        metadata: data.metadata || {},
        class_subject_id: updatePayload.class_subject_id || null,
        academic_year_id: updatePayload.academic_year_id || null,
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
  const userScope = await getServerUserScope()
  if (userScope.approvalStatus !== 'approved') {
    return { success: false, error: 'Permission denied: Your account is not approved for session status changes.' }
  }

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
      status: data.status,
      is_skipped: data.is_skipped ?? (data.status === 'skipped'),
      skipped_reason: data.status === 'confirmed' ? null : (data.skipped_reason || currentMeta.skipped_reason || null),
      skipped_by: data.status === 'confirmed' ? null : (data.skipped_by || currentMeta.skipped_by || null),
      decline_reason: data.status === 'confirmed' ? null : (data.decline_reason || currentMeta.decline_reason || null),
    }

    const VALID_PG_SESSION_STATUSES = new Set(['scheduled', 'in_progress', 'completed', 'cancelled'])
    const pgStatus = VALID_PG_SESSION_STATUSES.has(data.status)
      ? data.status
      : (data.status === 'skipped' ? 'cancelled' : 'scheduled')

    const { error } = await (supabase.from('schedules') as any)
      .update({
        status: pgStatus,
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
    if (data.status === 'skipped' && data.decline_reason) {
      const notifId = `notif-slot-dec-${Date.now()}`
      try {
        const pool = getPgPool()
        await pool.query(
          `INSERT INTO public.lab_notifications (id, target_role, title, message, severity, is_read, created_at)
           VALUES ($1, 'teacher', $2, $3, 'warning', false, NOW())
           ON CONFLICT (id) DO NOTHING;`,
          [
            notifId,
            `Slot Request Declined: ${subjectName}`,
            `Your booking request for ${subjectName} was declined. Reason: "${data.decline_reason}"`,
          ]
        )
      } catch (notifErr) {
        console.warn('Could not insert slot decline notification:', notifErr)
      }
    }

    // If approved, notify the teacher
    if (data.status === 'confirmed') {
      const notifId = `notif-slot-app-${Date.now()}`
      try {
        const pool = getPgPool()
        await pool.query(
          `INSERT INTO public.lab_notifications (id, target_role, title, message, severity, is_read, created_at)
           VALUES ($1, 'teacher', $2, $3, 'info', false, NOW())
           ON CONFLICT (id) DO NOTHING;`,
          [
            notifId,
            `Slot Request Approved: ${subjectName}`,
            `Your booking request for ${subjectName} has been approved and confirmed.`,
          ]
        )
      } catch (notifErr) {
        console.warn('Could not insert slot approval notification:', notifErr)
      }
    }

    revalidatePath('/schedules')
    revalidatePath('/')
    return { success: true }
  } catch (e: any) {
    return { error: e.message || 'Failed to update schedule status' }
  }
}
