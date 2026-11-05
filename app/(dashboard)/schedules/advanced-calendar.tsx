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
  Building2,
  Loader2,
} from 'lucide-react'
import {
  MasterRoutineItem,
  getOrderedDays,
  getWeekDates,
  DayKey,
  formatCleanSubjectCode,
  formatSubjectHeading,
  cleanSubjectTitle,
  isDateWithinHoliday,
  getOccupiedLabsInSlot,
  CANONICAL_PERIOD_SLOTS,
} from '@/lib/master-data'
import SessionActionModal, { ModalMode } from '@/components/schedules/session-action-modal'
import { useLiveSchedule } from '@/hooks/use-live-schedule'
import { useRoutineState } from '@/hooks/use-routine-state'
import { useCalendarSettings } from '@/hooks/use-calendar-settings'
import { useSubstitutionState } from '@/hooks/use-substitution-state'
import { useInfrastructureState } from '@/hooks/use-infrastructure-state'
import { getNepaliDate } from '@/lib/nepali-date'
import { UserProfile } from '@/app/actions/auth'

interface AdvancedCalendarProps {
  labFilter?: string
  teacherFilter?: string
  currentUser?: UserProfile | null
  weekOffset?: number
  focusSlotId?: string | null
  initialCalendarSettings?: import('@/hooks/use-calendar-settings').CalendarSettings | null
}

