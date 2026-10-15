'use client'

import React, { useState, useEffect, useMemo } from 'react'
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
import { Input } from '@/components/ui/input'
import { IncidentRecordItem, IncidentRecordFilters } from '@/types/records'
import { filtersToSearchParams } from '@/lib/report-spec/filter-codec'
import { incidentReportSpec, formatIncidentCaseNumber } from '@/lib/report-spec/incident-spec'
import { formatClassCode } from '@/lib/report-spec/practical-spec'
import { exportIncidentRecordsAction, createPrintSelectionSessionAction } from '@/app/actions/records'
import {
  FileSpreadsheet,
  FileText,
  Printer,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  Columns3,
  X,
  Search,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ShieldAlert,
  Camera,
} from 'lucide-react'

function IndeterminateCheckbox({
  indeterminate,
  className = '',
  ...rest
}: { indeterminate?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  const ref = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = !rest.checked && Boolean(indeterminate)
    }
  }, [ref, rest.checked, indeterminate])

  return (
    <input
      type="checkbox"
      ref={ref}
      className={`rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer h-4 w-4 ${className}`}
      {...rest}
    />
  )
}

interface IncidentRecordsTableProps {
  incidents: IncidentRecordItem[]
  filters: IncidentRecordFilters
  totalCount: number
  page?: number
  pageSize?: number
  totalPages?: number
  onFiltersChange?: (newFilters: Partial<IncidentRecordFilters>) => void
  onSelectIncident: (incident: IncidentRecordItem) => void
  labs?: Array<{ id: string; name: string }>
  userRole?: string
  userName?: string
  userScope?: any
  onRecordUpdated?: () => void
  isLoading?: boolean
}

