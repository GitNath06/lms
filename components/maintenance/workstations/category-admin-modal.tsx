'use client'

import React, { useState } from 'react'
import {
  X,
  Plus,
  Edit2,
  Trash2,
  Check,
  Loader2,
  Layers,
} from 'lucide-react'
import { manageIssueCategory } from '@/app/actions/workstations'
import type { IssueCategoryRow } from '@/types/database'
import type { IssueCategoryInput } from '@/types/workstations'

interface CategoryAdminModalProps {
  categories: IssueCategoryRow[]
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
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

export function CategoryAdminModal({
  categories,
  isOpen,
  onClose,
  onSuccess,
}: CategoryAdminModalProps) {
  const [editingCat, setEditingCat] = useState<IssueCategoryRow | null>(null)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Form State
  const [name, setName] = useState('')
  const [type, setType] = useState<'hardware' | 'software' | 'network' | 'peripheral' | 'other'>('hardware')
  const [color, setColor] = useState('#6366F1')
  const [defaultSeverity, setDefaultSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium')
  const [sortOrder, setSortOrder] = useState(0)

  if (!isOpen) return null

  const startCreate = () => {
    setEditingCat(null)
    setName('')
    setType('hardware')
    setColor('#6366F1')
    setDefaultSeverity('medium')
    setSortOrder(categories.length + 1)
    setIsCreatingNew(true)
    setErrorMessage(null)
  }

  const startEdit = (cat: IssueCategoryRow) => {
    setIsCreatingNew(false)
    setEditingCat(cat)
    setName(cat.name)
    setType(cat.type)
    setColor(cat.color)
    setDefaultSeverity(cat.default_severity)
    setSortOrder(cat.sort_order)
    setErrorMessage(null)
  }

  const cancelEdit = () => {
    setEditingCat(null)
    setIsCreatingNew(false)
    setErrorMessage(null)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setErrorMessage('Category name is required.')
      return
    }

    setSubmitting(true)
    setErrorMessage(null)

    try {
      const payload: IssueCategoryInput = {
        name: name.trim(),
        type,
        color,
        icon: 'AlertTriangle',
        default_severity: defaultSeverity,
        sort_order: sortOrder,
      }

      if (isCreatingNew) {
        const res = await manageIssueCategory('create', payload)
        if (!res.success) throw new Error(res.error || 'Failed to create category.')
      } else if (editingCat) {
        payload.id = editingCat.id
        const res = await manageIssueCategory('update', payload)
        if (!res.success) throw new Error(res.error || 'Failed to update category.')
      }

      cancelEdit()
      onSuccess()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      setErrorMessage(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (cat: IssueCategoryRow) => {
    if (!confirm(`Are you sure you want to retire category "${cat.name}"? If historical issues exist, it will be safely archived.`)) {
      return
    }

    setSubmitting(true)
    setErrorMessage(null)

    try {
      const res = await manageIssueCategory('delete', {
        id: cat.id,
        name: cat.name,
        type: cat.type,
        color: cat.color,
        icon: cat.icon,
        default_severity: cat.default_severity,
      })
      if (!res.success) throw new Error(res.error || 'Failed to delete category.')
      onSuccess()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete failed'
      setErrorMessage(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-white/[0.08] bg-[#101726] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#151E32]/70 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-base text-white">
                Workstation Issue Taxonomy
              </h3>
              <p className="text-xs text-slate-400">
                Manage hardware, software, network, and peripheral diagnostic classifications
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/[0.08] p-2 text-slate-400 hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {errorMessage && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
              {errorMessage}
            </div>
          )}

          {/* Form for Create / Edit */}
          {(isCreatingNew || editingCat) && (
            <form onSubmit={handleSave} className="rounded-xl border border-indigo-500/30 bg-[#151E32] p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                <h4 className="font-heading font-semibold text-xs text-indigo-300">
                  {isCreatingNew ? 'Create New Category' : `Edit: ${editingCat?.name}`}
                </h4>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Category Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. BIOS Battery Dead"
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-[#0E1524] px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300">Classification Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-[#0E1524] px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="hardware">Hardware Component</option>
                    <option value="software">Software / Operating System</option>
                    <option value="network">Network / LAN / Wi-Fi</option>
                    <option value="peripheral">Peripheral (Mouse/Keyboard/Display)</option>
                    <option value="other">Other Incident</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300">Default Severity</label>
                  <select
                    value={defaultSeverity}
                    onChange={(e) => setDefaultSeverity(e.target.value as any)}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-[#0E1524] px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="low">Low (Minor Glitch)</option>
                    <option value="medium">Medium (Impaired Usage)</option>
                    <option value="high">High (Station Down)</option>
                    <option value="critical">Critical (Hazard / Circuit Short)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300">Color Tag</label>
                  <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                    {COLOR_PRESETS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        style={{ backgroundColor: c }}
                        className={`h-6 w-6 rounded-full border-2 transition-transform ${
                          color === c ? 'scale-110 border-white shadow-md' : 'border-transparent hover:scale-105'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow hover:bg-indigo-500 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  <span>{isCreatingNew ? 'Create Category' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Action Bar */}
          {!isCreatingNew && !editingCat && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">
                {categories.length} Registered Categories
              </span>
              <button
                type="button"
                onClick={startCreate}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-500 active:scale-95"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Category</span>
              </button>
            </div>
          )}

          {/* Categories List */}
          <div className="space-y-2">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-[#151E32] p-3 transition-colors hover:border-slate-600"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.color || '#6366F1' }}
                  />
                  <div>
                    <h5 className="font-heading font-semibold text-xs text-white">
                      {cat.name}
                    </h5>
                    <div className="flex items-center gap-2 pt-0.5">
                      <span className="text-[10px] text-slate-400 capitalize">
                        {cat.type}
                      </span>
                      <span className="text-[10px] text-slate-600">•</span>
                      <span className="text-[10px] uppercase font-bold text-slate-400">
                        Default: {cat.default_severity}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(cat)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-indigo-400"
                    title="Edit category"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(cat)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-rose-400"
                    title="Delete category"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
