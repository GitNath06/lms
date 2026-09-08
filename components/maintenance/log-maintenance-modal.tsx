'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Wrench,
  CheckSquare2,
  Square,
  AlertCircle,
  Calendar,
  Package,
  X,
  Sparkles,
  CheckCircle2,
  Monitor,
  Clock,
  Layers,
  ShieldCheck,
  Grid,
  FileText,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  MaintenancePlanRecord,
  MaintenanceReminderRecord,
  logMaintenanceService,
} from '@/app/actions/maintenance'
import WorkstationMatrixSelector from './workstation-matrix-selector'
import { useUserScope } from '@/hooks/use-user-scope'
import { useInfrastructureState } from '@/hooks/use-infrastructure-state'
import { getNepaliDate } from '@/lib/nepali-date'

interface LogMaintenanceModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  reminder?: MaintenanceReminderRecord | null
  plan?: MaintenancePlanRecord | null
  plans: MaintenancePlanRecord[]
  selectedLabId?: string
}

export default function LogMaintenanceModal({
  isOpen,
  onClose,
  onSuccess,
  reminder,
  plan,
  plans,
  selectedLabId,
}: LogMaintenanceModalProps) {
  const { profile } = useUserScope()
  const { labs } = useInfrastructureState()
  const [selectedPlanId, setSelectedPlanId] = useState<string>('')
  const [labId, setLabId] = useState<string>(selectedLabId || 'comp')
  const currentLab = useMemo(() => labs.find((l) => l.id === labId), [labs, labId])
  const labCapacity = currentLab?.capacity || 40
  const isComputerOrTechLab = currentLab?.type === 'computer_lab' || currentLab?.type === 'electronics_lab' || labId === 'comp' || labId === 'elec'

  const [useMatrix, setUseMatrix] = useState<boolean>(true)
  const [flaggedStations, setFlaggedStations] = useState<string[]>([])
  const [assetIdentifier, setAssetIdentifier] = useState<string>('')
  const [workPerformed, setWorkPerformed] = useState<string>('')
  const [partsReplaced, setPartsReplaced] = useState<string>('')
  const [serviceDate, setServiceDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [completedChecklist, setCompletedChecklist] = useState<string[]>([])
  const [remarks, setRemarks] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const nepaliDateStr = useMemo(() => {
    try {
      const d = new Date(serviceDate)
      return getNepaliDate(d).formattedDate
    } catch {
      return ''
    }
  }, [serviceDate])

  const handleMatrixChange = (data: {
    serviced: string[]
    flagged: string[]
    summaryText: string
  }) => {
    setFlaggedStations(data.flagged)
    if (useMatrix) {
      setAssetIdentifier(data.summaryText)
    }
  }

  // Pre-fill state when plan, reminder, or modal is opened
  useEffect(() => {
    if (plan) {
      setSelectedPlanId(plan.id)
      setLabId(plan.lab_id)
      if (plan.checklist && Array.isArray(plan.checklist)) {
        setCompletedChecklist([...plan.checklist])
      } else {
        setCompletedChecklist([])
      }
      setAssetIdentifier(
        plan.lab_id === 'comp'
          ? 'All Workstations (PC 01–36)'
          : `${plan.title} Equipment`
      )
      setWorkPerformed(`Completed periodic routine maintenance for ${plan.title}.`)
    } else if (reminder) {
      setSelectedPlanId(reminder.plan_id)
      setLabId(reminder.lab_id)
      if (reminder.plan?.checklist && Array.isArray(reminder.plan.checklist)) {
        setCompletedChecklist([...reminder.plan.checklist])
      } else {
        setCompletedChecklist([])
      }
      setAssetIdentifier(
        reminder.lab_id === 'comp'
          ? 'All Workstations (PC 01–36)'
          : `All Systems / ${reminder.title}`
      )
      setWorkPerformed(`Completed periodic routine maintenance for ${reminder.title}.`)
    } else {
      const targetLab = selectedLabId && selectedLabId !== 'all' ? selectedLabId : 'comp'
      setSelectedPlanId(plans[0]?.id || '')
      setLabId(targetLab)
      setUseMatrix(targetLab === 'comp')
      setAssetIdentifier('')
      setWorkPerformed('')
      setCompletedChecklist([])
    }
    setErrorMsg(null)
  }, [plan, reminder, plans, selectedLabId, isOpen])

  // When plan changes, populate checklist from plan definition
  const handlePlanChange = (planId: string) => {
    setSelectedPlanId(planId)
    const targetPlan = plans.find((p) => p.id === planId)
    if (targetPlan) {
      setLabId(targetPlan.lab_id)
      setUseMatrix(targetPlan.lab_id === 'comp')
      if (Array.isArray(targetPlan.checklist)) {
        setCompletedChecklist([...targetPlan.checklist])
      }
    }
  }

  const toggleChecklistItem = (item: string) => {
    setCompletedChecklist((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assetIdentifier.trim()) {
      setErrorMsg('Target machine(s) or hardware identifier is required.')
      return
    }
    if (!workPerformed.trim()) {
      setErrorMsg('A summary of technical work completed is required.')
      return
    }

    setIsSubmitting(true)
    setErrorMsg(null)

    try {
      const res = await logMaintenanceService({
        plan_id: selectedPlanId || null,
        reminder_id: reminder?.id || null,
        lab_id: labId,
        asset_identifier: assetIdentifier.trim(),
        work_performed: workPerformed.trim(),
        checklist_completed: completedChecklist,
        parts_replaced: partsReplaced.trim() || null,
        cost_incurred: 0,
        service_date: serviceDate,
        remarks: remarks.trim() || null,
      })

      if (!res.success) {
        setErrorMsg(res.error || 'Failed to record maintenance.')
      } else {
        onSuccess()
        onClose()
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred while saving maintenance.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  const activePlan = plans.find((p) => p.id === selectedPlanId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 font-sans flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20 shadow-xs">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-zinc-950 dark:text-white">
                  Log Lab Maintenance
                </h3>
                {reminder && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    Linked to Reminder
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Record completed PC servicing, cleaning, or updates; auto-schedules next cycle.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Facility & Routine Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Monitor className="h-3.5 w-3.5 text-zinc-400" />
                Target Laboratory
              </label>
              <select
                value={labId}
                onChange={(e) => {
                  const nextLabId = e.target.value
                  setLabId(nextLabId)
                  const targetLab = labs.find((l) => l.id === nextLabId)
                  setUseMatrix(
                    targetLab?.type === 'computer_lab' ||
                      targetLab?.type === 'electronics_lab' ||
                      nextLabId === 'comp' ||
                      nextLabId === 'elec'
                  )
                }}
                className="w-full h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {labs && labs.length > 0 ? (
                  labs.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.capacity} Stations)
                    </option>
                  ))
                ) : (
                  <>
                    <option value="comp">Computer Engineering Lab 01 (40 Stations)</option>
                    <option value="phys">Physics Laboratory (38 Stations)</option>
                    <option value="chem">Chemistry Laboratory (40 Stations)</option>
                    <option value="bio">Biology Laboratory (35 Stations)</option>
                    <option value="elec">Electronics Laboratory (30 Stations)</option>
                  </>
                )}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-zinc-400" />
                Associated Routine Plan
              </label>
              <select
                value={selectedPlanId}
                onChange={(e) => handlePlanChange(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">-- General / Ad-hoc Maintenance --</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} (Every {p.interval_days} Days)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Machine / Target Scope */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Monitor className="h-3.5 w-3.5 text-zinc-400" />
                Target Equipment Scope <span className="text-rose-500">*</span>
              </label>

              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[10px]">
                <button
                  type="button"
                  onClick={() => setUseMatrix(true)}
                  className={`px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1 ${
                    useMatrix
                      ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-semibold'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  <Grid className="h-3 w-3" />
                  <span>{labCapacity}-Desk Matrix</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUseMatrix(false)}
                  className={`px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1 ${
                    !useMatrix
                      ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-semibold'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  <FileText className="h-3 w-3" />
                  <span>Manual Text</span>
                </button>
              </div>
            </div>

            {useMatrix ? (
              <div className="space-y-2.5">
                <WorkstationMatrixSelector
                  totalWorkstations={labCapacity}
                  labName={currentLab?.name || 'Computer Lab 01'}
                  onChange={handleMatrixChange}
                />

                {/* Flagged workstations follow-up banner */}
                {flaggedStations.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                      <span>
                        <strong>{flaggedStations.length} station(s) flagged:</strong>{' '}
                        {flaggedStations.join(', ')}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const note = `Follow-up needed for flagged workstations: ${flaggedStations.join(', ')}`
                        setRemarks((prev) => (prev ? `${prev}. ${note}` : note))
                      }}
                      className="text-[11px] font-semibold underline hover:text-rose-900 dark:hover:text-rose-100 cursor-pointer"
                    >
                      Append to Remarks
                    </button>
                  </div>
                )}

                {/* Micro input showing selected text summary */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-zinc-400 uppercase shrink-0">
                    Target String:
                  </span>
                  <Input
                    value={assetIdentifier}
                    onChange={(e) => setAssetIdentifier(e.target.value)}
                    placeholder="e.g. PC-01 to PC-40"
                    className="h-7 text-xs font-mono"
                    required
                  />
                </div>
              </div>
            ) : (
              <Input
                value={assetIdentifier}
                onChange={(e) => setAssetIdentifier(e.target.value)}
                placeholder="e.g. Workstations PC 01–28, Server Rack, Master PC, Projector"
                className="h-9 text-xs"
                required
              />
            )}
          </div>

          {/* Checklist Verification Card */}
          {activePlan && activePlan.checklist && activePlan.checklist.length > 0 && (
            <div className="space-y-2 p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Maintenance Checklist Verification
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {completedChecklist.length} of {activePlan.checklist.length} Completed
                </span>
              </div>
              <div className="space-y-1.5 pt-1">
                {activePlan.checklist.map((item, idx) => {
                  const isChecked = completedChecklist.includes(item)
                  return (
                    <div
                      key={idx}
                      onClick={() => toggleChecklistItem(item)}
                      className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all border text-xs ${
                        isChecked
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-200 font-medium'
                          : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                      }`}
                    >
                      {isChecked ? (
                        <CheckSquare2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : (
                        <Square className="h-4 w-4 text-zinc-400 shrink-0" />
                      )}
                      <span>{item}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Technical Work Summary */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Technical Work Performed <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={workPerformed}
              onChange={(e) => setWorkPerformed(e.target.value)}
              placeholder="e.g. Applied thermal paste across all 30 PCs, blew out heatsink dust, updated BIOS firmware to v2.14, tested memory stability."
              rows={3}
              className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs leading-relaxed"
              required
            />
          </div>

          {/* Parts Replaced & Service Date Row (NO PRICE/COST) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-zinc-400" />
                Hardware / Parts Used (Optional)
              </label>
              <Input
                value={partsReplaced}
                onChange={(e) => setPartsReplaced(e.target.value)}
                placeholder="e.g. Arctic MX-4 paste, 2x CMOS batteries"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                Service Date
              </label>
              <Input
                type="date"
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                className="h-9 text-xs"
                required
              />
            </div>
          </div>

          {/* Remarks */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Notes & Next Recommendations (Optional)
            </label>
            <Input
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. PC-12 CPU fan bearing makes faint hum; check next month."
              className="h-9 text-xs"
            />
          </div>

          {/* Institutional Digital Sign-Off Certificate Stamp */}
          <div className="p-3 rounded-xl border border-indigo-200/80 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50/70 via-slate-50 to-emerald-50/40 dark:from-indigo-950/30 dark:via-zinc-900/40 dark:to-emerald-950/20 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <ShieldCheck className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-950 dark:text-white flex items-center gap-1.5 font-heading">
                    Institutional Service Attestation
                  </h4>
                </div>
              </div>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                Dual Audit Trail
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1 border-t border-indigo-100/60 dark:border-indigo-900/40 font-mono text-zinc-600 dark:text-zinc-400">
              <div>
                <span className="text-zinc-400 dark:text-zinc-500">Certified By: </span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {profile?.full_name || 'Laboratory In-Charge'}
                </span>
                <span className="ml-1 text-[9px] px-1.5 py-0.2 rounded bg-zinc-200/60 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 capitalize">
                  {(profile?.role || 'lab_incharge').replace('_', ' ')}
                </span>
              </div>
              <div className="sm:text-right">
                <span className="text-zinc-400 dark:text-zinc-500">Date: </span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {serviceDate}
                </span>
                {nepaliDateStr && (
                  <span className="text-zinc-400 dark:text-zinc-500 ml-1 text-[10px]">
                    ({nepaliDateStr})
                  </span>
                )}
              </div>
            </div>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 italic">
              Submitting digitally seals this technical logbook entry with institutional audit verification.
            </p>
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-9 px-4 text-xs font-medium"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold gap-1.5 cursor-pointer shadow-xs"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{isSubmitting ? 'Saving...' : 'Save & Schedule Next Cycle'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
