'use client'

import React, { useState } from 'react'
import {
  LayoutGrid,
  Check,
  RotateCcw,
  Sparkles,
  Grid,
  Info,
  Loader2,
  X,
  SlidersHorizontal,
  Monitor,
  Plus,
  Minus,
  HelpCircle,
  Bookmark,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  LAYOUT_PRESETS,
  type LayoutPresetType,
  type CustomRoomGridConfig,
  type LabLayoutTemplate,
} from '@/lib/workstations/layout-engine'

interface LayoutEditorBarProps {
  isSaving: boolean
  hasUnsavedChanges: boolean
  snapGrid: number
  totalWorkstations: number
  terminalScale?: number
  savedTemplates?: LabLayoutTemplate[]
  onApplyPreset: (preset: LayoutPresetType) => void
  onApplyCustomConfig?: (config: CustomRoomGridConfig, provisionMissing?: boolean) => void
  onSaveTemplate?: (name: string, config: CustomRoomGridConfig, description?: string) => Promise<boolean>
  onDeleteTemplate?: (templateId: string) => Promise<boolean>
  onToggleSnapGrid: (grid: number) => void
  onTerminalScaleChange?: (scale: number) => void
  onSave: () => Promise<void>
  onCancel: () => void
}

export function LayoutEditorBar({
  isSaving,
  hasUnsavedChanges,
  snapGrid,
  totalWorkstations,
  terminalScale = 1,
  savedTemplates = [],
  onApplyPreset,
  onApplyCustomConfig,
  onSaveTemplate,
  onDeleteTemplate,
  onToggleSnapGrid,
  onTerminalScaleChange,
  onSave,
  onCancel,
}: LayoutEditorBarProps) {
  const [selectedPreset, setSelectedPreset] = useState<string>('rows_4x8')
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false)
  const [showSnapHelp, setShowSnapHelp] = useState(false)

  // Custom Grid Builder State (flexible 1 to 4 sides, any rows and columns)
  const [customSides, setCustomSides] = useState<1 | 2 | 3 | 4>(2)
  const [customRows, setCustomRows] = useState<number>(6)
  const [customCols, setCustomCols] = useState<number>(4)
  const [customRowNaming, setCustomRowNaming] = useState<'letters' | 'numbers'>('letters')
  const [customTerminalNaming, setCustomTerminalNaming] = useState<
    'alphanumeric' | 'side_prefix' | 'sequential_pc' | 'preserve'
  >('alphanumeric')
  const [customRowNames, setCustomRowNames] = useState<Record<number, string>>({
    0: 'Row A',
    1: 'Row B',
    2: 'Row C',
    3: 'Row D',
    4: 'Row E',
    5: 'Row F',
  })
  const [isEditingRowNames, setIsEditingRowNames] = useState(false)

  // Template Saving & Loading State
  const [templateName, setTemplateName] = useState<string>('')
  const [templateDescription, setTemplateDescription] = useState<string>('')
  const [isSavingTemplate, setIsSavingTemplate] = useState<boolean>(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')

  const handleLoadTemplate = (tpl: LabLayoutTemplate) => {
    if (!tpl.config) return
    setCustomSides(tpl.config.sides || 2)
    setCustomRows(tpl.config.rows || 6)
    setCustomCols(tpl.config.columns || 4)
    setCustomRowNaming(tpl.config.rowNaming || 'letters')
    setCustomTerminalNaming(tpl.config.terminalNaming || 'alphanumeric')
    if (tpl.config.customRowNames) {
      setCustomRowNames(tpl.config.customRowNames)
    }
    setTemplateName(tpl.name)
    setTemplateDescription(tpl.description || '')
    setSelectedTemplateId(tpl.id)
  }

  const handleSaveCurrentAsTemplate = async () => {
    if (!onSaveTemplate || !templateName.trim()) return
    setIsSavingTemplate(true)
    try {
      const config: CustomRoomGridConfig = {
        sides: customSides,
        rows: customRows,
        columns: customCols,
        rowNaming: customRowNaming,
        terminalNaming: customTerminalNaming,
        customRowNames,
      }
      await onSaveTemplate(templateName.trim(), config, templateDescription.trim())
    } finally {
      setIsSavingTemplate(false)
    }
  }

  const activePresetInfo = LAYOUT_PRESETS.find((p) => p.id === selectedPreset)
  const computedTotalSlots = customSides * customRows * customCols

  const handleCustomRowChange = (index: number, val: string) => {
    setCustomRowNames((prev) => ({
      ...prev,
      [index]: val,
    }))
  }

  const handleAddRow = () => {
    if (customRows >= 16) return
    const nextIdx = customRows
    const nextChar = String.fromCharCode(65 + (nextIdx % 26))
    const defaultName = customRowNaming === 'letters' ? `Row ${nextChar}` : `Row ${nextIdx + 1}`
    setCustomRowNames((prev) => ({ ...prev, [nextIdx]: defaultName }))
    setCustomRows((prev) => prev + 1)
  }

  const handleRemoveRow = () => {
    if (customRows <= 1) return
    setCustomRows((prev) => prev - 1)
  }

  const handleApplyCustom = (provisionMissing: boolean = false) => {
    if (!onApplyCustomConfig) return
    const config: CustomRoomGridConfig = {
      sides: customSides,
      rows: customRows,
      columns: customCols,
      rowNaming: customRowNaming,
      terminalNaming: customTerminalNaming,
      customRowNames,
    }
    onApplyCustomConfig(config, provisionMissing)
    setIsCustomModalOpen(false)
  }

  return (
    <div className="rounded-2xl border border-indigo-500/30 bg-[#0B0F19] p-3 sm:p-4 shadow-xl space-y-3 animate-in fade-in duration-200">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        {/* Left: Mode Title & Info */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shadow-xs">
            <LayoutGrid className="h-4 w-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading font-extrabold text-sm text-white">
                Floor Plan Layout Editor
              </h3>
              <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[10px] font-bold">
                {totalWorkstations} Terminals
              </Badge>
              {hasUnsavedChanges && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                  Unsaved Changes
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Drag workstations on canvas, build custom room grids (e.g. Left/Right 48 PCs), or apply presets.
            </p>
          </div>
        </div>

        {/* Center/Right: Custom Builder, Presets, Scale, Snap, Save */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Custom Grid Builder Trigger */}
          <Button
            type="button"
            size="sm"
            onClick={() => setIsCustomModalOpen(true)}
            className="h-8.5 px-3 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs gap-1.5"
            title="Configure custom rows, columns, sides, and seat ID patterns"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Custom Grid</span>
          </Button>

          {/* Preset Selector */}
          <div className="flex items-center gap-1.5">
            <Select
              value={selectedPreset}
              onChange={(e) => {
                const val = e.target.value
                setSelectedPreset(val)
                if (val.startsWith('tpl_')) {
                  const tplId = val.replace('tpl_', '')
                  const found = savedTemplates.find((t) => t.id === tplId)
                  if (found) {
                    handleLoadTemplate(found)
                  }
                }
              }}
              className="h-8.5 text-xs bg-[#151E32] border-white/10 text-white rounded-xl min-w-[170px]"
            >
              <optgroup label="Standard Math Presets">
                {LAYOUT_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </optgroup>
              {savedTemplates.length > 0 && (
                <optgroup label="Saved Custom Layouts">
                  {savedTemplates.map((t) => (
                    <option key={t.id} value={`tpl_${t.id}`}>
                      ★ {t.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </Select>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (selectedPreset.startsWith('tpl_')) {
                  const tplId = selectedPreset.replace('tpl_', '')
                  const found = savedTemplates.find((t) => t.id === tplId)
                  if (found) {
                    handleLoadTemplate(found)
                    onApplyCustomConfig?.(found.config, false)
                    return
                  }
                }
                onApplyPreset(selectedPreset as LayoutPresetType)
              }}
              className="h-8.5 px-2.5 text-xs font-semibold rounded-xl border-white/10 text-slate-200 hover:bg-white/5 gap-1.5 cursor-pointer"
              title="Apply selected preset"
            >
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              <span>Apply Preset</span>
            </Button>
          </div>

          {/* Terminal Size Scale Control */}
          {onTerminalScaleChange && (
            <div className="flex items-center gap-1 bg-[#151E32] p-0.5 rounded-xl border border-white/10 text-xs text-slate-300">
              <span className="px-2 py-1 text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                <Monitor className="h-3 w-3 text-indigo-400" />
                <span>Size:</span>
              </span>
              {[
                { label: '80%', val: 0.8 },
                { label: '100%', val: 1.0 },
                { label: '120%', val: 1.2 },
              ].map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => onTerminalScaleChange(s.val)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold cursor-pointer transition-colors ${
                    terminalScale === s.val
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title={`Set terminal display size to ${s.label}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {/* Grid Snap Control with Explanatory Hint */}
          <div className="flex items-center gap-1 bg-[#151E32] p-0.5 rounded-xl border border-white/10 text-xs text-slate-300 relative">
            <button
              type="button"
              onClick={() => setShowSnapHelp(!showSnapHelp)}
              className="px-1.5 py-1 text-[10px] font-semibold text-slate-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
              title="What is Snap to Grid?"
            >
              <Grid className="h-3 w-3" />
              <span>Snap:</span>
              <HelpCircle className="h-2.5 w-2.5 text-slate-500" />
            </button>
            {[0, 2, 4].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => onToggleSnapGrid(g)}
                className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold cursor-pointer transition-colors ${
                  snapGrid === g
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title={g === 0 ? 'Disable snap (smooth free drag)' : `Snap positions to ${g}% grid lines while dragging`}
              >
                {g === 0 ? 'Off' : `${g}%`}
              </button>
            ))}

            {showSnapHelp && (
              <div className="absolute top-full mt-2 left-0 w-64 p-2.5 rounded-xl bg-[#101726] border border-indigo-500/30 shadow-2xl z-50 text-[11px] text-slate-300 leading-relaxed animate-in fade-in">
                <div className="flex items-center justify-between font-bold text-white mb-1">
                  <span>Snap to Grid</span>
                  <button type="button" onClick={() => setShowSnapHelp(false)} className="text-slate-400 hover:text-white">
                    <X className="h-3 w-3" />
                  </button>
                </div>
                Aligns workstation coordinates to 2% or 4% grid intervals when dragging on the canvas so rows and columns stay neat and straight.
              </div>
            )}
          </div>

          {/* Cancel & Save Buttons */}
          <div className="flex items-center gap-1.5 ml-auto xl:ml-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSaving}
              onClick={onCancel}
              className="h-8.5 px-3 text-xs rounded-xl border-white/10 text-slate-300 hover:bg-white/5 gap-1.5"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Cancel</span>
            </Button>

            <Button
              type="button"
              size="sm"
              disabled={isSaving || !hasUnsavedChanges}
              onClick={onSave}
              className="h-8.5 px-3 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs gap-1.5 disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              <span>Save Layout</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Preset Details Hint */}
      {activePresetInfo && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Info className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
            <span>
              <strong className="text-slate-200">{activePresetInfo.title}</strong>: {activePresetInfo.description}
            </span>
          </div>
          <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full shrink-0 hidden sm:inline-block">
            {activePresetInfo.capacityHint}
          </span>
        </div>
      )}

      {/* ============================================================= */}
      {/* CUSTOM ROOM GRID BUILDER MODAL                                */}
      {/* ============================================================= */}
      {isCustomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg rounded-2xl border border-indigo-500/30 bg-[#101726] p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <SlidersHorizontal className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="font-heading font-extrabold text-sm text-white">
                    Custom Room Grid Builder
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Define custom sides, rows, columns, and systematic terminal naming (e.g. A1..A4, C4, G3).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Grid Configuration Controls */}
            <div className="space-y-4 text-xs">
              {/* Saved Custom Layout Templates (Load / Delete) */}
              {savedTemplates.length > 0 && (
                <div className="p-2.5 rounded-xl border border-indigo-500/20 bg-indigo-500/5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                      <Bookmark className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Saved Custom Layouts ({savedTemplates.length})</span>
                    </span>
                    {selectedTemplateId && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTemplateId('')
                          setTemplateName('')
                        }}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 cursor-pointer"
                      >
                        Clear Loaded
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {savedTemplates.map((tpl) => (
                      <div
                        key={tpl.id}
                        className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all ${
                          selectedTemplateId === tpl.id
                            ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                            : 'bg-[#151E32] text-slate-300 border-white/10 hover:border-indigo-500/50 hover:text-white'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleLoadTemplate(tpl)}
                          className="cursor-pointer text-left"
                          title={tpl.description || tpl.name}
                        >
                          {tpl.name}
                        </button>
                        {onDeleteTemplate && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (confirm(`Delete saved layout template "${tpl.name}"?`)) {
                                onDeleteTemplate(tpl.id)
                              }
                            }}
                            className="text-slate-400 hover:text-rose-400 p-0.5 rounded transition-colors opacity-60 group-hover:opacity-100 cursor-pointer"
                            title={`Delete template "${tpl.name}"`}
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Room Structure: Sides / Corridor Layout */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">
                  Room Corridor Layout (Sides &amp; Aisles)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      s: 2 as const,
                      title: '2 Sides (Left & Right)',
                      desc: 'Divided by a central instructor aisle corridor',
                    },
                    {
                      s: 1 as const,
                      title: '1 Single Hall Block',
                      desc: 'Uniform continuous rows across entire room',
                    },
                    {
                      s: 3 as const,
                      title: '3 Sections (Triple Pods)',
                      desc: 'Left, Center, and Right pods with 2 walking aisles',
                    },
                    {
                      s: 4 as const,
                      title: '4 Island Pods (Quads)',
                      desc: 'Four separated modular blocks for team work',
                    },
                  ].map((opt) => (
                    <button
                      key={opt.s}
                      type="button"
                      onClick={() => setCustomSides(opt.s)}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        customSides === opt.s
                          ? 'border-indigo-500 bg-indigo-500/10 text-white ring-1 ring-indigo-500'
                          : 'border-white/10 bg-[#151E32] text-slate-300 hover:border-white/20'
                      }`}
                    >
                      <div className="font-bold flex items-center justify-between">
                        <span>{opt.title}</span>
                        {customSides === opt.s && (
                          <span className="h-2 w-2 rounded-full bg-indigo-400" />
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5 leading-tight">
                        {opt.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Rows (Front to Back) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block font-semibold text-slate-300">
                    Number of Rows (Front to Back)
                  </label>
                  <span className="text-[11px] font-mono font-bold text-indigo-400">
                    {customRows} Rows
                  </span>
                </div>

                {/* Quick Row Selection Chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setCustomRows(r)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition-all cursor-pointer ${
                        customRows === r
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-[#151E32] text-slate-400 border border-white/5 hover:text-white hover:border-white/20'
                      }`}
                    >
                      {r} {r === 1 ? 'Row' : 'Rows'}
                    </button>
                  ))}

                  <div className="flex items-center gap-1 ml-auto">
                    <button
                      type="button"
                      disabled={customRows <= 1}
                      onClick={handleRemoveRow}
                      className="h-7 w-7 rounded-lg bg-[#151E32] border border-white/10 text-slate-300 hover:text-white flex items-center justify-center disabled:opacity-40 cursor-pointer"
                      title="Decrease rows"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={16}
                      value={customRows}
                      onChange={(e) =>
                        setCustomRows(Math.max(1, Math.min(16, parseInt(e.target.value) || 1)))
                      }
                      className="w-12 h-7 rounded-lg border border-white/10 bg-[#0B0F19] text-center font-mono font-bold text-white focus:border-indigo-500 focus:outline-none text-xs"
                    />
                    <button
                      type="button"
                      disabled={customRows >= 16}
                      onClick={handleAddRow}
                      className="h-7 w-7 rounded-lg bg-[#151E32] border border-white/10 text-slate-300 hover:text-white flex items-center justify-center disabled:opacity-40 cursor-pointer"
                      title="Increase rows"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Columns per Side / Section */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block font-semibold text-slate-300">
                    Columns per Side / Section
                  </label>
                  <span className="text-[11px] font-mono font-bold text-indigo-400">
                    {customCols} PCs per row
                  </span>
                </div>

                {/* Quick Column Selection Chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[1, 2, 3, 4, 5, 6, 8].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCustomCols(c)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition-all cursor-pointer ${
                        customCols === c
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-[#151E32] text-slate-400 border border-white/5 hover:text-white hover:border-white/20'
                      }`}
                    >
                      {c} {c === 1 ? 'Col' : 'Cols'}
                    </button>
                  ))}

                  <div className="flex items-center gap-1 ml-auto">
                    <button
                      type="button"
                      disabled={customCols <= 1}
                      onClick={() => setCustomCols((prev) => Math.max(1, prev - 1))}
                      className="h-7 w-7 rounded-lg bg-[#151E32] border border-white/10 text-slate-300 hover:text-white flex items-center justify-center disabled:opacity-40 cursor-pointer"
                      title="Decrease columns"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={customCols}
                      onChange={(e) =>
                        setCustomCols(Math.max(1, Math.min(12, parseInt(e.target.value) || 1)))
                      }
                      className="w-12 h-7 rounded-lg border border-white/10 bg-[#0B0F19] text-center font-mono font-bold text-white focus:border-indigo-500 focus:outline-none text-xs"
                    />
                    <button
                      type="button"
                      disabled={customCols >= 12}
                      onClick={() => setCustomCols((prev) => Math.min(12, prev + 1))}
                      className="h-7 w-7 rounded-lg bg-[#151E32] border border-white/10 text-slate-300 hover:text-white flex items-center justify-center disabled:opacity-40 cursor-pointer"
                      title="Increase columns"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Grid Calculation Pill */}
              <div className="p-3 rounded-xl border border-indigo-500/25 bg-indigo-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-indigo-300">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-400 shrink-0" />
                  <span>
                    Total Capacity: <strong className="text-white font-mono text-sm">{computedTotalSlots} Terminals</strong> ({customSides} sections &times; {customRows} rows &times; {customCols} cols)
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge className="bg-indigo-500/20 text-indigo-300 text-[10px] font-mono">
                    {totalWorkstations} in lab
                  </Badge>
                  {computedTotalSlots > totalWorkstations ? (
                    <Badge className="bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold border-emerald-500/30">
                      {computedTotalSlots - totalWorkstations} will be provisioned
                    </Badge>
                  ) : computedTotalSlots < totalWorkstations ? (
                    <Badge className="bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold border-amber-500/30">
                      {totalWorkstations - computedTotalSlots} surplus will be archived
                    </Badge>
                  ) : (
                    <Badge className="bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold border-emerald-500/30">
                      Matches Lab Inventory
                    </Badge>
                  )}
                </div>
              </div>

              {/* Row Naming Pattern & Editor */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block font-semibold text-slate-300">
                    Row Naming Scheme
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsEditingRowNames(!isEditingRowNames)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                  >
                    {isEditingRowNames ? 'Hide Row Name Inputs' : 'Customize Row Names'}
                  </button>
                </div>

                <Select
                  value={customRowNaming}
                  onChange={(e) => setCustomRowNaming(e.target.value as any)}
                  className="w-full h-9 text-xs bg-[#151E32] border-white/10 text-white rounded-xl"
                >
                  <option value="letters">Alphabetical (Row A, Row B, Row C, Row D...)</option>
                  <option value="numbers">Numeric (Row 1, Row 2, Row 3, Row 4...)</option>
                </Select>

                {/* Optional Custom Row Labels Editor */}
                {isEditingRowNames && (
                  <div className="p-2.5 rounded-xl border border-white/10 bg-[#151E32]/70 space-y-2 mt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-300">
                        Edit Labels for All {customRows} Rows:
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleAddRow}
                          disabled={customRows >= 16}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600/50 cursor-pointer disabled:opacity-40 flex items-center gap-1"
                        >
                          <Plus className="h-3 w-3" />
                          <span>Add Row</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveRow}
                          disabled={customRows <= 1}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 hover:bg-rose-500/40 cursor-pointer disabled:opacity-40 flex items-center gap-1"
                        >
                          <Minus className="h-3 w-3" />
                          <span>Remove Row</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                      {Array.from({ length: customSides * customRows }).map((_, globalIdx) => {
                        const sideIdx = Math.floor(globalIdx / customRows)
                        const rowInSide = globalIdx % customRows
                        const defaultChar = String.fromCharCode(65 + (globalIdx % 26))
                        const defaultName =
                          customRowNaming === 'letters' ? `Row ${defaultChar}` : `Row ${globalIdx + 1}`
                        const sidePrefix =
                          customSides === 2
                            ? sideIdx === 0
                              ? 'Left'
                              : 'Right'
                            : `Sec ${sideIdx + 1}`
                        return (
                          <div key={globalIdx} className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono text-slate-400 w-11 shrink-0 truncate" title={`${sidePrefix} Row ${rowInSide + 1}`}>
                              {sidePrefix[0]}-R{rowInSide + 1}
                            </span>
                            <input
                              type="text"
                              value={customRowNames[globalIdx] ?? defaultName}
                              onChange={(e) => handleCustomRowChange(globalIdx, e.target.value)}
                              className="w-full h-7 rounded-lg border border-white/10 bg-[#0B0F19] px-2 text-[11px] text-white focus:border-indigo-500 focus:outline-none"
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Terminal ID / Place Name Scheme */}
              <div className="space-y-1">
                <label className="block font-semibold text-slate-300">
                  Terminal ID Scheme (Place Naming)
                </label>
                <Select
                  value={customTerminalNaming}
                  onChange={(e) => setCustomTerminalNaming(e.target.value as any)}
                  className="w-full h-9 text-xs bg-[#151E32] border-white/10 text-white rounded-xl"
                >
                  <option value="alphanumeric">
                    Alphanumeric Coordinates (Left: A1..A4, Right: G1..G4; Hardware: PC-01..PC-48)
                  </option>
                  <option value="side_prefix">
                    Side-Prefixed (Left: L-A1..L-A4, Right: R-G1..R-G4)
                  </option>
                  <option value="sequential_pc">
                    Sequential Standards (PC-01, PC-02, PC-03...)
                  </option>
                  <option value="preserve">
                    Preserve Existing Hardware Labels
                  </option>
                </Select>
                <p className="text-[10px] text-slate-400">
                  Separates physical hardware (PC-01..PC-48) from desk position IDs (Left: A1..A4, Right: G1..G4), enabling instant PC relocation across lab desks without breaking maintenance history.
                </p>
              </div>

              {/* Save Custom Layout with User-Defined Name */}
              <div className="p-3 rounded-xl border border-indigo-500/25 bg-indigo-500/10 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Bookmark className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Save Layout with Custom Name</span>
                  </label>
                  {selectedTemplateId && (
                    <span className="text-[10px] text-indigo-300 font-mono font-semibold">
                      Loaded: {templateName}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Main Lab 48-PC (2-Side), Class 12 Exam Layout, Workshop 3-Pod"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="flex-1 h-8 rounded-lg border border-white/10 bg-[#0B0F19] px-2.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={!templateName.trim() || isSavingTemplate}
                    onClick={handleSaveCurrentAsTemplate}
                    className="h-8 px-3 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shrink-0 gap-1.5 cursor-pointer disabled:opacity-40"
                    title="Save this layout configuration with this custom name"
                  >
                    {isSavingTemplate ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Bookmark className="h-3.5 w-3.5" />
                    )}
                    <span>Save Layout</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-white/[0.08]">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCustomModalOpen(false)}
                className="h-8.5 text-xs rounded-xl border-white/10 text-slate-300 hover:bg-white/5"
              >
                Cancel
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleApplyCustom(false)}
                  className="h-8.5 px-3 text-xs font-semibold rounded-xl border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 gap-1.5 cursor-pointer"
                  title="Arrange current lab terminals to this custom grid without adding new machines"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Preview on Canvas</span>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleApplyCustom(true)}
                  className="h-8.5 px-3.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs gap-1.5 cursor-pointer"
                  title="Provision missing stations to match exact grid capacity and arrange everything"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Provision &amp; Apply ({computedTotalSlots} PCs)</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
