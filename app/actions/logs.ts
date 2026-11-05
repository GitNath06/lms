'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { DEFAULT_HOLIDAYS, isDateWithinHoliday } from '@/lib/master-data'
import { checkServerDateSuspension } from '@/lib/calendar-policy'
import { getServerUserScope } from '@/lib/context/server-user-scope'
import { dispatchSkippedSessionNotification } from '@/app/actions/notifications'
import { getPgPool } from '@/lib/db'

type PracticalLogInsert = Database['public']['Tables']['practical_logs']['Insert']
type PracticalLogUpdate = Database['public']['Tables']['practical_logs']['Update']
type LabRow = Database['public']['Tables']['labs']['Row']

declare global {
  var __PRACTICAL_LOGS_STORE__: any[] | undefined
}

function getStore(): any[] {
  if (!globalThis.__PRACTICAL_LOGS_STORE__) {
    globalThis.__PRACTICAL_LOGS_STORE__ = []
  }
  return globalThis.__PRACTICAL_LOGS_STORE__
}

const LAB_NAME_MAP: Record<string, { id: string; name: string; type: string }> = {
  comp: { id: 'comp', name: 'Computer Lab', type: 'computer_lab' },
  phys: { id: 'phys', name: 'Physics Lab', type: 'physics_lab' },
  chem: { id: 'chem', name: 'Chemistry Lab', type: 'chemistry_lab' },
}

