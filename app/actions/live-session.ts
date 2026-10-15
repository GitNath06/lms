'use server'

import { createClient } from '@/lib/supabase/server'
import { getServerUserScope } from '@/lib/context/server-user-scope'
import { revalidatePath } from 'next/cache'
import { checkSchedulingConflicts } from '@/lib/scheduling/conflict-engine'
import { recordAuditEvent, recordSeatSwapAudit } from '@/lib/audit/audit-ledger'
import { checkServerDateSuspension } from '@/lib/calendar-policy'
import type { SeatingSnapshotEntry } from '@/lib/types/seat-plans'

export type { SeatingSnapshotEntry }

export interface LiveSessionContext {
  scheduleId: string
  classSubjectId: string
  classId: string
  className: string
  grade: number
  section?: string
  subjectId: string
  subjectCode: string
  subjectName: string
  labId: string
  labName: string
  academicYearId: string
  academicYearName: string
  sessionTeacherId: string
  curriculumTeacherId: string
  sessionTeacherName: string
  startTime: string
  endTime: string
  dayKey: string
  date: string
  isAdHoc: boolean
  isPrivileged: boolean
  isTeacher: boolean
  canEdit: boolean
  expectedRoster: Array<{
    enrollmentId: string
    studentId: string
    rollNumber: number
    fullName: string
    admissionNo: string
    gender?: string
    photoUrl?: string | null
    status: string
  }>
  seatPlan: Record<string, {
    enrollmentId: string
    studentId: string
    rollNumber: number
    fullName: string
    photoUrl?: string | null
    isOverride: boolean
    originalWorkstationLabel?: string | null
    originalWorkstationId?: string | null
  }>
  existingLog?: {
    id: string
    practicalTitle: string
    presentStudents: number
    absentStudents: number
    absentRolls: number[]
    createdAt: string
    isLocked: boolean
    hoursRemainingInEditWindow: number
    status?: string | null
    skipReason?: string | null
    seatingSnapshot?: SeatingSnapshotEntry[] | null
  } | null
  existingAttendance?: Record<number, boolean>
}

/**
 * 5.1 Live Session Context Resolver
 * Derives complete relational bundle from scheduleId with zero string guessing.
 */
