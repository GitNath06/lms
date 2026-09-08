'use client'

import React, { useState, useEffect } from 'react'
import {
  Timer,
  CheckCircle2,
  Clock,
  ChevronRight,
  Calendar,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MasterRoutineItem } from '@/lib/master-data'

interface LiveSessionCockpitProps {
  ongoingSessions: MasterRoutineItem[]
  upcomingSessions: MasterRoutineItem[]
  passedUnloggedSessions: MasterRoutineItem[]
  loggedSessionsCount: number
  effectiveSessionsCount: number
  activeSlotId: string | null
  activePeriodName: string
  minutesRemaining: number
  currentUserRole?: string
  currentUserId?: string
  currentTeacherName?: string
  onOpenAction: (session: MasterRoutineItem, mode: 'log' | 'skip') => void
  onOpenTimetable?: () => void
  todayHolidayName?: string | null
}

export default function LiveSessionCockpit({
  ongoingSessions,
  upcomingSessions,
  passedUnloggedSessions,
  loggedSessionsCount,
  effectiveSessionsCount,
  activeSlotId,
  activePeriodName,
  minutesRemaining,
  currentUserRole,
  currentUserId,
  currentTeacherName,
  onOpenAction,
  onOpenTimetable,
  todayHolidayName,
}: LiveSessionCockpitProps) {
  const [mounted, setMounted] = useState(false)
  const [selectedLabIndex, setSelectedLabIndex] = useState(0)

  // Guardrail 1: Hydration guard
  useEffect(() => {
    setMounted(true)
  }, [])

  // SKELETON / STATIC FALLBACK DURING SSR HYDRATION
  if (!mounted) {
    return (
      <div className="glass-card rounded-2xl p-5 border border-zinc-200/80 dark:border-zinc-800 animate-pulse min-h-[140px] flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-4 w-40 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
          <div className="h-6 w-72 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
          <div className="h-3 w-56 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
        </div>
        <div className="h-9 w-36 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
      </div>
    )
  }

  // Guardrail 3: Concurrent Multi-Lab Session Resolution
  const isTeacher = currentUserRole === 'teacher'
  let activeSession: MasterRoutineItem | null = null

  if (ongoingSessions.length > 0) {
    if (isTeacher) {
      // Teachers: Filter strictly by assigned class
      const teacherSession = ongoingSessions.find(
        (s) =>
          (currentTeacherName && s.teacher?.toLowerCase().includes(currentTeacherName.toLowerCase())) ||
          (currentUserId && (s as any).teacher_id === currentUserId)
      )
      activeSession = teacherSession || null
    } else {
      // Admins, Coordinators, Lab In-Charges: Allow switching across active rooms
      activeSession = ongoingSessions[selectedLabIndex] || ongoingSessions[0]
    }
  }

  // ==========================================
  // STATE A: ACTIVE PRACTICAL SESSION RUNNING
  // ==========================================
  if (activeSession) {
    return (
      <div className="glass-card relative overflow-hidden rounded-2xl border-2 border-emerald-500/40 dark:border-emerald-500/30 p-5 shadow-md bg-gradient-to-br from-emerald-500/5 via-white/80 to-transparent dark:from-emerald-950/25 dark:via-surface-1 dark:to-surface-2 transition-all duration-300">
        {/* Milled Top Specular Sheen */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent pointer-events-none" />

        {/* Subtle Ambient Live Glow */}
        <div className="absolute -top-12 -right-12 h-36 w-36 rounded-full bg-emerald-500/15 dark:bg-emerald-500/20 blur-3xl pointer-events-none" />

        {/* Multi-Lab Horizontal Switcher for Admins/Coordinators */}
        {!isTeacher && ongoingSessions.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2.5 mb-3 border-b border-emerald-500/20 dark:border-emerald-500/20">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 mr-1 shrink-0">
              Active Rooms ({ongoingSessions.length}):
            </span>
            {ongoingSessions.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedLabIndex(idx)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-[0.97] motion-reduce:active:scale-100 ${
                  selectedLabIndex === idx
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-500/10 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/20'
                }`}
              >
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-radar-ripple absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-sm" />
                </span>
                <span>{s.lab}</span>
                <span className="text-[10px] opacity-80">({s.grade})</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            {/* Live Period Beacon & Countdown */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/40 shadow-2xs">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-radar-ripple absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-sm" />
                </span>
                <span>LIVE IN-SESSION • {activePeriodName.toUpperCase()}</span>
              </span>

              <span className="text-xs font-mono font-semibold text-zinc-600 dark:text-zinc-400">
                {activeSession.timeSlot} • {activeSession.lab}
              </span>

              {minutesRemaining > 0 ? (
                <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-300/60 dark:border-emerald-800/60 tabular-nums">
                  <Timer className="h-3 w-3 animate-pulse" />
                  {minutesRemaining}m remaining
                </span>
              ) : (
                <span className="text-xs font-mono text-zinc-400 italic">Period Concluding</span>
              )}
            </div>

            {/* Experiment Subject Title */}
            <h3 className="text-lg font-bold font-heading tracking-tight text-zinc-950 dark:text-white truncate">
              {activeSession.subjectCode} — {activeSession.subjectTitle}
            </h3>

            {/* Class Grade, Faculty, Strength Details */}
            <p className="text-xs text-zinc-600 dark:text-zinc-400 font-sans">
              <span className="font-semibold text-zinc-900 dark:text-zinc-200">{activeSession.grade}</span> • Faculty Supervisor:{' '}
              <strong className="text-zinc-900 dark:text-zinc-100 font-semibold">{activeSession.teacher}</strong> • Strength:{' '}
              <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{activeSession.defaultStudents} Students</span>
            </p>
          </div>

          {/* Action Station CTAs */}
          <div className="flex items-center gap-2.5 shrink-0 self-start lg:self-center">
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 text-xs font-semibold text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer active:scale-[0.97] transition-transform motion-reduce:active:scale-100"
              onClick={() => onOpenAction(activeSession!, 'skip')}
            >
              Skip Session
            </Button>
            <Button
              size="sm"
              className="h-9 px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-[0.97] transition-transform motion-reduce:active:scale-100"
              onClick={() => onOpenAction(activeSession!, 'log')}
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Log Practical & Roll Call</span>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ==========================================================
  // STATE B: OFF-HOURS / RECESS / NEXT UP (NO ACTIVE SESSION)
  // ==========================================================
  const nextSession = upcomingSessions.length > 0 ? upcomingSessions[0] : null
  const allCompleted = upcomingSessions.length === 0 && effectiveSessionsCount > 0

  return (
    <div className="glass-card relative overflow-hidden rounded-2xl border border-zinc-200/90 dark:border-border-card p-5 shadow-xs transition-all duration-300">
      {/* Milled Top Specular Sheen */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-surface-2 flex items-center justify-center text-zinc-600 dark:text-slate-300 shrink-0 border border-zinc-200/60 dark:border-border-subtle shadow-2xs">
            {todayHolidayName ? (
              <Calendar className="h-5 w-5 text-amber-500" />
            ) : allCompleted ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            ) : (
              <Clock className="h-5 w-5 text-indigo-500" />
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 dark:text-slate-400">
                {todayHolidayName
                  ? 'Institutional Recess Active'
                  : allCompleted
                  ? 'Daily Timetable Concluded'
                  : 'Recess / Between Periods'}
              </span>

              {allCompleted && (
                <span className="px-2 py-0.2 rounded-full text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {loggedSessionsCount}/{effectiveSessionsCount} Logged
                </span>
              )}
            </div>

            {todayHolidayName ? (
              <div>
                <h3 className="text-base font-bold font-heading text-zinc-950 dark:text-white">
                  {todayHolidayName}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-slate-400 font-sans">
                  Laboratory practical operations suspended today. Regular sessions resume tomorrow.
                </p>
              </div>
            ) : nextSession ? (
              <div>
                <h3 className="text-base font-bold font-heading text-zinc-950 dark:text-white flex items-center gap-2">
                  <span>Next Practical:</span>
                  <span className="text-indigo-600 dark:text-indigo-400">
                    {nextSession.subjectTitle} ({nextSession.grade})
                  </span>
                </h3>
                <p className="text-xs text-zinc-500 dark:text-slate-400 font-sans">
                  Scheduled for <strong>{nextSession.timeSlot}</strong> in {nextSession.lab} • Faculty:{' '}
                  {nextSession.teacher}
                </p>
              </div>
            ) : allCompleted ? (
              <div>
                <h3 className="text-base font-bold font-heading text-zinc-950 dark:text-white">
                  All Scheduled Practical Sessions for Today Have Concluded
                </h3>
                <p className="text-xs text-zinc-500 dark:text-slate-400 font-sans">
                  {passedUnloggedSessions.length > 0
                    ? `${passedUnloggedSessions.length} past session log${passedUnloggedSessions.length > 1 ? 's' : ''} awaiting completion.`
                    : 'All session attendance logs and syllabus topics successfully verified.'}
                </p>
              </div>
            ) : (
              <div>
                <h3 className="text-base font-bold font-heading text-zinc-950 dark:text-white">
                  No Practical Sessions Scheduled For Today
                </h3>
                <p className="text-xs text-zinc-500 dark:text-slate-400 font-sans">
                  Use the timetable scheduler to configure recurring weekly routine practical slots.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Timetable Quick Action */}
        <div className="shrink-0 self-start sm:self-center">
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenTimetable}
            className="h-8 text-xs font-semibold gap-1 text-zinc-700 dark:text-slate-200 border-zinc-200 dark:border-border-subtle dark:bg-surface-2 dark:hover:bg-surface-3 cursor-pointer active:scale-[0.97] transition-transform motion-reduce:active:scale-100"
          >
            <span>View Schedule Grid</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
