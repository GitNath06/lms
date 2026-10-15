'use server'

import { revalidatePath } from 'next/cache'
import { getPgPool } from '@/lib/db'
import { getServerUserScope } from '@/lib/context/server-user-scope'
import { recordAuditEvent } from '@/lib/audit'
import type {
  ArchiveCategoryType,
  ArchivedStudentRecord,
  ArchivedAcademicYearRecord,
  ArchivedInfrastructureRecord,
  ArchiveHubTelemetry,
} from '@/lib/types/archive-hub'

/**
 * Standardizes path revalidations for all student, roster, and admin views.
 */
function revalidateArchivePaths() {
  revalidatePath('/admin')
  revalidatePath('/admin', 'layout')
  revalidatePath('/maintenance')
  revalidatePath('/records')
  revalidatePath('/', 'layout')
}

/**
 * Fetches high-level executive telemetry for the Institutional Recycle Bin & Archive Hub.
 */
export async function getArchiveHubTelemetryAction(internalBypassScopeCheck?: boolean): Promise<{
  success: boolean
  data?: ArchiveHubTelemetry
  error?: string
}> {
  try {
    const scope = await getServerUserScope()
    if (!scope.isPrivileged && !internalBypassScopeCheck) {
      return { success: false, error: 'Access denied: Only administrators can view archive telemetry.' }
    }

    const pool = getPgPool()
    const res = await pool.query(`
      SELECT
        (
          SELECT COUNT(DISTINCT s.id)::int
          FROM public.students s
          LEFT JOIN public.student_enrollments se ON se.student_id = s.id
          WHERE s.is_active = false OR se.status = 'archived'
        ) AS trash_count,
        (
          SELECT COUNT(*)::int
          FROM public.student_enrollments
          WHERE status = 'graduated'
        ) AS graduated_count,
        (
          SELECT COUNT(*)::int
          FROM public.student_enrollments
          WHERE status = 'transferred'
        ) AS transferred_count,
        (
          SELECT COUNT(*)::int
          FROM public.academic_years
          WHERE is_current = false
        ) AS archived_years_count,
        (
          SELECT COUNT(*)::int
          FROM public.labs
          WHERE status = 'Inactive'
        ) AS inactive_labs_count,
        (
          SELECT COALESCE(
            (
              SELECT count(*)::int
              FROM (
                SELECT jsonb_array_elements(value) AS cat
                FROM public.institution_settings
                WHERE key = 'infrastructure_incident_categories'
              ) sub
              WHERE (cat->>'is_active')::boolean = false
            ),
            0
          )
        ) AS archived_categories_count;
    `)

    const row = res.rows[0] || {}
    const telemetry: ArchiveHubTelemetry = {
      trashCount: Number(row.trash_count || 0),
      graduatedCount: Number(row.graduated_count || 0),
      transferredCount: Number(row.transferred_count || 0),
      archivedYearsCount: Number(row.archived_years_count || 0),
      inactiveLabsCount: Number(row.inactive_labs_count || 0),
      archivedCategoriesCount: Number(row.archived_categories_count || 0),
    }

    return { success: true, data: telemetry }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error fetching archive telemetry'
    console.error('getArchiveHubTelemetryAction failed:', msg)
    return { success: false, error: msg }
  }
}

/**
 * Queries archived student records with disambiguation between Recycle Bin (trash),
 * Graduated Alumni, and Transferred students.
 */
