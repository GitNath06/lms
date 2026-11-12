'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  X,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  User,
  Users,
  Wrench,
  ShieldAlert,
  Loader2,
  FileCheck2,
  ChevronRight,
  Sparkles,
  UserCheck,
  XCircle,
  ArrowRightLeft,
  Check,
  ExternalLink,
  Monitor,
  Cpu,
  HardDrive,
  RotateCcw,
  ShieldCheck,
  Activity,
  Wifi,
  Server,
  Copy,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { WorkstationPhotoCapture } from './workstation-photo-capture'
import {
  reportWorkstationIssue,
  resolveWorkstationIssue,
  resetWorkstationHardwareLock,
} from '@/app/actions/workstations'
import { broadcastSync } from '@/lib/sync-bus'
import type {
  WorkstationWithIssues,
  WorkstationIssueRecord,
  WorkstationPhoto,
  WorkstationHardwareSpecs,
} from '@/types/workstations'
import type { IssueCategoryRow } from '@/types/database'
import type { WorkstationSeatAssignment } from '@/lib/types/seat-plans'

import type { DisplacedStudent } from '@/components/computer-lab/displaced-students-queue'

interface WorkstationIssueDrawerProps {
  workstation: (WorkstationWithIssues & {
    assignment?: WorkstationSeatAssignment | null
    session_override?: {
      override_id: string
      student_name: string
      roll_number: number
      enrollment_id?: string
      reason?: string | null
      photo_url?: string | null
      original_workstation_label?: string | null
    } | null
    isPresent?: boolean | null
  }) | null
  categories: IssueCategoryRow[]
  isPrivileged: boolean
  currentUserId: string
  currentUserName: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => Promise<void> | void
  assistanceRequest?: {
    id: string
    title: string
    description?: string | null
    severity?: string
    studentName?: string | null
    studentRoll?: string | null
  } | null
  onAcknowledgeAssistance?: (id: string) => Promise<void> | void
  onTogglePresence?: (identifier: string | number) => void
  onAssignOverride?: (targetWsId: string, enrollmentId: string) => Promise<void>
  availableWorkstations?: Array<{ id: string; label: string; description?: string }>
  displacedStudents?: DisplacedStudent[]
  onAssignReplacement?: (targetWsId: string, enrollmentId: string, reason: string) => Promise<void>
  isLocked?: boolean
}

