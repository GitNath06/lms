import type { AuditStructuredDiff } from '../types/audit'

export const SENSITIVE_KEY_PATTERNS = [
  'password',
  'new_password',
  'password_hash',
  'token',
  'secret',
  'smtp_password',
  'api_key',
  'otp',
  'access_token',
  'refresh_token',
]

export const MAX_DIFF_KEYS = 50
export const MAX_PAYLOAD_BYTES = 50000

/**
 * Checks if a key name matches any known sensitive credential/secret keywords.
 */
export function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase()
  return SENSITIVE_KEY_PATTERNS.some((pattern) => lower.includes(pattern))
}

/**
 * Redacts sensitive fields recursively from a record object.
 */
export function redactSensitiveData(obj: Record<string, any> | null | undefined): Record<string, any> | null {
  if (!obj || typeof obj !== 'object') return null
  if (Array.isArray(obj)) {
    return obj.map((item) => (typeof item === 'object' && item !== null ? redactSensitiveData(item) : item)) as any
  }

  const sanitized: Record<string, any> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveKey(key)) {
      sanitized[key] = '[REDACTED]'
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = redactSensitiveData(value)
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        typeof item === 'object' && item !== null ? redactSensitiveData(item) : item
      )
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}

/**
 * Recursively normalizes values (trims strings, converts numbers/booleans to string, converts Dates to ISO, handles null/undefined)
 */
export function normalizeValue(val: any): any {
  if (val === undefined || val === null) return null
  if (typeof val === 'number' || typeof val === 'boolean') return String(val)
  if (typeof val === 'string') return val.trim()
  if (val instanceof Date) return val.toISOString()
  if (Array.isArray(val)) return val.map(normalizeValue)
  if (typeof val === 'object') {
    const sorted: Record<string, any> = {}
    for (const k of Object.keys(val).sort()) {
      sorted[k] = normalizeValue(val[k])
    }
    return sorted
  }
  return val
}

/**
 * Computes a clean, redacted changed-keys diff between previous and next states.
 * Enforces a strict 50KB / 50-key truncation ceiling for bulk operations.
 */
export function computeStructuredDiff(
  before?: Record<string, any> | null,
  after?: Record<string, any> | null
): AuditStructuredDiff | null {
  if (!before && !after) return null

  if (before && after) {
    const allKeys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))

    // Bulk operation safeguard: cap keys
    if (allKeys.length > MAX_DIFF_KEYS) {
      return {
        bulk_overflow: true,
        summary: `Bulk operation modified ${allKeys.length} properties, exceeding visual diff threshold.`,
        count: allKeys.length,
        before: { _keysCount: allKeys.length },
        after: { _keysCount: allKeys.length },
      }
    }

    const changedBefore: Record<string, any> = {}
    const changedAfter: Record<string, any> = {}

    for (const key of allKeys) {
      const bRaw = before[key]
      const aRaw = after[key]

      const bVal = bRaw !== undefined ? bRaw : null
      const aVal = aRaw !== undefined ? aRaw : null

      const bNorm = normalizeValue(bVal)
      const aNorm = normalizeValue(aVal)

      if (JSON.stringify(bNorm) !== JSON.stringify(aNorm)) {
        if (isSensitiveKey(key)) {
          changedBefore[key] = bVal !== null ? '[REDACTED]' : null
          changedAfter[key] = aVal !== null ? '[REDACTED]' : null
        } else {
          changedBefore[key] = typeof bVal === 'object' && bVal !== null ? redactSensitiveData(bVal) : bVal
          changedAfter[key] = typeof aVal === 'object' && aVal !== null ? redactSensitiveData(aVal) : aVal
        }
      }
    }

    // 🛡️ Safeguard: If caller passed both before and after for an update, but values normalized identically,
    // ensure the update is NOT silently dropped. Record the provided update fields as a delta.
    if (Object.keys(changedBefore).length === 0) {
      console.warn('[AUDIT ENGINE] No delta found between before and after:', {
        before,
        after,
      })
      for (const [k, v] of Object.entries(after)) {
        if (k !== 'updated_at' && k !== 'created_at') {
          changedBefore[k] = before[k] !== undefined ? (isSensitiveKey(k) ? '[REDACTED]' : before[k]) : null
          changedAfter[k] = isSensitiveKey(k) ? '[REDACTED]' : v
        }
      }
    }

    // Check payload serialization size
    const jsonStr = JSON.stringify({ before: changedBefore, after: changedAfter })
    if (jsonStr.length > MAX_PAYLOAD_BYTES) {
      return {
        bulk_overflow: true,
        summary: `Diff payload size (${Math.round(jsonStr.length / 1024)}KB) exceeded 50KB limit.`,
        count: Object.keys(changedBefore).length,
      }
    }

    return { before: changedBefore, after: changedAfter }
  }

  // Pure creation, deletion, or single-state update fallback
  const cleanBefore = redactSensitiveData(before)
  const cleanAfter = redactSensitiveData(after)
  const single = cleanBefore ? { before: cleanBefore } : cleanAfter ? { after: cleanAfter } : null
  if (!single) return null
  const jsonStr = JSON.stringify(single)

  if (jsonStr.length > MAX_PAYLOAD_BYTES) {
    return {
      bulk_overflow: true,
      summary: `Payload size (${Math.round(jsonStr.length / 1024)}KB) exceeded 50KB limit.`,
      count: cleanBefore ? Object.keys(cleanBefore).length : cleanAfter ? Object.keys(cleanAfter).length : 0,
    }
  }

  return single
}
