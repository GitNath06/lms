'use client'

import React, { useState, useMemo } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Palmtree,
  Sparkles,
  Trash2,
  Check,
  X,
  AlertCircle,
  Plus,
  RotateCcw,
  Search,
  ExternalLink,
  ShieldCheck,
  Ban,
  BookOpen
} from 'lucide-react'
import {
  getBsMonthCalendar,
  BsCalendarDay,
  NEPALI_MONTHS_EN,
  NEPALI_MONTHS_NP,
  toNepaliDigits,
  getNepaliDate,
  getNepalDateStr
} from '@/lib/nepali-date'
import { HolidayItem, isDateWithinHoliday } from '@/lib/master-data'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

interface DualCalendarPickerProps {
  holidays: HolidayItem[]
  onAddHoliday: (holiday: HolidayItem) => void
  onDeleteHoliday: (id: string) => void
  onResetHolidays?: () => void
  sundayWeekend: boolean
  saturdayWeekend?: boolean
  isEditModeUnlocked: boolean
}

export default function DualCalendarPicker({
  holidays,
  onAddHoliday,
  onDeleteHoliday,
  onResetHolidays,
  sundayWeekend,
  saturdayWeekend = true,
  isEditModeUnlocked,
}: DualCalendarPickerProps) {
  // Determine current BS year from today's date
  const todayInfo = useMemo(() => getNepaliDate(new Date()), [])
  const [currentBsYear, setCurrentBsYear] = useState<number>(todayInfo.bsYear || 2081)
  const [currentBsMonth, setCurrentBsMonth] = useState<number>(todayInfo.bsMonth || 5)

  // Selection Range State for interactive marking
  const [rangeStart, setRangeStart] = useState<BsCalendarDay | null>(null)
  const [rangeEnd, setRangeEnd] = useState<BsCalendarDay | null>(null)

  // Form State for new holiday
  const [holidayTitle, setHolidayTitle] = useState('')
  const [holidayType, setHolidayType] = useState<'cultural' | 'state' | 'department' | 'vacation'>('cultural')
  const [selectedExistingHoliday, setSelectedExistingHoliday] = useState<HolidayItem | null>(null)
  const [directorySearch, setDirectorySearch] = useState('')
  const [directoryFilter, setDirectoryFilter] = useState<'all' | 'cultural' | 'state' | 'vacation'>('all')

  // Calendar Days for current month
  const monthData = useMemo(() => {
    return getBsMonthCalendar(currentBsYear, currentBsMonth)
  }, [currentBsYear, currentBsMonth])

  // Filter holidays belonging to the currently selected BS Year (Deduplicated by ID)
  const yearHolidays = useMemo(() => {
    const npYearStr = toNepaliDigits(currentBsYear)
    const enYearStr = currentBsYear.toString()
    const seenIds = new Set<string>()

    return holidays
      .filter((h) => {
        if (!h || !h.id || seenIds.has(h.id)) return false
        seenIds.add(h.id)

        if (h.bsDateStr) {
          if (h.bsDateStr.includes(npYearStr) || h.bsDateStr.includes(enYearStr)) {
            return true
          }
        }
        try {
          const np = getNepaliDate(new Date(h.dateStr))
          return np.bsYear === currentBsYear
        } catch (e) {
          return false
        }
      })
      .sort((a, b) => a.dateStr.localeCompare(b.dateStr))
  }, [holidays, currentBsYear])

  // Directory filtered list
  const filteredDirectoryHolidays = useMemo(() => {
    return yearHolidays.filter((h) => {
      const matchSearch =
        directorySearch === '' ||
        (h.title && h.title.toLowerCase().includes(directorySearch.toLowerCase())) ||
        (h.titleNp && h.titleNp.includes(directorySearch)) ||
        (h.bsDateStr && h.bsDateStr.includes(directorySearch))

      const matchFilter = directoryFilter === 'all' || h.type === directoryFilter
      return matchSearch && matchFilter
    })
  }, [yearHolidays, directorySearch, directoryFilter])

  // Month navigation
  const handlePrevMonth = () => {
    if (currentBsMonth === 1) {
      setCurrentBsYear((y) => y - 1)
      setCurrentBsMonth(12)
    } else {
      setCurrentBsMonth((m) => m - 1)
    }
    setRangeStart(null)
    setRangeEnd(null)
  }

  const handleNextMonth = () => {
    if (currentBsMonth === 12) {
      setCurrentBsYear((y) => y + 1)
      setCurrentBsMonth(1)
    } else {
      setCurrentBsMonth((m) => m + 1)
    }
    setRangeStart(null)
    setRangeEnd(null)
  }

  const handleJumpToToday = () => {
    setCurrentBsYear(todayInfo.bsYear)
    setCurrentBsMonth(todayInfo.bsMonth)
    setRangeStart(null)
    setRangeEnd(null)
  }

  const handleJumpToHolidayMonth = (h: HolidayItem) => {
    try {
      const np = getNepaliDate(new Date(h.dateStr))
      setCurrentBsYear(np.bsYear)
      setCurrentBsMonth(np.bsMonth)
      setSelectedExistingHoliday(h)
    } catch (e) {}
  }

  // Handle clicking a day on the calendar
  const handleDayClick = (day: BsCalendarDay) => {
    const existing = holidays.find((h) => isDateWithinHoliday(day.dateStr, h))
    if (existing) {
      setSelectedExistingHoliday(existing)
      return
    }
    setSelectedExistingHoliday(null)

    if (!rangeStart) {
      setRangeStart(day)
      setRangeEnd(null)
    } else if (!rangeEnd) {
      if (day.dateStr < rangeStart.dateStr) {
        setRangeEnd(rangeStart)
        setRangeStart(day)
      } else {
        setRangeEnd(day)
      }
    } else {
      setRangeStart(day)
      setRangeEnd(null)
    }
  }

  // Check if a day is within current selection
  const isDaySelected = (day: BsCalendarDay) => {
    if (rangeStart && !rangeEnd) {
      return day.dateStr === rangeStart.dateStr
    }
    if (rangeStart && rangeEnd) {
      return day.dateStr >= rangeStart.dateStr && day.dateStr <= rangeEnd.dateStr
    }
    return false
  }

  // Save new holiday from selection
  const handleSaveSelectedRecess = () => {
    if (!rangeStart) return
    if (!holidayTitle.trim()) return

    const effectiveEnd = rangeEnd || rangeStart
    const isMultiDay = effectiveEnd.dateStr !== rangeStart.dateStr

    const bsDateRangeString = isMultiDay
      ? `${toNepaliDigits(rangeStart.bsYear)} ${rangeStart.monthNameNp} ${rangeStart.bsDayNp} - ${effectiveEnd.monthNameNp} ${effectiveEnd.bsDayNp}`
      : `${toNepaliDigits(rangeStart.bsYear)} ${rangeStart.monthNameNp} ${rangeStart.bsDayNp}`

    const newHol: HolidayItem = {
      id: `hol-${Date.now()}`,
      title: holidayTitle.trim(),
      name: holidayTitle.trim(),
      titleNp: holidayTitle.trim(),
      dateStr: rangeStart.dateStr,
      endDateStr: effectiveEnd.dateStr,
      bsDateStr: bsDateRangeString,
      type: isMultiDay ? 'vacation' : holidayType,
      description: `Institutional recess marked via Dual Calendar Picker (${isMultiDay ? 'Multi-Day Vacation' : 'Single Day'})`,
    }

    onAddHoliday(newHol)
    setRangeStart(null)
    setRangeEnd(null)
    setHolidayTitle('')
  }

  // English month span label
  const firstDay = monthData.days[0]
  const lastDay = monthData.days[monthData.days.length - 1]
  const englishSpan = firstDay && lastDay
    ? `${firstDay.adDayString}, ${firstDay.adDate.getFullYear()} — ${lastDay.adDayString}, ${lastDay.adDate.getFullYear()}`
    : ''

  const dayHeaders = [
    { en: 'Sun', np: 'आइत' },
    { en: 'Mon', np: 'सोम' },
    { en: 'Tue', np: 'मंग' },
    { en: 'Wed', np: 'बुध' },
    { en: 'Thu', np: 'बिही' },
    { en: 'Fri', np: 'शुक्र' },
    { en: 'Sat', np: 'शनि' },
  ]

  const todayDateStr = getNepalDateStr(new Date())

  return (
    <div className="space-y-6">
      {/* TODAY STATUS BANNER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200 font-mono text-xs shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600 dark:bg-emerald-400"></span>
          </span>
          <span className="font-semibold">
            आजको आधिकारिक मिति (Today in Nepal):
          </span>
          <span className="font-bold underline decoration-emerald-500/50">
            {todayInfo.formattedDateNp}
          </span>
          <span className="text-emerald-700 dark:text-emerald-300 opacity-85">
            • {todayInfo.englishDate} (A.D.)
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="font-mono text-[10px] bg-emerald-100/60 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border-emerald-300/60">
            Current: {toNepaliDigits(todayInfo.bsYear)} B.S.
          </Badge>
          <button
            type="button"
            onClick={handleJumpToToday}
            className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 hover:text-emerald-950 dark:hover:text-white underline cursor-pointer"
          >
            Go to Today ➔
          </button>
        </div>
      </div>

      {/* 1. CALENDAR HEADER BAR */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/20">
            <CalendarIcon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold font-mono text-zinc-950 dark:text-white">
                {monthData.monthNameEn} ({monthData.monthNameNp}) {monthData.yearNp} B.S.
              </h3>
              <Badge variant="outline" className="font-mono text-[10px]">
                {currentBsYear} B.S.
              </Badge>
              <Badge variant="secondary" className="font-mono text-[10px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60">
                {yearHolidays.length} Public Holidays
              </Badge>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-sans mt-0.5">
              {englishSpan}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Year Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono text-zinc-500 font-semibold">Year:</span>
            <Select
              value={currentBsYear.toString()}
              onChange={(e) => {
                setCurrentBsYear(parseInt(e.target.value))
                setRangeStart(null)
                setRangeEnd(null)
              }}
              className="h-8 text-xs font-mono w-32"
            >
              {[2080, 2081, 2082, 2083, 2084, 2085].map((y) => (
                <option key={y} value={y.toString()}>
                  {y} B.S. ({toNepaliDigits(y)})
                </option>
              ))}
            </Select>
          </div>

          {/* Month Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono text-zinc-500 font-semibold">Month:</span>
            <Select
              value={currentBsMonth.toString()}
              onChange={(e) => {
                setCurrentBsMonth(parseInt(e.target.value))
                setRangeStart(null)
                setRangeEnd(null)
              }}
              className="h-8 text-xs font-mono w-36"
            >
              {NEPALI_MONTHS_EN.map((name, idx) => (
                <option key={name} value={(idx + 1).toString()}>
                  {idx + 1}. {name} ({NEPALI_MONTHS_NP[idx]})
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-center border border-zinc-200 dark:border-zinc-800 rounded-lg p-0.5 bg-zinc-50 dark:bg-zinc-800">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleJumpToToday}
              className="px-2 py-0.5 text-[11px] font-mono font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded text-zinc-700 dark:text-zinc-200 cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. DUAL NEPALI + ENGLISH CALENDAR GRID */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
        {/* Day Name Columns */}
        <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 font-mono text-center">
          {dayHeaders.map((dh, idx) => {
            const isWeekendCol = (idx === 6 && saturdayWeekend) || (idx === 0 && sundayWeekend)
            return (
              <div
                key={dh.en}
                className={`py-2.5 px-1 border-r border-zinc-200/60 dark:border-zinc-800 last:border-r-0 ${
                  isWeekendCol ? 'text-amber-700 dark:text-amber-400 font-bold bg-amber-500/5' : 'text-zinc-600 dark:text-zinc-300 font-medium'
                }`}
              >
                <div className="text-xs font-bold">{dh.np}</div>
                <div className="text-[10px] opacity-75">{dh.en}</div>
              </div>
            )
          })}
        </div>

        {/* Date Cells */}
        <div className="grid grid-cols-7 divide-x divide-y divide-zinc-200/60 dark:divide-zinc-800">
          {/* Empty prefix padding days */}
          {Array.from({ length: monthData.startDayOfWeek }).map((_, idx) => (
            <div
              key={`empty-${idx}`}
              className="min-h-[86px] p-2 bg-zinc-50/40 dark:bg-zinc-950/20 opacity-30 pointer-events-none"
            />
          ))}

          {/* Actual Month Days */}
          {monthData.days.map((day) => {
            const isToday = day.dateStr === todayDateStr
            const isSaturday = day.dayOfWeek === 6 && saturdayWeekend
            const isSundayWeekend = day.dayOfWeek === 0 && sundayWeekend
            const isWeekend = isSaturday || isSundayWeekend

            // Find if holiday exists on this day
            const holiday = holidays.find((h) => isDateWithinHoliday(day.dateStr, h))
            const selected = isDaySelected(day)

            return (
              <div
                key={day.dateStr}
                onClick={() => handleDayClick(day)}
                className={`min-h-[100px] p-2 transition-all cursor-pointer relative group flex flex-col justify-between rounded-sm ${
                  selected
                    ? 'bg-indigo-50 dark:bg-indigo-950/70 ring-2 ring-indigo-500 z-10'
                    : isToday
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/40 ring-2 ring-emerald-500 z-10'
                    : holiday
                    ? 'bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100/80 dark:hover:bg-rose-950/50'
                    : isWeekend
                    ? 'bg-amber-50/20 dark:bg-amber-950/15 hover:bg-amber-50/50 dark:hover:bg-amber-950/30'
                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                }`}
              >
                {/* Top Row: Nepali Big Day + Badges */}
                <div className="flex items-start justify-between">
                  <span
                    className={`text-lg sm:text-xl font-bold font-mono tracking-tight ${
                      isToday
                        ? 'text-emerald-700 dark:text-emerald-300 font-black'
                        : holiday
                        ? 'text-rose-700 dark:text-rose-300 font-extrabold'
                        : isWeekend
                        ? 'text-amber-700 dark:text-amber-400 font-bold'
                        : 'text-zinc-900 dark:text-zinc-100'
                    }`}
                  >
                    {day.bsDayNp}
                  </span>

                  {isToday ? (
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-600 text-white shadow-xs">
                      आज
                    </span>
                  ) : isWeekend ? (
                    <span className="text-[9px] font-mono text-amber-600 dark:text-amber-400 font-semibold px-1 rounded bg-amber-500/10">
                      Off
                    </span>
                  ) : null}
                </div>

                {/* Middle: Holiday Badge if scheduled */}
                {holiday && (
                  <div className="my-1">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border truncate max-w-full ${
                        holiday.type === 'cultural'
                          ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-900 dark:text-purple-200 border-purple-300 dark:border-purple-800'
                          : holiday.type === 'vacation'
                          ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800'
                          : holiday.type === 'department'
                          ? 'bg-cyan-100 dark:bg-cyan-950/80 text-cyan-900 dark:text-cyan-200 border-cyan-300 dark:border-cyan-800'
                          : 'bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-800'
                      }`}
                      title={holiday.title}
                    >
                      {holiday.titleNp || holiday.title}
                    </span>
                  </div>
                )}

                {/* Bottom Row: English Date */}
                <div className="flex items-center justify-between mt-auto pt-1 text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
                  <span className={isToday ? 'font-bold text-emerald-700 dark:text-emerald-300' : ''}>
                    {day.adDayString}
                  </span>
                  {selected && (
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-ping" />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 3. INTERACTIVE REVENUE / RANGE SELECTION ACTION BAR */}
      {rangeStart && (
        <div className="p-4 rounded-xl bg-indigo-50/90 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 shadow-md font-mono text-xs space-y-3 animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-indigo-200/80 dark:border-indigo-800/80 pb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span className="font-bold text-indigo-950 dark:text-indigo-100">
                Mark Calendar Holiday / Vacation:
              </span>
              <span className="px-2 py-0.5 rounded bg-white dark:bg-zinc-900 border border-indigo-300 dark:border-indigo-700 font-extrabold text-indigo-700 dark:text-indigo-300">
                {rangeStart.monthNameNp} {rangeStart.bsDayNp} ({rangeStart.adDayString})
                {rangeEnd && rangeEnd.dateStr !== rangeStart.dateStr && (
                  <> ➔ {rangeEnd.monthNameNp} {rangeEnd.bsDayNp} ({rangeEnd.adDayString})</>
                )}
              </span>
            </div>

            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {rangeEnd && rangeEnd.dateStr !== rangeStart.dateStr ? 'Multi-Day Vacation Range' : 'Click second date to set end of vacation, or mark single day below'}
            </div>
          </div>

          {!isEditModeUnlocked && (
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-[11px] bg-amber-500/10 p-2 rounded-lg border border-amber-300/80 dark:border-amber-800/60">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>Super-Admin modification is locked. Toggle the "Unlock Super-Admin" switch above to save or remove recesses.</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            <div className="sm:col-span-6">
              <Input
                type="text"
                placeholder="e.g. Annual Sports Week / Terminal Examination Recess"
                value={holidayTitle}
                onChange={(e) => setHolidayTitle(e.target.value)}
                className="h-8 text-xs bg-white dark:bg-zinc-900 border-indigo-300 dark:border-indigo-700"
                autoFocus
              />
            </div>

            <div className="sm:col-span-3">
              <Select
                value={holidayType}
                onChange={(e) => setHolidayType(e.target.value as any)}
                className="h-8 text-xs bg-white dark:bg-zinc-900 border-indigo-300 dark:border-indigo-700"
              >
                <option value="cultural">Festival / Cultural Recess</option>
                <option value="state">National Holiday</option>
                <option value="vacation">Seasonal Vacation</option>
                <option value="department">Departmental Recess</option>
              </Select>
            </div>

            <div className="sm:col-span-3 flex items-center gap-2">
              <Button
                size="sm"
                disabled={!holidayTitle.trim() || !isEditModeUnlocked}
                onClick={handleSaveSelectedRecess}
                className="h-8 flex-1 font-bold gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Mark Recess</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setRangeStart(null)
                  setRangeEnd(null)
                }}
                className="h-8 text-xs"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 4. EXISTING HOLIDAY INSPECTION MODAL / POPUP */}
      {selectedExistingHoliday && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 shadow-sm font-mono text-xs flex items-center justify-between animate-in slide-in-from-bottom-1 duration-150">
          <div>
            <div className="flex items-center gap-2">
              <Palmtree className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              <span className="font-bold text-rose-950 dark:text-rose-100 text-sm">
                {selectedExistingHoliday.title}
              </span>
              <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-rose-200/80 dark:bg-rose-900/80 text-rose-900 dark:text-rose-200 uppercase">
                {selectedExistingHoliday.type}
              </span>
            </div>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-1">
              Dates: <strong>{selectedExistingHoliday.bsDateStr || selectedExistingHoliday.dateStr}</strong>
              {selectedExistingHoliday.endDateStr && ` (${selectedExistingHoliday.dateStr} to ${selectedExistingHoliday.endDateStr})`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={!isEditModeUnlocked}
              onClick={() => {
                onDeleteHoliday(selectedExistingHoliday.id)
                setSelectedExistingHoliday(null)
              }}
              className="h-8 text-xs font-bold gap-1 bg-rose-600 hover:bg-rose-700"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete Recess</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedExistingHoliday(null)}
              className="h-8 text-xs"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* 5. OFFICIAL GOVERNMENT GAZETTE & INSTITUTIONAL RECESS DIRECTORY */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-indigo-500" />
              <h3 className="text-sm font-bold font-mono text-zinc-950 dark:text-white">
                Official Institutional & Gazette Holiday Directory ({currentBsYear} B.S.)
              </h3>
              <Badge variant="outline" className="font-mono text-[10px]">
                {filteredDirectoryHolidays.length} Holidays
              </Badge>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Verified against official Nepal Government Gazette (गृह मन्त्रालय) & Academic Calendar
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onResetHolidays && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onResetHolidays}
                disabled={!isEditModeUnlocked}
                className="h-8 text-xs font-mono font-semibold gap-1.5 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                title="Reset all holidays for all academic years to official Nepal Gazette presets"
              >
                <RotateCcw className="h-3.5 w-3.5 text-zinc-500" />
                <span>Sync MoHA Gazette Preset</span>
              </Button>
            )}
          </div>
        </div>

        {/* Directory Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <Input
              type="text"
              placeholder="Filter by festival or date..."
              value={directorySearch}
              onChange={(e) => setDirectorySearch(e.target.value)}
              className="pl-8 h-8 text-xs font-mono"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            {(['all', 'cultural', 'state', 'vacation'] as const).map((filterType) => (
              <button
                key={filterType}
                type="button"
                onClick={() => setDirectoryFilter(filterType)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono capitalize transition-all cursor-pointer ${
                  directoryFilter === filterType
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold shadow-2xs'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200'
                }`}
              >
                {filterType}
              </button>
            ))}
          </div>
        </div>

        {/* Directory List Table */}
        <div className="border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 text-zinc-500 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-4">Bikram Sambat (B.S.)</th>
                  <th className="py-2.5 px-4">English Date (A.D.)</th>
                  <th className="py-2.5 px-4">Official Holiday / Festival</th>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4">Laboratory Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {filteredDirectoryHolidays.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-zinc-400 font-mono text-xs">
                      No official holidays found matching criteria for {currentBsYear} B.S.
                    </td>
                  </tr>
                ) : (
                  filteredDirectoryHolidays.map((h, idx) => (
                    <tr key={`${h.id}-${idx}`} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-2.5 px-4 font-bold text-zinc-900 dark:text-zinc-100">
                        {h.bsDateStr || h.dateStr}
                      </td>
                      <td className="py-2.5 px-4 text-zinc-500">
                        {h.dateStr} {h.endDateStr && h.endDateStr !== h.dateStr ? `➔ ${h.endDateStr}` : ''}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="font-bold text-zinc-950 dark:text-white">
                          {h.titleNp || h.name || h.title}
                        </div>
                        <div className="text-[11px] text-zinc-500">{h.title}</div>
                      </td>
                      <td className="py-2.5 px-4">
                        <Badge
                          variant="outline"
                          className={`text-[9px] uppercase font-bold ${
                            h.type === 'cultural'
                              ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
                              : h.type === 'vacation'
                              ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                              : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                          }`}
                        >
                          {h.type}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="inline-flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
                          <Ban className="h-3 w-3" />
                          <span>Practicals Suspended</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleJumpToHolidayMonth(h)}
                            className="h-7 px-2 text-[11px] font-mono text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                          >
                            <span>Inspect</span>
                            <ChevronRight className="h-3 w-3 ml-0.5" />
                          </Button>
                          {isEditModeUnlocked && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => onDeleteHoliday(h.id)}
                              className="h-7 w-7 p-0 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                              title="Delete holiday"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
