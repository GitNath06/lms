# Task 25: Unified SessionActionModal Everywhere, Universal Seating Snapshot & Standby vs. Live Cockpit UI

**Execution Date**: 2026-10-12  
**Status**: Completed  
**Subsystems**: `components/computer-lab/computer-lab-workspace.tsx`, `components/computer-lab/live-cockpit-bar.tsx`, `components/maintenance/workstations/workstation-node.tsx`, `components/schedules/session-action-modal.tsx`, `app/actions/logs.ts`, `public.practical_logs` PostgreSQL table

---

## 1. Context & Architectural Root Causes

### Problem 1: Fragmented Modals Between Dashboard and Floor Plan
- On the main Dashboard, clicking a session opened the unified 7-tab institutional modal (`SessionActionModal`, as shown in `img1` and `img2`), allowing instructors to Log Attendance, Skip, Merge, Extend, Substitute, report Damage, or Delete.
- On the Computer Lab Floor Plan (`/computer-lab`), clicking the "Skip" button opened a completely different, ad-hoc dialog box (`img3`), creating visual inconsistency and preventing instructors from accessing the other session operations.
- The user required 100% uniformity across the application: clicking any session or session action (Skip, Merge, Extend, Log, etc.) must open the exact same unified `SessionActionModal` everywhere.

### Problem 2: Missing Topic Learned & Seating Snapshot Preservation for Computer Lab Practicals
- Submitting a practical session from the Floor Plan previously called `submitLiveSession` directly, bypassing the prompt for "Practical Topic / What Was Learned *" and "Remarks (Optional)".
- Furthermore, practical logs recorded for the Computer Lab (`comp`) must reliably preserve the frozen 48-workstation student seating layout (`seating_snapshot`) in `public.practical_logs`, regardless of whether logged from the Floor Plan, Dashboard, or Timetable.

### Problem 3: Insufficient Visual Distinction Between Live and Upcoming Sessions
- Previously, the Floor Plan indicated session timing solely with a small yellow vs. green dot.
- The user requested a dramatic, unmistakable visual difference: upcoming sessions must look distinctly **inactive / standby / sleep preview mode**, while live sessions must look truly **illuminated, glowing, and live**.

---

## 2. Implementations Completed

### A. Floor Plan Modal Unification (`components/computer-lab/computer-lab-workspace.tsx`)
- Completely removed the legacy ad-hoc `isSkipModalOpen` state and isolated dialog (`img3`).
- Dynamically imported `SessionActionModal` and integrated `useRoutineState()`.
- Routed all session lifecycle actions through `SessionActionModal`:
  - `onSkipSession`: opens `SessionActionModal` with `initialMode="skip"` (`img2`).
  - `onSubmitSession` & `onManageSession`: opens `SessionActionModal` with `initialMode="log"` (`img1`).
- Pre-filled live CAD attendance state:
  - Total enrolled, present, and absent counts automatically match the live floor roster.
  - Absent student roll numbers (`absent_rolls`) are pre-populated.
  - Live 48-workstation seating arrangement (`currentSeatingSnapshot`) is captured from `boardData.workstations` and forwarded to the modal.
- Handled modal log submission via `handleSaveLogFromModal`, calling `createPracticalLog` with the required `topic_learned`, `remarks`, `absent_rolls`, and `seating_snapshot`.

### B. Universal Seating Snapshot Preservation (`components/schedules/session-action-modal.tsx` & `app/actions/logs.ts`)
- Added `seatingSnapshot` support to `SessionActionModalProps` and `SessionActionModalContent`.
- Attached `seatingSnapshot` / `seating_snapshot` to the log payload in `onSaveLog` and the fallback `createPracticalLog` invocation.
- Added visual reassurance indicator to the session modal card header:
  - Displays `<CheckCircle2 className="h-3 w-3 text-emerald-400" /> 48-Station Seating Recorded` whenever the session belongs to the Computer Lab (`comp`).
- Server-side guarantee in `app/actions/logs.ts`: If client does not provide a snapshot (e.g. from Dashboard or Timetable), server automatically queries active seat assignments and overrides to construct and persist `seating_snapshot` in PostgreSQL.

### C. Standby vs. Live Visual Distinction Elevation

