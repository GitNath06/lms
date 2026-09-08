'use client'

import React, { useState } from 'react'
import {
  X,
  Plus,
  Trash2,
  Calendar,
  Layers,
  AlertTriangle,
  Clock,
  Sparkles,
  Loader2,
  ShieldCheck,
  Monitor,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { saveMaintenancePlan, MaintenancePlanRecord } from '@/app/actions/maintenance'

interface CreatePlanModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  initialPlan?: MaintenancePlanRecord | null
}

const PRESET_INTERVALS = [
  { label: 'Monthly (30d)', days: 30 },
  { label: 'Bi-Monthly (60d)', days: 60 },
  { label: 'Quarterly (90d)', days: 90 },
  { label: 'Tri-Annual (120d)', days: 120 },
  { label: 'Semi-Annual (180d)', days: 180 },
  { label: 'Annual (365d)', days: 365 },
]

const COMPUTER_ROUTINE_PRESETS = [
  {
    title: 'PC Thermal Paste & Heatsink Cleaning',
    category: 'Thermal & Hardware',
    intervalDays: 180,
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
    category: 'Firmware & OS',
    intervalDays: 120,
    severity: 'high' as const,
    checklist: [
      'Flash motherboards with latest stable OEM BIOS release',
      'Update chipset and network adapter drivers',
      'Verify Secure Boot and TPM 2.0 status across machines',
    ],
  },
  {
    title: 'PC Deep Dusting & Power Supply Inspection',
    category: 'Hardware Maintenance',
    intervalDays: 90,
    severity: 'routine' as const,
    checklist: [
      'Blow out internal dust from case, GPU, and RAM slots',
      'Check power supply fan spin and exhaust temperature',
      'Inspect SATA/NVMe drive cables and cable ties',
    ],
  },
  {
    title: 'Lab Software Image & Security Update Rollout',
    category: 'Software & Security',
    intervalDays: 60,
    severity: 'routine' as const,
    checklist: [
      'Deploy latest Windows updates and IDE compilers (VSCode, GCC, Python)',
      'Update student freeze/restore software (DeepFreeze/RebootRestore)',
      'Verify network drive mounting and offline cache permissions',
    ],
  },
]

