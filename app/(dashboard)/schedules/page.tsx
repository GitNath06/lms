'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Calendar,
  Printer,
  Plus,
  Filter,
  User,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import AdvancedCalendar from './advanced-calendar'
import SessionActionModal from '@/components/schedules/session-action-modal'
import { getCurrentUserProfile, UserProfile } from '@/app/actions/auth'
import { useRoutineState } from '@/hooks/use-routine-state'
import { useInfrastructureState } from '@/hooks/use-infrastructure-state'
import { useCalendarSettings } from '@/hooks/use-calendar-settings'
import { getWeekDates } from '@/lib/master-data'
import { useLiveSchedule } from '@/hooks/use-live-schedule'

export default function SchedulesPage() {
  const [labFilter, setLabFilter] = useState('all')
  const [teacherFilter, setTeacherFilter] = useState('all')
  const [weekOffset, setWeekOffset] = useState<number>(0)
  const [isAdhocOpen, setIsAdhocOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [mounted, setMounted] = useState(false)

  const { now } = useLiveSchedule()
  const { routines, addSession, requestSlotBooking } = useRoutineState()
  const { faculty: infraFaculty, labs: infraLabs } = useInfrastructureState()
  const { startDay } = useCalendarSettings()

  // Fetch Current User Profile
  useEffect(() => {
    setMounted(true)
    getCurrentUserProfile().then((user) => {
      setCurrentUser(user)
      // If user is a practical subject teacher, default to viewing their own sessions
      if (user?.role === 'teacher') {
        setTeacherFilter('my_sessions')
      }
    })
  }, [])

  // Teacher List for Filters (Only distinct subject teachers)
  const teacherList = useMemo(() => {
    const set = new Set<string>()
    infraFaculty.forEach((f) => {
      if (f.name) set.add(f.name)
    })
    routines.forEach((r) => {
      if (r.teacher) set.add(r.teacher)
    })
    return Array.from(set).sort()
  }, [infraFaculty, routines])

  // Week Dates calculation for header navigation
  const baseDate = useMemo(() => {
    const d = new Date(now)
    d.setDate(d.getDate() + weekOffset * 7)
    return d
  }, [now, weekOffset])

  const weekDates = useMemo(() => getWeekDates(baseDate, startDay), [baseDate, startDay])
  const startDayInfo = weekDates[0]
  const endDayInfo = weekDates[weekDates.length - 1]

  const isTeacher = currentUser?.role === 'teacher'

  return (
    <div className="flex flex-col h-[calc(100vh-84px)] -m-4 md:-m-6 p-3 md:p-4 space-y-2.5 animate-in fade-in duration-300 select-none overflow-hidden">
      {/* Sleek Command Toolbar: Lab Filter, Teacher Filter, Week Nav, Actions (Rigid Single Row) */}
      <div className="flex items-center justify-between gap-2 bg-white/95 dark:bg-zinc-900/95 p-2 px-3 rounded-xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs backdrop-blur-md shrink-0 print:hidden overflow-x-auto no-scrollbar">
        {/* Left Section: Title + Lab Switcher + Teacher Filter */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="h-7 w-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/60 dark:border-indigo-800/50 shadow-2xs shrink-0">
              <Calendar className="h-3.5 w-3.5" />
            </div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-xs sm:text-sm font-bold tracking-tight text-zinc-950 dark:text-white font-heading whitespace-nowrap">
                Lab Timetable
              </h2>
              <span className="px-1.5 py-0.2 text-[9px] font-sans font-bold tabular-nums rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center gap-1 shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                2083
              </span>
            </div>
          </div>

          {/* Segmented Lab Switcher */}
          <div className="flex items-center gap-0.5 p-0.5 bg-zinc-100 dark:bg-zinc-800/80 rounded-lg text-xs font-sans border border-zinc-200/60 dark:border-zinc-700/60 shrink-0">
            <button
              type="button"
              onClick={() => setLabFilter('all')}
              className={`px-2 py-1 rounded-md transition-all font-semibold text-[11px] ${
                labFilter === 'all'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              All Labs
            </button>
            {((infraLabs && infraLabs.length > 0) ? infraLabs : [
              { id: 'comp', name: 'Computer' },
              { id: 'phys', name: 'Physics' },
              { id: 'chem', name: 'Chemistry' },
              { id: 'bio', name: 'Biology' },
            ]).map((l: any) => {
              const shortName = l.name.replace(/\s+(Laboratory|Lab).*$/i, '')
              const isActive = labFilter === l.id
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setLabFilter(l.id)}
                  className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 text-[11px] ${
                    isActive
                      ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 font-semibold shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-indigo-500' : 'bg-zinc-400'}`} />
                  <span>{shortName}</span>
                </button>
              )
            })}
          </div>

          {/* 1. Subject Teacher Filter */}
          <div className="flex items-center gap-1 font-sans shrink-0">
            {isTeacher ? (
              <div className="flex items-center gap-0.5 p-0.5 bg-zinc-100 dark:bg-zinc-800/80 rounded-lg text-xs border border-zinc-200/60 dark:border-zinc-700/60">
                <button
                  type="button"
                  onClick={() => setTeacherFilter('my_sessions')}
                  className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 font-semibold text-[11px] ${
                    teacherFilter === 'my_sessions'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                  title="Show only your assigned practical sessions"
                >
                  <User className="h-3 w-3" />
                  <span>My Sessions</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTeacherFilter('all')}
                  className={`px-2 py-1 rounded-md transition-all font-semibold text-[11px] ${
                    teacherFilter === 'all'
                      ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                  title="Show all subject teachers"
                >
                  <span>All Teachers</span>
                </button>
              </div>
            ) : (
              <div className="relative flex items-center">
                <select
                  suppressHydrationWarning
                  value={teacherFilter}
                  onChange={(e) => setTeacherFilter(e.target.value)}
                  className="h-8 pl-3 pr-7 bg-zinc-100/90 dark:bg-zinc-800/90 border border-zinc-200/80 dark:border-zinc-700/80 rounded-lg text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans cursor-pointer shadow-2xs max-w-[130px] sm:max-w-[145px] truncate"
                >
                  <option value="all">All Subject Teachers</option>
                  {mounted &&
                    teacherList.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Right Section: Week Navigation & Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Week Navigation Controls (Rigid Fixed Width) */}
          <div className="flex items-center bg-zinc-100/90 dark:bg-zinc-800/90 p-0.5 rounded-lg border border-zinc-200/70 dark:border-zinc-700/70 font-sans text-xs shrink-0">
            <button
              type="button"
              onClick={() => setWeekOffset((w) => w - 1)}
              className="h-7 w-7 rounded-md hover:bg-white dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer flex items-center justify-center shrink-0"
              title="Previous Week"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>

            {/* Rigid container: exactly 315px wide so all English + Nepali dates and badges fit without any overflow */}
            <div suppressHydrationWarning className="flex items-center justify-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold w-[315px] shrink-0 text-center select-none font-sans">
              <CalendarDays className="h-3 w-3 text-indigo-500 shrink-0" />
              <span suppressHydrationWarning className="text-zinc-800 dark:text-zinc-200 whitespace-nowrap">
                {startDayInfo?.formattedEng} – {endDayInfo?.formattedEng}
              </span>
              <span className="text-zinc-400 shrink-0">•</span>
              <span suppressHydrationWarning className="text-amber-700 dark:text-amber-400 whitespace-nowrap">
                {startDayInfo?.formattedNp} – {endDayInfo?.formattedNp}
              </span>
              {weekOffset === 0 ? (
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 font-extrabold uppercase shrink-0">
                  Current
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setWeekOffset(0)}
                  title="Reset to current week"
                  className="px-1.5 py-0.2 rounded text-[9px] bg-indigo-100 hover:bg-indigo-200 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 font-extrabold cursor-pointer transition-colors shrink-0 flex items-center gap-0.5"
                >
                  <span>{weekOffset > 0 ? `+${weekOffset}w` : `${weekOffset}w`}</span>
                  <span className="font-normal opacity-70">(reset)</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setWeekOffset((w) => w + 1)}
              className="h-7 w-7 rounded-md hover:bg-white dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer flex items-center justify-center shrink-0"
              title="Next Week"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-xs font-semibold gap-1.5 border-zinc-200 dark:border-zinc-800 font-sans shrink-0"
            onClick={() => {
              if (typeof window !== 'undefined') window.print()
            }}
          >
            <Printer className="h-3.5 w-3.5 text-zinc-500" />
            <span className="hidden sm:inline">Print Routine</span>
          </Button>

          <Button
            size="sm"
            className="h-8 px-3 text-xs font-semibold gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-sans shadow-xs shrink-0 whitespace-nowrap"
            onClick={() => setIsAdhocOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{isTeacher ? 'Request Slot' : 'Book Slot'}</span>
          </Button>
        </div>
      </div>

      {/* Main Expansive Calendar Canvas (Takes 100% Remaining Height) */}
      <div className="flex-1 w-full overflow-hidden min-h-0">
        <AdvancedCalendar
          labFilter={labFilter}
          teacherFilter={teacherFilter}
          currentUser={currentUser}
          weekOffset={weekOffset}
        />
      </div>

      {/* Ad-hoc / New Slot Booking or Request Modal */}
      <SessionActionModal
        isOpen={isAdhocOpen}
        onClose={() => setIsAdhocOpen(false)}
        currentUser={currentUser}
        session={{
          id: `adhoc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          day: 'Monday',
          dayKey: 'mon',
          timeSlot: '10:10 - 11:00',
          slotId: 't2',
          span: 1,
          subjectCode: 'COMP-12',
          subjectTitle: 'Data Structures & Algorithms Lab',
          grade: 'Class 12',
          gradeKey: 'class-12',
          teacher: isTeacher ? (currentUser?.full_name || 'Practical Subject Teacher') : 'Assigned Subject Teacher',
          lab: 'Computer Lab',
          labKey: 'comp',
          defaultStudents: 38,
          category: 'Computer',
          dotColor: 'bg-indigo-500',
          badgeColor: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700',
          accentColor: 'border-l-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 text-zinc-950 dark:text-white',
        }}
        initialMode="book"
        onAddSession={isTeacher ? (s) => requestSlotBooking(s, currentUser?.full_name || 'Subject Teacher') : addSession}
      />
    </div>
  )
}

