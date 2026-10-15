'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getPgPool } from '@/lib/db'
import { getServerUserScope } from '@/lib/context/server-user-scope'
import { recordAuditEvent } from '@/lib/audit'
import type {
  Student,
  StudentEnrollment,
  StudentWithEnrollment,
  StudentFilterParams,
  UpsertStudentInput,
  EnrollStudentInput,
  CreateStudentWithEnrollmentInput,
} from '@/lib/types/students'

export type {
  Student,
  StudentEnrollment,
  StudentWithEnrollment,
  StudentFilterParams,
  UpsertStudentInput,
  EnrollStudentInput,
  CreateStudentWithEnrollmentInput,
}

/**
 * Checks whether the current user has access to view or manage a class cohort.
 */
function isClassAuthorized(assignedClasses: string[], isPrivileged: boolean, classIdOrName: string): boolean {
  if (isPrivileged) return true
  const norm = (s: string) => s.toLowerCase().replace(/[\s-_]/g, '')
  const target = norm(classIdOrName)
  return assignedClasses.some((c) => norm(c) === target)
}

/**
 * Resolves a class identifier (id or name) to both canonical id and name from public.classes.
 */
async function resolveCanonicalClass(dbOrSupabase: any, classIdOrName: string): Promise<{ id: string; name: string } | null> {
  const norm = (s: string) => s.toLowerCase().trim()
  let classRows: any[] = []
  if (typeof dbOrSupabase?.query === 'function') {
    const res = await dbOrSupabase.query(`SELECT id, name FROM public.classes;`)
    classRows = res.rows || []
  } else if (typeof dbOrSupabase?.from === 'function') {
    const { data } = await dbOrSupabase.from('classes').select('id, name')
    classRows = data || []
  }
  if (!classRows || classRows.length === 0) return null

  const target = norm(classIdOrName)
  const match = classRows.find(
    (c: any) => norm(c.id) === target || norm(c.name) === target || norm(c.id) === target.replace(/[\s-_]/g, '')
  )

  return match || null
}

/**
 * Standardizes revalidation across Admin, Roster, Dashboard, and Workstation views.
 */
function revalidateStudentPaths() {
  revalidatePath('/admin')
  revalidatePath('/admin', 'layout')
  revalidatePath('/maintenance')
  revalidatePath('/maintenance/workstations')
  revalidatePath('/records')
  revalidatePath('/', 'layout')
}

/**
 * Returns students enrolled in a specific class for an academic year, ordered by roll number ascending.
 * Enforces server-side class scope authorization.
 */
export async function getStudentsByClass(params: {
  classId: string
  academicYearId?: string
  statusFilter?: 'active' | 'archived' | 'all'
}): Promise<{ success: boolean; data: StudentWithEnrollment[]; error?: string }> {
  try {
    const scope = await getServerUserScope()

    if (!isClassAuthorized(scope.assignedClasses, scope.isPrivileged, params.classId)) {
      return { success: false, data: [], error: `Access denied: You do not have permission to view roster for ${params.classId}.` }
    }

    const pool = getPgPool()

    // Resolve canonical class ID
    const canonicalClass = await resolveCanonicalClass(pool, params.classId)
    const effectiveClassId = canonicalClass?.id || params.classId

    // Resolve target academic year (default to current active year if unspecified)
    let targetYearId = params.academicYearId
    if (!targetYearId) {
      const yearRes = await pool.query(`SELECT id FROM public.academic_years WHERE is_current = true LIMIT 1;`)
      targetYearId = yearRes.rows[0]?.id
      if (!targetYearId) {
        return { success: false, data: [], error: 'No active academic year configured. Please select or configure an academic year in Settings.' }
      }
    }

    const filter = params.statusFilter || 'active'
    let statusClause = `AND se.status = 'active'`
    if (filter === 'archived') {
      statusClause = `AND se.status = 'archived'`
    } else if (filter === 'all') {
      statusClause = `AND se.status IN ('active', 'archived', 'transferred', 'graduated', 'completed')`
    }

    const query = `
      SELECT 
        se.id AS enrollment_id,
        se.academic_year_id,
        se.class_id,
        se.roll_number,
        se.section,
        se.status AS enrollment_status,
        s.id AS student_id,
        s.admission_no,
        s.registration_no,
        s.full_name,
        s.gender,
        s.is_active,
        s.photo_url,
        w.label AS assigned_workstation_label
      FROM public.student_enrollments se
      JOIN public.students s ON s.id = se.student_id
      LEFT JOIN public.workstation_seat_plans wsp ON wsp.enrollment_id = se.id
      LEFT JOIN public.workstations w ON w.id = wsp.workstation_id
      WHERE se.academic_year_id = $1
        AND se.class_id = $2
        ${statusClause}
      ORDER BY se.roll_number ASC;
    `
    const res = await pool.query(query, [targetYearId, effectiveClassId])

    const formatted: StudentWithEnrollment[] = res.rows.map((row: any) => {
      const wsLabel = row.assigned_workstation_label || null
      return {
        student_id: row.student_id,
        enrollment_id: row.enrollment_id,
        full_name: row.full_name,
        roll_number: row.roll_number,
        admission_no: row.admission_no,
        registration_no: row.registration_no,
        gender: row.gender,
        class_id: row.class_id,
        academic_year_id: row.academic_year_id,
        section: row.section,
        enrollment_status: row.enrollment_status,
        is_active: row.is_active,
        assigned_workstation_label: wsLabel,
        is_unseated: !wsLabel && row.enrollment_status === 'active',
        photo_url: row.photo_url || null,
      }
    })

    return { success: true, data: formatted }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, data: [], error: msg }
  }
}


