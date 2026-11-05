import type { MaintenanceRoutineTemplateRow } from '@/types/database'

export type MaintenanceCadence =
  | 'daily'
  | 'weekly'
  | 'bi_weekly'
  | 'monthly'
  | 'bi_monthly'
  | 'quarterly'
  | 'tri_annual'
  | 'semi_annual'
  | 'annual'
  | 'as_needed'

export interface MaintenanceRoutineTemplateInput {
  id?: string
  title: string
  lab_id?: string
  cadence?: string
  interval_days?: number
  severity?: 'low' | 'routine' | 'high' | 'critical'
  category?: string
  checklist: string[]
  is_active?: boolean
  sort_order?: number
}

export interface MaintenanceRoutineTemplateOperationResult {
  success: boolean
  data?: MaintenanceRoutineTemplateRow
  error?: string
}
