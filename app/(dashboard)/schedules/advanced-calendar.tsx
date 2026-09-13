'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Plus,
  RotateCcw,
  Coffee,
  Merge,
  Clock,
  Split,
  CalendarDays,
  Palmtree,
  Sparkles,
  Lock,
  Flame,
  Radio,
  UserCheck,
  AlertCircle,
  Check,
  X,
  AlertTriangle,
  Landmark,
  Wrench,
} from 'lucide-react'
import {
  MASTER_TIME_SLOTS,
  MasterRoutineItem,
  getOrderedDays,
  getWeekDates,
  DayKey,
  formatCleanSubjectCode,
  isDateWithinHoliday,
} from '@/lib/master-data'
import SessionActionModal, { ModalMode } from '@/components/schedules/session-action-modal'
import { useLiveSchedule } from '@/hooks/use-live-schedule'
import { useRoutineState } from '@/hooks/use-routine-state'
import { useCalendarSettings } from '@/hooks/use-calendar-settings'
import { useSubstitutionState } from '@/hooks/use-substitution-state'
import { useInfrastructureState } from '@/hooks/use-infrastructure-state'
import { UserProfile } from '@/app/actions/auth'

interface AdvancedCalendarProps {
  labFilter?: string
  teacherFilter?: string
  currentUser?: UserProfile | null
  weekOffset?: number
}

