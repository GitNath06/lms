import React from 'react'
import { Calendar, Printer, Plus, Coffee, CalendarDays } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

const TIME_SLOTS = [
  { id: 't1', name: 'Pre', label: '09:15 - 10:10' },
  { id: 't2', name: 'P1', label: '10:10 - 11:00' },
  { id: 't3', name: 'P2', label: '11:00 - 11:45' },
  { id: 't4', name: 'P3', label: '11:45 - 12:30' },
  { id: 't5', name: 'P4', label: '12:30 - 01:15' },
  { id: 't6', name: 'Recess', label: '01:15 - 01:45', isBreak: true },
  { id: 't7', name: 'P5', label: '01:45 - 02:30' },
  { id: 't8', name: 'P6', label: '02:30 - 03:15' },
  { id: 't9', name: 'P7', label: '03:15 - 04:05' },
  { id: 't10', name: 'P8', label: '04:05 - 04:50' },
]

const DAYS = [
  { id: 'sun', name: 'Sunday', np: 'आइतबार', dateNp: 'भाद्र १५', dateEn: 'Aug 31', isToday: true, count: 4 },
  { id: 'mon', name: 'Monday', np: 'सोमबार', dateNp: 'भाद्र १६', dateEn: 'Sep 01', isToday: false, count: 5 },
  { id: 'tue', name: 'Tuesday', np: 'मङ्गलबार', dateNp: 'भाद्र १७', dateEn: 'Sep 02', isToday: false, count: 3 },
  { id: 'wed', name: 'Wednesday', np: 'बुधबार', dateNp: 'भाद्र १८', dateEn: 'Sep 03', isToday: false, count: 4 },
  { id: 'thu', name: 'Thursday', np: 'बिहीबार', dateNp: 'भाद्र १९', dateEn: 'Sep 04', isToday: false, count: 4 },
  { id: 'fri', name: 'Friday', np: 'शुक्रबार', dateNp: 'भाद्र २०', dateEn: 'Sep 05', isToday: false, count: 3 },
]