export async function getLiveSessionContext(
  scheduleId: string,
  sessionDate?: string
): Promise<{ success: boolean; data?: LiveSessionContext; error?: string }> {
  try {
    const supabase = await createClient()
    const scope = await getServerUserScope()

    // 1. Fetch schedule and join relational chain
    const { data: sched, error: schedErr } = await (supabase
      .from('schedules') as any)
      .select(`
        id, lab_id, teacher_id, start_time, end_time, day_key, class_subject_id, academic_year_id,
        class_subjects:class_subject_id (
          id, class_id, subject_id, teacher_id, academic_year_id,
          classes:class_id ( id, name, grade, section ),
          subjects:subject_id ( id, code, name ),
          academic_years:academic_year_id ( id, name, is_current ),
          profiles:teacher_id ( id, full_name )
        ),
        labs:lab_id ( id, name )
      `)
      .eq('id', scheduleId)
      .maybeSingle()

    if (schedErr || !sched) {
      return { success: false, error: 'Schedule slot not found or inaccessible.' }
    }

    const cs = sched.class_subjects
    if (!cs) {
      return { success: false, error: 'Curriculum assignment (class_subject) missing for this schedule.' }
    }

    const cls = cs.classes
    const sub = cs.subjects
    const ay = cs.academic_years
    const lab = sched.labs

    const classId = cs.class_id
    const academicYearId = cs.academic_year_id || sched.academic_year_id || '2083'

    // Verify teacher scope: If user is teacher, must teach this class/subject or be session teacher
    if (scope.isTeacher && !scope.isPrivileged) {
      const isAssignedCurriculum = cs.teacher_id === scope.userId
      const isAssignedSession = sched.teacher_id === scope.userId
      const hasClassAccess = scope.assignedClasses.includes(cls?.name || classId)
      if (!isAssignedCurriculum && !isAssignedSession && !hasClassAccess) {
        return { success: false, error: 'Access denied: You are not assigned to conduct or manage this session.' }
      }
    }

    // Resolve session teacher profile name
    let sessionTeacherName = 'Assigned Faculty'
    if (sched.teacher_id) {
      const { data: prof } = await (supabase
        .from('profiles') as any)
        .select('full_name')
        .eq('id', sched.teacher_id)
        .maybeSingle()
      if (prof?.full_name) {
        sessionTeacherName = prof.full_name
      }
    } else if (cs.profiles?.full_name) {
      sessionTeacherName = cs.profiles.full_name
    }

    // 2. Fetch Expected Roster from student_enrollments
    const { data: enrollmentsData, error: enrErr } = await (supabase
      .from('student_enrollments') as any)
      .select(`
        id, student_id, roll_number, status,
        students:student_id ( id, full_name, admission_no, gender, photo_url )
      `)
      .eq('class_id', classId)
      .eq('academic_year_id', academicYearId)
      .eq('status', 'active')
      .order('roll_number', { ascending: true })

    if (enrErr) {
      return { success: false, error: 'Failed to retrieve cohort roster.' }
    }

    const expectedRoster = (enrollmentsData || []).map((e: any) => ({
      enrollmentId: e.id,
      studentId: e.student_id,
      rollNumber: e.roll_number,
      fullName: e.students?.full_name || `Roll ${e.roll_number}`,
      admissionNo: e.students?.admission_no || '',
      gender: e.students?.gender,
      photoUrl: e.students?.photo_url || null,
      status: e.status,
    }))

    // Build enrollment map for lookup
    const enrollmentMap = new Map<string, typeof expectedRoster[0]>()
    expectedRoster.forEach((s: typeof expectedRoster[0]) => enrollmentMap.set(s.enrollmentId, s))

    // Fetch lab workstation labels for human-readable relocation tracking
    const { data: labWorkstations } = await (supabase
      .from('workstations') as any)
      .select('id, label')
      .eq('lab_id', sched.lab_id)

    const wsLabelMap = new Map<string, string>(
      (labWorkstations || []).map((w: any) => [w.id, w.label])
    )

    // 3. Fetch Tier 1 Baseline Seat Plan
    const { data: tier1Data } = await (supabase
      .from('workstation_seat_plans') as any)
      .select('workstation_id, enrollment_id')
      .eq('class_id', classId)
      .eq('academic_year_id', academicYearId)

    const effectiveSeatPlan: LiveSessionContext['seatPlan'] = {}
    const studentBaselineWsMap = new Map<string, string>()

    if (tier1Data) {
      for (const row of tier1Data as any[]) {
        const student = enrollmentMap.get(row.enrollment_id)
        if (student) {
          studentBaselineWsMap.set(student.enrollmentId, row.workstation_id)
          effectiveSeatPlan[row.workstation_id] = {
            enrollmentId: student.enrollmentId,
            studentId: student.studentId,
            rollNumber: student.rollNumber,
            fullName: student.fullName,
            photoUrl: student.photoUrl,
            isOverride: false,
            originalWorkstationLabel: wsLabelMap.get(row.workstation_id) || null,
            originalWorkstationId: row.workstation_id,
          }
        }
      }
    }

    // 4. Fetch Tier 2 Session Overrides (if session date is specified)
    const activeDate = sessionDate || new Date().toISOString().split('T')[0]

    // Authoritative Server-Side Holiday & Recess Guard
    const suspension = await checkServerDateSuspension(activeDate)
    if (suspension.isSuspended) {
      return {
        success: false,
        error: `Session locked: ${activeDate} is designated as an institutional ${suspension.type === 'holiday' ? 'holiday' : 'recess'} (${suspension.title}). Laboratory practical operations and attendance tracking are suspended.`,
      }
    }
    const { data: tier2Data } = await (supabase
      .from('session_seat_overrides') as any)
      .select('workstation_id, enrollment_id')
      .eq('schedule_id', scheduleId)
      .eq('session_date', activeDate)

    if (tier2Data) {
      for (const override of tier2Data as any[]) {
        const student = enrollmentMap.get(override.enrollment_id)
        if (student) {
          const originalWsId = studentBaselineWsMap.get(student.enrollmentId)
          const originalWsLabel = originalWsId ? wsLabelMap.get(originalWsId) : null

          // CRITICAL INVARIANT: Vacate ANY prior workstation where this student was assigned
          // so the student does not simultaneously appear at both broken PC and temp PC.
          for (const [existingWsId, existingEntry] of Object.entries(effectiveSeatPlan)) {
            if (existingEntry.enrollmentId === student.enrollmentId && existingWsId !== override.workstation_id) {
              delete effectiveSeatPlan[existingWsId]
            }
          }

          effectiveSeatPlan[override.workstation_id] = {
            enrollmentId: student.enrollmentId,
            studentId: student.studentId,
            rollNumber: student.rollNumber,
            fullName: student.fullName,
            photoUrl: student.photoUrl,
            isOverride: true,
            originalWorkstationLabel: originalWsLabel || null,
            originalWorkstationId: originalWsId || null,
          }
        }
      }
    }

    // 5. Check if practical log already exists for this schedule and date
    const { data: existingLogData } = await (supabase
      .from('practical_logs') as any)
      .select('id, practical_title, present_students, absent_students, absent_rolls, created_at, seating_snapshot, status, skip_reason')
      .eq('schedule_id', scheduleId)
      .eq('date', activeDate)
      .maybeSingle()

    let existingLog: LiveSessionContext['existingLog'] = null
    let existingAttendance: Record<number, boolean> | undefined = undefined

    if (existingLogData) {
      const createdAt = new Date(existingLogData.created_at).getTime()
      const now = Date.now()
      const ageHours = (now - createdAt) / (1000 * 60 * 60)
      const isLocked = !scope.isPrivileged && ageHours > 24
      const hoursRemaining = Math.max(0, 24 - ageHours)

      existingLog = {
        id: existingLogData.id,
        practicalTitle: existingLogData.practical_title,
        presentStudents: existingLogData.present_students,
        absentStudents: existingLogData.absent_students,
        absentRolls: existingLogData.absent_rolls || [],
        createdAt: existingLogData.created_at,
        isLocked,
        hoursRemainingInEditWindow: Math.round(hoursRemaining * 10) / 10,
        status: existingLogData.status || null,
        skipReason: existingLogData.skip_reason || null,
        seatingSnapshot: existingLogData.seating_snapshot || null,
      }

      // Fetch attendance rows
      const { data: attRows } = await (supabase
        .from('log_attendance') as any)
        .select('roll_number, is_present')
        .eq('log_id', existingLogData.id)

      if (attRows) {
        existingAttendance = {}
        for (const row of attRows as any[]) {
          existingAttendance[row.roll_number] = row.is_present
        }
      }
    }

    const canEdit = scope.isPrivileged || !existingLog || !existingLog.isLocked

    return {
      success: true,
      data: {
        scheduleId: sched.id,
        classSubjectId: cs.id,
        classId,
        className: cls?.name || classId,
        grade: cls?.grade || 12,
        section: cls?.section,
        subjectId: sub?.id || '',
        subjectCode: sub?.code || '',
        subjectName: sub?.name || '',
        labId: sched.lab_id,
        labName: lab?.name || 'Computer Laboratory',
        academicYearId,
        academicYearName: ay?.name || '2083 B.S. (2026/27 A.D.)',
        sessionTeacherId: sched.teacher_id,
        curriculumTeacherId: cs.teacher_id,
        sessionTeacherName,
        startTime: sched.start_time,
        endTime: sched.end_time,
        dayKey: sched.day_key,
        date: activeDate,
        isAdHoc: sched.id.startsWith('adhoc-'),
        isPrivileged: scope.isPrivileged,
        isTeacher: scope.isTeacher,
        canEdit,
        expectedRoster,
        seatPlan: effectiveSeatPlan,
        existingLog,
        existingAttendance,
      },
    }
  } catch (err: any) {
    console.error('Error resolving live session context:', err)
    return { success: false, error: err.message || 'Internal error resolving live session context.' }
  }
}

