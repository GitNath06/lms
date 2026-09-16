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
  const [userRole, setUserRole] = useState<string>('teacher')
  const [userName, setUserName] = useState<string>('')
  const [userScope, setUserScope] = useState<any>(null)
  const [labs, setLabs] = useState<Array<{ id: string; name: string }>>([])
  const [teachers, setTeachers] = useState<Array<{ id: string; full_name: string }>>([])

  // Filters and Grouping State
  const [filters, setFilters] = useState<PracticalRecordFilters>({
    lab_id: 'all',
    batch_group: 'all',
    subject_name: 'all',
    teacher_id: 'all',
    status: 'all',
    search: '',
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
          setUserRole(res.userRole)
          if (res.userName) setUserName(res.userName)
          if (res.userScope) setUserScope(res.userScope)
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
  }, [filters, groupBy])

  const handleResetFilters = () => {
    setFilters({
      lab_id: 'all',
      batch_group: 'all',
      subject_name: 'all',
      teacher_id: 'all',
      status: 'all',
      search: '',
      date_from: '',
      date_to: '',
    })
    setGroupBy('none')
  }

  return (
    <div className="space-y-6 w-full pb-16 font-sans animate-in fade-in duration-200">
      {/* Unified Page Header */}
      <PageHeader
        title="Practical Records & Verification"
        subtitle="Official institutional laboratory logs, multi-dimensional segmentation, subtotals & audit registry"
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
                className="h-9 px-3.5 rounded-xl border-zinc-200 dark:border-zinc-800 text-xs font-mono font-medium hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 gap-2 cursor-pointer"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
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
        userRole={userRole}
        userName={userName}
        userScope={userScope}
        onRecordUpdated={fetchRecords}
        isLoading={isLoading || isPending}
      />
    </div>
  )
}
