'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  ShieldCheck,
  Search,
  RotateCcw,
  Download,
  Filter,
  Eye,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Layers,
  ArrowRight,
  User,
  Clock,
  Building2,
  Calendar,
  KeyRound,
  FileText,
  AlertCircle,
  X,
  Sparkles,
  Wrench,
  Info,
  Trash2,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { getAuditLogs } from '@/app/actions/audit'
import type { AuditLogItem, AuditAction, AuditEntityType } from '@/types/audit'
import { getNepaliDate } from '@/lib/nepali-date'
import {
  isInternalSystemKey,
  getHumanFieldLabel,
  formatAuditValue,
  generateOperationalGuidance,
  resolveLabName,
} from '@/lib/audit-presenter'

function formatDualTimestamp(isoDateStr: string): { ad: string; bs: string } {
  try {
    const d = new Date(isoDateStr)
    const hours = d.getHours()
    const minutes = d.getMinutes().toString().padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const formattedHours = (hours % 12 || 12).toString().padStart(2, '0')

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const adDate = `${monthNames[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} • ${formattedHours}:${minutes} ${ampm}`

    const nepali = getNepaliDate(d)
    const bsDate = `${nepali.formattedDateNp.split(',')[0]}`

    return { ad: adDate, bs: bsDate }
  } catch {
    return { ad: isoDateStr, bs: '—' }
  }
}

function getActionBadge(action: AuditAction) {
  switch (action) {
    case 'CREATE':
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-bold">
          CREATE
        </Badge>
      )
    case 'UPDATE':
      return (
        <Badge className="bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 text-[10px] font-bold">
          UPDATE
        </Badge>
      )
    case 'DELETE':
      return (
        <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 text-[10px] font-bold">
          DELETE
        </Badge>
      )
    case 'RESET':
    case 'OVERRIDE':
      return (
        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] font-bold">
          {action}
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="text-[10px] font-bold">
          {action}
        </Badge>
      )
  }
}

function getEntityTypeBadge(type: AuditEntityType) {
  switch (type) {
    case 'lab':
      return <Badge variant="outline" className="text-[10px] font-sans border-cyan-500/30 text-cyan-600 dark:text-cyan-400">Lab Facility</Badge>
    case 'schedule':
      return <Badge variant="outline" className="text-[10px] font-sans border-indigo-500/30 text-indigo-600 dark:text-indigo-400">Timetable</Badge>
    case 'user_role':
      return <Badge variant="outline" className="text-[10px] font-sans border-violet-500/30 text-violet-600 dark:text-violet-400">Access & Role</Badge>
    case 'incident_category':
      return <Badge variant="outline" className="text-[10px] font-sans border-amber-500/30 text-amber-600 dark:text-amber-400">Incident Taxonomy</Badge>
    case 'curriculum':
      return <Badge variant="outline" className="text-[10px] font-sans border-emerald-500/30 text-emerald-600 dark:text-emerald-400">Curriculum</Badge>
    case 'policy':
      return <Badge variant="outline" className="text-[10px] font-sans border-rose-500/30 text-rose-600 dark:text-rose-400">Policy</Badge>
    default:
      return <Badge variant="outline" className="text-[10px] font-sans">{type}</Badge>
  }
}

function getRoleBadge(role: string) {
  const normalized = (role || '').toLowerCase().replace(/_/g, ' ')
  if (normalized.includes('super')) {
    return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 uppercase">SUPER ADMIN</span>
  }
  if (normalized.includes('incharge')) {
    return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 uppercase">LAB INCHARGE</span>
  }
  if (normalized.includes('hod')) {
    return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 uppercase">HOD</span>
  }
  return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 uppercase">TEACHER</span>
}

/**
 * High-signal executive summary renderer for the main table row.
 * Filters out low-level plumbing (span, created_at) and presents
 * real-world operational changes in clean, institutional UI.
 */