export default function AdvancedCalendar({
  labFilter = 'all',
  teacherFilter = 'all',
  currentUser = null,
  weekOffset = 0,
  focusSlotId = null,
  initialCalendarSettings = null,
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
  } = useCalendarSettings(initialCalendarSettings)

  const { holidays, labs, periods, subjects } = useInfrastructureState()
  const activeSlots = periods && periods.length > 0 ? periods : CANONICAL_PERIOD_SLOTS

  // Calculate Base Date according to week offset
  const baseDate = useMemo(() => {
    const d = new Date(now)
    d.setDate(d.getDate() + weekOffset * 7)
    return d
  }, [now, weekOffset])

  const currentBsYear = useMemo(() => getNepaliDate(baseDate).bsYear, [baseDate])

  const orderedDays = getOrderedDays(startDay)
  const displayedDays = useMemo(() => {
    if (sundayWeekend && saturdayWeekend) {
      return orderedDays.filter((d) => d.id !== 'sat' && d.id !== 'sun')
    }
    if (saturdayWeekend && !sundayWeekend) {
      return orderedDays.filter((d) => d.id !== 'sat')
    }
    return orderedDays
  }, [orderedDays, sundayWeekend, saturdayWeekend])
  const weekDates = getWeekDates(baseDate, startDay)

  const {
    routines,
    addSession,
    updateSession,
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
  const [isSubmittingDecline, setIsSubmittingDecline] = useState(false)
  const [declineError, setDeclineError] = useState<string | null>(null)
  const [mobileDayKey, setMobileDayKey] = useState<DayKey>(() => (currentDayKey && currentDayKey !== 'sun' && currentDayKey !== 'sat') ? (currentDayKey as DayKey) : 'mon')

  useEffect(() => {
    if (displayedDays.length > 0 && !displayedDays.some((d) => d.id === mobileDayKey)) {
      setMobileDayKey(displayedDays[0].id)
    }
  }, [displayedDays, mobileDayKey])

  const handleConfirmDecline = async () => {
    if (!declineSessionId) return
    setIsSubmittingDecline(true)
    setDeclineError(null)
    try {
      const finalReason = declineReason === 'Other' ? (customDeclineReason || 'Declined by Admin') : declineReason
      await rejectSlotBooking(declineSessionId, finalReason)
      setIsDeclineModalOpen(false)
      handleSuccess('Slot request declined and subject teacher notified.')
    } catch (err: any) {
      setDeclineError(err?.message || 'Failed to decline slot booking request.')
    } finally {
      setIsSubmittingDecline(false)
    }
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (currentDayKey) {
      setMobileDayKey(currentDayKey as DayKey)
    }
  }, [currentDayKey])

  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null)
  // Auto-focus and open review modal when linked from notification
  useEffect(() => {
    if (!focusSlotId || !routines || routines.length === 0) return
    const target = routines.find((r) => r.id === focusSlotId)
    if (target && target.status === 'requested') {
      const effDate = target.specificDate || target.date || undefined
      openActionModal(target, 'log', effDate)
    }
  }, [focusSlotId, routines])


  const openActionModal = (session: MasterRoutineItem, mode: ModalMode = 'log', dateStr?: string) => {
    const effDate = dateStr || session.date || session.specificDate || null
    setSelectedDateStr(effDate)
    setSelectedSession(effDate ? { ...session, date: effDate, specificDate: session.specificDate || effDate } : session)
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

    const slot = activeSlots.find((t) => t.id === slotId)
    const timeSlot = slot?.label || '10:10 - 11:00'
    const dayObj = orderedDays.find((d) => d.id === dayKey)
    const dayLabel = (dayObj?.label as any) || 'Monday'
    const isTeacherRole = currentUser?.role === 'teacher'

    const occupiedLabs = getOccupiedLabsInSlot(filteredRoutine, dayKey, slotId)
    // Select first unoccupied active lab from infrastructure facilities
    const activeLabs = labs.filter((l) => l.is_active !== false)
    const availableLab = activeLabs.find((l) => !occupiedLabs.has(l.id as any)) || activeLabs[0] || {
      id: 'comp',
      name: 'Computer Lab',
    }

    // Match real curriculum subject for this lab or fallback to first active subject
    const matchingSubject = subjects.find((s) => s.labId === availableLab.id) || subjects[0]

    const adhocSession: MasterRoutineItem = {
      id: `adhoc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      day: dayLabel,
      dayKey,
      timeSlot,
      slotId,
      span: 1,
      subjectCode: matchingSubject?.code || 'PRACTICAL',
      subjectTitle: matchingSubject?.title || 'Laboratory Practical',
      grade: matchingSubject?.grade || 'Class 12',
      gradeKey: ('class-' + ((matchingSubject?.grade || '12').replace(/\D/g, '') || '12')) as MasterRoutineItem['gradeKey'],
      teacher: isTeacherRole ? (currentUser?.full_name || 'Practical Subject Teacher') : (matchingSubject?.teacherName || 'Assigned Subject Teacher'),
      teacherId: isTeacherRole ? (currentUser?.id || null) : (matchingSubject?.teacherId || null),
      date: targetDateInfo?.dateStr,
      specificDate: targetDateInfo?.dateStr,
      isAdHoc: true,
      lab: availableLab.name as any,
      labKey: availableLab.id as any,
      defaultStudents: 38,
      category: availableLab.id === 'comp' ? 'Computer' : availableLab.id === 'phys' ? 'Physics' : availableLab.id === 'chem' ? 'Chemistry' : 'Biology',
      dotColor: availableLab.id === 'comp' ? 'bg-indigo-500' : availableLab.id === 'phys' ? 'bg-cyan-500' : availableLab.id === 'chem' ? 'bg-rose-500' : 'bg-emerald-500',
      badgeColor: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700',
      accentColor:
        'border-l-indigo-500 bg-indigo-50/90 dark:bg-indigo-950/50 text-zinc-950 dark:text-white border-indigo-200 dark:border-indigo-500/30',
    }

    setSelectedDateStr(targetDateInfo?.dateStr || null)
    setSelectedSession(adhocSession)
    setModalMode('book')
    setIsModalOpen(true)
  }

  const handleSuccess = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 4000)
  }

  const getLabDisplayCode = (labKey?: string, labCode?: string, labName?: string): string => {
    if (labs && labs.length > 0) {
      const matched = labs.find(
        (l) =>
          (labKey && l.id.toLowerCase() === labKey.toLowerCase()) ||
          (labKey && l.code.toLowerCase() === labKey.toLowerCase()) ||
          (labCode && l.code.toLowerCase() === labCode.toLowerCase()) ||
          (labName && l.name.toLowerCase() === labName.toLowerCase()) ||
          (labName && l.id.toLowerCase() === labName.toLowerCase())
      )
      if (matched?.code) return matched.code
    }
    if (labCode && labCode !== 'Lab 01') return labCode
    const k = (labKey || '').toLowerCase().trim()
    if (k === 'comp') return 'COMP-LAB'
    if (k === 'phys') return 'LAB-PHYS-01'
    if (k === 'chem') return 'LAB-CHEM-01'
    if (k === 'bio') return 'LAB-BIO-01'
    if (k === 'elec') return 'LAB-ELEC-01'
    return k ? k.toUpperCase() : 'LAB'
  }

  const getLabDisplayName = (labKey?: string, fallbackName?: string): string => {
    if (labs && labs.length > 0) {
      const matched = labs.find(
        (l) =>
          (labKey && l.id.toLowerCase() === labKey.toLowerCase()) ||
          (labKey && l.code.toLowerCase() === labKey.toLowerCase()) ||
          (fallbackName && l.name.toLowerCase() === fallbackName.toLowerCase()) ||
          (fallbackName && l.id.toLowerCase() === fallbackName.toLowerCase())
      )
      if (matched?.name) return matched.name
    }
    return fallbackName || 'Laboratory'
  }

  const getCompactLabName = (key?: string) => {
    if (!key) return ''
    if (labs && labs.length > 0) {
      const matched = labs.find(
        (l) => l.id.toLowerCase() === key.toLowerCase() || l.code.toLowerCase() === key.toLowerCase()
      )
      if (matched?.code) return matched.code
    }
    const k = key.toLowerCase().trim()
    if (k === 'comp') return 'COMP'
    if (k === 'phys') return 'PHY'
    if (k === 'chem') return 'CHM'
    if (k === 'bio') return 'BIO'
    if (k === 'elec') return 'ELC'
    return k.slice(0, 4).toUpperCase()
  }

  // ACCURATE LAB & TEACHER FILTER: Keep full routine on grid and highlight matching sessions
  const isSessionHighlighted = (item: MasterRoutineItem): boolean => {
    // 1. Lab Filter Check (supports primary or secondary multi-lab facility)
    if (labFilter !== 'all') {
      const matchComp = labFilter === 'comp' && (item.labKey === 'comp' || item.lab.toLowerCase().includes('comp') || (item.isDualLab && (item.secondaryLabKey === 'comp' || (item.secondaryLab || '').toLowerCase().includes('comp'))))
      const matchPhys = labFilter === 'phys' && (item.labKey === 'phys' || item.lab.toLowerCase().includes('phys') || (item.isDualLab && (item.secondaryLabKey === 'phys' || (item.secondaryLab || '').toLowerCase().includes('phys'))))
      const matchChem = labFilter === 'chem' && (item.labKey === 'chem' || item.lab.toLowerCase().includes('chem') || (item.isDualLab && (item.secondaryLabKey === 'chem' || (item.secondaryLab || '').toLowerCase().includes('chem'))))
      const matchBio = labFilter === 'bio' && (item.labKey === 'bio' || item.lab.toLowerCase().includes('bio') || (item.isDualLab && (item.secondaryLabKey === 'bio' || (item.secondaryLab || '').toLowerCase().includes('bio'))))
      const matchOther = !['comp', 'phys', 'chem', 'bio'].includes(labFilter) && (item.labKey === labFilter || (item.isDualLab && item.secondaryLabKey === labFilter))
      if (!matchComp && !matchPhys && !matchChem && !matchBio && !matchOther) return false
    }

    // 2. Subject Teacher Filter Check (Relational ID match + exact name match)
    if (teacherFilter && teacherFilter !== 'all') {
      if (teacherFilter === 'my_sessions') {
        const userId = currentUser?.id
        const userFullName = currentUser?.full_name?.toLowerCase().trim()
        const isAssigned = (userId && item.teacherId === userId) || (userFullName && item.teacher.toLowerCase().trim() === userFullName)
        const isRequested = Boolean(userFullName && item.requestedBy && item.requestedBy.toLowerCase().trim() === userFullName)
        if (!isAssigned && !isRequested) return false
      } else {
        if (item.teacher !== teacherFilter) return false
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
    <div className="flex flex-col h-full w-full bg-white/95 dark:bg-zinc-950/95 border border-zinc-200 dark:border-zinc-800/90 rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.06),0_1px_2px_-1px_rgba(0,0,0,0.06)] overflow-hidden select-none relative backdrop-blur-xl">
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

      {/* ============================================================= */}
      {/* MOBILE DAY-BY-DAY CARD VIEW (md:hidden)                       */}
      {/* ============================================================= */}
      <div className="md:hidden flex flex-col flex-1 overflow-hidden relative z-10">
        {/* Day-by-Day Tab Pills */}
        <div className="flex items-center gap-1.5 p-2.5 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-sm shrink-0">
          {displayedDays.map((day) => {
            const isSelected = mobileDayKey === day.id
            const isToday = currentDayKey === day.id
            const dayDate = weekDates.find((w) => w.dayKey === day.id)
            return (
              <button
                key={day.id}
                type="button"
                onClick={() => setMobileDayKey(day.id)}
                className={`flex flex-col items-center px-3 py-1.5 rounded-xl text-xs font-heading transition-all shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white font-extrabold shadow-sm'
                    : 'bg-white dark:bg-zinc-800/90 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/80 hover:bg-zinc-100'
                }`}
              >
                <span className="font-bold uppercase tracking-wider text-[11px] flex items-center gap-1">
                  {day.label}
                  {isToday && (
                    <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-500 animate-pulse'}`} />
                  )}
                </span>
                {dayDate && (
                  <span className={`text-[10px] font-mono mt-0.5 ${isSelected ? 'text-indigo-100' : 'text-zinc-400'}`}>
                    {dayDate.dateStr.split('-').slice(1).join('/')}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Selected Day Content */}
        <div className="p-3 space-y-3 flex-1 overflow-y-auto">
          {(() => {
            const isWeekend = isDayOff(mobileDayKey)
            const dayDateInfo = weekDates.find((w) => w.dayKey === mobileDayKey)
            const dayHoliday = dayDateInfo ? holidays.find((h) => isDateWithinHoliday(dayDateInfo.dateStr, h)) : null

            if (isWeekend) {
              return (
                <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 text-center space-y-2 shadow-xs">
                  <Palmtree className="h-7 w-7 text-amber-500 mx-auto" />
                  <h4 className="text-sm font-heading font-extrabold text-zinc-900 dark:text-white">
                    Weekend Statutory Recess
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto">
                    Laboratory practical sessions and scheduled timetables are suspended on statutory weekends.
                  </p>
                </div>
              )
            }

            if (dayHoliday) {
              return (
                <div className="p-6 rounded-2xl border border-amber-300 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20 text-center space-y-2 shadow-xs">
                  <Sparkles className="h-7 w-7 text-amber-500 mx-auto" />
                  <h4 className="text-sm font-heading font-extrabold text-amber-900 dark:text-amber-200">
                    Institutional Holiday: {dayHoliday.name}
                  </h4>
                  <p className="text-xs text-amber-700 dark:text-amber-300 max-w-xs mx-auto">
                    Operations and practical attendance tallies are suspended on recognized institutional holidays.
                  </p>
                </div>
              )
            }

            const rawDaySchedules = filteredRoutine.filter((s) => {
              if (s.dayKey !== mobileDayKey) return false
              if (s.specificDate) {
                return s.specificDate === dayDateInfo?.dateStr
              }
              return true
            })
            const seenIds = new Set<string>()
            const daySessions = rawDaySchedules.filter((s) => {
              if (!s || !s.id || seenIds.has(s.id)) return false
              seenIds.add(s.id)
              return true
            })

            const sortedSessions = [...daySessions].sort((a, b) => {
              const aIdx = activeSlots.findIndex((t) => t.id === a.slotId)
              const bIdx = activeSlots.findIndex((t) => t.id === b.slotId)
              return aIdx - bIdx
            })

            if (sortedSessions.length === 0) {
              return (
                <div className="p-8 text-center rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/30">
                  <CalendarDays className="h-7 w-7 text-zinc-400 mx-auto mb-2" />
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                    No laboratory practical sessions scheduled for this day.
                  </p>
                </div>
              )
            }

            return (
              <div className="space-y-2.5">
                {sortedSessions.map((session) => {
                  const isLive = currentDayKey === mobileDayKey && activeSlotId === session.slotId
                  const activeSub = getSubForSession(session.id, dayDateInfo?.dateStr || '')
                  const isSkipped = session.status === 'skipped'
                  const isRequested = session.status === 'requested'

                  return (
                    <div
                      key={session.id}
                      onClick={() => {
                        openActionModal(session, 'log', dayDateInfo?.dateStr)
                      }}
                      className={`rounded-2xl border p-3.5 transition-all shadow-xs cursor-pointer active:scale-[0.99] space-y-2.5 ${
                        isLive
                          ? 'border-emerald-500/50 bg-emerald-50/40 dark:bg-emerald-950/20 ring-1 ring-emerald-500/30'
                          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 hover:border-indigo-500/40'
                      }`}
                    >
                      {/* Top Row: Time Range, Period, and Status Beacon */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100">
                          <Clock className="h-3.5 w-3.5 text-zinc-400" />
                          <span>{session.timeSlot}</span>
                          <span className="text-zinc-400">&bull;</span>
                          <span className="text-zinc-600 dark:text-zinc-400 font-sans text-[11px]">
                            {session.span && session.span > 1
                              ? `${session.span} Periods (${session.slotId.toUpperCase()})`
                              : session.slotId.toUpperCase()}
                          </span>
                        </div>

                        {isLive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-emerald-600 text-white shadow-xs animate-pulse">
                            <span className="h-1.5 w-1.5 rounded-full bg-white" />
                            LIVE NOW
                          </span>
                        ) : isSkipped ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            Skipped
                          </span>
                        ) : isRequested ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            Requested
                          </span>
                        ) : null}
                      </div>

                      {/* Middle Row: Subject Title & Grade */}
                      <div>
                        <h4 className="font-heading font-extrabold text-sm text-zinc-900 dark:text-white leading-snug">
                          {formatSubjectHeading(session.subjectCode, session.subjectTitle)}
                        </h4>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold font-sans bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                            {session.grade}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-medium font-sans bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                            {getLabDisplayName(session.labKey, session.lab)}
                          </span>
                        </div>
                      </div>

                      {/* Bottom Row: Faculty & Action Hint */}
                      <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-xs">
                        <span className="text-zinc-600 dark:text-zinc-400 font-medium">
                          {activeSub ? (
                            <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                              {activeSub.substitute_teacher_name} (Proxy)
                            </span>
                          ) : (
                            session.teacher
                          )}
                        </span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-semibold text-[11px]">
                          Tap to Manage &rarr;
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      </div>

      {/* Main Grid Viewport (Desktop / Tablet: md:flex) */}
      <div className="hidden md:flex flex-1 w-full overflow-auto relative z-10">
        <div className="w-full min-w-[1540px] flex flex-col h-full">
          {/* Top Axis: Time Slots Header */}
          <div className="flex border-b border-zinc-200 dark:border-zinc-800/90 bg-zinc-50/95 dark:bg-zinc-900/95 sticky top-0 z-30 backdrop-blur-md w-full">
            {/* Axis Label */}
            <div className="w-48 shrink-0 border-r border-zinc-200 dark:border-zinc-800/90 p-3.5 flex items-center justify-between text-xs font-mono font-extrabold text-zinc-700 dark:text-zinc-200 uppercase tracking-wider sticky left-0 z-40 bg-zinc-50 dark:bg-zinc-900 shadow-xs">
              <span className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-indigo-500" />
                DAY // {currentBsYear}
              </span>
              <button
                onClick={resetToMaster}
                title="Reset Routine to Master Schedule"
                className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Period Slots */}
            <div
              className="flex-1 grid divide-x divide-zinc-200 dark:divide-zinc-800/80"
              style={{ gridTemplateColumns: `repeat(${activeSlots.length || 10}, minmax(0, 1fr))` }}
            >
              {activeSlots.map((slot) => {
                const isBreak = slot.id === 'break' || slot.id?.toLowerCase().includes('break') || slot.name?.toLowerCase().includes('break') || slot.name?.toLowerCase().includes('recess')
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

          {/* Day Rows in Configured Order (Recess days omitted when configured) */}
          <div suppressHydrationWarning className="flex-1 flex flex-col divide-y divide-zinc-200/80 dark:divide-zinc-800/80 w-full">
            {displayedDays.map((day) => {
              const isToday = weekOffset === 0 && currentDayKey === day.id
              const dayDateInfo = weekDates.find((w) => w.dayKey === day.id)
              const rawDaySchedules = filteredRoutine.filter((s) => {
                if (s.dayKey !== day.id) return false
                if (s.specificDate) {
                  return s.specificDate === dayDateInfo?.dateStr
                }
                return true
              })
              // Strict deduplication by session.id to guarantee 100% unique React keys
              const seenSessionIds = new Set<string>()
              const daySchedules = rawDaySchedules.filter((s) => {
                if (!s || !s.id || seenSessionIds.has(s.id)) return false
                seenSessionIds.add(s.id)
                return true
              })
              const isWeekend = isDayOff(day.id)
              const dayHoliday = dayDateInfo ? holidays.find((h) => isDateWithinHoliday(dayDateInfo.dateStr, h)) : null
              const isHoliday = !!dayHoliday

              // Multi-track allocation
              const sessionTracks = new Map<string, number>()
              const trackOccupancy: Array<Set<number>> = [new Set(), new Set()]

              const sortedSchedules = [...daySchedules].sort((a, b) => {
                const aIdx = activeSlots.findIndex((t) => t.id === a.slotId)
                const bIdx = activeSlots.findIndex((t) => t.id === b.slotId)
                return aIdx - bIdx
              })

              sortedSchedules.forEach((session) => {
                const startIdx = activeSlots.findIndex((t) => t.id === session.slotId)
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
                : 'min-h-[84px]'

              return (
                <div
                  key={day.id}
                  suppressHydrationWarning
                  className={`flex ${rowHeightClass} transition-colors relative w-full ${
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
                    suppressHydrationWarning
                    className={`w-48 shrink-0 border-r p-2.5 sm:p-3 flex flex-col justify-between sticky left-0 z-20 shadow-xs ${
                      isToday
                        ? 'border-l-4 border-l-emerald-500 bg-emerald-50/95 dark:bg-zinc-900/98 border-r-emerald-500/50'
                        : isHoliday
                        ? 'border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/95 dark:bg-zinc-950/95 border-l-4 border-l-amber-500'
                        : isWeekend
                        ? 'border-zinc-200 dark:border-zinc-800/80 bg-zinc-100/90 dark:bg-zinc-900/80'
                        : 'border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/90 dark:bg-zinc-950/90'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h4
                          suppressHydrationWarning
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
                        suppressHydrationWarning
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
                        <div suppressHydrationWarning className="flex items-center gap-1.5 text-xs font-mono mt-1.5 font-bold">
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
                      isWeekend

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
                                  {isHoliday ? 'Gazetted Public Holiday' : 'Weekend Recess'}
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
                        className={`flex-1 grid divide-x relative w-full ${
                          isToday
                            ? 'divide-emerald-500/30 dark:divide-emerald-500/20'
                            : 'divide-zinc-200/80 dark:divide-zinc-800/60'
                        }`}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: `repeat(${activeSlots.length || 10}, minmax(0, 1fr))`,
                          gridTemplateRows: hasTrack1 ? 'minmax(68px, 1fr) minmax(68px, 1fr)' : 'minmax(68px, auto)',
                        }}
                      >
                        {/* Background Grid Cells */}
                        {activeSlots.map((slot, slotIdx) => {
                          const isSlotActive = isToday && activeSlotId === slot.id
                          const isBreak = slot.id === 'break' || slot.id?.toLowerCase().includes('break') || slot.name?.toLowerCase().includes('break') || slot.name?.toLowerCase().includes('recess')
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
                                /* Quick-Add Buttons: Slot Free (Track 0) vs Next Available Track (Track 1) */
                                mounted && (
                                  !isOccupiedOnTrack0 ? (
                                    <button
                                      onClick={() => handleQuickAdd(day.id, slot.id)}
                                      className="opacity-0 group-hover/cell:opacity-100 transition-opacity absolute inset-0 m-2 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white/90 dark:bg-zinc-900/90 text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center gap-1.5 text-xs font-sans font-semibold shadow-sm backdrop-blur-md cursor-pointer"
                                      title={`Book practical slot on ${day.label} (${slot.name})`}
                                    >
                                      <Plus className="h-4 w-4 text-indigo-500" />
                                      <span>{currentUser?.role === 'teacher' ? 'Request Slot' : 'Book Slot'}</span>
                                    </button>
                                  ) : !isOccupiedOnTrack1 ? (
                                    <button
                                      onClick={() => handleQuickAdd(day.id, slot.id)}
                                      className={`opacity-0 group-hover/cell:opacity-100 transition-opacity absolute rounded-lg border border-dashed border-indigo-300 dark:border-indigo-700/60 bg-white/95 dark:bg-zinc-900/95 text-indigo-700 dark:text-indigo-300 hover:text-indigo-950 dark:hover:text-white flex items-center justify-center gap-1 text-[11px] font-sans font-semibold shadow-xs backdrop-blur-md cursor-pointer z-20 ${
                                        hasTrack1
                                          ? 'left-1 right-1 bottom-1 top-[52%] m-1'
                                          : 'bottom-1 left-1.5 right-1.5 h-6'
                                      }`}
                                      title={`Book another laboratory session on ${day.label} (${slot.name})`}
                                    >
                                      <Plus className="h-3 w-3 text-indigo-500" />
                                      <span>{currentUser?.role === 'teacher' ? 'Request Session' : 'Book Session'}</span>
                                    </button>
                                  ) : null
                                )
                              )}
                            </div>
                          )
                        })}

                        {/* Allocated Session Cards */}
                        {daySchedules.map((session) => {
                          const startIdx = activeSlots.findIndex((t) => t.id === session.slotId)
                          if (startIdx === -1) return null

                          const span = session.span || 1
                          const trackIdx = sessionTracks.get(session.id) || 0
                          const isMultiPeriod = span > 1
                          const isDualLab = Boolean(session.isDualLab)
                          const isLiveNow = isToday && activeSlotId === session.slotId
                          const activeSub = getSubForSession(session.id, dayDateInfo?.dateStr || '')

                          const isSkipped = Boolean(session.isSkipped || session.status === 'skipped')
                          const isRequested = session.status === 'requested'
                          const isHolidaySession = isHoliday
                          const isHighlighted = isSessionHighlighted(session)
   const isTargetFocus = focusSlotId && session.id === focusSlotId

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
                                openActionModal(session, 'log', dayDateInfo?.dateStr)
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
                              className={`m-1 p-2 sm:p-2.5 rounded-xl border-l-4 transition-all duration-200 flex flex-col justify-between overflow-hidden relative group backdrop-blur-md cursor-pointer self-start h-[68px] ${
                                isDualLab
                                  ? 'ring-1 ring-indigo-500/40 bg-gradient-to-r from-indigo-500/[0.08] to-transparent'
                                  : ''
                              } ${
                                !isHighlighted
                                  ? 'opacity-25 grayscale-[30%] hover:opacity-90'
                                  : ''
                              } ${
                                isHolidaySession
                                  ? 'grayscale opacity-35 bg-zinc-100/90 dark:bg-zinc-900/90 border border-zinc-200/90 dark:border-zinc-800/90 text-zinc-500 dark:text-zinc-400 select-none cursor-not-allowed shadow-none'
                                  : isSkipped
                                  ? 'grayscale opacity-40 hover:opacity-85 bg-zinc-100/90 dark:bg-zinc-900/90 border-2 border-dashed border-zinc-400 dark:border-zinc-600 text-zinc-500 dark:text-zinc-400 shadow-none'
                                  : isRequested
                                  ? (isTargetFocus ? 'border-2 border-dashed border-amber-500 bg-amber-50/90 dark:bg-amber-950/50 text-zinc-950 dark:text-white ring-4 ring-indigo-500 shadow-[0_0_35px_rgba(99,102,241,0.6)] animate-pulse' : 'border-2 border-dashed border-amber-500 bg-amber-50/90 dark:bg-amber-950/50 hover:dark:bg-amber-950/70 text-zinc-950 dark:text-white shadow-[0_0_15px_rgba(245,158,11,0.25)] hover:shadow-[0_0_25px_rgba(245,158,11,0.45)] ring-1 ring-amber-500/40')
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
                                {/* Line 1: Subject Code on left & Badges on right */}
                                <div className="flex items-center justify-between gap-1 mb-0.5">
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
                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-sans font-bold bg-zinc-900/10 dark:bg-white/15 text-zinc-900 dark:text-zinc-100 border border-zinc-900/10 dark:border-white/10">
                                      {session.grade.replace(/Class\s*/gi, '').trim() || session.grade}
                                    </span>

                                    {isDualLab && (
                                      <span
                                        title={`Multi-Lab Facility: ${session.lab} + ${session.secondaryLab || 'Secondary Lab'} simultaneously`}
                                        className="h-4 w-4 rounded flex items-center justify-center bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 shadow-2xs shrink-0"
                                      >
                                        <Building2 className="h-2.5 w-2.5" />
                                      </span>
                                    )}

                                    {isSkipped ? (
                                      <span className="px-1 py-0.2 rounded text-[8px] font-sans bg-zinc-600 text-white font-bold">
                                        SKIP
                                      </span>
                                    ) : isRequested ? (
                                      <span className="px-1 py-0.2 rounded text-[8px] font-sans bg-amber-500 text-white font-bold animate-pulse">
                                        PEND
                                      </span>
                                    ) : isLiveNow ? (
                                      <span className="px-1.5 py-0.2 rounded text-[8px] font-sans bg-emerald-500 text-white font-black flex items-center gap-0.5 animate-pulse">
                                        <Radio className="h-2 w-2" />
                                        LIVE
                                      </span>
                                    ) : isMultiPeriod ? (
                                      <span className="px-1 py-0.2 rounded text-[8px] font-sans bg-violet-600 text-white font-bold">
                                        {span}P
                                      </span>
                                    ) : null}
                                  </div>
                                </div>

                                {/* Middle: Subject Practical Title / Topic */}
                                {session.subjectTitle && (
                                  <div
                                    className={`text-[10.5px] font-medium truncate my-0.5 leading-tight ${
                                      isSkipped || isHolidaySession
                                        ? 'text-zinc-500 dark:text-zinc-500 line-through'
                                        : 'text-zinc-600 dark:text-zinc-300'
                                    }`}
                                    title={formatSubjectHeading(session.subjectCode, session.subjectTitle)}
                                  >
                                    {cleanSubjectTitle(session.subjectCode, session.subjectTitle)}
                                  </div>
                                )}

                                {/* Holiday Reason Overlay */}
                                {isHolidaySession && (
                                  <div className="text-[10px] font-sans text-zinc-600 dark:text-zinc-400 bg-zinc-200/70 dark:bg-zinc-800/80 px-2 py-0.5 rounded my-0.5 truncate border border-zinc-300/50 dark:border-zinc-700/50 font-medium flex items-center gap-1.5">
                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                                    <span className="truncate">Cancelled: {(dayHoliday as any)?.name || (dayHoliday as any)?.title || 'Academic Recess'}</span>
                                  </div>
                                )}

                                {/* Skipped Reason Banner */}
                                {isSkipped && session.skippedReason && (
                                  <div className="text-[10px] font-sans text-zinc-600 dark:text-zinc-400 bg-zinc-200/70 dark:bg-zinc-800/80 px-1.5 py-0.5 rounded my-0.5 truncate">
                                    Reason: {session.skippedReason}
                                  </div>
                                )}

                                {/* Requested By Banner & Quick Approve/Decline for Admin */}
                                {isRequested && !isHolidaySession && (
                                  <div className="my-0.5 space-y-1">
                                    <div className="text-[10px] font-sans font-bold text-amber-800 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-900/60 px-1.5 py-0.5 rounded border border-amber-300/60 dark:border-amber-700/60 truncate">
                                      Requested by: {session.requestedBy || session.teacher}
                                    </div>

                                    {canApprove && (
                                      <div
                                        className="flex items-center gap-1 pt-0.5 font-sans text-[10px]"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <button
                                          type="button"
                                          onClick={() => {
                                            approveSlotBooking(session.id)
                                            handleSuccess(`Approved practical slot for ${session.teacher}`)
                                          }}
                                          className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                                          title="Approve Slot Booking"
                                        >
                                          <Check className="h-2.5 w-2.5" />
                                          <span>Approve</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setDeclineSessionId(session.id)
                                            setDeclineError(null)
                                            setIsDeclineModalOpen(true)
                                          }}
                                          className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
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
                                  <div className="flex items-center gap-1 text-[10px] font-sans text-indigo-700 dark:text-indigo-300 bg-indigo-100/90 dark:bg-indigo-950/90 px-1.5 py-0.5 rounded border border-indigo-300/70 dark:border-indigo-800/70 my-0.5 font-bold">
                                    <UserCheck className="h-3 w-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                    <span className="truncate">Sub: {activeSub.substitute_teacher_name}</span>
                                  </div>
                                )}
                              </div>

                              {/* Line 2: Teacher Name & Contextual Badge */}
                              <div className="flex items-center justify-between text-[11px] font-sans mt-auto pt-1 border-t border-zinc-200/50 dark:border-zinc-700/50 gap-1">
                                <span
                                  className="truncate font-medium text-zinc-700 dark:text-zinc-300 text-[10.5px]"
                                  title={`${activeSub?.substitute_teacher_name || session.teacher}${session.coTeacher ? ` & ${session.coTeacher}` : ''} (${getLabDisplayName(session.labKey, session.lab)} & ${session.secondaryLab || 'Secondary Lab'})`}
                                >
                                  {activeSub ? (
                                    <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                                      {activeSub.substitute_teacher_name.split(' ').slice(-1)[0]} (Proxy)
                                    </span>
                                  ) : (
                                    session.teacher.replace(/-Teacher$/i, ' Staff').replace(/ & /g, ' + ')
                                  )}
                                  {isDualLab && session.coTeacher && session.coTeacher !== session.teacher && (
                                    <span className="text-zinc-400 dark:text-zinc-500 font-normal"> +{session.coTeacher.split(' ').slice(-1)[0]}</span>
                                  )}
                                </span>

                                {isDualLab ? (
                                  <span
                                    title={`Connected Facilities: ${getLabDisplayName(session.labKey, session.lab)} + ${session.secondaryLab || 'Secondary Lab'}`}
                                    className="shrink-0 text-[8.5px] font-sans font-bold px-1.5 py-0.5 rounded bg-zinc-100/90 dark:bg-zinc-800/90 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700/80"
                                  >
                                    {getCompactLabName(session.labKey)}+{getCompactLabName(session.secondaryLabKey)}
                                  </span>
                                ) : isMultiPeriod ? (
                                  <span className="shrink-0 text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/20">
                                    {session.timeSlot.split(' - ')[0]}–{session.timeSlot.split(' - ')[1]}
                                  </span>
                                ) : (
                                  <span
                                    title={`Room: ${getLabDisplayName(session.labKey, session.lab)} (${getLabDisplayCode(session.labKey, session.labCode, session.lab)})`}
                                    className="shrink-0 text-[8.5px] font-sans font-bold px-1.5 py-0.5 rounded bg-zinc-100/90 dark:bg-zinc-800/90 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700/80"
                                  >
                                    {getLabDisplayCode(session.labKey, session.labCode, session.lab)}
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
        sessionDate={selectedDateStr || selectedSession?.date || selectedSession?.specificDate || undefined}
        allRoutines={routines}
        initialMode={modalMode}
        currentUser={currentUser}
        onSuccess={handleSuccess}
        onDeleteSession={deleteSession}
        onExtendSession={extendSession}
        onMergeSession={mergeSession}
        onUnmergeSession={unmergeSession}
        onAddSession={currentUser?.role === 'teacher' ? (s) => requestSlotBooking(s, currentUser.full_name) : addSession}
        onUpdateSession={updateSession}
        onSkipSession={(sessionId, reason) => skipSession(sessionId, reason, currentUser?.full_name || 'Subject Teacher')}
        onUnskipSession={unskipSession}
        onApproveSession={approveSlotBooking}
        onRejectSession={(sessionId: string) => {
          setDeclineSessionId(sessionId)
          setDeclineError(null)
          setIsDeclineModalOpen(true)
        }}
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
                disabled={isSubmittingDecline}
                onClick={() => setIsDeclineModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {declineError && (
              <div className="p-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{declineError}</span>
              </div>
            )}

            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Specify the operational reason for declining this practical slot. An alert notification will be dispatched to the subject teacher.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Preset Operational Reason:</label>
              <select
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                disabled={isSubmittingDecline}
                className="w-full p-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none disabled:opacity-50"
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
                  disabled={isSubmittingDecline}
                  placeholder="e.g. System upgrade during period 3"
                  className="w-full p-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none disabled:opacity-50"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isSubmittingDecline}
                onClick={() => setIsDeclineModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingDecline}
                onClick={handleConfirmDecline}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingDecline ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Declining...</span>
                  </>
                ) : (
                  <span>Confirm Decline</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