/**
 * Creates or updates a student person record and enrolls them into a cohort.
 * Privileged users only.
 */
export async function createStudentWithEnrollment(
  input: CreateStudentWithEnrollmentInput
): Promise<{ success: boolean; data?: { studentId: string; enrollmentId: string }; error?: string }> {
  const scope = await getServerUserScope()
  if (!scope.isPrivileged) {
    return { success: false, error: 'Access denied: Only administrators can create and enroll students.' }
  }

  const { student, enrollment } = input
  if (!student.full_name || !student.full_name.trim()) {
    return { success: false, error: 'Student full name is required.' }
  }
  if (!enrollment.academic_year_id || !enrollment.class_id || !enrollment.roll_number) {
    return { success: false, error: 'Academic year, class, and roll number are required.' }
  }

  try {
    const supabase = await createClient()

    // 1. Resolve canonical class ID
    const canonicalClass = await resolveCanonicalClass(supabase, enrollment.class_id)
    const effectiveClassId = canonicalClass?.id || enrollment.class_id

    // Atomic execution via PostgreSQL stored function (guarantees rollback on error)
    const { data: rpcRes, error: rpcErr } = await (supabase.rpc as any)('create_student_with_enrollment_tx', {
      p_full_name: student.full_name.trim(),
      p_academic_year_id: enrollment.academic_year_id,
      p_class_id: effectiveClassId,
      p_roll_number: enrollment.roll_number,
      p_admission_no: student.admission_no?.trim() || null,
      p_gender: student.gender || null,
      p_section: enrollment.section || null,
      p_guardian_name: student.guardian_name?.trim() || null,
      p_guardian_phone: student.guardian_phone?.trim() || null,
      p_email: student.email?.trim() || null,
    })

    if (rpcErr) {
      if (rpcErr.message.includes('ROLL_COLLISION')) {
        return {
          success: false,
          error: `Roll number ${enrollment.roll_number} is already assigned in ${canonicalClass?.name || effectiveClassId} for academic year ${enrollment.academic_year_id}.`,
        }
      }
      return { success: false, error: rpcErr.message }
    }

    revalidateStudentPaths()
    return {
      success: true,
      data: {
        studentId: rpcRes.student_id,
        enrollmentId: rpcRes.enrollment_id,
      },
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

/**
 * Creates or updates a student person entity. Privileged only.
 */
export async function upsertStudent(
  input: UpsertStudentInput
): Promise<{ success: boolean; data?: Student; error?: string }> {
  const scope = await getServerUserScope()
  if (!scope.isPrivileged) {
    return { success: false, error: 'Access denied: Only administrators can modify student identities.' }
  }

  if (!input.full_name || !input.full_name.trim()) {
    return { success: false, error: 'Student full name is required.' }
  }

  try {
    const supabase = await createClient()

    if (input.id) {
      const { data, error } = await supabase
        .from('students')
        .update({
          full_name: input.full_name.trim(),
          admission_no: input.admission_no?.trim() || null,
          registration_no: input.registration_no?.trim() || null,
          gender: input.gender || null,
          dob_bs: input.dob_bs || null,
          dob_ad: input.dob_ad || null,
          guardian_name: input.guardian_name?.trim() || null,
          guardian_phone: input.guardian_phone?.trim() || null,
          email: input.email?.trim() || null,
        })
        .eq('id', input.id)
        .select('*')
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data: data as Student }
    } else {
      const { data, error } = await supabase
        .from('students')
        .insert({
          full_name: input.full_name.trim(),
          admission_no: input.admission_no?.trim() || null,
          registration_no: input.registration_no?.trim() || null,
          gender: input.gender || null,
          dob_bs: input.dob_bs || null,
          dob_ad: input.dob_ad || null,
          guardian_name: input.guardian_name?.trim() || null,
          guardian_phone: input.guardian_phone?.trim() || null,
          email: input.email?.trim() || null,
          is_active: true,
        })
        .select('*')
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data: data as Student }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

/**
 * Updates an enrollment's status or roll number without deleting historical context.
 */
export async function updateEnrollment(
  enrollmentId: string,
  updates: {
    roll_number?: number
    section?: string | null
    status?: 'active' | 'transferred' | 'graduated' | 'archived'
  }
): Promise<{ success: boolean; error?: string }> {
  const scope = await getServerUserScope()
  if (!scope.isPrivileged) {
    return { success: false, error: 'Access denied: Only administrators can update student enrollments.' }
  }

  try {
    const supabase = await createClient()

    // If updating roll_number, verify no collision
    if (updates.roll_number) {
      const { data: currentEnrollment } = await supabase
        .from('student_enrollments')
        .select('academic_year_id, class_id, roll_number')
        .eq('id', enrollmentId)
        .single()

      if (currentEnrollment && currentEnrollment.roll_number !== updates.roll_number) {
        const { data: collision } = await supabase
          .from('student_enrollments')
          .select('id')
          .eq('academic_year_id', currentEnrollment.academic_year_id)
          .eq('class_id', currentEnrollment.class_id)
          .eq('roll_number', updates.roll_number)
          .neq('id', enrollmentId)
          .maybeSingle()

        if (collision) {
          return { success: false, error: `Roll number ${updates.roll_number} is already assigned in this cohort.` }
        }
      }
    }

    const { error } = await supabase
      .from('student_enrollments')
      .update(updates)
      .eq('id', enrollmentId)

    if (error) return { success: false, error: error.message }

    revalidateStudentPaths()
    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

/**
 * Soft deactivates a student record. Historical academic history and enrollments remain intact.
 */
export async function softDeleteStudent(
  studentId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const scope = await getServerUserScope()
  if (!scope.isPrivileged) {
    return { success: false, error: 'Access denied: Only administrators can archive students.' }
  }

  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('students')
      .update({
        is_active: false,
        archived_at: new Date().toISOString(),
        archive_reason: reason || 'Archived by administrator',
      })
      .eq('id', studentId)

    if (error) return { success: false, error: error.message }

    revalidateStudentPaths()
    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

/**
 * Transfers a student from one class to another without destroying historical enrollment records.
 */
export async function transferStudentEnrollment(input: {
  studentId: string
  fromClassId: string
  toClassId: string
  academicYearId: string
  newRollNumber: number
  section?: string | null
}): Promise<{ success: boolean; newEnrollmentId?: string; error?: string }> {
  const scope = await getServerUserScope()
  if (!scope.isPrivileged) {
    return { success: false, error: 'Access denied: Only administrators can transfer students.' }
  }

  try {
    const supabase = await createClient()

    // 1. Resolve canonical class IDs
    const fromClass = await resolveCanonicalClass(supabase, input.fromClassId)
    const toClass = await resolveCanonicalClass(supabase, input.toClassId)
    const effectiveFromClassId = fromClass?.id || input.fromClassId
    const effectiveToClassId = toClass?.id || input.toClassId

    // 2. Check collision in destination class
    const { data: collision } = await supabase
      .from('student_enrollments')
      .select('id')
      .eq('academic_year_id', input.academicYearId)
      .eq('class_id', effectiveToClassId)
      .eq('roll_number', input.newRollNumber)
      .eq('status', 'active')
      .maybeSingle()

    if (collision) {
      return {
        success: false,
        error: `Roll number ${input.newRollNumber} is already occupied in destination class ${toClass?.name || effectiveToClassId}.`,
      }
    }

    // 3. Mark previous enrollment as 'transferred' (preserves historical record)
    await supabase
      .from('student_enrollments')
      .update({ status: 'transferred', updated_at: new Date().toISOString() })
      .eq('academic_year_id', input.academicYearId)
      .eq('class_id', effectiveFromClassId)
      .eq('student_id', input.studentId)

    // 4. Create new active enrollment in destination class
    const { data: newEnrollment, error: enrollErr } = await supabase
      .from('student_enrollments')
      .insert({
        academic_year_id: input.academicYearId,
        class_id: effectiveToClassId,
        student_id: input.studentId,
        roll_number: input.newRollNumber,
        section: input.section || null,
        status: 'active',
      })
      .select('id')
      .single()

    if (enrollErr) {
      return { success: false, error: enrollErr.message }
    }

    revalidateStudentPaths()
    return { success: true, newEnrollmentId: newEnrollment?.id }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown transfer error'
    return { success: false, error: msg }
  }
}

/**
 * Updates a student's personal identity and their cohort enrollment details.
 * Privileged users only.
 */
export async function updateStudentDetailsAction(input: {
  studentId: string
  enrollmentId: string
  fullName: string
  rollNumber: number
  admissionNo?: string | null
  registrationNo?: string | null
  gender?: string | null
}): Promise<{ success: boolean; error?: string }> {
  const scope = await getServerUserScope()
  if (!scope.isPrivileged) {
    return { success: false, error: 'Access denied: Only administrators can edit student records.' }
  }

  const { studentId, enrollmentId, fullName, rollNumber, admissionNo, registrationNo, gender } = input

  if (!fullName || !fullName.trim()) {
    return { success: false, error: 'Student full name is required.' }
  }

  if (!rollNumber || rollNumber <= 0 || rollNumber > 200) {
    return { success: false, error: 'Roll number must be between 1 and 200.' }
  }

  const pool = getPgPool()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // 1. Fetch current enrollment
    const enrRes = await client.query(
      `SELECT academic_year_id, class_id, roll_number FROM public.student_enrollments WHERE id = $1;`,
      [enrollmentId]
    )

    if (enrRes.rows.length === 0) {
      await client.query('ROLLBACK')
      return { success: false, error: 'Enrollment record not found.' }
    }

    const currentEnrollment = enrRes.rows[0]

    // 2. Check roll collision in this cohort
    if (currentEnrollment.roll_number !== rollNumber) {
      const collRes = await client.query(
        `SELECT se.id, se.roll_number, s.full_name
         FROM public.student_enrollments se
         JOIN public.students s ON s.id = se.student_id
         WHERE se.academic_year_id = $1 
           AND se.class_id = $2 
           AND se.roll_number = $3 
           AND se.status = 'active'
           AND se.id != $4
         LIMIT 1;`,
        [currentEnrollment.academic_year_id, currentEnrollment.class_id, rollNumber, enrollmentId]
      )

      if (collRes.rows.length > 0) {
        await client.query('ROLLBACK')
        const occupantName = collRes.rows[0].full_name || 'another student'
        return {
          success: false,
          error: `Roll ${rollNumber} is already occupied by ${occupantName}. Please choose an unassigned roll number.`,
        }
      }
    }

    // 3. Pre-save check: admission_no uniqueness across students
    if (admissionNo && admissionNo.trim()) {
      const cleanAdm = admissionNo.trim()
      const admRes = await client.query(
        `SELECT id, full_name, admission_no
         FROM public.students
         WHERE LOWER(admission_no) = LOWER($1)
           AND id != $2
         LIMIT 1;`,
        [cleanAdm, studentId]
      )

      if (admRes.rows.length > 0) {
        await client.query('ROLLBACK')
        return {
          success: false,
          error: `Admission number "${cleanAdm}" is already assigned to ${admRes.rows[0].full_name}.`,
        }
      }
    }

    // 4. Update student identity
    await client.query(
      `UPDATE public.students
       SET full_name = $1,
           admission_no = $2,
           registration_no = $3,
           gender = $4,
           is_active = true
       WHERE id = $5;`,
      [
        fullName.trim(),
        admissionNo?.trim() || null,
        registrationNo?.trim() || null,
        (gender as string) || null,
        studentId,
      ]
    )

    // 5. Update enrollment
    await client.query(
      `UPDATE public.student_enrollments
       SET roll_number = $1,
           updated_at = NOW()
       WHERE id = $2;`,
      [rollNumber, enrollmentId]
    )

    await client.query('COMMIT')

    revalidateStudentPaths()
    return { success: true }
  } catch (err: unknown) {
    await client.query('ROLLBACK')
    const msg = err instanceof Error ? err.message : 'Unknown update error'
    return { success: false, error: msg }
  } finally {
    client.release()
  }
}

/**
 * Deletes a student enrollment and dummy person record if safe (zero attendance logs).
 * If attendance logs exist, archives enrollment to prevent corrupting academic logs.
 */
export async function deleteStudentEnrollmentAction(input: {
  enrollmentId: string
  studentId: string
}): Promise<{ success: boolean; actionTaken?: 'deleted' | 'archived'; error?: string }> {
  const scope = await getServerUserScope()
  if (!scope.isPrivileged) {
    return { success: false, error: 'Access denied: Only administrators can delete or unenroll students.' }
  }

  const pool = getPgPool()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // 1. Check if enrollment has attendance records
    const attRes = await client.query(
      `SELECT count(*)::int AS cnt FROM public.log_attendance WHERE enrollment_id = $1;`,
      [input.enrollmentId]
    )
    const logCount = attRes.rows[0]?.cnt || 0

    if (logCount > 0) {
      // Archive instead of delete to protect historical records
      await client.query(
        `UPDATE public.student_enrollments
         SET status = 'archived', updated_at = NOW()
         WHERE id = $1;`,
        [input.enrollmentId]
      )

      // Immediately free up workstation seats
      await client.query(`DELETE FROM public.workstation_seat_plans WHERE enrollment_id = $1;`, [input.enrollmentId])
      await client.query(`DELETE FROM public.session_seat_overrides WHERE enrollment_id = $1;`, [input.enrollmentId])

      await client.query('COMMIT')
      revalidateStudentPaths()
      return {
        success: true,
        actionTaken: 'archived',
        error: `Student has ${logCount} recorded practical attendance logs. The enrollment was safely archived instead of deleted to protect historical compliance.`,
      }
    }

    // 2. Safe delete: clean up seat plans and enrollment
    await client.query(`DELETE FROM public.workstation_seat_plans WHERE enrollment_id = $1;`, [input.enrollmentId])
    await client.query(`DELETE FROM public.session_seat_overrides WHERE enrollment_id = $1;`, [input.enrollmentId])
    await client.query(`DELETE FROM public.student_enrollments WHERE id = $1;`, [input.enrollmentId])

    // 3. Delete student person if no other enrollments remain
    const remRes = await client.query(
      `SELECT count(*)::int AS cnt FROM public.student_enrollments WHERE student_id = $1;`,
      [input.studentId]
    )
    if (remRes.rows[0].cnt === 0) {
      await client.query(`DELETE FROM public.students WHERE id = $1;`, [input.studentId])
    }

    await client.query('COMMIT')
    revalidateStudentPaths()
    return { success: true, actionTaken: 'deleted' }
  } catch (err: unknown) {
    await client.query('ROLLBACK')
    const msg = err instanceof Error ? err.message : 'Unknown delete error'
    return { success: false, error: msg }
  } finally {
    client.release()
  }
}

/**
 * Bulk archives multiple student enrollments in one transaction.
 */
export async function bulkArchiveStudentsAction(
  enrollmentIds: string[]
): Promise<{ success: boolean; count?: number; error?: string }> {
  const scope = await getServerUserScope()
  if (!scope.isPrivileged) {
    return { success: false, error: 'Access denied: Only administrators can archive students.' }
  }

  if (!enrollmentIds || enrollmentIds.length === 0) {
    return { success: false, error: 'No students selected for archiving.' }
  }

  const pool = getPgPool()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    await client.query(
      `UPDATE public.student_enrollments
       SET status = 'archived', updated_at = NOW()
       WHERE id = ANY($1::uuid[]);`,
      [enrollmentIds]
    )

    // Immediately free up workstation seats for all archived enrollments
    await client.query(`DELETE FROM public.workstation_seat_plans WHERE enrollment_id = ANY($1::uuid[]);`, [enrollmentIds])
    await client.query(`DELETE FROM public.session_seat_overrides WHERE enrollment_id = ANY($1::uuid[]);`, [enrollmentIds])

    await client.query('COMMIT')

    revalidateStudentPaths()
    return { success: true, count: enrollmentIds.length }
  } catch (err: unknown) {
    await client.query('ROLLBACK')
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  } finally {
    client.release()
  }
}

/**
 * Bulk deletes multiple student enrollments, cleanly removing zero-history students
 * and safely archiving those with attendance logs.
 */
export async function bulkDeleteStudentsAction(
  items: Array<{ enrollmentId: string; studentId: string }>
): Promise<{ success: boolean; deletedCount: number; archivedCount: number; error?: string }> {
  const scope = await getServerUserScope()
  if (!scope.isPrivileged) {
    return { success: false, deletedCount: 0, archivedCount: 0, error: 'Access denied: Only administrators can delete students.' }
  }

  if (!items || items.length === 0) {
    return { success: false, deletedCount: 0, archivedCount: 0, error: 'No students selected.' }
  }

  try {
    let deletedCount = 0
    let archivedCount = 0

    for (const item of items) {
      const res = await deleteStudentEnrollmentAction(item)
      if (res.success) {
        if (res.actionTaken === 'deleted') deletedCount++
        else archivedCount++
      }
    }

    revalidateStudentPaths()
    return { success: true, deletedCount, archivedCount }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, deletedCount: 0, archivedCount: 0, error: msg }
  }
}

/**
 * Restores an archived student enrollment back to active status.
 * Auto-resolves roll collisions if their old roll was taken while archived.
 */
export async function restoreStudentEnrollmentAction(
  enrollmentId: string,
  requestedRollNumber?: number
): Promise<{ success: boolean; newRollNumber?: number; restoredStudentName?: string; error?: string }> {
  const scope = await getServerUserScope()
  if (!scope.isPrivileged) {
    return { success: false, error: 'Access denied: Only administrators can restore archived students.' }
  }

  const pool = getPgPool()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // 1. Fetch current enrollment details
    const enrRes = await client.query(
      `SELECT se.id, se.student_id, se.academic_year_id, se.class_id, se.roll_number, se.status, s.full_name
       FROM public.student_enrollments se
       JOIN public.students s ON s.id = se.student_id
       WHERE se.id = $1;`,
      [enrollmentId]
    )

    if (enrRes.rows.length === 0) {
      await client.query('ROLLBACK')
      return { success: false, error: 'Archived enrollment record not found.' }
    }

    const enrollment = enrRes.rows[0]
    const studentName = enrollment.full_name || 'Student'

    if (enrollment.status === 'active') {
      await client.query('ROLLBACK')
      return { success: true, restoredStudentName: studentName }
    }

    let targetRoll = requestedRollNumber ?? enrollment.roll_number

    // 2. Validate roll collision with active students in same cohort
    const activeRollsRes = await client.query(
      `SELECT roll_number FROM public.student_enrollments
       WHERE academic_year_id = $1 AND class_id = $2 AND status = 'active' AND id != $3;`,
      [enrollment.academic_year_id, enrollment.class_id, enrollmentId]
    )

    const occupiedRolls = new Set(activeRollsRes.rows.map((r: any) => r.roll_number))

    let rollChanged = false
    if (occupiedRolls.has(targetRoll)) {
      const maxRoll = occupiedRolls.size > 0 ? Math.max(...Array.from(occupiedRolls)) : 0
      targetRoll = maxRoll + 1
      rollChanged = true
    }

    // 3. Reactivate enrollment
    await client.query(
      `UPDATE public.student_enrollments
       SET status = 'active', roll_number = $1, updated_at = NOW()
       WHERE id = $2;`,
      [targetRoll, enrollmentId]
    )

    // 4. Ensure student person record is marked active
    await client.query(
      `UPDATE public.students
       SET is_active = true, archived_at = NULL, archive_reason = NULL
       WHERE id = $1;`,
      [enrollment.student_id]
    )

    await client.query('COMMIT')

    revalidateStudentPaths()

    return {
      success: true,
      restoredStudentName: studentName,
      newRollNumber: rollChanged ? targetRoll : undefined,
    }
  } catch (err: unknown) {
    await client.query('ROLLBACK')
    const msg = err instanceof Error ? err.message : 'Unknown restore error'
    return { success: false, error: msg }
  } finally {
    client.release()
  }
}

/**
 * Alphabetically sorts active cohort students by full name (A-Z) and renumbers roll numbers 1..N.
 * Strictly blocked if ANY practical attendance logs exist for this cohort.
 */
export async function resequenceClassRollsAlphabeticallyAction(params: {
  classId: string
  academicYearId: string
}): Promise<{ success: boolean; count?: number; error?: string }> {
  const scope = await getServerUserScope()
  if (!scope.isPrivileged) {
    return { success: false, error: 'Access denied: Only administrators can resequence roll numbers.' }
  }

  const pool = getPgPool()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // 1. Resolve canonical class
    const canonicalClass = await resolveCanonicalClass(pool, params.classId)
    const effectiveClassId = canonicalClass?.id || params.classId

    // 2. Fetch active enrollments with student names
    const enrRes = await client.query(
      `SELECT se.id, se.roll_number, se.student_id, s.full_name
       FROM public.student_enrollments se
       JOIN public.students s ON s.id = se.student_id
       WHERE se.academic_year_id = $1 
         AND se.class_id = $2 
         AND se.status = 'active';`,
      [params.academicYearId, effectiveClassId]
    )

    if (enrRes.rows.length === 0) {
      await client.query('ROLLBACK')
      return { success: false, error: 'No active students found in this class cohort to resequence.' }
    }

    const enrollments = enrRes.rows
    const enrollmentIds = enrollments.map((e: any) => e.id)

    // 3. Safety Guard: Check if ANY practical attendance logs exist for this cohort
    const attRes = await client.query(
      `SELECT count(*)::int AS cnt FROM public.log_attendance WHERE enrollment_id = ANY($1::uuid[]);`,
      [enrollmentIds]
    )
    const logCount = attRes.rows[0]?.cnt || 0

    if (logCount > 0) {
      await client.query('ROLLBACK')
      return {
        success: false,
        error: `Cannot resequence roll numbers: ${logCount} practical attendance record(s) already exist for this class. Resequencing would invalidate historical attendance logs.`,
      }
    }

    // 4. Sort students alphabetically by full_name (A-Z)
    const sorted = [...enrollments].sort((a: any, b: any) => {
      const nameA = (a.full_name || '').trim().toLowerCase()
      const nameB = (b.full_name || '').trim().toLowerCase()
      return nameA.localeCompare(nameB, 'en', { sensitivity: 'base' })
    })

    // 5. Update roll numbers directly:
    // uq_enrollment_roll is DEFERRABLE INITIALLY DEFERRED, so temporary duplicates
    // during sequential updates within the transaction are safely permitted until COMMIT.
    for (let i = 0; i < sorted.length; i++) {
      await client.query(
        `UPDATE public.student_enrollments SET roll_number = $1, updated_at = NOW() WHERE id = $2;`,
        [i + 1, sorted[i].id]
      )
    }

    await client.query('COMMIT')

    // Record audit event
    await recordAuditEvent({
      action: 'UPDATE',
      entityType: 'roster',
      entityId: `${params.academicYearId}-${effectiveClassId}`,
      entityLabel: `Alphabetical Roll Resequencing — ${canonicalClass?.name || effectiveClassId}`,
      after: {
        resequenced_count: sorted.length,
        class_id: effectiveClassId,
        academic_year_id: params.academicYearId,
      },
      metadata: {
        action: 'ALPHABETICAL_ROLL_SORT',
        actor_id: scope.userId,
        actor_name: scope.fullName,
      },
    })

    revalidateStudentPaths()

    return { success: true, count: sorted.length }
  } catch (err: unknown) {
    await client.query('ROLLBACK')
    const msg = err instanceof Error ? err.message : 'Unknown resequence error'
    return { success: false, error: msg }
  } finally {
    client.release()
  }
}

/**
 * Super Admin Danger Zone: Purges all test data for a class cohort (practical logs, seat plans,
 * enrollments, and unattached test student records).
 * Strictly guarded by super_admin role and typed confirmation phrase.
 */
export async function wipeClassCohortDataAction(params: {
  classId: string
  academicYearId: string
  confirmPhrase: string
  reason?: string
}): Promise<{
  success: boolean
  receipt?: {
    logsDeleted: number
    enrollmentsDeleted: number
    studentsDeleted: number
  }
  error?: string
}> {
  const scope = await getServerUserScope()
  if (!scope.isPrivileged || scope.role !== 'super_admin') {
    return {
      success: false,
      error: 'Unauthorized: Wiping class cohort data is restricted exclusively to Super Administrators.',
    }
  }

  const pool = getPgPool()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // 1. Resolve canonical class
    const canonicalClass = await resolveCanonicalClass(pool, params.classId)
    const effectiveClassId = canonicalClass?.id || params.classId
    const className = canonicalClass?.name || effectiveClassId

    // 2. Validate confirmation phrase: must be WIPE <CLASS_NAME> or WIPE <CLASS_ID>
    const expectedPhrase1 = `WIPE ${className.toUpperCase()}`
    const expectedPhrase2 = `WIPE ${effectiveClassId.toUpperCase()}`
    const normalizedInput = (params.confirmPhrase || '').trim().toUpperCase()

    if (normalizedInput !== expectedPhrase1 && normalizedInput !== expectedPhrase2) {
      await client.query('ROLLBACK')
      return {
        success: false,
        error: `Confirmation phrase mismatch. Please type exactly: "${expectedPhrase1}"`,
      }
    }

    // 3. Find all enrollments in this class & year
    const enrRes = await client.query(
      `SELECT id, student_id FROM public.student_enrollments
       WHERE academic_year_id = $1 AND class_id = $2;`,
      [params.academicYearId, effectiveClassId]
    )

    const enrollmentIds = enrRes.rows.map((r: any) => r.id)
    const candidateStudentIds = Array.from(new Set(enrRes.rows.map((r: any) => r.student_id)))

    let logsDeleted = 0
    let enrollmentsDeleted = enrollmentIds.length
    let studentsDeleted = 0

    if (enrollmentIds.length > 0) {
      // Step A: Count and delete log_attendance
      const attRes = await client.query(
        `DELETE FROM public.log_attendance WHERE enrollment_id = ANY($1::uuid[]);`,
        [enrollmentIds]
      )
      logsDeleted = attRes.rowCount || 0

      // Step B: Delete workstation seats and overrides
      await client.query(
        `DELETE FROM public.workstation_seat_plans WHERE enrollment_id = ANY($1::uuid[]);`,
        [enrollmentIds]
      )
      await client.query(
        `DELETE FROM public.session_seat_overrides WHERE enrollment_id = ANY($1::uuid[]);`,
        [enrollmentIds]
      )

      // Step C: Delete enrollments
      await client.query(
        `DELETE FROM public.student_enrollments WHERE id = ANY($1::uuid[]);`,
        [enrollmentIds]
      )

      // Step D: Delete orphaned student person records (those with no remaining enrollments)
      for (const studentId of candidateStudentIds) {
        const remRes = await client.query(
          `SELECT count(*)::int AS cnt FROM public.student_enrollments WHERE student_id = $1;`,
          [studentId]
        )
        if (remRes.rows[0].cnt === 0) {
          await client.query(`DELETE FROM public.students WHERE id = $1;`, [studentId])
          studentsDeleted++
        }
      }
    }

    await client.query('COMMIT')

    // 4. Record destruction receipt in public.audit_logs
    await recordAuditEvent({
      action: 'DELETE',
      entityType: 'roster',
      entityId: `${params.academicYearId}-${effectiveClassId}`,
      entityLabel: `Class Cohort Purge (Danger Zone) — ${className}`,
      before: {
        academic_year_id: params.academicYearId,
        class_id: effectiveClassId,
        enrollments_purged: enrollmentsDeleted,
        attendance_logs_purged: logsDeleted,
        orphaned_students_purged: studentsDeleted,
      },
      metadata: {
        action: 'WIPE_CLASS_COHORT',
        reason: params.reason || 'Super Admin Danger Zone Wipe',
        actor_id: scope.userId,
        actor_name: scope.fullName,
        timestamp: new Date().toISOString(),
      },
    })

    revalidatePath('/maintenance')
    revalidatePath('/maintenance/workstations')
    revalidatePath('/admin')
    revalidatePath('/schedules')

    return {
      success: true,
      receipt: {
        logsDeleted,
        enrollmentsDeleted,
        studentsDeleted,
      },
    }
  } catch (err: unknown) {
    await client.query('ROLLBACK')
    const msg = err instanceof Error ? err.message : 'Unknown wipe error'
    return { success: false, error: msg }
  } finally {
    client.release()
  }
}