export async function createPracticalLog(
  data: FormData | any
): Promise<{ success: boolean; log?: any; error?: string; duplicateId?: string }> {
  // Reject mutations for pending accounts
  const userScope = await getServerUserScope()
  if (userScope.isPending || userScope.approvalStatus !== 'approved') {
    return {
      success: false,
      error: 'Permission denied: Your account is pending verification and cannot record practical sessions until approved by an administrator.',
    }
  }

  let logPayload: any

  if (data instanceof FormData) {
    const total = parseInt(data.get('total_students') as string, 10) || 0
    let present = parseInt(data.get('present_students') as string, 10) || 0
    // Strict clamp: present cannot exceed total
    present = Math.min(total, Math.max(0, present))
    const absent = Math.max(0, total - present)

    logPayload = {
      schedule_id: (data.get('schedule_id') as string) || (data.get('sessionId') as string) || null,
      class_subject_id: (data.get('class_subject_id') as string) || null,
      lab_id: (data.get('lab_id') as string) || 'comp',
      teacher_id: (data.get('teacher_id') as string) || null,
      date: (data.get('date') as string) || new Date().toISOString().split('T')[0],
      period_label: (data.get('period_label') as string) || '',
      subject_name: (data.get('subject_name') as string) || 'Practical Session',
      batch_group: (data.get('batch_group') as string) || '',
      practical_title: (data.get('practical_title') as string) || 'Experiment Entry',
      total_students: total,
      present_students: present,
      absent_students: absent,
      remarks: (data.get('remarks') as string) || null,
      status: 'conducted',
      logged_by: 'subject_teacher',
    }
  } else {
    const total = data.total_students || data.totalStudents || 0
    let present = data.present_students || data.presentStudents || 0
    present = Math.min(total, Math.max(0, present))
    const absent = Math.max(0, total - present)

    let subjectName = data.subject_name
    if (!subjectName) {
      if (data.subjectTitle && data.subjectCode) {
        subjectName = data.subjectTitle.toLowerCase().startsWith(data.subjectCode.toLowerCase())
          ? data.subjectTitle
          : `${data.subjectCode} - ${data.subjectTitle}`
      } else {
        subjectName = data.subjectTitle || data.subjectCode || 'Practical Session'
      }
    }

    logPayload = {
      schedule_id: data.schedule_id || data.sessionId || null,
      class_subject_id: data.class_subject_id || data.classSubjectId || null,
      lab_id: data.lab_id || data.labKey || data.lab || 'comp',
      teacher_id: data.teacher_id || null,
      date: data.date || new Date().toISOString().split('T')[0],
      period_label: data.period_label || data.timeSlot || '',
      subject_name: subjectName,
      batch_group: data.batch_group || data.grade || '',
      practical_title: data.practical_title || data.topicLearned || 'Laboratory Practical Experiment',
      total_students: total,
      present_students: present,
      absent_students: absent,
      remarks: data.remarks || null,
      status: data.status || 'conducted',
      skip_reason: data.skip_reason || data.skipReason || null,
      topic_learned: data.topic_learned || data.topicLearned || null,
      logged_by: 'subject_teacher',
    }
  }

  // Reject practical log creation (both conducted and skipped) on institutional holidays or weekly recesses
  const suspension = await checkServerDateSuspension(logPayload.date)
  if (suspension.isSuspended) {
    return {
      success: false,
      error: `Practical log rejected: ${logPayload.date} is an official institutional ${suspension.type === 'holiday' ? 'holiday' : 'recess'} (${suspension.title}). Practicals are automatically suspended and no log entries (conducted or skipped) can be created.`,
    }
  }

  const safeLabId =
    logPayload.lab_id.toLowerCase().includes('comp')
      ? 'comp'
      : logPayload.lab_id.toLowerCase().includes('phys')
      ? 'phys'
      : logPayload.lab_id.toLowerCase().includes('chem')
      ? 'chem'
      : logPayload.lab_id.toLowerCase().includes('bio')
      ? 'bio'
      : logPayload.lab_id.toLowerCase().includes('elec')
      ? 'elec'
      : 'comp'

  const labInfo = LAB_NAME_MAP[safeLabId] || {
    id: safeLabId,
    name: 'Laboratory',
    type: 'laboratory',
  }

  // Server-side lab status check: block practical logging if Under Maintenance or Inactive
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      const { data: targetLab } = await (supabase
        .from('labs') as any)
        .select('id, name, status, is_active')
        .eq('id', safeLabId)
        .maybeSingle()

      if (targetLab) {
        if (targetLab.status === 'Under Maintenance') {
          return {
            success: false,
            error: `Practical log rejected: "${targetLab.name || safeLabId}" is currently Under Maintenance. Practical sessions cannot be conducted or logged in an offline facility.`,
          }
        }
        if (!targetLab.is_active || targetLab.status === 'Inactive') {
          return {
            success: false,
            error: `Practical log rejected: "${targetLab.name || safeLabId}" is currently Inactive / Decommissioned.`,
          }
        }
      }
    } catch (err) {
      console.warn('Error verifying lab status for practical log:', err)
    }
  }

  // ==========================================================================
  // 1. LOGICAL DUPLICATE CHECK & IDEMPOTENT SESSION RE-USE
  // ==========================================================================
  const norm = (s?: string | null) => (s ? s.trim().toLowerCase() : '')
  const checkDate = logPayload.date
  const checkLab = safeLabId
  const checkPeriod = norm(logPayload.period_label)
  const checkBatch = norm(logPayload.batch_group)
  const checkSubject = norm(logPayload.subject_name)
  const idempotencyKey =
    (data instanceof FormData
      ? (data.get('idempotency_key') as string) || (data.get('idempotencyKey') as string)
      : data?.idempotency_key || data?.idempotencyKey) || null
  let targetEditId = data.id || data.existingLogId || null

  // Check database for idempotency key replay
  if (idempotencyKey && isSupabaseConfigured()) {
    try {
      const pool = getPgPool()
      const { rows } = await pool.query(
        'SELECT id FROM public.practical_logs WHERE idempotency_key = $1 LIMIT 1',
        [idempotencyKey]
      )
      if (rows && rows.length > 0) {
        targetEditId = rows[0].id
      }
    } catch (idemErr) {
      console.warn('Idempotency key lookup warning:', idemErr)
    }
  }

  // Check Supabase DB for existing schedule or logical duplicates
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()

      // A. Exact Schedule + Date Collision: If a log already exists for this timetable schedule on this date, update in-place
      if (!targetEditId && logPayload.schedule_id) {
        const { data: schedMatch } = await (supabase.from('practical_logs') as any)
          .select('id')
          .eq('schedule_id', logPayload.schedule_id)
          .eq('date', checkDate)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (schedMatch?.id) {
          targetEditId = schedMatch.id
        }
      }

      // B. Facility + Period Collision check
      const { data: existingDbRows, error: dupErr } = await (supabase.from('practical_logs') as any)
        .select('id, schedule_id, date, lab_id, period_label, batch_group, subject_name')
        .eq('lab_id', checkLab)
        .eq('date', checkDate)

      if (!dupErr && existingDbRows && existingDbRows.length > 0) {
        const dbMatch = existingDbRows.find((r: any) => {
          if (targetEditId && r.id === targetEditId) return false
          const sameSchedule = Boolean(logPayload.schedule_id && r.schedule_id === logPayload.schedule_id)
          const sameSlot =
            norm(r.period_label) === checkPeriod &&
            norm(r.batch_group) === checkBatch &&
            norm(r.subject_name) === checkSubject
          return sameSchedule || sameSlot
        })

        if (dbMatch) {
          if (!targetEditId) {
            // Auto-heal duplicate: reuse existing matching log ID so operation performs in-place update
            targetEditId = dbMatch.id
          } else if (dbMatch.id !== targetEditId) {
            return {
              success: false,
              error: `A practical log already exists for ${logPayload.batch_group} · ${logPayload.subject_name} · ${logPayload.period_label} on ${logPayload.date}. Edit the existing entry instead of creating a duplicate.`,
              duplicateId: dbMatch.id,
            }
          }
        }
      }
    } catch (err) {
      console.warn('Error querying Supabase for duplicates:', err)
    }
  }

  // Check persistent memory store
  const store = getStore()
  const storeMatch = store.find((l) => {
    if (targetEditId && l.id === targetEditId) return false
    return (
      l.date === checkDate &&
      l.lab_id === checkLab &&
      norm(l.period_label) === checkPeriod &&
      norm(l.batch_group) === checkBatch &&
      norm(l.subject_name) === checkSubject
    )
  })

  if (storeMatch) {
    return {
      success: false,
      error: `A practical log already exists for ${logPayload.batch_group} · ${logPayload.subject_name} · ${logPayload.period_label} on ${logPayload.date}. Edit the existing entry instead of creating a duplicate.`,
      duplicateId: storeMatch.id,
    }
  }

  // ==========================================================================
  // 2. TEACHER IDENTITY RESOLUTION (Ensure valid profiles UUID)
  // ==========================================================================
  const isUUID = (str?: string | null) =>
    str ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str) : false

  let safeTeacherId = isUUID(logPayload.teacher_id) ? logPayload.teacher_id : null
  let teacherName =
    (data.teacher as string) || (data.teacher_name as string) || 'Assigned Subject Teacher'

  // If teacher_id is not already a UUID, resolve from profiles table by teacherName
  if (!safeTeacherId && isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      const cleanName = teacherName.replace(/^(Er\.|Dr\.|Mr\.|Ms\.)\s*/i, '').trim()
      const { data: prof } = await (supabase.from('profiles') as any)
        .select('id, full_name')
        .ilike('full_name', `%${cleanName}%`)
        .limit(1)
        .maybeSingle()

      if (prof && (prof as any).id) {
        safeTeacherId = (prof as any).id
        teacherName = (prof as any).full_name || teacherName
      }
    } catch {}
  }

  const safeAbsentRolls = Array.isArray(data.absent_rolls || data.absentRolls)
    ? (data.absent_rolls || data.absentRolls)
        .map((r: any) => (typeof r === 'number' ? r : parseInt(String(r), 10)))
        .filter((n: number) => Number.isFinite(n) && n > 0)
    : []

  const recordId = targetEditId || `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`

  const newLogRecord = {
    id: recordId,
    ...logPayload,
    lab_id: safeLabId,
    teacher_id: safeTeacherId,
    absent_rolls: safeAbsentRolls,
    created_at: new Date().toISOString(),
    labs: labInfo,
    profiles: { id: safeTeacherId || '', full_name: teacherName },
  }

  // Prepend to persistent memory store
  const existingIdx = store.findIndex((l) => l.id === recordId)
  if (existingIdx !== -1) {
    store[existingIdx] = newLogRecord
  } else {
    store.unshift(newLogRecord)
  }

  // Try to also write to Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      const { data: userData } = await supabase.auth.getUser()
      const loggedBy = isUUID(userData.user?.id) ? userData.user?.id : null

      // Resolve canonical class_subject_id and dual-write snapshots
      let resolvedClassSubjectId = logPayload.class_subject_id || null
      let targetClassId: string | null = null
      let effectiveYearId = logPayload.academic_year_id || null

      if (logPayload.schedule_id && !resolvedClassSubjectId) {
        const { data: sched } = await supabase
          .from('schedules')
          .select('id, class_subject_id, academic_year_id, batch_name, subject_name, teacher_id')
          .eq('id', logPayload.schedule_id)
          .maybeSingle()

        if (sched?.class_subject_id) {
          resolvedClassSubjectId = sched.class_subject_id
          if (!effectiveYearId && sched.academic_year_id) {
            effectiveYearId = sched.academic_year_id
          }
        }
      }

      if (!effectiveYearId) {
        const { data: currYear } = await supabase
          .from('academic_years')
          .select('id')
          .eq('is_current', true)
          .maybeSingle()
        effectiveYearId = currYear?.id || null
      }

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
          effectiveYearId = (cs as any).academic_year_id || effectiveYearId
          const sub = (cs as any).subjects
          const cls = (cs as any).classes
          if (sub?.code && sub?.name) {
            logPayload.subject_name = `${sub.code} - ${sub.name}`
          }
          if (cls?.name) {
            logPayload.batch_group = cls.name
          }
        }
      } else {
        // Look up candidate class_subjects matching batch and subject
        const norm = (s?: string | null) => (s ? s.trim().toLowerCase() : '')
        let csQuery = (supabase.from('class_subjects') as any)
          .select(`
            id, class_id, subject_id, teacher_id, academic_year_id,
            classes:class_id ( id, name, grade ),
            subjects:subject_id ( id, code, name )
          `)

        if (effectiveYearId) {
          csQuery = csQuery.eq('academic_year_id', effectiveYearId)
        }

        const { data: csList } = await csQuery

        if (csList && csList.length > 0) {
          const normBatch = norm(logPayload.batch_group)
          const normSub = norm(logPayload.subject_name)
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

            const classMatch =
              normBatch === clsName ||
              normBatch === clsId ||
              (cleanBatch.length > 0 && cleanBatch === cleanClsName) ||
              (cleanBatch.length > 0 && cleanBatch === cleanClsId) ||
              (cleanClsName.length > 1 && cleanBatch.startsWith(cleanClsName))

            const subjectMatch =
              (cleanSubCode.length > 0 && cleanSub.includes(cleanSubCode)) ||
              (subName.length > 0 && normSub.includes(subName))

            return classMatch && subjectMatch
          })

          if (matched) {
            resolvedClassSubjectId = matched.id
            targetClassId = matched.class_id
            effectiveYearId = matched.academic_year_id || effectiveYearId
            const sub = matched.subjects
            const cls = matched.classes
            if (sub?.code && sub?.name) {
              logPayload.subject_name = `${sub.code} - ${sub.name}`
            }
            if (cls?.name) {
              logPayload.batch_group = cls.name
            }
          } else {
            // NEVER cross-attach or guess an unrelated subject within the class cohort
            resolvedClassSubjectId = null
            // Resolve targetClassId directly from classes table for seating snapshot lookups
            const { data: clsMatch } = await supabase
              .from('classes')
              .select('id, name')
              .or(`id.ilike.${logPayload.batch_group},name.ilike.${logPayload.batch_group}`)
              .limit(1)
              .maybeSingle()
            if (clsMatch) {
              targetClassId = clsMatch.id
              logPayload.batch_group = clsMatch.name
            }
          }
        }
      }

      // -------------------------------------------------------------
      // UNIVERSAL SEATING SNAPSHOT INVARIANT FOR COMPUTER LAB
      // -------------------------------------------------------------
      let resolvedSeatingSnapshot = data.seating_snapshot || data.seatingSnapshot || null

      if (
        safeLabId === 'comp' &&
        (!resolvedSeatingSnapshot || !Array.isArray(resolvedSeatingSnapshot) || resolvedSeatingSnapshot.length === 0)
      ) {
        try {
          const { data: workstations } = await (supabase
            .from('workstations') as any)
            .select('id, label, row_label')
            .eq('lab_id', 'comp')
            .eq('is_active', true)
            .order('label', { ascending: true })

          if (workstations && workstations.length > 0) {
            let classIdForSeating = targetClassId
            if (!classIdForSeating && logPayload.batch_group) {
              const { data: clsData } = await supabase
                .from('classes')
                .select('id')
                .ilike('name', `%${logPayload.batch_group.trim()}%`)
                .maybeSingle()
              classIdForSeating = clsData?.id || null
            }

            const effectiveSeatPlan: Record<
              string,
              {
                studentId: string
                enrollmentId: string
                rollNumber: number
                fullName: string
                isOverride: boolean
                originalWorkstationLabel?: string | null
              }
            > = {}

            if (classIdForSeating && effectiveYearId) {
              const { data: tier1Data } = await (supabase
                .from('workstation_seat_plans') as any)
                .select(`
                  workstation_id, enrollment_id,
                  student_enrollments:enrollment_id (
                    id, student_id, roll_number,
                    students:student_id ( id, full_name, admission_no, gender, photo_url )
                  )
                `)
                .eq('class_id', classIdForSeating)
                .eq('academic_year_id', effectiveYearId)

              if (tier1Data) {
                for (const row of tier1Data as any[]) {
                  const enr = row.student_enrollments
                  if (enr && enr.students) {
                    effectiveSeatPlan[row.workstation_id] = {
                      studentId: enr.student_id,
                      enrollmentId: enr.id,
                      rollNumber: enr.roll_number,
                      fullName: enr.students.full_name,
                      isOverride: false,
                      originalWorkstationLabel: null,
                    }
                  }
                }
              }

              // Apply Tier 2 session seat overrides if schedule_id is present
              if (logPayload.schedule_id) {
                const { data: tier2Data } = await (supabase
                  .from('session_seat_overrides') as any)
                  .select(`
                    workstation_id, enrollment_id,
                    student_enrollments:enrollment_id (
                      id, student_id, roll_number,
                      students:student_id ( id, full_name, admission_no, gender, photo_url )
                    )
                  `)
                  .eq('schedule_id', logPayload.schedule_id)
                  .eq('session_date', logPayload.date)

                if (tier2Data) {
                  const wsLabelMap = new Map<string, string>(
                    workstations.map((w: any) => [w.id, w.label])
                  )

                  for (const override of tier2Data as any[]) {
                    const enr = override.student_enrollments
                    if (enr && enr.students) {
                      let originalLabel: string | null = null
                      // Vacate previous seat
                      for (const [wId, entry] of Object.entries(effectiveSeatPlan)) {
                        if (entry.enrollmentId === enr.id && wId !== override.workstation_id) {
                          originalLabel = wsLabelMap.get(wId) || null
                          delete effectiveSeatPlan[wId]
                        }
                      }

                      effectiveSeatPlan[override.workstation_id] = {
                        studentId: enr.student_id,
                        enrollmentId: enr.id,
                        rollNumber: enr.roll_number,
                        fullName: enr.students.full_name,
                        isOverride: true,
                        originalWorkstationLabel: originalLabel,
                      }
                    }
                  }
                }
              }
            }

            resolvedSeatingSnapshot = workstations.map((ws: any) => {
              const seat = effectiveSeatPlan[ws.id]
              const isAbsent = seat ? safeAbsentRolls.includes(seat.rollNumber) : false
              return {
                workstation_id: ws.id,
                workstation_label: ws.label,
                row_label: ws.row_label || null,
                student_id: seat ? seat.studentId : null,
                enrollment_id: seat ? seat.enrollmentId : null,
                student_name: seat ? seat.fullName : null,
                roll_number: seat ? seat.rollNumber : null,
                is_present: seat ? !isAbsent : false,
                is_override: seat ? seat.isOverride : false,
                original_workstation_label: seat?.originalWorkstationLabel || null,
                notes: seat?.isOverride
                  ? seat.originalWorkstationLabel
                    ? `Relocated from ${seat.originalWorkstationLabel}`
                    : 'Session relocation override'
                  : null,
              }
            })
          }
        } catch (seatErr) {
          console.warn('Could not auto-construct seating snapshot for computer lab:', seatErr)
        }
      }

      const upsertData: any = {
        id: recordId,
        schedule_id: logPayload.schedule_id || null,
        class_subject_id: resolvedClassSubjectId,
        lab_id: safeLabId,
        teacher_id: safeTeacherId,
        academic_year_id: effectiveYearId,
        date: logPayload.date,
        period_label: logPayload.period_label,
        subject_name: logPayload.subject_name,
        batch_group: logPayload.batch_group,
        practical_title: logPayload.practical_title,
        total_students: logPayload.total_students,
        present_students: logPayload.present_students,
        absent_students: logPayload.absent_students,
        absent_rolls: safeAbsentRolls,
        remarks: logPayload.remarks || null,
        status: logPayload.status || 'conducted',
        skip_reason: logPayload.skip_reason || null,
        topic_learned: logPayload.topic_learned || null,
        logged_by: loggedBy,
        idempotency_key: idempotencyKey,
      }

      if (resolvedSeatingSnapshot && Array.isArray(resolvedSeatingSnapshot) && resolvedSeatingSnapshot.length > 0) {
        upsertData.seating_snapshot = resolvedSeatingSnapshot
      }

      const { error: dbError } = await (supabase.from('practical_logs') as any).upsert(
        upsertData,
        { onConflict: 'id' }
      )

      if (dbError) {
        console.error('❌ Supabase log upsert error:', dbError)
        // If RLS blocked (e.g. background job / unauthenticated server caller / testing script), fall back to direct pg pool
        if (dbError.code === '42501' || dbError.message?.includes('row-level security')) {
          try {
            const pool = getPgPool()
            if (pool) {
              await pool.query(
                `INSERT INTO public.practical_logs (
                  id, schedule_id, class_subject_id, lab_id, teacher_id, academic_year_id,
                  date, period_label, subject_name, batch_group, practical_title,
                  total_students, present_students, absent_students, absent_rolls,
                  remarks, status, skip_reason, topic_learned, logged_by, seating_snapshot, idempotency_key
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
                ON CONFLICT (id) DO UPDATE SET
                  schedule_id = EXCLUDED.schedule_id,
                  class_subject_id = EXCLUDED.class_subject_id,
                  lab_id = EXCLUDED.lab_id,
                  teacher_id = EXCLUDED.teacher_id,
                  academic_year_id = EXCLUDED.academic_year_id,
                  date = EXCLUDED.date,
                  period_label = EXCLUDED.period_label,
                  subject_name = EXCLUDED.subject_name,
                  batch_group = EXCLUDED.batch_group,
                  practical_title = EXCLUDED.practical_title,
                  total_students = EXCLUDED.total_students,
                  present_students = EXCLUDED.present_students,
                  absent_students = EXCLUDED.absent_students,
                  absent_rolls = EXCLUDED.absent_rolls,
                  remarks = EXCLUDED.remarks,
                  status = EXCLUDED.status,
                  skip_reason = EXCLUDED.skip_reason,
                  topic_learned = EXCLUDED.topic_learned,
                  logged_by = EXCLUDED.logged_by,
                  seating_snapshot = COALESCE(EXCLUDED.seating_snapshot, practical_logs.seating_snapshot),
                  idempotency_key = COALESCE(EXCLUDED.idempotency_key, practical_logs.idempotency_key)`,
                [
                  upsertData.id,
                  upsertData.schedule_id,
                  upsertData.class_subject_id,
                  upsertData.lab_id,
                  upsertData.teacher_id,
                  upsertData.academic_year_id,
                  upsertData.date,
                  upsertData.period_label,
                  upsertData.subject_name,
                  upsertData.batch_group,
                  upsertData.practical_title,
                  upsertData.total_students,
                  upsertData.present_students,
                  upsertData.absent_students,
                  upsertData.absent_rolls,
                  upsertData.remarks,
                  upsertData.status,
                  upsertData.skip_reason,
                  upsertData.topic_learned,
                  upsertData.logged_by,
                  upsertData.seating_snapshot ? JSON.stringify(upsertData.seating_snapshot) : null,
                  upsertData.idempotency_key || null,
                ]
              )
            }
          } catch (pgErr) {
            console.error('PostgreSQL direct pool fallback also failed:', pgErr)
            return { success: false, error: dbError.message, log: newLogRecord }
          }
        } else {
          return { success: false, error: dbError.message, log: newLogRecord }
        }
      }

      // Post-insert: bridge attendance records with enrollment_id AND student_id via canonical relationship
      if (effectiveYearId && targetClassId) {
        try {
          const pool = getPgPool()
          await pool.query(
            `UPDATE public.log_attendance la
             SET enrollment_id = se.id,
                 student_id = se.student_id
             FROM public.student_enrollments se
             WHERE la.log_id = $1
               AND la.enrollment_id IS NULL
               AND se.academic_year_id = $2
               AND se.class_id = $3
               AND se.status = 'active'
               AND la.roll_number = se.roll_number;`,
            [recordId, effectiveYearId, targetClassId]
          )
        } catch (attErr) {
          console.warn('Attendance relational bridge non-blocking notice:', attErr)
        }
      }

      // Link any existing temporary session overrides to this submitted practical log
      if (logPayload.schedule_id && logPayload.date) {
        try {
          await supabase
            .from('session_seat_overrides')
            .update({ practical_log_id: recordId })
            .eq('schedule_id', logPayload.schedule_id)
            .eq('session_date', logPayload.date)
        } catch (ovErr) {
          console.warn('Session override link non-blocking notice:', ovErr)
        }
      }
    } catch (err: any) {
      console.warn('Supabase log insert skipped (fallback active):', err)
      return { success: false, error: err.message, log: newLogRecord }
    }
  }

  safeRevalidatePaths(['/records', '/records/new', '/print/daily-log', '/print/records', '/'])

  // Non-blocking background skipped session alert
  if (logPayload.status === 'skipped' || logPayload.is_skipped) {
    after(async () => {
      await dispatchSkippedSessionNotification({
        ...newLogRecord,
        teacher_name: teacherName,
        lab_name: labInfo?.name || safeLabId,
      }).catch((err) =>
        console.error('[Mailer] Background skipped session notification failed:', err)
      )
    })
  }

  return { success: true, log: newLogRecord }
}

