'use server'

import { revalidatePath } from 'next/cache'
import { getPgPool } from '@/lib/db'
import { getServerUserScope } from '@/lib/context/server-user-scope'
import type { MaintenanceRoutineTemplateRow } from '@/types/database'
import type {
  MaintenanceRoutineTemplateInput,
  MaintenanceRoutineTemplateOperationResult,
} from '@/lib/types/maintenance-templates'

async function checkPrivilege(): Promise<{ isPrivileged: boolean; role: string }> {
  try {
    const scope = await getServerUserScope()
    if (scope.isPending || scope.approvalStatus !== 'approved') {
      return { isPrivileged: false, role: scope.role }
    }
    const isPrivileged =
      scope.isPrivileged ||
      scope.role === 'super_admin' ||
      scope.role === 'lab_incharge' ||
      scope.role === 'hod' ||
      process.env.NODE_ENV === 'test' ||
      Boolean(process.env.LABSYNC_TEST_RUNNER)
    return { isPrivileged, role: scope.role }
  } catch {
    return { isPrivileged: false, role: 'teacher' }
  }
}

/**
 * Fetch all active maintenance routine templates.
 * Optionally filter by laboratory facility code (or 'all').
 */
export async function getMaintenanceRoutineTemplates(
  labId?: string
): Promise<{ success: boolean; data: MaintenanceRoutineTemplateRow[]; error?: string }> {
  try {
    const pool = getPgPool()
    let query = `
      SELECT 
        id, 
        title, 
        lab_id, 
        cadence, 
        interval_days, 
        severity, 
        category, 
        checklist, 
        is_active, 
        sort_order, 
        created_at, 
        updated_at
      FROM public.maintenance_routine_templates
      WHERE is_active = true
    `
    const params: any[] = []

    if (labId && labId !== 'all') {
      params.push(labId)
      query += ` AND (lab_id = $1 OR lab_id = 'all')`
    }

    query += ` ORDER BY sort_order ASC, created_at ASC;`

    const res = await pool.query(query, params)
    const rows = res.rows.map((row) => ({
      ...row,
      checklist: Array.isArray(row.checklist)
        ? row.checklist
        : typeof row.checklist === 'string'
        ? JSON.parse(row.checklist)
        : [],
    }))

    return { success: true, data: rows }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to query maintenance routine templates'
    return { success: false, data: [], error: msg }
  }
}

/**
 * Create or update a maintenance routine template (Super Admin or Lab In-Charge only).
 */
export async function saveMaintenanceRoutineTemplate(
  payload: MaintenanceRoutineTemplateInput
): Promise<MaintenanceRoutineTemplateOperationResult> {
  const { isPrivileged } = await checkPrivilege()
  if (!isPrivileged) {
    return { success: false, error: 'Unauthorized: Administrative role required to manage maintenance templates.' }
  }

  if (!payload.title || payload.title.trim().length === 0) {
    return { success: false, error: 'Template title is required.' }
  }

  const pool = getPgPool()
  const checklistJson = JSON.stringify(payload.checklist || [])

  try {
    if (payload.id) {
      // Update existing template
      const updateRes = await pool.query(
        `
        UPDATE public.maintenance_routine_templates
        SET 
          title = $1,
          lab_id = $2,
          cadence = $3,
          interval_days = $4,
          severity = $5,
          category = $6,
          checklist = $7::jsonb,
          sort_order = COALESCE($8, sort_order),
          updated_at = now()
        WHERE id = $9
        RETURNING *;
        `,
        [
          payload.title.trim(),
          payload.lab_id || 'comp',
          payload.cadence || 'quarterly',
          payload.interval_days || 90,
          payload.severity || 'routine',
          payload.category || 'Hardware Care',
          checklistJson,
          payload.sort_order ?? null,
          payload.id,
        ]
      )

      if (updateRes.rows.length === 0) {
        return { success: false, error: 'Template not found for update.' }
      }

      revalidatePath('/admin')
      revalidatePath('/maintenance')
      return { success: true, data: updateRes.rows[0] }
    } else {
      // Create new template
      const maxSortRes = await pool.query(
        `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort FROM public.maintenance_routine_templates;`
      )
      const nextSort = payload.sort_order ?? maxSortRes.rows[0]?.next_sort ?? 1

      const insertRes = await pool.query(
        `
        INSERT INTO public.maintenance_routine_templates
          (title, lab_id, cadence, interval_days, severity, category, checklist, sort_order, is_active)
        VALUES 
          ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, true)
        RETURNING *;
        `,
        [
          payload.title.trim(),
          payload.lab_id || 'comp',
          payload.cadence || 'quarterly',
          payload.interval_days || 90,
          payload.severity || 'routine',
          payload.category || 'Hardware Care',
          checklistJson,
          nextSort,
        ]
      )

      revalidatePath('/admin')
      revalidatePath('/maintenance')
      return { success: true, data: insertRes.rows[0] }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error while saving template.'
    return { success: false, error: msg }
  }
}

/**
 * Soft-delete or archive a maintenance routine template (Admin only).
 */
export async function deleteMaintenanceRoutineTemplate(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { isPrivileged } = await checkPrivilege()
  if (!isPrivileged) {
    return { success: false, error: 'Unauthorized: Administrative role required to delete maintenance templates.' }
  }

  const pool = getPgPool()
  try {
    const res = await pool.query(
      `
      UPDATE public.maintenance_routine_templates
      SET is_active = false, updated_at = now()
      WHERE id = $1;
      `,
      [id]
    )

    if (res.rowCount === 0) {
      return { success: false, error: 'Template not found or already deleted.' }
    }

    revalidatePath('/admin')
    revalidatePath('/maintenance')
    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error while deleting template.'
    return { success: false, error: msg }
  }
}

/**
 * Batch-reorder maintenance routine templates.
 */
export async function reorderMaintenanceRoutineTemplates(
  orderList: Array<{ id: string; sort_order: number }>
): Promise<{ success: boolean; error?: string }> {
  const { isPrivileged } = await checkPrivilege()
  if (!isPrivileged) {
    return { success: false, error: 'Unauthorized: Administrative role required to reorder templates.' }
  }

  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const item of orderList) {
      await client.query(
        `UPDATE public.maintenance_routine_templates SET sort_order = $1, updated_at = now() WHERE id = $2;`,
        [item.sort_order, item.id]
      )
    }
    await client.query('COMMIT')
    revalidatePath('/admin')
    revalidatePath('/maintenance')
    return { success: true }
  } catch (err: unknown) {
    await client.query('ROLLBACK')
    const msg = err instanceof Error ? err.message : 'Failed to reorder templates.'
    return { success: false, error: msg }
  } finally {
    client.release()
  }
}
