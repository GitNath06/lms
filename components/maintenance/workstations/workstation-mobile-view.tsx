'use client'

import React, { useState, useMemo } from 'react'
import {
  Search,
  CheckCircle2,
  ShieldAlert,
  Wrench,
  Monitor,
  Laptop,
  Layers,
  Map,
} from 'lucide-react'
import type { WorkstationWithIssues } from '@/types/workstations'

interface WorkstationMobileViewProps {
  workstations: WorkstationWithIssues[]
  onSelectWorkstation: (ws: WorkstationWithIssues) => void
  onToggleCanvasMode?: () => void
  isCanvasModeActive?: boolean
}

export function WorkstationMobileView({
  workstations,
  onSelectWorkstation,
  onToggleCanvasMode,
  isCanvasModeActive = false,
}: WorkstationMobileViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFilter, setSelectedFilter] = useState<string>('all')

  // Extract unique rows dynamically
  const rowLabels = useMemo(() => {
    const rows = new Set<string>()
    workstations.forEach((w) => {
      if (w.row_label) rows.add(w.row_label)
    })
    return Array.from(rows).sort()
  }, [workstations])

  // Filtered workstations
  const filteredWorkstations = useMemo(() => {
    return workstations.filter((ws) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchLabel = ws.label.toLowerCase().includes(q)
        const matchRow = ws.row_label?.toLowerCase().includes(q)
        const matchIssue = ws.active_issues?.some((i) => i.title.toLowerCase().includes(q))
        if (!matchLabel && !matchRow && !matchIssue) return false
      }

      // 2. Chip Filter
      if (selectedFilter === 'issues') {
        return ws.open_issues_count > 0
      }
      if (selectedFilter === 'operational') {
        return ws.open_issues_count === 0
      }
      if (selectedFilter !== 'all') {
        return ws.row_label === selectedFilter
      }

      return true
    })
  }, [workstations, searchQuery, selectedFilter])

  const flaggedCount = workstations.filter((w) => w.open_issues_count > 0).length

  return (
    <div className="space-y-3">
      {/* Mobile Control Strip: Search & Canvas Toggle */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search PC (e.g. PC-04)..."
            className="w-full rounded-xl border border-white/[0.08] bg-[#151E32] pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        {onToggleCanvasMode && (
          <button
            type="button"
            onClick={onToggleCanvasMode}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
              isCanvasModeActive
                ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                : 'border-white/[0.08] bg-[#151E32] text-slate-400 hover:text-white'
            }`}
          >
            {isCanvasModeActive ? (
              <>
                <Layers className="h-3.5 w-3.5" />
                <span>Grid View</span>
              </>
            ) : (
              <>
                <Map className="h-3.5 w-3.5" />
                <span>Floor Map</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Filter Chips Bar */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setSelectedFilter('all')}
          className={`flex-shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
            selectedFilter === 'all'
              ? 'bg-indigo-600 text-white'
              : 'border border-white/[0.08] bg-[#151E32] text-slate-400 hover:text-slate-200'
          }`}
        >
          All ({workstations.length})
        </button>

        {flaggedCount > 0 && (
          <button
            type="button"
            onClick={() => setSelectedFilter('issues')}
            className={`flex-shrink-0 flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
              selectedFilter === 'issues'
                ? 'bg-rose-600 text-white'
                : 'border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
            }`}
          >
            <ShieldAlert className="h-3 w-3" />
            <span>Issues ({flaggedCount})</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setSelectedFilter('operational')}
          className={`flex-shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
            selectedFilter === 'operational'
              ? 'bg-emerald-600 text-white'
              : 'border border-white/[0.08] bg-[#151E32] text-slate-400 hover:text-slate-200'
          }`}
        >
          Operational
        </button>

        {rowLabels.map((row) => (
          <button
            key={row}
            type="button"
            onClick={() => setSelectedFilter(row)}
            className={`flex-shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              selectedFilter === row
                ? 'bg-indigo-600 text-white'
                : 'border border-white/[0.08] bg-[#151E32] text-slate-400 hover:text-slate-200'
            }`}
          >
            {row}
          </button>
        ))}
      </div>

      {/* Visual Compact Matrix Grid (3 to 4 Columns) */}
      {filteredWorkstations.length === 0 ? (
        <div className="rounded-xl border border-white/[0.08] bg-[#151E32] p-8 text-center">
          <p className="text-xs text-slate-400">No workstations match the selected filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
          {filteredWorkstations.map((ws) => {
            const isFlagged = ws.status === 'flagged'
            const isUnderRepair = ws.status === 'under_repair'
            const isTeacher = ws.row_label?.toLowerCase().includes('teacher') || ws.label.toLowerCase().includes('teacher')

            let borderStyle = 'border-slate-800 bg-[#151E32] hover:border-slate-600'
            let ledColor = 'bg-emerald-400 shadow-[0_0_6px_#34d399]'

            if (isFlagged) {
              if (ws.highest_severity === 'critical') {
                borderStyle = 'border-rose-500/80 bg-rose-950/20 shadow-[0_0_10px_rgba(244,63,94,0.25)]'
                ledColor = 'bg-rose-500 animate-pulse shadow-[0_0_8px_#f43f5e]'
              } else {
                borderStyle = 'border-amber-500/80 bg-amber-950/20 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                ledColor = 'bg-amber-400 shadow-[0_0_6px_#fbbf24]'
              }
            } else if (isUnderRepair) {
              borderStyle = 'border-blue-500/80 bg-blue-950/20 shadow-[0_0_10px_rgba(59,130,246,0.2)]'
              ledColor = 'bg-blue-400 animate-pulse shadow-[0_0_6px_#60a5fa]'
            }

            return (
              <button
                key={ws.id}
                type="button"
                onClick={() => onSelectWorkstation(ws)}
                className={`relative flex flex-col items-center justify-between rounded-xl border p-2 text-center transition-transform active:scale-95 ${borderStyle}`}
              >
                {/* Issue Badge Overlay */}
                {ws.open_issues_count > 0 && (
                  <span
                    className={`absolute -top-2 right-1 flex items-center gap-0.5 rounded-full px-1.5 py-0.2 text-[9px] font-bold ${
                      ws.highest_severity === 'critical'
                        ? 'bg-rose-600 text-white'
                        : 'bg-amber-400 text-slate-950'
                    }`}
                  >
                    {ws.open_issues_count}
                  </span>
                )}

                {/* Top Hardware Bezel Strip */}
                <div className="flex w-full items-center justify-between">
                  {ws.device_type === 'laptop' ? (
                    <Laptop className="h-2.5 w-2.5 text-slate-500" />
                  ) : (
                    <Monitor className="h-2.5 w-2.5 text-slate-500" />
                  )}
                  <span className={`h-1.5 w-1.5 rounded-full ${ledColor}`} />
                </div>

                {/* Workstation Label */}
                <div className="py-1">
                  <span
                    className={`font-mono text-xs font-bold ${
                      isTeacher
                        ? 'text-indigo-300'
                        : isFlagged
                        ? 'text-white'
                        : 'text-slate-200'
                    }`}
                  >
                    {ws.label}
                  </span>
                </div>

                {/* Bottom Row Label or Health Indicator */}
                <div className="w-full flex items-center justify-center pt-0.5 border-t border-white/[0.04]">
                  {isFlagged ? (
                    <span className="text-[9px] font-semibold text-rose-400 flex items-center gap-0.5">
                      <ShieldAlert className="h-2.5 w-2.5" />
                      <span>Fault</span>
                    </span>
                  ) : isUnderRepair ? (
                    <span className="text-[9px] font-semibold text-blue-400 flex items-center gap-0.5">
                      <Wrench className="h-2.5 w-2.5" />
                      <span>Repair</span>
                    </span>
                  ) : (
                    <span className="text-[9px] font-medium text-slate-400 truncate max-w-[70px]">
                      {ws.row_label || 'Active'}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
