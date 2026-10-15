'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  Lock,
  Unlock,
  Save,
  Plus,
  RefreshCw,
  Loader2,
  Tv,
  CheckCircle2,
  ShieldAlert,
  Wrench,
  Sparkles,
  Layers,
  MapPin,
} from 'lucide-react'
import { WorkstationNode } from './workstation-node'
import { FloorLandmarkNode } from './floor-landmark-node'
import {
  updateWorkstationPositions,
  createWorkstation,
} from '@/app/actions/workstations'
import {
  saveLabFloorElements,
  deleteLabFloorElement,
} from '@/app/actions/floor-elements'
import type {
  WorkstationWithIssues,
  UpdateWorkstationPositionInput,
} from '@/types/workstations'
import type { IssueCategoryRow, LabFloorElementRow } from '@/types/database'
import { FLOOR_ELEMENT_CATALOG } from '@/lib/floor-elements'
import { LabDeskStructureOverlay } from '@/components/computer-lab/lab-desk-structure-overlay'

interface WorkstationFloorPlanProps {
  workstations: WorkstationWithIssues[]
  categories?: IssueCategoryRow[]
  floorElements?: LabFloorElementRow[]
  labId: string
  labName: string
  isPrivileged: boolean
  isSeatPlanMode?: boolean
  selectedWorkstationId?: string | null
  onSelectWorkstation: (ws: WorkstationWithIssues) => void
  onRefreshData: () => void
}