function renderAuditTableSummary(log: AuditLogItem) {
  const changes = log.changes
  if (!changes) {
    return <span className="text-zinc-400 font-sans text-xs">System state recorded</span>
  }

  if (changes.bulk_overflow) {
    return (
      <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 font-medium">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        <span>{changes.summary}</span>
      </div>
    )
  }

  const before = changes.before || {}
  const after = changes.after || {}

  // 1. TIMETABLE / SCHEDULE
  if (log.entity_type === 'schedule') {
    if (log.action === 'DELETE') {
      return (
        <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-medium text-xs">
          <Trash2 className="h-3.5 w-3.5 shrink-0" />
          <span>Purged timetable slot allocation</span>
        </div>
      )
    }

    const subject = after.subject_name || before.subject_name || log.entity_label
    const batch = after.batch_name || before.batch_name
    const timeRange = after.start_time && after.end_time ? `${after.start_time} – ${after.end_time}` : after.time_slot
    const labName = resolveLabName(after.lab_id || before.lab_id)
    const teacher = after.metadata?.teacher || after.teacher_id

    return (
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-bold text-zinc-900 dark:text-zinc-100 text-xs">
            {subject}
          </span>
          {batch && (
            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
              Batch {batch}
            </span>
          )}
        </div>
        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 flex-wrap">
          {timeRange && <span className="font-mono text-zinc-700 dark:text-zinc-300">{timeRange}</span>}
          {timeRange && labName && <span>•</span>}
          {labName && <span>{labName}</span>}
          {teacher && <span>•</span>}
          {teacher && <span className="text-zinc-600 dark:text-zinc-400">{teacher}</span>}
        </div>
      </div>
    )
  }

  // 2. LAB FACILITY
  if (log.entity_type === 'lab') {
    // Status change
    if (after.status) {
      const isMaint = String(after.status).toLowerCase().includes('maintenance')
      return (
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-zinc-500 font-medium">Status:</span>
          {before.status && (
            <>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 line-through">
                {before.status}
              </span>
              <ArrowRight className="h-3 w-3 text-zinc-400 shrink-0" />
            </>
          )}
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
              isMaint
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
            }`}
          >
            {isMaint && <Wrench className="h-2.5 w-2.5" />}
            {after.status}
          </span>
        </div>
      )
    }

    // Capacity change
    if (after.capacity !== undefined) {
      const prevCap = before.capacity
      const newCap = after.capacity
      const diff = typeof prevCap === 'number' ? newCap - prevCap : null

      return (
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-zinc-500 font-medium">Capacity:</span>
          {prevCap !== undefined && (
            <>
              <span className="font-mono text-zinc-400 line-through">{prevCap}</span>
              <ArrowRight className="h-3 w-3 text-zinc-400 shrink-0" />
            </>
          )}
          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
            {newCap} workstations
          </span>
          {diff !== null && (
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded">
              {diff > 0 ? `+${diff}` : diff}
            </span>
          )}
        </div>
      )
    }
  }

  // 3. GOVERNANCE & POLICY
  if (log.entity_type === 'policy') {
    if (after.precaution_active !== undefined || after.edit_mode_unlocked !== undefined) {
      const isUnlocked = after.edit_mode_unlocked === true || after.precaution_active === false
      return (
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-zinc-500 font-medium">Precaution Lock:</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
            {isUnlocked ? 'Locked' : 'Edit Mode'}
          </span>
          <ArrowRight className="h-3 w-3 text-zinc-400 shrink-0" />
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
              isUnlocked
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
            }`}
          >
            {isUnlocked ? 'Edit Mode Unlocked' : 'Precaution Active'}
          </span>
        </div>
      )
    }
  }

  // 4. INCIDENT TAXONOMY
  if (log.entity_type === 'incident_category') {
    return (
      <div className="flex items-center gap-2 flex-wrap text-xs">
        {after.severity && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 uppercase">
            {after.severity}
          </span>
        )}
        {after.sla_hours !== undefined && (
          <span className="text-zinc-600 dark:text-zinc-300 font-medium">
            SLA: {after.sla_hours}h target
          </span>
        )}
      </div>
    )
  }

  // 5. DELETION
  if (log.action === 'DELETE') {
    return (
      <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-medium text-xs">
        <Trash2 className="h-3.5 w-3.5 shrink-0" />
        <span>Archived / Removed from active infrastructure</span>
      </div>
    )
  }

  // 6. GENERAL FALLBACK (Filter out internal database noise)
  const meaningfulKeys = Object.keys(after).filter((k) => !isInternalSystemKey(k))
  const displayKeys = meaningfulKeys.length > 0 ? meaningfulKeys : Object.keys(after)

  if (displayKeys.length === 0) {
    return <span className="text-zinc-400 text-xs">System record synchronized</span>
  }

  return (
    <div className="text-xs text-zinc-600 dark:text-zinc-300 space-y-0.5">
      {displayKeys.slice(0, 2).map((k) => {
        const prevFmt = formatAuditValue(k, before[k])
        const nextFmt = formatAuditValue(k, after[k])
        return (
          <div key={k} className="flex items-center gap-1.5 flex-wrap">
            <strong className="text-zinc-800 dark:text-zinc-200 font-medium text-[11px]">
              {getHumanFieldLabel(k)}:
            </strong>
            {!prevFmt.isNull && (
              <>
                <span className="text-rose-600/80 dark:text-rose-400/80 line-through text-[11px]">
                  {prevFmt.display}
                </span>
                <ArrowRight className="h-2.5 w-2.5 text-zinc-400 shrink-0" />
              </>
            )}
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
              {nextFmt.display}
            </span>
          </div>
        )
      })}
      {displayKeys.length > 2 && (
        <span className="text-[10px] text-zinc-400 font-sans">
          +{displayKeys.length - 2} more operational properties
        </span>
      )}
    </div>
  )
}

