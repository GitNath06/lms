import { cache } from 'react'
import { createClient } from '../supabase/server'
import { isSupabaseConfigured } from '../supabase/config'
import { getCurrentUserProfile } from '@/app/actions/auth'
import { resolveUserScope, type UserScopeContext } from './user-scope'
import { verifySessionClaim, SESSION_CLAIM_COOKIE_NAME } from '../security/session-claim'

export type { UserScopeContext }

/**
 * Server-side helper to get the authenticated user's scope context,
 * augmented with real-time class_subjects database assignments.
 * 
 * STRICT APPARATUS / APP ROUTER ISOLATION:
 * This function imports createClient from @/lib/supabase/server which uses 'next/headers'.
 * It must remain strictly in this server-only file and NEVER be bundled into Client Components.
 */
export const getServerUserScope = cache(async (): Promise<UserScopeContext> => {
  // If running in automated tests with LABSYNC_TEST_RUNNER, provide an approved test scope
  if (process.env.LABSYNC_TEST_RUNNER === 'true' && !process.env.NEXT_RUNTIME) {
    const testProfile = {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'test-admin@labsync.local',
      full_name: 'Test Administrator',
      role: 'super_admin' as const,
      department: null,
      photo_url: null,
      avatar_url: null,
      honorific: null,
      bio: null,
      teaching_preferences: {},
      is_active: true,
      approval_status: 'approved' as const,
      permissions: {},
      created_at: new Date().toISOString(),
    }
    return resolveUserScope(testProfile)
  }

  // Fast-path: Check HMAC-signed session claim cookie (< 1ms Web Crypto verification)
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const claimCookie = cookieStore.get(SESSION_CLAIM_COOKIE_NAME)?.value
    if (claimCookie) {
      const verified = await verifySessionClaim(claimCookie)
      if (verified && verified.uid && verified.approvalStatus === 'approved') {
        const isPrivileged = verified.role === 'super_admin' || verified.role === 'hod' || verified.role === 'lab_incharge'
        const teacherProfile = verified.role === 'teacher' ? {
          teacherId: verified.teacherId || verified.uid,
          name: '',
          email: '',
          assignedClasses: verified.assignedClasses || [],
          assignedSubjects: verified.assignedSubjects || [],
          assignedLabIds: verified.assignedLabIds || [],
        } : null

        return {
          userId: verified.uid,
          fullName: '',
          email: '',
          role: verified.role as any,
          department: '',
          approvalStatus: verified.approvalStatus as any,
          isPending: false,
          isPrivileged,
          isTeacher: verified.role === 'teacher',
          assignedClasses: verified.assignedClasses || [],
          assignedSubjects: verified.assignedSubjects || [],
          assignedLabIds: verified.assignedLabIds || (verified.labScope ? [verified.labScope] : []),
          defaultViewMode: isPrivileged ? 'institutional' : 'my_data',
          teacherProfile,
        }
      }
    }
  } catch {}

  const profile = await getCurrentUserProfile()
  const baseScope = resolveUserScope(profile)

  // For approved teachers, query live class_subjects database records directly from PostgreSQL
  // Deprecating hardcoded INSTITUTIONAL_TEACHERS fallback when database is configured
  if (profile && profile.role === 'teacher' && profile.approval_status === 'approved' && Boolean((profile as any)?.is_active ?? true)) {
    try {
      if (isSupabaseConfigured()) {
        const supabase = await createClient()
        const { data: currYear } = await supabase
          .from('academic_years')
          .select('id')
          .eq('is_current', true)
          .limit(1)
          .maybeSingle()

        let query = supabase
          .from('class_subjects')
          .select(`
            class_id,
            subject_id,
            default_lab_id,
            academic_year_id,
            classes:class_id(name),
            subjects:subject_id(code, name)
          `)
          .eq('teacher_id', profile.id)

        if (currYear?.id) {
          query = query.or(`academic_year_id.eq.${currYear.id},academic_year_id.is.null`)
        }

        const { data: dbAssignments, error: dbErr } = await query

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
})
