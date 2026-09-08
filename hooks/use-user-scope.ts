'use client'

import { useState, useEffect } from 'react'
import { UserScopeContext, getServerUserScope, resolveUserScope } from '@/lib/context/user-scope'
import { getCurrentUserProfile, UserProfile } from '@/app/actions/auth'

let cachedProfilePromise: Promise<UserProfile | null> | null = null
let lastProfileFetch = 0
let cachedResolvedScope: { profile: UserProfile | null; scope: UserScopeContext } | null = null
const PROFILE_CLIENT_TTL = 30000 // 30 seconds

export function clearUserScopeCache() {
  cachedProfilePromise = null
  lastProfileFetch = 0
  cachedResolvedScope = null
}

export function useUserScope() {
  const [scope, setScope] = useState<UserScopeContext | null>(cachedResolvedScope ? cachedResolvedScope.scope : null)
  const [profile, setProfile] = useState<UserProfile | null>(cachedResolvedScope ? cachedResolvedScope.profile : null)
  const [loading, setLoading] = useState(!cachedResolvedScope)

  useEffect(() => {
    let isMounted = true
    async function fetchScope() {
      try {
        const now = Date.now()
        if (!cachedProfilePromise || (now - lastProfileFetch > PROFILE_CLIENT_TTL)) {
          lastProfileFetch = now
          cachedProfilePromise = getCurrentUserProfile().catch((err) => {
            cachedProfilePromise = null
            throw err
          })
        }
        const userProf = await cachedProfilePromise
        if (isMounted) {
          setProfile(userProf)
          const resolved = resolveUserScope(userProf)
          setScope(resolved)
          cachedResolvedScope = { profile: userProf, scope: resolved }
        }
      } catch (err) {
        console.warn('Failed to resolve client user scope:', err)
        if (isMounted) {
          const fallback = resolveUserScope(null)
          setScope(fallback)
          cachedResolvedScope = { profile: null, scope: fallback }
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    fetchScope()
    return () => {
      isMounted = false
    }
  }, [])

  return {
    scope,
    profile,
    loading,
    isPrivileged: scope?.isPrivileged ?? false,
    isTeacher: scope?.isTeacher ?? true,
    assignedClasses: scope?.assignedClasses ?? [],
    assignedSubjects: scope?.assignedSubjects ?? [],
    assignedLabIds: scope?.assignedLabIds ?? [],
    defaultViewMode: scope?.defaultViewMode ?? 'my_data',
  }
}
