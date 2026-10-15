'use client'

import React, { useState } from 'react'
import {
  FileCheck,
  RotateCcw,
  Clock,
  Users,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Unlock,
  CheckCircle2,
  Sparkles,
  Loader2,
  ArrowRightLeft,
  Search,
  Check,
  SlidersHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { LiveSessionContext } from '@/app/actions/live-session'

export interface SessionTimingStatus {
  status: 'live' | 'upcoming' | 'past'
  startsInMins?: number
  minsRemaining?: number
}

interface LiveCockpitBarProps {
  sessionContext: LiveSessionContext
  presentCount: number
  totalCount: number
  isSaving: boolean
  onMarkAllPresent: () => void
  onInvertAttendance?: () => void
  onFocusRoll?: (rollNumber: number) => void
  onSubmitSession: () => void
  onSwitchSession?: () => void
  timingStatus?: SessionTimingStatus | null
  onSkipSession?: () => void
  onManageSession?: () => void
}

export function LiveCockpitBar({
  sessionContext,
  presentCount,
  totalCount,
  isSaving,
  onMarkAllPresent,
  onInvertAttendance,
  onFocusRoll,
  onSubmitSession,
  onSwitchSession,
  timingStatus,
  onSkipSession,
  onManageSession,
}: LiveCockpitBarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  const absentCount = Math.max(0, totalCount - presentCount)
  const attendancePercentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0

  // Three-Tier Semantic Attendance Logic
  // >= 85%: Optimal / Emerald
  // 75% - 84%: Normal / Slate (NO false warning color!)
  // < 75%: Low Rate / Rose
  let tierBadge = {
    label: 'Optimal',
    classes: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  }
  if (attendancePercentage < 75) {
    tierBadge = {
      label: 'Low Rate',
      classes: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    }
  } else if (attendancePercentage < 85) {
    tierBadge = {
      label: 'Normal',
      classes: 'text-slate-200 bg-slate-500/10 border-white/10',
    }
  }

  const existingLog = sessionContext.existingLog
  const isLocked = existingLog?.isLocked ?? false
  const hoursRemaining = existingLog?.hoursRemainingInEditWindow ?? 24
  const isUpcoming = timingStatus?.status === 'upcoming'

  // Filter students for Jump-to-Roll search
  const filteredStudents = searchQuery.trim()
    ? sessionContext.expectedRoster.filter(
        (s) =>
          s.rollNumber.toString().includes(searchQuery.trim()) ||
          s.fullName.toLowerCase().includes(searchQuery.toLowerCase().trim())
      )
    : []

  const handleSelectRoll = (roll: number) => {
    onFocusRoll?.(roll)
    setSearchQuery('')
    setIsSearchOpen(false)
  }

  return (
    <div
      className={`rounded-2xl border transition-all duration-300 p-3.5 sm:p-4 shadow-xl space-y-3 font-sans ${
        isUpcoming
          ? 'border-amber-500/30 bg-[#0d121e] ring-1 ring-amber-500/20 shadow-[0_0_25px_rgba(245,158,11,0.08)]'
          : 'border-emerald-500/40 bg-gradient-to-r from-[#0a1b18] via-[#101726] to-[#101726] shadow-[0_0_35px_rgba(16,185,129,0.14)] ring-1 ring-emerald-500/30'
      }`}
    >
      {/* 0. Dedicated Operational Lifecycle Status Ribbon */}
      {/* Top Row: Session Title, Faculty, Time, and Status */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            {isUpcoming ? (
              <span className="flex h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b]" />
            ) : (
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]" />
            )}
            <span className="font-heading font-extrabold text-sm sm:text-base text-white">
              {sessionContext.subjectCode} &bull; {sessionContext.subjectName}
            </span>
            <Badge className="bg-indigo-500/10 text-indigo-300 border-indigo-500/20 text-[10px] font-bold">
              {sessionContext.className}
            </Badge>
            {sessionContext.isAdHoc && (
              <Badge className="bg-amber-500/10 text-amber-300 border-amber-500/20 text-[10px] font-bold">
                Ad-Hoc Makeup Session
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
            <span>Faculty: <strong className="text-slate-200 font-semibold">{sessionContext.sessionTeacherName}</strong></span>
            <span>&bull;</span>
            <span>Period: <strong className="text-slate-200 font-semibold">{sessionContext.startTime} – {sessionContext.endTime}</strong></span>
            <span>&bull;</span>
            <span>Room: <strong className="text-slate-200 font-semibold">{sessionContext.labName}</strong></span>
          </p>
        </div>

        {/* Right side: Operations, Remaining Time, 24-hr Edit Window Badge, Upcoming Status, Skip Button */}
        <div className="flex items-center gap-2 self-start lg:self-auto flex-wrap">
          {/* Remaining time / Countdown Pill */}
          {isUpcoming ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs font-mono font-bold text-amber-300 shadow-xs">
              <Clock className="h-3.5 w-3.5 text-amber-400" />
              <span>Starts in {timingStatus?.startsInMins ?? 0}m</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs font-mono font-bold text-emerald-300 shadow-xs">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              <span>{timingStatus?.minsRemaining ? `${timingStatus.minsRemaining}m remaining` : `Active until ${sessionContext.endTime}`}</span>
            </div>
          )}

          {existingLog ? (
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                existingLog.status === 'skipped'
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                  : isLocked
                  ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              }`}
            >
              {existingLog.status === 'skipped' ? (
                <>
                  <RotateCcw className="h-3.5 w-3.5 text-amber-400" />
                  <span>Session Skipped: {existingLog.skipReason || 'Class suspended'}</span>
                </>
              ) : isLocked ? (
                <>
                  <Lock className="h-3.5 w-3.5 text-rose-400" />
                  <span>Log Locked (Edit Window Closed)</span>
                </>
              ) : (
                <>
                  <Unlock className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Editable: {hoursRemaining}h window remaining</span>
                </>
              )}
            </div>
          ) : null}

          {onManageSession && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onManageSession}
              disabled={isSaving}
              className="h-8 px-2.5 text-xs rounded-xl border-white/10 text-slate-200 hover:bg-white/10 gap-1.5"
              title="Open full session operations modal (Log Attendance, Skip, Merge, Extend, Substitute, Damage)"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-400" />
              <span>Operations</span>
            </Button>
          )}

          {onSkipSession && !isLocked && existingLog?.status !== 'skipped' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSkipSession}
              disabled={isSaving}
              className="h-8 px-2.5 text-xs rounded-xl border-amber-500/30 text-amber-300 hover:bg-amber-500/10 hover:text-amber-200 gap-1.5"
              title="Record skipped practical session with official justification"
            >
              <RotateCcw className="h-3.5 w-3.5 text-amber-400" />
              <span>Skip</span>
            </Button>
          )}

          {onSwitchSession && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSwitchSession}
              className="h-8 px-2.5 text-xs rounded-xl border-white/10 text-slate-300 hover:bg-white/5"
            >
              Switch Session
            </Button>
          )}
        </div>
      </div>

      {/* Bottom Row: Live Telemetry + Operational Roll-Call Buttons */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 text-xs">
        {/* Attendance Counters & Three-tier badge */}
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Enrolled Roster:</span>
            <span className="font-heading font-extrabold text-white tabular-nums text-sm">
              {totalCount}
            </span>
          </div>

          <div className="h-3 w-px bg-white/10 hidden sm:block" />

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Present:</span>
            <span className="font-heading font-extrabold text-emerald-400 tabular-nums text-sm">
              {presentCount}
            </span>
          </div>

          <div className="h-3 w-px bg-white/10 hidden sm:block" />

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Absent:</span>
            <span className="font-heading font-extrabold text-rose-400 tabular-nums text-sm">
              {absentCount}
            </span>
          </div>

          <div className="h-3 w-px bg-white/10 hidden sm:block" />

          <div className={`px-2.5 py-1 rounded-xl border text-xs font-heading font-extrabold tabular-nums flex items-center gap-1.5 ${tierBadge.classes}`}>
            <span>{attendancePercentage}%</span>
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">({tierBadge.label})</span>
          </div>
        </div>

        {/* Accelerators & Search & Actions Strip */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Jump to Roll Quick Search */}
          <div className="relative">
            <div className="flex items-center h-8 px-2.5 rounded-xl bg-[#151E32] border border-white/10 text-xs">
              <Search className="h-3 w-3 text-slate-400 mr-1.5" />
              <input
                type="text"
                placeholder="Jump to Roll..."
                value={searchQuery}
                onFocus={() => setIsSearchOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setIsSearchOpen(true)
                }}
                className="bg-transparent border-none outline-hidden text-xs text-white placeholder:text-slate-500 w-24 sm:w-28"
              />
            </div>

            {/* Quick search autocomplete results popup */}
            {isSearchOpen && filteredStudents.length > 0 && (
              <div className="absolute top-9 left-0 z-50 w-52 max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-[#151E32] shadow-2xl p-1 text-xs">
                {filteredStudents.map((s) => (
                  <button
                    key={s.studentId}
                    type="button"
                    onClick={() => handleSelectRoll(s.rollNumber)}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/10 flex items-center justify-between text-slate-200"
                  >
                    <span className="truncate max-w-[120px]">{s.fullName}</span>
                    <Badge className="bg-indigo-500/20 text-indigo-300 font-mono text-[10px]">
                      Roll {s.rollNumber}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>

          {!isLocked && (
            <>
              {/* Mark All Present Accelerator */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onMarkAllPresent}
                disabled={isSaving}
                className="h-8 px-2.5 text-xs rounded-xl border-white/10 text-slate-200 hover:bg-white/5 gap-1.5"
              >
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span>All Present</span>
              </Button>

              {/* Invert Attendance Accelerator */}
              {onInvertAttendance && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onInvertAttendance}
                  disabled={isSaving}
                  className="h-8 px-2.5 text-xs rounded-xl border-white/10 text-slate-200 hover:bg-white/5 gap-1.5"
                >
                  <ArrowRightLeft className="h-3.5 w-3.5 text-indigo-400" />
                  <span className="hidden sm:inline">Invert</span>
                </Button>
              )}
            </>
          )}

          {/* Save & Submit Button */}
          <Button
            type="button"
            size="sm"
            onClick={onSubmitSession}
            disabled={isSaving || isLocked || isUpcoming}
            title={
              isUpcoming
                ? `Practical log unlocks when scheduled session begins at ${sessionContext.startTime}`
                : isLocked
                ? 'Edit window closed'
                : undefined
            }
            className={`h-8 px-3.5 text-xs font-bold rounded-xl shadow-xs gap-1.5 transition-all ${
              isLocked || isUpcoming
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-white/5'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-[0_0_16px_rgba(16,185,129,0.35)]'
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Recording...</span>
              </>
            ) : isUpcoming ? (
              <>
                <Lock className="h-3.5 w-3.5 text-slate-500" />
                <span>Starts at {sessionContext.startTime}</span>
              </>
            ) : existingLog ? (
              <>
                <FileCheck className="h-3.5 w-3.5" />
                <span>Update Session Log</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Save & Submit Practical Log</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