export function InstitutionalAuditManager() {
  const [logs, setLogs] = useState<AuditLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters State
  const [entityFilter, setEntityFilter] = useState<string>('all')
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Selected Log for Diff Modal
  const [inspectingLog, setInspectingLog] = useState<AuditLogItem | null>(null)
  const [viewMode, setViewMode] = useState<'visual' | 'json'>('visual')
  const [showInternals, setShowInternals] = useState(false)
  const [copiedJson, setCopiedJson] = useState(false)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getAuditLogs({
        entityType: entityFilter,
        action: actionFilter,
        search: searchQuery,
        page,
        limit: 20,
      })
      setLogs(res.logs)
      setTotalPages(res.totalPages)
      setTotalCount(res.totalCount)
    } catch (err: any) {
      console.error('Failed to load audit logs:', err)
      setError(err?.message || 'Failed to fetch audit records.')
    } finally {
      setLoading(false)
    }
  }, [entityFilter, actionFilter, searchQuery, page])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', dataStr)
    downloadAnchor.setAttribute('download', `institutional-audit-log-${new Date().toISOString().split('T')[0]}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  const handleCopyJson = () => {
    if (!inspectingLog) return
    navigator.clipboard.writeText(JSON.stringify(inspectingLog, null, 2))
    setCopiedJson(true)
    setTimeout(() => setCopiedJson(false), 2000)
  }

  // Compute key-by-key visual rows for the inspecting log
  const diffRows = useMemo(() => {
    if (!inspectingLog || !inspectingLog.changes) return []
    const { before, after, bulk_overflow } = inspectingLog.changes

    if (bulk_overflow) return []

    const beforeKeys = before ? Object.keys(before) : []
    const afterKeys = after ? Object.keys(after) : []
    const allKeys = Array.from(new Set([...beforeKeys, ...afterKeys]))

    return allKeys.map((key) => {
      const prevVal = before ? before[key] : undefined
      const nextVal = after ? after[key] : undefined
      const isChanged = JSON.stringify(prevVal) !== JSON.stringify(nextVal)
      return { key, prevVal, nextVal, isChanged }
    })
  }, [inspectingLog])

  // Partition into high-signal primary operational attributes vs low-level system internals
  const { primaryRows, internalRows } = useMemo(() => {
    const primary = diffRows.filter((r) => !isInternalSystemKey(r.key))
    const internal = diffRows.filter((r) => isInternalSystemKey(r.key))
    // If all keys happen to be internal, display them so nothing is missing
    return {
      primaryRows: primary.length > 0 ? primary : diffRows,
      internalRows: primary.length > 0 ? internal : [],
    }
  }, [diffRows])

  // Compute executive guidance and action advice
  const guidance = useMemo(() => {
    if (!inspectingLog) return null
    return generateOperationalGuidance(inspectingLog)
  }, [inspectingLog])

  return (
    <div className="space-y-4 font-sans text-xs">
      {/* Executive Header Strip */}
      <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs">
        <CardHeader className="p-4 px-5 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-900/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-4.5 w-4.5" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-2">
                  <span>Institutional Audit Trail & Governance Ledger</span>
                  <Badge variant="outline" className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400 border-indigo-500/30">
                    Append-Only
                  </Badge>
                  <span className="text-[11px] text-zinc-400 font-normal">
                    ({totalCount} logged mutations)
                  </span>
                </CardTitle>
                <CardDescription className="text-xs text-zinc-500">
                  Cryptographic, tamper-evident history of lab statuses, access elevation, timetable allocations, and policies.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchLogs()}
                disabled={loading}
                className="gap-1.5 text-xs font-medium cursor-pointer"
              >
                <RotateCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh Ledger</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportJson}
                disabled={logs.length === 0}
                className="gap-1.5 text-xs font-medium cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export JSON</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Filter Toolbar */}
        <CardContent className="p-4 bg-white dark:bg-zinc-900 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="sm:col-span-2 relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-zinc-400" />
              <Input
                placeholder="Search by actor name, entity label, or record ID..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setPage(1)
                }}
                className="pl-8.5 h-8.5 text-xs font-sans"
              />
            </div>

            {/* Entity Type Filter */}
            <div>
              <Select
                value={entityFilter}
                onChange={(e) => {
                  setEntityFilter(e.target.value)
                  setPage(1)
                }}
                className="h-8.5 text-xs font-sans"
              >
                <option value="all">All Entity Domains</option>
                <option value="lab">Laboratory Facilities</option>
                <option value="schedule">Timetable / Schedules</option>
                <option value="user_role">Staff Access & Roles</option>
                <option value="incident_category">Incident Taxonomy</option>
                <option value="curriculum">Curriculum Subjects</option>
                <option value="policy">Institutional Policies</option>
              </Select>
            </div>

            {/* Action Filter */}
            <div>
              <Select
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value)
                  setPage(1)
                }}
                className="h-8.5 text-xs font-sans"
              >
                <option value="all">All Action Verbs</option>
                <option value="CREATE">CREATE (Allocations & Additions)</option>
                <option value="UPDATE">UPDATE (State & Credential Shifts)</option>
                <option value="DELETE">DELETE (Removals & Purges)</option>
                <option value="RESET">RESET (Factory Restores)</option>
                <option value="OVERRIDE">OVERRIDE (Administrative Overrides)</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-2xs">
        {loading ? (
          <div className="p-12 text-center space-y-2 text-zinc-500">
            <RotateCcw className="h-6 w-6 animate-spin mx-auto text-indigo-500" />
            <p className="font-medium text-xs">Loading institutional audit ledger...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-2 text-rose-500">
            <AlertTriangle className="h-6 w-6 mx-auto" />
            <p className="font-semibold">{error}</p>
            <Button variant="outline" size="sm" onClick={() => fetchLogs()}>Try Again</Button>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center space-y-2 text-zinc-500">
            <ShieldCheck className="h-8 w-8 mx-auto text-zinc-400" />
            <p className="font-medium text-xs">No audit events match your filter criteria.</p>
            <p className="text-[11px] text-zinc-400">Mutations performed in the Super Admin Console will appear here automatically.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 font-semibold text-[11px]">
                  <th className="py-2.5 px-4">Date & Time (AD / BS)</th>
                  <th className="py-2.5 px-4">Actor</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-4">Target Entity</th>
                  <th className="py-2.5 px-4 min-w-[280px]">Change Summary</th>
                  <th className="py-2.5 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {logs.map((log) => {
                  const timestamps = formatDualTimestamp(log.created_at)

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors"
                    >
                      {/* Timestamp (Dual AD + BS) */}
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <div className="font-mono text-[11px] font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                            {timestamps.ad}
                          </div>
                          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-sans">
                            {timestamps.bs}
                          </div>
                        </div>
                      </td>

                      {/* Actor */}
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <div className="font-bold text-zinc-950 dark:text-zinc-100">
                            {log.actor_name}
                          </div>
                          <div>{getRoleBadge(log.actor_role)}</div>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {getActionBadge(log.action)}
                      </td>

                      {/* Target Entity */}
                      <td className="py-2.5 px-4">
                        <div className="space-y-1">
                          <div>{getEntityTypeBadge(log.entity_type)}</div>
                          <div className="font-bold text-zinc-900 dark:text-zinc-100 line-clamp-1 max-w-[220px]">
                            {log.entity_label}
                          </div>
                        </div>
                      </td>

                      {/* Change Summary (High-Signal Executive Representation) */}
                      <td className="py-2.5 px-4">
                        {renderAuditTableSummary(log)}
                      </td>

                      {/* Action CTA: Inspect Diff */}
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setInspectingLog(log)
                            setViewMode('visual')
                            setShowInternals(false)
                          }}
                          className="h-7 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 gap-1.5 cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Inspect Diff</span>
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!loading && totalPages > 1 && (
          <div className="p-3 px-5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/30">
            <span className="text-xs text-zinc-500">
              Page {page} of {totalPages} ({totalCount} entries)
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-7 text-xs"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="h-7 text-xs"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Visual Diff & Intelligence Inspector Modal */}
      {inspectingLog && guidance && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150 select-none font-sans">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl max-w-3xl w-full p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3 shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {getActionBadge(inspectingLog.action)}
                  {getEntityTypeBadge(inspectingLog.entity_type)}
                  <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
                    {inspectingLog.entity_label}
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <strong className="text-zinc-800 dark:text-zinc-200">{inspectingLog.actor_name}</strong>
                  </span>
                  <span>•</span>
                  <span>{getRoleBadge(inspectingLog.actor_role)}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1 font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                    <Clock className="h-3 w-3" />
                    {formatDualTimestamp(inspectingLog.created_at).ad} ({formatDualTimestamp(inspectingLog.created_at).bs})
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setInspectingLog(null)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="overflow-y-auto flex-1 pr-1 space-y-4">
              
              {/* 🌟 1. EXECUTIVE OPERATIONAL GUIDANCE & CONTEXT CARD ("What Changed & What To Do Knowing That") */}
              <div className={`p-4 rounded-xl border space-y-3 ${
                guidance.severityLevel === 'warning'
                  ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-300/70 dark:border-amber-800/60'
                  : guidance.severityLevel === 'caution'
                  ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-300/70 dark:border-rose-800/60'
                  : guidance.severityLevel === 'success'
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-300/70 dark:border-emerald-800/60'
                  : 'bg-indigo-50/60 dark:bg-indigo-950/20 border-indigo-200/80 dark:border-indigo-800/60'
              }`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Sparkles className={`h-4 w-4 shrink-0 ${
                      guidance.severityLevel === 'warning'
                        ? 'text-amber-600 dark:text-amber-400'
                        : guidance.severityLevel === 'caution'
                        ? 'text-rose-600 dark:text-rose-400'
                        : guidance.severityLevel === 'success'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-indigo-600 dark:text-indigo-400'
                    }`} />
                    <span className="font-bold text-xs text-zinc-950 dark:text-white uppercase tracking-wide">
                      Audit Intelligence & Operational Guidance
                    </span>
                  </div>

                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    guidance.severityLevel === 'warning'
                      ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30'
                      : guidance.severityLevel === 'caution'
                      ? 'bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-500/30'
                      : guidance.severityLevel === 'success'
                      ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30'
                      : 'bg-indigo-500/20 text-indigo-800 dark:text-indigo-300 border border-indigo-500/30'
                  }`}>
                    {guidance.headline}
                  </span>
                </div>

                {/* Narrative: Exactly What Changed */}
                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    What Changed Exactly:
                  </div>
                  <p className="text-xs text-zinc-900 dark:text-zinc-100 font-semibold leading-relaxed">
                    {guidance.narrative}
                  </p>
                </div>

                {/* Impact & Next Steps: What To Do Knowing That */}
                <div className="p-3 rounded-lg bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/70 dark:border-zinc-800 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                    <Info className="h-3.5 w-3.5 shrink-0" />
                    <span>Operational Impact & Recommended Action:</span>
                  </div>
                  <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    {guidance.impactMessage}
                  </p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium pt-0.5 border-t border-zinc-100 dark:border-zinc-800/80">
                    👉 <strong className="text-zinc-900 dark:text-zinc-200 font-bold">Recommended Step:</strong> {guidance.actionAdvice}
                  </p>
                </div>
              </div>

              {/* Telemetry Bar */}
              <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-800 grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs shrink-0">
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block font-mono">Origin IP</span>
                  <span className="font-mono text-zinc-800 dark:text-zinc-200 text-[11px]">
                    {inspectingLog.metadata?.client_ip || '127.0.0.1 (Local)'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block font-mono">User Agent / Origin</span>
                  <span className="font-sans text-zinc-800 dark:text-zinc-200 text-[11px] truncate block max-w-[180px]">
                    {inspectingLog.metadata?.user_agent || 'Admin Console'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block font-mono">Target ID</span>
                  <span className="font-mono text-zinc-800 dark:text-zinc-200 text-[11px]">
                    {inspectingLog.entity_id || 'System Governance'}
                  </span>
                </div>
              </div>

              {/* View Toggle Mode */}
              <div className="flex items-center justify-between pt-1 shrink-0">
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 font-mono uppercase tracking-wide">
                  Structured State Comparison
                </span>
                <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setViewMode('visual')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      viewMode === 'visual'
                        ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    Key-by-Key Diff
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('json')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      viewMode === 'json'
                        ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    Raw JSON
                  </button>
                </div>
              </div>

              {/* 📊 2. STRUCTURED COMPARISON VIEW */}
              {viewMode === 'visual' ? (
                diffRows.length === 0 ? (
                  <div className="p-8 text-center text-zinc-400 font-mono text-xs">
                    No discrete field comparisons available for this entry.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Primary Operational Attributes Table */}
                    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900">
                      <div className="p-2.5 px-3.5 bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                        <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-300 font-mono uppercase tracking-wider">
                          Key Operational Attributes ({primaryRows.length})
                        </span>
                        <span className="text-[10px] text-zinc-400 font-sans">
                          Cleaned & Humanized Representation
                        </span>
                      </div>

                      <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                        {primaryRows.map((row) => {
                          const humanLabel = getHumanFieldLabel(row.key)
                          const prevFmt = formatAuditValue(row.key, row.prevVal)
                          const nextFmt = formatAuditValue(row.key, row.nextVal)

                          return (
                            <div
                              key={row.key}
                              className="p-3 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition-colors grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center"
                            >
                              {/* Left Col: Field Name & Database Key */}
                              <div className="md:col-span-4 space-y-0.5">
                                <div className="font-bold text-xs text-zinc-900 dark:text-zinc-100 font-sans">
                                  {humanLabel}
                                </div>
                                <div className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
                                  {row.key}
                                </div>
                              </div>

                              {/* Middle Col: Previous State (Before) */}
                              <div className="md:col-span-4">
                                {prevFmt.isNull ? (
                                  <div className="inline-flex items-center px-2 py-1 rounded-md text-[11px] text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60 italic font-sans">
                                    Unassigned (Initial State)
                                  </div>
                                ) : (
                                  <div className="p-1.5 px-2.5 rounded-lg text-xs bg-zinc-100/80 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 border border-zinc-200/80 dark:border-zinc-700/80 line-through">
                                    {prevFmt.display}
                                  </div>
                                )}
                              </div>

                              {/* Right Col: New State (After) */}
                              <div className="md:col-span-4">
                                {nextFmt.subDetails ? (
                                  <div className="p-2 rounded-lg bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/50 space-y-1">
                                    {nextFmt.subDetails.map((sub, i) => (
                                      <div key={i} className="flex items-center justify-between text-xs font-sans">
                                        <span className="text-zinc-500 dark:text-zinc-400 text-[11px]">{sub.label}:</span>
                                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">{sub.value}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : nextFmt.badgeStyle === 'emerald' ? (
                                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    <span>{nextFmt.display}</span>
                                  </div>
                                ) : nextFmt.badgeStyle === 'amber' ? (
                                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                    <Wrench className="h-3.5 w-3.5" />
                                    <span>{nextFmt.display}</span>
                                  </div>
                                ) : nextFmt.badgeStyle === 'rose' ? (
                                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                                    <span>{nextFmt.display}</span>
                                  </div>
                                ) : (
                                  <div className="p-1.5 px-2.5 rounded-lg text-xs bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-950 dark:text-indigo-200 font-semibold border border-indigo-200/60 dark:border-indigo-800/60">
                                    {nextFmt.display}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Collapsible Low-Level System Internals Drawer */}
                    {internalRows.length > 0 && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => setShowInternals(!showInternals)}
                          className="w-full flex items-center justify-between p-2.5 px-3.5 rounded-xl bg-zinc-100/70 dark:bg-zinc-800/50 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 text-xs font-medium text-zinc-600 dark:text-zinc-400 cursor-pointer transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <Layers className="h-3.5 w-3.5 text-zinc-400" />
                            <span>
                              Low-Level System Attributes ({internalRows.length} technical fields: {internalRows.map((r) => r.key).join(', ')})
                            </span>
                          </span>
                          {showInternals ? (
                            <ChevronDown className="h-4 w-4 text-zinc-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-zinc-400" />
                          )}
                        </button>

                        {showInternals && (
                          <div className="mt-2 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                            {internalRows.map((row) => (
                              <div
                                key={row.key}
                                className="p-2.5 px-3.5 grid grid-cols-1 md:grid-cols-12 gap-2 text-xs font-mono"
                              >
                                <div className="md:col-span-4 text-zinc-500 font-bold">
                                  {row.key}
                                </div>
                                <div className="md:col-span-4 text-zinc-400 line-through">
                                  {row.prevVal !== undefined ? String(row.prevVal) : 'empty'}
                                </div>
                                <div className="md:col-span-4 text-zinc-800 dark:text-zinc-200 font-semibold">
                                  {row.nextVal !== undefined ? String(row.nextVal) : 'empty'}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              ) : (
                /* Raw JSON View */
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-500 font-mono">
                      Cryptographic Audit Record Payload (Tamper-Evident)
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyJson}
                      className="h-7 text-xs gap-1.5 cursor-pointer"
                    >
                      {copiedJson ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedJson ? 'Copied' : 'Copy JSON'}</span>
                    </Button>
                  </div>
                  <div className="bg-zinc-950 text-zinc-200 p-4 rounded-xl font-mono text-xs overflow-x-auto border border-zinc-800 max-h-[300px]">
                    <pre className="text-[11px] leading-relaxed">
                      {JSON.stringify(inspectingLog, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInspectingLog(null)}
                className="text-xs cursor-pointer"
              >
                Close Inspector
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default InstitutionalAuditManager