export function WorkstationFloorPlan({
  workstations,
  categories = [],
  floorElements = [],
  labId,
  labName,
  isPrivileged,
  isSeatPlanMode = false,
  selectedWorkstationId,
  onSelectWorkstation,
  onRefreshData,
}: WorkstationFloorPlanProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [localWorkstations, setLocalWorkstations] = useState<WorkstationWithIssues[]>(workstations)
  const [localFloorElements, setLocalFloorElements] = useState<LabFloorElementRow[]>(floorElements)
  const [isLayoutMode, setIsLayoutMode] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [savingPositions, setSavingPositions] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  // Dragging state for Workstations
  const draggingIdRef = useRef<string | null>(null)

  // Add Workstation Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newRow, setNewRow] = useState('Row A')
  const [newDeviceType, setNewDeviceType] = useState<'desktop' | 'aio' | 'laptop' | 'server'>('desktop')
  const [addingStation, setAddingStation] = useState(false)

  // Add Landmark Modal State
  const [isAddLandmarkOpen, setIsAddLandmarkOpen] = useState(false)
  const [selectedLandmarkType, setSelectedLandmarkType] = useState('whiteboard')
  const [newLandmarkLabel, setNewLandmarkLabel] = useState('Interactive Whiteboard')

  // Sync when parent workstations or floor elements change (if not currently editing layout)
  useEffect(() => {
    if (!hasUnsavedChanges) {
      setLocalWorkstations(workstations)
    }
  }, [workstations, hasUnsavedChanges])

  useEffect(() => {
    if (!hasUnsavedChanges) {
      setLocalFloorElements(floorElements)
    }
  }, [floorElements, hasUnsavedChanges])

  // Workstation Drag Handler
  const handleDragStart = useCallback(
    (e: React.PointerEvent, ws: WorkstationWithIssues) => {
      if (!isLayoutMode || !isPrivileged) return
      e.preventDefault()
      e.stopPropagation()

      draggingIdRef.current = ws.id

      const handlePointerMove = (moveEvent: PointerEvent) => {
        if (!canvasRef.current || !draggingIdRef.current) return

        const rect = canvasRef.current.getBoundingClientRect()
        const rawX = ((moveEvent.clientX - rect.left) / rect.width) * 100
        const rawY = ((moveEvent.clientY - rect.top) / rect.height) * 100

        // Snap to 2% grid increments and clamp inside walls (4% to 96%)
        const snappedX = Math.round(rawX / 2) * 2
        const snappedY = Math.round(rawY / 2) * 2
        const clampedX = Math.max(4, Math.min(96, snappedX))
        const clampedY = Math.max(6, Math.min(94, snappedY))

        setLocalWorkstations((prev) =>
          prev.map((item) =>
            item.id === draggingIdRef.current
              ? { ...item, pos_x: clampedX, pos_y: clampedY }
              : item
          )
        )
        setHasUnsavedChanges(true)
      }

      const handlePointerUp = () => {
        draggingIdRef.current = null
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', handlePointerUp)
      }

      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
    },
    [isLayoutMode, isPrivileged]
  )

  // Landmark Drag Handler
  const handleDragLandmarkStart = useCallback(
    (e: React.PointerEvent, el: LabFloorElementRow) => {
      if (!isLayoutMode || !isPrivileged) return
      e.preventDefault()
      e.stopPropagation()

      const targetId = el.id

      const handlePointerMove = (moveEvent: PointerEvent) => {
        if (!canvasRef.current) return

        const rect = canvasRef.current.getBoundingClientRect()
        const rawX = ((moveEvent.clientX - rect.left) / rect.width) * 100
        const rawY = ((moveEvent.clientY - rect.top) / rect.height) * 100

        const snappedX = Math.round(rawX / 2) * 2
        const snappedY = Math.round(rawY / 2) * 2
        const clampedX = Math.max(2, Math.min(98, snappedX))
        const clampedY = Math.max(2, Math.min(98, snappedY))

        setLocalFloorElements((prev) =>
          prev.map((item) =>
            item.id === targetId ? { ...item, pos_x: clampedX, pos_y: clampedY } : item
          )
        )
        setHasUnsavedChanges(true)
      }

      const handlePointerUp = () => {
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', handlePointerUp)
      }

      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
    },
    [isLayoutMode, isPrivileged]
  )

  // Landmark Rotate Handler (90 deg)
  const handleRotateLandmark = (el: LabFloorElementRow) => {
    setLocalFloorElements((prev) =>
      prev.map((item) =>
        item.id === el.id
          ? { ...item, rotation: (((item.rotation || 0) + 90) % 360) as any }
          : item
      )
    )
    setHasUnsavedChanges(true)
  }

  // Landmark Delete Handler
  const handleDeleteLandmark = (el: LabFloorElementRow) => {
    setLocalFloorElements((prev) => prev.filter((item) => item.id !== el.id))
    setHasUnsavedChanges(true)
  }

  // Save Layout Positions (Workstations + Landmarks)
  const handleSavePositions = async () => {
    setSavingPositions(true)
    setSaveMessage(null)

    const wsPayload: UpdateWorkstationPositionInput[] = localWorkstations.map((ws) => ({
      id: ws.id,
      pos_x: ws.pos_x,
      pos_y: ws.pos_y,
    }))

    const landmarkPayload = localFloorElements.map((el) => ({
      id: el.id,
      lab_id: labId,
      element_type: el.element_type,
      label: el.label,
      pos_x: el.pos_x,
      pos_y: el.pos_y,
      width: el.width || 12.0,
      height: el.height || 4.0,
      rotation: (el.rotation || 0) as 0 | 90 | 180 | 270,
      is_active: el.is_active,
    }))

    try {
      const [wsRes, elRes] = await Promise.all([
        updateWorkstationPositions(wsPayload),
        saveLabFloorElements(labId, landmarkPayload),
      ])

      if (!wsRes.success) throw new Error(wsRes.error || 'Failed to save workstation positions.')
      if (!elRes.success) throw new Error(elRes.error || 'Failed to save floor landmarks.')

      setHasUnsavedChanges(false)
      setSaveMessage('Physical room layout saved successfully.')
      setTimeout(() => setSaveMessage(null), 2500)
      onRefreshData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      setSaveMessage(`Error: ${msg}`)
    } finally {
      setSavingPositions(false)
    }
  }

  // Reset to Prop Positions
  const handleDiscardChanges = () => {
    setLocalWorkstations(workstations)
    setLocalFloorElements(floorElements)
    setHasUnsavedChanges(false)
    setSaveMessage(null)
  }

  // Create New Workstation
  const handleCreateWorkstation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLabel.trim()) return

    setAddingStation(true)
    try {
      const res = await createWorkstation({
        lab_id: labId,
        label: newLabel.trim(),
        row_label: newRow.trim() || null,
        pos_x: 50.0,
        pos_y: 50.0,
        device_type: newDeviceType,
      })

      if (!res.success) {
        throw new Error(res.error || 'Failed to create workstation.')
      }

      setIsAddModalOpen(false)
      setNewLabel('')
      onRefreshData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error adding workstation')
    } finally {
      setAddingStation(false)
    }
  }

  // Add Landmark from Catalog
  const handleAddLandmark = (e: React.FormEvent) => {
    e.preventDefault()
    const def = FLOOR_ELEMENT_CATALOG[selectedLandmarkType] || {
      defaultWidth: 12.0,
      defaultHeight: 4.0,
    }

    const newElement: LabFloorElementRow = {
      id: `temp-${Date.now()}`,
      lab_id: labId,
      element_type: selectedLandmarkType,
      label: newLandmarkLabel.trim() || 'Room Landmark',
      pos_x: 50.0,
      pos_y: 12.0,
      width: def.defaultWidth,
      height: def.defaultHeight,
      rotation: 0,
      metadata: {},
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    setLocalFloorElements((prev) => [...prev, newElement])
    setHasUnsavedChanges(true)
    setIsAddLandmarkOpen(false)
  }

  return (
    <div className="space-y-3">
      {/* Floor Plan Canvas Toolbar & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 rounded-xl border border-white/[0.08] bg-[#101726] p-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-heading font-extrabold text-sm text-white">
            {labName} Floor Canvas
          </span>

          <span className="font-mono text-[11px] text-slate-400">
            ({localWorkstations.length} Active Workstations &bull; {localFloorElements.length} Landmarks)
          </span>

          {saveMessage && (
            <span
              className={`rounded-lg px-2.5 py-0.5 text-xs font-semibold ${
                saveMessage.startsWith('Error')
                  ? 'bg-rose-500/20 text-rose-300'
                  : 'bg-emerald-500/20 text-emerald-300'
              }`}
            >
              {saveMessage}
            </span>
          )}
        </div>

        {/* Action Controls & Layout Mode Toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          {isPrivileged && (
            <>
              {isLayoutMode ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/20 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add PC</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsAddLandmarkOpen(true)}
                    className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    <span>Add Landmark</span>
                  </button>

                  {hasUnsavedChanges && (
                    <button
                      type="button"
                      onClick={handleDiscardChanges}
                      className="rounded-xl border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                    >
                      Discard
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={!hasUnsavedChanges || savingPositions}
                    onClick={handleSavePositions}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 shadow-md transition-all disabled:opacity-50"
                  >
                    {savingPositions ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    <span>Save Layout</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (hasUnsavedChanges) {
                        if (confirm('Discard unsaved layout changes?')) {
                          handleDiscardChanges()
                          setIsLayoutMode(false)
                        }
                      } else {
                        setIsLayoutMode(false)
                      }
                    }}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    <span>Exit Layout Mode</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsLayoutMode(true)}
                  className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-[#151E32] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-indigo-500/40 hover:text-indigo-300 transition-colors"
                >
                  <Unlock className="h-3.5 w-3.5" />
                  <span>Arrange Physical Layout</span>
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={onRefreshData}
            className="rounded-xl border border-white/[0.08] bg-[#151E32] p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Refresh floor telemetry"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Interactive 16:9 Floor Plan Canvas Container */}
      <div
        ref={canvasRef}
        className="relative w-full aspect-[16/9] min-h-[380px] sm:min-h-[480px] rounded-2xl border border-white/[0.08] bg-[#0B0F19] overflow-hidden select-none shadow-2xl"
        style={{
          backgroundImage: `
            radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.03) 0%, transparent 80%),
            linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 32px 32px, 32px 32px',
        }}
      >
        {/* Real-Life Architectural Desk Tables & Corridor Structures */}
        <LabDeskStructureOverlay />

        {/* Physical Floor Landmarks (Data-Driven from public.lab_floor_elements) */}
        {localFloorElements.map((el) => (
          <FloorLandmarkNode
            key={el.id}
            element={el}
            isLayoutMode={isLayoutMode}
            onDragStart={handleDragLandmarkStart}
            onRotate={handleRotateLandmark}
            onDelete={handleDeleteLandmark}
          />
        ))}

        {/* Layout Editing Notice Overlay Banner */}
        {isLayoutMode && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-xl border border-amber-500/50 bg-amber-950/80 px-4 py-1.5 text-xs font-medium text-amber-200 shadow-xl backdrop-blur-md animate-pulse">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <span>Layout Mode Active: Drag workstations or physical room landmarks to mirror actual desks</span>
          </div>
        )}

        {/* Render Workstation Nodes */}
        {localWorkstations.map((ws) => (
          <WorkstationNode
            key={ws.id}
            workstation={ws}
            isLayoutMode={isLayoutMode}
            isSeatPlanMode={isSeatPlanMode}
            isSelected={selectedWorkstationId === ws.id}
            onDragStart={handleDragStart}
            onClick={() => onSelectWorkstation(ws)}
          />
        ))}
      </div>

      {/* Visual Status Legend Bar */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-[#101726] p-3 text-xs text-slate-300 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            <span>Operational (Ready)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_#f43f5e]" />
            <span>Issue Reported / Flagged</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-400 shadow-[0_0_8px_#60a5fa]" />
            <span>Under Repair / Service</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-400" />
            <span>Teacher Desk / Landmarks</span>
          </div>
        </div>

        <div className="text-[11px] text-slate-500">
          Tip: Tap any PC node to inspect active tickets or snap camera evidence
        </div>
      </div>

      {/* Modal: Add New Workstation Node */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#101726] p-5 shadow-2xl">
            <h4 className="font-heading font-bold text-base text-white mb-3">
              Add New Physical Workstation
            </h4>
            <form onSubmit={handleCreateWorkstation} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300">Station Identifier / Label *</label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. PC-33 or Server-01"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-[#151E32] px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Row / Section</label>
                <input
                  type="text"
                  value={newRow}
                  onChange={(e) => setNewRow(e.target.value)}
                  placeholder="e.g. Row D, Teacher Station, or Rack 1"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-[#151E32] px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Device Hardware Profile</label>
                <select
                  value={newDeviceType}
                  onChange={(e) => setNewDeviceType(e.target.value as any)}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-[#151E32] px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none cursor-pointer"
                >
                  <option value="desktop">Standard Desktop Tower</option>
                  <option value="aio">All-In-One (AIO)</option>
                  <option value="laptop">Portable Lab Laptop</option>
                  <option value="server">Lab Host / Edge Server</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingStation}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 shadow-md transition-all disabled:opacity-50"
                >
                  {addingStation && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Add Workstation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add New Floor Landmark */}
      {isAddLandmarkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#101726] p-5 shadow-2xl">
            <h4 className="font-heading font-bold text-base text-white mb-3">
              Add Room Landmark / Landmark
            </h4>
            <form onSubmit={handleAddLandmark} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300">Landmark Type</label>
                <select
                  value={selectedLandmarkType}
                  onChange={(e) => {
                    const t = e.target.value
                    setSelectedLandmarkType(t)
                    setNewLandmarkLabel(FLOOR_ELEMENT_CATALOG[t]?.label || 'Room Landmark')
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-[#151E32] px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none cursor-pointer"
                >
                  <option value="whiteboard">Interactive Whiteboard</option>
                  <option value="projector_screen">Projector Screen</option>
                  <option value="teacher_desk">Teacher Podium / Console</option>
                  <option value="door">Entrance Door</option>
                  <option value="window">Ventilation Window</option>
                  <option value="pillar">Concrete Pillar</option>
                  <option value="storage_rack">Hardware Storage Rack</option>
                  <option value="network_rack">Network Server Rack</option>
                  <option value="fire_extinguisher">Fire Extinguisher Station</option>
                  <option value="custom_label">Custom Floor Marker</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Display Label *</label>
                <input
                  type="text"
                  value={newLandmarkLabel}
                  onChange={(e) => setNewLandmarkLabel(e.target.value)}
                  placeholder="e.g. Front Whiteboard, Emergency Exit"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-[#151E32] px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddLandmarkOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 shadow-md transition-all"
                >
                  <span>Place Landmark on Floor</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
