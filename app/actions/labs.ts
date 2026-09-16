'use server'
 
import { revalidatePath } from 'next/cache'
import { getPgPool } from '@/lib/db'
import { getServerUserScope } from '@/lib/context/user-scope'
import { recordAuditEvent } from '@/lib/audit'

import {
  type LabFacilityStatus,
  type LabFacilityPayload,
  validateLabStatus,
  deriveLabIsActive,
} from '@/lib/lab-status'

export type { LabFacilityPayload, LabFacilityStatus }

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
    if (!scope.isPrivileged || !['super_admin', 'lab_incharge'].includes(scope.role)) {
      return {
        success: false,
        error: 'Unauthorized: Only Super Admin and Lab In-Charge can modify laboratory facilities.',
      }
    }

    let validatedStatus: LabFacilityStatus | null = null
    let isActive: boolean | null = null

    if (updates.status !== undefined) {
      validatedStatus = validateLabStatus(updates.status)
      isActive = deriveLabIsActive(validatedStatus)
    }

    const pool = getPgPool()

    // Fetch existing state for tamper-evident structured diff (match on id, code, or name)
    const prevRes = await pool.query(
      'SELECT * FROM public.labs WHERE id = $1 OR (code IS NOT NULL AND UPPER(code) = UPPER($1)) OR (name IS NOT NULL AND UPPER(name) = UPPER($1))',
      [id]
    )
    const beforeState = prevRes.rows[0] || null
    const targetLabId = beforeState?.id || id

    const res = await pool.query(
      `
      UPDATE public.labs
      SET
        name = COALESCE($1, name),
        code = COALESCE($2, code),
        capacity = COALESCE($3, capacity),
        type = COALESCE($4, type),
        status = COALESCE($5, status),
        is_active = COALESCE($6, is_active)
      WHERE id = $7
      RETURNING *;
      `,
      [
        updates.name || null,
        updates.code ? updates.code.toUpperCase() : null,
        updates.capacity !== undefined ? Number(updates.capacity) : null,
        updates.type || null,
        validatedStatus,
        isActive,
        targetLabId,
      ]
    )

    if (res.rowCount === 0) {
      // If row does not exist, insert it
      const insertStatus = validatedStatus || 'Operational'
      const insertIsActive = isActive !== null ? isActive : true

      const insertRes = await pool.query(
        `
        INSERT INTO public.labs (id, name, code, capacity, type, status, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          code = EXCLUDED.code,
          capacity = EXCLUDED.capacity,
          type = EXCLUDED.type,
          status = EXCLUDED.status,
          is_active = EXCLUDED.is_active
        RETURNING *;
        `,
        [
          targetLabId,
          updates.name || 'Laboratory Facility',
          updates.code ? updates.code.toUpperCase() : targetLabId.toUpperCase(),
          updates.capacity !== undefined ? Number(updates.capacity) : 40,
          updates.type || 'computer_lab',
          insertStatus,
          insertIsActive,
        ]
      )

      await recordAuditEvent({
        action: 'CREATE',
        entityType: 'lab',
        entityId: targetLabId,
        entityLabel: insertRes.rows[0]?.name || targetLabId,
        after: insertRes.rows[0],
        metadata: { operation: 'upsert_lab_facility' },
      })

      revalidatePath('/admin')
      revalidatePath('/maintenance')
      revalidatePath('/schedules')
      revalidatePath('/')
      return { success: true, data: insertRes.rows[0] }
    }

    // Record UPDATE audit event with structured diff
    await recordAuditEvent({
      action: 'UPDATE',
      entityType: 'lab',
      entityId: targetLabId,
      entityLabel: res.rows[0]?.name || beforeState?.name || updates.name || targetLabId,
      before: beforeState || { id: targetLabId },
      after: res.rows[0],
      metadata: { operation: 'update_lab_facility' },
    })

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
    if (!scope.isPrivileged || !['super_admin', 'lab_incharge'].includes(scope.role)) {
      return {
        success: false,
        error: 'Unauthorized: Only Super Admin and Lab In-Charge can register new laboratory facilities.',
      }
    }

    const validatedStatus = validateLabStatus(lab.status || 'Operational')
    const isActive = deriveLabIsActive(validatedStatus)

    const pool = getPgPool()

    const res = await pool.query(
      `
      INSERT INTO public.labs (id, name, code, capacity, type, status, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        code = EXCLUDED.code,
        capacity = EXCLUDED.capacity,
        type = EXCLUDED.type,
        status = EXCLUDED.status,
        is_active = EXCLUDED.is_active
      RETURNING *;
      `,
      [
        lab.id,
        lab.name.trim(),
        lab.code.trim().toUpperCase(),
        Number(lab.capacity) || 40,
        lab.type || 'computer_lab',
        validatedStatus,
        isActive,
      ]
    )

    await recordAuditEvent({
      action: 'CREATE',
      entityType: 'lab',
      entityId: lab.id,
      entityLabel: lab.name.trim(),
      after: res.rows[0],
      metadata: { operation: 'create_lab_facility' },
    })

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
    if (!scope.isPrivileged || !['super_admin', 'lab_incharge'].includes(scope.role)) {
      return {
        success: false,
        error: 'Unauthorized: Only Super Admin and Lab In-Charge can delete laboratory facilities.',
      }
    }

    const pool = getPgPool()

    // Query before-state for audit record
    const prevRes = await pool.query('SELECT * FROM public.labs WHERE id = $1', [id])
    const beforeState = prevRes.rows[0] || null

    // Attempt permanent deletion from PostgreSQL
    try {
      const delRes = await pool.query(`DELETE FROM public.labs WHERE id = $1 RETURNING id;`, [id])
      if (delRes.rowCount && delRes.rowCount > 0) {
        await recordAuditEvent({
          action: 'DELETE',
          entityType: 'lab',
          entityId: id,
          entityLabel: beforeState?.name || id,
          before: beforeState,
          metadata: { operation: 'permanent_delete_lab' },
        })

        revalidatePath('/admin')
        revalidatePath('/maintenance')
        revalidatePath('/schedules')
        revalidatePath('/')
        return { success: true }
      }
    } catch (fkErr: any) {
      // Foreign key violation (PostgreSQL 23503) means active/historical records link to this room
      if (fkErr.code === '23503') {
        await pool.query(
          `UPDATE public.labs SET is_active = false, status = 'Inactive' WHERE id = $1;`,
          [id]
        )

        await recordAuditEvent({
          action: 'UPDATE',
          entityType: 'lab',
          entityId: id,
          entityLabel: beforeState?.name || id,
          before: beforeState,
          after: { ...beforeState, is_active: false, status: 'Inactive' },
          metadata: {
            operation: 'soft_deactivate_lab',
            reason: 'linked_historical_records_fk_23503',
          },
        })

        revalidatePath('/admin')
        revalidatePath('/maintenance')
        revalidatePath('/schedules')
        revalidatePath('/')
        return {
          success: false,
          error: 'This laboratory has linked historical records (practical logs, timetables, or maintenance) and cannot be permanently purged. It has been deactivated instead.',
        }
      }
      throw fkErr
    }

    return { success: true }
  } catch (err: any) {
    console.error(`[LMR] Failed to delete lab "${id}":`, err)
    return { success: false, error: err?.message || 'Failed to delete laboratory' }
  }
}

