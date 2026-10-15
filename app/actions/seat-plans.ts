'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getPgPool } from '@/lib/db'
import { getServerUserScope } from '@/lib/context/server-user-scope'
import type {
  CohortSeatPlanData,
  WorkstationWithAssignment,
  AssignStudentInput,
  SwapStudentsInput,
  AutoAssignInput,
  AutoAssignResult,
  AutoAssignStrategy,
  ClearSeatPlanInput,
  RecordSessionOverrideInput,
  SessionOverrideRecord,
} from '@/lib/types/seat-plans'
import type { StudentWithEnrollment } from '@/lib/types/students'

export type {
  CohortSeatPlanData,
  WorkstationWithAssignment,
  AssignStudentInput,
  SwapStudentsInput,
  AutoAssignInput,
  AutoAssignResult,
  AutoAssignStrategy,
  ClearSeatPlanInput,
  RecordSessionOverrideInput,
  SessionOverrideRecord,
}

function isScopeAuthorized(
  assignedClasses: string[],
  assignedLabIds: string[],
  isPrivileged: boolean,
  classIdOrName: string,
  labId: string
): boolean {
  if (isPrivileged) return true
  const norm = (s: string) => s.toLowerCase().replace(/[\s-_]/g, '')
  const hasClass = assignedClasses.some((c) => norm(c) === norm(classIdOrName))
  const hasLab = assignedLabIds.some((l) => norm(l) === norm(labId))
  return hasClass && hasLab
}

async function resolveCanonicalClass(supabase: any, classIdOrName: string): Promise<{ id: string; name: string } | null> {
  const norm = (s: string) => s.toLowerCase().trim()
  const { data: classRows } = await supabase.from('classes').select('id, name')
  if (!classRows || classRows.length === 0) return null
  const target = norm(classIdOrName)
  return classRows.find(
    (c: any) => norm(c.id) === target || norm(c.name) === target || norm(c.id) === target.replace(/[\s-_]/g, '')
  ) || null
}

/**
 * Returns the complete floor plan, workstation assignments, active issues,
 * and unassigned student tray for a specific laboratory cohort.
 */
