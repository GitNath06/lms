import type {
  WorkstationRow,
  WorkstationSeatPlanRow,
  SessionSeatOverrideRow,
  WorkstationIssueRow,
} from '@/types/database'
import type { StudentWithEnrollment } from '@/lib/types/students'

export interface WorkstationSeatAssignment {
  seat_plan_id: string
  workstation_id: string
  enrollment_id: string
  student_id: string
  student_name: string
  roll_number: number
  notes: string | null
  photo_url?: string | null
}

export interface WorkstationWithAssignment extends WorkstationRow {
  assignment?: WorkstationSeatAssignment | null
  active_issue?: {
    id: string
    title: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    status: 'open' | 'acknowledged' | 'in_progress' | 'resolved'
  } | null
  session_override?: {
    override_id: string
    student_name: string
    roll_number: number
    reason: string | null
    original_workstation_label?: string | null
    photo_url?: string | null
  } | null
}

export interface CohortSeatPlanData {
  lab_id: string
  lab_name: string
  academic_year_id: string
  academic_year_name: string
  class_id: string
  class_name: string
  workstations: WorkstationWithAssignment[]
  unassigned_students: StudentWithEnrollment[]
  total_students: number
  assigned_count: number
  unassigned_count: number
}

export interface AssignStudentInput {
  lab_id: string
  academic_year_id: string
  class_id: string
  workstation_id: string
  enrollment_id: string
  notes?: string | null
}

export interface SwapStudentsInput {
  lab_id: string
  academic_year_id: string
  class_id: string
  workstation_id_a: string
  workstation_id_b: string
}

export type AutoAssignStrategy = 'roll_asc' | 'alphabetical'

export interface AutoAssignInput {
  lab_id: string
  academic_year_id: string
  class_id: string
  strategy?: AutoAssignStrategy
}

export interface ClearSeatPlanInput {
  lab_id: string
  academic_year_id: string
  class_id: string
}

export interface SeatingSnapshotEntry {
  workstation_id: string
  workstation_label: string
  row_label?: string | null
  student_id: string | null
  enrollment_id?: string | null
  student_name: string | null
  roll_number: number | null
  is_present: boolean
  is_override: boolean
  original_workstation_label?: string | null
  notes?: string | null
}

export type SeatingSnapshot = SeatingSnapshotEntry[]


export interface AutoAssignResult {
  assigned_count: number
  already_assigned_count: number
  remaining_unassigned_count: number
  available_workstations_count: number
  assignments: Array<{
    workstation_label: string
    student_name: string
    roll_number: number
  }>
}

export interface RecordSessionOverrideInput {
  schedule_id?: string | null
  session_date: string
  practical_log_id?: string | null
  enrollment_id: string
  workstation_id: string
  original_workstation_id?: string | null
  reason: string
}

export interface SessionOverrideRecord extends SessionSeatOverrideRow {
  student_name?: string
  roll_number?: number
  workstation_label?: string
  original_workstation_label?: string | null
}