export function WorkstationIssueDrawer({
  workstation,
  categories,
  isPrivileged,
  currentUserId,
  currentUserName,
  isOpen,
  onClose,
  onSuccess,
  assistanceRequest = null,
  onAcknowledgeAssistance,
  onTogglePresence,
  onAssignOverride,
  availableWorkstations = [],
  displacedStudents = [],
  onAssignReplacement,
  isLocked = false,
}: WorkstationIssueDrawerProps) {
  const [activeTab, setActiveTab] = useState<'specs' | 'rollcall' | 'issues' | 'report'>('specs')
  const [submitting, setSubmitting] = useState(false)
  const [resolvingIssueId, setResolvingIssueId] = useState<string | null>(null)
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [partsReplaced, setPartsReplaced] = useState('')
  const [createLogbookEntry, setCreateLogbookEntry] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Local optimistic resolved issues tracker
  const [resolvedIssueIds, setResolvedIssueIds] = useState<string[]>([])

  // Report form state
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('')
  const [selectedChipTitle, setSelectedChipTitle] = useState<string>('')
  const [issueTitle, setIssueTitle] = useState('')
  const [issueDescription, setIssueDescription] = useState('')
  const [issueSeverity, setIssueSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium')
  const [issuePhotos, setIssuePhotos] = useState<WorkstationPhoto[]>([])

  // Reassignment state
  const destinationStations = availableWorkstations.filter((w) => w.id !== workstation?.id)
  const [selectedTargetWsId, setSelectedTargetWsId] = useState<string>('')
  const [isSubmittingOverride, setIsSubmittingOverride] = useState(false)
  const [localPresence, setLocalPresence] = useState<boolean>(true)

  // Displaced student assignment state
  const [selectedDisplacedEnrollmentId, setSelectedDisplacedEnrollmentId] = useState<string>('')
  const [isSubmittingDisplaced, setIsSubmittingDisplaced] = useState(false)
  const [isResettingLock, setIsResettingLock] = useState(false)
  const [confirmResetLock, setConfirmResetLock] = useState(false)
  const [copiedSetupCmd, setCopiedSetupCmd] = useState(false)

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const prevWorkstationIdRef = useRef<string | null>(null)
  const prevIsOpenRef = useRef<boolean>(false)

  // Smart-default tab and reset optimistic state ONLY on initial drawer open or when switching workstations
  useEffect(() => {
    if (!isOpen || !workstation) {
      prevIsOpenRef.current = isOpen
      return
    }

    const isNewlyOpened = !prevIsOpenRef.current && isOpen
    const isWorkstationChanged = prevWorkstationIdRef.current !== workstation.id

    if (isNewlyOpened || isWorkstationChanged) {
      setResolvedIssueIds([])
      setConfirmResetLock(false)
      setLocalPresence(workstation.isPresent !== false)

      const hasIssues =
        (workstation.active_issues && workstation.active_issues.length > 0) ||
        (workstation.open_issues_count || 0) > 0 ||
        Boolean(assistanceRequest) ||
        workstation.status === 'flagged' ||
        workstation.status === 'under_repair'

      const hasStudent = Boolean(workstation.session_override || workstation.assignment)

      if (hasIssues) {
        setActiveTab('issues')
      } else if (hasStudent && Boolean(onTogglePresence)) {
        setActiveTab('rollcall')
      } else {
        setActiveTab('specs')
      }
    }

    prevIsOpenRef.current = isOpen
    prevWorkstationIdRef.current = workstation.id
  }, [isOpen, workstation?.id, workstation?.status, workstation?.open_issues_count, assistanceRequest, onTogglePresence])

  // Keep local presence synchronized whenever workstation.isPresent changes
  useEffect(() => {
    if (workstation) {
      setLocalPresence(workstation.isPresent !== false)
    }
  }, [workstation?.isPresent])

  // Keep destination stations selection valid
  useEffect(() => {
    const validStations = availableWorkstations.filter((w) => w.id !== workstation?.id)
    if (!validStations.some((w) => w.id === selectedTargetWsId)) {
      setSelectedTargetWsId(validStations[0]?.id || '')
    }
  }, [availableWorkstations, workstation?.id, selectedTargetWsId])

  // Keep displaced students selection valid
  useEffect(() => {
    if (displacedStudents && displacedStudents.length > 0) {
      if (!displacedStudents.some((s) => s.enrollmentId === selectedDisplacedEnrollmentId)) {
        setSelectedDisplacedEnrollmentId(displacedStudents[0].enrollmentId)
      }
    } else {
      setSelectedDisplacedEnrollmentId('')
    }
  }, [displacedStudents, selectedDisplacedEnrollmentId])

  if (!isOpen || !workstation) return null

  // Active issues with optimistic exclusion
  const activeIssues = (workstation.active_issues || []).filter(
    (issue) => !resolvedIssueIds.includes(issue.id)
  )
  const activeCount = activeIssues.length + (assistanceRequest ? 1 : 0)
  const student = workstation.session_override || workstation.assignment
  const hasStudent = Boolean(student)
  const rollNumber = student?.roll_number
  const enrollmentId =
    workstation.assignment?.enrollment_id ||
    (workstation.session_override as any)?.enrollment_id
  const studentIdentifier = enrollmentId || rollNumber
  const isTemporary = Boolean(workstation.session_override)

  // Quick issue chips organized into 2 clean scannable rows with zero text overflow
  const quickIssueChipsRow1 = [
    { title: 'Mouse / Keyboard Fault', label: 'Mouse / Keyboard', subtitle: 'Faulty / jammed', tooltip: 'Mouse / Keyboard Fault', severity: 'medium' as const },
    { title: 'No Display / Black Screen', label: 'No Display', subtitle: 'Black screen', tooltip: 'No Display / Black Screen', severity: 'high' as const },
    { title: 'LAN / No Internet', label: 'LAN / Network', subtitle: 'No internet', tooltip: 'LAN / No Internet', severity: 'medium' as const },
    { title: 'Missing Software', label: 'Missing Software', subtitle: 'VS Code, Python', tooltip: 'Missing Lab Software (VS Code/Python/C++)', severity: 'low' as const },
  ]

  const quickIssueChipsRow2 = [
    { title: 'OS Freeze / BSOD Crash', label: 'OS Freeze', subtitle: 'BSOD / crash', tooltip: 'OS Freeze / BSOD Crash', severity: 'high' as const },
    { title: 'Audio / Headphone Fault', label: 'Audio / Sound', subtitle: 'Headphone jack', tooltip: 'Audio / Headphone Fault', severity: 'low' as const },
    { title: "Power / Won't Boot", label: "Power Fault", subtitle: "Won't boot", tooltip: "Power / Won't Boot", severity: 'critical' as const },
    { title: 'Other Issue', label: 'Other Issue', subtitle: 'Custom triage', tooltip: 'Other Workstation Problem', severity: 'medium' as const },
  ]

  const handleSelectChip = (chip: { title: string; severity: 'low' | 'medium' | 'high' | 'critical' }) => {
    setSelectedChipTitle(chip.title)
    setIssueSeverity(chip.severity)
    if (chip.title === 'Other Issue') {
      setIssueTitle('')
    } else {
      setIssueTitle(chip.title)
    }
    // Auto-match category if applicable
    const matchingCat = categories.find((c) =>
      c.name.toLowerCase().includes(chip.title.toLowerCase().slice(0, 5))
    )
    if (matchingCat) {
      setSelectedCategoryId(matchingCat.id)
    }
  }

  // 1. Toggle Attendance
  const handleToggleAttendance = (setPresent: boolean) => {
    if (isLocked || !studentIdentifier || !onTogglePresence) return
    setLocalPresence(setPresent)
    onTogglePresence(studentIdentifier)
    setSuccessMessage(setPresent ? 'Student marked present.' : 'Student marked absent.')
    setTimeout(() => {
      setSuccessMessage(null)
    }, 1500)
  }

  // 2. Quick Reassign (Tier 2)
  const handleReassignStudent = async () => {
    if (!selectedTargetWsId || !enrollmentId || !onAssignOverride) return
    setIsSubmittingOverride(true)
    setErrorMessage(null)
    try {
      await onAssignOverride(selectedTargetWsId, enrollmentId)
      const targetStationName = destinationStations.find((w) => w.id === selectedTargetWsId)?.label || 'station'
      setSuccessMessage(`Student temporarily relocated to ${targetStationName} for this session.`)
      setTimeout(() => {
        setSuccessMessage(null)
      }, 2500)
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to reassign seat.')
    } finally {
      setIsSubmittingOverride(false)
    }
  }

  // 3. Quick Seat Displaced Student
  const handleAssignDisplacedStudent = async () => {
    if (!selectedDisplacedEnrollmentId || !onAssignReplacement || !workstation) return
    setIsSubmittingDisplaced(true)
    setErrorMessage(null)
    try {
      await onAssignReplacement(workstation.id, selectedDisplacedEnrollmentId, 'Assigned from Workstation Sidebar')
      setSuccessMessage(`Student assigned to ${workstation.label} for this session.`)
      setTimeout(() => {
        setSuccessMessage(null)
      }, 2500)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to seat student.'
      setErrorMessage(msg)
    } finally {
      setIsSubmittingDisplaced(false)
    }
  }

  // 4. Submit Problem Report
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!issueTitle.trim()) {
      setErrorMessage('Please provide an issue title or description.')
      return
    }

    setErrorMessage(null)
    setSubmitting(true)

    try {
      const res = await reportWorkstationIssue({
        workstation_id: workstation.id,
        category_id: selectedCategoryId || null,
        title: issueTitle.trim(),
        description: issueDescription.trim() || null,
        severity: issueSeverity,
        photos: issuePhotos,
      })

      if (!res.success) {
        throw new Error(res.error || 'Failed to submit issue report.')
      }

      setSuccessMessage('Problem reported successfully. Lab In-Charge has been notified.')
      // Reset form
      setIssueTitle('')
      setIssueDescription('')
      setIssuePhotos([])

      // Refresh parent state immediately
      await onSuccess()
      broadcastSync('workstations', { stationCode: workstation.label })

      setTimeout(() => {
        setSuccessMessage(null)
        setActiveTab('issues')
      }, 1000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Submission failed.'
      setErrorMessage(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // 5. Resolve Issue Action
  const handleResolveIssue = async (issueId: string) => {
    if (!resolutionNotes.trim()) {
      setErrorMessage('Please enter resolution notes describing the corrective service performed.')
      return
    }

    setErrorMessage(null)
    setSubmitting(true)

    try {
      const res = await resolveWorkstationIssue({
        issue_id: issueId,
        resolution_notes: resolutionNotes.trim(),
        create_maintenance_log: createLogbookEntry,
        parts_replaced: partsReplaced.trim() || null,
      })

      if (!res.success) {
        throw new Error(res.error || 'Failed to resolve issue.')
      }

      // Optimistically hide the resolved issue immediately
      setResolvedIssueIds((prev) => [...prev, issueId])
      setResolvingIssueId(null)
      setResolutionNotes('')
      setPartsReplaced('')
      setSuccessMessage('Issue certified as resolved and recorded in Service Logbook.')

      // Refresh parent state immediately
      await onSuccess()
      broadcastSync('workstations', { stationCode: workstation.label })

      setTimeout(() => {
        setSuccessMessage(null)
      }, 2500)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Resolution failed.'
      setErrorMessage(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // 6. Reset Hardware Lock Action (Inline Protected Flow)
  const executeResetHardwareLock = async () => {
    if (!workstation) return

    setIsResettingLock(true)
    setErrorMessage(null)
    try {
      const res = await resetWorkstationHardwareLock(workstation.id)
      if (res.success) {
        setSuccessMessage(`Hardware lock released on ${workstation.label}. Station unbound and ready for new physical pairing.`)
        setConfirmResetLock(false)
        await onSuccess()
        broadcastSync('workstations', { stationCode: workstation.label })
      } else {
        setErrorMessage(res.error || 'Failed to reset hardware lock.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error resetting hardware lock.'
      setErrorMessage(msg)
    } finally {
      setIsResettingLock(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex justify-end bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150 cursor-pointer"
      onClick={onClose}
    >
      <div
        data-testid="workstation-drawer"
        role="dialog"
        aria-modal="true"
        className="relative flex h-[100dvh] max-h-[100dvh] w-full sm:w-[420px] max-w-lg md:max-w-xl flex-col bg-white dark:bg-[#101726] border-l border-zinc-200 dark:border-white/[0.08] shadow-2xl overflow-hidden animate-in slide-in-from-right duration-200 cursor-default pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Enterprise Command Header Bar */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/[0.08] bg-zinc-50/90 dark:bg-[#151E32]/90 px-5 py-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-xl border shadow-sm ${
                workstation.status === 'flagged' || assistanceRequest
                  ? 'border-amber-400 dark:border-amber-500/50 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : workstation.status === 'under_repair'
                  ? 'border-cyan-400 dark:border-cyan-500/50 bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                  : 'border-emerald-400 dark:border-emerald-500/50 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {workstation.status === 'flagged' || assistanceRequest ? (
                <ShieldAlert className="h-5 w-5" />
              ) : workstation.status === 'under_repair' ? (
                <Wrench className="h-5 w-5" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-heading font-extrabold text-lg text-zinc-900 dark:text-white">
                  {workstation.label}
                </h3>
                <span className="rounded-md bg-zinc-100 dark:bg-white/[0.06] px-2 py-0.5 font-mono text-xs text-zinc-700 dark:text-slate-300">
                  {workstation.row_label || 'Workstation'}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                    workstation.status === 'operational' && !assistanceRequest
                      ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20'
                      : workstation.status === 'under_repair'
                      ? 'text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/20'
                      : 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      workstation.status === 'operational' && !assistanceRequest
                        ? 'bg-emerald-500'
                        : workstation.status === 'under_repair'
                        ? 'bg-cyan-500'
                        : 'bg-amber-500'
                    }`}
                  />
                  <span>
                    {workstation.status === 'operational' && !assistanceRequest
                      ? 'Operational'
                      : workstation.status === 'under_repair'
                      ? 'Under Repair'
                      : 'Flagged'}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-200 dark:border-white/[0.08] p-2 text-zinc-400 dark:text-slate-400 transition-colors hover:bg-zinc-100 dark:hover:bg-white/[0.06] hover:text-zinc-900 dark:hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Unified 4-Tab Enterprise Command Center Navigator */}
        <div className="grid grid-cols-4 border-b border-zinc-200 dark:border-white/[0.08] bg-zinc-100/80 dark:bg-[#0E1524]">
          {/* Tab 1: Specs & Silicon Telemetry */}
          <button
            type="button"
            onClick={() => setActiveTab('specs')}
            className={`py-3 text-center text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'specs'
                ? 'border-indigo-600 dark:border-indigo-500 text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/5'
                : 'border-transparent text-zinc-600 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-slate-200'
            }`}
          >
            <Cpu className="h-3.5 w-3.5" />
            <span className="truncate">Specs</span>
            {workstation.machine_guid ? (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 shrink-0" title="Silicon Bound" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-slate-600 shrink-0" title="Unbound" />
            )}
          </button>

          {/* Tab 2: Live Seating & Attendance */}
          <button
            type="button"
            onClick={() => setActiveTab('rollcall')}
            className={`py-3 text-center text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'rollcall'
                ? 'border-indigo-600 dark:border-indigo-500 text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/5'
                : 'border-transparent text-zinc-600 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-slate-200'
            }`}
          >
            <UserCheck className="h-3.5 w-3.5" />
            <span className="truncate">Seating</span>
            {hasStudent && (
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${localPresence === false ? 'bg-rose-500 dark:bg-rose-400' : 'bg-emerald-500 dark:bg-emerald-400'}`} />
            )}
          </button>

          {/* Tab 3: Active Faults & Issues */}
          <button
            type="button"
            onClick={() => setActiveTab('issues')}
            className={`py-3 text-center text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'issues'
                ? 'border-indigo-600 dark:border-indigo-500 text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/5'
                : 'border-transparent text-zinc-600 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            <span className="truncate">Issues</span>
            {activeCount > 0 ? (
              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border-amber-300 dark:border-amber-500/30 text-[9px] font-mono px-1 py-0 h-4 min-w-4 flex items-center justify-center">
                {activeCount}
              </Badge>
            ) : null}
          </button>

          {/* Tab 4: Report Fault */}
          <button
            type="button"
            onClick={() => setActiveTab('report')}
            className={`py-3 text-center text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'report'
                ? 'border-indigo-600 dark:border-indigo-500 text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/5'
                : 'border-transparent text-zinc-600 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-slate-200'
            }`}
          >
            <Wrench className="h-3.5 w-3.5" />
            <span className="truncate">Report</span>
          </button>
        </div>

        {/* Global Feedback Notifications */}
        {errorMessage && (
          <div className="mx-5 mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="mx-5 mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-300">
            {successMessage}
          </div>
        )}

        {/* Drawer Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* ============================================================== */}
          {/* TAB 1: SILICON TELEMETRY & HARDWARE DIAGNOSTICS DECK           */}
          {/* ============================================================== */}
          {/* ============================================================== */}
          {/* TAB 1: SILICON TELEMETRY & HARDWARE DIAGNOSTICS DECK           */}
          {/* ============================================================== */}
          {activeTab === 'specs' && (() => {
            const specs = workstation.hardware_specs as WorkstationHardwareSpecs | null
            const hasValidTelemetry = Boolean(specs?.cpu && specs?.ram_gb)
            const totalGb = specs?.disk_c_total_gb || 0
            const freeGb = specs?.disk_c_free_gb || 0
            const usedGb = Math.max(0, totalGb - freeGb)
            const usedPct = totalGb > 0 ? Math.min(100, Math.round((usedGb / totalGb) * 100)) : 0
            const isLowDisk = freeGb < 15.0
            const isCriticalDisk = freeGb < 5.0

            return (
              <div className="space-y-4">
                {hasValidTelemetry && specs ? (
                  <div className="rounded-2xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#0E1526] p-4 sm:p-5 shadow-xl space-y-4 relative overflow-hidden">
                    <div className="absolute -top-12 -right-12 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

                    {/* Telemetry Header */}
                    <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/[0.06] pb-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm">
                          <Cpu className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="font-heading font-extrabold text-sm uppercase tracking-wider text-zinc-900 dark:text-white">
                            Silicon Telemetry
                          </h4>
                          <p className="text-[11px] text-zinc-500 dark:text-slate-400 font-mono">
                            Physical Node Architecture &amp; System Health
                          </p>
                        </div>
                      </div>

                      <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 px-3 py-1 rounded-full shadow-xs">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Agent Synced (v{specs.agent_version || '1.0.0'})</span>
                      </span>
                    </div>

                    {/* 2-Column Compute & Memory Bento Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Processor Core Card */}
                      <div className="rounded-xl bg-zinc-50 dark:bg-[#141E34] border border-zinc-200 dark:border-white/[0.06] p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10.5px] uppercase font-mono tracking-wider text-zinc-500 dark:text-slate-400 flex items-center gap-1.5">
                            <Activity className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                            Processor
                          </span>
                        </div>
                        <div className="text-zinc-900 dark:text-white font-bold text-xs leading-snug line-clamp-2" title={specs.cpu}>
                          {specs.cpu}
                        </div>
                        <div className="text-[10px] text-zinc-500 dark:text-slate-500 font-mono">
                          x64 Physical Compute Core
                        </div>
                      </div>

                      {/* Memory Card */}
                      <div className="rounded-xl bg-zinc-50 dark:bg-[#141E34] border border-zinc-200 dark:border-white/[0.06] p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10.5px] uppercase font-mono tracking-wider text-zinc-500 dark:text-slate-400 flex items-center gap-1.5">
                            <Server className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                            RAM Installed
                          </span>
                        </div>
                        <div className="text-zinc-900 dark:text-white font-extrabold text-lg font-heading tracking-tight">
                          {specs.ram_gb} GB
                        </div>
                        <div className="text-[10px] text-zinc-500 dark:text-slate-500 font-mono">
                          DDR System Memory
                        </div>
                      </div>
                    </div>

                    {/* Storage Allocation & Headroom Meter (Drive C:) */}
                    <div className="rounded-xl bg-zinc-50 dark:bg-[#141E34] border border-zinc-200 dark:border-white/[0.06] p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-zinc-600 dark:text-slate-400 flex items-center gap-1.5 font-medium">
                          <HardDrive className="h-3.5 w-3.5 text-zinc-500 dark:text-slate-400" />
                          System Volume (Drive C:)
                        </span>
                        <span className="font-mono font-bold text-zinc-900 dark:text-white tabular-nums">
                          {specs.disk_c_free_gb} GB Free / {specs.disk_c_total_gb} GB
                        </span>
                      </div>

                      {/* Graduated Multi-Tone Bar */}
                      <div className="h-2.5 w-full rounded-full bg-zinc-200 dark:bg-[#0B0F19] overflow-hidden p-0.5 border border-zinc-300 dark:border-white/5">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isCriticalDisk
                              ? 'bg-gradient-to-r from-rose-600 to-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.6)] animate-pulse'
                              : isLowDisk
                              ? 'bg-gradient-to-r from-amber-600 to-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                              : 'bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                          }`}
                          style={{ width: `${usedPct}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-slate-400">
                          {usedPct}% Allocated ({usedGb.toFixed(1)} GB in use)
                        </span>
                        {isCriticalDisk ? (
                          <span className="text-rose-400 font-bold flex items-center gap-1 animate-pulse">
                            <AlertTriangle className="h-3 w-3 text-rose-400" />
                            <span>Storage Critical (&lt;5 GB Free)</span>
                          </span>
                        ) : isLowDisk ? (
                          <span className="text-amber-300 font-medium flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 text-amber-400" />
                            <span>Low Storage Warning (&lt;15 GB)</span>
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* OS & Network Topology Ribbon */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                      <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#141E34] border border-zinc-200 dark:border-white/[0.06] space-y-1">
                        <div className="text-[10px] uppercase text-zinc-500 dark:text-slate-400 flex items-center gap-1.5">
                          <Monitor className="h-3 w-3 text-indigo-600 dark:text-indigo-400" /> Operating System
                        </div>
                        <div className="text-zinc-900 dark:text-slate-200 font-semibold text-[11.5px] truncate" title={specs.os_caption}>
                          {specs.os_caption}
                        </div>
                        <div className="text-[10px] text-zinc-500 dark:text-slate-500">
                          Build {specs.os_build} • 64-bit Kernel
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#141E34] border border-zinc-200 dark:border-white/[0.06] space-y-1">
                        <div className="text-[10px] uppercase text-zinc-500 dark:text-slate-400 flex items-center gap-1.5">
                          <Wifi className="h-3 w-3 text-cyan-600 dark:text-cyan-400" /> Station Link &amp; MAC
                        </div>
                        <div className="text-zinc-900 dark:text-slate-200 font-semibold text-[11.5px]">
                          {specs.lan_ip}
                        </div>
                        <div className="text-[10px] text-zinc-500 dark:text-slate-500">
                          MAC: {specs.mac_address}
                        </div>
                      </div>
                    </div>

                    {/* Silicon TOFU Hardware Lock Card */}
                    {workstation.machine_guid && (
                      <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/20 p-3.5 space-y-3">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex items-start gap-2.5">
                            <div className="h-7 w-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5 shadow-xs">
                              <ShieldCheck className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                <span>Silicon TOFU Lock Enforced</span>
                              </div>
                              <div className="text-[10.5px] text-slate-400 font-mono mt-0.5">
                                Bound to physical silicon ({workstation.machine_guid.slice(-17)}). Zero URL spoofing permitted.
                              </div>
                            </div>
                          </div>

                          {isPrivileged && (
                            <div className="shrink-0">
                              {confirmResetLock ? (
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    disabled={isResettingLock}
                                    onClick={executeResetHardwareLock}
                                    className="h-8 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs gap-1.5 cursor-pointer shadow-md"
                                  >
                                    <RotateCcw className={`h-3.5 w-3.5 ${isResettingLock ? 'animate-spin' : ''}`} />
                                    <span>Confirm Unbind</span>
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    disabled={isResettingLock}
                                    onClick={() => setConfirmResetLock(false)}
                                    className="h-8 px-2.5 rounded-xl text-slate-400 hover:text-white text-xs cursor-pointer"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={isResettingLock}
                                  onClick={() => setConfirmResetLock(true)}
                                  className="h-8 px-3 rounded-xl border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold text-xs gap-1.5 cursor-pointer transition-colors shadow-xs"
                                  title="Unbind current hardware GUID to allow new physical machine pairing"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  <span>Reset Hardware Lock</span>
                                </Button>
                              )}
                            </div>
                          )}
                        </div>

                        {confirmResetLock && (
                          <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/30 text-[11px] text-rose-300">
                            <strong>Motherboard or NIC replaced?</strong> Resetting will release the cryptographic lock on {workstation.label}. The next computer executing <code className="font-mono text-white">labsync-agent.ps1</code> with station code &quot;{workstation.label}&quot; will automatically bind to this station.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#0E1526] p-5 shadow-xl space-y-4">
                    <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/[0.06] pb-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 flex items-center justify-center text-zinc-500 dark:text-slate-400">
                          <Cpu className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="font-heading font-extrabold text-sm uppercase tracking-wider text-zinc-900 dark:text-white">
                            Hardware Telemetry
                          </h4>
                          <p className="text-[11px] text-zinc-500 dark:text-slate-400 font-mono">
                            {workstation.label} &bull; Native Diagnostics
                          </p>
                        </div>
                      </div>

                      <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-zinc-600 dark:text-slate-400 bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/10 px-3 py-1 rounded-full shadow-xs">
                        <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-slate-500" />
                        <span>Agent Not Connected</span>
                      </span>
                    </div>

                    <div className="rounded-xl border border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-white/[0.02] p-4 text-xs text-zinc-600 dark:text-slate-400 leading-relaxed">
                      Hardware telemetry (CPU, RAM, Disk, MAC) will populate automatically the first time the LabSync PowerShell Agent runs on this PC.
                    </div>

                    <div className="pt-1 text-left space-y-2">
                      <div className="flex items-center justify-between text-[10.5px] font-mono text-zinc-500 dark:text-slate-400 uppercase tracking-wider">
                        <span>Technician Enrollment Command:</span>
                        {copiedSetupCmd && (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                            <Check className="h-3 w-3" /> Copied
                          </span>
                        )}
                      </div>
                      <div
                        onClick={() => {
                          navigator.clipboard?.writeText(
                            `powershell -ExecutionPolicy Bypass -File .\\scripts\\client-agent\\labsync-agent.ps1 -StationCode "${workstation.label}"`
                          )
                          setCopiedSetupCmd(true)
                          setTimeout(() => setCopiedSetupCmd(false), 2500)
                        }}
                        className="p-2.5 rounded-xl bg-zinc-100 dark:bg-black/40 border border-zinc-200 dark:border-white/5 font-mono text-[11px] text-indigo-700 dark:text-indigo-300 hover:border-indigo-500/40 cursor-pointer select-all overflow-x-auto flex items-center justify-between gap-2"
                        title="Click to copy setup command"
                      >
                        <code className="truncate">
                          powershell -ExecutionPolicy Bypass -File .\scripts\client-agent\labsync-agent.ps1 -StationCode &quot;{workstation.label}&quot;
                        </code>
                        <Copy className="h-3.5 w-3.5 text-zinc-400 dark:text-slate-400 shrink-0" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Direct Operational Quick Links */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Link
                    href={`/terminal/${encodeURIComponent(workstation.label)}`}
                    target="_blank"
                    className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 text-xs text-slate-300 hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Monitor className="h-4 w-4 text-indigo-400 shrink-0" />
                      <span className="truncate">Student Gateway</span>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                  </Link>

                  <Link
                    href={`/maintenance?search=${encodeURIComponent(workstation.label)}`}
                    target="_blank"
                    className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 text-xs text-slate-300 hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Wrench className="h-4 w-4 text-amber-400 shrink-0" />
                      <span className="truncate">Service Logbook</span>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                  </Link>
                </div>
              </div>
            )
          })()}

          {/* ============================================================== */}
          {/* TAB 2: ROLL-CALL & SEATING ALLOCATION                           */}
          {/* ============================================================== */}
          {activeTab === 'rollcall' && (
            <div className="space-y-4">
              {student ? (
                <div className="rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-[#151E32] p-4 shadow-sm space-y-4">
                  {/* Seated Student Biographical Header */}
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full overflow-hidden border border-zinc-200 dark:border-white/20 bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 shadow-md">
                      {(student as any).photo_url ? (
                        <img
                          src={(student as any).photo_url}
                          alt={student.student_name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300 font-heading">
                          {student.student_name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-heading font-extrabold text-base text-zinc-900 dark:text-white truncate">
                          {student.student_name}
                        </h4>
                        <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30 font-mono text-[10.5px]">
                          Roll {student.roll_number}
                        </Badge>
                      </div>
                      <p className="text-xs text-zinc-600 dark:text-slate-400 mt-0.5">
                        {isTemporary ? (
                          <span className="text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1">
                            <ArrowRightLeft className="h-3 w-3 inline shrink-0" />
                            Temporarily Relocated (Session Override)
                          </span>
                        ) : (
                          'Baseline Cohort Seating Allocation'
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Attendance Controls */}
                  <div className="pt-3 border-t border-zinc-200 dark:border-white/5 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-600 dark:text-slate-400 font-medium">Session Attendance Status:</span>
                      <Badge
                        className={
                          localPresence === false
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300 border-rose-300 dark:border-rose-500/30'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30'
                        }
                      >
                        {localPresence === false ? 'Marked Absent' : 'Marked Present'}
                      </Badge>
                    </div>

                    {onTogglePresence && (
                      <div>
                        {localPresence === false ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleToggleAttendance(true)}
                            disabled={isLocked}
                            className="w-full h-10 rounded-xl text-xs font-bold gap-2 cursor-pointer transition-all border-emerald-400 dark:border-emerald-500/50 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20"
                          >
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            <span>Restore to Present</span>
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleToggleAttendance(false)}
                            disabled={isLocked}
                            className="w-full h-10 rounded-xl text-xs font-bold gap-2 cursor-pointer transition-all border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20"
                          >
                            <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                            <span>Mark Absent</span>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Tier 2 Temporary Reassignment */}
                  {onAssignOverride && (
                    <div className="pt-3 border-t border-zinc-200 dark:border-white/5 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-zinc-700 dark:text-slate-300 uppercase tracking-wider text-[10.5px]">
                          Temporary Reassign (Tier 2):
                        </span>
                        <span className="text-[10px] text-zinc-500 dark:text-slate-500">Today only</span>
                      </div>

                      {destinationStations.length === 0 ? (
                        <p className="text-[11px] text-zinc-600 dark:text-slate-400 italic">
                          No other operational vacant stations available for reassignment.
                        </p>
                      ) : (
                        <div className="flex gap-2">
                          <select
                            value={selectedTargetWsId}
                            onChange={(e) => setSelectedTargetWsId(e.target.value)}
                            className="flex-1 h-9 px-3 rounded-xl bg-white dark:bg-[#0B0F19] border border-zinc-300 dark:border-white/10 text-zinc-900 dark:text-white text-xs"
                          >
                            {destinationStations.map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.label}
                              </option>
                            ))}
                          </select>
                          <Button
                            type="button"
                            onClick={handleReassignStudent}
                            disabled={isSubmittingOverride || !selectedTargetWsId}
                            className="h-9 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs gap-1.5 cursor-pointer shrink-0 shadow-sm"
                          >
                            {isSubmittingOverride ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ArrowRightLeft className="h-3.5 w-3.5" />
                            )}
                            <span>Reassign</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-[#151E32]/50 p-6 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-500/20">
                    <Monitor className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-heading font-semibold text-zinc-900 dark:text-white text-sm">Station Available / Unassigned</h4>
                    <p className="mt-1 max-w-xs text-xs text-zinc-600 dark:text-slate-400">
                      No student is currently assigned or seated at {workstation.label}.
                    </p>
                  </div>

                  {/* Assign Displaced Student if any are waiting */}
                  {onAssignReplacement && displacedStudents && displacedStudents.length > 0 && (
                    <div className="w-full max-w-md pt-4 border-t border-white/5 text-left space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" />
                          <span>Assign Waiting / Displaced Student ({displacedStudents.length})</span>
                        </span>
                        <span className="text-[10px] text-slate-500">Tier 2 Quick Seat</span>
                      </div>
                      <div className="flex gap-2">
                        <select
                          value={selectedDisplacedEnrollmentId}
                          onChange={(e) => setSelectedDisplacedEnrollmentId(e.target.value)}
                          className="flex-1 h-9 px-3 rounded-xl bg-white dark:bg-[#0B0F19] border border-zinc-300 dark:border-white/10 text-zinc-900 dark:text-white text-xs truncate"
                        >
                          {displacedStudents.map((ds) => (
                            <option key={ds.enrollmentId} value={ds.enrollmentId}>
                              Roll {ds.rollNumber} — {ds.studentName} ({ds.originalWsLabel !== 'Unassigned' ? `Displaced from ${ds.originalWsLabel}` : 'Unassigned'})
                            </option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          onClick={handleAssignDisplacedStudent}
                          disabled={isSubmittingDisplaced || !selectedDisplacedEnrollmentId}
                          className="h-9 px-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs gap-1.5 cursor-pointer shrink-0 shadow-sm"
                        >
                          {isSubmittingDisplaced ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ArrowRightLeft className="h-3.5 w-3.5" />
                          )}
                          <span>Seat Here</span>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Quick Link to Student Terminal Gateway */}
              <div className="pt-2">
                <Link
                  href={`/terminal/${encodeURIComponent(workstation.label)}`}
                  target="_blank"
                  className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 text-xs text-slate-300 hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Monitor className="h-4 w-4 text-indigo-400" />
                    <span>Open Student Terminal Gateway</span>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                </Link>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: ACTIVE ISSUES & ASSISTANCE REQUESTS                      */}
          {/* ============================================================== */}
          {activeTab === 'issues' && (
            <div className="space-y-4">
              {/* Assistance Request Banner (Real-Time Student Ping) */}
              {assistanceRequest && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 shadow-sm space-y-2.5">
                  <div className="flex items-center justify-between gap-2 border-b border-amber-500/20 pb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                      </span>
                      <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-amber-300 truncate">
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
                        className="h-7 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs gap-1 cursor-pointer shadow-sm transition-all"
                        title="Acknowledge student help notification"
                      >
                        <Check className="h-3.5 w-3.5 text-slate-950" />
                        <span>Acknowledge</span>
                      </Button>
                    )}
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-sm font-extrabold text-white leading-snug">
                      {assistanceRequest.title}
                    </h4>
                    {assistanceRequest.studentName && (
                      <p className="text-xs text-zinc-300">
                        from <strong className="text-amber-200 font-semibold">{assistanceRequest.studentName}</strong>
                        {assistanceRequest.studentRoll && (
                          <span className="text-indigo-300 font-mono ml-1 font-bold">
                            (Roll {assistanceRequest.studentRoll})
                          </span>
                        )}
                      </p>
                    )}
                    {assistanceRequest.description && (
                      <p className="text-xs text-zinc-300/90 italic bg-black/40 p-2.5 rounded-lg border border-white/5 mt-1 leading-relaxed">
                        &ldquo;{assistanceRequest.description}&rdquo;
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Direct Link to Maintenance Workbench */}
              <div>
                <Link
                  href={`/maintenance?search=${encodeURIComponent(workstation.label)}`}
                  target="_blank"
                  className="block"
                >
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-9 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold text-xs gap-2 cursor-pointer shadow-xs transition-colors"
                  >
                    <Wrench className="h-3.5 w-3.5 text-amber-400" />
                    <span>Open Maintenance Workbench</span>
                    <ExternalLink className="h-3 w-3 ml-auto text-amber-400/70" />
                  </Button>
                </Link>
              </div>

              {/* Active Logged Database Tickets */}
              {activeIssues.length === 0 && !assistanceRequest ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="rounded-full bg-emerald-500/10 p-4 text-emerald-400 mb-3">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h4 className="font-heading font-semibold text-white">All Diagnostics Normal</h4>
                  <p className="mt-1 max-w-xs text-xs text-slate-400">
                    No active faults or hardware defects reported for {workstation.label}.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('report')}
                    className="mt-4 flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg transition-transform hover:bg-indigo-500 active:scale-95 cursor-pointer"
                  >
                    <span>Report Problem</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                activeIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className="rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-[#151E32] p-4 shadow-sm space-y-3"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {issue.category && (
                            <span
                              className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm"
                              style={{ backgroundColor: issue.category.color || '#6366F1' }}
                            >
                              {issue.category.name}
                            </span>
                          )}
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              issue.severity === 'critical'
                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30'
                                : issue.severity === 'high'
                                ? 'bg-amber-50 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30'
                                : 'bg-zinc-200 text-zinc-700 dark:bg-slate-700/50 dark:text-slate-300'
                            }`}
                          >
                            {issue.severity}
                          </span>
                          <span className="rounded-md bg-zinc-200/80 dark:bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium text-zinc-700 dark:text-slate-400 capitalize">
                            Status: {issue.status.replace('_', ' ')}
                          </span>

                          {/* Reporting Origin Attribution */}
                          {issue.source === 'student_terminal' ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/30 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                              <User className="h-3 w-3" />
                              <span>Student Terminal {issue.student_roll ? `• Roll ${issue.student_roll}` : ''}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 dark:bg-white/[0.06] border border-zinc-200 dark:border-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-700 dark:text-slate-400">
                              <Wrench className="h-3 w-3" />
                              <span>Faculty / In-Charge</span>
                            </span>
                          )}
                        </div>
                        <h4 className="font-heading font-semibold text-sm text-zinc-900 dark:text-white pt-1">
                          {issue.title}
                        </h4>
                        {issue.student_name && (
                          <div className="text-[11px] text-zinc-500 dark:text-slate-400 font-mono">
                            Reported by <strong className="text-zinc-800 dark:text-slate-200">{issue.student_name}</strong> {issue.student_roll ? `(Roll ${issue.student_roll})` : ''}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    {issue.description && (
                      <p className="rounded-lg bg-black/30 p-2.5 text-xs text-slate-300 leading-relaxed">
                        {issue.description}
                      </p>
                    )}

                    {/* Attached Evidence Photos */}
                    {issue.photos && issue.photos.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                          Photo Evidence ({issue.photos.length})
                        </p>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {issue.photos.map((photo, i) => (
                            <a
                              key={i}
                              href={photo.url}
                              target="_blank"
                              rel="noreferrer"
                              className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/40"
                            >
                              <img
                                src={photo.thumbnailUrl || photo.url}
                                alt={`Evidence ${i + 1}`}
                                className="h-full w-full object-cover transition-transform group-hover:scale-110"
                              />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Footer Info */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-white/5">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3 w-3 text-slate-500" />
                        <span>Reported by {issue.reported_by_name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-500" />
                        <span>{new Date(issue.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Resolution Section */}
                    {isPrivileged && (
                      <div className="pt-2">
                        {resolvingIssueId === issue.id ? (
                          <div className="space-y-3 rounded-lg border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-[#0E1524] p-3 text-xs">
                            <h5 className="font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                              <Sparkles className="h-3.5 w-3.5" />
                              <span>Certify Corrective Maintenance Fix</span>
                            </h5>
                            <div>
                              <label className="block text-[11px] text-zinc-600 dark:text-slate-400 mb-1">
                                Technical Action Taken &bull; Resolution Notes:
                              </label>
                              <textarea
                                value={resolutionNotes}
                                onChange={(e) => setResolutionNotes(e.target.value)}
                                rows={2}
                                className="w-full rounded-lg border border-zinc-300 dark:border-white/10 bg-white dark:bg-[#151E32] p-2 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                                placeholder="Describe corrective maintenance performed (e.g. replaced loose SATA cable)..."
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-zinc-600 dark:text-slate-400 mb-1">
                                Parts Replaced (Optional):
                              </label>
                              <input
                                type="text"
                                value={partsReplaced}
                                onChange={(e) => setPartsReplaced(e.target.value)}
                                className="w-full h-8 rounded-lg border border-zinc-300 dark:border-white/10 bg-white dark:bg-[#151E32] px-2 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                                placeholder="e.g. USB Optical Mouse, Cat6 Patch Cable"
                              />
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                              <input
                                type="checkbox"
                                checked={createLogbookEntry}
                                onChange={(e) => setCreateLogbookEntry(e.target.checked)}
                                className="rounded border-white/10 text-indigo-600 focus:ring-0"
                              />
                              <span>Log entry automatically to Certified Maintenance Logbook</span>
                            </label>
                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setResolvingIssueId(null)}
                                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5 cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={submitting}
                                onClick={() => handleResolveIssue(issue.id)}
                                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 cursor-pointer shadow-sm"
                              >
                                {submitting ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                )}
                                <span>Certify Fix</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setResolvingIssueId(issue.id)
                              setResolutionNotes('')
                              setPartsReplaced('')
                            }}
                            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20 cursor-pointer w-full justify-center"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Resolve &amp; Certify Fix</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 4: REPORT PROBLEM                                          */}
          {/* ============================================================== */}
          {activeTab === 'report' && (
            <form onSubmit={handleSubmitReport} className="space-y-4 text-xs">
              {/* Quick Issue Chips: 2 Clean Rows */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-zinc-700 dark:text-slate-300 uppercase tracking-wider">
                  Quick Issue Preset:
                </label>

                {/* Row 1: Hardware & Peripherals */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {quickIssueChipsRow1.map((chip) => (
                    <button
                      key={chip.title}
                      type="button"
                      onClick={() => handleSelectChip(chip)}
                      title={chip.tooltip || chip.title}
                      className={`p-2 rounded-xl border text-[11px] font-medium text-left transition-all cursor-pointer leading-tight flex flex-col justify-between min-h-[48px] ${
                        selectedChipTitle === chip.title
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 shadow-xs ring-1 ring-indigo-500/30'
                          : 'border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-white/[0.03] text-zinc-700 dark:text-slate-300 hover:border-zinc-300 dark:hover:border-white/20'
                      }`}
                    >
                      <span className="font-semibold text-[11px] leading-tight block truncate">
                        {chip.label || chip.title}
                      </span>
                      {chip.subtitle && (
                        <span className="text-[9.5px] text-zinc-500 dark:text-slate-400 block truncate mt-0.5 font-normal">
                          {chip.subtitle}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Row 2: Software, Power & Other */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {quickIssueChipsRow2.map((chip) => (
                    <button
                      key={chip.title}
                      type="button"
                      onClick={() => handleSelectChip(chip)}
                      title={chip.tooltip || chip.title}
                      className={`p-2 rounded-xl border text-[11px] font-medium text-left transition-all cursor-pointer leading-tight flex flex-col justify-between min-h-[48px] ${
                        selectedChipTitle === chip.title
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 shadow-xs ring-1 ring-indigo-500/30'
                          : 'border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-white/[0.03] text-zinc-700 dark:text-slate-300 hover:border-zinc-300 dark:hover:border-white/20'
                      }`}
                    >
                      <span className="font-semibold text-[11px] leading-tight block truncate">
                        {chip.label || chip.title}
                      </span>
                      {chip.subtitle && (
                        <span className="text-[9.5px] text-zinc-500 dark:text-slate-400 block truncate mt-0.5 font-normal">
                          {chip.subtitle}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Title Input (Shown when 'Other Issue' is picked or user has entered a custom title) */}
              {(selectedChipTitle === 'Other Issue' || (issueTitle && !quickIssueChipsRow1.some(c => c.title === issueTitle) && !quickIssueChipsRow2.some(c => c.title === issueTitle))) && (
                <div className="space-y-1.5 animate-in fade-in duration-150">
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-slate-300 uppercase tracking-wider">
                    Custom Issue Title <span className="text-rose-500">*</span>:
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={issueTitle}
                    onChange={(e) => setIssueTitle(e.target.value)}
                    placeholder="Describe custom issue (e.g. HDMI port broken, USB short)..."
                    className="w-full h-9 rounded-xl border border-zinc-300 dark:border-white/10 bg-white dark:bg-[#151E32] px-3 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              )}

              {/* Severity Selection */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-zinc-700 dark:text-slate-300 uppercase tracking-wider">
                  Severity Level:
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['low', 'medium', 'high', 'critical'] as const).map((sev) => (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setIssueSeverity(sev)}
                      className={`h-8 rounded-lg border text-xs font-semibold capitalize transition-all cursor-pointer ${
                        issueSeverity === sev
                          ? sev === 'critical'
                            ? 'border-rose-400 dark:border-rose-500 bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300'
                            : sev === 'high'
                            ? 'border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300'
                            : 'border-indigo-400 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300'
                          : 'border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/[0.03] text-zinc-600 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-zinc-700 dark:text-slate-300 uppercase tracking-wider">
                  Detailed Diagnostic Observations:
                </label>
                <textarea
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  rows={2}
                  placeholder="Optional diagnostic notes or observations..."
                  className="w-full rounded-xl border border-zinc-300 dark:border-white/10 bg-white dark:bg-[#151E32] p-2.5 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder-slate-500 focus:border-indigo-500 focus:outline-none leading-relaxed"
                />
              </div>

              {/* Photo Evidence Upload */}
              <WorkstationPhotoCapture
                photos={issuePhotos}
                onChange={setIssuePhotos}
                maxPhotos={3}
                disabled={submitting}
              />

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting || !issueTitle.trim()}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-xl transition-transform hover:bg-indigo-500 active:scale-98 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Submitting Report...</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4" />
                      <span>Submit Issue Report</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
