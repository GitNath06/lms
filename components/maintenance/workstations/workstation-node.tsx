'use client'

import React from 'react'
import {
  Monitor,
  Laptop,
  Server,
  AlertCircle,
  Wrench,
  ShieldAlert,
  User,
  ArrowRightLeft,
  Check,
  X,
  Sparkles,
} from 'lucide-react'
import type { WorkstationWithIssues } from '@/types/workstations'
import type { WorkstationSeatAssignment } from '@/lib/types/seat-plans'
import { ProgressiveAvatar } from '@/components/ui/progressive-avatar'

interface WorkstationNodeProps {
  workstation: WorkstationWithIssues & {
    assignment?: WorkstationSeatAssignment | null
    session_override?: {
      override_id: string
      student_id?: string
      student_name: string
      roll_number: number
      reason?: string | null
      photo_url?: string | null
      has_photo?: boolean
    } | null
    isPresent?: boolean | null
  }
  isLayoutMode?: boolean
  isSeatPlanMode?: boolean
  isSelected?: boolean
  isDropTarget?: boolean
  isFocused?: boolean
  isAssistanceRequested?: boolean
  assistanceRequest?: {
    id: string
    title: string
    description?: string | null
    severity?: string
    studentName?: string | null
    studentRoll?: string | null
  } | null
  onAcknowledgeAssistance?: (id: string) => void
  density?: 'standard' | 'compact' | 'projector'
  terminalScale?: number
  isStandby?: boolean
  onClick?: () => void
  onDragStart?: (e: React.PointerEvent, ws: any) => void
  onDragOver?: (e: React.DragEvent) => void
  onDragLeave?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent, ws: any) => void
}

