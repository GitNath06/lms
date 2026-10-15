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
import {
  PracticalGroupedSection,
  PracticalRecordFilters,
  PracticalGroupingKey,
} from '@/types/records'
import { filtersToSearchParams } from '@/lib/report-spec/filter-codec'
import { exportPracticalRecordsAction, createPrintSelectionSessionAction } from '@/app/actions/records'
import {
  FileSpreadsheet,
  FileText,
  Printer,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Columns3,
  X,
  Search,
  Eye,
  Edit3,
  Lock,
} from 'lucide-react'
import PracticalDetailModal from '@/components/records/practical-detail-modal'

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
      className={`rounded border-zinc-300 dark:border-zinc-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer h-4 w-4 ${className}`}
      {...rest}
    />
  )
}

interface PracticalRecordsTableProps {
  sections: PracticalGroupedSection[]
  filters: PracticalRecordFilters
  groupBy: PracticalGroupingKey
  totalCount: number
  page?: number
  pageSize?: number
  totalPages?: number
  onFiltersChange?: (newFilters: Partial<PracticalRecordFilters>) => void
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
  page = 1,
  pageSize = 10,
  totalPages = 1,
  onFiltersChange,
  userRole = 'teacher',
  userName = '',
  userScope = null,
  onRecordUpdated,
  isLoading = false,
}: PracticalRecordsTableProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [colMenuOpen, setColMenuOpen] = useState<boolean>(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

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

  // Column visibility map (order matches reference print sequence: Date → Period → Facility → Class → Subject → Experiment → Teacher → Attendance → Status → Remarks → Actions)
  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>({
    date: true,
    period: true,
    facility: true,
    class_batch: true,
    subject: true,
    experiment: true,
    teacher: true,
    attendance: true,
    status: true,
    remarks: true,
    actions: true,
  })

  const toggleColVisibility = (id: string) => {
    setVisibleCols((prev) => ({ ...prev, [id]: !prev[id] }))
  }

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
    date_from: filters.date_from,
    date_to: filters.date_to,
    status: filters.status,
    search: filters.search,
    batch_group: filters.batch_group,
    subject_name: filters.subject_name,
    teacher_id: filters.teacher_id,
    sortKey: filters.sortKey,
    sortDirection: filters.sortDirection,
    groupBy,
  })

  useEffect(() => {
    if (prevFilterSignatureRef.current && prevFilterSignatureRef.current !== currentFilterSignature) {
      setSelectedIds(new Set())
      setIsAllMatchingSelected(false)
    }
    prevFilterSignatureRef.current = currentFilterSignature
  }, [currentFilterSignature])

  // Flatten visible page records
  const pageRecords = useMemo(() => sections.flatMap((s) => s.records), [sections])
  const pageRecordIds = useMemo(() => pageRecords.map((r) => r.id), [pageRecords])

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
    try {
      const activeCols = getActiveVisibleCols()
      const toastText = hasSelection
        ? `Generating ${format.toUpperCase()} export for ${selectedCount} selected records...`
        : `Generating complete ${format.toUpperCase()} practical export...`
      showToast(toastText)

      const res = await exportPracticalRecordsAction(filters, groupBy, format, {
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
      if (groupBy !== 'none') params.set('groupBy', groupBy)
      window.open(`/print/records?${params.toString()}`, '_blank')
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
        if (groupBy !== 'none') params.set('groupBy', groupBy)
        window.open(`/print/records?${params.toString()}`, '_blank')
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
          if (groupBy !== 'none') params.set('groupBy', groupBy)
          window.open(`/print/records?${params.toString()}`, '_blank')
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
    if (groupBy !== 'none') params.set('groupBy', groupBy)
    window.open(`/print/records?${params.toString()}`, '_blank')
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
        {/* Left: Page Size Selector + Grouping Badge */}
        <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          <span>Show</span>
          <select
            value={pageSize >= 1000 ? 1000 : pageSize}
            onChange={(e) => onFiltersChange?.({ pageSize: Number(e.target.value), page: 1 })}
            className="h-8 px-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 cursor-pointer"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={1000}>All ({totalCount})</option>
          </select>
          <span>entries</span>
          {groupBy !== 'none' && (
            <Badge variant="outline" className="ml-2 text-[10px] font-mono bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800">
              Segmented by {groupBy.replace('_', ' ')}
            </Badge>
          )}
        </div>

        {/* Right: Instant Search + Column Vis + Export Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Instant Global Search Box */}
          <div className="relative min-w-[200px] sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            <Input
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search experiments, remarks..."
              className="h-8 pl-8 pr-7 text-xs bg-zinc-50 dark:bg-zinc-950 border-zinc-300 dark:border-zinc-800 rounded-xl"
            />
            {localSearch && (
              <button
                type="button"
                onClick={() => setLocalSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
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
              <div className="absolute right-0 mt-1 w-56 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl z-40 p-2 space-y-1 text-xs">
                <div className="px-2 py-1 text-[10px] font-mono uppercase text-zinc-400 font-bold border-b border-zinc-100 dark:border-zinc-800">
                  Toggle Columns
                </div>
                {[
                  { id: 'date', label: 'Date' },
                  { id: 'period', label: 'Period' },
                  { id: 'facility', label: 'Facility' },
                  { id: 'class_batch', label: 'Class' },
                  { id: 'subject', label: 'Subject' },
                  { id: 'experiment', label: 'Practical Experiment' },
                  { id: 'teacher', label: 'Subject Teacher' },
                  { id: 'attendance', label: 'Attendance' },
                  { id: 'status', label: 'Status' },
                  { id: 'remarks', label: 'Verification Remarks' },
                ].map((col) => (
                  <label
                    key={col.id}
                    className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer select-none text-zinc-800 dark:text-zinc-200"
                  >
                    <input
                      type="checkbox"
                      checked={visibleCols[col.id] ?? true}
                      onChange={() => toggleColVisibility(col.id)}
                      className="rounded-xs text-emerald-600 focus:ring-emerald-500 cursor-pointer"
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
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2 rounded-2xl bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-500/30 dark:border-emerald-800/60 text-xs font-mono text-emerald-950 dark:text-emerald-200 animate-in fade-in slide-in-from-top-1 duration-150 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold font-heading text-sm text-emerald-900 dark:text-emerald-200">
              {selectedCount} {selectedCount === 1 ? 'record' : 'records'} selected
            </span>
            {isAllMatchingSelected && (
              <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
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
              className="h-7 px-2.5 text-xs font-mono bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg gap-1.5 shadow-xs cursor-pointer"
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
        <div className="flex items-center justify-center gap-2 px-3.5 py-1.5 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs font-mono text-emerald-900 dark:text-emerald-200 text-center">
          {!isAllMatchingSelected ? (
            <>
              <span>All <strong>{pageRecordIds.length}</strong> records on this page are selected.</span>
              <button
                type="button"
                onClick={handleSelectAllMatching}
                className="font-bold underline text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-100 cursor-pointer ml-1"
              >
                Select all {totalCount} records matching current filters
              </button>
            </>
          ) : (
            <>
              <span>All <strong>{totalCount}</strong> records matching current filters are selected.</span>
              <button
                type="button"
                onClick={handleClearSelection}
                className="font-bold underline text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-100 cursor-pointer ml-1"
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
          <Table className="[&_th]:px-3.5 [&_th]:py-2.5 [&_td]:px-3.5 [&_td]:py-2.5">
            <TableHeader className="bg-zinc-50/80 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800 admin-type-table-header text-zinc-600 dark:text-slate-300">
              <TableRow className="hover:bg-transparent">
                {/* 0. Row Selection Checkbox */}
                <TableHead className="w-10 px-3 py-2.5 text-center select-none">
                  <IndeterminateCheckbox
                    checked={allPageSelected}
                    indeterminate={isPageIndeterminate}
                    onChange={togglePageSelectAll}
                    aria-label="Select all records on this page"
                  />
                </TableHead>

                {/* 1. Date */}
                {visibleCols.date && (
                  <TableHead
                    onClick={() => handleSort('date')}
                    className="w-24 font-bold text-zinc-600 dark:text-slate-300 cursor-pointer select-none hover:text-emerald-600 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Date</span>
                      {filters.sortKey === 'date' ? (
                        filters.sortDirection === 'asc' ? (
                          <ArrowUp className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <ArrowDown className="h-3 w-3 text-emerald-600" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-zinc-400 dark:text-slate-400 opacity-70" />
                      )}
                    </div>
                  </TableHead>
                )}

                {/* 2. Period */}
                {visibleCols.period && (
                  <TableHead
                    onClick={() => handleSort('period_label')}
                    className="w-28 font-bold text-zinc-600 dark:text-slate-300 cursor-pointer select-none hover:text-emerald-600 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Period</span>
                      {filters.sortKey === 'period_label' ? (
                        filters.sortDirection === 'asc' ? (
                          <ArrowUp className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <ArrowDown className="h-3 w-3 text-emerald-600" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-zinc-400 dark:text-slate-400 opacity-70" />
                      )}
                    </div>
                  </TableHead>
                )}

                {/* 3. Facility */}
                {visibleCols.facility && (
                  <TableHead
                    onClick={() => handleSort('facility')}
                    className="w-28 font-bold text-zinc-600 dark:text-slate-300 cursor-pointer select-none hover:text-emerald-600 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Facility</span>
                      {filters.sortKey === 'facility' ? (
                        filters.sortDirection === 'asc' ? (
                          <ArrowUp className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <ArrowDown className="h-3 w-3 text-emerald-600" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-zinc-400 dark:text-slate-400 opacity-70" />
                      )}
                    </div>
                  </TableHead>
                )}

                {/* 4. Class (Reordered before Subject) */}
                {visibleCols.class_batch && (
                  <TableHead
                    onClick={() => handleSort('batch_group')}
                    className="w-20 font-bold text-zinc-600 dark:text-slate-300 cursor-pointer select-none hover:text-emerald-600 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Class</span>
                      {filters.sortKey === 'batch_group' ? (
                        filters.sortDirection === 'asc' ? (
                          <ArrowUp className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <ArrowDown className="h-3 w-3 text-emerald-600" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-zinc-400 dark:text-slate-400 opacity-70" />
                      )}
                    </div>
                  </TableHead>
                )}

                {/* 5. Subject (Clean title + code-chip, expanded width) */}
                {visibleCols.subject && (
                  <TableHead
                    onClick={() => handleSort('subject_name')}
                    className="min-w-[240px] w-64 font-bold text-zinc-600 dark:text-slate-300 cursor-pointer select-none hover:text-emerald-600 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Subject</span>
                      {filters.sortKey === 'subject_name' ? (
                        filters.sortDirection === 'asc' ? (
                          <ArrowUp className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <ArrowDown className="h-3 w-3 text-emerald-600" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-zinc-400 dark:text-slate-400 opacity-70" />
                      )}
                    </div>
                  </TableHead>
                )}

                {/* 6. Practical Experiment (Separate column, expanded width) */}
                {visibleCols.experiment && (
                  <TableHead
                    onClick={() => handleSort('practical_title')}
                    className="min-w-[240px] font-bold text-zinc-600 dark:text-slate-300 cursor-pointer select-none hover:text-emerald-600 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Practical Experiment</span>
                      {filters.sortKey === 'practical_title' ? (
                        filters.sortDirection === 'asc' ? (
                          <ArrowUp className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <ArrowDown className="h-3 w-3 text-emerald-600" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-zinc-400 dark:text-slate-400 opacity-70" />
                      )}
                    </div>
                  </TableHead>
                )}

                {/* 7. Subject Teacher */}
                {visibleCols.teacher && (
                  <TableHead
                    onClick={() => handleSort('teacher_name')}
                    className="w-36 font-bold text-zinc-600 dark:text-slate-300 cursor-pointer select-none hover:text-emerald-600 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Subject Teacher</span>
                      {filters.sortKey === 'teacher_name' ? (
                        filters.sortDirection === 'asc' ? (
                          <ArrowUp className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <ArrowDown className="h-3 w-3 text-emerald-600" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-zinc-400 dark:text-slate-400 opacity-70" />
                      )}
                    </div>
                  </TableHead>
                )}

                {/* 8. Attendance */}
                {visibleCols.attendance && (
                  <TableHead
                    onClick={() => handleSort('attendance')}
                    className="w-28 text-center font-bold text-zinc-600 dark:text-slate-300 cursor-pointer select-none hover:text-emerald-600 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Attendance</span>
                      {filters.sortKey === 'attendance' ? (
                        filters.sortDirection === 'asc' ? (
                          <ArrowUp className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <ArrowDown className="h-3 w-3 text-emerald-600" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-zinc-400 dark:text-slate-400 opacity-70" />
                      )}
                    </div>
                  </TableHead>
                )}

                {/* 9. Status */}
                {visibleCols.status && (
                  <TableHead
                    onClick={() => handleSort('status')}
                    className="w-24 text-center font-bold text-zinc-600 dark:text-slate-300 cursor-pointer select-none hover:text-emerald-600 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Status</span>
                      {filters.sortKey === 'status' ? (
                        filters.sortDirection === 'asc' ? (
                          <ArrowUp className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <ArrowDown className="h-3 w-3 text-emerald-600" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-zinc-400 dark:text-slate-400 opacity-70" />
                      )}
                    </div>
                  </TableHead>
                )}

                {/* 10. Verification Remarks */}
                {visibleCols.remarks && (
                  <TableHead className="w-44 font-bold text-zinc-600 dark:text-slate-300">
                    Verification Remarks
                  </TableHead>
                )}

                {/* 11. Actions */}
                {visibleCols.actions && (
                  <TableHead className="w-20 text-right font-bold text-zinc-600 dark:text-slate-300">
                    Action
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={visibleColCount + 1} className="h-44 text-center">
                    <div className="flex flex-col items-center justify-center text-zinc-500 space-y-2">
                      <div className="h-6 w-6 rounded-full border-2 border-emerald-500/30 border-t-emerald-600 animate-spin" />
                      <p className="text-xs font-mono">Loading practical records...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : totalCount === 0 || sections.length === 0 || sections.every((s) => s.records.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={visibleColCount + 1} className="h-44 text-center">
                    <div className="flex flex-col items-center justify-center text-zinc-500 space-y-1.5">
                      <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                        No practical records found
                      </p>
                      <p className="text-xs text-zinc-400">
                        No practical session records matching the selected criteria.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                sections.map((sec) => {
                  const isCollapsed = !!collapsedGroups[sec.groupKey]

                  return (
                    <React.Fragment key={sec.groupKey}>
                      {/* Section / Group Header */}
                      {sec.groupKey !== 'all' && (
                        <TableRow
                          onClick={() => toggleGroup(sec.groupKey)}
                          className="bg-zinc-100/70 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer border-y border-zinc-200/80 dark:border-zinc-700/60 select-none transition-colors"
                        >
                          <TableCell colSpan={visibleColCount + 1} className="py-2.5 px-4">
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
                              <div className="flex items-center gap-3 text-xs font-mono text-zinc-500 dark:text-slate-300">
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
                          const isSelected = isRowSelected(rec.id)

                          return (
                            <TableRow
                              key={rec.id}
                              onClick={() => handleOpenDetail(rec)}
                              className={`text-xs hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors group ${
                                isSkipped ? 'bg-amber-50/20 dark:bg-amber-950/10' : ''
                              } ${isSelected ? 'bg-emerald-50/50 dark:bg-emerald-950/25' : ''}`}
                            >
                              {/* 0. Row Selection Checkbox */}
                              <TableCell
                                onClick={(e) => e.stopPropagation()}
                                className="w-10 px-3 text-center"
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => toggleRowSelect(rec.id, e as any)}
                                  className="rounded border-zinc-300 dark:border-zinc-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer h-4 w-4"
                                  aria-label={`Select practical record on ${rec.date}`}
                                />
                              </TableCell>

                              {/* 1. Date */}
                              {visibleCols.date && (
                                <TableCell className="font-mono text-xs text-zinc-600 dark:text-slate-300 whitespace-nowrap">
                                  {(rec.date as unknown) instanceof Date
                                    ? ((rec.date as unknown) as Date).toISOString().split('T')[0]
                                    : typeof rec.date === 'string'
                                    ? (rec.date.includes('T') ? rec.date.split('T')[0] : rec.date)
                                    : String(rec.date || '—')}
                                </TableCell>
                              )}

                              {/* 2. Period */}
                              {visibleCols.period && (
                                <TableCell className="font-mono font-medium text-xs text-zinc-800 dark:text-slate-200">
                                  {rec.period_label}
                                </TableCell>
                              )}

                              {/* 3. Facility */}
                              {visibleCols.facility && (
                                <TableCell className="font-medium text-xs text-zinc-900 dark:text-white">
                                  {rec.labs?.name?.split(' ')[0] || rec.lab_id.toUpperCase()} Lab
                                </TableCell>
                              )}

                              {/* 4. Class (Reordered before Subject) */}
                              {visibleCols.class_batch && (
                                <TableCell className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 whitespace-nowrap font-mono">
                                  {rec.batch_group}
                                </TableCell>
                              )}

                              {/* 5. Subject (Clean title + secondary code-chip, expanded width) */}
                              {visibleCols.subject && (
                                <TableCell className="min-w-[240px] w-64">
                                  <div className="admin-type-primary-label text-zinc-950 dark:text-white font-medium text-xs font-heading leading-snug">
                                    {rec.subject_name}
                                  </div>
                                  {rec.subject_code && (
                                    <div className="admin-type-code-chip text-zinc-500 dark:text-slate-300 font-mono text-[10.5px] mt-1 inline-block">
                                      {rec.subject_code}
                                    </div>
                                  )}
                                </TableCell>
                              )}

                              {/* 6. Practical Experiment (Separate column, expanded width) */}
                              {visibleCols.experiment && (
                                <TableCell className="min-w-[240px]">
                                  <div className="text-xs text-zinc-800 dark:text-slate-200 font-medium leading-snug">
                                    {rec.practical_title}
                                  </div>
                                </TableCell>
                              )}

                              {/* 7. Subject Teacher */}
                              {visibleCols.teacher && (
                                <TableCell className="text-xs text-zinc-700 dark:text-slate-200 font-medium">
                                  {rec.profiles?.full_name || 'Assigned Subject Teacher'}
                                </TableCell>
                              )}

                              {/* 8. Attendance */}
                              {visibleCols.attendance && (
                                <TableCell className="text-center font-mono">
                                  {isSkipped ? (
                                    <span className="text-zinc-400 italic text-[11px]">N/A</span>
                                  ) : (
                                    <div>
                                      <span className="font-bold text-zinc-900 dark:text-white">
                                        {rec.present_students}
                                      </span>
                                      <span className="text-zinc-400 dark:text-slate-400">/{rec.total_students}</span>
                                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                                        {attPct.toFixed(0)}%
                                      </div>
                                    </div>
                                  )}
                                </TableCell>
                              )}

                              {/* 9. Status */}
                              {visibleCols.status && (
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
                              )}

                              {/* 10. Verification Remarks */}
                              {visibleCols.remarks && (
                                <TableCell className="text-[11.5px] text-zinc-600 dark:text-slate-300">
                                  {isSkipped ? (
                                    <span className="text-amber-800 dark:text-amber-300 italic">
                                      {rec.skip_reason || 'Class postponed / suspended'}
                                    </span>
                                  ) : (
                                    rec.remarks || 'Standard practical routine executed.'
                                  )}
                                </TableCell>
                              )}

                              {/* 11. Actions */}
                              {visibleCols.actions && (
                                <TableCell className="py-2.5 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleOpenDetail(rec)
                                      }}
                                      className="h-7 w-7 text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
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
                                        className="h-7 w-7 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 cursor-pointer"
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
                              )}
                            </TableRow>
                          )
                        })}

                      {/* Group Subtotal Row if expanded and grouped */}
                      {!isCollapsed && sec.groupKey !== 'all' && (
                        <TableRow className="bg-zinc-50 dark:bg-zinc-950/40 border-b border-zinc-200/80 dark:border-zinc-800 text-xs font-mono font-bold text-zinc-800 dark:text-zinc-200">
                          {visibleCols.attendance ? (
                            <>
                              <TableCell
                                colSpan={Math.max(1, ['date', 'period', 'facility', 'class_batch', 'subject', 'experiment', 'teacher'].filter((k) => visibleCols[k]).length) + 1}
                                className="text-right py-2 text-zinc-500 dark:text-slate-300"
                              >
                                Subtotal [{sec.groupTitle}]: {sec.subtotal.totalSessions} Sessions ({sec.subtotal.conductedSessions} Conducted, {sec.subtotal.skippedSessions} Skipped)
                              </TableCell>
                              <TableCell className="text-center py-2 text-emerald-700 dark:text-emerald-400">
                                {sec.subtotal.totalPresent}/{sec.subtotal.totalEnrolled} ({sec.subtotal.averageAttendancePct.toFixed(1)}%)
                              </TableCell>
                              {Math.max(0, ['status', 'remarks', 'actions'].filter((k) => visibleCols[k]).length) > 0 && (
                                <TableCell
                                  colSpan={['status', 'remarks', 'actions'].filter((k) => visibleCols[k]).length}
                                  className="py-2"
                                />
                              )}
                            </>
                          ) : (
                            <TableCell colSpan={visibleColCount + 1} className="text-right py-2 text-zinc-500 dark:text-slate-300">
                              Subtotal [{sec.groupTitle}]: {sec.subtotal.totalSessions} Sessions ({sec.subtotal.conductedSessions} Conducted, {sec.subtotal.skippedSessions} Skipped) — Attendance: {sec.subtotal.totalPresent}/{sec.subtotal.totalEnrolled} ({sec.subtotal.averageAttendancePct.toFixed(1)}%)
                            </TableCell>
                          )}
                        </TableRow>
                      )}
                    </React.Fragment>
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
              className="h-7 px-2 text-xs font-mono border-zinc-200 dark:border-zinc-800 disabled:opacity-40 cursor-pointer"
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
                  className={`h-7 w-7 p-0 text-xs font-mono font-semibold cursor-pointer ${
                    isCurrent
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600'
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
              className="h-7 px-2 text-xs font-mono border-zinc-200 dark:border-zinc-800 disabled:opacity-40 cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
            </Button>
          </div>
        </div>
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
