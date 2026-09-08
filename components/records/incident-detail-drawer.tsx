'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  AlertTriangle,
  Clock,
  ShieldAlert,
  CheckCircle2,
  Building2,
  Calendar,
  UserCheck,
  FileText,
  Wrench,
  RotateCcw,
  Sparkles,
  Lock,
} from 'lucide-react'
import { IncidentRecordItem } from '@/types/records'
import { updateIncidentWorkflow } from '@/app/actions/records'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface IncidentDetailDrawerProps {
  incident: IncidentRecordItem | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  userRole: string
  userName?: string
}

export default function IncidentDetailDrawer({
  incident,
  isOpen,
  onClose,
  onSuccess,
  userRole,
  userName,
}: IncidentDetailDrawerProps) {
  const [mounted, setMounted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [escalationReason, setEscalationReason] = useState('')
  const [showEscalateInput, setShowEscalateInput] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (incident) {
      setResolutionNotes(incident.resolution_notes || '')
      setEscalationReason(incident.escalation_reason || '')
      setShowEscalateInput(false)
      setErrorMessage(null)
    }
  }, [incident])

  if (!isOpen || !incident || !mounted) return null

  const isPrivileged = ['super_admin', 'lab_incharge', 'hod', 'admin'].includes(userRole)
  const isCritical = incident.severity === 'major_critical'
  const isModerate = incident.severity === 'moderate'
  const isResolved = incident.status === 'resolved'
  const isEscalated = incident.escalated_to_hod

  const handleStatusUpdate = async (newStatus: 'under_repair' | 'replaced' | 'resolved') => {
    if (!isPrivileged) return
    setErrorMessage(null)

    if (newStatus === 'resolved' && (!resolutionNotes || resolutionNotes.trim().length < 5)) {
      setErrorMessage('A detailed resolution note (at least 5 characters) is required to certify an incident as resolved.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await updateIncidentWorkflow(incident.id, {
        status: newStatus,
        resolution_notes: resolutionNotes.trim() || undefined,
      })

      if (res.success) {
        onSuccess()
        onClose()
      } else {
        setErrorMessage(res.error || 'Failed to update status')
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'Action failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEscalateToHOD = async () => {
    if (!isPrivileged) return
    if (!escalationReason.trim()) {
      setErrorMessage('Please state the justification for escalating this case to the Head of Department.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await updateIncidentWorkflow(incident.id, {
        status: 'escalated_to_hod',
        is_escalating: true,
        escalation_reason: escalationReason.trim(),
      })

      if (res.success) {
        onSuccess()
        onClose()
      } else {
        setErrorMessage(res.error || 'Failed to escalate to HOD')
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'Escalation failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200 select-none overflow-y-auto font-sans">
      <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh] my-auto">
        {/* Drawer Header */}
        <div
          className={`p-5 px-6 border-b flex items-center justify-between ${
            isCritical
              ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60'
              : isModerate
              ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60'
              : 'bg-zinc-50 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-xl text-white shadow-xs ${
                isCritical
                  ? 'bg-rose-500 shadow-rose-500/30'
                  : isModerate
                  ? 'bg-amber-500 shadow-amber-500/30'
                  : 'bg-indigo-500 shadow-indigo-500/30'
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Case #{incident.id}
                </span>
                <Badge
                  className={`text-[10px] uppercase font-mono font-bold ${
                    isCritical
                      ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30'
                      : isModerate
                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30'
                      : 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-500/30'
                  }`}
                >
                  {incident.severity.replace('_', ' ')}
                </Badge>
              </div>
              <h2 className="text-base font-bold text-zinc-950 dark:text-white mt-0.5">
                {incident.title}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 flex items-center gap-2 font-mono text-[11px]">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. AUTHENTIC 3-TIMESTAMP AUDIT TIMELINE */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 space-y-3">
            <span className="text-[11px] font-mono uppercase font-bold text-zinc-400 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-indigo-500" />
              Lifecycle Audit Timeline
            </span>

            <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-200 dark:before:bg-zinc-800">
              {/* Event 1: Reported */}
              <div className="relative">
                <div className="absolute -left-[23px] top-1 h-3 w-3 rounded-full bg-indigo-500 border-2 border-white dark:border-zinc-900" />
                <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span>Incident Reported</span>
                  <span className="text-[10px] font-mono text-zinc-400 font-normal">
                    {incident.created_at ? new Date(incident.created_at).toLocaleString() : 'Date recorded'}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Logged by <strong>{incident.reporter_profile?.full_name || incident.reported_by}</strong> ({incident.batch_name} • {incident.session_label})
                </p>
              </div>

              {/* Event 2: Escalated (if active) */}
              {isEscalated && (
                <div className="relative">
                  <div className="absolute -left-[23px] top-1 h-3 w-3 rounded-full bg-rose-500 border-2 border-white dark:border-zinc-900" />
                  <div className="font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2">
                    <span>Escalated to Head of Department (HOD)</span>
                    <span className="text-[10px] font-mono text-zinc-400 font-normal">
                      {incident.escalated_at ? new Date(incident.escalated_at).toLocaleString() : 'Date recorded'}
                    </span>
                  </div>
                  <p className="text-[11px] text-rose-600 dark:text-rose-300 mt-0.5">
                    Reason: <em>"{incident.escalation_reason || 'Administrative intervention requested'}"</em>
                  </p>
                </div>
              )}

              {/* Event 3: Current Status (if under repair or replaced) */}
              {(incident.status === 'under_repair' || incident.status === 'replaced') && (
                <div className="relative">
                  <div className="absolute -left-[23px] top-1 h-3 w-3 rounded-full bg-sky-500 border-2 border-white dark:border-zinc-900" />
                  <div className="font-bold text-sky-700 dark:text-sky-400 flex items-center gap-2">
                    <span>Status: {incident.status === 'under_repair' ? 'Under Repair' : 'Replaced'}</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Apparatus triage in progress by laboratory technical team.
                  </p>
                </div>
              )}

              {/* Event 4: Resolution (if resolved) */}
              {isResolved && (
                <div className="relative">
                  <div className="absolute -left-[23px] top-1 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-900" />
                  <div className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                    <span>Certified Resolved</span>
                    <span className="text-[10px] font-mono text-zinc-400 font-normal">
                      {incident.resolved_at ? new Date(incident.resolved_at).toLocaleString() : 'Date recorded'}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300 mt-0.5">
                    Verified by <strong>{incident.resolver_profile?.full_name || incident.resolved_by || 'Lab In-Charge'}</strong>
                  </p>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 italic mt-0.5">
                    "{incident.resolution_notes}"
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 2. SPECIFICATIONS GRID */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
              <span className="text-[10px] font-mono text-zinc-400 uppercase">Facility Room</span>
              <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase mt-0.5 flex items-center gap-1.5">
                <Building2 className="h-3 w-3 text-indigo-500" />
                <span>{incident.labs?.name || `${incident.lab_id.toUpperCase()} Lab`}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
              <span className="text-[10px] font-mono text-zinc-400 uppercase">Period / Date</span>
              <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 truncate flex items-center gap-1.5">
                <Calendar className="h-3 w-3 text-amber-500" />
                <span>{incident.session_label || incident.date}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
              <span className="text-[10px] font-mono text-zinc-400 uppercase">Apparatus & Qty</span>
              <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 truncate">
                {incident.equipment_name} (x{incident.quantity})
              </div>
            </div>

            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
              <span className="text-[10px] font-mono text-zinc-400 uppercase">Subject Teacher</span>
              <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 mt-0.5 truncate">
                <UserCheck className="h-3 w-3 text-emerald-500" />
                <span className="truncate">{incident.subject_teacher_name}</span>
              </div>
            </div>
          </div>

          {/* Student Roll Info */}
          {incident.student_rolls && (
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs">
              <span className="text-zinc-500 font-mono uppercase text-[10px]">Involved Student Roll(s):</span>
              <span className="font-mono font-bold text-zinc-900 dark:text-white bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded-md">
                {incident.student_rolls}
              </span>
            </div>
          )}

          {/* 3. WORKFLOW ACTIONS (RBAC RESTRICTED) */}
          {isPrivileged ? (
            <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 space-y-3">
              <span className="text-[11px] font-mono uppercase font-bold text-zinc-900 dark:text-zinc-200 flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5 text-emerald-500" />
                Action Taken & Resolution Certification
              </span>

              {/* Resolution Notes Input */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase text-zinc-400">
                  Resolution / Triage Audit Notes (Mandatory for Resolution)
                </label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Record actions taken, e.g. repaired apparatus, replaced from buffer store, or sent for vendor calibration..."
                  className="w-full h-20 p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-sans text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Status Update Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={() => handleStatusUpdate('under_repair')}
                  disabled={isSubmitting}
                  variant="outline"
                  className="h-8 px-3 rounded-xl border-sky-500/30 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/40 text-xs font-mono font-bold"
                >
                  Mark Under Repair
                </Button>

                <Button
                  size="sm"
                  onClick={() => handleStatusUpdate('replaced')}
                  disabled={isSubmitting}
                  variant="outline"
                  className="h-8 px-3 rounded-xl border-indigo-500/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs font-mono font-bold"
                >
                  Mark Replaced
                </Button>

                <Button
                  size="sm"
                  onClick={() => handleStatusUpdate('resolved')}
                  disabled={isSubmitting}
                  className="h-8 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-mono font-bold shadow-xs ml-auto"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Certify Resolved
                </Button>
              </div>

              {/* Escalation to HOD Section */}
              {!isEscalated && (
                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
                  {!showEscalateInput ? (
                    <button
                      type="button"
                      onClick={() => setShowEscalateInput(true)}
                      className="text-[11px] font-mono text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
                    >
                      <ShieldAlert className="h-3 w-3" />
                      <span>Require institutional intervention? Escalate to HOD</span>
                    </button>
                  ) : (
                    <div className="space-y-2 pt-1 bg-rose-50/50 dark:bg-rose-950/20 p-3 rounded-xl border border-rose-200 dark:border-rose-900/50">
                      <label className="text-[10px] font-mono uppercase text-rose-700 dark:text-rose-300 font-bold">
                        Justification for HOD Escalation
                      </label>
                      <Input
                        value={escalationReason}
                        onChange={(e) => setEscalationReason(e.target.value)}
                        placeholder="e.g. Severe power surge damage; safety risk requires department head directive..."
                        className="bg-white dark:bg-zinc-900 text-xs h-8"
                      />
                      <div className="flex justify-end gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setShowEscalateInput(false)}
                          className="h-7 text-xs"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleEscalateToHOD}
                          disabled={isSubmitting}
                          className="h-7 px-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-mono font-bold"
                        >
                          Confirm HOD Escalation
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Teacher Role Notice: View only */
            <div className="p-3.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 flex items-center gap-2.5 text-zinc-600 dark:text-zinc-400">
              <Lock className="h-4 w-4 shrink-0 text-zinc-500" />
              <p className="text-[11px]">
                Read-only: Teachers can review reported incidents. Only Lab In-Charge, HOD, and Super Admin can certify resolutions or escalate to the department head.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
