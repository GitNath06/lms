'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  Wrench,
  Shield,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  Layers,
  Sparkles,
  Clock,
  Check,
  X,
  ChevronRight,
  Monitor,
  Calendar,
  AlertTriangle,
  RotateCcw,
  Sliders,
  ExternalLink,
  PauseCircle,
  PlayCircle,
  FileText,
  ShieldAlert,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import {
  MaintenancePlanRecord,
  getMaintenanceOverview,
  saveMaintenancePlan,
  deleteMaintenancePlan,
  toggleMaintenancePlanStatus,
} from '@/app/actions/maintenance'
import CreatePlanModal from '@/components/maintenance/create-plan-modal'

interface MaintenanceRoutinesManagerProps {
  isEditModeUnlocked: boolean
  triggerToast: (msg: string) => void
}

const LAB_LABELS: Record<string, string> = {
  comp: 'Computer Lab 01',
  phys: 'Physics Laboratory',
  chem: 'Chemistry Laboratory',
  bio: 'Biology Laboratory',
  elec: 'Electronics Laboratory',
}

const PRESET_ROUTINES = [
  {
    title: 'PC Thermal Paste & Heatsink Servicing',
    lab_id: 'comp',
    category: 'Thermal & Hardware',
    interval_days: 180,
    severity: 'routine' as const,
    checklist: [
      'Clean CPU heatsink and remove old thermal grease',
      'Apply fresh Arctic MX-4 compound onto processor',
      'Vacuum intake and exhaust dust filters',
      'Verify idle and stress temperatures remain < 70°C',
    ],
  },
  {
    title: 'BIOS Firmware & Driver Patching',
    lab_id: 'comp',
    category: 'Firmware & OS',
    interval_days: 120,
    severity: 'high' as const,
    checklist: [
      'Flash motherboards with latest stable OEM BIOS release',
      'Update chipset and network adapter drivers',
      'Verify Secure Boot and TPM 2.0 status across machines',
    ],
  },
  {
    title: 'PC Deep Dusting & Power Supply Inspection',
    lab_id: 'comp',
    category: 'Hardware Maintenance',
    interval_days: 90,
    severity: 'routine' as const,
    checklist: [
      'Blow out internal dust from case, GPU, and RAM slots',
      'Check power supply fan spin and exhaust temperature',
      'Inspect SATA/NVMe drive cables and cable ties',
    ],
  },
  {
    title: 'Lab Software Image & Compiler Rollout',
    lab_id: 'comp',
    category: 'Software & Security',
    interval_days: 60,
    severity: 'routine' as const,
    checklist: [
      'Deploy latest Windows updates and IDE compilers (VSCode, GCC, Python)',
      'Update student freeze/restore software (DeepFreeze/RebootRestore)',
      'Verify network drive mounting and offline cache permissions',
    ],
  },
  {
    title: 'Fume Hood & Chemical Storage Airflow Check',
    lab_id: 'chem',
    category: 'Chemical Safety',
    interval_days: 30,
    severity: 'high' as const,
    checklist: [
      'Inspect fume hood face velocity and airflow baffles',
      'Check acid and organic storage cabinet seals',
      'Test emergency eye-wash station flow rate',
    ],
  },
  {
    title: 'Optical Bench & Laser Calibration',
    lab_id: 'phys',
    category: 'Precision Calibration',
    interval_days: 90,
    severity: 'routine' as const,
    checklist: [
      'Clean optics with spectrophotometric grade lens paper',
      'Level precision optical bench rails and micrometers',
      'Calibrate spectrometer diffraction grating zero-point',
    ],
  },
]

