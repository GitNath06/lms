'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  X,
  CheckCircle2,
  XCircle,
  ArrowRightLeft,
  AlertTriangle,
  Wrench,
  Monitor,
  User,
  ShieldAlert,
  Loader2,
  ChevronDown,
  ExternalLink,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { reportWorkstationIssue } from '@/app/actions/workstations'
import { broadcastSync } from '@/lib/sync-bus'
import type { WorkstationWithIssues } from '@/types/workstations'
import type { WorkstationSeatAssignment } from '@/lib/types/seat-plans'
import type { IssueCategoryRow } from '@/types/database'

interface StationQuickPopoverProps {
  workstation: WorkstationWithIssues & {
    assignment?: WorkstationSeatAssignment | null
    session_override?: {
      override_id: string
      student_name: string
      roll_number: number
      enrollment_id?: string | null
      reason?: string | null
    } | null
    isPresent?: boolean | null
  }
  categories?: IssueCategoryRow[]
  availableWorkstations?: Array<{ id: string; label: string; description?: string }>
  isLocked?: boolean
  assistanceRequest?: {
    id: string
    title: string
    description?: string | null
    severity?: string
    studentName?: string | null
    studentRoll?: string | null
  } | null
  onAcknowledgeAssistance?: (reqId: string) => Promise<void> | void
  onTogglePresence?: (identifier: string | number) => void
  onAssignOverride?: (targetWsId: string, enrollmentId: string) => Promise<void>
  onIssueReported?: () => void
  onOpenIssueDrawer?: (ws: any) => void
  onClose: () => void
}

interface FaultOption {
  id?: string
  title: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  color?: string | null
}

const DEFAULT_FAULT_PRESETS: FaultOption[] = [
  { title: 'Mouse / Keyboard unresponsive', severity: 'medium', color: '#f59e0b' },
  { title: "No display / Monitor won't turn on", severity: 'high', color: '#ef4444' },
  { title: 'OS Crash / Blue Screen', severity: 'high', color: '#ef4444' },
  { title: 'Loose Network Cable / No Internet', severity: 'medium', color: '#3b82f6' },
  { title: "Power supply failure / Won't boot", severity: 'critical', color: '#dc2626' },
  { title: 'Hardware peripheral damaged', severity: 'medium', color: '#f97316' },
]

