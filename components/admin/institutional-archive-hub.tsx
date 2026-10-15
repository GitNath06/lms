'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Trash2,
  Archive,
  RotateCcw,
  Download,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Users,
  GraduationCap,
  Calendar,
  Building2,
  ShieldAlert,
  ShieldCheck,
  FileText,
  Lock,
  ArrowRight,
  Info,
  X,
  UserCheck,
  FileCheck,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  getArchiveHubTelemetryAction,
  getArchivedStudentsAction,
  getArchivedAcademicYearsAction,
  getArchivedInfrastructureAction,
  restoreStudentAction,
  permanentPurgeTrashAction,
  restoreInfrastructureItemAction,
} from '@/app/actions/archive-hub'
import type {
  ArchivedStudentRecord,
  ArchivedAcademicYearRecord,
  ArchivedInfrastructureRecord,
  ArchiveHubTelemetry,
} from '@/lib/types/archive-hub'

interface InstitutionalArchiveHubProps {
  isEditModeUnlocked: boolean
  triggerToast?: (msg: string) => void
}

type ArchiveHubTab = 'trash' | 'graduated' | 'transferred' | 'infrastructure'

export function InstitutionalArchiveHub({
  isEditModeUnlocked,
  triggerToast,
}: InstitutionalArchiveHubProps) {
  // Navigation
  const [activeTab, setActiveTab] = useState<ArchiveHubTab>('trash')

  // Telemetry
  const [telemetry, setTelemetry] = useState<ArchiveHubTelemetry | null>(null)
  const [isTelemetryLoading, setIsTelemetryLoading] = useState(true)

  // Records state
  const [students, setStudents] = useState<ArchivedStudentRecord[]>([])
  const [academicYears, setAcademicYears] = useState<ArchivedAcademicYearRecord[]>([])
  const [infrastructure, setInfrastructure] = useState<ArchivedInfrastructureRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedYear, setSelectedYear] = useState('all')
  const [selectedClass, setSelectedClass] = useState('all')

  // Action states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  // Purge Confirmation Modal
  const [purgeModalItem, setPurgeModalItem] = useState<ArchivedStudentRecord | null>(null)
  const [isPurging, setIsPurging] = useState(false)
  const [purgeError, setPurgeError] = useState<string | null>(null)

  const showToast = useCallback(
    (msg: string) => {
      if (triggerToast) {
        triggerToast(msg)
      } else {
        alert(msg)
      }
    },
    [triggerToast]
  )

  // Load telemetry stats
  const fetchTelemetry = useCallback(async () => {
    setIsTelemetryLoading(true)
    try {
      const res = await getArchiveHubTelemetryAction()
      if (res.success && res.data) {
        setTelemetry(res.data)
      }
    } catch (err) {
      console.error('Failed to load archive telemetry:', err)
    } finally {
      setIsTelemetryLoading(false)
    }
  }, [])

  // Load active tab data
  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      if (activeTab === 'trash' || activeTab === 'graduated' || activeTab === 'transferred') {
        const res = await getArchivedStudentsAction({
          category: activeTab,
          search: searchQuery,
          academicYearId: selectedYear,
          classId: selectedClass,
        })
        if (res.success && res.data) {
          setStudents(res.data)
        } else {
          setStudents([])
        }
      } else if (activeTab === 'infrastructure') {
        const [yearsRes, infraRes] = await Promise.all([
          getArchivedAcademicYearsAction(),
          getArchivedInfrastructureAction(),
        ])
        if (yearsRes.success && yearsRes.data) setAcademicYears(yearsRes.data)
        if (infraRes.success && infraRes.data) setInfrastructure(infraRes.data)
      }
    } catch (err) {
      console.error('Failed to load archive data:', err)
    } finally {
      setIsLoading(false)
    }
  }, [activeTab, searchQuery, selectedYear, selectedClass])

  useEffect(() => {
    fetchTelemetry()
  }, [fetchTelemetry])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Handle Restore Student
  const handleRestoreStudent = async (student: ArchivedStudentRecord) => {
    if (!isEditModeUnlocked) {
      showToast('🔒 Precaution Active: Unlock "Admin Edit Mode" at the top before restoring items.')
      return
    }

    setActionLoadingId(student.studentId)
    try {
      const res = await restoreStudentAction({
        studentId: student.studentId,
        enrollmentId: student.enrollmentId || undefined,
      })

      if (res.success) {
        const rollNotice = res.newRollNumber ? ` (Assigned Roll ${res.newRollNumber})` : ''
        showToast(`✅ ${res.restoredStudentName || student.fullName} successfully restored to active roster${rollNotice}.`)
        await Promise.all([fetchTelemetry(), fetchData()])
      } else {
        showToast(res.error || 'Failed to restore student.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown restore error'
      showToast(msg)
    } finally {
      setActionLoadingId(null)
    }
  }

  // Handle Confirm Permanent Purge
  const handleConfirmPurge = async () => {
    if (!purgeModalItem) return

    if (!isEditModeUnlocked) {
      setPurgeError('🔒 Precaution Active: Unlock "Admin Edit Mode" at the top before purging.')
      return
    }

    setIsPurging(true)
    setPurgeError(null)

    try {
      const res = await permanentPurgeTrashAction({
        studentId: purgeModalItem.studentId,
        enrollmentId: purgeModalItem.enrollmentId || undefined,
      })

      if (res.success) {
        showToast(`🗑️ ${purgeModalItem.fullName} was permanently purged from the system.`)
        setPurgeModalItem(null)
        await Promise.all([fetchTelemetry(), fetchData()])
      } else {
        setPurgeError(res.error || 'Failed to purge record.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown purge error'
      setPurgeError(msg)
    } finally {
      setIsPurging(false)
    }
  }

  // Handle Reactivate Infrastructure
  const handleReactivateInfrastructure = async (type: 'lab' | 'incident_category', id: string) => {
    if (!isEditModeUnlocked) {
      showToast('🔒 Precaution Active: Unlock "Admin Edit Mode" at the top before reactivating items.')
      return
    }

    setActionLoadingId(id)
    try {
      const res = await restoreInfrastructureItemAction({ itemType: type, itemId: id })
      if (res.success) {
        showToast(`✅ ${type === 'lab' ? 'Laboratory facility' : 'Incident category'} reactivated.`)
        await Promise.all([fetchTelemetry(), fetchData()])
      } else {
        showToast(res.error || 'Failed to reactivate.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      showToast(msg)
    } finally {
      setActionLoadingId(null)
    }
  }

  // Client-Side CSV Export with UTF-8 BOM
  const handleExportCSV = () => {
    if (students.length === 0) {
      showToast('No records available to export.')
      return
    }

    const headers = [
      'Student Name',
      'Admission No',
      'Registration No',
      'Gender',
      'Class',
      'Academic Year',
      'Roll Number',
      'Section',
      'Status',
      'Archived Date',
      'Archive Reason',
      'Practical Attendance Count',
    ]

    const rows = students.map((s) => [
      `"${s.fullName.replace(/"/g, '""')}"`,
      `"${s.admissionNo || ''}"`,
      `"${s.registrationNo || ''}"`,
      `"${s.gender || ''}"`,
      `"${s.className || s.classId || ''}"`,
      `"${s.academicYearName || s.academicYearId || ''}"`,
      s.rollNumber !== null ? s.rollNumber : '',
      `"${s.section || ''}"`,
      `"${s.enrollmentStatus}"`,
      `"${s.archivedAt ? s.archivedAt.split('T')[0] : ''}"`,
      `"${(s.archiveReason || '').replace(/"/g, '""')}"`,
      s.attendanceCount,
    ])

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `LMR_Archive_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showToast(`📄 Exported ${students.length} records to CSV.`)
  }

  // Unique Classes and Years for Filter
  const availableYears = useMemo(() => {
    const set = new Set<string>()
    students.forEach((s) => {
      if (s.academicYearId) set.add(s.academicYearId)
    })
    return Array.from(set).sort()
  }, [students])

  const availableClasses = useMemo(() => {
    const set = new Set<string>()
    students.forEach((s) => {
      if (s.classId) set.add(s.classId)
    })
    return Array.from(set).sort()
  }, [students])

  return (
    <div className="space-y-6">
      {/* Top 4 KPI Metrics Header Row: Direct Grid, No Double Nesting */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Metric 1: Recycle Bin (Trash) */}
        <div
          onClick={() => setActiveTab('trash')}
          className={`glass-card p-3 rounded-2xl flex items-center justify-between cursor-pointer transition-all ${
            activeTab === 'trash' ? 'ring-2 ring-rose-500/50 bg-rose-500/[0.04]' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold shrink-0">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Recycle Bin</div>
              <div className="text-base font-extrabold font-heading text-zinc-900 dark:text-white tabular-nums">
                {telemetry ? `${telemetry.trashCount} Items` : '—'}
              </div>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] text-rose-600 border-rose-500/20">
            Soft-Deleted
          </Badge>
        </div>

        {/* Metric 2: Graduated Alumni */}
        <div
          onClick={() => setActiveTab('graduated')}
          className={`glass-card p-3 rounded-2xl flex items-center justify-between cursor-pointer transition-all ${
            activeTab === 'graduated' ? 'ring-2 ring-emerald-500/50 bg-emerald-500/[0.04]' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shrink-0">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Graduated Alumni</div>
              <div className="text-base font-extrabold font-heading text-zinc-900 dark:text-white tabular-nums">
                {telemetry ? `${telemetry.graduatedCount} Students` : '—'}
              </div>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/20">
            Permanent
          </Badge>
        </div>

        {/* Metric 3: Transferred Students */}
        <div
          onClick={() => setActiveTab('transferred')}
          className={`glass-card p-3 rounded-2xl flex items-center justify-between cursor-pointer transition-all ${
            activeTab === 'transferred' ? 'ring-2 ring-amber-500/50 bg-amber-500/[0.04]' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Transferred Out</div>
              <div className="text-base font-extrabold font-heading text-zinc-900 dark:text-white tabular-nums">
                {telemetry ? `${telemetry.transferredCount} Students` : '—'}
              </div>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/20">
            Relocated
          </Badge>
        </div>

        {/* Metric 4: System Archives */}
        <div
          onClick={() => setActiveTab('infrastructure')}
          className={`glass-card p-3 rounded-2xl flex items-center justify-between cursor-pointer transition-all ${
            activeTab === 'infrastructure' ? 'ring-2 ring-indigo-500/50 bg-indigo-500/[0.04]' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shrink-0">
              <Archive className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">System Archives</div>
              <div className="text-base font-extrabold font-heading text-zinc-900 dark:text-white tabular-nums">
                {telemetry ? `${telemetry.archivedYearsCount + telemetry.inactiveLabsCount} Items` : '—'}
              </div>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] text-indigo-600 border-indigo-500/20">
            Cycles & Labs
          </Badge>
        </div>
      </div>

      {/* Main Archive Hub Card */}
      <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs overflow-hidden">
        <CardHeader className="p-4 px-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-zinc-900 dark:text-white">
              <Archive className="h-4 w-4 text-indigo-500" />
              <span>Institutional Recycle Bin & Archive Hub</span>
            </CardTitle>
            <CardDescription className="text-xs text-zinc-500 dark:text-slate-400 mt-0.5">
              Disambiguates soft-deleted trash items (restorable) from permanent academic archives (graduated cohorts & past cycles).
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportCSV}
              disabled={isLoading || (activeTab === 'infrastructure' ? true : students.length === 0)}
              className="text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </Button>

            <button
              type="button"
              onClick={() => {
                fetchTelemetry()
                fetchData()
              }}
              disabled={isLoading}
              className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-500 hover:text-zinc-900 dark:hover:text-white transition disabled:opacity-50 cursor-pointer"
              title="Refresh Archives"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-indigo-500' : ''}`} />
            </button>
          </div>
        </CardHeader>

        {/* Tab Switcher */}
        <div className="p-2.5 px-5 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/40 dark:bg-zinc-900/20 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/80">
            <button
              type="button"
              onClick={() => setActiveTab('trash')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'trash'
                  ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-2xs'
                  : 'text-zinc-600 dark:text-slate-400 hover:text-zinc-900'
              }`}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Recycle Bin (Trash)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('graduated')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'graduated'
                  ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                  : 'text-zinc-600 dark:text-slate-400 hover:text-zinc-900'
              }`}
            >
              <GraduationCap className="h-3.5 w-3.5" />
              <span>Graduated Alumni</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('transferred')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'transferred'
                  ? 'bg-white dark:bg-zinc-900 text-amber-600 dark:text-amber-400 shadow-2xs'
                  : 'text-zinc-600 dark:text-slate-400 hover:text-zinc-900'
              }`}
            >
              <UserCheck className="h-3.5 w-3.5" />
              <span>Transferred Students</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('infrastructure')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'infrastructure'
                  ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                  : 'text-zinc-600 dark:text-slate-400 hover:text-zinc-900'
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>System & Cycles</span>
            </button>
          </div>

          {/* Search & Filters (for student tabs) */}
          {activeTab !== 'infrastructure' && (
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by student name or admission no..."
                  className="h-8.5 pl-8 text-xs rounded-xl border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                />
              </div>

              {availableYears.length > 0 && (
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="h-8.5 px-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-mono text-zinc-700 dark:text-zinc-300"
                >
                  <option value="all">All Years</option>
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      वि.सं. {yr}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        {/* Tab Content */}
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-zinc-500 text-xs">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
              <span>Scanning archive records across PostgreSQL...</span>
            </div>
          ) : activeTab === 'trash' ? (
            /* --- TAB 1: RECYCLE BIN (TRASH) --- */
            students.length === 0 ? (
              <div className="py-16 text-center text-xs text-zinc-500 space-y-1">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto opacity-70" />
                <div className="font-bold text-zinc-700 dark:text-zinc-300">Recycle Bin is Empty</div>
                <p className="text-slate-400 max-w-sm mx-auto">
                  No soft-deleted students or archived enrollments found. Active rosters are operating cleanly.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                <div className="p-3 px-5 bg-rose-500/[0.03] dark:bg-rose-500/[0.05] border-b border-rose-500/10 flex items-center justify-between text-xs text-rose-700 dark:text-rose-300">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 shrink-0 text-rose-500" />
                    <span>
                      Items in the Recycle Bin can be restored back to their class rosters. Permanent purge is only permitted for records with 0 attendance logs.
                    </span>
                  </div>
                  <span className="font-bold tabular-nums shrink-0">{students.length} record(s)</span>
                </div>

                {students.map((student) => {
                  const isActionLoading = actionLoadingId === student.studentId
                  return (
                    <div
                      key={student.studentId}
                      className="p-4 px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                    >
                      {/* Left: Identity & Details */}
                      <div className="flex items-start gap-3.5">
                        <div className="h-10 w-10 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold shrink-0 font-heading">
                          {student.fullName.charAt(0)}
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-extrabold font-heading text-zinc-900 dark:text-white">
                              {student.fullName}
                            </h4>
                            {student.admissionNo && (
                              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-slate-500">
                                {student.admissionNo}
                              </span>
                            )}
                            <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 text-[10px] font-bold">
                              In Recycle Bin
                            </Badge>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                            <span>
                              Class: <strong className="text-zinc-700 dark:text-slate-200">{student.className || student.classId || 'Unassigned'}</strong>
                            </span>
                            <span>&bull;</span>
                            <span>
                              Cycle: <strong className="text-zinc-700 dark:text-slate-200">{student.academicYearName || student.academicYearId || '—'}</strong>
                            </span>
                            {student.rollNumber !== null && (
                              <>
                                <span>&bull;</span>
                                <span>
                                  Roll: <strong className="font-mono text-zinc-700 dark:text-slate-200">{student.rollNumber}</strong>
                                </span>
                              </>
                            )}
                            <span>&bull;</span>
                            <span>
                              Reason: <span className="italic text-zinc-600 dark:text-slate-300">{student.archiveReason || 'Soft-deleted'}</span>
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-400">
                            {student.archivedAt && (
                              <span>Archived: {new Date(student.archivedAt).toLocaleDateString()}</span>
                            )}
                            <span>&bull;</span>
                            <span>
                              Practical History: <strong className="tabular-nums text-zinc-600 dark:text-slate-300">{student.attendanceCount} logs recorded</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRestoreStudent(student)}
                          disabled={isActionLoading || !isEditModeUnlocked}
                          className="text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition disabled:opacity-50"
                          title={!isEditModeUnlocked ? 'Unlock Precaution Active to restore' : 'Restore student to active roster'}
                        >
                          {isActionLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5 text-emerald-500" />
                          )}
                          <span>Restore to Active</span>
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (!isEditModeUnlocked) {
                              showToast('🔒 Precaution Active: Unlock "Admin Edit Mode" at the top before purging.')
                              return
                            }
                            setPurgeModalItem(student)
                            setPurgeError(null)
                          }}
                          disabled={!isEditModeUnlocked}
                          className="text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/30 hover:bg-rose-500/10 hover:border-rose-500/30 transition disabled:opacity-50"
                          title={
                            !student.canPermanentPurge
                              ? 'Permanent purge blocked: student has operational attendance logs'
                              : 'Permanently purge zero-history student record'
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Purge</span>
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          ) : activeTab === 'graduated' || activeTab === 'transferred' ? (
            /* --- TAB 2: ACADEMIC ARCHIVES (GRADUATED & TRANSFERRED) --- */
            students.length === 0 ? (
              <div className="py-16 text-center text-xs text-zinc-500 space-y-1">
                <GraduationCap className="h-8 w-8 text-indigo-500 mx-auto opacity-70" />
                <div className="font-bold text-zinc-700 dark:text-zinc-300">
                  No {activeTab === 'graduated' ? 'Graduated Alumni' : 'Transferred Students'} Found
                </div>
                <p className="text-slate-400 max-w-sm mx-auto">
                  When students complete graduation or transfer out through the Cohort Promotion Wizard, their permanent records appear here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                <div className="p-3 px-5 bg-indigo-500/[0.03] dark:bg-indigo-500/[0.05] border-b border-indigo-500/10 flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-300">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 shrink-0 text-indigo-500" />
                    <span>
                      Permanent Academic Archive: These records preserve historical practical log attendance for institutional compliance and board verification.
                    </span>
                  </div>
                  <span className="font-bold tabular-nums shrink-0">{students.length} student(s)</span>
                </div>

                {students.map((student) => (
                  <div
                    key={`${student.studentId}-${student.enrollmentId}`}
                    className="p-4 px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shrink-0 font-heading">
                        {student.fullName.charAt(0)}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-extrabold font-heading text-zinc-900 dark:text-white">
                            {student.fullName}
                          </h4>
                          {student.admissionNo && (
                            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-slate-500">
                              {student.admissionNo}
                            </span>
                          )}
                          <Badge
                            className={`text-[10px] font-bold ${
                              activeTab === 'graduated'
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                            }`}
                          >
                            {activeTab === 'graduated' ? 'Graduated' : 'Transferred Out'}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                          <span>
                            Class: <strong className="text-zinc-700 dark:text-slate-200">{student.className || student.classId}</strong>
                          </span>
                          <span>&bull;</span>
                          <span>
                            Cycle: <strong className="text-zinc-700 dark:text-slate-200">{student.academicYearName || student.academicYearId}</strong>
                          </span>
                          {student.rollNumber !== null && (
                            <>
                              <span>&bull;</span>
                              <span>
                                Final Roll: <strong className="font-mono text-zinc-700 dark:text-slate-200">{student.rollNumber}</strong>
                              </span>
                            </>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-400">
                          Total Practicals Attended:{' '}
                          <strong className="tabular-nums text-zinc-700 dark:text-slate-200">{student.attendanceCount} sessions</strong>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <div className="flex items-center gap-1 text-xs text-slate-400 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 font-mono">
                        <FileCheck className="h-3.5 w-3.5 text-indigo-500" />
                        <span>Audit Sealed</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* --- TAB 3: SYSTEM & INFRASTRUCTURE ARCHIVES --- */
            <div className="p-5 space-y-6">
              {/* Past Academic Years Sub-Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-indigo-500" />
                    <span>Past Academic Operational Cycles</span>
                  </h4>
                  <span className="text-xs text-slate-400 tabular-nums">{academicYears.length} cycle(s)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {academicYears.length === 0 ? (
                    <div className="col-span-2 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-500">
                      No archived academic cycles found.
                    </div>
                  ) : (
                    academicYears.map((yr) => (
                      <div key={yr.id} className="glass-card p-3.5 rounded-2xl flex items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-extrabold font-heading text-zinc-900 dark:text-white">
                              {yr.name}
                            </span>
                            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-slate-500">
                              {yr.id}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400">
                            {yr.startDate} to {yr.endDate}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-xs font-extrabold font-heading text-zinc-900 dark:text-white tabular-nums">
                            {yr.totalLogs} Logs
                          </div>
                          <div className="text-[11px] text-slate-400 tabular-nums">
                            {yr.totalEnrollments} Students
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Inactive Labs & Categories Sub-Section */}
              <div className="space-y-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-amber-500" />
                    <span>Inactive Laboratories & Retired Categories</span>
                  </h4>
                  <span className="text-xs text-slate-400 tabular-nums">{infrastructure.length} item(s)</span>
                </div>

                <div className="divide-y divide-zinc-100 dark:divide-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                  {infrastructure.length === 0 ? (
                    <div className="p-6 text-center text-xs text-zinc-500">
                      Zero inactive laboratories or archived categories. All infrastructure active.
                    </div>
                  ) : (
                    infrastructure.map((item) => {
                      const isActionLoading = actionLoadingId === item.id
                      return (
                        <div key={item.id} className="p-3.5 px-4 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                              {item.type === 'lab' ? <Building2 className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                                <span>{item.name}</span>
                                <Badge variant="outline" className="text-[10px]">
                                  {item.type === 'lab' ? 'Laboratory' : 'Incident Category'}
                                </Badge>
                              </div>
                              <div className="text-[10px] text-slate-400">
                                Status: {item.status} {item.codeOrSeverity && `• ${item.codeOrSeverity}`}
                              </div>
                            </div>
                          </div>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReactivateInfrastructure(item.type, item.id)}
                            disabled={isActionLoading || !isEditModeUnlocked}
                            className="text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5"
                          >
                            {isActionLoading ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <RotateCcw className="h-3 w-3 text-indigo-500" />
                            )}
                            <span>Reactivate</span>
                          </Button>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: Permanent Purge Confirmation Dialog */}
      {purgeModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#101726] border border-zinc-200 dark:border-white/[0.08] rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-4 px-5 border-b border-zinc-100 dark:border-white/[0.08] flex items-center justify-between bg-zinc-50/60 dark:bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
                  <Trash2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Permanent Purge Confirmation</h3>
                  <p className="text-[11px] text-slate-400">Irreversible removal of zero-history trash item</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPurgeModalItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {purgeError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{purgeError}</span>
                </div>
              )}

              {/* Safety Assessment */}
              {!purgeModalItem.canPermanentPurge ? (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-start gap-3">
                  <ShieldAlert className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-rose-700 dark:text-rose-400">
                      Permanent Purge Blocked (NEB Audit Lock)
                    </h4>
                    <p className="text-[11px] text-rose-600/90 dark:text-rose-300 leading-relaxed">
                      Student <strong className="text-zinc-900 dark:text-white">{purgeModalItem.fullName}</strong> has{' '}
                      <strong>{purgeModalItem.attendanceCount} recorded practical attendance logs</strong>. Under NEB audit regulations, operational log history cannot be erased. The student must remain preserved in the archive.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-amber-700 dark:text-amber-400">
                      Zero Operational History Detected
                    </h4>
                    <p className="text-[11px] text-amber-600/90 dark:text-amber-300 leading-relaxed">
                      This student has 0 recorded attendance logs across all classes and years. It is safe to permanently remove without corrupting logbooks.
                    </p>
                  </div>
                </div>
              )}

              <div className="glass-card p-3 rounded-xl space-y-1 text-xs">
                <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Target Student</div>
                <div className="font-extrabold font-heading text-zinc-900 dark:text-white text-sm">
                  {purgeModalItem.fullName}
                </div>
                {purgeModalItem.admissionNo && (
                  <div className="text-slate-500 font-mono text-[11px]">Admission No: {purgeModalItem.admissionNo}</div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-white/[0.06]">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPurgeModalItem(null)}
                  className="text-xs rounded-xl"
                >
                  {!purgeModalItem.canPermanentPurge ? 'Understood — Keep in Archive' : 'Cancel'}
                </Button>

                {purgeModalItem.canPermanentPurge && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={isPurging}
                    onClick={handleConfirmPurge}
                    className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    {isPurging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    <span>Permanently Purge Record</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
