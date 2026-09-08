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
import { IncidentRecordItem, IncidentRecordFilters } from '@/types/records'
import { exportIncidentRecordsAction } from '@/app/actions/records'
import {
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  ChevronDown,
  Sparkles,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react'

interface IncidentRecordsTableProps {
  incidents: IncidentRecordItem[]
  filters: IncidentRecordFilters
  onSelectIncident: (incident: IncidentRecordItem) => void
  totalCount: number
  isLoading?: boolean
}

export default function IncidentRecordsTable({
  incidents,
  filters,
  onSelectIncident,
  totalCount,
  isLoading = false,
}: IncidentRecordsTableProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3500)
  }

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
      showToast(`Generating certified incident register export in ${format.toUpperCase()}...`)
      const res = await exportIncidentRecordsAction(filters, format)
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
    if (filters.severity) params.set('severity', filters.severity)
    if (filters.status) params.set('status', filters.status)
    if (filters.date_from) params.set('date_from', filters.date_from)
    if (filters.date_to) params.set('date_to', filters.date_to)

    window.open(`/print/incidents?${params.toString()}`, '_blank')
  }

  return (
    <div className="space-y-4 font-sans">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 px-4 py-2.5 rounded-xl shadow-2xl text-xs font-mono font-medium flex items-center gap-2 border border-zinc-700 animate-in slide-in-from-top-2 duration-150">
          <Sparkles className="h-4 w-4 text-rose-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-zinc-950 dark:text-white font-mono">
            Incident & Damage Records {isLoading ? '' : `(${totalCount})`}
          </span>
          <span className="text-xs text-zinc-500 font-sans">
            Click any record to inspect full audit timeline or certify resolution
          </span>
        </div>

        {/* Official Export Dropdown */}
        <div className="relative">
          <Button
            onClick={() => setExportMenuOpen(!exportMenuOpen)}
            disabled={isLoading || isExporting || totalCount === 0}
            className="h-9 px-3.5 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white text-xs font-medium flex items-center gap-2 shadow-xs transition-transform active:scale-95"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{isExporting ? 'Exporting...' : 'Export Register'}</span>
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
                    Excel Register (.xlsx)
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    Separated Reported vs Action Taken with severity fills
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
                    CSV Register (.csv)
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
                <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:scale-105 transition-transform mt-0.5">
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

      {/* Main Table */}
      <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center text-zinc-500 space-y-3">
            <div className="h-7 w-7 rounded-full border-2 border-rose-500/30 border-t-rose-600 animate-spin" />
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 font-mono">
              Loading incident records...
            </p>
          </div>
        ) : totalCount === 0 ? (
          <div className="p-12 text-center text-zinc-500 space-y-1.5">
            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              No records found
            </p>
            <p className="text-xs text-zinc-400">
              No incident or damage records matching the selected criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-zinc-50/80 dark:bg-zinc-950/70 border-b border-zinc-200 dark:border-zinc-800">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-[11px] font-mono font-bold uppercase text-zinc-600 dark:text-zinc-400 w-24">Date</TableHead>
                  <TableHead className="text-[11px] font-mono font-bold uppercase text-zinc-600 dark:text-zinc-400 w-24">Facility</TableHead>
                  <TableHead className="text-[11px] font-mono font-bold uppercase text-zinc-600 dark:text-zinc-400">Apparatus & Circumstances</TableHead>
                  <TableHead className="text-[11px] font-mono font-bold uppercase text-zinc-600 dark:text-zinc-400 w-28 text-center">Severity</TableHead>
                  <TableHead className="text-[11px] font-mono font-bold uppercase text-zinc-600 dark:text-zinc-400 w-32">Class & Teacher</TableHead>
                  <TableHead className="text-[11px] font-mono font-bold uppercase text-zinc-600 dark:text-zinc-400 w-32 text-center">Lifecycle Status</TableHead>
                  <TableHead className="text-[11px] font-mono font-bold uppercase text-zinc-600 dark:text-zinc-400 w-28 text-center">Response Speed</TableHead>
                  <TableHead className="text-[11px] font-mono font-bold uppercase text-zinc-600 dark:text-zinc-400 w-36">Action Taken</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {incidents.map((inc) => {
                  const isCritical = inc.severity === 'major_critical'
                  const isModerate = inc.severity === 'moderate'
                  const isResolved = inc.status === 'resolved'
                  const isEscalated = inc.escalated_to_hod

                  return (
                    <TableRow
                      key={inc.id}
                      onClick={() => onSelectIncident(inc)}
                      className="text-xs hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors"
                    >
                      {/* Date & Period */}
                      <TableCell className="font-mono text-zinc-600 dark:text-zinc-400 whitespace-nowrap align-top">
                        <div>{inc.date}</div>
                        <div className="text-[10px] text-zinc-400">{inc.session_label.split(' ')[0]}</div>
                      </TableCell>

                      {/* Lab Facility */}
                      <TableCell className="font-semibold text-zinc-900 dark:text-white align-top whitespace-nowrap">
                        {inc.labs?.name?.split(' ')[0] || inc.lab_id.toUpperCase()} Lab
                      </TableCell>

                      {/* Apparatus & Circumstances */}
                      <TableCell className="align-top">
                        <div className="font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
                          <span>{inc.equipment_name}</span>
                          <span className="text-zinc-400 font-normal">(x{inc.quantity})</span>
                        </div>
                        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5 line-clamp-2">
                          {inc.title}
                        </p>
                        {inc.student_rolls && (
                          <div className="text-[10px] text-zinc-400 mt-1 font-mono">
                            Roll(s): <strong>{inc.student_rolls}</strong>
                          </div>
                        )}
                      </TableCell>

                      {/* Severity */}
                      <TableCell className="text-center align-top whitespace-nowrap">
                        <Badge
                          className={`text-[10px] uppercase font-mono font-bold ${
                            isCritical
                              ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                              : isModerate
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                              : 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30'
                          }`}
                        >
                          {inc.severity.replace('_', ' ')}
                        </Badge>
                      </TableCell>

                      {/* Class & Faculty */}
                      <TableCell className="align-top">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {inc.batch_name}
                        </div>
                        <div className="text-[11px] text-zinc-500 mt-0.5 truncate">
                          {inc.subject_teacher_name}
                        </div>
                      </TableCell>

                      {/* Lifecycle Status */}
                      <TableCell className="text-center align-top whitespace-nowrap">
                        <div className="flex flex-col items-center gap-1">
                          <Badge
                            className={`text-[10px] uppercase font-mono font-bold ${
                              isResolved
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                : isEscalated
                                ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                                : inc.status === 'under_repair'
                                ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30'
                                : inc.status === 'replaced'
                                ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30'
                                : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                            }`}
                          >
                            {inc.status.replace('_', ' ')}
                          </Badge>

                          {isEscalated && (
                            <span className="text-[9px] font-mono font-bold text-rose-600 dark:text-rose-400 flex items-center gap-0.5">
                              <ShieldAlert className="h-2.5 w-2.5" /> HOD Alert
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Derived Response Speed */}
                      <TableCell className="text-center align-top font-mono text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                        <span className={`text-[11px] ${isResolved ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}`}>
                          {inc.time_to_resolve_label}
                        </span>
                      </TableCell>

                      {/* Action Taken */}
                      <TableCell className="align-top text-[11px] text-zinc-600 dark:text-zinc-400">
                        {inc.resolution_notes ? (
                          <div className="line-clamp-2 italic">
                            "{inc.resolution_notes}"
                          </div>
                        ) : (
                          <span className="text-zinc-400 italic">Pending inspection</span>
                        )}
                        {inc.resolved_by && (
                          <div className="text-[10px] text-zinc-400 font-mono mt-1">
                            By {inc.resolved_by}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
