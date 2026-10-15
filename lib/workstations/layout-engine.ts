/**
 * Pure Mathematical Layout Engine for Laboratory CAD Workstations
 * Conforms to Rule #13: Pure domain calculation decoupled from 'use server' RPCs.
 */

export type LayoutPresetType =
  | 'official_dual_wing'
  | 'rows_2x8'
  | 'rows_3x8'
  | 'rows_4x8'
  | 'rows_5x10'
  | 'rows_6x8'
  | 'dual_islands'
  | 'triple_islands'
  | 'u_perimeter'

export interface WorkstationPositionUpdate {
  id: string
  label: string
  position_id?: string | null
  pos_x: number
  pos_y: number
  row_label: string | null
}

export interface LayoutPresetInfo {
  id: LayoutPresetType
  title: string
  description: string
  capacityHint: string
  recommendedFor: string
}

export const LAYOUT_PRESETS: LayoutPresetInfo[] = [
  {
    id: 'official_dual_wing',
    title: 'Default Lab Layout (48 PCs)',
    description: 'Standard institutional laboratory setup: Left Wing (Rows A–F) and Right Wing (Rows G–L) with central aisle.',
    capacityHint: '48 PCs (2 Wings · 6 Rows · 4 Cols)',
    recommendedFor: 'Computer Lab 01 standard configuration',
  },
]

/**
 * Snaps a coordinate percentage to the nearest grid increment (e.g. 1%, 2%, 4%).
 */
export function snapCoordinate(val: number, snapGrid: number = 2): number {
  if (snapGrid <= 0) return Math.round(val * 10) / 10
  const snapped = Math.round(val / snapGrid) * snapGrid
  return Math.max(2, Math.min(98, Math.round(snapped * 10) / 10))
}

/**
 * Sort workstations naturally by label (PC-01, PC-02, ..., PC-10, Teacher-01 at front)
 */
export function sortWorkstationsByLabel<T extends { label: string }>(items: T[]): {
  teacherNodes: T[]
  studentNodes: T[]
} {
  const teacherNodes: T[] = []
  const studentNodes: T[] = []

  for (const item of items) {
    const lbl = item.label.toLowerCase()
    if (lbl.includes('teacher') || lbl.includes('podium') || lbl.includes('instructor')) {
      teacherNodes.push(item)
    } else {
      studentNodes.push(item)
    }
  }

  // Natural numeric sort for student PCs (PC-01, PC-2, PC-10)
  studentNodes.sort((a, b) => {
    const numA = parseInt(a.label.replace(/\D/g, '') || '0', 10)
    const numB = parseInt(b.label.replace(/\D/g, '') || '0', 10)
    if (numA !== numB) return numA - numB
    return a.label.localeCompare(b.label)
  })

  return { teacherNodes, studentNodes }
}

/**
 * Mathematically generates new workstation coordinates based on the selected layout preset.
 */
export function calculateAutoArrangement<
  T extends { id: string; label: string; row_label?: string | null; position_id?: string | null }
