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

interface WorkstationNodeProps {
  workstation: WorkstationWithIssues & {
    assignment?: WorkstationSeatAssignment | null
    session_override?: {
      override_id: string
      student_name: string
      roll_number: number
      reason?: string | null
      photo_url?: string | null
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
  let statusBorder = 'border-white/[0.08] group-hover:border-slate-500'
  let ledColor = 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
  let screenBg = 'bg-gradient-to-b from-[#151E32] to-[#0B0F19]'
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
      ? 'bg-gradient-to-b from-rose-950/50 via-[#151E32] to-[#0B0F19]'
      : 'bg-gradient-to-b from-amber-950/40 via-[#151E32] to-[#0B0F19]'
    haloGlow = isCritical
      ? 'ring-2 ring-rose-500/70 shadow-[0_0_24px_rgba(244,63,94,0.45)] animate-pulse'
      : 'ring-2 ring-amber-400/60 shadow-[0_0_20px_rgba(245,158,11,0.4)] animate-pulse'
  } else if (isUnderRepair) {
    statusBorder = 'border-cyan-500/80 shadow-[0_0_16px_rgba(6,182,212,0.4)]'
    ledColor = 'bg-cyan-400 animate-pulse shadow-[0_0_10px_#22d3ee]'
    screenBg = 'bg-gradient-to-b from-cyan-950/40 to-[#0B0F19]'
    haloGlow = 'ring-2 ring-cyan-500/50 shadow-[0_0_16px_rgba(6,182,212,0.3)] animate-pulse'
  }

  // Attendance-specific halo ring in Live Mode (only applied when nominal and no unresolved issues)
  if (!hasUnresolvedIssues && !isUnderRepair) {
    if (!isStandby && isSeatPlanMode && workstation.isPresent === true) {
      haloGlow = 'ring-2 ring-emerald-500/80 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
    } else if (!isStandby && isSeatPlanMode && workstation.isPresent === false) {
      haloGlow = ''
      statusBorder = 'border-slate-700/60'
    }
  }

  // Standby / Upcoming Inactive Mode styling
  if (isStandby && !hasUnresolvedIssues && !isUnderRepair) {
    statusBorder = 'border-white/[0.04] group-hover:border-slate-600'
    ledColor = 'bg-amber-400/50 shadow-[0_0_4px_#fbbf24]'
    screenBg = 'bg-gradient-to-b from-[#0c121e] via-[#080d16] to-[#05080f]'
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

  // Flat monitor sizing based on density (expanded width and height for clean un-wrapped text)
  const monitorClasses = isTeacher
    ? 'w-42 sm:w-48 h-17 sm:h-19'
    : density === 'projector'
    ? 'w-[152px] sm:w-[164px] md:w-[172px] h-[86px] sm:h-[94px]'
    : density === 'compact'
    ? 'w-[114px] sm:w-[122px] md:w-[128px] h-[64px] sm:h-[70px]'
    : 'w-[136px] sm:w-[144px] md:w-[150px] h-[74px] sm:h-[80px] md:h-[84px]'

  const student = sessionOverride || assignment
  const hasStudent = isSeatPlanMode && !isLayoutMode && !isTeacher && !!student

  return (
    <div
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
        {/* 1. FLAT MONITOR DISPLAY PANEL (Bezel + Recessed LCD Screen)    */}
        {/* ============================================================== */}
        <div
          style={{
            boxShadow:
              '0 6px 18px -2px rgba(0, 0, 0, 0.65), 0 2px 6px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
          }}
          className={`relative flex flex-col justify-between rounded-md border-2 p-0.5 transition-all duration-150 ${monitorClasses} ${statusBorder} ${haloGlow} bg-[#111827]`}
        >
          {/* Inner Recessed LCD Screen Glass */}
          <div
            className={`relative flex flex-col justify-between h-full w-full rounded-xs p-0.5 border border-black/70 overflow-hidden shadow-inner ${screenBg} bg-[#0A101D]`}
          >
            {/* Subtle top glare sheen */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent" />

            {/* Standby Micro Badge */}
            {isStandby && !isTeacher && (
              <span
                className="absolute top-0.5 right-0.5 z-20 px-1 py-0.2 rounded-2xs bg-amber-500/20 border border-amber-500/30 text-amber-300 font-mono text-[6px] font-bold uppercase tracking-wider shadow-xs"
                title="Workstation on Standby / Upcoming Session Preview"
              >
                STANDBY
              </span>
            )}

            {/* Temporary Relocation Badge in Top Right Corner Only */}
            {isTemporary && !isTeacher && !isStandby && (
              <span
                className="absolute top-0.5 right-0.5 z-20 px-1 py-0.2 rounded-2xs bg-amber-500/25 border border-amber-500/40 text-amber-300 font-mono text-[6.5px] font-black uppercase tracking-wider shadow-xs"
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
                  <span className="font-mono text-[7.5px] font-black text-indigo-300 uppercase tracking-wider flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shadow-[0_0_6px_#818cf8]" />
                    TEACHER CONSOLE
                  </span>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                </div>

                <div className="flex items-center justify-center gap-2 flex-1">
                  <Monitor className="h-4 w-4 text-indigo-400" />
                  <span className="font-mono text-[13px] font-black text-white tracking-wide">
                    {workstation.label}
                  </span>
                </div>
              </div>
            ) : hasStudent ? (
              /* ============================================================ */
              /* CASE 2: STUDENT ASSIGNED (DURING PRACTICAL SESSION / SEAT)   */
              /* ============================================================ */
              <div className="relative flex items-center gap-1.5 h-full w-full px-0.5 py-0.5">
                {/* Large Clear Portrait Avatar (Black & White greyscale inactive styling when absent) */}
                {(() => {
                  const isAbsent = !isStandby && isSeatPlanMode && workstation.isPresent === false
                  return (
                    <>
                      <div className={`relative w-11 sm:w-12 h-13 sm:h-14 rounded-md overflow-hidden border ${
                        isAbsent
                          ? 'border-slate-700/60 bg-slate-900 filter grayscale contrast-75 brightness-75 opacity-55'
                          : isUnderRepair
                          ? 'border-rose-500/70 ring-1 ring-rose-500/40 bg-rose-950/40'
                          : isFlagged
                          ? 'border-amber-500/70 ring-1 ring-amber-500/40 bg-amber-950/40'
                          : 'border-white/20 bg-slate-800'
                      } flex items-center justify-center shrink-0 shadow-xs transition-all duration-150`}>
                        {student?.photo_url ? (
                          <img
                            src={student.photo_url}
                            alt={student.student_name}
                            className={`h-full w-full object-cover object-top ${isAbsent ? 'grayscale contrast-75 brightness-75' : ''}`}
                          />
                        ) : (
                          <div className={`h-full w-full ${isAbsent ? 'bg-slate-700' : 'bg-gradient-to-br from-indigo-500 to-indigo-800'} flex items-center justify-center`}>
                            <span className={`text-sm font-extrabold font-heading ${isAbsent ? 'text-slate-400' : 'text-white'}`}>
                              {student?.student_name?.slice(0, 1).toUpperCase()}
                            </span>
                          </div>
                        )}

                        {/* Node-Centric Warning Indicator on Avatar for Unavailable Stations */}
                        {isUnderRepair && (
                          <span
                            className="absolute top-0.5 left-0.5 z-10 flex h-3.5 w-3.5 items-center justify-center rounded bg-rose-600 text-white shadow-xs"
                            title="Workstation Under Repair - Student Needs Temporary Relocation"
                          >
                            <Wrench className="h-2 w-2" />
                          </span>
                        )}
                        {isFlagged && !isUnderRepair && (
                          <span
                            className="absolute top-0.5 left-0.5 z-10 flex h-3.5 w-3.5 items-center justify-center rounded bg-amber-500 text-zinc-950 shadow-xs"
                            title="Hardware Fault Reported - Student May Need Temporary Relocation"
                          >
                            <AlertCircle className="h-2 w-2" />
                          </span>
                        )}
                      </div>

                      {/* Beside Avatar: Student Full Name & Roll No | PC Label Row */}
                      <div className="flex flex-col text-left min-w-0 flex-1 justify-center leading-tight">
                        {/* Full Student Name: Uses full width, no accidental wrapping */}
                        <span
                          className={`font-bold text-[11px] sm:text-[11.5px] leading-[1.2] line-clamp-2 break-words ${
                            isAbsent ? 'text-slate-400' : 'text-white'
                          }`}
                          title={student?.student_name}
                        >
                          {student?.student_name}
                        </span>

                        {/* Metadata Row: Roll No | PC Name (STRICTLY NO WRAP) */}
                        <div className="flex items-center gap-1 font-mono text-[8.5px] sm:text-[9px] font-bold mt-1 tabular-nums whitespace-nowrap shrink-0">
                          <span className={`${isAbsent ? 'text-slate-400' : 'text-indigo-300'} whitespace-nowrap`}>
                            R-{student?.roll_number}
                          </span>
                          <span className="text-slate-600 font-normal">|</span>
                          <span className={`${
                            isUnderRepair
                              ? 'text-rose-400 font-bold'
                              : isFlagged
                              ? 'text-amber-400 font-bold'
                              : isAbsent
                              ? 'text-slate-500 font-normal'
                              : 'text-slate-400 font-medium'
                          } whitespace-nowrap`}>
                            {workstation.label}
                          </span>

                          {/* Attendance Status: Emerald dot when Present, Neutral inactive badge when Absent (Zero red dot) */}
                          {workstation.isPresent === true && (
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_#34d399] ml-0.5 shrink-0" title="Present" />
                          )}
                          {isAbsent && (
                            <span className="px-1 py-0.2 rounded-xs bg-slate-800 border border-slate-700/80 text-slate-400 font-mono text-[6.5px] font-bold uppercase tracking-wider ml-0.5 shrink-0" title="Marked Absent">
                              Absent
                            </span>
                          )}
                          {isUnderRepair && !isTemporary && (
                            <span className="px-1 py-0 rounded bg-rose-500/30 text-rose-300 font-mono text-[6.5px] font-extrabold uppercase ml-0.5 shrink-0">
                              Broken
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  )
                })()}
              </div>
            ) : (
              /* ============================================================ */
              /* CASE 3: NO STUDENT ASSIGNED (SHOW PC NAME IN MIDDLE, BIG)     */
              /* ============================================================ */
              <div className="relative flex flex-col items-center justify-center h-full w-full">
                {/* Top corner: Subtle fault indicator if any */}
                {(workstation.open_issues_count > 0 || isUnderRepair) && (
                  <div className="absolute top-0 right-0 flex items-center gap-0.5">
                    {workstation.open_issues_count > 0 && (
                      <AlertCircle className="h-2.5 w-2.5 text-amber-400" />
                    )}
                    {isUnderRepair && (
                      <Wrench className="h-2.5 w-2.5 text-cyan-400" />
                    )}
                  </div>
                )}

                {/* Middle: PC Name like PC-01 in the middle in a little big font */}
                <span className="font-mono text-base sm:text-[17px] font-black tracking-wide text-white drop-shadow-xs">
                  {workstation.label}
                </span>
              </div>
            )}
          </div>

          {/* Bottom Monitor Chin Bar (with power status LED) */}
          <div className="mt-0.5 flex items-center justify-between px-1 h-1.5 w-full bg-[#182235] border-t border-white/[0.06] rounded-b-2xs">
            <div className="h-0.5 w-3 rounded-full bg-slate-600/50" />
            <span className={`h-1 w-1 rounded-full ${ledColor}`} />
          </div>
        </div>

        {/* ============================================================== */}
        {/* 2. MONITOR STAND NECK (Connects display to baseplate)          */}
        {/* ============================================================== */}
        <div className="w-3.5 sm:w-4 h-1.5 sm:h-2 bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 border-x border-slate-600/60 shadow-inner" />

        {/* ============================================================== */}
        {/* 3. MONITOR STAND BASE (Flat desktop pedestal foot)             */}
        {/* ============================================================== */}
        <div
          style={{
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
          }}
          className="w-14 sm:w-16 h-1 sm:h-1.5 rounded-xs bg-gradient-to-r from-slate-600 via-slate-500 to-slate-600 border border-slate-500/50"
        />
      </div>
    </div>
  )
}