export default function AdvancedCalendar({
  labFilter = 'all',
  teacherFilter = 'all',
  currentUser = null,
  weekOffset = 0,
}: AdvancedCalendarProps) {
  const {
    dayKey: currentDayKey,
    activeSlotId,
    activeSessions,
    now,
  } = useLiveSchedule()

  const {
    startDay,
    sundayWeekend,
    saturdayWeekend,
  } = useCalendarSettings()

  const { holidays } = useInfrastructureState()

  const {
    routines,
    addSession,
    deleteSession,
    extendSession,
    mergeSession,
    unmergeSession,
    skipSession,
    unskipSession,
    requestSlotBooking,
    approveSlotBooking,
    rejectSlotBooking,
    resetToMaster,
  } = useRoutineState()

  const { getSubForSession } = useSubstitutionState()

  const [mounted, setMounted] = useState(false)
  const [selectedSession, setSelectedSession] = useState<MasterRoutineItem | null>(null)
  const [hoveredSession, setHoveredSession] = useState<MasterRoutineItem | null>(null)
  const [modalMode, setModalMode] = useState<ModalMode>('log')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Decline Dialog State
  const [declineSessionId, setDeclineSessionId] = useState<string | null>(null)
  const [declineReason, setDeclineReason] = useState<string>('Lab occupied for senior exams')
  const [customDeclineReason, setCustomDeclineReason] = useState<string>('')
  const [isDeclineModalOpen, setIsDeclineModalOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Calculate Base Date according to week offset
  const baseDate = useMemo(() => {
    const d = new Date(now)
    d.setDate(d.getDate() + weekOffset * 7)
    return d
  }, [now, weekOffset])

  const orderedDays = getOrderedDays(startDay)
  const weekDates = getWeekDates(baseDate, startDay)

  const openActionModal = (session: MasterRoutineItem, mode: ModalMode = 'log') => {
    setSelectedSession(session)
    setModalMode(mode)
    setIsModalOpen(true)
  }

  const isDayOff = (dayKey: DayKey): boolean => {
    if (dayKey === 'sun') return sundayWeekend
    if (dayKey === 'sat') return saturdayWeekend
    return false
  }

  const handleQuickAdd = (dayKey: DayKey, slotId: string) => {
    if (isDayOff(dayKey)) {
      setToastMessage('Scheduling is locked on weekend recess days.')
      setTimeout(() => setToastMessage(null), 3000)
      return
    }

    const targetDateInfo = weekDates.find((w) => w.dayKey === dayKey)
    if (targetDateInfo && holidays.some((h) => isDateWithinHoliday(targetDateInfo.dateStr, h))) {
      const matchingH = holidays.find((h) => isDateWithinHoliday(targetDateInfo.dateStr, h))
      setToastMessage(`Institutional Holiday (${matchingH?.name || 'Recess'}): Practical slot booking is locked.`)
      setTimeout(() => setToastMessage(null), 3500)
      return
    }

    const slot = MASTER_TIME_SLOTS.find((t) => t.id === slotId)
    const timeSlot = slot?.label || '10:10 - 11:00'
    const dayObj = orderedDays.find((d) => d.id === dayKey)
    const dayLabel = (dayObj?.label as any) || 'Monday'
    const isTeacherRole = currentUser?.role === 'teacher'

    const adhocSession: MasterRoutineItem = {
      id: `adhoc-${Date.now()}`,
      day: dayLabel,
      dayKey,
      timeSlot,
      slotId,
      span: 1,
      subjectCode: 'COMP-12',
      subjectTitle: 'Data Structures & Algorithms Lab',
      grade: 'Class 12',
      gradeKey: 'class-12',
      teacher: isTeacherRole ? (currentUser?.full_name || 'Practical Subject Teacher') : 'Assigned Subject Teacher',
      lab: 'Computer Lab',
      labKey: 'comp',
      defaultStudents: 38,
      category: 'Computer',
      dotColor: 'bg-indigo-500',
      badgeColor: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700',
      accentColor:
        'border-l-indigo-500 bg-indigo-50/90 dark:bg-indigo-950/50 text-zinc-950 dark:text-white border-indigo-200 dark:border-indigo-500/30',
    }

    setSelectedSession(adhocSession)
    setModalMode('book')
    setIsModalOpen(true)
  }

  const handleSuccess = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 4000)
  }

  // ACCURATE LAB & TEACHER FILTER: Keep full routine on grid and highlight matching sessions
  const isSessionHighlighted = (item: MasterRoutineItem): boolean => {
    // 1. Lab Filter Check
    if (labFilter !== 'all') {
      const matchComp = labFilter === 'comp' && (item.labKey === 'comp' || item.lab.toLowerCase().includes('comp'))
      const matchPhys = labFilter === 'phys' && (item.labKey === 'phys' || item.lab.toLowerCase().includes('phys'))
      const matchChem = labFilter === 'chem' && (item.labKey === 'chem' || item.lab.toLowerCase().includes('chem'))
      const matchBio = labFilter === 'bio' && (item.labKey === 'bio' || item.lab.toLowerCase().includes('bio'))
      const matchOther = !['comp', 'phys', 'chem', 'bio'].includes(labFilter) && item.labKey === labFilter
      if (!matchComp && !matchPhys && !matchChem && !matchBio && !matchOther) return false
    }

    // 2. Subject Teacher Filter Check
    if (teacherFilter && teacherFilter !== 'all') {
      if (teacherFilter === 'my_sessions' && currentUser?.full_name) {
        const nameLower = currentUser.full_name.toLowerCase()
        const isAssigned = item.teacher.toLowerCase().includes(nameLower)
        const isRequested = item.requestedBy && item.requestedBy.toLowerCase().includes(nameLower)
        if (!isAssigned && !isRequested) return false
      } else if (teacherFilter !== 'my_sessions') {
        if (!item.teacher.toLowerCase().includes(teacherFilter.toLowerCase())) return false
      }
    }

    return true
  }

  // Preserve routine for layout stability so grid columns don't shift
  const filteredRoutine = routines

  // Dynamic Aurora Glow Computation (Live Session or Hovered Session)
  const targetSessionForAurora = hoveredSession || (activeSessions && activeSessions.length > 0 ? activeSessions[0] : null)

  const getAuroraStyles = () => {
    if (!targetSessionForAurora) {
      return {
        blob1: 'bg-indigo-500/20 dark:bg-indigo-600/15',
        blob2: 'bg-cyan-500/20 dark:bg-cyan-600/15',
        blob3: 'bg-violet-500/15 dark:bg-violet-600/10',
      }
    }

    const lab = targetSessionForAurora.lab.toLowerCase()
    const code = targetSessionForAurora.subjectCode.toUpperCase()

    if (lab.includes('comp') || code.includes('COMP') || code.includes('DBMS') || code.includes('WPD')) {
      return {
        blob1: 'bg-indigo-500/30 dark:bg-indigo-600/25',
        blob2: 'bg-violet-500/30 dark:bg-violet-600/25',
        blob3: 'bg-blue-500/20 dark:bg-blue-600/20',
      }
    }
    if (lab.includes('phys') || code.includes('PHY')) {
      return {
        blob1: 'bg-cyan-500/30 dark:bg-cyan-500/25',
        blob2: 'bg-teal-500/30 dark:bg-teal-500/25',
        blob3: 'bg-sky-500/20 dark:bg-sky-600/20',
      }
    }
    if (lab.includes('chem') || code.includes('CHEM')) {
      return {
        blob1: 'bg-rose-500/30 dark:bg-rose-500/25',
        blob2: 'bg-pink-500/30 dark:bg-pink-500/25',
        blob3: 'bg-amber-500/20 dark:bg-amber-600/20',
      }
    }
    if (lab.includes('bio') || code.includes('BIO')) {
      return {
        blob1: 'bg-emerald-500/30 dark:bg-emerald-500/25',
        blob2: 'bg-lime-500/30 dark:bg-lime-500/25',
        blob3: 'bg-teal-500/20 dark:bg-teal-600/20',
      }
    }

    return {
      blob1: 'bg-amber-500/30 dark:bg-amber-500/25',
      blob2: 'bg-orange-500/30 dark:bg-orange-500/25',
      blob3: 'bg-yellow-500/20 dark:bg-yellow-600/20',
    }
  }

  const aurora = getAuroraStyles()
  const canApprove =
    currentUser?.role === 'super_admin' ||
    currentUser?.role === 'lab_incharge' ||
    currentUser?.role === 'hod'

  return (
    <div className="flex flex-col h-full bg-white/95 dark:bg-zinc-950/95 border border-zinc-200/90 dark:border-zinc-800/90 rounded-2xl shadow-sm overflow-hidden select-none relative backdrop-blur-xl">
      {/* 🌌 Dynamic Ambient Aurora Glow Blobs Layer */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div
          className={`absolute -top-24 -left-20 w-96 h-96 rounded-full blur-[100px] transition-colors duration-1000 animate-aurora-1 ${aurora.blob1}`}
        />
        <div
          className={`absolute top-1/3 -right-24 w-[28rem] h-[28rem] rounded-full blur-[110px] transition-colors duration-1000 animate-aurora-2 ${aurora.blob2}`}
        />
        <div
          className={`absolute -bottom-20 left-1/3 w-[26rem] h-[26rem] rounded-full blur-[120px] transition-colors duration-1000 animate-aurora-1 ${aurora.blob3}`}
        />
      </div>

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="absolute top-4 right-4 z-50 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-4 py-2.5 rounded-xl shadow-2xl text-xs font-mono font-medium animate-in slide-in-from-top-2 duration-200 flex items-center gap-2 border border-zinc-700 dark:border-zinc-300">
          <Sparkles className="h-4 w-4 text-emerald-400 dark:text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Grid Viewport */}
      <div className="flex-1 overflow-auto relative z-10">
        <div className="min-w-[1540px] flex flex-col h-full">
          {/* Top Axis: Time Slots Header */}
          <div className="flex border-b border-zinc-200/90 dark:border-zinc-800/90 bg-zinc-50/95 dark:bg-zinc-900/95 sticky top-0 z-30 backdrop-blur-md">
            {/* Axis Label */}
            <div className="w-48 shrink-0 border-r border-zinc-200/90 dark:border-zinc-800/90 p-3.5 flex items-center justify-between text-xs font-mono font-extrabold text-zinc-700 dark:text-zinc-200 uppercase tracking-wider sticky left-0 z-40 bg-zinc-50 dark:bg-zinc-900 shadow-xs">
              <span className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-indigo-500" />
                DAY // 2083
              </span>
              <button
                onClick={resetToMaster}
                title="Reset Routine to Master Schedule"
                className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* 10 Period Slots */}
            <div className="flex-1 grid grid-cols-10 divide-x divide-zinc-200/80 dark:divide-zinc-800/80">
              {MASTER_TIME_SLOTS.map((slot) => {
                const isBreak = slot.id === 't6'
                const isSlotActive = weekOffset === 0 && activeSlotId === slot.id

                return (
                  <div
                    key={slot.id}
                    className={`p-3 px-2 text-center font-mono flex flex-col justify-center transition-all relative ${
                      isBreak
                        ? 'bg-amber-50/40 dark:bg-amber-950/20'
                        : isSlotActive
                        ? 'bg-emerald-50/90 dark:bg-emerald-950/60 ring-2 ring-emerald-500/80 shadow-[0_0_20px_rgba(16,185,129,0.25)] z-10'
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span
                        className={`text-xs font-extrabold tracking-tight ${
                          isBreak
                            ? 'text-amber-600 dark:text-amber-400'
                            : isSlotActive
                            ? 'text-emerald-700 dark:text-emerald-300 font-black'
                            : 'text-zinc-950 dark:text-white'
                        }`}
                      >
                        {slot.name}
                      </span>
                      {isSlotActive && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-mono font-black bg-emerald-600 text-white shadow-xs animate-pulse">
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                          LIVE
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[11px] mt-0.5 font-bold ${
                        isSlotActive ? 'text-emerald-800 dark:text-emerald-300' : 'text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      {slot.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 7 Day Rows in Configured Order */}
          <div suppressHydrationWarning className="flex-1 flex flex-col divide-y divide-zinc-200/80 dark:divide-zinc-800/80">
            {orderedDays.map((day) => {
              const isToday = weekOffset === 0 && currentDayKey === day.id
              const daySchedules = filteredRoutine.filter((s) => s.dayKey === day.id)
              const dayDateInfo = weekDates.find((w) => w.dayKey === day.id)
              const isWeekend = isDayOff(day.id)
              const dayHoliday = dayDateInfo ? holidays.find((h) => isDateWithinHoliday(dayDateInfo.dateStr, h)) : null
              const isHoliday = !!dayHoliday

              // Multi-track allocation
              const sessionTracks = new Map<string, number>()
              const trackOccupancy: Array<Set<number>> = [new Set(), new Set()]

              const sortedSchedules = [...daySchedules].sort((a, b) => {
                const aIdx = MASTER_TIME_SLOTS.findIndex((t) => t.id === a.slotId)
                const bIdx = MASTER_TIME_SLOTS.findIndex((t) => t.id === b.slotId)
                return aIdx - bIdx
              })

              sortedSchedules.forEach((session) => {
                const startIdx = MASTER_TIME_SLOTS.findIndex((t) => t.id === session.slotId)
                if (startIdx === -1) return
                const span = session.span || 1

                let chosenTrack = 0
                for (let track = 0; track < trackOccupancy.length; track++) {
                  let canFit = true
                  for (let c = startIdx; c < startIdx + span; c++) {
                    if (trackOccupancy[track].has(c)) {
                      canFit = false
                      break
                    }
                  }
                  if (canFit) {
                    chosenTrack = track
                    break
                  }
                }

                if (chosenTrack >= trackOccupancy.length) {
                  trackOccupancy.push(new Set())
                  chosenTrack = trackOccupancy.length - 1
                }

                for (let c = startIdx; c < startIdx + span; c++) {
                  trackOccupancy[chosenTrack].add(c)
                }
                sessionTracks.set(session.id, chosenTrack)
              })

              const hasTrack1 = trackOccupancy[1] && trackOccupancy[1].size > 0
              const rowHeightClass = isWeekend
                ? 'min-h-[80px]'
                : hasTrack1
                ? 'min-h-[148px]'
                : 'min-h-[92px]'

              return (
                <div
                  key={day.id}
                  className={`flex ${rowHeightClass} transition-colors relative ${
                    isToday
                      ? 'bg-emerald-500/10 dark:bg-emerald-950/20 ring-1 ring-emerald-500/40 z-10'
                      : isHoliday
                      ? 'bg-amber-50/10 dark:bg-amber-950/10'
                      : isWeekend
                      ? 'bg-zinc-100/40 dark:bg-zinc-900/30'
                      : ''
                  }`}
                >
                  {/* Left Sticky Day Axis with High-Contrast Dual Dates */}
                  <div
                    className={`w-48 shrink-0 border-r p-4 flex flex-col justify-between sticky left-0 z-20 shadow-xs ${
                      isToday
                        ? 'border-l-4 border-l-emerald-500 bg-emerald-50/95 dark:bg-zinc-900/98 border-r-emerald-500/50'
                        : isHoliday
                        ? 'border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/95 dark:bg-zinc-950/95 border-l-4 border-l-amber-500'
                        : isWeekend
                        ? 'border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-100/90 dark:bg-zinc-900/80'
                        : 'border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/90 dark:bg-zinc-950/90'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h4
                          className={`text-base font-extrabold ${
                            isToday
                              ? 'text-emerald-900 dark:text-emerald-100'
                              : isHoliday
                              ? 'text-amber-900 dark:text-amber-200'
                              : isWeekend
                              ? 'text-zinc-600 dark:text-zinc-400'
                              : 'text-zinc-950 dark:text-white'
                          }`}
                        >
                          {day.label}
                        </h4>
                        {isToday && (
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                        )}
                      </div>

                      <div
                        className={`text-xs font-mono font-bold mt-0.5 ${
                          isToday
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : isHoliday
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        {day.nepaliName}
                      </div>

                      {/* BOTH NEPALI & ENGLISH DATES */}
                      {dayDateInfo && (
                        <div className="flex items-center gap-1.5 text-xs font-mono mt-1.5 font-bold">
                          <span className="text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-200/60 dark:border-amber-800/60">
                            {dayDateInfo.formattedNp}
                          </span>
                          <span className="text-zinc-400">•</span>
                          <span className="text-zinc-600 dark:text-zinc-300">
                            {dayDateInfo.formattedEng}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mt-2" suppressHydrationWarning>
                      {isToday ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-emerald-500/25 text-emerald-900 dark:text-emerald-200 border border-emerald-500/80 shadow-[0_0_10px_rgba(16,185,129,0.25)]">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          TODAY
                        </span>
                      ) : isHoliday ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-500/40 shadow-xs truncate max-w-full">
                          <Palmtree className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span className="truncate">{dayHoliday.name || dayHoliday.title}</span>
                        </span>
                      ) : isWeekend ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                          <Palmtree className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                          Weekend Recess
                        </span>
                      ) : (
                        <span suppressHydrationWarning className="text-[11px] font-mono font-semibold text-zinc-500 dark:text-zinc-400">
                          {daySchedules.length} Sessions
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 10-Column Multi-Track Grid Body OR Whole-Day Suspension Banner */}
                  {(() => {
                    const isWholeDaySuspended =
                      isHoliday ||
                      isWeekend ||
                      (day.id === 'fri' && daySchedules.length === 0)

                    if (isWholeDaySuspended) {
                      const holidayName = (dayHoliday as any)?.name || (dayHoliday as any)?.title || 'Official Gazetted Holiday'

                      return (
                        <div
                          className={`flex-1 flex items-center justify-between px-6 sm:px-8 py-5 border-b relative overflow-hidden transition-all ${
                            isHoliday
                              ? 'bg-gradient-to-r from-amber-500/[0.09] via-amber-500/[0.04] to-emerald-500/[0.05] dark:from-amber-950/35 dark:via-zinc-900/40 dark:to-emerald-950/20 border-amber-500/30'
                              : isWeekend
                              ? 'bg-gradient-to-r from-zinc-100/70 via-zinc-50/40 to-zinc-100/70 dark:from-zinc-900/50 dark:via-zinc-900/20 dark:to-zinc-900/50 border-zinc-200/80 dark:border-zinc-800/80'
                              : 'bg-gradient-to-r from-indigo-500/[0.06] via-indigo-500/[0.03] to-purple-500/[0.05] dark:from-indigo-950/30 dark:via-zinc-900/40 dark:to-purple-950/20 border-indigo-500/30'
                          }`}
                        >
                          {/* Ambient Gold/Amber Glow behind text */}
                          <div className="absolute left-16 top-1/2 -translate-y-1/2 w-80 h-32 bg-amber-500/10 dark:bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

                          {/* Left: Holiday Icon + Title + Operational Explanation */}
                          <div className="flex items-center gap-4 relative z-10">
                            <div
                              className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform ${
                                isHoliday
                                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-amber-500/10'
                                  : isWeekend
                                  ? 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700'
                                  : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 shadow-indigo-500/10'
                              }`}
                            >
                              {isHoliday ? (
                                <Landmark className="h-6 w-6" />
                              ) : isWeekend ? (
                                <Coffee className="h-6 w-6" />
                              ) : (
                                <Sparkles className="h-6 w-6" />
                              )}
                            </div>

                            <div className="space-y-0.5">
                              <div className="flex flex-wrap items-center gap-2.5">
                                <h3 className="text-sm sm:text-base font-heading font-black text-zinc-950 dark:text-white tracking-tight">
                                  {isHoliday
                                    ? holidayName
                                    : day.id === 'fri'
                                    ? 'Academic Review & Practical Catch-up'
                                    : 'Institutional Weekend Recess'}
                                </h3>

                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${
                                    isHoliday
                                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                                      : isWeekend
                                      ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700'
                                      : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30'
                                  }`}
                                >
                                  {isHoliday ? 'Gazetted Public Holiday' : day.id === 'fri' ? 'Review Window' : 'Weekend Recess'}
                                </span>

                                {isToday && (
                                  <span className="px-2 py-0.2 rounded-full text-[9px] font-mono font-black bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40">
                                    TODAY
                                  </span>
                                )}
                              </div>

                              <p className="text-xs text-zinc-600 dark:text-zinc-400 font-sans max-w-3xl leading-relaxed">
                                {isHoliday
                                  ? `All laboratory practicals, student attendance tallies, and instructor session logs are suspended for ${holidayName}. Routine timetable resumes on the next scheduled academic day.`
                                  : day.id === 'fri'
                                  ? 'Friday timetable allocated for faculty syllabus reviews, student clubs, and practical makeup sessions.'
                                  : 'Weekly scheduled institutional recess. Laboratory facilities secured and offline.'}
                              </p>
                            </div>
                          </div>

                          {/* Right: Operational Directives / Micro-Pills */}
                          <div className="hidden md:flex items-center gap-2.5 font-mono text-xs shrink-0 relative z-10">
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs backdrop-blur-xs">
                              <span className="h-2 w-2 rounded-full bg-emerald-500" />
                              <span className="text-zinc-700 dark:text-zinc-300 font-medium text-[11px]">
                                Attendance Not Required
                              </span>
                            </div>

                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs backdrop-blur-xs">
                              <Wrench className="h-3.5 w-3.5 text-indigo-500" />
                              <span className="text-zinc-700 dark:text-zinc-300 font-medium text-[11px]">
                                Maintenance Access Open
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    }

                    return (
                      <div
                        suppressHydrationWarning
                        className={`flex-1 grid grid-cols-10 divide-x relative ${
                          isToday
                            ? 'divide-emerald-500/30 dark:divide-emerald-500/20'
                            : 'divide-zinc-200/80 dark:divide-zinc-800/60'
                        }`}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(10, minmax(0, 1fr))',
                          gridTemplateRows: hasTrack1 ? 'minmax(68px, 1fr) minmax(68px, 1fr)' : 'minmax(84px, 1fr)',
                        }}
                      >
                        {/* Background Grid Cells */}
                        {MASTER_TIME_SLOTS.map((slot, slotIdx) => {
                          const isSlotActive = isToday && activeSlotId === slot.id
                          const isBreak = slot.id === 't6'
                          const isOccupiedOnTrack0 = trackOccupancy[0].has(slotIdx)
                          const isOccupiedOnTrack1 = trackOccupancy[1] ? trackOccupancy[1].has(slotIdx) : false
                          const isSlotOccupied = isOccupiedOnTrack0 || isOccupiedOnTrack1

                          return (
                            <div
                              key={`bg-${day.id}-${slot.id}`}
                              style={{
                                gridColumnStart: slotIdx + 1,
                                gridColumnEnd: slotIdx + 2,
                                gridRowStart: 1,
                                gridRowEnd: hasTrack1 ? 3 : 2,
                              }}
                              className={`group/cell relative transition-colors ${
                                isBreak
                                  ? 'bg-amber-50/25 dark:bg-amber-950/15 flex items-center justify-center'
                                  : isSlotActive
                                  ? 'bg-emerald-500/10 dark:bg-emerald-950/25 ring-1 ring-inset ring-emerald-500/30'
                                  : isWeekend
                                  ? 'bg-zinc-100/30 dark:bg-zinc-900/20'
                                  : isHoliday
                                  ? 'bg-amber-500/5 dark:bg-amber-950/10 hover:bg-amber-500/10'
                                  : 'hover:bg-zinc-50/90 dark:hover:bg-zinc-900/50'
                              }`}
                            >
                              {isBreak ? (
                                !isSlotOccupied ? (
                                  <div className="flex flex-col items-center justify-center text-amber-600 dark:text-amber-400 font-mono text-[10px] font-bold pointer-events-none">
                                    <Coffee className="h-4 w-4 mb-0.5 opacity-80" />
                                    <span>RECESS</span>
                                  </div>
                                ) : null
                              ) : isHoliday ? (
                                <div className="flex flex-col items-center justify-center h-full text-amber-700/35 dark:text-amber-400/35 font-mono text-[9px] font-bold pointer-events-none p-1 text-center select-none">
                                  <Palmtree className="h-3 w-3 mb-0.5 opacity-40" />
                                  <span>RECESS</span>
                                </div>
                              ) : isWeekend ? (
                                <div className="flex items-center justify-center h-full opacity-30 pointer-events-none">
                                  <Lock className="h-3.5 w-3.5 text-zinc-400" />
                                </div>
                              ) : (
                                /* Quick-Add Button on Empty Working Slots */
                                mounted && !isOccupiedOnTrack0 && (
                                  <button
                                    onClick={() => handleQuickAdd(day.id, slot.id)}
                                    className="opacity-0 group-hover/cell:opacity-100 transition-opacity absolute inset-0 m-2 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white/90 dark:bg-zinc-900/90 text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center gap-1.5 text-xs font-mono font-bold shadow-sm backdrop-blur-md cursor-pointer"
                                    title={`Book practical slot on ${day.label} (${slot.name})`}
                                  >
                                    <Plus className="h-4 w-4 text-indigo-500" />
                                    <span>{currentUser?.role === 'teacher' ? 'Request Slot' : 'Book Slot'}</span>
                                  </button>
                                )
                              )}
                            </div>
                          )
                        })}

                        {/* Allocated Session Cards */}
                        {daySchedules.map((session) => {
                          const startIdx = MASTER_TIME_SLOTS.findIndex((t) => t.id === session.slotId)
                          if (startIdx === -1) return null

                          const span = session.span || 1
                          const trackIdx = sessionTracks.get(session.id) || 0
                          const isMultiPeriod = span > 1
                          const isLiveNow = isToday && activeSlotId === session.slotId
                          const activeSub = getSubForSession(session.id, dayDateInfo?.dateStr || '')

                          const isSkipped = Boolean(session.isSkipped || session.status === 'skipped')
                          const isRequested = session.status === 'requested'
                          const isHolidaySession = isHoliday
                          const isHighlighted = isSessionHighlighted(session)

                          const isComp = session.lab.toLowerCase().includes('comp') || session.labKey === 'comp'
                          const isPhys = session.lab.toLowerCase().includes('phys') || session.labKey === 'phys'
                          const isChem = session.lab.toLowerCase().includes('chem') || session.labKey === 'chem'

                          return (
                            <div
                              key={session.id}
                              onClick={() => {
                                if (isHolidaySession) {
                                  const holidayTitle = (dayHoliday as any)?.name || (dayHoliday as any)?.title || 'Academic Recess'
                                  setToastMessage(`Practical session automatically cancelled for ${holidayTitle}. Session actions and logging are disabled on holidays.`)
                                  setTimeout(() => setToastMessage(null), 3500)
                                  return
                                }
                                openActionModal(session, 'log')
                              }}
                              onMouseEnter={() => !isHolidaySession && setHoveredSession(session)}
                              onMouseLeave={() => !isHolidaySession && setHoveredSession(null)}
                              style={{
                                gridColumnStart: startIdx + 1,
                                gridColumnEnd: startIdx + 1 + span,
                                gridRowStart: trackIdx + 1,
                                gridRowEnd: trackIdx + 2,
                                zIndex: 10,
                              }}
                              className={`m-1 p-2 sm:p-2.5 rounded-xl border-l-4 transition-all duration-200 flex flex-col justify-between overflow-hidden relative group backdrop-blur-md cursor-pointer ${
                                !isHighlighted
                                  ? 'opacity-25 grayscale-[30%] hover:opacity-90'
                                  : ''
                              } ${
                                isHolidaySession
                                  ? 'grayscale opacity-35 bg-zinc-100/90 dark:bg-zinc-900/90 border border-zinc-200/90 dark:border-zinc-800/90 text-zinc-500 dark:text-zinc-400 select-none cursor-not-allowed shadow-none'
                                  : isSkipped
                                  ? 'grayscale opacity-40 hover:opacity-85 bg-zinc-100/90 dark:bg-zinc-900/90 border-2 border-dashed border-zinc-400 dark:border-zinc-600 text-zinc-500 dark:text-zinc-400 shadow-none'
                                  : isRequested
                                  ? 'border-2 border-dashed border-amber-500 bg-amber-50/90 dark:bg-amber-950/50 hover:dark:bg-amber-950/70 text-zinc-950 dark:text-white shadow-[0_0_15px_rgba(245,158,11,0.25)] hover:shadow-[0_0_25px_rgba(245,158,11,0.45)] ring-1 ring-amber-500/40'
                                  : isLiveNow
                                  ? 'ring-2 ring-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.45)] scale-[1.02]'
                                  : 'shadow-xs hover:shadow-xl hover:scale-[1.02]'
                              } ${
                                !isSkipped && !isHolidaySession && !isRequested && isMultiPeriod
                                  ? 'border-l-violet-500 bg-violet-50/90 dark:bg-violet-950/60 hover:dark:bg-violet-950/80 text-zinc-950 dark:text-white border border-violet-200 dark:border-violet-500/50 shadow-[0_0_15px_rgba(139,92,246,0.15)] hover:shadow-[0_0_25px_rgba(139,92,246,0.4)]'
                                  : !isSkipped && !isHolidaySession && !isRequested && isComp
                                  ? 'border-l-indigo-500 bg-indigo-50/90 dark:bg-indigo-950/50 hover:dark:bg-indigo-950/70 text-zinc-950 dark:text-white border border-indigo-200 dark:border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.15)] hover:shadow-[0_0_25px_rgba(99,102,241,0.4)]'
                                  : !isSkipped && !isHolidaySession && !isRequested && isPhys
                                  ? 'border-l-cyan-500 bg-cyan-50/90 dark:bg-cyan-950/50 hover:dark:bg-cyan-950/70 text-zinc-950 dark:text-white border border-cyan-200 dark:border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)] hover:shadow-[0_0_25px_rgba(6,182,212,0.4)]'
                                  : !isSkipped && !isHolidaySession && !isRequested && isChem
                                  ? 'border-l-rose-500 bg-rose-50/90 dark:bg-rose-950/50 hover:dark:bg-rose-950/70 text-zinc-950 dark:text-white border border-rose-200 dark:border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.15)] hover:shadow-[0_0_25px_rgba(244,63,94,0.4)]'
                                  : !isSkipped && !isHolidaySession && !isRequested
                                  ? 'border-l-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/50 hover:dark:bg-emerald-950/70 text-zinc-950 dark:text-white border border-emerald-200 dark:border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)]'
                                  : ''
                              }`}
                            >
                              <div className="flex-1 flex flex-col justify-between overflow-hidden">
                                {/* Line 1: Subject Code on left & Class Badge on right */}
                                <div className="flex items-center justify-between gap-1 mb-1">
                                  <span
                                    className={`text-xs sm:text-sm font-heading font-black tracking-tight truncate ${
                                      isSkipped || isHolidaySession
                                        ? 'line-through text-zinc-400 dark:text-zinc-500'
                                        : 'text-zinc-950 dark:text-white'
                                    }`}
                                  >
                                    {session.subjectCode}
                                  </span>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-zinc-900/10 dark:bg-white/15 text-zinc-900 dark:text-zinc-100 border border-zinc-900/10 dark:border-white/10">
                                      {session.grade.replace(/Class\s*/gi, '').trim() || session.grade}
                                    </span>

                                    {isSkipped ? (
                                      <span className="px-1 py-0.2 rounded text-[8px] font-mono bg-zinc-600 text-white font-bold">
                                        SKIP
                                      </span>
                                    ) : isRequested ? (
                                      <span className="px-1 py-0.2 rounded text-[8px] font-mono bg-amber-500 text-white font-bold animate-pulse">
                                        PEND
                                      </span>
                                    ) : isLiveNow ? (
                                      <span className="px-1.5 py-0.2 rounded text-[8px] font-mono bg-emerald-500 text-white font-black flex items-center gap-0.5 animate-pulse">
                                        <Radio className="h-2 w-2" />
                                        LIVE
                                      </span>
                                    ) : isMultiPeriod ? (
                                      <span className="px-1 py-0.2 rounded text-[8px] font-mono bg-violet-600 text-white font-bold">
                                        {span}P
                                      </span>
                                    ) : null}
                                  </div>
                                </div>

                                {/* Middle: Subject Practical Title / Topic */}
                                {session.subjectTitle && (
                                  <div
                                    className={`text-[11px] font-medium truncate my-0.5 leading-tight ${
                                      isSkipped || isHolidaySession
                                        ? 'text-zinc-500 dark:text-zinc-500 line-through'
                                        : 'text-zinc-600 dark:text-zinc-300'
                                    }`}
                                    title={session.subjectTitle}
                                  >
                                    {session.subjectTitle}
                                  </div>
                                )}

                                {/* Holiday Reason Overlay */}
                                {isHolidaySession && (
                                  <div className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-200/70 dark:bg-zinc-800/80 px-2 py-0.5 rounded my-0.5 truncate border border-zinc-300/50 dark:border-zinc-700/50 font-medium flex items-center gap-1.5">
                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                                    <span className="truncate">Cancelled: {(dayHoliday as any)?.name || (dayHoliday as any)?.title || 'Academic Recess'}</span>
                                  </div>
                                )}

                                {/* Skipped Reason Banner */}
                                {isSkipped && session.skippedReason && (
                                  <div className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-200/70 dark:bg-zinc-800/80 px-1.5 py-0.5 rounded my-0.5 truncate">
                                    Reason: {session.skippedReason}
                                  </div>
                                )}

                                {/* Requested By Banner & Quick Approve/Decline for Admin */}
                                {isRequested && !isHolidaySession && (
                                  <div className="my-0.5 space-y-1">
                                    <div className="text-[10px] font-mono font-bold text-amber-800 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-900/60 px-1.5 py-0.5 rounded border border-amber-300/60 dark:border-amber-700/60 truncate">
                                      Requested by: {session.requestedBy || session.teacher}
                                    </div>

                                    {canApprove && (
                                      <div
                                        className="flex items-center gap-1 pt-0.5 font-mono text-[10px]"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <button
                                          type="button"
                                          onClick={() => {
                                            approveSlotBooking(session.id)
                                            handleSuccess(`Approved practical slot for ${session.teacher}`)
                                          }}
                                          className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1 shadow-xs transition-colors"
                                          title="Approve Slot Booking"
                                        >
                                          <Check className="h-2.5 w-2.5" />
                                          <span>Approve</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setDeclineSessionId(session.id)
                                            setIsDeclineModalOpen(true)
                                          }}
                                          className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center gap-1 shadow-xs transition-colors"
                                          title="Decline Slot Booking with Reason"
                                        >
                                          <X className="h-2.5 w-2.5" />
                                          <span>Decline</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {activeSub && (
                                  <div className="flex items-center gap-1 text-[10px] font-mono text-indigo-700 dark:text-indigo-300 bg-indigo-100/90 dark:bg-indigo-950/90 px-1.5 py-0.5 rounded border border-indigo-300/70 dark:border-indigo-800/70 my-0.5 font-bold">
                                    <UserCheck className="h-3 w-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                    <span className="truncate">Sub: {activeSub.substitute_teacher_name}</span>
                                  </div>
                                )}
                              </div>

                              {/* Line 2: Teacher Name & Contextual Badge */}
                              <div className="flex items-center justify-between text-[11px] font-mono mt-auto pt-1 border-t border-zinc-200/50 dark:border-zinc-700/50 gap-1">
                                <span
                                  className="truncate font-medium text-zinc-700 dark:text-zinc-300 text-[10.5px]"
                                  title={activeSub?.substitute_teacher_name || session.teacher}
                                >
                                  {activeSub ? (
                                    <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                                      {activeSub.substitute_teacher_name.split(' ').slice(-1)[0]} (Proxy)
                                    </span>
                                  ) : (
                                    session.teacher.replace(/-Teacher$/i, ' Staff').replace(/ & /g, ' + ')
                                  )}
                                </span>

                                {isMultiPeriod ? (
                                  <span className="shrink-0 text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/20">
                                    {session.timeSlot.split(' - ')[0]}–{session.timeSlot.split(' - ')[1]}
                                  </span>
                                ) : (
                                  <span className="shrink-0 text-[9px] font-mono text-zinc-400">
                                    {session.labKey === 'comp' ? 'Lab 01' : session.labKey.toUpperCase()}
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Session Action Modal */}
      <SessionActionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        session={selectedSession}
        allRoutines={routines}
        initialMode={modalMode}
        currentUser={currentUser}
        onSuccess={handleSuccess}
        onDeleteSession={deleteSession}
        onExtendSession={extendSession}
        onMergeSession={mergeSession}
        onUnmergeSession={unmergeSession}
        onAddSession={currentUser?.role === 'teacher' ? (s) => requestSlotBooking(s, currentUser.full_name) : addSession}
        onSkipSession={(sessionId, reason) => skipSession(sessionId, reason, currentUser?.full_name || 'Subject Teacher')}
        onUnskipSession={unskipSession}
      />

      {/* Decline Reason Modal for Super Admin & Lab Incharge */}
      {isDeclineModalOpen && declineSessionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in select-none">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-4 font-mono">
            <div className="flex items-center justify-between border-b pb-3 border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-500" />
                <h3 className="text-sm font-bold text-zinc-950 dark:text-white">Decline Slot Booking Request</h3>
              </div>
              <button
                onClick={() => setIsDeclineModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Specify the operational reason for declining this practical slot. An alert notification will be dispatched to the subject teacher.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Preset Operational Reason:</label>
              <select
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                className="w-full p-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none"
              >
                <option value="Lab occupied for senior exams">Lab occupied for senior exams</option>
                <option value="Equipment under scheduled maintenance">Equipment under scheduled maintenance</option>
                <option value="Chemical inventory shortage">Chemical inventory shortage</option>
                <option value="Time slot collision with another practical">Time slot collision with another practical</option>
                <option value="Other">Custom Reason (specify below)</option>
              </select>
            </div>

            {declineReason === 'Other' && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Custom Reason Details:</label>
                <input
                  type="text"
                  value={customDeclineReason}
                  onChange={(e) => setCustomDeclineReason(e.target.value)}
                  placeholder="e.g. System upgrade during period 3"
                  className="w-full p-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDeclineModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const finalReason = declineReason === 'Other' ? (customDeclineReason || 'Declined by Admin') : declineReason
                  rejectSlotBooking(declineSessionId, finalReason)
                  setIsDeclineModalOpen(false)
                  handleSuccess('Slot request declined and subject teacher notified.')
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors"
              >
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
