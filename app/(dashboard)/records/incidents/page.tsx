'use client'

import React, { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ClipboardList,
  RefreshCw,
  Plus,
  ShieldCheck,
} from 'lucide-react'
import {
  IncidentRecordItem,
  IncidentRecordFilters,
  IncidentSummaryMetrics,
} from '@/types/records'
import { getIncidentRecords } from '@/app/actions/records'
import { getActiveLabs } from '@/app/actions/logs'
import { filtersToSearchParams, searchParamsToFilters } from '@/lib/report-spec/filter-codec'
import IncidentSummaryStrip from '@/components/records/incident-summary-strip'
import IncidentFilterBar from '@/components/records/incident-filter-bar'
import IncidentRecordsTable from '@/components/records/incident-records-table'
import IncidentDetailDrawer from '@/components/records/incident-detail-drawer'
import ReportIncidentModal from '@/components/dashboard/report-incident-modal'
import PageHeader from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'

export default function IncidentRecordsPage() {
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(true)
  const [incidents, setIncidents] = useState<IncidentRecordItem[]>([])
  const [metrics, setMetrics] = useState<IncidentSummaryMetrics>({
    totalIncidents: 0,
    openCount: 0,
    resolvedCount: 0,
    underRepairCount: 0,
    replacedCount: 0,
    escalatedCount: 0,
    minorCount: 0,
    moderateCount: 0,
    criticalCount: 0,
    averageTimeToResolveHours: null,
    averageTimeToResolveLabel: 'N/A',
  })
  const [userRole, setUserRole] = useState<string>('teacher')
  const [userId, setUserId] = useState<string>('')
  const [totalCount, setTotalCount] = useState<number>(0)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [labs, setLabs] = useState<Array<{ id: string; name: string }>>([])
  const [academicYears, setAcademicYears] = useState<Array<{ id: string; name: string; isCurrent: boolean }>>([])
  const [activeAcademicYearId, setActiveAcademicYearId] = useState<string | null>(null)

  // Modal and Drawer States
  const [selectedIncident, setSelectedIncident] = useState<IncidentRecordItem | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)

  // Filters State
  const [filters, setFilters] = useState<IncidentRecordFilters>(() => {
    if (typeof window !== 'undefined' && window.location.search) {
      const parsed = searchParamsToFilters(new URLSearchParams(window.location.search))
      return {
        academic_year_id: (parsed as any).academic_year_id || 'all',
        lab_id: parsed.lab_id || 'all',
        severity: parsed.severity || 'all',
        status: parsed.status || 'all',
        incident_type: (parsed as any).incident_type || 'all',
        date_from: parsed.date_from || '',
        date_to: parsed.date_to || '',
        date: parsed.date || '',
        equipment_name: parsed.equipment_name || '',
        title: parsed.title || '',
        teacher_name: parsed.teacher_name || '',
        search: parsed.search || '',
        page: parsed.page || 1,
        pageSize: parsed.pageSize || 10,
        sortKey: parsed.sortKey,
        sortDirection: parsed.sortDirection,
      }
    }
    return {
      academic_year_id: 'all',
      lab_id: 'all',
      severity: 'all',
      status: 'all',
      incident_type: 'all',
      search: '',
      page: 1,
      pageSize: 10,
    }
  })

  // Format a raw or client incident into an IncidentRecordItem
  const formatIncidentItem = (raw: any): IncidentRecordItem => {
    return {
      id: raw.id,
      lab_id: raw.lab_id,
      schedule_id: raw.schedule_id || null,
      date: raw.date || new Date().toISOString().split('T')[0],
      session_label: raw.session_label || 'Practical Session',
      subject_name: raw.subject_name || 'Laboratory Session',
      subject_teacher_name: raw.subject_teacher_name || raw.reported_by || 'Faculty In-Charge',
      batch_name: raw.batch_name || 'Class Practical',
      title: raw.title,
      circumstances: raw.circumstances || null,
      photo_url: raw.photo_url || null,
      incident_type: raw.incident_type || 'breakage',
      severity: raw.severity || 'minor',
      equipment_name: raw.equipment_name || 'Equipment',
      quantity: raw.quantity || 1,
      student_rolls: raw.student_rolls || null,
      status: raw.status || 'reported',
      escalated_to_hod: Boolean(raw.escalated_to_hod),
      escalation_reason: raw.escalation_reason || null,
      escalated_at: raw.escalated_at || null,
      resolution_notes: raw.resolution_notes || null,
      resolved_by: raw.resolved_by || null,
      resolved_by_id: raw.resolved_by_id || null,
      resolved_at: raw.resolved_at || null,
      reported_by: raw.reported_by || 'Faculty In-Charge',
      reported_by_id: raw.reported_by_id || null,
      is_fined: Boolean(raw.is_fined),
      fine_amount: raw.fine_amount || 0,
      fine_paid: Boolean(raw.fine_paid),
      fine_receipt_no: raw.fine_receipt_no || null,
      created_at: raw.created_at || new Date().toISOString(),
      labs: raw.labs || {
        id: raw.lab_id,
        name:
          raw.lab_id === 'chem'
            ? 'Chemistry Laboratory'
            : raw.lab_id === 'phys'
            ? 'Physics Laboratory'
            : raw.lab_id === 'comp'
            ? 'Computer Engineering Lab 01'
            : `${String(raw.lab_id).toUpperCase()} Lab`,
        type: `${raw.lab_id}_lab`,
      },
      time_to_resolve_label:
        raw.time_to_resolve_label ||
        (raw.status === 'resolved'
          ? 'Resolved'
          : raw.status === 'under_repair'
          ? 'Under Repair'
          : raw.status === 'replaced'
          ? 'Replaced'
          : raw.status === 'escalated_to_hod'
          ? 'Escalated to HOD'
          : 'Active / Open'),
      time_to_resolve_hours: raw.time_to_resolve_hours || null,
    }
  }

  // Merge server data with any optimistic / pending items in localStorage
  const reconcileWithLocalStorage = (serverIncidents: IncidentRecordItem[], serverMetrics?: IncidentSummaryMetrics) => {
    try {
      const savedRaw = localStorage.getItem('lab_incidents_v1')
      const outboxRaw = localStorage.getItem('lab_pending_incidents_outbox_v1')
      const localMap = new Map<string, any>()

      if (savedRaw) {
        const parsed = JSON.parse(savedRaw)
        if (Array.isArray(parsed)) {
          parsed.forEach((item) => {
            if (item && item.id) localMap.set(item.id, item)
          })
        }
      }
      if (outboxRaw) {
        const parsedOutbox = JSON.parse(outboxRaw)
        if (Array.isArray(parsedOutbox)) {
          parsedOutbox.forEach((item) => {
            if (item && item.id) localMap.set(item.id, item)
          })
        }
      }

      if (localMap.size > 0) {
        const serverIds = new Set(serverIncidents.map((i) => i.id))
        const missingLocal: IncidentRecordItem[] = []
        localMap.forEach((item, id) => {
          if (!serverIds.has(id)) {
            missingLocal.push(formatIncidentItem(item))
          }
        })

        if (missingLocal.length > 0) {
          const seen = new Set<string>()
          const merged: IncidentRecordItem[] = []
          for (const item of [...missingLocal, ...serverIncidents]) {
            if (item && item.id && !seen.has(item.id)) {
              seen.add(item.id)
              merged.push(item)
            }
          }
          setIncidents(merged)
          if (serverMetrics) {
            setMetrics({
              ...serverMetrics,
              totalIncidents: serverMetrics.totalIncidents + missingLocal.length,
              openCount: serverMetrics.openCount + missingLocal.filter((i) => i.status !== 'resolved').length,
            })
          }
          return
        }
      }
    } catch {}

    const seen = new Set<string>()
    const dedupedServer: IncidentRecordItem[] = []
    for (const item of serverIncidents) {
      if (item && item.id && !seen.has(item.id)) {
        seen.add(item.id)
        dedupedServer.push(item)
      }
    }
    setIncidents(dedupedServer)
    if (serverMetrics) setMetrics(serverMetrics)
  }

  // Initial load of master labs
  useEffect(() => {
    async function loadMasterData() {
      try {
        const labsData = await getActiveLabs()
        setLabs(labsData)
      } catch (err) {
        console.error('Error fetching master labs:', err)
      }
    }
    loadMasterData()
  }, [])

  const fetchIncidents = (showLoader = true) => {
    startTransition(async () => {
      if (showLoader) setIsLoading(true)
      try {
        const res = await getIncidentRecords(filters)
        if (res.success) {
          reconcileWithLocalStorage(res.incidents, res.metrics)
          setTotalCount(res.totalCount || res.incidents.length)
          setTotalPages(res.totalPages || 1)
          setUserRole(res.userRole)
          if (res.userId) setUserId(res.userId)
          if (res.academicYears) setAcademicYears(res.academicYears)
          if (res.activeAcademicYearId) setActiveAcademicYearId(res.activeAcademicYearId)
        }
      } catch (err) {
        console.error('Error fetching incident records:', err)
      } finally {
        if (showLoader) setIsLoading(false)
      }
    })
  }

  useEffect(() => {
    fetchIncidents(true)

    // Sync URL search params with current filters without reloading
    if (typeof window !== 'undefined') {
      const params = filtersToSearchParams(filters)
      const newUrl = `${window.location.pathname}?${params.toString()}`
      window.history.replaceState(null, '', newUrl)
    }
  }, [filters])

  const handleFiltersChange = (newFilters: Partial<IncidentRecordFilters>) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
    }))
  }

  // Reactive listeners for instant cross-component and cross-tab synchronization
  useEffect(() => {
    const handleIncidentEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{
        action?: string
        incidentId?: string
        incident?: any
        updates?: any
      }>
      const detail = customEvent?.detail

      if (detail?.incident && (detail.action === 'created' || !detail.action)) {
        const formatted = formatIncidentItem(detail.incident)
        setIncidents((prev) => {
          const filtered = prev.filter((i) => i.id !== formatted.id)
          return [formatted, ...filtered]
        })
        setMetrics((m) => ({
          ...m,
          totalIncidents: m.totalIncidents + 1,
          openCount: m.openCount + 1,
          minorCount: detail.incident.severity === 'minor' ? m.minorCount + 1 : m.minorCount,
          moderateCount: detail.incident.severity === 'moderate' ? m.moderateCount + 1 : m.moderateCount,
          criticalCount: detail.incident.severity === 'major_critical' ? m.criticalCount + 1 : m.criticalCount,
        }))
      } else if (detail?.incidentId && detail?.updates) {
        setIncidents((prev) =>
          prev.map((i) => (i.id === detail.incidentId ? { ...i, ...detail.updates } : i))
        )
      }

      // Seamless background reconciliation without flickering the loader
      getIncidentRecords(filters).then((res) => {
        if (res.success) {
          reconcileWithLocalStorage(res.incidents, res.metrics)
        }
      }).catch(() => {})
    }

    window.addEventListener('incidents-updated', handleIncidentEvent)
    window.addEventListener('new-incident-broadcast', handleIncidentEvent)

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'lab_incidents_v1' || e.key === 'lab_pending_incidents_outbox_v1') {
        fetchIncidents(false)
      }
    }
    window.addEventListener('storage', handleStorage)

    return () => {
      window.removeEventListener('incidents-updated', handleIncidentEvent)
      window.removeEventListener('new-incident-broadcast', handleIncidentEvent)
      window.removeEventListener('storage', handleStorage)
    }
  }, [filters])

  const handleResetFilters = () => {
    setFilters({
      academic_year_id: 'all',
      lab_id: 'all',
      severity: 'all',
      status: 'all',
      incident_type: 'all',
      search: '',
      date_from: '',
      date_to: '',
      date: '',
      equipment_name: '',
      title: '',
      teacher_name: '',
      page: 1,
      pageSize: 10,
    })
  }

  const handleSelectIncident = (inc: IncidentRecordItem) => {
    setSelectedIncident(inc)
    setIsDrawerOpen(true)
  }

  return (
    <div className="space-y-6 w-full pb-16 font-sans animate-in fade-in duration-200">
      {/* Page Header */}
      <PageHeader
        title="Laboratory Incident & Damage Register"
        subtitle="Equipment breakages, repair progress, and escalation records"
        icon={AlertTriangle}
        iconColor="text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200/60 dark:border-indigo-800/60"
        breadcrumbs={[
          { label: 'Practical Records', href: '/records' },
          { label: 'Incident Register' },
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/records">
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3.5 rounded-xl border-zinc-200 dark:border-zinc-800 text-xs font-mono font-medium hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 gap-2 cursor-pointer"
              >
                <ClipboardList className="h-3.5 w-3.5" />
                <span>Practical Records</span>
              </Button>
            </Link>

            <Button
              size="sm"
              onClick={() => setIsReportModalOpen(true)}
              className="h-9 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold gap-1.5 shadow-xs transition-transform active:scale-95 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Report Damage</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchIncidents(true)}
              disabled={isPending || isLoading}
              className="h-9 w-9 p-0 rounded-xl border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 cursor-pointer"
              title="Refresh Incident Registry"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        }
      />

      {/* Module C: Analytics Summary Strip */}
      <IncidentSummaryStrip metrics={metrics} isLoading={isLoading || isPending} />

      {/* Module B1: Filter Bar */}
      <IncidentFilterBar
        filters={filters}
        onFiltersChange={setFilters}
        onReset={handleResetFilters}
        labs={labs}
        academicYears={academicYears}
      />

      {/* Module B1 & B3: Table */}
      <IncidentRecordsTable
        incidents={incidents}
        filters={filters}
        onSelectIncident={handleSelectIncident}
        totalCount={totalCount}
        page={filters.page || 1}
        pageSize={filters.pageSize || 10}
        totalPages={totalPages}
        onFiltersChange={handleFiltersChange}
        labs={labs}
        userRole={userRole}
        userName={userId}
        isLoading={isLoading || isPending}
      />

      {/* Module B2: Incident Detail & Action Drawer */}
      <IncidentDetailDrawer
        incident={selectedIncident}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false)
          setSelectedIncident(null)
        }}
        onSuccess={fetchIncidents}
        userRole={userRole}
      />

      {/* Report Incident Modal */}
      <ReportIncidentModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        defaultLabId="phys"
        onSuccess={() => {
          fetchIncidents()
          setIsReportModalOpen(false)
        }}
      />
    </div>
  )
}
