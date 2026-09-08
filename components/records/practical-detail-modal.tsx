'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  Calendar,
  Clock,
  Building2,
  Users,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Edit3,
  Trash2,
  Lock,
  RotateCcw,
  Save,
  Check,
  Tag,
  GraduationCap,
} from 'lucide-react'
import { PracticalRecordItem } from '@/types/records'
import { updatePracticalLog, deletePracticalLog } from '@/app/actions/logs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface PracticalDetailModalProps {
  record: PracticalRecordItem | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  userRole?: string
  userName?: string
  userScope?: any
  canModify: boolean
  canDelete: boolean
}

export default function PracticalDetailModal({
  record,
  isOpen,
  onClose,
  onSuccess,
  userRole = 'teacher',
  userName = '',
  userScope = null,
  canModify,
  canDelete,
}: PracticalDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Edit form state
  const [practicalTitle, setPracticalTitle] = useState('')
  const [topicLearned, setTopicLearned] = useState('')
  const [status, setStatus] = useState<'conducted' | 'skipped'>('conducted')
  const [skipReason, setSkipReason] = useState('')
  const [totalStudents, setTotalStudents] = useState<number>(36)
  const [presentStudents, setPresentStudents] = useState<number>(34)
  const [absentRollsInput, setAbsentRollsInput] = useState('')
  const [remarks, setRemarks] = useState('')

  // Sync state when record changes
  useEffect(() => {
    if (record) {
      setPracticalTitle(record.practical_title || '')
      setTopicLearned(record.topic_learned || '')
      setStatus((record.status === 'skipped' ? 'skipped' : 'conducted'))
      setSkipReason(record.skip_reason || '')
      setTotalStudents(record.total_students || 36)
      setPresentStudents(record.present_students || 0)
      setAbsentRollsInput(Array.isArray(record.absent_rolls) ? record.absent_rolls.join(', ') : '')
      setRemarks(record.remarks || '')
      setIsEditing(false)
      setShowDeleteConfirm(false)
      setErrorMsg(null)
    }
  }, [record, isOpen])

  if (!isOpen || !record) return null

  const isSkipped = record.status === 'skipped'
  const absentCount = Math.max(0, totalStudents - presentStudents)
  const turnoutPct = totalStudents > 0 ? Math.round((presentStudents / totalStudents) * 100) : 0

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrorMsg(null)

    try {
      const parsedRolls = absentRollsInput
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0)

      const updatePayload = {
        practical_title: practicalTitle.trim() || record.practical_title,
        topic_learned: topicLearned.trim() || null,
        status,
        skip_reason: status === 'skipped' ? skipReason.trim() || 'Session skipped' : null,
        total_students: totalStudents,
        present_students: status === 'skipped' ? 0 : Math.min(presentStudents, totalStudents),
        absent_students: status === 'skipped' ? totalStudents : absentCount,
        absent_rolls: parsedRolls,
        remarks: remarks.trim() || null,
      }

      const res = await updatePracticalLog(record.id, updatePayload)
      if (res.success) {
        setIsEditing(false)
        onSuccess()
        onClose()
      } else {
        setErrorMsg(res.error || 'Failed to update practical log')
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error updating practical log')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    setErrorMsg(null)
    try {
      const res = await deletePracticalLog(record.id)
      if (res.success) {
        onSuccess()
        onClose()
      } else {
        setErrorMsg(res.error || 'Failed to delete practical log')
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error deleting practical log')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-start justify-between bg-zinc-50/60 dark:bg-zinc-900/40 gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Practical Record #{record.id.slice(-6)}
              </span>
              {isSkipped ? (
                <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] font-mono uppercase font-bold">
                  Skipped
                </Badge>
              ) : (
                <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-mono uppercase font-bold">
                  Conducted
                </Badge>
              )}
              {canModify && !isEditing && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Editable
                </span>
              )}
              {!canModify && (
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700 flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Read-Only Archive
                </span>
              )}
            </div>

            <h2 className="text-base sm:text-lg font-bold text-zinc-950 dark:text-white truncate">
              {record.subject_name}
            </h2>

            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
              {record.date} • {record.period_label} • {record.labs?.name || 'Laboratory Room'}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {canModify && !isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="h-8 text-xs font-mono font-bold gap-1.5 border-indigo-200 dark:border-indigo-800/80 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 shadow-2xs"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Modify</span>
              </Button>
            )}

            {isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(false)}
                className="h-8 text-xs font-mono text-zinc-600 dark:text-zinc-400"
              >
                Cancel
              </Button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Error Feedback */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border-b border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-mono flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 font-sans">
          {!isEditing ? (
            /* ================================================================= */
            /* READ-ONLY AUDIT VIEW */
            /* ================================================================= */
            <div className="space-y-4">
              {/* Practical Title & Topic */}
              <div className="p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 space-y-2">
                <div className="text-[11px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
                  Practical Syllabus & Experiment Focus
                </div>
                <div className="text-sm font-bold text-zinc-900 dark:text-white">
                  {record.practical_title || 'Practical Laboratory Exercise'}
                </div>
                {record.topic_learned && (
                  <div className="text-xs text-zinc-600 dark:text-zinc-300 flex items-start gap-1.5 pt-1">
                    <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-bold shrink-0">
                      Topic
                    </span>
                    <span>{record.topic_learned}</span>
                  </div>
                )}
              </div>

              {/* Class & Faculty Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                  <span className="text-[10px] font-mono uppercase text-zinc-400 block">Class / Batch</span>
                  <strong className="text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100">
                    {record.batch_group}
                  </strong>
                </div>

                <div className="p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                  <span className="text-[10px] font-mono uppercase text-zinc-400 block">Subject Teacher</span>
                  <strong className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    {record.profiles?.full_name || 'Assigned Faculty'}
                  </strong>
                </div>

                <div className="p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                  <span className="text-[10px] font-mono uppercase text-zinc-400 block">Laboratory Facility</span>
                  <strong className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    {record.labs?.name || 'Lab Room'}
                  </strong>
                </div>
              </div>

              {/* Attendance Registry */}
              <div className="p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    Attendance Registry
                  </span>
                  {!isSkipped && (
                    <Badge
                      className={`text-[10px] font-mono font-bold ${
                        record.attendance_pct >= 80
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {record.attendance_pct.toFixed(1)}% Attendance
                    </Badge>
                  )}
                </div>

                {!isSkipped ? (
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800">
                      <span className="text-[10px] font-mono uppercase text-zinc-400 block">Enrolled</span>
                      <span className="text-lg font-mono font-extrabold text-zinc-900 dark:text-white">
                        {record.total_students}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/60">
                      <span className="text-[10px] font-mono uppercase text-emerald-700 dark:text-emerald-300 block">Present</span>
                      <span className="text-lg font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                        {record.present_students}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-800/60">
                      <span className="text-[10px] font-mono uppercase text-rose-700 dark:text-rose-300 block">Absent</span>
                      <span className="text-lg font-mono font-extrabold text-rose-600 dark:text-rose-400">
                        {record.absent_students}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-200">
                    <span className="font-bold">Reason for Skip / Postponement:</span>{' '}
                    <span>{record.skip_reason || 'Class conducted as theoretical session'}</span>
                  </div>
                )}

                {/* Absent Roll Numbers Tags */}
                {Array.isArray(record.absent_rolls) && record.absent_rolls.length > 0 && (
                  <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-mono uppercase text-zinc-400 mr-1">Absent Rolls:</span>
                    {record.absent_rolls.map((roll: number | string) => (
                      <span
                        key={roll}
                        className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800"
                      >
                        Roll {roll}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Remarks */}
              {record.remarks && (
                <div className="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs">
                  <span className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                    Verification Remarks / Operational Notes
                  </span>
                  <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed font-mono">
                    {record.remarks}
                  </p>
                </div>
              )}

              {/* Delete confirmation button if authorized */}
              {canDelete && (
                <div className="pt-2 flex justify-end">
                  {!showDeleteConfirm ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="text-xs font-mono text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 gap-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete Record</span>
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-xs font-mono">
                      <span className="text-rose-700 dark:text-rose-300 font-bold">Confirm delete?</span>
                      <Button
                        size="sm"
                        disabled={isDeleting}
                        onClick={handleDelete}
                        className="h-7 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold"
                      >
                        {isDeleting ? 'Deleting...' : 'Yes, Delete'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="h-7 text-xs"
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* ================================================================= */
            /* EDIT / MODIFY FORM */
            /* ================================================================= */
            <form onSubmit={handleSave} className="space-y-4">
              <div className="p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/60 text-xs text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
                <Edit3 className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                <span>
                  Modifying verified record for <strong>{record.batch_group}</strong> • <strong>{record.date}</strong>
                </span>
              </div>

              {/* Title & Topic */}
              <div className="space-y-1 font-mono">
                <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  Practical Syllabus Title *
                </label>
                <Input
                  type="text"
                  required
                  value={practicalTitle}
                  onChange={(e) => setPracticalTitle(e.target.value)}
                  className="text-xs"
                  placeholder="e.g. Implementation of Binary Search Trees"
                />
              </div>

              <div className="space-y-1 font-mono">
                <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  Specific Topic Learned / Practical Focus
                </label>
                <Input
                  type="text"
                  value={topicLearned}
                  onChange={(e) => setTopicLearned(e.target.value)}
                  className="text-xs"
                  placeholder="e.g. Node insertion, traversal, complexity analysis"
                />
              </div>

              {/* Status Selector */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 font-mono">
                  <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    Conducted Status *
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="flex h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-xs font-mono font-medium focus:outline-none"
                  >
                    <option value="conducted">Conducted (Practical executed in Lab)</option>
                    <option value="skipped">Skipped (Theory class / Postponed)</option>
                  </select>
                </div>

                {status === 'skipped' && (
                  <div className="space-y-1 font-mono">
                    <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                      Reason for Skip *
                    </label>
                    <Input
                      type="text"
                      required
                      value={skipReason}
                      onChange={(e) => setSkipReason(e.target.value)}
                      className="text-xs"
                      placeholder="e.g. Theory class conducted in classroom"
                    />
                  </div>
                )}
              </div>

              {/* Attendance Fields (only if conducted) */}
              {status === 'conducted' && (
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                      Student Attendance Tally
                    </span>
                    <Badge className="text-xs font-mono">
                      {presentStudents} Present ({turnoutPct}%)
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-3 font-mono">
                    <div className="space-y-1">
                      <label className="text-[11px] text-zinc-500">Total Enrolled</label>
                      <Input
                        type="number"
                        min="1"
                        value={totalStudents}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value, 10) || 1)
                          setTotalStudents(val)
                          if (presentStudents > val) setPresentStudents(val)
                        }}
                        className="text-xs font-bold"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-zinc-500">Present Count</label>
                      <Input
                        type="number"
                        min="0"
                        max={totalStudents}
                        value={presentStudents}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value, 10) || 0)
                          setPresentStudents(Math.min(val, totalStudents))
                        }}
                        className="text-xs font-bold border-emerald-400 dark:border-emerald-600"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-zinc-500">Absent Count</label>
                      <div className="flex h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-xs items-center justify-center font-bold font-mono text-rose-600 dark:text-rose-400">
                        {absentCount}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 font-mono">
                    <label className="text-[11px] text-zinc-500">
                      Absent Roll Numbers (Comma-separated, optional)
                    </label>
                    <Input
                      type="text"
                      value={absentRollsInput}
                      onChange={(e) => setAbsentRollsInput(e.target.value)}
                      placeholder="e.g. 4, 12, 19"
                      className="text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Remarks */}
              <div className="space-y-1 font-mono">
                <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  Verification Remarks / Notes
                </label>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Additional observations, apparatus state..."
                  className="flex w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none"
                />
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                  className="text-xs font-mono"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="text-xs font-mono font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-xs"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{isSubmitting ? 'Saving...' : 'Save Modifications'}</span>
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