/**
 * Ad-Hoc / Makeup Session Fallback
 * Generates an ad-hoc schedule entry linked to canonical class_subjects
 * so the relational pipeline flows without error.
 */
export async function createAdHocSession(params: {
  classSubjectId: string
  labId: string
  startTime: string
  endTime: string
  date: string
  teacherId?: string
}): Promise<{ success: boolean; scheduleId?: string; error?: string }> {
  try {
    const supabase = await createClient()
    const scope = await getServerUserScope()

    if (!scope.isPrivileged && !scope.isTeacher) {
      return { success: false, error: 'Unauthorized: Only faculty members and administrators can start sessions.' }
    }

    // Authoritative Server-Side Holiday & Recess Guard
    const suspension = await checkServerDateSuspension(params.date)
    if (suspension.isSuspended) {
      return {
        success: false,
        error: `Ad-hoc session creation rejected: ${params.date} is an official institutional ${suspension.type === 'holiday' ? 'holiday' : 'recess'} (${suspension.title}). Laboratory practicals are suspended.`,
      }
    }

    // 1. Verify class_subject exists
    const { data: cs, error: csErr } = await (supabase
      .from('class_subjects') as any)
      .select(`
        id, class_id, subject_id, teacher_id, academic_year_id,
        classes:class_id ( name ),
        subjects:subject_id ( name )
      `)
      .eq('id', params.classSubjectId)
      .maybeSingle()

    if (csErr || !cs) {
      return { success: false, error: 'Invalid curriculum assignment (class_subject_id).' }
    }

    // Check teacher scope
    if (scope.isTeacher && !scope.isPrivileged) {
      const isAssigned = cs.teacher_id === scope.userId
      const hasClassAccess = scope.assignedClasses.includes(cs.classes?.name || cs.class_id)
      if (!isAssigned && !hasClassAccess) {
        return { success: false, error: 'Access denied: You are not authorized for this class/subject assignment.' }
      }
    }

    const sessionTeacherId = params.teacherId || scope.userId || cs.teacher_id
    const adHocScheduleId = `adhoc-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`

    // Map date to day_key (sun, mon, tue, wed, thu, fri, sat)
    const dayIndex = new Date(params.date).getDay()
    const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    const dayKey = dayKeys[dayIndex] || 'sun'

    // 2. Triple-Collision Conflict Defense Check
    const conflictCheck = await checkSchedulingConflicts({
      labId: params.labId,
      teacherId: sessionTeacherId,
      classSubjectId: cs.id,
      classId: cs.class_id,
      batchName: cs.classes?.name,
      dayKey,
      startTime: params.startTime,
      endTime: params.endTime,
    })

    if (conflictCheck.hasConflict) {
      return { success: false, error: conflictCheck.message || 'Scheduling conflict detected.' }
    }

    // Create ad-hoc schedule record
    const { error: insErr } = await (supabase
      .from('schedules') as any)
      .insert({
        id: adHocScheduleId,
        lab_id: params.labId,
        teacher_id: sessionTeacherId,
        subject_name: cs.subjects?.name || 'Practical Session',
        batch_name: cs.classes?.name || 'Class Cohort',
        start_time: params.startTime,
        end_time: params.endTime,
        slot_id: 'adhoc',
        day_key: dayKey,
        class_subject_id: cs.id,
        academic_year_id: cs.academic_year_id,
      })

    if (insErr) {
      console.error('Failed to create ad-hoc schedule:', insErr)
      return { success: false, error: 'Failed to initiate ad-hoc session schedule.' }
    }

    // 3. Record Audit Log for Ad-Hoc Session Creation
    await recordAuditEvent({
      action: 'CREATE',
      entityType: 'schedule',
      entityId: adHocScheduleId,
      entityLabel: `Ad-Hoc Session: ${cs.subjects?.name || 'Practical'} (${cs.classes?.name || 'Cohort'}) @ ${params.labId.toUpperCase()}`,
      after: {
        lab_id: params.labId,
        teacher_id: sessionTeacherId,
        start_time: params.startTime,
        end_time: params.endTime,
        is_adhoc: true,
      },
      metadata: {
        is_adhoc: true,
        date: params.date,
      },
    })

    revalidatePath('/computer-lab')
    revalidatePath('/schedules')
    return { success: true, scheduleId: adHocScheduleId }
  } catch (err: any) {
    console.error('Error creating ad-hoc session:', err)
    return { success: false, error: err.message || 'Failed to start ad-hoc session.' }
  }
}

