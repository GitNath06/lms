'use server'

import { revalidatePath } from 'next/cache'
import { getPgPool } from '@/lib/db'
import { getServerUserScope } from '@/lib/context/user-scope'

// Server-side in-memory cache for fast read path (5 min TTL)
const settingsCache = new Map<string, { value: any; timestamp: number }>()
const CACHE_TTL = 300000 // 5 minutes

export async function invalidateSettingsCache(key?: string) {
  if (key) {
    settingsCache.delete(key)
  } else {
    settingsCache.clear()
  }
}

/**
 * Fetch an authoritative institutional setting from PostgreSQL.
 * Falls back to in-memory cache or default value.
 */
export async function getInstitutionSetting<T>(key: string, fallback: T): Promise<T> {
  const cached = settingsCache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.value as T
  }

  try {
    const pool = getPgPool()
    const res = await pool.query(
      `SELECT value FROM public.institution_settings WHERE key = $1 LIMIT 1;`,
      [key]
    )

    if (res.rows.length > 0 && res.rows[0].value) {
      const val = res.rows[0].value as T
      settingsCache.set(key, { value: val, timestamp: Date.now() })
      return val
    }

    return fallback
  } catch (err) {
    console.warn(`[LMR] Failed to fetch setting "${key}" from PostgreSQL, using fallback:`, err)
    return fallback
  }
}

/**
 * Update an institutional setting in PostgreSQL with role verification.
 * Only privileged personnel (super_admin, admin, lab_incharge, hod) can update.
 */
export async function updateInstitutionSetting<T>(
  key: string,
  value: T
): Promise<{ success: boolean; error?: string }> {
  try {
    const scope = await getServerUserScope()
    if (!scope.isPrivileged) {
      return {
        success: false,
        error: 'Unauthorized: Only administrative faculty can update institutional settings.',
      }
    }

    const pool = getPgPool()
    await pool.query(
      `
      INSERT INTO public.institution_settings (key, value, updated_at, updated_by)
      VALUES ($1, $2::jsonb, now(), $3)
      ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = now(),
        updated_by = EXCLUDED.updated_by;
      `,
      [key, JSON.stringify(value), scope.userId || null]
    )

    // Invalidate server cache
    settingsCache.delete(key)

    // Revalidate affected routes
    revalidatePath('/schedules')
    revalidatePath('/admin')
    revalidatePath('/')

    return { success: true }
  } catch (err: any) {
    console.error(`[LMR] Failed to update setting "${key}":`, err)
    return { success: false, error: err?.message || 'Failed to update setting' }
  }
}
