'use client'

import React, { useState, useEffect } from 'react'
import {
  Activity,
  BookOpen,
  Clock,
  Users,
  Sparkles,
  ChevronRight,
  ChevronDown,
  ChevronUp,
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
  ShieldCheck,
  Wrench,
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
import IncidentRegistryCard from '@/components/dashboard/incident-registry-card'
import LiveSessionCockpit from '@/components/dashboard/live-session-cockpit'
import FacilityTelemetryCard from '@/components/dashboard/facility-telemetry-card'
import { useIncidentState } from '@/hooks/use-incident-state'
import { getMaintenanceHealthSummary } from '@/app/actions/maintenance'
import DashboardLoading from './loading'
import { TodaysActivityCard, QuickOperationsCard } from '@/components/dashboard/executive-kpi-summary'
import { SlidingSegmentedTabs, SegmentedTab } from '@/components/ui/sliding-segmented-tabs'

function getLabRibbon(_labName?: string) {
  return 'border-l-[3px] border-l-transparent'
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
    now,
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
  const [showAllUpcoming, setShowAllUpcoming] = useState(false)
  const MAX_UPCOMING_DEFAULT = 4

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

  const todayDateStr = getNepalDateStr(now)
  const { getHolidayForDate } = useInfrastructureState()
  const todayHoliday = getHolidayForDate(todayDateStr)
  const currentSlotIdx = MASTER_TIME_SLOTS.findIndex((s) => s.id === activeSlotId)
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
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
    const hr = now.getHours()
    if (hr < 12) setGreeting('Good morning')
    else if (hr < 17) setGreeting('Good afternoon')
    else setGreeting('Good evening')
  }, [now])

  const displayName = profile?.full_name || userScope?.fullName || 'Admin'
  const roleBadgeLabel = profile?.role === 'super_admin'
    ? 'Super Admin'
    : profile?.role === 'lab_incharge'
    ? 'Lab In-Charge'
    : profile?.role === 'hod'
    ? 'Head of Department'
    : 'Subject Teacher'

  // Hydration guard: render stable identical skeleton during SSR and pre-hydration
  if (!mounted) {
    return <DashboardLoading />
  }

  return (
    <div className="space-y-3.5 sm:space-y-4 w-full animate-in fade-in duration-300 relative select-none overflow-x-clip">
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
          className="p-3.5 px-4 sm:px-5 rounded-2xl glass-card border border-zinc-200/80 dark:border-white/[0.08] text-zinc-900 dark:text-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs animate-in fade-in duration-300 cursor-pointer hover:border-zinc-300 dark:hover:border-white/15 transition-all group"
          title="Click to view Academic Calendar & Official National Holidays"
        >
          <div className="flex items-center gap-3.5">
            <div className="h-9 w-9 rounded-xl bg-zinc-100 dark:bg-surface-2 text-zinc-600 dark:text-slate-300 border border-zinc-200/60 dark:border-white/[0.06] flex items-center justify-center shrink-0 shadow-xs">
              <Palmtree className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-slate-400 font-sans">
                  Official Institutional Recess
                </span>
                <span className="text-[11px] font-mono font-medium bg-zinc-100 dark:bg-slate-800 border border-zinc-200 dark:border-slate-700/60 text-zinc-700 dark:text-slate-300 px-2 py-0.5 rounded-md">
                  {todayHoliday.startDateNp} {todayHoliday.endDateNp ? `to ${todayHoliday.endDateNp}` : ''}
                </span>
              </div>
              <h3 className="text-sm font-bold text-zinc-950 dark:text-white mt-0.5 font-heading">
                {todayHoliday.name}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-slate-400 mt-0.5 font-sans">
                All laboratory practical sessions are automatically suspended today (No logs created). Click to view full calendar.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="px-2.5 py-0.5 rounded-lg bg-zinc-100 dark:bg-surface-2 text-zinc-700 dark:text-slate-300 border border-zinc-200 dark:border-white/[0.08] text-xs font-semibold font-sans shrink-0">
              Recess Active
            </span>
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
              <span>View Calendar</span>
              <ArrowUpRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      )}

      {/* 🌟 1. EXECUTIVE WELCOME MESSAGE (CRISP NEUTRAL OFF-WHITE - NO GRADIENT) */}
      <div className="pt-1 pb-0.5">
        <h1 className="text-[28px] sm:text-[34px] md:text-[38px] lg:text-[40px] leading-tight font-extrabold font-heading tracking-[-0.025em] text-zinc-950 dark:text-slate-100">
          {greeting}, <span className="text-zinc-800 dark:text-slate-300 font-bold">{displayName}</span>
        </h1>
      </div>

      {/* 2. MAIN COMMAND CENTER (UNIFIED 2-COLUMN FLOW) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 items-start">
        {/* LEFT COLUMN (65% / 8 Cols): Operational Station & Session Matrix */}
        <div className="lg:col-span-8 space-y-3.5 sm:space-y-4">
          {/* A. Today's Activity KPI Summary */}
          <TodaysActivityCard
            effectiveSlotsCount={effectiveSessions.length}
            loggedCount={loggedCount}
            totalSlotsCount={totalSlotsCount}
            attendanceRate={attendanceRate}
            totalPresentToday={totalPresentToday}
            totalEnrolledToday={totalEnrolledToday}
            passedUnloggedCount={passedUnloggedSessions.length}
            dayName={nepaliDate.dayName}
            dayNameNp={nepaliDate.dayNameNp}
            isHoliday={!!todayHoliday}
            holidayName={todayHoliday?.name}
          />

          {/* B. Live Session Cockpit (Hydration-Safe Two-State Dispatch Station) */}
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
                    label: 'Upcoming',
                    badge: upcomingSessions.length,
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
                onChange={(id) => {
                  setActiveTab(id)
                  setShowAllUpcoming(false)
                }}
              />

              {/* Lab Filter Selector */}
              <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-500">
                <Filter className="h-3 w-3 text-zinc-400" />
                <select
                  value={labFilter}
                  onChange={(e) => {
                    setLabFilter(e.target.value as any)
                    setShowAllUpcoming(false)
                  }}
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
              {/* 1. UPCOMING TAB (DEDICATED QUEUE - ACTIVE SESSIONS ARE IN COCKPIT ABOVE) */}
              {activeTab === 'upcoming' && (() => {
                const filteredUpcoming = upcomingSessions.filter(filterByLab)
                const visibleUpcoming = showAllUpcoming ? filteredUpcoming : filteredUpcoming.slice(0, MAX_UPCOMING_DEFAULT)
                const remainingUpcoming = filteredUpcoming.length - visibleUpcoming.length

                if (filteredUpcoming.length === 0) {
                  return (
                    <div className="py-12 text-center text-zinc-400 font-sans text-xs space-y-1">
                      <Clock className="h-5 w-5 mx-auto text-zinc-400 dark:text-zinc-500 mb-1" />
                      <p className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm">
                        No upcoming practical sessions remaining for today.
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-slate-400">
                        {ongoingSessions.length > 0
                          ? 'Current session is actively running in the cockpit above.'
                          : 'Check the Pending tab to review unlogged past sessions.'}
                      </p>
                    </div>
                  )
                }

                return (
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {/* Upcoming Sessions (Capped at 4 by default) */}
                    {visibleUpcoming.map((s) => (
                      <div
                        key={s.id}
                        className={`py-2.5 sm:py-3 px-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 font-sans hover:bg-zinc-50/70 dark:hover:bg-surface-2/60 transition-all duration-150 ease-out hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 hover:shadow-xs ${getLabRibbon(s.lab)}`}
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <span className="text-xs sm:text-[13px] font-bold font-mono text-zinc-800 dark:text-zinc-200 tabular-nums shrink-0">
                              {s.timeSlot}
                            </span>
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-surface-2 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-white/[0.08] font-sans shrink-0">
                              {s.grade}
                            </span>
                            <span className="text-[11px] font-medium text-zinc-500 dark:text-slate-400 font-sans shrink-0">
                              {s.lab}
                            </span>
                          </div>

                          <h4 className="text-sm sm:text-[15px] font-bold font-heading text-zinc-950 dark:text-white leading-snug truncate flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded font-mono text-xs font-semibold bg-zinc-100 dark:bg-slate-800/80 border border-zinc-200 dark:border-slate-700/60 text-zinc-700 dark:text-slate-300 shrink-0">
                              {s.subjectCode}
                            </span>
                            <span className="truncate">{s.subjectTitle}</span>
                          </h4>

                          <p className="text-xs sm:text-[13px] text-zinc-600 dark:text-slate-300 font-sans leading-tight flex flex-wrap items-center gap-1 sm:gap-1.5">
                            <span>Faculty:</span>
                            <strong className="font-semibold text-zinc-900 dark:text-white">{s.teacher}</strong>
                            <span className="text-zinc-300 dark:text-zinc-600">•</span>
                            <span>Strength:</span>
                            <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">{s.defaultStudents}</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                          {canManageSession(s) && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-3 text-xs font-semibold text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl active:scale-95 transition-transform motion-reduce:active:scale-100 cursor-pointer"
                                onClick={() => handleOpenAction(s, 'skip')}
                              >
                                Skip
                              </Button>
                              <Button
                                size="sm"
                                className="h-8 px-3.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-2xs active:scale-95 transition-transform motion-reduce:active:scale-100 cursor-pointer flex items-center gap-1.5"
                                onClick={() => handleOpenAction(s, 'log')}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Log</span>
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* On-Demand Expansion Control & Timetable Link */}
                    {filteredUpcoming.length > MAX_UPCOMING_DEFAULT ? (
                      <div className="p-3 px-4 sm:px-5 bg-zinc-50/60 dark:bg-surface-1/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs font-sans">
                        <div className="flex items-center gap-2 text-zinc-600 dark:text-slate-300">
                          <span>
                            Showing {visibleUpcoming.length} of {filteredUpcoming.length} upcoming sessions
                          </span>
                          {!showAllUpcoming && remainingUpcoming > 0 && (
                            <span className="px-2 py-0.5 rounded-md font-mono text-[11px] font-semibold bg-zinc-200/80 dark:bg-surface-3 text-zinc-700 dark:text-zinc-300">
                              {remainingUpcoming} more
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowAllUpcoming((prev) => !prev)}
                            className="h-8 px-3 rounded-xl border-zinc-200 dark:border-zinc-700/80 hover:bg-zinc-100 dark:hover:bg-surface-2 text-zinc-800 dark:text-zinc-200 font-medium text-xs gap-1.5 cursor-pointer"
                          >
                            {showAllUpcoming ? (
                              <>
                                <ChevronUp className="h-3.5 w-3.5 text-zinc-500" />
                                <span>Show next {MAX_UPCOMING_DEFAULT} only</span>
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
                                <span>View all ({filteredUpcoming.length})</span>
                              </>
                            )}
                          </Button>

                          <Link
                            href="/schedules"
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30 transition-colors"
                          >
                            <Calendar className="h-3.5 w-3.5" />
                            <span>Lab Timetable</span>
                            <ArrowUpRight className="h-3 w-3" />
                          </Link>
                        </div>
                      </div>
                    ) : (
                      filteredUpcoming.length > 0 && (
                        <div className="py-2.5 px-4 sm:px-5 bg-zinc-50/40 dark:bg-surface-1/30 flex items-center justify-between text-xs font-sans text-zinc-500 dark:text-slate-400">
                          <span>All {filteredUpcoming.length} upcoming sessions shown</span>
                          <Link
                            href="/schedules"
                            className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          >
                            <span>Lab Timetable</span>
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      )
                    )}
                  </div>
                )
              })()}

              {/* 2. PENDING / BACKLOG TAB (CALM, NON-ALARMIST STYLING) */}
              {activeTab === 'backlog' && (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {passedUnloggedSessions.filter(filterByLab).length === 0 ? (
                    <div className="py-12 text-center text-zinc-400 font-sans text-xs space-y-1">
                      <CheckCircle2 className="h-5 w-5 mx-auto text-emerald-500 mb-1" />
                      <p className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm">
                        No pending session logs!
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-slate-400">
                        All passed practical slots have been properly recorded or marked.
                      </p>
                    </div>
                  ) : (
                    passedUnloggedSessions.filter(filterByLab).map((s) => (
                      <div
                        key={s.id}
                        className={`py-2.5 sm:py-3 px-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 font-sans hover:bg-zinc-50/70 dark:hover:bg-surface-2/60 transition-all duration-150 ease-out hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 hover:shadow-xs ${getLabRibbon(s.lab)}`}
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <span className="text-xs sm:text-[13px] font-bold font-mono text-zinc-800 dark:text-zinc-200 tabular-nums shrink-0">
                              {s.timeSlot}
                            </span>
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-surface-2 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-white/[0.08] font-sans shrink-0">
                              {s.grade}
                            </span>
                            <span className="text-[11px] font-medium text-zinc-500 dark:text-slate-400 font-sans shrink-0">
                              {s.lab}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-sans shrink-0">
                              Pending Roll-Call
                            </span>
                          </div>

                          <h4 className="text-sm sm:text-[15px] font-bold font-heading text-zinc-950 dark:text-white leading-snug truncate flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded font-mono text-xs font-semibold bg-zinc-100 dark:bg-slate-800/80 border border-zinc-200 dark:border-slate-700/60 text-zinc-700 dark:text-slate-300 shrink-0">
                              {s.subjectCode}
                            </span>
                            <span className="truncate">{s.subjectTitle}</span>
                          </h4>

                          <p className="text-xs sm:text-[13px] text-zinc-600 dark:text-slate-300 font-sans leading-tight flex flex-wrap items-center gap-1 sm:gap-1.5">
                            <span>Faculty:</span>
                            <strong className="font-semibold text-zinc-900 dark:text-white">{s.teacher}</strong>
                            <span className="text-zinc-300 dark:text-zinc-600">•</span>
                            <span>Strength:</span>
                            <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">{s.defaultStudents}</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                          {canManageSession(s) && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-3 text-xs font-semibold text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl active:scale-95 transition-transform motion-reduce:active:scale-100 cursor-pointer"
                                onClick={() => handleOpenAction(s, 'skip')}
                              >
                                Mark Skipped
                              </Button>
                              <Button
                                size="sm"
                                className="h-8 px-3.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-2xs active:scale-95 transition-transform motion-reduce:active:scale-100 cursor-pointer flex items-center gap-1.5"
                                onClick={() => handleOpenAction(s, 'log')}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Log Attendance</span>
                              </Button>
                            </>
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
                    <div className="py-12 text-center text-zinc-400 font-sans text-xs space-y-1">
                      <FileCheck className="h-5 w-5 mx-auto text-zinc-400 dark:text-zinc-500 mb-1" />
                      <p className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm">
                        No practical logs recorded yet for today.
                      </p>
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
                            className={`py-2.5 sm:py-3 px-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 font-sans hover:bg-zinc-50/70 dark:hover:bg-surface-2/60 transition-all duration-150 ease-out hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 hover:shadow-xs ${getLabRibbon(log.lab || session?.lab)}`}
                          >
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                <span className="text-xs sm:text-[13px] font-bold font-mono text-zinc-800 dark:text-zinc-200 tabular-nums shrink-0">
                                  {log.timeSlot}
                                </span>
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-surface-2 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-white/[0.08] font-sans shrink-0">
                                  {log.grade}
                                </span>
                                <span className="text-[11px] font-medium text-zinc-500 dark:text-slate-400 font-sans shrink-0">
                                  {log.lab}
                                </span>
                                {isSkipped ? (
                                  <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-sans shrink-0">
                                    Skipped • {log.skipReason || 'Class in Room'}
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-mono tabular-nums shrink-0">
                                    {log.presentStudents}/{log.totalStudents} Present ({attendancePct}%)
                                  </span>
                                )}
                              </div>

                              <h4 className="text-sm sm:text-[15px] font-bold font-heading text-zinc-950 dark:text-white leading-snug truncate flex items-center gap-1.5">
                                <span className="px-1.5 py-0.5 rounded font-mono text-xs font-semibold bg-zinc-100 dark:bg-slate-800/80 border border-zinc-200 dark:border-slate-700/60 text-zinc-700 dark:text-slate-300 shrink-0">
                                  {log.subjectCode}
                                </span>
                                <span className="truncate">{log.subjectTitle}</span>
                              </h4>

                              {!isSkipped && log.topicLearned ? (
                                <p className="text-xs sm:text-[13px] text-zinc-600 dark:text-slate-300 font-sans leading-tight truncate">
                                  <span>Topic:</span>{' '}
                                  <strong className="font-semibold text-zinc-900 dark:text-white">{log.topicLearned}</strong>
                                  <span className="text-zinc-300 dark:text-zinc-600 mx-1">•</span>
                                  <span>Faculty:</span>{' '}
                                  <strong className="font-semibold text-zinc-900 dark:text-white">{log.teacher}</strong>
                                </p>
                              ) : (
                                <p className="text-xs sm:text-[13px] text-zinc-600 dark:text-slate-300 font-sans leading-tight">
                                  <span>Faculty:</span>{' '}
                                  <strong className="font-semibold text-zinc-900 dark:text-white">{log.teacher}</strong>
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                              {canManageSession(session) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 px-3 text-xs font-semibold gap-1.5 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl shadow-2xs active:scale-95 transition-transform motion-reduce:active:scale-100 cursor-pointer flex items-center"
                                  onClick={() => handleOpenAction(session, 'edit', log)}
                                >
                                  <Edit3 className="h-3.5 w-3.5 text-zinc-400" />
                                  <span>Modify</span>
                                </Button>
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
                  {todaySessions.filter(filterByLab).length === 0 ? (
                    <div className="py-12 text-center text-zinc-400 font-sans text-xs space-y-1">
                      <Calendar className="h-5 w-5 mx-auto text-zinc-400 dark:text-zinc-500 mb-1" />
                      <p className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm">
                        No scheduled practical sessions found.
                      </p>
                    </div>
                  ) : (
                    todaySessions.filter(filterByLab).map((s) => {
                      const existingLog = getLogForSession(s.id, todayDateStr)
                      return (
                        <div
                          key={s.id}
                          className={`py-2.5 sm:py-3 px-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 font-sans hover:bg-zinc-50/70 dark:hover:bg-surface-2/60 transition-all duration-150 ease-out hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 hover:shadow-xs ${getLabRibbon(s.lab)}`}
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                              <span className="text-xs sm:text-[13px] font-bold font-mono text-zinc-800 dark:text-zinc-200 tabular-nums shrink-0">
                                {s.timeSlot}
                              </span>
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-surface-2 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-white/[0.08] font-sans shrink-0">
                                {s.grade}
                              </span>
                              <span className="text-[11px] font-medium text-zinc-500 dark:text-slate-400 font-sans shrink-0">
                                {s.lab}
                              </span>
                              {existingLog && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-sans shrink-0">
                                  Logged
                                </span>
                              )}
                            </div>

                            <h4 className="text-sm sm:text-[15px] font-bold font-heading text-zinc-950 dark:text-white leading-snug truncate flex items-center gap-1.5">
                              <span className="px-1.5 py-0.5 rounded font-mono text-xs font-semibold bg-zinc-100 dark:bg-slate-800/80 border border-zinc-200 dark:border-slate-700/60 text-zinc-700 dark:text-slate-300 shrink-0">
                                {s.subjectCode}
                              </span>
                              <span className="truncate">{s.subjectTitle}</span>
                            </h4>

                            <p className="text-xs sm:text-[13px] text-zinc-600 dark:text-slate-300 font-sans leading-tight flex flex-wrap items-center gap-1 sm:gap-1.5">
                              <span>Faculty:</span>
                              <strong className="font-semibold text-zinc-900 dark:text-white">{s.teacher}</strong>
                              <span className="text-zinc-300 dark:text-zinc-600">•</span>
                              <span>Strength:</span>
                              <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">{s.defaultStudents}</span>
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                            {canManageSession(s) && (
                              existingLog ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 px-3 text-xs font-semibold gap-1.5 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl shadow-2xs active:scale-95 transition-transform motion-reduce:active:scale-100 cursor-pointer flex items-center"
                                  onClick={() => handleOpenAction(s, 'edit', existingLog)}
                                >
                                  <Edit3 className="h-3.5 w-3.5 text-zinc-400" />
                                  <span>Modify</span>
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  className="h-8 px-3.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-2xs active:scale-95 transition-transform motion-reduce:active:scale-100 cursor-pointer flex items-center gap-1.5"
                                  onClick={() => handleOpenAction(s, 'log')}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  <span>Log</span>
                                </Button>
                              )
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN (35% / 4 Cols): Quick Actions, Facility Rooms & Incidents */}
        <div className="lg:col-span-4 space-y-3.5 sm:space-y-4">
          {/* 1. Quick Operations (Print & New Session Log) */}
          <QuickOperationsCard />

          {/* 2. Consolidated Facility Telemetry (Laboratory Rooms & Availability) */}
          <FacilityTelemetryCard
            ongoingSessions={ongoingSessions}
            onOpenSession={(session) => handleOpenAction(session, 'log')}
            onQuickBook={handleQuickBook}
          />

          {/* 2. Laboratory Incidents & Repair Register */}
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
