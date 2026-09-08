'use client'

import React, { useState, useEffect } from 'react'
import {
  Activity,
  BookOpen,
  Clock,
  Users,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Timer,
  Edit3,
  Calendar,
  FileCheck,
  Plus,
  Printer,
  ClipboardList,
  Terminal,
  Atom,
  FlaskRound,
  Filter,
  ArrowUpRight,
  AlertTriangle,
  Palmtree,
  User,
  Building2,
  GraduationCap,
} from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import dynamic from 'next/dynamic'
import { MASTER_TIME_SLOTS, MasterRoutineItem } from '@/lib/master-data'
import { getNepalDateStr } from '@/lib/nepali-date'
import type { ModalMode } from '@/components/schedules/session-action-modal'
import { useLiveSchedule } from '@/hooks/use-live-schedule'
import { useRoutineState } from '@/hooks/use-routine-state'
import { useLogsState, PracticalLogRecord } from '@/hooks/use-logs-state'
import { useInfrastructureState } from '@/hooks/use-infrastructure-state'
import { useUserScope } from '@/hooks/use-user-scope'
import SyllabusProgress from '@/components/dashboard/syllabus-progress'
import IncidentRegistryCard from '@/components/dashboard/incident-registry-card'
import LiveSessionCockpit from '@/components/dashboard/live-session-cockpit'
import FacilityTelemetryCard from '@/components/dashboard/facility-telemetry-card'
import { useIncidentState } from '@/hooks/use-incident-state'
import { getMaintenanceHealthSummary } from '@/app/actions/maintenance'
import DashboardLoading from './loading'
import { SlidingSegmentedTabs, SegmentedTab } from '@/components/ui/sliding-segmented-tabs'

function getLabRibbon(labName?: string) {
  if (!labName) return 'border-l-[3px] border-l-zinc-300 dark:border-l-zinc-700'
  const lower = labName.toLowerCase()
  if (lower.includes('comp') || lower.includes('software') || lower.includes('tech')) {
    return 'border-l-[3px] border-l-indigo-500'
  }
  if (lower.includes('phys')) {
    return 'border-l-[3px] border-l-cyan-500'
  }
  if (lower.includes('chem')) {
    return 'border-l-[3px] border-l-rose-500'
  }
  if (lower.includes('bio') || lower.includes('life')) {
    return 'border-l-[3px] border-l-emerald-500'
  }
  if (lower.includes('elec') || lower.includes('hardw')) {
    return 'border-l-[3px] border-l-amber-500'
  }
  return 'border-l-[3px] border-l-zinc-300 dark:border-l-zinc-700'
}

const SessionActionModal = dynamic(() => import('@/components/schedules/session-action-modal'), {
  ssr: false,
})
const ReportIncidentModal = dynamic(() => import('@/components/dashboard/report-incident-modal'), {
  ssr: false,
})
const AcademicCalendarModal = dynamic(() => import('@/components/calendar/academic-calendar-modal'), {
  ssr: false,
})

