import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

describe('Floor Plan Navigation, Live Status Dot & Workspace Telemetry Suite', () => {
  it('Sidebar Navigation: CollapsibleSidebar renames item to Floor Plan and renders live status dot', () => {
    const sidebarPath = path.resolve(process.cwd(), 'components/layout/collapsible-sidebar.tsx')
    const content = fs.readFileSync(sidebarPath, 'utf8')

    assert.ok(content.includes("label: 'Floor Plan'"), 'Sidebar must define label: Floor Plan')
    assert.ok(content.includes("shortLabel: 'Floor Plan'"), 'Sidebar must define shortLabel: Floor Plan')
    assert.ok(content.includes("href: '/computer-lab'"), 'Sidebar route must link to /computer-lab')
    assert.ok(content.includes('useInfrastructureState'), 'Sidebar must use useInfrastructureState for live lab status')
    assert.ok(content.includes('isOperational'), 'Sidebar must compute isOperational')
    assert.ok(content.includes('bg-emerald-500'), 'Sidebar must render emerald status dot for operational')
  })

  it('Mobile Navigation: MobileNav renames item to Floor Plan and renders live status dot', () => {
    const mobileNavPath = path.resolve(process.cwd(), 'components/layout/mobile-nav.tsx')
    const content = fs.readFileSync(mobileNavPath, 'utf8')

    assert.ok(content.includes("label: 'Floor Plan', href: '/computer-lab'"), 'MobileNav must label item Floor Plan')
    assert.ok(content.includes('useInfrastructureState'), 'MobileNav must use useInfrastructureState for live lab status')
    assert.ok(content.includes("item.href === '/computer-lab'"), 'MobileNav must conditionally render status dot for /computer-lab')
  })

  it('Sidebar Nav: sidebar-nav.tsx renames item to Floor Plan and renders live status dot', () => {
    const sidebarNavPath = path.resolve(process.cwd(), 'components/layout/sidebar-nav.tsx')
    const content = fs.readFileSync(sidebarNavPath, 'utf8')

    assert.ok(content.includes("label: 'Floor Plan'"), 'SidebarNav must define label: Floor Plan')
    assert.ok(content.includes('useInfrastructureState'), 'SidebarNav must use useInfrastructureState')
  })

  it('Command Palette: CommandPalette includes direct Floor Plan shortcut', () => {
    const palettePath = path.resolve(process.cwd(), 'components/command-palette.tsx')
    const content = fs.readFileSync(palettePath, 'utf8')

    assert.ok(content.includes("router.push('/computer-lab')"), 'CommandPalette must include /computer-lab route')
    assert.ok(content.includes('FLOOR PLAN'), 'CommandPalette must display FLOOR PLAN action')
  })

  it('Floor Plan Page: app/(dashboard)/computer-lab/page.tsx queries lab facility status and updates metadata', () => {
    const pagePath = path.resolve(process.cwd(), 'app/(dashboard)/computer-lab/page.tsx')
    const content = fs.readFileSync(pagePath, 'utf8')

    assert.ok(content.includes('Floor Plan & Cockpit'), 'Metadata title must be Floor Plan & Cockpit')
    assert.ok(content.includes('initialLabFacility'), 'Page must fetch and pass initialLabFacility')
    assert.ok(content.includes("SELECT id, name, code, capacity, type, status, is_active FROM public.labs WHERE id = $1"), 'Page must query public.labs for facility status')
  })

  it('Floor Plan Workspace: ComputerLabWorkspace displays dynamic lab status badge and high-density telemetry', () => {
    const workspacePath = path.resolve(process.cwd(), 'components/computer-lab/computer-lab-workspace.tsx')
    const content = fs.readFileSync(workspacePath, 'utf8')

    assert.ok(content.includes('Floor Plan &amp; Live Cockpit') || content.includes('Floor Plan & Live Cockpit'), 'Header title must be Floor Plan & Live Cockpit')
    assert.ok(content.includes('useInfrastructureState'), 'Workspace must hook into useInfrastructureState for realtime updates')
    assert.ok(content.includes('currentLab.status ==='), 'Workspace must branch on currentLab.status')
    assert.ok(content.includes('Operational'), 'Workspace must render Operational status badge')
    assert.ok(content.includes('Under Maintenance'), 'Workspace must render Under Maintenance status badge')
    assert.ok(content.includes('Total Stations'), 'Telemetry strip must display Total Stations')
    assert.ok(content.includes('Flagged Issues'), 'Telemetry strip must display Flagged Issues')
    assert.ok(content.includes('Under Repair'), 'Telemetry strip must display Under Repair')
  })

  it('Floor Plan Workspace: Simulated Time Engine integration and ambient indicators', () => {
    const workspacePath = path.resolve(process.cwd(), 'components/computer-lab/computer-lab-workspace.tsx')
    const content = fs.readFileSync(workspacePath, 'utf8')

    assert.ok(content.includes('TIME_TRAVEL_EVENT'), 'Workspace must listen for TIME_TRAVEL_EVENT')
    assert.ok(content.includes('getEffectiveDate'), 'Workspace must retrieve effective simulated date')
    assert.ok(content.includes('isSimulatingTime'), 'Workspace must track active simulated time state')
    assert.ok(content.includes('SIMULATED TIME ACTIVE'), 'Workspace must display ambient simulated time strip when active')
    assert.ok(content.includes('liveOngoingSession'), 'Workspace must compute live ongoing session based on simulated minutes')
    assert.ok(content.includes('DisplacedStudentsQueue'), 'Workspace must render displaced students queue when workstations are faulted')
  })

  it('Unified Workstation Issue Drawer: StationQuickPopover and BaselineSeating route to img3 modal', () => {
    const popoverPath = path.resolve(process.cwd(), 'components/computer-lab/station-quick-popover.tsx')
    const popoverContent = fs.readFileSync(popoverPath, 'utf8')
    assert.ok(popoverContent.includes('onOpenIssueDrawer'), 'StationQuickPopover must accept onOpenIssueDrawer prop')

    const workspacePath = path.resolve(process.cwd(), 'components/computer-lab/computer-lab-workspace.tsx')
    const workspaceContent = fs.readFileSync(workspacePath, 'utf8')
    assert.ok(workspaceContent.includes('WorkstationIssueDrawer'), 'Workspace must mount WorkstationIssueDrawer')
    assert.ok(workspaceContent.includes('setIsIssueDrawerOpen(true)'), 'Opening issue drawer must set isIssueDrawerOpen to true')
  })
})