function safeRevalidatePaths(paths: string[]) {
  try {
    for (const p of paths) {
      revalidatePath(p)
    }
  } catch (e) {
    // Outside active Next.js request context (e.g. testing scripts)
  }
}

export async function updatePracticalLog(id: string, data: Partial<PracticalLogUpdate>) {
  const userScope = await getServerUserScope()
  if (userScope.isPending || userScope.approvalStatus !== 'approved') {
    return { success: false, error: 'Permission denied: Your account is pending verification and cannot modify records.' }
  }
  const isPrivileged = userScope.isPrivileged

  const pool = getPgPool()

  // 1. Authoritative ownership & existence check against live PostgreSQL
  const existingRes = await pool.query(
    `SELECT id, teacher_id, logged_by, remarks FROM public.practical_logs WHERE id = $1 LIMIT 1;`,
    [id]
  )
  if (existingRes.rows.length === 0) {
    return { success: false, error: 'Practical log record not found.' }
  }
  const existing = existingRes.rows[0]

  // 2. Ownership & sign-off role guards
  if (!isPrivileged) {
    const isOwner =
      Boolean(userScope.userId) &&
      (existing.teacher_id === userScope.userId || existing.logged_by === userScope.userId)
    if (!isOwner) {
      return { success: false, error: 'Permission denied: You can only modify your own practical session records.' }
    }

    // Guard: Only privileged roles (super_admin, lab_incharge, hod) can certify/verify sign-offs
    if (data.remarks && /verified|audit.*signed|sign-off|in-charge.*stamp/i.test(data.remarks)) {
      return {
        success: false,
        error: 'Permission denied: Only administrative faculty and Lab In-Charges can certify or apply digital verification sign-offs.',
      }
    }
  }

  // 3. Update in persistent memory store if present
  const store = getStore()
  const idx = store.findIndex((l) => l.id === id)
  if (idx !== -1) {
    store[idx] = { ...store[idx], ...data, updated_at: new Date().toISOString() }
  }

  // 4. Authoritative PostgreSQL write with SQL-level ownership guard
  try {
    const updates: string[] = []
    const vals: any[] = [id]
    for (const [k, v] of Object.entries(data)) {
      vals.push(v)
      updates.push(`${k} = $${vals.length}`)
    }
    if (updates.length > 0) {
      let updateSql = `UPDATE public.practical_logs SET ${updates.join(', ')} WHERE id = $1`
      if (!isPrivileged && userScope.userId) {
        vals.push(userScope.userId)
        updateSql += ` AND (teacher_id = $${vals.length} OR logged_by = $${vals.length})`
      }
      const pgRes = await pool.query(updateSql, vals)
      if (pgRes.rowCount === 0) {
        return { success: false, error: 'Record update rejected: unauthorized or non-existent record.' }
      }
    }
  } catch (pgErr: any) {
    console.error('Error updating practical log via pg pool:', pgErr)
    return { success: false, error: pgErr.message || 'Database update failed.' }
  }

  // 5. Opportunistic Supabase sync if configured
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      await (supabase.from('practical_logs') as any).update(data).eq('id', id)
    } catch (e: any) {
      // Background client sync warning
    }
  }

  safeRevalidatePaths(['/records', '/records/new', '/print/records', '/print/daily-log', '/'])

  return { success: true }
}

