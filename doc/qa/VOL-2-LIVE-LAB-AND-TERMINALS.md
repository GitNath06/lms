# LabSync LIMS — IEEE 29119 QA Specification Suite
## VOLUME 2: Live Lab Cockpit, CAD Floor Engine, Seat Planning & Student Workstation Terminals

> **Document Reference**: `LMR-QA-VOL2-2026-V1`  
> **Standard**: ISO/IEC/IEEE 29119-3:2021 (Test Documentation), IEEE 829  
> **Traceability Root**: [00-MASTER-QA-INDEX-AND-RTM.md](file:///d:/Projects/LMR/doc/qa/00-MASTER-QA-INDEX-AND-RTM.md)  
> **Scope**: Route `/computer-lab`, `/computer-lab/projector`, `/terminal/*`, CAD Viewport, Hardware Pairing, Kiosk Telemetry  
> **Status**: APPROVED & CANONICAL  
> **Last Verified**: 2026-11-12

---

## 1. Live Lab Workspace & Practical Session Lifecycle

### TC-VOL2-001: Active Timetable Session Auto-Detection & Roster Mount
* **Test ID & Classification Tag**: `TC-VOL2-001` • `[AUTO-E2E-GEOMETRY]` + `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Route: `app/(dashboard)/computer-lab/page.tsx`
  * Component: `components/computer-lab/computer-lab-workspace.tsx`
  * Action: `app/actions/live-session.ts` &rarr; `getLiveSessionContext(labId)`
* **Preconditions & RBAC Matrix**:
  * Role: `teacher` assigned to current timetable period (e.g., Sunday Period 2, Class 11 Sci A, Computer Lab 1).
  * System clock: Synchronized to period start time (e.g., 10:15 AM).
  * Viewports: 393×873, 768×858, 1686×858.
* **Sequential Step-by-Step Path**:
  1. Navigate to `/computer-lab`.
  2. Inspect Live Cockpit Bar header.
  3. Verify current ongoing class banner displays `"Class 11 Science A — Computer Science Practical"`.
  4. Verify all 34 workstations mount enrolled student labels according to the academic year seat plan.
* **Combinatorial & Edge Permutations**:
  * No scheduled session active &rarr; Cockpit displays `"OFF-HOURS / OPEN LAB"` badge and offers `"Start Ad-Hoc Practical"` button.
  * Holiday active &rarr; Cockpit displays `InstitutionalRecessCard`, disabling roll-call submission.
* **Layer 1: UI & Geometry Proof**:
  * Live Cockpit Bar fixed at top of workspace: `cockpit.getBoundingClientRect().top === 64px` (directly below topbar).
  * Glowing session indicator: `.ring-2.ring-emerald-500\/40.animate-pulse` present.
* **Layer 2 & 3: Cache & Network Proof**:
  * `getLiveSessionContext` fetches active schedule and cohort enrollments in single query roundtrip (< 180ms).
  * In-memory cache key: `live:session-context:lab-1`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Query matches active row in `public.schedules`:
    ```sql
    SELECT s.id, s.subject_title, c.name FROM public.schedules s
    JOIN public.classes c ON c.id = s.class_grade
    WHERE s.lab_id = 'lab-1' AND s.day_of_week = EXTRACT(DOW FROM CURRENT_DATE)::int;
    ```

---

### TC-VOL2-002: Ad-Hoc Unscheduled Practical Session Initialization
* **Test ID & Classification Tag**: `TC-VOL2-002` • `[AUTO-E2E-GEOMETRY]` + `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Component: `components/computer-lab/start-adhoc-session-modal.tsx`
  * Action: `app/actions/live-session.ts` &rarr; `createAdHocSession(labId, classId, subjectId, topic)`
* **Preconditions & RBAC Matrix**:
  * Role: `teacher` or `lab_incharge` opening laboratory outside standard timetable schedule.
* **Sequential Step-by-Step Path**:
  1. On `/computer-lab`, click `"Start Ad-Hoc Practical"` action button.
  2. Modal opens. Select Class: `"Class 12 Science B"`.
  3. Select Subject: `"Computer Science"`.
  4. Input Topic / Experiment: `"C++ Pointers and Dynamic Memory Allocation"`.
  5. Click `"Begin Ad-Hoc Session"`.
* **Combinatorial & Edge Permutations**:
  * Empty topic field &rarr; Form validation error: `"Experiment topic is required."`
  * Room already occupied by scheduled class &rarr; Conflict engine throws: `"Room Conflict: Lab currently reserved for Class 11 Science A."`
* **Layer 1: UI & Geometry Proof**:
  * Modal has `z-index: 70`.
  * Touch target for selection dropdowns: `dropdown.getBoundingClientRect().height >= 44px`.
* **Layer 2 & 3: Cache & Network Proof**:
  * Server Action returns `{ success: true, sessionId: 'adhoc-uuid-1' }`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Audit ledger logs `action = 'adhoc_session_started'`.
  * Temporary active lock placed on lab facility.

---

### TC-VOL2-003: Screen Wake Lock API Acquisition & Background Re-acquisition
* **Test ID & Classification Tag**: `TC-VOL2-003` • `[MANUAL-DEVICE]` + `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Hook: `hooks/use-wake-lock.ts` &rarr; `useWakeLock()`
  * Component: `components/computer-lab/live-cockpit-bar.tsx`
* **Preconditions & RBAC Matrix**:
  * Device: Vivo V23 5G or laptop running live roll-call in lab room.
* **Sequential Step-by-Step Path**:
  1. Open `/computer-lab` during active session.
  2. Verify screen stay-awake indicator badge displays `"Screen Wake Lock Active"`.
  3. Switch to another app or browser tab for 10 seconds.
  4. Switch back to LabSync tab.
* **Layer 1: UI & Geometry Proof**:
  * Wake lock status pill in Cockpit: Displays Emerald icon `<Zap className="h-3 w-3 text-emerald-500" />`.
* **Layer 2 & 3: Cache & Network Proof**:
  * `navigator.wakeLock.request('screen')` promise resolves to Sentinel object.
  * Document `visibilitychange` listener re-acquires lock seamlessly upon returning to foreground.

---

### TC-VOL2-004: Complete Practical Session Save & Submission
* **Test ID & Classification Tag**: `TC-VOL2-004` • `[AUTO-E2E-GEOMETRY]` + `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Component: `components/computer-lab/live-cockpit-bar.tsx`
  * Action: `app/actions/live-session.ts` &rarr; `submitLiveSession(payload)`
* **Preconditions & RBAC Matrix**:
  * Role: `teacher` assigned to session.
  * Roll-call marked for all workstations (e.g., 28 Present, 4 Absent).
* **Sequential Step-by-Step Path**:
  1. Mark 4 workstations as Absent by clicking their nodes.
  2. Enter Experiment Title: `"Database Normalization (1NF, 2NF, 3NF) in PostgreSQL"`.
  3. Click `"Save & Submit Practical Log"`.
  4. Confirmation dialog appears displaying summary: `"28 / 32 Students Present (87.5%)"`.
  5. Click `"Confirm & Endorse"`.
* **Combinatorial & Edge Permutations**:
  * Double-click submit &rarr; Button enters loading state with `Loader2`; `idempotency_key` guarantees single insert.
  * Network disconnects mid-submit &rarr; Mutation captured in IndexedDB outbox; UI updates optimistically; syncs upon reconnect.
* **Layer 1: UI & Geometry Proof**:
  * Submit button has minimum height `44px` with emerald-600 background.
  * Success toast notification triggers within 300ms.
* **Layer 2 & 3: Cache & Network Proof**:
  * Query caches for `records:list` and `dashboard:today-stats` invalidated via `notifySubscribers()`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Row inserted into `public.practical_logs`:
    ```sql
    SELECT total_students, present_students, absent_students, absent_rolls 
    FROM public.practical_logs WHERE practical_title LIKE '%Normalization%'
    ORDER BY created_at DESC LIMIT 1;
    -- Assert: total_students === 32, present_students === 28, absent_students === 4
    ```

---

### TC-VOL2-005: Session Skip & Reschedule Flow with Mandatory Justification
* **Test ID & Classification Tag**: `TC-VOL2-005` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Component: `components/computer-lab/skip-session-modal.tsx`
  * Action: `app/actions/logs.ts` &rarr; `createPracticalLog`
* **Preconditions & RBAC Matrix**:
  * Session could not be held (e.g., Campus Power Outage, Faculty Emergency).
* **Sequential Step-by-Step Path**:
  1. In Live Cockpit Bar, click `"Skip Session"` dropdown action.
  2. Modal opens. Select Reason: `"Power Outage / Generator Failure"`.
  3. Input remarks: `"Main grid feeder tripped at 10:15 AM."`
  4. Click `"Record Skipped Session"`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Row inserted in `public.practical_logs` with `status = 'skipped'` and `skip_reason` populated.
  * Total attendance recorded as `0`.

---

### TC-VOL2-006: Wall Projector Anonymized Display Mode
* **Test ID & Classification Tag**: `TC-VOL2-006` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Route: `app/(dashboard)/computer-lab/projector/page.tsx`
  * Component: `components/computer-lab/projector-view.tsx`
* **Preconditions & RBAC Matrix**:
  * External projector display connected via HDMI (1920×1080).
* **Sequential Step-by-Step Path**:
  1. Open `/computer-lab/projector`.
  2. Press `F11` to enter browser fullscreen.
  3. Toggle `"Anonymize Names"` switch.
* **Layer 1: UI & Geometry Proof**:
  * Top navigation header, mobile dock, and sidebars completely unmounted (`0px` height).
  * High-contrast OLED dark background (`#000000`).
  * Student cards display `Roll No` and `Initials` only (e.g., `"Roll 04 • R.S."`), preserving student privacy from back of room.

---

### TC-VOL2-007: Live Attendance Ratio Gauge Real-Time Update
* **Test ID & Classification Tag**: `TC-VOL2-007` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Component: `components/computer-lab/live-cockpit-bar.tsx`
* **Preconditions & RBAC Matrix**:
  * 32 total enrolled students.
* **Sequential Step-by-Step Path**:
  1. Mark 1 student Absent. Ratio changes to `31/32 (96.9%)` &rarr; Emerald badge `"Optimal"`.
  2. Mark 6 students Absent. Ratio changes to `25/32 (78.1%)` &rarr; Slate badge `"Normal"`.
  3. Mark 9 students Absent. Ratio changes to `23/32 (71.9%)` &rarr; Rose badge `"Low Rate"`.
* **Layer 1: UI & Geometry Proof**:
  * Semantic color tiers strictly enforced (Rule 9):
    * `>= 85%`: `text-emerald-500`, badge `Optimal`.
    * `75% - 84%`: `text-zinc-300`, badge `Normal` (Zero false warning amber).
    * `< 75%`: `text-rose-500`, badge `Low Rate`.

---

### TC-VOL2-008: Holiday & Statutory Recess Operation Suspension Shield
* **Test ID & Classification Tag**: `TC-VOL2-008` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Policy: `lib/calendar-policy.ts` &rarr; `evaluateDateSuspension`
  * Component: `components/computer-lab/institutional-recess-card.tsx`
* **Preconditions & RBAC Matrix**:
  * Date simulated: Saturday statutory weekend or Constitution Day holiday (Asoj 3).
* **Sequential Step-by-Step Path**:
  1. Open `/computer-lab` on a suspended calendar date.
* **Layer 1: UI & Geometry Proof**:
  * Workspace replaces interactive roll-call with `InstitutionalRecessCard`.
  * `"Save & Submit Practical Log"` button is absent from DOM.
  * Card displays official institutional holiday reason and date banner.

---

## 2. 2D CAD Floor Map vs. Mobile Tactical Aisle Deck

### TC-VOL2-009: Mobile Dual-Mode Segmented Switcher
* **Test ID & Classification Tag**: `TC-VOL2-009` • `[MANUAL-DEVICE]` + `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Component: `components/computer-lab/mobile-view-mode-toggle.tsx`
* **Preconditions & RBAC Matrix**:
  * Viewport: 393×873 px (Vivo V23 5G).
* **Sequential Step-by-Step Path**:
  1. Open `/computer-lab` on mobile.
  2. Locate 2-way segmented pill at top of workspace: `[Aisle Deck (Fast)] | [2D Floor Map]`.
  3. Default view is `Aisle Deck (Fast)`. Tap `2D Floor Map`.
  4. Viewport switches to zoomable CAD canvas. Tap `Aisle Deck (Fast)`.
* **Layer 1: UI & Geometry Proof**:
  * Segmented switcher is sticky below topbar with `z-index: 20`.
  * Active segment highlighted with `bg-white dark:bg-zinc-800` shadow pill.
  * Switch transition occurs within 100ms with 0 layout shift.

---

### TC-VOL2-010: Tactical Aisle Deck 48px 1-Tap Attendance Toggles
* **Test ID & Classification Tag**: `TC-VOL2-010` • `[MANUAL-DEVICE]` + `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Component: `components/computer-lab/mobile-tactical-aisle-deck.tsx`
* **Preconditions & RBAC Matrix**:
  * Viewport: 393×873 px.
* **Sequential Step-by-Step Path**:
  1. In `Aisle Deck` view, scroll down Aisle A (Desks A-01 to A-08).
  2. Single-tap desk `A-03` attendance button.
  3. State flips instantly from `Present` (Emerald ring) to `Absent` (Rose ring + line-through name).
  4. Tap again &rarr; Returns to `Present`.
* **Layer 1: UI & Geometry Proof**:
  * Attendance tap target dimensions: `btn.getBoundingClientRect().height >= 48px` and `width >= 48px`.
  * Row spacing between desks: `margin-bottom: 8px`.
  * Haptic vibration triggered on tap: `navigator.vibrate(12)`.

---

### TC-VOL2-011: Quick Station Popover Triage & Seat Reassignment
* **Test ID & Classification Tag**: `TC-VOL2-011` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Component: `components/computer-lab/station-quick-popover.tsx`
  * Action: `app/actions/seat-plans.ts` &rarr; `assignStudentToSeat`
* **Preconditions & RBAC Matrix**:
  * Instructor on desktop 2D CAD canvas.
* **Sequential Step-by-Step Path**:
  1. Click workstation node `PC-12`.
  2. Quick Station Popover floats above node.
  3. Click `"Reassign Student"` action.
  4. Select unassigned student `"Aarav Sharma"` from dropdown.
  5. Click `"Confirm Assignment"`.
* **Layer 1: UI & Geometry Proof**:
  * Popover has `z-index: 70`.
  * Popover arrow points directly to workstation bounding rect center.

---

### TC-VOL2-012: CAD Canvas Clamped Focal Zoom & Pan HUD
* **Test ID & Classification Tag**: `TC-VOL2-012` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Hook: `hooks/use-canvas-viewport.ts`
  * Component: `components/computer-lab/canvas-controls-hud.tsx`
* **Preconditions & RBAC Matrix**:
  * Desktop browser viewport 1280px+.
* **Sequential Step-by-Step Path**:
  1. Click `Zoom In` HUD button 4 times. Zoom clamps at maximum `1.6x`.
  2. Click `Zoom Out` HUD button 6 times. Zoom clamps at minimum `0.5x`.
  3. Click `Reset 1:1` button. Scale resets to `1.0x` and pan centers at `(0, 0)`.
  4. Click `Fit to Screen` button. Scale auto-calculates to fit all 34 nodes in viewport.
* **Layer 1: UI & Geometry Proof**:
  * Zoom HUD controls have zero literal `+` or `-` button text (Rule 1). Uses Lucide `<Plus />` and `<Minus />`.
  * Transform matrix applied to canvas: `transform: translate(x, y) scale(s)`.

---

### TC-VOL2-013: Interactive Radar Minimap Draggable Viewport Bounding Box
* **Test ID & Classification Tag**: `TC-VOL2-013` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Component: `components/computer-lab/canvas-minimap-radar.tsx`
* **Preconditions & RBAC Matrix**:
  * Desktop CAD view active.
* **Sequential Step-by-Step Path**:
  1. Locate bottom-right floating radar minimap.
  2. Click on the miniature representation of Row D.
  3. Main canvas smoothly pans to center Row D in viewport.
  4. Drag the minimap transparent viewport bounding box. Main canvas pans in real time.
* **Layer 1: UI & Geometry Proof**:
  * Minimap dimensions: `160px × 110px`.
  * Workstation dots in minimap mirror live status colors (Green, Amber, Rose).

---

### TC-VOL2-014: Physical Architectural Floor Elements Rendering
* **Test ID & Classification Tag**: `TC-VOL2-014` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Component: `components/computer-lab/lab-desk-structure-overlay.tsx`
  * Action: `app/actions/floor-elements.ts` &rarr; `getLabFloorElements`
* **Preconditions & RBAC Matrix**:
  * CAD floor view open.
* **Sequential Step-by-Step Path**:
  1. Inspect CAD canvas background layer.
  2. Verify physical architectural features are rendered:
     * Teacher Podium Desk at front center.
     * Whiteboard element spanning front wall.
     * Entrance Door element with swing arc indicator.
     * 2 Structural Support Pillars in aisle center.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Elements loaded from `public.floor_elements` matching `lab_id = 'lab-1'`.

---

### TC-VOL2-015: High-Speed Jump-to-Roll Input Beacon Auto-Pan
* **Test ID & Classification Tag**: `TC-VOL2-015` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Component: `components/computer-lab/live-cockpit-bar.tsx`
* **Preconditions & RBAC Matrix**:
  * Teacher wants to locate student Roll 17 in a large 40-seat room.
* **Sequential Step-by-Step Path**:
  1. Focus `"Jump to Roll"` input box in Cockpit Bar.
  2. Type `"17"` and press `Enter`.
  3. Main canvas auto-pans to workstation occupied by Roll 17.
  4. Workstation pulses with a luminous expanding beacon ring (`animate-ping`).
* **Layer 1: UI & Geometry Proof**:
  * Target workstation node bounding rect is brought within `100px` of canvas center point.

---

### TC-VOL2-016: Bulk Attendance Operations (Mark All Present / Invert Selection)
* **Test ID & Classification Tag**: `TC-VOL2-016` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Component: `components/computer-lab/live-cockpit-bar.tsx`
* **Preconditions & RBAC Matrix**:
  * Active session with random attendance marked.
* **Sequential Step-by-Step Path**:
  1. Click `"Actions"` dropdown in Cockpit Bar.
  2. Click `"Mark All Present"`. All 32 enrolled students flip to Present (`100%`).
  3. Click `"Invert Attendance"`. All 32 flip to Absent (`0%`).
  4. Click `"Mark All Present"` again to reset.
* **Layer 1: UI & Geometry Proof**:
  * Gauge metric updates synchronously from `0%` to `100%` within 16ms (single frame).

---

## 3. Cohort Seat Planning & Displaced Student Triage

### TC-VOL2-017: 1-Tap Student-to-Workstation Drag & Drop Binding
* **Test ID & Classification Tag**: `TC-VOL2-017` • `[AUTO-E2E-GEOMETRY]` + `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Component: `components/computer-lab/seat-planner-tab.tsx`
  * Action: `app/actions/seat-plans.ts` &rarr; `assignStudentToSeat`
* **Preconditions & RBAC Matrix**:
  * Role: `lab_incharge` or `super_admin` in Seat Planner mode.
* **Sequential Step-by-Step Path**:
  1. Open Seat Planner tab for Class 11 Science A.
  2. Select unassigned student `"Bikash Thapa (Roll 08)"` from left roster tray.
  3. Click empty workstation `PC-15`.
  4. Workstation updates to display `"08 • Bikash Thapa"`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Row upserted in `public.workstation_seat_plans`:
    ```sql
    SELECT enrollment_id, workstation_id FROM public.workstation_seat_plans
    WHERE workstation_id = 'ws-15' AND class_id = '11sci-a';
    ```

---

### TC-VOL2-018: Workstation Student Swap Atomic Transaction
* **Test ID & Classification Tag**: `TC-VOL2-018` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Component: `components/computer-lab/seat-planner-tab.tsx`
  * Action: `app/actions/seat-plans.ts` &rarr; `swapStudents(seatPlanIdA, seatPlanIdB)`
* **Preconditions & RBAC Matrix**:
  * Workstation `PC-01` holds Student A; Workstation `PC-02` holds Student B.
* **Sequential Step-by-Step Path**:
  1. Drag `PC-01` student badge onto `PC-02`.
  2. Confirmation modal displays: `"Swap seats between Roll 01 and Roll 02?"`
  3. Click `"Confirm Swap"`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Executed inside a single PostgreSQL transaction block:
    ```sql
    -- Atomic swap proof: No duplicate key violation on workstation_id constraint
    SELECT enrollment_id FROM public.workstation_seat_plans WHERE workstation_id = 'ws-01';
    -- Assert: equals Student B
    SELECT enrollment_id FROM public.workstation_seat_plans WHERE workstation_id = 'ws-02';
    -- Assert: equals Student A
    ```

---

### TC-VOL2-019: Auto-Assign Remaining Cohort Seats Algorithm
* **Test ID & Classification Tag**: `TC-VOL2-019` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/seat-plans.ts` &rarr; `autoAssignRemainingSeats(labId, classId)`
* **Preconditions & RBAC Matrix**:
  * 12 students unassigned; 15 workstations empty.
* **Sequential Step-by-Step Path**:
  1. Click `"Auto-Assign Remaining"` button in Seat Planner header.
  2. Dialog confirms: `"12 unassigned students will be mapped alphabetically by Roll Number."`
  3. Click `"Run Auto-Assignment"`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * All 12 students mapped sequentially across remaining operational workstations sorted by `row_label ASC, label ASC`.

---

### TC-VOL2-020: Mid-Class Machine Fault Session Seat Override
* **Test ID & Classification Tag**: `TC-VOL2-020` • `[AUTO-DB-INTEGRATION]` + `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Component: `components/computer-lab/station-quick-popover.tsx`
  * Action: `app/actions/seat-plans.ts` &rarr; `createSessionSeatOverride`
* **Preconditions & RBAC Matrix**:
  * Live session in progress. Student's PC blue-screens mid-class.
* **Sequential Step-by-Step Path**:
  1. On live floor, click `PC-07`. Click `"Report Out-of-Order"`.
  2. Machine turns Rose (`under_repair`). Student Roll 07 is displaced to the Displaced Queue.
  3. Click empty station `PC-34`. Select `"Assign Displaced Student (Roll 07)"`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Overrides table records session-scoped swap without mutating permanent year seat plan:
    ```sql
    SELECT * FROM public.workstation_seat_plan_overrides 
    WHERE original_workstation_id = 'ws-07' AND override_workstation_id = 'ws-34';
    ```

---

### TC-VOL2-021: Displaced Students Queue Dock & Temporary Allocation
* **Test ID & Classification Tag**: `TC-VOL2-021` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Component: `components/computer-lab/displaced-students-queue.tsx`
* **Preconditions & RBAC Matrix**:
  * 2 students displaced due to hardware faults.
* **Sequential Step-by-Step Path**:
  1. Inspect Displaced Students dock pinned to top right of canvas.
  2. Amber pill badge displays `"2 Displaced Students Awaiting Desk"`.
  3. Drag student from queue onto an empty operational workstation.
* **Layer 1: UI & Geometry Proof**:
  * Dock rendered with `z-index: 40`.
  * Amber warning accent: `border-amber-500/40 bg-amber-500/10`.

---

### TC-VOL2-022: Cohort Seat Plan Clearance with Precaution Active Lock Guard
* **Test ID & Classification Tag**: `TC-VOL2-022` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Component: `components/computer-lab/seat-planner-tab.tsx`
  * Action: `app/actions/seat-plans.ts` &rarr; `clearAllCohortSeats`
* **Preconditions & RBAC Matrix**:
  * Role: `super_admin`.
* **Sequential Step-by-Step Path**:
  1. Locate `"Clear Entire Plan"` action.
  2. Attempt click while safety lock `"Precaution Active"` toggle is ON &rarr; Action blocked.
  3. Switch safety lock `"Precaution Active"` to OFF.
  4. Click `"Clear Entire Plan"`. Confirm deletion in dialog.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Rows deleted from `public.workstation_seat_plans` for that `class_id`.
  * Audit ledger logs `action = 'seat_plan_cleared'` with actor ID.

---

## 4. Student Workstation Terminal & Hardware Pairing Engine

### TC-VOL2-023: Institutional Terminal Pairing Key Handshake
* **Test ID & Classification Tag**: `TC-VOL2-023` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/workstations.ts` &rarr; `getInstitutionalPairingKey`
  * Route: `app/terminal/pair/page.tsx`
* **Preconditions & RBAC Matrix**:
  * Lab In-Charge provisioning a newly imaged computer lab node.
* **Sequential Step-by-Step Path**:
  1. Open `/terminal/pair` on student PC.
  2. Screen displays `"Workstation Unpaired — Laboratory Terminal Gate"`.
  3. Input 8-character institutional master pairing key: `"LABS-2083"`.
  4. Select Workstation Identifier: `"PC-14"`.
  5. Click `"Authorize & Bind Terminal"`.
* **Layer 1: UI & Geometry Proof**:
  * Kiosk layout centers pairing form with high-contrast obsidian background (`#0B0F19`).
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Pairing key validated against hashed secret in `public.institution_settings`.

---

### TC-VOL2-024: Workstation Physical Hardware Binding & Anti-Spoof Fingerprint
* **Test ID & Classification Tag**: `TC-VOL2-024` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/terminal.ts` &rarr; `pairWorkstationTerminal`
  * Endpoint: `app/api/terminal/handshake/route.ts`
* **Preconditions & RBAC Matrix**:
  * Hardware parameters extracted via client agent: MAC address, motherboard UUID, CPU serial.
* **Sequential Step-by-Step Path**:
  1. Submit pairing payload containing `hardware_hash = SHA256(MAC + UUID)`.
  2. Server binds hash to workstation `PC-14`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Column `hardware_binding_hash` updated in `public.workstations`:
    ```sql
    SELECT hardware_binding_hash, is_locked FROM public.workstations WHERE label = 'PC-14';
    -- Assert: hardware_binding_hash IS NOT NULL AND is_locked = TRUE
    ```

---

### TC-VOL2-025: Student Terminal Live View & Experiment Guide Display
* **Test ID & Classification Tag**: `TC-VOL2-025` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Route: `app/terminal/page.tsx`
  * Component: `components/terminal/student-terminal-view.tsx`
* **Preconditions & RBAC Matrix**:
  * Paired workstation terminal during live practical class.
* **Sequential Step-by-Step Path**:
  1. Student sits at PC-14.
  2. Terminal displays:
     * Student biographical header: `"Roll 14 • Pradeep Adhikari"`.
     * Current experiment title: `"Binary Search Tree Implementation in C++"`.
     * Experiment syllabus instructions and expected outputs.
* **Layer 1: UI & Geometry Proof**:
  * Terminal view operates in fullscreen kiosk layout with zero administrative menus or navbars.

---

### TC-VOL2-026: Hardware Anti-Spoof MAC/UUID Hijack Prevention
* **Test ID & Classification Tag**: `TC-VOL2-026` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/terminal-simulator.ts` &rarr; `testAntiSpoofHijack`
  * Endpoint: `app/api/terminal/handshake/route.ts`
* **Preconditions & RBAC Matrix**:
  * Attacker on personal laptop attempts to spoof station `PC-01` to forge roll-call attendance.
* **Sequential Step-by-Step Path**:
  1. Attacker sends pairing handshake claiming to be `PC-01` with spoofed IP address.
  2. Motherboard UUID in payload does not match bound `hardware_binding_hash`.
* **Layer 1: UI & Geometry Proof**:
  * Terminal locks instantly displaying red security screen:
    `"Hardware Binding Mismatch: Terminal Locked. Contact Lab In-Charge."`
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Workstation flagged in `public.workstation_issues` with severity `high` and title `"Hardware Security Spoof Attempt"`.

---

### TC-VOL2-027: Student Assistance Raise-Hand & Distress Beacon
* **Test ID & Classification Tag**: `TC-VOL2-027` • `[AUTO-E2E-GEOMETRY]` + `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Component: `components/terminal/student-terminal-view.tsx`
  * Action: `app/actions/terminal.ts` &rarr; `submitStudentIssueReport`
* **Preconditions & RBAC Matrix**:
  * Student experiencing compile errors or keyboard failure during practical.
* **Sequential Step-by-Step Path**:
  1. On student terminal, click large amber button: `"Raise Hand / Request Help"`.
  2. Select category: `"Compiler / Syntax Assistance"`.
  3. Button enters pulsing state: `"Help Requested — Teacher Notified"`.
* **Layer 1: UI & Geometry Proof**:
  * On teacher's Live Cockpit CAD map, workstation `PC-14` pulses with a bright Amber distress ring.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Row created in `public.terminal_assistance_requests`:
    ```sql
    SELECT status, category FROM public.terminal_assistance_requests 
    WHERE workstation_id = 'ws-14' AND status = 'pending';
    ```

---

### TC-VOL2-028: Faculty Assistance Queue Acknowledgment & Clearance
* **Test ID & Classification Tag**: `TC-VOL2-028` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Component: `components/terminal/terminal-assistance-queue.tsx`
  * Action: `app/actions/terminal.ts` &rarr; `acknowledgeAssistanceRequest`
* **Preconditions & RBAC Matrix**:
  * Teacher receives help request from PC-14.
* **Sequential Step-by-Step Path**:
  1. Open Assistance Queue tray in Live Cockpit Bar.
  2. Click `"Acknowledge"` next to PC-14 request.
  3. Student terminal updates status: `"Teacher is on the way."`
  4. After helping student, click `"Clear Request"`. Amber pulse ceases.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Row in `public.terminal_assistance_requests` marked `status = 'resolved'` with `resolved_at` timestamp.

---

### TC-VOL2-029: 34-Node Swarm Boot Mass Simulator Stress Test
* **Test ID & Classification Tag**: `TC-VOL2-029` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/terminal-simulator.ts` &rarr; `simulateSwarmBootAll`
  * Component: `components/dev/terminal-simulator-controller.tsx`
* **Preconditions & RBAC Matrix**:
  * Staging/development stress test environment.
* **Sequential Step-by-Step Path**:
  1. Open Dev Station Rig controller.
  2. Click `"Simulate 34-Node Swarm Boot"`.
  3. 34 simulated terminals simultaneously fire handshake and heartbeats within 500ms.
* **Layer 1: UI & Geometry Proof**:
  * Live Cockpit CAD canvas updates all 34 nodes to online state without dropping below 55 FPS.
* **Layer 2 & 3: Cache & Network Proof**:
  * Database connection pooler handles concurrent handshake queries without connection exhaustion.

---

### TC-VOL2-030: Time-Travel Simulation Engine Timetable Slot Verification
* **Test ID & Classification Tag**: `TC-VOL2-030` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Component: `components/dev/time-travel-controller.tsx`
  * Context: `hooks/use-live-schedule.ts`
* **Preconditions & RBAC Matrix**:
  * QA engineer testing session transitions across all 7 daily periods.
* **Sequential Step-by-Step Path**:
  1. Open Dev Time Travel floating pill.
  2. Fast-forward virtual clock to `11:45 AM` (Period 3 start).
  3. Verify Live Cockpit synchronously re-mounts Class 12 Physics practical.
  4. Fast-forward to `04:30 PM` (School Day End).
  5. Verify Cockpit transitions cleanly to `"BREAK / OFF-HOURS"`.
* **Layer 1: UI & Geometry Proof**:
  * Time travel indicator pill pinned to bottom left of screen: `bg-purple-600/20 text-purple-300 font-mono text-xs`.

