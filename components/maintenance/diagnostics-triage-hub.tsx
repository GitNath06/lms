'use client'

import React, { useState, useTransition, useMemo } from 'react'
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
  Printer,
  Download,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  Layers,
  Search,
  ExternalLink,
  Cpu,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { subscribeToSync, broadcastSync } from '@/lib/sync-bus'
import { exportMaintenanceRecordsAction } from '@/app/actions/maintenance'
import { downloadBase64File } from '@/lib/exports/browser-downloader'
import {
  updateWorkstationIssueStatus,
  resolveWorkstationIssue,
  getDiagnosticsTriageData,
  type DiagnosticsTriageData,
  type WorkstationIssueRecord,
  type WorkstationWithIssues,
} from '@/app/actions/workstations'
import { getCachedData, setCachedData, fetchWithClientCache } from '@/lib/cache/client-query-cache'

const defaultTriageData: DiagnosticsTriageData = {
  lab_id: 'comp',
  lab_name: 'Computer Lab',
  metrics: {
    total: 34,
    operational: 34,
    flagged: 0,
    under_repair: 0,
    open_count: 0,
    in_progress_count: 0,
    resolved_count: 0,
  },
  workstations: [],
  issues: [],
  categories: [],
  is_privileged: true,
}

interface DiagnosticsTriageHubProps {
  initialData?: DiagnosticsTriageData
  initialSearchQuery?: string
  onRefresh?: () => void
}