/**
 * 5.4 Submit Live Session Practical Log & In-Seat Attendance
 * Atomically writes practical_logs and batch inserts public.log_attendance
 * with composite foreign key protection.
 */
export async function submitLiveSession(params: {
  scheduleId: string
  practicalTitle: string
  date: string
  attendance: Array<{
    studentId: string
    enrollmentId: string
    rollNumber: number
    isPresent: boolean
  }>
  remarks?: string
}): Promise<{ success: boolean; logId?: string; error?: string }> {
  try {
    const supabase = await createClient()
    const scope = await getServerUserScope()

    // 0. Authoritative Server-Side Holiday & Recess Guard
    const suspension = await checkServerDateSuspension(params.date)
    if (suspension.isSuspended) {
      return {
        success: false,
        error: `Practical log submission rejected: ${params.date} is an official institutional ${suspension.type === 'holiday' ? 'holiday' : 'recess'} (${suspension.title}). Laboratory practicals and attendance tallies are suspended on holidays and scheduled recesses.`,
      }
    }

    // 1. Resolve context to verify permissions and get canonical IDs
    const contextRes = await getLiveSessionContext(params.scheduleId, params.date)
    if (!contextRes.success || !contextRes.data) {
      return { success: false, error: contextRes.error || 'Failed to resolve session context.' }
    }
    const ctx = contextRes.data

    if (!ctx.canEdit) {
      return { success: false, error: 'This session log is finalized and locked. The 24-hour edit window has expired.' }
    }

    const safeTitle = (params.practicalTitle || '').trim() || 'Laboratory Practical Session'
    const totalStudents = params.attendance.length
    const presentStudents = params.attendance.filter((a) => a.isPresent).length
    const absentStudents = totalStudents - presentStudents
    const absentRolls = params.attendance
      .filter((a) => !a.isPresent)
      .map((a) => a.rollNumber)
      .sort((a, b) => a - b)

    // Build frozen session seating snapshot
    const { data: workstations } = await (supabase
      .from('workstations') as any)
      .select('id, label, row_label')
      .eq('lab_id', ctx.labId)
      .eq('is_active', true)
      .order('label', { ascending: true })

    const attendanceMap = new Map<string, boolean>()
    for (const att of params.attendance) {
      if (att.enrollmentId) attendanceMap.set(att.enrollmentId, att.isPresent)
      if (att.studentId) attendanceMap.set(att.studentId, att.isPresent)
      attendanceMap.set(String(att.rollNumber), att.isPresent)
    }

    const seatingSnapshot: SeatingSnapshotEntry[] = (workstations || []).map((ws: any) => {
      const seat = ctx.seatPlan[ws.id]
      if (!seat) {
        return {
          workstation_id: ws.id,
          workstation_label: ws.label,
          row_label: ws.row_label || null,
          student_id: null,
          enrollment_id: null,
          student_name: null,
          roll_number: null,
          is_present: false,
          is_override: false,
          original_workstation_label: null,
          notes: null,
        }
      }

      const isPresent =
        (seat.enrollmentId && attendanceMap.has(seat.enrollmentId) ? attendanceMap.get(seat.enrollmentId) : undefined) ??
        (seat.studentId && attendanceMap.has(seat.studentId) ? attendanceMap.get(seat.studentId) : undefined) ??
        attendanceMap.get(String(seat.rollNumber)) ??
        true

      return {
        workstation_id: ws.id,
        workstation_label: ws.label,
        row_label: ws.row_label || null,
        student_id: seat.studentId,
        enrollment_id: seat.enrollmentId,
        student_name: seat.fullName,
        roll_number: seat.rollNumber,
        is_present: !!isPresent,
        is_override: !!seat.isOverride,
        original_workstation_label: seat.originalWorkstationLabel || null,
        notes: seat.isOverride
          ? seat.originalWorkstationLabel
            ? `Relocated from ${seat.originalWorkstationLabel}`
            : 'Session relocation override'
          : null,
      }
    })

    let logId = ctx.existingLog?.id

    if (logId) {
      // 2A. Update Existing Practical Log (within 24-hr window)
      const { error: updateErr } = await (supabase
        .from('practical_logs') as any)
        .update({
          practical_title: safeTitle,
          total_students: totalStudents,
          present_students: presentStudents,
          absent_students: absentStudents,
          absent_rolls: absentRolls,
          remarks: params.remarks || null,
          topic_learned: safeTitle,
          seating_snapshot: seatingSnapshot,
        })
        .eq('id', logId)

      if (updateErr) {
        return { success: false, error: 'Failed to update practical log record.' }
      }
    } else {
      // 2B. Insert New Practical Log
      logId = `LOG-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`
      const { error: insErr } = await (supabase
        .from('practical_logs') as any)
        .insert({
          id: logId,
          schedule_id: ctx.scheduleId,
          lab_id: ctx.labId,
          teacher_id: ctx.sessionTeacherId,
          date: ctx.date,
          period_label: `${ctx.startTime} – ${ctx.endTime}`,
          subject_name: `${ctx.subjectCode} - ${ctx.subjectName}`,
          batch_group: ctx.className,
          practical_title: safeTitle,
          total_students: totalStudents,
          present_students: presentStudents,
          absent_students: absentStudents,
          absent_rolls: absentRolls,
          remarks: params.remarks || null,
          status: 'conducted',
          topic_learned: safeTitle,
          seating_snapshot: seatingSnapshot,
          class_subject_id: ctx.classSubjectId,
          academic_year_id: ctx.academicYearId,
          logged_by: scope.userId || ctx.sessionTeacherId,
        })

      if (insErr) {
        console.error('Failed to insert practical log:', insErr)
        return { success: false, error: 'Failed to create practical session log.' }
      }
    }

    // 3. Atomically upsert log_attendance records
    const attendanceRecords = params.attendance.map((att) => ({
      id: `${logId}-roll-${att.rollNumber}`,
      log_id: logId,
      enrollment_id: att.enrollmentId,
      student_id: att.studentId,
      roll_number: att.rollNumber,
      is_present: att.isPresent,
    }))

    const { error: attErr } = await (supabase
      .from('log_attendance') as any)
      .upsert(attendanceRecords, { onConflict: 'log_id,roll_number' })

    if (attErr) {
      console.error('Failed to record student attendance:', attErr)
      return { success: false, error: 'Practical log saved, but attendance records failed to sync.' }
    }

    // 4. Record Audit Event for Practical Log & Attendance Submission
    await recordAuditEvent({
      action: ctx.existingLog?.id ? 'UPDATE' : 'CREATE',
      entityType: 'attendance',
      entityId: logId,
      entityLabel: `${ctx.className} - ${ctx.subjectName} (${safeTitle})`,
      before: ctx.existingLog
        ? {
            present_students: ctx.existingLog.presentStudents,
            absent_students: ctx.existingLog.absentStudents,
          }
        : null,
      after: {
        present_students: presentStudents,
        absent_students: absentStudents,
      },
      metadata: {
        schedule_id: ctx.scheduleId,
        lab_id: ctx.labId,
        date: ctx.date,
        total_students: totalStudents,
        present_count: presentStudents,
        absent_count: absentStudents,
      },
    })

    revalidatePath('/computer-lab')
    revalidatePath('/records')
    revalidatePath('/')
    return { success: true, logId }
  } catch (err: any) {
    console.error('Error submitting live session:', err)
    return { success: false, error: err.message || 'Internal error submitting live session.' }
  }
}

