# LabSync LIMS — Computer Lab Operations & Live Cockpit
## Comprehensive Progress, Verification Guide & Remaining Work Blueprint

> **Date**: 2026-10-05  
> **Status**: IN ACTIVE PROGRESS  
> **Phases Completed**: Phase 2 (Auto-Grid & Wall Projection), Phase 3 (Dynamic Seating, Displaced Triage & Forensics), Navigation & Live Status Dot  
> **Phases Remaining**: Phase 1 (Zero-Login Terminal Self-Reporting & Anti-Spoofing), Phase 4 (Multi-PC Maintenance Routine Checklists)  
> **Target Environment**: Next.js 16 (App Router) · Supabase PostgreSQL · Tailwind CSS · React 19  
> **Target Routes**: `/computer-lab`, `/computer-lab/projector`, `/records`, `/maintenance`, `/terminal/[code]`  

---

## 1. Executive Summary & Status Scorecard

The modernization of academic computer laboratories in LabSync LIMS centers on replacing manual registers and static paper seating charts with an integrated, high-density operational cockpit. Over the course of current development, three major operational milestones have been delivered, fully typed with TypeScript strict mode (0 errors), and backed by 24 passing automated tests.

### Status Scorecard

| Milestone / Phase | Scope & Core Deliverables | Completion Status | Test Suite Outcome |
| :--- | :--- | :--- | :--- |
| **Nav & Telemetry Elevation** | Navigation renaming ("Computer Lab" &rarr; "Floor Plan"), dynamic pulsating status dots, and 4-metric high-density telemetry cards (~76px, Rule #10). | **100% Complete** | `tests/floor-plan-status-sync.test.mjs` (6/6 Pass) |
| **Phase 2: Auto-Grid & Projection** | Auto-grid layout presets (4-Row, 5-Row, Dual Islands), snap-to-grid, scalable 50+ node cards with student avatars, and fullscreen Wall Projection Mode (`/computer-lab/projector`) with 10s auto-refresh. | **100% Complete** | `tests/phase2-auto-grid-and-projector.test.mjs` (9/9 Pass) |
| **Phase 3: Seating & Forensics** | Roll (1..N) and Alphabetical (A–Z) auto-allocation, 1-click plan clearing, live displaced student triage queue, frozen `seating_snapshot` in `practical_logs`, `/records` historical chart viewer, and technical biography usage timeline. | **100% Complete** | `tests/phase3-seating-and-forensics.test.mjs` (6/6 Pass) |
| **Phase 1: Student Self-Reporting** | Zero-login student issue reporting (`/terminal/[code]`), 2-tier anti-prank hardware lock (Pairing Token + LAN IP binding), 1-tap issue chips, and real-time live help beacon on Live Cockpit. | **Queued (Next)** | Specification ready; ready for immediate execution |
| **Phase 4: Fleet Maintenance** | Machine-by-machine maintenance checklists in `/maintenance`, PC-01 to PC-50 checklist toggles (`Done`, `Pending`, `Blocked`), progress meter, floor plan overlay, and certified logbook archival. | **Queued** | Specification ready; ready after Phase 1 |

---

## 2. Completed Work & Verification Guide

### 2.1 Navigation Elevation & Facility Telemetry
- **Files Modified**:
  - [`components/layout/collapsible-sidebar.tsx`](file:///d:/Projects/LMR/components/layout/collapsible-sidebar.tsx)
  - [`components/layout/mobile-nav.tsx`](file:///d:/Projects/LMR/components/layout/mobile-nav.tsx)
  - [`components/layout/sidebar-nav.tsx`](file:///d:/Projects/LMR/components/layout/sidebar-nav.tsx)
  - [`components/command-palette.tsx`](file:///d:/Projects/LMR/components/command-palette.tsx)
  - [`app/(dashboard)/computer-lab/page.tsx`](file:///d:/Projects/LMR/app/%28dashboard%29/computer-lab/page.tsx)
  - [`components/computer-lab/computer-lab-workspace.tsx`](file:///d:/Projects/LMR/components/computer-lab/computer-lab-workspace.tsx)
- **Features Implemented**:
  1. Renamed all sidebar, mobile, and palette navigation items from *"Computer Lab"* to **"Floor Plan"** for clean institutional clarity.
  2. Integrated `useInfrastructureState()` hook: side panes and mobile navigation display a live pulsating dot indicator matching lab facility state:
     - 🟢 **Pulsing Emerald**: Operational facility.
     - 🟡 **Solid Amber**: Under Maintenance.
     - ⚪ **Subtle Slate**: Facility Inactive.
  3. Deployed four standalone, high-density facility telemetry cards (~76px height, Rule #10):
     - Total Workstations (Capacity comparison).
     - Operational Terminals (Percentage gauge).
     - Flagged Faults (Clickable shortcut into Diagnostics mode).
     - Under Repair (Active technician servicing count).
- **How to Test / Verify**:
  ```bash
  node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/floor-plan-status-sync.test.mjs
  ```
  - In browser: Open navigation menu to observe "Floor Plan" with emerald dot. Go to `/admin` &rarr; Facilities &rarr; Change Computer Lab status to "Under Maintenance", and observe immediate amber dot change and cautionary banner.

---

### 2.2 Phase 2: Auto-Grid Layout Engine & Big-Screen Projection Mode
- **Files Created / Modified**:
  - Layout Math Engine: [`lib/workstations/layout-engine.ts`](file:///d:/Projects/LMR/lib/workstations/layout-engine.ts)
  - Workstation Server Actions: [`app/actions/workstations.ts`](file:///d:/Projects/LMR/app/actions/workstations.ts)
  - Layout Editor Toolbar: [`components/computer-lab/layout-editor-bar.tsx`](file:///d:/Projects/LMR/components/computer-lab/layout-editor-bar.tsx)
  - Scalable Node UI: [`components/maintenance/workstations/workstation-node.tsx`](file:///d:/Projects/LMR/components/maintenance/workstations/workstation-node.tsx)
  - Wall Projection Component: [`components/computer-lab/projector-view.tsx`](file:///d:/Projects/LMR/components/computer-lab/projector-view.tsx)
  - Wall Projection Route: [`app/(dashboard)/computer-lab/projector/page.tsx`](file:///d:/Projects/LMR/app/%28dashboard%29/computer-lab/projector/page.tsx)
- **Features Implemented**:
  1. **Mathematical Layout Presets**:
     - `rows_4x8`: 4 rows $\times$ 8 desks + centered Teacher Podium ($x=50, y=12$).
     - `rows_5x10`: High-density 5 rows $\times$ 10 desks for up to 50 terminals.
     - `dual_islands`: West Pod ($x=22$) vs. East Pod ($x=78$) with central walking aisle.
  2. **Interactive Snap-to-Grid**: Clamps coordinates between 2% and 98% with 2% or 4% grid rounding.
  3. **Atomic Persistence**: Server action `batchUpdateWorkstationPositions` writes positions into `public.workstations` in a single PostgreSQL query.
  4. **Scalable 50+ Workstation Node UI**:
     - Large legible Roll Badges (`R-14`).
     - Circular photo avatars loaded dynamically via [`lib/student-photos/`](file:///d:/Projects/LMR/lib/student-photos/).
     - Three density profiles: `'compact' | 'standard' | 'projector'`.
  5. **Fullscreen Big-Screen Projection Mode (`/computer-lab/projector`)**:
     - High-contrast obsidian canvas (`#070A12`) optimized for large wall screens / projectors.
     - Zero admin chrome: no sidebar, no buttons, no edit controls.
     - Real-time digital clock and 10-second automatic polling synchronization.
     - Fullscreen toggle button (`Maximize2` / `Minimize2` supporting F11).
- **How to Test / Verify**:
  ```bash
  node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/phase2-auto-grid-and-projector.test.mjs
  ```
  - In browser: In `/computer-lab`, click the "Projector View" button in the top right to open `/computer-lab/projector` in a new tab. In the main window, switch to "Room Layout" mode, apply a layout preset (e.g. 5-Row), and observe instant repositioning.

---

### 2.3 Phase 3: Dynamic Seating, Displaced Student Triage & Forensic Audit
- **Files Created / Modified**:
  - Database Schema & Types: [`types/database.ts`](file:///d:/Projects/LMR/types/database.ts), [`lib/types/seat-plans.ts`](file:///d:/Projects/LMR/lib/types/seat-plans.ts), [`types/records.ts`](file:///d:/Projects/LMR/types/records.ts), [`lib/types/institutional-reports.ts`](file:///d:/Projects/LMR/lib/types/institutional-reports.ts)
  - Seat Plan Server Actions: [`app/actions/seat-plans.ts`](file:///d:/Projects/LMR/app/actions/seat-plans.ts)
  - Live Session Actions: [`app/actions/live-session.ts`](file:///d:/Projects/LMR/app/actions/live-session.ts)
  - Institutional Analytics: [`app/actions/institutional-reports.ts`](file:///d:/Projects/LMR/app/actions/institutional-reports.ts)
  - Displaced Student Queue: [`components/computer-lab/displaced-students-queue.tsx`](file:///d:/Projects/LMR/components/computer-lab/displaced-students-queue.tsx)
  - Workspace Integration: [`components/computer-lab/computer-lab-workspace.tsx`](file:///d:/Projects/LMR/components/computer-lab/computer-lab-workspace.tsx)
  - Record Detail Modal: [`components/records/practical-detail-modal.tsx`](file:///d:/Projects/LMR/components/records/practical-detail-modal.tsx)
  - Technical Biography Drawer: [`components/analytics/workstation-biography-drawer.tsx`](file:///d:/Projects/LMR/components/analytics/workstation-biography-drawer.tsx)
  - Test Suite: [`tests/phase3-seating-and-forensics.test.mjs`](file:///d:/Projects/LMR/tests/phase3-seating-and-forensics.test.mjs)
- **Features Implemented**:
  1. **Dual Auto-Assign Strategies & Natural Alphanumeric Sort**:
     - `Auto-Assign (Roll)`: Assigns unseated students in sequential roll order ($1 \dots N$).
     - `Auto-Assign (A–Z)`: Assigns unseated students alphabetically by full name.
     - Workstations are naturally sorted (`PC-01, PC-02 ... PC-10, PC-50`), eliminating string sort anomalies.
  2. **1-Click Cohort Plan Reset**:
     - `clearAllCohortSeats`: Allows Super Admin and Lab In-Charge to clear seat allocations for an entire cohort with safety confirmation, returning students to the unassigned tray without altering enrollment records.
  3. **Displaced Student Auto-Detection & Replacement Queue**:
     - Automatically scans active session seat plans against workstation issues (`under_repair`, `flagged` critical/high).
     - Renders an amber **Displaced Students Triage Queue** above the cockpit bar:
       `⚠️ Kaustuv Thapa (Roll 14) from PC-14 (Under Repair) → [Assign Replacement PC-28 (Operational)]`
     - 1-click trigger calls `assignSessionSeatOverride`, updating both teacher cockpit and wall projector with amber `Temp Relocation` tags.
  4. **Frozen Seating Snapshots in Practical Logs**:
     - Added column `seating_snapshot jsonb` to `public.practical_logs`.
     - `submitLiveSession` automatically freezes the complete room seating arrangement (station IDs, labels, student roll, full name, presence, and temporary relocation flags) into the practical log row.
  5. **Historical Seating Chart Viewer in `/records`**:
     - Opening any historical practical session in [`components/records/practical-detail-modal.tsx`](file:///d:/Projects/LMR/components/records/practical-detail-modal.tsx) displays an expandable **"Laboratory Seating Chart Snapshot"** rendering every workstation with student name, roll badge, presence/absence color pills, and temporary relocation indicators.
  6. **Workstation Usage Forensic Timeline**:
     - Server action `getWorkstationTechnicalBiography` queries `practical_logs` where `seating_snapshot` includes that workstation.
     - Workstation Biography Drawer provides a dedicated **"Usage Timeline"** tab showing the chronological history of students who sat at that specific machine (Date, Time, Class, Subject, Student, Roll, Present/Absent, Topic Learned).
     - Empowers administrators to instantly identify who altered Windows settings, installed unauthorized games, or caused hardware damage.
- **How to Test / Verify**:
  ```bash
  node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/phase3-seating-and-forensics.test.mjs
  ```
  - In browser:
    - **Seating**: Go to `/computer-lab` &rarr; Baseline Seating &rarr; test "Auto-Assign (Roll)" vs "Auto-Assign (A–Z)" vs "Clear Plan".
    - **Displaced Triage**: In `/maintenance` or diagnostics, flag PC-01 with a Critical fault. Switch to Live Session Cockpit. Observe the amber Displaced Student Banner appear. Relocate the student with 1 click.
    - **Records Snapshot**: In Live Session, click "Save & Submit Log". Navigate to `/records` and click the practical log. Observe the interactive Laboratory Seating Chart Snapshot showing who sat at each terminal.
    - **Forensic Timeline**: Click on any workstation in the floor plan to open the Biography Drawer. Click the "Usage Timeline" tab to view historical session seatings.

---

## 3. What is Left: Detailed Roadmap & Engineering Blueprint

### Phase 1: Zero-Login Student Terminal Self-Reporting & Live Cockpit Beacon

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│               PHASE 1: ZERO-LOGIN STUDENT TERMINAL SELF-REPORTING                │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 1. 2-Tier Hardware Lock (Anti-Prank / Anti-Spoofing Architecture):              │
│    • Tier 1: Device Pairing Token (Browser level)                                │
│      Admin pairs terminal once: `/terminal/pair?station=PC-30&token=...`        │
│      Stores persistent token in localStorage / httpOnly cookie.                 │
│    • Tier 2: LAN IP Binding (Network level)                                     │
│      Validates `request_ip` against mapped terminal IP in `public.workstations`.│
│                                                                                 │
│ 2. Student Self-Reporting Interface (`/terminal/[code]` or `/t/[station]`):   │
│    • Ultra-clean mobile/desktop friendly view for students at that terminal.    │
│    • Automatic identity confirmation: "Are you Kaustuv Thapa (Roll 14)?"        │
│      derived from live `sessionContext.seatPlan`.                               │
│    • 1-Tap Quick Issue Chips:                                                   │
│      - 🪟 Windows Not Activated / Expired                                       │
│      - 📄 MS Office / Word / Excel Unlicensed                                   │
│      - 📦 Missing Software (VS Code, Python, Turbo C++)                         │
│      - 💥 System Freeze / Blue Screen                                           │
│      - 🖱️ Mouse / Keyboard / Audio Fault                                       │
│      - 🌐 No Internet / Network Disconnected                                    │
│      - 📝 Custom problem note                                                   │
│                                                                                 │
│ 3. Real-Time Teacher Cockpit Beacon:                                            │
│    • Submitting an issue rings a live help chime and highlights the terminal    │
│      with an animated amber beacon on the Teacher & Lab In-Charge Cockpit.      │
│    • Direct 1-tap option on the Teacher screen: "Relocate Student to PC-xx".     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### Detailed Execution Steps for Phase 1:
1. **Database Schema Additions**:
   - Add `lan_ip inet | text` and `pairing_token text` to `public.workstations`.
   - Add `terminal_requests` table or link to `public.workstation_issues` with `source = 'student_terminal'`.
2. **Server Actions (`app/actions/terminal.ts`)**:
   - `pairWorkstationTerminal(workstationId: string, pairingSecret: string)`
   - `verifyTerminalAccess(stationCode: string, token?: string, clientIp?: string)`
   - `submitStudentIssueReport(params: { stationCode: string; issueType: string; description: string; enrollmentId?: string })`
3. **Route & Component**:
   - Route: `app/terminal/[code]/page.tsx`
   - Client Component: `components/terminal/student-terminal-view.tsx`
   - Pairing Page: `app/terminal/pair/page.tsx`
4. **Live Cockpit Integration**:
   - In [`components/computer-lab/live-cockpit-bar.tsx`](file:///d:/Projects/LMR/components/computer-lab/live-cockpit-bar.tsx), add incoming live help request alert pill with 1-click acknowledge/relocate.
5. **Testing**:
   - Unit test suite `tests/phase1-student-terminal.test.mjs` verifying pairing token validation, LAN IP verification, anti-spoofing rejection, and issue ticket creation.

---

### Phase 4: Multi-PC Maintenance Routine Checklists (Fleet Operations)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│               PHASE 4: MULTI-PC MAINTENANCE ROUTINE CHECKLISTS                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 1. Fleet Routine Definitions in `/maintenance`:                                 │
│    • Admin defines routine tasks: "Install Python 3.12 & VS Code",               │
│      "Thermal Paste Replacement & Dust Cleaning", "BIOS Security Update".       │
│                                                                                 │
│ 2. Machine-by-Machine Checklist Grid:                                           │
│    • Displays PC-01 to PC-50 in a responsive visual grid.                       │
│    • 1-Click state toggles: `[✓] Completed`, `[ ] Pending`, `[!] Blocked`.     │
│    • Real-time progress bar: `28/34 Terminals Completed (82%)`.                │
│                                                                                 │
│ 3. Synced CAD Floor Plan Overlay:                                               │
│    • Floor plan displays maintenance task completion badges directly over       │
│      desks so technicians can walk through the room with a tablet/phone.        │
│                                                                                 │
│ 4. Certified Service Log Archival:                                              │
│    • Completing the routine archives certified service logs into                │
│      `public.maintenance_logs` with 0 pricing clutter.                          │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### Completed Execution for Phase 4:
1. **Database Schema Extension**:
   - Added `affected_machines text[]` and `fleet_progress jsonb` columns to `public.maintenance_plans` in remote PostgreSQL via `scripts/migrate-add-fleet-maintenance.mjs`.
2. **Domain Models & Server Actions**:
   - `lib/types/maintenance-fleet.ts`: Canonical models `FleetTerminalEntry`, `FleetProgressMap`, and `calculateFleetProgressSummary`.
   - `app/actions/maintenance-fleet.ts`: Server actions `getFleetRoutineProgress`, `updateFleetTerminalStatus`, `batchUpdateFleetTerminalStatus`, `resetFleetRoutineProgress`, and `archiveFleetRoutineToLog`.
3. **Interactive UI Components**:
   - `components/maintenance/fleet-routine-modal.tsx`: Machine grid view, live percentage bar, row filters, 1-click cycle, CAD floor plan view, and official logbook archival.
   - `components/maintenance/maintenance-client-page.tsx`: Embedded "Fleet Grid" buttons in maintenance routine rows.
4. **Testing & Invariants**:
   - `tests/phase4-fleet-maintenance.test.mjs`: 6/6 tests passing (100%).

---

## 4. Verification & Testing Matrix

### Automated Test Suites Command Reference
Run these commands in PowerShell from the repository root (`d:\Projects\LMR`):

```powershell
# 1. Type Check (Strict TypeScript Verification)
npx tsc --noEmit

# 2. Phase 4 Test Suite (Fleet Maintenance Checklists & Multi-PC Operations)
node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/phase4-fleet-maintenance.test.mjs

# 3. Phase 3 Test Suite (Dynamic Seating, Displaced Triage, Frozen Snapshots, Forensics)
node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/phase3-seating-and-forensics.test.mjs

# 4. Phase 2 Test Suite (Auto-Grid Presets, Snap-to-Grid, Projection Screen)
node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/phase2-auto-grid-and-projector.test.mjs

# 5. Floor Plan Status & Navigation Test Suite
node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/floor-plan-status-sync.test.mjs

# 6. Workstation Relational Schema & Taxonomy Suite
node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/workstation-floor.test.mjs

# 7. Combined Full Regression Test (All 30 Tests)
node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/phase4-fleet-maintenance.test.mjs tests/phase3-seating-and-forensics.test.mjs tests/phase2-auto-grid-and-projector.test.mjs tests/floor-plan-status-sync.test.mjs tests/workstation-floor.test.mjs
```

### Expected Test Output Summary
```
# tests 30
# suites 5
# pass 30
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

---

## 5. Architectural Invariants Enforced

Agents resuming work on this repository **MUST** preserve these invariants:
1. **Rule #1 (No Literal `+` in Buttons)**:
   - Always use `<Plus className="h-4 w-4" /> <span>Add Item</span>`, never raw `+` text.
2. **Rule #8 (Strict TypeScript)**:
   - Every commit must pass `npx tsc --noEmit` with **0 errors**.
3. **Rule #10 (High-Density Cards)**:
   - Standalone `.glass-card` elements in direct grid, 2-row ~76px total height, zero nested parent containers.
4. **Rule #13 (Server Action Pure Functions)**:
   - Server action files (`app/actions/*`) marked with `'use server'` must strictly export `async function`s only. Pure domain math, types, and constants belong in `lib/`.
5. **Rule #16 (Zero Shadow Databases)**:
   - All reports, seating history, and forensic timelines query live PostgreSQL tables (`practical_logs`, `workstations`, `workstation_issues`, `workstation_seat_plans`). Never introduce disconnected mock caches.
6. **Rule #19 (Dynamic Workstation Status)**:
   - Operational status is not a static column in `workstations`. It is derived dynamically from active `workstation_issues`:
     - `status = 'in_progress'` &rarr; `under_repair`
     - `status = 'open'` &rarr; `flagged`
     - No open issues &rarr; `operational`
