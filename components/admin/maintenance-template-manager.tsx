'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Wrench,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Layers,
  Search,
  Filter,
  Check,
  X,
  PlayCircle,
  Shield,
  Loader2,
  ListChecks,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import {
  getMaintenanceRoutineTemplates,
  saveMaintenanceRoutineTemplate,
  deleteMaintenanceRoutineTemplate,
} from '@/app/actions/maintenance-templates'
import { saveMaintenancePlan } from '@/app/actions/maintenance'
import type { MaintenanceRoutineTemplateRow } from '@/types/database'
import type { MaintenanceRoutineTemplateInput } from '@/lib/types/maintenance-templates'

interface MaintenanceTemplateManagerProps {
  isEditModeUnlocked: boolean
  triggerToast: (msg: string) => void
  onRoutineDeployed?: () => void
}

const LAB_LABELS: Record<string, string> = {
  comp: 'Computer Lab 01',
  phys: 'Physics Laboratory',
  chem: 'Chemistry Laboratory',
  bio: 'Biology Laboratory',
  elec: 'Electronics Laboratory',
  all: 'All Facilities',
}

const CADENCE_OPTIONS = [
  { value: 'monthly', label: 'Monthly (30 Days)', days: 30 },
  { value: 'bi_monthly', label: 'Bi-Monthly (60 Days)', days: 60 },
  { value: 'quarterly', label: 'Quarterly (90 Days)', days: 90 },
  { value: 'tri_annual', label: 'Tri-Annual (120 Days)', days: 120 },
  { value: 'semi_annual', label: 'Semi-Annual (180 Days)', days: 180 },
  { value: 'annual', label: 'Annual (365 Days)', days: 365 },
]