>(
  workstations: T[],
  preset: LayoutPresetType = 'official_dual_wing',
  snapGrid: number = 2
): WorkstationPositionUpdate[] {
  const { teacherNodes, studentNodes } = sortWorkstationsByLabel(workstations)
  const results: WorkstationPositionUpdate[] = []

  // 1. Position Teacher Podium(s)
  teacherNodes.forEach((node, idx) => {
    const posX = snapCoordinate(50 + (idx - (teacherNodes.length - 1) / 2) * 15, snapGrid)
    const posY = snapCoordinate(12, snapGrid)
    results.push({
      id: node.id,
      label: node.label,
      pos_x: posX,
      pos_y: posY,
      row_label: 'Teacher Podium',
      position_id: 'PODIUM',
    })
  })

  const N = studentNodes.length
  if (N === 0) return results

  if (preset === 'official_dual_wing') {
    const slots = generateRoomGridSlots(
      {
        sides: 2,
        rows: 6,
        columns: 4,
        rowNaming: 'letters',
        terminalNaming: 'preserve',
      },
      snapGrid
    )

    // Map canonical slots by slot index (1 to 48) and positionId (e.g. A1, C2)
    const slotByNumber = new Map<number, (typeof slots)[0]>()
    const slotByPosId = new Map<string, (typeof slots)[0]>()
    slots.forEach((s) => {
      slotByNumber.set(s.slotIndex + 1, s)
      slotByPosId.set(s.positionId.toUpperCase(), s)
    })

    const unassignedNodes: typeof studentNodes = []
    const occupiedSlotIndices = new Set<number>()

    // Place each PC directly at its corresponding canonical desk number (PC-N -> Slot N)
    // Missing/deleted PCs naturally leave their canonical slot completely empty!
    studentNodes.forEach((node) => {
      const numMatch = node.label.match(/\d+/)
      const pcNum = numMatch ? parseInt(numMatch[0], 10) : null

      let matchedSlot: (typeof slots)[0] | undefined

      if (pcNum && slotByNumber.has(pcNum) && !occupiedSlotIndices.has(pcNum)) {
        matchedSlot = slotByNumber.get(pcNum)
      } else if (
        node.position_id &&
        slotByPosId.has(String(node.position_id).toUpperCase()) &&
        !occupiedSlotIndices.has(slotByPosId.get(String(node.position_id).toUpperCase())!.slotIndex + 1)
      ) {
        matchedSlot = slotByPosId.get(String(node.position_id).toUpperCase())
      }

      if (matchedSlot) {
        occupiedSlotIndices.add(matchedSlot.slotIndex + 1)
        results.push({
          id: node.id,
          label: node.label,
          pos_x: matchedSlot.pos_x,
          pos_y: matchedSlot.pos_y,
          row_label: matchedSlot.rowLabel,
          position_id: matchedSlot.positionId,
        })
      } else {
        unassignedNodes.push(node)
      }
    })

    // For extra or out-of-range PCs (> 48 or unnumbered, e.g. PC-490):
    // NEVER put them into empty canonical 1..48 slots! They belong in extension positions aligned with columns.
    unassignedNodes.forEach((node, extraIdx) => {
      const extCol = extraIdx % 4
      const extSide = Math.floor(extraIdx / 4) % 2 // 0: left wing, 1: right wing
      const extRowIdx = Math.floor(extraIdx / 8)
      const xStart = extSide === 0 ? 6 : 58
      const xStep = 12
      const extX = snapCoordinate(xStart + extCol * xStep, snapGrid)
      const extY = snapCoordinate(100 + extRowIdx * 12, snapGrid)
      const rowName = `Row ${String.fromCharCode(77 + extRowIdx)} (Extension)`
      const posId = `EXT-${extraIdx + 1}`

      results.push({
        id: node.id,
        label: node.label,
        pos_x: extX,
        pos_y: extY,
        row_label: rowName,
        position_id: posId,
      })
    })

    return results
  }

  if (preset.startsWith('rows_')) {
    // Dynamic row preset parser: rows_2x8, rows_3x8, rows_4x8, rows_5x10, rows_6x8
    const match = preset.match(/^rows_(\d+)x(\d+)$/)
    const rowCount = match ? parseInt(match[1], 10) : 4
    const itemsPerRow = Math.ceil(N / rowCount)
    const rowYStart = rowCount > 4 ? 26 : 30
    const rowYEnd = rowCount > 4 ? 90 : 86
    const rowYStep = rowCount > 1 ? (rowYEnd - rowYStart) / (rowCount - 1) : 0
    const rowNames = Array.from({ length: rowCount }, (_, i) => `Row ${String.fromCharCode(65 + i)}`)

    studentNodes.forEach((node, idx) => {
      const rowIndex = Math.min(rowCount - 1, Math.floor(idx / itemsPerRow))
      const colIndex = idx % itemsPerRow
      const countInThisRow = Math.min(itemsPerRow, N - rowIndex * itemsPerRow)

      const xMargin = rowCount >= 5 ? 8 : 12
      const xSpan = 100 - xMargin * 2
      const xStep = countInThisRow > 1 ? xSpan / (countInThisRow - 1) : 0
      const posX = countInThisRow > 1 ? xMargin + colIndex * xStep : 50
      const posY = rowCount > 1 ? rowYStart + rowIndex * rowYStep : 58

      results.push({
        id: node.id,
        label: node.label,
        pos_x: snapCoordinate(posX, snapGrid),
        pos_y: snapCoordinate(posY, snapGrid),
        row_label: rowNames[rowIndex] || `Row ${rowIndex + 1}`,
      })
    })
  } else if (preset === 'dual_islands') {
    // Dual Islands: Left Pod and Right Pod with central walking aisle
    const rowCount = Math.max(3, Math.ceil(N / 8))
    const halfCount = Math.ceil(N / 2)
    const rowYStart = 28
    const rowYEnd = 88
    const rowYStep = (rowYEnd - rowYStart) / Math.max(1, rowCount - 1)

    studentNodes.forEach((node, idx) => {
      const isLeft = idx < halfCount
      const islandIndex = isLeft ? idx : idx - halfCount
      const islandTotal = isLeft ? halfCount : N - halfCount
      const colsPerIsland = Math.ceil(islandTotal / rowCount)

      const rowIndex = Math.min(rowCount - 1, Math.floor(islandIndex / colsPerIsland))
      const colIndex = islandIndex % colsPerIsland

      const xStart = isLeft ? 8 : 62
      const xEnd = isLeft ? 38 : 92
      const xStep = colsPerIsland > 1 ? (xEnd - xStart) / (colsPerIsland - 1) : 0
      const posX = colsPerIsland > 1 ? xStart + colIndex * xStep : (xStart + xEnd) / 2
      const posY = rowYStart + rowIndex * rowYStep

      results.push({
        id: node.id,
        label: node.label,
        pos_x: snapCoordinate(posX, snapGrid),
        pos_y: snapCoordinate(posY, snapGrid),
        row_label: `${isLeft ? 'Left Pod' : 'Right Pod'} (Row ${rowIndex + 1})`,
      })
    })
  } else if (preset === 'triple_islands') {
    // Triple Islands: Left, Center, Right pods with 2 walking corridors
    const rowCount = Math.max(3, Math.ceil(N / 12))
    const thirdCount = Math.ceil(N / 3)
    const rowYStart = 28
    const rowYEnd = 88
    const rowYStep = (rowYEnd - rowYStart) / Math.max(1, rowCount - 1)

    studentNodes.forEach((node, idx) => {
      const podIndex = Math.min(2, Math.floor(idx / thirdCount))
      const localIdx = idx - podIndex * thirdCount
      const podTotal = podIndex === 2 ? N - 2 * thirdCount : thirdCount
      const colsPerPod = Math.ceil(podTotal / rowCount)

      const rowIndex = Math.min(rowCount - 1, Math.floor(localIdx / colsPerPod))
      const colIndex = localIdx % colsPerPod

      const xSpans = [
        { start: 8, end: 28, name: 'Left Pod' },
        { start: 40, end: 60, name: 'Center Pod' },
        { start: 72, end: 92, name: 'Right Pod' },
      ]
      const { start: xStart, end: xEnd, name: podName } = xSpans[podIndex]
      const xStep = colsPerPod > 1 ? (xEnd - xStart) / (colsPerPod - 1) : 0
      const posX = colsPerPod > 1 ? xStart + colIndex * xStep : (xStart + xEnd) / 2
      const posY = rowYStart + rowIndex * rowYStep

      results.push({
        id: node.id,
        label: node.label,
        pos_x: snapCoordinate(posX, snapGrid),
        pos_y: snapCoordinate(posY, snapGrid),
        row_label: `${podName} (Row ${rowIndex + 1})`,
      })
    })
  } else if (preset === 'u_perimeter') {
    // U-Shape Perimeter (Left wall, Back wall, Right wall)
    const leftCount = Math.floor(N * 0.35)
    const rightCount = Math.floor(N * 0.35)
    const backCount = N - leftCount - rightCount

    studentNodes.forEach((node, idx) => {
      let posX = 50
      let posY = 50
      let rowLabel = 'Perimeter'

      if (idx < leftCount) {
        const step = (86 - 28) / Math.max(1, leftCount - 1)
        posX = 12
        posY = 28 + idx * step
        rowLabel = 'West Wall'
      } else if (idx < leftCount + backCount) {
        const backIdx = idx - leftCount
        const step = (88 - 12) / Math.max(1, backCount + 1)
        posX = 12 + (backIdx + 1) * step
        posY = 88
        rowLabel = 'Rear Wall'
      } else {
        const rightIdx = idx - leftCount - backCount
        const step = (86 - 28) / Math.max(1, rightCount - 1)
        posX = 88
        posY = 86 - rightIdx * step
        rowLabel = 'East Wall'
      }

      results.push({
        id: node.id,
        label: node.label,
        pos_x: snapCoordinate(posX, snapGrid),
        pos_y: snapCoordinate(posY, snapGrid),
        row_label: rowLabel,
      })
    })
  }

  return results
}

