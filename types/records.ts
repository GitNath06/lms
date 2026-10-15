import type { Database, MaintenanceLogRow, MaintenancePlanRow, MaintenanceReminderRow } from './database'

export type PracticalLogRow = Database['public']['Tables']['practical_logs']['Row']
export type LabIncidentRow = Database['public']['Tables']['lab_incidents']['Row']
export type LabNotificationRow = Database['public']['Tables']['lab_notifications']['Row']
export type { MaintenanceLogRow, MaintenancePlanRow, MaintenanceReminderRow }
export type { SeatingSnapshotEntry, SeatingSnapshot } from '@/lib/types/seat-plans'

export interface PracticalRecordItem extends PracticalLogRow {
  labs?: {
    id: string
    name: string
    type: string
  } | null
  profiles?: {
    id: string
    full_name: string
    email?: string | null
    role?: string | null
  } | null
  attendance_pct: number
  absent_rolls?: (number | string)[] | null
  subject_code?: string | null
  subject_title?: string | null
  academic_year_id?: string | null
  academic_year_name?: string | null
}

export type PracticalGroupingKey = 'none' | 'batch_group' | 'subject_name' | 'teacher' | 'period_label'

export interface PracticalRecordFilters {
  academic_year_id?: string
  batch_group?: string
  subject_name?: string
  teacher_id?: string
  teacher_name?: string
  period_label?: string
  remarks?: string
  lab_id?: string
  date_from?: string
  date_to?: string
  date?: string
  status?: string
  search?: string
  page?: number
  pageSize?: number
  sortKey?: string
  sortDirection?: 'asc' | 'desc'
  selected_ids?: string[]
}

export interface ExportScopeDecision {
  mode: 'SELECTED_EXPLICIT' | 'ALL_MATCHING_EXPLICIT' | 'FILTERED_DEFAULT'
  selectedIds?: string[]
  filterSummary: string
  traceabilityNote: string
}

export interface PracticalGroupSubtotal {
  groupKey: string
  groupTitle: string
  totalSessions: number
  conductedSessions: number
  skippedSessions: number
  totalEnrolled: number
  totalPresent: number
  totalAbsent: number
  averageAttendancePct: number
}

export interface PracticalGroupedSection {
  groupKey: string
  groupTitle: string
  subtotal: PracticalGroupSubtotal
  records: PracticalRecordItem[]
}

export interface PracticalSummaryMetrics {
  totalSessions: number
  conductedSessions: number
  skippedSessions: number
  totalPresent: number
  totalEnrolled: number
  averageAttendancePct: number
}

export interface IncidentRecordItem extends LabIncidentRow {
  labs?: {
    id: string
    name: string
    type: string
  } | null
  reporter_profile?: {
    id: string
    full_name: string
    email?: string | null
    role?: string | null
  } | null
  resolver_profile?: {
    id: string
    full_name: string
    email?: string | null
  } | null
  time_to_resolve_label: string
  time_to_resolve_hours: number | null
}

export interface IncidentRecordFilters {
  academic_year_id?: string
  lab_id?: string
  severity?: string
  incident_type?: string
  status?: string
  date_from?: string
  date_to?: string
  date?: string
  subject_name?: string
  teacher_name?: string
  batch_name?: string
  equipment_name?: string
  title?: string
  search?: string
  page?: number
  pageSize?: number
  sortKey?: string
  sortDirection?: 'asc' | 'desc'
  selected_ids?: string[]
}

export interface IncidentSummaryMetrics {
  totalIncidents: number
  openCount: number
  resolvedCount: number
  underRepairCount: number
  replacedCount: number
  escalatedCount: number
  minorCount: number
  moderateCount: number
  criticalCount: number
  averageTimeToResolveHours: number | null
  averageTimeToResolveLabel: string
}

export type ExportFormat = 'xlsx' | 'csv' | 'pdf'

export interface MaintenanceRecordItem extends MaintenanceLogRow {
  lab_name?: string
  plan_title?: string | null
  plan?: {
    id: string
    title: string
    category: string
    interval_days: number
    target_role: string
    checklist: string[]
  } | null
  performed_by_name?: string
  checklist_count: number
  checklist_completed_pct: number
}

export interface MaintenanceSummaryMetrics {
  totalLogs: number
  overdueCount: number
  completedThisPeriodCount: number
  uniqueAssetsCount?: number
}

export interface MaintenanceRecordFilters {
  lab_id?: string
  date_from?: string
  date_to?: string
  search?: string
}
