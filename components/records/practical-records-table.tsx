'use client'

import React, { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  PracticalGroupedSection,
  PracticalRecordFilters,
  PracticalGroupingKey,
} from '@/types/records'
import { exportPracticalRecordsAction } from '@/app/actions/records'
import {
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  ChevronDown,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Check,
  Eye,
  Edit3,
  Trash2,
  Lock,
} from 'lucide-react'
import PracticalDetailModal from '@/components/records/practical-detail-modal'

interface PracticalRecordsTableProps {
  sections: PracticalGroupedSection[]
  filters: PracticalRecordFilters
  groupBy: PracticalGroupingKey
  totalCount: number
  userRole?: string
  userName?: string
  userScope?: any
  onRecordUpdated?: () => void
  isLoading?: boolean
}

export default function PracticalRecordsTable({
  sections,
  filters,
  groupBy,
  totalCount,
  userRole = 'teacher',
  userName = '',
  userScope = null,
  onRecordUpdated,
  isLoading = false,
}: PracticalRecordsTableProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [exportMenuOpen, setExportMenuOpen] = useState<boolean>(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const isPrivileged = userRole === 'super_admin' || userRole === 'hod' || userRole === 'lab_incharge'

  const canModify = (rec: any) => {
    if (isPrivileged) return true
    const teacherIdMatch = userScope?.userId && (rec.teacher_id === userScope.userId || rec.logged_by === userScope.userId)
    const teacherNameMatch = userName && (
      (rec.profiles?.full_name && rec.profiles.full_name.toLowerCase().includes(userName.toLowerCase())) ||
      (rec.profiles?.full_name && userName.toLowerCase().includes(rec.profiles.full_name.toLowerCase()))
    )
    const assignedTeacherMatch = userScope?.teacherProfile?.name && (
      (rec.profiles?.full_name && rec.profiles.full_name.toLowerCase().includes(userScope.teacherProfile.name.toLowerCase())) ||
      (rec.profiles?.full_name && userScope.teacherProfile.name.toLowerCase().includes(rec.profiles.full_name.toLowerCase()))
    )
    return Boolean(teacherIdMatch || teacherNameMatch || assignedTeacherMatch)
  }

  const canDelete = (rec: any) => {
    if (userRole === 'super_admin') return true
    if (userRole === 'teacher') return canModify(rec)
    return false
  }

  const handleOpenDetail = (rec: any) => {
    setSelectedRecord(rec)
    setIsModalOpen(true)
  }

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3500)
  }

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  // Trigger file download from base64 string
  const downloadFile = (base64: string, filename: string, contentType: string) => {
    const byteCharacters = atob(base64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: contentType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleExport = async (format: 'xlsx' | 'csv') => {
    setIsExporting(true)
    setExportMenuOpen(false)
    try {
      showToast(`Generating certified ${format.toUpperCase()} export...`)
      const res = await exportPracticalRecordsAction(filters, groupBy, format)
      if (res.success && res.base64 && res.filename && res.contentType) {
        downloadFile(res.base64, res.filename, res.contentType)
        showToast(`Downloaded ${res.filename}`)
      } else {
        showToast(`Export failed: ${res.error || 'Unknown error'}`)
      }
    } catch (e: any) {
      showToast(`Export failed: ${e.message}`)
    } finally {
      setIsExporting(false)
    }
  }

  const handleOpenPrint = () => {
    setExportMenuOpen(false)
    const params = new URLSearchParams()
    if (filters.lab_id) params.set('lab_id', filters.lab_id)
    if (filters.date_from) params.set('date_from', filters.date_from)
    if (filters.date_to) params.set('date_to', filters.date_to)
    if (filters.batch_group) params.set('batch_group', filters.batch_group)
    if (filters.subject_name) params.set('subject_name', filters.subject_name)
    if (filters.teacher_id) params.set('teacher_id', filters.teacher_id)
    if (groupBy !== 'none') params.set('groupBy', groupBy)

    window.open(`/print/records?${params.toString()}`, '_blank')
  }

  return (
    <div className="space-y-4 font-sans">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 px-4 py-2.5 rounded-xl shadow-2xl text-xs font-mono font-medium flex items-center gap-2 border border-zinc-700 animate-in slide-in-from-top-2 duration-150">
          <Sparkles className="h-4 w-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Table Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-zinc-950 dark:text-white font-mono">
            Practical Records {isLoading ? '' : `(${totalCount})`}
          </span>
          {groupBy !== 'none' && (
            <Badge variant="outline" className="text-[10px] font-mono bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800">
              Segmented by {groupBy.replace('_', ' ')}
            </Badge>
          )}
        </div>

        {/* Official Export Dropdown */}
        <div className="relative">
          <Button
            onClick={() => setExportMenuOpen(!exportMenuOpen)}
            disabled={isLoading || isExporting || totalCount === 0}
            className="h-9 px-3.5 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white text-xs font-medium flex items-center gap-2 shadow-xs transition-transform active:scale-95"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{isExporting ? 'Exporting...' : 'Export Records'}</span>
            <ChevronDown className={`h-3 w-3 transition-transform ${exportMenuOpen ? 'rotate-180' : ''}`} />
          </Button>

          {exportMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl z-30 p-1.5 animate-in fade-in zoom-in-95 duration-100 font-sans">
              <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 text-[10px] font-mono uppercase text-zinc-400 font-bold">
                Official Institutional Exports
              </div>

              {/* Excel */}
              <button
                onClick={() => handleExport('xlsx')}
                className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-start gap-2.5 transition-colors group cursor-pointer"
              >
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform mt-0.5">
                  <FileSpreadsheet className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    Excel Workbook (.xlsx)
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    Formatted title, subtotals, frozen panes & numeric %
                  </p>
                </div>
              </button>

              {/* CSV */}
              <button
                onClick={() => handleExport('csv')}
                className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-start gap-2.5 transition-colors group cursor-pointer"
              >
                <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 group-hover:scale-105 transition-transform mt-0.5">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    CSV Spreadsheet (.csv)
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    Quoted RFC 4180 with UTF-8 BOM encoding
                  </p>
                </div>
              </button>

              {/* Print / Save to PDF */}
              <button
                onClick={handleOpenPrint}
                className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-start gap-2.5 transition-colors group cursor-pointer border-t border-zinc-100 dark:border-zinc-800/80 mt-1 pt-2"
              >
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform mt-0.5">
                  <Printer className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    Print / Save to PDF
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    Certified letterhead view with dual signatures
                  </p>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Records Table Container */}
      <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center text-zinc-500 space-y-3">
            <div className="h-7 w-7 rounded-full border-2 border-emerald-500/30 border-t-emerald-600 animate-spin" />
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 font-mono">
              Loading practical records...
            </p>
          </div>
        ) : totalCount === 0 ? (
          <div className="p-12 text-center text-zinc-500 space-y-1.5">
            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              No records found
            </p>
            <p className="text-xs text-zinc-400">
              No practical session records matching the selected criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-zinc-50/80 dark:bg-zinc-950/70 border-b border-zinc-200 dark:border-zinc-800">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-[11px] font-mono font-bold uppercase text-zinc-600 dark:text-zinc-400 w-24">Date</TableHead>
                  <TableHead className="text-[11px] font-mono font-bold uppercase text-zinc-600 dark:text-zinc-400 w-32">Period</TableHead>
                  <TableHead className="text-[11px] font-mono font-bold uppercase text-zinc-600 dark:text-zinc-400 w-28">Facility</TableHead>
                  <TableHead className="text-[11px] font-mono font-bold uppercase text-zinc-600 dark:text-zinc-400">Subject & Experiment</TableHead>
                  <TableHead className="text-[11px] font-mono font-bold uppercase text-zinc-600 dark:text-zinc-400 w-28">Batch</TableHead>
                  <TableHead className="text-[11px] font-mono font-bold uppercase text-zinc-600 dark:text-zinc-400 w-36">Subject Teacher</TableHead>
                  <TableHead className="text-[11px] font-mono font-bold uppercase text-zinc-600 dark:text-zinc-400 text-center w-28">Attendance</TableHead>
                  <TableHead className="text-[11px] font-mono font-bold uppercase text-zinc-600 dark:text-zinc-400 text-center w-24">Status</TableHead>
                  <TableHead className="text-[11px] font-mono font-bold uppercase text-zinc-600 dark:text-zinc-400 w-44">Verification Remarks</TableHead>
                  <TableHead className="text-[11px] font-mono font-bold uppercase text-zinc-600 dark:text-zinc-400 text-right w-24">Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {sections.map((sec) => {
                  const isCollapsed = !!collapsedGroups[sec.groupKey]

                  return (
                    <React.Fragment key={sec.groupKey}>
                      {/* Section / Group Header */}
                      {sec.groupKey !== 'all' && (
                        <TableRow
                          onClick={() => toggleGroup(sec.groupKey)}
                          className="bg-zinc-100/70 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer border-y border-zinc-200/80 dark:border-zinc-700/60 select-none transition-colors"
                        >
                          <TableCell colSpan={10} className="py-2.5 px-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {isCollapsed ? (
                                  <ChevronRight className="h-4 w-4 text-zinc-500" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-zinc-500" />
                                )}
                                <span className="font-mono text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wide">
                                  {sec.groupTitle}
                                </span>
                                <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0">
                                  {sec.records.length} {sec.records.length === 1 ? 'session' : 'sessions'}
                                </Badge>
                              </div>

                              {/* Group Subtotals Badge Summary */}
                              <div className="flex items-center gap-3 text-xs font-mono text-zinc-500">
                                <span>
                                  Attendance: <strong className="text-zinc-900 dark:text-white">{sec.subtotal.totalPresent}</strong>/{sec.subtotal.totalEnrolled}
                                </span>
                                <Badge className="text-[10px] font-mono bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20">
                                  {sec.subtotal.averageAttendancePct.toFixed(1)}% Avg
                                </Badge>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}

                      {/* Records Rows */}
                      {!isCollapsed &&
                        sec.records.map((rec) => {
                          const isSkipped = rec.status === 'skipped'
                          const attPct = rec.attendance_pct

                          return (
                            <TableRow
                              key={rec.id}
                              onClick={() => handleOpenDetail(rec)}
                              className={`text-xs hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors group ${
                                isSkipped ? 'bg-amber-50/20 dark:bg-amber-950/10' : ''
                              }`}
                            >
                              <TableCell className="font-mono text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                                {rec.date}
                              </TableCell>
                              <TableCell className="font-mono font-medium text-zinc-800 dark:text-zinc-200">
                                {rec.period_label}
                              </TableCell>
                              <TableCell className="font-medium text-zinc-900 dark:text-white">
                                {rec.labs?.name?.split(' ')[0] || rec.lab_id.toUpperCase()} Lab
                              </TableCell>
                              <TableCell>
                                <div className="font-bold text-zinc-950 dark:text-white">
                                  {rec.subject_name}
                                </div>
                                <div className="text-[11px] text-zinc-600 dark:text-zinc-300 mt-0.5 font-medium">
                                  {rec.practical_title}
                                </div>
                                {rec.topic_learned && (
                                  <div className="text-[10.5px] text-zinc-500 dark:text-zinc-400 mt-1 flex items-start gap-1">
                                    <span className="font-mono text-[9px] uppercase px-1 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 shrink-0 font-semibold">
                                      Topic
                                    </span>
                                    <span className="italic">{rec.topic_learned}</span>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="font-semibold text-zinc-900 dark:text-zinc-100">
                                {rec.batch_group}
                              </TableCell>
                              <TableCell className="text-zinc-700 dark:text-zinc-300 font-medium">
                                {rec.profiles?.full_name || 'Assigned Subject Teacher'}
                              </TableCell>
                              <TableCell className="text-center font-mono">
                                {isSkipped ? (
                                  <span className="text-zinc-400 italic text-[11px]">N/A</span>
                                ) : (
                                  <div>
                                    <span className="font-bold text-zinc-900 dark:text-white">
                                      {rec.present_students}
                                    </span>
                                    <span className="text-zinc-400">/{rec.total_students}</span>
                                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                                      {attPct.toFixed(0)}%
                                    </div>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {isSkipped ? (
                                  <Badge className="text-[10px] uppercase font-mono font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30">
                                    Skipped
                                  </Badge>
                                ) : (
                                  <Badge className="text-[10px] uppercase font-mono font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                                    Conducted
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-[11px] text-zinc-600 dark:text-zinc-400">
                                {isSkipped ? (
                                  <span className="text-amber-800 dark:text-amber-300 italic">
                                    {rec.skip_reason || 'Class postponed / suspended'}
                                  </span>
                                ) : (
                                  rec.remarks || 'Standard practical routine executed.'
                                )}
                              </TableCell>
                              <TableCell className="py-2.5 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleOpenDetail(rec)
                                    }}
                                    className="h-7 w-7 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                                    title="View Practical Record Details"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>

                                  {canModify(rec) ? (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleOpenDetail(rec)
                                      }}
                                      className="h-7 w-7 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                                      title="Modify Practical Log"
                                    >
                                      <Edit3 className="h-3.5 w-3.5" />
                                    </Button>
                                  ) : (
                                    <span title="Read-only (Managed by assigned faculty)">
                                      <Lock className="h-3.5 w-3.5 text-zinc-400 opacity-60 ml-1.5 inline-block" />
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}

                      {/* Group Subtotal Row if expanded and grouped */}
                      {!isCollapsed && sec.groupKey !== 'all' && (
                        <TableRow className="bg-zinc-50 dark:bg-zinc-950/40 border-b border-zinc-200/80 dark:border-zinc-800 text-xs font-mono font-bold text-zinc-800 dark:text-zinc-200">
                          <TableCell colSpan={6} className="text-right py-2 text-zinc-500">
                            Subtotal [{sec.groupTitle}]: {sec.subtotal.totalSessions} Sessions ({sec.subtotal.conductedSessions} Conducted, {sec.subtotal.skippedSessions} Skipped)
                          </TableCell>
                          <TableCell className="text-center py-2 text-emerald-700 dark:text-emerald-400">
                            {sec.subtotal.totalPresent}/{sec.subtotal.totalEnrolled} ({sec.subtotal.averageAttendancePct.toFixed(1)}%)
                          </TableCell>
                          <TableCell colSpan={3} className="py-2" />
                        </TableRow>
                      )}
                    </React.Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Practical Record Detail & Modification Modal */}
      <PracticalDetailModal
        record={selectedRecord}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedRecord(null)
        }}
        onSuccess={() => {
          if (onRecordUpdated) onRecordUpdated()
          showToast('Practical log updated successfully')
        }}
        userRole={userRole}
        userName={userName}
        userScope={userScope}
        canModify={selectedRecord ? canModify(selectedRecord) : false}
        canDelete={selectedRecord ? canDelete(selectedRecord) : false}
      />
    </div>
  )
}
