# LabSync LIMS — IEEE 29119 QA Specification Suite
## VOLUME 4: Practical Logbook, Equipment Incidents, Preventive Maintenance & Print Engines

> **Document Reference**: `LMR-QA-VOL4-2026-V1`  
> **Standard**: ISO/IEC/IEEE 29119-3:2021 (Test Documentation), IEEE 829  
> **Traceability Root**: [00-MASTER-QA-INDEX-AND-RTM.md](file:///d:/Projects/LMR/doc/qa/00-MASTER-QA-INDEX-AND-RTM.md)  
> **Scope**: Routes `/records`, `/records/new`, `/records/incidents`, `/incidents`, `/maintenance/*`, `/print/*`, Data Exports  
> **Status**: APPROVED & CANONICAL  
> **Last Verified**: 2026-11-12

---

## 1. Practical Logbook Register & Manual Log Entry

### TC-VOL4-001: Desktop Practical Records Register Table vs Mobile Obsidian Cards
* **Test ID & Classification Tag**: `TC-VOL4-001` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Route: `app/(dashboard)/records/page.tsx`
  * Components: `components/records/practical-records-table.tsx`
  * Action: `app/actions/records.ts` &rarr; `getPracticalRecords`
* **Preconditions & RBAC Matrix**:
  * Authenticated user inspecting practical experiment history.
  * Viewports: 393×873 px (Vivo V23 5G) vs 1686×858 px (Desktop).
* **Sequential Step-by-Step Path**:
  1. Open `/records` on Desktop (1686px). Verify multi-column table renders: `Date (BS/AD)`, `Class & Batch`, `Subject`, `Topic / Experiment`, `Attendance Tally`, `Teacher`, `Verification Status`, `Actions`.
  2. Resize viewport to 393px (Mobile).
  3. Verify desktop table is hidden (`hidden md:block`).
  4. Verify mobile view displays high-density Obsidian Practical Cards (`md:hidden`).
* **Layer 1: UI & Geometry Proof**:
  * Mobile card layout:
    * Header: Subject title + class grade pill.
    * 2×2 Metadata grid: Date, Lab, Attendance (`28/32`), and Teacher initials.
    * Footer: Experiment topic + 44px `"View Details"` and `"Print"` icon buttons.
  * Card touch target: `card.getBoundingClientRect().height >= 96px`.
  * Zero horizontal scroll: `document.documentElement.scrollWidth <= 393`.
* **Layer 2 & 3: Cache & Network Proof**:
  * Query cached in client SWR store with key `records:list:...`.

---

### TC-VOL4-002: Multi-Filter Cascading Selection & Mobile 2-Column Grid
* **Test ID & Classification Tag**: `TC-VOL4-002` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Component: `components/records/practical-filter-bar.tsx`
* **Preconditions & RBAC Matrix**:
  * Viewport: 393×873 px.
* **Sequential Step-by-Step Path**:
  1. On `/records`, tap `"Filter Records"` collapsible bar.
  2. Filter bar expands into a responsive `grid-cols-2` mobile layout.
  3. Select Lab: `"Computer Lab 1"`.
  4. Select Status: `"Conducted"`.
  5. Select Academic Year: `"2083/84"`.
  6. Enter search query: `"Normalization"`.
* **Layer 1: UI & Geometry Proof**:
  * Each filter selector has minimum touch target `height >= 44px`.
  * Zero filter overflow off the 393px screen: `filterBar.getBoundingClientRect().width <= 393`.
* **Layer 2 & 3: Cache & Network Proof**:
  * Filter state synced to URL search parameters without page reload (`window.history.replaceState`).

---

### TC-VOL4-003: SWR Query Cache Hydration & SSR Skeleton Mismatch Defense
* **Test ID & Classification Tag**: `TC-VOL4-003` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Route: `app/(dashboard)/records/page.tsx`
  * Component: `components/records/practical-summary-strip.tsx`
* **Preconditions & RBAC Matrix**:
  * User refreshes `/records` with pre-cached records in memory.
* **Sequential Step-by-Step Path**:
  1. Hard refresh `/records` with DevTools open.
  2. Observe `PracticalSummaryStrip` metrics render during hydration.
* **Layer 1: UI & Geometry Proof**:
  * Zero React SSR hydration error: `!mounted || isLoading || isPending` renders identical skeleton during Frame 0 on both server and client before smoothly hydrating metrics.
* **Layer 2 & 3: Cache & Network Proof**:
  * Metric cards transition from skeleton to bold numerals within 40ms.

---

### TC-VOL4-004: Manual Practical Log Creation Form Submission
* **Test ID & Classification Tag**: `TC-VOL4-004` • `[AUTO-DB-INTEGRATION]` + `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Route: `app/(dashboard)/records/new/page.tsx`
  * Component: `app/(dashboard)/records/new/log-form.tsx`
  * Action: `app/actions/logs.ts` &rarr; `createPracticalLog(payload)`
* **Preconditions & RBAC Matrix**:
  * Role: `teacher`.
* **Sequential Step-by-Step Path**:
  1. Open `/records/new`.
  2. Select Date: Today's date (auto-selected).
  3. Select Class: `"Class 11 Science A"`.
  4. Select Subject: `"Computer Science"`.
  5. Select Lab: `"Computer Lab 1"`.
  6. Input Experiment: `"Writing SQL DDL & DML Commands in PostgreSQL"`.
  7. Input Absent Rolls: `"4, 12, 19"`.
  8. Click `"Save & Submit Practical Log"`.
* **Combinatorial & Edge Permutations**:
  * Non-operational lab selected &rarr; Server rejects with `"Selected laboratory is Under Maintenance."`
  * Total students absent > enrolled students &rarr; Validation error `"Absent count cannot exceed enrolled students."`
* **Layer 1: UI & Geometry Proof**:
  * Submit button has `height: 48px` and `font-bold`.
* **Layer 2 & 3: Cache & Network Proof**:
  * `idempotency_key` (UUID v4) prevents duplicate insert on double-click.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Row inserted in `public.practical_logs` with `absent_rolls = ARRAY[4, 12, 19]`.

---

### TC-VOL4-005: Student Roll-Call Attendance Tally & Absent Roll Counter
* **Test ID & Classification Tag**: `TC-VOL4-005` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Component: `app/(dashboard)/records/new/log-form.tsx`
* **Preconditions & RBAC Matrix**:
  * Enrolled student count: 32.
* **Sequential Step-by-Step Path**:
  1. Type `"03, 07, 15"` into absent rolls input.
  2. Verify Present Students gauge updates instantly: `29 Present, 3 Absent (90.6%)`.
  3. Type `"22"` &rarr; Updates to `28 Present, 4 Absent (87.5%)`.
* **Layer 1: UI & Geometry Proof**:
  * Attendance percentage text colored Emerald (`#10B981`) for `>= 85%`.

---

### TC-VOL4-006: Form Sticky Bottom Submit Bar Clearance Above Mobile Dock
* **Test ID & Classification Tag**: `TC-VOL4-006` • `[MANUAL-DEVICE]` + `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Component: `app/(dashboard)/records/new/log-form.tsx`
  * Navigation: `components/layout/mobile-bottom-nav.tsx`
* **Preconditions & RBAC Matrix**:
  * Viewport: 393×873 px (Vivo V23 5G).
* **Sequential Step-by-Step Path**:
  1. Open `/records/new` on mobile.
  2. Scroll down form to the sticky submit bar.
* **Layer 1: UI & Geometry Proof**:
  * MobileBottomNav is automatically unmounted on `/records/new` (`pathname === '/records/new'`), giving 100% viewport height to the form.
  * Sticky submit bar rests against bottom screen edge: `bar.getBoundingClientRect().bottom === window.innerHeight`.
  * Submit button is fully unobstructed with minimum height `48px`.

---

### TC-VOL4-007: Faculty Scope RBAC Data Isolation
* **Test ID & Classification Tag**: `TC-VOL4-007` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/records.ts` &rarr; `getPracticalRecords`
* **Preconditions & RBAC Matrix**:
  * User: `teacher` without `can_view_all_logs` permission.
* **Sequential Step-by-Step Path**:
  1. Teacher logs in and navigates to `/records`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Server Action forces `teacher_id = auth.uid()` in SQL WHERE clause:
    ```sql
    SELECT * FROM public.practical_logs WHERE teacher_id = 'current-teacher-uuid';
    ```
  * Teacher cannot see logs recorded by other faculty members.

---

### TC-VOL4-008: Practical Log Editing & Historical Record Amendments
* **Test ID & Classification Tag**: `TC-VOL4-008` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/logs.ts` &rarr; `updatePracticalLog(id, payload)`
* **Preconditions & RBAC Matrix**:
  * Role: Original instructor who submitted the log within 24 hours.
* **Sequential Step-by-Step Path**:
  1. Open practical record detail modal. Click `"Edit Log"`.
  2. Update remarks: `"Experiment completed with 100% successful test cases."`
  3. Click `"Save Amendments"`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * `public.practical_logs` row updated. Audit ledger logs `action = 'log_amended'`.

---

### TC-VOL4-009: Practical Log Deletion with Administrative Password Guard
* **Test ID & Classification Tag**: `TC-VOL4-009` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/logs.ts` &rarr; `deletePracticalLog(id)`
* **Preconditions & RBAC Matrix**:
  * Role: `super_admin`.
* **Sequential Step-by-Step Path**:
  1. Open practical log detail modal.
  2. Click `"Delete Log"`.
  3. Modal prompts for administrator confirmation password.
  4. Submit valid password.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Row removed from `public.practical_logs`. Foreign key cascades cleanly.

---

### TC-VOL4-010: Interactive Practical Detail Modal Audit Verification
* **Test ID & Classification Tag**: `TC-VOL4-010` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Component: `components/records/practical-detail-modal.tsx`
* **Preconditions & RBAC Matrix**:
  * Any role inspecting a verified practical session.
* **Sequential Step-by-Step Path**:
  1. Click any row in `/records`.
  2. Modal opens displaying:
     * Experiment syllabus code and title.
     * Batch group and section.
     * Dual Sign-off stamps: Teacher signature + Lab Incharge audit stamp.
     * Absent roll pill badges.
* **Layer 1: UI & Geometry Proof**:
  * Modal has `z-index: 70`. Touch target for close button: `44px × 44px`.

---

## 2. Equipment Breakage, Incident Register & HOD Escalation

### TC-VOL4-011: Equipment Breakage Incident Reporting with Image Compression
* **Test ID & Classification Tag**: `TC-VOL4-011` • `[AUTO-DB-INTEGRATION]` + `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Route: `app/(dashboard)/records/incidents/page.tsx`
  * Action: `app/actions/incidents.ts` &rarr; `reportIncident(payload)`
  * Compression: `lib/image-compression.ts`
* **Preconditions & RBAC Matrix**:
  * Instructor reporting damaged equipment (e.g., dropped spectrometer, cracked motherboard).
* **Sequential Step-by-Step Path**:
  1. Open `/records/incidents`. Click `"Report Damage"`.
  2. Select Lab: `"Physics Lab"`.
  3. Equipment Name: `"Spectrometer Optical Prism"`.
  4. Severity: `"Major / Critical"`.
  5. Attach 4MB photo of broken glass.
  6. Click `"File Incident Report"`.
* **Layer 2 & 3: Cache & Network Proof**:
  * `compressAvatar` / `compressImage` scales 4MB JPEG down to < 200KB before transmission.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Row created in `public.lab_incidents`:
    ```sql
    SELECT equipment_name, severity, status FROM public.lab_incidents 
    WHERE equipment_name = 'Spectrometer Optical Prism';
    -- Assert: severity = 'major_critical' AND status = 'reported'
    ```

---

### TC-VOL4-012: Damage Fine Assessment & Payment Reconciliation
* **Test ID & Classification Tag**: `TC-VOL4-012` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/records.ts` &rarr; `updateIncidentWorkflow`
* **Preconditions & RBAC Matrix**:
  * Student student Roll 12 broke laboratory glassware during practical.
* **Sequential Step-by-Step Path**:
  1. In Incident Detail Drawer, locate `"Institutional Fine Assessment"`.
  2. Input Fine Amount: `Rs. 500`.
  3. Toggle `"Fine Paid by Student"` to TRUE.
  4. Click `"Update Incident Record"`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * `public.lab_incidents` updated: `fine_amount = 500, fine_paid = TRUE`.

---

### TC-VOL4-013: Critical Breakage Escalation to Head of Department
* **Test ID & Classification Tag**: `TC-VOL4-013` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/incidents.ts` &rarr; `escalateIncidentToHOD(incidentId)`
* **Preconditions & RBAC Matrix**:
  * Role: `lab_incharge` reviewing major equipment failure.
* **Sequential Step-by-Step Path**:
  1. Open incident drawer for critical incident.
  2. Click `"Escalate to Head of Department"`.
  3. Input Escalation Remarks: `"Requires administrative purchase order for optical prism replacement."`
  4. Click `"Confirm Escalation"`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * `public.lab_incidents.status` flips to `'escalated_to_hod'`.
  * Automated email alert queued for HOD email address.

---

### TC-VOL4-014: Incident Automated Email Alert Dispatch
* **Test ID & Classification Tag**: `TC-VOL4-014` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/notifications.ts` &rarr; `dispatchIncidentEmailAlert`
* **Preconditions & RBAC Matrix**:
  * Critical incident reported.
* **Sequential Step-by-Step Path**:
  1. Verify email dispatch log.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Row created in `public.email_dispatch_logs` with template `incident_alert_hod` and `status = 'delivered'`.

---

### TC-VOL4-015: Incident Lifecycle State Machine (Reported &rarr; Investigating &rarr; Resolved)
* **Test ID & Classification Tag**: `TC-VOL4-015` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/incidents.ts` &rarr; `updateIncidentStatus`
* **Preconditions & RBAC Matrix**:
  * Role: `hod` or `lab_incharge`.
* **Sequential Step-by-Step Path**:
  1. Transition incident status from `reported` &rarr; `investigating`.
  2. Transition from `investigating` &rarr; `resolved` with resolution notes: `"Equipment replaced and recalibrated."`
* **Layer 4: PostgreSQL & Audit Invariant**:
  * `public.lab_incidents` has `resolved_at IS NOT NULL` and `status = 'resolved'`.

---

### TC-VOL4-016: Mobile < 768px Incident Triage Cards Layout
* **Test ID & Classification Tag**: `TC-VOL4-016` • `[MANUAL-DEVICE]` + `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Route: `app/(dashboard)/records/incidents/page.tsx`
* **Preconditions & RBAC Matrix**:
  * Viewport: 393×873 px (Vivo V23 5G).
* **Sequential Step-by-Step Path**:
  1. Open `/records/incidents` on mobile.
  2. Inspect incident cards.
* **Layer 1: UI & Geometry Proof**:
  * Each card has full width `393px - 32px padding = 361px`.
  * Severity badge (Red `Major`, Amber `Moderate`, Gray `Minor`) sits in top-right corner.
  * Status transition button sits in card footer above the bottom dock clearance.

---

### TC-VOL4-017: Equipment Incident Detail Drawer Telemetry & Repair Notes
* **Test ID & Classification Tag**: `TC-VOL4-017` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Component: `components/records/incident-detail-drawer.tsx`
* **Preconditions & RBAC Matrix**:
  * Any authenticated user clicking an incident record.
* **Sequential Step-by-Step Path**:
  1. Click an incident card.
  2. Drawer slides in from right edge (`max-w-[480px]`).
  3. Verify timeline of status transitions, fine payment receipts, and repair observations.
* **Layer 1: UI & Geometry Proof**:
  * Drawer backdrop has `z-index: 70`.

---

### TC-VOL4-018: Soft-Archiving of Referenced Incident Categories
* **Test ID & Classification Tag**: `TC-VOL4-018` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/workstations.ts` &rarr; `manageIssueCategory`
* **Preconditions & RBAC Matrix**:
  * An incident category `"Glassware Breakage"` is linked to 15 historical incidents.
* **Sequential Step-by-Step Path**:
  1. Admin attempts to delete `"Glassware Breakage"`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * System soft-archives category (`is_active = FALSE`) instead of hard-deleting, preserving foreign key integrity across past incident reports (Rule 15).

---

## 3. Preventive Maintenance & Workstation Fleet Diagnostics

### TC-VOL4-019: Preventive Routine Plan Authoring with Multi-Cadence Presets
* **Test ID & Classification Tag**: `TC-VOL4-019` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Route: `app/(dashboard)/maintenance/page.tsx`
  * Action: `app/actions/maintenance.ts` &rarr; `saveMaintenancePlan`
  * Component: `components/maintenance/create-plan-modal.tsx`
* **Preconditions & RBAC Matrix**:
  * Role: `lab_incharge` or `super_admin`.
* **Sequential Step-by-Step Path**:
  1. On `/maintenance`, click `"Create Preventive Routine"`.
  2. Input Title: `"Monthly Thermal Paste & Heatsink De-dusting"`.
  3. Select Cadence: `"monthly"`.
  4. Select Affected Machines: `['PC-01', 'PC-02', ..., 'PC-34']`.
  5. Add checklist items: `["Open side panel", "Clean heatsink fins", "Apply Arctic MX-4 paste", "Record CPU idle temp"]`.
  6. Click `"Save Preventive Plan"`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Row inserted in `public.maintenance_plans` with `affected_machines = ARRAY['PC-01'...]` and `cadence = 'monthly'`.
  * Zero financial/cost fields stored (Rule 4).

---

### TC-VOL4-020: Preventive Routine Plan Status Toggle & Deletion
* **Test ID & Classification Tag**: `TC-VOL4-020` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/maintenance.ts` &rarr; `toggleMaintenancePlanStatus`, `deleteMaintenancePlan`
* **Preconditions & RBAC Matrix**:
  * Role: `lab_incharge`.
* **Sequential Step-by-Step Path**:
  1. Toggle routine switch from Active to Inactive.
  2. Verify routine status updates to paused.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * `public.maintenance_plans.is_active` set to `FALSE`.

---

### TC-VOL4-021: Machine Fleet Routine Checklist Execution
* **Test ID & Classification Tag**: `TC-VOL4-021` • `[AUTO-E2E-GEOMETRY]` + `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Component: `components/maintenance/fleet-routine-modal.tsx`
  * Action: `app/actions/maintenance-fleet.ts` &rarr; `updateFleetTerminalStatus`
* **Preconditions & RBAC Matrix**:
  * Technician servicing PC-01 under Monthly De-dusting plan.
* **Sequential Step-by-Step Path**:
  1. Open Monthly De-dusting fleet modal.
  2. Click `PC-01`. Check off all 4 maintenance steps.
  3. Input observations: `"Idle temp dropped from 58C to 39C."`
  4. Click `"Mark PC-01 Completed"`.
* **Layer 1: UI & Geometry Proof**:
  * PC-01 badge flips from Amber `"Pending"` to Emerald `"Serviced"`.

---

### TC-VOL4-022: Batch Fleet Terminal Status Update & Archive to Logbook
* **Test ID & Classification Tag**: `TC-VOL4-022` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/maintenance-fleet.ts` &rarr; `archiveFleetRoutineToLog`
* **Preconditions & RBAC Matrix**:
  * All 34 workstations completed under routine plan.
* **Sequential Step-by-Step Path**:
  1. Click `"Archive Complete Routine to Service Logbook"`.
  2. Dialog confirms archiving.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Row created in `public.maintenance_logs` certified by technician ID with `status = 'completed'`.
  * Next recommended service date automatically set to `CURRENT_DATE + 30 days`.

---

### TC-VOL4-023: Overdue Maintenance Alert Snoozing & Notification Dispatch
* **Test ID & Classification Tag**: `TC-VOL4-023` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/maintenance.ts` &rarr; `snoozeMaintenanceReminder`
  * Component: `components/maintenance/snooze-modal.tsx`
* **Preconditions & RBAC Matrix**:
  * Maintenance plan is 3 days overdue.
* **Sequential Step-by-Step Path**:
  1. Click amber overdue reminder card.
  2. Select Snooze Duration: `"3 Days"`.
  3. Input Snooze Reason: `"Terminal parts arriving Wednesday."`
  4. Click `"Confirm Snooze"`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * `snoozed_until` timestamp set in `public.maintenance_plans`. Overdue alert suppressed until expiry.

---

### TC-VOL4-024: Workstation Dynamic Operational Status Derivation (Zero Status Column)
* **Test ID & Classification Tag**: `TC-VOL4-024` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Route: `app/(dashboard)/maintenance/workstations/page.tsx`
  * Component: `components/maintenance/workstations/workstation-node.tsx`
* **Preconditions & RBAC Matrix**:
  * System Invariant: `public.workstations` does NOT contain a static `status` column (Rule 19).
* **Sequential Step-by-Step Path**:
  1. Workstation `PC-05` has active issue with `status = 'in_progress'`.
  2. Workstation `PC-06` has active issue with `status = 'open'`.
  3. Workstation `PC-07` has zero active issues.
* **Layer 1: UI & Geometry Proof**:
  * PC-05 displays Amber LED: `under_repair`.
  * PC-06 displays Rose LED: `flagged`.
  * PC-07 displays Emerald LED: `operational`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Status derived in real time from SQL join on `public.workstation_issues`.

---

### TC-VOL4-025: Workstation Node Creation & Batch Grid Provisioning
* **Test ID & Classification Tag**: `TC-VOL4-025` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/workstations.ts` &rarr; `provisionCustomGridWorkstations(labId, rows, cols)`
* **Preconditions & RBAC Matrix**:
  * Role: `super_admin` setting up new 30-seat laboratory room.
* **Sequential Step-by-Step Path**:
  1. In CAD Layout Editor, click `"Batch Grid Provisioning"`.
  2. Input Rows: `5`, Columns: `6`, Prefix: `"PC-"`.
  3. Click `"Generate 30 Workstation Nodes"`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * 30 rows created in `public.workstations` with calculated `pos_x` and `pos_y` coordinates.

---

### TC-VOL4-026: Workstation Fault Reporting & Hardware Ticket Triage
* **Test ID & Classification Tag**: `TC-VOL4-026` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/workstations.ts` &rarr; `reportWorkstationIssue`
* **Preconditions & RBAC Matrix**:
  * Student reports faulty mouse on PC-18.
* **Sequential Step-by-Step Path**:
  1. On CAD floor, click PC-18. Click `"Report Issue"`.
  2. Select Category: `"Peripheral / Mouse"`, Severity: `"low"`, Title: `"Mouse optical sensor drifting"`.
  3. Click `"Submit Fault Ticket"`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Row inserted in `public.workstation_issues` with `status = 'open'`. Workstation LED turns Rose.

---

### TC-VOL4-027: Workstation Issue Resolution & Technician Hand-off
* **Test ID & Classification Tag**: `TC-VOL4-027` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/workstations.ts` &rarr; `resolveWorkstationIssue(issueId, resolutionNotes)`
* **Preconditions & RBAC Matrix**:
  * Technician replaces mouse.
* **Sequential Step-by-Step Path**:
  1. Open triage drawer for PC-18.
  2. Click `"Mark Resolved"`. Input notes: `"Replaced with Logitech USB optical mouse."`
  3. Confirm resolution.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * `public.workstation_issues` updated: `status = 'resolved', resolved_at = NOW()`.
  * Workstation LED synchronously flips back to Emerald (`operational`).

---

### TC-VOL4-028: Workstation Hardware Security Binding Reset
* **Test ID & Classification Tag**: `TC-VOL4-028` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/workstations.ts` &rarr; `resetWorkstationHardwareBinding(workstationId)`
* **Preconditions & RBAC Matrix**:
  * Role: `super_admin` replacing upgraded motherboard on PC-14.
* **Sequential Step-by-Step Path**:
  1. In Workstation Diagnostics, locate PC-14.
  2. Click `"Reset Hardware Binding"`.
  3. Safety confirmation dialog opens. Confirm reset.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * `public.workstations.hardware_binding_hash` set to `NULL` and `is_locked = FALSE`. Workstation unlocked for re-pairing.

---

## 4. Print Engines & Streaming Data Exports

### TC-VOL4-029: Cryptographic Print Selection Session Minting
* **Test ID & Classification Tag**: `TC-VOL4-029` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/records.ts` &rarr; `createPrintSelectionSessionAction(ids)`
* **Preconditions & RBAC Matrix**:
  * User selects 5 specific practical logs to print an official board dossier.
* **Sequential Step-by-Step Path**:
  1. Check checkboxes for records #1, #3, #4, #7, #9.
  2. Click `"Print Selected Records"`.
* **Layer 2 & 3: Cache & Network Proof**:
  * Server Action mints temporary session token: `{ success: true, sessionId: 'print-token-abc' }`.
  * Window opens `/print/records?session=print-token-abc`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Row created in `public.print_selection_sessions` with 1-hour expiration timestamp.

---

### TC-VOL4-030: NEB A4 Landscape Daily Practical Register Print Sheet
* **Test ID & Classification Tag**: `TC-VOL4-030` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Route: `app/(dashboard)/print/daily-log/page.tsx`
* **Preconditions & RBAC Matrix**:
  * Viewport: 1122×793 px (A4 Landscape standard at 96 DPI).
* **Sequential Step-by-Step Path**:
  1. Navigate to `/print/daily-log?id=log-uuid-1`.
  2. Inspect print sheet layout.
* **Layer 1: UI & Geometry Proof**:
  * Header displays official NEB institution banner and Bikram Sambat date.
  * `@media print` CSS rules: Navigation header, sidebar, and buttons hidden (`display: none !important`).
  * Table rows protected against split: `tr { page-break-inside: avoid; }`.
  * Three-Tier Official Signature Block rendered at bottom: (Subject Teacher, Lab In-Charge, Principal).

---

### TC-VOL4-031: Certified Practical Records Ledger Print Sheet
* **Test ID & Classification Tag**: `TC-VOL4-031` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Route: `app/(dashboard)/print/records/page.tsx`
* **Preconditions & RBAC Matrix**:
  * Batch print of 25 practical records.
* **Layer 1: UI & Geometry Proof**:
  * Multi-page pagination renders running headers and page numbers (`Page X of Y`).

---

### TC-VOL4-032: Official Equipment Breakage & Hazard Register Print Sheet
* **Test ID & Classification Tag**: `TC-VOL4-032` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Route: `app/(dashboard)/print/incidents/page.tsx`
* **Preconditions & RBAC Matrix**:
  * HOD printing annual laboratory equipment damage ledger.
* **Layer 1: UI & Geometry Proof**:
  * Includes columns: Incident Date (BS), Equipment Name, Description of Damage, Responsible Student Roll, Fine Assessed, Witness Signature.

---

### TC-VOL4-033: Certified Technical Service Logbook Print Sheet
* **Test ID & Classification Tag**: `TC-VOL4-033` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Route: `app/(dashboard)/print/maintenance/page.tsx`
* **Preconditions & RBAC Matrix**:
  * External technical audit inspection.
* **Layer 1: UI & Geometry Proof**:
  * Lists certified maintenance history with technician license/name and next recommended service dates.

---

### TC-VOL4-034: Official Classroom Wall Seating Chart Print Sheet
* **Test ID & Classification Tag**: `TC-VOL4-034` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Route: `app/(dashboard)/print/seating-chart/page.tsx`
* **Preconditions & RBAC Matrix**:
  * Laminated classroom wall chart for Class 11 Science A.
* **Layer 1: UI & Geometry Proof**:
  * Groups desks into Rows A through D with teacher podium at top center.
  * High-contrast black-and-white print styling for clean physical lamination.

---

### TC-VOL4-035: Streaming Binary XLSX Workbook & CSV Export Engine
* **Test ID & Classification Tag**: `TC-VOL4-035` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Endpoint: `app/api/export/[type]/route.ts`
  * Action: `app/actions/records.ts` &rarr; `exportPracticalRecordsAction`
  * Engine: `lib/exports/xlsx.ts`
* **Preconditions & RBAC Matrix**:
  * User clicking `"Export to Excel (.xlsx)"` on filtered practical records.
* **Sequential Step-by-Step Path**:
  1. Click `"Export to Excel"`.
  2. Browser downloads file: `LabSync_Practical_Records_2083.xlsx`.
* **Layer 2 & 3: Cache & Network Proof**:
  * Response header: `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
  * Response header: `Content-Disposition: attachment; filename="LabSync_Practical_Records_2083.xlsx"`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Generated Excel file contains institutional header banner, styled table headers with fill `#1E293B`, and three-tier signature blocks.