export interface CustomRoomGridConfig {
  sides: 1 | 2 | 3 | 4
  rows: number
  columns: number
  rowNaming: 'letters' | 'numbers'
  terminalNaming: 'alphanumeric' | 'sequential_pc' | 'side_prefix' | 'preserve'
  customRowNames?: Record<number, string>
  positions?: WorkstationPositionUpdate[]
}

export interface LabLayoutTemplate {
  id: string
  lab_id: string
  name: string
  description?: string | null
  config: CustomRoomGridConfig
  created_at?: string
  updated_at?: string
}

export interface CustomRoomGridSlot {
  slotIndex: number
  sideIndex: number // 0 to sides - 1
  rowIndex: number
  globalRowIndex: number
  colIndex: number
  rowLabel: string
  positionId: string // e.g. A1, A2, A3, A4, G1, G2, G3, G4...
  suggestedHardwareLabel: string // e.g. PC-01, PC-02...
  suggestedLabel: string // backwards compatibility or positionId
  pos_x: number
  pos_y: number
}

function getSideLayoutSpec(
  sideIndex: number,
  totalSides: number
): { xStart: number; xEnd: number; sideLabel: string; sidePrefix: string } {
  if (totalSides === 1) {
    return { xStart: 10, xEnd: 90, sideLabel: '', sidePrefix: '' }
  }
  if (totalSides === 2) {
    // 2 Sides (Left & Right Wings) optimized for spacious modular cubicles
    // Left Wing: 6% to 42% (12% step for 4 cols: 6%, 18%, 30%, 42%)
    // Central Walking Aisle: 42% to 58% (16% wide unobstructed corridor aligned with Teacher Podium at 50%)
    // Right Wing: 58% to 94% (12% step for 4 cols: 58%, 70%, 82%, 94%)
    if (sideIndex === 0) return { xStart: 6, xEnd: 42, sideLabel: ' (Left)', sidePrefix: 'L-' }
    return { xStart: 58, xEnd: 94, sideLabel: ' (Right)', sidePrefix: 'R-' }
  }
  if (totalSides === 3) {
    // 3 Sections (Triple Pods: Left, Center, Right) with two 12% wide walking aisles
    // Pod width = 20%, Aisles = 12% (10% even spacing between PCs)
    if (sideIndex === 0) return { xStart: 8, xEnd: 28, sideLabel: ' (Left)', sidePrefix: 'L-' }
    if (sideIndex === 1) return { xStart: 40, xEnd: 60, sideLabel: ' (Center)', sidePrefix: 'C-' }
    return { xStart: 72, xEnd: 92, sideLabel: ' (Right)', sidePrefix: 'R-' }
  }
  // totalSides === 4
  // 4 Island Pods (width 14% each) separated by 3 aisles (10% wide each)
  const spans = [
    { xStart: 7, xEnd: 21, sideLabel: ' (Pod 1)', sidePrefix: 'P1-' },
    { xStart: 31, xEnd: 45, sideLabel: ' (Pod 2)', sidePrefix: 'P2-' },
    { xStart: 55, xEnd: 69, sideLabel: ' (Pod 3)', sidePrefix: 'P3-' },
    { xStart: 79, xEnd: 93, sideLabel: ' (Pod 4)', sidePrefix: 'P4-' },
  ]
  return spans[sideIndex] || spans[0]
}

