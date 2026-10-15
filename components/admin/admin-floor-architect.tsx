'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  Monitor,
  Layers,
  Sparkles,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Building2,
  Loader2,
  SlidersHorizontal,
  Grid,
  Check,
  RotateCcw,
  Plus,
  Minus,
  X,
  HelpCircle,
  Bookmark,
  Trash2,
  AlertTriangle,
  Info,
  Search,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { WorkstationNode } from '@/components/maintenance/workstations/workstation-node'
import { FloorLandmarkNode } from '@/components/maintenance/workstations/floor-landmark-node'
import { CanvasControlsHud } from '@/components/computer-lab/canvas-controls-hud'
import { CanvasMinimapRadar } from '@/components/computer-lab/canvas-minimap-radar'
import { CadInspectorDrawer } from './cad-inspector-drawer'
import { useCanvasViewport } from '@/hooks/use-canvas-viewport'
import {
  getWorkstationBoardData,
  updateWorkstationPositions,
  batchUpdateWorkstationPositions,
  provisionCustomGridWorkstations,
  applyAutoArrangementLayout,
  getCustomLayoutTemplates,
  saveCustomLayoutTemplate,
  deleteCustomLayoutTemplate,
  createWorkstation,
  updateWorkstation,
  deleteWorkstation,
} from '@/app/actions/workstations'
import {
  getLabFloorElements,
  saveLabFloorElements,
  deleteLabFloorElement,
} from '@/app/actions/floor-elements'
import {
  LAYOUT_PRESETS,
  calculateAutoArrangement,
  calculateCustomRoomLayout,
  generateRoomGridSlots,
  snapCoordinate,
  type LayoutPresetType,
  type CustomRoomGridConfig,
  type LabLayoutTemplate,
  type CustomRoomGridSlot,
} from '@/lib/workstations/layout-engine'
import { FLOOR_ELEMENT_CATALOG } from '@/lib/floor-elements'
import type { WorkstationBoardData, WorkstationWithIssues } from '@/types/workstations'
import type { LabFloorElementRow } from '@/types/database'

interface AdminFloorArchitectProps {
  isEditModeUnlocked: boolean
}

const LAB_OPTIONS = [
  { id: 'comp', name: 'Computer Lab 01', type: 'computer_lab' },
  { id: 'phys', name: 'Physics Laboratory', type: 'physics_lab' },
  { id: 'chem', name: 'Chemistry Laboratory', type: 'chemistry_lab' },
  { id: 'bio', name: 'Biology Laboratory', type: 'biology_lab' },
]

function areWorkstationsMatching(
  a: WorkstationWithIssues[],
  b: WorkstationWithIssues[]
): boolean {
  if (a.length !== b.length) return false
  const bMap = new Map(b.map((w) => [w.id, w]))
  for (const wa of a) {
    const wb = bMap.get(wa.id)
    if (!wb) return false
    if (
      Math.abs(wa.pos_x - wb.pos_x) > 0.5 ||
      Math.abs(wa.pos_y - wb.pos_y) > 0.5 ||
      wa.label !== wb.label ||
      (wa.row_label || '') !== (wb.row_label || '') ||
      ((wa as any).position_id || '') !== ((wb as any).position_id || '')
    ) {
      return false
    }
  }
  return true
}

