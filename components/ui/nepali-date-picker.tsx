'use client'

import React, { useState, useEffect, useMemo } from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react'
import {
  getBsMonthCalendar,
  BsCalendarDay,
  NEPALI_MONTHS_EN,
  NEPALI_MONTHS_NP,
  toNepaliDigits,
  getNepaliDate,
  getNepalDateStr,
} from '@/lib/nepali-date'

export interface NepaliDatePickerProps {
  value?: string // YYYY-MM-DD (ISO / Gregorian standard for database)
  onChange: (dateStr: string, dayInfo?: BsCalendarDay) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  align?: 'start' | 'center' | 'end' | 'left' | 'right'
}

export function NepaliDatePicker({
  value,
  onChange,
  placeholder = 'मिति छान्नुहोस् / Select Nepali Date',
  disabled = false,
  className = '',
  align = 'start',
}: NepaliDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Determine initial BS Year & Month from value or today
  const todayInfo = useMemo(() => getNepaliDate(new Date()), [])
  const todayDateStr = useMemo(() => getNepalDateStr(new Date()), [])

  const selectedDayInfo = useMemo(() => {
    if (!value) return null
    try {
      const d = new Date(value)
      if (isNaN(d.getTime())) return null
      return getNepaliDate(d)
    } catch {
      return null
    }
  }, [value])

  const [currentBsYear, setCurrentBsYear] = useState<number>(
    selectedDayInfo ? selectedDayInfo.bsYear : todayInfo.bsYear || 2083
  )
  const [currentBsMonth, setCurrentBsMonth] = useState<number>(
    selectedDayInfo ? selectedDayInfo.bsMonth : todayInfo.bsMonth || 1
  )

  // Sync internal month view when value changes
  useEffect(() => {
    if (selectedDayInfo) {
      setCurrentBsYear(selectedDayInfo.bsYear)
      setCurrentBsMonth(selectedDayInfo.bsMonth)
    }
  }, [selectedDayInfo])

  // Get month data
  const monthData = useMemo(() => {
    return getBsMonthCalendar(currentBsYear, currentBsMonth)
  }, [currentBsYear, currentBsMonth])

  // Navigation
  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (currentBsMonth === 1) {
      setCurrentBsYear((y) => y - 1)
      setCurrentBsMonth(12)
    } else {
      setCurrentBsMonth((m) => m - 1)
    }
  }

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (currentBsMonth === 12) {
      setCurrentBsYear((y) => y + 1)
      setCurrentBsMonth(1)
    } else {
      setCurrentBsMonth((m) => m + 1)
    }
  }

  const handleJumpToToday = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentBsYear(todayInfo.bsYear)
    setCurrentBsMonth(todayInfo.bsMonth)
    onChange(todayDateStr)
    setIsOpen(false)
  }

  const handleDaySelect = (day: BsCalendarDay) => {
    onChange(day.dateStr, day)
    setIsOpen(false)
  }

  // Display label: Option C + Option A: "२०८४ बैशाख १ गते (14 Apr 2027)"
  const displayLabel = useMemo(() => {
    if (!selectedDayInfo) return null
    return `${selectedDayInfo.formattedDateNp} (${selectedDayInfo.englishDate})`
  }, [selectedDayInfo])

  const dayHeaders = [
    { en: 'Sun', np: 'आइत' },
    { en: 'Mon', np: 'सोम' },
    { en: 'Tue', np: 'मंग' },
    { en: 'Wed', np: 'बुध' },
    { en: 'Thu', np: 'बिही' },
    { en: 'Fri', np: 'शुक्र' },
    { en: 'Sat', np: 'शनि' },
  ]

  const availableYears = [2078, 2079, 2080, 2081, 2082, 2083, 2084, 2085, 2086, 2087, 2088, 2089, 2090]

  return (
    <PopoverPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
      <div className={`relative inline-block w-full ${className}`}>
        {/* Trigger Button / Input Display */}
        <PopoverPrimitive.Trigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={`w-full px-3 py-2 text-left text-xs rounded-xl border transition-all flex items-center justify-between gap-2 cursor-pointer ${
              isOpen
                ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-white dark:bg-[#151E32]'
                : 'border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-[#151E32] hover:border-zinc-300 dark:hover:border-white/[0.15]'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center gap-2 truncate">
              <CalendarIcon className="h-4 w-4 text-indigo-500 shrink-0" />
              {displayLabel ? (
                <span className="font-semibold text-zinc-900 dark:text-white truncate">
                  {displayLabel}
                </span>
              ) : (
                <span className="text-slate-400 font-normal">{placeholder}</span>
              )}
            </div>

            {value && !disabled && (
              <span
                onClick={(e) => {
                  e.stopPropagation()
                  onChange('')
                }}
                className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-white/[0.1] text-slate-400 hover:text-rose-500 transition cursor-pointer"
                title="Clear date"
              >
                <X className="h-3 w-3" />
              </span>
            )}
          </button>
        </PopoverPrimitive.Trigger>

        {/* Portal-Rendered Dropdown Calendar (Zero Clipping, Always on Top) */}
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align={align === 'right' || align === 'end' ? 'end' : align === 'center' ? 'center' : 'start'}
            sideOffset={6}
            collisionPadding={12}
            className="z-[9999] w-[320px] sm:w-[340px] bg-white dark:bg-[#101726] border border-zinc-200 dark:border-white/[0.12] rounded-2xl shadow-2xl p-3 animate-in fade-in zoom-in-95 duration-150 text-zinc-900 dark:text-zinc-100"
          >
            {/* Header Controls: Year, Month, Arrows */}
            <div className="flex items-center justify-between gap-1 pb-2.5 mb-2.5 border-b border-zinc-100 dark:border-white/[0.06]">
              {/* Year & Month Selectors */}
              <div className="flex items-center gap-1.5">
                <select
                  value={currentBsYear}
                  onChange={(e) => setCurrentBsYear(parseInt(e.target.value, 10))}
                  className="text-xs font-bold font-mono bg-zinc-100 dark:bg-[#151E32] text-zinc-900 dark:text-white rounded-lg px-2 py-1 border border-zinc-200 dark:border-white/[0.08] focus:outline-none cursor-pointer"
                >
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr} className="bg-white dark:bg-[#101726]">
                      {yr} B.S. ({toNepaliDigits(yr)})
                    </option>
                  ))}
                </select>

                <select
                  value={currentBsMonth}
                  onChange={(e) => setCurrentBsMonth(parseInt(e.target.value, 10))}
                  className="text-xs font-bold bg-zinc-100 dark:bg-[#151E32] text-zinc-900 dark:text-white rounded-lg px-2 py-1 border border-zinc-200 dark:border-white/[0.08] focus:outline-none cursor-pointer max-w-[130px]"
                >
                  {NEPALI_MONTHS_EN.map((name, idx) => (
                    <option key={name} value={idx + 1} className="bg-white dark:bg-[#101726]">
                      {idx + 1}. {NEPALI_MONTHS_NP[idx]} ({name})
                    </option>
                  ))}
                </select>
              </div>

              {/* Prev / Today / Next buttons */}
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/[0.06] text-slate-500 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer"
                  title="अघिल्लो महिना (Prev Month)"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={handleJumpToToday}
                  className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition cursor-pointer"
                  title="आजको मिति (Today)"
                >
                  आज
                </button>

                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/[0.06] text-slate-500 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer"
                  title="पछिल्लो महिना (Next Month)"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 text-center mb-1 font-mono">
              {dayHeaders.map((dh, idx) => {
                const isWeekend = idx === 0 || idx === 6
                return (
                  <div
                    key={dh.en}
                    className={`py-1 text-[11px] font-bold ${
                      isWeekend ? 'text-amber-500 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <div>{dh.np}</div>
                    <div className="text-[9px] opacity-70 font-normal">{dh.en}</div>
                  </div>
                )
              })}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Empty padding before day 1 */}
              {Array.from({ length: monthData.startDayOfWeek }).map((_, idx) => (
                <div key={`empty-${idx}`} className="h-9 opacity-0 pointer-events-none" />
              ))}

              {/* Actual BS days */}
              {monthData.days.map((day) => {
                const isSelected = value === day.dateStr
                const isToday = day.dateStr === todayDateStr
                const isSaturday = day.dayOfWeek === 6
                const isSunday = day.dayOfWeek === 0

                return (
                  <button
                    key={day.dateStr}
                    type="button"
                    onClick={() => handleDaySelect(day)}
                    className={`h-9 rounded-xl p-0.5 flex flex-col items-center justify-between text-center transition-all cursor-pointer relative ${
                      isSelected
                        ? 'bg-indigo-600 text-white font-extrabold shadow-md shadow-indigo-600/30'
                        : isToday
                        ? 'border border-indigo-500/60 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-bold'
                        : isSaturday
                        ? 'bg-amber-500/5 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        : isSunday
                        ? 'hover:bg-zinc-100 dark:hover:bg-white/[0.06] text-zinc-900 dark:text-zinc-100'
                        : 'hover:bg-zinc-100 dark:hover:bg-white/[0.06] text-zinc-900 dark:text-zinc-100'
                    }`}
                  >
                    {/* Top: Large Devanagari Day */}
                    <span className="text-xs font-bold leading-none font-heading mt-0.5">
                      {day.bsDayNp}
                    </span>

                    {/* Bottom: Gregorian Micro Date (e.g. 14 Apr) */}
                    <span
                      className={`text-[8px] font-mono leading-none mb-0.5 ${
                        isSelected ? 'text-white/80' : 'text-slate-400'
                      }`}
                    >
                      {day.adDayString}
                    </span>

                    {/* Micro Today / Off Badges */}
                    {isToday && !isSelected && (
                      <span className="absolute top-0.5 right-0.5 text-[7px] font-extrabold text-indigo-500 leading-none">
                        आज
                      </span>
                    )}
                    {isSaturday && !isSelected && !isToday && (
                      <span className="absolute top-0.5 right-0.5 text-[6px] font-bold text-amber-500 leading-none">
                        Off
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Quick Footer */}
            <div className="pt-2 mt-2 border-t border-zinc-100 dark:border-white/[0.06] flex items-center justify-between text-[11px] text-slate-400">
              <span>
                {monthData.monthNameNp} {toNepaliDigits(currentBsYear)} ({monthData.daysInMonth} दिन)
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-2 py-0.5 rounded text-xs font-bold hover:bg-zinc-100 dark:hover:bg-white/[0.06] text-slate-500 hover:text-zinc-900 dark:hover:text-white transition"
              >
                बन्द गर्नुहोस् (Close)
              </button>
            </div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </div>
    </PopoverPrimitive.Root>
  )
}