/**
 * Generates coordinate slots and systematic labels for a custom multi-row, multi-column, 1 to 4 sided room.
 * Each side has its own distinct set of rows (e.g. Left has Rows A..F with cols 1..4, Right has Rows G..L with cols 1..4).
 */
export function generateRoomGridSlots(
  config: CustomRoomGridConfig,
  snapGrid: number = 2
): CustomRoomGridSlot[] {
  const slots: CustomRoomGridSlot[] = []
  const { sides = 2, rows, columns, rowNaming, terminalNaming, customRowNames } = config

  const clampedSides = Math.max(1, Math.min(4, sides))
  const clampedRows = Math.max(1, Math.min(16, rows))
  const clampedCols = Math.max(1, Math.min(12, columns))

  const yStart = 28
  const yEnd = 88
  const yStep = clampedRows > 1 ? (yEnd - yStart) / (clampedRows - 1) : 0

  let sequentialPcIndex = 1

  // Traverse side by side so Left Pod is populated first (PC-01..PC-24, Rows A..F),
  // then Right Pod (PC-25..PC-48, Rows G..L)
  for (let s = 0; s < clampedSides; s++) {
    const { xStart, xEnd, sideLabel, sidePrefix } = getSideLayoutSpec(s, clampedSides)
    const xStep = clampedCols > 1 ? (xEnd - xStart) / (clampedCols - 1) : 0

    for (let r = 0; r < clampedRows; r++) {
      // Global row index across sections ensures each side has completely distinct row letters:
      // Side 0 (Left): r=0..5 -> globalRowIndex=0..5 -> 'A', 'B', 'C', 'D', 'E', 'F'
      // Side 1 (Right): r=0..5 -> globalRowIndex=6..11 -> 'G', 'H', 'I', 'J', 'K', 'L'
      const globalRowIndex = s * clampedRows + r
      const defaultRowChar = String.fromCharCode(65 + (globalRowIndex % 26))
      const baseRowName =
        customRowNames?.[globalRowIndex]?.trim() ||
        (rowNaming === 'letters' ? `Row ${defaultRowChar}` : `Row ${globalRowIndex + 1}`)
      const rowChar = rowNaming === 'letters' ? defaultRowChar : `R${globalRowIndex + 1}`
      const posY = snapCoordinate(clampedRows > 1 ? yStart + r * yStep : 58, snapGrid)

      for (let c = 0; c < clampedCols; c++) {
        const posX = snapCoordinate(
          clampedCols > 1 ? xStart + c * xStep : (xStart + xEnd) / 2,
          snapGrid
        )

        // Terminal place / position ID: strictly 1 to columns (e.g. 1 to 4)!
        // Left side row 0: A1, A2, A3, A4
        // Right side row 0: G1, G2, G3, G4
        const positionId = `${rowChar}${c + 1}`
        const hardwarePcLabel = `PC-${String(sequentialPcIndex).padStart(2, '0')}`

        let displayLabel = ''
        if (terminalNaming === 'alphanumeric') {
          displayLabel = positionId
        } else if (terminalNaming === 'side_prefix') {
          displayLabel = `${sidePrefix}${rowChar}${c + 1}`
        } else if (terminalNaming === 'sequential_pc') {
          displayLabel = hardwarePcLabel
        } else {
          displayLabel = hardwarePcLabel
        }

        slots.push({
          slotIndex: slots.length,
          sideIndex: s,
          rowIndex: r,
          globalRowIndex,
          colIndex: c,
          rowLabel: `${baseRowName}${sideLabel}`,
          positionId,
          suggestedHardwareLabel: hardwarePcLabel,
          suggestedLabel: displayLabel,
          pos_x: posX,
          pos_y: posY,
        })
        sequentialPcIndex++
      }
    }
  }

  return slots
}