export async function getArchivedStudentsAction(params: {
  category: 'trash' | 'graduated' | 'transferred'
  search?: string
  academicYearId?: string
  classId?: string
  limit?: number
  internalBypassScopeCheck?: boolean
}): Promise<{
  success: boolean
  data?: ArchivedStudentRecord[]
  error?: string
}> {
  try {
    const scope = await getServerUserScope()
    if (!scope.isPrivileged && !params.internalBypassScopeCheck) {
      return { success: false, error: 'Access denied: Only administrators can access archived records.' }
    }

    const pool = getPgPool()
    const { category, search, academicYearId, classId, limit = 200 } = params

    let whereClause = ''
    const queryParams: any[] = []

    if (category === 'trash') {
      whereClause = `(s.is_active = false OR se.status = 'archived')`
    } else if (category === 'graduated') {
      whereClause = `se.status = 'graduated'`
    } else if (category === 'transferred') {
      whereClause = `se.status = 'transferred'`
    }

    if (search && search.trim()) {
      queryParams.push(`%${search.trim().toLowerCase()}%`)
      const pIdx = queryParams.length
      whereClause += ` AND (LOWER(s.full_name) LIKE $${pIdx} OR LOWER(COALESCE(s.admission_no, '')) LIKE $${pIdx})`
    }

    if (academicYearId && academicYearId !== 'all') {
      queryParams.push(academicYearId)
      const pIdx = queryParams.length
      whereClause += ` AND se.academic_year_id = $${pIdx}`
    }

    if (classId && classId !== 'all') {
      queryParams.push(classId)
      const pIdx = queryParams.length
      whereClause += ` AND se.class_id = $${pIdx}`
    }

    queryParams.push(limit)
    const limitIdx = queryParams.length

    const sql = `
      SELECT 
        s.id AS student_id,
        se.id AS enrollment_id,
        s.full_name,
        s.admission_no,
        s.registration_no,
        s.gender,
        s.is_active AS is_student_active,
        s.archived_at,
        s.archive_reason,
        se.class_id,
        c.name AS class_name,
        se.academic_year_id,
        ay.name AS academic_year_name,
        se.roll_number,
        se.section,
        COALESCE(se.status, 'archived') AS enrollment_status,
        COALESCE(
          (SELECT COUNT(*)::int FROM public.log_attendance la WHERE (se.id IS NOT NULL AND la.enrollment_id = se.id) OR la.student_id = s.id),
          0
        ) AS attendance_count
      FROM public.students s
      LEFT JOIN public.student_enrollments se ON se.student_id = s.id
      LEFT JOIN public.classes c ON c.id = se.class_id
      LEFT JOIN public.academic_years ay ON ay.id = se.academic_year_id
      WHERE ${whereClause}
      ORDER BY s.archived_at DESC NULLS LAST, s.full_name ASC
      LIMIT $${limitIdx};
    `

    const res = await pool.query(sql, queryParams)

    const data: ArchivedStudentRecord[] = res.rows.map((r: any) => ({
      studentId: String(r.student_id),
      enrollmentId: r.enrollment_id ? String(r.enrollment_id) : null,
      fullName: String(r.full_name),
      admissionNo: r.admission_no ? String(r.admission_no) : null,
      registrationNo: r.registration_no ? String(r.registration_no) : null,
      gender: r.gender ? String(r.gender) : null,
      classId: r.class_id ? String(r.class_id) : null,
      className: r.class_name ? String(r.class_name) : (r.class_id ? String(r.class_id) : null),
      academicYearId: r.academic_year_id ? String(r.academic_year_id) : null,
      academicYearName: r.academic_year_name ? String(r.academic_year_name) : (r.academic_year_id ? String(r.academic_year_id) : null),
      rollNumber: r.roll_number !== null ? Number(r.roll_number) : null,
      section: r.section ? String(r.section) : null,
      enrollmentStatus: String(r.enrollment_status),
      isStudentActive: Boolean(r.is_student_active),
      archivedAt: r.archived_at ? new Date(r.archived_at).toISOString() : null,
      archiveReason: r.archive_reason ? String(r.archive_reason) : null,
      attendanceCount: Number(r.attendance_count || 0),
      canPermanentPurge: Number(r.attendance_count || 0) === 0,
    }))

    return { success: true, data }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error querying archived students'
    console.error('getArchivedStudentsAction failed:', msg)
    return { success: false, error: msg }
  }
}

/**
 * Queries past/archived academic years with operational statistics.
 */
