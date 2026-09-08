'use client'

import React, { useState } from 'react'
import {
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  Layers,
  Wrench,
  ChevronRight,
  Monitor,
  Atom,
  FlaskRound as Flask,
  Dna,
  Cpu,
} from 'lucide-react'
import {
  LabPlanHealthMatrixItem,
  MaintenancePlanRecord,
} from '@/app/actions/maintenance'

interface PlanHealthMatrixProps {
  matrixData: LabPlanHealthMatrixItem[]
  plans: MaintenancePlanRecord[]
  selectedLab: string
  onSelectLab: (labId: string) => void
}

const LAB_ICONS: Record<string, any> = {
  comp: Monitor,
  phys: Atom,
  chem: Flask,
  bio: Dna,
  elec: Cpu,
}

const LAB_CLUSTERS: Record<string, string> = {
  comp: 'Workstations, Server Rack & Network',
  phys: 'Optics, Spectrometers & Meters',
  chem: 'Fume Hoods, Reagents & Glassware',
  bio: 'Microscopes, Centrifuges & Autoclaves',
  elec: 'Oscilloscopes & Power Supplies',
}

const CADENCE_COLUMNS = [
  { label: 'Bi-Weekly', days: 15, range: [1, 20] },
  { label: 'Monthly', days: 30, range: [21, 45] },
  { label: 'Quarterly', days: 90, range: [46, 120] },
  { label: 'Semi-Annual', days: 180, range: [121, 240] },
  { label: 'Annual', days: 365, range: [241, 730] },
]

