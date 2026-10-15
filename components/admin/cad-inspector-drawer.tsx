'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  Monitor,
  Trash2,
  Check,
  AlertTriangle,
  Wrench,
  RotateCw,
  Plus,
  Minus,
  Laptop,
  Server,
  Layers,
  MapPin,
  Tag,
  ShieldAlert,
  Loader2,
  ExternalLink,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import type { WorkstationWithIssues } from '@/types/workstations'
import type { LabFloorElementRow } from '@/types/database'
import { FLOOR_ELEMENT_CATALOG } from '@/lib/floor-elements'

interface CadInspectorDrawerProps {
  workstation: WorkstationWithIssues | null
  landmark: LabFloorElementRow | null
  isOpen: boolean
  isPrivileged: boolean
  onClose: () => void
  onUpdateWorkstation: (updated: {
    id: string
    label: string
    row_label?: string | null
    position_id?: string | null
    device_type: 'desktop' | 'aio' | 'laptop' | 'server'
    pos_x: number
    pos_y: number
  }) => Promise<boolean>
  onDeleteWorkstation: (id: string) => Promise<{ success: boolean; error?: string }>
  onUpdateLandmark: (updated: LabFloorElementRow) => void
  onDeleteLandmark: (id: string) => void
  onRotateLandmark: (landmark: LabFloorElementRow) => void
}

