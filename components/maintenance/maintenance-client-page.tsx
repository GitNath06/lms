'use client'

import React, { useState, useTransition, useMemo } from 'react'
import {
  Wrench,
  ShieldCheck,
  Plus,
  RefreshCw,
  Bell,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
  Printer,
  ShieldAlert,
  Monitor,
  FileCheck2,
  Search,
  CheckSquare2,
  Square,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Calendar,
  UserCheck,
  Package,
  FileText,
  AlertCircle,
  Check,
  PauseCircle,
  Users,
  LayoutGrid,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import PageHeader from '@/components/layout/page-header'
import MaintenanceDetailDrawer from './maintenance-detail-drawer'
import LogMaintenanceModal from './log-maintenance-modal'
import SnoozeModal from './snooze-modal'
import CreatePlanModal from './create-plan-modal'
import FleetRoutineModal from './fleet-routine-modal'
import { DiagnosticsTriageHub } from './diagnostics-triage-hub'
import type { WorkstationBoardData, DiagnosticsTriageData } from '@/types/workstations'
import {
  MaintenanceOverviewData,
  MaintenanceReminderRecord,
  MaintenanceLogRecord,
  MaintenancePlanRecord,
  getMaintenanceOverview,
} from '@/app/actions/maintenance'

interface MaintenanceClientPageProps {
  initialData: MaintenanceOverviewData
  initialWorkstationData?: WorkstationBoardData
  initialTriageData?: DiagnosticsTriageData
  initialSearch?: string
  initialTab?: 'diagnostics' | 'tasks' | 'history'
}

export default function MaintenanceClientPage({
  initialData,
  initialWorkstationData,
  initialTriageData,
  initialSearch = '',
  initialTab = 'diagnostics',
}: MaintenanceClientPageProps) {
  const [data, setData] = useState<MaintenanceOverviewData>(initialData)
  const [selectedLab, setSelectedLab] = useState<string>('comp')
  const [activeTab, setActiveTab] = useState<'diagnostics' | 'tasks' | 'history'>(initialTab)
  const [searchQuery, setSearchQuery] = useState<string>(initialSearch)
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Modal States
  const [isLogModalOpen, setIsLogModalOpen] = useState(false)
  const [selectedReminderForLog, setSelectedReminderForLog] =
    useState<MaintenanceReminderRecord | null>(null)
  const [selectedPlanForLog, setSelectedPlanForLog] =
    useState<MaintenancePlanRecord | null>(null)

  const [isSnoozeModalOpen, setIsSnoozeModalOpen] = useState(false)
  const [selectedReminderForSnooze, setSelectedReminderForSnooze] =
    useState<MaintenanceReminderRecord | null>(null)

  const [isCreatePlanOpen, setIsCreatePlanOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<MaintenancePlanRecord | null>(null)

  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false)
  const [selectedLogForDetail, setSelectedLogForDetail] =
    useState<MaintenanceLogRecord | null>(null)

  const [isFleetModalOpen, setIsFleetModalOpen] = useState(false)
  const [selectedPlanForFleet, setSelectedPlanForFleet] =
    useState<MaintenancePlanRecord | null>(null)

  const handleOpenFleetModal = (plan: MaintenancePlanRecord) => {
    setSelectedPlanForFleet(plan)
    setIsFleetModalOpen(true)
  }

  // Refresh data from server
  const handleRefresh = () => {
    startTransition(async () => {
      try {
        const fresh = await getMaintenanceOverview(selectedLab)
        setData(fresh)
      } catch (err) {
        console.error('Failed to refresh maintenance data:', err)
      }
    })
  }

  // Open Log Modal for a specific plan or reminder
  const handleOpenLogForPlan = (plan: MaintenancePlanRecord) => {
    setSelectedPlanForLog(plan)
    // Find active reminder linked to this plan if any
    const linkedReminder = data.reminders.find((r) => r.plan_id === plan.id)
    setSelectedReminderForLog(linkedReminder || null)
    setIsLogModalOpen(true)
  }

  // Open Log Modal directly (top button)
  const handleOpenGeneralLogModal = () => {
    setSelectedPlanForLog(null)
    setSelectedReminderForLog(null)
    setIsLogModalOpen(true)
  }

  // Open Snooze Modal for a specific reminder
  const handleOpenSnooze = (plan: MaintenancePlanRecord) => {
    const linkedReminder = data.reminders.find((r) => r.plan_id === plan.id)
    if (linkedReminder) {
      setSelectedReminderForSnooze(linkedReminder)
      setIsSnoozeModalOpen(true)
    }
  }

  // Open Detail Drawer
  const handleOpenDetail = (log: MaintenanceLogRecord) => {
    setSelectedLogForDetail(log)
    setIsDetailDrawerOpen(true)
  }

  // Filtered Plans for Tab 1
  const filteredPlans = useMemo(() => {
    return data.plans.filter((p) => {
      if (selectedLab !== 'all' && p.lab_id !== selectedLab) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchTitle = p.title.toLowerCase().includes(q)
        const matchCat = (p.category || '').toLowerCase().includes(q)
        const matchLab = (p.lab_id || '').toLowerCase().includes(q)
        const matchChecklist = p.checklist?.some((c) => c.toLowerCase().includes(q))
        if (!matchTitle && !matchCat && !matchLab && !matchChecklist) return false
      }
      return true
    })
  }, [data.plans, selectedLab, searchQuery])

  // Filtered History Logs for Tab 2
  const filteredLogs = useMemo(() => {
    return data.logs.filter((l) => {
      if (selectedLab !== 'all' && l.lab_id !== selectedLab) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchAsset = (l.asset_identifier || '').toLowerCase().includes(q)
        const matchWork = (l.work_performed || '').toLowerCase().includes(q)
        const matchTech = (l.performed_by_name || '').toLowerCase().includes(q)
        const matchPlan = (l.plan_title || '').toLowerCase().includes(q)
        if (!matchAsset && !matchWork && !matchTech && !matchPlan) return false
      }
      return true
    })
  }, [data.logs, selectedLab, searchQuery])

  // Summary counts
  const overdueCount = useMemo(() => {
    return data.reminders.filter((r) => r.is_overdue).length
  }, [data.reminders])

  const pendingCount = useMemo(() => {
    return data.reminders.length
  }, [data.reminders])

  return (
    <div className="space-y-4 w-full pb-16 font-sans">
      {/* 1. COMPACT PURPOSE-BUILT HEADER */}
      <PageHeader
        title="Lab Diagnostics & Maintenance Workbench"
        subtitle="Institutional hardware diagnostics, workstation floor triage, routine service plans, and certified compliance logbook"
        icon={Wrench}
        breadcrumbs={[{ label: 'Lab Diagnostics & Maintenance' }]}
        badge={
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
            Workbench
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/computer-lab">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 px-3 text-xs gap-1.5 rounded-xl border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 cursor-pointer"
              >
                <Monitor className="h-3.5 w-3.5" />
                <span>Floor Map &amp; Live Cockpit</span>
              </Button>
            </Link>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isPending}
              className="h-9 px-3 text-xs gap-1.5 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>

            <Link href="/print/maintenance">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 px-3 text-xs gap-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5 text-zinc-500" />
                <span>Print Report</span>
              </Button>
            </Link>

            <Button
              type="button"
              size="sm"
              onClick={handleOpenGeneralLogModal}
              className="h-9 px-3.5 text-xs font-bold rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 hover:opacity-90 shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Wrench className="h-3.5 w-3.5" />
              <span>Record Service</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => {
                setEditingPlan(null)
                setIsCreatePlanOpen(true)
              }}
              className="h-9 px-3.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Routine</span>
            </Button>
          </div>
        }
      />



      {/* 3. MAIN WORKSPACE WITH 2 CLEAR TABS */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.06),0_1px_2px_-1px_rgba(0,0,0,0.06)] overflow-hidden">
        {/* Tab Selector & Search Toolbar */}
        <div className="p-3 sm:p-4 border-b border-zinc-200/60 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 w-fit flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('diagnostics')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'diagnostics'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              <span>Diagnostics &amp; Triage</span>
              {initialTriageData && (
                <span className="font-mono text-[11px] px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-500 font-bold">
                  {initialTriageData.metrics.open_count + initialTriageData.metrics.in_progress_count}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('tasks')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'tasks'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Wrench className="h-3.5 w-3.5 text-indigo-500" />
              <span>Routine Tasks</span>
              <span className="font-mono text-[11px] px-1.5 py-0.2 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                {filteredPlans.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'history'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <FileCheck2 className="h-3.5 w-3.5 text-emerald-500" />
              <span>Maintenance History</span>
              <span className="font-mono text-[11px] px-1.5 py-0.2 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                {filteredLogs.length}
              </span>
            </button>
          </div>

          {/* Quick Search for Tasks & History */}
          {activeTab !== 'diagnostics' && (
            <div className="relative w-full sm:w-72">
              <Search className="h-3.5 w-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === 'tasks'
                    ? 'Search routines...'
                    : 'Search service logs...'
                }
                className="h-8.5 pl-8.5 text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
              />
            </div>
          )}
        </div>

        {/* TAB 1: ACTIVE DIAGNOSTICS & RESOLUTION HUB */}
        {activeTab === 'diagnostics' && (
          <div className="p-4 sm:p-5">
            {initialTriageData ? (
              <DiagnosticsTriageHub
                initialData={initialTriageData}
                initialSearchQuery={initialSearch}
                onRefresh={handleRefresh}
              />
            ) : (
              <div className="py-12 text-center text-xs text-zinc-400">
                Loading diagnostics telemetry...
              </div>
            )}
          </div>
        )}

        {/* TAB 1: UNIFIED TASKS & SCHEDULE TABLE */}
        {activeTab === 'tasks' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 text-zinc-600 dark:text-zinc-400 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Routine Task</th>
                  <th className="py-3 px-4">Target Lab</th>
                  <th className="py-3 px-4">Frequency</th>
                  <th className="py-3 px-4">Last Serviced</th>
                  <th className="py-3 px-4">Next Target / Status</th>
                  <th className="py-3 px-4 text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {filteredPlans.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-zinc-500 text-xs">
                      <div className="max-w-xs mx-auto space-y-2">
                        <Wrench className="h-6 w-6 mx-auto text-zinc-400" />
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                          No maintenance routines found
                        </p>
                        <p className="text-zinc-500 text-[11px]">
                          {searchQuery
                            ? 'No matches found. Clear search to show all.'
                            : 'No routines configured for this lab.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPlans.map((plan) => {
                    const linkedReminder = data.reminders.find((r) => r.plan_id === plan.id)
                    const isExpanded = expandedPlanId === plan.id
                    const isOverdue = linkedReminder?.is_overdue || false
                    const isSnoozed = linkedReminder?.status === 'snoozed'

                    return (
                      <React.Fragment key={plan.id}>
                        <tr className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                          {/* Routine Task & SOP preview */}
                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              <div className="font-bold text-zinc-950 dark:text-white text-xs flex items-center gap-2">
                                <span>{plan.title}</span>
                                {!plan.is_active && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-400">
                                    Paused
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                                  {plan.category || 'General'}
                                </span>
                                {plan.checklist && plan.checklist.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setExpandedPlanId(isExpanded ? null : plan.id)}
                                    className="text-[10.5px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                                  >
                                    <span>{plan.checklist.length} SOP steps</span>
                                    <span className="text-[9px]">{isExpanded ? '▲' : '▼'}</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Target Lab */}
                          <td className="py-3 px-4 font-medium text-zinc-800 dark:text-zinc-200">
                            <div className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                              {plan.lab_id}
                            </div>
                            <span className="text-[11px] text-zinc-400">
                              {plan.lab_id === 'comp'
                                ? 'Computer Lab 01'
                                : plan.lab_id === 'phys'
                                ? 'Physics Lab'
                                : plan.lab_id === 'chem'
                                ? 'Chemistry Lab'
                                : plan.lab_id === 'bio'
                                ? 'Biology Lab'
                                : 'Electronics Lab'}
                            </span>
                          </td>

                          {/* Frequency */}
                          <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300">
                            <div className="font-mono font-bold text-zinc-900 dark:text-white">
                              Every {plan.interval_days} Days
                            </div>
                            <span className="text-[11px] text-zinc-400">
                              {plan.interval_days <= 30
                                ? 'Monthly'
                                : plan.interval_days <= 60
                                ? 'Bi-Monthly'
                                : plan.interval_days <= 90
                                ? 'Quarterly'
                                : plan.interval_days <= 180
                                ? 'Semi-Annual'
                                : 'Annual'}
                            </span>
                          </td>

                          {/* Last Serviced Record */}
                          <td className="py-3 px-4">
                            {plan.last_serviced_date ? (
                              <div className="space-y-0.5">
                                <div className="font-mono font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                  <span>{plan.last_serviced_date}</span>
                                </div>
                                <span className="text-[11px] text-zinc-500 block truncate max-w-[180px]">
                                  {plan.last_serviced_by || 'Staff'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-zinc-400 italic">
                                Never logged yet
                              </span>
                            )}
                          </td>

                          {/* Next Due / Current Status Badge */}
                          <td className="py-3 px-4">
                            {isOverdue ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 animate-pulse">
                                  <AlertTriangle className="h-3 w-3" />
                                  Overdue +{linkedReminder?.overdue_days}d
                                </span>
                                <span className="text-[11px] font-mono text-zinc-500 block">
                                  Due: {linkedReminder?.due_date}
                                </span>
                              </div>
                            ) : isSnoozed ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                  <Clock className="h-3 w-3" />
                                  Snoozed
                                </span>
                                <span className="text-[11px] font-mono text-zinc-500 block">
                                  Until: {linkedReminder?.snoozed_until}
                                </span>
                              </div>
                            ) : linkedReminder ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                                  <Clock className="h-3 w-3" />
                                  Due in {linkedReminder.days_remaining}d
                                </span>
                                <span className="text-[11px] font-mono text-zinc-500 block">
                                  Target: {linkedReminder.due_date}
                                </span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                                <Check className="h-3 w-3" />
                                Up to Date
                              </span>
                            )}
                          </td>

                          {/* Action Column: Direct Log & Fleet Routine Buttons */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenFleetModal(plan)}
                                className="h-7 px-2.5 text-xs font-semibold rounded-lg border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 cursor-pointer flex items-center gap-1"
                                title="Run machine-by-machine fleet checklist"
                              >
                                <LayoutGrid className="h-3 w-3" />
                                <span className="hidden xl:inline">Fleet Grid</span>
                              </Button>

                              <Button
                                size="sm"
                                onClick={() => handleOpenLogForPlan(plan)}
                                className="h-7 px-3 text-xs font-bold rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 hover:opacity-90 shadow-xs cursor-pointer flex items-center gap-1"
                              >
                                <Wrench className="h-3 w-3" />
                                <span>Record Service</span>
                              </Button>

                              {linkedReminder && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenSnooze(plan)}
                                  className="h-7 px-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                                  title="Snooze reminder"
                                >
                                  <Clock className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expandable SOP Checklist Row */}
                        {isExpanded && (
                          <tr className="bg-zinc-50/70 dark:bg-zinc-950/50">
                            <td colSpan={6} className="p-3 px-6 border-b border-zinc-100 dark:border-zinc-800">
                              <div className="space-y-1.5 max-w-2xl">
                                <span className="text-[10.5px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                                  Standard Operating Procedure Checklist:
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                                  {plan.checklist?.map((step, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-900 p-2 rounded-lg border border-zinc-200/80 dark:border-zinc-800"
                                    >
                                      <span className="h-4 w-4 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                                        {idx + 1}
                                      </span>
                                      <span className="truncate">{step}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: COMPLETE AUDIT HISTORY LOGBOOK */}
        {activeTab === 'history' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 text-zinc-600 dark:text-zinc-400 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Service Date</th>
                  <th className="py-3 px-4">Laboratory</th>
                  <th className="py-3 px-4">Routine & Target Machine(s)</th>
                  <th className="py-3 px-4">Performed By</th>
                  <th className="py-3 px-4">Checklist Verified</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-zinc-500 text-xs">
                      <div className="max-w-xs mx-auto space-y-2">
                        <FileCheck2 className="h-6 w-6 mx-auto text-zinc-400" />
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                          No service records on file
                        </p>
                        <p className="text-zinc-500 text-[11px]">
                          When you complete a maintenance session, click "Record Service" to
                          archive the certified entry.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-zinc-950 dark:text-white">
                        {log.service_date}
                      </td>

                      <td className="py-3.5 px-4 font-medium text-zinc-800 dark:text-zinc-200">
                        <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                          {log.lab_id}
                        </span>
                        <span className="block text-[11px] text-zinc-400">
                          {log.lab_name || log.lab_id.toUpperCase()}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-zinc-950 dark:text-white text-xs">
                          {log.plan_title || 'General Servicing'}
                        </div>
                        <div className="text-[11px] text-zinc-500 mt-0.5">
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">
                            Target:
                          </span>{' '}
                          {log.asset_identifier}
                          {log.parts_replaced && (
                            <span className="ml-2 text-indigo-600 dark:text-indigo-400">
                              • {log.parts_replaced}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-zinc-700 dark:text-zinc-300 font-medium">
                        <div className="flex items-center gap-1.5">
                          <UserCheck className="h-3.5 w-3.5 text-zinc-400" />
                          <span>{log.performed_by_name}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                          <Check className="h-3 w-3" />
                          {log.checklist_completed?.length || 0} Steps Completed
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenDetail(log)}
                          className="h-7 px-2.5 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          View Details →
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: Log Maintenance */}
      <LogMaintenanceModal
        isOpen={isLogModalOpen}
        onClose={() => {
          setIsLogModalOpen(false)
          setSelectedReminderForLog(null)
          setSelectedPlanForLog(null)
        }}
        onSuccess={handleRefresh}
        reminder={selectedReminderForLog}
        plan={selectedPlanForLog}
        plans={data.plans}
        selectedLabId={selectedPlanForLog?.lab_id || selectedLab}
      />

      {/* MODAL 2: Snooze Reminder */}
      <SnoozeModal
        isOpen={isSnoozeModalOpen}
        onClose={() => {
          setIsSnoozeModalOpen(false)
          setSelectedReminderForSnooze(null)
        }}
        onSuccess={handleRefresh}
        reminder={selectedReminderForSnooze}
      />

      {/* MODAL 3: Configure Routine Plan */}
      <CreatePlanModal
        isOpen={isCreatePlanOpen}
        onClose={() => {
          setIsCreatePlanOpen(false)
          setEditingPlan(null)
        }}
        onSuccess={handleRefresh}
        initialPlan={editingPlan}
      />

      {/* DRAWER: Service Audit Detail */}
      <MaintenanceDetailDrawer
        isOpen={isDetailDrawerOpen}
        onClose={() => setIsDetailDrawerOpen(false)}
        log={selectedLogForDetail}
      />

      {/* MODAL 4: Fleet Routine Execution Grid & CAD Floor Plan */}
      {isFleetModalOpen && selectedPlanForFleet && (
        <FleetRoutineModal
          isOpen={isFleetModalOpen}
          onClose={() => {
            setIsFleetModalOpen(false)
            setSelectedPlanForFleet(null)
          }}
          onSuccess={handleRefresh}
          plan={selectedPlanForFleet}
        />
      )}
    </div>
  )
}
