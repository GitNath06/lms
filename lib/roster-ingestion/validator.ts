import type {
  ParsedRosterRow,
  ValidationRowPreview,
  RosterPreflightReport,
  IngestionMode,
  UnmatchedExistingStudent,
} from './types'
import {
  formatStudentDisplayName,
  normalizeStudentName,
  calculateNameSimilarity,
} from '../imports/string-normalization'

export interface DatabaseValidationContext {
  targetAcademicYearId: string
  targetAcademicYearName: string
  targetClassId: string
  targetClassName: string
  // Existing students in institution
  existingStudentsByAdmissionNo: Map<
    string,
    { id: string; full_name: string; admission_no: string | null; registration_no: string | null }
  >
  existingStudentsByRegistrationNo: Map<
    string,
    { id: string; full_name: string; admission_no: string | null; registration_no: string | null }
  >
  allActiveStudents: Array<{ id: string; full_name: string; admission_no: string | null }>
  // Existing enrollments in target cohort (academic_year_id, class_id)
  existingEnrollmentsByStudentId: Map<string, { id: string; roll_number: number }>
  existingEnrollmentsByRoll: Map<
    number,
    { id: string; student_id: string; full_name: string; admission_no: string | null; registration_no: string | null }
  >
  existingCohortStudents?: Array<UnmatchedExistingStudent>
  existingAttendanceLogsCount?: number
  mode?: IngestionMode
}

/**
 * Checks exact normalized name match (including token permutations like "Sharma Aarav" vs "Aarav Sharma")
 * without fuzzy Levenshtein blurring, avoiding silent identity mixups.
 */
export function isExactNormalizedNameMatch(nameA: string, nameB: string): boolean {
  const normA = normalizeStudentName(nameA)
  const normB = normalizeStudentName(nameB)
  if (!normA || !normB) return false
  if (normA === normB) return true
  const tokensA = normA.split(' ').sort().join(' ')
  const tokensB = normB.split(' ').sort().join(' ')
  return tokensA === tokensB
}

/**
 * Formats a clean sequential institutional admission number:
 * Format: ADM-[YEAR]-[SEQ]
 * Example: ADM-2083-0001
 * Completely decoupled from mutable class names or roll numbers.
 */
