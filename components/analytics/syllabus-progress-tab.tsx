'use client'

import React, { useState, useEffect } from 'react'
import {
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Sparkles,
  Loader2,
  FileCheck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { getSyllabusProgressLedger } from '@/app/actions/institutional-reports'
import type { SyllabusProgressLedger } from '@/lib/types/institutional-reports'

interface SyllabusProgressTabProps {
  classes: Array<{ id: string; name: string }>
}

export function SyllabusProgressTab({ classes }: SyllabusProgressTabProps) {
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || '12eng')
  const [ledger, setLedger] = useState<SyllabusProgressLedger | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getSyllabusProgressLedger({ classId: selectedClassId })
      .then((res) => {
        if (res.success && res.data) setLedger(res.data)
      })
      .finally(() => setLoading(false))
  }, [selectedClassId])

  return (
    <div className="space-y-4 font-sans text-zinc-900 dark:text-zinc-100">
      {/* Header filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-[#101726] border border-white/[0.08] shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
            <BookOpen className="h-4 w-4 text-indigo-400" />
            <span>Class Curriculum:</span>
          </div>
          <Select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="h-8.5 text-xs bg-[#151E32] border-white/10 text-white rounded-xl min-w-[180px]"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="text-xs text-slate-400">
          Curriculum Target: <strong className="text-white">{ledger?.prescribed_quota || 20} Prescribed Practicals</strong>
        </div>
      </div>

      {/* Progress & KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
        <div className="rounded-xl border border-white/[0.08] bg-[#101726] p-3 flex flex-col justify-between shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Syllabus Completion
          </span>
          <div className="mt-1">
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="font-heading text-2xl font-extrabold text-white tabular-nums">
                {ledger?.completed_count || 0} / {ledger?.prescribed_quota || 20}
              </span>
              <span className="text-xs font-bold text-indigo-400 tabular-nums">
                {ledger?.completion_pct || 0}%
              </span>
            </div>
            {/* Progress Bar */}
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
              <div
                style={{ width: `${ledger?.completion_pct || 0}%` }}
                className="h-full bg-indigo-500 rounded-full transition-all duration-300"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[#101726] p-3 flex flex-col justify-between shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
            Avg Practical Attendance
          </span>
          <span className="font-heading text-2xl font-extrabold text-emerald-400 tabular-nums mt-1">
            {ledger?.avg_attendance_pct || 0}%
          </span>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[#101726] p-3 flex flex-col justify-between shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
            Skipped / Postponed Sessions
          </span>
          <span className="font-heading text-2xl font-extrabold text-amber-400 tabular-nums mt-1">
            {ledger?.skipped_count || 0}
          </span>
        </div>
      </div>

      {/* Practicals Conducted Ledger Table */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#101726] overflow-hidden shadow-xl">
        <div className="p-3.5 border-b border-white/[0.08] flex items-center justify-between">
          <h3 className="font-heading font-extrabold text-sm text-white flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-indigo-400" />
            <span>Completed Experiments &amp; Syllabi Logbook</span>
          </h3>
          <Badge className="bg-indigo-500/10 text-indigo-300 text-[10px]">
            {ledger?.practicals.length || 0} Recorded Sessions
          </Badge>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
            <span className="text-xs">Loading syllabus progress...</span>
          </div>
        ) : (ledger?.practicals || []).length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            Zero practical sessions logged for this class subject.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] bg-[#151E32]/60 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Period</th>
                  <th className="py-2.5 px-3">Practical Experiment Title</th>
                  <th className="py-2.5 px-3 text-center w-28">Present / Enrolled</th>
                  <th className="py-2.5 px-3 text-center w-24">Turnout %</th>
                  <th className="py-2.5 px-3 text-right w-32">In-Charge Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {ledger?.practicals.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-2 px-3 font-mono text-slate-300">
                      {p.date}
                    </td>
                    <td className="py-2 px-3 text-slate-400">
                      {p.period_label}
                    </td>
                    <td className="py-2 px-3 font-medium text-white">
                      {p.practical_title}
                    </td>
                    <td className="py-2 px-3 text-center font-mono tabular-nums text-slate-300">
                      {p.present_students} / {p.total_students}
                    </td>
                    <td className="py-2 px-3 text-center font-mono font-extrabold tabular-nums text-emerald-400">
                      {p.attendance_rate_pct}%
                    </td>
                    <td className="py-2 px-3 text-right">
                      <Badge
                        className={`text-[9px] font-bold ${
                          p.incharge_verified
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}
                      >
                        {p.incharge_verified ? 'Verified' : 'Pending Audit'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
