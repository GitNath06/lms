'use server'

import { revalidatePath } from 'next/cache'
import { getPgPool } from '@/lib/db'
import { getServerUserScope } from '@/lib/context/server-user-scope'
import type { ClassRecord, ClassEnrollmentStat } from '@/lib/types/classes'

/**
 * Returns a map of class_id -> active enrolled student count for the given academic year.
 * Executes a single, fast aggregated GROUP BY query to eliminate the N+1 query problem.
 */
export async function getClassEnrollmentStats(
  academicYearId?: string
): Promise<{ success: boolean; data: Record<string, number>; error?: string }> {
  try {
    const pool = getPgPool()

    let effectiveYearId = academicYearId
    if (!effectiveYearId) {
      const yearRes = await pool.query(
        `SELECT id FROM public.academic_years WHERE is_current = true ORDER BY start_date DESC LIMIT 1;`
      )
      effectiveYearId = yearRes.rows[0]?.id
    }

    if (!effectiveYearId) {
      return { success: true, data: {} }
    }

    const query = `
      SELECT 
        class_id, 
        count(*)::int AS enrolled_count
      FROM public.student_enrollments
      WHERE academic_year_id = $1 
        AND status = 'active'
      GROUP BY class_id;
    `
    const res = await pool.query(query, [effectiveYearId])

    const statsMap: Record<string, number> = {}
    for (const row of res.rows) {
      statsMap[row.class_id] = row.enrolled_count
      const norm = row.class_id.toLowerCase().replace(/[\s-_]/g, '')
      statsMap[norm] = row.enrolled_count
    }

    return { success: true, data: statsMap }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('Failed to get class enrollment stats:', msg)
    return { success: false, data: {}, error: msg }
  }
}

/**
 * Returns all active classes directly from public.classes database table.
 * Strictly dynamic single source of truth.
 */