export function formatSequentialAdmissionNo(
  academicYearId: string,
  seq: number
): string {
  const cleanYear = (academicYearId || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const padSeq = String(seq).padStart(seq < 1000 ? 4 : 5, '0')
  return `ADM-${cleanYear}-${padSeq}`
}

/**
 * Legacy compatibility alias for formatAutoAdmissionNo
 * Returns format: ADM-[YEAR]-[CLASS]-[ROLL]
 */
export function formatAutoAdmissionNo(
  academicYearId: string,
  classId: string,
  rollNumber: number
): string {
  const cleanYear = (academicYearId || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const cleanClass = (classId || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const padRoll = String(rollNumber).padStart(rollNumber < 100 ? 2 : 3, '0')
  return `ADM-${cleanYear}-${cleanClass}-${padRoll}`
}

/**
 * Pre-flight validation pipeline with deterministic reconciliation,
 * automatic provisional roll allocation for sheets missing roll numbers,
 * and support for both 'sync' and 'clean_slate' modes.
 */
export function validateParsedRoster(
  rows: ParsedRosterRow[],
  context: DatabaseValidationContext
): RosterPreflightReport {
  const mode: IngestionMode = context.mode || 'sync'
  const cleanSlateEligible = (context.existingAttendanceLogsCount ?? 0) === 0

  // Intra-file uniqueness tracking sets
  const rollCounts = new Map<number, number>()
  const admCounts = new Map<string, number>()
  const regCounts = new Map<string, number>()

  // 1. Gather all occupied rolls from existing database cohort
  const occupiedRolls = new Set<number>()
  if (context.existingEnrollmentsByRoll) {
    context.existingEnrollmentsByRoll.forEach((_, r) => occupiedRolls.add(r))
  }

  // 2. Tally explicitly provided rolls from uploaded file
  rows.forEach((r) => {
    if (r.roll_number !== null && r.roll_number !== undefined && r.roll_number > 0 && r.roll_number <= 200) {
      rollCounts.set(r.roll_number, (rollCounts.get(r.roll_number) || 0) + 1)
      occupiedRolls.add(r.roll_number)
    }
  })

  // 3. Dynamic provisional roll allocator for rows where roll number was omitted (null/undefined)
  let nextAvailableRoll = 1
  const allocateProvisionalRoll = (): number => {
    while (occupiedRolls.has(nextAvailableRoll) && nextAvailableRoll <= 200) {
      nextAvailableRoll++
    }
    const allocated = nextAvailableRoll <= 200 ? nextAvailableRoll : 200
    occupiedRolls.add(allocated)
    nextAvailableRoll++
    return allocated
  }

  // 4. Pre-process rows with effective non-colliding rolls and clean institutional IDs
  let autoAdmissionSeq = (context.allActiveStudents?.length || 0) + 1
  const effectiveRows = rows.map((r) => {
    const isRollOmitted = r.roll_number === null || r.roll_number === undefined
    const effectiveRoll: number = isRollOmitted ? allocateProvisionalRoll() : (r.roll_number ?? 0)

    const rawAdm = r.admission_no?.trim() || null
    const isAutoAdmission = !rawAdm
    // If rawAdm is provided (e.g. RFID No. '1641052469'), preserve verbatim.
    // If absent, synthesize a clean sequential admission number.
    const effectiveAdm = rawAdm || formatSequentialAdmissionNo(context.targetAcademicYearId, autoAdmissionSeq++)

    return {
      ...r,
      isRollOmitted,
      effectiveRoll,
      effectiveAdm,
      rawAdm,
      isAutoAdmission,
    }
  })

  // Track admission & registration frequency across effective rows
  effectiveRows.forEach((r) => {
    if (r.effectiveAdm) {
      const normAdm = r.effectiveAdm.toLowerCase().trim()
      admCounts.set(normAdm, (admCounts.get(normAdm) || 0) + 1)
    }
    if (r.registration_no) {
      const normReg = r.registration_no.toLowerCase().trim()
      regCounts.set(normReg, (regCounts.get(normReg) || 0) + 1)
    }
  })

  let validCount = 0
  let newStudentsCount = 0
  let existingStudentsCount = 0
  let retainedEnrollmentsCount = 0
  let updatedEnrollmentsCount = 0
  let warningCount = 0
  let errorCount = 0

  const matchedStudentIdsInUpload = new Set<string>()
  const previews: ValidationRowPreview[] = []

  // If clean slate mode requested but attendance history exists, block early
  if (mode === 'clean_slate' && !cleanSlateEligible) {
    errorCount++
  }

  // Pass 2: Row-level validation and identity reconciliation
  effectiveRows.forEach((row) => {
    const rawName = row.full_name.trim()
    const displayName = formatStudentDisplayName(rawName)
    const roll = row.effectiveRoll
    const rawAdm = row.rawAdm
    const isAutoAdmission = row.isAutoAdmission
    const adm = row.effectiveAdm
    const reg = row.registration_no?.trim() || null
    const currentOccupantAtRoll = context.existingEnrollmentsByRoll.get(roll)

    let rowStatus: ValidationRowPreview['status'] = 'valid_new'
    let errorMessage: string | null = null
    let warningMessage: string | null = null
    let matchedStudentId: string | null = null
    let matchedStudentName: string | null = null
    let oldRollNumber: number | null = null
    let diffBadge: ValidationRowPreview['diff_badge'] = 'brand_new'
    let matchConfidence: ValidationRowPreview['match_confidence'] = 'none'
    let existingStudentId: string | null = null
    let existingStudentName: string | null = null
    let existingAdmissionNo: string | null = null

    // A. Syntax & Intra-File Checks
    const rollToCheck = row.isRollOmitted ? row.effectiveRoll : (row.roll_number ?? 0)
    if (!rawName) {
      rowStatus = 'error'
      errorMessage = 'Student full name is required.'
    } else if (rollToCheck <= 0 || rollToCheck > 200) {
      rowStatus = 'error'
      errorMessage = `Roll number (${rollToCheck}) is out of valid range (1–200).`
    } else if (!row.isRollOmitted && row.roll_number !== null && (rollCounts.get(row.roll_number) || 0) > 1) {
      rowStatus = 'error'
      errorMessage = `Duplicate roll number ${row.roll_number} appears multiple times inside the spreadsheet.`
    } else if (rawAdm && (admCounts.get(rawAdm.toLowerCase()) || 0) > 1) {
      rowStatus = 'error'
      errorMessage = `Duplicate admission / RFID number ${rawAdm} appears multiple times inside the spreadsheet.`
    } else if (reg && (regCounts.get(reg.toLowerCase()) || 0) > 1) {
      rowStatus = 'error'
      errorMessage = `Duplicate registration number ${reg} appears multiple times inside the spreadsheet.`
    }

    // B. Reconcile based on mode
    if (rowStatus !== 'error') {
      if (mode === 'clean_slate') {
        if (!cleanSlateEligible) {
          rowStatus = 'error'
          errorMessage = `Cannot perform clean slate replacement: ${context.existingAttendanceLogsCount} attendance record(s) exist for this cohort.`
        } else {
          const studentByAdm = rawAdm ? context.existingStudentsByAdmissionNo.get(rawAdm.toLowerCase()) : null
          const studentByReg = reg ? context.existingStudentsByRegistrationNo.get(reg.toLowerCase()) : null

          if (studentByAdm && studentByReg && studentByAdm.id !== studentByReg.id) {
            rowStatus = 'error'
            errorMessage = `Identity conflict: Admission No '${rawAdm}' and Registration No '${reg}' resolve to two different students.`
          } else {
            const matched = studentByAdm || studentByReg
            if (matched) {
              matchedStudentId = matched.id
              matchedStudentName = matched.full_name
              matchedStudentIdsInUpload.add(matched.id)
              rowStatus = 'valid_existing'
              diffBadge = 'matched_exact'
              matchConfidence = 'admission_exact'
              existingStudentId = matched.id
              existingStudentName = matched.full_name
              existingAdmissionNo = matched.admission_no
            } else {
              rowStatus = 'valid_new'
              diffBadge = 'brand_new'
              matchConfidence = 'none'
            }
          }
        }
      } else {
        // Mode: 'sync'
        // Deterministic Matching Ladder
        const studentByAdm = rawAdm ? context.existingStudentsByAdmissionNo.get(rawAdm.toLowerCase()) : null
        const studentByReg = reg ? context.existingStudentsByRegistrationNo.get(reg.toLowerCase()) : null

        if (studentByAdm && studentByReg && studentByAdm.id !== studentByReg.id) {
          rowStatus = 'error'
          errorMessage = `Identity conflict: Admission / RFID '${rawAdm}' belongs to ${studentByAdm.full_name}, but Registration No '${reg}' belongs to ${studentByReg.full_name}.`
        } else if (studentByAdm || studentByReg) {
          // Strong match by provided identifier (100% confidence)
          const matched = (studentByAdm || studentByReg)!
          matchedStudentId = matched.id
          matchedStudentName = matched.full_name
          matchedStudentIdsInUpload.add(matched.id)
          matchConfidence = 'admission_exact'
          existingStudentId = matched.id
          existingStudentName = matched.full_name
          existingAdmissionNo = matched.admission_no

          const existingEnrollment = context.existingEnrollmentsByStudentId.get(matched.id)

          if (existingEnrollment) {
            if (existingEnrollment.roll_number === roll) {
              rowStatus = 'valid_retained'
              diffBadge = 'matched_exact'
            } else {
              rowStatus = 'valid_roll_update'
              oldRollNumber = existingEnrollment.roll_number
              diffBadge = 'roll_changed'
              warningMessage = `Roll number shifted from ${existingEnrollment.roll_number} → ${roll}.`
            }
          } else {
            if (currentOccupantAtRoll && currentOccupantAtRoll.student_id !== matched.id) {
              rowStatus = 'review_needed'
              diffBadge = 'collision'
              warningMessage = `Roll ${roll} is currently held by "${currentOccupantAtRoll.full_name}". Reassigning to incoming student "${matched.full_name}".`
            } else {
              rowStatus = 'valid_existing'
              diffBadge = 'brand_new'
            }
          }
        } else {
          // When Admission / RFID is omitted (or provided identifier not found):
          // Follow Deterministic In-Class Matching Ladder:

          // Rule 1: Exact Roll + Exact Normalized Name Match
          if (currentOccupantAtRoll && isExactNormalizedNameMatch(rawName, currentOccupantAtRoll.full_name)) {
            matchedStudentId = currentOccupantAtRoll.student_id
            matchedStudentName = currentOccupantAtRoll.full_name
            matchedStudentIdsInUpload.add(currentOccupantAtRoll.student_id)
            rowStatus = 'valid_retained'
            diffBadge = 'matched_exact'
            matchConfidence = 'name_only'
            existingStudentId = currentOccupantAtRoll.student_id
            existingStudentName = currentOccupantAtRoll.full_name
            existingAdmissionNo = currentOccupantAtRoll.admission_no
          } else {
            // Rule 2: Unique In-Class Name Match (Roll Shift)
            const cohortNameMatches = (context.existingCohortStudents || []).filter((s) =>
              isExactNormalizedNameMatch(rawName, s.full_name)
            )

            if (cohortNameMatches.length === 1) {
              const shiftedStudent = cohortNameMatches[0]
              matchedStudentId = shiftedStudent.student_id
              matchedStudentName = shiftedStudent.full_name
              matchedStudentIdsInUpload.add(shiftedStudent.student_id)
              rowStatus = 'valid_roll_update'
              oldRollNumber = shiftedStudent.roll_number
              diffBadge = 'roll_changed'
              matchConfidence = 'name_only'
              existingStudentId = shiftedStudent.student_id
              existingStudentName = shiftedStudent.full_name
              existingAdmissionNo = shiftedStudent.admission_no
              warningMessage = `Roll number shifted from ${shiftedStudent.roll_number} → ${roll}.`
            } else if (cohortNameMatches.length > 1) {
              // DUPLICATE NAME HAZARD: Multiple students in this class have the exact same name
              rowStatus = 'review_needed'
              diffBadge = 'collision'
              matchConfidence = 'name_only'
              warningMessage = `Duplicate Name Hazard: ${cohortNameMatches.length} students named "${displayName}" exist in this cohort. Match via Admission / RFID No. or manual review required.`
            } else if (currentOccupantAtRoll && !row.isRollOmitted) {
              // Rule 3: Same Roll, Different Name Spelling
              rowStatus = 'review_needed'
              diffBadge = 'name_typo'
              matchedStudentId = currentOccupantAtRoll.student_id
              matchedStudentName = currentOccupantAtRoll.full_name
              matchConfidence = 'none'
              existingStudentId = currentOccupantAtRoll.student_id
              existingStudentName = currentOccupantAtRoll.full_name
              existingAdmissionNo = currentOccupantAtRoll.admission_no
              warningMessage = `Roll ${roll} is currently held by "${currentOccupantAtRoll.full_name}". Incoming name is "${displayName}". Manual review required.`
            } else {
              // Rule 4: New Roll & Unrecognized Name
              // Check institution-wide advisory similarity
              const similar = context.allActiveStudents.find(
                (s) => calculateNameSimilarity(rawName, s.full_name) >= 0.85
              )

              if (similar) {
                rowStatus = 'review_needed'
                diffBadge = 'name_typo'
                matchConfidence = 'none'
                existingStudentId = similar.id
                existingStudentName = similar.full_name
                existingAdmissionNo = similar.admission_no
                warningMessage = `Advisory: Similar name to existing student "${similar.full_name}"${
                  similar.admission_no ? ` (${similar.admission_no})` : ''
                }. Confirm if this is a new student.`
              } else {
                rowStatus = 'valid_new'
                diffBadge = 'brand_new'
                matchConfidence = 'none'
              }
            }
          }
        }
      }
    }

    // Tally metrics
    if (rowStatus === 'error') {
      errorCount++
    } else {
      validCount++
      if (rowStatus === 'valid_new') newStudentsCount++
      if (rowStatus === 'valid_existing') existingStudentsCount++
      if (rowStatus === 'valid_retained') retainedEnrollmentsCount++
      if (rowStatus === 'valid_roll_update') updatedEnrollmentsCount++
      if (rowStatus === 'review_needed') {
        warningCount++
        newStudentsCount++
      }
    }

    previews.push({
      row_index: row.row_index,
      roll_number: roll,
      full_name: displayName || rawName,
      admission_no: adm,
      is_auto_admission_no: isAutoAdmission,
      registration_no: reg,
      gender: row.gender || null,
      contact: row.contact || null,
      status: rowStatus,
      matched_student_id: matchedStudentId,
      matched_student_name: matchedStudentName,
      old_roll_number: oldRollNumber,
      diff_badge: diffBadge,
      error_message: errorMessage,
      warning_message: warningMessage,
      existing_student_id: existingStudentId || currentOccupantAtRoll?.student_id || null,
      existing_student_name: existingStudentName || currentOccupantAtRoll?.full_name || null,
      existing_admission_no: existingAdmissionNo || currentOccupantAtRoll?.admission_no || null,
      match_confidence: matchConfidence,
    })
  })

  // Group into structural categories
  const bucket1: ValidationRowPreview[] = []
  const bucket2: ValidationRowPreview[] = []
  const bucket3: ValidationRowPreview[] = []

  previews.forEach((p) => {
    if (mode === 'clean_slate') {
      if (p.status === 'error') {
        bucket2.push(p)
      } else {
        bucket1.push(p)
      }
    } else {
      if (p.status === 'valid_retained' || p.status === 'valid_roll_update') {
        bucket1.push(p)
      } else if (p.status === 'review_needed' || p.status === 'warning' || p.status === 'error') {
        bucket2.push(p)
      } else {
        bucket3.push(p)
      }
    }
  })

  // Unmatched currently enrolled students who are absent from the upload
  const bucket4: UnmatchedExistingStudent[] = (context.existingCohortStudents || []).filter(
    (s) => !matchedStudentIdsInUpload.has(s.student_id)
  )

  const canCommit = errorCount === 0 && validCount > 0

  return {
    target_academic_year_id: context.targetAcademicYearId,
    target_academic_year_name: context.targetAcademicYearName,
    target_class_id: context.targetClassId,
    target_class_name: context.targetClassName,
    mode,
    clean_slate_eligible: cleanSlateEligible,
    existing_cohort_count: context.existingCohortStudents?.length ?? 0,
    existing_attendance_logs_count: context.existingAttendanceLogsCount ?? 0,
    total_rows: rows.length,
    valid_count: validCount,
    new_students_count: newStudentsCount,
    existing_students_count: existingStudentsCount,
    retained_enrollments_count: retainedEnrollmentsCount,
    updated_enrollments_count: updatedEnrollmentsCount,
    warning_count: warningCount,
    error_count: errorCount,
    can_commit: canCommit,
    buckets: {
      bucket1_auto_confirmed: bucket1,
      bucket2_review_needed: bucket2,
      bucket3_clean_new: bucket3,
      bucket4_unmatched_existing: bucket4,
    },
    rows: previews,
  }
}
