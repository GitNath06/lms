'use server'

import { revalidatePath } from 'next/cache'
import { getPgPool } from '@/lib/db'
import { getServerUserScope } from '@/lib/context/server-user-scope'

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

import { sortPeriodSlots } from '@/lib/utils'

export interface PeriodSlotRecord {
  id: string
  name: string
  label: string
}

/**
 * Returns dynamic bell / period slots from PostgreSQL institution_settings.
 * Always sorted chronologically by start time.
 */
export async function getPeriodSlotsAction(): Promise<{
  success: boolean
  data: PeriodSlotRecord[]
  error?: string
}> {
  try {
    let slots = await getInstitutionSetting<PeriodSlotRecord[]>('master_time_slots', [])
    if (!slots || slots.length === 0) {
      slots = await getInstitutionSetting<PeriodSlotRecord[]>('infrastructure_periods', [])
    }
    if (slots && slots.length > 0) {
      const sorted = sortPeriodSlots(slots)
      return { success: true, data: sorted }
    }
    return { success: true, data: [] }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, data: [], error: msg }
  }
}

/**
 * Update bell / period slots atomically across both keys in PostgreSQL.
 * Automatically sorts slots chronologically by start time so morning periods always precede afternoon periods.
 * Allowed for privileged personnel (super_admin, admin, lab_incharge).
 */
export async function updatePeriodSlotsAction(
  slots: PeriodSlotRecord[]
): Promise<{ success: boolean; data: PeriodSlotRecord[]; error?: string }> {
  try {
    const scope = await getServerUserScope()
    if (!scope.isPrivileged || scope.approvalStatus !== 'approved') {
      return {
        success: false,
        data: [],
        error: 'Unauthorized: Only administrative faculty can update institutional bell timings.',
      }
    }

    if (!Array.isArray(slots)) {
      return { success: false, data: [], error: 'Invalid slots array' }
    }

    // Sort strictly chronologically
    const sorted = sortPeriodSlots(slots)

    const pool = getPgPool()
    await pool.query(
      `
      INSERT INTO public.institution_settings (key, value, updated_at, updated_by)
      VALUES 
        ('master_time_slots', $1::jsonb, now(), $2),
        ('infrastructure_periods', $1::jsonb, now(), $2)
      ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = now(),
        updated_by = EXCLUDED.updated_by;
      `,
      [JSON.stringify(sorted), scope.userId || null]
    )

    // Invalidate server cache for both keys
    settingsCache.delete('master_time_slots')
    settingsCache.delete('infrastructure_periods')

    // Revalidate affected routes
    revalidatePath('/schedules')
    revalidatePath('/admin')
    revalidatePath('/records/new')
    revalidatePath('/')

    return { success: true, data: sorted }
  } catch (err: any) {
    console.error('[LMR] Failed to update period slots:', err)
    return { success: false, data: [], error: err?.message || 'Failed to update period slots' }
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
    if (!scope.isPrivileged || scope.approvalStatus !== 'approved') {
      return {
        success: false,
        error: 'Unauthorized: Only administrative faculty can update institutional settings.',
      }
    }

    // If updating periods via generic setting, keep both in sync and sort chronologically
    if (key === 'master_time_slots' || key === 'infrastructure_periods') {
      const slots = Array.isArray(value) ? sortPeriodSlots(value as any) : value
      const pool = getPgPool()
      await pool.query(
        `
        INSERT INTO public.institution_settings (key, value, updated_at, updated_by)
        VALUES 
          ('master_time_slots', $1::jsonb, now(), $2),
          ('infrastructure_periods', $1::jsonb, now(), $2)
        ON CONFLICT (key) DO UPDATE SET
          value = EXCLUDED.value,
          updated_at = now(),
          updated_by = EXCLUDED.updated_by;
        `,
        [JSON.stringify(slots), scope.userId || null]
      )
      settingsCache.delete('master_time_slots')
      settingsCache.delete('infrastructure_periods')
      revalidatePath('/schedules')
      revalidatePath('/admin')
      revalidatePath('/records/new')
      revalidatePath('/')
      return { success: true }
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
