# LabSync LIMS — IEEE 29119 QA Specification Suite
## VOLUME 3: Master Timetable Routine, 3-Way Conflict Engine, Faculty Substitutions & Lab Facilities

> **Document Reference**: `LMR-QA-VOL3-2026-V1`  
> **Standard**: ISO/IEC/IEEE 29119-3:2021 (Test Documentation), IEEE 829  
> **Traceability Root**: [00-MASTER-QA-INDEX-AND-RTM.md](file:///d:/Projects/LMR/doc/qa/00-MASTER-QA-INDEX-AND-RTM.md)  
> **Scope**: Route `/schedules`, Timetable Grid, Triple-Collision Engine, Substitutions, Facility Lifecycle, Daily Reminder Crons  
> **Status**: APPROVED & CANONICAL  
> **Last Verified**: 2026-11-12

---

## 1. Master Timetable Routine & Responsive Grid Engine

### TC-VOL3-001: Laboratory Facility Tab Filtering & SWR State Switching
* **Test ID & Classification Tag**: `TC-VOL3-001` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Route: `app/(dashboard)/schedules/page.tsx`
  * Components: `components/schedules/schedule-grid-client.tsx`, `components/ui/sliding-segmented-tabs.tsx`
  * Action: `app/actions/schedules.ts` &rarr; `getLabs`
* **Preconditions & RBAC Matrix**:
  * Role: Any authenticated role (`super_admin`, `lab_incharge`, `hod`, `teacher`).
  * Viewports: 393×873 (Vivo V23 5G), 768×858, 1686×858.
* **Sequential Step-by-Step Path**:
  1. Navigate to `/schedules`.
  2. Locate top facility tab bar: `[All Labs]`, `[Computer Lab 1]`, `[Physics Lab]`, `[Chemistry Lab]`, `[Biology Lab]`.
  3. Click `[Physics Lab]`.
  4. Verify timetable grid updates to display only Physics Laboratory routines.
  5. Click `[All Labs]`.
* **Combinatorial & Edge Permutations**:
  * Rapid switching between tabs (< 100ms) &rarr; Zero skeleton flicker; SWR cache renders cached timetable instantly via `getCachedQuery`.
  * Lab facility marked `Under Maintenance` &rarr; Tab displays amber badge `[Under Maintenance]`.
* **Layer 1: UI & Geometry Proof**:
  * Sliding segmented tab indicator animates smoothly with transform matrix: `style="transform: translateX(...)"`.
  * Height of facility tab pill: `tab.getBoundingClientRect().height >= 40px`.
* **Layer 2 & 3: Cache & Network Proof**:
  * `getLabs` cached in client memory for 300,000ms (`staleTimeMs = 5min`).
  * Re-clicking a previously visited tab generates 0 network requests.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Filtered periods match SQL condition: `SELECT * FROM public.schedules WHERE lab_id = 'physics-lab-uuid'`.

---

### TC-VOL3-002: Sunday–Friday Academic Day Selector & Active Day Highlight
* **Test ID & Classification Tag**: `TC-VOL3-002` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Route: `app/(dashboard)/schedules/page.tsx`
  * Component: `components/schedules/routine-manager.tsx`
* **Preconditions & RBAC Matrix**:
  * Current system day: Sunday (Nepali academic week start) through Friday.
* **Sequential Step-by-Step Path**:
  1. Open `/schedules`.
  2. Observe the 6-day academic selector: `[Sun]`, `[Mon]`, `[Tue]`, `[Wed]`, `[Thu]`, `[Fri]`.
  3. Verify current weekday automatically receives active styling: `bg-indigo-600 text-white font-bold`.
  4. Saturday (Day 6) is excluded from the selector per Nepali institutional statutory weekend policy.
* **Layer 1: UI & Geometry Proof**:
  * Day selector touch target: `btn.getBoundingClientRect().height >= 44px` on mobile viewports.
  * Spacing between day buttons: `gap >= 8px`.

---

### TC-VOL3-003: Desktop 7-Column Timetable Matrix Rendering
* **Test ID & Classification Tag**: `TC-VOL3-003` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Route: `app/(dashboard)/schedules/page.tsx`
  * Component: `components/schedules/schedule-grid-client.tsx`
* **Preconditions & RBAC Matrix**:
  * Viewport >= 1024px (`lg:block`).
* **Sequential Step-by-Step Path**:
  1. Open `/schedules` at 1280×800 or 1686×858.
  2. Inspect main grid layout.
  3. Verify 7 period columns: `Period 1 (10:15 - 11:00)`, `Period 2 (11:00 - 11:45)`, `Period 3 (11:45 - 12:30)`, `Break (12:30 - 01:15)`, `Period 4 (01:15 - 02:00)`, `Period 5 (02:00 - 02:45)`, `Period 6 (02:45 - 03:30)`.
* **Layer 1: UI & Geometry Proof**:
  * Desktop matrix container has `display: block` and mobile stacked cards have `display: none` (`hidden md:block`).
  * Table column widths evenly distributed with `table-fixed`.
  * Zero horizontal text collision or ellipsis truncation in period cells.

---

### TC-VOL3-004: Mobile (< 768px, 393px Vivo V23 5G) Vertical Stacked Period Cards
* **Test ID & Classification Tag**: `TC-VOL3-004` • `[MANUAL-DEVICE]` + `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Route: `app/(dashboard)/schedules/page.tsx`
  * Component: `components/schedules/schedule-grid-client.tsx`
* **Preconditions & RBAC Matrix**:
  * Viewport: 393×873 px (Device: Vivo V23 5G standalone PWA).
* **Sequential Step-by-Step Path**:
  1. Open `/schedules` on Vivo V23 5G.
  2. Verify desktop matrix table is completely unmounted (`count === 0` in DOM or `hidden md:block`).
  3. Verify periods render as clean, vertically stacked mobile cards.
  4. Each card displays: Period Number badge (`Period 2`), Time Slot (`11:00 - 11:45 AM`), Subject Title (`Computer Science`), Class Grade (`Class 11 Science A`), Assigned Teacher, and Facility Room.
* **Layer 1: UI & Geometry Proof**:
  * Zero horizontal document scrollbar: `document.documentElement.scrollWidth <= 393`.
  * Minimum touch target for period card: `card.getBoundingClientRect().height >= 72px`.
  * Safe area padding: Last card bottom clearance above bottom dock: `lastCard.bottom <= window.innerHeight - 64 - 16` (`pb-28`).

---

### TC-VOL3-005: Scheduled Period Slot Creation & Roster Binding
* **Test ID & Classification Tag**: `TC-VOL3-005` • `[AUTO-DB-INTEGRATION]` + `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Component: `components/schedules/session-action-modal.tsx`
  * Action: `app/actions/schedules.ts` &rarr; `createSchedule(payload)`
* **Preconditions & RBAC Matrix**:
  * Role: `super_admin` or `lab_incharge` (requires `can_manage_maintenance` or admin rights).
* **Sequential Step-by-Step Path**:
  1. Click an empty slot on the timetable (e.g., Tuesday Period 3, Computer Lab 1).
  2. Modal opens with title `"Schedule Laboratory Period"`.
  3. Select Class: `"Class 11 Science B"`.
  4. Select Subject: `"Computer Science"`.
  5. Select Instructor: `"Er. Ramesh Adhikari"`.
  6. Default Enrolled Students count auto-populates to `34`.
  7. Click `"Create Timetable Entry"`.
* **Combinatorial & Edge Permutations**:
  * Missing instructor &rarr; Validation error `"Instructor is required."`
  * Slot already occupied &rarr; Intercepted by Triple-Collision Engine before database write.
* **Layer 1: UI & Geometry Proof**:
  * Modal has `z-index: 70`. Form fields have minimum height `44px`.
* **Layer 2 & 3: Cache & Network Proof**:
  * Server action returns `{ success: true, scheduleId: 'sched-uuid-99' }`.
  * Query cache `schedules:list` invalidated.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Row inserted in `public.schedules`:
    ```sql
    SELECT day_of_week, time_slot, subject_title, class_grade, teacher_id 
    FROM public.schedules WHERE id = 'sched-uuid-99';
    -- Assert: day_of_week = 2, subject_title = 'Computer Science', default_students = 34
    ```

---

### TC-VOL3-006: Scheduled Period Update & Teacher Reassignment
* **Test ID & Classification Tag**: `TC-VOL3-006` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Component: `components/schedules/session-action-modal.tsx`
  * Action: `app/actions/schedules.ts` &rarr; `updateSchedule(id, payload)`
* **Preconditions & RBAC Matrix**:
  * Role: `super_admin`.
* **Sequential Step-by-Step Path**:
  1. Click existing period card for Class 11 Science A.
  2. Click `"Edit Period Details"`.
  3. Change Teacher from `"Teacher A"` to `"Teacher B"`.
  4. Click `"Save Changes"`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * `public.schedules` updated: `teacher_id = 'teacher-b-uuid'`.
  * Audit ledger records: `entity_type = 'schedule', action = 'update'`.

---

### TC-VOL3-007: Scheduled Period Deletion with Dependency Guard
* **Test ID & Classification Tag**: `TC-VOL3-007` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/schedules.ts` &rarr; `deleteSchedule(id)`
* **Preconditions & RBAC Matrix**:
  * Role: `super_admin`.
* **Sequential Step-by-Step Path**:
  1. Select a routine period slot.
  2. Click `"Delete Period"`.
  3. Safety confirmation dialog displays: `"Are you sure you want to remove this timetable slot?"`
  4. Confirm deletion.
* **Combinatorial & Edge Permutations**:
  * Period already has linked historical practical logs (`public.practical_logs.schedule_id`) &rarr; Deletion blocked or schedule soft-archived (`status = 'archived'`) to preserve academic records integrity.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Schedule deleted or set `status = 'archived'`. Foreign keys to `practical_logs` remain intact.

---

### TC-VOL3-008: Multi-Period Block Merging (Double Practical Sessions)
* **Test ID & Classification Tag**: `TC-VOL3-008` • `[AUTO-DB-INTEGRATION]` + `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Action: `app/actions/schedules.ts` &rarr; `mergeSchedules(primaryId, secondaryId)`
  * Component: `components/schedules/routine-manager.tsx`
* **Preconditions & RBAC Matrix**:
  * Two contiguous periods on same day (e.g., Period 1 & Period 2, Class 12 Chemistry).
* **Sequential Step-by-Step Path**:
  1. Select Period 1.
  2. Click `"Merge with Next Period"`.
  3. Verify Period 1 and Period 2 fuse into a single double-width block (`span: 2`).
  4. Time label updates to `"10:15 - 11:45 AM (90 mins)"`.
* **Layer 1: UI & Geometry Proof**:
  * On desktop matrix: Fused cell spans 2 table columns (`col-span-2`).
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Primary schedule row updated with `span = 2`. Secondary schedule row marked inactive or merged.

---

### TC-VOL3-009: Multi-Period Block Unmerging
* **Test ID & Classification Tag**: `TC-VOL3-009` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/schedules.ts` &rarr; `unmergeSchedule(scheduleId)`
* **Preconditions & RBAC Matrix**:
  * Existing merged double-period schedule (`span = 2`).
* **Sequential Step-by-Step Path**:
  1. Click merged double-period block.
  2. Click `"Unmerge into Single Periods"`.
  3. Verify block splits back into 2 distinct 45-minute period cards.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Primary row reset to `span = 1`. Secondary period row re-activated.

---

### TC-VOL3-010: Master Timetable Reset with "Precaution Active" Lock
* **Test ID & Classification Tag**: `TC-VOL3-010` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/schedules.ts` &rarr; `resetSchedulesToMaster(labId)`
* **Preconditions & RBAC Matrix**:
  * Role: `super_admin` with safety toggle `"Precaution Active"` enabled.
* **Sequential Step-by-Step Path**:
  1. Attempt to click `"Reset Lab Timetable to Master Default"` while `"Precaution Active"` is ON.
  2. Button is locked with warning tooltip: `"Safety Precaution Active: Unlock toggle to perform destructive action."`
  3. Switch `"Precaution Active"` to OFF.
  4. Click `"Reset Lab Timetable"`. Confirm with password verification.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Timetable re-seeded from institutional master blueprint. Audit ledger records emergency reset.

---

## 2. Triple-Collision Defense Engine (`conflict-engine.ts`)

### TC-VOL3-011: Conflict Dimension 1 — Laboratory Room Double-Booking Rejection
* **Test ID & Classification Tag**: `TC-VOL3-011` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Lib: `lib/scheduling/conflict-engine.ts` &rarr; `detectScheduleCollisions`
  * Action: `app/actions/schedules.ts` &rarr; `createSchedule`
* **Preconditions & RBAC Matrix**:
  * Room `Computer Lab 1` is already booked for Sunday Period 2 by Class 11 Science A.
* **Sequential Step-by-Step Path**:
  1. Attempt to create a new schedule entry for `Computer Lab 1` on Sunday Period 2 for Class 12 Science B.
* **Layer 1: UI & Geometry Proof**:
  * UI displays red conflict alert banner:
    `"Room Collision Detected: Computer Lab 1 is already allocated to Class 11 Science A during Sunday Period 2."`
* **Layer 2 & 3: Cache & Network Proof**:
  * `createSchedule` rejects with `{ success: false, conflictType: 'ROOM_COLLISION', details: {...} }`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Zero rows inserted in `public.schedules`. Table row count remains unchanged.

---

### TC-VOL3-012: Conflict Dimension 2 — Faculty Member Double-Booking Rejection
* **Test ID & Classification Tag**: `TC-VOL3-012` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Lib: `lib/scheduling/conflict-engine.ts`
  * Action: `app/actions/schedules.ts`
* **Preconditions & RBAC Matrix**:
  * Teacher `Mr. K.P. Sharma` is scheduled in `Physics Lab` on Monday Period 3.
* **Sequential Step-by-Step Path**:
  1. Attempt to schedule `Mr. K.P. Sharma` in `Computer Lab 1` on Monday Period 3.
* **Layer 1: UI & Geometry Proof**:
  * Modal displays warning:
    `"Faculty Collision Detected: Mr. K.P. Sharma is already teaching in Physics Lab during Monday Period 3."`
* **Layer 2 & 3: Cache & Network Proof**:
  * Server action returns `{ success: false, conflictType: 'TEACHER_COLLISION' }`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Database transaction aborted.

---

### TC-VOL3-013: Conflict Dimension 3 — Student Class/Cohort Double-Booking Rejection
* **Test ID & Classification Tag**: `TC-VOL3-013` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Lib: `lib/scheduling/conflict-engine.ts`
* **Preconditions & RBAC Matrix**:
  * Student cohort `Class 11 Science A` is scheduled for Biology Practical on Wednesday Period 4.
* **Sequential Step-by-Step Path**:
  1. Attempt to schedule `Class 11 Science A` for Computer Lab Practical on Wednesday Period 4.
* **Layer 1: UI & Geometry Proof**:
  * Conflict banner displays:
    `"Cohort Collision: Class 11 Science A is already scheduled in Biology Lab during Wednesday Period 4."`
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Database write prevented.

---

### TC-VOL3-014: Conflict Free Window Permitted Pass-Through
* **Test ID & Classification Tag**: `TC-VOL3-014` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Lib: `lib/scheduling/conflict-engine.ts`
* **Preconditions & RBAC Matrix**:
  * Room, Faculty, and Cohort are all completely unreserved on Thursday Period 5.
* **Sequential Step-by-Step Path**:
  1. Submit schedule creation request.
* **Layer 2 & 3: Cache & Network Proof**:
  * `detectScheduleCollisions` returns `{ hasConflict: false, conflicts: [] }`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Row inserted cleanly with HTTP 200 response.

---

## 3. Teacher Substitutions & Live Routine Overrides

### TC-VOL3-015: Assigning a Substitute Teacher for a Specific Date/Slot
* **Test ID & Classification Tag**: `TC-VOL3-015` • `[AUTO-DB-INTEGRATION]` + `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Action: `app/actions/substitutions.ts` &rarr; `assignSubstitute(payload)`
  * Component: `components/schedules/substitute-teacher-modal.tsx`
* **Preconditions & RBAC Matrix**:
  * Role: `hod` or `super_admin`. Regular teacher reports sick leave for tomorrow.
* **Sequential Step-by-Step Path**:
  1. On `/schedules`, click tomorrow's schedule period for Teacher A.
  2. Click `"Assign Substitute Instructor"`.
  3. Select Substitute Teacher: `"Er. Sunita Karki"`.
  4. Input Reason: `"Medical Leave"`.
  5. Click `"Confirm Substitution"`.
* **Layer 1: UI & Geometry Proof**:
  * Routine period card displays purple badge: `"Substitute: Er. Sunita Karki"`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Row inserted in `public.teacher_substitutions`:
    ```sql
    SELECT original_teacher_id, substitute_teacher_id, date, status 
    FROM public.teacher_substitutions WHERE schedule_id = 'sched-1' AND status = 'active';
    ```

---

### TC-VOL3-016: Substitute Teacher Collision Pre-Flight Check
* **Test ID & Classification Tag**: `TC-VOL3-016` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Lib: `lib/scheduling/conflict-engine.ts`
  * Action: `app/actions/substitutions.ts`
* **Preconditions & RBAC Matrix**:
  * Proposed substitute teacher is already conducting another practical in Chemistry Lab at that exact time.
* **Sequential Step-by-Step Path**:
  1. Attempt to assign substitute teacher.
* **Layer 1: UI & Geometry Proof**:
  * Modal displays error: `"Selected substitute teacher has a schedule conflict during this period."`
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Substitution rejected before insert.

---

### TC-VOL3-017: Viewing Active Institutional Substitutions Ledger
* **Test ID & Classification Tag**: `TC-VOL3-017` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Action: `app/actions/substitutions.ts` &rarr; `getSubstitutions`
  * Component: `components/schedules/substitutions-ledger-modal.tsx`
* **Preconditions & RBAC Matrix**:
  * 3 active substitutions registered across the institution for this week.
* **Sequential Step-by-Step Path**:
  1. Click `"Active Substitutions"` button in schedules header.
  2. Modal opens displaying table of active substitutions, dates, affected labs, and substitute teacher names.
* **Layer 1: UI & Geometry Proof**:
  * Modal table renders cleanly with zebra striping and `min-h-[44px]` action rows.

---

### TC-VOL3-018: Cancelling an Active Substitution & Restoring Regular Teacher
* **Test ID & Classification Tag**: `TC-VOL3-018` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/substitutions.ts` &rarr; `cancelSubstitution(substitutionId)`
* **Preconditions & RBAC Matrix**:
  * Regular teacher returns early from leave.
* **Sequential Step-by-Step Path**:
  1. In Substitutions Ledger, locate substitution for Teacher A.
  2. Click `"Cancel Substitution"`.
  3. Confirm cancellation.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Row in `public.teacher_substitutions` updated: `status = 'cancelled', cancelled_at = NOW()`.
  * Timetable grid reverts to displaying original teacher.

---

## 4. Laboratory Facility Management Lifecycle

### TC-VOL3-019: Creating a New Laboratory Facility Room
* **Test ID & Classification Tag**: `TC-VOL3-019` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/labs.ts` &rarr; `createLabFacility(payload)`
* **Preconditions & RBAC Matrix**:
  * Role: `super_admin`.
* **Sequential Step-by-Step Path**:
  1. In Admin Center or Schedules Facility Manager, click `"Add New Laboratory Room"`.
  2. Fill Name: `"Robotics & IoT Laboratory"`, Code: `"ROBOTICS-LAB"`, Capacity: `30`, Type: `computer_lab`, Status: `Operational`.
  3. Click `"Save Facility"`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Row inserted into `public.labs`:
    ```sql
    SELECT name, code, capacity, status, is_active FROM public.labs WHERE code = 'ROBOTICS-LAB';
    -- Assert: status = 'Operational' AND is_active = TRUE
    ```

---

### TC-VOL3-020: Lab Facility Status Constraint Enforcement
* **Test ID & Classification Tag**: `TC-VOL3-020` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/labs.ts` &rarr; `updateLabFacility`
* **Preconditions & RBAC Matrix**:
  * Attempt to set unapproved status string (e.g., `'maintenance'`, `'closed'`).
* **Sequential Step-by-Step Path**:
  1. Dispatch update payload with `status: 'maintenance'`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Database constraint `labs_status_check` (`CHECK (status IN ('Operational', 'Under Maintenance', 'Inactive'))`) rejects payload with error.

---

### TC-VOL3-021: Non-Operational Lab Booking Block Guard
* **Test ID & Classification Tag**: `TC-VOL3-021` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/schedules.ts` &rarr; `createSchedule`
* **Preconditions & RBAC Matrix**:
  * Lab status: `Under Maintenance`.
* **Sequential Step-by-Step Path**:
  1. Attempt to book a timetable period or start an ad-hoc session in this lab.
* **Layer 1: UI & Geometry Proof**:
  * Error message: `"Laboratory facility is currently Under Maintenance and cannot be scheduled for practical classes."`
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Server action checks `public.labs.is_active === TRUE` before allowing schedule creation.

---

### TC-VOL3-022: Deleting an Empty Laboratory Facility
* **Test ID & Classification Tag**: `TC-VOL3-022` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/labs.ts` &rarr; `deleteLabFacility(labId)`
* **Preconditions & RBAC Matrix**:
  * Role: `super_admin`. Newly created lab with 0 workstations and 0 schedules.
* **Sequential Step-by-Step Path**:
  1. Click `"Delete Facility"`.
  2. Confirm dialog.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Lab row deleted from `public.labs`. Audit ledger logs deletion.

---

### TC-VOL3-023: Deleting a Laboratory Facility with Dependencies Rejection
* **Test ID & Classification Tag**: `TC-VOL3-023` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/labs.ts` &rarr; `deleteLabFacility(labId)`
* **Preconditions & RBAC Matrix**:
  * Lab facility has 34 workstations and 12 historical practical logs.
* **Sequential Step-by-Step Path**:
  1. Attempt to delete `Computer Lab 1`.
* **Layer 1: UI & Geometry Proof**:
  * Alert modal: `"Cannot delete laboratory: 34 workstations and 12 practical logs are linked to this facility. Deactivate the facility instead."`
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Foreign key constraint prevents accidental cascade deletion.

---

## 5. Automated Daily Teacher Reminder Cron Execution

### TC-VOL3-024: Automated Daily Teacher Reminder Cron Execution
* **Test ID & Classification Tag**: `TC-VOL3-024` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Endpoint: `app/api/cron/reminders/route.ts`
  * Action: `app/actions/notifications.ts` &rarr; `dispatchTeacherDailyReminders()`
* **Preconditions & RBAC Matrix**:
  * Time: 07:00 AM academic day morning. 4 teachers scheduled for practical sessions today.
* **Sequential Step-by-Step Path**:
  1. Cloud scheduler invokes `GET /api/cron/reminders` with `Authorization: Bearer CRON_SECRET`.
  2. Cron queries today's schedules matching `day_of_week`.
  3. Sends email/push notification to each scheduled teacher summarizing room, class, and time slot.
* **Combinatorial & Edge Permutations**:
  * Missing or incorrect `Bearer` token &rarr; Endpoint rejects with HTTP 401 Unauthorized (`{"error": "Unauthorized cron request"}`).
  * Today is Saturday or national holiday &rarr; Cron exits early with `{ status: "skipped_holiday", notificationsSent: 0 }`.
* **Layer 2 & 3: Cache & Network Proof**:
  * Response returns HTTP 200 with `{ success: true, count: 4, timestamp: "..." }`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Notification dispatch logged in `public.email_dispatch_logs` and notifications created in `public.notifications`.

---

### TC-VOL3-025: Upcoming Holiday Notice Cron Dispatch
* **Test ID & Classification Tag**: `TC-VOL3-025` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Endpoint: `app/api/cron/reminders/route.ts`
  * Action: `app/actions/notifications.ts` &rarr; `dispatchUpcomingHolidayNotices()`
* **Preconditions & RBAC Matrix**:
  * Bada Dashain festival begins in 2 days according to Bikram Sambat academic calendar.
* **Sequential Step-by-Step Path**:
  1. Cron executes at 08:00 AM.
  2. Queries `public.academic_holidays` for events occurring within 48 hours.
  3. Broadcasts institutional holiday alert to all faculty profiles.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Rows inserted in `public.notifications` for all active faculty profiles with category `holiday_alert`.

