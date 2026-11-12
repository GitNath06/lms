# LabSync LIMS — IEEE 29119 QA Specification Suite
## VOLUME 5: Institutional Administration, Rosters, Analytics Suite & Profile Security

> **Document Reference**: `LMR-QA-VOL5-2026-V1`  
> **Standard**: ISO/IEC/IEEE 29119-3:2021 (Test Documentation), IEEE 829  
> **Traceability Root**: [00-MASTER-QA-INDEX-AND-RTM.md](file:///d:/Projects/LMR/doc/qa/00-MASTER-QA-INDEX-AND-RTM.md)  
> **Scope**: Routes `/admin`, `/analytics`, `/profile`, 15 Admin Managers, Ingestion Pipeline, Audit Trail, Dual-OTP  
> **Status**: APPROVED & CANONICAL  
> **Last Verified**: 2026-11-12

---

## 1. Super-Admin Center, Academic Years & Cohort Promotion

### TC-VOL5-001: Super Admin Tab Switching & SWR Zero-Network Hydration
* **Test ID & Classification Tag**: `TC-VOL5-001` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Route: `app/(dashboard)/admin/page.tsx`
  * Components: `components/admin/*` (15 sub-managers)
  * Cache: `lib/cache/client-query-cache.ts` &rarr; `fetchWithClientCache`
* **Preconditions & RBAC Matrix**:
  * Role: `super_admin`.
  * Viewports: 1106×858 px, 1686×858 px.
* **Sequential Step-by-Step Path**:
  1. Open `/admin`.
  2. Click tab `"01 Academic Years"`. Wait for load.
  3. Click tab `"02 Classes & Subjects"`. Wait for load.
  4. Click tab `"01 Academic Years"` again.
* **Combinatorial & Edge Permutations**:
  * Non-super-admin user accesses `/admin` &rarr; Edge proxy and layout redirect immediately to `/` with error badge.
* **Layer 1: UI & Geometry Proof**:
  * Active manager container renders within 16ms without screen flicker or scroll reset.
* **Layer 2 & 3: Cache & Network Proof**:
  * Re-entering tab `"01 Academic Years"` generates 0 network requests; rendered synchronously from memory cache.

---

### TC-VOL5-002: Academic Operational Cycle Creation & Activation
* **Test ID & Classification Tag**: `TC-VOL5-002` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/academic-years.ts` &rarr; `createAcademicYear(payload)`
  * Component: `components/admin/academic-years-manager.tsx`
* **Preconditions & RBAC Matrix**:
  * Role: `super_admin`.
* **Sequential Step-by-Step Path**:
  1. In Academic Years Manager, click `"Create Academic Year"`.
  2. Input Identifier: `"2084"`, Name: `"2084/85"`.
  3. Start Date: `"2027-04-14"`, End Date: `"2028-04-12"`.
  4. Check `"Set as Active Year"`.
  5. Click `"Save Operational Cycle"`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Row inserted in `public.academic_years`.
  * Any previously active academic year has `is_current` flipped to `FALSE` in single atomic transaction.

---

### TC-VOL5-003: Current Academic Year Switching & System-Wide Scope Invalidation
* **Test ID & Classification Tag**: `TC-VOL5-003` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/academic-years.ts` &rarr; `setCurrentAcademicYear(id)`
* **Preconditions & RBAC Matrix**:
  * Role: `super_admin`.
* **Sequential Step-by-Step Path**:
  1. Select Academic Year `2083/84`.
  2. Click `"Set Active Academic Year"`.
  3. Modal warns: `"This will switch the active academic cycle system-wide."` Confirm switch.
* **Layer 2 & 3: Cache & Network Proof**:
  * System broadcasts cache eviction event across all open client tabs.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Exactly 1 row in `public.academic_years` has `is_current = TRUE`.

---

### TC-VOL5-004: Academic Year Dependency Pre-Flight Guard
* **Test ID & Classification Tag**: `TC-VOL5-004` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/academic-years.ts` &rarr; `checkAcademicYearDependenciesAction(id)`
* **Preconditions & RBAC Matrix**:
  * Academic Year `2082` has 120 student enrollments and 45 practical logs.
* **Sequential Step-by-Step Path**:
  1. Attempt to delete Academic Year `2082`.
* **Layer 1: UI & Geometry Proof**:
  * Alert displays dependency breakdown: `"Cannot delete: 120 student enrollments and 45 practical logs exist."`
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Deletion prevented. Year remains in database.

---

### TC-VOL5-005: Multi-Year Cohort Promotion Wizard Dry-Run Simulation
* **Test ID & Classification Tag**: `TC-VOL5-005` • `[AUTO-DB-INTEGRATION]` + `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Component: `components/admin/cohort-promotion-wizard.tsx`
  * Action: `app/actions/academic-years.ts` &rarr; `promoteCohortAction`
* **Preconditions & RBAC Matrix**:
  * Class 11 Science A (32 students) completing academic year 2083.
* **Sequential Step-by-Step Path**:
  1. Open Cohort Promotion Wizard.
  2. Source Year: `2083/84`, Source Class: `11 Science A`.
  3. Target Year: `2084/85`, Target Class: `12 Science A`.
  4. Click `"Run Promotion Dry-Run"`.
  5. Inspect Dry-Run Ledger:
     * 30 Students Promoted to Grade 12.
     * 1 Student Retained (Repeater).
     * 1 Student Marked Transferred / Left Institution.
* **Layer 1: UI & Geometry Proof**:
  * Simulation table renders breakdown with zero database changes applied.

---

### TC-VOL5-006: Atomic Cohort Promotion Batch Execution
* **Test ID & Classification Tag**: `TC-VOL5-006` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/academic-years.ts` &rarr; `executeCohortPromotionBatchAction(batchPayload)`
* **Preconditions & RBAC Matrix**:
  * Role: `super_admin` confirming Dry-Run results.
* **Sequential Step-by-Step Path**:
  1. Click `"Execute Cohort Promotion Batch"`.
  2. Confirm batch execution dialog.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * 30 new rows created in `public.student_enrollments` with `academic_year_id = '2084'` and `status = 'active'`.
  * Source year enrollments updated to `status = 'completed'` or `'archived'`.
  * Strict constraint verified: `CHECK (status IN ('active', 'transferred', 'graduated', 'archived', 'completed'))` (Rule 18).
  * Batch logged in `public.cohort_promotion_batches` for potential rollback.

---

### TC-VOL5-007: Cohort Promotion Batch Rollback Safety Net
* **Test ID & Classification Tag**: `TC-VOL5-007` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/academic-years.ts` &rarr; `rollbackCohortPromotionBatchAction(batchId)`
* **Preconditions & RBAC Matrix**:
  * Promotion executed erroneously 5 minutes ago.
* **Sequential Step-by-Step Path**:
  1. In Promotion Batches history, click `"Rollback Batch #2084-01"`.
  2. Confirm rollback.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Promoted Grade 12 enrollments deleted.
  * Grade 11 source enrollments restored to `status = 'active'`.

---

### TC-VOL5-008: Student Enrollment Status Check Constraint Enforcement
* **Test ID & Classification Tag**: `TC-VOL5-008` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Table: `public.student_enrollments`
* **Preconditions & RBAC Matrix**:
  * Direct SQL insert or buggy action attempting unapproved status `'promoted'`.
* **Sequential Step-by-Step Path**:
  1. Attempt insert with `status = 'promoted'`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * PostgreSQL check constraint `student_enrollments_status_check` throws fatal error:
    `violates check constraint "student_enrollments_status_check"`.

---

### TC-VOL5-009: Curricular Class Grade & Stream Management
* **Test ID & Classification Tag**: `TC-VOL5-009` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/classes.ts` &rarr; `createClassAction(payload)`
* **Preconditions & RBAC Matrix**:
  * Role: `super_admin`.
* **Sequential Step-by-Step Path**:
  1. In Classes & Subjects Manager, click `"Add New Class"`.
  2. Name: `"Class 11 Management"`, Grade Level: `11`, Stream: `"Management"`.
  3. Click `"Save Class"`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Row inserted in `public.classes` with `is_active = TRUE`.

---

### TC-VOL5-010: Curricular Subject CRUD & Weekly Practical Quotas
* **Test ID & Classification Tag**: `TC-VOL5-010` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/subjects.ts` &rarr; `createSubjectAction`, `assignSubjectToClassAction`
* **Preconditions & RBAC Matrix**:
  * Role: `super_admin`.
* **Sequential Step-by-Step Path**:
  1. Create Subject: `"Computer Science (Practical)"`, Code: `"COMP-201"`.
  2. Map subject to Class 11 Science A.
  3. Set Weekly Practical Quota: `2 Sessions / Week`.
  4. Assign Primary Teacher: `"Er. Ramesh Adhikari"`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Row created in `public.class_subjects` with `weekly_quota = 2`.

---

## 2. Student Roster Spreadsheet Ingestion & Batch Photos

### TC-VOL5-011: Official Multi-Stream Blank Roster Template Generation
* **Test ID & Classification Tag**: `TC-VOL5-011` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/roster-ingestion.ts` &rarr; `getBlankRosterTemplateAction`
  * Lib: `lib/roster-ingestion/template-generator.ts`
* **Preconditions & RBAC Matrix**:
  * Administrator downloading official CSV/XLSX template.
* **Sequential Step-by-Step Path**:
  1. Click `"Download Blank Roster Template"`.
  2. Choose format: `"Excel (.xlsx)"`.
* **Layer 2 & 3: Cache & Network Proof**:
  * Browser downloads file with columns: `Roll Number`, `Admission Number`, `Registration Number`, `Full Name`, `Gender`, `Section`.

---

### TC-VOL5-012: Roster Spreadsheet Parsing & Dry-Run Validation
* **Test ID & Classification Tag**: `TC-VOL5-012` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Component: `components/admin/roster-import-modal.tsx`
  * Action: `app/actions/roster-ingestion.ts` &rarr; `validateRosterFileAction`
* **Preconditions & RBAC Matrix**:
  * Administrator uploading 35-student Excel file containing 1 duplicate roll number.
* **Sequential Step-by-Step Path**:
  1. Open Roster Import Modal.
  2. Select Class: `"Class 11 Science A"`.
  3. Drop `Class11_Roster.xlsx` into dropzone.
  4. Inspect Dry-Run Pre-Flight Matrix:
     * 34 Valid Rows (Green checkmarks).
     * 1 Duplicate Error (Row 18 has duplicate Roll 14).
* **Layer 1: UI & Geometry Proof**:
  * Error highlighted with red badge: `"Duplicate Roll 14 detected at row 18."` Commit button is disabled.

---

### TC-VOL5-013: Atomic Roster Ingestion Commit with Conflict Resolution
* **Test ID & Classification Tag**: `TC-VOL5-013` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/roster-ingestion.ts` &rarr; `commitRosterIngestionAction`
* **Preconditions & RBAC Matrix**:
  * Validated 34-student roster spreadsheet.
* **Sequential Step-by-Step Path**:
  1. Click `"Commit Roster Ingestion"`.
  2. Await batch progress bar (100%).
* **Layer 4: PostgreSQL & Audit Invariant**:
  * 34 rows created in `public.students` and 34 enrollment rows created in `public.student_enrollments`.

---

### TC-VOL5-014: Class Roster Alphabetical Roll Resequencing
* **Test ID & Classification Tag**: `TC-VOL5-014` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/students.ts` &rarr; `resequenceClassRollsAlphabeticallyAction(classId)`
* **Preconditions & RBAC Matrix**:
  * Mid-year admissions created disordered roll numbers.
* **Sequential Step-by-Step Path**:
  1. Click `"Resequence Rolls Alphabetically"`.
  2. Confirm re-numbering.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * `public.student_enrollments.roll_number` re-assigned sequentially from `1` to `N` ordered by `students.full_name ASC`.

---

### TC-VOL5-015: Student Departure & Inter-Institutional Transfer
* **Test ID & Classification Tag**: `TC-VOL5-015` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/students.ts` &rarr; `transferStudentEnrollment(studentId, reason)`
* **Preconditions & RBAC Matrix**:
  * Student leaves school mid-term.
* **Sequential Step-by-Step Path**:
  1. Click student row. Select `"Transfer Student"`.
  2. Input reason: `"Family relocation to Pokhara."` Confirm transfer.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * `public.student_enrollments.status` set to `'transferred'`. Student removed from live roll-call rosters.

---

### TC-VOL5-016: Bulk Student Cohort Archival & Cohort Data Wipe
* **Test ID & Classification Tag**: `TC-VOL5-016` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/students.ts` &rarr; `bulkArchiveStudentsAction`, `wipeClassCohortDataAction`
* **Preconditions & RBAC Matrix**:
  * Role: `super_admin` with `"Precaution Active"` toggle unlocked.
* **Sequential Step-by-Step Path**:
  1. In Class Manager, click `"Bulk Archive Class Cohort"`.
  2. Confirm password authorization.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Enrollments updated to `status = 'archived'`. Historical practical log attendance tallies preserved.

---

### TC-VOL5-017: Batch Student Photo Zip Ingestion & Roll-Number Matcher
* **Test ID & Classification Tag**: `TC-VOL5-017` • `[AUTO-DB-INTEGRATION]` + `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Component: `components/admin/batch-photo-import-modal.tsx`
  * Action: `app/actions/students.ts` &rarr; `batchUpdateStudentPhotosAction`
  * Lib: `lib/student-photos/zip-parser.ts`, `lib/student-photos/compressor.ts`
* **Preconditions & RBAC Matrix**:
  * Zip archive containing 34 images named by roll number: `roll-01.jpg`, `roll-02.png`, etc.
* **Sequential Step-by-Step Path**:
  1. Open Batch Photo Import Modal for Class 11 Science A.
  2. Upload `Class11_Photos.zip` (15MB).
  3. Client unzips, matches filenames to student roll numbers, and compresses each image to 256×256 WebP (< 40KB).
  4. Inspect visual preview grid: 34 matched photos with student names.
  5. Click `"Confirm & Upload 34 Photos"`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Column `photo_url` populated in `public.students` with Supabase Storage public URLs.

---

## 3. Archival Trash Bin & Irreversible Purge Guard

### TC-VOL5-018: Unified Trash Bin Telemetry & Soft-Deleted Asset Inspection
* **Test ID & Classification Tag**: `TC-VOL5-018` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Route: `app/(dashboard)/admin/page.tsx` &rarr; Tab `"14 Unified Trash Recovery Bin"`
  * Component: `components/admin/institutional-archive-hub.tsx`
  * Action: `app/actions/archive-hub.ts` &rarr; `getArchiveHubTelemetryAction`
* **Preconditions & RBAC Matrix**:
  * Role: `super_admin`.
* **Sequential Step-by-Step Path**:
  1. Open Trash Bin tab.
  2. Inspect 3 sub-tables: Soft-Deleted Students, Archived Academic Years, Decommissioned Workstations.
* **Layer 1: UI & Geometry Proof**:
  * Visual badge displays countdown days remaining until permanent auto-purge (e.g., `"26 days left"`).

---

### TC-VOL5-019: Soft-Deleted Student Record Restoration
* **Test ID & Classification Tag**: `TC-VOL5-019` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/archive-hub.ts` &rarr; `restoreStudentAction(studentId)`
* **Preconditions & RBAC Matrix**:
  * Accidental student deletion occurred yesterday.
* **Sequential Step-by-Step Path**:
  1. In Trash Bin, click `"Restore"` next to student record.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * `public.students.is_active` set back to `TRUE` and `archived_at` set to `NULL`.

---

### TC-VOL5-020: Irreversible Permanent Trash Purge with Safety Consent
* **Test ID & Classification Tag**: `TC-VOL5-020` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/archive-hub.ts` &rarr; `permanentPurgeTrashAction`
* **Preconditions & RBAC Matrix**:
  * Role: `super_admin`. Safety toggle `"Precaution Active"` unlocked.
* **Sequential Step-by-Step Path**:
  1. Click `"Permanently Purge Expired Trash"`.
  2. Type confirmation phrase: `"PURGE FOREVER"`.
  3. Click `"Confirm Permanent Destruction"`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Hard SQL `DELETE` executed on soft-deleted rows expired > 30 days. Action logged in `public.audit_ledger`.

---

## 4. User Access, Audit Ledger & Email Diagnostics

### TC-VOL5-021: User Registration Approval & Rejection Triage
* **Test ID & Classification Tag**: `TC-VOL5-021` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Component: `components/admin/user-access-manager.tsx`
  * Action: `app/actions/auth.ts` &rarr; `approveUserAccount`, `rejectUserAccount`
* **Preconditions & RBAC Matrix**:
  * Newly registered teacher account awaiting verification.
* **Sequential Step-by-Step Path**:
  1. In User Access Manager, locate pending user.
  2. Click `"Approve"` &rarr; Status flips to `approved`.
  3. Locate spam registration. Click `"Reject"` &rarr; Status flips to `rejected`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * `public.profiles.approval_status` updated to `'approved'` or `'rejected'`.

---

### TC-VOL5-022: Granular Role & Permission Mutation
* **Test ID & Classification Tag**: `TC-VOL5-022` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/auth.ts` &rarr; `updateUserPermissions(userId, permissions)`
* **Preconditions & RBAC Matrix**:
  * Role: `super_admin`.
* **Sequential Step-by-Step Path**:
  1. Select teacher profile.
  2. Grant `"Can Manage Maintenance"` and `"Can View All Logs"`.
  3. Click `"Save Permissions"`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * `public.profiles.permissions` JSONB column updated: `{"can_manage_maintenance": true, "can_view_all_logs": true}`.

---

### TC-VOL5-023: Immutable Audit Ledger Before/After JSONB Diff Viewer
* **Test ID & Classification Tag**: `TC-VOL5-023` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Component: `components/admin/institutional-audit-manager.tsx`
  * Action: `app/actions/audit.ts` &rarr; `getAuditLogs`
* **Preconditions & RBAC Matrix**:
  * Administrator auditing yesterday's roll-call overrides and student seat swaps.
* **Sequential Step-by-Step Path**:
  1. Open Audit Ledger tab.
  2. Click audit row `ACTION: seat_swap`.
  3. Drawer opens displaying visual side-by-side JSON diff:
     * Red: `before_state.enrollment_id: "student-a"`
     * Green: `after_state.enrollment_id: "student-b"`
* **Layer 1: UI & Geometry Proof**:
  * JSON diff styled with monospace font and green/red line highlighting.

---

### TC-VOL5-024: Administrative CAD Floor Architect & Node Drag-Placement
* **Test ID & Classification Tag**: `TC-VOL5-024` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Component: `components/admin/admin-floor-architect.tsx`
  * Action: `app/actions/workstations.ts` &rarr; `updateWorkstationPositions`
* **Preconditions & RBAC Matrix**:
  * Role: `super_admin` designing a custom U-shaped computer lab layout.
* **Sequential Step-by-Step Path**:
  1. Open Floor Architect tab.
  2. Drag workstation `PC-01` from `(120, 150)` to `(200, 250)`.
  3. Click `"Save Floor Geometry"`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * `public.workstations` coordinates updated: `pos_x = 200, pos_y = 250`.

---

### TC-VOL5-025: Institutional Email Engine Health & SMTP Logs
* **Test ID & Classification Tag**: `TC-VOL5-025` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Component: `components/admin/email-notification-manager.tsx`
  * Action: `app/actions/notifications.ts` &rarr; `getEmailEngineStatus`, `getEmailDispatchLogs`
* **Preconditions & RBAC Matrix**:
  * Administrator reviewing automated teacher reminder delivery health.
* **Sequential Step-by-Step Path**:
  1. Open Email Manager.
  2. Inspect SMTP telemetry: `Status: Online, Delivery Rate: 99.4%, Queue: 0 pending`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Reads live aggregated metrics from `public.email_dispatch_logs`.

---

## 5. Institutional Analytics Suite (`/analytics`)

### TC-VOL5-026: NEB 75% Board Exam Attendance Compliance Ledger
* **Test ID & Classification Tag**: `TC-VOL5-026` • `[AUTO-DB-INTEGRATION]` + `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Route: `app/(dashboard)/analytics/page.tsx` &rarr; Tab `"01 NEB 75% Board Compliance"`
  * Action: `app/actions/institutional-reports.ts` &rarr; `getStudentBoardComplianceReport`
* **Preconditions & RBAC Matrix**:
  * Role: `hod` or `super_admin`.
* **Sequential Step-by-Step Path**:
  1. Navigate to `/analytics`.
  2. Select Class: `"Class 12 Science A"`.
  3. Ledger lists all students with: Total Practicals Conducted, Total Attended, Attendance Percentage, and Board Eligibility Status (`Eligible` >= 75%, `At Risk` 70-74%, `Disqualified` < 70%).
* **Layer 1: UI & Geometry Proof**:
  * Disqualified rows highlighted in Rose (`text-rose-500 bg-rose-500/10`).
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Zero shadow database. Computed live from `public.practical_logs` (Rule 16).

---

### TC-VOL5-027: Curricular Syllabus Quota Progress Ledger
* **Test ID & Classification Tag**: `TC-VOL5-027` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/institutional-reports.ts` &rarr; `getSyllabusProgressLedger`
* **Preconditions & RBAC Matrix**:
  * HOD reviewing practical syllabus coverage across all departments.
* **Sequential Step-by-Step Path**:
  1. Switch to `"Syllabus Quota Progress"` tab.
  2. Compare planned quota vs executed practicals for Physics, Chemistry, Biology, and Computer Science.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Accurate percentage based on `class_subjects.weekly_quota * academic_weeks`.

---

### TC-VOL5-028: Faculty Practical Sign-off Audit Trail
* **Test ID & Classification Tag**: `TC-VOL5-028` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/institutional-reports.ts` &rarr; `getFacultyPracticalLedger`
* **Preconditions & RBAC Matrix**:
  * Audit verification of teacher practical logs.
* **Sequential Step-by-Step Path**:
  1. Switch to `"Faculty Sign-Off Ledger"`.
  2. Inspect verification ratios: Verified Sessions vs Unverified Sessions per teacher.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Verification status extracted from `public.practical_logs.remarks`.

---

### TC-VOL5-029: Laboratory Facility Occupancy Index Telemetry
* **Test ID & Classification Tag**: `TC-VOL5-029` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Action: `app/actions/institutional-reports.ts` &rarr; `getLabOccupancyIndex`
* **Preconditions & RBAC Matrix**:
  * Institutional planning for next semester.
* **Sequential Step-by-Step Path**:
  1. Switch to `"Lab Occupancy Index"`.
  2. Inspect weekly utilization percentage: `Computer Lab 1: 82%`, `Physics Lab: 64%`, `Chemistry Lab: 58%`.
* **Layer 1: UI & Geometry Proof**:
  * Bar charts rendered with `xychart-beta` SVG layout.

---

### TC-VOL5-030: Workstation Reliability & Hardware Biography Drawer
* **Test ID & Classification Tag**: `TC-VOL5-030` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Action: `app/actions/institutional-reports.ts` &rarr; `getWorkstationTechnicalBiography(workstationId)`
  * Component: `components/analytics/workstation-biography-drawer.tsx`
* **Preconditions & RBAC Matrix**:
  * Lab In-Charge reviewing historical failure rate of PC-04.
* **Sequential Step-by-Step Path**:
  1. Switch to `"Workstation MTTR & Reliability"` tab.
  2. Click `PC-04`.
  3. Drawer slides in displaying complete technical biography:
     * Hardware binding history.
     * All 6 past fault tickets and resolution times (MTTR).
     * Preventive maintenance service logs.
     * Past student seat assignments.
* **Layer 1: UI & Geometry Proof**:
  * Drawer width: `min(540px, 100vw)`.

---

## 6. Faculty Profile & Dual-OTP Credential Security

### TC-VOL5-031: Mobile 393px Profile Viewport Ergonomics & Tab Switcher
* **Test ID & Classification Tag**: `TC-VOL5-031` • `[MANUAL-DEVICE]` + `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Route: `app/(dashboard)/profile/page.tsx`
  * Component: `components/profile/profile-client-view.tsx`
* **Preconditions & RBAC Matrix**:
  * Viewport: 393×873 px (Vivo V23 5G).
* **Sequential Step-by-Step Path**:
  1. Open `/profile` on mobile.
  2. Inspect layout:
     * Centered circular avatar with camera trigger badge.
     * Full-width 3-tab segmented switcher: `[Identity] | [Security] | [Preferences]`.
     * Form inputs with high-contrast obsidian wells.
     * Save button resting cleanly above bottom dock.
* **Layer 1: UI & Geometry Proof**:
  * Zero horizontal overflow: `document.documentElement.scrollWidth <= 393`.
  * Input heights: `input.getBoundingClientRect().height >= 44px`.
  * Save button bottom clearance: `saveBtn.getBoundingClientRect().bottom <= window.innerHeight - 64 - 16` (`pb-28`).

---

### TC-VOL5-032: Faculty Biographical Profile Update & Validation
* **Test ID & Classification Tag**: `TC-VOL5-032` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/profile.ts` &rarr; `updateTeacherProfile(payload)`
  * Component: `components/profile/teacher-profile-form.tsx`
* **Preconditions & RBAC Matrix**:
  * Teacher updating phone number and qualification details.
* **Sequential Step-by-Step Path**:
  1. On `/profile`, update Phone Number: `"+977 9841234567"`.
  2. Update Specialization: `"Data Structures & Algorithms"`.
  3. Click `"Save Profile Changes"`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Row updated in `public.profiles`.

---

### TC-VOL5-033: Faculty Avatar Upload, Client Compression & Storage Sync
* **Test ID & Classification Tag**: `TC-VOL5-033` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/auth.ts` &rarr; `updateCurrentUserPhoto`
  * Compressor: `lib/student-photos/compressor.ts`
* **Preconditions & RBAC Matrix**:
  * User uploads 5MB PNG photo taken on camera phone.
* **Sequential Step-by-Step Path**:
  1. Tap camera icon on profile avatar.
  2. Select 5MB image.
  3. Client compresses photo to 256×256 WebP (< 50KB).
  4. Submit to server.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * `public.profiles.photo_url` updated with compressed WebP URL.

---

### TC-VOL5-034: In-App Credential Password Change Flow
* **Test ID & Classification Tag**: `TC-VOL5-034` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/profile-credentials.ts` &rarr; `changeCurrentPassword`
* **Preconditions & RBAC Matrix**:
  * Authenticated user on `"Security"` tab.
* **Sequential Step-by-Step Path**:
  1. Input Current Password.
  2. Input New Password (must satisfy all 4 complexity rules).
  3. Confirm New Password.
  4. Click `"Update Password"`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Supabase auth password updated. Session claim refreshed.

---

### TC-VOL5-035: Dual-OTP Institutional Email Address Change Protocol
* **Test ID & Classification Tag**: `TC-VOL5-035` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/profile-credentials.ts` &rarr; `initiateDualOtpEmailChange`, `confirmDualOtpEmailChange`
* **Preconditions & RBAC Matrix**:
  * Teacher changing official institutional email from `old@school.edu.np` to `new@school.edu.np`.
* **Sequential Step-by-Step Path**:
  1. Input New Email address.
  2. Click `"Initiate Email Change"`.
  3. System sends OTP-1 to Old Email and OTP-2 to New Email.
  4. User inputs both OTP-1 and OTP-2 into confirmation modal.
  5. Click `"Verify & Switch Email"`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Email changed only when both OTPs verified simultaneously, preventing account hijacking.
  * Audit ledger records: `action = 'dual_otp_email_change'`.

