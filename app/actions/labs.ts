'use server'

import { revalidatePath } from 'next/cache'
import { getPgPool } from '@/lib/db'
import { getServerUserScope } from '@/lib/context/user-scope'
import { updateInstitutionSetting } from './settings'

export interface LabFacilityPayload {
  id: string
  name: string
  code: string
  capacity: number
  type: string
  status: string
}

/**
 * Update an existing laboratory facility record in PostgreSQL.
 * Persists capacity, room code, status, and classification.
 */
export async function updateLabFacility(
  id: string,
  updates: Partial<LabFacilityPayload>
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const scope = await getServerUserScope()
    if (!scope.isPrivileged) {
      return {
        success: false,
        error: 'Unauthorized: Only administrative faculty can modify laboratory facilities.',
      }
    }

    const pool = getPgPool()
    const isActive =
      updates.status !== undefined ? updates.status !== 'Maintenance' && updates.status !== 'Inactive' : null

    const res = await pool.query(
      `
      UPDATE public.labs
      SET
        name = COALESCE($1, name),
        code = COALESCE($2, code),
        capacity = COALESCE($3, capacity),
        type = COALESCE($4, type),
        is_active = COALESCE($5, is_active)
      WHERE id = $6
      RETURNING *;
      `,
      [
        updates.name || null,
        updates.code ? updates.code.toUpperCase() : null,
        updates.capacity !== undefined ? Number(updates.capacity) : null,
        updates.type || null,
        isActive,
        id,
      ]
    )

    if (res.rowCount === 0) {
      // If row does not exist, insert it
      const insertRes = await pool.query(
        `
        INSERT INTO public.labs (id, name, code, capacity, type, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          code = EXCLUDED.code,
          capacity = EXCLUDED.capacity,
          type = EXCLUDED.type,
          is_active = EXCLUDED.is_active
        RETURNING *;
        `,
        [
          id,
          updates.name || 'Laboratory Facility',
          updates.code ? updates.code.toUpperCase() : id.toUpperCase(),
          updates.capacity !== undefined ? Number(updates.capacity) : 40,
          updates.type || 'computer_lab',
          isActive !== null ? isActive : true,
        ]
      )
      revalidatePath('/admin')
      revalidatePath('/maintenance')
      revalidatePath('/schedules')
      revalidatePath('/')
      return { success: true, data: insertRes.rows[0] }
    }

    // Revalidate affected cache paths
    revalidatePath('/admin')
    revalidatePath('/maintenance')
    revalidatePath('/schedules')
    revalidatePath('/')

    return { success: true, data: res.rows[0] }
  } catch (err: any) {
    console.error(`[LMR] Failed to update lab "${id}":`, err)
    return { success: false, error: err?.message || 'Database update failed' }
  }
}

/**
 * Register a brand new laboratory room in PostgreSQL.
 */
export async function createLabFacility(
  lab: LabFacilityPayload
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const scope = await getServerUserScope()
    if (!scope.isPrivileged) {
      return {
        success: false,
        error: 'Unauthorized: Only administrative faculty can register new laboratory facilities.',
      }
    }

    const pool = getPgPool()
    const isActive = lab.status !== 'Maintenance' && lab.status !== 'Inactive'

    const res = await pool.query(
      `
      INSERT INTO public.labs (id, name, code, capacity, type, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        code = EXCLUDED.code,
        capacity = EXCLUDED.capacity,
        type = EXCLUDED.type,
        is_active = EXCLUDED.is_active
      RETURNING *;
      `,
      [
        lab.id,
        lab.name.trim(),
        lab.code.trim().toUpperCase(),
        Number(lab.capacity) || 40,
        lab.type || 'computer_lab',
        isActive,
      ]
    )

    revalidatePath('/admin')
    revalidatePath('/maintenance')
    revalidatePath('/schedules')
    revalidatePath('/')

    return { success: true, data: res.rows[0] }
  } catch (err: any) {
    console.error('[LMR] Failed to create lab facility:', err)
    return { success: false, error: err?.message || 'Failed to create laboratory' }
  }
}

/**
 * Delete or deactivate a laboratory facility.
 */
export async function deleteLabFacility(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const scope = await getServerUserScope()
    if (!scope.isPrivileged) {
      return {
        success: false,
        error: 'Unauthorized: Only administrative faculty can delete laboratory facilities.',
      }
    }

    const pool = getPgPool()
    // Soft delete by setting is_active = false to preserve historical timetable and maintenance logs
    await pool.query(
      `UPDATE public.labs SET is_active = false WHERE id = $1;`,
      [id]
    )

    revalidatePath('/admin')
    revalidatePath('/maintenance')
    revalidatePath('/schedules')
    revalidatePath('/')

    return { success: true }
  } catch (err: any) {
    console.error(`[LMR] Failed to delete lab "${id}":`, err)
    return { success: false, error: err?.message || 'Failed to delete laboratory' }
  }
}
