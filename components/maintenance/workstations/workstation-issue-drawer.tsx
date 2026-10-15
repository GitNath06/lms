'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  X,
  AlertTriangle,
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { WorkstationPhotoCapture } from './workstation-photo-capture'
import {
  reportWorkstationIssue,
  resolveWorkstationIssue,
} from '@/app/actions/workstations'
import type {
  WorkstationWithIssues,
  WorkstationIssueRecord,
  WorkstationPhoto,
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
  onTogglePresence?: (rollNumber: number) => void
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
  const [activeTab, setActiveTab] = useState<'rollcall' | 'issues' | 'report'>('issues')
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

  // Reset optimistic resolution state when workstation changes
  useEffect(() => {
    setResolvedIssueIds([])
  }, [workstation?.id])

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

  // Sync state and smart-default tab on workstation change
  useEffect(() => {
    if (!isOpen || !workstation) return

    setLocalPresence(workstation.isPresent !== false)

    const hasIssues =
      (workstation.active_issues && workstation.active_issues.length > 0) ||
      Boolean(assistanceRequest) ||
      workstation.status === 'flagged' ||
      workstation.status === 'under_repair'

    const hasStudent = Boolean(workstation.session_override || workstation.assignment)

    if (hasIssues) {
      setActiveTab('issues')
    } else if (hasStudent && Boolean(onTogglePresence)) {
      setActiveTab('rollcall')
    } else if (Boolean(onTogglePresence)) {
      setActiveTab('rollcall')
    } else {
      setActiveTab('issues')
    }
  }, [workstation?.id, isOpen])

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
  const isTemporary = Boolean(workstation.session_override)

  // Quick preset titles based on selected category
  const titlePresets = [
    'No Display / Monitor Blackout',
    'Windows BSOD / Kernel Panic',
    'LAN Cable Fault / No Network',
    'Keyboard Keys Jammed / Unresponsive',
    'Mouse Clicker / Sensor Broken',
    'System Overheating / Shuts Down',
    'Power Supply Failed / Won\'t Boot',
    'Missing Required Lab Software',
  ]

  const handleCategorySelect = (catId: string) => {
    setSelectedCategoryId(catId)
    const cat = categories.find((c) => c.id === catId)
    if (cat) {
      setIssueSeverity(cat.default_severity)
      if (!issueTitle) {
        setIssueTitle(cat.name)
      }
    }
  }

  // 1. Toggle Attendance
  const handleToggleAttendance = (setPresent: boolean) => {
    if (isLocked || !rollNumber || !onTogglePresence) return
    setLocalPresence(setPresent)
    onTogglePresence(rollNumber)
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

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150 cursor-pointer"
      onClick={onClose}
    >
      <div
        className="relative flex h-full w-full max-w-lg md:max-w-xl flex-col bg-[#101726] border-l border-white/[0.08] shadow-2xl overflow-hidden animate-in slide-in-from-right duration-200 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#151E32]/80 px-5 py-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                workstation.status === 'flagged' || assistanceRequest
                  ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                  : workstation.status === 'under_repair'
                  ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-400'
                  : 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
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
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-extrabold text-lg text-white">
                  {workstation.label}
                </h3>
                <span className="rounded-md bg-white/[0.06] px-2 py-0.5 font-mono text-xs text-slate-300">
                  {workstation.row_label || 'Workstation'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Status:{' '}
                <span
                  className={
                    workstation.status === 'operational' && !assistanceRequest
                      ? 'text-emerald-400 font-semibold'
                      : workstation.status === 'under_repair'
                      ? 'text-cyan-400 font-semibold'
                      : 'text-amber-400 font-semibold'
                  }
                >
                  {workstation.status === 'operational' && !assistanceRequest
                    ? 'Operational (Ready)'
                    : workstation.status === 'under_repair'
                    ? 'Under Repair / Servicing'
                    : `Flagged (${activeCount} Active Issue${activeCount > 1 ? 's' : ''})`}
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/[0.08] p-2 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Unified 3-Tab Navigator */}
        <div className="flex border-b border-white/[0.08] bg-[#0E1524]">
          {/* Tab 1: Roll-Call & Seating */}
          {Boolean(onTogglePresence || hasStudent) && (
            <button
              type="button"
              onClick={() => setActiveTab('rollcall')}
              className={`flex-1 py-3 text-center text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'rollcall'
                  ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserCheck className="h-3.5 w-3.5" />
              <span>Roll-Call</span>
            </button>
          )}

          {/* Tab 2: Active Issues & Assistance */}
          <button
            type="button"
            onClick={() => setActiveTab('issues')}
            className={`flex-1 py-3 text-center text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'issues'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Active Issues ({activeCount})</span>
          </button>

          {/* Tab 3: Report Problem */}
          <button
            type="button"
            onClick={() => setActiveTab('report')}
            className={`flex-1 py-3 text-center text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'report'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wrench className="h-3.5 w-3.5" />
            <span>Report Problem</span>
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
          {/* TAB 1: ROLL-CALL & SEATING ALLOCATION                           */}
          {/* ============================================================== */}
          {activeTab === 'rollcall' && (
            <div className="space-y-4">
              {student ? (
                <div className="rounded-xl border border-white/[0.08] bg-[#151E32] p-4 shadow-sm space-y-4">
                  {/* Seated Student Biographical Header */}
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full overflow-hidden border border-white/20 bg-slate-800 flex items-center justify-center shrink-0 shadow-md">
                      {(student as any).photo_url ? (
                        <img
                          src={(student as any).photo_url}
                          alt={student.student_name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-bold text-indigo-300 font-heading">
                          {student.student_name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-heading font-extrabold text-base text-white truncate">
                          {student.student_name}
                        </h4>
                        <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 font-mono text-[10.5px]">
                          Roll {student.roll_number}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {isTemporary ? (
                          <span className="text-amber-300 font-medium flex items-center gap-1">
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
                  <div className="pt-3 border-t border-white/5 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">Session Attendance Status:</span>
                      <Badge
                        className={
                          localPresence === false
                            ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                            : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        }
                      >
                        {localPresence === false ? 'Marked Absent' : 'Marked Present'}
                      </Badge>
                    </div>

                    {onTogglePresence && (
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleToggleAttendance(true)}
                          disabled={isLocked || localPresence === true}
                          className={`h-11 rounded-xl text-xs font-bold gap-2 cursor-pointer transition-all ${
                            localPresence === true
                              ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-300 shadow-sm'
                              : 'border-white/10 text-slate-300 hover:bg-white/5'
                          }`}
                        >
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          <span>Mark Present</span>
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleToggleAttendance(false)}
                          disabled={isLocked || localPresence === false}
                          className={`h-11 rounded-xl text-xs font-bold gap-2 cursor-pointer transition-all ${
                            localPresence === false
                              ? 'border-rose-500/60 bg-rose-500/20 text-rose-300 shadow-sm'
                              : 'border-white/10 text-slate-300 hover:bg-white/5'
                          }`}
                        >
                          <XCircle className="h-4 w-4 text-rose-400" />
                          <span>Mark Absent</span>
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Tier 2 Temporary Reassignment */}
                  {onAssignOverride && (
                    <div className="pt-3 border-t border-white/5 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-300 uppercase tracking-wider text-[10.5px]">
                          Temporary Reassign (Tier 2):
                        </span>
                        <span className="text-[10px] text-slate-500">Today only</span>
                      </div>

                      {destinationStations.length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic">
                          No other operational vacant stations available for reassignment.
                        </p>
                      ) : (
                        <div className="flex gap-2">
                          <select
                            value={selectedTargetWsId}
                            onChange={(e) => setSelectedTargetWsId(e.target.value)}
                            className="flex-1 h-9 px-3 rounded-xl bg-[#0B0F19] border border-white/10 text-white text-xs"
                          >
                            {destinationStations.map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.label} ({w.description || 'Empty & Operational'})
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
                <div className="rounded-xl border border-white/5 bg-[#151E32]/50 p-6 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                    <Monitor className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-heading font-semibold text-white text-sm">Station Available / Unassigned</h4>
                    <p className="mt-1 max-w-xs text-xs text-slate-400">
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
                          className="flex-1 h-9 px-3 rounded-xl bg-[#0B0F19] border border-white/10 text-white text-xs truncate"
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
                    No active faults or hardware defects reported for this workstation.
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
                    className="rounded-xl border border-white/[0.08] bg-[#151E32] p-4 shadow-sm space-y-3"
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
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : issue.severity === 'high'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-slate-700/50 text-slate-300'
                            }`}
                          >
                            {issue.severity}
                          </span>
                          <span className="rounded-md bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium text-slate-400 capitalize">
                            Status: {issue.status.replace('_', ' ')}
                          </span>
                        </div>
                        <h4 className="font-heading font-semibold text-sm text-white pt-1">
                          {issue.title}
                        </h4>
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
                          <div className="space-y-3 rounded-lg border border-indigo-500/30 bg-[#0E1524] p-3 text-xs">
                            <h5 className="font-semibold text-indigo-300 flex items-center gap-1.5">
                              <Sparkles className="h-3.5 w-3.5" />
                              <span>Certify Corrective Maintenance Fix</span>
                            </h5>
                            <div>
                              <label className="block text-[11px] text-slate-400 mb-1">
                                Technical Action Taken &bull; Resolution Notes:
                              </label>
                              <textarea
                                value={resolutionNotes}
                                onChange={(e) => setResolutionNotes(e.target.value)}
                                rows={2}
                                className="w-full rounded-lg border border-white/10 bg-[#151E32] p-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                                placeholder="Describe corrective maintenance performed (e.g. replaced loose SATA cable)..."
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-slate-400 mb-1">
                                Parts Replaced (Optional):
                              </label>
                              <input
                                type="text"
                                value={partsReplaced}
                                onChange={(e) => setPartsReplaced(e.target.value)}
                                className="w-full h-8 rounded-lg border border-white/10 bg-[#151E32] px-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
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
          {/* TAB 3: REPORT PROBLEM                                          */}
          {/* ============================================================== */}
          {activeTab === 'report' && (
            <form onSubmit={handleSubmitReport} className="space-y-4 text-xs">
              {/* Presets */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Quick Issue Presets:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {titlePresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setIssueTitle(preset)}
                      className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                        issueTitle === preset
                          ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                          : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category Picker */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Hardware Fault Category:
                </label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => handleCategorySelect(e.target.value)}
                  className="w-full h-9 rounded-xl border border-white/10 bg-[#151E32] px-3 text-xs text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">-- General Diagnostic Fault --</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({cat.default_severity.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Issue Title <span className="text-rose-400">*</span>:
                </label>
                <input
                  type="text"
                  required
                  value={issueTitle}
                  onChange={(e) => setIssueTitle(e.target.value)}
                  placeholder="e.g. Screen flickering, loose power supply..."
                  className="w-full h-9 rounded-xl border border-white/10 bg-[#151E32] px-3 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Severity Selection */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
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
                            ? 'border-rose-500 bg-rose-500/20 text-rose-300'
                            : sev === 'high'
                            ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                            : 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                          : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-white'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Detailed Diagnostic Observations:
                </label>
                <textarea
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  rows={3}
                  placeholder="Provide any symptoms observed, student remarks, error messages..."
                  className="w-full rounded-xl border border-white/10 bg-[#151E32] p-3 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none leading-relaxed"
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
                  disabled={submitting}
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
                      <span>Submit Problem Report</span>
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
