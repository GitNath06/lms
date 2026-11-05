'use client'

import React, { useState, useEffect } from 'react'
import {
  Wrench,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Layers,
  ArrowUp,
  ArrowDown,
  Check,
  X,
  Loader2,
  Monitor,
  Cpu,
  Wifi,
  Mouse,
  HelpCircle,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import {
  getIssueCategories,
  manageIssueCategory,
  reorderIssueCategories,
} from '@/app/actions/workstations'
import type { IssueCategoryRow } from '@/types/database'
import type { IssueCategoryInput } from '@/types/workstations'

interface WorkstationFaultCategoriesManagerProps {
  isEditModeUnlocked: boolean
  triggerToast: (msg: string) => void
}

const COLOR_PRESETS = [
  '#EF4444', // Red
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#6366F1', // Indigo
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#64748B', // Slate
]

const TYPE_ICONS: Record<string, React.ReactNode> = {
  hardware: <Cpu className="h-3.5 w-3.5" />,
  software: <Monitor className="h-3.5 w-3.5" />,
  network: <Wifi className="h-3.5 w-3.5" />,
  peripheral: <Mouse className="h-3.5 w-3.5" />,
  other: <HelpCircle className="h-3.5 w-3.5" />,
}

export function WorkstationFaultCategoriesManager({
  isEditModeUnlocked,
  triggerToast,
}: WorkstationFaultCategoriesManagerProps) {
  const [categories, setCategories] = useState<IssueCategoryRow[]>([])
  const [loading, setLoading] = useState(true)

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<IssueCategoryRow | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form State
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState<'hardware' | 'software' | 'network' | 'peripheral' | 'other'>('hardware')
  const [formColor, setFormColor] = useState('#6366F1')
  const [formSeverity, setFormSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium')
  const [formSortOrder, setFormSortOrder] = useState(1)

  const loadCategories = async () => {
    setLoading(true)
    try {
      const res = await getIssueCategories()
      if (res.success && res.data) {
        setCategories(res.data)
      } else {
        triggerToast(`❌ ${res.error || 'Failed to load categories'}`)
      }
    } catch {
      triggerToast('❌ Error loading issue categories')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCategories()
  }, [])

  const requireEditMode = (): boolean => {
    if (!isEditModeUnlocked) {
      triggerToast('🔒 Precaution Active: Unlock "Admin Edit Mode" at the top to modify fault categories.')
      return false
    }
    return true
  }

  const handleOpenAddModal = () => {
    if (!requireEditMode()) return
    setEditingCategory(null)
    setFormName('')
    setFormType('hardware')
    setFormColor('#6366F1')
    setFormSeverity('medium')
    setFormSortOrder(categories.length + 1)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (cat: IssueCategoryRow) => {
    if (!requireEditMode()) return
    setEditingCategory(cat)
    setFormName(cat.name)
    setFormType(cat.type)
    setFormColor(cat.color)
    setFormSeverity(cat.default_severity)
    setFormSortOrder(cat.sort_order)
    setIsModalOpen(true)
  }

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!requireEditMode()) return
    if (!formName.trim()) {
      triggerToast('⚠️ Category name is required')
      return
    }

    setIsSubmitting(true)
    try {
      const payload: IssueCategoryInput = {
        name: formName.trim(),
        type: formType,
        color: formColor,
        icon: 'AlertTriangle',
        default_severity: formSeverity,
        sort_order: formSortOrder,
      }

      if (editingCategory) {
        payload.id = editingCategory.id
        const res = await manageIssueCategory('update', payload)
        if (res.success) {
          triggerToast(`✅ Updated fault category: ${formName}`)
          setIsModalOpen(false)
          await loadCategories()
        } else {
          triggerToast(`❌ ${res.error || 'Failed to update category'}`)
        }
      } else {
        const res = await manageIssueCategory('create', payload)
        if (res.success) {
          triggerToast(`✅ Added fault category: ${formName}`)
          setIsModalOpen(false)
          await loadCategories()
        } else {
          triggerToast(`❌ ${res.error || 'Failed to create category'}`)
        }
      }
    } catch {
      triggerToast('❌ Error saving category')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteCategory = async (cat: IssueCategoryRow) => {
    if (!requireEditMode()) return
    if (
      !confirm(
        `Are you sure you want to retire category "${cat.name}"? If past issue records exist, it will be safely soft-archived.`
      )
    ) {
      return
    }

    try {
      const res = await manageIssueCategory('delete', {
        id: cat.id,
        name: cat.name,
        type: cat.type,
        color: cat.color,
        icon: cat.icon,
        default_severity: cat.default_severity,
      })
      if (res.success) {
        triggerToast(`🗑️ Category retired: ${cat.name}`)
        setCategories((prev) => prev.filter((c) => c.id !== cat.id))
      } else {
        triggerToast(`❌ ${res.error || 'Failed to delete category'}`)
      }
    } catch {
      triggerToast('❌ Error deleting category')
    }
  }

  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    if (!requireEditMode()) return
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= categories.length) return

    const newCategories = [...categories]
    const temp = newCategories[index]
    newCategories[index] = newCategories[targetIndex]
    newCategories[targetIndex] = temp

    // Re-assign 1..N order
    const updates = newCategories.map((c, idx) => ({ id: c.id, sort_order: idx + 1 }))
    setCategories(newCategories.map((c, idx) => ({ ...c, sort_order: idx + 1 })))

    const res = await reorderIssueCategories(updates)
    if (res.success) {
      triggerToast('✅ Updated category display order')
    } else {
      triggerToast(`❌ ${res.error || 'Failed to reorder'}`)
      await loadCategories()
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs overflow-hidden">
        <CardHeader className="p-4 px-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              Workstation Fault Categories & Diagnostic Taxonomy
            </CardTitle>
            <CardDescription className="text-xs text-zinc-500">
              Configurable fault categories, color coding, and default urgency levels shown to teachers and lab staff
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              disabled={!isEditModeUnlocked}
              onClick={handleOpenAddModal}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              title={!isEditModeUnlocked ? 'Unlock edit mode at top to add category' : undefined}
            >
              <Plus className="h-4 w-4" />
              <span>Add Fault Category</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-2 text-xs text-zinc-500">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
              <span>Loading workstation fault categories...</span>
            </div>
          ) : categories.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-400">
              No workstation fault categories registered.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 text-zinc-600 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Category Name</th>
                  <th className="py-3 px-4">Domain Type</th>
                  <th className="py-3 px-4">Color Tag</th>
                  <th className="py-3 px-4">Default Urgency</th>
                  <th className="py-3 px-4 text-center w-24">Order</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {categories.map((cat, idx) => (
                  <tr
                    key={cat.id}
                    className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 text-center font-mono font-bold text-zinc-400 text-xs">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full shrink-0 shadow-xs"
                          style={{ backgroundColor: cat.color || '#6366F1' }}
                        />
                        <span className="font-heading font-bold text-zinc-950 dark:text-white text-xs">
                          {cat.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-slate-300 capitalize">
                        {TYPE_ICONS[cat.type] || <Cpu className="h-3.5 w-3.5" />}
                        <span>{cat.type}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-zinc-500">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-3.5 w-3.5 rounded border border-black/10 shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span>{cat.color}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          cat.default_severity === 'critical'
                            ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                            : cat.default_severity === 'high'
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                            : cat.default_severity === 'medium'
                            ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30'
                            : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {cat.default_severity}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          disabled={!isEditModeUnlocked || idx === 0}
                          onClick={() => handleMoveOrder(idx, 'up')}
                          className="h-6 w-6 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 disabled:opacity-20 cursor-pointer flex items-center justify-center transition-colors"
                          title="Move up"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          disabled={!isEditModeUnlocked || idx === categories.length - 1}
                          onClick={() => handleMoveOrder(idx, 'down')}
                          className="h-6 w-6 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 disabled:opacity-20 cursor-pointer flex items-center justify-center transition-colors"
                          title="Move down"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!isEditModeUnlocked}
                          onClick={() => handleOpenEditModal(cat)}
                          className="h-7 px-2.5 text-xs font-semibold cursor-pointer disabled:opacity-40"
                        >
                          <Edit3 className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!isEditModeUnlocked}
                          onClick={() => handleDeleteCategory(cat)}
                          className="h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 dark:border-rose-900/40 cursor-pointer disabled:opacity-40"
                          title="Soft-archive category"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* --- ADD / EDIT FAULT CATEGORY MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#101726] border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 px-6 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between bg-zinc-50/60 dark:bg-zinc-900/40">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Layers className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-sm text-zinc-950 dark:text-white">
                    {editingCategory ? 'Edit Workstation Category' : 'New Fault Category'}
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    Define diagnostic classification for lab terminals
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
            <form onSubmit={handleSaveCategory} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-zinc-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Category Name *
                </label>
                <Input
                  type="text"
                  required
                  placeholder="e.g. GPU Display Artifacts, Power Surge"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Domain Type
                  </label>
                  <Select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    className="h-9 text-xs"
                  >
                    <option value="hardware">Hardware</option>
                    <option value="software">Software</option>
                    <option value="network">Network</option>
                    <option value="peripheral">Peripheral</option>
                    <option value="other">Other</option>
                  </Select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Default Severity
                  </label>
                  <Select
                    value={formSeverity}
                    onChange={(e) => setFormSeverity(e.target.value as any)}
                    className="h-9 text-xs"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </Select>
                </div>
              </div>

              {/* Color Swatch Picker */}
              <div>
                <label className="block text-[11px] font-bold text-zinc-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Color Tag Accent
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {COLOR_PRESETS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormColor(color)}
                      className={`h-7 w-7 rounded-full transition-transform cursor-pointer flex items-center justify-center border-2 ${
                        formColor === color ? 'border-zinc-950 dark:border-white scale-110 shadow-sm' : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    >
                      {formColor === color && <Check className="h-3.5 w-3.5 text-white drop-shadow-sm" />}
                    </button>
                  ))}
                  <Input
                    type="text"
                    value={formColor}
                    onChange={(e) => setFormColor(e.target.value)}
                    className="h-7 w-24 text-[11px] font-mono ml-auto"
                    placeholder="#6366F1"
                  />
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
                  <span>{editingCategory ? 'Save Changes' : 'Create Category'}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
