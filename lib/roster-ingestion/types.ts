/**
 * Roster Ingestion and Cohort Lifecycle Types
 * Strict 4-column LMS specification: Roll Number, Full Name, Admission No, Registration No
 */

export type IngestionMode = 'sync' | 'clean_slate'

export interface RawRosterRow {
  roll_number?: number | string | null
  full_name?: string | null
  admission_no?: string | null
  registration_no?: string | null
  gender?: string | null
  contact?: string | null
}

export interface ParsedRosterRow {
  row_index: number
  roll_number: number | null
  full_name: string
  admission_no: string | null
  registration_no: string | null
  gender?: 'male' | 'female' | 'other' | null
  contact?: string | null
}

export type RowValidationStatus =
  | 'valid_new'          // Clean new student person entity + cohort enrollment
  | 'valid_existing'     // Existing student (matched by strong ID) + new cohort enrollment
  | 'valid_retained'     // Existing student already enrolled with same roll (idempotent retention)
  | 'valid_roll_update'  // Existing student matched, safe roll shift/swap in cohort
  | 'review_needed'      // Advisory review (e.g. name similarity or changed name on same roll)
  | 'warning'            // Advisory warning
  | 'error'              // Blocking fatal error (duplicate roll, collision, identifier mismatch)

export interface ValidationRowPreview {
  row_index: number
  roll_number: number | null
  full_name: string
  admission_no: string | null
  is_auto_admission_no?: boolean
  registration_no: string | null
  gender?: 'male' | 'female' | 'other' | null
  contact?: string | null
  status: RowValidationStatus
  matched_student_id?: string | null
  matched_student_name?: string | null
  old_roll_number?: number | null
  diff_badge?: 'matched_exact' | 'roll_changed' | 'name_typo' | 'brand_new' | 'collision'
  error_message?: string | null
  warning_message?: string | null
  existing_student_id?: string | null
  existing_student_name?: string | null
  existing_admission_no?: string | null
  match_confidence?: 'admission_exact' | 'name_only' | 'none'
  user_override_decision?: 'confirm_match' | 'treat_as_new'
}

export interface UnmatchedExistingStudent {
  id: string
  student_id: string
  roll_number: number
  full_name: string
  admission_no: string | null
  registration_no: string | null
  workstation_label?: string | null
}

export interface RosterBuckets {
  bucket1_auto_confirmed: ValidationRowPreview[]
  bucket2_review_needed: ValidationRowPreview[]
  bucket3_clean_new: ValidationRowPreview[]
  bucket4_unmatched_existing: UnmatchedExistingStudent[]
}

export interface RosterPreflightReport {
  target_academic_year_id: string
  target_academic_year_name: string
  target_class_id: string
  target_class_name: string
  mode: IngestionMode
  clean_slate_eligible: boolean
  existing_cohort_count: number
  existing_attendance_logs_count: number
  total_rows: number
  valid_count: number
  new_students_count: number
  existing_students_count: number
  retained_enrollments_count: number
  updated_enrollments_count: number
  warning_count: number
  error_count: number
  can_commit: boolean
  buckets: RosterBuckets
  rows: ValidationRowPreview[]
}

export interface RosterCommitResult {
  success: boolean
  mode?: IngestionMode
  processed_rows: number
  students_created: number
  students_matched: number
  enrollments_created: number
  enrollments_retained: number
  enrollments_updated?: number
  error?: string
}

export interface IngestionPayloadRow {
  roll_number: number
  full_name: string
  admission_no: string | null
  registration_no: string | null
  gender?: string | null
  contact?: string | null
  student_id?: string | null
  action?: 'sync' | 'replace_occupant' | 'assign_next_roll' | null
}
