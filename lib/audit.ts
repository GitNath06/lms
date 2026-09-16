import { getPgPool } from './db'
import { getServerUserScope } from './context/user-scope'
import type { LogAuditEventParams, AuditStructuredDiff } from '../types/audit'
import {
  computeStructuredDiff,
  redactSensitiveData,
  normalizeValue,
  isSensitiveKey,
  SENSITIVE_KEY_PATTERNS,
  MAX_DIFF_KEYS,
  MAX_PAYLOAD_BYTES,
} from './audit-diff'

export {
  computeStructuredDiff,
  redactSensitiveData,
  normalizeValue,
  isSensitiveKey,
  SENSITIVE_KEY_PATTERNS,
  MAX_DIFF_KEYS,
  MAX_PAYLOAD_BYTES,
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Centralized audit logging engine to be invoked inside server actions.
 * Guarantees failsafe execution (catches all internal errors to never disrupt business actions).
 */
export async function recordAuditEvent(params: LogAuditEventParams): Promise<{ success: boolean; id?: string }> {
  try {
    const { action, entityType, entityId, entityLabel, before, after, metadata = {} } = params

    // 1. Resolve authenticated actor context
    let actorId: string | null = null
    let actorName = 'System / Automated'
    let actorRole = 'super_admin'

    try {
      const scope = await getServerUserScope()
      if (scope && scope.userId) {
        // Sanitize UUID for PostgreSQL foreign key
        actorId = UUID_REGEX.test(scope.userId) ? scope.userId : null
        actorName = scope.fullName || scope.email || 'Staff Member'
        actorRole = scope.role || 'teacher'
      }
    } catch {
      // Fallback to automated
    }

    // 2. Extract request origin telemetry safely
    let clientIp = '127.0.0.1'
    let userAgent = 'LabSync LIMS / Internal'
    try {
      const { headers } = await import('next/headers')
      const headerList = await headers()
      clientIp = headerList.get('x-forwarded-for')?.split(',')[0].trim() || headerList.get('x-real-ip') || '127.0.0.1'
      userAgent = headerList.get('user-agent') || 'Internal Server Action'
    } catch {
      // Called outside HTTP request cycle
    }

    const mergedMetadata = {
      ...metadata,
      client_ip: clientIp,
      user_agent: userAgent,
      recorded_at: new Date().toISOString(),
    }

    // 3. Compute clean, redacted changed-keys diff
    let effectiveBefore = before
    let effectiveAfter = after

    if (action === 'UPDATE') {
      if (!effectiveBefore && effectiveAfter) {
        effectiveBefore = { id: entityId || 'unknown' }
      } else if (effectiveBefore && !effectiveAfter) {
        effectiveAfter = { id: entityId || 'unknown', ...effectiveBefore }
      }
    }

    const diff = computeStructuredDiff(effectiveBefore, effectiveAfter)

    // 4. Insert into PostgreSQL public.audit_logs via Pool
    const pool = getPgPool()
    const res = await pool.query(
      `
      INSERT INTO public.audit_logs (
        actor_id,
        actor_name,
        actor_role,
        action,
        entity_type,
        entity_id,
        entity_label,
        changes,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id;
      `,
      [
        actorId,
        actorName,
        actorRole,
        action,
        entityType,
        entityId || null,
        entityLabel,
        diff ? JSON.stringify(diff) : null,
        JSON.stringify(mergedMetadata),
      ]
    )

    return { success: true, id: res.rows[0]?.id }
  } catch (err: any) {
    // Failsafe: Never interrupt caller
    console.error('⚠️ [Audit Trail] Failed to record audit log event:', err?.message || err)
    return { success: false }
  }
}