/**
 * Calculates workstation placement, positioning, and preserves physical hardware asset names.
 */
export function calculateCustomRoomLayout<
  T extends { id: string; label: string; row_label?: string | null; position_id?: string | null }
>(
  workstations: T[],
  config: CustomRoomGridConfig,
  snapGrid: number = 2,
  applySuggestedLabels: boolean = true
): WorkstationPositionUpdate[] {
  const { teacherNodes, studentNodes } = sortWorkstationsByLabel(workstations)
  const results: WorkstationPositionUpdate[] = []

  // 1. Teacher Podium(s)
  teacherNodes.forEach((node, idx) => {
    const posX = snapCoordinate(50 + (idx - (teacherNodes.length - 1) / 2) * 15, snapGrid)
    const posY = snapCoordinate(12, snapGrid)
    results.push({
      id: node.id,
      label: node.label.toLowerCase().includes('teacher') ? node.label : 'Teacher-01',
      position_id: 'PODIUM',
      pos_x: posX,
      pos_y: posY,
      row_label: 'Teacher Podium',
    })
  })

  // 2. If config.positions contains saved explicit coordinates, respect them directly
  if (config.positions && Array.isArray(config.positions) && config.positions.length > 0) {
    const posById = new Map(config.positions.map((p) => [p.id, p]))
    const posByLabel = new Map(config.positions.map((p) => [p.label, p]))

    studentNodes.forEach((node) => {
      const match = posById.get(node.id) || posByLabel.get(node.label)
      if (match) {
        results.push({
          id: node.id,
          label: match.label || node.label,
          position_id: match.position_id || node.position_id || null,
          pos_x: match.pos_x,
          pos_y: match.pos_y,
          row_label: match.row_label || node.row_label || null,
        })
      }
    })

    if (results.length === workstations.length) {
      return results
    }
  }

  // 3. Generate Grid Slots
  const slots = generateRoomGridSlots(config, snapGrid)

  // Map slots by slot index (1 to N) and positionId (e.g. A1, C2)
  const slotByNumber = new Map<number, (typeof slots)[0]>()
  const slotByPosId = new Map<string, (typeof slots)[0]>()
  slots.forEach((s) => {
    slotByNumber.set(s.slotIndex + 1, s)
    slotByPosId.set(s.positionId.toUpperCase(), s)
  })

  const occupiedSlotIndices = new Set<number>()
  const unassignedNodes: typeof studentNodes = []
  const extensionNodes: typeof studentNodes = []

  // 4. Match student nodes with PC numbers or position_id to slots (preserving gaps!)
  studentNodes.forEach((node) => {
    const numMatch = node.label.match(/\d+/)
    const pcNum = numMatch ? parseInt(numMatch[0], 10) : null

    // If terminal number exceeds configured room slots, treat as extension terminal
    if (pcNum && pcNum > slots.length) {
      extensionNodes.push(node)
      return
    }

    let matchedSlot: (typeof slots)[0] | undefined

    if (config.terminalNaming === 'preserve' || !applySuggestedLabels) {
      if (pcNum && slotByNumber.has(pcNum) && !occupiedSlotIndices.has(pcNum)) {
        matchedSlot = slotByNumber.get(pcNum)
      } else if (
        node.position_id &&
        slotByPosId.has(String(node.position_id).toUpperCase()) &&
        !occupiedSlotIndices.has(slotByPosId.get(String(node.position_id).toUpperCase())!.slotIndex + 1)
      ) {
        matchedSlot = slotByPosId.get(String(node.position_id).toUpperCase())
      }
    }

    if (matchedSlot) {
      occupiedSlotIndices.add(matchedSlot.slotIndex + 1)
      results.push({
        id: node.id,
        label: node.label,
        position_id: matchedSlot.positionId,
        pos_x: matchedSlot.pos_x,
        pos_y: matchedSlot.pos_y,
        row_label: matchedSlot.rowLabel,
      })
    } else {
      unassignedNodes.push(node)
    }
  })

  // 5. Assign unassigned nodes to remaining available slots
  const availableSlots = slots.filter((s) => !occupiedSlotIndices.has(s.slotIndex + 1))
  let availIdx = 0

  unassignedNodes.forEach((node) => {
    if (availIdx < availableSlots.length) {
      const slot = availableSlots[availIdx++]
      occupiedSlotIndices.add(slot.slotIndex + 1)
      let machineLabel = node.label
      const isCoordinateLabel = /^[A-Z]\d+$/i.test(node.label) || /^[LR]-\w+$/i.test(node.label)
      if (isCoordinateLabel || config.terminalNaming === 'sequential_pc') {
        machineLabel = slot.suggestedHardwareLabel
      } else if (applySuggestedLabels && !node.label.startsWith('PC-')) {
        machineLabel = slot.suggestedHardwareLabel
      }

      results.push({
        id: node.id,
        label: machineLabel,
        position_id: slot.positionId,
        pos_x: slot.pos_x,
        pos_y: slot.pos_y,
        row_label: slot.rowLabel,
      })
    } else {
      extensionNodes.push(node)
    }
  })

  // 6. Out-of-range or extension nodes placed into extension positions
  extensionNodes.forEach((node, extraIdx) => {
    const extCol = extraIdx % 4
    const extSide = Math.floor(extraIdx / 4) % 2
    const extRowIdx = Math.floor(extraIdx / 8)
    const xStart = extSide === 0 ? 6 : 58
    const xStep = 12
    const extX = snapCoordinate(xStart + extCol * xStep, snapGrid)
    const extY = snapCoordinate(100 + extRowIdx * 12, snapGrid)
    const rowName = `Row ${String.fromCharCode(77 + extRowIdx)} (Extension)`
    const posId = `EXT-${extraIdx + 1}`

    results.push({
      id: node.id,
      label: node.label,
      pos_x: extX,
      pos_y: extY,
      row_label: rowName,
      position_id: posId,
    })
  })

  return results
}