export async function getLabSeatPlan(params: {
  labId: string
  classId: string
  academicYearId?: string
  internalBypassScopeCheck?: boolean
}): Promise<{ success: boolean; data?: CohortSeatPlanData; error?: string }> {
  try {
    const scope = await getServerUserScope()

    if (!params.internalBypassScopeCheck && !isScopeAuthorized(scope.assignedClasses, scope.assignedLabIds, scope.isPrivileged, params.classId, params.labId)) {
      return {
        success: false,
        error: `Access denied: You do not have permission to view seat plan for ${params.classId} in lab ${params.labId}.`,
      }
    }

    const supabase = await createClient()

    // 1. Resolve canonical class & lab details
    const canonicalClass = await resolveCanonicalClass(supabase, params.classId)
    const effectiveClassId = canonicalClass?.id || params.classId
    const className = canonicalClass?.name || params.classId

    const { data: labData } = await supabase.from('labs').select('id, name').eq('id', params.labId).single()
    const labName = labData?.name || 'Computer Laboratory'

    // 2. Resolve academic year
    let targetYearId = params.academicYearId
    let yearName = 'Current Academic Year'
    if (!targetYearId) {
      const { data: currentYear } = await supabase
        .from('academic_years')
        .select('id, name')
        .eq('is_current', true)
        .maybeSingle()
      if (!currentYear?.id) {
        return { success: false, error: 'No active academic year configured. Please select or configure an academic year in Settings.' }
      }
      targetYearId = currentYear.id
      yearName = currentYear.name || 'Current Academic Year'
    } else {
      const { data: yearRow } = await supabase.from('academic_years').select('name').eq('id', targetYearId).single()
      if (yearRow) yearName = yearRow.name
    }

    // 3. Fetch active workstations in this lab
    const { data: workstationsData, error: wsErr } = await supabase
      .from('workstations')
      .select('*')
      .eq('lab_id', params.labId)
      .eq('is_active', true)
      .order('label', { ascending: true })

    if (wsErr) {
      return { success: false, error: 'Failed to fetch workstations for this lab.' }
    }
    const workstations = workstationsData || []

    // 4. Fetch active issues for these workstations
    const wsIds = workstations.map((w: any) => w.id)
    const { data: issuesData } = wsIds.length > 0
      ? await supabase
          .from('workstation_issues')
          .select('id, workstation_id, title, severity, status')
          .in('workstation_id', wsIds)
          .in('status', ['open', 'acknowledged', 'in_progress'])
      : { data: [] }

    const issueMap = new Map<string, any>()
    ;(issuesData || []).forEach((issue: any) => {
      // Pick highest severity if multiple
      if (!issueMap.has(issue.workstation_id)) {
        issueMap.set(issue.workstation_id, issue)
      }
    })

    // 5. Fetch default seat plan assignments for (lab_id, academic_year_id, class_id)
    const { data: seatPlansData, error: spErr } = await supabase
      .from('workstation_seat_plans')
      .select(`
        id,
        workstation_id,
        enrollment_id,
        notes,
        student_enrollments!inner (
          id,
          roll_number,
          student_id,
          students!inner (
            id,
            full_name,
            photo_url
          )
        )
      `)
      .eq('lab_id', params.labId)
      .eq('academic_year_id', targetYearId)
      .eq('class_id', effectiveClassId)

    if (spErr) {
      console.error('Error fetching seat plans:', spErr)
    }

    const assignmentMap = new Map<string, any>()
    const assignedEnrollmentIds = new Set<string>()

    ;(seatPlansData || []).forEach((row: any) => {
      assignmentMap.set(row.workstation_id, {
        seat_plan_id: row.id,
        workstation_id: row.workstation_id,
        enrollment_id: row.enrollment_id,
        student_id: row.student_enrollments.students.id,
        student_name: row.student_enrollments.students.full_name,
        roll_number: row.student_enrollments.roll_number,
        notes: row.notes,
        photo_url: row.student_enrollments.students.photo_url || null,
      })
      assignedEnrollmentIds.add(row.enrollment_id)
    })

    // 6. Fetch today's session seat overrides if any
    const today = new Date().toISOString().split('T')[0]
    const { data: overridesData } = wsIds.length > 0
      ? await supabase
          .from('session_seat_overrides')
          .select(`
            id,
            workstation_id,
            original_workstation_id,
            reason,
            enrollment_id,
            student_enrollments!inner (
              roll_number,
              students!inner (
                full_name,
                photo_url
              )
            ),
            original_ws:original_workstation_id (
              label
            )
          `)
          .in('workstation_id', wsIds)
          .eq('session_date', today)
      : { data: [] }

    const overrideMap = new Map<string, any>()
    ;(overridesData || []).forEach((ov: any) => {
      overrideMap.set(ov.workstation_id, {
        override_id: ov.id,
        student_name: ov.student_enrollments.students.full_name,
        roll_number: ov.student_enrollments.roll_number,
        reason: ov.reason,
        original_workstation_label: ov.original_ws?.label || null,
        photo_url: ov.student_enrollments.students.photo_url || null,
      })
    })

    // 7. Assemble Workstation nodes with assignment and issue state
    const enrichedWorkstations: WorkstationWithAssignment[] = workstations.map((ws: any) => ({
      ...ws,
      assignment: assignmentMap.get(ws.id) || null,
      active_issue: issueMap.get(ws.id) || null,
      session_override: overrideMap.get(ws.id) || null,
    }))

    // 8. Fetch all active enrolled students for this cohort to calculate unassigned tray
    const { data: allEnrollments } = await supabase
      .from('student_enrollments')
      .select(`
        id,
        academic_year_id,
        class_id,
        student_id,
        roll_number,
        section,
        status,
        students!inner (
          id,
          admission_no,
          registration_no,
          full_name,
          gender,
          is_active
        )
      `)
      .eq('academic_year_id', targetYearId)
      .eq('class_id', effectiveClassId)
      .eq('status', 'active')
      .order('roll_number', { ascending: true })

    const unassignedStudents: StudentWithEnrollment[] = []
    ;(allEnrollments || []).forEach((row: any) => {
      if (!assignedEnrollmentIds.has(row.id)) {
        unassignedStudents.push({
          student_id: row.students.id,
          enrollment_id: row.id,
          full_name: row.students.full_name,
          roll_number: row.roll_number,
          admission_no: row.students.admission_no,
          registration_no: row.students.registration_no,
          gender: row.students.gender,
          class_id: row.class_id,
          academic_year_id: row.academic_year_id,
          section: row.section,
          enrollment_status: row.status,
          is_active: row.students.is_active,
        })
      }
    })

    return {
      success: true,
      data: {
        lab_id: params.labId,
        lab_name: labName,
        academic_year_id: targetYearId,
        academic_year_name: yearName,
        class_id: effectiveClassId,
        class_name: className,
        workstations: enrichedWorkstations,
        unassigned_students: unassignedStudents,
        total_students: (allEnrollments || []).length,
        assigned_count: assignedEnrollmentIds.size,
        unassigned_count: unassignedStudents.length,
      },
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

/**
 * Assigns an enrolled student to a physical workstation.
 * Enforces Phase 1 uniqueness constraints and server-side authorization.
 */
export async function assignStudentToSeat(
  params: AssignStudentInput
): Promise<{ success: boolean; data?: { seatPlanId: string }; error?: string }> {
  try {
    const scope = await getServerUserScope()

    if (!scope.isPrivileged) {
      return {
        success: false,
        error: 'Access denied: Teachers have read-only access to seat plans. Only Super Admin and Lab In-Charge can assign seats.',
      }
    }

    if (!isScopeAuthorized(scope.assignedClasses, scope.assignedLabIds, scope.isPrivileged, params.class_id, params.lab_id)) {
      return { success: false, error: 'Access denied: You do not have permission to assign seats for this class/lab.' }
    }

    const supabase = await createClient()

    // 1. Resolve canonical class ID
    const canonicalClass = await resolveCanonicalClass(supabase, params.class_id)
    const effectiveClassId = canonicalClass?.id || params.class_id

    // 2. Validate workstation belongs to target lab and is active
    const { data: wsRow } = await supabase
      .from('workstations')
      .select('id, lab_id, is_active, label')
      .eq('id', params.workstation_id)
      .single()

    if (!wsRow || wsRow.lab_id !== params.lab_id || !wsRow.is_active) {
      return { success: false, error: 'Target workstation is invalid or decommissioned.' }
    }

    // 3. Validate student enrollment belongs to target class and academic year
    const { data: enrollRow } = await supabase
      .from('student_enrollments')
      .select('id, class_id, academic_year_id, roll_number, status')
      .eq('id', params.enrollment_id)
      .single()

    if (!enrollRow || enrollRow.class_id !== effectiveClassId || enrollRow.academic_year_id !== params.academic_year_id) {
      return { success: false, error: 'Selected student enrollment does not match the target cohort.' }
    }

    // 4. Check if workstation is already assigned to a DIFFERENT student in this cohort
    const { data: existingSeat } = await supabase
      .from('workstation_seat_plans')
      .select('id, enrollment_id')
      .eq('lab_id', params.lab_id)
      .eq('academic_year_id', params.academic_year_id)
      .eq('class_id', effectiveClassId)
      .eq('workstation_id', params.workstation_id)
      .maybeSingle()

    if (existingSeat && existingSeat.enrollment_id !== params.enrollment_id) {
      return { success: false, error: `${wsRow.label} is already occupied by another student in this cohort.` }
    }

    // 5. Check if student is already assigned to another workstation in this cohort (move behavior)
    const { data: studentCurrentSeat } = await supabase
      .from('workstation_seat_plans')
      .select('id, workstation_id')
      .eq('lab_id', params.lab_id)
      .eq('academic_year_id', params.academic_year_id)
      .eq('class_id', effectiveClassId)
      .eq('enrollment_id', params.enrollment_id)
      .maybeSingle()

    const pool = getPgPool()
    if (studentCurrentSeat && studentCurrentSeat.workstation_id !== params.workstation_id) {
      // Remove old seat allocation so student moves cleanly
      await pool.query('DELETE FROM public.workstation_seat_plans WHERE id = $1', [studentCurrentSeat.id])
    }

    // 6. Upsert the seat plan assignment
    const { rows: savedRows } = await pool.query(`
      INSERT INTO public.workstation_seat_plans (
        lab_id, academic_year_id, class_id, workstation_id, enrollment_id, notes, assigned_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (lab_id, academic_year_id, class_id, workstation_id)
      DO UPDATE SET
        enrollment_id = EXCLUDED.enrollment_id,
        notes = EXCLUDED.notes,
        assigned_by = EXCLUDED.assigned_by
      RETURNING id;
    `, [
      params.lab_id,
      params.academic_year_id,
      effectiveClassId,
      params.workstation_id,
      params.enrollment_id,
      params.notes || null,
      scope.userId || null,
    ])

    const savedPlanId = savedRows[0]?.id || ''
    revalidatePath('/maintenance', 'layout')
    return { success: true, data: { seatPlanId: savedPlanId } }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

/**
 * Removes a student from their default seat allocation.
 */
export async function clearSeatAssignment(
  seatPlanId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const scope = await getServerUserScope()
    const supabase = await createClient()

    // 1. Fetch seat plan to verify authorization
    const { data: plan } = await supabase
      .from('workstation_seat_plans')
      .select('class_id, lab_id')
      .eq('id', seatPlanId)
      .single()

    if (!plan) {
      return { success: false, error: 'Seat assignment not found.' }
    }

    if (!scope.isPrivileged) {
      return {
        success: false,
        error: 'Access denied: Teachers have read-only access to seat plans. Only Super Admin and Lab In-Charge can clear seat assignments.',
      }
    }

    if (!isScopeAuthorized(scope.assignedClasses, scope.assignedLabIds, scope.isPrivileged, plan.class_id, plan.lab_id)) {
      return { success: false, error: 'Access denied: You do not have permission to clear this seat assignment.' }
    }

    const pool = getPgPool()
    await pool.query('DELETE FROM public.workstation_seat_plans WHERE id = $1', [seatPlanId])

    revalidatePath('/maintenance', 'layout')
    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

/**
 * Performs an atomic swap between two physical workstations for a cohort.
 */
export async function swapStudents(
  params: SwapStudentsInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const scope = await getServerUserScope()

    if (!scope.isPrivileged) {
      return {
        success: false,
        error: 'Access denied: Teachers have read-only access to seat plans. Only Super Admin and Lab In-Charge can swap seats.',
      }
    }

    if (!isScopeAuthorized(scope.assignedClasses, scope.assignedLabIds, scope.isPrivileged, params.class_id, params.lab_id)) {
      return { success: false, error: 'Access denied: You do not have permission to swap seats for this cohort.' }
    }

    const supabase = await createClient()
    const canonicalClass = await resolveCanonicalClass(supabase, params.class_id)
    const effectiveClassId = canonicalClass?.id || params.class_id

    // Atomic swap executed via PostgreSQL stored procedure in a single transaction
    const { data: rpcRes, error: rpcErr } = await (supabase.rpc as any)('swap_workstation_seat_plans_tx', {
      p_lab_id: params.lab_id,
      p_academic_year_id: params.academic_year_id,
      p_class_id: effectiveClassId,
      p_ws_a: params.workstation_id_a,
      p_ws_b: params.workstation_id_b,
      p_user_id: scope.userId || null,
    })

    if (rpcErr) {
      return { success: false, error: rpcErr.message }
    }

    revalidatePath('/maintenance', 'layout')
    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

/**
 * Automatically assigns remaining unassigned students to available physical workstations
 * in roll number order. Existing manual seat allocations are strictly preserved.
 */
export async function autoAssignRemainingSeats(
  params: AutoAssignInput
): Promise<{ success: boolean; data?: AutoAssignResult; error?: string }> {
  try {
    const scope = await getServerUserScope()

    if (!scope.isPrivileged) {
      return {
        success: false,
        error: 'Access denied: Teachers have read-only access to seat plans. Only Super Admin and Lab In-Charge can auto-assign seats.',
      }
    }

    const supabase = await createClient()
    const canonicalClass = await resolveCanonicalClass(supabase, params.class_id)
    const effectiveClassId = canonicalClass?.id || params.class_id

    // 1. Fetch active workstations in lab (sorted by label)
    const { data: workstations } = await supabase
      .from('workstations')
      .select('id, label, is_active')
      .eq('lab_id', params.lab_id)
      .eq('is_active', true)
      .order('label', { ascending: true })

    if (!workstations || workstations.length === 0) {
      return { success: false, error: 'No active workstations found in this laboratory.' }
    }

    // 2. Fetch existing seat plan allocations for this cohort
    const { data: existingPlans } = await supabase
      .from('workstation_seat_plans')
      .select('workstation_id, enrollment_id')
      .eq('lab_id', params.lab_id)
      .eq('academic_year_id', params.academic_year_id)
      .eq('class_id', effectiveClassId)

    const occupiedWsIds = new Set((existingPlans || []).map((p: any) => p.workstation_id))
    const assignedEnrollmentIds = new Set((existingPlans || []).map((p: any) => p.enrollment_id))

    // 3. Available workstations (not occupied and not under critical hardware repair)
    const availableWsCandidates = workstations.filter((w: any) => !occupiedWsIds.has(w.id))

    // Check for critical/high severe issues or active repair (in_progress) that make a workstation unusable
    const candidateIds = availableWsCandidates.map((w: any) => w.id)
    const { data: candidateIssues } = candidateIds.length > 0
      ? await supabase
          .from('workstation_issues')
          .select('workstation_id, severity, status')
          .in('workstation_id', candidateIds)
          .in('status', ['open', 'in_progress'])
      : { data: [] }

    // Unavailable if actively under repair (in_progress) or severe fault (critical/high). Minor issues remain usable!
    const unavailableWsIds = new Set<string>()
    ;(candidateIssues || []).forEach((issue: any) => {
      if (issue.status === 'in_progress' || issue.severity === 'critical' || issue.severity === 'high') {
        unavailableWsIds.add(issue.workstation_id)
      }
    })

    const availableWs = availableWsCandidates.filter((w: any) => !unavailableWsIds.has(w.id))

    // Ensure natural alphanumeric sort for workstations (PC-01, PC-02 ... PC-10)
    availableWs.sort((a: any, b: any) =>
      (a.label || '').localeCompare(b.label || '', undefined, { numeric: true, sensitivity: 'base' })
    )

    // 4. Enrolled students who are not assigned yet
    const { data: allEnrollments } = await supabase
      .from('student_enrollments')
      .select(`
        id,
        roll_number,
        students!inner (
          id,
          full_name
        )
      `)
      .eq('academic_year_id', params.academic_year_id)
      .eq('class_id', effectiveClassId)
      .eq('status', 'active')
      .order('roll_number', { ascending: true })

    const unassignedStudents = (allEnrollments || []).filter((e: any) => !assignedEnrollmentIds.has(e.id))

    // Sort according to requested strategy (Roll 1..N or Alphabetical A–Z)
    if (params.strategy === 'alphabetical') {
      unassignedStudents.sort((a: any, b: any) => {
        const nameA = (a.students?.full_name || '').toLowerCase()
        const nameB = (b.students?.full_name || '').toLowerCase()
        return nameA.localeCompare(nameB)
      })
    } else {
      // Default: sort by roll number ascending
      unassignedStudents.sort((a: any, b: any) => (a.roll_number || 0) - (b.roll_number || 0))
    }

    if (unassignedStudents.length === 0) {
      return {
        success: true,
        data: {
          assigned_count: 0,
          already_assigned_count: assignedEnrollmentIds.size,
          remaining_unassigned_count: 0,
          available_workstations_count: availableWs.length,
          assignments: [],
        },
      }
    }

    // 5. Match unassigned students to available workstations
    const numToAssign = Math.min(unassignedStudents.length, availableWs.length)
    const newInserts: any[] = []
    const summaryAssignments: any[] = []

    for (let i = 0; i < numToAssign; i++) {
      const student = unassignedStudents[i]
      const ws = availableWs[i]

      newInserts.push({
        lab_id: params.lab_id,
        academic_year_id: params.academic_year_id,
        class_id: effectiveClassId,
        workstation_id: ws.id,
        enrollment_id: student.id,
        assigned_by: scope.userId || null,
      })

      summaryAssignments.push({
        workstation_label: ws.label,
        student_name: (student as any).students.full_name,
        roll_number: student.roll_number,
      })
    }

    if (newInserts.length > 0) {
      const pool = getPgPool()
      for (const ins of newInserts) {
        await pool.query(`
          INSERT INTO public.workstation_seat_plans (
            lab_id, academic_year_id, class_id, workstation_id, enrollment_id, assigned_by
          ) VALUES ($1, $2, $3, $4, $5, $6);
        `, [ins.lab_id, ins.academic_year_id, ins.class_id, ins.workstation_id, ins.enrollment_id, ins.assigned_by])
      }
    }

    revalidatePath('/maintenance', 'layout')
    return {
      success: true,
      data: {
        assigned_count: numToAssign,
        already_assigned_count: assignedEnrollmentIds.size,
        remaining_unassigned_count: unassignedStudents.length - numToAssign,
        available_workstations_count: availableWs.length - numToAssign,
        assignments: summaryAssignments,
      },
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

/**
 * Clears all baseline workstation seat allocations for a cohort in a specific laboratory.
 * Only Super Admin and Lab In-Charge are authorized to clear baseline seat plans.
 */
export async function clearAllCohortSeats(
  params: ClearSeatPlanInput
): Promise<{ success: boolean; clearedCount?: number; error?: string }> {
  try {
    const scope = await getServerUserScope()

    if (!scope.isPrivileged) {
      return {
        success: false,
        error: 'Access denied: Only Super Admin and Lab In-Charge can reset cohort seat plans.',
      }
    }

    if (!isScopeAuthorized(scope.assignedClasses, scope.assignedLabIds, scope.isPrivileged, params.class_id, params.lab_id)) {
      return { success: false, error: 'Access denied: You do not have permission to modify seat plans for this class/lab.' }
    }

    const supabase = await createClient()
    const canonicalClass = await resolveCanonicalClass(supabase, params.class_id)
    const effectiveClassId = canonicalClass?.id || params.class_id

    const pool = getPgPool()
    const delRes = await pool.query(
      `DELETE FROM public.workstation_seat_plans
       WHERE lab_id = $1 AND academic_year_id = $2 AND class_id = $3
       RETURNING id;`,
      [params.lab_id, params.academic_year_id, effectiveClassId]
    )

    const clearedCount = delRes.rowCount || 0
    revalidatePath('/maintenance', 'layout')
    revalidatePath('/computer-lab', 'layout')
    return { success: true, clearedCount }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}


/**
 * Records a temporary session seat override for an ongoing practical session.
 * Destination collision and student uniqueness guards are enforced.
 */
export async function createSessionSeatOverride(
  input: RecordSessionOverrideInput
): Promise<{ success: boolean; data?: { overrideId: string }; error?: string }> {
  try {
    const scope = await getServerUserScope()

    if (!scope.isPrivileged) {
      return {
        success: false,
        error: 'Access denied: Teachers have read-only access. Session seat overrides must be recorded by Super Admin or Lab In-Charge.',
      }
    }

    const supabase = await createClient()

    if (!input.workstation_id || !input.enrollment_id || !input.session_date) {
      return { success: false, error: 'Workstation, student enrollment, and session date are required.' }
    }

    // Check collision on destination workstation for the session
    let collisionQuery = supabase
      .from('session_seat_overrides')
      .select('id')
      .eq('session_date', input.session_date)
      .eq('workstation_id', input.workstation_id)

    if (input.schedule_id) {
      collisionQuery = collisionQuery.eq('schedule_id', input.schedule_id)
    } else {
      collisionQuery = collisionQuery.is('schedule_id', null)
    }

    const { data: wsCollision } = await collisionQuery.maybeSingle()

    if (wsCollision) {
      return { success: false, error: 'Destination workstation is already assigned as an override in this session.' }
    }

    const pool = getPgPool()
    const { rows: ovRows } = await pool.query(`
      INSERT INTO public.session_seat_overrides (
        schedule_id, session_date, practical_log_id, enrollment_id, workstation_id, original_workstation_id, reason, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id;
    `, [
      input.schedule_id || null,
      input.session_date,
      input.practical_log_id || null,
      input.enrollment_id,
      input.workstation_id,
      input.original_workstation_id || null,
      input.reason.trim(),
      scope.userId || null,
    ])

    const overrideId = ovRows[0]?.id || ''
    revalidatePath('/maintenance', 'layout')
    return { success: true, data: { overrideId } }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

/**
 * Removes a temporary session seat override.
 */
export async function clearSessionSeatOverride(
  overrideId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const scope = await getServerUserScope()

    if (!scope.isPrivileged) {
      return {
        success: false,
        error: 'Access denied: Teachers have read-only access. Session seat overrides must be cleared by Super Admin or Lab In-Charge.',
      }
    }

    const pool = getPgPool()
    await pool.query('DELETE FROM public.session_seat_overrides WHERE id = $1', [overrideId])
    revalidatePath('/maintenance', 'layout')
    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

/**
 * Returns the list of academic classes authorized for the current user.
 * Enforces server-side boundary: Teachers strictly receive their assigned classes;
 * Privileged users receive all institutional classes.
 */
export async function getAuthorizedClasses(): Promise<{
  success: boolean
  data: Array<{ id: string; name: string; grade: number; section: string }>
  error?: string
}> {
  try {
    const scope = await getServerUserScope()
    const supabase = await createClient()

    const { data: allActive, error } = await supabase
      .from('classes')
      .select('id, name, grade, section')
      .eq('is_active', true)
      .order('grade', { ascending: false })
      .order('name', { ascending: true })

    if (error) return { success: false, data: [], error: error.message }

    const rawList = (allActive || []) as Array<{ id: string; name: string; grade: number; section: string }>

    if (!scope.isPrivileged) {
      const norm = (s: string) => s.toLowerCase().replace(/[\s-_]/g, '')
      const assigned = scope.assignedClasses.map(norm)
      const filtered = rawList.filter((c) =>
        assigned.includes(norm(c.id)) || assigned.includes(norm(c.name))
      )
      return { success: true, data: filtered }
    }

    return { success: true, data: rawList }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, data: [], error: msg }
  }
}

/**
 * Returns the effective visual seat plan for an ongoing/specific practical session.
 * Merges the Tier-1 base cohort seat plan with any Tier-2 session seat overrides.
 * Strictly checks teacher authorization: Teachers can only view sessions assigned to them.
 */
export async function getSessionSeatPlan(params: {
  scheduleId: string
  sessionDate: string
}): Promise<{
  success: boolean
  data?: CohortSeatPlanData & {
    schedule_id: string
    session_date: string
    subject_code?: string
    subject_title?: string
    teacher_name?: string
    override_count: number
  }
  error?: string
}> {
  try {
    const scope = await getServerUserScope()
    const supabase = await createClient()

    // 1. Fetch schedule with profiles join for teacher name
    const { data: schedule, error: schedErr } = await supabase
      .from('schedules')
      .select(`
        id,
        batch_name,
        lab_id,
        teacher_id,
        subject_name,
        metadata,
        profiles (
          id,
          full_name
        )
      `)
      .eq('id', params.scheduleId)
      .maybeSingle()

    if (schedErr || !schedule) {
      return { success: false, error: 'Target timetable session not found.' }
    }

    const teacherName = (schedule as any).profiles?.full_name || (schedule as any).metadata?.teacher || null
    const subjectName = (schedule as any).subject_name || ''
    const subjectCode = subjectName.includes(' - ') ? subjectName.split(' - ')[0].trim() : subjectName
    const subjectTitle = subjectName.includes(' - ') ? subjectName.split(' - ').slice(1).join(' - ').trim() : subjectName

    // 2. Teacher Authorization Check
    // Teacher only sees sessions assigned to that teacher!
    if (!scope.isPrivileged) {
      const isOwner =
        (schedule.teacher_id && schedule.teacher_id === scope.userId) ||
        (scope.fullName &&
          teacherName &&
          teacherName.toLowerCase().trim() === scope.fullName.toLowerCase().trim())

      if (!isOwner) {
        return {
          success: false,
          error: 'Access denied: Teachers can only view seat plans for their own assigned sessions.',
        }
      }
    }

    // 3. Resolve canonical class ID from batch_name
    const canonicalClass = await resolveCanonicalClass(supabase, schedule.batch_name)
    const effectiveClassId = canonicalClass?.id || schedule.batch_name

    // 4. Fetch base Tier 1 plan (session ownership already validated above)
    const basePlanRes = await getLabSeatPlan({
      labId: schedule.lab_id,
      classId: effectiveClassId,
      internalBypassScopeCheck: true,
    })

    if (!basePlanRes.success || !basePlanRes.data) {
      return { success: false, error: basePlanRes.error || 'Failed to fetch base seat plan.' }
    }

    // 5. Fetch Tier 2 Session Overrides for this schedule & date
    const { data: overridesData } = await supabase
      .from('session_seat_overrides')
      .select(`
        id,
        enrollment_id,
        workstation_id,
        original_workstation_id,
        reason,
        student_enrollments!inner (
          id,
          roll_number,
          students!inner (
            id,
            full_name
          )
        )
      `)
      .eq('schedule_id', params.scheduleId)
      .eq('session_date', params.sessionDate)

    const overrides = (overridesData || []) as any[]

    // 6. Overlay Tier 2 onto workstations in view WITHOUT mutating Tier 1 database rows
    const workstationsMap = new Map<string, WorkstationWithAssignment>()
    basePlanRes.data.workstations.forEach((ws) => {
      workstationsMap.set(ws.id, { ...ws })
    })

    // Track which workstations were evacuated due to override
    const evacuatedWsIds = new Set<string>()
    overrides.forEach((ov) => {
      if (ov.original_workstation_id) {
        evacuatedWsIds.add(ov.original_workstation_id)
      }
    })

    // Apply evacuations and destinations
    workstationsMap.forEach((ws, wsId) => {
      if (evacuatedWsIds.has(wsId)) {
        ws.session_override = {
          override_id: 'evacuated',
          student_name: ws.assignment?.student_name || 'Student',
          roll_number: ws.assignment?.roll_number || 0,
          reason: 'Temporarily relocated to another workstation for this session',
          original_workstation_label: ws.label,
        }
      }
    })

    overrides.forEach((ov) => {
      const destWs = workstationsMap.get(ov.workstation_id)
      const origWs = ov.original_workstation_id ? workstationsMap.get(ov.original_workstation_id) : null
      if (destWs) {
        destWs.session_override = {
          override_id: ov.id,
          student_name: ov.student_enrollments.students.full_name,
          roll_number: ov.student_enrollments.roll_number,
          reason: ov.reason,
          original_workstation_label: origWs?.label || null,
        }
      }
    })

    return {
      success: true,
      data: {
        ...basePlanRes.data,
        workstations: Array.from(workstationsMap.values()),
        schedule_id: params.scheduleId,
        session_date: params.sessionDate,
        subject_code: subjectCode,
        subject_title: subjectTitle,
        teacher_name: teacherName || 'Assigned Instructor',
        override_count: overrides.length,
      },
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

