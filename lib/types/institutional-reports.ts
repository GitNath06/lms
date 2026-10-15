export interface StudentComplianceRecord {
  student_id: string
  enrollment_id: string
  roll_number: number
  full_name: string
  registration_no: string | null
  sessions_held: number
  sessions_attended: number
  absent_count: number
  attendance_rate_pct: number
  is_eligible: boolean // >= 75% NEB exam threshold
}

export interface StudentComplianceReport {
  class_id: string
  class_name: string
  academic_year_id: string
  academic_year_name: string
  total_students: number
  eligible_students: number
  barred_students: number
  cohort_avg_rate_pct: number
  records: StudentComplianceRecord[]
}

export interface SyllabusPracticalItem {
  id: string
  practical_title: string
  date: string
  period_label: string
  present_students: number
  total_students: number
  attendance_rate_pct: number
  status: 'conducted' | 'skipped'
  skip_reason: string | null
  incharge_verified: boolean
}

export interface SyllabusProgressLedger {
  class_id: string
  class_name: string
  subject_id: string
  subject_name: string
  subject_code: string
  academic_year_id: string
  prescribed_quota: number
  completed_count: number
  skipped_count: number
  completion_pct: number
  avg_attendance_pct: number
  practicals: SyllabusPracticalItem[]
  skipped_reasons_tally: Record<string, number>
}

export interface FacultyActivityRecord {
  teacher_id: string
  teacher_name: string
  email: string | null
  total_sessions_logged: number
  conducted_count: number
  skipped_count: number
  total_students_taught: number
  avg_attendance_pct: number
  incharge_verified_count: number
  pending_verification_count: number
  verification_rate_pct: number
}

export interface LabOccupancyRecord {
  lab_id: string
  lab_name: string
  lab_capacity: number
  scheduled_weekly_hours: number
  actual_conducted_hours: number
  occupancy_rate_pct: number
  avg_students_per_session: number
  capacity_utilization_pct: number
  busiest_day: string
  busiest_slot: string
}

export interface WorkstationReliabilityRecord {
  workstation_id: string
  workstation_label: string
  row_label: string | null
  device_type: string
  status: string
  total_issues_count: number
  open_issues_count: number
  resolved_issues_count: number
  critical_issues_count: number
  downtime_hours: number
  uptime_pct: number
  last_serviced_at: string | null
}

export interface WorkstationReliabilityReport {
  lab_id: string
  lab_name: string
  total_workstations: number
  operational_count: number
  faulty_count: number
  under_repair_count: number
  overall_uptime_pct: number
  overall_mttr_hours: number
  fault_categories_breakdown: Record<string, number>
  hotspot_workstations: WorkstationReliabilityRecord[]
  workstations: WorkstationReliabilityRecord[]
}

export interface WorkstationBiography {
  workstation_id: string
  label: string
  row_label: string | null
  device_type: string
  status: string
  created_at: string
  issues: Array<{
    id: string
    title: string
    severity: string
    status: string
    reported_by_name: string
    created_at: string
    resolved_at: string | null
    resolution_notes: string | null
    duration_hours: number | null
  }>
  maintenance_history: Array<{
    log_id: string
    plan_title: string
    performed_by: string
    performed_at: string
    observations: string | null
  }>
  student_seating_history: Array<{
    academic_year: string
    class_name: string
    student_name: string
    roll_number: number
  }>
  practical_usage_timeline?: Array<{
    log_id: string
    date: string
    period_label: string
    subject_name: string
    batch_group: string
    practical_title: string
    topic_learned: string | null
    student_name: string | null
    roll_number: number | null
    is_present: boolean
    is_override: boolean
    original_workstation_label?: string | null
  }>
}

export interface InstitutionalReminderItem {
  id: string
  type: 'critical_workstation' | 'overdue_maintenance' | 'pending_verification' | 'low_attendance_cohort'
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  message: string
  linkUrl: string
  timestamp: string
}
