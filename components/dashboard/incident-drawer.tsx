'use client'

import React, { useState } from 'react'
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Wrench,
  RotateCcw,
  Send,
  X,
  UserCheck,
  Building2,
  Calendar,
  FileText,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import { LabIncidentRecord, useIncidentState } from '@/hooks/use-incident-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface IncidentDrawerProps {
  incident: LabIncidentRecord | null
  isOpen: boolean
  onClose: () => void
  userRole?: 'super_admin' | 'lab_incharge' | 'hod' | 'faculty'
}

export default function IncidentDrawer({
  incident,
  isOpen,
  onClose,
  userRole = 'lab_incharge',
}: IncidentDrawerProps) {
  const { resolveIncident, escalateToHOD } = useIncidentState()

  const [isEscalating, setIsEscalating] = useState(false)
  const [escalationReason, setEscalationReason] = useState('')
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen || !incident) return null

  const isCritical = incident.severity === 'major_critical'
  const isModerate = incident.severity === 'moderate'
  const isEscalated = incident.status === 'escalated_to_hod' || incident.escalated_to_hod
  const isResolved = incident.status === 'resolved'

  const canManage = userRole === 'super_admin' || userRole === 'lab_incharge' || userRole === 'hod'

  const handleStatusChange = async (newStatus: 'under_repair' | 'replaced' | 'resolved') => {
    if (!canManage) return
    setIsSubmitting(true)
    try {
      const resolverTitle =
        userRole === 'hod'
          ? 'Head of Department'
          : userRole === 'super_admin'
          ? 'Super Admin'
          : 'Lab In-Charge'

      await resolveIncident(incident.id, {
        status: newStatus,
        resolution_notes: resolutionNotes || `Marked as ${newStatus.replace('_', ' ')} by ${resolverTitle}`,
        resolved_by: resolverTitle,
      })
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEscalate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!escalationReason.trim() || !canManage) return
    setIsSubmitting(true)
    try {
      await escalateToHOD(incident.id, escalationReason.trim())
      setIsEscalating(false)
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150 select-none">
      <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
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
              className={`p-2 rounded-xl ${
                isCritical
                  ? 'bg-rose-500 text-white shadow-rose-500/30'
                  : isModerate
                  ? 'bg-amber-500 text-white shadow-amber-500/30'
                  : 'bg-indigo-500 text-white shadow-indigo-500/30'
              } shadow-sm`}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Case #{incident.id}
                </span>
                <Badge
                  className={`text-[10px] uppercase font-mono ${
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
        <div className="p-6 overflow-y-auto space-y-4 font-mono text-xs">
          {/* Status Progression Banner */}
          <div className="p-3 px-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-zinc-400" />
              <span className="text-zinc-600 dark:text-zinc-400">Current Status:</span>
              <span
                className={`font-bold uppercase px-2 py-0.5 rounded-md ${
                  isResolved
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                    : isEscalated
                    ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20'
                    : incident.status === 'under_repair'
                    ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20'
                    : incident.status === 'replaced'
                    ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20'
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                }`}
              >
                {incident.status.replace('_', ' ')}
              </span>
            </div>

            {incident.resolved_by && (
              <span className="text-[11px] text-zinc-400">
                Actioned by: <strong>{incident.resolved_by}</strong>
              </span>
            )}
          </div>

          {/* HOD Escalation Alert Notice if active */}
          {isEscalated && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-200 space-y-1">
              <div className="flex items-center gap-2 font-bold text-xs">
                <ShieldAlert className="h-4 w-4 text-rose-500" />
                <span>Escalated to Head of Department (HOD)</span>
              </div>
              <p className="text-[11px] font-sans text-zinc-700 dark:text-zinc-300 pl-6">
                <strong>Justification:</strong> {incident.escalation_reason || 'Requires institutional inspection and HOD review.'}
              </p>
            </div>
          )}

          {/* 4 Metadata Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200/50 dark:border-zinc-800">
              <span className="text-[10px] font-mono text-zinc-400 uppercase">Facility Room</span>
              <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase mt-0.5 flex items-center gap-1.5">
                <Building2 className="h-3 w-3 text-indigo-500" />
                <span>{incident.lab_id} Lab</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200/50 dark:border-zinc-800">
              <span className="text-[10px] font-mono text-zinc-400 uppercase">Period / Date</span>
              <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 truncate flex items-center gap-1.5">
                <Calendar className="h-3 w-3 text-amber-500" />
                <span>{incident.session_label || incident.date}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200/50 dark:border-zinc-800">
              <span className="text-[10px] font-mono text-zinc-400 uppercase">Class Batch</span>
              <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate mt-0.5">
                {incident.batch_name} ({incident.subject_name.split(' - ')[0]})
              </div>
            </div>

            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200/50 dark:border-zinc-800">
              <span className="text-[10px] font-mono text-zinc-400 uppercase">Supervising Faculty</span>
              <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 mt-0.5 truncate">
                <UserCheck className="h-3 w-3 text-emerald-500" />
                <span className="truncate">{incident.subject_teacher_name}</span>
              </div>
            </div>
          </div>

          {/* Detailed Incident Circumstances (What Happened) */}
          <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-indigo-500" />
                Incident Circumstances & Description
              </span>
              <span className="text-[10px] text-zinc-400 uppercase">
                Reported by {incident.reported_by}
              </span>
            </div>
            <p className="text-xs font-sans text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
              {incident.resolution_notes || incident.title}
            </p>
            {incident.student_rolls && (
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center gap-2 text-[11px]">
                <span className="text-zinc-400 font-bold uppercase">Involved Student Roll(s):</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                  {incident.student_rolls}
                </span>
              </div>
            )}
          </div>

          {/* Non-authorized Standard User notice */}
          {!canManage && (
            <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 text-[11px] flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-zinc-400" />
              <span>Standard User View: Report logged to Lab In-Charge, Super Admin & HOD. Status updates are managed by authorized lab authorities.</span>
            </div>
          )}

          {/* Operational Resolution Input (For Authorized In-Charge / Admin / HOD) */}
          {canManage && !isResolved && (
            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-mono font-bold text-zinc-600 dark:text-zinc-400 uppercase flex items-center justify-between">
                <span>Technical Action / Resolution Notes</span>
                <span className="text-[10px] text-zinc-400 font-normal">Optional technical or store notes</span>
              </label>
              <Input
                type="text"
                placeholder="e.g. Sent to physics workshop for recalibration / Replaced from store buffer inventory"
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                className="text-xs bg-white dark:bg-zinc-800/40"
              />
            </div>
          )}

          {/* Escalation Input Dialog */}
          {canManage && isEscalating && (
            <form
              onSubmit={handleEscalate}
              className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 space-y-3"
            >
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-zinc-950 dark:text-white uppercase">
                <Send className="h-3.5 w-3.5 text-rose-500" />
                <span>Specify Reason for Forwarding to HOD</span>
              </div>
              <Input
                type="text"
                required
                placeholder="Describe why Head of Department direct attention/decision is required..."
                value={escalationReason}
                onChange={(e) => setEscalationReason(e.target.value)}
                className="text-xs bg-white dark:bg-zinc-900"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEscalating(false)}
                  className="h-8 text-xs font-mono"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="h-8 text-xs font-mono bg-rose-600 hover:bg-rose-700 text-white font-bold"
                >
                  Forward to HOD
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 px-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 flex flex-wrap items-center justify-between gap-3">
          <div>
            {canManage && !isResolved && !isEscalating && !isEscalated && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEscalating(true)}
                className="h-8 text-xs font-mono text-rose-600 hover:text-rose-700 border-rose-200 dark:border-rose-900/60 gap-1.5 font-bold"
              >
                <Send className="h-3 w-3" />
                <span>Forward to HOD</span>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {canManage && !isResolved ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={() => handleStatusChange('under_repair')}
                  className="h-8 text-xs font-mono gap-1.5"
                >
                  <Wrench className="h-3 w-3 text-sky-500" />
                  <span>Mark Under Repair</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={() => handleStatusChange('replaced')}
                  className="h-8 text-xs font-mono gap-1.5"
                >
                  <RotateCcw className="h-3 w-3 text-indigo-500" />
                  <span>Mark Replaced</span>
                </Button>

                <Button
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() => handleStatusChange('resolved')}
                  className="h-8 text-xs font-mono bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-bold shadow-xs"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Close as Resolved</span>
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={onClose}
                className="h-8 text-xs font-mono"
              >
                Close View
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