export async function getClassesAction(filter?: {
  activeOnly?: boolean
}): Promise<{
  success: boolean
  data: ClassRecord[]
  error?: string
}> {
  try {
    const pool = getPgPool()
    const activeOnly = filter?.activeOnly !== false // defaults to true
    let query = `
      SELECT id, name, grade, section, stream_id, capacity, is_active, created_at
      FROM public.classes
    `
    const params: any[] = []
    if (activeOnly) {
      params.push(true)
      query += ` WHERE is_active = $1`
    }
    query += ` ORDER BY grade DESC NULLS LAST, name ASC;`

    const res = await pool.query(query, params)
    return {
      success: true,
      data: res.rows.map((r) => ({
        id: r.id,
        name: r.name,
        grade: r.grade,
        section: r.section,
        stream_id: r.stream_id,
        capacity: Number(r.capacity || 40),
        is_active: Boolean(r.is_active),
        created_at: r.created_at ? new Date(r.created_at).toISOString() : undefined,
      })),
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('Failed to get classes from database:', msg)
    return { success: false, data: [], error: msg }
  }
}

/**
 * Creates a new class batch in public.classes with RBAC guard.
 */
export async function createClassAction(data: {
  id?: string
  name: string
  grade?: number | null
  section?: string | null
  stream_id?: string | null
  capacity?: number
  is_active?: boolean
}): Promise<{ success: boolean; data?: ClassRecord; error?: string }> {
  try {
    const scope = await getServerUserScope()
    if (!scope.isPrivileged || scope.approvalStatus !== 'approved') {
      return { success: false, error: 'Unauthorized: Only administrative faculty can create academic classes.' }
    }

    const cleanName = data.name.trim()
    if (!cleanName) {
      return { success: false, error: 'Class name is required.' }
    }

    const id = data.id?.trim().toLowerCase() || cleanName.toLowerCase().replace(/[^a-z0-9_-]/g, '-')
    const pool = getPgPool()

    // Ensure stream exists in reference table to satisfy foreign key constraint
    if (data.stream_id && data.stream_id.trim()) {
      await pool.query(
        `INSERT INTO public.streams (id, name) VALUES ($1, $1) ON CONFLICT (id) DO NOTHING;`,
        [data.stream_id.trim()]
      )
    }

    // Check if id already exists
    const checkRes = await pool.query(
      `SELECT id FROM public.classes WHERE id = $1 LIMIT 1;`,
      [id]
    )
    if (checkRes.rows.length > 0) {
      return { success: false, error: `A class with ID "${id}" already exists.` }
    }

    const res = await pool.query(
      `
      INSERT INTO public.classes (id, name, grade, section, stream_id, capacity, is_active, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, now())
      RETURNING id, name, grade, section, stream_id, capacity, is_active, created_at;
      `,
      [
        id,
        cleanName,
        data.grade || null,
        data.section || null,
        data.stream_id ? data.stream_id.trim() : null,
        data.capacity || 40,
        data.is_active !== undefined ? data.is_active : true,
      ]
    )

    revalidatePath('/admin')
    revalidatePath('/schedules')

    const r = res.rows[0]
    return {
      success: true,
      data: {
        id: r.id,
        name: r.name,
        grade: r.grade,
        section: r.section,
        stream_id: r.stream_id,
        capacity: Number(r.capacity || 40),
        is_active: Boolean(r.is_active),
        created_at: new Date(r.created_at).toISOString(),
      },
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('Failed to create class:', msg)
    return { success: false, error: msg }
  }
}

/**
 * Updates an existing class in public.classes with RBAC guard.
 */
export async function updateClassAction(
  id: string,
  data: Partial<{
    name: string
    grade: number | null
    section: string | null
    stream_id: string | null
    capacity: number
    is_active: boolean
  }>
): Promise<{ success: boolean; data?: ClassRecord; error?: string }> {
  try {
    const scope = await getServerUserScope()
    if (!scope.isPrivileged || scope.approvalStatus !== 'approved') {
      return { success: false, error: 'Unauthorized: Only administrative faculty can update academic classes.' }
    }

    const pool = getPgPool()

    // Ensure stream exists in reference table to satisfy foreign key constraint
    if (data.stream_id && data.stream_id.trim()) {
      await pool.query(
        `INSERT INTO public.streams (id, name) VALUES ($1, $1) ON CONFLICT (id) DO NOTHING;`,
        [data.stream_id.trim()]
      )
    }

    const updates: string[] = []
    const params: any[] = [id]

    if (data.name !== undefined) {
      params.push(data.name.trim())
      updates.push(`name = $${params.length}`)
    }
    if (data.grade !== undefined) {
      params.push(data.grade !== null ? Number(data.grade) : null)
      updates.push(`grade = $${params.length}`)
    }
    if (data.section !== undefined) {
      params.push(data.section ? data.section.trim() : null)
      updates.push(`section = $${params.length}`)
    }
    if (data.stream_id !== undefined) {
      params.push(data.stream_id ? data.stream_id.trim() : null)
      updates.push(`stream_id = $${params.length}`)
    }
    if (data.capacity !== undefined) {
      params.push(Number(data.capacity || 40))
      updates.push(`capacity = $${params.length}`)
    }
    if (data.is_active !== undefined) {
      params.push(Boolean(data.is_active))
      updates.push(`is_active = $${params.length}`)
    }

    if (updates.length === 0) {
      return { success: true }
    }

    const query = `
      UPDATE public.classes
      SET ${updates.join(', ')}
      WHERE id = $1
      RETURNING id, name, grade, section, stream_id, capacity, is_active, created_at;
    `
    const res = await pool.query(query, params)
    if (res.rows.length === 0) {
      return { success: false, error: 'Class not found.' }
    }

    revalidatePath('/admin')
    revalidatePath('/schedules')

    const r = res.rows[0]
    return {
      success: true,
      data: {
        id: r.id,
        name: r.name,
        grade: r.grade,
        section: r.section,
        stream_id: r.stream_id,
        capacity: Number(r.capacity || 40),
        is_active: Boolean(r.is_active),
        created_at: new Date(r.created_at).toISOString(),
      },
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('Failed to update class:', msg)
    return { success: false, error: msg }
  }
}

/**
 * Soft-deactivates an academic class with student enrollment safety checks.
 */
export async function deactivateClassAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const scope = await getServerUserScope()
    if (!scope.isPrivileged || scope.approvalStatus !== 'approved') {
      return { success: false, error: 'Unauthorized: Only administrative faculty can deactivate academic classes.' }
    }

    const pool = getPgPool()

    // Soft-deactivate to preserve historical enrollment records
    const res = await pool.query(
      `
      UPDATE public.classes
      SET is_active = false
      WHERE id = $1
      RETURNING id;
      `,
      [id]
    )

    if (res.rows.length === 0) {
      return { success: false, error: 'Class not found.' }
    }

    revalidatePath('/admin')
    revalidatePath('/schedules')

    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('Failed to deactivate class:', msg)
    return { success: false, error: msg }
  }
}

