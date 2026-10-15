# Task 34: Unified Workstation Sidebar Drawer (Roll-Call, Assistance, Triage & Reporting)

**Task ID**: `2026-10-13-task-34-unified-workstation-sidebar-drawer`  
**Execution Date**: October 13, 2026  
**Status**: Completed  
**Author**: Antigravity Pair Programming Agent  

---

## 1. Context & Motivation

Previously, interacting with a workstation terminal on the CAD floor plan in `/computer-lab` opened a floating center modal popup (`StationQuickPopover`). If the user clicked "Report Fault" inside that popup, a separate slide-over right sidebar drawer (`WorkstationIssueDrawer`) would open over or behind it.

This workflow suffered from several key friction points:
1. **Modal Duplication / Disjointed Flow**: The user had to click a terminal, open a popup, click "Report Fault", which opened a sidebar drawer showing reported faults and problem reporting.
2. **Floor Plan Canvas Occlusion**: The floating center modal box obstructed the middle of the CAD floor plan, making it impossible to see other desks or monitor overall lab state while taking attendance or inspecting faults.
3. **Repetitive Interactions**: Switching between Roll-Call, reviewing active student assistance requests, checking database faults, and submitting new problem tickets required opening and closing multiple separate dialogs.

The user proposed unifying all workstation tasks into a single slide-over right sidebar drawer.

---

## 2. Key Architectural Invariants & Changes

### A. Unified Multi-Tab Workstation Sidebar Drawer (`components/maintenance/workstations/workstation-issue-drawer.tsx`)
- Elevated `WorkstationIssueDrawer` into the comprehensive **Unified Workstation Sidebar Drawer** supporting 3 cohesive tabs:
  1. **Tab 1: Roll-Call & Seating** (`UserCheck` icon):
     - Displays seated student profile photo/initials avatar, full name, roll number, and class stream.
     - Single-tap **[Mark Present]** (Emerald) and **[Mark Absent]** (Rose) buttons with real-time feedback.
     - **Tier 2 Temporary Seat Reassignment**: Dropdown listing available operational vacant PCs + stations with absent students, with a 1-click confirmation button.
     - Distinguishes between baseline cohort allocation vs. temporary relocation (Tier 2 session override).
     - Direct link: `Open Student Terminal Gateway`.
  2. **Tab 2: Active Issues & Assistance ({activeCount})** (`AlertTriangle` icon):
     - Displays real-time student assistance requests with pulsing radar beacon, student name, roll number, quote, and **[Acknowledge]** action button.
     - Displays logged database fault tickets with category pills, severity badges, photo evidence, reporter info, and **[Resolve & Certify Fix]** action.
     - Direct button to Maintenance Workbench: `<Link href="/maintenance?search=..."><Button>Open Maintenance Workbench</Button></Link>`.
     - Clean empty state: "All Diagnostics Normal" when 0 issues.
  3. **Tab 3: Report Problem** (`Wrench` icon):
     - Quick 1-tap issue presets ("No Display / Monitor Blackout", "Windows BSOD", "LAN Cable Fault", etc.).
     - Hardware fault category dropdown.
     - Title input, description textarea, and 4-tier severity selector (`low`, `medium`, `high`, `critical`).
     - Photo evidence upload (`WorkstationPhotoCapture`).
     - Submit problem report action button.

### B. Smart Tab Default
- When opening the drawer on any workstation:
  - If the workstation has active issues or an active student help request &rarr; automatically opens on **Active Issues**.
  - Else if during an active session with an assigned student &rarr; automatically opens on **Roll-Call**.
  - Else &rarr; defaults to **Active Issues** (or **Report Problem**).
- Instructors can flip between tabs in 1 click without closing the drawer.

### C. Live Workspace Integration (`components/computer-lab/computer-lab-workspace.tsx`)
- **Direct Drawer Trigger**: In `handleWorkstationClick`, clicking any terminal directly opens `WorkstationIssueDrawer` on the right side.
- **Canvas Stays Visible**: The CAD floor plan remains fully visible on the left.
- **Seamless Node Switching**: Clicking another PC on the floor plan immediately updates the sidebar drawer to inspect that PC and moves the selection halo without opening new popups.
- Completely retired the center popup modal (`StationQuickPopover`) in the operational workspace.

### D. Real-Time Auto-Refresh, Backdrop Click Dismissal & Reactive Synchronization
- **Dynamic Workstation Derivation (`activeDrawerWorkstation`)**: Replaced stale static state snapshots with a reactive `useMemo` selector in `computer-lab-workspace.tsx` that binds `selectedWorkstationId` against live `boardData.workstations` and `sessionContext.seatPlan`. Whenever sessions or workstation records update, the drawer automatically reflects fresh assignments, status, and tickets without closing and reopening.
- **Instant Optimistic Issue Resolution**: In `handleResolveIssue`, resolved issue IDs are tracked locally in `resolvedIssueIds` and excluded from `activeIssues` immediately upon confirmation. `await onSuccess()` triggers parallel re-fetch via `refreshLiveSessionAndBoard()`.
- **Automatic Seating Relocation Refresh**: When a student is temporarily reassigned to another station, `assignSessionSeatOverride` and `refreshLiveSessionAndBoard()` run immediately. The vacated station instantly flips to "Station Available / Unassigned" and destination stations update their capacity.
- **Backdrop Click & Escape Dismissal**: The fixed backdrop overlay now handles `onClick={onClose}` (with `e.stopPropagation()` on the drawer panel) and window `keydown` handles `Escape` key dismissal, allowing users to close the drawer with a single click outside or tap on Escape.
- **Displaced Student Quick Seat**: When viewing an unassigned workstation, instructors can directly assign any displaced student (from broken or unallocated PCs) via a dedicated dropdown and 1-tap "Seat Here" action.

---

## 3. Verification & Test Evidence

1. **Test Suites**:
   - `tests/cad-floor-architect.test.mjs`: All 9/9 tests passed.
   - `tests/floor-plan-status-sync.test.mjs`: All 8/8 tests passed.
   - `tests/temporary-relocation-and-terminal.test.mjs`: All 7/7 tests passed.
   - `tests/unified-session-modal-and-standby-cockpit.test.mjs`: All 8/8 tests passed.
   - **Total 32/32 tests passed**.
2. **TypeScript Compilation**:
   - `npx tsc --noEmit` executed with **0 errors**.
3. **Institutional Standards Compliance**:
   - Rule 1: No literal `+` in buttons (all icons use Lucide `<Plus />`, `<Wrench />`, etc.).
   - Rule 3: `Precaution Active` safety lock intact.
   - Rule 8: Strict TypeScript mode verified.