/**
 * 5.5 Temporary Session Seat Override
 * Temporarily moves a student from one PC to another for today's session only.
 * Leaves Tier 1 baseline untouched.
 */
export async function assignSessionSeatOverride(params: {
  scheduleId: string
  sessionDate: string
  workstationId: string
  enrollmentId: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const scope = await getServerUserScope()

    if (!scope.isPrivileged && !scope.isTeacher) {
      return { success: false, error: 'Unauthorized to adjust session seating.' }
    }

    // Authoritative Server-Side Holiday & Recess Guard
    const suspension = await checkServerDateSuspension(params.sessionDate)
    if (suspension.isSuspended) {
      return {
        success: false,
        error: `Seat reassignment rejected: ${params.sessionDate} is an official institutional ${suspension.type === 'holiday' ? 'holiday' : 'recess'} (${suspension.title}).`,
      }
    }

    const { error } = await (supabase
      .from('session_seat_overrides') as any)
      .upsert(
        {
          schedule_id: params.scheduleId,
          session_date: params.sessionDate,
          workstation_id: params.workstationId,
          enrollment_id: params.enrollmentId,
          created_by: scope.userId,
        },
        { onConflict: 'schedule_id,session_date,workstation_id' }
      )

    if (error) {
      return { success: false, error: 'Failed to record session seat override.' }
    }

    // Remove any previous temporary relocation for this student on other workstations
    // for this exact session so the student occupies strictly one workstation.
    await (supabase
      .from('session_seat_overrides') as any)
      .delete()
      .eq('schedule_id', params.scheduleId)
      .eq('session_date', params.sessionDate)
      .eq('enrollment_id', params.enrollmentId)
      .neq('workstation_id', params.workstationId)

    // Record Audit Event for Session Seat Override
    await recordSeatSwapAudit({
      scheduleId: params.scheduleId,
      sessionDate: params.sessionDate,
      fromWorkstation: 'Baseline Seat',
      toWorkstation: params.workstationId,
      studentName: `Enrollment ${params.enrollmentId}`,
      rollNumber: 0,
    })

    revalidatePath('/computer-lab')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to record session override.' }
  }
}
