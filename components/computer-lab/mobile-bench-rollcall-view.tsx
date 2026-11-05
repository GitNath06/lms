'use client'

import React, { useState, useMemo } from 'react'
import {
  Check,
  X,
  Search,
  ArrowRightLeft,
  Monitor,
  AlertTriangle,
  Wrench,
  RotateCcw,
  Sparkles,
  Users,
  CheckCheck,
  ChevronDown,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { WorkstationWithIssues } from '@/types/workstations'
import type { LiveSessionContext } from '@/app/actions/live-session'

/**
 * Cleanly derives a 2-letter grid coordinate code (e.g. A3, H4) from workstation
 * position_id or row_label + desk index, hiding long strings like 'Row H (Right)'.
 */
function getShortAddress(ws: WorkstationWithIssues): string {
  if (ws.position_id && ws.position_id.trim()) {
    const trimmed = ws.position_id.trim()
    if (trimmed.toUpperCase() === 'PODIUM' || trimmed.toUpperCase() === 'TEACHER') {
      return 'T1'
    }
    return trimmed
  }

  let rowLetter = ''
  if (ws.row_label) {
    const rowMatch = ws.row_label.match(/Row\s*([A-Za-z])/i)
    if (rowMatch) {
      rowLetter = rowMatch[1].toUpperCase()
    }
  }

  let colIndex: number | null = null
  if (ws.label) {
    const numMatch = ws.label.match(/\d+/)
    if (numMatch) {
      const pcNum = parseInt(numMatch[0], 10)
      if (!isNaN(pcNum)) {
        colIndex = ((pcNum - 1) % 4) + 1
      }
    }
  }

  if (rowLetter && colIndex !== null) {
    return `${rowLetter}${colIndex}`
  }

  if (rowLetter) return rowLetter

  if (ws.label) {
    const clean = ws.label.replace(/^PC-?/i, '')
    if (clean) return clean
  }

  return '—'
}

/**
 * Generates clean 2-letter uppercase monogram initials from full student name.
 */
function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return 'ST'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface MobileBenchRollcallViewProps {
  workstations: WorkstationWithIssues[]
  sessionContext: LiveSessionContext | null
  sessionAttendance: Record<string, boolean>
  onToggleAttendance: (identifier: string | number) => void
  onMarkAllPresent: () => void
  onInvertAttendance: () => void
  onRelocateStudent: (destWorkstationId: string, enrollmentId: string) => Promise<void>
  onReportIssue: (workstation: any) => void
  onViewWorkstation?: (workstation: any) => void
  isLiveSession: boolean
  isSuspended?: boolean
  suspensionTitle?: string
}

export function MobileBenchRollcallView({
  workstations,
  sessionContext,
  sessionAttendance,
  onToggleAttendance,
  onMarkAllPresent,
  onInvertAttendance,
  onRelocateStudent,
  onReportIssue,
  onViewWorkstation,
  isLiveSession,
  isSuspended = false,
  suspensionTitle,
}: MobileBenchRollcallViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'absent' | 'present' | 'flagged'>('all')
  const [relocatingEnrollmentId, setRelocatingEnrollmentId] = useState<string | null>(null)
  const [isSubmittingRelocation, setIsSubmittingRelocation] = useState(false)

  // Map workstations with current session seat assignments
  const benchItems = useMemo(() => {
    // Sort workstations naturally: row_label then label (PC-01, PC-02...)
    const sorted = [...workstations].sort((a, b) => {
      const aLabel = a.label || ''
      const bLabel = b.label || ''
      return aLabel.localeCompare(bLabel, undefined, { numeric: true, sensitivity: 'base' })
    })

    return sorted.map((ws) => {
      const seat = sessionContext?.seatPlan ? sessionContext.seatPlan[ws.id] : null
      const isAssigned = Boolean(seat)
      const rollNumber = seat?.rollNumber
      const enrollmentId = seat?.enrollmentId
      const isPresent = enrollmentId
        ? (sessionAttendance[enrollmentId] ?? (rollNumber !== undefined ? sessionAttendance[rollNumber] ?? true : true))
        : rollNumber !== undefined
        ? (sessionAttendance[rollNumber] ?? true)
        : false
      const hasIssue = (ws.open_issues_count && ws.open_issues_count > 0) || (ws.active_issues && ws.active_issues.length > 0)
      const isUnderRepair = ws.status === 'under_repair' || ws.active_issues?.some((i) => i.status === 'in_progress')

      return {
        workstation: ws,
        seat,
        isAssigned,
        rollNumber,
        enrollmentId,
        isPresent,
        hasIssue,
        isUnderRepair,
      }
    })
  }, [workstations, sessionContext?.seatPlan, sessionAttendance])

  // Compute roll-call attendance statistics
  const stats = useMemo(() => {
    const assignedWithRoll = benchItems.filter((b) => b.isAssigned && b.rollNumber !== undefined)
    const totalEnrolled = sessionContext?.expectedRoster?.length || assignedWithRoll.length || 0
    let presentCount = 0

    if (sessionContext?.expectedRoster && sessionContext.expectedRoster.length > 0) {
      sessionContext.expectedRoster.forEach((student) => {
        const isPres =
          sessionAttendance[student.enrollmentId] ??
          (sessionAttendance[student.rollNumber] ?? true)
        if (isPres) {
          presentCount++
        }
      })
    } else {
      assignedWithRoll.forEach((item) => {
        if (item.isPresent) presentCount++
      })
    }

    const absentCount = Math.max(0, totalEnrolled - presentCount)
    const attendancePct = totalEnrolled > 0 ? Math.round((presentCount / totalEnrolled) * 100) : 0

    return {
      total: totalEnrolled,
      present: presentCount,
      absent: absentCount,
      pct: attendancePct,
    }
  }, [benchItems, sessionContext?.expectedRoster, sessionAttendance])

  // Filter items based on search and tab filter
  const filteredItems = useMemo(() => {
    let list = benchItems

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter((item) => {
        const wsMatch = item.workstation.label.toLowerCase().includes(q)
        const nameMatch = item.seat?.fullName.toLowerCase().includes(q)
        const rollMatch = item.rollNumber !== undefined && String(item.rollNumber).includes(q)
        return wsMatch || nameMatch || rollMatch
      })
    }

    if (filterMode === 'absent') {
      list = list.filter((item) => item.isAssigned && !item.isPresent)
    } else if (filterMode === 'present') {
      list = list.filter((item) => item.isAssigned && item.isPresent)
    } else if (filterMode === 'flagged') {
      list = list.filter((item) => item.hasIssue || item.isUnderRepair)
    }

    return list
  }, [benchItems, searchQuery, filterMode])

  // Candidate destination workstations for student relocation
  const vacantWorkstations = useMemo(() => {
    return workstations.filter((ws) => {
      const isOccupied = sessionContext?.seatPlan ? Boolean(sessionContext.seatPlan[ws.id]) : false
      return !isOccupied && ws.is_active !== false
    })
  }, [workstations, sessionContext?.seatPlan])

  const handleExecuteRelocation = async (destWsId: string) => {
    if (!relocatingEnrollmentId) return
    setIsSubmittingRelocation(true)
    try {
      await onRelocateStudent(destWsId, relocatingEnrollmentId)
      setRelocatingEnrollmentId(null)
    } catch (err) {
      console.error('Failed to relocate student:', err)
    } finally {
      setIsSubmittingRelocation(false)
    }
  }

  // Attendance tier badge style
  const getAttendanceBadge = () => {
    if (stats.pct >= 85) {
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs font-bold font-mono">
          {stats.pct}% Optimal
        </Badge>
      )
    }
    if (stats.pct >= 75) {
      return (
        <Badge className="bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30 text-xs font-bold font-mono">
          {stats.pct}% Normal
        </Badge>
      )
    }
    return (
      <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 text-xs font-bold font-mono">
        {stats.pct}% Low Rate
      </Badge>
    )
  }

  return (
    <div className="w-full flex flex-col space-y-3 font-sans pb-6">
      {/* 1. COMPACT ATTENDANCE HUD & QUICK ACCELERATORS */}
      <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#101726] p-3.5 shadow-md space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <Users className="h-4 w-4" />
            </span>
            <div>
              <div className="text-xs font-heading font-extrabold text-zinc-900 dark:text-white flex items-center gap-1.5">
                <span>Roll-Call Attendance</span>
                {getAttendanceBadge()}
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-slate-400 font-mono">
                {stats.present} Present &bull; {stats.absent} Absent &bull; {stats.total} Total
              </div>
            </div>
          </div>

          {/* Quick 1-Tap Accelerators */}
          {isLiveSession && !isSuspended && (
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onMarkAllPresent}
                className="h-8 px-2.5 text-xs font-bold rounded-lg border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 gap-1"
                title="Mark all students present"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span className="hidden xs:inline">All</span> Present
              </Button>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onInvertAttendance}
                className="h-8 px-2 text-xs font-bold rounded-lg border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-slate-300 hover:bg-zinc-100 dark:hover:bg-white/5"
                title="Invert attendance selection"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-2 pt-1 border-t border-zinc-100 dark:border-white/[0.06]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <Input
              type="text"
              placeholder="Search by Roll #, Student Name, or PC..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 text-xs rounded-xl border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-[#0B0F19]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                filterMode === 'all'
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200'
              }`}
            >
              All ({benchItems.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('present')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                filterMode === 'present'
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20'
              }`}
            >
              Present ({stats.present})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('absent')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                filterMode === 'absent'
                  ? 'bg-rose-600 text-white font-bold'
                  : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 hover:bg-rose-500/20'
              }`}
            >
              Absent ({stats.absent})
            </button>
          </div>
        </div>
      </div>

      {/* 2. RECESSED HOLIDAY NOTICE IF APPLICABLE */}
      {isSuspended && (
        <div className="rounded-2xl border border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-3.5 flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-200 font-medium">
          <Info className="h-4 w-4 text-amber-500 shrink-0" />
          <span>Attendance is suspended today: {suspensionTitle || 'Institutional Recess'}</span>
        </div>
      )}

      {/* 3. BENCH / WORKSTATION CARD LIST */}
      <div className="space-y-2">
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center rounded-2xl border border-dashed border-zinc-200 dark:border-white/10 bg-white/50 dark:bg-[#101726]/50">
            <p className="text-xs text-zinc-500 dark:text-slate-400">
              No matching benches or students found for &ldquo;{searchQuery}&rdquo;.
            </p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const { workstation, seat, isAssigned, rollNumber, enrollmentId, isPresent, hasIssue, isUnderRepair } = item
            const shortAddress = getShortAddress(workstation)
            const studentPhotoUrl =
              seat?.photoUrl ||
              sessionContext?.expectedRoster?.find((s) => s.rollNumber === seat?.rollNumber)?.photoUrl ||
              null
            const issueCount =
              workstation.open_issues_count ||
              workstation.active_issues?.filter((i) => i.status !== 'resolved').length ||
              (hasIssue ? 1 : 0)
            const activeFaultTitle =
              workstation.active_issues?.find((i) => i.status !== 'resolved')?.title ||
              (hasIssue ? 'Hardware/Software Fault' : null)

            return (
              <div
                key={workstation.id}
                data-testid="mobile-bench-item"
                onClick={() => {
                  if (onViewWorkstation) {
                    onViewWorkstation(workstation)
                  } else {
                    onReportIssue(workstation)
                  }
                }}
                className={`p-3 rounded-2xl glass-card border flex items-center justify-between gap-3 active:scale-[0.99] transition-all cursor-pointer select-none ${
                  isLiveSession && !isSuspended && isAssigned && !isPresent
                    ? 'border-rose-500/30 bg-rose-500/[0.03] dark:bg-rose-950/10'
                    : hasIssue || isUnderRepair
                    ? 'border-amber-500/40 bg-amber-500/[0.02] dark:bg-amber-950/10'
                    : 'border-zinc-200/80 dark:border-white/[0.08] bg-white dark:bg-[#101726]'
                } shadow-xs hover:border-indigo-500/40`}
              >
                {/* Left-Center Middle Area: Top badges & Student info */}
                <div className="min-w-0 flex-1 space-y-1">
                  {/* Top-Left Corner: Hardware badge + status LED dot + micro 2-letter coordinate + issue pill */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Compact Hardware Badge */}
                    <span className="font-heading font-extrabold text-xs px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-white/10 text-zinc-900 dark:text-white border border-zinc-200/70 dark:border-white/10 shrink-0 tabular-nums">
                      {workstation.label}
                    </span>

                    {/* Status LED dot */}
                    {isUnderRepair ? (
                      <span className="h-2 w-2 rounded-full bg-rose-500 ring-2 ring-rose-500/20 shrink-0" title="Under Repair" />
                    ) : hasIssue ? (
                      <span className="h-2 w-2 rounded-full bg-amber-500 ring-2 ring-amber-500/20 shrink-0" title="Issue Flagged" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" title="Operational" />
                    )}

                    {/* Micro 2-letter grid coordinate badge (position_id like A3, H4) */}
                    <span className="text-[10px] font-mono font-semibold text-zinc-400 dark:text-slate-400 px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200/50 dark:border-white/[0.06] shrink-0">
                      {shortAddress}
                    </span>

                    {/* Subtle Amber/Rose Indicator Pill for active faults */}
                    {isUnderRepair ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 dark:text-rose-400 px-1.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 shrink-0">
                        <Wrench className="h-2.5 w-2.5" />
                        <span>Under Repair</span>
                      </span>
                    ) : hasIssue ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 shrink-0">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        <span>{issueCount} {issueCount === 1 ? 'Issue' : 'Issues'}</span>
                      </span>
                    ) : null}

                    {/* Relocated Badge */}
                    {seat?.isOverride && (
                      <Badge className="text-[9px] bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 px-1.5 py-0 shrink-0">
                        Relocated
                      </Badge>
                    )}
                  </div>

                  {/* Left-Center Middle Area: Student Full Name or Vacant Bench + Micro-Status */}
                  <div className="pt-0.5 min-w-0">
                    {isAssigned && seat ? (
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold font-heading text-zinc-900 dark:text-white truncate leading-snug">
                          {seat.fullName}
                        </span>
                        <div className="text-[11px] truncate leading-tight mt-0.5">
                          {hasIssue && activeFaultTitle ? (
                            <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              <span className="truncate">{activeFaultTitle}</span>
                            </span>
                          ) : isLiveSession && !isSuspended ? (
                            isPresent ? (
                              <span className="text-emerald-600 dark:text-emerald-400/90 font-medium">
                                Present &bull; Tap to toggle / report
                              </span>
                            ) : (
                              <span className="text-rose-600 dark:text-rose-400/90 font-medium">
                                Absent &bull; Tap to toggle / report
                              </span>
                            )
                          ) : isSuspended ? (
                            <span className="text-zinc-500 dark:text-slate-400 italic">
                              Session Suspended
                            </span>
                          ) : seat.originalWorkstationLabel ? (
                            <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                              Moved from {seat.originalWorkstationLabel}
                            </span>
                          ) : (
                            <span className="text-zinc-500 dark:text-slate-400">
                              Assigned Cohort Desk
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs text-zinc-400 dark:text-slate-500 italic flex items-center gap-1.5 leading-snug">
                          <span>Vacant Bench</span>
                        </span>
                        {hasIssue && activeFaultTitle ? (
                          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium truncate flex items-center gap-1 mt-0.5">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            <span className="truncate">{activeFaultTitle}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-400 dark:text-slate-500 mt-0.5">
                            Tap to report issue or allocate
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Side Column (Student Avatar + Roll Number Below OR Compact Vacant Pill) */}
                {isAssigned && seat ? (
                  <div
                    className="flex flex-col items-center justify-center shrink-0 min-w-[48px] min-h-[48px] touch-manipulation cursor-pointer"
                    onClick={(e) => {
                      if (isLiveSession && !isSuspended && (enrollmentId || rollNumber !== undefined)) {
                        e.stopPropagation()
                        try {
                          navigator.vibrate?.(10)
                        } catch {}
                        onToggleAttendance(enrollmentId || rollNumber!)
                      }
                    }}
                    title={
                      isLiveSession && !isSuspended
                        ? `Click to mark ${isPresent ? 'Absent' : 'Present'}`
                        : undefined
                    }
                  >
                    {/* Student circular photo avatar */}
                    <div
                      className={`relative h-10 w-10 rounded-full overflow-hidden bg-zinc-100 dark:bg-[#151E32] flex items-center justify-center shadow-xs transition-transform active:scale-95 ${
                        isLiveSession && !isSuspended && !isPresent
                          ? 'ring-2 ring-rose-500/60 ring-offset-1 ring-offset-white dark:ring-offset-[#101726]'
                          : hasIssue || isUnderRepair
                          ? 'ring-2 ring-amber-500/50 ring-offset-1 ring-offset-white dark:ring-offset-[#101726]'
                          : 'ring-1 ring-zinc-200 dark:ring-white/10'
                      }`}
                    >
                      {studentPhotoUrl ? (
                        <img
                          src={studentPhotoUrl}
                          alt={seat.fullName}
                          className="h-full w-full object-cover object-top"
                        />
                      ) : (
                        <span className="font-heading font-extrabold text-xs text-zinc-600 dark:text-slate-300 select-none">
                          {getInitials(seat.fullName)}
                        </span>
                      )}
                    </div>

                    {/* Compact Roll Number label directly below photo */}
                    <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-1 tabular-nums tracking-tight">
                      Roll #{seat.rollNumber}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center shrink-0 min-w-[52px]">
                    <span className="text-[10px] font-mono text-zinc-400 dark:text-slate-500 px-2 py-1 rounded-lg border border-dashed border-zinc-200 dark:border-white/10">
                      Vacant
                    </span>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
