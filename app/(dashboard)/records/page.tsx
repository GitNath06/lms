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
import { getCachedData, setCachedData, fetchWithClientCache } from '@/lib/cache/client-query-cache'
import { filtersToSearchParams, searchParamsToFilters } from '@/lib/report-spec/filter-codec'
import PracticalSummaryStrip from '@/components/records/practical-summary-strip'
import PracticalFilterBar from '@/components/records/practical-filter-bar'
import PracticalRecordsTable from '@/components/records/practical-records-table'
import SyllabusProgress from '@/components/dashboard/syllabus-progress'
import { Button } from '@/components/ui/button'
import PageHeader from '@/components/layout/page-header'

export default function PracticalRecordsPage() {
  const [isPending, startTransition] = useTransition()
  const [mounted, setMounted] = useState<boolean>(false)

  // Filters and Grouping State (deterministic SSR defaults to guarantee 0 hydration mismatch)
  const DEFAULT_FILTERS: PracticalRecordFilters = {
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

  const [filters, setFilters] = useState<PracticalRecordFilters>(DEFAULT_FILTERS)
  const [groupBy, setGroupBy] = useState<PracticalGroupingKey>('none')

  // Client-side mount & URL search param hydration
  useEffect(() => {
    setMounted(true)
    if (typeof window !== 'undefined' && window.location.search) {
      const parsed = searchParamsToFilters(new URLSearchParams(window.location.search))
      setFilters((prev) => ({
        ...prev,
        academic_year_id: parsed.academic_year_id || prev.academic_year_id,
        lab_id: parsed.lab_id || prev.lab_id,
        batch_group: parsed.batch_group || prev.batch_group,
        subject_name: parsed.subject_name || prev.subject_name,
        teacher_id: parsed.teacher_id || prev.teacher_id,
        status: parsed.status || prev.status,
        search: parsed.search || prev.search,
        page: parsed.page || prev.page,
        pageSize: parsed.pageSize || prev.pageSize,
        sortKey: parsed.sortKey || prev.sortKey,
        sortDirection: parsed.sortDirection || prev.sortDirection,
        date_from: parsed.date_from || prev.date_from,
        date_to: parsed.date_to || prev.date_to,
        date: parsed.date || prev.date,
        period_label: parsed.period_label || prev.period_label,
        remarks: parsed.remarks || prev.remarks,
        teacher_name: parsed.teacher_name || prev.teacher_name,
      }))
    }
  }, [])

  const initialKey = `records:list:${JSON.stringify(filters)}:${groupBy}`
  const initialCached = getCachedData<any>(initialKey)

  const [isLoading, setIsLoading] = useState<boolean>(() => !initialCached)
  const [sections, setSections] = useState<PracticalGroupedSection[]>(() => initialCached?.sections || [])
  const [metrics, setMetrics] = useState<PracticalSummaryMetrics>(() => initialCached?.metrics || {
    totalSessions: 0,
    conductedSessions: 0,
    skippedSessions: 0,
    totalPresent: 0,
    totalEnrolled: 0,
    averageAttendancePct: 0,
  })
  const [totalCount, setTotalCount] = useState<number>(() => initialCached?.totalCount || 0)
  const [totalPages, setTotalPages] = useState<number>(() => initialCached?.totalPages || 1)
  const [userRole, setUserRole] = useState<string>(() => initialCached?.userRole || 'teacher')
  const [userName, setUserName] = useState<string>(() => initialCached?.userName || '')
  const [userScope, setUserScope] = useState<any>(() => initialCached?.userScope || null)
  const [labs, setLabs] = useState<Array<{ id: string; name: string }>>(() => {
    return getCachedData<Array<{ id: string; name: string }>>('master:active-labs') || []
  })
  const [teachers, setTeachers] = useState<Array<{ id: string; full_name: string }>>(() => {
    return getCachedData<Array<{ id: string; full_name: string }>>('master:active-teachers') || []
  })
  const [academicYears, setAcademicYears] = useState<Array<{ id: string; name: string; isCurrent: boolean }>>(() => initialCached?.academicYears || [])
  const [activeAcademicYearId, setActiveAcademicYearId] = useState<string | null>(() => initialCached?.activeAcademicYearId || null)

  // Initial load of master labs and teachers
  useEffect(() => {
    async function loadMasterData() {
      try {
        const [activeLabs, activeTeachers] = await Promise.all([
          fetchWithClientCache('master:active-labs', () => getActiveLabs(), { staleTimeMs: 300_000 }),
          fetchWithClientCache('master:active-teachers', () => getTeachers(), { staleTimeMs: 300_000 }),
        ])
        if (Array.isArray(activeLabs)) setLabs(activeLabs)
        if (Array.isArray(activeTeachers)) setTeachers(activeTeachers)
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
        const cacheKey = `records:list:${JSON.stringify(filters)}:${groupBy}`
        const res = await fetchWithClientCache(
          cacheKey,
          () => getPracticalRecords(filters, groupBy),
          { staleTimeMs: 60_000 }
        )
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
    const handler = setTimeout(() => {
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
    }, 300)

    return () => clearTimeout(handler)
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
      <PracticalSummaryStrip metrics={metrics} isLoading={!mounted || isLoading || isPending} />

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
        isLoading={!mounted || isLoading || isPending}
      />
    </div>
  )
}