export function WorkstationNode({
  workstation,
  isLayoutMode = false,
  isSeatPlanMode = false,
  isSelected = false,
  isDropTarget = false,
  isFocused = false,
  isAssistanceRequested = false,
  assistanceRequest = null,
  onAcknowledgeAssistance,
  density = 'standard',
  terminalScale = 1,
  isStandby = false,
  onClick,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: WorkstationNodeProps) {
  const isFlagged = workstation.status === 'flagged'
  const isUnderRepair = workstation.status === 'under_repair'
  const isTeacher =
    workstation.row_label?.toLowerCase().includes('teacher') ||
    workstation.label.toLowerCase().includes('teacher')

  const assignment = workstation.assignment
  const sessionOverride = workstation.session_override

  const hasUnresolvedIssues =
    Boolean(isAssistanceRequested) ||
    isFlagged ||
    (workstation.open_issues_count ?? 0) > 0 ||
    Boolean(workstation.active_issues && workstation.active_issues.some((i) => i.status !== 'resolved'))

  const unresolvedCount = Math.max(
    (workstation.open_issues_count || 0) + (isAssistanceRequested && (!workstation.open_issues_count || workstation.open_issues_count === 0) ? 1 : 0),
    workstation.active_issues?.filter((i) => i.status !== 'resolved').length || 0,
    isAssistanceRequested ? 1 : 0
  )

  // Status border, led, screen background, and persistent glowing aura
  let statusBorder = 'border-zinc-300 dark:border-white/15 group-hover:border-zinc-400 dark:group-hover:border-slate-400'
  let ledColor = 'bg-emerald-500 dark:bg-emerald-400 shadow-[0_0_8px_#10b981] dark:shadow-[0_0_8px_#34d399]'
  let screenBg = 'bg-white dark:bg-[#0A101D]'
  let haloGlow = ''
  const isTemporary = Boolean((assignment as any)?.is_override || sessionOverride)

  if (hasUnresolvedIssues && !isUnderRepair) {
    // UNRESOLVED ISSUE INVARIANT: Persistent alert glow remains until issue is resolved or marked under servicing
    const isCritical =
      workstation.highest_severity === 'critical' ||
      assistanceRequest?.severity === 'critical' ||
      Boolean(workstation.active_issues?.some((i) => i.severity === 'critical' && i.status !== 'resolved'))
    statusBorder = isCritical
      ? 'border-rose-500/90 shadow-[0_0_20px_rgba(244,63,94,0.55)]'
      : 'border-amber-400/80 shadow-[0_0_20px_rgba(245,158,11,0.5)]'
    ledColor = isCritical
      ? 'bg-rose-500 animate-pulse shadow-[0_0_12px_#f43f5e]'
      : 'bg-amber-400 animate-pulse shadow-[0_0_12px_#fbbf24]'
    screenBg = isCritical
      ? 'bg-rose-50 dark:bg-[#1a080d]'
      : 'bg-amber-50 dark:bg-[#1c1206]'
    haloGlow = isCritical
      ? 'ring-2 ring-rose-500/70 shadow-[0_0_24px_rgba(244,63,94,0.45)] animate-pulse'
      : 'ring-2 ring-amber-400/60 shadow-[0_0_20px_rgba(245,158,11,0.4)] animate-pulse'
  } else if (isUnderRepair) {
    statusBorder = 'border-cyan-500/80 shadow-[0_0_16px_rgba(6,182,212,0.4)]'
    ledColor = 'bg-cyan-400 animate-pulse shadow-[0_0_10px_#22d3ee]'
    screenBg = 'bg-cyan-50 dark:bg-[#071822]'
    haloGlow = 'ring-2 ring-cyan-500/50 shadow-[0_0_16px_rgba(6,182,212,0.3)] animate-pulse'
  }

  // Attendance & relocation invariant: Soft greyish in light theme, sleek dark in dark theme
  if (!hasUnresolvedIssues && !isUnderRepair) {
    statusBorder = 'border-zinc-300 dark:border-white/15'
    haloGlow = ''
  }

  // Standby / Upcoming Inactive Mode styling
  if (isStandby && !hasUnresolvedIssues && !isUnderRepair) {
    statusBorder = 'border-zinc-300/80 dark:border-white/10 group-hover:border-zinc-400 dark:group-hover:border-slate-400'
    ledColor = 'bg-amber-400/50 shadow-[0_0_4px_#fbbf24]'
    screenBg = 'bg-slate-50 dark:bg-[#0c121e]'
    haloGlow = ''
  }

  // Selected state
  if (isSelected) {
    statusBorder = 'border-indigo-400 ring-2 ring-indigo-400/80 shadow-[0_0_20px_rgba(99,102,241,0.6)]'
  }

  // Drop target state
  if (isDropTarget) {
    statusBorder = 'border-emerald-400 ring-2 ring-emerald-400/80 shadow-[0_0_20px_rgba(52,211,153,0.6)]'
  }

  // Quick-search focus beacon halo
  if (isFocused) {
    haloGlow = 'ring-4 ring-indigo-500/90 shadow-[0_0_28px_rgba(99,102,241,0.9)] animate-pulse'
    statusBorder = 'border-indigo-400'
  }

  // Flat monitor sizing based on density (compact with built-in breathing room to prevent overlap)
  const monitorClasses = isTeacher
    ? 'w-42 sm:w-48 h-17 sm:h-19'
    : density === 'projector'
    ? 'w-[144px] sm:w-[152px] xl:w-[160px] h-[78px] sm:h-[84px] xl:h-[88px]'
    : density === 'compact'
    ? 'w-[104px] sm:w-[112px] xl:w-[120px] h-[56px] sm:h-[60px] xl:h-[64px]'
    : 'w-[114px] sm:w-[122px] xl:w-[130px] h-[62px] sm:h-[66px] xl:h-[70px]'

  const student = sessionOverride || assignment
  const hasStudent = isSeatPlanMode && !isLayoutMode && !isTeacher && !!student
  const isAbsent = !isStandby && isSeatPlanMode && workstation.isPresent === false
  const isPresent = !isStandby && isSeatPlanMode && workstation.isPresent === true

  // Smart Chin Pill Status Logic (dynamically encodes Student Attendance & Temporary Relocation)
  let chinPillStyle: React.CSSProperties = {}
  let chinPillClass = 'bg-zinc-300 dark:bg-white/20'
  let chinPillTitle = 'Vacant Station'

  if (isTeacher) {
    chinPillClass = 'bg-indigo-500 shadow-[0_0_4px_rgba(99,102,241,0.6)]'
    chinPillTitle = 'Teacher Console'
  } else if (hasStudent) {
    if (isTemporary) {
      if (isAbsent) {
        // Temp + Absent: Dual-color split (Rose-Red \ Brownish-Amber)
        chinPillStyle = {
          background: 'linear-gradient(115deg, #ef4444 0%, #ef4444 46%, #71717a 46%, #71717a 54%, #d97706 54%, #f59e0b 100%)',
        }
        chinPillClass = 'border border-rose-500/80'
        chinPillTitle = 'Temporary Relocation — Absent'
      } else {
        // Temp + Present: Dual-color split (Neon Emerald Green \ Brownish-Amber)
        chinPillStyle = {
          background: 'linear-gradient(115deg, #10b981 0%, #10b981 46%, #71717a 46%, #71717a 54%, #d97706 54%, #f59e0b 100%)',
        }
        chinPillClass = 'shadow-[0_0_4px_rgba(52,211,153,0.7)]'
        chinPillTitle = 'Temporary Relocation — Present'
      }
    } else if (isAbsent) {
      // Standard Absent: Unlit/dim bar with subtle 1px rose-red border
      chinPillClass = 'border border-rose-500/90 bg-rose-500/20'
      chinPillTitle = 'Assigned Student — Absent'
    } else if (isPresent || (!isStandby && isSeatPlanMode)) {
      // Standard Present: Solid glowing Neon Emerald Green
      chinPillClass = 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.8)]'
      chinPillTitle = 'Assigned Student — Present'
    }
  }

  // Hardware Health Status LED (🟢 Operational, 🟡 Flagged Issue, 🔴 Under Repair)
  let hardwareLedColor = 'bg-emerald-500 dark:bg-emerald-400 shadow-[0_0_4px_#10b981]'
  let hardwareLedTitle = 'Hardware Status: Operational'

  if (isUnderRepair) {
    hardwareLedColor = 'bg-rose-500 animate-pulse shadow-[0_0_6px_#f43f5e]'
    hardwareLedTitle = 'Hardware Status: Under Repair'
  } else if (hasUnresolvedIssues || isFlagged) {
    hardwareLedColor = 'bg-amber-400 animate-pulse shadow-[0_0_6px_#fbbf24]'
    hardwareLedTitle = 'Hardware Status: Issue Flagged'
  }

  return (
    <div
      data-testid="workstation-node"
      data-station-code={workstation.label}
      style={{
        left: `${workstation.pos_x}%`,
        top: `${workstation.pos_y}%`,
        transform: `translate(-50%, -50%)${terminalScale && terminalScale !== 1 ? ` scale(${terminalScale})` : ''}`,
        transformOrigin: 'center center',
      }}
      onPointerDown={isLayoutMode ? (e) => onDragStart?.(e, workstation) : undefined}
      onClick={onClick}
      onDragOver={isSeatPlanMode ? onDragOver : undefined}
      onDragLeave={isSeatPlanMode ? onDragLeave : undefined}
      onDrop={isSeatPlanMode ? (e) => onDrop?.(e, workstation) : undefined}
      className={`group absolute select-none transition-all duration-150 ${
        isStandby ? 'opacity-70 hover:opacity-95' : ''
      } ${
        isLayoutMode
          ? 'cursor-grab active:cursor-grabbing hover:scale-105 active:scale-95 z-25'
          : 'cursor-pointer hover:scale-[1.04] active:scale-[0.98] z-10'
      } ${hasUnresolvedIssues ? 'z-40' : ''}`}
    >
      {/* ============================================================== */}
      {/* PERSISTENT AMBIENT RADAR BEACON & COMPACT NUMERIC BUBBLE       */}
      {/* ============================================================== */}
      {hasUnresolvedIssues && !isUnderRepair && (
        <>
          {/* Subtle Radar Pulse Wave */}
          <span className="pointer-events-none absolute -inset-2.5 rounded-xl border border-amber-400/40 animate-ping opacity-35 duration-1000 z-0" />
          {/* Soft Luminous Backlight Aura */}
          <span className="pointer-events-none absolute -inset-1.5 rounded-lg bg-amber-500/15 blur-xs animate-pulse z-0" />

          {/* Compact Radiant Numeric Bubble Pill (e.g. "1", "4") */}
          {unresolvedCount > 0 && (
            <div className="absolute -top-3.5 -right-2 z-30 pointer-events-none flex items-center justify-center animate-in zoom-in-75 duration-200">
              <span
                className={`relative flex items-center gap-1 px-1.5 py-0.5 rounded-full font-mono font-black text-[10.5px] leading-none shadow-[0_0_14px_rgba(245,158,11,0.9)] border-2 border-slate-950 select-none ${
                  workstation.highest_severity === 'critical' || assistanceRequest?.severity === 'critical'
                    ? 'bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-[0_0_14px_rgba(244,63,94,0.9)]'
                    : 'bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950'
                }`}
                title={`${unresolvedCount} active ${unresolvedCount === 1 ? 'issue / help request' : 'issues'} on ${workstation.label}. Click node to view details.`}
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-950 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-slate-950" />
                </span>
                <span className="tabular-nums font-black">{unresolvedCount}</span>
              </span>
            </div>
          )}
        </>
      )}

      <div className="flex flex-col items-center">
        {/* ============================================================== */}
        {/* 1. FLAT MONITOR DISPLAY PANEL (Soft Greyish Light / Dark Bezel)*/}
        {/* ============================================================== */}
        <div
          className={`relative flex flex-col justify-between rounded-md p-0.5 border transition-all duration-150 ${monitorClasses} ${statusBorder} ${haloGlow} bg-white dark:bg-[#111827] shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.5)]`}
        >
          {/* Inner Recessed LCD Screen Glass */}
          <div
            className={`relative flex flex-col justify-between flex-1 w-full rounded-xs p-1 sm:p-1.5 overflow-hidden ${screenBg}`}
          >
            {/* Subtle top glare sheen */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />

            {/* Standby Micro Badge */}
            {isStandby && !isTeacher && (
              <span
                className="absolute top-0.5 right-0.5 z-20 px-1 py-0.2 rounded-2xs bg-amber-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-mono text-[6px] font-bold uppercase tracking-wider shadow-xs"
                title="Workstation on Standby / Upcoming Session Preview"
              >
                STANDBY
              </span>
            )}

            {/* Temporary Relocation Badge in Top Right Corner Only */}
            {isTemporary && !isTeacher && !isStandby && (
              <span
                className="absolute top-0.5 right-0.5 z-20 px-1 py-0.2 rounded-2xs bg-amber-500/25 border border-amber-500/40 text-amber-700 dark:text-amber-300 font-mono text-[6.5px] font-black uppercase tracking-wider shadow-xs"
                title="Temporarily Relocated Student for Today's Session"
              >
                TEMP
              </span>
            )}

            {/* ============================================================ */}
            {/* CASE 1: TEACHER PODIUM CONSOLE                               */}
            {/* ============================================================ */}
            {isTeacher ? (
              <div className="flex flex-col justify-between h-full w-full">
                <div className="flex items-center justify-between border-b border-indigo-500/20 pb-0.5">
                  <span className="font-mono text-[7.5px] font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shadow-[0_0_6px_#818cf8]" />
                    TEACHER CONSOLE
                  </span>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#34d399]" />
                </div>

                <div className="flex items-center justify-center gap-2 flex-1">
                  <Monitor className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="font-mono text-[13px] font-black text-zinc-900 dark:text-white tracking-wide truncate">
                    {workstation.label}
                  </span>
                </div>
              </div>
            ) : hasStudent ? (
              /* ============================================================ */
              /* CASE 2: STUDENT ASSIGNED (DURING PRACTICAL SESSION / SEAT)   */
              /* ============================================================ */
              <div className="relative flex items-center gap-1.5 h-full w-full px-0.5 py-0.5">
                {/* Clear Portrait Avatar via Progressive Deferred Loader */}
                <ProgressiveAvatar
                  studentId={(student as any)?.student_id || (student as any)?.studentId}
                  name={student?.student_name}
                  hasPhoto={(student as any)?.has_photo ?? (student as any)?.hasPhoto ?? Boolean(student?.photo_url)}
                  photoUrl={student?.photo_url}
                  isAbsent={isAbsent}
                  isUnderRepair={isUnderRepair}
                  className={`w-9 sm:w-10 h-10 sm:h-11 rounded-md ${
                    isUnderRepair
                      ? 'border-rose-400 dark:border-rose-500/70 ring-1 ring-rose-400/40 bg-rose-50 dark:bg-rose-950/40'
                      : isFlagged
                      ? 'border-amber-400 dark:border-amber-500/70 ring-1 ring-amber-400/40 bg-amber-50 dark:bg-amber-950/40'
                      : ''
                  }`}
                >
                  {/* Node-Centric Warning Indicator on Avatar for Unavailable Stations */}
                  {isUnderRepair && (
                    <span
                      className="absolute top-0.5 left-0.5 z-10 flex h-3 w-3 items-center justify-center rounded bg-rose-600 text-white shadow-xs"
                      title="Workstation Under Repair"
                    >
                      <Wrench className="h-1.5 w-1.5" />
                    </span>
                  )}
                  {isFlagged && !isUnderRepair && (
                    <span
                      className="absolute top-0.5 left-0.5 z-10 flex h-3 w-3 items-center justify-center rounded bg-amber-500 text-zinc-950 shadow-xs"
                      title="Hardware Fault Reported"
                    >
                      <AlertCircle className="h-1.5 w-1.5" />
                    </span>
                  )}
                </ProgressiveAvatar>

                {/* Beside Avatar: Student Full Name & Roll No | PC Label Row */}
                <div className="flex flex-col text-left min-w-0 flex-1 justify-center leading-tight">
                  {/* Full Student Name */}
                  <span
                    className={`font-bold text-[10px] sm:text-[10.5px] leading-[1.15] line-clamp-2 break-words ${
                      isAbsent ? 'text-slate-400 dark:text-slate-500' : 'text-zinc-900 dark:text-white'
                    }`}
                    title={student?.student_name}
                  >
                    {student?.student_name}
                  </span>

                  {/* Metadata Row: Roll No | PC Name (STRICTLY NO WRAP, FULL VISIBILITY OF PC-XX) */}
                  <div className="flex items-center gap-1 font-mono text-[8px] sm:text-[8.5px] font-bold mt-0.5 tabular-nums whitespace-nowrap shrink-0">
                    <span className={`${isAbsent ? 'text-slate-400 dark:text-slate-500' : 'text-indigo-600 dark:text-indigo-400'} whitespace-nowrap`}>
                      R-{student?.roll_number}
                    </span>
                    <span className="text-zinc-300 dark:text-slate-600 font-normal">|</span>
                    <span className={`${
                      isUnderRepair
                        ? 'text-rose-600 dark:text-rose-400 font-bold'
                        : isFlagged
                        ? 'text-amber-600 dark:text-amber-400 font-bold'
                        : isAbsent
                        ? 'text-slate-400 dark:text-slate-500 font-normal'
                        : 'text-zinc-600 dark:text-slate-300 font-medium'
                    } whitespace-nowrap`}>
                      {workstation.label}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* ============================================================ */
              /* CASE 3: NO STUDENT ASSIGNED (SHOW PC NAME IN MIDDLE)          */
              /* ============================================================ */
              <div className="relative flex flex-col items-center justify-center flex-1 h-full w-full py-0.5">
                {/* Top corner: Subtle fault indicator if any */}
                {(workstation.open_issues_count > 0 || isUnderRepair) && (
                  <div className="absolute top-0 right-0 flex items-center gap-0.5">
                    {workstation.open_issues_count > 0 && (
                      <AlertCircle className="h-2.5 w-2.5 text-amber-500" />
                    )}
                    {isUnderRepair && (
                      <Wrench className="h-2.5 w-2.5 text-cyan-500" />
                    )}
                  </div>
                )}

                {/* Middle: PC Name like PC-01 */}
                <span className="font-mono text-sm sm:text-base font-black tracking-wider text-zinc-800 dark:text-white drop-shadow-xs truncate max-w-[95%]">
                  {workstation.label}
                </span>
              </div>
            )}
          </div>

          {/* Bottom Monitor Chin Bar (Ultra-thin h-[6px] soft greyish chin with micro indicator and micro health LED) */}
          <div className="h-[6px] py-0 px-1.5 flex items-center justify-between w-full bg-zinc-100 dark:bg-[#151D2C] border-t border-zinc-200/80 dark:border-white/[0.08] rounded-b-xs shrink-0">
            {/* Smart Attendance & Temp Status Chin Pill (Micro sleek bar) */}
            <div
              style={chinPillStyle}
              className={`w-4 sm:w-5 h-[2px] rounded-full overflow-hidden flex items-center shrink-0 ${chinPillClass}`}
              title={chinPillTitle}
            />

            {/* Hardware Health Status Micro LED */}
            <span
              className={`h-1 w-1 rounded-full ${hardwareLedColor} ring-1 ring-black/10 dark:ring-transparent shrink-0`}
              title={hardwareLedTitle}
            />
          </div>
        </div>

        {/* ============================================================== */}
        {/* 2. MONITOR STAND NECK (Properly proportioned connector)        */}
        {/* ============================================================== */}
        <div className="w-3.5 sm:w-4 h-1 sm:h-1.5 bg-zinc-300 dark:bg-slate-600 border-x border-zinc-400/60 dark:border-slate-500 shadow-2xs shrink-0" />

        {/* ============================================================== */}
        {/* 3. MONITOR STAND BASE (Substantial desk pedestal foot)         */}
        {/* ============================================================== */}
        <div
          style={{
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
          }}
          className="w-12 sm:w-14 xl:w-16 h-1 sm:h-1.5 rounded-xs bg-zinc-300 dark:bg-slate-600 border border-zinc-400/70 dark:border-slate-500 shrink-0"
        />

        {/* 4. GROUNDING DESK CONTACT SHADOW */}
        <div className="w-14 sm:w-16 xl:w-18 h-0.5 rounded-full bg-zinc-400/30 dark:bg-black/50 blur-[1px] pointer-events-none shrink-0" />
      </div>
    </div>
  )
}

