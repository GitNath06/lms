'use server'

import { revalidatePath } from 'next/cache'
import { getPgPool } from '@/lib/db'
import { getServerUserScope } from '@/lib/context/server-user-scope'
import type {
  SubjectRecord,
  CreateSubjectInput,
  UpdateSubjectInput,
  ClassSubjectRecord,
  AssignSubjectToClassInput,
} from '@/lib/types/subjects'

/**
 * Returns subjects from public.subjects database table.
 * Strictly dynamic single source of truth.
 */
export async function getSubjectsAction(filter?: {
  activeOnly?: boolean
  labId?: string
}): Promise<{
  success: boolean
  data: SubjectRecord[]
  error?: string
}> {
  try {
    const pool = getPgPool()
    const activeOnly = filter?.activeOnly !== false // defaults to true
    let query = `
      SELECT id, code, name, default_lab_id, credit_hours, is_active, created_at
      FROM public.subjects
      WHERE 1=1
    `
    const params: any[] = []

    if (activeOnly) {
      params.push(true)
      query += ` AND is_active = $${params.length}`
    }

    if (filter?.labId) {
      params.push(filter.labId)
      query += ` AND default_lab_id = $${params.length}`
    }

    query += ` ORDER BY name ASC;`

    const res = await pool.query(query, params)
    return {
      success: true,
      data: res.rows.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        default_lab_id: r.default_lab_id,
        credit_hours: r.credit_hours !== null ? Number(r.credit_hours) : null,
        is_active: Boolean(r.is_active),
        created_at: r.created_at ? new Date(r.created_at).toISOString() : undefined,
      })),
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('Failed to get subjects from database:', msg)
    return { success: false, data: [], error: msg }
  }
}

/**
 * Creates a new subject in public.subjects with RBAC guard.
 */