export function CadInspectorDrawer({
  workstation,
  landmark,
  isOpen,
  isPrivileged,
  onClose,
  onUpdateWorkstation,
  onDeleteWorkstation,
  onUpdateLandmark,
  onDeleteLandmark,
  onRotateLandmark,
}: CadInspectorDrawerProps) {
  // Local state for workstation form
  const [wsLabel, setWsLabel] = useState('')
  const [wsRowLabel, setWsRowLabel] = useState('')
  const [wsPositionId, setWsPositionId] = useState('')
  const [wsDeviceType, setWsDeviceType] = useState<'desktop' | 'aio' | 'laptop' | 'server'>('desktop')
  const [wsPosX, setWsPosX] = useState(50)
  const [wsPosY, setWsPosY] = useState(50)

  // Local state for landmark form
  const [lmLabel, setLmLabel] = useState('')
  const [lmType, setLmType] = useState('whiteboard')
  const [lmPosX, setLmPosX] = useState(50)
  const [lmPosY, setLmPosY] = useState(50)
  const [lmWidth, setLmWidth] = useState(12)
  const [lmHeight, setLmHeight] = useState(4)
  const [lmRotation, setLmRotation] = useState(0)

  // Submitting & confirmation state
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  // Sync state whenever selected workstation changes
  useEffect(() => {
    if (workstation) {
      setWsLabel(workstation.label)
      setWsRowLabel(workstation.row_label || '')
      setWsPositionId((workstation as any).position_id || '')
      setWsDeviceType((workstation.device_type as any) || 'desktop')
      setWsPosX(workstation.pos_x)
      setWsPosY(workstation.pos_y)
      setShowDeleteConfirm(false)
      setActionError(null)
      setActionSuccess(null)
    }
  }, [workstation])

  // Sync state whenever selected landmark changes
  useEffect(() => {
    if (landmark) {
      setLmLabel(landmark.label)
      setLmType(landmark.element_type)
      setLmPosX(landmark.pos_x)
      setLmPosY(landmark.pos_y)
      setLmWidth(landmark.width || 12)
      setLmHeight(landmark.height || 4)
      setLmRotation(landmark.rotation || 0)
      setShowDeleteConfirm(false)
      setActionError(null)
      setActionSuccess(null)
    }
  }, [landmark])

  if (!isOpen || (!workstation && !landmark)) {
    return null
  }

  // Workstation Update Handler
  const handleSaveWorkstation = async () => {
    if (!workstation || !isPrivileged) return
    setIsUpdating(true)
    setActionError(null)
    setActionSuccess(null)

    try {
      const ok = await onUpdateWorkstation({
        id: workstation.id,
        label: wsLabel.trim(),
        row_label: wsRowLabel.trim() || null,
        position_id: wsPositionId.trim() || null,
        device_type: wsDeviceType,
        pos_x: wsPosX,
        pos_y: wsPosY,
      })

      if (ok) {
        setActionSuccess('Station properties updated.')
        setTimeout(() => setActionSuccess(null), 2500)
      } else {
        setActionError('Failed to update station properties.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Update failed'
      setActionError(msg)
    } finally {
      setIsUpdating(false)
    }
  }

  // Workstation Delete Handler (Smart Deletion Guard)
  const handleDeleteWorkstation = async () => {
    if (!workstation || !isPrivileged) return
    setIsDeleting(true)
    setActionError(null)

    try {
      const res = await onDeleteWorkstation(workstation.id)
      if (res.success) {
        setShowDeleteConfirm(false)
        onClose()
      } else {
        setActionError(res.error || 'Failed to remove workstation.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Deletion failed'
      setActionError(msg)
    } finally {
      setIsDeleting(false)
    }
  }

  // Landmark Update Handler
  const handleSaveLandmark = () => {
    if (!landmark || !isPrivileged) return
    onUpdateLandmark({
      ...landmark,
      label: lmLabel.trim(),
      element_type: lmType,
      pos_x: lmPosX,
      pos_y: lmPosY,
      width: lmWidth,
      height: lmHeight,
      rotation: lmRotation as 0 | 90 | 180 | 270,
    })
    setActionSuccess('Landmark updated.')
    setTimeout(() => setActionSuccess(null), 2000)
  }

  const stepCoord = (val: number, delta: number, setter: (n: number) => void) => {
    const next = Math.max(2, Math.min(98, Math.round((val + delta) * 10) / 10))
    setter(next)
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />
      <aside className="fixed top-0 right-0 h-full w-96 max-w-[90vw] z-50 bg-[#101726] border-l border-white/10 shadow-2xl flex flex-col font-sans animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#0B0F19]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            {workstation ? <Monitor className="h-4 w-4" /> : <Tag className="h-4 w-4" />}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-heading font-extrabold text-sm text-white">
                {workstation ? workstation.label : landmark?.label}
              </h3>
              <Badge className="bg-white/10 text-slate-300 text-[10px] font-mono border-white/10">
                {workstation ? workstation.device_type.toUpperCase() : 'LANDMARK'}
              </Badge>
            </div>
            <p className="text-[11px] text-slate-400">
              {workstation ? 'Hardware Node Inspector' : 'Architectural Landmark Inspector'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          title="Close Inspector"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs text-slate-300">
        {/* Precaution Safety Lock Notice */}
        {!isPrivileged && (
          <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
            <div className="text-[11px] leading-relaxed">
              <strong>Precaution Active (Read-Only)</strong>: Unlock Edit Mode in the Admin Console header to calibrate coordinates, change properties, or delete hardware.
            </div>
          </div>
        )}

        {/* Feedback Messages */}
        {actionError && (
          <div className="p-2.5 rounded-xl border border-rose-500/40 bg-rose-950/30 text-rose-300 flex items-start gap-2 text-[11px]">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-rose-400" />
            <span>{actionError}</span>
          </div>
        )}
        {actionSuccess && (
          <div className="p-2.5 rounded-xl border border-emerald-500/40 bg-emerald-950/30 text-emerald-300 flex items-center gap-2 text-[11px]">
            <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* ============================================================== */}
        {/* CASE A: WORKSTATION INSPECTION                                 */}
        {/* ============================================================== */}
        {workstation && (
          <>
            {/* Diagnostic Status Pill & Issues */}
            <div className="p-3 rounded-xl border border-white/5 bg-[#151E32] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-300">Operational Health:</span>
                {workstation.status === 'operational' ? (
                  <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px] font-bold">
                    Operational
                  </Badge>
                ) : workstation.status === 'under_repair' ? (
                  <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[10px] font-bold animate-pulse">
                    Under Repair
                  </Badge>
                ) : (
                  <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px] font-bold">
                    Flagged ({workstation.open_issues_count} open)
                  </Badge>
                )}
              </div>

              {workstation.active_issues && workstation.active_issues.length > 0 && (
                <div className="pt-2 border-t border-white/5 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Active Fault Tickets:
                  </span>
                  {workstation.active_issues.map((iss) => (
                    <div
                      key={iss.id}
                      className="p-1.5 rounded-lg bg-black/30 border border-white/5 text-[11px] flex items-center justify-between"
                    >
                      <span className="truncate pr-2 text-slate-200">{iss.title}</span>
                      <Badge className="bg-amber-500/20 text-amber-300 text-[9px] shrink-0">
                        {iss.severity}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              {/* Direct Link to Maintenance Workbench */}
              <div className="pt-2 border-t border-white/5">
                <Link
                  href={`/maintenance?search=${encodeURIComponent(workstation.label)}`}
                  target="_blank"
                  className="block"
                >
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-8.5 rounded-xl border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold text-xs gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <Wrench className="h-3.5 w-3.5 text-amber-400" />
                    <span>Open Maintenance Workbench</span>
                    <ExternalLink className="h-3 w-3 ml-auto text-amber-400/70" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Editable Attributes */}
            <div className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Hardware Terminal Label
                </label>
                <input
                  type="text"
                  value={wsLabel}
                  disabled={!isPrivileged}
                  onChange={(e) => setWsLabel(e.target.value)}
                  className="w-full h-8.5 rounded-xl border border-white/10 bg-[#0B0F19] px-3 font-mono font-bold text-white focus:border-indigo-500 focus:outline-none disabled:opacity-60"
                  placeholder="e.g. PC-07"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Row Label
                  </label>
                  <input
                    type="text"
                    value={wsRowLabel}
                    disabled={!isPrivileged}
                    onChange={(e) => setWsRowLabel(e.target.value.replace(/\b\w/g, (c) => c.toUpperCase()))}
                    className="w-full h-8.5 rounded-xl border border-white/10 bg-[#0B0F19] px-3 text-slate-200 focus:border-indigo-500 focus:outline-none disabled:opacity-60"
                    placeholder="e.g. Row A"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Desk Position ID
                  </label>
                  <input
                    type="text"
                    value={wsPositionId}
                    disabled={!isPrivileged}
                    onChange={(e) => setWsPositionId(e.target.value.toUpperCase())}
                    className="w-full h-8.5 rounded-xl border border-white/10 bg-[#0B0F19] px-3 font-mono uppercase text-slate-200 focus:border-indigo-500 focus:outline-none disabled:opacity-60"
                    placeholder="e.g. A1, F4"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Hardware Device Type
                </label>
                <Select
                  value={wsDeviceType}
                  disabled={!isPrivileged}
                  onChange={(e) => setWsDeviceType(e.target.value as any)}
                  className="w-full h-8.5 bg-[#0B0F19] border-white/10 text-white rounded-xl text-xs disabled:opacity-60"
                >
                  <option value="desktop">Desktop Workstation (Tower + Display)</option>
                  <option value="aio">All-In-One Terminal (Integrated PC)</option>
                  <option value="laptop">Portable Laptop Desk</option>
                  <option value="server">Server / Master Host Terminal</option>
                </Select>
              </div>

              {/* Exact Normalized CAD Coordinates */}
              <div className="p-3 rounded-xl border border-white/10 bg-[#151E32] space-y-2.5">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-indigo-400" />
                  <span>CAD Floor Coordinates</span>
                </span>

                {/* X Stepper */}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-slate-400 w-16">X Coord:</span>
                  <div className="flex items-center gap-1 flex-1">
                    <button
                      type="button"
                      disabled={!isPrivileged || wsPosX <= 2}
                      onClick={() => stepCoord(wsPosX, -1, setWsPosX)}
                      className="h-7 w-7 rounded-lg bg-[#0B0F19] border border-white/10 text-slate-300 hover:text-white flex items-center justify-center disabled:opacity-40 cursor-pointer"
                      title="Step left by 1%"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <input
                      type="number"
                      step={0.5}
                      min={0}
                      max={100}
                      value={wsPosX}
                      disabled={!isPrivileged}
                      onChange={(e) => setWsPosX(parseFloat(e.target.value) || 0)}
                      className="flex-1 h-7 rounded-lg border border-white/10 bg-[#0B0F19] text-center font-mono font-bold text-white text-xs disabled:opacity-60"
                    />
                    <button
                      type="button"
                      disabled={!isPrivileged || wsPosX >= 98}
                      onClick={() => stepCoord(wsPosX, 1, setWsPosX)}
                      className="h-7 w-7 rounded-lg bg-[#0B0F19] border border-white/10 text-slate-300 hover:text-white flex items-center justify-center disabled:opacity-40 cursor-pointer"
                      title="Step right by 1%"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <span className="text-slate-400 font-mono text-[11px] w-6">%</span>
                  </div>
                </div>

                {/* Y Stepper */}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-slate-400 w-16">Y Coord:</span>
                  <div className="flex items-center gap-1 flex-1">
                    <button
                      type="button"
                      disabled={!isPrivileged || wsPosY <= 2}
                      onClick={() => stepCoord(wsPosY, -1, setWsPosY)}
                      className="h-7 w-7 rounded-lg bg-[#0B0F19] border border-white/10 text-slate-300 hover:text-white flex items-center justify-center disabled:opacity-40 cursor-pointer"
                      title="Step up by 1%"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <input
                      type="number"
                      step={0.5}
                      min={0}
                      max={100}
                      value={wsPosY}
                      disabled={!isPrivileged}
                      onChange={(e) => setWsPosY(parseFloat(e.target.value) || 0)}
                      className="flex-1 h-7 rounded-lg border border-white/10 bg-[#0B0F19] text-center font-mono font-bold text-white text-xs disabled:opacity-60"
                    />
                    <button
                      type="button"
                      disabled={!isPrivileged || wsPosY >= 98}
                      onClick={() => stepCoord(wsPosY, 1, setWsPosY)}
                      className="h-7 w-7 rounded-lg bg-[#0B0F19] border border-white/10 text-slate-300 hover:text-white flex items-center justify-center disabled:opacity-40 cursor-pointer"
                      title="Step down by 1%"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <span className="text-slate-400 font-mono text-[11px] w-6">%</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={!isPrivileged || isUpdating}
                  onClick={handleSaveWorkstation}
                  className="w-full h-8.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isUpdating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  <span>Apply Node Changes</span>
                </Button>

                {/* Smart Deletion Guard UI */}
                {!showDeleteConfirm ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!isPrivileged}
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full h-8.5 rounded-xl border-rose-500/30 text-rose-300 hover:bg-rose-500/10 hover:border-rose-500/50 gap-1.5 cursor-pointer disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Remove Workstation</span>
                  </Button>
                ) : (
                  <div className="p-3 rounded-xl border border-rose-500/40 bg-rose-950/30 space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-start gap-2 text-rose-200">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                      <div className="text-[11px] leading-tight">
                        <strong>Confirm Removal of {workstation.label}?</strong>
                        <p className="text-slate-400 mt-1 text-[10px]">
                          Smart Deletion Guard will clean up seat assignments. Will be rejected if unresolved tickets exist.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isDeleting}
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 h-7.5 text-[11px] rounded-lg border-white/10 text-slate-300"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={isDeleting}
                        onClick={handleDeleteWorkstation}
                        className="flex-1 h-7.5 text-[11px] font-bold rounded-lg bg-rose-600 hover:bg-rose-500 text-white gap-1"
                      >
                        {isDeleting ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                        <span>Confirm Delete</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ============================================================== */}
        {/* CASE B: LANDMARK INSPECTION                                    */}
        {/* ============================================================== */}
        {landmark && (
          <div className="space-y-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Landmark Label
              </label>
              <input
                type="text"
                value={lmLabel}
                disabled={!isPrivileged}
                onChange={(e) => setLmLabel(e.target.value)}
                className="w-full h-8.5 rounded-xl border border-white/10 bg-[#0B0F19] px-3 text-slate-200 focus:border-indigo-500 focus:outline-none disabled:opacity-60"
                placeholder="e.g. Interactive Whiteboard"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Landmark Category
              </label>
              <Select
                value={lmType}
                disabled={!isPrivileged}
                onChange={(e) => setLmType(e.target.value)}
                className="w-full h-8.5 bg-[#0B0F19] border-white/10 text-white rounded-xl text-xs disabled:opacity-60"
              >
                {Object.entries(FLOOR_ELEMENT_CATALOG).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
              </Select>
            </div>

            {/* Coordinates & Dimensions */}
            <div className="p-3 rounded-xl border border-white/10 bg-[#151E32] space-y-2.5">
              <span className="font-bold text-white flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-indigo-400" />
                <span>Placement &amp; Geometry</span>
              </span>

              {/* X Coordinate */}
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-slate-400 w-16">X Coord:</span>
                <div className="flex items-center gap-1 flex-1">
                  <button
                    type="button"
                    disabled={!isPrivileged || lmPosX <= 2}
                    onClick={() => stepCoord(lmPosX, -1, setLmPosX)}
                    className="h-7 w-7 rounded-lg bg-[#0B0F19] border border-white/10 text-slate-300 hover:text-white flex items-center justify-center disabled:opacity-40 cursor-pointer"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <input
                    type="number"
                    step={0.5}
                    value={lmPosX}
                    disabled={!isPrivileged}
                    onChange={(e) => setLmPosX(parseFloat(e.target.value) || 0)}
                    className="flex-1 h-7 rounded-lg border border-white/10 bg-[#0B0F19] text-center font-mono font-bold text-white text-xs disabled:opacity-60"
                  />
                  <button
                    type="button"
                    disabled={!isPrivileged || lmPosX >= 98}
                    onClick={() => stepCoord(lmPosX, 1, setLmPosX)}
                    className="h-7 w-7 rounded-lg bg-[#0B0F19] border border-white/10 text-slate-300 hover:text-white flex items-center justify-center disabled:opacity-40 cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <span className="text-slate-400 font-mono text-[11px] w-6">%</span>
                </div>
              </div>

              {/* Y Coordinate */}
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-slate-400 w-16">Y Coord:</span>
                <div className="flex items-center gap-1 flex-1">
                  <button
                    type="button"
                    disabled={!isPrivileged || lmPosY <= 2}
                    onClick={() => stepCoord(lmPosY, -1, setLmPosY)}
                    className="h-7 w-7 rounded-lg bg-[#0B0F19] border border-white/10 text-slate-300 hover:text-white flex items-center justify-center disabled:opacity-40 cursor-pointer"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <input
                    type="number"
                    step={0.5}
                    value={lmPosY}
                    disabled={!isPrivileged}
                    onChange={(e) => setLmPosY(parseFloat(e.target.value) || 0)}
                    className="flex-1 h-7 rounded-lg border border-white/10 bg-[#0B0F19] text-center font-mono font-bold text-white text-xs disabled:opacity-60"
                  />
                  <button
                    type="button"
                    disabled={!isPrivileged || lmPosY >= 98}
                    onClick={() => stepCoord(lmPosY, 1, setLmPosY)}
                    className="h-7 w-7 rounded-lg bg-[#0B0F19] border border-white/10 text-slate-300 hover:text-white flex items-center justify-center disabled:opacity-40 cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <span className="text-slate-400 font-mono text-[11px] w-6">%</span>
                </div>
              </div>

              {/* Rotation Stepper */}
              <div className="flex items-center justify-between pt-1">
                <span className="font-semibold text-slate-300">Rotation Angle:</span>
                <div className="flex items-center gap-1">
                  {[0, 90, 180, 270].map((deg) => (
                    <button
                      key={deg}
                      type="button"
                      disabled={!isPrivileged}
                      onClick={() => setLmRotation(deg)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold cursor-pointer transition-colors ${
                        lmRotation === deg
                          ? 'bg-indigo-600 text-white'
                          : 'bg-[#0B0F19] text-slate-400 hover:text-white'
                      }`}
                    >
                      {deg}°
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={!isPrivileged}
                    onClick={() => {
                      const next = (((lmRotation || 0) + 90) % 360) as any
                      setLmRotation(next)
                      onRotateLandmark({ ...landmark, rotation: next })
                    }}
                    className="p-1.5 rounded-lg bg-[#0B0F19] border border-white/10 text-slate-300 hover:text-white cursor-pointer ml-1"
                    title="Rotate 90 degrees clockwise"
                  >
                    <RotateCw className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 space-y-2">
              <Button
                type="button"
                size="sm"
                disabled={!isPrivileged}
                onClick={handleSaveLandmark}
                className="w-full h-8.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-1.5 shadow-xs cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Save Landmark Changes</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!isPrivileged}
                onClick={() => {
                  if (confirm(`Remove landmark "${landmark.label}"?`)) {
                    onDeleteLandmark(landmark.id)
                    onClose()
                  }
                }}
                className="w-full h-8.5 rounded-xl border-rose-500/30 text-rose-300 hover:bg-rose-500/10 gap-1.5 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Landmark</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </aside>
  </>
)
}
