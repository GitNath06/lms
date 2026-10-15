'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getServerUserScope } from '@/lib/context/server-user-scope'
import { getPgPool } from '@/lib/db'
import { recordAuditEvent } from '@/lib/audit'
import type {
  AcademicYear,
  CreateAcademicYearInput,
  UpdateAcademicYearInput,
  AcademicYearDependencyReport,
  StudentPromotionException,
  PromoteCohortInput,
  PromoteCohortResult,
  PromotionStudentItem,
  LateralNewcomerItem,
  ExecuteCohortPromotionBatchInput,
  PromotionBatchReceipt,
  PromotionBatchHistoryItem,
} from '@/lib/types/academic-years'

/**
 * Returns all academic years ordered by start date descending.
 */
export async function getAcademicYears(): Promise<{ success: boolean; data: AcademicYear[]; error?: string }> {
  try {
    const pool = getPgPool()
    const res = await pool.query(`
      SELECT id, name, start_date, end_date, is_current, created_at
      FROM public.academic_years
      ORDER BY start_date DESC;
    `)

    const data: AcademicYear[] = res.rows.map((r: any) => ({
      id: String(r.id),
      name: String(r.name),
      start_date: r.start_date ? new Date(r.start_date).toISOString() : '',
      end_date: r.end_date ? new Date(r.end_date).toISOString() : '',
      is_current: Boolean(r.is_current),
      is_archived: Boolean(r.is_archived),
      created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    }))

    return { success: true, data }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('Error fetching academic years:', msg)
    return { success: false, data: [], error: msg }
  }
}

/**
 * Returns the single active/current academic year.
 */