export async function createSubjectAction(
  data: CreateSubjectInput
): Promise<{ success: boolean; data?: SubjectRecord; error?: string }> {
  try {
    const scope = await getServerUserScope()
    if (!scope.isPrivileged || scope.approvalStatus !== 'approved') {
      return { success: false, error: 'Unauthorized: Only administrative faculty can create curriculum subjects.' }
    }

    const cleanCode = data.code.trim().toUpperCase()
    const cleanName = data.name.trim()
    if (!cleanCode || !cleanName) {
      return { success: false, error: 'Subject code and name are required.' }
    }

    const id = data.id?.trim().toLowerCase() || cleanCode.toLowerCase().replace(/[^a-z0-9_-]/g, '-')
    const pool = getPgPool()

    // Check if code or id already exists
    const checkRes = await pool.query(
      `SELECT id FROM public.subjects WHERE id = $1 OR UPPER(code) = $2 LIMIT 1;`,
      [id, cleanCode]
    )
    if (checkRes.rows.length > 0) {
      return { success: false, error: `A subject with code "${cleanCode}" already exists.` }
    }

    const res = await pool.query(
      `
      INSERT INTO public.subjects (id, code, name, default_lab_id, credit_hours, is_active, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, now())
      RETURNING id, code, name, default_lab_id, credit_hours, is_active, created_at;
      `,
      [
        id,
        cleanCode,
        cleanName,
        data.default_lab_id || null,
        data.credit_hours || null,
        data.is_active !== undefined ? data.is_active : true,
      ]
    )

    revalidatePath('/admin')
    revalidatePath('/records')
    revalidatePath('/schedules')

    const r = res.rows[0]
    return {
      success: true,
      data: {
        id: r.id,
        code: r.code,
        name: r.name,
        default_lab_id: r.default_lab_id,
        credit_hours: r.credit_hours !== null ? Number(r.credit_hours) : null,
        is_active: Boolean(r.is_active),
        created_at: new Date(r.created_at).toISOString(),
      },
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('Failed to create subject:', msg)
    return { success: false, error: msg }
  }
}

/**
 * Updates an existing subject in public.subjects with RBAC guard.
 */
export async function updateSubjectAction(
  id: string,
  data: UpdateSubjectInput
): Promise<{ success: boolean; data?: SubjectRecord; error?: string }> {
  try {
    const scope = await getServerUserScope()
    if (!scope.isPrivileged || scope.approvalStatus !== 'approved') {
      return { success: false, error: 'Unauthorized: Only administrative faculty can update curriculum subjects.' }
    }

    const pool = getPgPool()
    const updates: string[] = []
    const params: any[] = [id]

    if (data.code !== undefined) {
      params.push(data.code.trim().toUpperCase())
      updates.push(`code = $${params.length}`)
    }
    if (data.name !== undefined) {
      params.push(data.name.trim())
      updates.push(`name = $${params.length}`)
    }
    if (data.default_lab_id !== undefined) {
      params.push(data.default_lab_id || null)
      updates.push(`default_lab_id = $${params.length}`)
    }
    if (data.credit_hours !== undefined) {
      params.push(data.credit_hours !== null ? Number(data.credit_hours) : null)
      updates.push(`credit_hours = $${params.length}`)
    }
    if (data.is_active !== undefined) {
      params.push(Boolean(data.is_active))
      updates.push(`is_active = $${params.length}`)
    }

    if (updates.length === 0) {
      return { success: true }
    }

    const query = `
      UPDATE public.subjects
      SET ${updates.join(', ')}
      WHERE id = $1
      RETURNING id, code, name, default_lab_id, credit_hours, is_active, created_at;
    `
    const res = await pool.query(query, params)
    if (res.rows.length === 0) {
      return { success: false, error: `Subject not found.` }
    }

    revalidatePath('/admin')
    revalidatePath('/records')
    revalidatePath('/schedules')

    const r = res.rows[0]
    return {
      success: true,
      data: {
        id: r.id,
        code: r.code,
        name: r.name,
        default_lab_id: r.default_lab_id,
        credit_hours: r.credit_hours !== null ? Number(r.credit_hours) : null,
        is_active: Boolean(r.is_active),
        created_at: new Date(r.created_at).toISOString(),
      },
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('Failed to update subject:', msg)
    return { success: false, error: msg }
  }
}

/**
 * Soft-deactivates a subject with reference protection.
 * Foreign keys in practical_logs and schedules prevent raw DELETE.
 */
export async function deactivateSubjectAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const scope = await getServerUserScope()
    if (!scope.isPrivileged || scope.approvalStatus !== 'approved') {
      return { success: false, error: 'Unauthorized: Only administrative faculty can deactivate curriculum subjects.' }
    }

    const pool = getPgPool()

    // Soft-deactivate to preserve historical integrity
    const res = await pool.query(
      `
      UPDATE public.subjects
      SET is_active = false
      WHERE id = $1
      RETURNING id;
      `,
      [id]
    )

    if (res.rows.length === 0) {
      return { success: false, error: 'Subject not found.' }
    }

    revalidatePath('/admin')
    revalidatePath('/records')
    revalidatePath('/schedules')

    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('Failed to deactivate subject:', msg)
    return { success: false, error: msg }
  }
}

/**
 * Returns relational class_subjects mappings enriched with class names,
 * subject names, and assigned teacher profiles.
 */
