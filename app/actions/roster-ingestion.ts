'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getServerUserScope } from '@/lib/context/server-user-scope'
import { recordAuditEvent } from '@/lib/audit'
import { parseRosterFile } from '@/lib/roster-ingestion/parser'
import {
  validateParsedRoster,
  type DatabaseValidationContext,
} from '@/lib/roster-ingestion/validator'
import { generateBlankRosterTemplate } from '@/lib/roster-ingestion/template'
import type {
  RosterPreflightReport,
  RosterCommitResult,
  IngestionPayloadRow,
  IngestionMode,
  UnmatchedExistingStudent,
} from '@/lib/roster-ingestion/types'
import ExcelJS from 'exceljs'

export type {
  RosterPreflightReport,
  RosterCommitResult,
  IngestionPayloadRow,
  IngestionMode,
  UnmatchedExistingStudent,
}

/**
 * Resolves canonical class ID and human-readable name from public.classes
 */
async function resolveCanonicalClass(
  supabase: any,
  classIdOrName: string
): Promise<{ id: string; name: string } | null> {
  const norm = (s: string) => s.toLowerCase().trim()
  const { data: classRows } = await supabase.from('classes').select('id, name')
  if (!classRows || classRows.length === 0) return null
  const target = norm(classIdOrName)
  const match = classRows.find(
    (c: any) =>
      norm(c.id) === target ||
      norm(c.name) === target ||
      norm(c.id) === target.replace(/[\s-_]/g, '')
  )
  return match || null
}

/**
 * Resolves academic year ID and human-readable name from public.academic_years
 */
async function resolveAcademicYear(
  supabase: any,
  yearId?: string | null
): Promise<{ id: string; name: string } | null> {
  if (yearId) {
    const { data: year } = await supabase
      .from('academic_years')
      .select('id, name')
      .eq('id', yearId)
      .maybeSingle()
    if (year) return year
  }

  const { data: currentYear } = await supabase
    .from('academic_years')
    .select('id, name')
    .eq('is_current', true)
    .maybeSingle()

  return currentYear || null
}

/**
 * Pre-flight file validation action.
 * Parses upload file and evaluates database conflicts WITHOUT committing any records.
 */
