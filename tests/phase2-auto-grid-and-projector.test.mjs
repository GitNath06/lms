import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  calculateAutoArrangement,
  calculateCustomRoomLayout,
  generateRoomGridSlots,
  snapCoordinate,
  sortWorkstationsByLabel,
  LAYOUT_PRESETS,
} from '../lib/workstations/layout-engine.ts'

describe('Phase 2: Auto-Grid Layout & Big-Screen Projection Screen Suite', () => {
  it('Layout Engine: snapCoordinate clamps coordinates and applies mathematical grid steps', () => {
    assert.equal(snapCoordinate(12.3, 2), 12)
    assert.equal(snapCoordinate(13.1, 2), 14)
    assert.equal(snapCoordinate(22.8, 4), 24)
    assert.equal(snapCoordinate(0.5, 2), 2, 'Must clamp minimum coordinate to 2%')
    assert.equal(snapCoordinate(99.5, 2), 98, 'Must clamp maximum coordinate to 98%')
  })

  it('Layout Engine: sortWorkstationsByLabel separates teacher pod from numbered student PCs', () => {
    const raw = [
      { id: '1', label: 'PC-10' },
      { id: '2', label: 'PC-02' },
      { id: '3', label: 'Teacher-01' },
      { id: '4', label: 'PC-01' },
    ]
    const { teacherNodes, studentNodes } = sortWorkstationsByLabel(raw)

    assert.equal(teacherNodes.length, 1)
    assert.equal(teacherNodes[0].label, 'Teacher-01')
    assert.equal(studentNodes.length, 3)
    assert.equal(studentNodes[0].label, 'PC-01')
    assert.equal(studentNodes[1].label, 'PC-02')
    assert.equal(studentNodes[2].label, 'PC-10')
  })

  it('Layout Engine: calculateAutoArrangement (rows_4x8) arranges 34 terminals across 4 rows and teacher podium', () => {
    const testStations = Array.from({ length: 33 }, (_, i) => ({
      id: `station-${i + 1}`,
      label: `PC-${String(i + 1).padStart(2, '0')}`,
    }))
    testStations.push({ id: 'teacher-podium', label: 'Teacher-01' })

    const updates = calculateAutoArrangement(testStations, 'rows_4x8', 2)
    assert.equal(updates.length, 34)

    const teacher = updates.find((u) => u.label === 'Teacher-01')
    assert.ok(teacher)
    assert.equal(teacher.pos_x, 50)
    assert.equal(teacher.pos_y, 12)
    assert.equal(teacher.row_label, 'Teacher Podium')

    // Verify 4 distinct rows
    const studentRows = new Set(updates.filter((u) => u.label !== 'Teacher-01').map((u) => u.row_label))
    assert.deepEqual(Array.from(studentRows).sort(), ['Row A', 'Row B', 'Row C', 'Row D'].sort())
  })

  it('Layout Engine: calculateAutoArrangement (rows_5x10) arranges 50 terminals across 5 compact rows', () => {
    const testStations = Array.from({ length: 50 }, (_, i) => ({
      id: `station-${i + 1}`,
      label: `PC-${String(i + 1).padStart(2, '0')}`,
    }))

    const updates = calculateAutoArrangement(testStations, 'rows_5x10', 2)
    assert.equal(updates.length, 50)

    const studentRows = new Set(updates.map((u) => u.row_label))
    assert.deepEqual(Array.from(studentRows).sort(), ['Row A', 'Row B', 'Row C', 'Row D', 'Row E'].sort())
  })

  it('Layout Engine: calculateAutoArrangement (dual_islands) separates left and right pods with central aisle', () => {
    const testStations = Array.from({ length: 32 }, (_, i) => ({
      id: `station-${i + 1}`,
      label: `PC-${String(i + 1).padStart(2, '0')}`,
    }))

    const updates = calculateAutoArrangement(testStations, 'dual_islands', 2)
    assert.equal(updates.length, 32)

    const leftPod = updates.filter((u) => u.row_label?.includes('Left Pod'))
    const rightPod = updates.filter((u) => u.row_label?.includes('Right Pod'))

    assert.equal(leftPod.length, 16)
    assert.equal(rightPod.length, 16)

    // Left pod X coordinates must be <= 42%, Right pod X coordinates must be >= 58%
    leftPod.forEach((node) => assert.ok(node.pos_x <= 42, `Left pod station ${node.label} at ${node.pos_x}% exceeds 42%`))
    rightPod.forEach((node) => assert.ok(node.pos_x >= 58, `Right pod station ${node.label} at ${node.pos_x}% is below 58%`))
  })

  it('Server Actions: app/actions/workstations.ts exports batchUpdateWorkstationPositions and applyAutoArrangementLayout', () => {
    const actionsPath = path.resolve(process.cwd(), 'app/actions/workstations.ts')
    const content = fs.readFileSync(actionsPath, 'utf8')

    assert.ok(content.includes('export async function batchUpdateWorkstationPositions'), 'Must export batchUpdateWorkstationPositions')
    assert.ok(content.includes('export async function applyAutoArrangementLayout'), 'Must export applyAutoArrangementLayout')
    assert.ok(content.includes("revalidatePath('/computer-lab')"), 'Must revalidate /computer-lab')
    assert.ok(content.includes("revalidatePath('/computer-lab/projector')"), 'Must revalidate /computer-lab/projector')
  })

  it('WorkstationNode Component: Supports density="projector", larger photo avatars, and layout drag coordinates', () => {
    const nodePath = path.resolve(process.cwd(), 'components/maintenance/workstations/workstation-node.tsx')
    const content = fs.readFileSync(nodePath, 'utf8')

    assert.ok(content.includes("density?: 'standard' | 'compact' | 'projector'"), 'Must support density prop')
    assert.ok(content.includes('isLayoutMode'), 'Must support isLayoutMode prop')
    assert.ok(content.includes('photo_url'), 'Must render student photo avatar')
    assert.ok(content.includes('R-'), 'Must render Roll Number pill')
    assert.ok(content.includes('cursor-grab'), 'Must render grab cursor in layout mode')
  })

  it('LayoutEditorBar Component: Provides presets, grid snapping, and save/cancel actions', () => {
    const barPath = path.resolve(process.cwd(), 'components/computer-lab/layout-editor-bar.tsx')
    const content = fs.readFileSync(barPath, 'utf8')

    assert.ok(content.includes('Floor Plan Layout Editor'), 'Must display title')
    assert.ok(content.includes('LAYOUT_PRESETS'), 'Must bind LAYOUT_PRESETS')
    assert.ok(content.includes('onApplyPreset'), 'Must trigger onApplyPreset')
    assert.ok(content.includes('onToggleSnapGrid'), 'Must toggle snap grid')
    assert.ok(content.includes('Save Layout'), 'Must provide Save Layout action')
  })

  it('Projector Mode: Dedicated component and route exist with 10s auto-refresh and wall display', () => {
    const projectorViewPath = path.resolve(process.cwd(), 'components/computer-lab/projector-view.tsx')
    const projectorPagePath = path.resolve(process.cwd(), 'app/(dashboard)/computer-lab/projector/page.tsx')

    const viewContent = fs.readFileSync(projectorViewPath, 'utf8')
    const pageContent = fs.readFileSync(projectorPagePath, 'utf8')

    assert.ok(viewContent.includes('Wall Seating Chart'), 'ProjectorView must render Wall Seating Chart header')
    assert.ok(viewContent.includes('toggleFullscreen'), 'ProjectorView must support HTML5 fullscreen')
    assert.ok(viewContent.includes('refreshLiveState'), 'ProjectorView must implement live refresh')
    assert.ok(viewContent.includes('10000'), 'ProjectorView must poll every 10 seconds')
    assert.ok(viewContent.includes('density="projector"'), 'ProjectorView must render nodes in projector density')

    assert.ok(pageContent.includes('ProjectorView'), 'Projector page must mount ProjectorView')
    assert.ok(pageContent.includes('getWorkstationBoardData'), 'Projector page must fetch workstation data')
  })

  it('Layout Engine: calculateCustomRoomLayout generates 48 terminals across 2 sides (Left/Right) with A1..A8 naming', () => {
    const config = {
      sides: 2,
      rows: 6,
      columns: 4,
      rowNaming: 'letters',
      terminalNaming: 'alphanumeric',
      customRowNames: { 0: 'Row A', 1: 'Row B', 2: 'Row C', 3: 'Row D', 4: 'Row E', 5: 'Row F' },
    }

    const slots = generateRoomGridSlots(config)
    assert.equal(slots.length, 48, 'Must generate exactly 48 slots (2 sides * 6 rows * 4 cols)')

    // Check row naming and labels: Left Wing has Rows A..F, Right Wing has Rows G..L
    const leftSlots = slots.filter((s) => s.sideIndex === 0)
    const rightSlots = slots.filter((s) => s.sideIndex === 1)
    assert.equal(leftSlots.length, 24, 'Left side must have 24 terminals')
    assert.equal(rightSlots.length, 24, 'Right side must have 24 terminals')

    // Left Wing first row: A1..A4
    assert.equal(leftSlots[0].positionId, 'A1')
    assert.equal(leftSlots[3].positionId, 'A4')
    // Right Wing first row: G1..G4 (strictly 1 to 4!)
    assert.equal(rightSlots[0].positionId, 'G1')
    assert.equal(rightSlots[3].positionId, 'G4')

    // Generate mock stations to arrange
    const mockStations = Array.from({ length: 48 }, (_, i) => ({
      id: `station-${i + 1}`,
      label: `PC-${String(i + 1).padStart(2, '0')}`,
    }))

    const updates = calculateCustomRoomLayout(mockStations, config, 2)
    assert.equal(updates.length, 48)

    // Check Left Side vs Right Side coordinate distribution
    const leftSide = updates.filter((u) => u.row_label?.includes('(Left)'))
    const rightSide = updates.filter((u) => u.row_label?.includes('(Right)'))
    assert.equal(leftSide.length, 24)
    assert.equal(rightSide.length, 24)

    // Left side X should be <= 46%, Right side X should be >= 54% (central aisle)
    leftSide.forEach((u) => assert.ok(u.pos_x <= 46, `Left station ${u.label} pos_x ${u.pos_x}% should be <= 46%`))
    rightSide.forEach((u) => assert.ok(u.pos_x >= 54, `Right station ${u.label} pos_x ${u.pos_x}% should be >= 54%`))

    // Physical machine labels MUST be preserved as PC-01..PC-48
    assert.equal(leftSide[0].label, 'PC-01')
    assert.equal(leftSide[3].label, 'PC-04')
    assert.equal(rightSide[0].label, 'PC-25')
    assert.equal(rightSide[3].label, 'PC-28')

    // Position IDs stored systematically: A1..A4 for left, G1..G4 for right
    assert.equal(leftSide[0].position_id, 'A1')
    assert.equal(leftSide[3].position_id, 'A4')
    assert.equal(rightSide[0].position_id, 'G1')
    assert.equal(rightSide[3].position_id, 'G4')
  })

  it('Layout Engine: Generates flexible 3-section (Triple Pods) and 4-pod configurations', () => {
    const config3 = {
      sides: 3,
      rows: 4,
      columns: 4,
      rowNaming: 'letters',
      terminalNaming: 'alphanumeric',
    }
    const slots3 = generateRoomGridSlots(config3)
    assert.equal(slots3.length, 48, '3 sides * 4 rows * 4 cols = 48 slots')
    // Section 1 (Left): Rows A..D (A1..A4)
    assert.equal(slots3[0].positionId, 'A1')
    assert.equal(slots3[3].positionId, 'A4')
    // Section 2 (Center): Rows E..H (E1..E4)
    assert.equal(slots3[16].positionId, 'E1')
    assert.equal(slots3[19].positionId, 'E4')
    // Section 3 (Right): Rows I..L (I1..I4)
    assert.equal(slots3[32].positionId, 'I1')
    assert.equal(slots3[35].positionId, 'I4')

    assert.ok(slots3[0].rowLabel.includes('(Left)'))
    assert.ok(slots3[16].rowLabel.includes('(Center)'))
    assert.ok(slots3[32].rowLabel.includes('(Right)'))

    const mockStations = Array.from({ length: 48 }, (_, i) => ({
      id: `station-${i + 1}`,
      label: `PC-${String(i + 1).padStart(2, '0')}`,
    }))
    const updates3 = calculateCustomRoomLayout(mockStations, config3, 2)
    assert.equal(updates3.length, 48)
    assert.equal(updates3[0].label, 'PC-01')
    assert.equal(updates3[0].position_id, 'A1')
  })

  it('Server Actions: app/actions/workstations.ts provisions using desktop device_type and collision-proof 2-pass rename', () => {
    const actionsPath = path.resolve(process.cwd(), 'app/actions/workstations.ts')
    const content = fs.readFileSync(actionsPath, 'utf8')

    assert.ok(content.includes('export async function provisionCustomGridWorkstations'), 'Must export provisionCustomGridWorkstations')
    assert.ok(content.includes("'desktop'"), "Must insert with device_type 'desktop' to satisfy check constraint")
    assert.ok(!content.includes("true, 'pc'"), "Must not insert with invalid device_type 'pc'")
    assert.ok(content.includes("SET label = '__tmp_'"), 'Must perform collision-proof temporary label update')
    assert.ok(content.includes('position_id'), 'Must support and update position_id column')
  })

  it('Layout Engine: 3-section 54-PC configuration has zero horizontal collisions and eliminates overflow piles', () => {
    const config54 = {
      sides: 3,
      rows: 6,
      columns: 3,
      rowNaming: 'letters',
      terminalNaming: 'alphanumeric',
    }
    const slots = generateRoomGridSlots(config54)
    assert.equal(slots.length, 54, 'Must generate exactly 54 slots (3 sides * 6 rows * 3 cols)')

    // Left Pod (Row A): cols 1..3
    const leftPodA = slots.filter((s) => s.sideIndex === 0 && s.rowIndex === 0)
    assert.equal(leftPodA.length, 3)
    assert.equal(leftPodA[0].positionId, 'A1')
    assert.equal(leftPodA[1].positionId, 'A2')
    assert.equal(leftPodA[2].positionId, 'A3')

    // Center Pod (Row G): cols 1..3
    const centerPodG = slots.filter((s) => s.sideIndex === 1 && s.rowIndex === 0)
    assert.equal(centerPodG.length, 3)
    assert.equal(centerPodG[0].positionId, 'G1')
    assert.equal(centerPodG[1].positionId, 'G2')
    assert.equal(centerPodG[2].positionId, 'G3')

    // Right Pod (Row M): cols 1..3
    const rightPodM = slots.filter((s) => s.sideIndex === 2 && s.rowIndex === 0)
    assert.equal(rightPodM.length, 3)
    assert.equal(rightPodM[0].positionId, 'M1')
    assert.equal(rightPodM[1].positionId, 'M2')
    assert.equal(rightPodM[2].positionId, 'M3')

    // Verify Aisle 1 (between Left and Center) and Aisle 2 (between Center and Right) >= 12%
    const aisle1 = centerPodG[0].pos_x - leftPodA[2].pos_x
    const aisle2 = rightPodM[0].pos_x - centerPodG[2].pos_x
    assert.ok(aisle1 >= 12, `Aisle 1 between Left and Center must be >= 12%, got ${aisle1}%`)
    assert.ok(aisle2 >= 12, `Aisle 2 between Center and Right must be >= 12%, got ${aisle2}%`)

    // Verify that surplus stations (e.g. 97 stations in lab) do NOT dump at 94%
    const mock97Stations = Array.from({ length: 97 }, (_, i) => ({
      id: `station-${i + 1}`,
      label: `PC-${String(i + 1).padStart(2, '0')}`,
    }))
    const updates = calculateCustomRoomLayout(mock97Stations, config54, 2)
    assert.equal(updates.length, 54, 'Must return exactly 54 grid stations and NOT dump 43 surplus at bottom')
    const reserveDump = updates.filter((u) => u.row_label === 'Reserve Stations' || u.pos_y === 94)
    assert.equal(reserveDump.length, 0, 'Zero workstations dumped in reserve or at y: 94%')
  })

  it('Server Actions & Engine: Supports named custom layout templates and architectural desk structure', () => {
    const actionsPath = path.resolve(process.cwd(), 'app/actions/workstations.ts')
    const content = fs.readFileSync(actionsPath, 'utf8')

    assert.ok(content.includes('export async function getCustomLayoutTemplates'), 'Must export getCustomLayoutTemplates')
    assert.ok(content.includes('export async function saveCustomLayoutTemplate'), 'Must export saveCustomLayoutTemplate')
    assert.ok(content.includes('export async function deleteCustomLayoutTemplate'), 'Must export deleteCustomLayoutTemplate')
    assert.ok(content.includes('public.lab_layout_templates'), 'Must query public.lab_layout_templates')

    const editorPath = path.resolve(process.cwd(), 'components/computer-lab/layout-editor-bar.tsx')
    const editorContent = fs.readFileSync(editorPath, 'utf8')
    assert.ok(editorContent.includes('savedTemplates'), 'LayoutEditorBar must accept savedTemplates prop')
    assert.ok(editorContent.includes('onSaveTemplate'), 'LayoutEditorBar must accept onSaveTemplate prop')
    assert.ok(editorContent.includes('Saved Custom Layouts'), 'Must render Saved Custom Layouts group')

    const deskOverlayPath = path.resolve(process.cwd(), 'components/computer-lab/lab-desk-structure-overlay.tsx')
    assert.ok(fs.existsSync(deskOverlayPath), 'LabDeskStructureOverlay component must exist')
  })
})

