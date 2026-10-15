# Task 33: Compact Numeric Node Badge, Station Details Popover, Persistent Glowing Aura & Maintenance Navigation

**Task ID**: `2026-10-13-task-33-compact-numeric-node-badge-details-popover-and-maintenance-navigation`  
**Execution Date**: October 13, 2026  
**Status**: Completed  
**Author**: Antigravity Pair Programming Agent  

---

## 1. Context & Motivation

In Task 31, real-time student assistance notifications were rendered as wide speech bubbles (`min-w-[210px] max-w-[260px]`) floating directly above workstation monitors on the CAD floor canvas. While functional for single terminals, on standard 48-station lab arrangements, these wide speech bubbles overlapped adjacent workstations and cluttered the instructor's visual overview.

Furthermore, instructors needed:
1. **Compact Numeric Badge on Canvas Nodes**: Declutter the canvas by replacing large speech bubbles with a sleek numeric bubble badge (e.g. `1`, `4`) indicating the count of active issues/help requests on that terminal.
2. **On-Demand Details View with 1-Tap Acknowledge**: Clicking the node opens the full details popover (`StationQuickPopover`), displaying problem title, student name & roll number, problem description quote, and the **[Acknowledge]** action button.
3. **Direct Navigation to Maintenance Workbench**: An immediate button (`Open Maintenance Workbench`) that links directly to `/maintenance?search=${workstation.label}`, allowing the lab in-charge/technician to immediately take triage and servicing actions.
4. **Persistent Glowing Aura Invariant**: Until the underlying issue ticket is either marked **resolved** or marked **under servicing** (`under_repair`), the workstation node MUST KEEP GLOWING with the ambient radar wave and pulsing aura (even after the student notification is acknowledged).

---

## 2. Key Architectural Invariants & Changes

### A. Compact Numeric Bubble Badge (`components/maintenance/workstations/workstation-node.tsx`)
- **Canvas Decluttering**: Excised the wide text speech bubble (`min-w-[210px] max-w-[260px]`).
- **Unresolved Issues Invariant**:
  ```ts
  const hasUnresolvedIssues =
    Boolean(isAssistanceRequested) ||
    isFlagged ||
    (workstation.open_issues_count ?? 0) > 0 ||
    Boolean(workstation.active_issues && workstation.active_issues.some((i) => i.status !== 'resolved'))

  const unresolvedCount = Math.max(
    (workstation.open_issues_count || 0) + (isAssistanceRequested && (!workstation.open_issues_count || workstation.open_issues_count === 0) ? 1 : 0),
    workstation.active_issues?.filter((i) => i.status !== 'resolved').length || 0,
    isAssistanceRequested ? 1 : 0
  )
  ```
- **Radiant Numeric Pill**: Positioned at `-top-3.5 -right-2` of the monitor screen, displaying a bold tabular count (`1`, `4`) with an ambient pulsing radar wave and luminous backlight aura.
- **Persistent Glow**: The amber/rose glowing aura remains active as long as `hasUnresolvedIssues && !isUnderRepair`. It is NEVER overwritten or hidden by nominal green attendance halos. When marked `under_repair`, it switches to the cyan servicing aura. Only when resolved does it return to nominal green.

### B. Station Details Popover & 1-Tap Acknowledge (`components/computer-lab/station-quick-popover.tsx`)
- Added `assistanceRequest` and `onAcknowledgeAssistance` props to `StationQuickPopoverProps`.
- Rendered an active **Help Request & Fault Details Card** right below the header:
  - Header: `Help Request • {workstation.label}` with real-time ping indicator.
  - **[Acknowledge]** Button: 1-tap dismissal of the student help ping notification.
  - Problem title, student name & roll number, and quoted description.
  - Active database fault tickets with severity pills.
  - Direct Action Button: `<Link href="/maintenance?search=..."><Button>Open Maintenance Workbench</Button></Link>`.
- Added `/maintenance` shortcut link in the popover footer as well.

### C. Live Workspace Click Integration (`components/computer-lab/computer-lab-workspace.tsx`)
- Updated `handleWorkstationClick` in Live Mode to always open `StationQuickPopover` with full workstation data, whether during active sessions or during standby/recess.
- Passed `assistanceRequest` and `onAcknowledgeAssistance` down to `StationQuickPopover`.
- Allows teachers to view issues, acknowledge student help requests, and jump to maintenance at any time.

### D. Direct Deep-Linking & Maintenance Page (`app/(dashboard)/maintenance/page.tsx`, `maintenance-client-page.tsx`, `diagnostics-triage-hub.tsx`, `cad-inspector-drawer.tsx`)
- Updated `MaintenancePage` to resolve `searchParams` (`search`, `station`, `tab`) and pass `initialSearch` and `initialTab` to `MaintenanceClientPage`.
- Updated `MaintenanceClientPage` to initialize `searchQuery` and pass `initialSearchQuery` to `DiagnosticsTriageHub`.
- When navigating to `/maintenance?search=PC-01`, the Diagnostics & Triage Hub automatically filters directly to `PC-01`, ready for 1-click servicing/resolution actions.
- Added direct `Open Maintenance Workbench` button in `CadInspectorDrawer` (`components/admin/cad-inspector-drawer.tsx`).

---

## 3. Verification & Test Evidence

1. **Test Suite Execution**:
   - `tests/cad-floor-architect.test.mjs`: Added test assertions verifying `WorkstationNode` compact numeric bubble badge, wide bubble purge, and `StationQuickPopover` detailed help request view with `Acknowledge` button and `Open Maintenance Workbench` link. All 9/9 tests passed.
   - `tests/temporary-relocation-and-terminal.test.mjs` & `tests/unified-session-modal-and-standby-cockpit.test.mjs`: All 15/15 tests passed.
2. **TypeScript Compilation**:
   - `npx tsc --noEmit` executed with 0 errors.
3. **Adherence to Institutional Standards**:
   - Rule 1: No literal `+` in buttons (all icons use Lucide `<Plus />` or `<Wrench />`).
   - Rule 3: `Precaution Active` safety lock intact.
   - Rule 8: Strict TypeScript mode verified.
