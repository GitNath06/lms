'use client'

import React, { useState, useEffect } from 'react'
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  Download,
  Printer,
  Search,
  Loader2,
  FileSpreadsheet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import {
  getStudentBoardComplianceReport,
  exportStudentBoardComplianceAction,
} from '@/app/actions/institutional-reports'
import type { StudentComplianceReport } from '@/lib/types/institutional-reports'

interface StudentComplianceTabProps {
  classes: Array<{ id: string; name: string }>
  academicYears: Array<{ id: string; name: string }>
}

export function StudentComplianceTab({ classes, academicYears }: StudentComplianceTabProps) {
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || '12eng')
  const [selectedYearId, setSelectedYearId] = useState<string>(academicYears[0]?.id || '2083')
  const [report, setReport] = useState<StudentComplianceReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterEligible, setFilterEligible] = useState<'all' | 'eligible' | 'barred'>('all')
  const [exportingExcel, setExportingExcel] = useState(false)

  useEffect(() => {
    setLoading(true)
    getStudentBoardComplianceReport({
      academicYearId: selectedYearId,
      classId: selectedClassId,
    })
      .then((res) => {
        if (res.success && res.data) setReport(res.data)
      })
      .finally(() => setLoading(false))
  }, [selectedClassId, selectedYearId])

  // Filter records
  const filteredRecords = (report?.records || []).filter((r) => {
    const matchesSearch =
      r.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.roll_number.toString().includes(searchQuery) ||
      (r.registration_no && r.registration_no.toLowerCase().includes(searchQuery.toLowerCase()))

    if (!matchesSearch) return false

    if (filterEligible === 'eligible') return r.is_eligible
    if (filterEligible === 'barred') return !r.is_eligible
    return true
  })

  // Export to CSV
  const handleExportCSV = () => {
    if (!report) return
    const headers = [
      'Roll No',
      'Registration No',
      'Student Name',
      'Sessions Held',
      'Sessions Attended',
      'Absent Count',
      'Attendance Rate (%)',
      'NEB Exam Eligibility',
    ]
    const rows = filteredRecords.map((r) => [
      r.roll_number,
      r.registration_no || '—',
      `"${r.full_name}"`,
      r.sessions_held,
      r.sessions_attended,
      r.absent_count,
      `${r.attendance_rate_pct}%`,
      r.is_eligible ? 'Eligible' : 'Barred (Below 75%)',
    ])

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `NEB_Compliance_${report.class_name}_${report.academic_year_name}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Export to Excel (.xlsx)
  const handleExportExcel = async () => {
    if (!report) return
    setExportingExcel(true)
    try {
      const res = await exportStudentBoardComplianceAction({
        academicYearId: selectedYearId,
        classId: selectedClassId,
      })
      if (res.success && res.base64) {
        const byteCharacters = atob(res.base64)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        const blob = new Blob([byteArray], {
          type: res.contentType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = res.filename || `NEB_Compliance_${report.class_name}.xlsx`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error('Failed to export Excel:', err)
    } finally {
      setExportingExcel(false)
    }
  }

  return (
    <div className="space-y-4 font-sans text-zinc-900 dark:text-zinc-100">
      {/* Filter Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-[#101726] border border-white/[0.08] shadow-sm">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
            <Users className="h-4 w-4 text-indigo-400" />
            <span>Class:</span>
          </div>
          <Select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="h-8.5 text-xs bg-[#151E32] border-white/10 text-white rounded-xl min-w-[160px]"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>

          {academicYears.length > 0 && (
            <Select
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              className="h-8.5 text-xs bg-[#151E32] border-white/10 text-white rounded-xl min-w-[120px]"
            >
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </Select>
          )}

          {/* Eligibility Filter Pills */}
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#151E32] border border-white/5 text-[11px]">
            <button
              type="button"
              onClick={() => setFilterEligible('all')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filterEligible === 'all' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({report?.total_students || 0})
            </button>
            <button
              type="button"
              onClick={() => setFilterEligible('eligible')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filterEligible === 'eligible'
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'text-slate-400 hover:text-emerald-400'
              }`}
            >
              Eligible ({report?.eligible_students || 0})
            </button>
            <button
              type="button"
              onClick={() => setFilterEligible('barred')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filterEligible === 'barred'
                  ? 'bg-rose-600 text-white font-bold'
                  : 'text-slate-400 hover:text-rose-400'
              }`}
            >
              Barred ({report?.barred_students || 0})
            </button>
          </div>
        </div>

        {/* Search & Export Actions */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search student or roll..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8.5 pl-8 pr-3 text-xs rounded-xl bg-[#151E32] border border-white/10 text-white placeholder:text-slate-500 w-44 sm:w-52"
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={!report || report.records.length === 0}
            className="h-8.5 px-3 text-xs rounded-xl border-white/10 text-slate-200 hover:bg-white/5 gap-1.5"
          >
            <Download className="h-3.5 w-3.5 text-indigo-400" />
            <span>CSV</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={!report || report.records.length === 0 || exportingExcel}
            className="h-8.5 px-3 text-xs rounded-xl border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/10 gap-1.5"
          >
            {exportingExcel ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
            )}
            <span>Excel</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="rounded-xl border border-white/[0.08] bg-[#101726] p-3 flex flex-col justify-between shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Enrolled</span>
          <span className="font-heading text-xl sm:text-2xl font-extrabold text-white tabular-nums mt-1">
            {report?.total_students || 0}
          </span>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[#101726] p-3 flex flex-col justify-between shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Board Exam Eligible</span>
          <div className="flex items-center justify-between mt-1">
            <span className="font-heading text-xl sm:text-2xl font-extrabold text-emerald-400 tabular-nums">
              {report?.eligible_students || 0}
            </span>
            <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20 text-[10px]">
              &ge; 75%
            </Badge>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[#101726] p-3 flex flex-col justify-between shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400">Barred (Attendance Shortage)</span>
          <div className="flex items-center justify-between mt-1">
            <span className="font-heading text-xl sm:text-2xl font-extrabold text-rose-400 tabular-nums">
              {report?.barred_students || 0}
            </span>
            <Badge className="bg-rose-500/10 text-rose-300 border-rose-500/20 text-[10px]">
              &lt; 75%
            </Badge>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[#101726] p-3 flex flex-col justify-between shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">Cohort Avg Attendance</span>
          <span className="font-heading text-xl sm:text-2xl font-extrabold text-white tabular-nums mt-1">
            {report?.cohort_avg_rate_pct || 0}%
          </span>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#101726] overflow-hidden shadow-xl">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
            <span className="text-xs">Computing board compliance metrics...</span>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            No students found matching your search or filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] bg-[#151E32]/60 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3 w-16">Roll</th>
                  <th className="py-2.5 px-3">Student Name</th>
                  <th className="py-2.5 px-3 w-28">Reg No</th>
                  <th className="py-2.5 px-3 text-center w-24">Held</th>
                  <th className="py-2.5 px-3 text-center w-24">Attended</th>
                  <th className="py-2.5 px-3 text-center w-24">Absent</th>
                  <th className="py-2.5 px-3 text-center w-28">Rate (%)</th>
                  <th className="py-2.5 px-3 text-right w-36">NEB Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {filteredRecords.map((r) => (
                  <tr key={r.enrollment_id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-2 px-3 font-mono font-bold text-slate-200 tabular-nums">
                      Roll {r.roll_number}
                    </td>
                    <td className="py-2 px-3 font-semibold text-white">
                      {r.full_name}
                    </td>
                    <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">
                      {r.registration_no || '—'}
                    </td>
                    <td className="py-2 px-3 text-center font-mono tabular-nums text-slate-300">
                      {r.sessions_held}
                    </td>
                    <td className="py-2 px-3 text-center font-mono tabular-nums text-emerald-400 font-bold">
                      {r.sessions_attended}
                    </td>
                    <td className="py-2 px-3 text-center font-mono tabular-nums text-rose-400">
                      {r.absent_count}
                    </td>
                    <td className="py-2 px-3 text-center font-mono font-extrabold tabular-nums">
                      <span
                        className={
                          r.attendance_rate_pct >= 85
                            ? 'text-emerald-400'
                            : r.attendance_rate_pct >= 75
                            ? 'text-slate-200'
                            : 'text-rose-400'
                        }
                      >
                        {r.attendance_rate_pct}%
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <Badge
                        className={`text-[10px] font-bold ${
                          r.is_eligible
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}
                      >
                        {r.is_eligible ? 'Eligible' : 'Barred (<75%)'}
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