export default function MaintenanceRoutinesManager({
  isEditModeUnlocked,
  triggerToast,
}: MaintenanceRoutinesManagerProps) {
  const [plans, setPlans] = useState<MaintenancePlanRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [labFilter, setLabFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all')

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<MaintenancePlanRecord | null>(null)
  const [planToDelete, setPlanToDelete] = useState<MaintenancePlanRecord | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null)

  const loadPlans = async () => {
    setLoading(true)
    try {
      const data = await getMaintenanceOverview('all')
      setPlans(data.plans || [])
    } catch (err: any) {
      triggerToast('Failed to load maintenance plans.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPlans()
  }, [])

  const requireEditMode = (): boolean => {
    if (!isEditModeUnlocked) {
      triggerToast('🔒 Precaution Guard: Unlock "Admin Edit Mode" at the top to modify maintenance routines.')
      return false
    }
    return true
  }

  const handleToggleStatus = async (plan: MaintenancePlanRecord) => {
    if (!requireEditMode()) return
    const nextStatus = !plan.is_active

    const res = await toggleMaintenancePlanStatus(plan.id, nextStatus)
    if (res.success) {
      triggerToast(
        nextStatus
          ? `🟢 Routine activated: ${plan.title}`
          : `⏸️ Routine paused: ${plan.title}. Reminders suspended.`
      )
      setPlans((prev) =>
        prev.map((p) => (p.id === plan.id ? { ...p, is_active: nextStatus } : p))
      )
    } else {
      triggerToast(`❌ ${res.error || 'Failed to update plan status'}`)
    }
  }

  const handleDeletePlan = async () => {
    if (!requireEditMode() || !planToDelete) return
    setIsDeleting(true)
    try {
      const res = await deleteMaintenancePlan(planToDelete.id)
      if (res.success) {
        triggerToast(`🗑️ Routine deleted: ${planToDelete.title}`)
        setPlans((prev) => prev.filter((p) => p.id !== planToDelete.id))
        setPlanToDelete(null)
      } else {
        triggerToast(`❌ ${res.error || 'Failed to delete plan'}`)
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const handleQuickAddPreset = async (preset: (typeof PRESET_ROUTINES)[0]) => {
    if (!requireEditMode()) return
    const res = await saveMaintenancePlan({
      title: preset.title,
      lab_id: preset.lab_id,
      category: preset.category,
      interval_days: preset.interval_days,
      severity: preset.severity,
      checklist: preset.checklist,
      target_role: 'lab_incharge',
      description: `Official laboratory preventive routine for ${LAB_LABELS[preset.lab_id] || preset.lab_id}.`,
      is_active: true,
    })

    if (res.success) {
      triggerToast(`✨ Preset added: ${preset.title}`)
      loadPlans()
    } else {
      triggerToast(`❌ ${res.error || 'Failed to add preset'}`)
    }
  }

  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      if (labFilter !== 'all' && p.lab_id !== labFilter) return false
      if (statusFilter === 'active' && !p.is_active) return false
      if (statusFilter === 'paused' && p.is_active) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesTitle = p.title.toLowerCase().includes(q)
        const matchesCat = (p.category || '').toLowerCase().includes(q)
        const matchesLab = (LAB_LABELS[p.lab_id] || p.lab_id).toLowerCase().includes(q)
        const matchesChecklist = p.checklist?.some((c) => c.toLowerCase().includes(q))
        if (!matchesTitle && !matchesCat && !matchesLab && !matchesChecklist) return false
      }
      return true
    })
  }, [plans, labFilter, statusFilter, searchQuery])

  const stats = useMemo(() => {
    const total = plans.length
    const active = plans.filter((p) => p.is_active).length
    const compCount = plans.filter((p) => p.lab_id === 'comp').length
    const scienceCount = plans.filter((p) => p.lab_id !== 'comp').length
    return { total, active, compCount, scienceCount }
  }, [plans])

  return (
    <div className="space-y-5 font-sans">
      {/* Overview Metric Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500 font-medium">Configured Routines</span>
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Layers className="h-4 w-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-zinc-950 dark:text-white mt-2 font-mono">
            {stats.total}
          </div>
          <span className="text-[11px] text-zinc-400 mt-0.5 block">Across all laboratories</span>
        </div>

        <div className="p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500 font-medium">Active Monitoring</span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2 font-mono">
            {stats.active}
          </div>
          <span className="text-[11px] text-zinc-400 mt-0.5 block">Generating dynamic reminders</span>
        </div>

        <div className="p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500 font-medium">Computer Lab Plans</span>
            <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <Monitor className="h-4 w-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400 mt-2 font-mono">
            {stats.compCount}
          </div>
          <span className="text-[11px] text-zinc-400 mt-0.5 block">Thermal, BIOS, Cleaning, OS</span>
        </div>

        <div className="p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500 font-medium">Science Labs Plans</span>
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Wrench className="h-4 w-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2 font-mono">
            {stats.scienceCount}
          </div>
          <span className="text-[11px] text-zinc-400 mt-0.5 block">Physics, Chem, Bio equipment & tools</span>
        </div>
      </div>

      {/* Main Table Card */}
      <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs overflow-hidden">
        <CardHeader className="p-4 px-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <Wrench className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              Master Maintenance Routines & Routine Cadence
            </CardTitle>
            <CardDescription className="text-xs text-zinc-500">
              Configure scheduled preventive care routines, SOP checklists, and automated alert cadences
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/maintenance"
              className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1 mr-2"
            >
              <span>Live Servicing Hub</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
            <Button
              size="sm"
              disabled={!isEditModeUnlocked}
              onClick={() => {
                setEditingPlan(null)
                setIsCreateModalOpen(true)
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs gap-1.5 shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Add Routine Plan</span>
            </Button>
          </div>
        </CardHeader>

        {/* Filter and Search Toolbar */}
        <div className="p-3.5 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 flex flex-wrap items-center justify-between gap-2.5">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="h-3.5 w-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search routines, categories, or checklist steps..."
              className="h-8.5 pl-8.5 text-xs bg-zinc-50/60 dark:bg-zinc-950"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={labFilter}
              onChange={(e) => setLabFilter(e.target.value)}
              className="h-8.5 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none"
            >
              <option value="all">All Laboratories</option>
              <option value="comp">Computer Lab 01</option>
              <option value="phys">Physics Laboratory</option>
              <option value="chem">Chemistry Laboratory</option>
              <option value="bio">Biology Laboratory</option>
              <option value="elec">Electronics Laboratory</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="h-8.5 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="paused">Paused Only</option>
            </select>
          </div>
        </div>

        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 text-zinc-600 dark:text-zinc-400 font-bold uppercase text-[10.5px]">
                <th className="py-3 px-4">Routine Title & Category</th>
                <th className="py-3 px-4">Target Lab</th>
                <th className="py-3 px-4">Cadence / Interval</th>
                <th className="py-3 px-4">SOP Checklist</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500 font-mono text-xs">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="h-5 w-5 rounded-full border-2 border-indigo-500/30 border-t-indigo-600 animate-spin" />
                      <span>Loading maintenance routines...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredPlans.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500 text-xs">
                    <div className="max-w-xs mx-auto space-y-3">
                      <div className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
                        <Wrench className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100">No maintenance routines found</p>
                        <p className="text-zinc-500 text-[11px] mt-0.5">
                          {searchQuery || labFilter !== 'all' || statusFilter !== 'all'
                            ? 'Try adjusting your filters or search query.'
                            : 'Install recommended standard routines below to get started.'}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPlans.map((plan) => {
                  const isExpanded = expandedPlanId === plan.id
                  return (
                    <React.Fragment key={plan.id}>
                      <tr className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-start gap-2.5">
                            <div className="mt-0.5">
                              {plan.lab_id === 'comp' ? (
                                <Monitor className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                              ) : (
                                <Wrench className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-zinc-950 dark:text-white text-xs">
                                {plan.title}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                  {plan.category || 'General'}
                                </span>
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                                    plan.severity === 'critical'
                                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                      : plan.severity === 'high'
                                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                      : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                                  }`}
                                >
                                  {plan.severity}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-medium text-zinc-800 dark:text-zinc-200">
                          <span className="font-mono text-xs uppercase font-bold text-indigo-600 dark:text-indigo-400">
                            {plan.lab_id}
                          </span>
                          <span className="block text-[11px] text-zinc-400">
                            {LAB_LABELS[plan.lab_id] || plan.lab_id}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 font-medium text-zinc-700 dark:text-zinc-300">
                          <span className="font-mono font-bold text-zinc-950 dark:text-white text-xs">
                            Every {plan.interval_days} Days
                          </span>
                          <span className="block text-[11px] text-zinc-400">
                            {plan.interval_days <= 30
                              ? 'Monthly cadence'
                              : plan.interval_days <= 90
                              ? 'Quarterly cycle'
                              : plan.interval_days <= 180
                              ? 'Semi-Annual cycle'
                              : 'Annual cadence'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => setExpandedPlanId(isExpanded ? null : plan.id)}
                            className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>{plan.checklist?.length || 0} SOP Steps</span>
                            <span className="text-[10px] font-mono text-zinc-400">
                              {isExpanded ? '▲' : '▼'}
                            </span>
                          </button>
                        </td>

                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            disabled={!isEditModeUnlocked}
                            onClick={() => handleToggleStatus(plan)}
                            className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold border transition-colors flex items-center gap-1 cursor-pointer ${
                              plan.is_active
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200'
                            } ${!isEditModeUnlocked ? 'opacity-70 cursor-not-allowed' : ''}`}
                            title={isEditModeUnlocked ? 'Click to toggle Active/Paused' : 'Unlock Admin Edit Mode to toggle'}
                          >
                            {plan.is_active ? (
                              <>
                                <Check className="h-3 w-3" />
                                <span>Active</span>
                              </>
                            ) : (
                              <>
                                <PauseCircle className="h-3 w-3" />
                                <span>Paused</span>
                              </>
                            )}
                          </button>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!isEditModeUnlocked}
                              onClick={() => {
                                setEditingPlan(plan)
                                setIsCreateModalOpen(true)
                              }}
                              className="h-7 px-2.5 text-xs font-semibold"
                            >
                              <Edit3 className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!isEditModeUnlocked}
                              onClick={() => setPlanToDelete(plan)}
                              className="h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 dark:border-rose-900/50"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Checklist Sub-row */}
                      {isExpanded && (
                        <tr className="bg-zinc-50/60 dark:bg-zinc-950/40">
                          <td colSpan={6} className="p-3 px-6 border-b border-zinc-100 dark:border-zinc-800">
                            <div className="space-y-1.5 max-w-2xl">
                              <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                                Standard Operating Procedure (SOP) Checklist:
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                                {plan.checklist && plan.checklist.length > 0 ? (
                                  plan.checklist.map((step, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-900 p-2 rounded-lg border border-zinc-200/80 dark:border-zinc-800"
                                    >
                                      <span className="h-4 w-4 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                                        {idx + 1}
                                      </span>
                                      <span className="truncate">{step}</span>
                                    </div>
                                  ))
                                ) : (
                                  <span className="text-xs text-zinc-400 italic">No checklist steps specified.</span>
                                )}
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
        </CardContent>
      </Card>

      {/* Preset Library Quick Install Section */}
      <Card className="border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40">
        <CardHeader className="p-4 px-5">
          <CardTitle className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Recommended Standard Lab Routine Presets
          </CardTitle>
          <CardDescription className="text-xs text-zinc-500">
            One-click installer for standardized academic lab preventive care plans
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 px-5 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {PRESET_ROUTINES.map((preset, idx) => {
              const isInstalled = plans.some((p) => p.title.toLowerCase() === preset.title.toLowerCase())
              return (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col justify-between space-y-2 shadow-2xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        {preset.lab_id}
                      </span>
                      <span className="text-[10px] font-bold text-zinc-400">
                        Every {preset.interval_days}d
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-zinc-950 dark:text-white leading-snug">
                      {preset.title}
                    </h4>
                    <span className="text-[11px] text-zinc-500 block">
                      {preset.checklist.length} checklist steps
                    </span>
                  </div>

                  <Button
                    size="sm"
                    variant={isInstalled ? 'outline' : 'default'}
                    disabled={!isEditModeUnlocked || isInstalled}
                    onClick={() => handleQuickAddPreset(preset)}
                    className={`w-full text-xs font-semibold h-7 ${
                      isInstalled
                        ? 'opacity-60 text-zinc-500'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    {isInstalled ? (
                      <span className="flex items-center gap-1">
                        <Check className="h-3 w-3" /> Installed
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Plus className="h-3 w-3" /> Quick Add
                      </span>
                    )}
                  </Button>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* MODAL 1: Create or Edit Plan */}
      <CreatePlanModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false)
          setEditingPlan(null)
        }}
        onSuccess={() => {
          setIsCreateModalOpen(false)
          setEditingPlan(null)
          triggerToast('Maintenance routine plan saved successfully!')
          loadPlans()
        }}
        initialPlan={editingPlan}
      />

      {/* MODAL 2: Delete Safety Confirmation */}
      {planToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 select-none">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 font-sans animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="h-10 w-10 rounded-full bg-rose-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
                  Delete Maintenance Routine
                </h3>
                <span className="text-xs text-zinc-500">Irreversible operational action</span>
              </div>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              Are you sure you want to permanently delete{' '}
              <strong className="text-zinc-900 dark:text-white">{planToDelete.title}</strong>? Any
              associated active reminders will also be dismissed.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPlanToDelete(null)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={isDeleting}
                onClick={handleDeletePlan}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