export default function DashboardPage() {
  const {
    routines,
    deleteSession,
    extendSession,
    mergeSession,
    unmergeSession,
  } = useRoutineState()

  const {
    logs,
    saveLog,
    updateLog,
    deleteLog,
    getLogForSession,
  } = useLogsState()

  const {
    mounted,
    timeString,
    nepaliDate,
    activeSlotId,
    activePeriodName,
    minutesRemaining,
    todaySessions,
  } = useLiveSchedule(routines)

  // Context-First User Scope
  const { scope: userScope, profile, isTeacher, isPrivileged } = useUserScope()

  const [selectedSession, setSelectedSession] = useState<MasterRoutineItem | null>(null)
  const [selectedExistingLog, setSelectedExistingLog] = useState<PracticalLogRecord | null>(null)
  const [modalMode, setModalMode] = useState<ModalMode>('log')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Segmented Tab and Lab Filter State
  const [activeTab, setActiveTab] = useState<'upcoming' | 'backlog' | 'completed' | 'all'>('upcoming')
  const [labFilter, setLabFilter] = useState<'all' | 'comp' | 'phys' | 'chem'>('all')

  // Lab Health & Dynamic Overdue Maintenance Integration
  const { incidents } = useIncidentState()
  const [maintenanceStats, setMaintenanceStats] = useState<{ active_reminders: number; overdue_reminders: number }>({
    active_reminders: 0,
    overdue_reminders: 0,
  })

  useEffect(() => {
    getMaintenanceHealthSummary()
      .then(setMaintenanceStats)
      .catch((err) => console.error('Failed to load maintenance health summary:', err))
  }, [])

  const todayDateStr = getNepalDateStr(new Date())
  const { getHolidayForDate } = useInfrastructureState()
  const todayHoliday = getHolidayForDate(todayDateStr)
  const currentSlotIdx = MASTER_TIME_SLOTS.findIndex((s) => s.id === activeSlotId)
  const currentMinutes = new Date().getHours() * 60 + new Date().getMinutes()
  const isBeforeSchool = currentMinutes < 9 * 60 + 15
  const isAfterSchool = currentMinutes >= 16 * 60 + 50

  // Faculty Scope & Management Permission Matcher
  const isMySession = (s: MasterRoutineItem) => {
    if (!userScope) return true
    const teacherLower = (s.teacher || '').toLowerCase().trim()
    const assignedName = (userScope.teacherProfile?.name || '').toLowerCase().trim()
    const userFullName = (userScope.fullName || '').toLowerCase().trim()

    if (assignedName && (teacherLower.includes(assignedName) || assignedName.includes(teacherLower))) return true
    if (userFullName && (teacherLower.includes(userFullName) || userFullName.includes(teacherLower))) return true
    return false
  }

  // Privileged users (Admin, Lab Incharge, HOD) can manage all sessions; teachers can manage their own sessions
  const canManageSession = (s: MasterRoutineItem) => isPrivileged || isMySession(s)

  // Unified Institutional Schedule View across all profiles
  const effectiveSessions = todaySessions

  // Categorize sessions based on active scope
  const loggedSessions: { session: MasterRoutineItem; log: PracticalLogRecord }[] = []
  const ongoingSessions: MasterRoutineItem[] = []
  const passedUnloggedSessions: MasterRoutineItem[] = []
  const upcomingSessions: MasterRoutineItem[] = []

  effectiveSessions.forEach((session) => {
    const existingLog = getLogForSession(session.id, todayDateStr)
    if (existingLog) {
      loggedSessions.push({ session, log: existingLog })
      return
    }

    const startSlotIdx = MASTER_TIME_SLOTS.findIndex((s) => s.id === session.slotId)
    const span = session.span || 1
    const endSlotIdx = startSlotIdx !== -1 ? startSlotIdx + span - 1 : -1

    if (isBeforeSchool) {
      upcomingSessions.push(session)
    } else if (isAfterSchool) {
      passedUnloggedSessions.push(session)
    } else if (currentSlotIdx !== -1) {
      if (currentSlotIdx >= startSlotIdx && currentSlotIdx <= endSlotIdx) {
        ongoingSessions.push(session)
      } else if (currentSlotIdx > endSlotIdx) {
        passedUnloggedSessions.push(session)
      } else {
        upcomingSessions.push(session)
      }
    } else {
      const breakIdx = 5
      if (startSlotIdx < breakIdx) {
        passedUnloggedSessions.push(session)
      } else {
        upcomingSessions.push(session)
      }
    }
  })

  const handleOpenAction = (
    session: MasterRoutineItem,
    mode: ModalMode = 'log',
    existingLogRecord?: PracticalLogRecord
  ) => {
    setSelectedSession(session)
    setSelectedExistingLog(existingLogRecord || null)
    setModalMode(mode)
    setIsModalOpen(true)
  }

  const handleQuickBook = (labName: string) => {
    const isComp = labName.includes('Computer')
    const isPhys = labName.includes('Physics')

    const adhocSession: MasterRoutineItem = {
      id: `quick-book-${Date.now()}`,
      day: (nepaliDate.dayName as any) || 'Monday',
      dayKey: 'mon',
      timeSlot: 'Current Period',
      slotId: activeSlotId || 't2',
      span: 1,
      subjectCode: 'Ad-hoc Practical Session',
      subjectTitle: `${labName} Session`,
      grade: 'Class 12',
      gradeKey: 'class-12',
      teacher: isTeacher ? (userScope?.teacherProfile?.name || profile?.full_name || 'Subject Teacher') : 'Assigned Subject Teacher',
      lab: labName as any,
      labKey: isComp ? 'comp' : isPhys ? 'phys' : 'chem',
      defaultStudents: 36,
      category: 'General',
      dotColor: isComp ? 'bg-indigo-400' : isPhys ? 'bg-cyan-400' : 'bg-rose-400',
      badgeColor: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
      accentColor: 'border-l-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 text-zinc-950 dark:text-zinc-50',
    }

    setSelectedSession(adhocSession)
    setSelectedExistingLog(null)
    setModalMode('adhoc')
    setIsModalOpen(true)
  }

  const handleSuccess = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 4000)
  }

  const featuredSession = ongoingSessions.length > 0 ? ongoingSessions[0] : null

  // 1. Scheduled vs Logged stats
  const loggedCount = loggedSessions.length
  const totalSlotsCount = effectiveSessions.length
  const compliancePct = totalSlotsCount > 0 ? Math.round((loggedCount / totalSlotsCount) * 100) : 0

  // 2. Student Attendance Rate calculation across today's logged sessions
  const todayConductedLogs = logs.filter(
    (l) => l.date === todayDateStr && l.status === 'conducted'
  )
  const totalPresentToday = todayConductedLogs.reduce((acc, l) => acc + (l.presentStudents || 0), 0)
  const totalEnrolledToday = todayConductedLogs.reduce((acc, l) => acc + (l.totalStudents || 0), 0)
  const attendanceRate =
    totalEnrolledToday > 0
      ? Math.round((totalPresentToday / totalEnrolledToday) * 1000) / 10
      : 0

  // 3. Combined Lab Health & Maintenance metrics
  const activeIncidents = incidents.filter((i) => i.status !== 'resolved')
  const overdueServicing = maintenanceStats.overdue_reminders
  const totalHealthIssues = activeIncidents.length + overdueServicing

  // Filter helper
  const filterByLab = (s: MasterRoutineItem) => {
    if (labFilter === 'all') return true
    return s.labKey === labFilter
  }

  // Hydration-guarded dynamic time-of-day greeting (client-only computation)
  const [greeting, setGreeting] = useState('Welcome to Lab Operations')
  useEffect(() => {
    const hr = new Date().getHours()
    if (hr < 12) setGreeting('Good morning')
    else if (hr < 17) setGreeting('Good afternoon')
    else setGreeting('Good evening')
  }, [])

  // Hydration guard: render stable identical skeleton during SSR and pre-hydration
  if (!mounted) {
    return <DashboardLoading />
  }

  return (
    <div className="space-y-5 w-full animate-in fade-in duration-300 relative select-none overflow-x-clip">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-4 py-2.5 rounded-xl shadow-2xl text-xs font-medium animate-in slide-in-from-top-2 duration-200 flex items-center gap-2 border border-zinc-700 dark:border-zinc-300">
          <Sparkles className="h-4 w-4 text-amber-400 dark:text-amber-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 🏛️ Institutional Holiday Recess Banner */}
      {todayHoliday && (
        <div
          onClick={() => setIsCalendarModalOpen(true)}
          className="p-4 px-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-500/5 border border-amber-500/30 text-amber-950 dark:text-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-300 cursor-pointer hover:border-amber-500/50 transition-all group"
          title="Click to view Academic Calendar & Official National Holidays"
        >
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-2xl bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
              <Palmtree className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 font-mono">
                  Official Institutional Recess
                </span>
                <span className="text-xs font-mono font-bold bg-amber-500/20 text-amber-900 dark:text-amber-200 px-2 py-0.5 rounded-full border border-amber-500/30">
                  {todayHoliday.startDateNp} {todayHoliday.endDateNp ? `to ${todayHoliday.endDateNp}` : ''}
                </span>
              </div>
              <h3 className="text-sm font-bold text-zinc-950 dark:text-white mt-0.5 font-heading">
                {todayHoliday.name}
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-0.5">
                All laboratory practical sessions are automatically suspended today (No logs created). Click to view full calendar.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-500/30 text-xs font-bold font-mono shrink-0">
              Recess Active
            </span>
            <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 underline underline-offset-2">
              View Calendar ➔
            </span>
          </div>
        </div>
      )}

      {/* 1. TOP EXECUTIVE KPI CARDS (ULTRA-MODERN GLASS-GLOW COMMAND TILES) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Tile 1: Today's Practical Timetable */}
        <div className="glass-glow-card hover-card-lift relative overflow-hidden rounded-2xl p-4 shadow-sm group">
          <div className="absolute -top-10 -right-10 h-24 w-24 rounded-full bg-indigo-500/10 dark:bg-indigo-500/15 blur-2xl group-hover:bg-indigo-500/20 transition-all pointer-events-none" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/60 dark:border-indigo-800/50 shadow-2xs">
                <BookOpen className="h-4 w-4" />
              </div>
              <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Today's Schedule
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsCalendarModalOpen(true)}
              className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/50 font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors cursor-pointer"
              title="Click to view Academic & National Holidays Calendar"
            >
              2083 Routine ▾
            </button>
          </div>

          <div className="mt-3 mb-2 flex items-baseline justify-between" suppressHydrationWarning>
            <div className="flex items-baseline gap-1.5" suppressHydrationWarning>
              <span suppressHydrationWarning className="text-3xl font-extrabold font-heading tracking-tight text-zinc-950 dark:text-white tabular-nums">
                {effectiveSessions.length}
              </span>
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Practical Slots
              </span>
            </div>
            <span suppressHydrationWarning className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300">
              {ongoingSessions.length > 0 ? (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 text-[11px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                  {ongoingSessions.length} In-Session
                </span>
              ) : (
                <span className="text-zinc-400 text-[11px]">Scheduled</span>
              )}
            </span>
          </div>

          {/* Session Distribution Footer */}
          <div className="pt-2 border-t border-zinc-100 dark:border-white/[0.08] flex items-center justify-between text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
              {nepaliDate.dayNameNp}
            </span>
            <span>{nepaliDate.dayName} Timetable</span>
          </div>
        </div>

        {/* Tile 2: Operational Session Compliance */}
        <div className="glass-glow-card hover-card-lift relative overflow-hidden rounded-2xl p-4 shadow-sm group">
          <div className="absolute -top-10 -right-10 h-24 w-24 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 blur-2xl group-hover:bg-emerald-500/20 transition-all pointer-events-none" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/60 dark:border-emerald-800/50 shadow-2xs">
                <FileCheck className="h-4 w-4" />
              </div>
              <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Session Compliance
              </span>
            </div>
            <span suppressHydrationWarning className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/50 font-bold tabular-nums">
              {compliancePct}% Done
            </span>
          </div>

          <div className="mt-3 mb-2 flex items-baseline justify-between" suppressHydrationWarning>
            <div className="flex items-baseline gap-1.5" suppressHydrationWarning>
              <span suppressHydrationWarning className="text-3xl font-extrabold font-heading tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
                {loggedCount}
              </span>
              <span suppressHydrationWarning className="text-xs font-mono text-zinc-400">
                / {totalSlotsCount} Logged
              </span>
            </div>
            {passedUnloggedSessions.length > 0 ? (
              <span suppressHydrationWarning className="text-[11px] font-mono text-amber-600 dark:text-amber-400 font-semibold">
                {passedUnloggedSessions.length} Pending
              </span>
            ) : (
              <span suppressHydrationWarning className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 font-semibold">
                <CheckCircle2 className="h-3 w-3" /> Up to date
              </span>
            )}
          </div>

          {/* Micro Progress Track */}
          <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden mt-1.5 mb-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
              style={{ width: `${compliancePct}%` }}
            />
          </div>

          <div className="border-t border-zinc-100 dark:border-white/[0.08] pt-1.5 flex items-center justify-between text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
            <span>Status:</span>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              {passedUnloggedSessions.length === 0 ? 'Verified Complete' : `${passedUnloggedSessions.length} Pending Action`}
            </span>
          </div>
        </div>

        {/* Tile 3: Student Attendance Rate (Reclaimed from redundant BS picker) */}
        <div className="glass-glow-card hover-card-lift relative overflow-hidden rounded-2xl p-4 shadow-sm group">
          <div className="absolute -top-10 -right-10 h-24 w-24 rounded-full bg-indigo-500/10 dark:bg-indigo-500/15 blur-2xl group-hover:bg-indigo-500/20 transition-all pointer-events-none" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/60 dark:border-indigo-800/50 shadow-2xs">
                <Users className="h-4 w-4" />
              </div>
              <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Attendance Rate
              </span>
            </div>
            <span suppressHydrationWarning className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/50 font-bold tabular-nums">
              {totalPresentToday > 0 ? 'Verified Roll' : 'Expected'}
            </span>
          </div>

          <div className="mt-3 mb-2 flex items-baseline justify-between" suppressHydrationWarning>
            <div className="flex items-baseline gap-1.5" suppressHydrationWarning>
              <span suppressHydrationWarning className="text-3xl font-extrabold font-heading tracking-tight text-indigo-600 dark:text-indigo-400 tabular-nums">
                {attendanceRate}%
              </span>
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Avg Present
              </span>
            </div>
            <span suppressHydrationWarning className="text-xs font-mono font-semibold text-zinc-600 dark:text-zinc-400">
              {totalPresentToday > 0 ? `${totalPresentToday}/${totalEnrolledToday}` : 'Class 11/12'}
            </span>
          </div>

          {/* Micro Attendance Track */}
          <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden mt-1.5 mb-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
              style={{ width: `${Math.min(100, attendanceRate)}%` }}
            />
          </div>

          <div className="border-t border-zinc-100 dark:border-white/[0.08] pt-1.5 flex items-center justify-between text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
            <span>Roll-call Tally:</span>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              {totalPresentToday > 0 ? `${totalPresentToday} Students Logged` : 'Awaiting Session Roll'}
            </span>
          </div>
        </div>

        {/* Tile 4: Lab Health & Maintenance (Reclaimed from redundant clock, dynamically combining breakages + overdue routines) */}
        <div className="glass-glow-card hover-card-lift relative overflow-hidden rounded-2xl p-4 shadow-sm group">
          <div className="absolute -top-10 -right-10 h-24 w-24 rounded-full bg-rose-500/10 dark:bg-rose-500/15 blur-2xl group-hover:bg-rose-500/20 transition-all pointer-events-none" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-xl flex items-center justify-center border shadow-2xs ${
                totalHealthIssues > 0
                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200/60 dark:border-rose-800/50'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/50'
              }`}>
                {totalHealthIssues > 0 ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              </div>
              <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Lab Health & Servicing
              </span>
            </div>
            <span suppressHydrationWarning className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
              totalHealthIssues > 0
                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200/60 dark:border-rose-800/50'
                : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/50'
            }`}>
              {totalHealthIssues > 0 ? `${totalHealthIssues} Flagged` : 'All Clear'}
            </span>
          </div>

          <div className="mt-3 mb-2 flex items-baseline justify-between" suppressHydrationWarning>
            <div className="flex items-baseline gap-1.5" suppressHydrationWarning>
              <span suppressHydrationWarning className={`text-3xl font-extrabold font-heading tracking-tight tabular-nums ${
                totalHealthIssues > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
              }`}>
                {totalHealthIssues}
              </span>
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {totalHealthIssues > 0 ? 'Open Issues' : 'Optimal Health'}
              </span>
            </div>
            <span suppressHydrationWarning className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 font-semibold">
              {activeIncidents.length} Fault{activeIncidents.length === 1 ? '' : 's'}
            </span>
          </div>

          {/* Micro Health Track */}
          <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden mt-1.5 mb-2">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                totalHealthIssues > 0
                  ? 'bg-gradient-to-r from-rose-500 to-amber-500'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-400'
              }`}
              style={{ width: totalHealthIssues > 0 ? `${Math.min(100, totalHealthIssues * 25)}%` : '100%' }}
            />
          </div>

          <div className="border-t border-zinc-100 dark:border-white/[0.08] pt-1.5 flex items-center justify-between text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
            <span>Servicing Status:</span>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              {overdueServicing > 0 ? `${overdueServicing} Overdue Task${overdueServicing === 1 ? '' : 's'}` : 'Routines Up to Date'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. MAIN COMMAND CENTER (2-COLUMN ARCHITECTURE) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN (65% / 8 Cols): Operational Station & Session Matrix */}
        <div className="lg:col-span-8 space-y-5">
          {/* A. Live Session Cockpit (Hydration-Safe Two-State Dispatch Station) */}
          <LiveSessionCockpit
            ongoingSessions={ongoingSessions}
            upcomingSessions={upcomingSessions}
            passedUnloggedSessions={passedUnloggedSessions}
            loggedSessionsCount={loggedSessions.length}
            effectiveSessionsCount={effectiveSessions.length}
            activeSlotId={activeSlotId}
            activePeriodName={activePeriodName}
            minutesRemaining={minutesRemaining}
            currentUserRole={profile?.role}
            currentUserId={profile?.id}
            currentTeacherName={userScope?.teacherProfile?.name || profile?.full_name}
            onOpenAction={(session, mode) => handleOpenAction(session, mode)}
            onOpenTimetable={() => window.location.assign('/schedules')}
            todayHolidayName={todayHoliday?.name}
          />

          {/* B. Segmented Session Feed Card */}
          <Card className="glass-card border border-zinc-200/80 dark:border-white/[0.08] shadow-2xs overflow-hidden relative">
            {/* Milled Top Specular Sheen */}
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

            {/* Tab Header Bar */}
            <div className="border-b border-zinc-100 dark:border-white/[0.06] p-3 bg-zinc-50/50 dark:bg-surface-1/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <SlidingSegmentedTabs
                tabs={[
                  {
                    id: 'upcoming',
                    label: 'Live & Upcoming',
                    badge: upcomingSessions.length + ongoingSessions.length,
                  },
                  {
                    id: 'backlog',
                    label: 'Pending',
                    badge: passedUnloggedSessions.length > 0 ? passedUnloggedSessions.length : undefined,
                    badgeVariant: passedUnloggedSessions.length > 0 ? 'alert' : 'default',
                  },
                  {
                    id: 'completed',
                    label: 'Logged Records',
                    badge: loggedSessions.length,
                  },
                  {
                    id: 'all',
                    label: 'All',
                    badge: todaySessions.length,
                    hiddenOnMobile: true,
                  },
                ]}
                activeTab={activeTab}
                onChange={(id) => setActiveTab(id)}
              />

              {/* Lab Filter Selector */}
              <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-500">
                <Filter className="h-3 w-3 text-zinc-400" />
                <select
                  value={labFilter}
                  onChange={(e) => setLabFilter(e.target.value as any)}
                  className="bg-transparent text-xs font-mono font-medium text-zinc-800 dark:text-zinc-200 border-none focus:outline-none cursor-pointer"
                >
                  <option value="all">All Labs</option>
                  <option value="comp">Computer</option>
                  <option value="phys">Physics</option>
                  <option value="chem">Chemistry</option>
                </select>
              </div>
            </div>

            {/* Tab Contents */}
            <CardContent className="p-0">
              {/* 1. UPCOMING / LIVE TAB */}
              {activeTab === 'upcoming' && (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {upcomingSessions.filter(filterByLab).length === 0 && ongoingSessions.filter(filterByLab).length === 0 ? (
                    <div className="py-12 text-center text-zinc-400 font-mono text-xs space-y-1">
                      <Clock className="h-5 w-5 mx-auto text-zinc-300 dark:text-zinc-600 mb-1" />
                      <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                        No upcoming sessions remaining for today.
                      </p>
                      <p className="text-[11px]">Check the Pending tab to review unlogged past sessions.</p>
                    </div>
                  ) : (
                    <>
                      {ongoingSessions.filter(filterByLab).map((s) => (
                        <div
                          key={s.id}
                          className={`p-3.5 px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono bg-emerald-50/20 dark:bg-emerald-950/10 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-all duration-150 ease-out hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 hover:shadow-xs ${getLabRibbon(s.lab)}`}
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                LIVE NOW
                              </span>
                              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                                {s.timeSlot}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                                {s.grade}
                              </span>
                              <span className="text-[10px] text-zinc-400">{s.lab}</span>
                            </div>
                            <h4 className="text-xs font-bold text-zinc-950 dark:text-white font-sans">
                              {s.subjectCode} — {s.subjectTitle}
                            </h4>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                              Subject Teacher: <strong>{s.teacher}</strong> • Strength: {s.defaultStudents}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {canManageSession(s) ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs text-zinc-600 dark:text-zinc-300"
                                  onClick={() => handleOpenAction(s, 'skip')}
                                >
                                  Skip
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                                  onClick={() => handleOpenAction(s, 'log')}
                                >
                                  Log
                                </Button>
                              </>
                            ) : (
                              <span className="text-[11px] text-zinc-400 font-mono italic">
                                {s.teacher}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}

                      {upcomingSessions.filter(filterByLab).map((s) => (
                        <div
                          key={s.id}
                          className={`p-3.5 px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono hover:bg-zinc-50/70 dark:hover:bg-surface-2/60 transition-all duration-150 ease-out hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 hover:shadow-xs ${getLabRibbon(s.lab)}`}
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                                {s.timeSlot}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 font-bold">
                                {s.grade}
                              </span>
                              <span className="text-[10px] text-zinc-400">{s.lab}</span>
                            </div>
                            <h4 className="text-xs font-bold text-zinc-950 dark:text-white font-sans">
                              {s.subjectCode} — {s.subjectTitle}
                            </h4>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                              Subject Teacher: <strong>{s.teacher}</strong> • Strength: {s.defaultStudents}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {canManageSession(s) ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                  onClick={() => handleOpenAction(s, 'skip')}
                                >
                                  Skip
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-7 text-xs bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 font-semibold"
                                  onClick={() => handleOpenAction(s, 'log')}
                                >
                                  Log
                                </Button>
                              </>
                            ) : (
                              <span className="text-[11px] text-zinc-400 font-mono italic">
                                {s.teacher}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* 2. PENDING / BACKLOG TAB (CALM, NON-ALARMIST STYLING) */}
              {activeTab === 'backlog' && (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {passedUnloggedSessions.filter(filterByLab).length === 0 ? (
                    <div className="py-12 text-center text-zinc-400 font-mono text-xs space-y-1">
                      <CheckCircle2 className="h-5 w-5 mx-auto text-emerald-500 mb-1" />
                      <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                        No pending session logs!
                      </p>
                      <p className="text-[11px]">All passed practical slots have been properly recorded or marked.</p>
                    </div>
                  ) : (
                    passedUnloggedSessions.filter(filterByLab).map((s) => (
                      <div
                        key={s.id}
                        className={`p-3.5 px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono hover:bg-zinc-50/70 dark:hover:bg-surface-2/60 transition-all duration-150 ease-out hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 hover:shadow-xs ${getLabRibbon(s.lab)}`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                              {s.timeSlot}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 font-bold">
                              {s.grade}
                            </span>
                            <span className="text-[10px] text-zinc-400">{s.lab}</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800/80 text-zinc-500 border border-zinc-200 dark:border-zinc-800">
                              Pending Record
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-zinc-950 dark:text-white font-sans">
                            {s.subjectCode} — {s.subjectTitle}
                          </h4>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                            Subject Teacher: <strong>{s.teacher}</strong> • Strength: {s.defaultStudents}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {canManageSession(s) ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                onClick={() => handleOpenAction(s, 'skip')}
                              >
                                Mark Skipped
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-2xs"
                                onClick={() => handleOpenAction(s, 'log')}
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Log Attendance
                              </Button>
                            </>
                          ) : (
                            <span className="text-[11px] text-zinc-400 font-mono italic">
                              {s.teacher}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* 3. COMPLETED LOGGED RECORDS TAB */}
              {activeTab === 'completed' && (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {loggedSessions.filter(({ session }) => filterByLab(session)).length === 0 ? (
                    <div className="py-12 text-center text-zinc-400 font-mono text-xs space-y-1">
                      <FileCheck className="h-5 w-5 mx-auto text-zinc-300 dark:text-zinc-600 mb-1" />
                      <p>No practical logs recorded yet for today.</p>
                    </div>
                  ) : (
                    loggedSessions
                      .filter(({ session }) => filterByLab(session))
                      .map(({ session, log }) => {
                        const isSkipped = log.status === 'skipped'
                        const attendancePct =
                          log.totalStudents > 0
                            ? Math.round((log.presentStudents / log.totalStudents) * 100)
                            : 0

                        return (
                          <div
                            key={log.id}
                            className={`p-3.5 px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono hover:bg-zinc-50/70 dark:hover:bg-surface-2/60 transition-all duration-150 ease-out hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 hover:shadow-xs ${getLabRibbon(log.lab || session?.lab)}`}
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-zinc-950 dark:text-white">
                                  {log.subjectCode} — {log.subjectTitle}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 font-bold">
                                  {log.grade}
                                </span>
                                {isSkipped ? (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                    Skipped • {log.skipReason || 'Class in Room'}
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold">
                                    {log.presentStudents}/{log.totalStudents} Present ({attendancePct}%)
                                  </span>
                                )}
                              </div>

                              {!isSkipped && log.topicLearned && (
                                <p className="text-xs text-zinc-600 dark:text-zinc-300 font-medium font-sans">
                                  Topic: <strong className="text-zinc-900 dark:text-zinc-100">{log.topicLearned}</strong>
                                </p>
                              )}

                              <p className="text-[11px] text-zinc-400">
                                {log.timeSlot} • {log.lab} • Subject Teacher: <strong>{log.teacher}</strong>
                              </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {canManageSession(session) ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs font-semibold gap-1 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-2xs"
                                  onClick={() => handleOpenAction(session, 'edit', log)}
                                >
                                  <Edit3 className="h-3 w-3 text-zinc-500" />
                                  <span>Modify</span>
                                </Button>
                              ) : (
                                <span className="text-[11px] text-zinc-400 font-mono italic">
                                  {session.teacher}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })
                  )}
                </div>
              )}

              {/* 4. ALL SESSIONS TIMELINE TAB */}
              {activeTab === 'all' && (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {todaySessions.filter(filterByLab).map((s) => {
                    const existingLog = getLogForSession(s.id, todayDateStr)
                    return (
                      <div
                        key={s.id}
                        className={`p-3.5 px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono hover:bg-zinc-50/70 dark:hover:bg-surface-2/60 transition-all duration-150 ease-out hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 hover:shadow-xs ${getLabRibbon(s.lab)}`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                              {s.timeSlot}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 font-bold">
                              {s.grade}
                            </span>
                            <span className="text-[10px] text-zinc-400">{s.lab}</span>
                            {existingLog && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-200 dark:border-emerald-800">
                                Logged
                              </span>
                            )}
                          </div>
                          <h4 className="text-xs font-bold text-zinc-950 dark:text-white font-sans">
                            {s.subjectCode} — {s.subjectTitle}
                          </h4>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                            Subject Teacher: <strong>{s.teacher}</strong> • Strength: {s.defaultStudents}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {canManageSession(s) ? (
                            existingLog ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800"
                                onClick={() => handleOpenAction(s, 'edit', existingLog)}
                              >
                                <Edit3 className="h-3 w-3 mr-1 text-zinc-400" />
                                Modify
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                className="h-7 text-xs bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                                onClick={() => handleOpenAction(s, 'log')}
                              >
                                Log
                              </Button>
                            )
                          ) : (
                            <span className="text-[11px] text-zinc-400 font-mono italic">
                              {s.teacher}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN (35% / 4 Cols): Facility Telemetry & Quick Dock */}
        <div className="lg:col-span-4 space-y-5">
          {/* 1. Consolidated Facility Telemetry */}
          <FacilityTelemetryCard
            ongoingSessions={ongoingSessions}
            onOpenSession={(session) => handleOpenAction(session, 'log')}
            onQuickBook={handleQuickBook}
          />

          {/* 2. Quick Operations & Certified Audit Action Strip */}
          <div className="glass-card p-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xs space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                Quick Operations
              </span>
              <Link
                href="/print/daily-log"
                className="text-[10px] font-mono font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Daily Sheet ↗
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Link href="/print/records" className="w-full">
                <Button
                  size="sm"
                  className="w-full h-8 px-2.5 text-xs font-bold gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs rounded-xl cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print Report</span>
                </Button>
              </Link>

              <Link href="/logs/new" className="w-full">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-8 px-2.5 text-xs font-semibold gap-1.5 rounded-xl border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-emerald-500" />
                  <span>New Log</span>
                </Button>
              </Link>
            </div>
          </div>

          {/* 3. Syllabus & Practical Progress */}
          <SyllabusProgress />

          {/* 4. Laboratory Incidents & Breakage Register */}
          <IncidentRegistryCard />
        </div>
      </div>

      {/* Interactive Operational Modal (Loaded On-Demand) */}
      {isModalOpen && (
        <SessionActionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          session={selectedSession}
          existingLog={selectedExistingLog}
          allRoutines={routines}
          initialMode={modalMode}
          currentUser={profile}
          onSuccess={handleSuccess}
          onDeleteSession={deleteSession}
          onExtendSession={extendSession}
          onMergeSession={mergeSession}
          onUnmergeSession={unmergeSession}
          onSaveLog={(logData) => {
            if (selectedExistingLog) {
              updateLog(selectedExistingLog.id, logData)
            } else {
              saveLog(logData)
            }
          }}
        />
      )}

      {/* Standalone Quick-Action Damage Report Modal (Loaded On-Demand) */}
      {isReportModalOpen && (
        <ReportIncidentModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
        />
      )}

      {/* Official Academic & National Holidays Calendar Modal (Loaded On-Demand) */}
      {isCalendarModalOpen && (
        <AcademicCalendarModal
          isOpen={isCalendarModalOpen}
          onClose={() => setIsCalendarModalOpen(false)}
        />
      )}
    </div>
  )
}
