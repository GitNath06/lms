import React from 'react'
import { FileCheck, Users, TrendingUp, Sparkles, Search, Plus } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'

export default function LogsLoading() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto select-none animate-in fade-in duration-200">
      {/* 1. TOP EXECUTIVE AUDIT METRICS (Exact duplicate of logs/page.tsx) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1 */}
        <div className="relative overflow-hidden rounded-2xl border border-zinc-200/90 dark:border-zinc-800/90 bg-gradient-to-br from-white via-zinc-50/50 to-zinc-100/40 dark:from-zinc-900/90 dark:via-zinc-900/50 dark:to-zinc-950 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/60 dark:border-indigo-800/50 shadow-2xs">
                <FileCheck className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
                Log Database
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/50 font-bold">
              Audited
            </span>
          </div>
          <div className="mt-3 mb-1.5 flex items-baseline gap-1.5">
            <Skeleton className="h-8 w-16 rounded-md" />
            <span className="text-xs font-medium text-zinc-400">Registered Logs</span>
          </div>
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] font-mono text-zinc-400">
            Certified Academic Records
          </div>
        </div>

        {/* Metric 2 */}
        <div className="relative overflow-hidden rounded-2xl border border-zinc-200/90 dark:border-zinc-800/90 bg-gradient-to-br from-white via-zinc-50/50 to-zinc-100/40 dark:from-zinc-900/90 dark:via-zinc-900/50 dark:to-zinc-950 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/60 dark:border-emerald-800/50 shadow-2xs">
                <Users className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
                Turnout Tally
              </span>
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="mt-3 mb-1.5 flex items-baseline gap-1.5">
            <Skeleton className="h-8 w-20 rounded-md" />
            <span className="text-xs font-mono text-zinc-400">/ Total Enrolled</span>
          </div>
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] font-mono text-zinc-400">
            Total Practical Attendance
          </div>
        </div>

        {/* Metric 3 */}
        <div className="relative overflow-hidden rounded-2xl border border-zinc-200/90 dark:border-zinc-800/90 bg-gradient-to-br from-white via-zinc-50/50 to-zinc-100/40 dark:from-zinc-900/90 dark:via-zinc-900/50 dark:to-zinc-950 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200/60 dark:border-amber-800/50 shadow-2xs">
                <TrendingUp className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
                Active Labs
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/50 font-bold">
              5 Facilities
            </span>
          </div>
          <div className="mt-3 mb-1.5 flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold font-mono tracking-tight text-zinc-950 dark:text-white">
              5
            </span>
            <span className="text-xs font-medium text-zinc-400">Laboratories</span>
          </div>
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] font-mono text-zinc-400">
            Physics, Chem, Bio, Comp & Elec
          </div>
        </div>

        {/* Metric 4 */}
        <div className="relative overflow-hidden rounded-2xl border border-zinc-200/90 dark:border-zinc-800/90 bg-gradient-to-br from-white via-zinc-50/50 to-zinc-100/40 dark:from-zinc-900/90 dark:via-zinc-900/50 dark:to-zinc-950 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center border border-cyan-200/60 dark:border-cyan-800/50 shadow-2xs">
                <Sparkles className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
                Data Stream
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200/60 dark:border-cyan-800/50 font-bold">
              Real-Time
            </span>
          </div>
          <div className="mt-3 mb-1.5 flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold font-mono tracking-tight text-cyan-600 dark:text-cyan-400">
              100%
            </span>
            <span className="text-xs font-medium text-zinc-400">Online Sync</span>
          </div>
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] font-mono text-zinc-400">
            Zero Local Log Divergence
          </div>
        </div>
      </div>

      {/* 2. HEADER ACTION & SEARCH TOOLBAR (Exact duplicate) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-zinc-900/80 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs backdrop-blur-md">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 min-w-[280px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-3.5 w-3.5 text-zinc-400" />
            </div>
            <div className="pl-8.5 h-8 text-xs font-sans rounded-md border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 flex items-center text-zinc-400">
              Search by experiment, subject, or batch...
            </div>
          </div>

          {/* Quick Lab Filter Links */}
          <div className="hidden md:flex items-center gap-1 p-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs font-mono">
            <span className="px-2.5 py-1 rounded-md bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white font-bold shadow-2xs">
              All Labs
            </span>
            <span className="px-2.5 py-1 text-zinc-400">Computer</span>
            <span className="px-2.5 py-1 text-zinc-400">Physics</span>
            <span className="px-2.5 py-1 text-zinc-400">Chemistry</span>
            <span className="px-2.5 py-1 text-zinc-400">Biology</span>
          </div>
        </div>

        <div className="h-8 px-3 rounded-lg bg-indigo-600/80 text-white flex items-center gap-1.5 text-xs font-semibold shadow-xs">
          <Plus className="h-3.5 w-3.5" />
          <span>New Practical Entry</span>
        </div>
      </div>

      {/* 3. MAIN LOGS AUDIT TABLE CARD (Exact duplicate) */}
      <Card className="border border-zinc-200/80 dark:border-zinc-800 shadow-2xs overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/40 text-xs font-mono text-zinc-500">
          <span>Official Practical Session Log Database</span>
          <Skeleton className="h-4 w-24 rounded" />
        </div>

        {/* Table Header Columns */}
        <div className="grid grid-cols-12 px-5 py-3 border-b border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50/70 dark:bg-zinc-900/70 text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400">
          <div className="col-span-2">Date // Slot</div>
          <div className="col-span-3">Class & Subject</div>
          <div className="col-span-3">Experiment / Topic</div>
          <div className="col-span-2">Attendance</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-1 text-right">Action</div>
        </div>

        {/* Table Rows Shimmer */}
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
          {[1, 2, 3, 4, 5, 6].map((row) => (
            <div key={row} className="grid grid-cols-12 px-5 py-4 items-center">
              {/* Col 1: Date & Time */}
              <div className="col-span-2 space-y-1">
                <Skeleton className="h-4 w-24 rounded" />
                <Skeleton className="h-3 w-28 rounded" />
              </div>

              {/* Col 2: Class & Subject */}
              <div className="col-span-3 space-y-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-12 rounded" />
                  <Skeleton className="h-4 w-32 rounded" />
                </div>
                <Skeleton className="h-3 w-36 rounded" />
              </div>

              {/* Col 3: Experiment Title */}
              <div className="col-span-3 space-y-1">
                <Skeleton className="h-4 w-48 rounded" />
                <Skeleton className="h-3 w-32 rounded" />
              </div>

              {/* Col 4: Attendance */}
              <div className="col-span-2 space-y-1">
                <Skeleton className="h-4 w-20 rounded" />
                <Skeleton className="h-2.5 w-16 rounded" />
              </div>

              {/* Col 5: Status */}
              <div className="col-span-1">
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>

              {/* Col 6: Actions */}
              <div className="col-span-1 flex justify-end gap-1">
                <Skeleton className="h-7 w-7 rounded-md" />
                <Skeleton className="h-7 w-7 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
