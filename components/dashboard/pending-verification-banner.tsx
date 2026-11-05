'use client'

import React from 'react'
import { Clock } from 'lucide-react'
import type { UserProfile } from '@/lib/permissions'

interface PendingVerificationBannerProps {
  profile: UserProfile | null
}

export default function PendingVerificationBanner({ profile }: PendingVerificationBannerProps) {
  if (!profile || profile.approval_status !== 'pending') {
    return null
  }

  return (
    <div className="mb-5 px-3.5 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in duration-200">
      <div className="flex items-center gap-2.5 min-w-0">
        <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            Account In Review:
          </span>
          <span className="text-zinc-600 dark:text-zinc-400">
            Your registration is awaiting Administrator clearance. You have read-only preview access.
          </span>
        </div>
      </div>

      <span className="shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
        Pending Approval
      </span>
    </div>
  )
}