export default function AdminFloorArchitect({
  isEditModeUnlocked,
}: AdminFloorArchitectProps) {
  const [selectedLabId, setSelectedLabId] = useState<string>('comp')
  const [boardData, setBoardData] = useState<WorkstationBoardData | null>(null)
  const [localWorkstations, setLocalWorkstations] = useState<WorkstationWithIssues[]>([])
  const [localFloorElements, setLocalFloorElements] = useState<LabFloorElementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveToast, setSaveToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Interactive Viewport Controls (Pan & Zoom)
  const viewport = useCanvasViewport({
    minZoom: 0.5,
    maxZoom: 1.6,
    defaultZoom: 1.0,
  })

  // Minimap visibility
  const [isMinimapVisible, setIsMinimapVisible] = useState(false)
  const [containerDimensions, setContainerDimensions] = useState({ width: 1200, height: 750 })

  // 1. Data Loader
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [bData, fData, tplRes] = await Promise.all([
        getWorkstationBoardData(selectedLabId),
        getLabFloorElements(selectedLabId),
        getCustomLayoutTemplates(selectedLabId),
      ])
      setBoardData(bData)
      setLocalWorkstations(bData.workstations)
      if (fData.success && fData.data) {
        setLocalFloorElements(fData.data)
      } else {
        setLocalFloorElements([])
      }
      if (tplRes.success && tplRes.templates) {
        setSavedTemplates(tplRes.templates)
      }
      setHasUnsavedChanges(false)
    } catch (err) {
      console.error('Error loading floor architect data:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedLabId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Track container dimensions for radar minimap
  useEffect(() => {
    const el = viewport.containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerDimensions({
          width: entry.contentRect.width || 1200,
          height: entry.contentRect.height || 750,
        })
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [viewport.containerRef])

  // Grid, Scale & Presets
  const [snapGrid, setSnapGrid] = useState<number>(2)
  const [terminalScale, setTerminalScale] = useState<number>(1.0)
  const [selectedPreset, setSelectedPreset] = useState<string>('official_dual_wing')
  const [savedTemplates, setSavedTemplates] = useState<LabLayoutTemplate[]>([])

  // Selection & Inspector Drawer State
  const [selectedWs, setSelectedWs] = useState<WorkstationWithIssues | null>(null)
  const [selectedLandmark, setSelectedLandmark] = useState<LabFloorElementRow | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Dragging tracking
  const draggingWsIdRef = useRef<string | null>(null)
  const draggingLandmarkIdRef = useRef<string | null>(null)
  const justDraggedRef = useRef<boolean>(false)

  // Add Workstation Modal State (Exact position and row slot)
  const [isAddWsModalOpen, setIsAddWsModalOpen] = useState(false)
  const [newWsLabel, setNewWsLabel] = useState('')
  const [newWsRow, setNewWsRow] = useState('Row A (Left)')
  const [newWsPositionId, setNewWsPositionId] = useState('A1')
  const [newWsPos, setNewWsPos] = useState<{ x: number; y: number }>({ x: 6, y: 28 })
  const [selectedSlotKey, setSelectedSlotKey] = useState<string>('auto')
  const [newWsDeviceType, setNewWsDeviceType] = useState<'desktop' | 'aio' | 'laptop' | 'server'>('desktop')
  const [isCreatingWs, setIsCreatingWs] = useState(false)

  // Add Landmark Modal
  const [isAddLmModalOpen, setIsAddLmModalOpen] = useState(false)
  const [newLmType, setNewLmType] = useState('whiteboard')
  const [newLmLabel, setNewLmLabel] = useState('Interactive Whiteboard')
  const [isCreatingLm, setIsCreatingLm] = useState(false)

  // Quick-Find Terminal Selector State
  const [quickFindQuery, setQuickFindQuery] = useState('')
  const [isQuickFindOpen, setIsQuickFindOpen] = useState(false)
  const quickFindRef = useRef<HTMLDivElement>(null)

  // Close Quick-Find Popover on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (quickFindRef.current && !quickFindRef.current.contains(e.target as Node)) {
        setIsQuickFindOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Save Layout Modal State (Default Modification & Custom Layout Naming)
  const [isSaveLayoutModalOpen, setIsSaveLayoutModalOpen] = useState(false)
  const [saveLayoutMode, setSaveLayoutMode] = useState<'default_or_new' | 'update_or_new'>('default_or_new')
  const [customPresetName, setCustomPresetName] = useState('')

  // Added Extension Grid Slots / Custom Positions
  const [addedGridSlots, setAddedGridSlots] = useState<CustomRoomGridSlot[]>([])

  // Custom Grid Builder Modal State
  const [isCustomGridModalOpen, setIsCustomGridModalOpen] = useState(false)
  const [customSides, setCustomSides] = useState<1 | 2>(2)
  const [customRows, setCustomRows] = useState<number>(6)
  const [customCols, setCustomCols] = useState<number>(4)
  const [customRowNaming, setCustomRowNaming] = useState<'letters' | 'numbers'>('letters')
  const [customTerminalNaming, setCustomTerminalNaming] = useState<
    'alphanumeric' | 'side_prefix' | 'sequential_pc' | 'preserve'
  >('alphanumeric')
  const [templateName, setTemplateName] = useState<string>('')
  const [templateDescription, setTemplateDescription] = useState<string>('')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')

  // Canonical standard grid slots (for Computer Lab standard 48-station dual-wing topology)
  const canonicalGridSlots = useMemo<CustomRoomGridSlot[]>(() => {
    if (selectedLabId !== 'comp') return []
    return generateRoomGridSlots(
      {
        sides: 2,
        rows: 6,
        columns: 4,
        rowNaming: 'letters',
        terminalNaming: 'preserve',
      },
      snapGrid
    )
  }, [selectedLabId, snapGrid])

  // Combined Grid Slots (Canonical 48 + Extension Rows & Custom Added Positions)
  const allGridSlots = useMemo<CustomRoomGridSlot[]>(() => {
    return [...canonicalGridSlots, ...addedGridSlots]
  }, [canonicalGridSlots, addedGridSlots])

  // Empty Grid Slots on Canvas (spots in allGridSlots not occupied by any existing workstation)
  const emptyGridSlots = useMemo<CustomRoomGridSlot[]>(() => {
    if (allGridSlots.length === 0) return []
    return allGridSlots.filter((slot) => {
      const isOccupied = localWorkstations.some((ws) => {
        const dx = Math.abs(ws.pos_x - slot.pos_x)
        const dy = Math.abs(ws.pos_y - slot.pos_y)
        return dx < 4.5 && dy < 4.5
      })
      return !isOccupied
    })
  }, [allGridSlots, localWorkstations])

  // Filter and group workstations for minimal Quick-Find combobox
  const filteredWorkstations = useMemo(() => {
    const q = quickFindQuery.trim().toLowerCase()
    if (!q) return localWorkstations
    return localWorkstations.filter((w) => {
      const matchLabel = w.label.toLowerCase().includes(q)
      const matchRow = w.row_label?.toLowerCase().includes(q)
      const matchPos = (w as any).position_id?.toLowerCase().includes(q)
      const matchType = w.device_type.toLowerCase().includes(q)
      return matchLabel || matchRow || matchPos || matchType
    })
  }, [localWorkstations, quickFindQuery])

  const groupedWorkstations = useMemo(() => {
    const leftWing: WorkstationWithIssues[] = []
    const rightWing: WorkstationWithIssues[] = []
    const podium: WorkstationWithIssues[] = []

    filteredWorkstations.forEach((w) => {
      const isTeacher =
        w.label.toLowerCase().includes('teacher') ||
        w.label.toLowerCase().includes('podium') ||
        w.row_label?.toLowerCase().includes('teacher')
      if (isTeacher) {
        podium.push(w)
      } else if (
        w.row_label?.toLowerCase().includes('right') ||
        (w as any).position_id?.match(/^[G-L]/i) ||
        w.pos_x > 50
      ) {
        rightWing.push(w)
      } else {
        leftWing.push(w)
      }
    })

    return { leftWing, rightWing, podium }
  }, [filteredWorkstations])

  // Handler for Ghost Slot Click on Canvas
  const handleGhostSlotClick = useCallback(
    (slot: CustomRoomGridSlot) => {
      if (!isEditModeUnlocked) {
        setSaveToast({
          text: 'Precaution Active: Layout modifications require enabling Edit Mode at top of Admin Console.',
          type: 'error',
        })
        setTimeout(() => setSaveToast(null), 3200)
        return
      }

      // Check if suggested label is already taken
      let targetLabel = slot.suggestedHardwareLabel
      const isTaken = localWorkstations.some(
        (w) => w.label.toLowerCase() === targetLabel.toLowerCase()
      )
      if (isTaken) {
        let maxNum = 0
        localWorkstations.forEach((w) => {
          const match = w.label.match(/\d+/)
          if (match) {
            const num = parseInt(match[0], 10)
            if (!isNaN(num) && num > maxNum) maxNum = num
          }
        })
        targetLabel = `PC-${String(maxNum + 1).padStart(2, '0')}`
      }

      setNewWsLabel(targetLabel)
      setNewWsRow(slot.rowLabel)
      setNewWsPositionId(slot.positionId)
      setNewWsPos({ x: slot.pos_x, y: slot.pos_y })
      setSelectedSlotKey(slot.positionId)
      setIsAddWsModalOpen(true)
    },
    [isEditModeUnlocked, localWorkstations]
  )

  // Handler for opening Add Workstation modal from top toolbar button
  const handleOpenAddWsModal = useCallback(() => {
    if (!isEditModeUnlocked) return

    if (emptyGridSlots.length > 0) {
      const firstSlot = emptyGridSlots[0]
      let targetLabel = firstSlot.suggestedHardwareLabel
      const isTaken = localWorkstations.some(
        (w) => w.label.toLowerCase() === targetLabel.toLowerCase()
      )
      if (isTaken) {
        let maxNum = 0
        localWorkstations.forEach((w) => {
          const match = w.label.match(/\d+/)
          if (match) {
            const num = parseInt(match[0], 10)
            if (!isNaN(num) && num > maxNum) maxNum = num
          }
        })
        targetLabel = `PC-${String(maxNum + 1).padStart(2, '0')}`
      }

      setNewWsLabel(targetLabel)
      setNewWsRow(firstSlot.rowLabel)
      setNewWsPositionId(firstSlot.positionId)
      setNewWsPos({ x: firstSlot.pos_x, y: firstSlot.pos_y })
      setSelectedSlotKey(firstSlot.positionId)
    } else {
      let maxNum = 0
      localWorkstations.forEach((w) => {
        const match = w.label.match(/\d+/)
        if (match) {
          const num = parseInt(match[0], 10)
          if (!isNaN(num) && num > maxNum) maxNum = num
        }
      })
      setNewWsLabel(`PC-${String(maxNum + 1).padStart(2, '0')}`)
      setNewWsRow('Row A (Left)')
      setNewWsPositionId('')
      setNewWsPos({ x: 50, y: 50 })
      setSelectedSlotKey('custom')
    }

    setIsAddWsModalOpen(true)
  }, [isEditModeUnlocked, emptyGridSlots, localWorkstations])

  // Delete saved custom layout template
  const handleDeleteCustomTemplate = async (templateId: string) => {
    if (!isEditModeUnlocked) return
    const res = await deleteCustomLayoutTemplate(templateId, selectedLabId)
    if (res.success) {
      setSavedTemplates((prev) => prev.filter((t) => t.id !== templateId))
      setSelectedPreset('official_dual_wing')
      setSaveToast({ text: 'Custom layout preset deleted.', type: 'success' })
      setTimeout(() => setSaveToast(null), 2500)
    } else {
      alert(res.error || 'Failed to delete custom layout template.')
    }
  }

  // Marks layout as modified without forcefully kicking user off active preset
  const triggerLayoutModification = useCallback(() => {
    setHasUnsavedChanges(true)
  }, [])

  // 2. Drag & Drop Handlers for Workstations (with magnetic grid snapping & click fallback)
  const handleWorkstationDragStart = useCallback(
    (e: React.PointerEvent, ws: WorkstationWithIssues) => {
      const startX = e.clientX
      const startY = e.clientY
      let hasDragged = false
      let currentClampedX = ws.pos_x
      let currentClampedY = ws.pos_y

      if (!isEditModeUnlocked) {
        handleSelectWorkstation(ws)
        return
      }

      draggingWsIdRef.current = ws.id

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const dist = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY)
        if (dist > 4) {
          hasDragged = true
        }
        if (!hasDragged) return

        moveEvent.preventDefault()
        const container = viewport.containerRef.current
        if (!container || !draggingWsIdRef.current) return

        const rect = container.getBoundingClientRect()
        // Compute position inside canvas taking zoom and pan into account
        const clientX = moveEvent.clientX - rect.left - viewport.pan.x
        const clientY = moveEvent.clientY - rect.top - viewport.pan.y
        const rawX = (clientX / (rect.width * viewport.zoom)) * 100
        const rawY = (clientY / (rect.height * viewport.zoom)) * 100

        const snappedX = snapCoordinate(rawX, snapGrid)
        const snappedY = snapCoordinate(rawY, snapGrid)
        currentClampedX = Math.max(2, Math.min(98, snappedX))
        currentClampedY = Math.max(4, Math.min(96, snappedY))

        setLocalWorkstations((prev) =>
          prev.map((item) =>
            item.id === draggingWsIdRef.current
              ? { ...item, pos_x: currentClampedX, pos_y: currentClampedY }
              : item
          )
        )
        triggerLayoutModification()

        // If currently open in inspector, update active coordinates
        if (selectedWs?.id === draggingWsIdRef.current) {
          setSelectedWs((prev) => (prev ? { ...prev, pos_x: currentClampedX, pos_y: currentClampedY } : null))
        }
      }

      const handlePointerUp = () => {
        const draggedId = draggingWsIdRef.current
        draggingWsIdRef.current = null
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', handlePointerUp)

        if (!hasDragged) {
          handleSelectWorkstation(ws)
          return
        }

        // Suppress browser click event from opening the inspector drawer
        justDraggedRef.current = true
        setTimeout(() => {
          justDraggedRef.current = false
        }, 200)

        if (!draggedId) return

        // Magnetic Grid Snapping: Check if dropped close (<= 6.5%) to any available desk slot
        let targetSlot: CustomRoomGridSlot | null = null
        let minDist = 6.5

        for (const slot of allGridSlots) {
          const d = Math.hypot(currentClampedX - slot.pos_x, currentClampedY - slot.pos_y)
          if (d < minDist) {
            minDist = d
            targetSlot = slot
          }
        }

        if (targetSlot) {
          // Check if another workstation is already occupying this target slot
          const occupyingWs = localWorkstations.find(
            (w) =>
              w.id !== draggedId &&
              Math.hypot(w.pos_x - targetSlot!.pos_x, w.pos_y - targetSlot!.pos_y) < 2.5
          )

          if (occupyingWs) {
            // Swap positions between dragged workstation and occupying workstation
            setLocalWorkstations((prev) =>
              prev.map((item) => {
                if (item.id === draggedId) {
                  return {
                    ...item,
                    pos_x: targetSlot!.pos_x,
                    pos_y: targetSlot!.pos_y,
                    row_label: targetSlot!.rowLabel,
                    position_id: targetSlot!.positionId,
                  }
                }
                if (item.id === occupyingWs.id) {
                  return {
                    ...item,
                    pos_x: ws.pos_x,
                    pos_y: ws.pos_y,
                    row_label: ws.row_label,
                    position_id: (ws as any).position_id || null,
                  }
                }
                return item
              })
            )
          } else {
            // Magnetically snap dragged workstation directly to canonical/extension coordinates and slot metadata
            setLocalWorkstations((prev) =>
              prev.map((item) =>
                item.id === draggedId
                  ? {
                      ...item,
                      pos_x: targetSlot!.pos_x,
                      pos_y: targetSlot!.pos_y,
                      row_label: targetSlot!.rowLabel,
                      position_id: targetSlot!.positionId,
                    }
                  : item
              )
            )
          }
          triggerLayoutModification()
        }
      }

      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
    },
    [isEditModeUnlocked, viewport.pan.x, viewport.pan.y, viewport.zoom, snapGrid, selectedWs, allGridSlots, localWorkstations, triggerLayoutModification]
  )

  // 3. Drag & Drop Handlers for Landmarks (with click fallback)
  const handleLandmarkDragStart = useCallback(
    (e: React.PointerEvent, el: LabFloorElementRow) => {
      const startX = e.clientX
      const startY = e.clientY
      let hasDragged = false

      if (!isEditModeUnlocked) {
        handleSelectLandmark(el)
        return
      }

      draggingLandmarkIdRef.current = el.id

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const dist = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY)
        if (dist > 4) {
          hasDragged = true
        }
        if (!hasDragged) return

        moveEvent.preventDefault()
        const container = viewport.containerRef.current
        if (!container || !draggingLandmarkIdRef.current) return

        const rect = container.getBoundingClientRect()
        const clientX = moveEvent.clientX - rect.left - viewport.pan.x
        const clientY = moveEvent.clientY - rect.top - viewport.pan.y
        const rawX = (clientX / (rect.width * viewport.zoom)) * 100
        const rawY = (clientY / (rect.height * viewport.zoom)) * 100

        const snappedX = snapCoordinate(rawX, snapGrid)
        const snappedY = snapCoordinate(rawY, snapGrid)
        const clampedX = Math.max(2, Math.min(98, snappedX))
        const clampedY = Math.max(2, Math.min(98, snappedY))

        setLocalFloorElements((prev) =>
          prev.map((item) =>
            item.id === draggingLandmarkIdRef.current
              ? { ...item, pos_x: clampedX, pos_y: clampedY }
              : item
          )
        )
        triggerLayoutModification()

        if (selectedLandmark?.id === draggingLandmarkIdRef.current) {
          setSelectedLandmark((prev) => (prev ? { ...prev, pos_x: clampedX, pos_y: clampedY } : null))
        }
      }

      const handlePointerUp = () => {
        draggingLandmarkIdRef.current = null
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', handlePointerUp)
        if (!hasDragged) {
          handleSelectLandmark(el)
        } else {
          justDraggedRef.current = true
          setTimeout(() => {
            justDraggedRef.current = false
          }, 200)
        }
      }

      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
    },
    [isEditModeUnlocked, viewport.pan.x, viewport.pan.y, viewport.zoom, snapGrid, selectedLandmark, triggerLayoutModification]
  )

  // Tab / Window reload protection for unsaved layout changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  // Add Extension Row to Expand Capacity (Strictly aligns with canonical wing column x-coordinates and 12% vertical row spacing)
  const handleAddExtensionRow = (side: 'left' | 'right' = 'left') => {
    if (!isEditModeUnlocked) return

    triggerLayoutModification()

    const sideIndex = side === 'left' ? 0 : 1
    const sideExistingExtSlots = addedGridSlots.filter((s) => s.sideIndex === sideIndex)
    const sideExtRowCount = Math.floor(sideExistingExtSlots.length / 4)
    const totalExtRows = Math.floor(addedGridSlots.length / 4)
    const rowLetter = String.fromCharCode(77 + totalExtRows) // 77 = 'M', N, O, P...
    const sideLabel = side === 'left' ? 'Left Wing' : 'Right Wing'
    const rowLabel = `Row ${rowLetter} (${sideLabel} Extension ${sideExtRowCount + 1})`

    // Canonical column alignment:
    // Left Wing: cols at 6%, 18%, 30%, 42% (xStart = 6, xStep = 12)
    // Right Wing: cols at 58%, 70%, 82%, 94% (xStart = 58, xStep = 12)
    const xStart = side === 'left' ? 6 : 58
    const xStep = 12
    // Vertical spacing strictly aligned with rows A..F / G..L (spacing 12%):
    // First extension row on this side is at 88 + 12 = 100%
    const yPos = snapCoordinate(100 + sideExtRowCount * 12, snapGrid)

    let maxPcNum = 48
    localWorkstations.forEach((w) => {
      const match = w.label.match(/\d+/)
      if (match) {
        const num = parseInt(match[0], 10)
        if (!isNaN(num) && num > maxPcNum) maxPcNum = num
      }
    })
    addedGridSlots.forEach((s) => {
      const match = s.suggestedHardwareLabel.match(/\d+/)
      if (match) {
        const num = parseInt(match[0], 10)
        if (!isNaN(num) && num > maxPcNum) maxPcNum = num
      }
    })

    const newSlots: CustomRoomGridSlot[] = Array.from({ length: 4 }, (_, c) => {
      const col = c + 1
      const posId = `${rowLetter}${col}`
      const pcNum = maxPcNum + col
      return {
        slotIndex: canonicalGridSlots.length + addedGridSlots.length + c,
        sideIndex,
        rowIndex: 6 + sideExtRowCount,
        globalRowIndex: 6 + totalExtRows,
        colIndex: c,
        rowLabel,
        positionId: posId,
        suggestedHardwareLabel: `PC-${String(pcNum).padStart(2, '0')}`,
        suggestedLabel: posId,
        pos_x: snapCoordinate(xStart + c * xStep, snapGrid),
        pos_y: yPos,
      }
    })

    setAddedGridSlots((prev) => [...prev, ...newSlots])
    setSaveToast({
      text: `Added ${rowLabel} (+4 desk positions: ${rowLetter}1–${rowLetter}4).`,
      type: 'success',
    })
    setTimeout(() => setSaveToast(null), 3000)
  }

  // 4. Save Entire Layout (Enables updating Institutional Default with warning, or saving custom presets)
  const handleInitiateSaveLayout = () => {
    if (!isEditModeUnlocked) return

    if (selectedPreset === 'official_dual_wing' || selectedPreset === 'draft_custom') {
      let nextNum = 1
      savedTemplates.forEach((t) => {
        const m = t.name.match(/Custom(?:\s+Layout)?\s*(\d+)/i)
        if (m) {
          const n = parseInt(m[1], 10)
          if (!isNaN(n) && n >= nextNum) nextNum = n + 1
        }
      })
      setCustomPresetName(`Custom ${nextNum}`)
      setSaveLayoutMode('default_or_new')
      setIsSaveLayoutModalOpen(true)
    } else {
      // Currently on an existing custom layout template
      const tplId = selectedPreset.replace('tpl_', '')
      const currentTpl = savedTemplates.find((t) => t.id === tplId)
      let nextNum = 1
      savedTemplates.forEach((t) => {
        const m = t.name.match(/Custom(?:\s+Layout)?\s*(\d+)/i)
        if (m) {
          const n = parseInt(m[1], 10)
          if (!isNaN(n) && n >= nextNum) nextNum = n + 1
        }
      })
      setCustomPresetName(currentTpl ? `${currentTpl.name} (Copy)` : `Custom ${nextNum}`)
      setSaveLayoutMode('update_or_new')
      setIsSaveLayoutModalOpen(true)
    }
  }

  // Update Institutional Default layout in PostgreSQL baseline
  const handleConfirmUpdateInstitutionalDefault = async () => {
    setIsSaving(true)
    try {
      const wsUpdates = localWorkstations.map((w) => ({
        id: w.id,
        pos_x: w.pos_x,
        pos_y: w.pos_y,
        row_label: w.row_label || null,
        label: w.label,
        position_id: (w as any).position_id || null,
      }))
      const landmarkUpdates = localFloorElements.map((el) => ({
        id: el.id,
        lab_id: selectedLabId,
        element_type: el.element_type,
        label: el.label,
        pos_x: el.pos_x,
        pos_y: el.pos_y,
        width: el.width || 12.0,
        height: el.height || 4.0,
        rotation: (el.rotation || 0) as 0 | 90 | 180 | 270,
        is_active: el.is_active,
      }))

      const [wsRes, lmRes] = await Promise.all([
        batchUpdateWorkstationPositions(selectedLabId, wsUpdates),
        saveLabFloorElements(selectedLabId, landmarkUpdates),
      ])
      if (!wsRes.success) throw new Error(wsRes.error || 'Failed to save workstation positions.')
      if (!lmRes.success) throw new Error(lmRes.error || 'Failed to save floor landmarks.')

      // Synchronize in-memory boardData baseline
      setBoardData((prev) =>
        prev
          ? {
              ...prev,
              workstations: localWorkstations.map((w) => ({ ...w })),
            }
          : null
      )

      setSelectedPreset('official_dual_wing')
      setHasUnsavedChanges(false)
      setIsSaveLayoutModalOpen(false)
      setSaveToast({
        text: 'Institutional Default Layout updated successfully in database.',
        type: 'success',
      })
      setTimeout(() => setSaveToast(null), 3500)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save error'
      setSaveToast({ text: msg, type: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  // Save new custom preset
  const handleConfirmSaveLayout = async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setIsSaving(true)
    try {
      const wsUpdates = localWorkstations.map((w) => ({
        id: w.id,
        pos_x: w.pos_x,
        pos_y: w.pos_y,
        row_label: w.row_label || null,
        label: w.label,
        position_id: (w as any).position_id || null,
      }))
      const landmarkUpdates = localFloorElements.map((el) => ({
        id: el.id,
        lab_id: selectedLabId,
        element_type: el.element_type,
        label: el.label,
        pos_x: el.pos_x,
        pos_y: el.pos_y,
        width: el.width || 12.0,
        height: el.height || 4.0,
        rotation: (el.rotation || 0) as 0 | 90 | 180 | 270,
        is_active: el.is_active,
      }))

      const config: CustomRoomGridConfig = {
        sides: customSides,
        rows: customRows,
        columns: customCols,
        rowNaming: 'letters',
        terminalNaming: 'preserve',
        positions: wsUpdates,
      }
      const tplRes = await saveCustomLayoutTemplate(selectedLabId, trimmed, config)
      if (!tplRes.success || !tplRes.template) {
        throw new Error(tplRes.error || 'Failed to save custom layout template.')
      }

      const [wsRes, lmRes] = await Promise.all([
        batchUpdateWorkstationPositions(selectedLabId, wsUpdates),
        saveLabFloorElements(selectedLabId, landmarkUpdates),
      ])
      if (!wsRes.success) throw new Error(wsRes.error || 'Failed to save workstation positions.')
      if (!lmRes.success) throw new Error(lmRes.error || 'Failed to save floor landmarks.')

      setSavedTemplates((prev) => [
        ...prev.filter((t) => t.id !== tplRes.template!.id),
        tplRes.template!,
      ])

      // Synchronize in-memory boardData baseline
      setBoardData((prev) =>
        prev
          ? {
              ...prev,
              workstations: localWorkstations.map((w) => ({ ...w })),
            }
          : null
      )

      setSelectedPreset(`tpl_${tplRes.template.id}`)
      setHasUnsavedChanges(false)
      setIsSaveLayoutModalOpen(false)
      setSaveToast({
        text: `Layout saved as "${trimmed}".`,
        type: 'success',
      })
      setTimeout(() => setSaveToast(null), 3000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save error'
      setSaveToast({ text: msg, type: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  // Update existing custom preset in place
  const handleConfirmUpdateExistingLayout = async () => {
    const tplId = selectedPreset.replace('tpl_', '')
    const currentTpl = savedTemplates.find((t) => t.id === tplId)
    if (!currentTpl) return
    await handleConfirmSaveLayout(currentTpl.name)
  }

  // 5. Discard / Revert Changes with confirmation
  const handleDiscardChanges = () => {
    if (hasUnsavedChanges) {
      const ok = window.confirm('Discard all unsaved layout modifications and revert to last saved state?')
      if (!ok) return
    }
    if (boardData) {
      setLocalWorkstations(boardData.workstations.map((w) => ({ ...w })))
    }
    setAddedGridSlots([])
    setHasUnsavedChanges(false)
    if (selectedPreset === 'draft_custom') {
      setSelectedPreset('official_dual_wing')
    }
    setSaveToast({ text: 'Changes discarded. Restored last saved layout.', type: 'success' })
    setTimeout(() => setSaveToast(null), 2500)
  }

  // Reload from database with confirmation
  const handleRefreshData = async () => {
    if (hasUnsavedChanges) {
      const ok = window.confirm('You have unsaved changes. Reloading from database will discard them. Continue?')
      if (!ok) return
    }
    await loadData()
    setAddedGridSlots([])
    setHasUnsavedChanges(false)
  }

  // 6. Inspector Actions
  const handleSelectWorkstation = (ws: WorkstationWithIssues) => {
    if (justDraggedRef.current) return
    setSelectedWs(ws)
    setSelectedLandmark(null)
    setIsDrawerOpen(true)
  }

  const handleSelectLandmark = (el: LabFloorElementRow) => {
    if (justDraggedRef.current) return
    setSelectedLandmark(el)
    setSelectedWs(null)
    setIsDrawerOpen(true)
  }

  const handleDrawerUpdateWorkstation = async (updated: {
    id: string
    label: string
    row_label?: string | null
    position_id?: string | null
    device_type: 'desktop' | 'aio' | 'laptop' | 'server'
    pos_x: number
    pos_y: number
  }): Promise<boolean> => {
    const res = await updateWorkstation({
      id: updated.id,
      label: updated.label,
      row_label: updated.row_label,
      position_id: updated.position_id,
      device_type: updated.device_type,
      pos_x: updated.pos_x,
      pos_y: updated.pos_y,
    })

    if (res.success && res.data) {
      setLocalWorkstations((prev) =>
        prev.map((item) =>
          item.id === updated.id
            ? {
                ...item,
                label: updated.label,
                row_label: updated.row_label || null,
                position_id: updated.position_id || null,
                device_type: updated.device_type,
                pos_x: updated.pos_x,
                pos_y: updated.pos_y,
              }
            : item
        )
      )
      setSelectedWs((prev) =>
        prev && prev.id === updated.id
          ? {
              ...prev,
              label: updated.label,
              row_label: updated.row_label || null,
              position_id: updated.position_id || null,
              device_type: updated.device_type,
              pos_x: updated.pos_x,
              pos_y: updated.pos_y,
            }
          : prev
      )
      triggerLayoutModification()
      return true
    }
    return false
  }

  const handleDrawerDeleteWorkstation = async (id: string) => {
    const res = await deleteWorkstation(id)
    if (res.success) {
      setLocalWorkstations((prev) => prev.filter((item) => item.id !== id))
      setSelectedWs(null)
      setIsDrawerOpen(false)
      triggerLayoutModification()
      setSaveToast({ text: `Workstation ${res.deletedLabel || id} deleted successfully.`, type: 'success' })
      setTimeout(() => setSaveToast(null), 3000)
    }
    return res
  }

  const handleDrawerUpdateLandmark = (updated: LabFloorElementRow) => {
    setLocalFloorElements((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    )
    triggerLayoutModification()
  }

  const handleDrawerDeleteLandmark = async (id: string) => {
    const res = await deleteLabFloorElement(id)
    if (res.success) {
      setLocalFloorElements((prev) => prev.filter((item) => item.id !== id))
      setSelectedLandmark(null)
      setIsDrawerOpen(false)
      triggerLayoutModification()
    }
  }

  const handleDrawerRotateLandmark = (landmark: LabFloorElementRow) => {
    setLocalFloorElements((prev) =>
      prev.map((item) =>
        item.id === landmark.id
          ? { ...item, rotation: (((item.rotation || 0) + 90) % 360) as any }
          : item
      )
    )
    triggerLayoutModification()
  }

  // 7. Add Workstation
  const handleCreateWorkstation = async () => {
    if (!newWsLabel.trim() || !isEditModeUnlocked) return
    setIsCreatingWs(true)
    try {
      const res = await createWorkstation({
        lab_id: selectedLabId,
        label: newWsLabel.trim(),
        row_label: newWsRow.trim() || null,
        position_id: newWsPositionId.trim() || null,
        pos_x: newWsPos.x,
        pos_y: newWsPos.y,
        device_type: newWsDeviceType,
      })

      if (res.success && res.data) {
        const newStation: WorkstationWithIssues = {
          ...res.data,
          status: 'operational',
          open_issues_count: 0,
          highest_severity: null,
          active_issues: [],
        }
        setLocalWorkstations((prev) => [...prev, newStation])
        setIsAddWsModalOpen(false)
        setSelectedWs(newStation)
        setIsDrawerOpen(true)
        triggerLayoutModification()
        setSaveToast({
          text: `Workstation ${res.data.label} provisioned at ${res.data.row_label || res.data.position_id || 'selected location'}.`,
          type: 'success',
        })
        setTimeout(() => setSaveToast(null), 2500)
      } else {
        alert(res.error || 'Failed to create workstation.')
      }
    } finally {
      setIsCreatingWs(false)
    }
  }

  // 8. Add Landmark
  const handleCreateLandmark = async () => {
    if (!newLmLabel.trim() || !isEditModeUnlocked) return
    setIsCreatingLm(true)
    try {
      const newLm = {
        lab_id: selectedLabId,
        element_type: newLmType,
        label: newLmLabel.trim(),
        pos_x: 50,
        pos_y: 10,
        width: 16.0,
        height: 4.5,
        rotation: 0 as const,
        is_active: true,
      }
      const res = await saveLabFloorElements(selectedLabId, [newLm])
      if (res.success) {
        setIsAddLmModalOpen(false)
        await loadData()
        triggerLayoutModification()
        setSaveToast({ text: `Landmark "${newLm.label}" added to floor plan.`, type: 'success' })
        setTimeout(() => setSaveToast(null), 2500)
      } else {
        alert(res.error || 'Failed to add floor landmark.')
      }
    } finally {
      setIsCreatingLm(false)
    }
  }

  // 9. Apply Layout Preset (Official Institutional Layout or Saved Custom Presets)
  const handleApplyPreset = (presetKey: string) => {
    if (!isEditModeUnlocked) return

    if (presetKey.startsWith('tpl_')) {
      const tplId = presetKey.replace('tpl_', '')
      const template = savedTemplates.find((t) => t.id === tplId)
      if (template) {
        const calculated = calculateCustomRoomLayout(localWorkstations, template.config, snapGrid, true)
        const posMap = new Map(calculated.map((c) => [c.id, c]))

        setLocalWorkstations((prev) =>
          prev.map((w) => {
            const update = posMap.get(w.id)
            if (update) {
              return {
                ...w,
                pos_x: update.pos_x,
                pos_y: update.pos_y,
                row_label: update.row_label || w.row_label,
                label: update.label || w.label,
                position_id: update.position_id || (w as any).position_id,
              }
            }
            return w
          })
        )
        setAddedGridSlots([])
        setHasUnsavedChanges(true)
        setSaveToast({ text: `Applied custom preset: "${template.name}".`, type: 'success' })
        setTimeout(() => setSaveToast(null), 2500)
      }
      return
    }

    const calculated = calculateAutoArrangement(localWorkstations, presetKey as LayoutPresetType, snapGrid)
    const posMap = new Map(calculated.map((c) => [c.id, c]))

    setLocalWorkstations((prev) =>
      prev.map((w) => {
        const update = posMap.get(w.id)
        if (update) {
          return {
            ...w,
            pos_x: update.pos_x,
            pos_y: update.pos_y,
            row_label: update.row_label || w.row_label,
            position_id: update.position_id || (w as any).position_id,
          }
        }
        return w
      })
    )
    setAddedGridSlots([])
    setHasUnsavedChanges(true)
    setSaveToast({ text: 'Applied Official Institutional Layout (Dual-Wing · 48 PCs).', type: 'success' })
    setTimeout(() => setSaveToast(null), 2500)
  }

  // Restores canonical 48-PC dual-wing institutional standard
  const handleApplyDefaultCanonicalLayout = useCallback(() => {
    if (!isEditModeUnlocked) return
    if (hasUnsavedChanges) {
      const ok = window.confirm(
        'Discard unsaved layout modifications and restore Default Lab Layout (48 PCs)?'
      )
      if (!ok) return
    }
    const calculated = calculateAutoArrangement(localWorkstations, 'official_dual_wing', snapGrid)
    const posMap = new Map(calculated.map((c) => [c.id, c]))

    const updated = localWorkstations.map((w) => {
      const update = posMap.get(w.id)
      if (update) {
        return {
          ...w,
          pos_x: update.pos_x,
          pos_y: update.pos_y,
          row_label: update.row_label || w.row_label,
          position_id: update.position_id || (w as any).position_id,
        }
      }
      return w
    })

    setLocalWorkstations(updated)
    setAddedGridSlots([])
    setSelectedPreset('official_dual_wing')

    const matchesBaseline = boardData ? areWorkstationsMatching(updated, boardData.workstations) : false
    setHasUnsavedChanges(!matchesBaseline)

    setSaveToast({ text: 'Applied Default Lab Layout (Dual-Wing · 48 PCs).', type: 'success' })
    setTimeout(() => setSaveToast(null), 3000)
  }, [isEditModeUnlocked, hasUnsavedChanges, localWorkstations, snapGrid, boardData])

  // Preset Selection Change with Unsaved Changes Guard
  const handlePresetChange = (newKey: string) => {
    if (!isEditModeUnlocked) {
      setSaveToast({
        text: 'Precaution Active: Layout modifications require enabling Edit Mode at top of Admin Console.',
        type: 'error',
      })
      setTimeout(() => setSaveToast(null), 3200)
      return
    }

    if (newKey === 'official_dual_wing') {
      handleApplyDefaultCanonicalLayout()
      return
    }

    if (newKey === 'draft_custom') {
      setSelectedPreset('draft_custom')
      return
    }

    if (hasUnsavedChanges) {
      const ok = window.confirm(
        'You have unsaved layout modifications. Switching layouts will discard your unsaved changes. Continue?'
      )
      if (!ok) return
    }
    setSelectedPreset(newKey)
    handleApplyPreset(newKey)
  }

  // 10. Apply Streamlined Custom Grid Layout
  const handleApplyCustomGrid = async () => {
    if (!isEditModeUnlocked) return
    const config: CustomRoomGridConfig = {
      sides: customSides,
      rows: customRows,
      columns: customCols,
      rowNaming: 'letters',
      terminalNaming: 'preserve',
    }

    // Optional: Save as named custom preset if templateName is provided
    if (templateName.trim()) {
      try {
        const tplRes = await saveCustomLayoutTemplate(
          selectedLabId,
          templateName.trim(),
          config,
          templateDescription.trim() || undefined
        )
        if (tplRes.success && tplRes.template) {
          setSavedTemplates((prev) => [
            ...prev.filter((t) => t.id !== tplRes.template!.id),
            tplRes.template!,
          ])
          setSelectedPreset(`tpl_${tplRes.template.id}`)
        }
      } catch (err) {
        console.error('Error saving template:', err)
      }
    }

    const calculated = calculateCustomRoomLayout(localWorkstations, config, snapGrid, true)
    const posMap = new Map(calculated.map((c) => [c.id, c]))

    setLocalWorkstations((prev) =>
      prev.map((w) => {
        const update = posMap.get(w.id)
        if (update) {
          return {
            ...w,
            pos_x: update.pos_x,
            pos_y: update.pos_y,
            row_label: update.row_label || w.row_label,
            label: update.label || w.label,
            position_id: update.position_id || (w as any).position_id,
          }
        }
        return w
      })
    )
    setAddedGridSlots([])
    triggerLayoutModification()
    setIsCustomGridModalOpen(false)
    setSaveToast({
      text: `Applied Custom Grid (${customSides} side${customSides > 1 ? 's' : ''} × ${customRows}R × ${customCols}C).`,
      type: 'success',
    })
    setTimeout(() => setSaveToast(null), 3000)
  }

  // Active preset metadata
  const activePresetInfo = LAYOUT_PRESETS.find((p) => p.id === selectedPreset)

  return (
    <div className="space-y-3 font-sans text-zinc-900 dark:text-zinc-100 relative">
      {/* ============================================================== */}
      {/* 1. TOP COMMAND & TOOLS BAR                                     */}
      {/* ============================================================== */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl border border-indigo-500/30 bg-[#0B0F19] text-white shadow-xl">
        {/* Left Title & Status */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shadow-xs">
            <Monitor className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading font-extrabold text-sm text-white">
                CAD Floor Architect
              </h3>
              {hasUnsavedChanges && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                  Unsaved Changes
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Spatial CAD design, hardware provisioning &amp; workstation calibration
            </p>
          </div>
        </div>

        {/* Center / Right Command Tools */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Add PC Button (Rule 1: No literal + in text) */}
          <Button
            type="button"
            size="sm"
            disabled={!isEditModeUnlocked}
            onClick={handleOpenAddWsModal}
            className="h-8.5 px-3 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5 shadow-xs cursor-pointer disabled:opacity-40"
            title="Provision a new workstation node in this lab"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add PC</span>
          </Button>

          {/* Add Landmark Button (Rule 1: No literal + in text) */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!isEditModeUnlocked}
            onClick={() => setIsAddLmModalOpen(true)}
            className="h-8.5 px-3 text-xs font-semibold rounded-xl border-white/10 text-slate-200 hover:bg-white/5 gap-1.5 cursor-pointer disabled:opacity-40"
            title="Place whiteboards, podiums, doors, or windows"
          >
            <Plus className="h-3.5 w-3.5 text-indigo-400" />
            <span>Add Landmark</span>
          </Button>

          {/* Add Row Buttons to Expand Lab Capacity (Rule 1: No literal + in text) */}
          <div className="flex items-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!isEditModeUnlocked}
              onClick={() => handleAddExtensionRow('left')}
              className="h-8.5 px-2.5 text-xs font-semibold rounded-l-xl border-white/10 text-slate-200 hover:bg-white/5 gap-1 cursor-pointer disabled:opacity-40"
              title="Expand capacity by adding 4 desk positions to Left Wing"
            >
              <Plus className="h-3.5 w-3.5 text-indigo-400" />
              <span>Add Row (L)</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!isEditModeUnlocked}
              onClick={() => handleAddExtensionRow('right')}
              className="h-8.5 px-2 text-xs font-semibold rounded-r-xl border-l-0 border-white/10 text-slate-200 hover:bg-white/5 gap-1 cursor-pointer disabled:opacity-40"
              title="Expand capacity by adding 4 desk positions to Right Wing"
            >
              <Plus className="h-3.5 w-3.5 text-indigo-400" />
              <span>(R)</span>
            </Button>
          </div>

          {/* Custom Grid Builder Trigger */}
          <Button
            type="button"
            size="sm"
            disabled={!isEditModeUnlocked}
            onClick={() => setIsCustomGridModalOpen(true)}
            className="h-8.5 px-3 text-xs font-bold rounded-xl bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-200 gap-1.5 cursor-pointer disabled:opacity-40"
            title="Generate custom rows, columns, and corridor layout"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Custom Grid</span>
          </Button>

          {/* Layout Presets Dropdown & Reset Action */}
          <div className="flex items-center gap-1.5">
            <Select
              value={selectedPreset}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="h-8.5 text-xs bg-[#151E32] border-white/10 text-white rounded-xl min-w-[190px]"
            >
              <option value="official_dual_wing">Default Lab Layout (48 PCs)</option>
              {selectedPreset === 'draft_custom' && (
                <option value="draft_custom">
                  {customPresetName} (Draft)
                </option>
              )}
              {savedTemplates.length > 0 && (
                <optgroup label="Saved Custom Presets">
                  {savedTemplates.map((t) => (
                    <option key={t.id} value={`tpl_${t.id}`}>
                      {t.name} ({t.config.sides * t.config.rows * t.config.columns} PCs)
                    </option>
                  ))}
                </optgroup>
              )}
            </Select>

            {/* 1-Click Reset to Default Canonical Layout */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!isEditModeUnlocked}
              onClick={handleApplyDefaultCanonicalLayout}
              className="h-8.5 px-2.5 text-xs rounded-xl border-white/10 text-slate-300 hover:bg-white/5 cursor-pointer disabled:opacity-40 gap-1.5"
              title="Reset canvas to pristine Default Lab Layout (48 PCs)"
            >
              <RotateCcw className="h-3 w-3 text-indigo-400" />
              <span>Reset Default</span>
            </Button>

            {selectedPreset.startsWith('tpl_') && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!isEditModeUnlocked}
                onClick={() => handleDeleteCustomTemplate(selectedPreset.replace('tpl_', ''))}
                className="h-8.5 px-2 text-xs font-semibold rounded-xl border-rose-500/40 text-rose-300 hover:bg-rose-500/10 cursor-pointer disabled:opacity-40"
                title="Delete this saved custom preset"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {/* Discard & Save Actions */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!hasUnsavedChanges || isSaving}
            onClick={handleDiscardChanges}
            className="h-8.5 px-3 text-xs rounded-xl border-white/10 text-slate-300 hover:bg-white/5 gap-1.5 disabled:opacity-40 cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Discard</span>
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={!hasUnsavedChanges || isSaving || !isEditModeUnlocked}
            onClick={handleInitiateSaveLayout}
            className="h-8.5 px-3 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs gap-1.5 disabled:opacity-40 cursor-pointer"
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            <span>Save Layout</span>
          </Button>

          {/* Refresh Data */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefreshData}
            disabled={loading}
            className="h-8.5 px-2.5 text-xs rounded-xl border-white/10 text-slate-300 hover:bg-white/5 cursor-pointer"
            title="Reload from database"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>

          {/* Link to Live Lab Workspace */}
          <Link href="/computer-lab">
            <Button
              type="button"
              size="sm"
              className="h-8.5 px-3 text-xs font-bold rounded-xl bg-[#151E32] hover:bg-[#1E293B] border border-white/10 text-slate-200 gap-1.5 shadow-xs"
              title="Navigate to the operational lab workspace"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Open Live Lab</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Safety Notice if Locked (Rule 3: Keep Precaution Active intact) */}
      {!isEditModeUnlocked && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-300 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-amber-500" />
            <span>
              <strong>Precaution Active</strong>: Layout modifications, node dragging, adding PCs, and deletions require enabling <strong>Edit Mode</strong> at the top of the Admin Console.
            </span>
          </div>
        </div>
      )}

      {/* Toast Feedback */}
      {saveToast && (
        <div
          className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-semibold animate-in fade-in duration-200 ${
            saveToast.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300'
              : 'border-rose-500/40 bg-rose-950/30 text-rose-300'
          }`}
        >
          {saveToast.type === 'success' ? (
            <Check className="h-4 w-4 text-emerald-400" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-rose-400" />
          )}
          <span>{saveToast.text}</span>
        </div>
      )}

      {/* 2. TERMINAL QUICK SELECTOR & TRIAGE BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-2xl bg-[#101726] border border-white/10 text-xs">
        <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-0">
          <span className="font-bold text-slate-300 flex items-center gap-1.5 shrink-0">
            <Monitor className="h-4 w-4 text-indigo-400" />
            <span>Select Terminal:</span>
          </span>

          {/* Quick-Find Combobox with Search & Organized Groups */}
          <div ref={quickFindRef} className="relative flex-1 max-w-sm min-w-[240px]">
            {selectedWs ? (
              <div className="flex items-center justify-between h-8 px-2.5 rounded-xl bg-[#0B0F19] border border-indigo-500/40 text-white font-mono text-xs">
                <div className="flex items-center gap-2 truncate">
                  <span
                    className={`h-2 w-2 rounded-full shrink-0 ${
                      selectedWs.status === 'under_repair'
                        ? 'bg-cyan-400'
                        : selectedWs.status === 'flagged'
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                    }`}
                  />
                  <span className="font-extrabold text-indigo-300">{selectedWs.label}</span>
                  {selectedWs.row_label && (
                    <span className="text-slate-400 font-sans text-[11px] truncate">
                      ({selectedWs.row_label})
                    </span>
                  )}
                  {(selectedWs as any).position_id && (
                    <span className="px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-mono">
                      {(selectedWs as any).position_id}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedWs(null)
                      setQuickFindQuery('')
                      setIsQuickFindOpen(true)
                    }}
                    className="p-1 text-slate-400 hover:text-white rounded-md transition-colors cursor-pointer"
                    title="Change selected terminal"
                  >
                    <Search className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedWs(null)}
                    className="p-1 text-slate-400 hover:text-white rounded-md transition-colors cursor-pointer"
                    title="Clear selection"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={quickFindQuery}
                  onChange={(e) => {
                    setQuickFindQuery(e.target.value)
                    setIsQuickFindOpen(true)
                  }}
                  onFocus={() => setIsQuickFindOpen(true)}
                  placeholder="Quick find terminal (e.g. PC-11, Row C, C1)..."
                  className="w-full h-8 pl-8 pr-7 rounded-xl bg-[#0B0F19] border border-white/10 text-white font-sans text-xs placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setIsQuickFindOpen(!isQuickFindOpen)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-white cursor-pointer"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Quick-Find Autocomplete Popover */}
            {isQuickFindOpen && (
              <div className="absolute top-full mt-1.5 left-0 w-full sm:w-96 p-2 rounded-2xl bg-[#0B0F19] border border-indigo-500/30 shadow-2xl z-50 max-h-72 overflow-y-auto space-y-2.5 animate-in fade-in duration-150">
                {/* Podium / Teacher Node */}
                {groupedWorkstations.podium.length > 0 && (
                  <div>
                    <div className="px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 rounded-md mb-1">
                      Instructor Console
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {groupedWorkstations.podium.map((w) => (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => {
                            handleSelectWorkstation(w)
                            setIsQuickFindOpen(false)
                          }}
                          className={`p-1.5 rounded-lg border text-left flex items-center justify-between cursor-pointer transition-colors ${
                            selectedWs?.id === w.id
                              ? 'bg-indigo-600 text-white border-indigo-500'
                              : 'bg-[#151E32] text-slate-200 border-white/5 hover:border-indigo-500/40 hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <Monitor className="h-3 w-3 text-indigo-400 shrink-0" />
                            <span className="font-mono font-bold text-xs truncate">{w.label}</span>
                          </div>
                          <span className="text-[9px] font-mono text-slate-400">Podium</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Left Wing */}
                {groupedWorkstations.leftWing.length > 0 && (
                  <div>
                    <div className="px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-300 bg-white/5 rounded-md mb-1 flex items-center justify-between">
                      <span>Left Wing (Rows A–F)</span>
                      <span className="text-slate-400 font-normal">{groupedWorkstations.leftWing.length} PCs</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {groupedWorkstations.leftWing.map((w) => {
                        const posId = (w as any).position_id || ''
                        return (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => {
                              handleSelectWorkstation(w)
                              setIsQuickFindOpen(false)
                            }}
                            className={`p-1.5 rounded-lg border text-left flex items-center justify-between cursor-pointer transition-colors ${
                              selectedWs?.id === w.id
                                ? 'bg-indigo-600 text-white border-indigo-500'
                                : 'bg-[#151E32] text-slate-200 border-white/5 hover:border-indigo-500/40 hover:bg-white/5'
                            }`}
                          >
                            <div className="truncate">
                              <span className="font-mono font-bold text-xs block leading-tight truncate">
                                {w.label}
                              </span>
                              <span className="text-[9px] font-mono text-slate-400 block truncate">
                                {posId || w.row_label?.replace(' (Left)', '') || ''}
                              </span>
                            </div>
                            <span
                              className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                                w.status === 'under_repair'
                                  ? 'bg-cyan-400'
                                  : w.status === 'flagged'
                                  ? 'bg-amber-400'
                                  : 'bg-emerald-400'
                              }`}
                            />
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Right Wing */}
                {groupedWorkstations.rightWing.length > 0 && (
                  <div>
                    <div className="px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-300 bg-white/5 rounded-md mb-1 flex items-center justify-between">
                      <span>Right Wing (Rows G–L)</span>
                      <span className="text-slate-400 font-normal">{groupedWorkstations.rightWing.length} PCs</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {groupedWorkstations.rightWing.map((w) => {
                        const posId = (w as any).position_id || ''
                        return (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => {
                              handleSelectWorkstation(w)
                              setIsQuickFindOpen(false)
                            }}
                            className={`p-1.5 rounded-lg border text-left flex items-center justify-between cursor-pointer transition-colors ${
                              selectedWs?.id === w.id
                                ? 'bg-indigo-600 text-white border-indigo-500'
                                : 'bg-[#151E32] text-slate-200 border-white/5 hover:border-indigo-500/40 hover:bg-white/5'
                            }`}
                          >
                            <div className="truncate">
                              <span className="font-mono font-bold text-xs block leading-tight truncate">
                                {w.label}
                              </span>
                              <span className="text-[9px] font-mono text-slate-400 block truncate">
                                {posId || w.row_label?.replace(' (Right)', '') || ''}
                              </span>
                            </div>
                            <span
                              className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                                w.status === 'under_repair'
                                  ? 'bg-cyan-400'
                                  : w.status === 'flagged'
                                  ? 'bg-amber-400'
                                  : 'bg-emerald-400'
                              }`}
                            />
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {filteredWorkstations.length === 0 && (
                  <div className="p-4 text-center text-slate-400 text-xs italic">
                    No terminals match &ldquo;{quickFindQuery}&rdquo;
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {selectedWs ? (
          <div className="flex items-center gap-2 flex-wrap ml-auto sm:ml-0 shrink-0">
            <Button
              type="button"
              size="sm"
              onClick={() => setIsDrawerOpen(true)}
              className="h-8 px-3 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white gap-1 shadow-xs cursor-pointer"
            >
              <SlidersHorizontal className="h-3 w-3" />
              <span>Open Inspector</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!isEditModeUnlocked}
              onClick={() => setIsDrawerOpen(true)}
              className="h-8 px-3 text-xs font-bold rounded-xl border-rose-500/40 text-rose-300 hover:bg-rose-500/10 hover:border-rose-500/60 gap-1 cursor-pointer disabled:opacity-40"
              title="Remove or decommission this workstation"
            >
              <Trash2 className="h-3 w-3" />
              <span>Remove {selectedWs.label}</span>
            </Button>
          </div>
        ) : (
          <span className="text-slate-400 text-[11px] italic shrink-0">
            Click any workstation or empty slot on canvas to view properties
          </span>
        )}
      </div>

      {/* ============================================================== */}
      {/* 3. INTERACTIVE CAD CANVAS VIEWPORT                             */}
      {/* ============================================================== */}
      <div
        {...viewport.containerProps}
        className={`relative w-full h-[750px] rounded-2xl border border-indigo-500/20 bg-[#0B0F19] overflow-hidden select-none shadow-inner ${
          viewport.isPanning ? 'cursor-grabbing' : viewport.isPanToolActive ? 'cursor-grab' : 'cursor-default'
        }`}
      >
        {/* Floating HUD Controls */}
        <CanvasControlsHud
          zoom={viewport.zoom}
          isPanToolActive={viewport.isPanToolActive}
          isMinimapVisible={isMinimapVisible}
          onZoomIn={viewport.zoomIn}
          onZoomOut={viewport.zoomOut}
          onResetZoom={viewport.resetZoom}
          onFitToScreen={viewport.fitToScreen}
          onTogglePanTool={viewport.togglePanTool}
          onToggleMinimap={() => setIsMinimapVisible(!isMinimapVisible)}
          terminalScale={terminalScale}
          onSetTerminalScale={setTerminalScale}
          snapGrid={snapGrid}
          onSetSnapGrid={setSnapGrid}
        />

        {/* Floating Radar Minimap */}
        {isMinimapVisible && (
          <div className="absolute bottom-4 right-4 z-30">
            <CanvasMinimapRadar
              workstations={localWorkstations}
              zoom={viewport.zoom}
              pan={viewport.pan}
              containerWidth={containerDimensions.width}
              containerHeight={containerDimensions.height}
              onPanChange={viewport.setPan}
              onClose={() => setIsMinimapVisible(false)}
            />
          </div>
        )}

        {/* Blueprint Grid Lines & Dots Layer */}
        <div
          className="absolute inset-0 pointer-events-none opacity-25"
          style={{
            backgroundImage: `radial-gradient(circle, #6366F1 1px, transparent 1px)`,
            backgroundSize: `${(snapGrid || 2) * 16}px ${(snapGrid || 2) * 16}px`,
          }}
        />

        {/* Viewport Transform Container */}
        <div
          style={{
            ...viewport.canvasTransformStyle,
            width: '100%',
            height: '100%',
            position: 'absolute',
            inset: 0,
          }}
        >
          {loading ? (
            <div className="h-full w-full flex items-center justify-center">
              <div className="flex items-center gap-2 text-xs text-indigo-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Calibrating laboratory topology...</span>
              </div>
            </div>
          ) : (
            <>
              {/* Floor Landmarks (Whiteboards, Doors, Podiums) */}
              {localFloorElements.map((el) => (
                <FloorLandmarkNode
                  key={el.id}
                  element={el}
                  isLayoutMode={isEditModeUnlocked}
                  isSelected={selectedLandmark?.id === el.id}
                  onDragStart={handleLandmarkDragStart}
                  onRotate={handleDrawerRotateLandmark}
                  onDelete={() => handleDrawerDeleteLandmark(el.id)}
                  onClick={() => handleSelectLandmark(el)}
                />
              ))}

              {/* Interactive Ghost Slots for Empty Canonical Grid Locations */}
              {emptyGridSlots.map((slot) => (
                <div
                  key={`ghost-${slot.slotIndex}-${slot.positionId}`}
                  style={{
                    left: `${slot.pos_x}%`,
                    top: `${slot.pos_y}%`,
                    transform: `translate(-50%, -50%)${
                      terminalScale && terminalScale !== 1 ? ` scale(${terminalScale})` : ''
                    }`,
                    transformOrigin: 'center center',
                  }}
                  className="absolute group z-10 pointer-events-auto"
                >
                  <button
                    type="button"
                    onClick={() => handleGhostSlotClick(slot)}
                    className="w-[136px] sm:w-[144px] md:w-[150px] h-[74px] sm:h-[80px] md:h-[84px] rounded-xl border-2 border-dashed border-indigo-400/30 hover:border-indigo-400 hover:scale-[1.03] bg-indigo-500/[0.04] hover:bg-indigo-500/15 backdrop-blur-2xs flex flex-col items-center justify-center p-2 text-center transition-all cursor-pointer shadow-xs hover:shadow-indigo-500/25"
                    title={`Click to provision PC at ${slot.positionId} (${slot.rowLabel})`}
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-xs">
                      <Plus className="h-4 w-4" />
                    </div>
                    <span className="font-mono text-[10.5px] font-bold text-indigo-300/80 group-hover:text-white mt-1 transition-colors">
                      {slot.suggestedHardwareLabel || slot.positionId}
                    </span>
                    <span className="text-[8.5px] text-slate-400/80 group-hover:text-slate-300 font-sans leading-tight">
                      {slot.positionId} • {slot.rowLabel.replace(' (Left)', '').replace(' (Right)', '')}
                    </span>
                  </button>
                </div>
              ))}

              {/* Living LCD Workstations */}
              {localWorkstations.map((ws) => (
                <WorkstationNode
                  key={ws.id}
                  workstation={ws}
                  isLayoutMode={isEditModeUnlocked}
                  isSelected={selectedWs?.id === ws.id}
                  terminalScale={terminalScale}
                  onDragStart={handleWorkstationDragStart}
                  onClick={() => handleSelectWorkstation(ws)}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. TECHNICAL INSPECTOR DRAWER                                  */}
      {/* ============================================================== */}
      <CadInspectorDrawer
        workstation={selectedWs}
        landmark={selectedLandmark}
        isOpen={isDrawerOpen}
        isPrivileged={isEditModeUnlocked}
        onClose={() => {
          setIsDrawerOpen(false)
          setSelectedWs(null)
          setSelectedLandmark(null)
        }}
        onUpdateWorkstation={handleDrawerUpdateWorkstation}
        onDeleteWorkstation={handleDrawerDeleteWorkstation}
        onUpdateLandmark={handleDrawerUpdateLandmark}
        onDeleteLandmark={handleDrawerDeleteLandmark}
        onRotateLandmark={handleDrawerRotateLandmark}
      />

      {/* ============================================================== */}
      {/* 4. ADD WORKSTATION MODAL                                       */}
      {/* ============================================================== */}
      {isAddWsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-2xl border border-indigo-500/30 bg-[#101726] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <Monitor className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-sm text-white">
                    Provision New Workstation
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Add a physical computing terminal to {LAB_OPTIONS.find((l) => l.id === selectedLabId)?.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddWsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div>
                <label className="block font-semibold mb-1">Terminal Hardware Label</label>
                <input
                  type="text"
                  value={newWsLabel}
                  onChange={(e) => setNewWsLabel(e.target.value)}
                  className="w-full h-8.5 rounded-xl border border-white/10 bg-[#0B0F19] px-3 font-mono font-bold text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="e.g. PC-09"
                />
              </div>

              {/* Target Grid Location Selector */}
              <div>
                <label className="block font-semibold mb-1">Target Grid Location</label>
                <Select
                  value={selectedSlotKey}
                  onChange={(e) => {
                    const val = e.target.value
                    setSelectedSlotKey(val)
                    if (val !== 'custom') {
                      const slot = emptyGridSlots.find((s) => s.positionId === val)
                      if (slot) {
                        setNewWsRow(slot.rowLabel)
                        setNewWsPositionId(slot.positionId)
                        setNewWsPos({ x: slot.pos_x, y: slot.pos_y })
                        // If label matches a standard pattern or was pre-filled, suggest slot label
                        const isTaken = localWorkstations.some(
                          (w) => w.label.toLowerCase() === slot.suggestedHardwareLabel.toLowerCase()
                        )
                        if (!isTaken) {
                          setNewWsLabel(slot.suggestedHardwareLabel)
                        }
                      }
                    }
                  }}
                  className="w-full h-8.5 bg-[#0B0F19] border-white/10 text-white rounded-xl text-xs"
                >
                  {emptyGridSlots.map((slot) => (
                    <option key={slot.positionId} value={slot.positionId}>
                      Slot {slot.positionId}: {slot.rowLabel} (Recommended: {slot.suggestedHardwareLabel})
                    </option>
                  ))}
                  <option value="custom">Manual Placement / Custom Coordinates</option>
                </Select>
              </div>

              {/* Row Assignment & Desk Position ID */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Row Assignment</label>
                  <input
                    type="text"
                    value={newWsRow}
                    onChange={(e) => setNewWsRow(e.target.value.replace(/\b\w/g, (c) => c.toUpperCase()))}
                    className="w-full h-8.5 rounded-xl border border-white/10 bg-[#0B0F19] px-3 text-slate-200 focus:border-indigo-500 focus:outline-none"
                    placeholder="e.g. Row C (Left)"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Desk Position ID</label>
                  <input
                    type="text"
                    value={newWsPositionId}
                    onChange={(e) => setNewWsPositionId(e.target.value.toUpperCase())}
                    className="w-full h-8.5 rounded-xl border border-white/10 bg-[#0B0F19] px-3 font-mono uppercase text-slate-200 focus:border-indigo-500 focus:outline-none"
                    placeholder="e.g. C1, F4"
                  />
                </div>
              </div>

              {/* CAD Canvas Coordinates */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">X Coordinate (%)</label>
                  <input
                    type="number"
                    min={2}
                    max={98}
                    step={2}
                    value={newWsPos.x}
                    onChange={(e) =>
                      setNewWsPos((prev) => ({ ...prev, x: parseFloat(e.target.value) || 0 }))
                    }
                    className="w-full h-8.5 rounded-xl border border-white/10 bg-[#0B0F19] px-3 font-mono text-slate-200 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Y Coordinate (%)</label>
                  <input
                    type="number"
                    min={2}
                    max={98}
                    step={2}
                    value={newWsPos.y}
                    onChange={(e) =>
                      setNewWsPos((prev) => ({ ...prev, y: parseFloat(e.target.value) || 0 }))
                    }
                    className="w-full h-8.5 rounded-xl border border-white/10 bg-[#0B0F19] px-3 font-mono text-slate-200 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Device Form Factor</label>
                <Select
                  value={newWsDeviceType}
                  onChange={(e) => setNewWsDeviceType(e.target.value as any)}
                  className="w-full h-8.5 bg-[#0B0F19] border-white/10 text-white rounded-xl text-xs"
                >
                  <option value="desktop">Desktop Workstation (Tower + Display)</option>
                  <option value="aio">All-In-One Terminal</option>
                  <option value="laptop">Portable Laptop Desk</option>
                  <option value="server">Server / Master Host Terminal</option>
                </Select>
              </div>

              <div className="p-2.5 rounded-xl border border-indigo-500/20 bg-indigo-500/5 text-[11px] text-indigo-300">
                Will be placed at coordinates ({newWsPos.x}%, {newWsPos.y}%) in {newWsRow || 'unassigned row'}.
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddWsModalOpen(false)}
                className="flex-1 h-8.5 rounded-xl border-white/10 text-slate-300"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isCreatingWs || !newWsLabel.trim()}
                onClick={handleCreateWorkstation}
                className="flex-1 h-8.5 font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5"
              >
                {isCreatingWs ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                <span>Provision Terminal</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. ADD LANDMARK MODAL                                          */}
      {/* ============================================================== */}
      {isAddLmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-2xl border border-indigo-500/30 bg-[#101726] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-sm text-white">
                    Place Architectural Landmark
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Add teaching podiums, interactive whiteboards, doors, or pillars
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddLmModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div>
                <label className="block font-semibold mb-1">Landmark Type</label>
                <Select
                  value={newLmType}
                  onChange={(e) => {
                    const val = e.target.value
                    setNewLmType(val)
                    const meta = FLOOR_ELEMENT_CATALOG[val]
                    if (meta) setNewLmLabel(meta.label)
                  }}
                  className="w-full h-8.5 bg-[#0B0F19] border-white/10 text-white rounded-xl text-xs"
                >
                  {Object.entries(FLOOR_ELEMENT_CATALOG).map(([key, meta]) => (
                    <option key={key} value={key}>
                      {meta.label} ({meta.category})
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Display Label</label>
                <input
                  type="text"
                  value={newLmLabel}
                  onChange={(e) => setNewLmLabel(e.target.value)}
                  className="w-full h-8.5 rounded-xl border border-white/10 bg-[#0B0F19] px-3 text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="e.g. Interactive Whiteboard"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddLmModalOpen(false)}
                className="flex-1 h-8.5 rounded-xl border-white/10 text-slate-300"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isCreatingLm || !newLmLabel.trim()}
                onClick={handleCreateLandmark}
                className="flex-1 h-8.5 font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5"
              >
                {isCreatingLm ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                <span>Place Landmark</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 6. SAVE CUSTOM LAYOUT MODAL (Default Immutability Guard)        */}
      {/* ============================================================== */}
      {isSaveLayoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-2xl border border-indigo-500/30 bg-[#101726] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <Bookmark className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-sm text-white">
                    {saveLayoutMode === 'default_or_new' ? 'Save as Custom Layout or Default' : 'Save Layout Modifications'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {saveLayoutMode === 'default_or_new'
                      ? 'Update the institutional default baseline or save as a custom layout preset.'
                      : 'Choose whether to update your existing preset, create a new one, or promote to default.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSaveLayoutModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {saveLayoutMode === 'default_or_new' ? (
              <div className="space-y-4 text-xs text-slate-300">
                {/* Option 1: Update Institutional Default Layout */}
                <div className="p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/10 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-300 text-xs">
                          Option 1: Update Institutional Default Layout
                        </span>
                        <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-300 bg-amber-500/20 px-1.5 py-0 font-mono">
                          Permanent Baseline
                        </Badge>
                      </div>
                      <p className="text-[11px] text-amber-200/90 mt-1 leading-relaxed">
                        Warning: This will modify the official default layout in the database. All live lab sessions, student seating plans, and default layout resets will reflect these updated workstation coordinates.
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    disabled={isSaving}
                    onClick={handleConfirmUpdateInstitutionalDefault}
                    className="w-full h-8.5 font-bold rounded-xl bg-amber-600 hover:bg-amber-500 text-white gap-1.5 shadow-xs cursor-pointer"
                  >
                    {isSaving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    <span>Confirm &amp; Update Institutional Default</span>
                  </Button>
                </div>

                {/* Option 2: Save as Custom Preset */}
                <div className="p-3.5 rounded-xl border border-white/10 bg-[#151E32] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">Option 2: Save as Custom Layout</span>
                    <span className="text-[10.5px] font-mono text-emerald-400">New Preset</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Preserves the default baseline untouched and saves your current layout as a custom preset.
                  </p>
                  <div>
                    <label className="block font-semibold mb-1 text-slate-200 text-[11px]">Preset Name</label>
                    <input
                      type="text"
                      value={customPresetName}
                      onChange={(e) => setCustomPresetName(e.target.value)}
                      className="w-full h-8.5 rounded-xl border border-white/10 bg-[#0B0F19] px-3 text-white focus:border-indigo-500 focus:outline-none"
                      placeholder="e.g. Custom 1"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={isSaving || !customPresetName.trim()}
                    onClick={() => handleConfirmSaveLayout(customPresetName)}
                    className="w-full h-8.5 font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 shadow-xs cursor-pointer"
                  >
                    {isSaving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Bookmark className="h-3.5 w-3.5" />
                    )}
                    <span>Save as Custom Layout</span>
                  </Button>
                </div>

                <div className="pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsSaveLayoutModalOpen(false)}
                    className="w-full h-8.5 rounded-xl border-white/10 text-slate-300"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs text-slate-300">
                {/* Option 1: Update Existing Preset in Place */}
                <div className="p-3 rounded-xl border border-white/10 bg-[#151E32] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">Option 1: Update Current Preset</span>
                    <span className="text-[10.5px] font-mono text-indigo-400">Overwrite</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Saves current positions directly into &ldquo;{savedTemplates.find((t) => t.id === selectedPreset.replace('tpl_', ''))?.name || 'Current Preset'}&rdquo;.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    disabled={isSaving}
                    onClick={handleConfirmUpdateExistingLayout}
                    className="w-full h-8.5 font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5 cursor-pointer"
                  >
                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    <span>Update &ldquo;{savedTemplates.find((t) => t.id === selectedPreset.replace('tpl_', ''))?.name || 'Current Preset'}&rdquo;</span>
                  </Button>
                </div>

                {/* Option 2: Save as New Layout */}
                <div className="p-3 rounded-xl border border-white/10 bg-[#151E32] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">Option 2: Save as New Layout</span>
                    <span className="text-[10.5px] font-mono text-emerald-400">New Preset</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Keeps the current preset unchanged and creates an additional preset.
                  </p>
                  <div>
                    <label className="block font-semibold mb-1 text-slate-200">New Preset Name</label>
                    <input
                      type="text"
                      value={customPresetName}
                      onChange={(e) => setCustomPresetName(e.target.value)}
                      className="w-full h-8.5 rounded-xl border border-white/10 bg-[#0B0F19] px-3 text-white focus:border-indigo-500 focus:outline-none"
                      placeholder="e.g. Custom 2"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={isSaving || !customPresetName.trim()}
                    onClick={() => handleConfirmSaveLayout(customPresetName)}
                    className="w-full h-8.5 font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 cursor-pointer"
                  >
                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    <span>Save as New Preset</span>
                  </Button>
                </div>

                {/* Option 3: Promote to Institutional Default */}
                <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-300">Option 3: Set as Institutional Default</span>
                    <span className="text-[10.5px] font-mono text-amber-400">Set Default</span>
                  </div>
                  <p className="text-[11px] text-amber-200/90 leading-relaxed">
                    Warning: Promotes this layout to be the institutional default baseline in the database for all future classes and resets.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    disabled={isSaving}
                    onClick={handleConfirmUpdateInstitutionalDefault}
                    className="w-full h-8.5 font-bold rounded-xl bg-amber-600 hover:bg-amber-500 text-white gap-1.5 cursor-pointer"
                  >
                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    <span>Promote to Institutional Default</span>
                  </Button>
                </div>

                <div className="pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsSaveLayoutModalOpen(false)}
                    className="w-full h-8.5 rounded-xl border-white/10 text-slate-300"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 7. CUSTOM ROOM GRID BUILDER MODAL (Decluttered & Streamlined)   */}
      {/* ============================================================== */}
      {isCustomGridModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-2xl border border-indigo-500/30 bg-[#101726] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <SlidersHorizontal className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="font-heading font-extrabold text-sm text-white">
                    Custom Room Grid Generator
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Quickly configure room corridor wings, rows, and desk counts
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomGridModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Grid Configuration Controls */}
            <div className="space-y-4 text-xs text-slate-300">
              {/* Corridor Layout */}
              <div>
                <label className="block font-semibold mb-1.5 text-slate-200">Room Corridor Structure</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { s: 2 as const, title: '2 Sides (Dual Wings)', desc: 'Center walking aisle (standard)' },
                    { s: 1 as const, title: '1 Single Block', desc: 'Continuous rows across room' },
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
                        {customSides === opt.s && <span className="h-2 w-2 rounded-full bg-indigo-400" />}
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5 leading-tight">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Rows */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block font-semibold text-slate-200">Number of Rows</label>
                  <span className="text-[11px] font-mono font-bold text-indigo-400">{customRows} Rows</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[2, 3, 4, 5, 6, 7, 8].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setCustomRows(r)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                        customRows === r
                          ? 'bg-indigo-600 text-white'
                          : 'bg-[#151E32] text-slate-400 border border-white/5 hover:text-white'
                      }`}
                    >
                      {r}R
                    </button>
                  ))}
                </div>
              </div>

              {/* Columns */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block font-semibold text-slate-200">
                    {customSides === 2 ? 'Desks per Row (per Side)' : 'Desks per Row'}
                  </label>
                  <span className="text-[11px] font-mono font-bold text-indigo-400">{customCols} Desks</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[2, 3, 4, 5, 6].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCustomCols(c)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                        customCols === c
                          ? 'bg-indigo-600 text-white'
                          : 'bg-[#151E32] text-slate-400 border border-white/5 hover:text-white'
                      }`}
                    >
                      {c} Desks
                    </button>
                  ))}
                </div>
              </div>

              {/* Capacity Calculation */}
              <div className="p-3 rounded-xl border border-indigo-500/25 bg-indigo-500/10 flex items-center justify-between text-xs text-indigo-300">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-400 shrink-0" />
                  <span>
                    Total Capacity: <strong className="text-white font-mono text-sm">{customSides * customRows * customCols} Desks</strong>
                    <span className="text-[10px] text-indigo-400/80 block">
                      ({customSides} {customSides === 1 ? 'block' : 'sides'} &times; {customRows} rows &times; {customCols} desks)
                    </span>
                  </span>
                </div>
                <Badge className="bg-indigo-500/20 text-indigo-300 text-[10px] font-mono">
                  {localWorkstations.length} PCs active
                </Badge>
              </div>

              {/* Save as Named Layout Preset */}
              <div className="pt-2 border-t border-white/10 space-y-1.5">
                <label className="block font-semibold text-slate-200">Save as Named Preset (Optional)</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g. Exam Setup or 36-Desk Layout"
                  className="w-full h-8.5 rounded-xl border border-white/10 bg-[#0B0F19] px-3 text-white placeholder:text-slate-500 text-xs focus:border-indigo-500 focus:outline-none"
                />
                <p className="text-[10.5px] text-slate-400">
                  If entered, this layout is automatically saved to your Presets dropdown.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCustomGridModalOpen(false)}
                className="flex-1 h-8.5 rounded-xl border-white/10 text-slate-300"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleApplyCustomGrid}
                className="flex-1 h-8.5 font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5 shadow-xs"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Apply Custom Grid</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
