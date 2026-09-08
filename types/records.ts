import { Database } from './database'

export type PracticalLogRow = Database['public']['Tables']['practical_logs']['Row']
export type LabIncidentRow = Database['public']['Tables']['lab_incidents']['Row']
export type LabNotificationRow = Database['public']['Tables']['lab_notifications']['Row']

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
}

export type PracticalGroupingKey = 'none' | 'batch_group' | 'subject_name' | 'teacher' | 'period_label'

export interface PracticalRecordFilters {
  batch_group?: string
  subject_name?: string
  teacher_id?: string
  period_label?: string
  lab_id?: string
  date_from?: string
  date_to?: string
  status?: 'all' | 'conducted' | 'skipped'
  search?: string
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
  lab_id?: string
  severity?: 'all' | 'minor' | 'moderate' | 'major_critical'
  incident_type?: string
  status?: 'all' | 'reported' | 'escalated_to_hod' | 'under_repair' | 'replaced' | 'resolved'
  date_from?: string
  date_to?: string
  subject_name?: string
  teacher_name?: string
  batch_name?: string
  search?: string
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