export async function getCurrentAcademicYear(): Promise<{ success: boolean; data: AcademicYear | null; error?: string }> {
  try {
    const pool = getPgPool()
    const res = await pool.query(`
      SELECT id, name, start_date, end_date, is_current, created_at
      FROM public.academic_years
      WHERE is_current = true
      LIMIT 1;
    `)

    if (res.rows.length === 0) {
      return { success: true, data: null }
    }

    const r = res.rows[0]
    return {
      success: true,
      data: {
        id: String(r.id),
        name: String(r.name),
        start_date: r.start_date ? new Date(r.start_date).toISOString() : '',
        end_date: r.end_date ? new Date(r.end_date).toISOString() : '',
        is_current: Boolean(r.is_current),
        is_archived: Boolean(r.is_archived),
        created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
        updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
      },
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('Error fetching current academic year:', msg)
    return { success: false, data: null, error: msg }
  }
}

/**
 * Flips the current academic year cycle. Super Admin / Privileged only.
 */
export async function setCurrentAcademicYear(
  targetYearId: string
): Promise<{ success: boolean; error?: string }> {
  const scope = await getServerUserScope()
  if (!scope.isPrivileged) {
    return { success: false, error: 'Access denied: Only administrators can change the active academic cycle.' }
  }

  try {
    const supabase = await createClient()

    // 1. Unset current from all years
    const { error: unsetErr } = await supabase
      .from('academic_years')
      .update({ is_current: false })
      .neq('id', targetYearId)

    if (unsetErr) {
      return { success: false, error: 'Failed to clear current academic year flag.' }
    }

    // 2. Set new active year
    const { error: setErr } = await supabase
      .from('academic_years')
      .update({ is_current: true })
      .eq('id', targetYearId)

    if (setErr) {
      return { success: false, error: 'Failed to set target academic year as active.' }
    }

    revalidatePath('/maintenance', 'layout')
    revalidatePath('/records', 'layout')
    revalidatePath('/admin', 'layout')
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

/**
 * Creates a new academic year cycle. Super Admin / Privileged only.
 */
export async function createAcademicYear(
  input: CreateAcademicYearInput
): Promise<{ success: boolean; data?: AcademicYear; error?: string }> {
  const scope = await getServerUserScope()
  if (!scope.isPrivileged) {
    return { success: false, error: 'Access denied: Only administrators can create academic years.' }
  }

  if (!input.id || !input.name || !input.start_date || !input.end_date) {
    return { success: false, error: 'All fields (id, name, start_date, end_date) are required.' }
  }

  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    if (input.is_current) {
      await client.query('UPDATE public.academic_years SET is_current = false WHERE is_current = true;')
    }

    const insertRes = await client.query(`
      INSERT INTO public.academic_years (id, name, start_date, end_date, is_current, is_archived, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, false, now(), now())
      RETURNING *;
    `, [
      input.id.trim(),
      input.name.trim(),
      input.start_date,
      input.end_date,
      Boolean(input.is_current),
    ])

    await client.query('COMMIT')

    const r = insertRes.rows[0]
    const data: AcademicYear = {
      id: String(r.id),
      name: String(r.name),
      start_date: r.start_date ? new Date(r.start_date).toISOString() : '',
      end_date: r.end_date ? new Date(r.end_date).toISOString() : '',
      is_current: Boolean(r.is_current),
      is_archived: Boolean(r.is_archived),
      created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    }

    // Record audit event
    await recordAuditEvent({
      action: 'CREATE',
      entityType: 'academic_year',
      entityId: input.id.trim(),
      entityLabel: `Academic Year ${input.name.trim()} (${input.id.trim()})`,
      after: {
        id: input.id.trim(),
        name: input.name.trim(),
        start_date: input.start_date,
        end_date: input.end_date,
        is_current: Boolean(input.is_current),
      },
      metadata: {
        actionDesc: 'Created new academic year cycle',
      },
    })

    revalidatePath('/admin', 'layout')
    revalidatePath('/maintenance', 'layout')
    revalidatePath('/records', 'layout')
    revalidatePath('/', 'layout')
    return { success: true, data }
  } catch (err: unknown) {
    await client.query('ROLLBACK').catch(() => {})
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('createAcademicYear failed:', msg)
    return { success: false, error: msg }
  } finally {
    client.release()
  }
}

/**
 * Safely updates an academic year's display label and date range without altering its primary key ID.
 * This guarantees 100% data integrity for all existing foreign keys (practical_logs, enrollments, seat plans, schedules).
 */
export async function updateAcademicYearAction(
  input: { id: string; name?: string; start_date?: string; end_date?: string; internalBypassScopeCheck?: boolean }
): Promise<{ success: boolean; data?: AcademicYear; error?: string }> {
  const scope = await getServerUserScope()
  if (!scope.isPrivileged && !input.internalBypassScopeCheck) {
    return { success: false, error: 'Access denied: Only administrators can modify academic years.' }
  }

  const { id, name, start_date, end_date } = input
  if (!id || !id.trim()) {
    return { success: false, error: 'Academic year ID is required.' }
  }

  const pool = getPgPool()
  const client = await pool.connect()

  try {
    // 1. Fetch current state
    const existingRes = await client.query(
      `SELECT id, name, start_date, end_date, is_current, is_archived, created_at FROM public.academic_years WHERE id = $1;`,
      [id.trim()]
    )

    if (existingRes.rows.length === 0) {
      return { success: false, error: `Academic year '${id}' not found.` }
    }

    const beforeState = existingRes.rows[0]
    const updatedName = name !== undefined ? name.trim() : beforeState.name
    const updatedStartDate = start_date !== undefined ? start_date : beforeState.start_date
    const updatedEndDate = end_date !== undefined ? end_date : beforeState.end_date

    if (!updatedName || !updatedStartDate || !updatedEndDate) {
      return { success: false, error: 'Display name, start date, and end date cannot be empty.' }
    }

    // 2. Perform update (immutable primary key id is NEVER touched)
    const updateRes = await client.query(
      `UPDATE public.academic_years
       SET name = $1, start_date = $2, end_date = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING id, name, start_date, end_date, is_current, is_archived, created_at, updated_at;`,
      [updatedName, updatedStartDate, updatedEndDate, id.trim()]
    )

    const updatedRow = updateRes.rows[0]
    const afterData: AcademicYear = {
      id: String(updatedRow.id),
      name: String(updatedRow.name),
      start_date: updatedRow.start_date ? new Date(updatedRow.start_date).toISOString() : '',
      end_date: updatedRow.end_date ? new Date(updatedRow.end_date).toISOString() : '',
      is_current: Boolean(updatedRow.is_current),
      is_archived: Boolean(updatedRow.is_archived),
      created_at: updatedRow.created_at ? new Date(updatedRow.created_at).toISOString() : new Date().toISOString(),
      updated_at: updatedRow.updated_at ? new Date(updatedRow.updated_at).toISOString() : new Date().toISOString(),
    }

    // 3. Record Structured Audit Trail
    await recordAuditEvent({
      action: 'UPDATE',
      entityType: 'academic_year',
      entityId: id.trim(),
      entityLabel: `Academic Year ${updatedName} (${id.trim()})`,
      before: {
        name: beforeState.name,
        start_date: beforeState.start_date,
        end_date: beforeState.end_date,
      },
      after: {
        name: updatedName,
        start_date: updatedStartDate,
        end_date: updatedEndDate,
      },
      metadata: {
        actionDesc: 'Updated academic year details while preserving primary key & historical references',
      },
    })

    revalidatePath('/admin', 'layout')
    revalidatePath('/maintenance', 'layout')
    revalidatePath('/records', 'layout')
    revalidatePath('/', 'layout')

    return { success: true, data: afterData }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error updating academic year'
    console.error('updateAcademicYearAction failed:', msg)
    return { success: false, error: msg }
  } finally {
    client.release()
  }
}

/**
 * Inspects all relational dependencies across public database tables referencing an academic year.
 * Protects historical operational data (NEB 75% attendance logs, enrollments, seat plans, schedules).
 */
export async function checkAcademicYearDependenciesAction(
  yearId: string
): Promise<{ success: boolean; data?: AcademicYearDependencyReport; error?: string }> {
  if (!yearId || !yearId.trim()) {
    return { success: false, error: 'Year ID is required.' }
  }

  const pool = getPgPool()
  try {
    // 1. Fetch academic year details
    const yearRes = await pool.query(
      `SELECT id, name, is_current FROM public.academic_years WHERE id = $1;`,
      [yearId.trim()]
    )

    if (yearRes.rows.length === 0) {
      return { success: false, error: `Academic year '${yearId}' does not exist.` }
    }

    const yearRow = yearRes.rows[0]
    const isCurrent = Boolean(yearRow.is_current)
    const yearName = String(yearRow.name || yearRow.id)

    // 2. Query counts across all relational tables
    const depRes = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM public.practical_logs WHERE academic_year_id = $1) AS practical_logs_count,
        (SELECT COUNT(*)::int FROM public.student_enrollments WHERE academic_year_id = $1) AS enrollments_count,
        (SELECT COUNT(*)::int FROM public.workstation_seat_plans WHERE academic_year_id = $1) AS seat_plans_count,
        (SELECT COUNT(*)::int FROM public.class_subjects WHERE academic_year_id = $1) AS class_subjects_count,
        (SELECT COUNT(*)::int FROM public.schedules WHERE academic_year_id = $1) AS schedules_count;
    `, [yearId.trim()])

    const counts = depRes.rows[0] || {}
    const practicalLogsCount = Number(counts.practical_logs_count || 0)
    const enrollmentsCount = Number(counts.enrollments_count || 0)
    const seatPlansCount = Number(counts.seat_plans_count || 0)
    const classSubjectsCount = Number(counts.class_subjects_count || 0)
    const schedulesCount = Number(counts.schedules_count || 0)

    const totalDependencies = practicalLogsCount + enrollmentsCount + seatPlansCount + classSubjectsCount + schedulesCount

    let canDelete = true
    let blockReason: string | undefined = undefined

    if (isCurrent) {
      canDelete = false
      blockReason = 'Cannot delete the current active academic year cycle. Please activate a different cycle first.'
    } else if (totalDependencies > 0) {
      canDelete = false
      const parts: string[] = []
      if (practicalLogsCount > 0) parts.push(`${practicalLogsCount} practical log(s)`)
      if (enrollmentsCount > 0) parts.push(`${enrollmentsCount} student enrollment(s)`)
      if (seatPlansCount > 0) parts.push(`${seatPlansCount} seat assignment(s)`)
      if (classSubjectsCount > 0) parts.push(`${classSubjectsCount} subject mapping(s)`)
      if (schedulesCount > 0) parts.push(`${schedulesCount} timetable schedule(s)`)

      blockReason = `Deletion Blocked: Academic Year '${yearName}' contains ${parts.join(', ')}. In accordance with NEB compliance and historical audit integrity, academic cycles with operational records cannot be deleted. Completed years should remain safely archived.`
    }

    const report: AcademicYearDependencyReport = {
      yearId: yearRow.id,
      yearName,
      isCurrent,
      practicalLogsCount,
      enrollmentsCount,
      seatPlansCount,
      classSubjectsCount,
      schedulesCount,
      totalDependencies,
      canDelete,
      blockReason,
    }

    return { success: true, data: report }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error inspecting dependencies'
    console.error('checkAcademicYearDependenciesAction failed:', msg)
    return { success: false, error: msg }
  }
}

/**
 * Ultra-safe deletion of an academic year.
 * STRICT POLICY:
 * - Current active cycle (is_current = true) CANNOT be deleted.
 * - Any academic year with historical operational records (practical logs, student enrollments, seat plans, schedules) CANNOT be deleted under any circumstances.
 * - Accidental / empty years (totalDependencies === 0) can be safely deleted if unlocked by an administrator.
 */
export async function deleteAcademicYearAction(
  yearId: string,
  internalBypassScopeCheck?: boolean
): Promise<{ success: boolean; error?: string; blockReason?: string; dependencies?: AcademicYearDependencyReport }> {
  const scope = await getServerUserScope()
  if (!scope.isPrivileged && !internalBypassScopeCheck) {
    return { success: false, error: 'Access denied: Only administrators can delete academic cycles.' }
  }

  if (!yearId || !yearId.trim()) {
    return { success: false, error: 'Academic year ID is required.' }
  }

  // Pre-flight check
  const checkRes = await checkAcademicYearDependenciesAction(yearId.trim())
  if (!checkRes.success || !checkRes.data) {
    return { success: false, error: checkRes.error || 'Failed to inspect academic year dependencies.' }
  }

  const dep = checkRes.data
  if (!dep.canDelete) {
    return {
      success: false,
      error: dep.blockReason || 'Deletion is strictly blocked to protect historical records.',
      blockReason: dep.blockReason,
      dependencies: dep,
    }
  }

  const pool = getPgPool()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // Double check with row lock
    const lockRes = await client.query(
      `SELECT id, name, is_current FROM public.academic_years WHERE id = $1 FOR UPDATE;`,
      [yearId.trim()]
    )

    if (lockRes.rows.length === 0) {
      await client.query('ROLLBACK')
      return { success: false, error: `Academic year '${yearId}' not found.` }
    }

    if (lockRes.rows[0].is_current) {
      await client.query('ROLLBACK')
      return { success: false, error: 'Cannot delete the current active academic cycle.' }
    }

    // Re-verify no records exist within transaction
    const verifyRes = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM public.practical_logs WHERE academic_year_id = $1) AS practical_logs_count,
        (SELECT COUNT(*)::int FROM public.student_enrollments WHERE academic_year_id = $1) AS enrollments_count,
        (SELECT COUNT(*)::int FROM public.workstation_seat_plans WHERE academic_year_id = $1) AS seat_plans_count,
        (SELECT COUNT(*)::int FROM public.class_subjects WHERE academic_year_id = $1) AS class_subjects_count,
        (SELECT COUNT(*)::int FROM public.schedules WHERE academic_year_id = $1) AS schedules_count;
    `, [yearId.trim()])

    const v = verifyRes.rows[0]
    const total = Number(v.practical_logs_count || 0) + Number(v.enrollments_count || 0) + Number(v.seat_plans_count || 0) + Number(v.class_subjects_count || 0) + Number(v.schedules_count || 0)

    if (total > 0) {
      await client.query('ROLLBACK')
      return {
        success: false,
        error: `Deletion rejected: Detected ${total} active or historical records linked to this academic cycle.`,
      }
    }

    // Perform deletion
    await client.query(`DELETE FROM public.academic_years WHERE id = $1;`, [yearId.trim()])

    await client.query('COMMIT')

    // Audit Event
    await recordAuditEvent({
      action: 'DELETE',
      entityType: 'academic_year',
      entityId: yearId.trim(),
      entityLabel: `Academic Year ${dep.yearName} (${yearId.trim()})`,
      before: {
        id: dep.yearId,
        name: dep.yearName,
        isCurrent: dep.isCurrent,
        totalDependencies: 0,
      },
      after: {},
      metadata: {
        actionDesc: 'Permanently deleted empty/accidental academic cycle with zero associated operational records',
      },
    })

    revalidatePath('/admin', 'layout')
    revalidatePath('/maintenance', 'layout')
    revalidatePath('/records', 'layout')
    revalidatePath('/', 'layout')

    return { success: true }
  } catch (err: unknown) {
    await client.query('ROLLBACK')
    const msg = err instanceof Error ? err.message : 'Unknown error during academic year deletion'
    console.error('deleteAcademicYearAction failed:', msg)
    return { success: false, error: msg }
  } finally {
    client.release()
  }
}

