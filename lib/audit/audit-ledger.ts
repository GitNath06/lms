import { getPgPool } from '@/lib/db'
import { recordAuditEvent } from '@/lib/audit'
import type {
  AuditAction,
  AuditEntityType,
  AuditLogItem,
  AuditLogFilterParams,
  AuditLogResponse,
  LogAuditEventParams,
} from '@/types/audit'

export type {
  AuditAction,
  AuditEntityType,
  AuditLogItem,
  AuditLogFilterParams,
  AuditLogResponse,
  LogAuditEventParams,
}

export { recordAuditEvent }

/**
 * 1. Record Attendance Override / Roll-Call Flip
 */
export async function recordAttendanceOverrideAudit(params: {
  practicalLogId: string
  studentName: string
  rollNumber: number
  beforePresent: boolean
  afterPresent: boolean
  reason?: string
}): Promise<{ success: boolean; id?: string }> {
  return recordAuditEvent({
    action: 'OVERRIDE',
    entityType: 'attendance',
    entityId: params.practicalLogId,
    entityLabel: `Roll ${params.rollNumber} (${params.studentName}) Attendance Status`,
    before: { is_present: params.beforePresent },
    after: { is_present: params.afterPresent },
    metadata: {
      student_name: params.studentName,
      roll_number: params.rollNumber,
      override_reason: params.reason || 'Manual instructor adjustment',
    },
  })
}

/**
 * 2. Record Session Seat Plan Reassignment / Seat Swap
 */
export async function recordSeatSwapAudit(params: {
  scheduleId: string
  sessionDate: string
  fromWorkstation: string
  toWorkstation: string
  studentName: string
  rollNumber: number
}): Promise<{ success: boolean; id?: string }> {
  return recordAuditEvent({
    action: 'OVERRIDE',
    entityType: 'seat_plan',
    entityId: params.scheduleId,
    entityLabel: `Seat Swap: Roll ${params.rollNumber} -> ${params.toWorkstation}`,
    before: { workstation: params.fromWorkstation },
    after: { workstation: params.toWorkstation },
    metadata: {
      schedule_id: params.scheduleId,
      session_date: params.sessionDate,
      student_name: params.studentName,
      roll_number: params.rollNumber,
      from_workstation: params.fromWorkstation,
      to_workstation: params.toWorkstation,
    },
  })
}

/**
 * 3. Record Workstation Fault Issue Lifecycle Status Change
 */
export async function recordWorkstationIssueStatusAudit(params: {
  issueId: string
  workstationLabel: string
  beforeStatus: string
  afterStatus: string
  resolutionNotes?: string
}): Promise<{ success: boolean; id?: string }> {
  return recordAuditEvent({
    action: 'UPDATE',
    entityType: 'workstation_issue',
    entityId: params.issueId,
    entityLabel: `Workstation ${params.workstationLabel} Issue Status`,
    before: { status: params.beforeStatus },
    after: { status: params.afterStatus },
    metadata: {
      workstation: params.workstationLabel,
      resolution_notes: params.resolutionNotes || null,
    },
  })
}

/**
 * 4. Record Schedule Modification / Creation / Cancellation
 */
export async function recordScheduleModificationAudit(params: {
  scheduleId: string
  action: 'CREATE' | 'UPDATE' | 'DELETE'
  subjectName: string
  batchName: string
  labId: string
  changes?: Record<string, any>
}): Promise<{ success: boolean; id?: string }> {
  return recordAuditEvent({
    action: params.action,
    entityType: 'schedule',
    entityId: params.scheduleId,
    entityLabel: `Timetable: ${params.subjectName} (${params.batchName}) @ ${params.labId.toUpperCase()}`,
    before: params.action === 'CREATE' ? null : params.changes?.before || null,
    after: params.action === 'DELETE' ? null : params.changes?.after || {
      subject_name: params.subjectName,
      batch_name: params.batchName,
      lab_id: params.labId,
    },
    metadata: {
      subject_name: params.subjectName,
      batch_name: params.batchName,
      lab_id: params.labId,
    },
  })
}

/**
 * 5. Query Audit Ledger with Optional Filtering & Pagination
 */
export async function queryAuditLedger(
  filters: AuditLogFilterParams = {}
): Promise<AuditLogResponse> {
  const { entityType, action, search, page = 1, limit = 25 } = filters
  const offset = Math.max(0, (page - 1) * limit)

  const pool = getPgPool()
  const whereClauses: string[] = ['1=1']
  const queryParams: any[] = []
  let paramIndex = 1

  if (entityType && entityType !== 'all') {
    whereClauses.push(`entity_type = $${paramIndex++}`)
    queryParams.push(entityType)
  }

  if (action && action !== 'all') {
    whereClauses.push(`action = $${paramIndex++}`)
    queryParams.push(action)
  }

  if (search && search.trim()) {
    const searchPattern = `%${search.trim()}%`
    whereClauses.push(
      `(entity_label ILIKE $${paramIndex} OR actor_name ILIKE $${paramIndex} OR COALESCE(entity_id, '') ILIKE $${paramIndex})`
    )
    queryParams.push(searchPattern)
    paramIndex++
  }

  const whereSql = whereClauses.join(' AND ')

  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS total FROM public.audit_logs WHERE ${whereSql}`,
    queryParams
  )
  const totalCount = countRes.rows[0]?.total || 0

  const dataParams = [...queryParams, limit, offset]
  const dataRes = await pool.query(
    `
    SELECT 
      id,
      created_at,
      actor_id,
      actor_name,
      actor_role,
      action,
      entity_type,
      entity_id,
      entity_label,
      changes,
      metadata
    FROM public.audit_logs
    WHERE ${whereSql}
    ORDER BY created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `,
    dataParams
  )

  const logs: AuditLogItem[] = dataRes.rows.map((row) => ({
    id: row.id,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    actor_id: row.actor_id,
    actor_name: row.actor_name,
    actor_role: row.actor_role,
    action: row.action as AuditAction,
    entity_type: row.entity_type as AuditEntityType,
    entity_id: row.entity_id,
    entity_label: row.entity_label,
    changes: row.changes,
    metadata: row.metadata || {},
  }))

  const totalPages = Math.max(1, Math.ceil(totalCount / limit))

  return {
    logs,
    totalCount,
    page,
    totalPages,
    hasMore: page < totalPages,
  }
}

/**
 * 6. Get Audit History for a Specific Entity ID
 */
export async function getAuditHistoryForEntity(
  entityType: string,
  entityId: string
): Promise<AuditLogItem[]> {
  const pool = getPgPool()
  const res = await pool.query(
    `
    SELECT 
      id,
      created_at,
      actor_id,
      actor_name,
      actor_role,
      action,
      entity_type,
      entity_id,
      entity_label,
      changes,
      metadata
    FROM public.audit_logs
    WHERE entity_type = $1 AND entity_id = $2
    ORDER BY created_at DESC
    LIMIT 50;
    `,
    [entityType, entityId]
  )

  return res.rows.map((row) => ({
    id: row.id,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    actor_id: row.actor_id,
    actor_name: row.actor_name,
    actor_role: row.actor_role,
    action: row.action as AuditAction,
    entity_type: row.entity_type as AuditEntityType,
    entity_id: row.entity_id,
    entity_label: row.entity_label,
    changes: row.changes,
    metadata: row.metadata || {},
  }))
}
