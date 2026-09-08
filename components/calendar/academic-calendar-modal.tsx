'use client'

import React, { useState, useMemo } from 'react'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Palmtree,
  X,
  Sparkles,
  Clock,
  ShieldCheck,
  Ban,
  CheckCircle2,
  ExternalLink,
  BookOpen,
  Info
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
import { DEFAULT_HOLIDAYS, HolidayItem, isDateWithinHoliday } from '@/lib/master-data'
import { useInfrastructureState } from '@/hooks/use-infrastructure-state'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface AcademicCalendarModalProps {
  isOpen: boolean
  onClose: () => void
  initialDate?: Date
}

export default function AcademicCalendarModal({
  isOpen,
  onClose,
  initialDate = new Date(),
}: AcademicCalendarModalProps) {
  if (!isOpen) return null

  return <AcademicCalendarModalContent onClose={onClose} initialDate={initialDate} />
}

function AcademicCalendarModalContent({
  onClose,
  initialDate,
}: {
  onClose: () => void
  initialDate: Date
}) {
  const { holidays: customHolidays } = useInfrastructureState()
  const allHolidays = useMemo(() => {
    const list = [...DEFAULT_HOLIDAYS]
    if (Array.isArray(customHolidays)) {
      customHolidays.forEach((ch) => {
        if (!list.some((h) => h.id === ch.id || h.dateStr === ch.dateStr)) {
          list.push(ch)
        }
      })
    }
    return list
  }, [customHolidays])

  const todayInfo = useMemo(() => getNepaliDate(new Date()), [])
  const [currentBsYear, setCurrentBsYear] = useState<number>(todayInfo.bsYear || 2083)
  const [currentBsMonth, setCurrentBsMonth] = useState<number>(todayInfo.bsMonth || 5)
  const [activeTab, setActiveTab] = useState<'calendar' | 'directory'>('calendar')

  // Selected Day State
  const [selectedDay, setSelectedDay] = useState<BsCalendarDay | null>(null)

  // Current Month Data
  const monthData = useMemo(() => {
    return getBsMonthCalendar(currentBsYear, currentBsMonth)
  }, [currentBsYear, currentBsMonth])

  // Filter holidays for the selected BS Year (Deduplicated by ID)
  const yearHolidays = useMemo(() => {
    const npYearDigits = toNepaliDigits(currentBsYear)
    const enYearStr = currentBsYear.toString()
    const seenIds = new Set<string>()

    return allHolidays
      .filter((h) => {
        if (!h || !h.id || seenIds.has(h.id)) return false
        seenIds.add(h.id)

        if (h.bsDateStr) {
          if (h.bsDateStr.includes(npYearDigits) || h.bsDateStr.includes(enYearStr)) {
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
  }, [allHolidays, currentBsYear])

  // Navigation handlers
  const handlePrevMonth = () => {
    if (currentBsMonth === 1) {
      setCurrentBsYear((y) => y - 1)
      setCurrentBsMonth(12)
    } else {
      setCurrentBsMonth((m) => m - 1)
    }
    setSelectedDay(null)
  }

  const handleNextMonth = () => {
    if (currentBsMonth === 12) {
      setCurrentBsYear((y) => y + 1)
      setCurrentBsMonth(1)
    } else {
      setCurrentBsMonth((m) => m + 1)
    }
    setSelectedDay(null)
  }

  const handleResetToday = () => {
    setCurrentBsYear(todayInfo.bsYear || 2083)
    setCurrentBsMonth(todayInfo.bsMonth || 5)
    setSelectedDay(null)
  }

  const jumpToHolidayMonth = (h: HolidayItem) => {
    const parts = h.dateStr.split('-')
    const adYear = parseInt(parts[0], 10)
    const adMonth = parseInt(parts[1], 10) - 1
    const adDay = parseInt(parts[2], 10)
    const d = new Date(Date.UTC(adYear, adMonth, adDay))
    const np = getNepaliDate(d)
    setCurrentBsYear(np.bsYear)
    setCurrentBsMonth(np.bsMonth)
    setActiveTab('calendar')

    const targetDay = monthData.days.find((d) => d.dateStr === h.dateStr)
    if (targetDay) {
      setSelectedDay(targetDay)
    }
  }

  const selectedHoliday = selectedDay
    ? allHolidays.find((h) => isDateWithinHoliday(selectedDay.dateStr, h))
    : null

  const isTodaySelected = selectedDay && selectedDay.dateStr === getNepalDateStr(new Date())

  const WEEK_DAYS = [
    { id: 0, labelNp: 'आइत', labelEn: 'Sun' },
    { id: 1, labelNp: 'सोम', labelEn: 'Mon' },
    { id: 2, labelNp: 'मंगलबार', labelEn: 'Tue' },
    { id: 3, labelNp: 'बुध', labelEn: 'Wed' },
    { id: 4, labelNp: 'बिही', labelEn: 'Thu' },
    { id: 5, labelNp: 'शुक्र', labelEn: 'Fri' },
    { id: 6, labelNp: 'शनि', labelEn: 'Sat', isWeekend: true },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-zinc-900 dark:text-zinc-100 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-950/40">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shadow-xs">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-zinc-950 dark:text-white">
                  Academic & National Holidays Calendar
                </h2>
                <Badge variant="outline" className="text-[10px] font-mono border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50">
                  वि.सं. {toNepaliDigits(currentBsYear)} B.S.
                </Badge>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Official Nepal Government Gazette Holidays, Institutional Recesses & Practical Schedule Status
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Sub-header Navigation & Tabs */}
        <div className="px-6 py-3 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-100/40 dark:bg-zinc-900/40 flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
          {/* Month Switcher Controls */}
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevMonth}
              className="h-8 w-8 p-0 rounded-xl"
              title="Previous Month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-1.5">
              <select
                value={currentBsYear.toString()}
                onChange={(e) => {
                  setCurrentBsYear(parseInt(e.target.value, 10))
                  setSelectedDay(null)
                }}
                className="h-8 px-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-xs text-zinc-900 dark:text-zinc-100 shadow-2xs font-mono"
              >
                {[2080, 2081, 2082, 2083, 2084, 2085].map((y) => (
                  <option key={y} value={y.toString()}>
                    {y} B.S. ({toNepaliDigits(y)})
                  </option>
                ))}
              </select>

              <div className="px-3 py-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold flex items-center gap-2 shadow-2xs">
                <span className="text-zinc-950 dark:text-white text-sm">
                  {monthData.monthNameNp}
                </span>
                <span className="text-zinc-400 text-[11px]">
                  ({monthData.monthNameEn})
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleNextMonth}
              className="h-8 w-8 p-0 rounded-xl"
              title="Next Month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetToday}
              className="h-8 px-2.5 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl"
            >
              Current Month
            </Button>
          </div>

          {/* Segmented View Switcher */}
          <div className="flex items-center gap-1 bg-zinc-200/80 dark:bg-zinc-800/80 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('calendar')}
              className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                activeTab === 'calendar'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              Month View
            </button>
            <button
              onClick={() => setActiveTab('directory')}
              className={`px-3 py-1 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 ${
                activeTab === 'directory'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              <Palmtree className="h-3 w-3 text-amber-500" />
              <span>National Holidays ({allHolidays.length})</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {activeTab === 'calendar' ? (
            <div className="space-y-4">
              {/* 7-Column Day Header */}
              <div className="grid grid-cols-7 gap-1 text-center font-mono text-xs font-bold text-zinc-500 dark:text-zinc-400 border-b border-zinc-200/80 dark:border-zinc-800/80 pb-2">
                {WEEK_DAYS.map((wd) => (
                  <div
                    key={wd.id}
                    className={`py-1 ${
                      wd.isWeekend ? 'text-rose-600 dark:text-rose-400' : ''
                    }`}
                  >
                    <div>{wd.labelNp}</div>
                    <div className="text-[10px] font-normal opacity-70">{wd.labelEn}</div>
                  </div>
                ))}
              </div>

              {/* 7-Column Month Days Grid */}
              <div className="grid grid-cols-7 gap-1.5">
                {/* Empty leading offset cells */}
                {Array.from({ length: monthData.startDayOfWeek }).map((_, idx) => (
                  <div
                    key={`blank-${idx}`}
                    className="min-h-[64px] rounded-xl border border-transparent bg-zinc-100/30 dark:bg-zinc-900/20"
                  />
                ))}

                {/* Day Cells */}
                {monthData.days.map((day) => {
                  const isToday = day.dateStr === getNepalDateStr(new Date())
                  const isWeekend = day.dayOfWeek === 6
                  const holiday = allHolidays.find((h) => isDateWithinHoliday(day.dateStr, h))
                  const isSelected = selectedDay?.dateStr === day.dateStr

                  return (
                    <button
                      key={day.dateStr}
                      type="button"
                      onClick={() => setSelectedDay(day)}
                      className={`min-h-[68px] sm:min-h-[76px] p-2 rounded-xl border transition-all flex flex-col justify-between text-left relative group select-none ${
                        isSelected
                          ? 'border-indigo-500 ring-2 ring-indigo-500/40 bg-indigo-50/60 dark:bg-indigo-950/40 z-10'
                          : isToday
                          ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 ring-1 ring-emerald-500/50'
                          : holiday
                          ? 'border-amber-400/80 dark:border-amber-600/60 bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-50/70'
                          : isWeekend
                          ? 'border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/40'
                          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:border-zinc-400 dark:hover:border-zinc-600'
                      }`}
                    >
                      {/* Top Bar: Nepali Day & English Date */}
                      <div className="flex items-start justify-between w-full">
                        <span
                          className={`text-sm sm:text-base font-black font-mono tracking-tight ${
                            isToday
                              ? 'text-emerald-700 dark:text-emerald-300'
                              : holiday
                              ? 'text-amber-700 dark:text-amber-300'
                              : isWeekend
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-zinc-900 dark:text-zinc-100'
                          }`}
                        >
                          {day.bsDayNp}
                        </span>

                        <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
                          {day.adDayString}
                        </span>
                      </div>

                      {/* Bottom Status Tags */}
                      <div className="mt-1 w-full truncate">
                        {isToday ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-500 text-white shadow-2xs">
                            TODAY
                          </span>
                        ) : holiday ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-500 text-white shadow-2xs truncate max-w-full" title={holiday.name || holiday.title}>
                            <Palmtree className="h-2.5 w-2.5 shrink-0" />
                            <span className="truncate">{holiday.name || holiday.title}</span>
                          </span>
                        ) : isWeekend ? (
                          <span className="text-[9px] font-mono text-rose-500 dark:text-rose-400 font-semibold">
                            Weekend
                          </span>
                        ) : null}
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Day Inspector Drawer (When day clicked) */}
              <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 transition-all">
                {selectedDay ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold uppercase text-zinc-500 dark:text-zinc-400">
                          Selected Day Details
                        </span>
                        {isTodaySelected && (
                          <Badge className="bg-emerald-500 text-white text-[10px] font-mono">TODAY</Badge>
                        )}
                        {selectedHoliday && (
                          <Badge className="bg-amber-500 text-white text-[10px] font-mono flex items-center gap-1">
                            <Palmtree className="h-3 w-3" />
                            <span>Institutional Holiday</span>
                          </Badge>
                        )}
                      </div>

                      <h3 className="text-base font-extrabold text-zinc-950 dark:text-white font-mono">
                        {toNepaliDigits(selectedDay.bsYear)} {selectedDay.monthNameNp} {selectedDay.bsDayNp} गते, {selectedDay.dayNameNp}
                        <span className="text-xs font-normal text-zinc-500 ml-2">
                          ({selectedDay.adDate.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })})
                        </span>
                      </h3>

                      {selectedHoliday ? (
                        <div className="space-y-1 pt-1">
                          <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
                            {selectedHoliday.titleNp || selectedHoliday.title} ({selectedHoliday.name || selectedHoliday.title})
                          </p>
                          <p className="text-xs text-zinc-600 dark:text-zinc-300">
                            {selectedHoliday.description || 'Official academic recess. Regular laboratory practical sessions suspended.'}
                          </p>
                          <div className="flex items-center gap-2 pt-1 text-[11px] font-mono text-rose-600 dark:text-rose-400 font-bold">
                            <Ban className="h-3.5 w-3.5" />
                            <span>Practicals Automatically Cancelled • No Attendance or Skip Logs Created</span>
                          </div>
                        </div>
                      ) : selectedDay.dayOfWeek === 6 ? (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          Institutional Weekend Recess (Saturday). Laboratories closed.
                        </p>
                      ) : (
                        <div className="flex items-center gap-2 pt-1 text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Standard Academic Working Day • Normal Laboratory Timetable Operates</span>
                        </div>
                      )}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedDay(null)}
                      className="shrink-0 text-xs font-mono"
                    >
                      Clear Selection
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                    <div className="flex items-center gap-2 font-mono">
                      <Info className="h-4 w-4 text-zinc-400" />
                      <span>Click on any date to inspect holiday status, festival events, and laboratory practical rules.</span>
                    </div>
                    <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">
                      {yearHolidays.length} Holidays Active in {currentBsYear} B.S.
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* National & Institutional Holidays Directory (View 2) */
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-950 dark:text-amber-100 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Palmtree className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <h4 className="font-bold">Official Government & Institutional Calendar Directory ({currentBsYear} B.S.)</h4>
                    <p className="text-zinc-600 dark:text-zinc-300">
                      On every scheduled holiday listed below, all laboratory practical sessions are <strong>automatically cancelled</strong>. 
                      The system locks slot booking and rejects practical attendance logs (even as skipped) to preserve institutional compliance.
                    </p>
                  </div>
                </div>

                <Badge variant="outline" className="font-mono text-xs border-amber-500/40 bg-white/50 dark:bg-zinc-900/50 text-amber-800 dark:text-amber-300 shrink-0">
                  {yearHolidays.length} Holidays
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {yearHolidays.map((holiday, idx) => (
                  <div
                    key={`${holiday.id}-${idx}`}
                    className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:border-amber-400 dark:hover:border-amber-700/60 transition-all shadow-xs flex flex-col justify-between space-y-3 group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <Badge
                          variant="outline"
                          className="text-[10px] font-mono border-amber-500/40 bg-amber-50/60 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                        >
                          {holiday.type.toUpperCase()} RECESS
                        </Badge>

                        <span className="text-[11px] font-mono font-bold text-zinc-500 dark:text-zinc-400">
                          {holiday.bsDateStr || holiday.dateStr}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-zinc-950 dark:text-white mt-2">
                        {holiday.titleNp || holiday.title}
                      </h4>
                      <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 font-mono">
                        {holiday.name || holiday.title}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                        {holiday.description || 'Public institutional holiday. Sessions suspended.'}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-rose-600 dark:text-rose-400">
                        <Ban className="h-3 w-3" />
                        <span>Cancelled (No Logs)</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => jumpToHolidayMonth(holiday)}
                        className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        <span>View in Grid</span>
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 flex items-center justify-between text-xs font-mono text-zinc-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>Official Holiday Engine Active • Automatic Recess Enforcement</span>
          </div>

          <Button
            size="sm"
            onClick={onClose}
            className="h-8 px-4 text-xs font-mono"
          >
            Close Calendar
          </Button>
        </div>
      </div>
    </div>
  )
}
