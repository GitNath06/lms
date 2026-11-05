# Task 82: Live Session Clock Sync, Lock CAD Stage Aspect Ratio, Declutter Cockpit & Seating UI, Fix Specs NaN% Bug & Streamline Report Tab

**Date**: 2026-10-26  
**Status**: Completed  
**Branch**: `master`  
**TypeScript Verification**: `npx tsc --noEmit` passed with 0 errors.

---

## 1. Context & Objectives

The institutional Computer Lab workspace (`/computer-lab`) and Workstation Issue Drawer required 6 targeted architectural and UX fixes:
1. **Clock Sync Freeze**: At 10:34 PM (break/off-hours), the cockpit banner showed past scheduled sessions (e.g. `COA-11 (02:25 - 03:10 PM)` as "Active until 03:10 PM") due to falling back onto `todaySessions[0]` whenever `liveOngoingSession` was null.
2. **CAD Monitor Overlap on Viewport Resize**: Responsive width div (`w-full`) rendered percentage coordinates (`left: 18%`, `top: 28%`) where 12% spacing shrank below 130px when the sidebar expanded or drawer opened, causing fixed-pixel workstation monitors to touch or collide.
3. **Cockpit Bar & Seating Tab Clutter**: Live Cockpit Bar displayed redundant `✓ All Present`, `⇄ Invert`, and `100% (OPTIMAL)` badges when 100% of students default to present, plus a generic `"Faculty: Assigned Faculty"` placeholder. The Workstation Drawer & Quick Popover Seating tabs had a redundant two-button row `[✓ Mark Present] [✕ Mark Absent]` for already-present students and verbose `(Empty & Operational)` suffixes in reassignment dropdowns.
4. **Fake "Agent Synced" & NaN% Math in SPECS Tab**: Workstations with empty `{}` hardware specs displayed fake `🟢 Agent Synced (v1.0.0)`, filler tags (`Verified`, `Optimal Headroom`), and `NaN% Allocated (NaN GB in use)`.
5. **Report Tab Overhead**: Teachers reporting broken equipment were forced through 3 redundant fields: 8 quick issue preset pills, a dropdown containing non-computer categories (e.g. Chemical Spills / Glassware), and a custom title input.

---

## 2. Key Changes Implemented

### Task 1: Fix Stuck / Fake Active Session Tracking
- **Files**: `components/computer-lab/computer-lab-workspace.tsx`, `components/computer-lab/live-cockpit-bar.tsx`
- **Auto-Activation Logic**: Computed `liveOngoingSession` by strictly comparing current time `currentTimeStr` against slot `start_time <= currentTimeStr && currentTimeStr < slot.end_time` on today's `dayKey`.
- **Standby Cockpit Bar**: When the current time is between periods or off-hours (and the teacher has not manually selected an ad-hoc session via `userManuallySelectedRef`), automatically renders the clean Standby Cockpit Bar showing:
  - Next Upcoming Session with countdown: `"Next: {subjectCode} • Starts in {mins}m"`
  - Quick period selector dropdown
  - 1-click **"Start Unscheduled Session"** button.

### Task 2: Lock CAD Stage Aspect Ratio (Zero PC Overlap on Resize)
- **Files**: `hooks/use-canvas-viewport.ts`, `components/computer-lab/computer-lab-workspace.tsx`, `components/admin/admin-floor-architect.tsx`
- **Fixed Logical Coordinate Stage**: Locked the inner transformed CAD canvas stage to a fixed logical coordinate size of `1360px` width by `780px` height (`style={{ width: '1360px', height: '780px', position: 'absolute', left: 0, top: 0, ...viewport.canvasTransformStyle }}`).
  - 12% horizontal spacing is permanently `163.2px` and 12% vertical spacing is permanently `93.6px`, guaranteeing a 28px+ physical gap between every PC monitor regardless of window dimensions.
