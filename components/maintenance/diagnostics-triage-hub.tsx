'use client'

import React, { useState, useTransition } from 'react'
import {
  Monitor,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  Clock,
  ShieldCheck,
  User,
  Filter,
  Check,
  RotateCcw,
  Sparkles,
  FileCheck2,
  X,
  Loader2,
  ChevronRight,
  HelpCircle,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  updateWorkstationIssueStatus,
  resolveWorkstationIssue,
  getDiagnosticsTriageData,
  type DiagnosticsTriageData,
  type WorkstationIssueRecord,
  type WorkstationWithIssues,
} from '@/app/actions/workstations'

interface DiagnosticsTriageHubProps {
  initialData: DiagnosticsTriageData
  initialSearchQuery?: string
  onRefresh?: () => void
}

export function DiagnosticsTriageHub({
  initialData,
  initialSearchQuery = '',
  onRefresh,
}: DiagnosticsTriageHubProps) {
  const [data, setData] = useState<DiagnosticsTriageData>(initialData)
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all')
  const [selectedStationFilter, setSelectedStationFilter] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery)
  const [isPending, startTransition] = useTransition()

  // Resolve Modal State
  const [resolvingIssue, setResolvingIssue] = useState<WorkstationIssueRecord | null>(null)
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [partsReplaced, setPartsReplaced] = useState('')
  const [createLogbookEntry, setCreateLogbookEntry] = useState(true)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  const { workstations, issues, metrics } = data

  // Filtered issues list
  const filteredIssues = issues.filter((iss) => {
    if (statusFilter !== 'all' && iss.status !== statusFilter) return false
    if (selectedStationFilter && iss.workstation_label !== selectedStationFilter) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchTitle = iss.title.toLowerCase().includes(q)
      const matchStation = (iss.workstation_label || '').toLowerCase().includes(q)
      const matchDesc = (iss.description || '').toLowerCase().includes(q)
      const matchReporter = (iss.reported_by_name || '').toLowerCase().includes(q)
      if (!matchTitle && !matchStation && !matchDesc && !matchReporter) return false
    }
    return true
  })

  // Handle Sync / Refresh
  const handleSync = () => {
    startTransition(async () => {
      try {
        const fresh = await getDiagnosticsTriageData(data.lab_id || 'comp')
        setData(fresh)
        onRefresh?.()
      } catch (err: any) {
        console.error('Error refreshing diagnostics triage:', err)
      }
    })
  }

  // Handle Mark Under Repair
  const handleMarkUnderRepair = (issue: WorkstationIssueRecord) => {
    startTransition(async () => {
      try {
        const res = await updateWorkstationIssueStatus(issue.id, 'in_progress', 'Marked under technician repair')
        if (res.success) {
          setActionSuccess(`Workstation ${issue.workstation_label} is now marked Under Repair.`)
          setTimeout(() => setActionSuccess(null), 3000)
          // Optimistically update issue status
          setData((prev) => ({
            ...prev,
            issues: prev.issues.map((i) => (i.id === issue.id ? { ...i, status: 'in_progress' } : i)),
            workstations: prev.workstations.map((w) =>
              w.id === issue.workstation_id ? { ...w, status: 'under_repair' } : w
            ),
            metrics: {
              ...prev.metrics,
              open_count: Math.max(0, prev.metrics.open_count - 1),
              in_progress_count: prev.metrics.in_progress_count + 1,
              under_repair: prev.metrics.under_repair + 1,
              flagged: Math.max(0, prev.metrics.flagged - 1),
            },
          }))
          onRefresh?.()
        } else {
          setActionError(res.error || 'Failed to update issue status.')
        }
      } catch (err: any) {
        setActionError(err.message || 'Error updating status.')
      }
    })
  }

  // Handle Resolve and Restore
  const handleConfirmResolve = async () => {
    if (!resolvingIssue) return
    if (!resolutionNotes.trim()) {
      setActionError('Resolution notes are required to certify issue closure.')
      return
    }

    startTransition(async () => {
      try {
        const res = await resolveWorkstationIssue({
          issue_id: resolvingIssue.id,
          resolution_notes: resolutionNotes.trim(),
          create_maintenance_log: createLogbookEntry,
          parts_replaced: partsReplaced.trim() || null,
        })

        if (res.success) {
          setActionSuccess(`Resolved: Workstation ${resolvingIssue.workstation_label} restored to Operational.`)
          setTimeout(() => setActionSuccess(null), 3500)
          setResolvingIssue(null)
          setResolutionNotes('')
          setPartsReplaced('')

          // Optimistically update
          setData((prev) => ({
            ...prev,
            issues: prev.issues.map((i) =>
              i.id === resolvingIssue.id
                ? {
                    ...i,
                    status: 'resolved',
                    resolution_notes: resolutionNotes.trim(),
                    resolved_at: new Date().toISOString(),
                  }
                : i
            ),
            workstations: prev.workstations.map((w) =>
              w.id === resolvingIssue.workstation_id ? { ...w, status: 'operational', open_issues_count: 0 } : w
            ),
            metrics: {
              ...prev.metrics,
              open_count:
                resolvingIssue.status === 'open'
                  ? Math.max(0, prev.metrics.open_count - 1)
                  : prev.metrics.open_count,
              in_progress_count:
                resolvingIssue.status === 'in_progress'
                  ? Math.max(0, prev.metrics.in_progress_count - 1)
                  : prev.metrics.in_progress_count,
              resolved_count: prev.metrics.resolved_count + 1,
              operational: prev.metrics.operational + 1,
              under_repair:
                resolvingIssue.status === 'in_progress'
                  ? Math.max(0, prev.metrics.under_repair - 1)
                  : prev.metrics.under_repair,
              flagged:
                resolvingIssue.status === 'open' ? Math.max(0, prev.metrics.flagged - 1) : prev.metrics.flagged,
            },
          }))
          onRefresh?.()
        } else {
          setActionError(res.error || 'Failed to resolve issue.')
        }
      } catch (err: any) {
        setActionError(err.message || 'Error resolving issue.')
      }
    })
  }

  return (
    <div className="space-y-5 font-sans">
      {/* Action Feedback Alerts */}
      {actionSuccess && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 flex items-center justify-between text-xs text-emerald-300 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{actionSuccess}</span>
          </div>
          <button type="button" onClick={() => setActionSuccess(null)} className="text-emerald-400 hover:text-white">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 flex items-center justify-between text-xs text-rose-300 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
            <span className="font-semibold">{actionError}</span>
          </div>
          <button type="button" onClick={() => setActionError(null)} className="text-rose-400 hover:text-white">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 1. HIGH-DENSITY FLEET TELEMETRY CARDS (Rule #10: ~76px 2-row layout) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Total Stations */}
        <div className="glass-card p-2.5 sm:p-3 rounded-xl flex flex-col justify-between h-[76px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-400">
                <Monitor className="h-3 w-3" />
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-zinc-400 dark:text-slate-400">
                Total Fleet
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold text-zinc-500 dark:text-slate-400 px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-white/[0.04]">
              {data.lab_name}
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl sm:text-[22px] font-extrabold font-heading text-zinc-950 dark:text-white tabular-nums">
              {metrics.total}
            </span>
            <span className="text-[11px] text-zinc-500 dark:text-slate-400 font-sans">
              Monitored Nodes
            </span>
          </div>
        </div>

        {/* Operational Ready */}
        <div className="glass-card p-2.5 sm:p-3 rounded-xl flex flex-col justify-between h-[76px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-emerald-600 dark:text-emerald-400">
                Operational
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 px-1.5 py-0.2 rounded bg-emerald-500/10">
              {metrics.total > 0 ? Math.round((metrics.operational / metrics.total) * 100) : 100}% Health
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl sm:text-[22px] font-extrabold font-heading text-emerald-600 dark:text-emerald-400 tabular-nums">
              {metrics.operational}
            </span>
            <span className="text-[11px] text-zinc-500 dark:text-slate-400 font-sans">
              Ready for Class
            </span>
          </div>
        </div>

        {/* Awaiting Triage / Open Issues */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'open' ? 'all' : 'open')}
          className={`glass-card p-2.5 sm:p-3 rounded-xl flex flex-col justify-between h-[76px] cursor-pointer transition-all hover:border-amber-500/40 ${
            metrics.open_count > 0 ? 'border-amber-500/30' : ''
          }`}
          title="Filter to Open / Awaiting Triage issues"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className={`flex h-5 w-5 items-center justify-center rounded-md ${
                metrics.open_count > 0 ? 'bg-amber-500/15 text-amber-500' : 'bg-zinc-500/10 text-zinc-400'
              }`}>
                <AlertTriangle className="h-3 w-3" />
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-zinc-400 dark:text-slate-400">
                Awaiting Triage
              </span>
            </div>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
              metrics.open_count > 0 ? 'bg-amber-500/15 text-amber-400' : 'bg-zinc-100 dark:bg-white/[0.04] text-zinc-400'
            }`}>
              {metrics.open_count === 0 ? 'Nominal' : `${metrics.open_count} Open`}
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className={`text-xl sm:text-[22px] font-extrabold font-heading tabular-nums ${
              metrics.open_count > 0 ? 'text-amber-500' : 'text-zinc-950 dark:text-white'
            }`}>
              {metrics.open_count}
            </span>
            <span className="text-[11px] text-zinc-500 dark:text-slate-400 font-sans">
              {metrics.open_count > 0 ? 'Reported by Staff' : 'Zero Open Faults'}
            </span>
          </div>
        </div>

        {/* Active Under Repair */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'in_progress' ? 'all' : 'in_progress')}
          className={`glass-card p-2.5 sm:p-3 rounded-xl flex flex-col justify-between h-[76px] cursor-pointer transition-all hover:border-rose-500/40 ${
            metrics.in_progress_count > 0 ? 'border-rose-500/30' : ''
          }`}
          title="Filter to stations currently Under Repair"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className={`flex h-5 w-5 items-center justify-center rounded-md ${
                metrics.in_progress_count > 0 ? 'bg-rose-500/15 text-rose-500' : 'bg-zinc-500/10 text-zinc-400'
              }`}>
                <Wrench className="h-3 w-3" />
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-zinc-400 dark:text-slate-400">
                Under Repair
              </span>
            </div>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
              metrics.in_progress_count > 0 ? 'bg-rose-500/15 text-rose-400' : 'bg-zinc-100 dark:bg-white/[0.04] text-zinc-400'
            }`}>
              {metrics.in_progress_count === 0 ? 'Clear' : `${metrics.in_progress_count} Active`}
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className={`text-xl sm:text-[22px] font-extrabold font-heading tabular-nums ${
              metrics.in_progress_count > 0 ? 'text-rose-500' : 'text-zinc-950 dark:text-white'
            }`}>
              {metrics.in_progress_count}
            </span>
            <span className="text-[11px] text-zinc-500 dark:text-slate-400 font-sans">
              {metrics.in_progress_count > 0 ? 'Technician Active' : 'Full Availability'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. COMPACT HARDWARE FLEET RADAR (PURE TECHNICAL BEACONS - ZERO STUDENT ROSTERS) */}
      <div className="glass-card rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-indigo-400" />
            <h3 className="font-heading font-extrabold text-sm text-zinc-950 dark:text-white">
              Hardware Fleet Radar
            </h3>
            <span className="text-xs text-zinc-500 dark:text-slate-400">
              (Live status for {workstations.length} workstations — click any node to filter issues)
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]" />
              <span>Operational</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span>Flagged Fault</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
              <span>Under Repair</span>
            </span>
            {selectedStationFilter && (
              <button
                type="button"
                onClick={() => setSelectedStationFilter(null)}
                className="text-xs font-semibold text-indigo-400 hover:text-white underline cursor-pointer ml-2"
              >
                Clear Node Filter ({selectedStationFilter})
              </button>
            )}
          </div>
        </div>

        {/* Compact Terminal Chips Grid */}
        <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 lg:grid-cols-16 gap-1.5 pt-1">
          {workstations.map((ws) => {
            const isSelected = selectedStationFilter === ws.label
            const isUnderRepair = ws.status === 'under_repair'
            const isFlagged = ws.status === 'flagged'

            let bgClass = 'bg-zinc-100 dark:bg-[#151E32] text-zinc-700 dark:text-slate-300 border-zinc-200 dark:border-white/10'
            let dotClass = 'bg-emerald-500'

            if (isUnderRepair) {
              bgClass = 'bg-rose-500/15 text-rose-300 border-rose-500/40 ring-1 ring-rose-500/50'
              dotClass = 'bg-rose-500 animate-pulse'
            } else if (isFlagged) {
              bgClass = 'bg-amber-500/15 text-amber-300 border-amber-500/40'
              dotClass = 'bg-amber-500'
            }

            if (isSelected) {
              bgClass += ' ring-2 ring-indigo-500 shadow-md shadow-indigo-500/30'
            }

            return (
              <button
                key={ws.id}
                type="button"
                onClick={() => setSelectedStationFilter(isSelected ? null : ws.label)}
                title={`${ws.label}: ${ws.status.toUpperCase()} (${ws.open_issues_count} open issues)`}
                className={`flex flex-col items-center justify-center p-1.5 rounded-lg border text-center transition-all cursor-pointer hover:scale-105 ${bgClass}`}
              >
                <div className="flex items-center gap-1">
                  <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
                  <span className="font-mono text-[10px] font-bold tracking-tight">
                    {ws.label}
                  </span>
                </div>
                {ws.open_issues_count > 0 && (
                  <span className="text-[9px] font-mono px-1 py-0 rounded bg-rose-500/20 text-rose-300 mt-0.5 font-bold">
                    {ws.open_issues_count} {ws.open_issues_count === 1 ? 'issue' : 'issues'}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* 3. REPORTED ISSUES RESOLVER BOARD */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Toolbar & Filter Tabs */}
        <div className="p-3 sm:p-4 border-b border-zinc-200/60 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex-wrap">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <span>All Issues</span>
              <span className="font-mono text-[11px] px-1.5 py-0.2 rounded-full bg-zinc-200 dark:bg-zinc-800">
                {issues.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('open')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'open'
                  ? 'bg-white dark:bg-zinc-900 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              <span>Awaiting Triage</span>
              <span className="font-mono text-[11px] px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-400 font-bold">
                {metrics.open_count}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('in_progress')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'in_progress'
                  ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Wrench className="h-3.5 w-3.5 text-rose-500" />
              <span>Under Repair</span>
              <span className="font-mono text-[11px] px-1.5 py-0.2 rounded-full bg-rose-500/15 text-rose-400 font-bold">
                {metrics.in_progress_count}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('resolved')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'resolved'
                  ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span>Resolved &amp; Closed</span>
              <span className="font-mono text-[11px] px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-400 font-bold">
                {metrics.resolved_count}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search issues, PC label, symptoms..."
              className="h-8.5 w-full sm:w-64 text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={handleSync}
              className="h-8.5 px-3 text-xs rounded-xl border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-800 gap-1.5 shrink-0 cursor-pointer"
              title="Sync latest live workstation health and fault tickets from database"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync</span>
            </Button>
          </div>
        </div>

        {/* Issues List / Table */}
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {filteredIssues.length === 0 ? (
            <div className="py-14 text-center text-zinc-500 space-y-2">
              <ShieldCheck className="h-8 w-8 mx-auto text-emerald-500/70" />
              <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs">
                {statusFilter === 'all'
                  ? 'No reported workstation issues on file.'
                  : `No issues in "${statusFilter.replace('_', ' ')}" state.`}
              </p>
              <p className="text-[11px] text-zinc-400">
                All reported hardware and software faults filed by teachers appear here for technician triage.
              </p>
            </div>
          ) : (
            filteredIssues.map((issue) => {
              const isResolved = issue.status === 'resolved'
              const isInProgress = issue.status === 'in_progress'
              const isOpen = issue.status === 'open'

              return (
                <div
                  key={issue.id}
                  className={`m-2.5 p-3.5 sm:p-4 rounded-xl border transition-all duration-150 ${
                    isInProgress
                      ? 'border-l-4 border-l-rose-500 border-rose-500/30 bg-rose-500/[0.03] dark:bg-rose-950/20 shadow-xs'
                      : isOpen
                      ? 'border-l-4 border-l-amber-500 border-amber-500/30 bg-amber-500/[0.03] dark:bg-amber-950/20 shadow-xs'
                      : 'border-l-4 border-l-emerald-500 border-emerald-500/20 bg-emerald-500/[0.02] dark:bg-emerald-950/10'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3.5">
                    {/* Left: Station & Symptom Metadata */}
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Workstation Badge */}
                        <div className="flex items-center gap-1.5 font-mono text-xs font-extrabold px-2.5 py-0.5 rounded-lg bg-[#151E32] text-white border border-white/10 shadow-xs">
                          <Monitor className="h-3 w-3 text-indigo-400" />
                          <span>{issue.workstation_label || 'Workstation'}</span>
                        </div>

                        {/* Title */}
                        <h4 className="font-heading font-extrabold text-sm text-zinc-950 dark:text-white">
                          {issue.title}
                        </h4>

                        {/* Category Classification */}
                        {issue.category && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                            <span>{issue.category.name}</span>
                          </span>
                        )}

                        {/* Severity Badge */}
                        <span
                          className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            issue.severity === 'critical'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 font-black'
                              : issue.severity === 'high'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : issue.severity === 'medium'
                              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                              : 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30'
                          }`}
                        >
                          {issue.severity}
                        </span>

                        {/* Status Pill */}
                        {isResolved ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="h-3 w-3" />
                            Resolved &amp; Closed
                          </span>
                        ) : isInProgress ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse">
                            <Wrench className="h-3 w-3" />
                            Under Repair
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            <AlertTriangle className="h-3 w-3" />
                            Awaiting Triage
                          </span>
                        )}
                      </div>

                      {/* Description / Symptoms */}
                      {issue.description && (
                        <p className="text-xs text-zinc-600 dark:text-slate-300 leading-relaxed pl-0.5 font-sans bg-black/20 p-2 rounded-lg border border-white/5">
                          {issue.description}
                        </p>
                      )}

                      {/* Resolution Log (if resolved) */}
                      {isResolved && issue.resolution_notes && (
                        <div className="p-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 text-xs text-emerald-300 space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                            <FileCheck2 className="h-3.5 w-3.5 text-emerald-400" />
                            <span>Resolution Notes:</span>
                          </div>
                          <p className="leading-relaxed text-[11px] text-emerald-200/95 pl-5">
                            {issue.resolution_notes}
                          </p>
                          {issue.resolved_at && (
                            <span className="text-[10px] text-emerald-400/80 font-mono block pl-5 pt-0.5">
                              Certified closed on {new Date(issue.resolved_at).toLocaleString()} by {issue.resolved_by_name || 'Staff'}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Reporter Metadata */}
                      <div className="flex items-center gap-3 text-[11px] text-zinc-400 dark:text-slate-500 pt-0.5">
                        <span className="flex items-center gap-1.5">
                          <User className="h-3 w-3 text-zinc-400" />
                          <span>Reported by <strong className="text-zinc-300 font-semibold">{issue.reported_by_name || 'Staff'}</strong></span>
                        </span>
                        <span>&bull;</span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-zinc-400" />
                          <span>{new Date(issue.created_at).toLocaleString()}</span>
                        </span>
                      </div>
                    </div>

                    {/* Right: Triage Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0 self-start lg:self-center pt-2 lg:pt-0 flex-wrap">
                      {isOpen && (
                        <Button
                          type="button"
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleMarkUnderRepair(issue)}
                          className="h-8.5 px-3 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-xs gap-1.5 cursor-pointer"
                          title="Flag PC as Under Repair (takes station offline in classroom Floor Map)"
                        >
                          <Wrench className="h-3.5 w-3.5" />
                          <span>Mark Under Repair</span>
                        </Button>
                      )}

                      {!isResolved && (
                        <Button
                          type="button"
                          size="sm"
                          disabled={isPending}
                          onClick={() => {
                            setResolvingIssue(issue)
                            setResolutionNotes('')
                            setPartsReplaced('')
                            setActionError(null)
                          }}
                          className="h-8.5 px-3 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs gap-1.5 cursor-pointer"
                          title="Enter service notes and restore station to Operational"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Resolve &amp; Restore</span>
                        </Button>
                      )}

                      {isInProgress && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isPending}
                          onClick={() => {
                            startTransition(async () => {
                              await updateWorkstationIssueStatus(issue.id, 'open', 'Reverted back to Awaiting Triage')
                              setData((prev) => ({
                                ...prev,
                                issues: prev.issues.map((i) => (i.id === issue.id ? { ...i, status: 'open' } : i)),
                                workstations: prev.workstations.map((w) =>
                                  w.id === issue.workstation_id ? { ...w, status: 'flagged' } : w
                                ),
                              }))
                              onRefresh?.()
                            })
                          }}
                          className="h-8.5 px-2.5 text-xs rounded-xl border-white/10 text-slate-300 hover:text-white hover:bg-white/5 gap-1"
                          title="Revert back to Awaiting Triage"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>Revert</span>
                        </Button>
                      )}

                      {isResolved && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isPending}
                          onClick={() => {
                            startTransition(async () => {
                              await updateWorkstationIssueStatus(issue.id, 'open', 'Reopened by technician')
                              const fresh = await getDiagnosticsTriageData(data.lab_id || 'comp')
                              setData(fresh)
                              onRefresh?.()
                            })
                          }}
                          className="h-8.5 px-2.5 text-xs font-semibold rounded-xl border-white/10 text-slate-300 hover:text-white hover:bg-white/5 gap-1.5 cursor-pointer"
                          title="Reopen this fault ticket if issue recurs"
                        >
                          <RotateCcw className="h-3.5 w-3.5 text-amber-400" />
                          <span>Reopen Ticket</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* 4. RESOLVE & RESTORE MODAL */}
      {resolvingIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#101726] p-5 shadow-2xl space-y-4 font-sans">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="font-heading font-extrabold text-sm text-white flex items-center gap-2">
                    <span>Resolve Issue on {resolvingIssue.workstation_label}</span>
                    <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300">
                      {resolvingIssue.workstation_label}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Certify problem resolution to return station to 100% Operational status.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResolvingIssue(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Issue Summary Card */}
            <div className="p-3 rounded-xl border border-white/10 bg-[#151E32]/70 text-xs space-y-1">
              <span className="font-semibold text-slate-200">Reported Symptom:</span>
              <p className="text-white font-medium">{resolvingIssue.title}</p>
              {resolvingIssue.description && (
                <p className="text-slate-400 text-[11px]">{resolvingIssue.description}</p>
              )}
            </div>

            {/* Resolution Form */}
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-200">
                  Corrective Action / Resolution Notes <span className="text-rose-400">*</span>
                </label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="e.g. Replaced damaged HDMI cable, ran GPU stress test, terminal confirmed operational."
                  rows={3}
                  className="w-full rounded-xl bg-[#0B0F19] border border-white/10 p-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-200">
                  Parts Replaced / Hardware Changes (Optional)
                </label>
                <Input
                  value={partsReplaced}
                  onChange={(e) => setPartsReplaced(e.target.value)}
                  placeholder="e.g. HDMI Cable 2.0, 8GB DDR4 RAM stick, USB Mouse"
                  className="h-8.5 text-xs bg-[#0B0F19] border-white/10 text-white rounded-xl"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={createLogbookEntry}
                  onChange={(e) => setCreateLogbookEntry(e.target.checked)}
                  className="rounded border-white/20 bg-[#0B0F19] text-indigo-600 focus:ring-0"
                />
                <span className="text-xs text-slate-300">
                  Automatically create official entry in Certified Service Logbook
                </span>
              </label>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.08]">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setResolvingIssue(null)}
                className="h-8.5 text-xs rounded-xl border-white/10 text-slate-300"
              >
                <span>Cancel</span>
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isPending || !resolutionNotes.trim()}
                onClick={handleConfirmResolve}
                className="h-8.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs gap-1.5"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Restoring Station...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Confirm &amp; Restore Station</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
