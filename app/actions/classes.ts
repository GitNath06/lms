'use server'

import { getPgPool } from '@/lib/db'
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
        `SELECT id FROM public.academic_years WHERE is_current = true LIMIT 1;`
      )
      effectiveYearId = yearRes.rows[0]?.id || '2083'
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
export async function getClassesAction(): Promise<{
  success: boolean
  data: ClassRecord[]
  error?: string
}> {
  try {
    const pool = getPgPool()
    const query = `
      SELECT id, name, grade, section, stream_id, capacity, is_active, created_at
      FROM public.classes
      WHERE is_active = true
      ORDER BY grade DESC NULLS LAST, name ASC;
    `
    const res = await pool.query(query)
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
