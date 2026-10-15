'use client'

import React, { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import {
  ClipboardList,
  AlertTriangle,
  Sparkles,
  Printer,
  ShieldCheck,
  RefreshCw,
  Plus,
} from 'lucide-react'
import {
  PracticalGroupedSection,
  PracticalRecordFilters,
  PracticalGroupingKey,
  PracticalSummaryMetrics,
} from '@/types/records'
import { getPracticalRecords } from '@/app/actions/records'
import { getActiveLabs, getTeachers } from '@/app/actions/logs'
import { filtersToSearchParams, searchParamsToFilters } from '@/lib/report-spec/filter-codec'
import PracticalSummaryStrip from '@/components/records/practical-summary-strip'
import PracticalFilterBar from '@/components/records/practical-filter-bar'
import PracticalRecordsTable from '@/components/records/practical-records-table'
import SyllabusProgress from '@/components/dashboard/syllabus-progress'
import { Button } from '@/components/ui/button'
import PageHeader from '@/components/layout/page-header'

export default function PracticalRecordsPage() {
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [sections, setSections] = useState<PracticalGroupedSection[]>([])
  const [metrics, setMetrics] = useState<PracticalSummaryMetrics>({
    totalSessions: 0,
    conductedSessions: 0,
    skippedSessions: 0,
    totalPresent: 0,
    totalEnrolled: 0,
    averageAttendancePct: 0,
  })
  const [totalCount, setTotalCount] = useState<number>(0)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [userRole, setUserRole] = useState<string>('teacher')
  const [userName, setUserName] = useState<string>('')
  const [userScope, setUserScope] = useState<any>(null)
  const [labs, setLabs] = useState<Array<{ id: string; name: string }>>([])
  const [teachers, setTeachers] = useState<Array<{ id: string; full_name: string }>>([])
  const [academicYears, setAcademicYears] = useState<Array<{ id: string; name: string; isCurrent: boolean }>>([])
  const [activeAcademicYearId, setActiveAcademicYearId] = useState<string | null>(null)

  // Filters and Grouping State (initialized with defaults or URL params if in browser)
  const [filters, setFilters] = useState<PracticalRecordFilters>(() => {
    if (typeof window !== 'undefined' && window.location.search) {
      const parsed = searchParamsToFilters(new URLSearchParams(window.location.search))
      return {
        academic_year_id: parsed.academic_year_id || 'all',
        lab_id: parsed.lab_id || 'all',
        batch_group: parsed.batch_group || 'all',
        subject_name: parsed.subject_name || 'all',
        teacher_id: parsed.teacher_id || 'all',
        status: parsed.status || 'all',
        search: parsed.search || '',
        page: parsed.page || 1,
        pageSize: parsed.pageSize || 10,
        sortKey: parsed.sortKey,
        sortDirection: parsed.sortDirection,
        date_from: parsed.date_from || '',
        date_to: parsed.date_to || '',
        date: parsed.date || '',
        period_label: parsed.period_label || '',
        remarks: parsed.remarks || '',
        teacher_name: parsed.teacher_name || '',
      }
    }
    return {
      academic_year_id: 'all',
      lab_id: 'all',
      batch_group: 'all',
      subject_name: 'all',
      teacher_id: 'all',
      status: 'all',
      search: '',
      page: 1,
      pageSize: 10,
    }
  })
  const [groupBy, setGroupBy] = useState<PracticalGroupingKey>('none')

  // Initial load of master labs and teachers
  useEffect(() => {
    async function loadMasterData() {
      try {
        const [activeLabs, activeTeachers] = await Promise.all([
          getActiveLabs(),
          getTeachers(),
        ])
        setLabs(activeLabs)
        setTeachers(activeTeachers)
      } catch (err) {
        console.warn('Failed to load labs/teachers:', err)
      }
    }
    loadMasterData()
  }, [])

  // Fetch records whenever filters or grouping change
  const fetchRecords = () => {
    setIsLoading(true)
    startTransition(async () => {
      try {
        const res = await getPracticalRecords(filters, groupBy)
        if (res.success) {
          setSections(res.sections)
          setMetrics(res.metrics)
          setTotalCount(res.totalCount)
          setTotalPages(res.totalPages || 1)
          setUserRole(res.userRole)
          if (res.userName) setUserName(res.userName)
          if (res.userScope) setUserScope(res.userScope)
          if (res.academicYears) setAcademicYears(res.academicYears)
          if (res.activeAcademicYearId) setActiveAcademicYearId(res.activeAcademicYearId)
        }
      } catch (err) {
        console.error('Error fetching practical records:', err)
      } finally {
        setIsLoading(false)
      }
    })
  }

  useEffect(() => {
    fetchRecords()

    // Sync URL search params with current filters without reloading
    if (typeof window !== 'undefined') {
      const params = filtersToSearchParams({
        ...filters,
        groupBy: groupBy !== 'none' ? groupBy : undefined,
      })
      const newUrl = `${window.location.pathname}?${params.toString()}`
      window.history.replaceState(null, '', newUrl)
    }
  }, [filters, groupBy])

  const handleFiltersChange = (newFilters: Partial<PracticalRecordFilters>) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
    }))
  }

  const handleResetFilters = () => {
    setFilters({
      academic_year_id: 'all',
      lab_id: 'all',
      batch_group: 'all',
      subject_name: 'all',
      teacher_id: 'all',
      status: 'all',
      search: '',
      date_from: '',
      date_to: '',
      date: '',
      period_label: '',
      remarks: '',
      teacher_name: '',
      page: 1,
      pageSize: 10,
    })
    setGroupBy('none')
  }

  return (
    <div className="space-y-6 w-full pb-16 font-sans animate-in fade-in duration-200">
      {/* Unified Page Header */}
      <PageHeader
        title="Practical Records & Verification"
        subtitle="Verified practical experiment logs, attendance, and syllabus tracking"
        icon={ClipboardList}
        iconColor="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200/60 dark:border-emerald-800/60"
        breadcrumbs={[{ label: 'Practical Records' }]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/records/new">
              <Button
                size="sm"
                className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-sans text-xs font-semibold gap-1.5 shadow-xs border border-emerald-500/30 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Record Practical</span>
              </Button>
            </Link>

            <Link href="/records/incidents">
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3.5 rounded-xl border-zinc-200 dark:border-zinc-800 text-xs font-mono font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 gap-2 cursor-pointer"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                <span>Incident Register</span>
              </Button>
            </Link>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchRecords}
              disabled={isPending}
              className="h-9 px-3 rounded-xl border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-600 dark:text-zinc-300 gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
          </div>
        }
      />

      {/* Module C: Analytics Summary Strip */}
      <PracticalSummaryStrip metrics={metrics} isLoading={isLoading || isPending} />

      {/* Curriculum Syllabus Progress & Quota Tracking */}
      <SyllabusProgress />

      {/* Module A1: Filter and Grouping Bar */}
      <PracticalFilterBar
        filters={filters}
        groupBy={groupBy}
        onFiltersChange={setFilters}
        onGroupByChange={setGroupBy}
        onReset={handleResetFilters}
        labs={labs}
        teachers={teachers}
        academicYears={academicYears}
        activeAcademicYearId={activeAcademicYearId}
        userRole={userRole}
        userName={userName}
        userScope={userScope}
      />

      {/* Module A1 & A2: Filterable, Segmentable Table with Grouping, Actions & Exports */}
      <PracticalRecordsTable
        sections={sections}
        filters={filters}
        groupBy={groupBy}
        totalCount={totalCount}
        page={filters.page || 1}
        pageSize={filters.pageSize || 10}
        totalPages={totalPages}
        onFiltersChange={handleFiltersChange}
        userRole={userRole}
        userName={userName}
        userScope={userScope}
        onRecordUpdated={fetchRecords}
        isLoading={isLoading || isPending}
      />
    </div>
  )
}
