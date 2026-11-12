'use client'

import React, { useState, useEffect } from 'react'
import { Calendar, Clock, ChevronDown } from 'lucide-react'
import { useLiveSchedule } from '@/hooks/use-live-schedule'
import { toNepaliDigits } from '@/lib/nepali-date'
import AcademicCalendarModal from '@/components/calendar/academic-calendar-modal'

export default function LiveClockHeader() {
  const { mounted, timeString, nepaliDate, activePeriodName, activeSlotId } = useLiveSchedule()
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [localTime, setLocalTime] = useState<string>('')

  useEffect(() => {
    const updateLocalClock = () => {
      setLocalTime(
        new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      )
    }
    updateLocalClock()
    const interval = setInterval(updateLocalClock, 1000)
    return () => clearInterval(interval)
  }, [])

  if (!mounted) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-8 w-28 sm:w-48 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
      </div>
    )
  }

  // Base Bikram Sambat date string: e.g. "२०८३ कात्तिक २६"
  const baseBsDate = `${toNepaliDigits(nepaliDate.bsYear)} ${nepaliDate.bsMonthNameNp} ${toNepaliDigits(nepaliDate.bsDay)}`

  return (
    <>
      <div className="flex items-center gap-2 select-none shrink-0 whitespace-nowrap">
        {/* Live Active Period Beacon — hidden on mobile (< 768px), visible on md:inline-flex */}
        {activeSlotId ? (
          <span className="hidden md:inline-flex items-center gap-2 h-9 px-2.5 sm:px-3 rounded-xl text-xs font-heading font-extrabold tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 shadow-2xs shrink-0 whitespace-nowrap">
            <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/30 animate-pulse shrink-0" />
            <span>{activePeriodName.toUpperCase()}</span>
          </span>
        ) : (
          <span className="hidden md:inline-flex items-center gap-2 h-9 px-2.5 sm:px-3 rounded-xl text-xs font-heading font-bold tracking-wide text-zinc-800 dark:text-zinc-200 bg-zinc-100/90 dark:bg-zinc-800/80 shadow-2xs shrink-0 whitespace-nowrap">
            <span className="h-2 w-2 rounded-full bg-zinc-400 dark:bg-zinc-500 shrink-0" />
            <span>BREAK</span>
            <span className="hidden lg:inline">&nbsp;/ OFF-HOURS</span>
          </span>
        )}

        {/* Nepali Calendar BS & English Date Interactive Display (Zero overflow-hidden, zero chopping) */}
        <button
          type="button"
          onClick={() => setIsCalendarOpen(true)}
          className="h-9 flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3 rounded-xl bg-zinc-100/90 dark:bg-zinc-800/80 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/70 shadow-2xs text-xs font-sans transition-all cursor-pointer group text-left shrink-0 whitespace-nowrap"
          title="Click to view Academic Calendar & National Holidays"
        >
          <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
            <Calendar className="h-4 w-4 text-amber-500 dark:text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
            {/* Always show Bikram Sambat date */}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-amber-600 dark:group-hover:text-amber-300 transition-colors whitespace-nowrap">
              {baseBsDate}
              {/* Show weekday on 2xl screens (>= 1536px) */}
              <span className="hidden 2xl:inline">, {nepaliDate.dayNameNp}</span>
            </span>
            {/* Show English date on 2xl screens (>= 1536px) */}
            <span className="text-xs font-sans font-medium text-zinc-500 dark:text-zinc-400 hidden 2xl:inline shrink-0 whitespace-nowrap">
              ({nepaliDate.englishDate})
            </span>
            <ChevronDown className="h-3 w-3 text-zinc-400 group-hover:text-amber-500 transition-colors shrink-0" />
          </div>

          {/* Divider between Date and Clock: visible on lg:flex (>= 1024px) */}
          <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700 hidden lg:block shrink-0" />

          {/* Live Clock with Bold Tabular Numbers — visible on lg:inline-flex (>= 1024px) */}
          <div className="hidden lg:flex items-center gap-1.5 text-zinc-900 dark:text-zinc-100 font-mono tabular-nums font-bold text-xs sm:text-[13px] whitespace-nowrap shrink-0">
            <Clock className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
            <span className="whitespace-nowrap">{localTime || timeString}</span>
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
