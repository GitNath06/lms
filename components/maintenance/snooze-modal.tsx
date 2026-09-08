'use client'

import React, { useState } from 'react'
import {
  Clock,
  AlertCircle,
  Calendar,
  X,
  ShieldAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  MaintenanceReminderRecord,
  snoozeMaintenanceReminder,
} from '@/app/actions/maintenance'

interface SnoozeModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  reminder: MaintenanceReminderRecord | null
}

export default function SnoozeModal({
  isOpen,
  onClose,
  onSuccess,
  reminder,
}: SnoozeModalProps) {
  const [snoozeOption, setSnoozeOption] = useState<'3' | '7' | '14' | 'custom'>('7')
  const [customDate, setCustomDate] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().split('T')[0]
  })
  const [reason, setReason] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!isOpen || !reminder) return null

  const handleSnoozeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) {
      setErrorMsg('A brief justification note explaining why this maintenance is deferred is required.')
      return
    }

    setIsSubmitting(true)
    setErrorMsg(null)

    try {
      const payload: {
        reminder_id: string
        reason: string
        snooze_days?: number
        custom_snooze_until?: string
      } = {
        reminder_id: reminder.id,
        reason: reason.trim(),
      }

      if (snoozeOption === 'custom') {
        payload.custom_snooze_until = customDate
      } else {
        payload.snooze_days = parseInt(snoozeOption, 10)
      }

      const res = await snoozeMaintenanceReminder(payload)
      if (!res.success) {
        setErrorMsg(res.error || 'Failed to snooze reminder.')
      } else {
        onSuccess()
        onClose()
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 font-sans">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
                Snooze Maintenance Reminder
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Temporarily defer reminder with an audit note.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSnoozeSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Reminder Context Pill */}
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 space-y-1">
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>{reminder.lab_name || reminder.lab_id}</span>
              {reminder.snooze_count > 0 && (
                <span className="text-amber-600 dark:text-amber-400 font-semibold">
                  Snoozed {reminder.snooze_count}x previously
                </span>
              )}
            </div>
            <div className="text-xs font-bold text-zinc-900 dark:text-white">
              {reminder.title}
            </div>
          </div>

          {/* Defer Duration Presets */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Snooze Duration
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: '3', label: '+3 Days' },
                { id: '7', label: '+7 Days' },
                { id: '14', label: '+14 Days' },
                { id: 'custom', label: 'Custom' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSnoozeOption(opt.id as any)}
                  className={`py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                    snoozeOption === opt.id
                      ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-amber-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Input */}
          {snoozeOption === 'custom' && (
            <div className="space-y-1.5 animate-in fade-in duration-150">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                <span>Snooze Until Date</span>
              </label>
              <Input
                type="date"
                min={new Date().toISOString().split('T')[0]}
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="h-9 text-xs"
                required
              />
            </div>
          )}

          {/* Mandatory Reason */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Reason for Deferral <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Awaiting delivery of Arctic MX-4 thermal paste; exams in progress this week."
              rows={2}
              className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs leading-relaxed"
              required
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-9 text-xs font-medium"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="h-9 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-4 cursor-pointer shadow-xs"
            >
              {isSubmitting ? 'Deferring...' : 'Confirm Snooze'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