export interface PracticalLogFilters {
  search?: string
  lab_id?: string
  date?: string
  effectiveDate?: string
  teacher_id?: string
  view_mode?: 'my_data' | 'all'
  limit?: number
  offset?: number
}

// Helper to guarantee clean string dates from direct PostgreSQL driver queries
function normalizePracticalLogRow(row: any) {
  if (!row) return row
  let dateStr = ''
  if (row.date instanceof Date) {
    const y = row.date.getFullYear()
    const m = String(row.date.getMonth() + 1).padStart(2, '0')
    const d = String(row.date.getDate()).padStart(2, '0')
    dateStr = `${y}-${m}-${d}`
  } else if (typeof row.date === 'string') {
    dateStr = row.date.includes('T') ? row.date.split('T')[0] : row.date
  } else if (row.date) {
    dateStr = String(row.date)
  }

  let createdAtStr = ''
  if (row.created_at instanceof Date) {
    createdAtStr = row.created_at.toISOString()
  } else if (row.created_at) {
    createdAtStr = String(row.created_at)
  }

  return {
    ...row,
    date: dateStr,
    created_at: createdAtStr,
  }
}

export async function getPracticalLogs(filters?: PracticalLogFilters) {
  const userScope = await getServerUserScope()
  if (userScope.isPending || userScope.approvalStatus !== 'approved') {
    return []
  }
  const isPrivileged = userScope.isPrivileged
  const shouldScopeToMyData = !isPrivileged || filters?.view_mode === 'my_data'

  // Attempt direct PostgreSQL execution via pg pool on port 6543
  try {
    const pool = getPgPool()
    const activeDate = filters?.date || filters?.effectiveDate || new Date().toISOString().split('T')[0]
    const limit = filters?.limit ?? 50
    const offset = filters?.offset ?? 0

    // Build WHERE clauses
    const whereClauses: string[] = []
    const params: any[] = []

    if (filters?.lab_id && filters.lab_id !== 'all') {
      params.push(filters.lab_id)
      whereClauses.push(`pl.lab_id = $${params.length}`)
    }

    if (filters?.search && filters.search.trim().length > 0) {
      params.push(`%${filters.search.trim()}%`)
      whereClauses.push(`(pl.subject_name ILIKE $${params.length} OR pl.practical_title ILIKE $${params.length} OR pl.batch_group ILIKE $${params.length})`)
    }

    if (shouldScopeToMyData && userScope.userId) {
      params.push(userScope.userId)
      whereClauses.push(`(pl.teacher_id = $${params.length} OR pl.logged_by = $${params.length})`)
    } else if (filters?.teacher_id && filters.teacher_id !== 'all') {
      params.push(filters.teacher_id)
      whereClauses.push(`pl.teacher_id = $${params.length}`)
    }

    const baseWhere = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    // Fast SQL COUNT aggregations
    const countSql = `
      SELECT 
        COUNT(*)::int as total_count,
        COUNT(*) FILTER (WHERE status != 'skipped')::int as conducted_count,
        COUNT(*) FILTER (WHERE status = 'skipped')::int as skipped_count
      FROM public.practical_logs pl
      ${baseWhere}
    `
    const countRes = await pool.query(countSql, params)
    const counts = countRes.rows[0] || { total_count: 0, conducted_count: 0, skipped_count: 0 }

    // If specific date requested, fetch exactly that date
    if (filters?.date) {
      const dateParams = [...params, filters.date]
      const dateWhere = whereClauses.length > 0
        ? `WHERE ${whereClauses.join(' AND ')} AND pl.date = $${dateParams.length}`
        : `WHERE pl.date = $${dateParams.length}`

      const dateQuery = `
        SELECT 
          pl.*,
          pl.date::text as date,
          pl.created_at::text as created_at,
          row_to_json(l.*) as labs,
          json_build_object('id', p.id, 'full_name', p.full_name) as profiles
        FROM public.practical_logs pl
        LEFT JOIN public.labs l ON pl.lab_id = l.id
        LEFT JOIN public.profiles p ON pl.teacher_id = p.id
        ${dateWhere}
        ORDER BY pl.created_at DESC
      `
      const dateRes = await pool.query(dateQuery, dateParams)
      const list: any = (dateRes.rows || []).map(normalizePracticalLogRow)
      list.totalCount = counts.total_count
      list.conductedCount = counts.conducted_count
      list.skippedCount = counts.skipped_count
      list.logs = list
      return list
    }

    // Two-Phase Query: Date-locked logs for activeDate + windowed historical logs
    const todayParams = [...params, activeDate]
    const todayWhere = whereClauses.length > 0
      ? `WHERE ${whereClauses.join(' AND ')} AND pl.date = $${todayParams.length}`
      : `WHERE pl.date = $${todayParams.length}`

    const todayQuery = `
      SELECT 
        pl.*,
        pl.date::text as date,
        pl.created_at::text as created_at,
        row_to_json(l.*) as labs,
        json_build_object('id', p.id, 'full_name', p.full_name) as profiles
      FROM public.practical_logs pl
      LEFT JOIN public.labs l ON pl.lab_id = l.id
      LEFT JOIN public.profiles p ON pl.teacher_id = p.id
      ${todayWhere}
      ORDER BY pl.created_at DESC
    `

    const histParams = [...params, limit, offset]
    const histLimitParam = `$${histParams.length - 1}`
    const histOffsetParam = `$${histParams.length}`

    const histQuery = `
      SELECT 
        pl.*,
        pl.date::text as date,
        pl.created_at::text as created_at,
        row_to_json(l.*) as labs,
        json_build_object('id', p.id, 'full_name', p.full_name) as profiles
      FROM public.practical_logs pl
      LEFT JOIN public.labs l ON pl.lab_id = l.id
      LEFT JOIN public.profiles p ON pl.teacher_id = p.id
      ${baseWhere}
      ORDER BY pl.date DESC, pl.created_at DESC
      LIMIT ${histLimitParam} OFFSET ${histOffsetParam}
    `

    const [todayRes, histRes] = await Promise.all([
      pool.query(todayQuery, todayParams),
      pool.query(histQuery, histParams),
    ])

    // Merge and deduplicate by ID, keeping today's rows at the top
    const seenIds = new Set<string>()
    const mergedList: any[] = []

    for (const row of todayRes.rows || []) {
      if (!seenIds.has(row.id)) {
        seenIds.add(row.id)
        mergedList.push(normalizePracticalLogRow(row))
      }
    }

    for (const row of histRes.rows || []) {
      if (!seenIds.has(row.id)) {
        seenIds.add(row.id)
        mergedList.push(normalizePracticalLogRow(row))
      }
    }

    const returnResult: any = mergedList
    returnResult.totalCount = counts.total_count
    returnResult.conductedCount = counts.conducted_count
    returnResult.skippedCount = counts.skipped_count
    returnResult.logs = mergedList
    return returnResult
  } catch (pgErr) {
    console.warn('[getPracticalLogs] PG pool fast-path failed, falling back to Supabase SDK:', pgErr)
  }

  const store = getStore()
  let list = [...store]

  // If Supabase is configured, try querying remote logs
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      let query = supabase
        .from('practical_logs')
        .select(`*, labs (id, name, type), profiles (id, full_name)`)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

      if (filters?.lab_id && filters.lab_id !== 'all') {
        query = query.eq('lab_id', filters.lab_id)
      }
      if (filters?.date) {
        query = query.eq('date', filters.date)
      }
      if (filters?.search && filters.search.trim().length > 0) {
        const cleanSearch = filters.search.trim().replace(/[%_]/g, '')
        query = query.or(
          `subject_name.ilike.%${cleanSearch}%,practical_title.ilike.%${cleanSearch}%,batch_group.ilike.%${cleanSearch}%`
        )
      }

      // Context-First Scoping at Supabase query layer
      if (shouldScopeToMyData && userScope.userId) {
        query = query.or(`teacher_id.eq.${userScope.userId},logged_by.eq.${userScope.userId}`)
      } else if (filters?.teacher_id && filters.teacher_id !== 'all') {
        query = query.eq('teacher_id', filters.teacher_id)
      }

      const { data, error } = await query
      if (!error && data) {
        return data as any[]
      }
    } catch (e) {}
  }

  // In-memory store fallback with contextual scoping
  if (filters?.lab_id && filters.lab_id !== 'all') {
    const target = filters.lab_id.toLowerCase()
    list = list.filter(
      (l) =>
        l.lab_id.toLowerCase().includes(target) ||
        (l.labs?.id && l.labs.id.toLowerCase().includes(target)) ||
        (l.labs?.name && l.labs.name.toLowerCase().includes(target))
    )
  }

  if (filters?.date) {
    list = list.filter((l) => l.date === filters.date)
  }

  if (filters?.search && filters.search.trim().length > 0) {
    const q = filters.search.toLowerCase()
    list = list.filter(
      (l) =>
        l.subject_name.toLowerCase().includes(q) ||
        l.practical_title.toLowerCase().includes(q) ||
        l.batch_group.toLowerCase().includes(q)
    )
  }

  if (shouldScopeToMyData) {
    const teacherNames = [
      userScope.fullName,
      userScope.teacherProfile?.name,
      userScope.email?.split('@')[0],
    ]
      .filter(Boolean)
      .map((n) => n!.toLowerCase())

    list = list.filter((l) => {
      if (userScope.userId && (l.teacher_id === userScope.userId || l.logged_by === userScope.userId)) return true
      const profName = (l.profiles?.full_name || l.teacher || '').toLowerCase()
      return teacherNames.some((tn) => profName.includes(tn) || tn.includes(profName))
    })
  } else if (filters?.teacher_id && filters.teacher_id !== 'all') {
    list = list.filter((l) => l.teacher_id === filters.teacher_id || l.profiles?.id === filters.teacher_id)
  }

  return list
}

