'use client'

import React, { useState, useEffect } from 'react'
import {
  Users,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Award,
  Loader2,
  FileCheck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getFacultyPracticalLedger } from '@/app/actions/institutional-reports'
import type { FacultyActivityRecord } from '@/lib/types/institutional-reports'

export function FacultyActivityTab() {
  const [records, setRecords] = useState<FacultyActivityRecord[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getFacultyPracticalLedger({})
      .then((res) => {
        if (res.success && res.data) setRecords(res.data)
      })
      .finally(() => setLoading(false))
  }, [])

  const totalSessionsLogged = records.reduce((acc, r) => acc + r.total_sessions_logged, 0)
  const totalStudentsTaught = records.reduce((acc, r) => acc + r.total_students_taught, 0)
  const overallVerificationPct =
    totalSessionsLogged > 0
      ? Math.round(
          (records.reduce((acc, r) => acc + r.incharge_verified_count, 0) /
            totalSessionsLogged) *
            100
        )
      : 100

  return (
    <div className="space-y-4 font-sans text-zinc-900 dark:text-zinc-100">
      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
        <div className="rounded-xl border border-white/[0.08] bg-[#101726] p-3 flex flex-col justify-between shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Total Sessions Logged
          </span>
          <span className="font-heading text-2xl font-extrabold text-white tabular-nums mt-1">
            {totalSessionsLogged}
          </span>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[#101726] p-3 flex flex-col justify-between shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
            Total Practical Students Taught
          </span>
          <span className="font-heading text-2xl font-extrabold text-indigo-400 tabular-nums mt-1">
            {totalStudentsTaught}
          </span>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[#101726] p-3 flex flex-col justify-between shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
            Lab In-Charge Verification Rate
          </span>
          <span className="font-heading text-2xl font-extrabold text-emerald-400 tabular-nums mt-1">
            {overallVerificationPct}%
          </span>
        </div>
      </div>

      {/* Main Faculty Table */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#101726] overflow-hidden shadow-xl">
        <div className="p-3.5 border-b border-white/[0.08] flex items-center justify-between">
          <h3 className="font-heading font-extrabold text-sm text-white flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-indigo-400" />
            <span>Faculty Practical Operations &amp; Verification Audit</span>
          </h3>
          <Badge className="bg-indigo-500/10 text-indigo-300 text-[10px]">
            {records.length} Faculty Members
          </Badge>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
            <span className="text-xs">Loading faculty activity records...</span>
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            Zero faculty activity records found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] bg-[#151E32]/60 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Faculty Instructor</th>
                  <th className="py-2.5 px-3 text-center w-28">Total Logged</th>
                  <th className="py-2.5 px-3 text-center w-28">Conducted</th>
                  <th className="py-2.5 px-3 text-center w-24">Skipped</th>
                  <th className="py-2.5 px-3 text-center w-32">Students Taught</th>
                  <th className="py-2.5 px-3 text-center w-28">Avg Attendance</th>
                  <th className="py-2.5 px-3 text-right w-36">In-Charge Verified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {records.map((r) => (
                  <tr key={r.teacher_id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-white">{r.teacher_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{r.email || 'faculty'}</div>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-white tabular-nums">
                      {r.total_sessions_logged}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono tabular-nums text-emerald-400">
                      {r.conducted_count}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono tabular-nums text-rose-400">
                      {r.skipped_count}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono tabular-nums text-slate-200">
                      {r.total_students_taught}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold tabular-nums text-slate-200">
                      {r.avg_attendance_pct}%
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <Badge
                          className={`text-[9px] font-bold ${
                            r.verification_rate_pct >= 90
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}
                        >
                          {r.incharge_verified_count} / {r.conducted_count} ({r.verification_rate_pct}%)
                        </Badge>
                        {r.pending_verification_count > 0 && (
                          <span className="text-[9px] text-amber-400 font-medium">
                            {r.pending_verification_count} pending
                          </span>
                        )}
                      </div>
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