/**
 * Updates the photo avatar for an individual student.
 */
export async function updateStudentPhotoAction(params: {
  studentId: string
  photoUrl: string | null
}): Promise<{ success: boolean; error?: string }> {
  try {
    const scope = await getServerUserScope()
    if (!scope.isPrivileged) {
      return { success: false, error: 'Access denied: Insufficient privileges to update student photo.' }
    }

    const pool = getPgPool()
    const studentRes = await pool.query(
      `SELECT id, full_name, photo_url FROM public.students WHERE id = $1;`,
      [params.studentId]
    )

    if (studentRes.rows.length === 0) {
      return { success: false, error: 'Student record not found.' }
    }

    const prevStudent = studentRes.rows[0]

    await pool.query(
      `UPDATE public.students SET photo_url = $1, updated_at = NOW() WHERE id = $2;`,
      [params.photoUrl, params.studentId]
    )

    await recordAuditEvent({
      action: 'UPDATE',
      entityType: 'student',
      entityId: params.studentId,
      entityLabel: `Student Photo Update — ${prevStudent.full_name}`,
      before: { photo_url: prevStudent.photo_url },
      after: { photo_url: params.photoUrl ? 'UPDATED_IMAGE' : null },
      metadata: {
        actor_id: scope.userId,
        actor_name: scope.fullName,
        timestamp: new Date().toISOString(),
      },
    })

    revalidatePath('/admin')
    revalidatePath('/maintenance')
    revalidatePath('/records')

    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown photo update error'
    return { success: false, error: msg }
  }
}

