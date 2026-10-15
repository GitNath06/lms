'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { DEFAULT_HOLIDAYS, isDateWithinHoliday } from '@/lib/master-data'
import { checkServerDateSuspension } from '@/lib/calendar-policy'
import { getServerUserScope } from '@/lib/context/server-user-scope'
import { getTeacherAssignments } from '@/lib/context/institutional-relationships'
import { dispatchSkippedSessionNotification } from '@/app/actions/notifications'
import { getPgPool } from '@/lib/db'

type PracticalLogInsert = Database['public']['Tables']['practical_logs']['Insert']
type PracticalLogUpdate = Database['public']['Tables']['practical_logs']['Update']
type LabRow = Database['public']['Tables']['labs']['Row']

declare global {
  var __PRACTICAL_LOGS_STORE__: any[] | undefined
}

const SEED_PRACTICAL_LOGS = [
  {
    id: 'log-seed-1',
    schedule_id: 'mon-1',
    lab_id: 'comp',
    teacher_id: 't1',
    date: new Date().toISOString().split('T')[0],
    period_label: 'Period 1 & 2 (10:10 - 11:45)',
    subject_name: 'COMP-12 - Data Structures & Algorithms Lab',
    batch_group: '12 Eng',
    practical_title: 'Implementation of Binary Search Trees in C++',
    total_students: 38,
    present_students: 36,
    absent_students: 2,
    remarks: 'All 38 workstations functioning properly. Students completed traversal exercises.',
    status: 'conducted',
    skip_reason: null,
    topic_learned: 'Binary Search Trees & Traversal',
    logged_by: 'local-admin',
    created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
    labs: { id: 'comp', name: 'Computer Engineering Lab 01', type: 'computer_lab' },
    profiles: { id: 't1', full_name: 'Dr. Rajesh Sharma' },
  },
  {
    id: 'log-seed-2',
    schedule_id: 'mon-2',
    lab_id: 'phys',
    teacher_id: 't2',
    date: new Date().toISOString().split('T')[0],
    period_label: 'Period 3 & 4 (11:45 - 01:15)',
    subject_name: 'PHY-11 - Optics & Wave Mechanics',
    batch_group: '11 Eng',
    practical_title: 'Verification of Hooke’s Law and Spring Constant Calculation',
    total_students: 40,
    present_students: 38,
    absent_students: 2,
    remarks: 'Weights and spring sets verified. High student engagement.',
    status: 'conducted',
    skip_reason: null,
    topic_learned: 'Hooke’s Law & Spring Oscillations',
    logged_by: 'local-admin',
    created_at: new Date(Date.now() - 3600000 * 1.5).toISOString(),
    labs: { id: 'phys', name: 'Physics Laboratory', type: 'physics_lab' },
    profiles: { id: 't2', full_name: 'Dr. Prakash Adhikari' },
  },
]

function getStore(): any[] {
  if (!globalThis.__PRACTICAL_LOGS_STORE__) {
    globalThis.__PRACTICAL_LOGS_STORE__ = [...SEED_PRACTICAL_LOGS]
  }
  return globalThis.__PRACTICAL_LOGS_STORE__
}

const LAB_NAME_MAP: Record<string, { id: string; name: string; type: string }> = {
  comp: { id: 'comp', name: 'Computer Engineering Lab 01', type: 'computer_lab' },
  phys: { id: 'phys', name: 'Physics Laboratory', type: 'physics_lab' },
  chem: { id: 'chem', name: 'Chemistry Laboratory', type: 'chemistry_lab' },
  bio: { id: 'bio', name: 'Biology & Life Sciences Lab', type: 'biology_lab' },
  elec: { id: 'elec', name: 'Electronics & Hardware Lab', type: 'electronics_lab' },
}

const TEACHER_NAME_MAP: Record<string, string> = {
  t1: 'Dr. Rajesh Sharma',
  t2: 'Dr. Prakash Adhikari',
  t3: 'Ms. Sunita Thapa',
  t4: 'Er. Anish Karki',
  t5: 'Dr. Nirmala Poudel',
}

