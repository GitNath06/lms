import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { calculateAutoArrangement } from '../lib/workstations/layout-engine.ts'

test('CAD Floor Architect Suite: Relocation & Enterprise Controls', async (t) => {
  const rootDir = process.cwd()

  await t.test('Admin page renders CAD Floor Architect sub-tab and dynamic component', () => {
    const adminPagePath = path.join(rootDir, 'app', '(dashboard)', 'admin', 'page.tsx')
    const content = fs.readFileSync(adminPagePath, 'utf8')

    assert.ok(
      content.includes('CAD Floor Architect'),
      'Admin page must include the renamed sub-tab "CAD Floor Architect"'
    )
    assert.ok(
      content.includes('AdminFloorArchitect'),
      'Admin page must dynamically import and mount AdminFloorArchitect'
    )
    assert.ok(
      !content.includes('Floor Designer & Grid'),
      'Old sub-tab label "Floor Designer & Grid" must be completely removed'
    )
  })

  await t.test('Daily operational /computer-lab workspace is purged of Room Layout editing mode', () => {
    const workspacePath = path.join(rootDir, 'components', 'computer-lab', 'computer-lab-workspace.tsx')
    const content = fs.readFileSync(workspacePath, 'utf8')

    assert.ok(
      content.includes("export type WorkspaceMode = 'live' | 'baseline'"),
      'WorkspaceMode must be restricted to live and baseline'
    )
    assert.ok(
      !content.includes("<span>Room Layout</span>"),
      'Room Layout switcher button must be purged from operational /computer-lab'
    )
    assert.ok(
      !content.includes("<LayoutEditorBar"),
      'LayoutEditorBar component must not be mounted in /computer-lab'
    )
  })

  await t.test('deleteWorkstation implements Smart Deletion Guard and cross-route revalidation', () => {
    const workstationsActionPath = path.join(rootDir, 'app', 'actions', 'workstations.ts')
    const content = fs.readFileSync(workstationsActionPath, 'utf8')

    assert.ok(
      content.includes('Smart Deletion Guard'),
      'deleteWorkstation must document and implement Smart Deletion Guard'
    )
    assert.ok(
      content.includes("FROM public.workstation_issues WHERE workstation_id = $1 AND status != 'resolved'"),
      'deleteWorkstation must verify that no active unresolved fault tickets exist on the workstation'
    )
    assert.ok(
      content.includes('DELETE FROM public.workstation_seat_plans WHERE workstation_id = $1'),
      'deleteWorkstation must clean up seat plan links'
    )
    assert.ok(
      content.includes('DELETE FROM public.session_seat_overrides WHERE workstation_id = $1'),
      'deleteWorkstation must clean up session seat overrides'
    )
    assert.ok(
      content.includes("revalidatePath('/admin')"),
      'deleteWorkstation must revalidate /admin'
    )
    assert.ok(
      content.includes("revalidatePath('/computer-lab')"),
      'deleteWorkstation must revalidate /computer-lab'
    )
  })

  await t.test('AdminFloorArchitect adheres to Rule 1 (no literal + in buttons) and Rule 3 (Precaution Active)', () => {
    const architectPath = path.join(rootDir, 'components', 'admin', 'admin-floor-architect.tsx')
    const content = fs.readFileSync(architectPath, 'utf8')

    // Check Rule 1: No literal '+' inside button tags
    const literalPlusRegex = /<button[^>]*>[^<]*\+[^<]*<\/button>/i
    const spanPlusRegex = /<span[^>]*>[^<]*\+[^<]*<\/span>/i
    assert.ok(
      !literalPlusRegex.test(content),
      'Rule 1 violated: No literal + in button text'
    )
    assert.ok(
      !spanPlusRegex.test(content),
      'Rule 1 violated: No literal + in span text'
    )

    // Check Rule 3: Keep Precaution Active intact
    assert.ok(
      content.includes('Precaution Active'),
      'Rule 3 violated: Precaution Active safety toggle label must be preserved intact'
    )

    // Check features: Custom Grid, Presets, Add PC, Inspector Drawer
    assert.ok(content.includes('Custom Room Grid Generator'), 'Must provide Custom Room Grid Generator')
    assert.ok(content.includes('CadInspectorDrawer'), 'Must mount CadInspectorDrawer')
    assert.ok(content.includes('Provision New Workstation'), 'Must provide Add PC modal')
    assert.ok(content.includes('Place Architectural Landmark'), 'Must provide Add Landmark modal')
  })

  await t.test('CadInspectorDrawer supports real-time editing and deletion with confirmation', () => {
    const drawerPath = path.join(rootDir, 'components', 'admin', 'cad-inspector-drawer.tsx')
    const content = fs.readFileSync(drawerPath, 'utf8')

    assert.ok(content.includes('CadInspectorDrawer'), 'Component must export CadInspectorDrawer')
    assert.ok(content.includes('Remove Workstation'), 'Must provide Remove Workstation action')
    assert.ok(content.includes('Confirm Removal of'), 'Must provide deletion confirmation prompt')
    assert.ok(content.includes('CAD Floor Coordinates'), 'Must provide X/Y coordinate steppers')
  })

  await t.test('AdminFloorArchitect provides Ghost Slots, Minimal Quick-Find, and Official Layout Presets', () => {
    const architectPath = path.join(rootDir, 'components', 'admin', 'admin-floor-architect.tsx')
    const content = fs.readFileSync(architectPath, 'utf8')

    // 1. Ghost slots rendering on canvas
    assert.ok(
      content.includes('emptyGridSlots.map'),
      'Must map and render emptyGridSlots on the CAD canvas'
    )
    assert.ok(
      content.includes('handleGhostSlotClick'),
      'Must implement handleGhostSlotClick to open modal with prefilled slot position'
    )

    // 2. Add Workstation target location inputs
    assert.ok(
      content.includes('Target Grid Location'),
      'Provision modal must provide Target Grid Location selector'
    )
    assert.ok(
      content.includes('Desk Position ID'),
      'Provision modal must provide Desk Position ID input'
    )
    assert.ok(
      content.includes('X Coordinate (%)'),
      'Provision modal must provide X Coordinate input'
    )
    assert.ok(
      content.includes('Y Coordinate (%)'),
      'Provision modal must provide Y Coordinate input'
    )

    // 3. Minimal Quick-Find Combobox (no flat select dropdown)
    assert.ok(
      content.includes('Quick-Find Combobox'),
      'Must provide Quick-Find Combobox'
    )
    assert.ok(
      content.includes('Left Wing (Rows A–F)'),
      'Quick-Find must group terminals by Left Wing (Rows A–F)'
    )
    assert.ok(
      content.includes('Right Wing (Rows G–L)'),
      'Quick-Find must group terminals by Right Wing (Rows G–L)'
    )
    assert.ok(
      !content.includes('-- Click on Canvas or Pick PC --'),
      'Old flat 48-item dropdown option "-- Click on Canvas or Pick PC --" must be purged'
    )

    // 4. Official Institutional Layout preset & custom template saving
    assert.ok(
      content.includes('official_dual_wing'),
      'Must default and support official_dual_wing preset'
    )
    assert.ok(
      content.includes('Save as Named Preset'),
      'Custom Grid modal must provide Save as Named Preset section'
    )
    assert.ok(
      content.includes('handleDeleteCustomTemplate'),
      'Must allow deleting custom layout templates'
    )
  })

  test('CAD Floor Architect: Magnetic Grid Catch, Uppercase Position IDs, and Decluttered HUD Toolbar', async () => {
    const architectPath = path.resolve('components/admin/admin-floor-architect.tsx')
    const drawerPath = path.resolve('components/admin/cad-inspector-drawer.tsx')
    const hudPath = path.resolve('components/computer-lab/canvas-controls-hud.tsx')
    const actionsPath = path.resolve('app/actions/workstations.ts')

    const architectContent = fs.readFileSync(architectPath, 'utf8')
    const drawerContent = fs.readFileSync(drawerPath, 'utf8')
    const hudContent = fs.readFileSync(hudPath, 'utf8')
    const actionsContent = fs.readFileSync(actionsPath, 'utf8')

    // 1. Magnetic Grid Snapping & Click-suppression
    assert.ok(
      architectContent.includes('justDraggedRef'),
      'Architect must track justDraggedRef to suppress drawer opening after drag release'
    )
    assert.ok(
      architectContent.includes('Magnetic Grid Snapping: Check if dropped close'),
      'Architect must execute magnetic grid snapping on pointerup'
    )
    assert.ok(
      architectContent.includes('targetSlot!.positionId') && architectContent.includes('targetSlot!.rowLabel'),
      'Architect must auto-assign targetSlot row_label and position_id on magnetic catch'
    )

    // 2. Auto-uppercase on Position ID and auto-capitalize Row Label
    assert.ok(
      drawerContent.includes('setWsPositionId(e.target.value.toUpperCase())'),
      'CadInspectorDrawer must auto-uppercase Desk Position ID upon typing'
    )
    assert.ok(
      drawerContent.includes('setWsRowLabel(e.target.value.replace('),
      'CadInspectorDrawer must auto-capitalize Row Label words upon typing'
    )
    assert.ok(
      architectContent.includes('setNewWsPositionId(e.target.value.toUpperCase())'),
      'Add Workstation modal must auto-uppercase newWsPositionId upon typing'
    )

    // 3. Toolbar decluttering & HUD embedded scale/snap
    assert.ok(
      !architectContent.includes('Enterprise Suite'),
      'Architect top bar must not include redundant Enterprise Suite badge'
    )
    assert.ok(
      hudContent.includes('terminalScale') && hudContent.includes('snapGrid'),
      'CanvasControlsHud must support terminalScale and snapGrid controls directly inside canvas'
    )
    assert.ok(
      architectContent.includes('terminalScale={terminalScale}') && architectContent.includes('snapGrid={snapGrid}'),
      'Architect must pass terminalScale and snapGrid to CanvasControlsHud'
    )

    // 4. batchUpdateWorkstationPositions accurately updates position_id and row_label
    assert.ok(
      actionsContent.includes('hasPosId = item.position_id !== undefined') &&
      actionsContent.includes('hasRow = item.row_label !== undefined'),
      'batchUpdateWorkstationPositions must verify presence of row_label and position_id'
    )
  })

  await t.test('Default Layout Immutability, Out-of-Range PC Isolation, Direct Layout Switch, and Capacity Extension', async () => {
    const architectPath = path.resolve('components/admin/admin-floor-architect.tsx')
    const architectContent = fs.readFileSync(architectPath, 'utf8')

    // 1. Direct Layout Switch & Apply Button Purge (Point 5)
    assert.ok(
      architectContent.includes('handlePresetChange(e.target.value)'),
      'Layout dropdown must trigger handlePresetChange directly upon selection'
    )
    assert.ok(
      !architectContent.includes('<span>Apply</span>'),
      'Redundant Apply button must be completely removed from top toolbar'
    )

    // 2. Default Layout Immutability & Custom Layout Preset Dialog (Point 1)
    assert.ok(
      architectContent.includes('handleInitiateSaveLayout'),
      'Save Layout action must route to handleInitiateSaveLayout'
    )
    assert.ok(
      architectContent.includes("setCustomPresetName(`Custom ${nextNum}`)"),
      'Modifying default layout must propose system-generated name like Custom 1'
    )
    assert.ok(
      architectContent.includes('Save as Custom Layout') && architectContent.includes('Update Current Preset'),
      'Save Custom Layout Modal must support create new and update existing modes'
    )

    // 3. Unsaved changes guards (Point 1)
    assert.ok(
      architectContent.includes('handleBeforeUnload'),
      'Architect must guard against window close/refresh with unsaved changes'
    )
    assert.ok(
      architectContent.includes('handleDiscardChanges') && architectContent.includes('window.confirm'),
      'Discarding changes must confirm with user if modifications are unsaved'
    )
    assert.ok(
      architectContent.includes('handleRefreshData') && architectContent.includes('window.confirm'),
      'Refreshing data must confirm with user if modifications are unsaved'
    )

    // 4. Lab Capacity Extension Row (Point 4)
    assert.ok(
      architectContent.includes("handleAddExtensionRow('left')") && architectContent.includes("handleAddExtensionRow('right')"),
      'Architect must support adding capacity extension rows to Left and Right wings'
    )
    assert.ok(
      architectContent.includes('<span>Add Row (L)</span>') && architectContent.includes('<span>(R)</span>'),
      'Add Row buttons must exist and satisfy Rule 1 (no literal + in text)'
    )

    // 5. Canonical Gaps & Out-of-Range PC Isolation (Point 3)
    // Setup test workstations: PC-01..PC-08, PC-10..PC-12 (PC-09 is missing!), plus an out-of-range PC-498
    const mockStations = [
      { id: 'ws-1', label: 'PC-01' },
      { id: 'ws-2', label: 'PC-02' },
      { id: 'ws-3', label: 'PC-03' },
      { id: 'ws-4', label: 'PC-04' },
      { id: 'ws-5', label: 'PC-05' },
      { id: 'ws-6', label: 'PC-06' },
      { id: 'ws-7', label: 'PC-07' },
      { id: 'ws-8', label: 'PC-08' },
      // PC-09 is missing!
      { id: 'ws-10', label: 'PC-10' },
      { id: 'ws-11', label: 'PC-11' },
      { id: 'ws-12', label: 'PC-12' },
      { id: 'ws-498', label: 'PC-498' }, // Out of range!
    ]

    const arranged = calculateAutoArrangement(mockStations, 'official_dual_wing', 2)

    // Verify PC-498 did NOT steal slot 9 (C1)!
    const pc498Arrangement = arranged.find((a) => a.id === 'ws-498')
    assert.ok(pc498Arrangement, 'PC-498 must be positioned')
    assert.notEqual(pc498Arrangement.position_id, 'C1', 'PC-498 must NOT steal canonical Slot 9 (C1)')
    assert.ok(
      pc498Arrangement.row_label.includes('Extension'),
      'PC-498 must be mapped to Extension row'
    )

    // 6. Reset Default Action & Canonical Layout Protection (Point 1 & img2)
    assert.ok(
      architectContent.includes('handleApplyDefaultCanonicalLayout'),
      'Architect must implement handleApplyDefaultCanonicalLayout to restore canonical dual-wing standard'
    )
    assert.ok(
      architectContent.includes('<span>Reset Default</span>'),
      'Architect must render Reset Default button in top toolbar'
    )

    // 7. Viewport Drag Pointer Safety (img3 fix)
    const viewportPath = path.resolve('hooks/use-canvas-viewport.ts')
    const viewportContent = fs.readFileSync(viewportPath, 'utf8')
    assert.ok(
      viewportContent.includes('const dragStart = dragStartRef.current') &&
      viewportContent.includes('if (!isPanning || !dragStart) return'),
      'useCanvasViewport must safely capture dragStart to prevent TypeError: Cannot read properties of null (reading panX)'
    )

    // 8. Workstation Node Compact Numeric Bubble Badge & Persistent Glow Invariant
    const nodePath = path.resolve('components/maintenance/workstations/workstation-node.tsx')
    const nodeContent = fs.readFileSync(nodePath, 'utf8')
    assert.ok(
      nodeContent.includes('assistanceRequest?:') &&
      nodeContent.includes('onAcknowledgeAssistance?:'),
      'WorkstationNode must support assistanceRequest and onAcknowledgeAssistance props'
    )
    assert.ok(
      nodeContent.includes('hasUnresolvedIssues') &&
      nodeContent.includes('unresolvedCount'),
      'WorkstationNode must calculate unresolved issues count for compact numeric badge'
    )
    assert.ok(
      nodeContent.includes('border-amber-400/80') || nodeContent.includes('border-amber-400/70'),
      'WorkstationNode must use refined ambient aura instead of harsh solid border-amber-400'
    )
    assert.ok(
      !nodeContent.includes('min-w-[210px] max-w-[260px]'),
      'WorkstationNode must purge wide speech bubble to prevent occluding adjacent canvas nodes'
    )

    // 8b. StationQuickPopover Detailed Help Request & Direct /maintenance Action
    const popoverPath = path.resolve('components/computer-lab/station-quick-popover.tsx')
    const popoverContent = fs.readFileSync(popoverPath, 'utf8')
    assert.ok(
      popoverContent.includes('Help Request') &&
      popoverContent.includes('Acknowledge'),
      'StationQuickPopover must render active help request details with 1-tap Acknowledge button upon node click'
    )
    assert.ok(
      popoverContent.includes('/maintenance?search=') &&
      popoverContent.includes('Open Maintenance Workbench'),
      'StationQuickPopover must render direct button to /maintenance workbench for instant triage actions'
    )

    // 9. Operational Workspace Top Notification Bar Removal (img1 fix)
    const liveWorkspacePath = path.resolve('components/computer-lab/computer-lab-workspace.tsx')
    const liveWorkspaceContent = fs.readFileSync(liveWorkspacePath, 'utf8')
    assert.ok(
      !liveWorkspaceContent.includes('<TerminalAssistanceQueue'),
      'Operational workspace must purge redundant top notification bar for student assistance'
    )

    // 10. Institutional Default Modification & Warning Confirmation
    assert.ok(
      architectContent.includes('handleConfirmUpdateInstitutionalDefault'),
      'Architect must implement handleConfirmUpdateInstitutionalDefault to allow modifying permanent default baseline'
    )
    assert.ok(
      architectContent.includes('Warning: This will modify the official default layout in the database') ||
      architectContent.includes('Warning: Promotes this layout to be the institutional default baseline'),
      'Save modal must display clear warning regarding permanent institutional default modification'
    )
    assert.ok(
      architectContent.includes('areWorkstationsMatching'),
      'Architect must implement areWorkstationsMatching to prevent false unsaved changes badge'
    )

    // 11. calculateCustomRoomLayout Gap Preservation for Deleted Terminals
    const { calculateCustomRoomLayout } = await import('../lib/workstations/layout-engine.ts')
    const sampleNodes = [
      { id: '1', label: 'PC-01' },
      { id: '8', label: 'PC-08' },
      { id: '10', label: 'PC-10' }, // PC-09 deleted
      { id: '25', label: 'PC-25' }, // PC-21..24 deleted
      { id: '490', label: 'PC-490' }, // Out of range
    ]
    const customConfig = {
      sides: 2,
      rows: 6,
      columns: 4,
      rowNaming: 'letters',
      terminalNaming: 'preserve',
    }
    const customArranged = calculateCustomRoomLayout(sampleNodes, customConfig)
    const pc10 = customArranged.find((a) => a.label === 'PC-10')
    const pc25 = customArranged.find((a) => a.label === 'PC-25')
    const pc490 = customArranged.find((a) => a.label === 'PC-490')

    assert.equal(pc10?.position_id, 'C2', 'PC-10 must land on slot C2 leaving C1 vacant for missing PC-09')
    assert.equal(pc25?.position_id, 'G1', 'PC-25 must land on slot G1 (Right Wing) leaving Row F vacant')
    assert.equal(pc490?.position_id, 'EXT-1', 'Out-of-range PC-490 must be placed in extension row EXT-1')
  })
})