export default function IncidentRecordsTable({
  incidents,
  filters,
  totalCount,
  page = 1,
  pageSize = 10,
  totalPages = 1,
  onFiltersChange,
  onSelectIncident,
  labs = [],
  userRole = 'teacher',
  userName = '',
  userScope = null,
  onRecordUpdated,
  isLoading = false,
}: IncidentRecordsTableProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [colMenuOpen, setColMenuOpen] = useState(false)
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null)

  // Guarantee strict uniqueness of incident IDs for table rendering
  const uniqueIncidents = useMemo(() => {
    const seen = new Set<string>()
    return incidents.filter((inc) => {
      if (!inc?.id || seen.has(inc.id)) return false
      seen.add(inc.id)
      return true
    })
  }, [incidents])

  // Local state for instant global search with 300ms debounce
  const [localSearch, setLocalSearch] = useState<string>(filters.search || '')
  useEffect(() => {
    setLocalSearch(filters.search || '')
  }, [filters.search])

  useEffect(() => {
    const handler = setTimeout(() => {
      if (localSearch !== (filters.search || '')) {
        onFiltersChange?.({ search: localSearch, page: 1 })
      }
    }, 300)
    return () => clearTimeout(handler)
  }, [localSearch, filters.search, onFiltersChange])

  // Column visibility map (default all true)
  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>({
    date_case: true,
    facility: true,
    equipment: true,
    title_circ: true,
    severity: true,
    teacher_batch: true,
    status: true,
    resolution: true,
    actions: true,
  })

  const toggleColVisibility = (id: string) => {
    setVisibleCols((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3500)
  }

  // =========================================================================
  // ROW SELECTION & VIEW STATE (PHASE 2)
  // =========================================================================
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isAllMatchingSelected, setIsAllMatchingSelected] = useState<boolean>(false)

  // Lifecycle Rule: Auto-clear selection when filter, search, or sort changes.
  // Note: page and pageSize are deliberately omitted so selection persists across page navigation!
  const prevFilterSignatureRef = React.useRef<string>('')
  const currentFilterSignature = JSON.stringify({
    lab_id: filters.lab_id,
    severity: filters.severity,
    status: filters.status,
    incident_type: filters.incident_type,
    search: filters.search,
    date_from: filters.date_from,
    date_to: filters.date_to,
    sortKey: filters.sortKey,
    sortDirection: filters.sortDirection,
  })

  useEffect(() => {
    if (prevFilterSignatureRef.current && prevFilterSignatureRef.current !== currentFilterSignature) {
      setSelectedIds(new Set())
      setIsAllMatchingSelected(false)
    }
    prevFilterSignatureRef.current = currentFilterSignature
  }, [currentFilterSignature])

  // Visible page record IDs
  const pageRecordIds = useMemo(() => uniqueIncidents.map((inc) => inc.id), [uniqueIncidents])

  const allPageSelected = pageRecordIds.length > 0 && pageRecordIds.every((id) => selectedIds.has(id))
  const somePageSelected = pageRecordIds.some((id) => selectedIds.has(id)) && !allPageSelected
  const isPageIndeterminate = somePageSelected

  const isRowSelected = (id: string) => isAllMatchingSelected || selectedIds.has(id)

  const toggleRowSelect = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setIsAllMatchingSelected(false)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const togglePageSelectAll = () => {
    setIsAllMatchingSelected(false)
    if (allPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        pageRecordIds.forEach((id) => next.delete(id))
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        pageRecordIds.forEach((id) => next.add(id))
        return next
      })
    }
  }

  const handleClearSelection = () => {
    setSelectedIds(new Set())
    setIsAllMatchingSelected(false)
  }

  const handleSelectAllMatching = () => {
    setIsAllMatchingSelected(true)
    setSelectedIds(new Set(pageRecordIds))
  }

  const selectedCount = isAllMatchingSelected ? totalCount : selectedIds.size
  const hasSelection = selectedCount > 0

  const getActiveVisibleCols = () => {
    return Object.keys(visibleCols).filter((k) => visibleCols[k] && k !== 'actions')
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

  // Exports ALWAYS export the full filtered set or strictly selected rows
  const handleExport = async (format: 'xlsx' | 'csv') => {
    setIsExporting(true)
    try {
      const activeCols = getActiveVisibleCols()
      const toastText = hasSelection
        ? `Generating ${format.toUpperCase()} export for ${selectedCount} selected records...`
        : `Generating complete ${format.toUpperCase()} incident report...`
      showToast(toastText)

      const res = await exportIncidentRecordsAction(filters, format, {
        visibleColumns: activeCols,
        selectedIds: isAllMatchingSelected ? undefined : (selectedIds.size > 0 ? Array.from(selectedIds) : undefined),
        isAllMatchingSelected,
        sortKey: filters.sortKey,
        sortDirection: filters.sortDirection,
      })
      if (res.success && res.base64 && res.filename && res.contentType) {
        downloadFile(res.base64, res.filename, res.contentType)
        showToast(`Downloaded full report: ${res.filename}`)
      } else {
        showToast(`Export failed: ${res.error || 'Unknown error'}`)
      }
    } catch (e: any) {
      showToast(`Export failed: ${e.message}`)
    } finally {
      setIsExporting(false)
    }
  }

  const handleOpenPrint = async () => {
    const activeCols = getActiveVisibleCols()
    const colsParam = activeCols.join(',')

    if (isAllMatchingSelected) {
      const params = filtersToSearchParams({
        ...filters,
        page: undefined,
        pageSize: undefined,
        cols: colsParam,
        selectedAll: true,
      })
      window.open(`/print/incidents?${params.toString()}`, '_blank')
      return
    }

    if (selectedIds.size > 0) {
      const idsArray = Array.from(selectedIds)
      if (idsArray.length <= 10) {
        const params = filtersToSearchParams({
          ...filters,
          page: undefined,
          pageSize: undefined,
          cols: colsParam,
          selected: idsArray.join(','),
        })
        window.open(`/print/incidents?${params.toString()}`, '_blank')
      } else {
        showToast('Preparing print session...')
        const tokenRes = await createPrintSelectionSessionAction(idsArray)
        if (tokenRes.success && tokenRes.token) {
          const params = filtersToSearchParams({
            ...filters,
            page: undefined,
            pageSize: undefined,
            cols: colsParam,
            selKey: tokenRes.token,
          })
          window.open(`/print/incidents?${params.toString()}`, '_blank')
        } else {
          showToast(`Failed to create print session: ${tokenRes.error}`)
        }
      }
      return
    }

    // Standard unselected print
    const params = filtersToSearchParams({
      ...filters,
      page: undefined,
      pageSize: undefined,
      cols: colsParam,
    })
    window.open(`/print/incidents?${params.toString()}`, '_blank')
  }

  // Sort handler
  const handleSort = (colId: string) => {
    const isCurrent = filters.sortKey === colId
    const nextDir = isCurrent && filters.sortDirection === 'asc' ? 'desc' : 'asc'
    onFiltersChange?.({
      sortKey: colId,
      sortDirection: nextDir,
      page: 1,
    })
  }

  // Numbered pagination windowing
  const paginationRange = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }
    const items: (number | 'ellipsis')[] = []
    if (page <= 4) {
      for (let i = 1; i <= 5; i++) items.push(i)
      items.push('ellipsis')
      items.push(totalPages)
    } else if (page >= totalPages - 3) {
      items.push(1)
      items.push('ellipsis')
      for (let i = totalPages - 4; i <= totalPages; i++) items.push(i)
    } else {
      items.push(1)
      items.push('ellipsis')
      items.push(page - 1)
      items.push(page)
      items.push(page + 1)
      items.push('ellipsis')
      items.push(totalPages)
    }
    return items
  }, [page, totalPages])

  const startRecord = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const endRecord = Math.min(page * pageSize, totalCount)

  const visibleColCount = useMemo(() => {
    return Object.values(visibleCols).filter(Boolean).length
  }, [visibleCols])

  return (
    <div className="space-y-3 font-sans">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 px-4 py-2.5 rounded-xl shadow-2xl text-xs font-mono font-medium flex items-center gap-2 border border-zinc-700 animate-in slide-in-from-top-2 duration-150">
          <Sparkles className="h-4 w-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ==================================================================== */}
      {/* DATATABLES ACTION STRIP (Show entries, Search, ColVis, Full-Export) */}
      {/* ==================================================================== */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2.5 rounded-2xl shadow-xs">
        {/* Left: Page Size Selector */}
        <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          <span>Show</span>
          <select
            value={pageSize >= 1000 ? 1000 : pageSize}
            onChange={(e) => onFiltersChange?.({ pageSize: Number(e.target.value), page: 1 })}
            className="h-8 px-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={1000}>All ({totalCount})</option>
          </select>
          <span>entries</span>
        </div>

        {/* Right: Instant Search + Column Vis + Export Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Instant Global Search Box */}
          <div className="relative min-w-[200px] sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            <Input
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search equipment, notes..."
              className="h-8 pl-8 pr-7 text-xs bg-zinc-50 dark:bg-zinc-950 border-zinc-300 dark:border-zinc-800 rounded-xl"
            />
            {localSearch && (
              <button
                type="button"
                onClick={() => setLocalSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Column Visibility Dropdown */}
          <div className="relative">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setColMenuOpen(!colMenuOpen)}
              className="h-8 px-2.5 rounded-xl border-zinc-200 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 gap-1.5 cursor-pointer"
              title="Toggle Visible Columns"
            >
              <Columns3 className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Columns</span>
            </Button>

            {colMenuOpen && (
              <div className="absolute right-0 mt-1 w-48 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl z-40 p-2 space-y-1 text-xs">
                <div className="px-2 py-1 text-[10px] font-mono uppercase text-zinc-400 font-bold border-b border-zinc-100 dark:border-zinc-800">
                  Toggle Columns
                </div>
                {[
                  { id: 'date_case', label: 'Date & Case #' },
                  { id: 'facility', label: 'Facility' },
                  { id: 'equipment', label: 'Equipment' },
                  { id: 'title_circ', label: 'Circumstances' },
                  { id: 'severity', label: 'Severity' },
                  { id: 'teacher_batch', label: 'Faculty & Class' },
                  { id: 'status', label: 'Status' },
                  { id: 'resolution', label: 'Resolution Notes' },
                ].map((col) => (
                  <label
                    key={col.id}
                    className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer select-none text-zinc-800 dark:text-zinc-200"
                  >
                    <input
                      type="checkbox"
                      checked={visibleCols[col.id] ?? true}
                      onChange={() => toggleColVisibility(col.id)}
                      className="rounded-xs text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span>{col.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Export Toolbar with Full-Dataset Tooltip */}
          <div
            className="flex items-center rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-0.5 gap-0.5"
            title="Exports include all matching records, not just this page"
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isExporting || totalCount === 0}
              onClick={() => handleExport('csv')}
              className="h-7 px-2 text-xs font-mono font-medium text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 rounded-lg gap-1 cursor-pointer"
            >
              <FileText className="h-3 w-3 text-sky-500" />
              <span>CSV</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isExporting || totalCount === 0}
              onClick={() => handleExport('xlsx')}
              className="h-7 px-2 text-xs font-mono font-medium text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 rounded-lg gap-1 cursor-pointer"
            >
              <FileSpreadsheet className="h-3 w-3 text-emerald-500" />
              <span>Excel</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleOpenPrint}
              className="h-7 px-2 text-xs font-mono font-medium text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 rounded-lg gap-1 cursor-pointer"
            >
              <Printer className="h-3 w-3 text-indigo-500" />
              <span>Print</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* CONTEXTUAL ROW SELECTION ACTION BAR (PHASE 2) */}
      {/* ==================================================================== */}
      {hasSelection && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2 rounded-2xl bg-indigo-500/10 dark:bg-indigo-950/30 border border-indigo-500/30 dark:border-indigo-800/60 text-xs font-mono text-indigo-950 dark:text-indigo-200 animate-in fade-in slide-in-from-top-1 duration-150 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
            <span className="font-bold font-heading text-sm text-indigo-900 dark:text-indigo-200">
              {selectedCount} {selectedCount === 1 ? 'case' : 'cases'} selected
            </span>
            {isAllMatchingSelected && (
              <Badge variant="outline" className="text-[10px] font-mono border-indigo-500/40 text-indigo-700 dark:text-indigo-300">
                All matching filters
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              disabled={isExporting}
              onClick={() => handleExport('csv')}
              className="h-7 px-2.5 text-xs font-mono bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg gap-1.5 shadow-xs cursor-pointer"
            >
              <FileText className="h-3.5 w-3.5 text-sky-500" />
              <span>Export Selected (CSV)</span>
            </Button>

            <Button
              type="button"
              size="sm"
              disabled={isExporting}
              onClick={() => handleExport('xlsx')}
              className="h-7 px-2.5 text-xs font-mono bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg gap-1.5 shadow-xs cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
              <span>Export Selected (Excel)</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleOpenPrint}
              className="h-7 px-2.5 text-xs font-mono bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5 text-white" />
              <span>Print Selected</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearSelection}
              className="h-7 px-2 text-xs font-mono text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-lg cursor-pointer"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              <span>Clear</span>
            </Button>
          </div>
        </div>
      )}

      {/* Gmail-Style "Select all N matching filters" Banner */}
      {allPageSelected && totalCount > pageRecordIds.length && (
        <div className="flex items-center justify-center gap-2 px-3.5 py-1.5 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-xl text-xs font-mono text-indigo-900 dark:text-indigo-200 text-center">
          {!isAllMatchingSelected ? (
            <>
              <span>All <strong>{pageRecordIds.length}</strong> incident cases on this page are selected.</span>
              <button
                type="button"
                onClick={handleSelectAllMatching}
                className="font-bold underline text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-indigo-100 cursor-pointer ml-1"
              >
                Select all {totalCount} cases matching current filters
              </button>
            </>
          ) : (
            <>
              <span>All <strong>{totalCount}</strong> cases matching current filters are selected.</span>
              <button
                type="button"
                onClick={handleClearSelection}
                className="font-bold underline text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-indigo-100 cursor-pointer ml-1"
              >
                Clear selection
              </button>
            </>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TABLE DATA GRID WITH SORT HEADERS */}
      {/* ==================================================================== */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-zinc-50/80 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800 admin-type-table-header text-zinc-600 dark:text-slate-300">
              {/* Single Clean Header Row: Labels with Sort Carets */}
              <TableRow className="hover:bg-transparent">
                {/* 0. Row Selection Checkbox */}
                <TableHead className="w-10 px-3 py-2.5 text-center select-none">
                  <IndeterminateCheckbox
                    checked={allPageSelected}
                    indeterminate={isPageIndeterminate}
                    onChange={togglePageSelectAll}
                    aria-label="Select all incidents on this page"
                  />
                </TableHead>

                {visibleCols.date_case && (
                  <TableHead
                    onClick={() => handleSort('date_case')}
                    className="w-28 font-bold text-zinc-600 dark:text-slate-300 cursor-pointer select-none hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Date & Case</span>
                      {filters.sortKey === 'date_case' ? (
                        filters.sortDirection === 'asc' ? (
                          <ArrowUp className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <ArrowDown className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-zinc-400 dark:text-slate-400 opacity-70" />
                      )}
                    </div>
                  </TableHead>
                )}

                {visibleCols.facility && (
                  <TableHead
                    onClick={() => handleSort('facility')}
                    className="w-28 font-bold text-zinc-600 dark:text-slate-300 cursor-pointer select-none hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Facility</span>
                      {filters.sortKey === 'facility' ? (
                        filters.sortDirection === 'asc' ? (
                          <ArrowUp className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <ArrowDown className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-zinc-400 dark:text-slate-400 opacity-70" />
                      )}
                    </div>
                  </TableHead>
                )}

                {visibleCols.equipment && (
                  <TableHead
                    onClick={() => handleSort('equipment')}
                    className="w-36 font-bold text-zinc-600 dark:text-slate-300 cursor-pointer select-none hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Equipment</span>
                      {filters.sortKey === 'equipment' ? (
                        filters.sortDirection === 'asc' ? (
                          <ArrowUp className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <ArrowDown className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-zinc-400 dark:text-slate-400 opacity-70" />
                      )}
                    </div>
                  </TableHead>
                )}

                {visibleCols.title_circ && (
                  <TableHead
                    onClick={() => handleSort('title_circ')}
                    className="min-w-[180px] font-bold text-zinc-600 dark:text-slate-300 cursor-pointer select-none hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Circumstances & Description</span>
                      {filters.sortKey === 'title_circ' ? (
                        filters.sortDirection === 'asc' ? (
                          <ArrowUp className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <ArrowDown className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-zinc-400 dark:text-slate-400 opacity-70" />
                      )}
                    </div>
                  </TableHead>
                )}

                {visibleCols.severity && (
                  <TableHead
                    onClick={() => handleSort('severity')}
                    className="w-20 text-center font-bold text-zinc-600 dark:text-slate-300 cursor-pointer select-none hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Severity</span>
                      {filters.sortKey === 'severity' ? (
                        filters.sortDirection === 'asc' ? (
                          <ArrowUp className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <ArrowDown className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-zinc-400 dark:text-slate-400 opacity-70" />
                      )}
                    </div>
                  </TableHead>
                )}

                {visibleCols.teacher_batch && (
                  <TableHead
                    onClick={() => handleSort('teacher_batch')}
                    className="w-32 font-bold text-zinc-600 dark:text-slate-300 cursor-pointer select-none hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Faculty & Class</span>
                      {filters.sortKey === 'teacher_batch' ? (
                        filters.sortDirection === 'asc' ? (
                          <ArrowUp className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <ArrowDown className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-zinc-400 dark:text-slate-400 opacity-70" />
                      )}
                    </div>
                  </TableHead>
                )}

                {visibleCols.status && (
                  <TableHead
                    onClick={() => handleSort('status')}
                    className="w-24 text-center font-bold text-zinc-600 dark:text-slate-300 cursor-pointer select-none hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Status</span>
                      {filters.sortKey === 'status' ? (
                        filters.sortDirection === 'asc' ? (
                          <ArrowUp className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <ArrowDown className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-zinc-400 dark:text-slate-400 opacity-70" />
                      )}
                    </div>
                  </TableHead>
                )}

                {visibleCols.resolution && (
                  <TableHead className="w-48 font-bold text-zinc-600 dark:text-slate-300">
                    Resolution Notes
                  </TableHead>
                )}

                {visibleCols.actions && (
                  <TableHead className="w-16 text-right font-bold text-zinc-600 dark:text-slate-300">
                    Action
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>

            {/* Table Body */}
            <TableBody className="text-xs divide-y divide-zinc-100 dark:divide-zinc-800">
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={visibleColCount + 1} className="py-12 text-center text-zinc-500 font-mono">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                      <span>Loading incident records...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : incidents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleColCount + 1} className="py-12 text-center text-zinc-500">
                    <div className="space-y-1">
                      <p className="font-medium text-zinc-700 dark:text-zinc-300">No incident or damage records found</p>
                      <p className="text-[11px] text-zinc-400 dark:text-slate-400">Try adjusting your scope filters or search terms.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                uniqueIncidents.map((inc) => {
                  const isResolved = inc.status === 'resolved'
                  const isEscalated = inc.status === 'escalated_to_hod'
                  const rawDate = inc.date || inc.created_at
                  const dateStr =
                    (rawDate as unknown) instanceof Date
                      ? (isNaN((rawDate as unknown as Date).getTime()) ? '—' : (rawDate as unknown as Date).toISOString().split('T')[0])
                      : typeof rawDate === 'string'
                      ? (rawDate.includes('T') ? rawDate.split('T')[0] : rawDate || '—')
                      : String(rawDate || '—')
                  const caseNum = formatIncidentCaseNumber(inc.id, (inc as any).incident_number)
                  const isSelected = isRowSelected(inc.id)

                  return (
                    <TableRow
                      key={inc.id}
                      onClick={() => onSelectIncident(inc)}
                      className={`hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors cursor-pointer ${
                        isSelected ? 'bg-indigo-50/50 dark:bg-indigo-950/25' : ''
                      }`}
                    >
                      {/* 0. Row Selection Checkbox */}
                      <TableCell
                        onClick={(e) => e.stopPropagation()}
                        className="w-10 px-3 text-center"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => toggleRowSelect(inc.id, e as any)}
                          className="rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer h-4 w-4"
                          aria-label={`Select incident case ${caseNum}`}
                        />
                      </TableCell>

                      {/* Date & Case */}
                      {visibleCols.date_case && (
                        <TableCell className="font-mono whitespace-nowrap">
                          <div className="admin-type-primary-label text-zinc-950 dark:text-white">{dateStr}</div>
                          <div className="admin-type-code-chip text-zinc-500 dark:text-slate-300 mt-0.5">{caseNum}</div>
                        </TableCell>
                      )}

                      {/* Facility */}
                      {visibleCols.facility && (
                        <TableCell className="admin-type-subtext text-zinc-800 dark:text-slate-200 font-medium whitespace-nowrap">
                          {inc.labs?.name || inc.lab_id}
                        </TableCell>
                      )}

                      {/* Equipment */}
                      {visibleCols.equipment && (
                        <TableCell className="whitespace-nowrap">
                          <div className="admin-type-primary-label text-zinc-950 dark:text-white">
                            {inc.equipment_name || 'Workstation Equipment'}
                          </div>
                          <div className="admin-type-subtext text-[11px] font-mono uppercase text-zinc-500 dark:text-slate-300 mt-0.5">
                            {String(inc.incident_type || 'Malfunction').replace(/_/g, ' ')}
                          </div>
                        </TableCell>
                      )}

                      {/* Circumstances & Description with Photo Thumbnail */}
                      {visibleCols.title_circ && (
                        <TableCell className="min-w-[200px]">
                          <div className="flex items-center gap-2.5">
                            {inc.photo_url && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setLightboxPhoto(inc.photo_url!)
                                }}
                                className="relative shrink-0 h-9 w-9 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 hover:ring-2 hover:ring-indigo-500 transition-all cursor-pointer group shadow-2xs"
                                title="View attached evidence photo"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={inc.photo_url}
                                  alt="Photo Evidence"
                                  className="h-full w-full object-cover group-hover:scale-110 transition-transform"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <Camera className="h-3.5 w-3.5 text-white" />
                                </div>
                              </button>
                            )}
                            <div className="min-w-0">
                              <div className="admin-type-body text-zinc-900 dark:text-zinc-100 font-medium line-clamp-1" title={inc.title}>
                                {inc.title}
                              </div>
                              {inc.circumstances && (
                                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-0.5" title={inc.circumstances}>
                                  {inc.circumstances}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      )}

                      {/* Severity */}
                      {visibleCols.severity && (
                        <TableCell className="text-center whitespace-nowrap">
                          {inc.severity === 'major_critical' ? (
                            <Badge className="text-[9px] uppercase font-mono font-bold bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30">
                              Critical
                            </Badge>
                          ) : inc.severity === 'moderate' ? (
                            <Badge className="text-[9px] uppercase font-mono font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30">
                              Moderate
                            </Badge>
                          ) : (
                            <Badge className="text-[9px] uppercase font-mono font-bold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700">
                              Minor
                            </Badge>
                          )}
                        </TableCell>
                      )}

                      {/* Faculty & Class */}
                      {visibleCols.teacher_batch && (
                        <TableCell className="whitespace-nowrap">
                          <div className="admin-type-primary-label text-zinc-950 dark:text-white">
                            {inc.subject_teacher_name || inc.reported_by || 'Staff'}
                          </div>
                          <div className="admin-type-code-chip text-zinc-500 dark:text-slate-300 mt-0.5">
                            {inc.batch_name ? formatClassCode(inc.batch_name) : 'General Class'}
                          </div>
                        </TableCell>
                      )}

                      {/* Status */}
                      {visibleCols.status && (
                        <TableCell className="text-center whitespace-nowrap">
                          {isResolved ? (
                            <Badge className="text-[9px] uppercase font-mono font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                              Resolved
                            </Badge>
                          ) : isEscalated ? (
                            <Badge className="text-[9px] uppercase font-mono font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30">
                              HOD Review
                            </Badge>
                          ) : inc.status === 'under_repair' ? (
                            <Badge className="text-[9px] uppercase font-mono font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30">
                              Repair
                            </Badge>
                          ) : (
                            <Badge className="text-[9px] uppercase font-mono font-bold bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30">
                              Reported
                            </Badge>
                          )}
                        </TableCell>
                      )}

                      {/* Resolution */}
                      {visibleCols.resolution && (
                        <TableCell className="max-w-[200px]" title={inc.resolution_notes || undefined}>
                          <div className="admin-type-subtext text-zinc-600 dark:text-slate-300 line-clamp-1">
                            {inc.resolution_notes || '—'}
                          </div>
                          {inc.time_to_resolve_label && (
                            <div className="admin-type-code-chip text-zinc-500 dark:text-slate-300 font-mono mt-0.5">
                              Duration: {inc.time_to_resolve_label}
                            </div>
                          )}
                        </TableCell>
                      )}

                      {/* Actions */}
                      {visibleCols.actions && (
                        <TableCell className="py-2.5 text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation()
                              onSelectIncident(inc)
                            }}
                            className="h-7 w-7 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                            title="Triage / View Incident Details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* ==================================================================== */}
        {/* NUMBERED PAGINATION FOOTER */}
        {/* ==================================================================== */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-zinc-50 dark:bg-zinc-950/70 border-t border-zinc-200 dark:border-zinc-800 text-xs">
          {/* Left: Entries Counter */}
          <div className="text-zinc-500 dark:text-slate-300 font-mono text-[11.5px]">
            Showing <span className="font-bold text-zinc-900 dark:text-zinc-100">{startRecord}</span> to{' '}
            <span className="font-bold text-zinc-900 dark:text-zinc-100">{endRecord}</span> of{' '}
            <span className="font-bold text-zinc-900 dark:text-zinc-100">{totalCount}</span> entries
          </div>

          {/* Right: Numbered Page Buttons */}
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || isLoading}
              onClick={() => onFiltersChange?.({ page: page - 1 })}
              className="h-7 px-2 text-xs font-mono border-zinc-200 dark:border-zinc-800 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-0.5" />
              <span>Previous</span>
            </Button>

            {paginationRange.map((item, idx) => {
              if (item === 'ellipsis') {
                return (
                  <span key={`ellipsis-${idx}`} className="px-1 text-zinc-400 font-mono">
                    …
                  </span>
                )
              }
              const isCurrent = item === page
              return (
                <Button
                  key={item}
                  type="button"
                  size="sm"
                  variant={isCurrent ? 'default' : 'outline'}
                  disabled={isLoading}
                  onClick={() => onFiltersChange?.({ page: item })}
                  className={`h-7 w-7 p-0 text-xs font-mono font-semibold ${
                    isCurrent
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-600'
                      : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  {item}
                </Button>
              )
            })}

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isLoading}
              onClick={() => onFiltersChange?.({ page: page + 1 })}
              className="h-7 px-2 text-xs font-mono border-zinc-200 dark:border-zinc-800 disabled:opacity-40"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Lightbox Modal for Photo Evidence */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-[10000] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="relative max-w-3xl max-h-[85vh] rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxPhoto(null)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-black/70 hover:bg-black text-white transition-colors z-10 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxPhoto}
              alt="Full Evidence Preview"
              className="max-h-[85vh] w-auto object-contain"
            />
          </div>
        </div>
      )}
    </div>
  )
}