export async function validateRosterFileAction(
  formData: FormData
): Promise<{ success: boolean; report?: RosterPreflightReport; error?: string }> {
  try {
    const scope = await getServerUserScope()
    if (!scope.isPrivileged) {
      return {
        success: false,
        error: 'Access denied: Only administrators and Lab In-Charges can import class rosters.',
      }
    }

    const file = formData.get('file') as File | null
    const targetAcademicYearId = formData.get('academicYearId') as string | null
    const targetClassId = formData.get('classId') as string | null
    const mode = ((formData.get('mode') as string) || 'sync') as IngestionMode

    if (!file || !(file instanceof File) || file.size === 0) {
      return { success: false, error: 'Please select a valid Excel (.xlsx, .xls) or CSV (.csv) file.' }
    }

    if (!targetClassId) {
      return { success: false, error: 'Please select a target class for roster ingestion.' }
    }

    const supabase = await createClient()

    // 1. Resolve canonical target year and class
    const canonicalClass = await resolveCanonicalClass(supabase, targetClassId)
    if (!canonicalClass) {
      return { success: false, error: `Class '${targetClassId}' not found in institution database.` }
    }

    const canonicalYear = await resolveAcademicYear(supabase, targetAcademicYearId)
    if (!canonicalYear) {
      return { success: false, error: 'Academic year not found in institution database.' }
    }

    // 2. Parse file buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const parsedRows = await parseRosterFile(buffer, file.name)

    // 3. Assemble database validation context
    // A. All active students with strong identifiers
    const { data: studentRows } = await supabase
      .from('students')
      .select('id, full_name, admission_no, registration_no, is_active')
      .eq('is_active', true)

    const studentsByAdm = new Map<string, { id: string; full_name: string; admission_no: string | null; registration_no: string | null }>()
    const studentsByReg = new Map<string, { id: string; full_name: string; admission_no: string | null; registration_no: string | null }>()
    const allActiveStudents: Array<{ id: string; full_name: string; admission_no: string | null }> = []

    ;(studentRows || []).forEach((s: any) => {
      allActiveStudents.push({ id: s.id, full_name: s.full_name, admission_no: s.admission_no })
      if (s.admission_no) studentsByAdm.set(s.admission_no.toLowerCase().trim(), s)
      if (s.registration_no) studentsByReg.set(s.registration_no.toLowerCase().trim(), s)
    })

    // B. Existing enrollments in target cohort
    const { data: enrollmentRows } = await supabase
      .from('student_enrollments')
      .select(`
        id,
        student_id,
        roll_number,
        status,
        students!inner(id, full_name, admission_no, registration_no)
      `)
      .eq('academic_year_id', canonicalYear.id)
      .eq('class_id', canonicalClass.id)
      .eq('status', 'active')

    const enrollmentsByStudentId = new Map<string, { id: string; roll_number: number }>()
    const enrollmentsByRoll = new Map<
      number,
      {
        id: string
        student_id: string
        full_name: string
        admission_no: string | null
        registration_no: string | null
      }
    >()
    const existingCohortStudents: Array<UnmatchedExistingStudent> = []

    // Fetch workstation seats for cohort enrollments
    const cohortEnrollmentIds = (enrollmentRows || []).map((e: any) => e.id)
    const seatMap = new Map<string, string>()

    if (cohortEnrollmentIds.length > 0) {
      const { data: seats } = await supabase
        .from('workstation_seat_plans')
        .select(`
          enrollment_id,
          workstations (
            label
          )
        `)
        .in('enrollment_id', cohortEnrollmentIds)

      ;(seats || []).forEach((sp: any) => {
        if (sp.workstations?.label) {
          seatMap.set(sp.enrollment_id, sp.workstations.label)
        }
      })
    }

    ;(enrollmentRows || []).forEach((e: any) => {
      enrollmentsByStudentId.set(e.student_id, { id: e.id, roll_number: e.roll_number })
      const st = e.students
      const full_name = st?.full_name || 'Enrolled Student'
      const admission_no = st?.admission_no || null
      const registration_no = st?.registration_no || null

      enrollmentsByRoll.set(e.roll_number, {
        id: e.id,
        student_id: e.student_id,
        full_name,
        admission_no,
        registration_no,
      })

      existingCohortStudents.push({
        id: e.id,
        student_id: e.student_id,
        roll_number: e.roll_number,
        full_name,
        admission_no,
        registration_no,
        workstation_label: seatMap.get(e.id) || null,
      })
    })

    // Check attendance count for cohort to determine clean slate eligibility
    let attendanceLogsCount = 0
    if (enrollmentRows && enrollmentRows.length > 0) {
      const enrollmentIds = enrollmentRows.map((e: any) => e.id)
      const { count } = await supabase
        .from('log_attendance')
        .select('id', { count: 'exact', head: true })
        .in('enrollment_id', enrollmentIds)
      attendanceLogsCount = count || 0
    }

    const dbContext: DatabaseValidationContext = {
      targetAcademicYearId: canonicalYear.id,
      targetAcademicYearName: canonicalYear.name,
      targetClassId: canonicalClass.id,
      targetClassName: canonicalClass.name,
      existingStudentsByAdmissionNo: studentsByAdm,
      existingStudentsByRegistrationNo: studentsByReg,
      allActiveStudents,
      existingEnrollmentsByStudentId: enrollmentsByStudentId,
      existingEnrollmentsByRoll: enrollmentsByRoll,
      existingCohortStudents,
      existingAttendanceLogsCount: attendanceLogsCount,
      mode,
    }

    // 4. Run pre-flight validator
    const report = validateParsedRoster(parsedRows, dbContext)
    return { success: true, report }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown pre-flight validation error'
    return { success: false, error: msg }
  }
}

/**
 * Commits pre-validated roster rows to PostgreSQL via atomic stored procedure.
 */
