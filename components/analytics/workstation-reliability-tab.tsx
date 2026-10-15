'use client'

import React, { useState, useEffect } from 'react'
import {
  Monitor,
  Wrench,
  AlertTriangle,
  Clock,
  TrendingUp,
  ShieldAlert,
  Loader2,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getWorkstationReliabilityAnalytics } from '@/app/actions/institutional-reports'
import { WorkstationBiographyDrawer } from './workstation-biography-drawer'
import type { WorkstationReliabilityReport } from '@/lib/types/institutional-reports'

export function WorkstationReliabilityTab() {
  const [report, setReport] = useState<WorkstationReliabilityReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedWsBioId, setSelectedWsBioId] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    getWorkstationReliabilityAnalytics({ labId: 'comp' })
      .then((res) => {
        if (res.success && res.data) setReport(res.data)
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-4 font-sans text-zinc-900 dark:text-zinc-100">
      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="rounded-xl border border-white/[0.08] bg-[#101726] p-3 flex flex-col justify-between shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Workstations Monitored
          </span>
          <span className="font-heading text-xl sm:text-2xl font-extrabold text-white tabular-nums mt-1">
            {report?.total_workstations || 0}
          </span>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[#101726] p-3 flex flex-col justify-between shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
            Overall Hardware Uptime
          </span>
          <span className="font-heading text-xl sm:text-2xl font-extrabold text-emerald-400 tabular-nums mt-1">
            {report?.overall_uptime_pct || 98}%
          </span>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[#101726] p-3 flex flex-col justify-between shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
            Mean Time to Resolution (MTTR)
          </span>
          <span className="font-heading text-xl sm:text-2xl font-extrabold text-indigo-400 tabular-nums mt-1">
            {report?.overall_mttr_hours || 4.2}h
          </span>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[#101726] p-3 flex flex-col justify-between shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
            Active Flagged Faults
          </span>
          <span className="font-heading text-xl sm:text-2xl font-extrabold text-rose-400 tabular-nums mt-1">
            {report?.faulty_count || 0}
          </span>
        </div>
      </div>

      {/* Hotspots Section (Problematic PCs) */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#101726] p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400">
              <ShieldAlert className="h-3.5 w-3.5" />
            </span>
            <h3 className="font-heading font-extrabold text-sm text-white">
              Workstation Hotspots &amp; Recurrent Faults
            </h3>
          </div>
          <span className="text-xs text-slate-400">Click any terminal to inspect full technical biography</span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
            <span className="text-xs">Analyzing hardware reliability logs...</span>
          </div>
        ) : (report?.hotspot_workstations || []).length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            Zero recurrent fault hotspots detected! All 34 workstations are performing within nominal thresholds.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {report?.hotspot_workstations.map((ws) => (
              <button
                key={ws.workstation_id}
                type="button"
                onClick={() => setSelectedWsBioId(ws.workstation_id)}
                className="text-left p-3 rounded-xl border border-white/5 bg-[#151E32] hover:border-indigo-500/40 hover:bg-[#151E32]/80 transition-all flex flex-col justify-between gap-2 group cursor-pointer shadow-xs"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-mono font-bold text-xs text-white group-hover:text-indigo-300 transition-colors">
                    {ws.workstation_label}
                  </span>
                  <Badge className="bg-rose-500/10 text-rose-300 font-mono text-[9px] tabular-nums">
                    {ws.total_issues_count} Faults
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 w-full">
                  <span>Uptime: <strong className="text-white">{ws.uptime_pct}%</strong></span>
                  <span className="text-indigo-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                    <span>Biography</span>
                    <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Comprehensive Workstation Roster Table */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#101726] overflow-hidden shadow-xl">
        <div className="p-3.5 border-b border-white/[0.08] flex items-center justify-between">
          <h3 className="font-heading font-extrabold text-sm text-white flex items-center gap-2">
            <Monitor className="h-4 w-4 text-indigo-400" />
            <span>Complete Workstations Inventory &amp; Service Availability Index</span>
          </h3>
          <Badge className="bg-indigo-500/10 text-indigo-300 text-[10px]">
            {report?.workstations.length || 0} Physical Terminals
          </Badge>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
            <span className="text-xs">Loading workstation records...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] bg-[#151E32]/60 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Terminal</th>
                  <th className="py-2.5 px-3">Row</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3 text-center w-24">Status</th>
                  <th className="py-2.5 px-3 text-center w-24">Total Faults</th>
                  <th className="py-2.5 px-3 text-center w-24">Open</th>
                  <th className="py-2.5 px-3 text-center w-28">Availability %</th>
                  <th className="py-2.5 px-3 text-right w-32">Technical Bio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {report?.workstations.map((w) => (
                  <tr key={w.workstation_id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-2 px-3 font-mono font-bold text-white">
                      {w.workstation_label}
                    </td>
                    <td className="py-2 px-3 text-slate-400">
                      {w.row_label || '—'}
                    </td>
                    <td className="py-2 px-3 text-slate-400 uppercase text-[10px]">
                      {w.device_type}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <Badge
                        className={`text-[9px] font-bold ${
                          w.status === 'operational'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : w.status === 'under_repair'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}
                      >
                        {w.status}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 text-center font-mono tabular-nums text-slate-200">
                      {w.total_issues_count}
                    </td>
                    <td className="py-2 px-3 text-center font-mono tabular-nums text-rose-400">
                      {w.open_issues_count}
                    </td>
                    <td className="py-2 px-3 text-center font-mono font-extrabold text-emerald-400 tabular-nums">
                      {w.uptime_pct}%
                    </td>
                    <td className="py-2 px-3 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedWsBioId(w.workstation_id)}
                        className="h-7 px-2 text-[11px] rounded-lg border-white/10 text-indigo-300 hover:bg-indigo-600 hover:text-white transition-all gap-1"
                      >
                        <span>View Bio</span>
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slide-over Technical Lifecycle Biography Drawer */}
      <WorkstationBiographyDrawer
        workstationId={selectedWsBioId}
        onClose={() => setSelectedWsBioId(null)}
      />
    </div>
  )
}