export default function CreatePlanModal({
  isOpen,
  onClose,
  onSuccess,
  initialPlan,
}: CreatePlanModalProps) {
  const [labId, setLabId] = useState(initialPlan?.lab_id || 'comp')
  const [title, setTitle] = useState(initialPlan?.title || '')
  const [category, setCategory] = useState(initialPlan?.category || 'Hardware Care')
  const [intervalDays, setIntervalDays] = useState(initialPlan?.interval_days || 90)
  const [severity, setSeverity] = useState<'low' | 'routine' | 'high' | 'critical'>(
    initialPlan?.severity || 'routine'
  )
  const [targetRole, setTargetRole] = useState(initialPlan?.target_role || 'lab_incharge')
  const [description, setDescription] = useState(initialPlan?.description || '')
  const [checklist, setChecklist] = useState<string[]>(
    initialPlan?.checklist && initialPlan.checklist.length > 0
      ? initialPlan.checklist
      : [
          'Blow out internal chassis dust and clean fan blades',
          'Inspect cable connections and power supply stability',
          'Perform quick functional OS boot and network test',
        ]
  )
  const [newCheckItem, setNewCheckItem] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  if (!isOpen) return null

  const handleApplyPreset = (preset: (typeof COMPUTER_ROUTINE_PRESETS)[0]) => {
    setTitle(preset.title)
    setCategory(preset.category)
    setIntervalDays(preset.intervalDays)
    setSeverity(preset.severity)
    setChecklist([...preset.checklist])
  }

  const handleAddChecklist = () => {
    if (!newCheckItem.trim()) return
    setChecklist([...checklist, newCheckItem.trim()])
    setNewCheckItem('')
  }

  const handleRemoveChecklist = (idx: number) => {
    setChecklist(checklist.filter((_, i) => i !== idx))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setErrorMsg('Plan title is mandatory.')
      return
    }
    if (intervalDays <= 0) {
      setErrorMsg('Recurrence interval must be at least 1 day.')
      return
    }
    if (checklist.length === 0) {
      setErrorMsg('Please include at least one checklist item.')
      return
    }

    setLoading(true)
    setErrorMsg('')

    try {
      const res = await saveMaintenancePlan({
        id: initialPlan?.id,
        lab_id: labId,
        title: title.trim(),
        category: category.trim(),
        interval_days: Number(intervalDays),
        severity,
        target_role: targetRole,
        checklist,
        description: description.trim() || null,
        is_active: true,
      })

      if (!res.success) {
        setErrorMsg(res.error || 'Failed to save maintenance plan.')
      } else {
        onSuccess()
        onClose()
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] font-sans">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-950 dark:text-white">
                {initialPlan ? 'Edit Maintenance Routine' : 'New Maintenance Routine'}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Set recurring cycle for computer hardware, software updates, or lab equipment.
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

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 text-xs bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Quick Computer Lab Presets */}
          {!initialPlan && (
            <div className="p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 space-y-2">
              <div className="text-[11px] font-semibold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                Quick Computer Lab Routine Templates:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {COMPUTER_ROUTINE_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 transition-colors font-medium cursor-pointer shadow-2xs"
                  >
                    + {preset.title.split(' ')[0]} {preset.title.split(' ')[1]} ({preset.intervalDays}d)
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Target Lab & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Target Facility
              </label>
              <Select
                value={labId}
                onChange={(e) => setLabId(e.target.value)}
                className="h-9 text-xs"
              >
                <option value="comp">Computer Engineering Lab 01</option>
                <option value="phys">Physics Laboratory</option>
                <option value="chem">Chemistry Laboratory</option>
                <option value="bio">Biology Laboratory</option>
                <option value="elec">Electronics Laboratory</option>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Category
              </label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Thermal Care, Software Patch, Hardware"
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Routine Title <span className="text-rose-500">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. PC Heatsink & Dust Filter Cleaning"
              className="h-9 text-xs font-medium"
              required
            />
          </div>

          {/* Interval & Recurrence */}
          <div className="space-y-2 p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-indigo-500" />
                Recurrence Cadence (Interval Days)
              </label>
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                Every {intervalDays} Days
              </span>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {PRESET_INTERVALS.map((preset) => (
                <button
                  key={preset.days}
                  type="button"
                  onClick={() => setIntervalDays(preset.days)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                    intervalDays === preset.days
                      ? 'bg-indigo-600 text-white font-bold border-indigo-600 shadow-xs'
                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-indigo-400'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="pt-2 flex items-center gap-2">
              <span className="text-xs text-zinc-500 shrink-0">Custom Days:</span>
              <Input
                type="number"
                min="1"
                max="730"
                value={intervalDays}
                onChange={(e) => setIntervalDays(Math.max(1, Number(e.target.value) || 1))}
                className="h-8 text-xs w-24"
              />
              <span className="text-[11px] text-zinc-400">
                (Next reminder automatically triggers Day {intervalDays} after service)
              </span>
            </div>
          </div>

          {/* Severity & Target Role */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Criticality
              </label>
              <Select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as any)}
                className="h-9 text-xs"
              >
                <option value="routine">Routine (Standard Periodic Care)</option>
                <option value="high">High (Performance / Stability)</option>
                <option value="critical">Critical (Core Infrastructure / Server)</option>
                <option value="low">Low (Cosmetic / Sanitization)</option>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Assigned Role
              </label>
              <Select
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                className="h-9 text-xs"
              >
                <option value="lab_incharge">Lab In-Charge / Technician</option>
                <option value="coordinator">Academic Coordinator</option>
                <option value="super_admin">Super Admin / Principal</option>
              </Select>
            </div>
          </div>

          {/* Checklist */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Verification Steps Checklist ({checklist.length})
              </label>
              <span className="text-[11px] text-zinc-400">Checked off during service</span>
            </div>

            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {checklist.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-200"
                >
                  <span className="truncate pr-2 text-xs">
                    <span className="text-zinc-400 mr-1.5 font-semibold">#{idx + 1}</span>
                    {item}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveChecklist(idx)}
                    className="text-zinc-400 hover:text-rose-500 transition-colors p-0.5"
                    title="Remove item"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Input
                value={newCheckItem}
                onChange={(e) => setNewCheckItem(e.target.value)}
                placeholder="Add new step (e.g. Test RAM stability)..."
                className="h-8 text-xs"
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddChecklist()
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddChecklist}
                className="h-8 px-2.5 text-xs shrink-0"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Guidance & Scope Notes (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Ensure all thermal paste is cleaned using isopropyl alcohol before applying new compound."
              rows={2}
              className="w-full text-xs rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-2.5 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs leading-relaxed"
            />
          </div>

          {/* Footer buttons */}
          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={loading}
              className="h-9 px-4 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading}
              className="h-9 px-4 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Saving Routine...
                </>
              ) : initialPlan ? (
                'Update Maintenance Routine'
              ) : (
                'Create Routine & Schedule Reminder'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
