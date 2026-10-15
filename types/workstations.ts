import {
  WorkstationRow,
  IssueCategoryRow,
  WorkstationIssueRow,
  LabFloorElementRow,
} from '@/types/database'

export interface WorkstationPhoto {
  url: string
  name?: string
  size?: number
  thumbnailUrl?: string
}

export interface WorkstationIssueRecord {
  id: string
  workstation_id: string
  workstation_label?: string
  lab_id?: string
  category_id: string | null
  category?: IssueCategoryRow | null
  title: string
  description: string | null
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'acknowledged' | 'in_progress' | 'resolved'
  reported_by_id: string | null
  reported_by_name: string
  source?: 'staff' | 'student_terminal' | null
  student_name?: string | null
  student_roll?: string | null
  photos: WorkstationPhoto[]
  resolved_by_id: string | null
  resolved_by_name: string | null
  resolution_notes: string | null
  resolved_at: string | null
  linked_maintenance_log_id: string | null
  created_at: string
  updated_at: string
}

export type WorkstationDerivedStatus = 'operational' | 'flagged' | 'under_repair'

export interface WorkstationWithIssues extends WorkstationRow {
  open_issues_count: number
  highest_severity: 'low' | 'medium' | 'high' | 'critical' | null
  status: WorkstationDerivedStatus
  active_issues: WorkstationIssueRecord[]
}

export interface WorkstationBoardMetrics {
  total: number
  operational: number
  flagged: number
  under_repair: number
  open_issues_count: number
}

export interface WorkstationBoardData {
  lab_id: string
  lab_name: string
  workstations: WorkstationWithIssues[]
  categories: IssueCategoryRow[]
  active_issues: WorkstationIssueRecord[]
  floor_elements?: LabFloorElementRow[]
  metrics: WorkstationBoardMetrics
  is_privileged: boolean
  user_role: string
  user_id: string
  user_name: string
}

export interface DiagnosticsTriageMetrics {
  total: number
  operational: number
  flagged: number
  under_repair: number
  open_count: number
  in_progress_count: number
  resolved_count: number
}

export interface DiagnosticsTriageData {
  lab_id: string
  lab_name: string
  workstations: WorkstationWithIssues[]
  issues: WorkstationIssueRecord[]
  categories: IssueCategoryRow[]
  metrics: DiagnosticsTriageMetrics
  is_privileged: boolean
}

export interface UpdateWorkstationPositionInput {
  id: string
  pos_x: number
  pos_y: number
}

export interface ReportWorkstationIssueInput {
  workstation_id: string
  category_id?: string | null
  title: string
  description?: string | null
  severity?: 'low' | 'medium' | 'high' | 'critical'
  photos?: WorkstationPhoto[]
}

export interface ResolveWorkstationIssueInput {
  issue_id: string
  resolution_notes: string
  create_maintenance_log?: boolean
  parts_replaced?: string | null
}

export interface CreateWorkstationInput {
  lab_id: string
  label: string
  row_label?: string | null
  position_id?: string | null
  pos_x?: number
  pos_y?: number
  device_type?: 'desktop' | 'aio' | 'laptop' | 'server'
}

export interface UpdateWorkstationInput {
  id: string
  label?: string
  row_label?: string | null
  position_id?: string | null
  pos_x?: number
  pos_y?: number
  device_type?: 'desktop' | 'aio' | 'laptop' | 'server'
  is_active?: boolean
}

export interface IssueCategoryInput {
  id?: string
  name: string
  type: 'hardware' | 'software' | 'network' | 'peripheral' | 'other'
  color: string
  icon: string
  default_severity: 'low' | 'medium' | 'high' | 'critical'
  is_active?: boolean
  sort_order?: number
}
