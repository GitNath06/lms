'use client'

import React, { useState } from 'react'
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Users,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface DisplacedStudent {
  studentName: string
  rollNumber: number
  studentId: string
  enrollmentId: string
  originalWsId?: string
  originalWsLabel?: string
  issueTitle: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  type?: 'faulted' | 'unassigned'
}

interface DisplacedStudentsQueueProps {
  displacedStudents: DisplacedStudent[]
  availableWorkstations: Array<{ id: string; label: string; description?: string }>
  onAssignReplacement: (
    targetWsId: string,
    enrollmentId: string,
    reason: string
  ) => Promise<void>
  onDismiss?: () => void
}

export function DisplacedStudentsQueue({
  displacedStudents,
  availableWorkstations,
  onAssignReplacement,
  onDismiss,
}: DisplacedStudentsQueueProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [selectedTargets, setSelectedTargets] = useState<Record<string, string>>({})
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ id: string; text: string } | null>(null)
  const [isDismissed, setIsDismissed] = useState(false)

  if (displacedStudents.length === 0 || isDismissed) return null

  const safeIndex = selectedIndex >= displacedStudents.length ? 0 : selectedIndex
  const currentStudent = displacedStudents[safeIndex]

  const handleAssign = async (student: DisplacedStudent) => {
    const validTarget = selectedTargets[student.enrollmentId]
    const targetWsId =
      validTarget && availableWorkstations.some((w) => w.id === validTarget)
        ? validTarget
        : availableWorkstations[0]?.id

    if (!targetWsId) {
      alert('No operational workstations available for relocation.')
      return
    }

    setAssigningId(student.enrollmentId)
    try {
      const isUnassigned = student.type === 'unassigned'
      const reason = isUnassigned
        ? 'Initial seat allocation'
        : `Temporary replacement: ${student.originalWsLabel || 'Station'} unavailable (${student.issueTitle})`

      await onAssignReplacement(targetWsId, student.enrollmentId, reason)
      const targetLabel = availableWorkstations.find((w) => w.id === targetWsId)?.label || targetWsId
      setFeedback({
        id: student.enrollmentId,
        text: `Assigned to ${targetLabel}!`,
      })
      setTimeout(() => {
        setFeedback(null)
      }, 2500)
    } catch (err: any) {
      alert(err.message || 'Failed to assign replacement seat.')
    } finally {
      setAssigningId(null)
    }
  }

  const isAssigning = assigningId === currentStudent.enrollmentId
  const validSelectedTarget = selectedTargets[currentStudent.enrollmentId]
  const currentTarget =
    validSelectedTarget && availableWorkstations.some((w) => w.id === validSelectedTarget)
      ? validSelectedTarget
      : availableWorkstations[0]?.id || ''
  const currentFeedback = feedback?.id === currentStudent.enrollmentId ? feedback.text : null

  return (
    <div className="h-8 px-3 rounded-lg bg-[#101726]/95 border border-white/10 dark:border-white/15 shadow-xs flex items-center justify-between gap-2.5 text-xs animate-in fade-in duration-150 overflow-hidden">
      {/* Left: Triage Category & Student Selector */}
      <div className="flex items-center gap-2 min-w-0">
        {displacedStudents.length > 1 ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="flex h-5 items-center gap-1 px-1.5 rounded bg-amber-500/10 border border-amber-500/25 text-amber-400 text-[10px] font-mono font-bold">
              <AlertTriangle className="h-2.5 w-2.5" />
              <span>Triage ({displacedStudents.length})</span>
            </span>

            {displacedStudents.length <= 4 ? (
              <div className="flex items-center gap-1">
                {displacedStudents.map((ds, idx) => {
                  const isActive = idx === safeIndex
                  return (
                    <button
                      key={ds.enrollmentId}
                      type="button"
                      onClick={() => setSelectedIndex(idx)}
                      className={`h-5 px-1.5 text-[10px] font-mono font-semibold rounded transition-colors cursor-pointer shrink-0 ${
                        isActive
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      R-{ds.rollNumber} {ds.type === 'unassigned' ? '· Unseated' : `· ${ds.originalWsLabel}`}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedIndex((prev) => (prev > 0 ? prev - 1 : displacedStudents.length - 1))}
                  className="h-5 w-5 flex items-center justify-center rounded bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Previous student"
                >
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <select
                  value={safeIndex}
                  onChange={(e) => setSelectedIndex(Number(e.target.value))}
                  className="h-5 text-[10px] font-mono bg-white/5 border border-white/10 text-slate-200 rounded px-1.5 focus:outline-hidden cursor-pointer max-w-[190px] truncate"
                >
                  {displacedStudents.map((ds, idx) => (
                    <option key={ds.enrollmentId} value={idx} className="bg-[#101726] text-white">
                      {idx + 1}/{displacedStudents.length}: Roll {ds.rollNumber} ({ds.type === 'unassigned' ? 'Unseated' : ds.originalWsLabel})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setSelectedIndex((prev) => (prev < displacedStudents.length - 1 ? prev + 1 : 0))}
                  className="h-5 w-5 flex items-center justify-center rounded bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Next student"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <span
            className={`flex h-5 items-center gap-1 px-1.5 rounded text-[10px] font-mono font-bold shrink-0 ${
              currentStudent.type === 'unassigned'
                ? 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-300'
                : 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
            }`}
          >
            {currentStudent.type === 'unassigned' ? (
              <>
                <Users className="h-2.5 w-2.5 text-indigo-400" />
                <span>Unseated</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-2.5 w-2.5 text-amber-400" />
                <span>Station Offline</span>
              </>
            )}
          </span>
        )}

        {/* Current Student Details */}
        <div className="flex items-center gap-1.5 min-w-0 text-xs">
          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300 shrink-0">
            Roll {currentStudent.rollNumber}
          </span>
          <span className="font-heading font-semibold text-xs text-white truncate max-w-[120px] sm:max-w-[160px]">
            {currentStudent.studentName}
          </span>
          <span className="text-zinc-600 text-[10px] hidden sm:inline">&bull;</span>
          <span className="text-[11px] text-slate-400 truncate max-w-[180px] hidden lg:inline">
            {currentStudent.type === 'unassigned' ? (
              <span className="text-amber-400/90 font-medium">Needs workstation allocation</span>
            ) : (
              <>
                <span className="text-rose-400 font-mono font-semibold">{currentStudent.originalWsLabel}: </span>
                <span className="italic text-slate-400">{currentStudent.issueTitle}</span>
              </>
            )}
          </span>
        </div>
      </div>

      {/* Right Action: Target Station Dropdown & Action Button */}
      <div className="flex items-center gap-1.5 shrink-0 ml-auto">
        {availableWorkstations.length > 0 ? (
          <>
            <select
              value={currentTarget}
              onChange={(e) =>
                setSelectedTargets((prev) => ({
                  ...prev,
                  [currentStudent.enrollmentId]: e.target.value,
                }))
              }
              className="h-6 text-[11px] font-mono bg-[#0B0F19] border border-white/15 text-slate-200 rounded-md px-2 focus:outline-hidden focus:border-indigo-400 cursor-pointer max-w-[170px] sm:max-w-[210px] truncate"
            >
              {availableWorkstations.map((ws) => (
                <option key={ws.id} value={ws.id} className="bg-[#101726] text-white">
                  {ws.label} {ws.description ? `· ${ws.description}` : '· Available'}
                </option>
              ))}
            </select>

            <Button
              type="button"
              size="sm"
              disabled={isAssigning || !currentTarget}
              onClick={() => handleAssign(currentStudent)}
              className="h-6 px-2.5 text-[11px] font-bold rounded-md bg-indigo-600 hover:bg-indigo-500 text-white shrink-0 shadow-2xs gap-1 cursor-pointer flex items-center"
            >
              {isAssigning ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Assigning...</span>
                </>
              ) : currentFeedback ? (
                <>
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                  <span>{currentFeedback}</span>
                </>
              ) : (
                <>
                  <ArrowRightLeft className="h-3 w-3" />
                  <span>{currentStudent.type === 'unassigned' ? 'Assign Station' : 'Relocate'}</span>
                </>
              )}
            </Button>
          </>
        ) : (
          <span className="text-[10px] text-rose-400 italic">No free stations</span>
        )}

        <button
          type="button"
          onClick={() => {
            setIsDismissed(true)
            onDismiss?.()
          }}
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer ml-0.5"
          title="Dismiss triage strip"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}