export async function getTodayLogStats(dateStr?: string, viewMode?: 'my_data' | 'all') {
  const userScope = await getServerUserScope()
  if (userScope.isPending || userScope.approvalStatus !== 'approved') {
    return {
      totalLogsToday: 0,
      totalStudentsAttended: 0,
      conductedCount: 0,
      skippedCount: 0,
      logs: [],
      userScope,
    }
  }
  const isPrivileged = userScope.isPrivileged
  const shouldScopeToMyData = !isPrivileged || viewMode === 'my_data'

  const store = getStore()
  const targetDate = dateStr || new Date().toISOString().split('T')[0]
  let todayList = store.filter((l) => l.date === targetDate)

  if (shouldScopeToMyData) {
    const teacherNames = [
      userScope.fullName,
      userScope.teacherProfile?.name,
    ]
      .filter(Boolean)
      .map((n) => n!.toLowerCase())

    todayList = todayList.filter((l) => {
      if (userScope.userId && (l.teacher_id === userScope.userId || l.logged_by === userScope.userId)) return true
      const profName = (l.profiles?.full_name || l.teacher || '').toLowerCase()
      return teacherNames.some((tn) => profName.includes(tn) || tn.includes(profName))
    })
  }

  const conducted = todayList.filter((l) => l.status !== 'skipped')
  const totalStudents = conducted.reduce((acc, curr) => acc + (curr.present_students || 0), 0)

  return {
    totalLogsToday: todayList.length,
    totalStudentsAttended: totalStudents,
    conductedCount: conducted.length,
    skippedCount: todayList.length - conducted.length,
    logs: todayList,
    userScope,
  }
}