/**
 * Atomically updates photo avatars for a batch of students (e.g. from Batch Photo Import).
 */
export async function batchUpdateStudentPhotosAction(params: {
  updates: Array<{ studentId: string; photoUrl: string }>
}): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const scope = await getServerUserScope()
    if (!scope.isPrivileged) {
      return { success: false, count: 0, error: 'Access denied: Insufficient privileges for batch photo import.' }
    }

    if (!params.updates || params.updates.length === 0) {
      return { success: true, count: 0 }
    }

    const pool = getPgPool()
    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      for (const item of params.updates) {
        await client.query(
          `UPDATE public.students SET photo_url = $1, updated_at = NOW() WHERE id = $2;`,
          [item.photoUrl, item.studentId]
        )
      }

      await client.query('COMMIT')

      await recordAuditEvent({
        action: 'UPDATE',
        entityType: 'student',
        entityId: 'batch-photo-import',
        entityLabel: `Batch Student Photo Import (${params.updates.length} students)`,
        metadata: {
          total_updated: params.updates.length,
          actor_id: scope.userId,
          actor_name: scope.fullName,
          timestamp: new Date().toISOString(),
        },
      })

      revalidatePath('/admin')
      revalidatePath('/maintenance')
      revalidatePath('/records')

      return { success: true, count: params.updates.length }
    } catch (batchErr) {
      await client.query('ROLLBACK')
      throw batchErr
    } finally {
      client.release()
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown batch photo update error'
    return { success: false, count: 0, error: msg }
  }
}


