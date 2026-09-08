'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Check,
  AlertTriangle,
  RotateCcw,
  CheckCheck,
  Monitor,
  Plus,
  Minus,
  Trash2,
  Sliders,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export type WorkstationState = 'pending' | 'serviced' | 'flagged'

interface WorkstationMatrixSelectorProps {
  initialServiced?: string[]
  initialFlagged?: string[]
  totalWorkstations?: number
  labName?: string
  onChange: (data: {
    serviced: string[]
    flagged: string[]
    summaryText: string
  }) => void
}

export default function WorkstationMatrixSelector({
  initialServiced = [],
  initialFlagged = [],
  totalWorkstations = 40,
  labName = 'Computer Lab 01',
  onChange,
}: WorkstationMatrixSelectorProps) {
  // Generate initial list of PCs based on capacity
  const generateDefaultIds = (count: number) => {
    return Array.from({ length: Math.max(1, count) }, (_, i) => {
      const num = i + 1
      return `PC-${num < 10 ? '0' : ''}${num}`
    })
  }

  // Workstation IDs state (allows dynamic additions / removals)
  const [workstationIds, setWorkstationIds] = useState<string[]>(() =>
    generateDefaultIds(totalWorkstations)
  )

  // Track if user is in "Configure Stations" mode
  const [isConfiguring, setIsConfiguring] = useState(false)
  const [newStationInput, setNewStationInput] = useState('')
  const [customError, setCustomError] = useState<string | null>(null)

  // Sync with prop when totalWorkstations changes and not actively configured
  useEffect(() => {
    setWorkstationIds((prev) => {
      // If the length already matches or stations were customized, don't clobber unless empty
      if (prev.length === totalWorkstations) return prev
      return generateDefaultIds(totalWorkstations)
    })
  }, [totalWorkstations])

  // Station status tracking (pending | serviced | flagged)
  const [states, setStates] = useState<Record<string, WorkstationState>>(() => {
    const initial: Record<string, WorkstationState> = {}
    workstationIds.forEach((id) => {
      if (initialFlagged.includes(id)) {
        initial[id] = 'flagged'
      } else if (initialServiced.includes(id)) {
        initial[id] = 'serviced'
      } else {
        initial[id] = 'pending'
      }
    })
    return initial
  })

  // Group into Rows of 10 Desks (Rows A, B, C, D, E, etc.)
  const rows = useMemo(() => {
    const rowLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
    const result: { letter: string; items: string[] }[] = []
    const perRow = 10
    const totalRows = Math.ceil(workstationIds.length / perRow)

    for (let r = 0; r < totalRows; r++) {
      result.push({
        letter: rowLetters[r] || `R${r + 1}`,
        items: workstationIds.slice(r * perRow, (r + 1) * perRow),
      })
    }
    return result
  }, [workstationIds])

  // Count metrics
  const servicedList = useMemo(
    () => workstationIds.filter((id) => states[id] === 'serviced'),
    [workstationIds, states]
  )
  const flaggedList = useMemo(
    () => workstationIds.filter((id) => states[id] === 'flagged'),
    [workstationIds, states]
  )
  const pendingCount = workstationIds.length - servicedList.length - flaggedList.length

  // Synchronize upstream on state change
  useEffect(() => {
    let summaryText = ''
    if (servicedList.length === workstationIds.length && workstationIds.length > 0) {
      summaryText = `All ${workstationIds.length} Workstations Serviced (${workstationIds[0]} to ${workstationIds[workstationIds.length - 1]})`
    } else if (servicedList.length > 0 && flaggedList.length > 0) {
      summaryText = `${servicedList.length} Workstations Serviced, ${flaggedList.length} Flagged (${flaggedList.join(', ')})`
    } else if (servicedList.length > 0) {
      summaryText = `${servicedList.length} of ${workstationIds.length} Workstations Serviced (${servicedList.slice(0, 4).join(', ')}${servicedList.length > 4 ? `... +${servicedList.length - 4}` : ''})`
    } else if (flaggedList.length > 0) {
      summaryText = `${flaggedList.length} Workstations Flagged for Repair (${flaggedList.join(', ')})`
    } else {
      summaryText = `${labName} (${workstationIds.length} Workstations - Pending Selection)`
    }

    onChange({
      serviced: servicedList,
      flagged: flaggedList,
      summaryText,
    })
  }, [servicedList, flaggedList, workstationIds, labName, onChange])

  // 0ms Optimistic 3-State Cycle: Pending -> Serviced -> Flagged -> Pending
  const toggleWorkstation = (id: string) => {
    if (isConfiguring) return // Disable normal cycle when editing station layout
    setStates((prev) => {
      const current = prev[id] || 'pending'
      let next: WorkstationState = 'serviced'
      if (current === 'serviced') next = 'flagged'
      else if (current === 'flagged') next = 'pending'
      else next = 'serviced'

      return {
        ...prev,
        [id]: next,
      }
    })
  }

  // --- Dynamic Station Management Handlers ---

  // 1. Add single PC (appends next sequential number)
  const handleAddSequentialPC = () => {
    setWorkstationIds((prev) => {
      const numbers = prev
        .map((id) => {
          const match = id.match(/PC-(\d+)/)
          return match ? parseInt(match[1], 10) : 0
        })
        .filter((n) => !isNaN(n))
      const nextNum = (numbers.length > 0 ? Math.max(...numbers) : prev.length) + 1
      const newId = `PC-${nextNum < 10 ? '0' : ''}${nextNum}`
      if (prev.includes(newId)) {
        return [...prev, `PC-${nextNum + 1}`]
      }
      return [...prev, newId]
    })
    setCustomError(null)
  }

  // 2. Remove last PC
  const handleRemoveLastPC = () => {
    if (workstationIds.length <= 1) return
    const idToRemove = workstationIds[workstationIds.length - 1]
    setWorkstationIds((prev) => prev.slice(0, -1))
    setStates((prev) => {
      const copy = { ...prev }
      delete copy[idToRemove]
      return copy
    })
    setCustomError(null)
  }

  // 3. Remove specific PC number (e.g. PC-15 was decommissioned or sent for repair)
  const handleRemoveSpecificStation = (idToRemove: string) => {
    if (workstationIds.length <= 1) {
      setCustomError('At least 1 workstation must remain in the grid.')
      return
    }
    setWorkstationIds((prev) => prev.filter((id) => id !== idToRemove))
    setStates((prev) => {
      const copy = { ...prev }
      delete copy[idToRemove]
      return copy
    })
    setCustomError(null)
  }

  // 4. Add custom workstation identifier (e.g. "PC-41", "SRV-01", "INSTRUCTOR-PC")
  const handleAddCustomStation = (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    const trimmed = newStationInput.trim().toUpperCase()
    if (!trimmed) return

    if (workstationIds.includes(trimmed)) {
      setCustomError(`Station "${trimmed}" already exists in the grid.`)
      return
    }

    setWorkstationIds((prev) => [...prev, trimmed])
    setNewStationInput('')
    setCustomError(null)
  }

  // 5. Jump to preset count (30, 36, 40, 48)
  const handleSetPresetCount = (count: number) => {
    setWorkstationIds(generateDefaultIds(count))
    setStates({})
    setCustomError(null)
  }

  // 6. Reset to default capacity
  const handleResetToDefault = () => {
    setWorkstationIds(generateDefaultIds(totalWorkstations))
    setStates({})
    setCustomError(null)
  }

  // Batch actions
  const selectAll = () => {
    const updated: Record<string, WorkstationState> = {}
    workstationIds.forEach((id) => {
      updated[id] = 'serviced'
    })
    setStates(updated)
  }

  const invertSelection = () => {
    setStates((prev) => {
      const updated: Record<string, WorkstationState> = {}
      workstationIds.forEach((id) => {
        const current = prev[id] || 'pending'
        if (current === 'pending') updated[id] = 'serviced'
        else if (current === 'serviced') updated[id] = 'pending'
        else updated[id] = current
      })
      return updated
    })
  }

  const selectProblematicOnly = () => {
    setStates((prev) => {
      const updated: Record<string, WorkstationState> = {}
      workstationIds.forEach((id) => {
        if (prev[id] === 'flagged') {
          updated[id] = 'flagged'
        } else {
          updated[id] = 'pending'
        }
      })
      if (Object.values(updated).filter((s) => s === 'flagged').length === 0) {
        if (workstationIds[13]) updated[workstationIds[13]] = 'flagged'
        if (workstationIds[27]) updated[workstationIds[27]] = 'flagged'
      }
      return updated
    })
  }

  const clearAll = () => {
    const updated: Record<string, WorkstationState> = {}
    workstationIds.forEach((id) => {
      updated[id] = 'pending'
    })
    setStates(updated)
  }

  return (
    <div className="space-y-3 p-3.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 select-none">
      {/* Header & Status Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-zinc-200/60 dark:border-zinc-800/80">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/60 dark:border-indigo-800/60 shrink-0">
            <Monitor className="h-3.5 w-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold font-heading text-zinc-950 dark:text-white flex items-center gap-1.5">
              <span>Interactive Workstation Grid</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold">
                {workstationIds.length} PCs
              </span>
            </h4>
            <p className="text-[11px] text-zinc-500 font-sans">
              {isConfiguring ? (
                <span className="text-amber-600 dark:text-amber-400 font-semibold">
                  Layout Mode: Click any red [×] to remove a PC, or use the controls below to add stations.
                </span>
              ) : (
                <>
                  Click desk to cycle:{' '}
                  <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">1-Click (Cleaned)</strong> •{' '}
                  <strong className="text-rose-600 dark:text-rose-400 font-semibold">2-Clicks (Flagged)</strong> •{' '}
                  <span className="text-zinc-400">3-Clicks (Reset)</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Action / Mode Toggle & Metrics */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setIsConfiguring(!isConfiguring)
              setCustomError(null)
            }}
            className={`h-7 px-2.5 text-[11px] font-sans font-semibold rounded-lg cursor-pointer flex items-center gap-1.5 transition-colors ${
              isConfiguring
                ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700'
                : 'text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Sliders className="h-3 w-3" />
            <span>{isConfiguring ? 'Done Editing' : 'Add / Remove PCs'}</span>
          </Button>

          {/* Live Counter Badges (only when not configuring) */}
          {!isConfiguring && (
            <div className="flex items-center gap-1.5 font-mono text-[10px]">
              <span className="px-2 py-0.5 rounded-full font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800/60 flex items-center gap-1">
                <Check className="h-3 w-3" />
                <span>{servicedList.length}</span>
              </span>

              {flaggedList.length > 0 && (
                <span className="px-2 py-0.5 rounded-full font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-300/60 dark:border-rose-800/60 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  <span>{flaggedList.length}</span>
                </span>
              )}

              <span className="px-2 py-0.5 rounded-full text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                {pendingCount}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* --- WORKSTATION CONFIGURATION DRAWER (Add / Remove PC Toolbar) --- */}
      {isConfiguring && (
        <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 space-y-2.5 animate-in fade-in duration-150">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            {/* Stepper Controls */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                Station Count:
              </span>
              <div className="flex items-center border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-900 shadow-2xs">
                <button
                  type="button"
                  onClick={handleRemoveLastPC}
                  disabled={workstationIds.length <= 1}
                  title="Remove highest PC"
                  className="h-7 w-7 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="px-2.5 text-xs font-mono font-bold text-zinc-900 dark:text-white">
                  {workstationIds.length}
                </span>
                <button
                  type="button"
                  onClick={handleAddSequentialPC}
                  title="Add next PC"
                  className="h-7 w-7 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1 pl-1">
                {[30, 36, 40, 48].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleSetPresetCount(preset)}
                    className={`h-7 px-2 text-[10px] font-mono font-bold rounded-md border cursor-pointer transition-colors ${
                      workstationIds.length === preset
                        ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                        : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Identifier Input */}
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                placeholder="Custom ID (e.g. PC-41)"
                value={newStationInput}
                onChange={(e) => setNewStationInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    e.stopPropagation()
                    handleAddCustomStation(e)
                  }
                }}
                className="h-7 px-2.5 text-xs font-mono rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500 w-44"
              />
              <Button
                type="button"
                size="sm"
                onClick={handleAddCustomStation}
                className="h-7 px-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                <span>Add Station</span>
              </Button>
            </div>

            {/* Reset to Lab Default */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetToDefault}
              className="h-7 px-2 text-[11px] font-sans text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset to {totalWorkstations}</span>
            </Button>
          </div>

          {customError && (
            <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
              {customError}
            </p>
          )}
        </div>
      )}

      {/* Batch Action Toolbar (only in logging mode) */}
      {!isConfiguring && (
        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5">
          <div className="flex flex-wrap items-center gap-1.5 font-mono">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={selectAll}
              className="h-7 px-2.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 border-emerald-300/70 dark:border-emerald-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer flex items-center gap-1"
            >
              <CheckCheck className="h-3 w-3" />
              <span>Select All ({workstationIds.length})</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={invertSelection}
              className="h-7 px-2 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <span>Invert</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={selectProblematicOnly}
              className="h-7 px-2 text-[11px] font-semibold text-rose-700 dark:text-rose-300 border-rose-300/70 dark:border-rose-800/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer flex items-center gap-1"
            >
              <AlertTriangle className="h-3 w-3" />
              <span>Flag Faults</span>
            </Button>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="h-7 px-2 text-[11px] font-mono text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 cursor-pointer flex items-center gap-1"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset</span>
          </Button>
        </div>
      )}

      {/* Dynamic Workstation Matrix Grid (Rows A to N, 10 desks per row) */}
      <div className="space-y-2 pt-1 font-mono">
        {rows.map((row) => (
          <div key={row.letter} className="flex items-center gap-2">
            <span className="w-5 text-[10px] font-black text-zinc-400 dark:text-zinc-500 text-center shrink-0">
              {row.letter}
            </span>

            <div className="flex-1 grid grid-cols-5 sm:grid-cols-10 gap-1.5">
              {row.items.map((id) => {
                const state = states[id] || 'pending'
                const isServiced = state === 'serviced'
                const isFlagged = state === 'flagged'

                return (
                  <div key={id} className="relative group">
                    <button
                      type="button"
                      onClick={() => toggleWorkstation(id)}
                      disabled={isConfiguring}
                      title={
                        isConfiguring
                          ? `Click the red [×] above to remove ${id}`
                          : `${id}: ${isServiced ? 'Cleaned & Tested (click to flag)' : isFlagged ? 'Fault / Damaged (click to reset)' : 'Pending (click to mark cleaned)'}`
                      }
                      className={`w-full h-8 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-2xs select-none ${
                        isConfiguring
                          ? 'border-2 border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-950/20 text-zinc-800 dark:text-zinc-200 cursor-default'
                          : 'cursor-pointer active:scale-95'
                      } ${
                        !isConfiguring && isServiced
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500 shadow-xs'
                          : !isConfiguring && isFlagged
                          ? 'bg-rose-600 hover:bg-rose-700 text-white border border-rose-500 shadow-xs animate-pulse'
                          : !isConfiguring
                          ? 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200/90 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700'
                          : ''
                      }`}
                    >
                      {!isConfiguring && isServiced ? (
                        <Check className="h-3 w-3 shrink-0 stroke-[2.5]" />
                      ) : !isConfiguring && isFlagged ? (
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                      ) : null}
                      <span className="text-[11px] tracking-tight">
                        {id.startsWith('PC-') ? id.replace('PC-', '') : id}
                      </span>
                    </button>

                    {/* Remove Pill (shown when in layout configuration mode) */}
                    {isConfiguring && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveSpecificStation(id)
                        }}
                        title={`Remove ${id} from table`}
                        className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-xs cursor-pointer z-10 transition-transform hover:scale-110"
                      >
                        <X className="h-2.5 w-2.5 stroke-[3]" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