export default function SchedulesLoading() {
  return (
    <div className="flex flex-col h-[calc(100vh-84px)] -m-4 md:-m-6 p-3 md:p-4 space-y-3 select-none overflow-hidden animate-in fade-in duration-200">
      {/* 1. Sleek Single-Line Command Toolbar (Matches page.tsx exactly) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white/90 dark:bg-zinc-900/90 p-3 px-4 rounded-xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs backdrop-blur-md shrink-0">
        {/* Left: Title & Session Tag */}
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/60 dark:border-indigo-800/50 shadow-2xs">
            <Calendar className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-tight text-zinc-950 dark:text-white font-mono">
                Laboratory Timetable Matrix
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                Session 2083
              </span>
            </div>
          </div>
        </div>

        {/* Center: Segmented Lab Switcher Skeleton */}
        <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-lg text-xs font-mono border border-zinc-200/60 dark:border-zinc-700/60">
          <span className="px-3 py-1 rounded-md bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-xs font-bold">
            All Labs
          </span>
          <span className="px-3 py-1 rounded-md text-zinc-400 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-indigo-500/50" />
            <span>Computer Lab</span>
          </span>
          <span className="px-3 py-1 rounded-md text-zinc-400 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-cyan-500/50" />
            <span>Physics Lab</span>
          </span>
          <span className="px-3 py-1 rounded-md text-zinc-400 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-500/50" />
            <span>Chemistry Lab</span>
          </span>
          <span className="px-3 py-1 rounded-md text-zinc-400 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500/50" />
            <span>Biology Lab</span>
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <div className="h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 flex items-center gap-1.5 text-xs font-mono font-semibold text-zinc-400 bg-white/50 dark:bg-zinc-900/50">
            <Printer className="h-3.5 w-3.5 text-zinc-400" />
            <span>Print Routine</span>
          </div>
          <div className="h-8 px-3 rounded-lg bg-indigo-600/80 text-white flex items-center gap-1.5 text-xs font-mono font-semibold shadow-xs">
            <Plus className="h-3.5 w-3.5" />
            <span>+ Book Slot</span>
          </div>
        </div>
      </div>

      {/* 2. Main Expansive Calendar Canvas (Matches advanced-calendar.tsx exactly) */}
      <div className="flex-1 w-full overflow-hidden min-h-0 bg-white/95 dark:bg-zinc-950/95 border border-zinc-200/90 dark:border-zinc-800/90 rounded-2xl shadow-sm relative flex flex-col backdrop-blur-xl">
        <div className="flex-1 overflow-auto relative z-10">
          <div className="min-w-[1280px] flex flex-col h-full">
            {/* Top Axis: Time Slots Header */}
            <div className="flex border-b border-zinc-200/90 dark:border-zinc-800/90 bg-zinc-50/95 dark:bg-zinc-900/95 sticky top-0 z-30 backdrop-blur-md">
              {/* Sticky Corner Axis Label */}
              <div className="w-48 shrink-0 border-r border-zinc-200/90 dark:border-zinc-800/90 p-3.5 flex items-center justify-between text-xs font-mono font-extrabold text-zinc-700 dark:text-zinc-200 uppercase tracking-wider sticky left-0 z-40 bg-zinc-50 dark:bg-zinc-900 shadow-xs">
                <span className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-indigo-500" />
                  DAY // 2083
                </span>
                <Skeleton className="h-4 w-4 rounded" />
              </div>

              {/* 10 Period Columns Header */}
              <div className="flex-1 grid grid-cols-10 divide-x divide-zinc-200/80 dark:divide-zinc-800/80">
                {TIME_SLOTS.map((slot) => (
                  <div
                    key={slot.id}
                    className={`p-3 px-2 text-center font-mono flex flex-col justify-center ${
                      slot.isBreak ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span
                        className={`text-xs font-extrabold tracking-tight ${
                          slot.isBreak ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-950 dark:text-white'
                        }`}
                      >
                        {slot.name}
                      </span>
                    </div>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 font-bold">
                      {slot.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 6 Day Rows with Real Shimmering Session Cards */}
            <div className="flex-1 flex flex-col divide-y divide-zinc-200/80 dark:divide-zinc-800/80">
              {DAYS.map((day, dIdx) => (
                <div
                  key={day.id}
                  className={`flex min-h-[120px] transition-colors relative ${
                    day.isToday ? 'bg-emerald-500/5 dark:bg-emerald-950/10' : ''
                  }`}
                >
                  {/* Left Sticky Day Column (w-48) */}
                  <div
                    className={`w-48 shrink-0 border-r p-4 flex flex-col justify-between sticky left-0 z-20 shadow-xs ${
                      day.isToday
                        ? 'border-l-4 border-l-emerald-500 bg-emerald-50/90 dark:bg-zinc-900/95 border-r-emerald-500/40'
                        : 'border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/90 dark:bg-zinc-950/90'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-extrabold text-zinc-950 dark:text-white">
                          {day.name}
                        </h4>
                        {day.isToday && (
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                        )}
                      </div>
                      <div className="text-xs font-mono font-bold mt-0.5 text-zinc-500 dark:text-zinc-400">
                        {day.np}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-mono mt-1.5 font-bold">
                        <span className="text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-200/60 dark:border-amber-800/60">
                          {day.dateNp}
                        </span>
                        <span className="text-zinc-400">•</span>
                        <span className="text-zinc-600 dark:text-zinc-300">{day.dateEn}</span>
                      </div>
                    </div>

                    <div className="mt-2">
                      {day.isToday ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-emerald-500/25 text-emerald-900 dark:text-emerald-200 border border-emerald-500/80">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          TODAY
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono font-semibold text-zinc-500 dark:text-zinc-400">
                          {day.count} Sessions
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 10-Column Multi-Track Grid with Shimmer Cards */}
                  <div
                    className="flex-1 grid grid-cols-10 divide-x divide-zinc-200/80 dark:divide-zinc-800/60 relative p-1.5 gap-1.5"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(10, minmax(0, 1fr))',
                    }}
                  >
                    {/* Shimmering Session Cards matching actual layout */}
                    {dIdx % 2 === 0 ? (
                      <>
                        {/* Slot 2-3: 2P Multi-period Card */}
                        <div
                          style={{ gridColumn: '2 / span 2' }}
                          className="p-3 rounded-xl border-l-4 border-l-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/40 shadow-xs flex flex-col justify-between"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Skeleton className="h-4 w-20 rounded bg-indigo-200/70 dark:bg-indigo-800/50" />
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                                2P
                              </span>
                            </div>
                            <Skeleton className="h-3.5 w-full rounded bg-indigo-200/50 dark:bg-indigo-800/30" />
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-indigo-100/80 dark:border-indigo-900/40">
                            <Skeleton className="h-2.5 w-24 bg-indigo-200/60 dark:bg-indigo-800/40" />
                            <span className="text-[10px] font-mono text-indigo-600/70 dark:text-indigo-400/70 font-semibold">
                              10:10 - 11:45
                            </span>
                          </div>
                        </div>

                        {/* Slot 4: 1P Single Card */}
                        <div
                          style={{ gridColumn: '4 / span 1' }}
                          className="p-2.5 rounded-xl border-l-4 border-l-cyan-500 bg-cyan-50/60 dark:bg-cyan-950/30 border border-cyan-200/60 dark:border-cyan-800/40 shadow-xs flex flex-col justify-between"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <Skeleton className="h-3.5 w-16 bg-cyan-200/70 dark:bg-cyan-800/50" />
                              <span className="text-[9px] font-mono font-bold px-1 rounded bg-cyan-100 dark:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300">
                                1P
                              </span>
                            </div>
                            <Skeleton className="h-3 w-full bg-cyan-200/50 dark:bg-cyan-800/30" />
                          </div>
                          <Skeleton className="h-2 w-16 bg-cyan-200/60 dark:bg-cyan-800/40" />
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Slot 3-4: 2P Multi-period Card */}
                        <div
                          style={{ gridColumn: '3 / span 2' }}
                          className="p-3 rounded-xl border-l-4 border-l-rose-500 bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-800/40 shadow-xs flex flex-col justify-between"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Skeleton className="h-4 w-20 rounded bg-rose-200/70 dark:bg-rose-800/50" />
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300">
                                2P
                              </span>
                            </div>
                            <Skeleton className="h-3.5 w-full rounded bg-rose-200/50 dark:bg-rose-800/30" />
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-rose-100/80 dark:border-rose-900/40">
                            <Skeleton className="h-2.5 w-24 bg-rose-200/60 dark:bg-rose-800/40" />
                            <span className="text-[10px] font-mono text-rose-600/70 dark:text-rose-400/70 font-semibold">
                              11:00 - 12:30
                            </span>
                          </div>
                        </div>

                        {/* Slot 2: 1P Card */}
                        <div
                          style={{ gridColumn: '2 / span 1' }}
                          className="p-2.5 rounded-xl border-l-4 border-l-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 shadow-xs flex flex-col justify-between"
                        >
                          <div className="space-y-1">
                            <Skeleton className="h-3.5 w-16 bg-emerald-200/70 dark:bg-emerald-800/50" />
                            <Skeleton className="h-3 w-full bg-emerald-200/50 dark:bg-emerald-800/30" />
                          </div>
                          <Skeleton className="h-2 w-16 bg-emerald-200/60 dark:bg-emerald-800/40" />
                        </div>
                      </>
                    )}

                    {/* Recess Column (Slot 6) */}
                    <div
                      style={{ gridColumn: '6 / span 1' }}
                      className="flex flex-col items-center justify-center text-amber-600/70 dark:text-amber-400/70 font-mono text-[10px] font-bold bg-amber-50/30 dark:bg-amber-950/20 rounded-lg"
                    >
                      <Coffee className="h-3.5 w-3.5 mb-0.5 opacity-70" />
                      <span>RECESS</span>
                    </div>

                    {/* Afternoon Slot 7-8: 2P Multi-period Card */}
                    <div
                      style={{ gridColumn: '7 / span 2' }}
                      className="p-3 rounded-xl border-l-4 border-l-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/40 shadow-xs flex flex-col justify-between"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Skeleton className="h-4 w-20 rounded bg-indigo-200/70 dark:bg-indigo-800/50" />
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                            2P
                          </span>
                        </div>
                        <Skeleton className="h-3.5 w-full rounded bg-indigo-200/50 dark:bg-indigo-800/30" />
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-indigo-100/80 dark:border-indigo-900/40">
                        <Skeleton className="h-2.5 w-24 bg-indigo-200/60 dark:bg-indigo-800/40" />
                        <span className="text-[10px] font-mono text-indigo-600/70 dark:text-indigo-400/70 font-semibold">
                          01:45 - 03:15
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