- **ResizeObserver Auto-Fit**: Added a `ResizeObserver` on `viewport.containerRef` in `use-canvas-viewport.ts` that automatically recalculates scale (`Math.min(containerWidth / 1400, containerHeight / 820)`) whenever the browser resizes or the sidebar/drawer toggles.
- **Terminal Scale Integration**: Exposed `terminalScale` (80%, 100%, 120%) buttons in `CanvasControlsHud` and wired them to `WorkstationNode` scaling in both `/computer-lab` and CAD Floor Architect.

### Task 3: Declutter Live Cockpit Bar & Seating Tab Attendance Controls
- **Files**: `components/computer-lab/live-cockpit-bar.tsx`, `components/maintenance/workstations/workstation-issue-drawer.tsx`, `components/computer-lab/station-quick-popover.tsx`
- **Cockpit Bar**:
  - Removed redundant `✓ All Present`, `⇄ Invert`, and `100% (OPTIMAL)` badges.
  - Rendered subtle `Reset All to Present` link only when `absentCount > 0`.
  - Shortened active countdown badge to crisp `18m left` (or `Ends 3:10 PM`).
  - Replaced generic `"Faculty: Assigned Faculty"` placeholder with the actual instructor's name (or omitted if unassigned).
- **Seating Tabs (Drawer & Quick Popover)**:
  - Replaced side-by-side two-button row `[Mark Present] [Mark Absent]` with a single clean contextual action button: `Mark Absent` when present, `Restore to Present` when absent.
  - Stripped out verbose `(Empty & Operational)` suffixes from the temporary reassign dropdown, rendering clean station codes (`PC-04`, `PC-26`).

### Task 4: Fix Fake "Agent Synced", Redundant Header Tags & NaN% Math in SPECS Tab
- **File**: `components/maintenance/workstations/workstation-issue-drawer.tsx`
- **Drawer Header**: Removed decorative `Silicon Bound / Unbound` badge; simplified status to a single clean badge (`● Operational`, `● Flagged`, `● Under Repair`).
- **Telemetry Verification**:
  - Checked `Boolean(specs?.cpu && specs?.ram_gb)`.
  - If false (unconnected agent): Displays honest `⚪ Agent Not Connected` pill and an informative card explaining that hardware telemetry will populate automatically when the LabSync PowerShell Agent runs, along with a copyable command.
  - If true: Stripped decorative filler tags (`Cores`, `Verified`, `Optimal Headroom`, `Anti-Spoof`) and guarded disk calculations with `totalGb > 0 ? Math.round((usedGb / totalGb) * 100) : 0` to permanently eliminate `NaN%`.
  - Rendered Silicon TOFU Lock card only if `machine_guid` exists in the database.

### Task 5: Streamline the REPORT Tab for 1-Tap Teacher Speed
- **Files**: `components/maintenance/workstations/workstation-issue-drawer.tsx`, `components/computer-lab/station-quick-popover.tsx`
- **Eliminated Category Dropdown**: Completely removed the redundant "HARDWARE FAULT CATEGORY" dropdown (and filtered out chemistry/glassware categories).
- **Two Scannable Chip Rows**:
  - Row 1: `Mouse / Keyboard Fault` (med), `No Display / Black Screen` (high), `LAN / No Internet` (med), `Missing Lab Software (VS Code/Python/C++)` (low)
  - Row 2: `OS Freeze / BSOD Crash` (high), `Audio / Headphone Fault` (low), `Power / Won't Boot` (critical), `Other Issue` (med)
- **1-Tap Auto-Fill**: Selecting any preset chip instantly sets the Issue Title and default Severity. Displays the manual "Custom Issue Title" input only when `Other Issue` is selected.
- **Compact Observations**: Converted diagnostic observations to a compact 2-row optional field (`rows={2}`) and standardized submit button to `Submit Issue Report`.

---

## 3. Verification & Compliance
- `npx tsc --noEmit` passed with 0 errors.
- Adhered strictly to the repository design rules: zero literal `+` in button text, zero department regressions, and semantic colors preserved.
