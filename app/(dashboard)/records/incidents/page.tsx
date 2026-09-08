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
  const [labs, setLabs] = useState<Array<{ id: string; name: string }>>([])

  // Modal and Drawer States
  const [selectedIncident, setSelectedIncident] = useState<IncidentRecordItem | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)

  // Filters State
  const [filters, setFilters] = useState<IncidentRecordFilters>({
    lab_id: 'all',
    severity: 'all',
    status: 'all',
    incident_type: 'all',
    search: '',
  })

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

  const fetchIncidents = () => {
    startTransition(async () => {
      setIsLoading(true)
      try {
        const res = await getIncidentRecords(filters)
        if (res.success) {
          setIncidents(res.incidents)
          setMetrics(res.metrics)
          setUserRole(res.userRole)
          if (res.userId) setUserId(res.userId)
        }
      } catch (err) {
        console.error('Error fetching incident records:', err)
      } finally {
        setIsLoading(false)
      }
    })
  }

  useEffect(() => {
    fetchIncidents()
  }, [filters])

  const handleResetFilters = () => {
    setFilters({
      lab_id: 'all',
      severity: 'all',
      status: 'all',
      incident_type: 'all',
      search: '',
      date_from: '',
      date_to: '',
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
        subtitle="Official apparatus breakage records, HOD escalation audit & technical repair tracking"
        icon={AlertTriangle}
        iconColor="bg-rose-500 text-white shadow-md shadow-rose-500/20"
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
              className="h-9 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium gap-1.5 shadow-xs transition-transform active:scale-95 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Report Damage</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchIncidents}
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
      />

      {/* Module B1 & B3: Table */}
      <IncidentRecordsTable
        incidents={incidents}
        filters={filters}
        onSelectIncident={handleSelectIncident}
        totalCount={incidents.length}
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