export function MaintenanceTemplateManager({
  isEditModeUnlocked,
  triggerToast,
  onRoutineDeployed,
}: MaintenanceTemplateManagerProps) {
  const [templates, setTemplates] = useState<MaintenanceRoutineTemplateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [labFilter, setLabFilter] = useState('all')

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<MaintenanceRoutineTemplateRow | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deployingId, setDeployingId] = useState<string | null>(null)

  // Form Fields
  const [formTitle, setFormTitle] = useState('')
  const [formLabId, setFormLabId] = useState('comp')
  const [formCadence, setFormCadence] = useState('quarterly')
  const [formIntervalDays, setFormIntervalDays] = useState(90)
  const [formSeverity, setFormSeverity] = useState<'low' | 'routine' | 'high' | 'critical'>('routine')
  const [formCategory, setFormCategory] = useState('Hardware Care')
  const [formChecklist, setFormChecklist] = useState<string[]>([])
  const [newChecklistStep, setNewChecklistStep] = useState('')

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const res = await getMaintenanceRoutineTemplates()
      if (res.success && res.data) {
        setTemplates(res.data)
      } else {
        triggerToast(`❌ ${res.error || 'Failed to load templates'}`)
      }
    } catch {
      triggerToast('❌ Error loading maintenance routine templates')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTemplates()
  }, [])

  const requireEditMode = (): boolean => {
    if (!isEditModeUnlocked) {
      triggerToast('🔒 Precaution Active: Unlock "Admin Edit Mode" at the top to modify templates.')
      return false
    }
    return true
  }

  const handleOpenAddModal = () => {
    if (!requireEditMode()) return
    setEditingTemplate(null)
    setFormTitle('')
    setFormLabId('comp')
    setFormCadence('quarterly')
    setFormIntervalDays(90)
    setFormSeverity('routine')
    setFormCategory('Hardware Maintenance')
    setFormChecklist([
      'Inspect physical cables and clean dust filters',
      'Verify operating temperatures and functional status',
    ])
    setNewChecklistStep('')
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (t: MaintenanceRoutineTemplateRow) => {
    if (!requireEditMode()) return
    setEditingTemplate(t)
    setFormTitle(t.title)
    setFormLabId(t.lab_id)
    setFormCadence(t.cadence)
    setFormIntervalDays(t.interval_days)
    setFormSeverity(t.severity as any)
    setFormCategory(t.category)
    const list = Array.isArray(t.checklist)
      ? t.checklist
      : typeof t.checklist === 'string'
      ? JSON.parse(t.checklist)
      : []
    setFormChecklist(list)
    setNewChecklistStep('')
    setIsModalOpen(true)
  }

  const handleCadenceChange = (val: string) => {
    setFormCadence(val)
    const matched = CADENCE_OPTIONS.find((c) => c.value === val)
    if (matched) {
      setFormIntervalDays(matched.days)
    }
  }

  const handleAddChecklistStep = () => {
    if (!newChecklistStep.trim()) return
    setFormChecklist((prev) => [...prev, newChecklistStep.trim()])
    setNewChecklistStep('')
  }

  const handleRemoveChecklistStep = (index: number) => {
    setFormChecklist((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!requireEditMode()) return
    if (!formTitle.trim()) {
      triggerToast('⚠️ Template title is required')
      return
    }

    setIsSubmitting(true)
    try {
      const payload: MaintenanceRoutineTemplateInput = {
        id: editingTemplate ? editingTemplate.id : undefined,
        title: formTitle.trim(),
        lab_id: formLabId,
        cadence: formCadence,
        interval_days: formIntervalDays,
        severity: formSeverity,
        category: formCategory.trim() || 'General Upkeep',
        checklist: formChecklist,
      }

      const res = await saveMaintenanceRoutineTemplate(payload)
      if (res.success) {
        triggerToast(
          editingTemplate
            ? `✅ Updated template: ${formTitle}`
            : `✅ Created routine template: ${formTitle}`
        )
        setIsModalOpen(false)
        await loadTemplates()
      } else {
        triggerToast(`❌ ${res.error || 'Failed to save template'}`)
      }
    } catch {
      triggerToast('❌ Unexpected error saving template')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteTemplate = async (t: MaintenanceRoutineTemplateRow) => {
    if (!requireEditMode()) return
    if (!confirm(`Are you sure you want to retire template "${t.title}"?`)) return

    try {
      const res = await deleteMaintenanceRoutineTemplate(t.id)
      if (res.success) {
        triggerToast(`🗑️ Archived template: ${t.title}`)
        setTemplates((prev) => prev.filter((item) => item.id !== t.id))
      } else {
        triggerToast(`❌ ${res.error || 'Failed to archive template'}`)
      }
    } catch {
      triggerToast('❌ Error archiving template')
    }
  }

  const handleDeployRoutine = async (t: MaintenanceRoutineTemplateRow) => {
    if (!requireEditMode()) return
    setDeployingId(t.id)
    try {
      const checklist = Array.isArray(t.checklist)
        ? t.checklist
        : typeof t.checklist === 'string'
        ? JSON.parse(t.checklist)
        : []

      const res = await saveMaintenancePlan({
        title: t.title,
        lab_id: t.lab_id,
        category: t.category,
        interval_days: t.interval_days,
        severity: t.severity as any,
        checklist,
        target_role: 'lab_incharge',
        description: `Deployed from preset template: ${t.title} (${t.interval_days}d cycle).`,
      })

      if (res.success) {
        triggerToast(`🚀 Deployed routine to workbench: "${t.title}"`)
        if (onRoutineDeployed) onRoutineDeployed()
      } else {
        triggerToast(`❌ ${res.error || 'Failed to deploy routine'}`)
      }
    } catch {
      triggerToast('❌ Error deploying routine')
    } finally {
      setDeployingId(null)
    }
  }

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchesSearch =
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesLab = labFilter === 'all' || t.lab_id === labFilter
      return matchesSearch && matchesLab
    })
  }, [templates, searchQuery, labFilter])

  return (
    <div className="space-y-4">
      {/* Header and Quick Stats */}
      <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs overflow-hidden">
        <CardHeader className="p-4 px-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              Maintenance Routine Templates & Cadence Presets
            </CardTitle>
            <CardDescription className="text-xs text-zinc-500">
              Institutional standard maintenance templates for 1-click routine rollout across computer and science labs
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              disabled={!isEditModeUnlocked}
              onClick={handleOpenAddModal}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              title={!isEditModeUnlocked ? 'Unlock edit mode at top to add template' : undefined}
            >
              <Plus className="h-4 w-4" />
              <span>Add Template</span>
            </Button>
          </div>
        </CardHeader>

        {/* Filter Controls */}
        <div className="p-4 bg-zinc-50/30 dark:bg-zinc-900/20 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="h-3.5 w-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Search templates by title or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8.5 pl-8.5 text-xs bg-white dark:bg-zinc-900 w-full"
            />
          </div>
          <div className="w-full sm:w-auto min-w-[180px]">
            <Select
              value={labFilter}
              onChange={(e) => setLabFilter(e.target.value)}
              className="h-8.5 text-xs bg-white dark:bg-zinc-900 font-medium"
            >
              <option value="all">All Facility Types</option>
              <option value="comp">Computer Lab 01</option>
              <option value="phys">Physics Laboratory</option>
              <option value="chem">Chemistry Laboratory</option>
              <option value="bio">Biology Laboratory</option>
              <option value="elec">Electronics Laboratory</option>
            </Select>
          </div>
        </div>

        {/* Table Content */}
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-2 text-xs text-zinc-500">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
              <span>Loading routine presets...</span>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-400">
              No routine templates found matching your criteria.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 text-zinc-600 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Template Title & Category</th>
                  <th className="py-3 px-4">Target Facility</th>
                  <th className="py-3 px-4">Cadence & Cycle</th>
                  <th className="py-3 px-4">Checklist Items</th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {filteredTemplates.map((t) => {
                  const checklist = Array.isArray(t.checklist)
                    ? t.checklist
                    : typeof t.checklist === 'string'
                    ? JSON.parse(t.checklist)
                    : []

                  return (
                    <tr
                      key={t.id}
                      className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-heading font-bold text-zinc-950 dark:text-white text-xs">
                          {t.title}
                        </div>
                        <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-slate-300">
                          {t.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-zinc-700 dark:text-slate-300 font-medium">
                        {LAB_LABELS[t.lab_id] || t.lab_id.toUpperCase()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-zinc-400" />
                          <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                            {t.interval_days} Days
                          </span>
                          <span className="text-[10px] text-zinc-400 capitalize">
                            ({t.cadence.replace('_', ' ')})
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                          <ListChecks className="h-3.5 w-3.5" />
                          <span>{checklist.length} Checkpoints</span>
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            t.severity === 'critical'
                              ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                              : t.severity === 'high'
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {t.severity}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* 1-Click Deploy Routine */}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!isEditModeUnlocked || deployingId === t.id}
                            onClick={() => handleDeployRoutine(t)}
                            className="h-7 px-2.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 border-emerald-500/30 cursor-pointer disabled:opacity-40"
                            title={!isEditModeUnlocked ? 'Unlock edit mode to deploy routine' : 'Deploy as active routine to Workbench'}
                          >
                            {deployingId === t.id ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <PlayCircle className="h-3 w-3 mr-1" />
                            )}
                            Deploy
                          </Button>

                          {/* Edit Template */}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!isEditModeUnlocked}
                            onClick={() => handleOpenEditModal(t)}
                            className="h-7 px-2.5 text-xs font-semibold cursor-pointer disabled:opacity-40"
                          >
                            <Edit3 className="h-3 w-3 mr-1" />
                            Edit
                          </Button>

                          {/* Delete Template */}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!isEditModeUnlocked}
                            onClick={() => handleDeleteTemplate(t)}
                            className="h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 dark:border-rose-900/40 cursor-pointer disabled:opacity-40"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* --- ADD / EDIT TEMPLATE MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-[#101726] border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 px-6 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between bg-zinc-50/60 dark:bg-zinc-900/40">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Wrench className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-sm text-zinc-950 dark:text-white">
                    {editingTemplate ? 'Edit Routine Preset Template' : 'Create Routine Preset Template'}
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    Define reusable preventive maintenance criteria and checkpoints
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="h-7 w-7 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveTemplate} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-zinc-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Template Title *
                </label>
                <Input
                  type="text"
                  required
                  placeholder="e.g. PC Thermal Paste & Heatsink Servicing"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Designated Facility
                  </label>
                  <Select
                    value={formLabId}
                    onChange={(e) => setFormLabId(e.target.value)}
                    className="h-9 text-xs"
                  >
                    <option value="comp">Computer Lab 01</option>
                    <option value="phys">Physics Laboratory</option>
                    <option value="chem">Chemistry Laboratory</option>
                    <option value="bio">Biology Laboratory</option>
                    <option value="elec">Electronics Laboratory</option>
                    <option value="all">All Facilities</option>
                  </Select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Taxonomy Category
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. Thermal & Hardware, Safety"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Cadence Preset
                  </label>
                  <Select
                    value={formCadence}
                    onChange={(e) => handleCadenceChange(e.target.value)}
                    className="h-9 text-xs"
                  >
                    {CADENCE_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Interval Days
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={730}
                    value={formIntervalDays}
                    onChange={(e) => setFormIntervalDays(parseInt(e.target.value, 10) || 90)}
                    className="h-9 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Severity
                  </label>
                  <Select
                    value={formSeverity}
                    onChange={(e) => setFormSeverity(e.target.value as any)}
                    className="h-9 text-xs"
                  >
                    <option value="low">Low</option>
                    <option value="routine">Routine</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </Select>
                </div>
              </div>

              {/* Checklist Items Editor */}
              <div className="space-y-2 pt-1">
                <label className="block text-[11px] font-bold text-zinc-700 dark:text-slate-300 uppercase tracking-wider">
                  Checklist Inspection Steps ({formChecklist.length})
                </label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {formChecklist.map((step, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11.5px]"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span className="h-4 w-4 rounded-full bg-indigo-500/20 text-indigo-500 text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="truncate text-zinc-800 dark:text-slate-200">{step}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveChecklistStep(idx)}
                        className="text-zinc-400 hover:text-rose-500 cursor-pointer p-0.5"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add Step Input */}
                <div className="flex items-center gap-2 pt-1">
                  <Input
                    type="text"
                    placeholder="Add an inspection checkpoint (Press Enter)..."
                    value={newChecklistStep}
                    onChange={(e) => setNewChecklistStep(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddChecklistStep()
                      }
                    }}
                    className="h-8.5 text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddChecklistStep}
                    className="h-8.5 px-3 text-xs gap-1 cursor-pointer shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Step</span>
                  </Button>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="h-9 px-4 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  <span>{editingTemplate ? 'Save Template Changes' : 'Create Template'}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
