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
      <div className="glass-card rounded-2xl p-3.5 sm:p-4 border border-zinc-200/80 dark:border-zinc-800 animate-pulse min-h-[100px] flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-4 w-40 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
          <div className="h-5 w-64 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
          <div className="h-3 w-48 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
        </div>
        <div className="h-8.5 w-32 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
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
      <div className="glass-card relative overflow-hidden rounded-2xl border border-emerald-500/35 dark:border-emerald-500/40 p-3.5 sm:p-4 shadow-xs bg-white dark:bg-surface-1 transition-all duration-200">
        {/* Milled Top Specular Sheen */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent pointer-events-none" />

        {/* Multi-Lab Horizontal Switcher for Admins/Coordinators */}
        {!isTeacher && ongoingSessions.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2.5 border-b border-zinc-100 dark:border-white/[0.06]">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 dark:text-slate-400 mr-1 shrink-0">
              Active Rooms ({ongoingSessions.length}):
            </span>
            {ongoingSessions.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedLabIndex(idx)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-[0.97] motion-reduce:active:scale-100 ${
                  selectedLabIndex === idx
                    ? 'bg-zinc-900 text-white dark:bg-slate-800 dark:text-white border border-zinc-700 dark:border-slate-600 shadow-xs'
                    : 'bg-zinc-100 dark:bg-surface-2 text-zinc-700 dark:text-slate-300 hover:bg-zinc-200 dark:hover:bg-surface-3 border border-zinc-200 dark:border-white/[0.06]'
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>{s.lab}</span>
                <span className="text-[10px] opacity-70">({s.grade})</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
          <div className="space-y-1 min-w-0">
            {/* Live Period Beacon & Countdown (Sole Animated Micro-Accent) */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-sans font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-radar-ripple absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-sm" />
                </span>
                <span>LIVE IN-SESSION • {activePeriodName.toUpperCase()}</span>
              </span>

              <span className="text-xs font-mono font-semibold text-zinc-600 dark:text-slate-400">
                {activeSession.timeSlot} • {activeSession.lab}
              </span>

              {minutesRemaining > 0 ? (
                <span className="inline-flex items-center gap-1 text-xs font-mono font-medium text-zinc-600 dark:text-slate-300 bg-zinc-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md border border-zinc-200 dark:border-slate-700/60 tabular-nums">
                  <Timer className="h-3 w-3 text-zinc-400 dark:text-slate-400" />
                  {minutesRemaining}m remaining
                </span>
              ) : (
                <span className="text-xs font-mono text-zinc-400 italic">Period Concluding</span>
              )}
            </div>

            {/* Experiment Subject Title */}
            <h3 className="text-base sm:text-lg font-bold font-heading tracking-tight text-zinc-950 dark:text-white truncate">
              {activeSession.subjectCode} — {activeSession.subjectTitle}
            </h3>

            {/* Class Grade, Faculty, Strength Details */}
            <p className="text-xs text-zinc-600 dark:text-slate-400 font-sans">
              <span className="font-semibold text-zinc-900 dark:text-zinc-200">{activeSession.grade}</span> • Faculty Supervisor:{' '}
              <strong className="text-zinc-900 dark:text-zinc-100 font-semibold">{activeSession.teacher}</strong> • Strength:{' '}
              <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{activeSession.defaultStudents} Students</span>
            </p>
          </div>

          {/* Action Station CTAs: Log = Primary (Indigo), Skip = Secondary (Neutral Outline) */}
          <div className="flex items-center gap-2 shrink-0 self-start lg:self-center">
            <Button
              variant="outline"
              size="sm"
              className="h-8.5 px-3 text-xs font-semibold text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer active:scale-[0.97] transition-transform motion-reduce:active:scale-100 rounded-xl"
              onClick={() => onOpenAction(activeSession!, 'skip')}
            >
              Skip Session
            </Button>
            <Button
              size="sm"
              className="h-8.5 px-3.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs rounded-xl flex items-center gap-1.5 cursor-pointer active:scale-[0.97] transition-transform motion-reduce:active:scale-100"
              onClick={() => onOpenAction(activeSession!, 'log')}
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Log Practical Session</span>
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
    <div className="glass-card relative overflow-hidden rounded-2xl border border-zinc-200/90 dark:border-border-card p-3.5 sm:p-4 shadow-xs transition-all duration-300">
      {/* Milled Top Specular Sheen */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-zinc-100 dark:bg-surface-2 flex items-center justify-center text-zinc-500 dark:text-slate-400 shrink-0 border border-zinc-200/60 dark:border-border-subtle shadow-2xs">
            {todayHolidayName ? (
              <Calendar className="h-4.5 w-4.5 text-zinc-500 dark:text-slate-400" />
            ) : allCompleted ? (
              <CheckCircle2 className="h-4.5 w-4.5 text-zinc-500 dark:text-slate-400" />
            ) : (
              <Clock className="h-4.5 w-4.5 text-zinc-500 dark:text-slate-400" />
            )}
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold font-sans uppercase tracking-wider text-zinc-500 dark:text-slate-400">
                {todayHolidayName
                  ? 'Institutional Recess Active'
                  : allCompleted
                  ? 'Daily Timetable Concluded'
                  : 'Recess / Between Periods'}
              </span>

              {allCompleted && (
                <span className="px-2 py-0.2 rounded-full text-[11px] font-sans font-semibold bg-zinc-100 dark:bg-surface-2 text-zinc-700 dark:text-slate-300 border border-zinc-200 dark:border-border-subtle">
                  {loggedSessionsCount}/{effectiveSessionsCount} Logged
                </span>
              )}
            </div>

            {todayHolidayName ? (
              <div>
                <h3 className="text-sm sm:text-base font-bold font-heading text-zinc-950 dark:text-white">
                  {todayHolidayName}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-slate-400 font-sans">
                  Laboratory practical operations suspended today. Regular sessions resume tomorrow.
                </p>
              </div>
            ) : nextSession ? (
              <div>
                <h3 className="text-sm sm:text-base font-bold font-heading text-zinc-950 dark:text-white flex items-center gap-2">
                  <span>Next Practical:</span>
                  <span className="text-zinc-800 dark:text-slate-200 font-bold">
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
                <h3 className="text-sm sm:text-base font-bold font-heading text-zinc-950 dark:text-white">
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
                <h3 className="text-sm sm:text-base font-bold font-heading text-zinc-950 dark:text-white">
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
            className="h-8 px-3 text-xs font-sans gap-1.5 text-zinc-700 dark:text-slate-300 border-zinc-200 dark:border-border-card hover:bg-zinc-100 dark:hover:bg-surface-2 shadow-2xs font-semibold cursor-pointer rounded-xl"
            onClick={onOpenTimetable}
          >
            <span>View Timetable</span>
            <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
          </Button>
        </div>
      </div>
    </div>
  )
}
