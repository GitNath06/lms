'use server'

import { revalidatePath } from 'next/cache'
import { getPgPool } from '@/lib/db'
import { getServerUserScope } from '@/lib/context/user-scope'
import { recordAuditEvent } from '@/lib/audit'
import type {
  AuditLogFilterParams,
  AuditLogResponse,
  AuditLogItem,
  AuditAction,
  AuditEntityType,
} from '@/types/audit'

export type {
  AuditLogFilterParams,
  AuditLogResponse,
  AuditLogItem,
  AuditAction,
  AuditEntityType,
}

/**
 * Fetch paginated audit log events from PostgreSQL with optional filtering.
 * Strictly restricted to Super Admin sessions.
 */
export async function getAuditLogs(
  filters: AuditLogFilterParams = {}
): Promise<AuditLogResponse> {
  const scope = await getServerUserScope()
  if (!scope.isPrivileged || scope.role !== 'super_admin') {
    throw new Error('Unauthorized: Institutional Audit Trail is restricted exclusively to Super Administrators.')
  }

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

  // 1. Total count query
  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS total FROM public.audit_logs WHERE ${whereSql}`,
    queryParams
  )
  const totalCount = countRes.rows[0]?.total || 0

  // 2. Paginated rows query
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
 * Server action to record an audit event from client-side administrative interactions (e.g. policy toggles).
 * Anti-Forgery: Actor identity is derived strictly on the server; client cannot spoof actor metadata.
 */
export async function recordClientAuditEvent(params: {
  action: AuditAction
  entityType: AuditEntityType
  entityId?: string | null
  entityLabel: string
  before?: Record<string, any> | null
  after?: Record<string, any> | null
  metadata?: Record<string, any>
}): Promise<{ success: boolean; error?: string }> {
  const scope = await getServerUserScope()
  if (!scope.isPrivileged || scope.role !== 'super_admin') {
    return {
      success: false,
      error: 'Unauthorized: Only Super Administrators can log institutional governance events.',
    }
  }

  const res = await recordAuditEvent({
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    entityLabel: params.entityLabel,
    before: params.before,
    after: params.after,
    metadata: {
      ...params.metadata,
      source: 'admin_console_client_action',
    },
  })

  if (res.success) {
    revalidatePath('/admin')
  }

  return res
}
