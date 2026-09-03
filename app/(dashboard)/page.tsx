'use client'

import React, { useState } from 'react'
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
  Terminal,
  Atom,
  FlaskRound,
  Filter,
  ArrowUpRight,
  AlertTriangle,
} from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MASTER_TIME_SLOTS, MasterRoutineItem } from '@/lib/master-data'
import { getNepalDateStr } from '@/lib/nepali-date'
import SessionActionModal, { ModalMode } from '@/components/schedules/session-action-modal'
import { useLiveSchedule } from '@/hooks/use-live-schedule'
import { useRoutineState } from '@/hooks/use-routine-state'
import { useLogsState, PracticalLogRecord } from '@/hooks/use-logs-state'
import SyllabusProgress from '@/components/dashboard/syllabus-progress'
import IncidentRegistryCard from '@/components/dashboard/incident-registry-card'
import ReportIncidentModal from '@/components/dashboard/report-incident-modal'

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

  const [selectedSession, setSelectedSession] = useState<MasterRoutineItem | null>(null)
  const [selectedExistingLog, setSelectedExistingLog] = useState<PracticalLogRecord | null>(null)
  const [modalMode, setModalMode] = useState<ModalMode>('log')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Segmented Tab and Lab Filter State
  const [activeTab, setActiveTab] = useState<'upcoming' | 'backlog' | 'completed' | 'all'>('upcoming')
  const [labFilter, setLabFilter] = useState<'all' | 'comp' | 'phys' | 'chem'>('all')

  const todayDateStr = getNepalDateStr(new Date())
  const currentSlotIdx = MASTER_TIME_SLOTS.findIndex((s) => s.id === activeSlotId)
  const currentMinutes = new Date().getHours() * 60 + new Date().getMinutes()
  const isBeforeSchool = currentMinutes < 9 * 60 + 15
  const isAfterSchool = currentMinutes >= 16 * 60 + 50

  // Categorize today's sessions
  const loggedSessions: { session: MasterRoutineItem; log: PracticalLogRecord }[] = []
  const ongoingSessions: MasterRoutineItem[] = []
  const passedUnloggedSessions: MasterRoutineItem[] = []
  const upcomingSessions: MasterRoutineItem[] = []

  todaySessions.forEach((session) => {
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
      teacher: 'Assigned Faculty',
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

  // Filter helper
  const filterByLab = (s: MasterRoutineItem) => {
    if (labFilter === 'all') return true
    return s.labKey === labFilter
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto animate-in fade-in duration-300 relative select-none">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-4 py-2.5 rounded-xl shadow-2xl text-xs font-medium animate-in slide-in-from-top-2 duration-200 flex items-center gap-2 border border-zinc-700 dark:border-zinc-300">
          <Sparkles className="h-4 w-4 text-amber-400 dark:text-amber-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. TOP EXECUTIVE KPI CARDS (ULTRA-MODERN GLASSMORPHIC COMMAND TILES) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Today's Practical Timetable */}
        <div className="relative overflow-hidden rounded-2xl border border-zinc-200/90 dark:border-zinc-800/90 bg-gradient-to-br from-white via-zinc-50/50 to-zinc-100/40 dark:from-zinc-900/90 dark:via-zinc-900/50 dark:to-zinc-950 p-4 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-800/60 transition-all duration-300 group">
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-10 -right-10 h-24 w-24 rounded-full bg-indigo-500/10 dark:bg-indigo-500/15 blur-2xl group-hover:bg-indigo-500/20 transition-all" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/60 dark:border-indigo-800/50 shadow-2xs">
                <BookOpen className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
                Today's Matrix
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/50 font-semibold">
              2083 Routine
            </span>
          </div>

          <div className="mt-3 mb-2 flex items-baseline justify-between" suppressHydrationWarning>
            <div className="flex items-baseline gap-1.5" suppressHydrationWarning>
              <span suppressHydrationWarning className="text-3xl font-extrabold font-mono tracking-tight text-zinc-950 dark:text-white">
                {todaySessions.length}
              </span>
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Practical Slots
              </span>
            </div>
            <span suppressHydrationWarning className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300">
              {ongoingSessions.length > 0 ? (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 text-[11px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                  1 In-Session
                </span>
              ) : (
                <span className="text-zinc-400 text-[11px]">Scheduled</span>
              )}
            </span>
          </div>

          {/* Mini Session Distribution Bar */}
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
              {nepaliDate.dayNameNp}
            </span>
            <span>{nepaliDate.dayName} Timetable</span>
          </div>
        </div>

        {/* Card 2: Operational Log Completion */}
        <div className="relative overflow-hidden rounded-2xl border border-zinc-200/90 dark:border-zinc-800/90 bg-gradient-to-br from-white via-zinc-50/50 to-zinc-100/40 dark:from-zinc-900/90 dark:via-zinc-900/50 dark:to-zinc-950 p-4 shadow-sm hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-800/60 transition-all duration-300 group">
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-10 -right-10 h-24 w-24 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 blur-2xl group-hover:bg-emerald-500/20 transition-all" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/60 dark:border-emerald-800/50 shadow-2xs">
                <FileCheck className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
                Log Turnout
              </span>
            </div>
            <span suppressHydrationWarning className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/50 font-bold">
              {todaySessions.length > 0 ? Math.round((loggedSessions.length / todaySessions.length) * 100) : 0}% Done
            </span>
          </div>

          <div className="mt-3 mb-2 flex items-baseline justify-between" suppressHydrationWarning>
            <div className="flex items-baseline gap-1.5" suppressHydrationWarning>
              <span suppressHydrationWarning className="text-3xl font-extrabold font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
                {loggedSessions.length}
              </span>
              <span suppressHydrationWarning className="text-xs font-mono text-zinc-400">
                / {todaySessions.length} Logged
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
              style={{
                width: `${todaySessions.length > 0 ? Math.min(100, Math.round((loggedSessions.length / todaySessions.length) * 100)) : 0}%`,
              }}
            />
          </div>

          <div className="border-t border-zinc-100 dark:border-zinc-800/80 pt-1.5 flex items-center justify-between text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
            <span>Audit State:</span>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              {passedUnloggedSessions.length === 0 ? 'Verified' : 'Action Pending'}
            </span>
          </div>
        </div>

        {/* Card 3: Live Bikram Sambat (B.S.) Calendar */}
        <div className="relative overflow-hidden rounded-2xl border border-zinc-200/90 dark:border-zinc-800/90 bg-gradient-to-br from-white via-zinc-50/50 to-zinc-100/40 dark:from-zinc-900/90 dark:via-zinc-900/50 dark:to-zinc-950 p-4 shadow-sm hover:shadow-md hover:border-amber-300 dark:hover:border-amber-800/60 transition-all duration-300 group">
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-10 -right-10 h-24 w-24 rounded-full bg-amber-500/10 dark:bg-amber-500/15 blur-2xl group-hover:bg-amber-500/20 transition-all" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200/60 dark:border-amber-800/50 shadow-2xs">
                <Calendar className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
                Nepali Date
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/50 font-bold">
              B.S. 2083
            </span>
          </div>

          <div className="mt-2.5 mb-1.5">
            <div className="text-xl font-bold tracking-tight text-zinc-950 dark:text-white truncate">
              {mounted ? nepaliDate.formattedDateNp : '२०८३ भदौ १६, बुधवार'}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
              {mounted ? nepaliDate.dayNameNp : 'बुधवार'} • {nepaliDate.dayName}
            </div>
          </div>

          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
            <span>Solar Calendar:</span>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              {mounted ? nepaliDate.englishDate : '2 Sept 2026'} (A.D.)
            </span>
          </div>
        </div>

        {/* Card 4: Precision Live Clock */}
        <div className="relative overflow-hidden rounded-2xl border border-zinc-200/90 dark:border-zinc-800/90 bg-gradient-to-br from-white via-zinc-50/50 to-zinc-100/40 dark:from-zinc-900/90 dark:via-zinc-900/50 dark:to-zinc-950 p-4 shadow-sm hover:shadow-md hover:border-cyan-300 dark:hover:border-cyan-800/60 transition-all duration-300 group">
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-10 -right-10 h-24 w-24 rounded-full bg-cyan-500/10 dark:bg-cyan-500/15 blur-2xl group-hover:bg-cyan-500/20 transition-all" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center border border-cyan-200/60 dark:border-cyan-800/50 shadow-2xs">
                <Clock className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
                Precision Clock
              </span>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200/60 dark:border-cyan-800/50">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-ping" />
              LIVE NPT
            </span>
          </div>

          <div className="mt-2.5 mb-1.5">
            <div className="text-2xl font-extrabold font-mono tracking-tight text-zinc-950 dark:text-white tabular-nums">
              {mounted ? timeString : '--:--:--'}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5 flex items-center justify-between">
              <span>Timezone:</span>
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">UTC +05:45</span>
            </div>
          </div>

          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
            <span>Current Period:</span>
            <span className="font-bold text-cyan-600 dark:text-cyan-400 truncate max-w-[120px]">
              {activePeriodName}
            </span>
          </div>
        </div>
      </div>

      {/* 2. MAIN COMMAND CENTER (2-COLUMN ARCHITECTURE) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN (65% / 8 Cols): Operational Station & Session Matrix */}
        <div className="lg:col-span-8 space-y-5">
          {/* A. Live Station Hero Banner */}
          {featuredSession ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/15 p-4.5 shadow-2xs backdrop-blur-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                      LIVE NOW // {activePeriodName.toUpperCase()}
                    </span>
                    <span className="text-xs text-zinc-500 font-mono">
                      {featuredSession.timeSlot} • {featuredSession.lab}
                    </span>
                    {minutesRemaining > 0 && (
                      <span className="text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Timer className="h-3 w-3" />
                        {minutesRemaining}m left
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-zinc-950 dark:text-white">
                    {featuredSession.subjectCode} — {featuredSession.subjectTitle}
                  </h3>

                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                    {featuredSession.grade} • Faculty: <strong className="text-zinc-800 dark:text-zinc-200">{featuredSession.teacher}</strong> • Strength: {featuredSession.defaultStudents}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-semibold text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    onClick={() => handleOpenAction(featuredSession, 'skip')}
                  >
                    Skip
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
                    onClick={() => handleOpenAction(featuredSession, 'log')}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    Log Live Practical
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4 shadow-2xs backdrop-blur-md flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <span>Current Status:</span>
                    <span className="font-mono text-zinc-500 font-normal">{activePeriodName}</span>
                  </div>
                  <div suppressHydrationWarning className="text-[11px] text-zinc-400 font-mono">
                    {upcomingSessions.length > 0
                      ? `${upcomingSessions.length} upcoming scheduled sessions remaining today.`
                      : 'All scheduled practical sessions for today have concluded.'}
                  </div>
                </div>
              </div>

              <Link href="/schedules">
                <Button variant="outline" size="sm" className="h-7 text-xs font-mono gap-1 text-zinc-600 dark:text-zinc-300">
                  <span>Timetable Matrix</span>
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          )}

          {/* B. Segmented Session Feed Card */}
          <Card className="border border-zinc-200/80 dark:border-zinc-800 shadow-2xs overflow-hidden">
            {/* Tab Header Bar */}
            <div className="border-b border-zinc-100 dark:border-zinc-800/80 p-3 bg-zinc-50/50 dark:bg-zinc-900/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              {/* Segmented Pills */}
              <div suppressHydrationWarning className="flex items-center gap-1 p-1 bg-zinc-200/60 dark:bg-zinc-800/60 rounded-lg text-xs font-medium font-mono">
                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={() => setActiveTab('upcoming')}
                  className={`px-3 py-1.5 rounded-md transition-all ${
                    activeTab === 'upcoming'
                      ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-xs font-bold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  Live & Upcoming ({upcomingSessions.length + ongoingSessions.length})
                </button>

                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={() => setActiveTab('backlog')}
                  className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                    activeTab === 'backlog'
                      ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-xs font-bold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <span>Pending</span>
                  {passedUnloggedSessions.length > 0 && (
                    <span suppressHydrationWarning className="px-1.5 py-0.2 rounded-full text-[9px] bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold">
                      {passedUnloggedSessions.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={() => setActiveTab('completed')}
                  className={`px-3 py-1.5 rounded-md transition-all ${
                    activeTab === 'completed'
                      ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-xs font-bold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  Logged Records ({loggedSessions.length})
                </button>

                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1.5 rounded-md transition-all hidden sm:block ${
                    activeTab === 'all'
                      ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-xs font-bold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  All ({todaySessions.length})
                </button>
              </div>

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
                          className="p-3.5 px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono bg-emerald-50/20 dark:bg-emerald-950/10 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-colors"
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
                              Faculty: <strong>{s.teacher}</strong> • Strength: {s.defaultStudents}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
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
                          </div>
                        </div>
                      ))}

                      {upcomingSessions.filter(filterByLab).map((s) => (
                        <div
                          key={s.id}
                          className="p-3.5 px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40 transition-colors"
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
                              Faculty: <strong>{s.teacher}</strong> • Strength: {s.defaultStudents}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
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
                        className="p-3.5 px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40 transition-colors"
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
                            Faculty: <strong>{s.teacher}</strong> • Strength: {s.defaultStudents}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
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
                        const turnout =
                          log.totalStudents > 0
                            ? Math.round((log.presentStudents / log.totalStudents) * 100)
                            : 0

                        return (
                          <div
                            key={log.id}
                            className="p-3.5 px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40 transition-colors"
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
                                    {log.presentStudents}/{log.totalStudents} Present ({turnout}%)
                                  </span>
                                )}
                              </div>

                              {!isSkipped && log.topicLearned && (
                                <p className="text-xs text-zinc-600 dark:text-zinc-300 font-medium font-sans">
                                  Topic: <strong className="text-zinc-900 dark:text-zinc-100">{log.topicLearned}</strong>
                                </p>
                              )}

                              <p className="text-[11px] text-zinc-400">
                                {log.timeSlot} • {log.lab} • Faculty: <strong>{log.teacher}</strong>
                              </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs font-semibold gap-1 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-2xs"
                                onClick={() => handleOpenAction(session, 'edit', log)}
                              >
                                <Edit3 className="h-3 w-3 text-zinc-500" />
                                <span>Modify</span>
                              </Button>
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
                        className="p-3.5 px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40 transition-colors"
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
                            Faculty: <strong>{s.teacher}</strong> • Strength: {s.defaultStudents}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {existingLog ? (
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
          {/* 1. Live Facility Telemetry Pods */}
          <Card className="border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
            <CardHeader className="p-4 pb-3 border-b border-zinc-100 dark:border-zinc-800/80 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Facility Telemetry
                </CardTitle>
                <CardDescription className="text-[11px] text-zinc-500">
                  Live Room Occupancy
                </CardDescription>
              </div>
              <span className="text-[10px] font-mono text-zinc-400">Real-time</span>
            </CardHeader>

            <CardContent className="p-3.5 space-y-3">
              {[
                {
                  key: 'comp',
                  name: 'Computer Lab 01',
                  code: 'LAB-COMP-01',
                  icon: Terminal,
                  capacity: 40,
                },
                {
                  key: 'phys',
                  name: 'Physics Laboratory',
                  code: 'LAB-PHYS-01',
                  icon: Atom,
                  capacity: 38,
                },
                {
                  key: 'chem',
                  name: 'Chemistry Laboratory',
                  code: 'LAB-CHEM-01',
                  icon: FlaskRound,
                  capacity: 40,
                },
              ].map((lab) => {
                const Icon = lab.icon
                const activeSessionInLab = ongoingSessions.find(
                  (s) =>
                    (lab.key === 'comp' && s.lab === 'Computer Lab') ||
                    (lab.key === 'phys' && s.lab === 'Physics Lab') ||
                    (lab.key === 'chem' && s.lab === 'Chemistry Lab')
                )
                const isOccupied = !!activeSessionInLab

                return (
                  <div
                    key={lab.key}
                    className={`p-3 rounded-xl border transition-all ${
                      isOccupied
                        ? 'border-emerald-500/30 bg-emerald-50/15 dark:bg-emerald-950/15'
                        : 'border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/40 dark:bg-zinc-900/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400">
                          <Icon className="h-3 w-3" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                            {lab.name}
                          </h4>
                        </div>
                      </div>

                      {isOccupied ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                          IN USE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono text-zinc-500 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                          <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                          FREE
                        </span>
                      )}
                    </div>

                    {isOccupied && activeSessionInLab ? (
                      <div className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 mt-1 pl-8">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {activeSessionInLab.subjectCode} ({activeSessionInLab.grade})
                        </span>
                        <div className="text-[10px] text-zinc-400">
                          {activeSessionInLab.teacher} • {activeSessionInLab.timeSlot}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 mt-1 pl-8">
                        <span>Capacity: {lab.capacity}</span>
                        <button
                          onClick={() => handleQuickBook(lab.name)}
                          className="text-indigo-600 dark:text-indigo-400 text-[10px] font-bold hover:underline"
                        >
                          + Quick Book
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* 2. Quick Operations Shortcuts */}
          <div className="p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-2xs space-y-2.5">
            <div className="text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
              Quick Actions
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Link href="/logs/new" className="w-full">
                <Button variant="outline" size="sm" className="w-full h-8 text-xs font-semibold gap-1 text-zinc-700 dark:text-zinc-300">
                  <Plus className="h-3 w-3" />
                  <span>Log Entry</span>
                </Button>
              </Link>
              <Link href="/print/daily-log" className="w-full">
                <Button variant="outline" size="sm" className="w-full h-8 text-xs font-semibold gap-1 text-zinc-700 dark:text-zinc-300">
                  <Printer className="h-3 w-3" />
                  <span>Daily Sheet</span>
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsReportModalOpen(true)}
                className="w-full h-8 text-xs font-semibold gap-1 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                <AlertTriangle className="h-3 w-3 text-rose-500" />
                <span>Damage</span>
              </Button>
            </div>
          </div>

          {/* 3. Syllabus & Practical Progress */}
          <SyllabusProgress />

          {/* 4. Laboratory Incidents & Breakage Register */}
          <IncidentRegistryCard />
        </div>
      </div>

      {/* Interactive Operational Modal */}
      <SessionActionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        session={selectedSession}
        existingLog={selectedExistingLog}
        allRoutines={routines}
        initialMode={modalMode}
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

      {/* Standalone Quick-Action Damage Report Modal */}
      <ReportIncidentModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
      />
    </div>
  )
}
