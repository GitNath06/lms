export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'RESET' | 'OVERRIDE' | 'PROMOTION_BATCH' | 'PROMOTION_ROLLBACK'

export type AuditEntityType =
  | 'lab'
  | 'schedule'
  | 'user_role'
  | 'incident_category'
  | 'curriculum'
  | 'policy'
  | 'infrastructure'
  | 'student'
  | 'roster'
  | 'cohort_promotion'
  | 'workstation'
  | 'workstation_issue'
  | 'seat_plan'
  | 'attendance'
  | 'academic_year'

export interface AuditStructuredDiff {
  before?: Record<string, any> | null
  after?: Record<string, any> | null
  bulk_overflow?: boolean
  summary?: string
  count?: number
}

export interface AuditLogItem {
  id: string
  created_at: string
  actor_id: string | null
  actor_name: string
  actor_role: string
  action: AuditAction
  entity_type: AuditEntityType
  entity_id: string | null
  entity_label: string
  changes: AuditStructuredDiff | null
  metadata: Record<string, any>
}

export interface AuditLogFilterParams {
  entityType?: string
  action?: string
  search?: string
  page?: number
  limit?: number
}

export interface AuditLogResponse {
  logs: AuditLogItem[]
  totalCount: number
  page: number
  totalPages: number
  hasMore: boolean
}

export interface LogAuditEventParams {
  action: AuditAction
  entityType: AuditEntityType
  entityId?: string | null
  entityLabel: string
  before?: Record<string, any> | null
  after?: Record<string, any> | null
  metadata?: Record<string, any>
}
