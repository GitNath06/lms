'use client'

import React, { useState, useEffect } from 'react'
import {
  Building2,
  Clock,
  Users,
  CheckCircle2,
  Calendar,
  Loader2,
  ArrowUpRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getLabOccupancyIndex } from '@/app/actions/institutional-reports'
import type { LabOccupancyRecord } from '@/lib/types/institutional-reports'

export function LabOccupancyTab() {
  const [records, setRecords] = useState<LabOccupancyRecord[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getLabOccupancyIndex({})
      .then((res) => {
        if (res.success && res.data) setRecords(res.data)
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-4 font-sans text-zinc-900 dark:text-zinc-100">
      {/* Overview Banner */}
      <div className="p-4 rounded-2xl bg-[#101726] border border-white/[0.08] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <h3 className="font-heading font-extrabold text-sm text-white flex items-center gap-2">
            <Building2 className="h-4 w-4 text-indigo-400" />
            <span>Institutional Laboratory Occupancy &amp; Capacity Utilization</span>
          </h3>
          <p className="text-xs text-slate-400">
            Operating baseline: 36 instructional hours / week (10:00 AM – 4:00 PM, Sunday–Friday).
          </p>
        </div>
      </div>

      {/* Lab Cards Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
          <span className="text-xs">Computing facility utilization indices...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {records.map((r) => (
            <div
              key={r.lab_id}
              className="rounded-2xl border border-white/[0.08] bg-[#101726] p-4 space-y-3.5 shadow-md"
            >
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                  <h4 className="font-heading font-extrabold text-sm text-white">
                    {r.lab_name}
                  </h4>
                </div>
                <Badge className="bg-indigo-500/10 text-indigo-300 font-mono text-[10px]">
                  Cap: {r.lab_capacity} Students
                </Badge>
              </div>

              {/* Metrics Row */}
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-2.5 rounded-xl bg-[#151E32] border border-white/5 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Timetable Booked Hours
                  </div>
                  <div className="font-heading text-lg font-extrabold text-white tabular-nums">
                    {r.scheduled_weekly_hours}h / 36h
                  </div>
                  <div className="text-[10px] text-indigo-300 font-semibold">
                    {r.occupancy_rate_pct}% Room Occupancy
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-[#151E32] border border-white/5 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Avg Student Volume
                  </div>
                  <div className="font-heading text-lg font-extrabold text-emerald-400 tabular-nums">
                    {r.avg_students_per_session} Students
                  </div>
                  <div className="text-[10px] text-emerald-300 font-semibold">
                    {r.capacity_utilization_pct}% Capacity Used
                  </div>
                </div>
              </div>

              {/* Utilization Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Weekly Operating Density</span>
                  <span className="font-mono text-white">{r.occupancy_rate_pct}%</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${r.occupancy_rate_pct}%` }}
                    className="h-full bg-indigo-500 rounded-full transition-all"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
