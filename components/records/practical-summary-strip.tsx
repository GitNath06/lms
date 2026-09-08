'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { PracticalSummaryMetrics } from '@/types/records'
import { CalendarCheck, Percent, XCircle, Users } from 'lucide-react'

interface PracticalSummaryStripProps {
  metrics: PracticalSummaryMetrics
  isLoading?: boolean
}

export default function PracticalSummaryStrip({ metrics, isLoading = false }: PracticalSummaryStripProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-sans">
      {/* 1. Total Sessions */}
      <Card className="border border-zinc-200/80 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-sm shadow-xs hover:shadow-md transition-shadow">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Total Sessions
            </p>
            {isLoading ? (
              <div className="h-7 w-24 bg-zinc-200 dark:bg-zinc-800 rounded-md animate-pulse mt-1" />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-zinc-950 dark:text-white">
                  {metrics.totalSessions}
                </span>
                <span className="text-[11px] text-zinc-500 font-sans">
                  ({metrics.conductedSessions} conducted)
                </span>
              </div>
            )}
          </div>
          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <CalendarCheck className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      {/* 2. Average Attendance Rate */}
      <Card className="border border-zinc-200/80 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-sm shadow-xs hover:shadow-md transition-shadow">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Average Attendance
            </p>
            {isLoading ? (
              <div className="h-7 w-20 bg-zinc-200 dark:bg-zinc-800 rounded-md animate-pulse mt-1" />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {metrics.averageAttendancePct.toFixed(1)}%
                </span>
                <span className="text-[11px] text-zinc-500 font-sans">avg attendance</span>
              </div>
            )}
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Percent className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      {/* 3. Skipped / Rescheduled Sessions */}
      <Card className="border border-zinc-200/80 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-sm shadow-xs hover:shadow-md transition-shadow">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Skipped Sessions
            </p>
            {isLoading ? (
              <div className="h-7 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-md animate-pulse mt-1" />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
                  {metrics.skippedSessions}
                </span>
                <span className="text-[11px] text-zinc-500 font-sans">
                  {metrics.totalSessions > 0
                    ? `${((metrics.skippedSessions / metrics.totalSessions) * 100).toFixed(0)}% of total`
                    : '0%'}
                </span>
              </div>
            )}
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <XCircle className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      {/* 4. Total Student Footfall */}
      <Card className="border border-zinc-200/80 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-sm shadow-xs hover:shadow-md transition-shadow">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Student Headcount
            </p>
            {isLoading ? (
              <div className="h-7 w-24 bg-zinc-200 dark:bg-zinc-800 rounded-md animate-pulse mt-1" />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-cyan-600 dark:text-cyan-400">
                  {metrics.totalPresent}
                </span>
                <span className="text-[11px] text-zinc-500 font-sans">
                  / {metrics.totalEnrolled} total
                </span>
              </div>
            )}
          </div>
          <div className="h-10 w-10 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
            <Users className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