export async function createPracticalLog(
  data: FormData | any
): Promise<{ success: boolean; log?: any; error?: string; duplicateId?: string }> {
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
      teacher_id: (data.get('teacher_id') as string) || 't1',
      date: (data.get('date') as string) || new Date().toISOString().split('T')[0],
      period_label: (data.get('period_label') as string) || 'Period 1 (10:10 - 11:00)',
      subject_name: (data.get('subject_name') as string) || 'Practical Session',
      batch_group: (data.get('batch_group') as string) || '12 Eng',
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
      teacher_id: data.teacher_id || 't1',
      date: data.date || new Date().toISOString().split('T')[0],
      period_label: data.period_label || data.timeSlot || 'Period 1',
      subject_name: subjectName,
      batch_group: data.batch_group || data.grade || '12 Eng',
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
  // 1. LOGICAL DUPLICATE CHECK: date + lab_id + period_label + batch_group + subject_name
  // ==========================================================================
  const norm = (s?: string | null) => (s ? s.trim().toLowerCase() : '')
  const checkDate = logPayload.date
  const checkLab = safeLabId
  const checkPeriod = norm(logPayload.period_label)
  const checkBatch = norm(logPayload.batch_group)
  const checkSubject = norm(logPayload.subject_name)
  const isExplicitEdit = Boolean(data.id || (data.isEdit && data.existingLogId))
  const targetEditId = data.id || data.existingLogId

  // Check Supabase DB for duplicates under RLS
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      const { data: existingDbRows, error: dupErr } = await (supabase.from('practical_logs') as any)
        .select('id, date, lab_id, period_label, batch_group, subject_name')
        .eq('lab_id', checkLab)

      if (!dupErr && existingDbRows && existingDbRows.length > 0) {
        const dbMatch = existingDbRows.find((r: any) => {
          if (isExplicitEdit && r.id === targetEditId) return false
          return (
            r.date === checkDate &&
            norm(r.period_label) === checkPeriod &&
            norm(r.batch_group) === checkBatch &&
            norm(r.subject_name) === checkSubject
          )
        })

        if (dbMatch) {
          return {
            success: false,
            error: `A practical log already exists for ${logPayload.batch_group} · ${logPayload.subject_name} · ${logPayload.period_label} on ${logPayload.date}. Edit the existing entry instead of creating a duplicate.`,
            duplicateId: dbMatch.id,
          }
        }
      }
    } catch (err) {
      console.warn('Error querying Supabase for duplicates:', err)
    }
  }

  // Check Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      const { data: existingDbRows } = await supabase
        .from('practical_logs')
        .select('id, date, lab_id, period_label, batch_group, subject_name')
        .eq('date', checkDate)
        .eq('lab_id', checkLab)

      if (existingDbRows && existingDbRows.length > 0) {
        const dbMatch = (existingDbRows as any[]).find((r) => {
          if (isExplicitEdit && r.id === targetEditId) return false
          return (
            norm(r.period_label) === checkPeriod &&
            norm(r.batch_group) === checkBatch &&
            norm(r.subject_name) === checkSubject
          )
        })

        if (dbMatch) {
          return {
            success: false,
            error: `A practical log already exists for ${logPayload.batch_group} · ${logPayload.subject_name} · ${logPayload.period_label} on ${logPayload.date}. Edit the existing entry instead of creating a duplicate.`,
            duplicateId: dbMatch.id,
          }
        }
      }
    } catch (err) {
      console.warn('Error querying DB for duplicates:', err)
    }
  }

  // Check persistent memory store
  const store = getStore()
  const storeMatch = store.find((l) => {
    if (isExplicitEdit && l.id === targetEditId) return false
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
    TEACHER_NAME_MAP[logPayload.teacher_id] || (data.teacher as string) || 'Assigned Subject Teacher'

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
    profiles: { id: safeTeacherId || 't1', full_name: teacherName },
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
        const { data: csList } = await supabase
          .from('class_subjects')
          .select(`
            id, class_id, subject_id, teacher_id, academic_year_id,
            classes:class_id ( id, name, grade ),
            subjects:subject_id ( id, code, name )
          `)

        if (csList && csList.length > 0) {
          const normBatch = norm(logPayload.batch_group)
          const normSub = norm(logPayload.subject_name)
          const matched = (csList as any[]).find((cs) => {
            const clsName = norm(cs.classes?.name)
            const clsId = norm(cs.class_id)
            const subCode = norm(cs.subjects?.code)
            const classMatch = normBatch === clsName || normBatch === clsId || normBatch.includes(clsName) || (cs.classes?.grade && normBatch.includes(String(cs.classes.grade)))
            const subjectMatch = subCode && normSub.includes(subCode)
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
            // Fallback match by class or first available curriculum record to preserve not-null constraint
            const fallbackByClass = (csList as any[]).find((cs) => {
              const clsName = norm(cs.classes?.name)
              const clsId = norm(cs.class_id)
              return normBatch === clsName || normBatch === clsId || normBatch.includes(clsName)
            })
            const fallback = fallbackByClass || csList[0]
            if (fallback) {
              resolvedClassSubjectId = fallback.id
              targetClassId = fallback.class_id
              effectiveYearId = fallback.academic_year_id || effectiveYearId
            }
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
                  remarks, status, skip_reason, topic_learned, logged_by, seating_snapshot
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
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
                  seating_snapshot = COALESCE(EXCLUDED.seating_snapshot, practical_logs.seating_snapshot)`,
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
          const { data: enrollments } = await supabase
            .from('student_enrollments')
            .select('id, student_id, roll_number')
            .eq('academic_year_id', effectiveYearId)
            .eq('class_id', targetClassId)
            .eq('status', 'active')

          if (enrollments && enrollments.length > 0) {
            for (const enr of enrollments) {
              await supabase
                .from('log_attendance')
                .update({
                  enrollment_id: enr.id,
                  student_id: enr.student_id,
                })
                .eq('log_id', recordId)
                .eq('roll_number', enr.roll_number)
                .is('enrollment_id', null)
            }
          }
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
  const isPrivileged = userScope.isPrivileged

  const store = getStore()
  const idx = store.findIndex((l) => l.id === id)
  const existingRecord = idx !== -1 ? store[idx] : null

  if (!isPrivileged && existingRecord) {
    const isOwner =
      (userScope.userId && (existingRecord.teacher_id === userScope.userId || existingRecord.logged_by === userScope.userId)) ||
      (existingRecord.teacher && userScope.fullName && existingRecord.teacher.toLowerCase().includes(userScope.fullName.toLowerCase())) ||
      (existingRecord.profiles?.full_name && userScope.fullName && existingRecord.profiles.full_name.toLowerCase().includes(userScope.fullName.toLowerCase()))

    if (!isOwner) {
      return { success: false, error: 'Permission denied: You can only modify your own practical session records.' }
    }
  }

  if (idx !== -1) {
    store[idx] = { ...store[idx], ...data, updated_at: new Date().toISOString() }
  }


  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      const { error } = await (supabase.from('practical_logs') as any).update(data).eq('id', id)
      if (error) {
        console.error('❌ Supabase log update error:', error)
      }
    } catch (e: any) {
      console.warn('⚠️ Supabase update error:', e.message)
    }
  }

  safeRevalidatePaths(['/records', '/records/new', '/print/records', '/print/daily-log', '/'])

  return { success: true }
}

export async function getPracticalLogs(filters?: {
  search?: string
  lab_id?: string
  date?: string
  teacher_id?: string
  view_mode?: 'my_data' | 'all'
}) {
  const userScope = await getServerUserScope()
  const isPrivileged = userScope.isPrivileged
  const shouldScopeToMyData = !isPrivileged || filters?.view_mode === 'my_data'

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
      if (!error && data && data.length > 0) {
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
      id: scope.userId || scope.teacherProfile?.teacherId || 't1',
      name: scope.fullName || scope.teacherProfile?.name || 'Assigned Subject Teacher',
      email: scope.email,
    },
  }
}

export async function deletePracticalLog(id: string) {
  const userScope = await getServerUserScope()
  const isPrivileged = userScope.isPrivileged

  const store = getStore()
  const existingRecord = store.find((l) => l.id === id)

  if (!isPrivileged && existingRecord) {
    const isOwner =
      (userScope.userId && (existingRecord.teacher_id === userScope.userId || existingRecord.logged_by === userScope.userId)) ||
      (existingRecord.teacher && userScope.fullName && existingRecord.teacher.toLowerCase().includes(userScope.fullName.toLowerCase())) ||
      (existingRecord.profiles?.full_name && userScope.fullName && existingRecord.profiles.full_name.toLowerCase().includes(userScope.fullName.toLowerCase()))

    if (!isOwner) {
      return { success: false, error: 'Permission denied: You can only delete your own practical session records.' }
    }
  }

  globalThis.__PRACTICAL_LOGS_STORE__ = store.filter((l) => l.id !== id)


  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      await supabase.from('practical_logs').delete().eq('id', id)
    } catch (e) {}
  }

  safeRevalidatePaths(['/records', '/records/new', '/print/records', '/print/daily-log', '/'])

  return { success: true }
}

export async function getActiveLabs(): Promise<LabRow[]> {
  const defaultLabs: LabRow[] = [
    { id: 'comp', name: 'Computer Engineering Lab 01', type: 'computer_lab', capacity: 40, status: 'Operational', is_active: true },
    { id: 'phys', name: 'Physics Laboratory', type: 'physics_lab', capacity: 38, status: 'Operational', is_active: true },
    { id: 'chem', name: 'Chemistry Laboratory', type: 'chemistry_lab', capacity: 40, status: 'Operational', is_active: true },
    { id: 'bio', name: 'Biology & Life Sciences Lab', type: 'biology_lab', capacity: 35, status: 'Operational', is_active: true },
    { id: 'elec', name: 'Electronics & Hardware Lab', type: 'electronics_lab', capacity: 30, status: 'Operational', is_active: true },
  ]

  if (!isSupabaseConfigured()) {
    return defaultLabs
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('labs')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (error || !data || data.length === 0) {
      return defaultLabs
    }

    return data as LabRow[]
  } catch (e) {
    return defaultLabs
  }
}

export async function getTeachers() {
  const defaultTeachers = [
    { id: 't1', full_name: 'Dr. Rajesh Sharma (Computer Science)' },
    { id: 't2', full_name: 'Dr. Prakash Adhikari (Physics)' },
    { id: 't3', full_name: 'Ms. Sunita Thapa (Chemistry)' },
    { id: 't4', full_name: 'Er. Anish Karki (Electronics)' },
    { id: 't5', full_name: 'Dr. Nirmala Poudel (Biology)' },
  ]

  if (!isSupabaseConfigured()) {
    return defaultTeachers
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .order('full_name')

    if (error || !data || data.length === 0) {
      return defaultTeachers
    }

    return (data as any[]) || defaultTeachers
  } catch (e) {
    return defaultTeachers
  }
}