export interface LabDeskRowStructure {
  id: string
  sideIndex: number
  rowIndex: number
  globalRowIndex: number
  rowName: string
  sideName: string
  xStart: number
  xEnd: number
  y: number
  width: number
}

export interface LabDeskFloorStructure {
  sidesCount: number
  rows: LabDeskRowStructure[]
  wings: Array<{
    sideIndex: number
    title: string
    subtitle: string
    xStart: number
    xEnd: number
  }>
  centralAisle?: {
    xStart: number
    xEnd: number
    xCenter: number
  } | null
}

/**
 * Computes realistic architectural desk table surfaces and wing layouts for top-view rendering.
 */
export function getLabDeskFloorStructure(
  config?: CustomRoomGridConfig
): LabDeskFloorStructure {
  const sides = config?.sides || 2
  const rows = Math.max(1, Math.min(16, config?.rows || 6))
  const cols = Math.max(1, Math.min(12, config?.columns || 4))

  const yStart = 28
  const yEnd = 88
  const yStep = rows > 1 ? (yEnd - yStart) / (rows - 1) : 0

  const rowStructures: LabDeskRowStructure[] = []
  const wings: LabDeskFloorStructure['wings'] = []

  for (let s = 0; s < sides; s++) {
    const { xStart, xEnd } = getSideLayoutSpec(s, sides)
    // Add margin around workstations so desk looks like a real physical table surface
    const deskXStart = Math.max(2, xStart - 3.5)
    const deskXEnd = Math.min(98, xEnd + 3.5)
    const deskWidth = deskXEnd - deskXStart

    const sideName =
      sides === 2
        ? s === 0 ? 'Left Pod • Wing A' : 'Right Pod • Wing B'
        : sides === 3
        ? s === 0 ? 'Left Pod' : s === 1 ? 'Center Pod' : 'Right Pod'
        : sides === 4
        ? `Pod ${s + 1}`
        : 'Main Hall'

    const startLetter = String.fromCharCode(65 + ((s * rows) % 26))
    const endLetter = String.fromCharCode(65 + ((s * rows + rows - 1) % 26))

    wings.push({
      sideIndex: s,
      title: sideName.toUpperCase(),
      subtitle: `Rows ${startLetter}–${endLetter} (${rows * cols} PCs)`,
      xStart: deskXStart,
      xEnd: deskXEnd,
    })

    for (let r = 0; r < rows; r++) {
      const globalRowIndex = s * rows + r
      const defaultRowChar = String.fromCharCode(65 + (globalRowIndex % 26))
      const rowName =
        config?.customRowNames?.[globalRowIndex]?.trim() ||
        (config?.rowNaming === 'numbers' ? `Row ${globalRowIndex + 1}` : `Row ${defaultRowChar}`)
      const posY = rows > 1 ? yStart + r * yStep : 58

      rowStructures.push({
        id: `desk_s${s}_r${r}`,
        sideIndex: s,
        rowIndex: r,
        globalRowIndex,
        rowName,
        sideName,
        xStart: deskXStart,
        xEnd: deskXEnd,
        y: posY,
        width: deskWidth,
      })
    }
  }

  const centralAisle =
    sides === 2
      ? {
          xStart: 45.5,
          xEnd: 54.5,
          xCenter: 50,
        }
      : null

  return {
    sidesCount: sides,
    rows: rowStructures,
    wings,
    centralAisle,
  }
}