export function DiagnosticsTriageHub({
  initialData,
  initialSearchQuery = '',
  onRefresh,
}: DiagnosticsTriageHubProps) {
  const [data, setData] = useState<DiagnosticsTriageData>(() => {
    const cached = getCachedData<DiagnosticsTriageData>('workstations:triage:comp')
    return cached || initialData || defaultTriageData
  })
  const hasActiveFaults =
    (initialData?.metrics?.open_count || 0) > 0 || (initialData?.metrics?.in_progress_count || 0) > 0
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'open' | 'in_progress' | 'resolved'>(
    hasActiveFaults ? 'active' : 'all'
  )
  const [selectedStationFilter, setSelectedStationFilter] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery)
  const [isPending, startTransition] = useTransition()

  // Fleet Radar view & filter controls
  const [radarViewMode, setRadarViewMode] = useState<'matrix' | 'bays'>('matrix')
  const [radarStatusFilter, setRadarStatusFilter] = useState<'all' | 'operational' | 'faults'>('all')
  const [radarSearch, setRadarSearch] = useState('')

  // Resolve Modal State
  const [resolvingIssue, setResolvingIssue] = useState<WorkstationIssueRecord | null>(null)
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [partsReplaced, setPartsReplaced] = useState('')
  const [createLogbookEntry, setCreateLogbookEntry] = useState(true)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async (format: 'xlsx' | 'csv') => {
    setIsExporting(true)
    try {
      const res = await exportMaintenanceRecordsAction(data.lab_id || 'all', format)
      if (res.success && res.base64 && res.filename) {
        downloadBase64File(res.base64, res.filename, res.contentType || 'application/octet-stream')
      } else {
        setActionError(res.error || 'Failed to export maintenance logbook')
      }
    } catch (err: any) {
      setActionError(err.message || 'Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  const { workstations, issues, metrics } = data

  const totalStations = workstations.length
  const operationalStations = useMemo(() => workstations.filter((w) => w.status === 'operational'), [workstations])
  const underRepairStations = useMemo(() => workstations.filter((w) => w.status === 'under_repair'), [workstations])
  const flaggedStations = useMemo(() => workstations.filter((w) => w.status === 'flagged'), [workstations])
  const faultStations = useMemo(
    () => workstations.filter((w) => w.status !== 'operational' || w.open_issues_count > 0),
    [workstations]
  )
  const fleetHealthRate = totalStations > 0 ? Math.round((operationalStations.length / totalStations) * 100) : 100

  // Filtered workstations for the radar
  const filteredRadarStations = useMemo(() => {
    return workstations.filter((ws) => {
      if (radarStatusFilter === 'operational' && ws.status !== 'operational') return false
      if (radarStatusFilter === 'faults' && ws.status === 'operational' && ws.open_issues_count === 0) return false

      if (radarSearch.trim()) {
        const q = radarSearch.toLowerCase().trim()
        const matchLabel = ws.label.toLowerCase().includes(q)
        const matchRow = (ws.row_label || '').toLowerCase().includes(q)
        if (!matchLabel && !matchRow) return false
      }

      return true
    })
  }, [workstations, radarStatusFilter, radarSearch])

  // Group by row for "Bays" view mode
  const bayGroups = useMemo(() => {
    const map = new Map<string, WorkstationWithIssues[]>()
    filteredRadarStations.forEach((ws) => {
      const row = ws.row_label || 'General Floor'
      const list = map.get(row) || []
      list.push(ws)
      map.set(row, list)
    })
    return Array.from(map.entries())
  }, [filteredRadarStations])

  const selectedWs = useMemo(() => {
    return workstations.find((w) => w.label === selectedStationFilter) || null
  }, [workstations, selectedStationFilter])

  // Filtered issues list
  const filteredIssues = issues.filter((iss) => {
    if (statusFilter === 'active') {
      if (iss.status !== 'open' && iss.status !== 'in_progress') return false
    } else if (statusFilter !== 'all' && iss.status !== statusFilter) {
      return false
    }
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

  // Keep internal state aligned when parent provides fresh initialData
  React.useEffect(() => {
    if (initialData) {
      setData(initialData)
    }
  }, [initialData])

  // Continuous real-time auto-synchronization for Diagnostics & Triage Hub
  React.useEffect(() => {
    let isMounted = true
    let inFlight = false

    const autoSync = async (force: boolean = false) => {
      if (!isMounted || inFlight) return
      if (!force && typeof document !== 'undefined' && document.hidden) return
      inFlight = true
      try {
        const fresh = await getDiagnosticsTriageData(data.lab_id || 'comp')
        if (isMounted && fresh) {
          setData(fresh)
          onRefresh?.()
        }
      } catch {
        // Silently ignore transient network blips
      } finally {
        inFlight = false
      }
    }

    // 1. Continuous 10-second adaptive polling (checks visibility)
    const timer = setInterval(() => autoSync(false), 10000)

    // 2. Instant sync on focus / visibility return (forced)
    const handleVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        autoSync(true)
      }
    }
    const handleFocus = () => autoSync(true)
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)

    // 3. Instant real-time bus subscription across tabs/devices (forced, updates background tabs too!)
    const unsubWs = subscribeToSync('workstations', () => autoSync(true))
    const unsubAssist = subscribeToSync('assistance', () => autoSync(true))

    return () => {
      isMounted = false
      clearInterval(timer)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
      unsubWs()
      unsubAssist()
    }
  }, [data.lab_id, onRefresh])

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
          broadcastSync('workstations', { stationCode: issue.workstation_label })
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
          broadcastSync('workstations', { stationCode: resolvingIssue.workstation_label })
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
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-400">
                <Monitor className="h-3 w-3" />
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-zinc-400 dark:text-slate-400 truncate">
                Total Fleet
              </span>
            </div>
            <span className="hidden min-[420px]:inline-flex text-[9px] sm:text-[10px] font-mono font-bold text-zinc-500 dark:text-slate-400 px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-white/[0.04] truncate max-w-[80px]">
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
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-emerald-600 dark:text-emerald-400 truncate">
                Operational
              </span>
            </div>
            <span className="hidden min-[420px]:inline-flex text-[9px] sm:text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 px-1.5 py-0.2 rounded bg-emerald-500/10 shrink-0">
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
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`shrink-0 flex h-5 w-5 items-center justify-center rounded-md ${
                metrics.open_count > 0 ? 'bg-amber-500/15 text-amber-500' : 'bg-zinc-500/10 text-zinc-400'
              }`}>
                <AlertTriangle className="h-3 w-3" />
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-zinc-400 dark:text-slate-400 truncate">
                Awaiting Triage
              </span>
            </div>
            <span className={`hidden min-[420px]:inline-flex text-[9px] sm:text-[10px] font-mono font-bold px-1.5 py-0.2 rounded shrink-0 ${
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
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`shrink-0 flex h-5 w-5 items-center justify-center rounded-md ${
                metrics.in_progress_count > 0 ? 'bg-rose-500/15 text-rose-500' : 'bg-zinc-500/10 text-zinc-400'
              }`}>
                <Wrench className="h-3 w-3" />
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-zinc-400 dark:text-slate-400 truncate">
                Under Repair
              </span>
            </div>
            <span className={`hidden min-[420px]:inline-flex text-[9px] sm:text-[10px] font-mono font-bold px-1.5 py-0.2 rounded shrink-0 ${
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

      {/* 2. ADVANCED HARDWARE FLEET RADAR & TELEMETRY HUB */}
      <div className="glass-card rounded-2xl p-4 sm:p-5 space-y-4">
        {/* Top Control Bar: Title & Telemetry Metrics */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-zinc-200/60 dark:border-white/[0.06]">
          {/* Title & Live Telemetry Badge */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 shadow-xs shrink-0">
              <Cpu className="h-4.5 w-4.5" />
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-heading font-extrabold text-sm sm:text-base text-zinc-950 dark:text-white tracking-tight">
                  Hardware Fleet Radar
                </h3>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-500/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>{fleetHealthRate}% Health</span>
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-slate-400 mt-0.5">
                Real-time telemetry across {totalStations} workstations — click any node to isolate tickets
              </p>
            </div>
          </div>

          {/* Quick Filters, Search & View Modes */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Quick Filter Segmented Pills */}
            <div className="inline-flex items-center p-0.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/80 text-xs">
              <button
                type="button"
                onClick={() => setRadarStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  radarStatusFilter === 'all'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                All ({totalStations})
              </button>
              <button
                type="button"
                onClick={() => setRadarStatusFilter('operational')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  radarStatusFilter === 'operational'
                    ? 'bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400'
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>Healthy ({operationalStations.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setRadarStatusFilter('faults')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  radarStatusFilter === 'faults'
                    ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${faultStations.length > 0 ? 'bg-rose-500 animate-pulse' : 'bg-zinc-400'}`} />
                <span>Faults ({faultStations.length})</span>
              </button>
            </div>

            {/* Quick Node Search */}
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={radarSearch}
                onChange={(e) => setRadarSearch(e.target.value)}
                placeholder="Find PC..."
                className="h-8 pl-8 pr-2.5 w-24 sm:w-28 text-xs font-mono rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              {radarSearch && (
                <button
                  type="button"
                  onClick={() => setRadarSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* View Mode Toggle: Matrix vs Bays */}
            <div className="hidden sm:inline-flex items-center p-0.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/80 text-xs">
              <button
                type="button"
                onClick={() => setRadarViewMode('matrix')}
                title="Matrix view (high density uniform grid)"
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  radarViewMode === 'matrix'
                    ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setRadarViewMode('bays')}
                title="Bays view (grouped by architectural row)"
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  radarViewMode === 'bays'
                    ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Selected Station Telemetry Inspector Bar (when a station is selected) */}
        {selectedStationFilter && selectedWs && (
          <div className="flex items-center justify-between flex-wrap gap-2.5 px-3.5 py-2.5 rounded-xl bg-indigo-50/90 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-500/30 text-xs shadow-xs animate-in fade-in duration-200">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="flex h-6 px-2 items-center justify-center rounded-lg bg-indigo-600 text-white font-mono font-bold text-xs shadow-xs">
                {selectedWs.label}
              </span>
              <span className="text-zinc-600 dark:text-slate-300 font-medium">
                {selectedWs.row_label ? `Located in ${selectedWs.row_label}` : 'Floor Node'}
              </span>
              <span className="text-zinc-300 dark:text-zinc-700">•</span>
              <span className={`inline-flex items-center gap-1 font-semibold ${
                selectedWs.status === 'under_repair'
                  ? 'text-rose-600 dark:text-rose-400'
                  : selectedWs.status === 'flagged'
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${
                  selectedWs.status === 'under_repair'
                    ? 'bg-rose-500 animate-pulse'
                    : selectedWs.status === 'flagged'
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`} />
                <span className="capitalize">{selectedWs.status.replace('_', ' ')}</span>
              </span>
              {selectedWs.open_issues_count > 0 && (
                <span className="px-1.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 font-mono font-bold text-[10px]">
                  {selectedWs.open_issues_count} open {selectedWs.open_issues_count === 1 ? 'ticket' : 'tickets'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/computer-lab?station=${encodeURIComponent(selectedWs.label)}`}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline"
              >
                <span>CAD Floor View</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
              <button
                type="button"
                onClick={() => setSelectedStationFilter(null)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-slate-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-[11px] font-bold cursor-pointer shadow-xs transition-colors"
              >
                <X className="h-3 w-3" />
                <span>Clear Filter</span>
              </button>
            </div>
          </div>
        )}

        {/* Workstation Nodes Grid / Bay Clusters */}
        {filteredRadarStations.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-500 dark:text-slate-400 space-y-1">
            <p className="font-semibold text-zinc-800 dark:text-zinc-200">No workstations match current filter.</p>
            <p>Try clearing your search query or selecting &quot;All&quot; nodes.</p>
          </div>
        ) : radarViewMode === 'matrix' ? (
          /* High Density Uniform Matrix (clean, compact pills with zero label truncation) */
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-11 gap-1.5 sm:gap-2">
            {filteredRadarStations.map((ws) => {
              const isSelected = selectedStationFilter === ws.label
              const isUnderRepair = ws.status === 'under_repair'
              const isFlagged = ws.status === 'flagged'

              let containerStyle =
                'bg-zinc-50 dark:bg-white/[0.03] border-zinc-200/80 dark:border-white/[0.07] text-zinc-700 dark:text-slate-300 hover:border-zinc-300 dark:hover:border-white/20'
              let dotStyle = 'bg-emerald-500'

              if (isUnderRepair) {
                containerStyle =
                  'bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/30'
                dotStyle = 'bg-rose-500 animate-pulse'
              } else if (isFlagged) {
                containerStyle =
                  'bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30'
                dotStyle = 'bg-amber-500 animate-pulse'
              }

              if (isSelected) {
                containerStyle =
                  'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-950 dark:text-indigo-100 shadow-md shadow-indigo-500/20 scale-[1.02]'
              }

              return (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => setSelectedStationFilter(isSelected ? null : ws.label)}
                  title={`${ws.label} (${ws.row_label || 'Unassigned'}): ${ws.status.toUpperCase()}${
                    ws.open_issues_count > 0 ? ` • ${ws.open_issues_count} open fault(s)` : ' • Fully Operational'
                  }`}
                  className={`group relative h-8 px-2 sm:px-2.5 rounded-lg border flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer select-none ${containerStyle}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotStyle}`} />
                  <span className="font-bold text-xs font-mono tracking-tight whitespace-nowrap">
                    {ws.label}
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          /* Architectural Bay Clusters */
          <div className="space-y-3">
            {bayGroups.map(([rowLabel, stationsInRow]) => {
              const hasFaultsInRow = stationsInRow.some((s) => s.status !== 'operational' || s.open_issues_count > 0)
              return (
                <div
                  key={rowLabel}
                  className="p-3 rounded-xl bg-zinc-50/70 dark:bg-[#151E32]/50 border border-zinc-200/60 dark:border-white/[0.04] space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-800 dark:text-slate-200 font-heading">
                        {rowLabel}
                      </span>
                      <span className="text-[11px] text-zinc-400 dark:text-slate-500 font-mono">
                        ({stationsInRow.length} {stationsInRow.length === 1 ? 'node' : 'nodes'})
                      </span>
                    </div>
                    {hasFaultsInRow && (
                      <span className="text-[10px] font-bold font-mono text-rose-600 dark:text-rose-400 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        <span>Action Required</span>
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1.5">
                    {stationsInRow.map((ws) => {
                      const isSelected = selectedStationFilter === ws.label
                      const isUnderRepair = ws.status === 'under_repair'
                      const isFlagged = ws.status === 'flagged'

                      let containerStyle =
                        'bg-zinc-50 dark:bg-white/[0.03] border-zinc-200/80 dark:border-white/[0.07] text-zinc-700 dark:text-slate-300 hover:border-zinc-300 dark:hover:border-white/20'
                      let dotStyle = 'bg-emerald-500'

                      if (isUnderRepair) {
                        containerStyle =
                          'bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/30'
                        dotStyle = 'bg-rose-500 animate-pulse'
                      } else if (isFlagged) {
                        containerStyle =
                          'bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30'
                        dotStyle = 'bg-amber-500 animate-pulse'
                      }

                      if (isSelected) {
                        containerStyle =
                          'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-950 dark:text-indigo-100 shadow-md shadow-indigo-500/20 scale-[1.02]'
                      }

                      return (
                        <button
                          key={ws.id}
                          type="button"
                          onClick={() => setSelectedStationFilter(isSelected ? null : ws.label)}
                          title={`${ws.label}: ${ws.status.toUpperCase()}${
                            ws.open_issues_count > 0 ? ` • ${ws.open_issues_count} open fault(s)` : ''
                          }`}
                          className={`group relative h-8 px-2 sm:px-2.5 rounded-lg border flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer select-none ${containerStyle}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotStyle}`} />
                          <span className="font-bold text-xs font-mono tracking-tight whitespace-nowrap">
                            {ws.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 3. REPORTED ISSUES RESOLVER BOARD */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Toolbar & Filter Tabs */}
        <div className="p-3 sm:p-4 border-b border-zinc-200/60 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex-wrap">
            {selectedStationFilter && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
                <span>Node: {selectedStationFilter}</span>
                <button
                  type="button"
                  onClick={() => setSelectedStationFilter(null)}
                  className="hover:text-indigo-950 dark:hover:text-white cursor-pointer ml-1"
                  title="Clear node filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'active'
                  ? 'bg-white dark:bg-zinc-900 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              <span>Active Faults</span>
              <span className="font-mono text-[11px] px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-500 dark:text-amber-400 font-bold">
                {metrics.open_count + metrics.in_progress_count}
              </span>
            </button>

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

          <div className="flex items-center gap-2 w-full lg:w-auto justify-between lg:justify-end">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search issues, PC label, symptoms..."
              className="h-8.5 w-full sm:w-52 md:w-56 text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 shrink"
            />
            <div className="flex items-center gap-1.5 flex-nowrap shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={handleSync}
                className="h-8.5 px-2.5 sm:px-3 text-xs rounded-xl border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-800 gap-1.5 shrink-0 cursor-pointer"
                title="Sync latest live workstation health and fault tickets from database"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Sync</span>
              </Button>

              <Link href={`/print/maintenance?lab_id=${data.lab_id || 'all'}`} className="hidden md:inline-flex">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8.5 px-2.5 sm:px-3 text-xs rounded-xl border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-800 gap-1.5 shrink-0 cursor-pointer text-indigo-600 dark:text-indigo-400"
                  title="Print certified A4 landscape service logbook"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print Logbook</span>
                </Button>
              </Link>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isExporting}
                onClick={() => handleExport('xlsx')}
                className="hidden md:inline-flex h-8.5 px-2.5 text-xs rounded-xl border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-800 gap-1.5 shrink-0 cursor-pointer text-emerald-600 dark:text-emerald-400"
                title="Download Excel (.xlsx) service register"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Excel</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isExporting}
                onClick={() => handleExport('csv')}
                className="hidden md:inline-flex h-8.5 px-2.5 text-xs rounded-xl border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-800 gap-1.5 shrink-0 cursor-pointer"
                title="Download CSV log"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>CSV</span>
              </Button>
            </div>
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
                  : statusFilter === 'active'
                  ? 'No active fault tickets awaiting triage or repair.'
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

              // Deduplicate category if title already contains or equals it
              const isCategoryDuplicate = Boolean(
                issue.category &&
                  (issue.category.name.trim().toLowerCase() === issue.title.trim().toLowerCase() ||
                    issue.title.trim().toLowerCase().includes(issue.category.name.trim().toLowerCase()) ||
                    issue.category.name.trim().toLowerCase().includes(issue.title.trim().toLowerCase()))
              )

              const severityBadgeStyle =
                issue.severity === 'critical'
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 font-black'
                  : issue.severity === 'high'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30'
                  : issue.severity === 'medium'
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30'
                  : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/20 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-500/30'

              if (isResolved) {
                // Sleek, compact 2-row card (~68px height) with subtle left border (NOT heavy full border)
                return (
                  <div
                    key={issue.id}
                    className="m-2 p-2.5 sm:p-3 rounded-xl border border-zinc-200/70 dark:border-white/[0.06] border-l-2 border-l-emerald-500/60 bg-white dark:bg-[#121927] hover:bg-zinc-50/50 dark:hover:bg-[#151E32]/70 transition-all duration-150 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                  >
                    {/* Row 1: [PC-01] + Issue Title + [LOW] + [✓ Resolved] on left | [Reopen] ghost button on right */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        {/* Workstation Badge */}
                        <div className="flex items-center gap-1 font-mono text-xs font-extrabold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-[#151E32] text-zinc-800 dark:text-white border border-zinc-200 dark:border-white/10 shrink-0">
                          <Monitor className="h-3 w-3 text-indigo-500 dark:text-indigo-400" />
                          <span>{issue.workstation_label || 'PC'}</span>
                        </div>

                        {/* Title */}
                        <h4 className="font-heading font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 truncate">
                          {issue.title}
                        </h4>

                        {/* Category (only if not redundant with title) */}
                        {issue.category && !isCategoryDuplicate && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/20 shrink-0">
                            <span className="h-1 w-1 rounded-full bg-indigo-500" />
                            <span>{issue.category.name}</span>
                          </span>
                        )}

                        {/* Severity Badge */}
                        <span className={`font-mono text-[9px] font-bold px-1.5 py-0.2 rounded uppercase shrink-0 ${severityBadgeStyle}`}>
                          {issue.severity}
                        </span>

                        {/* Status Pill */}
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 shrink-0">
                          <Check className="h-3 w-3 text-emerald-500" />
                          <span>Resolved</span>
                        </span>
                      </div>

                      {/* Right: Reopen Ghost Button */}
                      <Button
                        type="button"
                        variant="ghost"
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
                        className="h-7 px-2 text-[11px] font-semibold rounded-lg text-zinc-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10 gap-1 cursor-pointer shrink-0"
                        title="Reopen ticket"
                      >
                        <RotateCcw className="h-3 w-3 text-amber-500" />
                        <span>Reopen</span>
                      </Button>
                    </div>

                    {/* Row 2: Inline resolution notes + Closed by + Reported metadata in a clean, muted single line */}
                    <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-slate-400 truncate mt-1">
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium truncate">
                        ✓ Resolution: {issue.resolution_notes ? `"${issue.resolution_notes}"` : '"Resolved"'}
                      </span>
                      <span>•</span>
                      <span className="truncate">
                        Closed by {issue.resolved_by_name || 'System Admin'} (
                        {issue.resolved_at
                          ? new Date(issue.resolved_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })
                          : 'recently'}
                        )
                      </span>
                      <span>•</span>
                      <span className="shrink-0 text-zinc-400 dark:text-slate-500">
                        Reported{' '}
                        {new Date(issue.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                )
              }

              // Active Tickets (Awaiting Triage or Under Repair)
              return (
                <div
                  key={issue.id}
                  className={`m-2.5 p-3.5 sm:p-4 rounded-xl border transition-all duration-150 ${
                    isInProgress
                      ? 'border-l-4 border-l-rose-500 border-rose-500/30 bg-rose-500/[0.03] dark:bg-rose-950/20 shadow-xs'
                      : 'border-l-4 border-l-amber-500 border-amber-500/30 bg-amber-500/[0.03] dark:bg-amber-950/20 shadow-xs'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3.5">
                    {/* Left: Station & Symptom Metadata */}
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Workstation Badge */}
                        <div className="flex items-center gap-1.5 font-mono text-xs font-extrabold px-2.5 py-0.5 rounded-lg bg-zinc-100 dark:bg-[#151E32] text-zinc-800 dark:text-white border border-zinc-200 dark:border-white/10 shadow-xs">
                          <Monitor className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                          <span>{issue.workstation_label || 'Workstation'}</span>
                        </div>

                        {/* Title */}
                        <h4 className="font-heading font-extrabold text-sm text-zinc-950 dark:text-white">
                          {issue.title}
                        </h4>

                        {/* Category Classification (only if not redundant with title) */}
                        {issue.category && !isCategoryDuplicate && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400" />
                            <span>{issue.category.name}</span>
                          </span>
                        )}

                        {/* Severity Badge */}
                        <span className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded uppercase ${severityBadgeStyle}`}>
                          {issue.severity}
                        </span>

                        {/* Status Pill */}
                        {isInProgress ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300 border border-rose-300 dark:border-rose-500/30 animate-pulse">
                            <Wrench className="h-3 w-3" />
                            Under Repair
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30">
                            <AlertTriangle className="h-3 w-3" />
                            Awaiting Triage
                          </span>
                        )}
                      </div>

                      {/* Description / Symptoms */}
                      {issue.description && (
                        <p className="text-xs text-zinc-700 dark:text-slate-300 leading-relaxed pl-0.5 font-sans bg-zinc-50 dark:bg-black/20 p-2 rounded-lg border border-zinc-200 dark:border-white/5">
                          {issue.description}
                        </p>
                      )}

                      {/* Reporter Metadata */}
                      <div className="flex items-center gap-3 text-[11px] text-zinc-500 dark:text-slate-400 pt-0.5">
                        <span className="flex items-center gap-1.5">
                          <User className="h-3 w-3 text-zinc-400" />
                          <span>
                            Reported by <strong className="text-zinc-800 dark:text-zinc-200 font-semibold">{issue.reported_by_name || 'Staff'}</strong>
                          </span>
                        </span>
                        <span>•</span>
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
                          className="h-8.5 px-2.5 text-xs rounded-xl border-zinc-200 dark:border-white/10 bg-white/80 dark:bg-transparent text-zinc-700 dark:text-slate-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 gap-1 shadow-xs"
                          title="Revert back to Awaiting Triage"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>Revert</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150 select-none">
          <div className="relative w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#101726] p-4 sm:p-5 shadow-2xl flex flex-col max-h-[calc(100dvh-2rem)] overflow-hidden my-auto space-y-3.5 font-sans">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-white/[0.08] shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/20">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="font-heading font-extrabold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                    <span>Resolve Issue on {resolvingIssue.workstation_label}</span>
                    <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                      {resolvingIssue.workstation_label}
                    </span>
                  </h3>
                  <p className="text-[11px] text-zinc-600 dark:text-slate-400">
                    Certify problem resolution to return station to 100% Operational status.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResolvingIssue(null)}
                className="p-1 rounded-lg text-zinc-400 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-3.5 pr-0.5">
              {/* Issue Summary Card */}
              <div className="p-3 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-[#151E32]/70 text-xs space-y-1">
                <span className="font-semibold text-zinc-700 dark:text-slate-200">Reported Symptom:</span>
                <p className="text-zinc-900 dark:text-white font-medium">{resolvingIssue.title}</p>
                {resolvingIssue.description && (
                  <p className="text-zinc-600 dark:text-slate-400 text-[11px]">{resolvingIssue.description}</p>
                )}
              </div>

              {/* Resolution Form */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-zinc-800 dark:text-slate-200">
                    Corrective Action / Resolution Notes <span className="text-rose-500 dark:text-rose-400">*</span>
                  </label>
                  <textarea
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="e.g. Replaced damaged HDMI cable, ran GPU stress test, terminal confirmed operational."
                    rows={3}
                    className="w-full rounded-xl bg-zinc-50 dark:bg-[#0B0F19] border border-zinc-300 dark:border-white/10 p-2.5 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-zinc-800 dark:text-slate-200">
                    Parts Replaced / Hardware Changes (Optional)
                  </label>
                  <Input
                    value={partsReplaced}
                    onChange={(e) => setPartsReplaced(e.target.value)}
                    placeholder="e.g. HDMI Cable 2.0, 8GB DDR4 RAM stick, USB Mouse"
                    className="h-8.5 text-xs bg-zinc-50 dark:bg-[#0B0F19] border-zinc-300 dark:border-white/10 text-zinc-900 dark:text-white rounded-xl"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={createLogbookEntry}
                    onChange={(e) => setCreateLogbookEntry(e.target.checked)}
                    className="rounded border-zinc-300 dark:border-white/20 bg-zinc-50 dark:bg-[#0B0F19] text-indigo-600 focus:ring-0"
                  />
                  <span className="text-xs text-zinc-700 dark:text-slate-300">
                    Automatically create official entry in Certified Service Logbook
                  </span>
                </label>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-white/[0.08] shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setResolvingIssue(null)}
                className="h-8.5 text-xs rounded-xl border-zinc-300 dark:border-white/10 text-zinc-700 dark:text-slate-300 hover:bg-zinc-100 dark:hover:bg-white/5"
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