export async function getScopedLogFormOptions() {
  const scope = await getServerUserScope()
  return {
    scope,
    isPrivileged: scope.isPrivileged,
    isTeacher: scope.isTeacher,
    assignedClasses: scope.assignedClasses,
    assignedSubjects: scope.assignedSubjects,
    assignedLabIds: scope.assignedLabIds,
    teacher: {
      id: scope.userId || scope.teacherProfile?.teacherId || '',
      name: scope.fullName || scope.teacherProfile?.name || 'Assigned Subject Teacher',
      email: scope.email,
    },
  }
}

export async function deletePracticalLog(id: string): Promise<{ success: boolean; error?: string }> {
  const userScope = await getServerUserScope()
  if (userScope.isPending || userScope.approvalStatus !== 'approved') {
    return { success: false, error: 'Permission denied: Your account is pending verification and cannot delete records.' }
  }
  const isPrivileged = userScope.isPrivileged

  const pool = getPgPool()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // 1. Fetch practical log record from PostgreSQL
    const logRes = await client.query(`
      SELECT pl.id, pl.teacher_id, pl.logged_by, pl.remarks, pl.status, pl.subject_name, pl.practical_title
      FROM public.practical_logs pl
      WHERE pl.id = $1;
    `, [id])

    const existingRecord = logRes.rows[0]

    if (existingRecord) {
      if (!isPrivileged) {
        const isOwner =
          Boolean(userScope.userId && (existingRecord.teacher_id === userScope.userId || existingRecord.logged_by === userScope.userId))

        if (!isOwner) {
          await client.query('ROLLBACK')
          return { success: false, error: 'Permission denied: You can only delete your own practical session records.' }
        }

        // Verification safety guard: prevent non-admins from deleting verified/signed-off logs
        const isVerified = (existingRecord.remarks && existingRecord.remarks.toLowerCase().includes('verified')) || existingRecord.status === 'verified'
        if (isVerified) {
          await client.query('ROLLBACK')
          return { success: false, error: 'Cannot delete practical session: Session has already received administrative verification sign-off.' }
        }
      }

      // 2. Unlink any seat overrides associated with this practical log
      await client.query(`
        UPDATE public.session_seat_overrides 
        SET practical_log_id = NULL 
        WHERE practical_log_id = $1;
      `, [id])

      // 3. Delete attendance logs
      await client.query(`
        DELETE FROM public.log_attendance 
        WHERE log_id = $1;
      `, [id])

      // 4. Delete practical log
      await client.query(`
        DELETE FROM public.practical_logs 
        WHERE id = $1;
      `, [id])
    }

    await client.query('COMMIT')

    // Clean in-memory store
    const store = getStore()
    globalThis.__PRACTICAL_LOGS_STORE__ = store.filter((l) => l.id !== id)

    // Sync with Supabase client if configured
    if (isSupabaseConfigured()) {
      try {
        const supabase = await createClient()
        await supabase.from('practical_logs').delete().eq('id', id)
      } catch (e) {}
    }

    safeRevalidatePaths(['/records', '/records/new', '/print/records', '/print/daily-log', '/', '/schedules', '/computer-lab'])
    return { success: true }
  } catch (err: unknown) {
    await client.query('ROLLBACK').catch(() => {})
    const msg = err instanceof Error ? err.message : 'Unknown deletion error'
    console.error('deletePracticalLog failed:', msg)
    return { success: false, error: msg }
  } finally {
    client.release()
  }
}