#### 1. Live Cockpit Bar (`components/computer-lab/live-cockpit-bar.tsx`)
- Added an authoritative Operational Status Ribbon at the top of the Cockpit card:
  - **Upcoming (Standby)**: Amber ribbon `LAB ON STANDBY • UPCOMING COHORT PREVIEW` with class start time and countdown in minutes. Card container styled with subdued dark slate and amber rim.
  - **Live (In Progress)**: Emerald ribbon `LIVE PRACTICAL IN PROGRESS` with animated dual-ring pulse beacon and remaining period minutes. Card container illuminated with deep Obsidian and emerald glow.
- Added 1-tap "Operations" button (`<SlidersHorizontal /> Operations`) enabling instant access to the unified `SessionActionModal` for Skip, Merge, Extend, Substitute, and Damage triage.
- Action button state enforcement:
  - Upcoming: Locked button `<Lock /> Starts at 10:10 AM` (disabled with `cursor-not-allowed`).
  - Live: Active illuminated emerald button `<CheckCircle2 /> Save & Submit Practical Log`.

#### 2. Workstation Nodes (`components/maintenance/workstations/workstation-node.tsx`)
- Added `isStandby` boolean prop (defaults to `false`).
- In Standby mode:
  - Monitor LCD screen dims to sleep slate (`#0c121e`).
  - Status LED shifts to standby amber (`#fbbf24`).
  - Outer chamfered bezel borders and attendance halo glows are muted.
  - Node opacity is desaturated (`opacity-70 hover:opacity-95`).
  - Added discrete `STANDBY` micro-badge inside the LCD display.
- In Live mode:
  - Monitor LCD screen illuminates in high-contrast deep blue-black (`#0f172a`).
  - Status LED shines in emerald green.
  - Vibrant green/cyan attendance halos active for present students.

#### 3. CAD Canvas Floating HUD Banner (`components/computer-lab/computer-lab-workspace.tsx`)
- Rendered centered floating HUD badge above the floor plan:
  - Upcoming: Amber glass pill `STANDBY PREVIEW MODE • Session starts at HH:MM AM`.
  - Live: Emerald pulsing pill `LIVE SESSION ACTIVE • HH:MM - HH:MM`.

---

## 3. Verification & Automated Testing

### Test Suite: `tests/unified-session-modal-and-standby-cockpit.test.mjs`
1. **Floor Plan Uniformity**: Verified `computer-lab-workspace` imports and renders `SessionActionModal`, and that the isolated `isSkipModalOpen` dialog is purged.
2. **Universal Seating Protection**: Verified `computer-lab-workspace` passes the 48-station live seating snapshot to `SessionActionModal`.
3. **Cockpit Layout**: Verified `LiveCockpitBar` renders remaining time pill beside Operations button in session header row and removed top banner.
4. **Workstation Standby Mode & Absent Greyscale**: Verified `WorkstationNode` accepts `isStandby`, renders `STANDBY` badge, and renders absent students with greyscale inactive avatar with red dot removed.
5. **Reassignment Integrity**: Verified `computer-lab-workspace` filters out workstations under repair/servicing and with open faults from temporary reassignments.
6. **SessionActionModal Topic Validation & Global Error Banner**: Verified `SessionActionModal` validates practical topic before saving, displays global error banner, and shows 48-Station Seating Recorded badge.
7. **StationQuickPopover Responsiveness & Auto-Close**: Verified `StationQuickPopover` tracks local presence for instant feedback and auto-closes without requiring clicking 'X'.

**Result**: 7/7 subtests passing.

### Regression Test Suites
- `tests/chronological-sorting-and-seating-snapshot.test.mjs`: 3/3 tests passing.
- `tests/merge-unmerge-schedule.test.mjs`: 2/2 tests passing.
- `npx tsc --noEmit`: 0 compile or type errors.

---

## 4. Operational Ergonomics & Floor Forensics Refinements

### A. Compact Live Cockpit Header Layout
- Removed the top `LIVE PRACTICAL IN PROGRESS` banner from `LiveCockpitBar`.
- Relocated remaining time / countdown pill directly into the session header box beside the `Operations` button.

### B. Absent Student Avatar Inactive Styling
- When student attendance is marked absent (`workstation.isPresent === false`):
  - Avatar container and student photo/initials display in full black & white greyscale (`filter grayscale contrast-75 brightness-75 opacity-55`).
  - Student name displays in subdued slate text (`text-slate-400`).
  - Old red dot (`bg-rose-400`) completely removed; replaced with a neutral slate `Absent` micro-pill in the metadata row.
  - Monitor bezel halo glow removes rose glow, reverting to neutral slate border.

