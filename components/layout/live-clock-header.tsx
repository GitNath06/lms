'use client'

import React, { useState } from 'react'
import { Calendar, Clock, ChevronDown } from 'lucide-react'
import { useLiveSchedule } from '@/hooks/use-live-schedule'
import AcademicCalendarModal from '@/components/calendar/academic-calendar-modal'

export default function LiveClockHeader() {
  const { mounted, timeString, nepaliDate, activePeriodName, activeSlotId } = useLiveSchedule()
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)

  if (!mounted) {
    return (
      <div className="flex items-center gap-3">
        <div className="h-8 w-48 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center gap-2.5 select-none">
        {/* Live Active Period Beacon */}
        {activeSlotId ? (
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-mono font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
            {activePeriodName.toUpperCase()}
          </span>
        ) : (
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-mono text-zinc-500 dark:text-zinc-400 bg-zinc-100/70 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
            RECESS / OFF-HOURS
          </span>
        )}

        {/* Nepali Calendar BS & English Date Interactive Display */}
        <button
          type="button"
          onClick={() => setIsCalendarOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-zinc-200/90 dark:border-zinc-800/90 bg-white/90 dark:bg-zinc-900/90 hover:border-amber-400/80 dark:hover:border-amber-600/80 hover:bg-amber-50/40 dark:hover:bg-amber-950/30 shadow-2xs text-xs font-sans transition-all cursor-pointer group text-left"
          title="Click to view Academic Calendar & National Holidays"
        >
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400 group-hover:scale-110 transition-transform" />
            <span className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors">
              {nepaliDate.formattedDateNp}
            </span>
            <span className="text-[10px] font-mono text-zinc-400 hidden md:inline">
              ({nepaliDate.englishDate})
            </span>
            <ChevronDown className="h-3 w-3 text-zinc-400 group-hover:text-amber-500 transition-colors ml-0.5" />
          </div>

          <div className="h-3.5 w-px bg-zinc-200 dark:bg-zinc-800 hidden sm:block" />

          {/* Live Clock with Tabular Numbers */}
          <div className="flex items-center gap-1.5 text-zinc-800 dark:text-zinc-200 font-mono tabular-nums font-bold">
            <Clock className="h-3.5 w-3.5 text-zinc-400 dark:text-slate-400" />
            <span>{timeString}</span>
          </div>
        </button>
      </div>

      {/* Academic Calendar Modal */}
      <AcademicCalendarModal
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
      />
    </>
  )
}
