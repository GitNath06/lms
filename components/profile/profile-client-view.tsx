'use client'

import React, { useState, useEffect } from 'react'
import { useUserScope } from '@/hooks/use-user-scope'
import { TeacherProfileForm } from '@/components/profile/teacher-profile-form'
import { ProfileSkeleton } from '@/components/ui/skeleton-loader'
import { UserCheck, ShieldCheck, Clock } from 'lucide-react'
import { getCachedData } from '@/lib/cache/client-query-cache'
import type { UserProfile } from '@/lib/permissions'

interface ProfileClientViewProps {
  initialProfile?: UserProfile | null
}

export function ProfileClientView({ initialProfile }: ProfileClientViewProps = {}) {
  const { profile: hookProfile, scope: userScope, loading } = useUserScope(initialProfile)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const profile = hookProfile || initialProfile || getCachedData<UserProfile>('auth:current-user-profile')

  // Prevent hydration mismatch: If initialProfile was not provided during SSR,
  // ensure client frame-1 matches the server-rendered skeleton before mounting unless cached.
  if (!initialProfile && !mounted && !profile) {
    return <ProfileSkeleton />
  }

  if (loading && !profile) {
    return <ProfileSkeleton />
  }

  if (!profile) {
    return <ProfileSkeleton />
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-200/60 dark:border-zinc-800/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <UserCheck className="h-5 w-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold font-heading text-zinc-900 dark:text-zinc-50 tracking-tight">
              Faculty Profile & Preferences
            </h1>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Configure your institutional title, contact information, research bio, and curriculum delivery preferences.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {profile.approval_status === 'pending' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              <span>Clearance: In Review</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              <span>Authenticated Session</span>
            </span>
          )}
        </div>
      </div>

      {/* Main Profile Form */}
      <TeacherProfileForm initialProfile={profile} userScope={userScope || undefined} />
    </div>
  )
}