### C. Reassignment Destination Protection
- In `computer-lab-workspace.tsx`, filtered `availableWorkstations` for temporary reassignment to strictly exclude PCs that are `under_repair` (active in-progress service) or `flagged` (open hardware faults).
- Servicing PCs like `PC-07` and `PC-37` are no longer selectable as student destinations.

### D. SessionActionModal New Log vs Edit Log Resolution
- Fixed `modalExistingLog` in `computer-lab-workspace.tsx` which previously returned a dummy object `{ id: '', ... }` even when no log existed, tricking `SessionActionModal` into edit mode (`Edit Log` / `Update Practical Record`).
- `modalExistingLog` now returns `null` when no saved log exists, correctly rendering `Log Attendance` and `Confirm Practical Record`.
- Pre-filled live floor attendance counts via `initialTotalStudents`, `initialAbsentRolls`, and `initialAbsentCount`.
- Added explicit topic validation in `handleActionSubmit` (`if (!topicLearned.trim()) setSubError(...)`) and global error banner so empty fields are visibly highlighted rather than failing silently.
- Added `async`/`await` support for `onSaveLog` and `onSkipSession` with loading spinners and auto-closing.

### E. Dialog Auto-Close on Action Completion
- `StationQuickPopover`:
  - Marking attendance immediately updates local presence, triggers attendance toggle, and auto-closes the popover after 260ms without requiring clicking 'X'.
  - Temporary seat reassignment and fault reporting display clear feedback and auto-close smoothly.
- `SessionActionModal`:
  - Awaits asynchronous persistence before triggering success toast and closing modal.

### F. Absent-Student Workstation Availability & Relocation Triage
- **Authoritative Vacancy Derivation**: In `computer-lab-workspace.tsx`, `availableRelocationStations` now treats an operational workstation as available if:
  1. It is operational & active (`status === 'operational'`, `is_active !== false`, not under repair or flagged).
  2. And either has no student assigned (`!sessionContext.seatPlan[w.id]`), OR its assigned student is marked absent (`sessionAttendance[seatedStudent.rollNumber] === false`).
- **Dynamic Vacancy Description**: Workstations are annotated with informative labels:
  - Absent vacancies: `"PC-08 (Vacant — Absent: Kaustuv Thapa)"`
  - Unassigned stations: `"PC-20 (Empty & Operational)"`
- **UI Integration**:
  - `DisplacedStudentsQueue`: Dropdown displays absent-student vacancies with full descriptive tags so displaced students from broken PCs can immediately be relocated to vacant workstations.
  - `StationQuickPopover`: Tier 2 Reassignment dropdown lists both vacant operational PCs and absent-student vacancies (excluding the current workstation).
  - `displacedStudents`: Filtered out students who are marked absent (`sessionAttendance[student.rollNumber] === false`) to prevent absent students from cluttering the relocation triage queue.

### G. Workstation Node Temporary Relocation Visual Refinement
- **Removed Bulky Yellow Border**: Removed the yellow/amber monitor border (`border-amber-400/90 ring-1 ring-amber-400/50`) and yellow avatar border (`border-amber-400/80 ring-1 ring-amber-400/60`). Workstation displays clean, standard dark slate styling.
- **Top Right Corner `TEMP` Badge Only**:
  - Completely purged the `TEMP` tag from the student portrait avatar (`absolute top-0.5 left-0.5`) to prevent obscuring student faces.
  - Purged duplicate inline `TEMP` tag from the bottom metadata line (`R-7 | PC-12`), eliminating text overflow.
  - Positioned the `TEMP` micro-badge cleanly in the top right corner of the recessed display (`absolute top-0.5 right-0.5 z-20 px-1 py-0.2 rounded-2xs bg-amber-500/25 border border-amber-500/40 text-amber-300 font-mono text-[6.5px] font-black uppercase tracking-wider`).

### H. Floor Plan Full-Width Space Utilization (Zero Extra Side Margins)
- **Purged Artificial Width Constraints**: Removed `max-w-[1600px] mx-auto` and redundant `p-4 sm:p-6` from `app/(dashboard)/computer-lab/page.tsx`.
- **Consistent Layout Alignment**: The Floor Plan & Live Cockpit page now renders at full width (`w-full`) directly inside `<main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-canvas">`, identical to `/records/incidents` and the rest of the application.
- **Expanded CAD Floor Canvas**: The CAD canvas and telemetry bars now stretch horizontally to utilize all available screen real estate without dead empty margins on the left and right.

