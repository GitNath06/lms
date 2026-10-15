import { createClient } from '../supabase/server'
import { isSupabaseConfigured } from '../supabase/config'
import { getCurrentUserProfile } from '@/app/actions/auth'
import { resolveUserScope, type UserScopeContext } from './user-scope'

export type { UserScopeContext }

/**
 * Server-side helper to get the authenticated user's scope context,
 * augmented with real-time class_subjects database assignments.
 * 
 * STRICT APPARATUS / APP ROUTER ISOLATION:
 * This function imports createClient from @/lib/supabase/server which uses 'next/headers'.
 * It must remain strictly in this server-only file and NEVER be bundled into Client Components.
 */
export async function getServerUserScope(): Promise<UserScopeContext> {
  const profile = await getCurrentUserProfile()
  const baseScope = resolveUserScope(profile)

  // For teachers, query live class_subjects database records directly from PostgreSQL
  // Deprecating hardcoded INSTITUTIONAL_TEACHERS fallback when database is configured
  if (profile && profile.role === 'teacher') {
    try {
      if (isSupabaseConfigured()) {
        const supabase = await createClient()
        const { data: dbAssignments, error: dbErr } = await supabase
          .from('class_subjects')
          .select(`
            class_id,
            subject_id,
            default_lab_id,
            classes:class_id(name),
            subjects:subject_id(code, name)
          `)
          .eq('teacher_id', profile.id)

        if (!dbErr) {
          const assignedClasses = new Set<string>()
          const assignedLabs = new Set<string>()
          const assignedSubjects: UserScopeContext['assignedSubjects'] = []

          for (const row of (dbAssignments || []) as any[]) {
            const className = row.classes?.name || row.class_id
            if (className) assignedClasses.add(className)
            if (row.default_lab_id) assignedLabs.add(row.default_lab_id)
            if (row.subjects) {
              const code = row.subjects.code || row.subject_id
              if (!assignedSubjects.some((s) => s.code === code && s.grade === className)) {
                assignedSubjects.push({
                  code,
                  title: row.subjects.name || code,
                  grade: className,
                  labId: row.default_lab_id || 'comp',
                  labName: 'Laboratory',
                })
              }
            }
          }

          return {
            ...baseScope,
            assignedClasses: Array.from(assignedClasses),
            assignedLabIds: Array.from(assignedLabs),
            assignedSubjects,
            teacherProfile: null, // Deprecated INSTITUTIONAL_TEACHERS in favor of canonical PostgreSQL truth
          }
        }
      }
    } catch (err) {
      console.warn('Error querying teacher scope from class_subjects:', err)
    }
  }

  return baseScope
}
