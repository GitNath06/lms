'use client'

import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  Users,
  Wrench,
} from 'lucide-react'
import Link from 'next/link'

interface OperationsSummaryProps {
  greeting: string
  firstName?: string
  dayName: string
  dayNameNp: string
  nepaliYear: string | number
  sessionCount: number
  loggedCount: number
  compliancePct: number
  attendanceRate: number
  totalPresent: number
  totalEnrolled: number
  healthIssues: number
  onOpenCalendar: () => void
}

export default function OperationsSummary({
  greeting,
  firstName,
  dayName,
  dayNameNp,
  nepaliYear,
  sessionCount,
  loggedCount,
  compliancePct,
  attendanceRate,
  totalPresent,
  totalEnrolled,
  healthIssues,
  onOpenCalendar,
}: OperationsSummaryProps) {
  const summaryItems = [
    {
      label: 'Practical sessions',
      value: sessionCount,
      detail: `${dayName} timetable`,
      icon: Activity,
      tone: 'text-indigo-600 dark:text-indigo-400',
    },
    {
      label: 'Records completed',
      value: `${loggedCount}/${sessionCount}`,
      detail: `${compliancePct}% logged`,
      icon: ClipboardCheck,
      tone: compliancePct === 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400',
    },
    {
      label: 'Attendance',
      value: `${attendanceRate}%`,
      detail: totalEnrolled > 0 ? `${totalPresent}/${totalEnrolled} present` : 'Awaiting roll call',
      icon: Users,
      tone: 'text-indigo-600 dark:text-indigo-400',
    },
    {
      label: 'Needs attention',
      value: healthIssues,
      detail: healthIssues === 0 ? 'All clear' : 'Open lab issues',
      icon: Wrench,
      tone: healthIssues > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400',
    },
  ]

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-zinc-200/80 pb-5 dark:border-white/[0.08] sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-[11px] font-semibold tracking-wide text-zinc-500 dark:text-slate-400">
            LabSync / Operations
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-[-0.04em] text-zinc-950 dark:text-white sm:text-4xl">
            Today in the laboratories
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-slate-400">
            {greeting}, {firstName || 'there'}. Here is the operational picture for today.
          </p>
        </div>

        <div className="flex items-center gap-3 text-sm sm:text-right">
          <button
            type="button"
            onClick={onOpenCalendar}
            className="border-r border-zinc-200 pr-3 text-left dark:border-white/[0.08] sm:text-right"
          >
            <span className="block text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-slate-500">
              Today
            </span>
            <span className="mt-0.5 block font-semibold text-zinc-800 dark:text-zinc-200">
              {dayNameNp} · {nepaliYear}
            </span>
          </button>
          <Link
            href="/schedules"
            className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            Timetable
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 border-y border-zinc-200/80 dark:border-white/[0.08] sm:grid-cols-4">
        {summaryItems.map((item, index) => {
          const Icon = item.icon
          return (
            <div
              key={item.label}
              className={`min-w-0 px-3 py-3.5 sm:px-4 ${index > 0 ? 'border-l border-zinc-200/80 dark:border-white/[0.08]' : ''}`}
            >
              <div className="flex items-center gap-2">
                <Icon className={`h-3.5 w-3.5 shrink-0 ${item.tone}`} />
                <span className="truncate text-[11px] font-medium text-zinc-500 dark:text-slate-400">
                  {item.label}
                </span>
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className={`font-heading text-xl font-bold tabular-nums ${item.tone}`}>
                  {item.value}
                </span>
                <span className="truncate text-[10px] text-zinc-400 dark:text-slate-500">
                  {item.detail}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="hidden items-center gap-2 text-[11px] font-medium text-zinc-500 dark:text-slate-400 sm:flex">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        <span>Operational overview</span>
        <span className="h-px flex-1 bg-zinc-200/80 dark:bg-white/[0.08]" />
      </div>
    </section>
  )
}