export default function PlanHealthMatrix({
  matrixData,
  plans,
  selectedLab,
  onSelectLab,
}: PlanHealthMatrixProps) {
  const [viewMode, setViewMode] = useState<'cards' | 'cross_matrix'>('cards')

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs font-sans space-y-4">
      {/* Matrix Header & Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Layers className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold text-zinc-950 dark:text-white tracking-tight">
              Lab Maintenance Status Matrix
            </h3>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Routine health and upcoming service schedules across computer and science laboratory facilities.
          </p>
        </div>

        {/* View Mode Switch & Reset */}
        <div className="flex items-center gap-2">
          {selectedLab !== 'all' && (
            <button
              type="button"
              onClick={() => onSelectLab('all')}
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 mr-2 cursor-pointer"
            >
              Clear Filter ({selectedLab.toUpperCase()})
            </button>
          )}

          <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-medium">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1 rounded-lg transition-all ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-bold shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              Facility Cards
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cross_matrix')}
              className={`px-3 py-1 rounded-lg transition-all ${
                viewMode === 'cross_matrix'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-bold shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              Cadence Grid
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: Facility Matrix Cards */}
      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {matrixData.map((lab) => {
            const Icon = LAB_ICONS[lab.lab_id] || Wrench
            const isSelected = selectedLab === lab.lab_id
            const labPlans = plans.filter((p) => p.lab_id === lab.lab_id)

            // Health Status Theme
            const isOverdue = lab.overdue_plans > 0
            const isDueSoon = !isOverdue && lab.due_soon_plans > 0
            const statusLabel = isOverdue
              ? `${lab.overdue_plans} Overdue`
              : isDueSoon
              ? `${lab.due_soon_plans} Due Soon`
              : 'Up to Date'

            const statusBadgeClass = isOverdue
              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
              : isDueSoon
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'

            return (
              <div
                key={lab.lab_id}
                onClick={() => onSelectLab(isSelected ? 'all' : lab.lab_id)}
                className={`group relative p-4 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20 shadow-sm ring-2 ring-indigo-500/30'
                    : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-800/30 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-white dark:hover:bg-zinc-800/60'
                }`}
              >
                <div>
                  {/* Card Header: Icon, Name & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 group-hover:scale-105'
                        } transition-transform`}
                      >
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                          {lab.lab_name}
                        </h4>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                          {LAB_CLUSTERS[lab.lab_id] || 'Hardware & Systems'}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${statusBadgeClass}`}
                    >
                      {statusLabel}
                    </span>
                  </div>

                  {/* Frequency Cadence Chips */}
                  <div className="mt-4 space-y-1.5">
                    <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                      Active Routines ({labPlans.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {labPlans.length > 0 ? (
                        labPlans.map((p) => {
                          const isPlanOverdue = (p.overdue_days || 0) > 0
                          return (
                            <span
                              key={p.id}
                              title={`${p.title} - every ${p.interval_days} days`}
                              className={`text-[11px] px-2 py-0.5 rounded-md border transition-colors ${
                                isPlanOverdue
                                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 font-bold'
                                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                              }`}
                            >
                              {p.interval_days}d
                            </span>
                          )
                        })
                      ) : (
                        <span className="text-[11px] text-zinc-400 italic">No plans registered</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Footer: Dates */}
                <div className="mt-4 pt-3 border-t border-zinc-200/70 dark:border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                  <div>
                    <span className="text-zinc-400">Next Target:</span>{' '}
                    <span
                      className={
                        isOverdue
                          ? 'text-rose-600 dark:text-rose-400 font-bold'
                          : 'text-zinc-700 dark:text-zinc-300 font-semibold'
                      }
                    >
                      {lab.next_target_date || 'None'}
                    </span>
                  </div>
                  <div className="flex items-center text-[11px] font-medium text-indigo-600 dark:text-indigo-400 group-hover:translate-x-0.5 transition-transform">
                    {isSelected ? 'Selected' : 'Filter'}
                    <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* VIEW 2: Cadence Matrix Table */
        <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800">
                <th className="py-2.5 px-4 font-bold text-zinc-900 dark:text-zinc-100 text-xs w-56">
                  Laboratory Facility
                </th>
                {CADENCE_COLUMNS.map((col) => (
                  <th
                    key={col.label}
                    className="py-2.5 px-3 font-semibold text-zinc-600 dark:text-zinc-300 text-xs text-center border-l border-zinc-200 dark:border-zinc-800"
                  >
                    {col.label}
                    <div className="text-[10px] text-zinc-400 font-normal">~{col.days} Days</div>
                  </th>
                ))}
                <th className="py-2.5 px-4 font-bold text-zinc-900 dark:text-zinc-100 text-xs text-right border-l border-zinc-200 dark:border-zinc-800">
                  Compliance Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {matrixData.map((lab) => {
                const labPlans = plans.filter((p) => p.lab_id === lab.lab_id)
                const isSelected = selectedLab === lab.lab_id

                return (
                  <tr
                    key={lab.lab_id}
                    onClick={() => onSelectLab(isSelected ? 'all' : lab.lab_id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-50/40 dark:bg-indigo-950/30'
                        : 'hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40'
                    }`}
                  >
                    <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
                      <div>
                        <div className="text-xs font-bold">{lab.lab_name}</div>
                        <div className="text-[10px] text-zinc-400 font-normal">
                          {labPlans.length} active routine(s)
                        </div>
                      </div>
                    </td>

                    {/* Cadence Check Cells */}
                    {CADENCE_COLUMNS.map((col) => {
                      const matchedPlans = labPlans.filter(
                        (p) =>
                          p.interval_days >= col.range[0] && p.interval_days <= col.range[1]
                      )
                      const hasOverdue = matchedPlans.some(
                        (p) => (p.overdue_days || 0) > 0
                      )

                      return (
                        <td
                          key={col.label}
                          className="py-3 px-3 text-center border-l border-zinc-200 dark:border-zinc-800 align-middle"
                        >
                          {matchedPlans.length > 0 ? (
                            <div className="inline-flex flex-col items-center gap-0.5">
                              <span
                                className={`inline-flex items-center justify-center h-6 px-2 rounded-md text-[11px] font-semibold ${
                                  hasOverdue
                                    ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30'
                                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                                }`}
                              >
                                {matchedPlans.length} Routine{matchedPlans.length > 1 ? 's' : ''}
                              </span>
                              {hasOverdue && (
                                <span className="text-[9px] text-rose-600 font-bold">
                                  Overdue
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-zinc-300 dark:text-zinc-700 font-mono">—</span>
                          )}
                        </td>
                      )
                    })}

                    {/* Overall Compliance */}
                    <td className="py-3 px-4 text-right border-l border-zinc-200 dark:border-zinc-800">
                      {lab.overdue_plans > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">
                          <AlertTriangle className="h-3 w-3" />
                          {lab.overdue_plans} Overdue
                        </span>
                      ) : lab.due_soon_plans > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                          <Clock className="h-3 w-3" />
                          {lab.due_soon_plans} Due Soon
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                          <CheckCircle2 className="h-3 w-3" />
                          Optimal
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