export async function getClassSubjectsAction(
  classId?: string,
  academicYearId?: string
): Promise<{
  success: boolean
  data: ClassSubjectRecord[]
  error?: string
}> {
  try {
    const pool = getPgPool()
    let query = `
      SELECT 
        cs.id,
        cs.academic_year_id,
        cs.class_id,
        cs.subject_id,
        cs.teacher_id,
        cs.default_lab_id,
        cs.created_at,
        c.name AS class_name,
        s.code AS subject_code,
        s.name AS subject_name,
        p.full_name AS teacher_name,
        l.name AS lab_name
      FROM public.class_subjects cs
      LEFT JOIN public.classes c ON c.id = cs.class_id
      LEFT JOIN public.subjects s ON s.id = cs.subject_id
      LEFT JOIN public.profiles p ON p.id = cs.teacher_id
      LEFT JOIN public.labs l ON l.id = cs.default_lab_id
      WHERE 1=1
    `
    const params: any[] = []

    if (classId) {
      params.push(classId)
      query += ` AND cs.class_id = $${params.length}`
    }

    let effectiveYearId = academicYearId
    if (!effectiveYearId) {
      const currentYearRes = await pool.query(
        `SELECT id FROM public.academic_years WHERE is_current = true LIMIT 1;`
      )
      effectiveYearId = currentYearRes.rows[0]?.id
    }

    if (effectiveYearId && effectiveYearId !== 'all') {
      params.push(effectiveYearId)
      query += ` AND (cs.academic_year_id = $${params.length} OR cs.academic_year_id IS NULL)`
    }

    query += ` ORDER BY c.name ASC, s.name ASC;`

    const res = await pool.query(query, params)
    return {
      success: true,
      data: res.rows.map((r) => ({
        id: r.id,
        academic_year_id: r.academic_year_id,
        class_id: r.class_id,
        subject_id: r.subject_id,
        teacher_id: r.teacher_id,
        default_lab_id: r.default_lab_id,
        created_at: r.created_at ? new Date(r.created_at).toISOString() : undefined,
        class_name: r.class_name || r.class_id,
        subject_code: r.subject_code || '',
        subject_name: r.subject_name || r.subject_id,
        teacher_name: r.teacher_name || undefined,
        lab_name: r.lab_name || undefined,
      })),
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('Failed to get class_subjects from database:', msg)
    return { success: false, data: [], error: msg }
  }
}

/**
 * Assigns a subject to a class in public.class_subjects junction table.
 */
export async function assignSubjectToClassAction(
  data: AssignSubjectToClassInput
): Promise<{ success: boolean; data?: ClassSubjectRecord; error?: string }> {
  try {
    const scope = await getServerUserScope()
    if (!scope.isPrivileged || scope.approvalStatus !== 'approved') {
      return { success: false, error: 'Unauthorized: Only administrative faculty can assign subjects to classes.' }
    }

    const pool = getPgPool()

    // Determine current academic year if not provided
    let yearId = data.academic_year_id
    if (!yearId) {
      const yearRes = await pool.query(
        `SELECT id FROM public.academic_years WHERE is_current = true LIMIT 1;`
      )
      yearId = yearRes.rows[0]?.id || null
    }

    // Check if mapping already exists
    const checkRes = await pool.query(
      `
      SELECT id FROM public.class_subjects 
      WHERE class_id = $1 AND subject_id = $2 
        AND (academic_year_id = $3 OR ($3 IS NULL AND academic_year_id IS NULL))
      LIMIT 1;
      `,
      [data.class_id, data.subject_id, yearId]
    )

    let recordId: string
    if (checkRes.rows.length > 0) {
      // Update existing mapping
      recordId = checkRes.rows[0].id
      await pool.query(
        `
        UPDATE public.class_subjects
        SET teacher_id = $1, default_lab_id = $2
        WHERE id = $3;
        `,
        [data.teacher_id || null, data.default_lab_id || null, recordId]
      )
    } else {
      // Insert new mapping
      const insertRes = await pool.query(
        `
        INSERT INTO public.class_subjects (academic_year_id, class_id, subject_id, teacher_id, default_lab_id, created_at)
        VALUES ($1, $2, $3, $4, $5, now())
        RETURNING id;
        `,
        [yearId, data.class_id, data.subject_id, data.teacher_id || null, data.default_lab_id || null]
      )
      recordId = insertRes.rows[0].id
    }

    revalidatePath('/admin')
    revalidatePath('/schedules')

    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('Failed to assign subject to class:', msg)
    return { success: false, error: msg }
  }
}

/**
 * Removes a class_subjects junction mapping with foreign key protection & RBAC guard.
 */
export async function removeClassSubjectAction(
  classSubjectId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const scope = await getServerUserScope()
    if (!scope.isPrivileged || scope.approvalStatus !== 'approved') {
      return { success: false, error: 'Unauthorized: Only administrative faculty can remove class subject assignments.' }
    }

    const pool = getPgPool()

    // 1. Foreign Key Reference Check: Guard against orphan or corrupted practical logs
    const logCheck = await pool.query(
      `SELECT count(*)::int AS log_count FROM public.practical_logs WHERE class_subject_id = $1;`,
      [classSubjectId]
    )
    const logCount = logCheck.rows[0]?.log_count || 0
    if (logCount > 0) {
      return {
        success: false,
        error: `Cannot delete class-subject assignment: ${logCount} historical practical log(s) reference this assignment. Unassign the teacher instead to preserve official audit records.`,
      }
    }

    // 2. Transactional safe delete: cleans associated schedules and deletes mapping cleanly
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(`DELETE FROM public.schedules WHERE class_subject_id = $1;`, [classSubjectId])
      await client.query(`DELETE FROM public.class_subjects WHERE id = $1;`, [classSubjectId])
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    revalidatePath('/admin')
    revalidatePath('/schedules')

    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('Failed to remove class_subject assignment:', msg)
    return { success: false, error: msg }
  }
}
