'use client'

import React, { useState, useMemo } from 'react'
import {
  AlertTriangle,
  Plus,
  Edit3,
  Trash2,
  RotateCcw,
  ShieldAlert,
  Search,
  CheckCircle2,
  Archive,
  Eye,
  EyeOff,
  Filter,
} from 'lucide-react'
import { IncidentCategoryItem, LabFacilityItem } from '@/hooks/use-infrastructure-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

interface IncidentCategoriesManagerProps {
  categories: IncidentCategoryItem[]
  isEditModeUnlocked: boolean
  onAddCategory: (cat: IncidentCategoryItem) => void
  onUpdateCategory: (id: string, updates: Partial<IncidentCategoryItem>) => void
  onDeleteCategory: (id: string) => void
  onDeactivateCategory: (id: string) => void
  onResetCategories: () => void
  labs: LabFacilityItem[]
  historicalIncidents?: Array<{ id: string; incident_type?: string; title?: string }>
  triggerToast: (msg: string) => void
}

export function IncidentCategoriesManager({
  categories,
  isEditModeUnlocked,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onDeactivateCategory,
  onResetCategories,
  labs,
  historicalIncidents = [],
  triggerToast,
}: IncidentCategoriesManagerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [labFilter, setLabFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('all')

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<IncidentCategoryItem | null>(null)
  const [formName, setFormName] = useState('')
  const [formCode, setFormCode] = useState('')
  const [formSeverity, setFormSeverity] = useState<'minor' | 'moderate' | 'major_critical'>('moderate')
  const [formTargetLab, setFormTargetLab] = useState<string>('all')
  const [formDescription, setFormDescription] = useState('')

  // Confirmation / Safety Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    description: string
    isReferenced: boolean
    referenceCount: number
    onConfirm: () => void
  }>({
    isOpen: false,
    title: '',
    description: '',
    isReferenced: false,
    referenceCount: 0,
    onConfirm: () => {},
  })

  // Filtered categories
  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const match =
          cat.name.toLowerCase().includes(q) ||
          cat.code.toLowerCase().includes(q) ||
          cat.description.toLowerCase().includes(q)
        if (!match) return false
      }

      // Lab filter
      if (labFilter !== 'all') {
        const target = cat.targetLab || 'all'
        if (target !== 'all' && target !== labFilter) return false
      }

      // Status filter
      const isActive = cat.is_active !== false
      if (statusFilter === 'active' && !isActive) return false
      if (statusFilter === 'archived' && isActive) return false

      return true
    })
  }, [categories, searchQuery, labFilter, statusFilter])

  // Open modal for new category
  const handleOpenAdd = () => {
    setEditingCategory(null)
    setFormName('')
    setFormCode('')
    setFormSeverity('moderate')
    setFormTargetLab('all')
    setFormDescription('')
    setIsModalOpen(true)
  }

  // Open modal for editing category
  const handleOpenEdit = (cat: IncidentCategoryItem) => {
    setEditingCategory(cat)
    setFormName(cat.name)
    setFormCode(cat.code)
    setFormSeverity(cat.severity)
    setFormTargetLab(cat.targetLab || 'all')
    setFormDescription(cat.description)
    setIsModalOpen(true)
  }

  // Save (create or update)
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isEditModeUnlocked) return

    const sanitizedCode = formCode.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')

    if (editingCategory) {
      onUpdateCategory(editingCategory.id, {
        name: formName.trim(),
        code: sanitizedCode || editingCategory.code,
        severity: formSeverity,
        targetLab: formTargetLab as any,
        description: formDescription.trim(),
      })
      triggerToast(`Classification "${formName.trim()}" updated.`)
    } else {
      const newCat: IncidentCategoryItem = {
        id: `cat-${Date.now()}`,
        name: formName.trim(),
        code: sanitizedCode || `cat_${Date.now()}`,
        severity: formSeverity,
        targetLab: formTargetLab as any,
        description: formDescription.trim(),
        is_active: true,
      }
      onAddCategory(newCat)
      triggerToast(`New incident classification "${formName.trim()}" registered.`)
    }

    setIsModalOpen(false)
    setEditingCategory(null)
  }

  // Safe delete with referential integrity protection
  const handleDeleteRequest = (cat: IncidentCategoryItem) => {
    if (!isEditModeUnlocked) return

    // Check if category is referenced in historical incidents
    const references = historicalIncidents.filter(
      (inc) => inc.incident_type === cat.code || inc.incident_type === cat.id
    )

    if (references.length > 0) {
      // Referential integrity guard: Soft-delete / Archive instead of destructive hard delete
      setConfirmDialog({
        isOpen: true,
        title: `Archive Category: ${cat.name}`,
        description: `This classification is linked to ${references.length} historical incident audit record(s). To protect historical records and reporting integrity, this classification will be Archived (soft-deleted). It will not appear in future reporting forms, but past logs will retain their original classification.`,
        isReferenced: true,
        referenceCount: references.length,
        onConfirm: () => {
          onDeactivateCategory(cat.id)
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
          triggerToast(`Category "${cat.name}" has been archived to preserve historical audits.`)
        },
      })
    } else {
      // No historical references: Safe to permanently delete
      setConfirmDialog({
        isOpen: true,
        title: `Remove Category: ${cat.name}`,
        description: `Are you sure you want to permanently delete "${cat.name}"? This classification has 0 active references in past incident records.`,
        isReferenced: false,
        referenceCount: 0,
        onConfirm: () => {
          onDeleteCategory(cat.id)
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
          triggerToast(`Category "${cat.name}" removed permanently.`)
        },
      })
    }
  }

  // Toggle active/inactive state
  const handleToggleActive = (cat: IncidentCategoryItem) => {
    if (!isEditModeUnlocked) return
    const newStatus = cat.is_active === false ? true : false
    onUpdateCategory(cat.id, { is_active: newStatus })
    triggerToast(
      `Classification "${cat.name}" is now ${newStatus ? 'Active' : 'Archived / Inactive'}.`
    )
  }

  return (
    <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs overflow-hidden">
      <CardHeader className="p-4 px-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <CardTitle className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            Incident & Safety Classifications
          </CardTitle>
          <CardDescription className="text-xs text-zinc-500 mt-0.5">
            Institutional classifications for equipment breakage, laboratory hazards, and emergency SOP thresholds
          </CardDescription>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!isEditModeUnlocked}
            onClick={() => {
              if (window.confirm('Reset all classifications to official institutional safety defaults?')) {
                onResetCategories()
                triggerToast('Incident classifications reset to official institutional defaults.')
              }
            }}
            className="text-xs h-8 gap-1.5 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5 text-zinc-500" />
            <span>Reset to Defaults</span>
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={!isEditModeUnlocked}
            onClick={handleOpenAdd}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs h-8 gap-1.5 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Add Category</span>
          </Button>
        </div>
      </CardHeader>

      {/* Filter and Search Bar */}
      <div className="p-3 px-5 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/30 dark:bg-zinc-900/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
          <Input
            placeholder="Search classifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs font-sans"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1 text-zinc-500 text-[11px] font-medium shrink-0">
            <Filter className="h-3 w-3" />
            <span>Lab:</span>
          </div>
          <Select
            value={labFilter}
            onChange={(e) => setLabFilter(e.target.value)}
            className="h-8 text-xs font-sans w-36"
          >
            <option value="all">All Labs</option>
            {labs.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>

          <div className="flex items-center gap-1 text-zinc-500 text-[11px] font-medium shrink-0 ml-1">
            <span>Status:</span>
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="h-8 text-xs font-sans w-28"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </Select>
        </div>
      </div>

      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 text-zinc-600 dark:text-zinc-400 font-bold uppercase text-[10.5px]">
              <th className="py-3 px-4">Category Name & Code</th>
              <th className="py-3 px-4">Default Urgency</th>
              <th className="py-3 px-4">Target Lab</th>
              <th className="py-3 px-4">Operating Protocol / Description</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {filteredCategories.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                  No incident classifications found matching the current filters.
                </td>
              </tr>
            ) : (
              filteredCategories.map((c) => {
                const isActive = c.is_active !== false
                const targetLabName =
                  c.targetLab && c.targetLab !== 'all'
                    ? labs.find((l) => l.id === c.targetLab)?.name || c.targetLab.toUpperCase()
                    : 'ALL LABORATORIES'

                return (
                  <tr
                    key={c.id}
                    className={`hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors ${
                      !isActive ? 'opacity-60 bg-zinc-50/40 dark:bg-zinc-900/20' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-zinc-950 dark:text-white text-xs">{c.name}</div>
                      <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                        {c.code}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          c.severity === 'major_critical'
                            ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30'
                            : c.severity === 'moderate'
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                            : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30'
                        }`}
                      >
                        {c.severity === 'major_critical' && <AlertTriangle className="h-3 w-3" />}
                        {c.severity.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono text-[10.5px] font-semibold">
                        {targetLabName}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-zinc-600 dark:text-zinc-300 text-xs max-w-xs truncate">
                      {c.description}
                    </td>
                    <td className="py-3 px-4">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500">
                          <Archive className="h-3.5 w-3.5" />
                          Archived
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!isEditModeUnlocked}
                          onClick={() => handleOpenEdit(c)}
                          className="h-7 px-2.5 text-xs font-semibold cursor-pointer"
                        >
                          <Edit3 className="h-3 w-3 mr-1" />
                          Edit
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!isEditModeUnlocked}
                          onClick={() => handleToggleActive(c)}
                          title={isActive ? 'Archive classification' : 'Reactivate classification'}
                          className="h-7 px-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                        >
                          {isActive ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!isEditModeUnlocked}
                          onClick={() => handleDeleteRequest(c)}
                          className="h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-900/50 cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </CardContent>

      {/* --- ADD / EDIT CATEGORY MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 select-none font-sans">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-indigo-500" />
                <span>
                  {editingCategory ? `Edit Classification: ${editingCategory.name}` : 'Register Safety Classification'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false)
                  setEditingCategory(null)
                }}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-zinc-700 dark:text-zinc-300">Category Name *</label>
                <Input
                  required
                  placeholder="e.g. Optical Lens Damage"
                  value={formName}
                  onChange={(e) => {
                    setFormName(e.target.value)
                    if (!editingCategory && !formCode) {
                      setFormCode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_'))
                    }
                  }}
                  className="h-8.5 text-xs font-sans"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-zinc-700 dark:text-zinc-300">Classification Code *</label>
                <Input
                  required
                  placeholder="e.g. lens_damage"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  className="h-8.5 text-xs font-mono"
                />
                <span className="text-[10.5px] text-zinc-400">
                  Standard identifier used in incident audit records (letters, numbers, underscores).
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-zinc-700 dark:text-zinc-300">Default Urgency Tier</label>
                  <Select
                    value={formSeverity}
                    onChange={(e) => setFormSeverity(e.target.value as any)}
                    className="h-8.5 text-xs font-sans"
                  >
                    <option value="minor">Minor (Low / Standard)</option>
                    <option value="moderate">Moderate (Interrupted Session)</option>
                    <option value="major_critical">Major Critical (Immediate HOD Alert)</option>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-zinc-700 dark:text-zinc-300">Designated Facility Scope</label>
                  <Select
                    value={formTargetLab}
                    onChange={(e) => setFormTargetLab(e.target.value)}
                    className="h-8.5 text-xs font-sans"
                  >
                    <option value="all">All Laboratories</option>
                    {labs.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-zinc-700 dark:text-zinc-300">
                  Standard Operating Protocol (SOP) & Description
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe the incident scenario and first-response instructions for teachers / lab assistants..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2 text-xs font-sans focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsModalOpen(false)
                    setEditingCategory(null)
                  }}
                  className="text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer"
                >
                  {editingCategory ? 'Update Classification' : 'Save Classification'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- CONFIRMATION & REFERENTIAL INTEGRITY MODAL --- */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 select-none font-sans">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div
                className={`p-2.5 rounded-xl ${
                  confirmDialog.isReferenced
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                }`}
              >
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div className="space-y-1 flex-1">
                <h3 className="text-sm font-bold text-zinc-950 dark:text-white">{confirmDialog.title}</h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {confirmDialog.description}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
                className="text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={confirmDialog.onConfirm}
                className={`font-bold text-xs cursor-pointer ${
                  confirmDialog.isReferenced
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-rose-600 hover:bg-rose-700 text-white'
                }`}
              >
                {confirmDialog.isReferenced ? 'Archive Classification' : 'Delete Permanently'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
