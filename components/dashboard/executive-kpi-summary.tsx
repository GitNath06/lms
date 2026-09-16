'use client'

import React, { useMemo } from 'react'
import Link from 'next/link'
import {
  Calendar,
  Users,
  FileCheck,
  Plus,
  Printer,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface TodaysActivityCardProps {
  effectiveSlotsCount: number
  loggedCount: number
  totalSlotsCount: number
  attendanceRate: number
  totalPresentToday: number
  totalEnrolledToday: number
  passedUnloggedCount: number
  dayName: string
  dayNameNp?: string
  isHoliday?: boolean
  holidayName?: string
}

export function TodaysActivityCard({
  effectiveSlotsCount,
  loggedCount,
  totalSlotsCount,
  attendanceRate,
  totalPresentToday,
  totalEnrolledToday,
  passedUnloggedCount,
  dayName,
  dayNameNp,
  isHoliday,
  holidayName,
}: TodaysActivityCardProps) {
  // Refined 3-tier attendance semantic logic:
  // < 75% : Danger (Rose)
  // 75% - 84%: Crisp neutral (nominal / acceptable, no false alarm)
  // >= 85%: Success (Emerald)
  // zero / awaiting: Neutral
  const attendanceColorClass = useMemo(() => {
    if (effectiveSlotsCount === 0 || totalEnrolledToday === 0) {
      return 'text-zinc-950 dark:text-slate-100'
    }
    if (attendanceRate < 75) return 'text-rose-600 dark:text-rose-400'
    if (attendanceRate < 85) return 'text-zinc-950 dark:text-slate-100'
    return 'text-emerald-600 dark:text-emerald-400'
  }, [effectiveSlotsCount, totalEnrolledToday, attendanceRate])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
      {/* Card 1: Practical Slots */}
      <div className="glass-card rounded-xl sm:rounded-2xl border border-zinc-200/80 dark:border-white/[0.08] bg-white dark:bg-surface-2/80 p-2.5 sm:p-3 flex flex-col justify-between shadow-2xs hover:border-zinc-300 dark:hover:border-white/[0.15] transition-all relative overflow-hidden dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
        {/* Specular sheen */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200/70 dark:border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <Calendar className="h-3 w-3" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-slate-300 font-sans">
              Slots
            </span>
          </div>
          <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-surface-3 text-zinc-600 dark:text-slate-300 border border-zinc-200/60 dark:border-white/[0.06]">
            Today
          </span>
        </div>

        <div className="mt-2 flex items-baseline justify-between gap-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl sm:text-[22px] font-extrabold font-heading text-zinc-950 dark:text-white tabular-nums tracking-tight leading-none">
              {effectiveSlotsCount}
            </span>
            <span className="text-[11px] font-medium text-zinc-400 dark:text-slate-500 font-sans">
              scheduled
            </span>
          </div>
          <span className="text-[10px] text-zinc-400 dark:text-slate-500 font-sans truncate">
            Class 11 & 12
          </span>
        </div>
      </div>

      {/* Card 2: Avg Attendance */}
      <div className="glass-card rounded-xl sm:rounded-2xl border border-zinc-200/80 dark:border-white/[0.08] bg-white dark:bg-surface-2/80 p-2.5 sm:p-3 flex flex-col justify-between shadow-2xs hover:border-zinc-300 dark:hover:border-white/[0.15] transition-all relative overflow-hidden dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
        {/* Specular sheen */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/70 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <Users className="h-3 w-3" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-slate-300 font-sans">
              Attendance
            </span>
          </div>
          <span
            className={`text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded border ${
              effectiveSlotsCount === 0 || totalEnrolledToday === 0
                ? 'bg-zinc-100 dark:bg-surface-3 text-zinc-500 dark:text-slate-400 border-zinc-200/60 dark:border-white/[0.06]'
                : attendanceRate >= 85
                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                : attendanceRate >= 75
                ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20'
                : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'
            }`}
          >
            {effectiveSlotsCount === 0 || totalEnrolledToday === 0
              ? 'Awaiting'
              : attendanceRate >= 85
              ? 'Optimal'
              : attendanceRate >= 75
              ? 'Normal'
              : 'Low Rate'}
          </span>
        </div>

        <div className="mt-2 flex items-baseline justify-between gap-1">
          <div className="flex items-baseline gap-1">
            <span
              className={`text-xl sm:text-[22px] font-extrabold font-heading tabular-nums tracking-tight leading-none ${attendanceColorClass}`}
            >
              {effectiveSlotsCount === 0 || totalEnrolledToday === 0 ? '—' : `${attendanceRate}%`}
            </span>
            {totalEnrolledToday > 0 && (
              <span className="text-[11px] font-medium text-zinc-400 dark:text-slate-500 font-sans">
                rate
              </span>
            )}
          </div>
          <span className="text-[10px] text-zinc-400 dark:text-slate-500 font-sans truncate">
            {effectiveSlotsCount === 0
              ? 'No sessions'
              : totalEnrolledToday > 0
              ? `${totalPresentToday}/${totalEnrolledToday} present`
              : 'Roll-call pending'}
          </span>
        </div>
      </div>

      {/* Card 3: Sessions Logged */}
      <div className="glass-card rounded-xl sm:rounded-2xl border border-zinc-200/80 dark:border-white/[0.08] bg-white dark:bg-surface-2/80 p-2.5 sm:p-3 flex flex-col justify-between shadow-2xs hover:border-zinc-300 dark:hover:border-white/[0.15] transition-all relative overflow-hidden dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
        {/* Specular sheen */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-violet-50 dark:bg-violet-500/10 border border-violet-200/70 dark:border-violet-500/20 flex items-center justify-center text-violet-600 dark:text-violet-400 shrink-0">
              <FileCheck className="h-3 w-3" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-slate-300 font-sans">
              Logged
            </span>
          </div>
          <span
            className={`text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded border ${
              loggedCount === totalSlotsCount && totalSlotsCount > 0
                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                : passedUnloggedCount > 0
                ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                : 'bg-zinc-100 dark:bg-surface-3 text-zinc-600 dark:text-slate-300 border-zinc-200/70 dark:border-white/[0.06]'
            }`}
          >
            {loggedCount === totalSlotsCount && totalSlotsCount > 0
              ? 'Complete'
              : passedUnloggedCount > 0
              ? `${passedUnloggedCount} Pending`
              : 'On Track'}
          </span>
        </div>

        <div className="mt-2 space-y-1">
          <div className="flex items-baseline justify-between gap-1">
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-[22px] font-extrabold font-heading text-zinc-950 dark:text-white tabular-nums tracking-tight leading-none">
                {loggedCount}
              </span>
              <span className="text-xs font-bold font-heading text-zinc-400 dark:text-slate-500">
                /{totalSlotsCount}
              </span>
            </div>
            <span className="text-[10px] font-medium text-zinc-400 dark:text-slate-500 font-sans">
              {totalSlotsCount > 0 ? `${Math.round((loggedCount / totalSlotsCount) * 100)}%` : '0%'}
            </span>
          </div>

          <div className="w-full bg-zinc-100 dark:bg-surface-3 h-1 rounded-full overflow-hidden border border-zinc-200/40 dark:border-white/[0.04]">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                loggedCount === totalSlotsCount && totalSlotsCount > 0
                  ? 'bg-emerald-500'
                  : passedUnloggedCount > 0
                  ? 'bg-amber-500'
                  : 'bg-indigo-600 dark:bg-indigo-500'
              }`}
              style={{ width: `${totalSlotsCount > 0 ? Math.min(100, Math.round((loggedCount / totalSlotsCount) * 100)) : 0}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export function QuickOperationsCard() {
  return (
    <div className="glass-card rounded-xl sm:rounded-2xl p-2.5 sm:p-3 border border-zinc-200/80 dark:border-white/[0.08] shadow-2xs space-y-2 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] relative overflow-hidden flex flex-col justify-between">
      {/* Milled Top Specular Sheen */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-sans flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
          Quick Operations
        </span>
        <Link
          href="/print/daily-log"
          className="text-xs font-semibold font-sans text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Daily Register ↗
        </Link>
      </div>

      {/* Action Buttons: Strictly Print Report & New Session Log */}
      <div className="grid grid-cols-2 gap-2">
        <Link href="/print/records" className="w-full">
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 px-2 text-xs font-semibold gap-1.5 rounded-xl border-zinc-200 dark:border-white/[0.08] hover:bg-zinc-100 dark:hover:bg-slate-800 text-zinc-800 dark:text-slate-200 cursor-pointer shadow-2xs"
          >
            <Printer className="h-3.5 w-3.5 text-zinc-500 dark:text-slate-400" />
            <span>Print Report</span>
          </Button>
        </Link>

        <Link href="/records/new" className="w-full">
          <Button
            size="sm"
            className="w-full h-8 px-2 text-xs font-bold gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Session Log</span>
          </Button>
        </Link>
      </div>
    </div>
  )
}

export interface ExecutiveKpiSummaryProps extends TodaysActivityCardProps {
  onReportDamage?: () => void
  totalHealthIssues?: number
  activeIncidentsCount?: number
  overdueServicingCount?: number
}

export default function ExecutiveKpiSummary(props: ExecutiveKpiSummaryProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-3.5 items-start">
      <div className="lg:col-span-8">
        <TodaysActivityCard {...props} />
      </div>
      <div className="lg:col-span-4">
        <QuickOperationsCard />
      </div>
    </div>
  )
}