/**
 * Promotes a cohort from one class/year to another with full exception-handling.
 * Checked students advance to destination class.
 * Unchecked students either repeat in the source class or are marked left/archived.
 * Zero data loss; historical attendance and prior enrollments remain 100% intact.
 */
export async function promoteCohortAction(
  input: PromoteCohortInput
): Promise<{ success: boolean; data?: PromoteCohortResult; error?: string }> {
  const scope = await getServerUserScope()
  if (!scope.isPrivileged && !input.internalBypassScopeCheck) {
    return { success: false, error: 'Access denied: Only administrators can promote cohorts.' }
  }

  const { fromClassId, toClassId, fromAcademicYearId, toAcademicYearId, exceptions = [] } = input

  if (!fromClassId || !toClassId || !fromAcademicYearId || !toAcademicYearId) {
    return { success: false, error: 'Source and destination classes and academic years are required.' }
  }

  if (fromAcademicYearId === toAcademicYearId && fromClassId === toClassId) {
    return { success: false, error: 'Cannot promote a cohort to the exact same class and academic year.' }
  }

  const pool = getPgPool()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // 1. Fetch all active student enrollments in the source cohort
    const enrollmentsQuery = `
      SELECT se.id, se.student_id, se.roll_number, se.section
      FROM public.student_enrollments se
      WHERE se.class_id = $1 
        AND se.academic_year_id = $2 
        AND se.status = 'active'
      ORDER BY se.roll_number ASC;
    `
    const sourceEnrollments = await client.query(enrollmentsQuery, [fromClassId, fromAcademicYearId])

    if (sourceEnrollments.rows.length === 0) {
      await client.query('ROLLBACK')
      return { success: false, error: 'No active student enrollments found in the selected source class.' }
    }

    const exceptionMap = new Map<string, 'repeat' | 'archive'>()
    for (const ex of exceptions) {
      exceptionMap.set(ex.studentId, ex.action)
    }

    let promotedCount = 0
    let retainedCount = 0
    let archivedCount = 0

    // 2. Get highest existing roll number in destination class for the new year to avoid duplicate key conflicts
    const destMaxRollRes = await client.query(
      `SELECT COALESCE(MAX(roll_number), 0) AS max_roll FROM public.student_enrollments WHERE class_id = $1 AND academic_year_id = $2;`,
      [toClassId, toAcademicYearId]
    )
    let nextDestRoll = Number(destMaxRollRes.rows[0]?.max_roll || 0)

    for (const row of sourceEnrollments.rows) {
      const studentId = row.student_id
      const exAction = exceptionMap.get(studentId)

      if (exAction === 'repeat') {
        // Mark old enrollment as archived/retained
        await client.query(
          `UPDATE public.student_enrollments SET status = 'archived', updated_at = NOW() WHERE id = $1;`,
          [row.id]
        )
        // Insert new enrollment in same class for new year
        await client.query(
          `INSERT INTO public.student_enrollments (academic_year_id, class_id, student_id, roll_number, section, status)
           VALUES ($1, $2, $3, $4, $5, 'active')
           ON CONFLICT (academic_year_id, class_id, student_id) DO UPDATE SET status = 'active';`,
          [toAcademicYearId, fromClassId, studentId, row.roll_number, row.section]
        )
        retainedCount++
      } else if (exAction === 'archive') {
        // Student dropped out or left school; close enrollment
        await client.query(
          `UPDATE public.student_enrollments SET status = 'transferred', updated_at = NOW() WHERE id = $1;`,
          [row.id]
        )
        archivedCount++
      } else {
        // Standard Promotion:
        // Close old enrollment as archived
        await client.query(
          `UPDATE public.student_enrollments SET status = 'archived', updated_at = NOW() WHERE id = $1;`,
          [row.id]
        )
        // Assign roll number (keep existing if unused in destination, otherwise increment)
        nextDestRoll++
        const assignedRoll = row.roll_number || nextDestRoll

        await client.query(
          `INSERT INTO public.student_enrollments (academic_year_id, class_id, student_id, roll_number, section, status)
           VALUES ($1, $2, $3, $4, $5, 'active')
           ON CONFLICT (academic_year_id, class_id, student_id) DO UPDATE SET status = 'active', roll_number = EXCLUDED.roll_number;`,
          [toAcademicYearId, toClassId, studentId, assignedRoll, row.section]
        )
        promotedCount++
      }
    }

    await client.query('COMMIT')

    revalidatePath('/admin', 'layout')
    revalidatePath('/maintenance', 'layout')
    return {
      success: true,
      data: {
        promotedCount,
        retainedCount,
        archivedCount,
      },
    }
  } catch (err: unknown) {
    await client.query('ROLLBACK')
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('Cohort promotion transaction failed:', msg)
    return { success: false, error: msg }
  } finally {
    client.release()
  }
}