export function StationQuickPopover({
  workstation,
  categories = [],
  availableWorkstations = [],
  isLocked = false,
  assistanceRequest = null,
  onAcknowledgeAssistance,
  onTogglePresence,
  onAssignOverride,
  onIssueReported,
  onOpenIssueDrawer,
  onClose,
}: StationQuickPopoverProps) {
  const [activeTab, setActiveTab] = useState<'attendance' | 'reassign' | 'fault'>('attendance')
  const destinationStations = availableWorkstations.filter((w) => w.id !== workstation.id)
  const [selectedTargetWsId, setSelectedTargetWsId] = useState<string>(destinationStations[0]?.id || '')

  const faultOptions = React.useMemo<FaultOption[]>(() => {
    if (categories && categories.length > 0) {
      const active = categories.filter(
        (c) => c.is_active && !/chemical|acid|glassware|specimen|reagent/i.test(c.name)
      )
      if (active.length > 0) {
        return active.map((c) => ({
          id: c.id,
          title: c.name,
          severity: (c.default_severity as 'low' | 'medium' | 'high' | 'critical') || 'medium',
          color: c.color,
        }))
      }
    }
    return DEFAULT_FAULT_PRESETS
  }, [categories])

  const [selectedFaultOption, setSelectedFaultOption] = useState<FaultOption>(() => faultOptions[0] || DEFAULT_FAULT_PRESETS[0])
  const [customFaultTitle, setCustomFaultTitle] = useState('')
  const [faultSeverity, setFaultSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>(
    faultOptions[0]?.severity || 'medium'
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [localPresence, setLocalPresence] = useState<boolean>(workstation.isPresent !== false)

  React.useEffect(() => {
    if (faultOptions.length > 0) {
      if (!selectedFaultOption || !faultOptions.some((f) => f.title === selectedFaultOption.title)) {
        setSelectedFaultOption(faultOptions[0])
        setFaultSeverity(faultOptions[0].severity)
      }
    }
  }, [faultOptions, selectedFaultOption])

  React.useEffect(() => {
    const validStations = availableWorkstations.filter((w) => w.id !== workstation.id)
    if (!selectedTargetWsId || !validStations.some((w) => w.id === selectedTargetWsId)) {
      setSelectedTargetWsId(validStations[0]?.id || '')
    }
  }, [availableWorkstations, workstation.id, selectedTargetWsId])

  React.useEffect(() => {
    setLocalPresence(workstation.isPresent !== false)
  }, [workstation.isPresent])

  const student = workstation.session_override || workstation.assignment
  const hasStudent = !!student
  const rollNumber = student?.roll_number
  const enrollmentId = student?.enrollment_id || workstation.assignment?.enrollment_id
  const studentIdentifier = enrollmentId || rollNumber

  // 1. Toggle attendance
  const handleToggle = (setPresent: boolean) => {
    if (isLocked || !studentIdentifier || !onTogglePresence) return
    setLocalPresence(setPresent)
    onTogglePresence(studentIdentifier)
    setFeedback({
      text: setPresent ? 'Marked Present' : 'Marked Absent',
      type: 'success',
    })
    // Auto-close dialog after 260ms so teachers don't have to unnecessarily click the 'X' button
    setTimeout(() => {
      onClose()
    }, 260)
  }

  // 2. Quick Reassign
  const handleReassign = async () => {
    if (!selectedTargetWsId || !enrollmentId || !onAssignOverride) return
    setIsSubmitting(true)
    setFeedback(null)
    try {
      await onAssignOverride(selectedTargetWsId, enrollmentId)
      setFeedback({ text: 'Student reassigned for this session!', type: 'success' })
      setTimeout(() => {
        onClose()
      }, 350)
    } catch (err: any) {
      setFeedback({ text: err.message || 'Failed to reassign seat.', type: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // 3. Fast 1-Tap Fault Report
  const handleReportFault = async () => {
    const title = customFaultTitle.trim() || selectedFaultOption?.title || 'Fault Report'
    if (!title) return
    setIsSubmitting(true)
    setFeedback(null)
    try {
      const res = await reportWorkstationIssue({
        workstation_id: workstation.id,
        category_id: selectedFaultOption?.id || null,
        title,
        severity: faultSeverity,
      })
      if (res.success) {
        setFeedback({ text: `Fault logged on ${workstation.label}. Sent to Maintenance!`, type: 'success' })
        broadcastSync('workstations', { stationCode: workstation.label })
        onIssueReported?.()
        setTimeout(() => {
          onClose()
        }, 1200)
      } else {
        setFeedback({ text: res.error || 'Failed to report fault.', type: 'error' })
      }
    } catch (err: any) {
      setFeedback({ text: err.message || 'Error submitting fault.', type: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs select-none">
      <div className="relative w-full max-w-sm sm:max-w-md rounded-2xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#101726] shadow-2xl p-4 font-sans text-zinc-900 dark:text-white animate-in zoom-in-95 duration-150 max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden my-auto space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/[0.08] pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            {hasStudent ? (
              <div className="h-9 w-9 rounded-full overflow-hidden border border-zinc-200 dark:border-white/20 bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 shadow-sm">
                {(student as any).photo_url ? (
                  <img
                    src={(student as any).photo_url}
                    alt={student.student_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 font-heading">
                    {student.student_name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-600/30 border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400">
                <Monitor className="h-4 w-4" />
              </span>
            )}
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-heading font-extrabold text-sm text-zinc-900 dark:text-white">
                  {workstation.label}
                </h3>
                <Badge
                  className={`text-[9px] font-bold ${
                    workstation.status === 'operational'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/20'
                      : workstation.status === 'under_repair'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400 border-amber-300 dark:border-amber-500/20'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-500/10 dark:text-rose-400 border-rose-300 dark:border-rose-500/20'
                  }`}
                >
                  {workstation.status}
                </Badge>
              </div>
              <p className="text-[11px] text-zinc-600 dark:text-slate-400">
                {hasStudent ? (
                  <>
                    <strong className="text-zinc-900 dark:text-slate-200">{student.student_name}</strong> &bull; Roll {student.roll_number}
                  </>
                ) : (
                  'Station Available / Unassigned'
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Inner Body */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-3.5 pr-0.5">
          {/* ============================================================== */}
          {/* ACTIVE HELP REQUEST & FAULT DETAILS SECTION                     */}
          {/* ============================================================== */}
        {(assistanceRequest || (workstation.active_issues && workstation.active_issues.length > 0)) && (
          <div className="p-3 rounded-xl border border-amber-400 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
            {/* Assistance Request Banner (if any) */}
            {assistanceRequest && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 border-b border-amber-400/40 dark:border-amber-500/20 pb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                    </span>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 truncate">
                      Help Request &bull; {workstation.label}
                    </span>
                  </div>
                  {onAcknowledgeAssistance && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={async () => {
                        await onAcknowledgeAssistance(assistanceRequest.id)
                      }}
                      className="h-6.5 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] gap-1 shadow-sm transition-all cursor-pointer"
                      title="Acknowledge student help notification"
                    >
                      <Check className="h-3 w-3 text-slate-950" />
                      <span>Acknowledge</span>
                    </Button>
                  )}
                </div>

                <div className="space-y-0.5 text-left">
                  <div className="text-xs font-extrabold text-zinc-900 dark:text-white leading-snug">
                    {assistanceRequest.title}
                  </div>
                  {assistanceRequest.studentName && (
                    <div className="text-[11px] text-zinc-700 dark:text-zinc-300">
                      from <strong className="text-amber-800 dark:text-amber-200 font-semibold">{assistanceRequest.studentName}</strong>
                      {assistanceRequest.studentRoll && (
                        <span className="text-indigo-600 dark:text-indigo-300 font-mono ml-1 font-bold">
                          (Roll {assistanceRequest.studentRoll})
                        </span>
                      )}
                    </div>
                  )}
                  {assistanceRequest.description && (
                    <p className="text-[10.5px] text-zinc-800 dark:text-zinc-300/90 italic bg-white/70 dark:bg-black/40 p-2 rounded-lg border border-amber-300 dark:border-white/5 mt-1">
                      &ldquo;{assistanceRequest.description}&rdquo;
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Logged Terminal Faults (if any) */}
            {workstation.active_issues && workstation.active_issues.length > 0 && (
              <div className="space-y-1.5 text-left">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:text-slate-400 block">
                  Logged Fault Tickets ({workstation.active_issues.length}):
                </span>
                <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                  {workstation.active_issues.map((iss) => (
                    <div
                      key={iss.id}
                      className="p-1.5 rounded-lg bg-white/80 dark:bg-black/40 border border-zinc-200 dark:border-white/5 text-[11px] flex items-center justify-between gap-2"
                    >
                      <span className="truncate text-zinc-800 dark:text-slate-200 font-medium">{iss.title}</span>
                      <Badge className={
                        iss.severity === 'critical'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300 border-rose-300 dark:border-rose-500/30 text-[9px] shrink-0'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border-amber-300 dark:border-amber-500/30 text-[9px] shrink-0'
                      }>
                        {iss.severity}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Direct Link to Maintenance Workbench from Active Fault Card */}
            <Link
              href={`/maintenance?search=${encodeURIComponent(workstation.label)}`}
              className="block pt-1"
            >
              <Button
                type="button"
                className="w-full h-8.5 rounded-xl border border-amber-400 dark:border-amber-500/40 bg-amber-100 dark:bg-amber-500/20 hover:bg-amber-200 dark:hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 font-bold text-xs gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <Wrench className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300" />
                <span>Open Maintenance Workbench</span>
                <ExternalLink className="h-3 w-3 ml-auto text-amber-600 dark:text-amber-300/70" />
              </Button>
            </Link>
          </div>
        )}

        {/* Tab Navigator */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-[#151E32] border border-zinc-200 dark:border-white/5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('attendance')}
            className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
              activeTab === 'attendance'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-zinc-600 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-slate-200'
            }`}
          >
            Roll-Call
          </button>
          {hasStudent && (
            <button
              type="button"
              onClick={() => setActiveTab('reassign')}
              className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                activeTab === 'reassign'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-zinc-600 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-slate-200'
              }`}
            >
              Reassign (Tier 2)
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (onOpenIssueDrawer) {
                onOpenIssueDrawer(workstation)
                onClose()
              } else {
                setActiveTab('fault')
              }
            }}
            className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer flex items-center justify-center gap-1 ${
              activeTab === 'fault'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-rose-700 dark:text-rose-300 hover:text-rose-900 dark:hover:text-white hover:bg-rose-100 dark:hover:bg-rose-600/30'
            }`}
          >
            <AlertTriangle className="h-3 w-3" />
            <span>Report Fault</span>
          </button>
        </div>

        {/* Tab 1: Attendance */}
        {activeTab === 'attendance' && (
          <div className="space-y-3">
            {hasStudent ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 dark:bg-[#151E32] border border-zinc-200 dark:border-white/5 text-xs">
                  <span className="text-zinc-600 dark:text-slate-400">Current Status:</span>
                  <Badge
                    className={
                      !localPresence
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/10 dark:text-rose-300 border-rose-300 dark:border-rose-500/20'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/20'
                    }
                  >
                    {!localPresence ? 'Marked Absent' : 'Marked Present'}
                  </Badge>
                </div>

                <div>
                  {localPresence ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleToggle(false)}
                      disabled={isLocked}
                      className="w-full h-10 rounded-xl text-xs font-bold gap-2 border-rose-300 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all cursor-pointer"
                    >
                      <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                      <span>Mark Absent</span>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleToggle(true)}
                      disabled={isLocked}
                      className="w-full h-10 rounded-xl text-xs font-bold gap-2 border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all cursor-pointer"
                    >
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Restore to Present</span>
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-600 dark:text-slate-400 text-center py-4">
                No student is currently seated at this workstation.
              </p>
            )}
          </div>
        )}

        {/* Tab 2: Temporary Seat Reassign */}
        {activeTab === 'reassign' && hasStudent && (
          <div className="space-y-3 text-xs">
            <p className="text-zinc-600 dark:text-slate-400 text-[11px]">
              Temporarily reassign <strong className="text-zinc-900 dark:text-white">{student.student_name}</strong> to another operational PC for today&apos;s practical session only.
            </p>

            {destinationStations.length === 0 ? (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs">
                No operational vacant workstations available for temporary reassignment. All other PCs are occupied or currently undergoing servicing.
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-zinc-700 dark:text-slate-300 uppercase tracking-wider">
                  Select Destination Workstation:
                </label>
                <select
                  value={selectedTargetWsId}
                  onChange={(e) => setSelectedTargetWsId(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl bg-zinc-50 dark:bg-[#151E32] border border-zinc-300 dark:border-white/10 text-zinc-900 dark:text-white text-xs"
                >
                  {destinationStations.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Button
              type="button"
              onClick={handleReassign}
              disabled={isSubmitting || !selectedTargetWsId || destinationStations.length === 0}
              className="w-full h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5"
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowRightLeft className="h-3.5 w-3.5" />
              )}
              <span>Confirm Temporary Reassign</span>
            </Button>
          </div>
        )}

        {/* Tab 3: Fast 1-Tap Fault Reporting */}
        {activeTab === 'fault' && (
          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-zinc-700 dark:text-slate-300 uppercase tracking-wider">
                Select Fault Category:
              </label>
              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                {faultOptions.map((preset) => (
                  <button
                    key={preset.id || preset.title}
                    type="button"
                    onClick={() => {
                      setSelectedFaultOption(preset)
                      setFaultSeverity(preset.severity)
                    }}
                    className={`w-full text-left p-2 rounded-lg border transition-all text-xs flex items-center justify-between cursor-pointer ${
                      selectedFaultOption?.title === preset.title
                        ? 'border-rose-400 dark:border-rose-500/50 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200'
                        : 'border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-[#151E32] text-zinc-700 dark:text-slate-300 hover:bg-zinc-100 dark:hover:bg-white/5'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {preset.color && (
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: preset.color }}
                        />
                      )}
                      <span>{preset.title}</span>
                    </span>
                    <Badge
                      className={`text-[9px] ${
                        preset.severity === 'critical'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300'
                          : preset.severity === 'high'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300'
                      }`}
                    >
                      {preset.severity}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="button"
              onClick={handleReportFault}
              disabled={isSubmitting}
              className="w-full h-9 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs gap-1.5"
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" />
              )}
              <span>Submit Fault Ticket to Maintenance</span>
            </Button>
          </div>
        )}

        {/* Feedback Message */}
        {feedback && (
          <div
            className={`p-2 rounded-xl text-center text-xs font-semibold ${
              feedback.type === 'success'
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-300'
                : 'bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-300'
            }`}
          >
            {feedback.text}
          </div>
        )}
        </div>

        {/* Shortcut to Maintenance Workbench & Student Terminal View */}
        <div className="pt-2 flex flex-col items-center gap-1.5 border-t border-zinc-200 dark:border-white/5 text-center shrink-0">
          <Link
            href={`/maintenance?search=${encodeURIComponent(workstation.label)}`}
            className="inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200 font-semibold transition-colors"
          >
            <Wrench className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Open Maintenance Workbench</span>
            <ExternalLink className="w-3 h-3 text-amber-600 dark:text-amber-400/70" />
          </Link>
          <Link
            href={`/terminal/${encodeURIComponent(workstation.label)}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors"
          >
            <span>Open Student Terminal Gateway</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  )
}
