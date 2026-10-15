'use client'

import React, { useState, useEffect, useMemo, useTransition } from 'react'
import {
  Wrench,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  CheckCheck,
  Search,
  Filter,
  Monitor,
  LayoutGrid,
  MapPin,
  Sparkles,
  ChevronDown,
  ChevronRight,
  X,
  FileCheck2,
  AlertCircle,
  HelpCircle,
  Info,
  Check,
  PauseCircle,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  FleetTerminalStatus,
  FleetProgressMap,
  FleetProgressSummary,
  calculateFleetProgressSummary,
  sortWorkstationLabels,
  groupWorkstationLabelsByRow,
} from '@/lib/types/maintenance-fleet'
import {
  getFleetRoutineProgress,
  updateFleetTerminalStatus,
  batchUpdateFleetTerminalStatus,
  resetFleetRoutineProgress,
  archiveFleetRoutineToLog,
} from '@/app/actions/maintenance-fleet'
import type { MaintenancePlanRecord } from '@/app/actions/maintenance'

interface FleetRoutineModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  plan: MaintenancePlanRecord
}

interface WorkstationCoordinate {
  id: string
  label: string
  pos_x: number
  pos_y: number
  row_label?: string | null
}

export default function FleetRoutineModal({
  isOpen,
  onClose,
  onSuccess,
  plan,
}: FleetRoutineModalProps) {
  const [activeView, setActiveView] = useState<'grid' | 'floor'>('grid')
  const [selectedRow, setSelectedRow] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'blocked'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isPending, startTransition] = useTransition()

  // Routine execution state
  const [targetMachines, setTargetMachines] = useState<string[]>([])
  const [fleetProgress, setFleetProgress] = useState<FleetProgressMap>({})
  const [workstations, setWorkstations] = useState<WorkstationCoordinate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Block note editing state
  const [editingBlockedStation, setEditingBlockedStation] = useState<string | null>(null)
  const [blockedNoteInput, setBlockedNoteInput] = useState('')

  // SOP Checklist expanded
  const [showChecklist, setShowChecklist] = useState(false)

  // Archival Modal Confirmation State
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false)
  const [archiveRemarks, setArchiveRemarks] = useState('')
  const [archiveParts, setArchiveParts] = useState('')
  const [isArchiving, setIsArchiving] = useState(false)

  // 1. Fetch initial progress on open
  useEffect(() => {
    if (!isOpen || !plan.id) return
    let isMounted = true

    async function loadData() {
      setIsLoading(true)
      setErrorMsg(null)
      try {
        const res = await getFleetRoutineProgress(plan.id)
        if (!isMounted) return
        if (res.success && res.plan) {
          setTargetMachines(res.plan.targetMachines || [])
          setFleetProgress(res.plan.fleetProgress || {})
          setWorkstations(res.workstations || [])
        }
      } catch (err) {
        if (!isMounted) return
        setErrorMsg(err instanceof Error ? err.message : 'Failed to load fleet maintenance data')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadData()
    return () => {
      isMounted = false
    }
  }, [isOpen, plan.id])

  // Computed summary
  const summary: FleetProgressSummary = useMemo(() => {
    return calculateFleetProgressSummary(targetMachines, fleetProgress)
  }, [targetMachines, fleetProgress])

  // Row groups
  const rowGroups = useMemo(() => {
    return groupWorkstationLabelsByRow(targetMachines)
  }, [targetMachines])

  // Filtered machines
  const filteredMachines = useMemo(() => {
    return targetMachines.filter((label) => {
      // Row filter
      if (selectedRow !== 'all') {
        const matchingGroup = rowGroups.find((g) => g.rowLabel === selectedRow)
        if (matchingGroup && !matchingGroup.items.includes(label)) {
          return false
        }
      }

      // Status filter
      const entry = fleetProgress[label]
      const status = entry?.status || 'pending'
      if (statusFilter !== 'all' && status !== statusFilter) {
        return false
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchLabel = label.toLowerCase().includes(q)
        const matchNote = (entry?.notes || '').toLowerCase().includes(q)
        if (!matchLabel && !matchNote) return false
      }

      return true
    })
  }, [targetMachines, fleetProgress, selectedRow, statusFilter, searchQuery, rowGroups])

  // Cycle machine status: pending -> completed -> blocked -> pending
  const handleCycleStatus = (label: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const current = fleetProgress[label]?.status || 'pending'
    let next: FleetTerminalStatus = 'completed'
    if (current === 'completed') next = 'blocked'
    else if (current === 'blocked') next = 'pending'
    else next = 'completed'

    if (next === 'blocked') {
      // Open quick note input
      setEditingBlockedStation(label)
      setBlockedNoteInput(fleetProgress[label]?.notes || '')
    }

    // Optimistic update
    setFleetProgress((prev) => ({
      ...prev,
      [label]: {
        ...prev[label],
        status: next,
        updated_at: new Date().toISOString(),
      },
    }))

    startTransition(async () => {
      try {
        await updateFleetTerminalStatus(plan.id, label, next)
      } catch (err) {
        console.error('Failed to update terminal status:', err)
      }
    })
  }

  // Save blocked note
  const handleSaveBlockedNote = () => {
    if (!editingBlockedStation) return
    const station = editingBlockedStation
    const note = blockedNoteInput.trim()

    setFleetProgress((prev) => ({
      ...prev,
      [station]: {
        ...prev[station],
        status: 'blocked',
        notes: note,
        updated_at: new Date().toISOString(),
      },
    }))

    setEditingBlockedStation(null)

    startTransition(async () => {
      try {
        await updateFleetTerminalStatus(plan.id, station, 'blocked', note)
      } catch (err) {
        console.error('Failed to save blocked note:', err)
      }
    })
  }

  // Batch action: Mark current filtered stations completed
  const handleBatchMarkCompleted = () => {
    const toUpdate = filteredMachines.filter((label) => fleetProgress[label]?.status !== 'completed')
    if (toUpdate.length === 0) return

    setFleetProgress((prev) => {
      const next = { ...prev }
      toUpdate.forEach((label) => {
        next[label] = {
          ...next[label],
          status: 'completed',
          updated_at: new Date().toISOString(),
        }
      })
      return next
    })

    startTransition(async () => {
      try {
        await batchUpdateFleetTerminalStatus(plan.id, toUpdate, 'completed')
      } catch (err) {
        console.error('Failed to batch update terminals:', err)
      }
    })
  }

  // Batch action: Reset current filtered stations to pending
  const handleBatchResetPending = () => {
    const toUpdate = filteredMachines.filter((label) => fleetProgress[label]?.status !== 'pending')
    if (toUpdate.length === 0) return

    setFleetProgress((prev) => {
      const next = { ...prev }
      toUpdate.forEach((label) => {
        next[label] = {
          ...next[label],
          status: 'pending',
          notes: '',
          updated_at: new Date().toISOString(),
        }
      })
      return next
    })

    startTransition(async () => {
      try {
        await batchUpdateFleetTerminalStatus(plan.id, toUpdate, 'pending')
      } catch (err) {
        console.error('Failed to batch reset terminals:', err)
      }
    })
  }

  // Reset entire routine
  const handleResetEntireRoutine = () => {
    if (!confirm('Are you sure you want to reset all terminals in this routine back to Pending?')) {
      return
    }

    setFleetProgress((prev) => {
      const next: FleetProgressMap = {}
      targetMachines.forEach((label) => {
        next[label] = { status: 'pending', updated_at: new Date().toISOString() }
      })
      return next
    })

    startTransition(async () => {
      try {
        await resetFleetRoutineProgress(plan.id)
      } catch (err) {
        console.error('Failed to reset routine progress:', err)
      }
    })
  }

  // Archive to official log
  const handleConfirmArchive = async () => {
    setIsArchiving(true)
    try {
      const res = await archiveFleetRoutineToLog({
        planId: plan.id,
        remarks: archiveRemarks.trim() || undefined,
        partsReplaced: archiveParts.trim() || undefined,
      })
      if (res.success) {
        setIsArchiveModalOpen(false)
        onSuccess?.()
        onClose()
      } else {
        alert(res.error || 'Failed to archive maintenance log')
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error archiving maintenance log')
    } finally {
      setIsArchiving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto font-sans animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0B0F19] border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* 1. COMPACT PURPOSE-BUILT HEADER */}
        <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 flex items-start justify-between gap-4 shrink-0">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20">
                <Wrench className="h-3 w-3" />
                Fleet Execution Routine
              </span>
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                {plan.category || 'General Routine'}
              </span>
              <span className="text-zinc-300 dark:text-zinc-700">•</span>
              <span className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300 uppercase">
                {plan.lab_id === 'comp' ? 'Computer Lab 01' : plan.lab_id}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-heading font-bold text-zinc-900 dark:text-white">
              {plan.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 2. HIGH-DENSITY KPI STRIP (RULE #10 & RULE #7) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 sm:px-5 bg-white dark:bg-[#0B0F19] border-b border-zinc-200/80 dark:border-zinc-800 shrink-0">
          {/* Progress Gauge */}
          <div className="glass-card p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800/80 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
              <span>Fleet Progress</span>
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                {summary.percentage}%
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-heading font-extrabold text-zinc-900 dark:text-white tabular-nums">
                {summary.completed}
                <span className="text-xs font-normal text-zinc-400 ml-1">/ {summary.total} PCs</span>
              </span>
            </div>
            {/* Slim bar */}
            <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${summary.percentage}%` }}
              />
            </div>
          </div>

          {/* Completed */}
          <div className="glass-card p-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Completed
              </span>
              <span className="font-mono text-[10px]">Optimal</span>
            </div>
            <div className="mt-1">
              <span className="text-xl sm:text-2xl font-heading font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {summary.completed}
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 ml-1.5">
                verified stations
              </span>
            </div>
            <span className="text-[10px] text-emerald-600/70 font-mono">
              {summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0}% done
            </span>
          </div>

          {/* Pending */}
          <div className="glass-card p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Pending
              </span>
              <span className="font-mono text-[10px]">Awaiting</span>
            </div>
            <div className="mt-1">
              <span className="text-xl sm:text-2xl font-heading font-extrabold text-zinc-700 dark:text-zinc-300 tabular-nums">
                {summary.pending}
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 ml-1.5">
                remaining PCs
              </span>
            </div>
            <span className="text-[10px] text-zinc-400 font-mono">
              Ready for technician
            </span>
          </div>

          {/* Blocked */}
          <div className="glass-card p-2.5 rounded-xl border border-rose-500/20 bg-rose-500/5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] font-semibold text-rose-700 dark:text-rose-400">
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                Blocked / Issues
              </span>
              <span className="font-mono text-[10px]">Action req</span>
            </div>
            <div className="mt-1">
              <span className="text-xl sm:text-2xl font-heading font-extrabold text-rose-600 dark:text-rose-400 tabular-nums">
                {summary.blocked}
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 ml-1.5">
                hardware/OS blocks
              </span>
            </div>
            <span className="text-[10px] text-rose-500 font-mono">
              {summary.blocked > 0 ? 'Requires attention' : 'Zero blocks'}
            </span>
          </div>
        </div>

        {/* 3. SOP CHECKLIST ACCORDION */}
        {plan.checklist && plan.checklist.length > 0 && (
          <div className="px-5 py-2 bg-zinc-50/80 dark:bg-zinc-900/30 border-b border-zinc-200/80 dark:border-zinc-800 shrink-0 text-xs">
            <button
              type="button"
              onClick={() => setShowChecklist((p) => !p)}
              className="flex items-center justify-between w-full text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer font-medium"
            >
              <span className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-indigo-500" />
                <span>Standard Operating Procedure ({plan.checklist.length} checklist steps)</span>
              </span>
              {showChecklist ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
            {showChecklist && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-2 pb-1 animate-in slide-in-from-top-1 duration-150">
                {plan.checklist.map((step, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 bg-white dark:bg-zinc-900 p-2 rounded-lg border border-zinc-200/80 dark:border-zinc-800 text-[11.5px] text-zinc-700 dark:text-zinc-300"
                  >
                    <span className="h-4 w-4 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="leading-snug">{step}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. CONTROLS TOOLBAR: TABS, ROW FILTERS, BATCH ACTIONS */}
        <div className="p-3 sm:px-5 bg-white dark:bg-[#0B0F19] border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            {/* Dual-View Switcher */}
            <div className="bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded-xl flex items-center border border-zinc-200/80 dark:border-zinc-800 text-xs">
              <button
                type="button"
                onClick={() => setActiveView('grid')}
                className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  activeView === 'grid'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-bold'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Grid View</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView('floor')}
                className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  activeView === 'floor'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-bold'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                <MapPin className="h-3.5 w-3.5 text-indigo-400" />
                <span>CAD Floor View</span>
              </button>
            </div>

            {/* Row Filter Pills (in Grid View) */}
            {activeView === 'grid' && (
              <div className="hidden sm:flex items-center gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedRow('all')}
                  className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                    selectedRow === 'all'
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  All Rows
                </button>
                {rowGroups.map((rg) => (
                  <button
                    key={rg.rowLabel}
                    type="button"
                    onClick={() => setSelectedRow(rg.rowLabel)}
                    className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                      selectedRow === rg.rowLabel
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold'
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {rg.rowLabel}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Search & Batch Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search PC..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 pr-2.5 rounded-lg text-xs bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 w-28 sm:w-36"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleBatchMarkCompleted}
              disabled={isPending || filteredMachines.length === 0}
              className="h-8 px-2.5 text-xs rounded-lg gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
              title="Mark all currently visible stations as completed"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Mark Visible Complete</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleBatchResetPending}
              disabled={isPending || filteredMachines.length === 0}
              className="h-8 px-2.5 text-xs rounded-lg gap-1 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              title="Reset visible stations to pending"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </Button>
          </div>
        </div>

        {/* 5. MAIN CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-zinc-50/50 dark:bg-[#070A11]">
          {isLoading ? (
            <div className="py-20 text-center space-y-3">
              <div className="inline-block animate-spin h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
              <p className="text-xs text-zinc-500">Loading terminal fleet data...</p>
            </div>
          ) : errorMsg ? (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs text-center space-y-2">
              <AlertTriangle className="h-5 w-5 mx-auto" />
              <p>{errorMsg}</p>
            </div>
          ) : activeView === 'grid' ? (
            /* VIEW A: MACHINE GRID VIEW */
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
                {filteredMachines.map((label) => {
                  const entry = fleetProgress[label]
                  const status = entry?.status || 'pending'
                  const isCompleted = status === 'completed'
                  const isBlocked = status === 'blocked'

                  return (
                    <div
                      key={label}
                      onClick={(e) => handleCycleStatus(label, e)}
                      className={`relative p-2.5 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between min-h-[92px] group ${
                        isCompleted
                          ? 'bg-emerald-500/10 border-emerald-500/30 dark:bg-emerald-500/5 hover:border-emerald-500/50'
                          : isBlocked
                          ? 'bg-rose-500/10 border-rose-500/30 dark:bg-rose-500/5 hover:border-rose-500/50'
                          : 'bg-white dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-800 hover:border-indigo-500/40 hover:shadow-xs'
                      }`}
                    >
                      {/* Top Row: Icon + Label */}
                      <div className="flex items-center justify-between">
                        <span className="font-heading font-extrabold text-xs text-zinc-900 dark:text-white group-hover:text-indigo-400 transition">
                          {label}
                        </span>
                        {isCompleted ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        ) : isBlocked ? (
                          <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 animate-pulse" />
                        ) : (
                          <Clock className="h-4 w-4 text-zinc-400 shrink-0" />
                        )}
                      </div>

                      {/* Middle Note or Info */}
                      <div className="my-1">
                        {isBlocked ? (
                          <p className="text-[10px] text-rose-600 dark:text-rose-400 font-medium line-clamp-2 leading-tight">
                            {entry?.notes || 'Blocked / Needs Attention'}
                          </p>
                        ) : isCompleted ? (
                          <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                            ✓ Serviced
                          </p>
                        ) : (
                          <p className="text-[10px] text-zinc-400">
                            Tap to complete
                          </p>
                        )}
                      </div>

                      {/* Bottom Micro Status Bar */}
                      <div className="flex items-center justify-between pt-1 border-t border-zinc-100 dark:border-zinc-800/60 text-[9.5px]">
                        <span
                          className={`font-semibold capitalize ${
                            isCompleted
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : isBlocked
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-zinc-400'
                          }`}
                        >
                          {status}
                        </span>
                        <span className="text-[9px] text-zinc-400 opacity-60 group-hover:opacity-100">
                          cycle ⇄
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {filteredMachines.length === 0 && (
                <div className="py-16 text-center text-xs text-zinc-400 space-y-1">
                  <Filter className="h-6 w-6 mx-auto text-zinc-300 dark:text-zinc-700" />
                  <p>No workstations matching your active filters.</p>
                </div>
              )}
            </div>
          ) : (
            /* VIEW B: INTERACTIVE CAD FLOOR PLAN VIEW */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 px-1">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Interactive Room Floor Plan — Click any desk to cycle maintenance status</span>
                </span>
                <span className="text-[11px] font-mono">
                  Scale: 100% Floor Bounds
                </span>
              </div>

              {/* Blueprint Canvas Box */}
              <div className="relative w-full h-[460px] sm:h-[500px] bg-white dark:bg-[#090D16] border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden p-4 shadow-inner">
                {/* Visual Grid Lines */}
                <div
                  className="absolute inset-0 opacity-15 pointer-events-none"
                  style={{
                    backgroundImage:
                      'radial-gradient(circle at 1px 1px, rgba(99, 102, 241, 0.4) 1px, transparent 0)',
                    backgroundSize: '24px 24px',
                  }}
                />

                {/* Front Whiteboard / Podium Bar */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-48 h-3 bg-zinc-200 dark:bg-zinc-800 rounded-full border border-zinc-300 dark:border-zinc-700 flex items-center justify-center">
                  <span className="text-[8px] font-bold uppercase tracking-wider text-zinc-500">
                    Whiteboard / Front Wall
                  </span>
                </div>

                {/* Workstation Nodes on CAD Canvas */}
                {workstations.map((ws) => {
                  const entry = fleetProgress[ws.label]
                  const status = entry?.status || 'pending'
                  const isCompleted = status === 'completed'
                  const isBlocked = status === 'blocked'
                  const isTeacher = ws.label.toLowerCase().includes('teacher') || ws.label.toLowerCase().includes('podium')

                  return (
                    <div
                      key={ws.id}
                      onClick={(e) => handleCycleStatus(ws.label, e)}
                      style={{
                        left: `${ws.pos_x}%`,
                        top: `${ws.pos_y}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                      className={`absolute cursor-pointer transition-transform hover:scale-110 select-none z-10 flex flex-col items-center group`}
                    >
                      {/* Node Pill */}
                      <div
                        className={`h-9 px-2 min-w-[54px] rounded-lg border shadow-xs flex items-center justify-center gap-1 transition-all ${
                          isCompleted
                            ? 'bg-emerald-500 text-white border-emerald-400 font-bold'
                            : isBlocked
                            ? 'bg-rose-500 text-white border-rose-400 font-bold animate-pulse'
                            : 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700'
                        } ${isTeacher ? 'ring-2 ring-indigo-500' : ''}`}
                      >
                        {isCompleted ? (
                          <Check className="h-3 w-3 stroke-[3]" />
                        ) : isBlocked ? (
                          <AlertTriangle className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3 text-zinc-400" />
                        )}
                        <span className="text-[10px] font-mono font-bold tracking-tight">
                          {ws.label}
                        </span>
                      </div>

                      {/* Tooltip on hover */}
                      <div className="hidden group-hover:block absolute -top-7 bg-zinc-900 text-white text-[9.5px] px-2 py-0.5 rounded-md whitespace-nowrap shadow-md z-30 pointer-events-none">
                        {status.toUpperCase()} • Click to cycle
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* 6. BOTTOM ACTION BAR: ARCHIVE AS CERTIFIED LOG & DISMISS */}
        <div className="p-3 sm:p-4 bg-white dark:bg-zinc-900/90 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetEntireRoutine}
              className="h-9 px-3 text-xs rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-500/30 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              <span>Reset All Progress</span>
            </Button>

            <span className="text-xs text-zinc-400 hidden sm:inline">
              Progress auto-saves to database in real-time.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-9 px-4 text-xs font-semibold rounded-xl cursor-pointer"
            >
              Keep In-Progress & Close
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => setIsArchiveModalOpen(true)}
              className="h-9 px-4 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <FileCheck2 className="h-4 w-4" />
              <span>Archive as Certified Log</span>
            </Button>
          </div>
        </div>
      </div>

      {/* MODAL 1: BLOCKED ISSUE REASON NOTE */}
      {editingBlockedStation && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 max-w-sm w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-rose-500" />
                <span>Flag Workstation Block: {editingBlockedStation}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingBlockedStation(null)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-500">
              Provide brief technical diagnostic reason why this PC could not be serviced (e.g. Broken monitor, OS corrupt, Blue Screen).
            </p>

            <Input
              type="text"
              placeholder="e.g. BSOD on boot, no network cable"
              value={blockedNoteInput}
              onChange={(e) => setBlockedNoteInput(e.target.value)}
              className="text-xs rounded-lg"
              autoFocus
            />

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingBlockedStation(null)}
                className="h-8 text-xs rounded-lg"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveBlockedNote}
                className="h-8 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white"
              >
                Save Block Reason
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ARCHIVE AS CERTIFIED SERVICE LOG CONFIRMATION */}
      {isArchiveModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-heading font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <FileCheck2 className="h-5 w-5 text-indigo-500" />
                <span>Archive Fleet Service Log</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsArchiveModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
              <p>
                This action will write an official certified maintenance log into{' '}
                <strong className="text-zinc-900 dark:text-white font-mono">public.maintenance_logs</strong> with complete audit verification.
              </p>

              <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 space-y-1 text-xs">
                <div className="flex justify-between font-medium">
                  <span>Routine:</span>
                  <span className="font-bold text-zinc-900 dark:text-white">{plan.title}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Completed:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {summary.completed} / {summary.total} PCs ({summary.percentage}%)
                  </span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Blocked:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    {summary.blocked} stations
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Technician Certification Remarks:
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Python 3.12 verified, all batch tests passed"
                  value={archiveRemarks}
                  onChange={(e) => setArchiveRemarks(e.target.value)}
                  className="text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Parts / Consumables Replaced (Optional):
                </label>
                <Input
                  type="text"
                  placeholder="e.g. 2 tubes Arctic MX-4 thermal paste, 3 Cat6 cables"
                  value={archiveParts}
                  onChange={(e) => setArchiveParts(e.target.value)}
                  className="text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsArchiveModalOpen(false)}
                className="h-9 px-3 text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmArchive}
                disabled={isArchiving}
                className="h-9 px-4 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                {isArchiving ? (
                  <>
                    <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Archiving...</span>
                  </>
                ) : (
                  <>
                    <FileCheck2 className="h-4 w-4" />
                    <span>Certify & Submit Log</span>
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