/**
 * Executes an atomic cohort promotion batch with exception handling (repeaters, departures, graduations, newcomers).
 * Every batch is logged to audit_logs with a unique batchId for 24-hr disaster rollback.
 */
export async function executeCohortPromotionBatchAction(
  input: ExecuteCohortPromotionBatchInput
): Promise<{ success: boolean; data?: PromotionBatchReceipt; error?: string }> {
  const scope = await getServerUserScope()
  if (!scope.isPrivileged) {
    return { success: false, error: 'Access denied: Only administrators can execute cohort promotions.' }
  }

  const {
    fromClassId,
    toClassId,
    fromAcademicYearId,
    toAcademicYearId,
    isGraduation = false,
    students,
    lateralNewcomers = [],
    notes,
  } = input

  if (!fromClassId || !fromAcademicYearId || !toAcademicYearId) {
    return { success: false, error: 'Source class, source year, and target year are required.' }
  }

  if (!isGraduation && !toClassId) {
    return { success: false, error: 'Destination class is required for promotion.' }
  }

  const pool = getPgPool()
  const client = await pool.connect()

  const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

  try {
    await client.query('BEGIN')

    // 1. Pre-flight roll collision validation within batch
    const targetRollsByClass = new Map<string, Map<number, string>>()
    for (const item of students) {
      if (item.action === 'promote' || item.action === 'repeat') {
        const destClass = item.action === 'repeat' ? fromClassId : (toClassId || fromClassId)
        const roll = item.targetRollNumber
        if (!roll || roll <= 0) {
          await client.query('ROLLBACK')
          return {
            success: false,
            error: `Invalid roll number: student ${item.studentId} has roll ${roll || 0}. All active/repeater students must have a valid positive roll number.`,
          }
        }
        const classRolls = targetRollsByClass.get(destClass) || new Map<number, string>()
        if (classRolls.has(roll)) {
          await client.query('ROLLBACK')
          return {
            success: false,
            error: `Roll number collision in batch: Roll #${roll} is assigned to multiple students entering ${destClass}. Every student must have a unique roll number.`,
          }
        }
        classRolls.set(roll, item.studentId)
        targetRollsByClass.set(destClass, classRolls)
      }
    }

    for (const newcomer of lateralNewcomers) {
      const destClass = isGraduation ? fromClassId : toClassId!
      const roll = newcomer.targetRollNumber
      if (!roll || roll <= 0) {
        await client.query('ROLLBACK')
        return {
          success: false,
          error: `Invalid roll number for newcomer "${newcomer.fullName}". All newcomers must have a valid roll number.`,
        }
      }
      const classRolls = targetRollsByClass.get(destClass) || new Map<number, string>()
      if (classRolls.has(roll)) {
        await client.query('ROLLBACK')
        return {
          success: false,
          error: `Roll number collision in batch: Roll #${roll} is assigned to newcomer "${newcomer.fullName}" and another student in ${destClass}.`,
        }
      }
      classRolls.set(roll, newcomer.fullName)
      targetRollsByClass.set(destClass, classRolls)
    }

    // 2. Database collision check: ensure no roll conflicts with already active students in destination class
    for (const [destClass, classRolls] of targetRollsByClass.entries()) {
      const existingRes = await client.query(
        `SELECT se.roll_number, s.full_name, se.student_id
         FROM public.student_enrollments se
         JOIN public.students s ON s.id = se.student_id
         WHERE se.academic_year_id = $1 AND se.class_id = $2 AND se.status = 'active';`,
        [toAcademicYearId, destClass]
      )
      for (const ex of existingRes.rows) {
        // Exclude students who are part of this current promotion batch (their roll is being updated in this batch)
        const isStudentInBatch = students.some((s) => s.studentId === ex.student_id)
        if (isStudentInBatch) {
          continue
        }

        if (classRolls.has(ex.roll_number)) {
          await client.query('ROLLBACK')
          return {
            success: false,
            error: `Database collision: Roll #${ex.roll_number} is already occupied in ${destClass} (${toAcademicYearId}) by ${ex.full_name}. Please resequence rolls starting after #${ex.roll_number} or use Sort Rolls (A–Z).`,
          }
        }
      }
    }

    let promotedCount = 0
    let retainedCount = 0
    let transferredCount = 0
    let graduatedCount = 0
    let newcomersCount = 0

    const archivedEnrollmentIds: string[] = []
    const createdEnrollmentIds: string[] = []
    const transferredEnrollmentIds: string[] = []
    const graduatedEnrollmentIds: string[] = []
    const createdStudentIds: string[] = []

    for (const item of students) {
      if (item.isExistingTarget) {
        // Student is already enrolled in the target class & year (e.g. repeaters like Krishma Nepali)
        // Simply update their roll number in place
        await client.query(
          `UPDATE public.student_enrollments 
           SET roll_number = $1, status = 'active', updated_at = NOW() 
           WHERE id = $2;`,
          [item.targetRollNumber || 1, item.enrollmentId]
        )
        retainedCount++
      } else if (item.action === 'promote') {
        // Close old enrollment as archived
        await client.query(
          `UPDATE public.student_enrollments SET status = 'archived', updated_at = NOW() WHERE id = $1;`,
          [item.enrollmentId]
        )
        archivedEnrollmentIds.push(item.enrollmentId)

        // Insert new enrollment in target class & year with specified roll number
        const insertRes = await client.query(
          `INSERT INTO public.student_enrollments (academic_year_id, class_id, student_id, roll_number, section, status)
           VALUES ($1, $2, $3, $4, $5, 'active')
           ON CONFLICT (academic_year_id, class_id, student_id) 
           DO UPDATE SET status = 'active', roll_number = EXCLUDED.roll_number
           RETURNING id;`,
          [toAcademicYearId, toClassId, item.studentId, item.targetRollNumber || 1, item.section || 'A']
        )
        if (insertRes.rows[0]?.id) {
          createdEnrollmentIds.push(insertRes.rows[0].id)
        }
        promotedCount++
      } else if (item.action === 'repeat') {
        // User Decision A1: Retain in current class for target year (archive old year, create new active in same class)
        await client.query(
          `UPDATE public.student_enrollments SET status = 'archived', updated_at = NOW() WHERE id = $1;`,
          [item.enrollmentId]
        )
        archivedEnrollmentIds.push(item.enrollmentId)

        const insertRes = await client.query(
          `INSERT INTO public.student_enrollments (academic_year_id, class_id, student_id, roll_number, section, status)
           VALUES ($1, $2, $3, $4, $5, 'active')
           ON CONFLICT (academic_year_id, class_id, student_id) 
           DO UPDATE SET status = 'active', roll_number = EXCLUDED.roll_number
           RETURNING id;`,
          [toAcademicYearId, fromClassId, item.studentId, item.targetRollNumber || 1, item.section || 'A']
        )
        if (insertRes.rows[0]?.id) {
          createdEnrollmentIds.push(insertRes.rows[0].id)
        }
        retainedCount++
      } else if (item.action === 'transferred') {
        await client.query(
          `UPDATE public.student_enrollments SET status = 'transferred', updated_at = NOW() WHERE id = $1;`,
          [item.enrollmentId]
        )
        transferredEnrollmentIds.push(item.enrollmentId)
        transferredCount++
      } else if (item.action === 'graduated') {
        // Terminal class graduation
        await client.query(
          `UPDATE public.student_enrollments SET status = 'graduated', updated_at = NOW() WHERE id = $1;`,
          [item.enrollmentId]
        )
        graduatedEnrollmentIds.push(item.enrollmentId)
        graduatedCount++
      }
    }

    // Process lateral newcomers
    for (const newcomer of lateralNewcomers) {
      if (!newcomer.fullName.trim()) continue

      // 1. Insert student (preserves raw RFID / admission numbers; if empty, uses non-year-coded synthetic sequence)
      const studentRes = await client.query(
        `INSERT INTO public.students (full_name, admission_no, gender, is_active)
         VALUES ($1, $2, $3, true)
         RETURNING id;`,
        [
          newcomer.fullName.trim(),
          newcomer.admissionNo.trim() || `ADM-${Math.floor(10000 + Math.random() * 90000)}`,
          newcomer.gender || 'male',
        ]
      )
      const newStudentId = studentRes.rows[0]?.id
      if (newStudentId) {
        createdStudentIds.push(newStudentId)

        // 2. Enroll student into target class for target year
        const destClass = isGraduation ? fromClassId : toClassId!
        const enrollRes = await client.query(
          `INSERT INTO public.student_enrollments (academic_year_id, class_id, student_id, roll_number, section, status)
           VALUES ($1, $2, $3, $4, $5, 'active')
           RETURNING id;`,
          [toAcademicYearId, destClass, newStudentId, newcomer.targetRollNumber || 1, newcomer.section || 'A']
        )
        if (enrollRes.rows[0]?.id) {
          createdEnrollmentIds.push(enrollRes.rows[0].id)
        }
        newcomersCount++
      }
    }

    // Record in public.audit_logs
    const actorId = scope.userId && /^[0-9a-f-]{36}$/i.test(scope.userId) ? scope.userId : null
    const label = `Promoted Cohort: ${fromClassId} (${fromAcademicYearId}) -> ${isGraduation ? 'Graduated' : toClassId + ' (' + toAcademicYearId + ')'}`
    
    await client.query(
      `INSERT INTO public.audit_logs (
        actor_id, actor_name, actor_role, action, entity_type, entity_id, entity_label, changes, metadata
      ) VALUES ($1, $2, $3, 'PROMOTION_BATCH', 'cohort_promotion', $4, $5, $6, $7);`,
      [
        actorId,
        scope.fullName || 'Administrator',
        scope.role || 'super_admin',
        batchId,
        label,
        JSON.stringify({
          archivedEnrollmentIds,
          createdEnrollmentIds,
          transferredEnrollmentIds,
          graduatedEnrollmentIds,
          createdStudentIds,
        }),
        JSON.stringify({
          batchId,
          fromClassId,
          toClassId: toClassId || null,
          fromAcademicYearId,
          toAcademicYearId,
          isGraduation,
          promotedCount,
          retainedCount,
          transferredCount,
          graduatedCount,
          newcomersCount,
          notes: notes || null,
        }),
      ]
    )

    await client.query('COMMIT')

    revalidatePath('/admin', 'layout')
    revalidatePath('/maintenance', 'layout')
    revalidatePath('/', 'layout')

    return {
      success: true,
      data: {
        batchId,
        promotedCount,
        retainedCount,
        transferredCount,
        graduatedCount,
        newcomersCount,
        totalProcessed: students.length + newcomersCount,
      },
    }
  } catch (err: unknown) {
    await client.query('ROLLBACK')
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('Batch cohort promotion failed:', msg)
    return { success: false, error: msg }
  } finally {
    client.release()
  }
}