export async function getArchivedAcademicYearsAction(internalBypassScopeCheck?: boolean): Promise<{
  success: boolean
  data?: ArchivedAcademicYearRecord[]
  error?: string
}> {
  try {
    const scope = await getServerUserScope()
    if (!scope.isPrivileged && !internalBypassScopeCheck) {
      return { success: false, error: 'Access denied: Only administrators can view past cycles.' }
    }

    const pool = getPgPool()
    const res = await pool.query(`
      SELECT 
        ay.id,
        ay.name,
        ay.start_date,
        ay.end_date,
        ay.is_current,
        ay.is_archived,
        (SELECT COUNT(*)::int FROM public.practical_logs pl WHERE pl.academic_year_id = ay.id) AS total_logs,
        (SELECT COUNT(*)::int FROM public.student_enrollments se WHERE se.academic_year_id = ay.id) AS total_enrollments
      FROM public.academic_years ay
      WHERE ay.is_current = false
      ORDER BY ay.start_date DESC;
    `)

    const data: ArchivedAcademicYearRecord[] = res.rows.map((r: any) => ({
      id: String(r.id),
      name: String(r.name),
      startDate: r.start_date ? new Date(r.start_date).toISOString().split('T')[0] : '',
      endDate: r.end_date ? new Date(r.end_date).toISOString().split('T')[0] : '',
      isCurrent: Boolean(r.is_current),
      isArchived: Boolean(r.is_archived),
      totalLogs: Number(r.total_logs || 0),
      totalEnrollments: Number(r.total_enrollments || 0),
    }))

    return { success: true, data }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

/**
 * Queries inactive laboratories and soft-archived incident categories.
 */
export async function getArchivedInfrastructureAction(internalBypassScopeCheck?: boolean): Promise<{
  success: boolean
  data?: ArchivedInfrastructureRecord[]
  error?: string
}> {
  try {
    const scope = await getServerUserScope()
    if (!scope.isPrivileged && !internalBypassScopeCheck) {
      return { success: false, error: 'Access denied.' }
    }

    const pool = getPgPool()
    const labRes = await pool.query(`
      SELECT id, 'lab' AS type, name, status, code AS code_or_severity, created_at
      FROM public.labs WHERE status = 'Inactive'
      ORDER BY created_at DESC;
    `)

    const data: ArchivedInfrastructureRecord[] = labRes.rows.map((r: any) => ({
      id: String(r.id),
      type: 'lab' as const,
      name: String(r.name),
      codeOrSeverity: r.code_or_severity ? String(r.code_or_severity) : undefined,
      status: String(r.status),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    }))

    const catRes = await pool.query(`
      SELECT value FROM public.institution_settings WHERE key = 'infrastructure_incident_categories';
    `)
    if (catRes.rows.length > 0 && Array.isArray(catRes.rows[0].value)) {
      for (const c of catRes.rows[0].value) {
        if (c && c.is_active === false) {
          data.push({
            id: String(c.id || c.code),
            type: 'incident_category',
            name: String(c.name),
            codeOrSeverity: c.severity ? String(c.severity) : (c.code ? String(c.code) : undefined),
            status: 'Archived',
            createdAt: new Date().toISOString(),
          })
        }
      }
    }

    return { success: true, data }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

/**
 * Restores a student and/or enrollment from the Recycle Bin back to active status.
 * Auto-resolves roll collision if their prior roll was assigned to another active student.
 */
export async function restoreStudentAction(input: {
  studentId: string
  enrollmentId?: string
  targetRollNumber?: number
  internalBypassScopeCheck?: boolean
}): Promise<{
  success: boolean
  restoredStudentName?: string
  newRollNumber?: number
  error?: string
}> {
  const scope = await getServerUserScope()
  if (!scope.isPrivileged && !input.internalBypassScopeCheck) {
    return { success: false, error: 'Access denied: Only administrators can restore archived items.' }
  }

  const { studentId, enrollmentId, targetRollNumber } = input
  if (!studentId) {
    return { success: false, error: 'Student ID is required.' }
  }

  const pool = getPgPool()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // 1. Reactivate student person record
    const sRes = await client.query(
      `UPDATE public.students
       SET is_active = true, archived_at = NULL, archive_reason = NULL
       WHERE id = $1
       RETURNING full_name;`,
      [studentId]
    )

    if (sRes.rows.length === 0) {
      await client.query('ROLLBACK')
      return { success: false, error: 'Student record not found.' }
    }

    const studentName = sRes.rows[0].full_name || 'Student'
    let assignedRoll: number | undefined = undefined

    // 2. If enrollmentId provided, reactivate enrollment
    if (enrollmentId) {
      const enrRes = await client.query(
        `SELECT id, student_id, academic_year_id, class_id, roll_number, status
         FROM public.student_enrollments
         WHERE id = $1;`,
        [enrollmentId]
      )

      if (enrRes.rows.length > 0) {
        const enr = enrRes.rows[0]
        let desiredRoll = targetRollNumber ?? enr.roll_number

        // Check active roll collisions
        const activeRollsRes = await client.query(
          `SELECT roll_number FROM public.student_enrollments
           WHERE academic_year_id = $1 AND class_id = $2 AND status = 'active' AND id != $3;`,
          [enr.academic_year_id, enr.class_id, enrollmentId]
        )

        const activeRolls = new Set(activeRollsRes.rows.map((r: any) => r.roll_number))
        if (activeRolls.has(desiredRoll)) {
          const maxRoll = activeRolls.size > 0 ? Math.max(...Array.from(activeRolls)) : 0
          desiredRoll = maxRoll + 1
        }
        assignedRoll = desiredRoll

        await client.query(
          `UPDATE public.student_enrollments
           SET status = 'active', roll_number = $1, updated_at = NOW()
           WHERE id = $2;`,
          [desiredRoll, enrollmentId]
        )
      }
    }

    await client.query('COMMIT')

    // Audit event
    await recordAuditEvent({
      action: 'UPDATE',
      entityType: 'student',
      entityId: studentId,
      entityLabel: `Restored Student: ${studentName}`,
      after: {
        is_active: true,
        restored_at: new Date().toISOString(),
        assigned_roll: assignedRoll,
      },
      metadata: {
        actionDesc: 'Restored student from Recycle Bin to active status',
      },
    })

    revalidateArchivePaths()

    return {
      success: true,
      restoredStudentName: studentName,
      newRollNumber: assignedRoll,
    }
  } catch (err: unknown) {
    await client.query('ROLLBACK')
    const msg = err instanceof Error ? err.message : 'Unknown restore error'
    console.error('restoreStudentAction failed:', msg)
    return { success: false, error: msg }
  } finally {
    client.release()
  }
}

/**
 * Ultra-safe permanent purge of a trash student item.
 * STRICT SAFETY RULE:
 * - If student has ANY recorded practical attendance logs, deletion is HARD BLOCKED to protect NEB compliance.
 * - Only items with 0 historical attendance logs can be permanently purged.
 */
export async function permanentPurgeTrashAction(input: {
  studentId: string
  enrollmentId?: string
  internalBypassScopeCheck?: boolean
}): Promise<{
  success: boolean
  error?: string
}> {
  const scope = await getServerUserScope()
  if (!scope.isPrivileged && !input.internalBypassScopeCheck) {
    return { success: false, error: 'Access denied: Only administrators can permanently purge records.' }
  }

  const { studentId, enrollmentId } = input
  if (!studentId) {
    return { success: false, error: 'Student ID is required.' }
  }

  const pool = getPgPool()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // 1. Check student attendance logs across all enrollments
    const attRes = await client.query(
      `SELECT count(*)::int AS cnt
       FROM public.log_attendance
       WHERE enrollment_id IN (
         SELECT id FROM public.student_enrollments WHERE student_id = $1
       ) OR student_id = $1;`,
      [studentId]
    )

    const logCount = Number(attRes.rows[0]?.cnt || 0)
    if (logCount > 0) {
      await client.query('ROLLBACK')
      return {
        success: false,
        error: `Permanent purge blocked: Student has ${logCount} recorded practical attendance logs. Under institutional and NEB regulations, operational logbook history cannot be deleted. This record will remain preserved in the archive.`,
      }
    }

    // 2. Fetch student name for audit
    const sRes = await client.query(`SELECT full_name FROM public.students WHERE id = $1;`, [studentId])
    const studentName = sRes.rows[0]?.full_name || studentId

    // 3. Clean up seat plans and session overrides
    if (enrollmentId) {
      await client.query(`DELETE FROM public.workstation_seat_plans WHERE enrollment_id = $1;`, [enrollmentId])
      await client.query(`DELETE FROM public.session_seat_overrides WHERE enrollment_id = $1;`, [enrollmentId])
      await client.query(`DELETE FROM public.student_enrollments WHERE id = $1;`, [enrollmentId])
    } else {
      await client.query(
        `DELETE FROM public.workstation_seat_plans WHERE enrollment_id IN (SELECT id FROM public.student_enrollments WHERE student_id = $1);`,
        [studentId]
      )
      await client.query(
        `DELETE FROM public.session_seat_overrides WHERE enrollment_id IN (SELECT id FROM public.student_enrollments WHERE student_id = $1);`,
        [studentId]
      )
      await client.query(`DELETE FROM public.student_enrollments WHERE student_id = $1;`, [studentId])
    }

    // 4. If no remaining enrollments for this person, delete student
    const remEnrRes = await client.query(`SELECT count(*)::int AS cnt FROM public.student_enrollments WHERE student_id = $1;`, [studentId])
    if (Number(remEnrRes.rows[0]?.cnt || 0) === 0) {
      await client.query(`DELETE FROM public.students WHERE id = $1;`, [studentId])
    }

    await client.query('COMMIT')

    // Audit event
    await recordAuditEvent({
      action: 'DELETE',
      entityType: 'student',
      entityId: studentId,
      entityLabel: `Permanently Purged Student: ${studentName}`,
      before: { studentId, studentName },
      after: {},
      metadata: {
        actionDesc: 'Permanently purged zero-history student from Recycle Bin',
      },
    })

    revalidateArchivePaths()
    return { success: true }
  } catch (err: unknown) {
    await client.query('ROLLBACK')
    const msg = err instanceof Error ? err.message : 'Unknown purge error'
    console.error('permanentPurgeTrashAction failed:', msg)
    return { success: false, error: msg }
  } finally {
    client.release()
  }
}

/**
 * Restores an inactive lab or soft-archived incident category back to active service.
 */
export async function restoreInfrastructureItemAction(input: {
  itemType: 'lab' | 'incident_category'
  itemId: string
  internalBypassScopeCheck?: boolean
}): Promise<{
  success: boolean
  error?: string
}> {
  const scope = await getServerUserScope()
  if (!scope.isPrivileged && !input.internalBypassScopeCheck) {
    return { success: false, error: 'Access denied: Only administrators can reactivate infrastructure.' }
  }

  const pool = getPgPool()
  try {
    if (input.itemType === 'lab') {
      const res = await pool.query(
        `UPDATE public.labs SET status = 'Operational', is_active = true WHERE id = $1 RETURNING name;`,
        [input.itemId]
      )
      if (res.rows.length === 0) return { success: false, error: 'Lab facility not found.' }

      await recordAuditEvent({
        action: 'UPDATE',
        entityType: 'lab',
        entityId: input.itemId,
        entityLabel: `Reactivated Lab: ${res.rows[0].name}`,
        after: { status: 'Operational', is_active: true },
        metadata: { actionDesc: 'Reactivated facility from archive' },
      })
    } else if (input.itemType === 'incident_category') {
      const catRes = await pool.query(
        `SELECT value FROM public.institution_settings WHERE key = 'infrastructure_incident_categories';`
      )
      if (catRes.rows.length === 0 || !Array.isArray(catRes.rows[0].value)) {
        return { success: false, error: 'Incident categories setting not found.' }
      }
      const list = catRes.rows[0].value
      const target = list.find((c: any) => String(c.id) === input.itemId || String(c.code) === input.itemId)
      if (!target) {
        return { success: false, error: 'Incident category not found.' }
      }
      target.is_active = true

      await pool.query(
        `UPDATE public.institution_settings SET value = $1::jsonb, updated_at = NOW() WHERE key = 'infrastructure_incident_categories';`,
        [JSON.stringify(list)]
      )

      await recordAuditEvent({
        action: 'UPDATE',
        entityType: 'incident_category',
        entityId: input.itemId,
        entityLabel: `Restored Incident Category: ${target.name}`,
        after: { is_active: true },
        metadata: { actionDesc: 'Restored incident category from archive' },
      })
    }

    revalidateArchivePaths()
    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown restore error'
    return { success: false, error: msg }
  }
}
