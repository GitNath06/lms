'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  Play,
  Calendar,
  Clock,
  Building2,
  BookOpen,
  GraduationCap,
  Sparkles,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { NepaliDatePicker } from '@/components/ui/nepali-date-picker'
import { createAdHocSession } from '@/app/actions/live-session'

interface StartAdHocSessionModalProps {
  isOpen: boolean
  onClose: () => void
  onSessionStarted: (scheduleId: string) => void
  labId?: string
  labName?: string
  classes: Array<{ id: string; name: string }>
  subjects: Array<{ id: string; code: string; name: string; classId?: string; classSubjectId?: string }>
  classSubjects: Array<{
    id: string
    classId: string
    subjectId: string
    className: string
    subjectName: string
    subjectCode: string
  }>
}

export function StartAdHocSessionModal({
  isOpen,
  onClose,
  onSessionStarted,
  labId = 'comp',
  labName = 'Computer Lab 01',
  classes,
  subjects,
  classSubjects,
}: StartAdHocSessionModalProps) {
  const [selectedClassId, setSelectedClassId] = useState<string>('')
  const [selectedClassSubjectId, setSelectedClassSubjectId] = useState<string>('')
  const [sessionDate, setSessionDate] = useState<string>('')
  const [startTime, setStartTime] = useState<string>('10:00')
  const [endTime, setEndTime] = useState<string>('11:00')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize date to today in YYYY-MM-DD
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    setSessionDate(today)

    // Set default class if available
    if (classes.length > 0 && !selectedClassId) {
      setSelectedClassId(classes[0].id)
    }
  }, [classes, selectedClassId])

  // Filter available subjects for selected class from classSubjects
  const availableAssignments = classSubjects.filter(
    (cs) => cs.classId === selectedClassId
  )

  useEffect(() => {
    if (availableAssignments.length > 0) {
      setSelectedClassSubjectId(availableAssignments[0].id)
    } else {
      setSelectedClassSubjectId('')
    }
  }, [selectedClassId, availableAssignments])

  if (!isOpen) return null

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!selectedClassSubjectId) {
      setError('Please select a valid subject assignment for this cohort.')
      return
    }

    setLoading(true)
    try {
      const res = await createAdHocSession({
        classSubjectId: selectedClassSubjectId,
        labId,
        startTime,
        endTime,
        date: sessionDate,
      })

      if (!res.success || !res.scheduleId) {
        setError(res.error || 'Failed to start unscheduled session.')
        setLoading(false)
        return
      }

      onSessionStarted(res.scheduleId)
      onClose()
    } catch (err: any) {
      setError(err.message || 'An error occurred while launching session.')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs font-sans">
      <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#101726] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] p-4.5 bg-[#151E32]/60">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Play className="h-4 w-4 fill-indigo-400" />
            </span>
            <div>
              <h3 className="font-heading font-extrabold text-base text-white">
                Start Unscheduled Session
              </h3>
              <p className="text-xs text-slate-400">
                Launch an ad-hoc practical lab or makeup period in {labName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleStartSession} className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Class Cohort */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <GraduationCap className="h-3.5 w-3.5 text-indigo-400" />
              <span>Academic Cohort / Class</span>
            </label>
            <Select
              required
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="h-10 text-xs font-medium bg-[#151E32] border-white/10 text-white rounded-xl"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Subject Assignment */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-indigo-400" />
              <span>Curriculum Subject</span>
            </label>
            {availableAssignments.length > 0 ? (
              <Select
                required
                value={selectedClassSubjectId}
                onChange={(e) => setSelectedClassSubjectId(e.target.value)}
                className="h-10 text-xs font-medium bg-[#151E32] border-white/10 text-white rounded-xl"
              >
                {availableAssignments.map((cs) => (
                  <option key={cs.id} value={cs.id}>
                    {cs.subjectCode} · {cs.subjectName}
                  </option>
                ))}
              </Select>
            ) : (
              <div className="rounded-xl border border-dashed border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                No active teaching assignments found for this class. Select another class.
              </div>
            )}
          </div>

          {/* Date & Time Slot */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-indigo-400" />
                <span>Session Date</span>
              </label>
              <NepaliDatePicker
                value={sessionDate}
                onChange={(d) => setSessionDate(d)}
                placeholder="सत्र मिति / Session Date"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-indigo-400" />
                <span>Start Time</span>
              </label>
              <Input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="h-10 text-xs bg-[#151E32] border-white/10 text-white rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-indigo-400" />
                <span>End Time</span>
              </label>
              <Input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="h-10 text-xs bg-[#151E32] border-white/10 text-white rounded-xl"
              />
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-[#151E32]/40 p-3 text-[11px] text-slate-400 flex items-start gap-2">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" />
            <span>
              This will instantly create an ad-hoc timetable slot and derive the expected student roster from the canonical database without text heuristics.
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/[0.08]">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="h-9 px-4 text-xs rounded-xl border-white/10 text-slate-300 hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !selectedClassSubjectId}
              className="h-9 px-4 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs gap-1.5"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Launching...</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-white" />
                  <span>Start Live Session</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