export async function commitRosterIngestionAction(input: {
  academicYearId: string
  classId: string
  rows: IngestionPayloadRow[]
  mode?: IngestionMode
}): Promise<{ success: boolean; result?: RosterCommitResult; error?: string }> {
  try {
    const scope = await getServerUserScope()
    if (!scope.isPrivileged) {
      return {
        success: false,
        error: 'Access denied: Only administrators and Lab In-Charges can commit roster ingestion.',
      }
    }

    if (!input.rows || input.rows.length === 0) {
      return { success: false, error: 'Cannot commit an empty roster.' }
    }

    const effectiveMode = input.mode || 'sync'
    const supabase = await createClient()

    // Resolve canonical class ID
    const canonicalClass = await resolveCanonicalClass(supabase, input.classId)
    const effectiveClassId = canonicalClass?.id || input.classId

    // 1. Invoke atomic PostgreSQL RPC
    const { data: rpcRes, error: rpcErr } = await (supabase.rpc as any)(
      'commit_roster_ingestion_tx',
      {
        p_academic_year_id: input.academicYearId,
        p_class_id: effectiveClassId,
        p_rows: input.rows,
        p_mode: effectiveMode,
      }
    )

    if (rpcErr) {
      console.error('Error committing roster ingestion RPC:', rpcErr)
      return { success: false, error: rpcErr.message }
    }

    // 2. Record administrative audit trail
    await recordAuditEvent({
      action: 'CREATE',
      entityType: 'roster',
      entityId: `${input.academicYearId}-${effectiveClassId}`,
      entityLabel: `Class Roster Ingestion (${effectiveMode.toUpperCase()}) — ${canonicalClass?.name || effectiveClassId}`,
      after: {
        academic_year_id: input.academicYearId,
        class_id: effectiveClassId,
        mode: effectiveMode,
        processed_rows: rpcRes.processed_rows,
        students_created: rpcRes.students_created,
        students_matched: rpcRes.students_matched,
        enrollments_created: rpcRes.enrollments_created,
        enrollments_retained: rpcRes.enrollments_retained,
        enrollments_updated: rpcRes.enrollments_updated,
      },
      metadata: {
        source: 'EXCEL_ROSTER_IMPORT',
        mode: effectiveMode,
        actor_id: scope.userId,
        actor_name: scope.fullName,
      },
    })

    // 3. Revalidate affected workspaces
    revalidatePath('/admin')
    revalidatePath('/admin', 'layout')
    revalidatePath('/maintenance')
    revalidatePath('/maintenance/workstations')
    revalidatePath('/records')
    revalidatePath('/', 'layout')

    return {
      success: true,
      result: {
        success: true,
        mode: effectiveMode,
        processed_rows: rpcRes.processed_rows,
        students_created: rpcRes.students_created,
        students_matched: rpcRes.students_matched,
        enrollments_created: rpcRes.enrollments_created,
        enrollments_retained: rpcRes.enrollments_retained,
        enrollments_updated: rpcRes.enrollments_updated,
      },
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown commit error'
    return { success: false, error: msg }
  }
}

/**
 * Generates and returns a blank 4-column roster template (.xlsx) as base64 string.
 */
export async function getBlankRosterTemplateAction(params?: {
  academicYearId?: string
  classId?: string
}): Promise<{ success: boolean; dataBase64?: string; fileName?: string; error?: string }> {
  try {
    const supabase = await createClient()
    let className: string | undefined
    let yearName: string | undefined

    if (params?.classId) {
      const canonicalClass = await resolveCanonicalClass(supabase, params.classId)
      className = canonicalClass?.name
    }

    if (params?.academicYearId) {
      const canonicalYear = await resolveAcademicYear(supabase, params.academicYearId)
      yearName = canonicalYear?.name
    }

    const buffer = await generateBlankRosterTemplate({
      academicYearName: yearName,
      className,
    })

    const cleanClassName = (className || 'Template').replace(/[^a-z0-9_-]/gi, '_')
    const fileName = `Roster_Template_${cleanClassName}.xlsx`

    return {
      success: true,
      dataBase64: buffer.toString('base64'),
      fileName,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to generate roster template.'
    return { success: false, error: msg }
  }
}

/**
 * Exports the active cohort roster with assigned computer lab seats to a styled Excel workbook.
 */
export async function exportCohortRosterAction(params: {
  academicYearId: string
  classId: string
}): Promise<{ success: boolean; dataBase64?: string; fileName?: string; error?: string }> {
  try {
    const scope = await getServerUserScope()
    if (!scope.isPrivileged && !scope.assignedClasses.includes(params.classId)) {
      return { success: false, error: 'Access denied: You do not have permission to export this roster.' }
    }

    const supabase = await createClient()
    const canonicalClass = await resolveCanonicalClass(supabase, params.classId)
    const effectiveClassId = canonicalClass?.id || params.classId
    const canonicalYear = await resolveAcademicYear(supabase, params.academicYearId)

    // Fetch enrollments with student data
    const { data: enrollments } = await supabase
      .from('student_enrollments')
      .select(`
        id,
        roll_number,
        status,
        students!inner (
          id,
          full_name,
          admission_no,
          registration_no
        )
      `)
      .eq('academic_year_id', params.academicYearId)
      .eq('class_id', effectiveClassId)
      .order('roll_number', { ascending: true })

    // Fetch Tier 1 seat assignments for this cohort in computer lab ('comp')
    const { data: seatPlans } = await supabase
      .from('workstation_seat_plans')
      .select(`
        enrollment_id,
        workstations!inner (
          label
        )
      `)
      .eq('academic_year_id', params.academicYearId)
      .eq('class_id', effectiveClassId)
      .eq('lab_id', 'comp')

    const seatMap = new Map<string, string>()
    ;(seatPlans || []).forEach((sp: any) => {
      seatMap.set(sp.enrollment_id, sp.workstations?.label || '—')
    })

    // Create Excel Workbook
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Class Roster')

    sheet.columns = [
      { header: 'Roll No', key: 'roll', width: 12 },
      { header: 'Student Full Name', key: 'name', width: 32 },
      { header: 'Admission No', key: 'adm', width: 20 },
      { header: 'Registration No', key: 'reg', width: 22 },
      { header: 'Assigned PC', key: 'pc', width: 16 },
      { header: 'Status', key: 'status', width: 14 },
    ]

    // Style Header Row
    const headerRow = sheet.getRow(1)
    headerRow.height = 26
    headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    }
    headerRow.alignment = { vertical: 'middle', horizontal: 'left' }

    ;(enrollments || []).forEach((e: any) => {
      const pcLabel = seatMap.get(e.id) || 'Unassigned'
      const row = sheet.addRow({
        roll: e.roll_number,
        name: e.students?.full_name || '—',
        adm: e.students?.admission_no || '—',
        reg: e.students?.registration_no || '—',
        pc: pcLabel,
        status: e.status?.toUpperCase() || 'ACTIVE',
      })
      row.height = 20
      row.alignment = { vertical: 'middle' }
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const cleanClassName = (canonicalClass?.name || effectiveClassId).replace(/[^a-z0-9_-]/gi, '_')
    const fileName = `Roster_${cleanClassName}_${params.academicYearId}.xlsx`

    return {
      success: true,
      dataBase64: Buffer.from(buffer).toString('base64'),
      fileName,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to export roster.'
    return { success: false, error: msg }
  }
}

/**
 * Parses an uploaded spreadsheet (.xlsx, .xls, .csv) for lateral newcomers during cohort promotion.
 * Preserves raw RFID / student ID numbers verbatim without transient prefixing.
 */
export async function parseNewcomerSpreadsheetAction(
  formData: FormData
): Promise<{
  success: boolean
  students?: Array<{
    fullName: string
    admissionNo: string | null
    gender: 'male' | 'female' | 'other' | null
    contact: string | null
    registrationNo: string | null
    suggestedRoll: number | null
  }>
  error?: string
}> {
  try {
    const scope = await getServerUserScope()
    if (!scope.isPrivileged) {
      return { success: false, error: 'Access denied: Only administrators can import student rosters.' }
    }

    const file = formData.get('file') as File | null
    if (!file || !(file instanceof File) || file.size === 0) {
      return { success: false, error: 'Please upload a valid Excel (.xlsx, .xls) or CSV (.csv) file.' }
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const parsedRows = await parseRosterFile(buffer, file.name)

    const validStudents = parsedRows
      .filter((r) => r.full_name && r.full_name.trim().length > 0)
      .map((r) => ({
        fullName: r.full_name.trim(),
        admissionNo: r.admission_no ? r.admission_no.trim() : null,
        gender: r.gender ?? null,
        contact: r.contact ?? null,
        registrationNo: r.registration_no ?? null,
        suggestedRoll: r.roll_number ?? null,
      }))

    if (validStudents.length === 0) {
      return { success: false, error: 'No valid student records with names were found in the uploaded file.' }
    }

    return { success: true, students: validStudents }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to parse newcomers spreadsheet.'
    return { success: false, error: msg }
  }
}

