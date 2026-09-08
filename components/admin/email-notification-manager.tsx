'use client'

import React, { useState, useEffect } from 'react'
import {
  Mail,
  Send,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  ShieldCheck,
  Calendar,
  Wrench,
  Palmtree,
  UserCheck,
  Play,
  Sparkles,
  ExternalLink,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  getEmailEngineStatus,
  getEmailDispatchLogs,
  dispatchTeacherDailyReminders,
  dispatchOverdueMaintenanceAlerts,
  dispatchUpcomingHolidayNotices,
} from '@/app/actions/notifications'

interface DispatchLogItem {
  id: string
  dispatch_type: string
  recipient_email: string
  reference_date: string
  metadata: any
  dispatched_at: string
}

interface EngineStatus {
  isGmailConfigured: boolean
  senderEmail: string
  isCronSecretConfigured: boolean
  totalLogs: number
  todaysLogs: number
  todayStr: string
}

export default function EmailNotificationManager() {
  const [status, setStatus] = useState<EngineStatus | null>(null)
  const [logs, setLogs] = useState<DispatchLogItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 4000)
  }

  const loadData = async () => {
    try {
      setIsRefreshing(true)
      const [statusRes, logsRes] = await Promise.all([
        getEmailEngineStatus(),
        getEmailDispatchLogs(20),
      ])
      if (statusRes.success) {
        setStatus(statusRes as any)
      }
      if (logsRes.success) {
        setLogs(logsRes.logs || [])
      }
    } catch (err) {
      console.error('Failed to load email engine status:', err)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Manual Trigger Handlers
  const handleTriggerTeacherReminders = async () => {
    try {
      setActiveAction('teacher_reminders')
      const res = await dispatchTeacherDailyReminders(true)
      if (res.success) {
        showToast(
          `Schedule Reminders: ${res.dispatchedCount} emails sent (${res.skippedDuplicates} skipped).`
        )
      } else {
        showToast(`Failed to trigger reminders: ${(res as any).message || 'Unknown error'}`)
      }
      await loadData()
    } catch (e: any) {
      showToast(`Error: ${e.message}`)
    } finally {
      setActiveAction(null)
    }
  }

  const handleTriggerMaintenanceScan = async () => {
    try {
      setActiveAction('maintenance_scan')
      const res = await dispatchOverdueMaintenanceAlerts(true)
      if (res.success) {
        showToast(
          `Maintenance Scan: ${res.dispatchedCount} alerts sent to Lab In-Charges (${(res as any).message || 'Complete'}).`
        )
      } else {
        showToast(`Maintenance scan error: ${res.error || 'Failed'}`)
      }
      await loadData()
    } catch (e: any) {
      showToast(`Error: ${e.message}`)
    } finally {
      setActiveAction(null)
    }
  }

  const handleTriggerHolidayNotice = async () => {
    try {
      setActiveAction('holiday_notice')
      const res = await dispatchUpcomingHolidayNotices(true)
      if (res.success) {
        showToast(
          `Holiday SOP: ${res.dispatchedCount} notices sent for ${res.holidaysFound} upcoming holidays.`
        )
      } else {
        showToast(`Holiday notice error: ${res.error || 'Failed'}`)
      }
      await loadData()
    } catch (e: any) {
      showToast(`Error: ${e.message}`)
    } finally {
      setActiveAction(null)
    }
  }

  const getDispatchBadge = (type: string) => {
    switch (type) {
      case 'daily_digest':
        return (
          <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 font-mono text-[10px]">
            Daily Roster
          </Badge>
        )
      case 'overdue_maintenance':
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 font-mono text-[10px]">
            Overdue Upkeep
          </Badge>
        )
      case 'holiday_notice':
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-mono text-[10px]">
            Holiday SOP
          </Badge>
        )
      case 'incident_alert':
        return (
          <Badge variant="outline" className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 font-mono text-[10px]">
            Breakage Alert
          </Badge>
        )
      case 'skipped_session':
        return (
          <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 font-mono text-[10px]">
            Skipped Session
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="font-mono text-[10px]">
            {type}
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3.5 px-4 rounded-xl bg-indigo-600 text-white text-xs font-semibold shadow-lg animate-in fade-in slide-in-from-top-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-white/80 hover:text-white cursor-pointer ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Telemetry & Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-2xs">
          <CardContent className="p-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span>SMTP Connection</span>
              <Mail className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-heading font-extrabold text-zinc-950 dark:text-white">
                {status?.isGmailConfigured ? 'Gmail Pool' : 'Dev Mode'}
              </span>
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="text-[11px] text-zinc-500 font-mono truncate">
              {status?.senderEmail || 'computerlab.rrlss@gmail.com'}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-2xs">
          <CardContent className="p-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span>Scheduled Cron</span>
              <Clock className="h-4 w-4 text-cyan-500" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-heading font-extrabold text-zinc-950 dark:text-white">
                07:00 NPT
              </span>
              <Badge variant="outline" className="text-[10px] font-mono border-cyan-500/30 text-cyan-600 dark:text-cyan-400">
                Daily Sun-Fri
              </Badge>
            </div>
            <p className="text-[11px] text-zinc-500 font-mono">
              Vercel Cron: 15 1 * * 0-5 (UTC)
            </p>
          </CardContent>
        </Card>

        <Card className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-2xs">
          <CardContent className="p-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span>Today’s Dispatches</span>
              <Send className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-heading font-extrabold text-zinc-950 dark:text-white tabular-nums">
                {status?.todaysLogs ?? 0}
              </span>
              <span className="text-xs text-zinc-500">emails logged</span>
            </div>
            <p className="text-[11px] text-zinc-500 font-mono">
              Reference: {status?.todayStr || new Date().toISOString().split('T')[0]}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-2xs">
          <CardContent className="p-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span>Idempotency Shield</span>
              <ShieldCheck className="h-4 w-4 text-purple-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-heading font-extrabold text-zinc-950 dark:text-white tabular-nums">
                {status?.totalLogs ?? 0}
              </span>
              <span className="text-xs text-zinc-500">records in DB</span>
            </div>
            <p className="text-[11px] text-zinc-500 font-mono">
              Unique constraint: (type, email, date)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Manual Diagnostic & Trigger Station */}
      <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs overflow-hidden">
        <CardHeader className="p-4 px-5 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-900/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
                <Send className="h-4.5 w-4.5" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-2">
                  <span>Manual Dispatch & Diagnostic Station</span>
                  <Badge variant="outline" className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400 border-indigo-500/30">
                    Live Triggers
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs text-zinc-500 font-mono">
                  Test and execute institutional email notification sweeps immediately. Bypasses 24h cron waiting cycle.
                </CardDescription>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={isRefreshing}
              className="h-8 px-3 text-xs gap-1.5 cursor-pointer font-mono"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh Telemetry</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Action 1: Teacher Daily Schedule Sweep */}
          <div className="p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 flex flex-col justify-between gap-4 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-indigo-500" />
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 font-mono uppercase tracking-wide">
                  Teacher Schedule Sweep
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-sans">
                Sends personalized daily lab practical schedules to all faculty members with assigned sessions today (Class 11/12, period times, and default student tallies).
              </p>
            </div>

            <Button
              type="button"
              size="sm"
              onClick={handleTriggerTeacherReminders}
              disabled={activeAction === 'teacher_reminders'}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold font-mono h-8.5 rounded-xl cursor-pointer flex items-center justify-center gap-2 shadow-xs"
            >
              {activeAction === 'teacher_reminders' ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Dispatching Rosters...</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>Send Today’s Roster Emails</span>
                </>
              )}
            </Button>
          </div>

          {/* Action 2: Overdue Maintenance Scan */}
          <div className="p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 flex flex-col justify-between gap-4 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 font-mono uppercase tracking-wide">
                  Maintenance Overdue Scan
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-sans">
                Scans all pending maintenance plans across Computer, Physics, and Chemistry labs. Dispatches targeted alerts to Lab In-Charges for tasks past their due date.
              </p>
            </div>

            <Button
              type="button"
              size="sm"
              onClick={handleTriggerMaintenanceScan}
              disabled={activeAction === 'maintenance_scan'}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold font-mono h-8.5 rounded-xl cursor-pointer flex items-center justify-center gap-2 shadow-xs"
            >
              {activeAction === 'maintenance_scan' ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Scanning Due Dates...</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>Scan Overdue Maintenance</span>
                </>
              )}
            </Button>
          </div>

          {/* Action 3: Upcoming Holiday Notice */}
          <div className="p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 flex flex-col justify-between gap-4 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Palmtree className="h-4 w-4 text-emerald-500" />
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 font-mono uppercase tracking-wide">
                  Holiday SOP Notice (48h)
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-sans">
                Identifies academic calendar holidays starting within the next 48 hours. Dispatches equipment shutdown checklist and preventive care suggestions to In-Charges.
              </p>
            </div>

            <Button
              type="button"
              size="sm"
              onClick={handleTriggerHolidayNotice}
              disabled={activeAction === 'holiday_notice'}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold font-mono h-8.5 rounded-xl cursor-pointer flex items-center justify-center gap-2 shadow-xs"
            >
              {activeAction === 'holiday_notice' ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Checking Holidays...</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>Dispatch Holiday Notice</span>
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Dispatch Audit Log */}
      <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs overflow-hidden">
        <CardHeader className="p-4 px-5 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-900/40">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-zinc-950 dark:text-white">
                Dispatch Audit Logbook
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500 font-mono">
                Recent email delivery events verified and recorded in <code className="text-indigo-600 dark:text-indigo-400">public.email_dispatch_logs</code>
              </CardDescription>
            </div>
            <span className="text-xs font-mono text-zinc-400">
              Showing last {logs.length} dispatches
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/60 text-zinc-500 font-mono text-[11px]">
                  <th className="py-2.5 px-4 font-semibold">Event Type</th>
                  <th className="py-2.5 px-4 font-semibold">Recipient Email</th>
                  <th className="py-2.5 px-4 font-semibold">Reference Date</th>
                  <th className="py-2.5 px-4 font-semibold">Context / Metadata</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Dispatched At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-zinc-400">
                      No email dispatches recorded in this session.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="py-2.5 px-4">{getDispatchBadge(log.dispatch_type)}</td>
                      <td className="py-2.5 px-4 font-mono font-medium text-zinc-800 dark:text-zinc-200">
                        {log.recipient_email}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-zinc-600 dark:text-zinc-400">
                        {log.reference_date}
                      </td>
                      <td className="py-2.5 px-4 text-zinc-600 dark:text-zinc-300 truncate max-w-xs font-sans">
                        {log.metadata
                          ? typeof log.metadata === 'object'
                            ? JSON.stringify(log.metadata)
                            : log.metadata
                          : '—'}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-zinc-400 text-right">
                        {new Date(log.dispatched_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
