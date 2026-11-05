'use client'

import { useState, useEffect } from 'react'
import { type UserScopeContext, resolveUserScope } from '@/lib/context/user-scope'
import { getCurrentUserProfile, type UserProfile } from '@/app/actions/auth'
import {
  getCachedData,
  setCachedData,
  fetchWithClientCache,
  invalidateCacheByPrefix,
} from '@/lib/cache/client-query-cache'

const USER_PROFILE_CACHE_KEY = 'auth:current-user-profile'
const USER_PROFILE_TTL = 300_000 // 5 minutes

export function clearUserScopeCache() {
  invalidateCacheByPrefix(USER_PROFILE_CACHE_KEY)
}

export function useUserScope(initialProfile?: UserProfile | null) {
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    return initialProfile || getCachedData<UserProfile>(USER_PROFILE_CACHE_KEY) || null
  })
  const [scope, setScope] = useState<UserScopeContext | null>(() => {
    const base = initialProfile || getCachedData<UserProfile>(USER_PROFILE_CACHE_KEY)
    return base ? resolveUserScope(base) : null
  })
  const [loading, setLoading] = useState<boolean>(() => {
    return !initialProfile && !getCachedData<UserProfile>(USER_PROFILE_CACHE_KEY)
  })

  useEffect(() => {
    let isMounted = true
    async function loadScope() {
      try {
        const userProf = await fetchWithClientCache<UserProfile | null>(
          USER_PROFILE_CACHE_KEY,
          () => getCurrentUserProfile(),
          { staleTimeMs: USER_PROFILE_TTL }
        )
        if (isMounted) {
          setProfile(userProf)
          setScope(resolveUserScope(userProf))
        }
      } catch (err) {
        console.warn('Failed to resolve client user scope:', err)
        if (isMounted) {
          const fallback = resolveUserScope(null)
          setScope(fallback)
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    loadScope()
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
