'use client'

import React from 'react'
import {
  Bell,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Wrench,
  ShieldAlert,
  Sparkles,
  Monitor,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MaintenanceReminderRecord } from '@/app/actions/maintenance'

interface PersistentRemindersCardProps {
  reminders: MaintenanceReminderRecord[]
  onOpenLogModal: (reminder: MaintenanceReminderRecord) => void
  onOpenSnoozeModal: (reminder: MaintenanceReminderRecord) => void
}

export default function PersistentRemindersCard({
  reminders,
  onOpenLogModal,
  onOpenSnoozeModal,
}: PersistentRemindersCardProps) {
  const overdueCount = reminders.filter((r) => r.is_overdue).length

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs font-sans space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/20">
            <Bell className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-zinc-950 dark:text-white tracking-tight">
                Pinned Maintenance Reminders
              </h3>
              {overdueCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white animate-pulse">
                  {overdueCount} Overdue
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Scheduled computer and lab maintenance cycles requiring verification or sign-off.
            </p>
          </div>
        </div>

        <span className="text-xs font-medium text-zinc-400">
          {reminders.length} Active Notice{reminders.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Reminder List */}
      {reminders.length === 0 ? (
        <div className="py-8 text-center bg-zinc-50/50 dark:bg-zinc-800/30 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
          <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
          <h4 className="text-xs font-bold text-zinc-900 dark:text-white">
            All Lab Maintenance Routines Up to Date
          </h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto mt-0.5">
            Zero pending or overdue servicing notices across all monitored lab systems.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reminders.map((reminder) => {
            const isOverdue = reminder.is_overdue
            const isSnoozed = reminder.status === 'snoozed'

            return (
              <div
                key={reminder.id}
                className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3.5 ${
                  isOverdue
                    ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20 shadow-xs'
                    : isSnoozed
                    ? 'border-amber-300 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/20'
                    : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-800/30'
                }`}
              >
                {/* Left info */}
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200">
                      {reminder.lab_name || reminder.lab_id}
                    </span>

                    {/* Delay & Due Status Badge */}
                    {isOverdue ? (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1">
                        <ShieldAlert className="h-3 w-3 shrink-0" />
                        Overdue by +{reminder.overdue_days} Day{reminder.overdue_days === 1 ? '' : 's'}
                      </span>
                    ) : isSnoozed ? (
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                        <Clock className="h-3 w-3 shrink-0" />
                        Snoozed until {reminder.snoozed_until} (#{reminder.snooze_count})
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 flex items-center gap-1">
                        <Clock className="h-3 w-3 shrink-0" />
                        {reminder.days_remaining === 0
                          ? 'Due Today'
                          : `Due in ${reminder.days_remaining} days (${reminder.due_date})`}
                      </span>
                    )}

                    {reminder.plan?.severity && (
                      <span
                        className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded border ${
                          reminder.plan.severity === 'critical'
                            ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30'
                            : reminder.plan.severity === 'high'
                            ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                        }`}
                      >
                        {reminder.plan.severity}
                      </span>
                    )}
                  </div>

                  <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
                    {reminder.title}
                  </h4>

                  {/* Snooze Reason or Checklist preview */}
                  {isSnoozed && reminder.snooze_reason ? (
                    <div className="text-xs text-amber-800 dark:text-amber-300 bg-amber-100/50 dark:bg-amber-900/30 p-2 rounded-lg italic">
                      Snooze Reason: "{reminder.snooze_reason}"
                    </div>
                  ) : reminder.plan?.checklist && reminder.plan.checklist.length > 0 ? (
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                      <span className="text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                        {reminder.plan.checklist.length} Checklist Steps
                      </span>
                      <span className="truncate max-w-md hidden sm:inline">
                        • {reminder.plan.checklist.slice(0, 2).join(' • ')}...
                      </span>
                    </div>
                  ) : null}
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenSnoozeModal(reminder)}
                    className="h-8 px-3 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white"
                  >
                    <Clock className="h-3.5 w-3.5 mr-1" /> Snooze
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onOpenLogModal(reminder)}
                    className="h-8 px-3 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                  >
                    <Wrench className="h-3.5 w-3.5 mr-1.5" /> Log Maintenance
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