export async function getActiveLabs(): Promise<LabRow[]> {
  try {
    const pool = getPgPool()
    const res = await pool.query(`
      SELECT id, name, code, capacity, type, status, is_active
      FROM public.labs
      WHERE is_active = true
      ORDER BY name ASC;
    `)

    if (res.rows) {
      return res.rows as LabRow[]
    }

    if (isSupabaseConfigured()) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('labs')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (!error && data) {
        return data as LabRow[]
      }
    }

    return []
  } catch (e) {
    console.error('Failed to get active labs:', e)
    return []
  }
}

export async function getTeachers() {
  try {
    const pool = getPgPool()
    const res = await pool.query(`
      SELECT id, full_name, email, role
      FROM public.profiles
      WHERE approval_status = 'approved'
        AND is_active = true
        AND role IN ('teacher', 'lab_incharge')
      ORDER BY full_name ASC;
    `)

    if (res.rows) {
      return res.rows.map((r: any) => ({
        id: String(r.id),
        full_name: String(r.full_name),
        email: r.email ? String(r.email) : undefined,
        role: String(r.role),
      }))
    }

    // Fallback to Supabase client if direct pool returned no rows
    if (isSupabaseConfigured()) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('approval_status', 'approved')
        .eq('is_active', true)
        .in('role', ['teacher', 'lab_incharge'])
        .order('full_name')

      if (!error && data) {
        return data as any[]
      }
    }

    return []
  } catch (e) {
    console.error('Failed to get teachers:', e)
    return []
  }
}