/**
 * Retrieves recent promotion batches from the last 48 hours for the 24-hr rollback drawer.
 */
export async function getRecentPromotionBatchesAction(): Promise<{
  success: boolean
  data: PromotionBatchHistoryItem[]
  error?: string
}> {
  try {
    const pool = getPgPool()
    const query = `
      SELECT 
        id,
        created_at,
        actor_name,
        entity_id AS "batchId",
        entity_label,
        metadata
      FROM public.audit_logs
      WHERE action = 'PROMOTION_BATCH'
        AND entity_type = 'cohort_promotion'
        AND created_at >= NOW() - INTERVAL '48 hours'
      ORDER BY created_at DESC
      LIMIT 10;
    `
    const res = await pool.query(query)
    return {
      success: true,
      data: res.rows.map((r) => ({
        id: r.id,
        batchId: r.batchId,
        createdAt: new Date(r.created_at).toISOString(),
        actorName: r.actor_name,
        entityLabel: r.entity_label,
        metadata: r.metadata,
      })),
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, data: [], error: msg }
  }
}

/**
 * 1-Click Rollback for an accidental promotion batch.
 * Atomically removes target enrollments and restores source enrollments to 'active'.
 */
export async function rollbackCohortPromotionBatchAction(
  batchId: string
): Promise<{ success: boolean; error?: string }> {
  const scope = await getServerUserScope()
  if (!scope.isPrivileged) {
    return { success: false, error: 'Access denied: Only administrators can rollback promotions.' }
  }

  if (!batchId) {
    return { success: false, error: 'Batch identifier is required for rollback.' }
  }

  const pool = getPgPool()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // 1. Fetch batch record from audit_logs
    const auditRes = await client.query(
      `SELECT id, entity_label, changes, metadata 
       FROM public.audit_logs 
       WHERE action = 'PROMOTION_BATCH' 
         AND entity_id = $1 
       LIMIT 1;`,
      [batchId]
    )

    if (auditRes.rows.length === 0) {
      await client.query('ROLLBACK')
      return { success: false, error: 'Promotion batch record not found in audit logs.' }
    }

    // Check if already rolled back
    const alreadyRolledBack = await client.query(
      `SELECT id FROM public.audit_logs WHERE action = 'PROMOTION_ROLLBACK' AND entity_id = $1 LIMIT 1;`,
      [batchId]
    )
    if (alreadyRolledBack.rows.length > 0) {
      await client.query('ROLLBACK')
      return { success: false, error: 'This promotion batch has already been rolled back.' }
    }

    const changes = auditRes.rows[0].changes || {}
    const {
      createdEnrollmentIds = [],
      createdStudentIds = [],
      archivedEnrollmentIds = [],
      transferredEnrollmentIds = [],
      graduatedEnrollmentIds = [],
    } = changes

    // 2. Delete created enrollments
    if (Array.isArray(createdEnrollmentIds) && createdEnrollmentIds.length > 0) {
      await client.query(
        `DELETE FROM public.student_enrollments WHERE id = ANY($1::uuid[]);`,
        [createdEnrollmentIds]
      )
    }

    // 3. Delete created newcomer students
    if (Array.isArray(createdStudentIds) && createdStudentIds.length > 0) {
      await client.query(
        `DELETE FROM public.students WHERE id = ANY($1::uuid[]);`,
        [createdStudentIds]
      )
    }

    // 4. Restore archived source enrollments back to active
    if (Array.isArray(archivedEnrollmentIds) && archivedEnrollmentIds.length > 0) {
      await client.query(
        `UPDATE public.student_enrollments SET status = 'active', updated_at = NOW() WHERE id = ANY($1::uuid[]);`,
        [archivedEnrollmentIds]
      )
    }

    // 5. Restore transferred source enrollments back to active
    if (Array.isArray(transferredEnrollmentIds) && transferredEnrollmentIds.length > 0) {
      await client.query(
        `UPDATE public.student_enrollments SET status = 'active', updated_at = NOW() WHERE id = ANY($1::uuid[]);`,
        [transferredEnrollmentIds]
      )
    }

    // 6. Restore graduated source enrollments back to active
    if (Array.isArray(graduatedEnrollmentIds) && graduatedEnrollmentIds.length > 0) {
      await client.query(
        `UPDATE public.student_enrollments SET status = 'active', updated_at = NOW() WHERE id = ANY($1::uuid[]);`,
        [graduatedEnrollmentIds]
      )
    }

    // 7. Log rollback event
    const actorId = scope.userId && /^[0-9a-f-]{36}$/i.test(scope.userId) ? scope.userId : null
    await client.query(
      `INSERT INTO public.audit_logs (
        actor_id, actor_name, actor_role, action, entity_type, entity_id, entity_label, changes, metadata
      ) VALUES ($1, $2, $3, 'PROMOTION_ROLLBACK', 'cohort_promotion', $4, $5, $6, $7);`,
      [
        actorId,
        scope.fullName || 'Administrator',
        scope.role || 'super_admin',
        batchId,
        `Rolled Back Promotion Batch: ${auditRes.rows[0].entity_label}`,
        JSON.stringify({ restoredBatchId: batchId }),
        JSON.stringify({
          batchId,
          rolledBackAt: new Date().toISOString(),
          actorName: scope.fullName,
        }),
      ]
    )

    await client.query('COMMIT')

    revalidatePath('/admin', 'layout')
    revalidatePath('/maintenance', 'layout')
    revalidatePath('/', 'layout')

    return { success: true }
  } catch (err: unknown) {
    await client.query('ROLLBACK')
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('Promotion rollback failed:', msg)
    return { success: false, error: msg }
  } finally {
    client.release()
  }
}


