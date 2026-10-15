# LabSync LIMS — Unified Roster Lifecycle & Archival Architecture
## Master Engineering Specification & Implementation Plan (Version 2.1 — Final Production Blueprint)
*Synthesized from Enterprise SIS / ERP Architectural Principles (Gemini, Claude & Antigravity)*

> **Document Version**: 2.1 (Production Blueprint — Final Polish)  
> **Target Environment**: LabSync LIMS (LMR) — Academic Laboratory Management System  
> **Institutional Scope**: Secondary & Higher Secondary Education (Class 11 & Class 12, NEB Curriculum, Nepal)  
> **The Golden Rule**: *LabSync is a Laboratory Execution System, not the Master School ERP. Never overwrite or delete a real identity; only transition status and state on top of permanent UUIDs.*

---

## 1. The Unified Architectural Doctrine

### 1.1 The Golden Boundary: LIMS vs. Master School ERP
```
┌──────────────────────────────────────────────────────────────┐
│                    CENTRAL SCHOOL ERP                        │
│   (Fee Billing, Master Admissions, Official Transcripts)     │
│   • Single Source of Truth for Admissions & Promotion        │
└──────────────────────────────┬───────────────────────────────┘
                               │ Confirmed Class Export (.xlsx)
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                    LABSYNC LIMS                              │
│    (Workstation CAD Floor, Practical Logbook, Roll-Call,     │
│     NEB 75% Lab Exam Compliance, Chemical Safety Register)   │
│    • Execution & Auditing Engine for Practical Sessions      │
└──────────────────────────────────────────────────────────────┘
```
* **The Master School ERP is the authoritative single source of truth** for who passed, who failed, who paid fees, and who was admitted.
* LabSync LIMS **does not reinvent** central school admissions, billing, or complex promotional rules.
* When school administration finalizes a class roster, the Lab In-Charge simply exports the confirmed spreadsheet from the ERP and ingests it into LabSync via **Smart Sync**.

---

### 1.2 The One Governing Principle: Decoupled Identity vs. Annual Enrollment
Enterprise Student Information Systems (SIS) strictly decouple the permanent human being from their temporal academic standing:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. THE PERMANENT IDENTITY (public.students)                                            │
│    • Surrogate Primary Key: id (UUID, system-generated, immutable, permanent).         │
│    • Business Identifier: admission_no (Human ID, UNIQUE constraint, editable).        │
│    • Person Attributes: full_name, gender, dob.                                        │
│    • Invariant: Created once upon school admission; NEVER reset on academic year change.│
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ 1 : N (One student, many annual years)
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 2. THE ANNUAL ENROLLMENT (public.student_enrollments)                                  │
│    • Foreign Key: student_id (UUID references public.students.id).                     │
│    • Academic Cycle: academic_year_id ('2083', '2084'), class_id ('11sci', '12eng').   │
│    • Positional Label: roll_number (Derived alphabetical A-Z integer, NOT an ID).      │
│    • Lifecycle State: status ('active' | 'archived' | 'transferred' | 'completed').    │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ 1 : N (One enrollment, many practical logs)
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 3. LABORATORY AUDIT TRAIL (public.log_attendance, workstation_seat_plans)              │
│    • Foreign Key: enrollment_id (UUID references public.student_enrollments.id).       │
│    • Database Defense: ON DELETE RESTRICT (Database forbids deletion if logs exist).   │
│    • Invariant: Name edits or roll shifts NEVER orphan or break past practical logs.   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 1.3 Core Architectural Invariants
1. **Surrogate UUID vs. Business Admission Number**:
   - `public.students.id` is the internal UUID. All downstream relations (`student_enrollments`, `log_attendance`, `workstation_seat_plans`) reference this UUID.
   - `admission_no` is a human business identifier (e.g. `ADM-00101` or the ERP student ID). It carries a `UNIQUE` constraint in `public.students`, is fully editable if mistyped, and never cascades.
   - **Zero Year-Coded Synthetic Formats**: The system forbids synthesizing transient strings like `ADM-2083-12ENG-01`. An admission number belongs to the human being, not to a grade or year.
2. **Roll Number as a Derived Positional Label**:
   - `roll_number` is purely an integer positional label ($1 \dots N$) derived by sorting the active class list alphabetically (A–Z).
   - It is stored **only** on `public.student_enrollments` and is never used as a foreign key anywhere in the database.
3. **Automatic Archival via Invariant**:
   - Transitioning to a new academic year (e.g. 2084) creates new enrollments for that year. The untouched 2083 enrollments automatically become historical archives. Past attendance logs remain permanently readable and printable under Year `2083`.

---

## 2. Ten Real-World Architectural Guardrails (v2.1)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 CORE ARCHITECTURAL GUARDRAILS                                   │
├────┬──────────────────────────────────┬─────────────────────────────────────────────────────────┤
│ 01 │ Tiered Smart Sync Matching       │ Bucket 1 (admission_no) vs Bucket 2 (Ambiguous Name)    │
├────┼──────────────────────────────────┼─────────────────────────────────────────────────────────┤
│ 02 │ Contextual Disambiguation Table  │ Side-by-side comparison (DOB, Gender, History) for B2   │
├────┼──────────────────────────────────┼─────────────────────────────────────────────────────────┤
│ 03 │ Pre-Flight Collision Defense     │ Friendly UI interception for duplicate admission_no     │
├────┼──────────────────────────────────┼─────────────────────────────────────────────────────────┤
│ 04 │ Workstation Seat Release Warning │ Explicit physical PC count warning when archiving missing│
├────┼──────────────────────────────────┼─────────────────────────────────────────────────────────┤
│ 05 │ Pre-Save Roll Collision Check    │ Friendly toast if manual roll edit collides with student│
├────┼──────────────────────────────────┼─────────────────────────────────────────────────────────┤
│ 06 │ Latecomer Escape Hatch           │ Single-row Edit Student modal remains unlocked mid-year │
├────┼──────────────────────────────────┼─────────────────────────────────────────────────────────┤
│ 07 │ Mid-Year Archival Roll Gap Lock  │ Never shift remaining rolls down when a student leaves  │
├────┼──────────────────────────────────┼─────────────────────────────────────────────────────────┤
│ 08 │ Active (Unseated) Restore State  │ Restored students get prominent [ Assign PC ] prompt   │
├────┼──────────────────────────────────┼─────────────────────────────────────────────────────────┤
│ 09 │ Detailed JSONB Audit Receipts    │ Forensic JSONB payload logged on Danger Zone wipe       │
├────┼──────────────────────────────────┼─────────────────────────────────────────────────────────┤
│ 10 │ Principal Audit Ledger UI        │ Consumption table in /admin Tab 04 parsing JSONB logs   │
└────┴──────────────────────────────────┴─────────────────────────────────────────────────────────┘
```

---

### Guardrail 1: Smart Sync Split Match (Duplicate Name Hazard Defense)
* In Nepali schools, duplicate names (e.g., two different students named "Bibek Thapa" in Class 12) are very common.
* **Bucket 1 (Auto-Confirmed)**: Matched by permanent `admission_no` &rarr; 100% safe to merge/update in-place automatically.
* **Bucket 2 (Manual Review)**: Matched by `full_name` only &rarr; Flagged in amber with mandatory human choices:
  1. **"Confirm Link & Update"**: Confirms this row is a spelling correction or known occupant.
  2. **"Create as New Student"**: Confirms this is a distinct student who happens to share the same name (creates a fresh `students` UUID).
* Prevents silent duplicate-name identity corruption.

---

### Guardrail 2: Disambiguating Bucket 2 (The Side-by-Side Context Table)
* To prevent admins from guessing blindly when reviewing a name match in Bucket 2, each card renders a side-by-side contextual comparison table:

```
┌──────────────────────────────────────┬─────────────────────────────────────────────────────────┐
│ INCOMING SPREADSHEET ROW             │ EXISTING DATABASE OCCUPANT                              │
├──────────────────────────────────────┼─────────────────────────────────────────────────────────┤
│ Full Name:    Bibek Thapa            │ Full Name:    Bibek Thapa                               │
│ Admission No: ADM-00109              │ Admission No: ADM-00084                                 │
│ Gender:       Male                   │ Gender:       Male                                      │
│ DOB:          2062-04-12 B.S.        │ DOB:          2061-11-28 B.S.                           │
│ Prior Grade:  —                      │ Status:       Archived (Class 11 Eng, 2082 B.S.)        │
└──────────────────────────────────────┴─────────────────────────────────────────────────────────┘
```
* With DOB, Gender, and prior academic history exposed side-by-side, the administrator can confidently click **"Yes, Link/Merge"** or **"No, Create New"**.

---

### Guardrail 3: Pre-Flight `admission_no` Collision Interception
* If an Excel file or edit form attempts to assign an admission number that already belongs to another student UUID in the database, the server intercepts it before PostgreSQL crashes:
  > ⚠️ **Conflict Detected**: Admission Number `ADM-00102` is already assigned to **"Sandesh Acharya"** (UUID: `...`). Resolve this collision in your file or assign a distinct admission number before committing.

---

### Guardrail 4: Workstation Seat Release Warning
* When archiving missing students in Bucket 4 (students in DB but missing from the uploaded file), the UI explicitly warns:
  > ⚠️ **Workstation Seat Release Warning**:  
  > Archiving these **3 missing students** will permanently preserve their practical logs, but will **immediately release 3 assigned physical workstation seats** (PC-04, PC-12, PC-19) on the CAD workstation floor.

---

### Guardrail 5: Pre-Save Roll Collision Check (Manual Roll Editing)
* When an admin manually edits a single student to assign a roll number (e.g. mid-year latecomer), the server action performs a pre-save check against `UNIQUE (academic_year_id, class_id, roll_number)`:
  * If Roll 15 is entered, but Roll 15 is already occupied by "Chirag Shrestha", the server intercepts it and returns a clean, friendly message:  
    `"Roll 15 is already occupied by Chirag Shrestha. Please choose an empty roll number."`
  * Completely eliminates raw PostgreSQL 500 constraint crashes.

---

### Guardrail 6: Roll Number Governance — The Latecomer Escape Hatch
* While bulk **"Sort Rolls (A–Z)"** strictly locks once practical logs exist, the **Single-Row "Edit Student" Modal** remains permanently unlocked.
* Admins can always manually assign an empty roll number (e.g. Roll 41) to a mid-year latecomer without renumbering or shifting the rest of the class.

---

### Guardrail 7: Mid-Year Archival Roll Gap Invariant
* When student Roll 15 leaves school mid-year and is archived, their roll number stays frozen on their archived record.
* We do **not** shift Rolls 16–40 down, preserving physical paper logbook and signed attendance register continuity.

---

### Guardrail 8: Archival Lifecycle — The "Active, Unseated" State on Restore
* Restoring an archived student sets their enrollment status back to `'active'`, but because their seat was vacated, assigns them **"Active (Unseated)"**.
* The Live Lab Cockpit displays an amber badge: `[ Unseated — Click to Assign Workstation ]`, opening the CAD floor plan seat assigner.

---

### Guardrail 9: Danger Zone — Detailed Structured JSONB Audit Receipts
* When a Super Admin executes a cascading class wipe under **Precaution Active**, the action logs an exhaustive JSONB payload directly into `public.audit_ledger`:
  ```json
  {
    "action": "WIPE_COHORT_DANGER_ZONE",
    "entity_type": "cohort",
    "entity_id": "2083-12eng",
    "actor_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "actor_name": "System Administrator",
    "metadata": {
      "class_id": "12eng",
      "class_name": "12 Eng",
      "academic_year_id": "2083",
      "practical_logs_deleted": 142,
      "attendance_records_deleted": 3124,
      "workstation_seats_freed": 24,
      "session_seat_overrides_deleted": 18,
      "enrollments_deleted": 35,
      "orphaned_students_deleted": 0,
      "confirmation_phrase_typed": "WIPE 12 ENG",
      "reason": "Administrative cohort wipe of corrupted test data prior to ERP sync"
    }
  }
  ```

---

### Guardrail 10: Principal's Audit Ledger Consumption UI
* In the Super Admin `/admin` Console (Tab 04 - System Maintenance), an interactive **Audit Trail & Ledger** data table parses the JSONB payloads into clean, human-readable columns:
  * **Timestamp** (`2026-09-26 19:30:15`)
  * **Actor** (`Admin Aarav Sharma`)
  * **Action** (`WIPE_COHORT_DANGER_ZONE`)
  * **Details** (`Wiped Class 12 Eng (2083): 105 logs, 24 seats, 22 enrollments`)
  * **Inspection Modal**: 1-click JSON inspector for forensic deep-dives by the school Principal or auditor.

---

## 3. Database Invariants & Structural Safeguards

### 3.1 Database-Enforced Defense: `ON DELETE RESTRICT`
To guarantee that software bugs, script errors, or accidental button clicks cannot delete students with active practical records:
* The foreign key from `public.log_attendance` to `public.student_enrollments` strictly enforces:
  ```sql
  ALTER TABLE public.log_attendance
    DROP CONSTRAINT IF EXISTS log_attendance_enrollment_id_fkey,
    ADD CONSTRAINT log_attendance_enrollment_id_fkey
      FOREIGN KEY (enrollment_id)
      REFERENCES public.student_enrollments(id)
      ON DELETE RESTRICT;
  ```
* **Guarantee**: If a student has even 1 attendance record in a practical session, PostgreSQL will reject any `DELETE` statement at the database engine level. Deletion is physically impossible until an authorized administrator explicitly purges the session logs in the Danger Zone.

---

## 4. Concrete Implementation Blueprint

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              FIVE CORE IMPLEMENTATION MODULES                          │
├───────────────────────────────┬────────────────────────────────────────────────────────┤
│ Module 1: Roster UI Tabs      │ • Active | Archived | All segmented filter tabs       │
│ & Archive Browser             │ • "Restore to Active" action with roll conflict check  │
│                               │ • Automatic workstation seat release on archival       │
│                               │ • "Active, Unseated" status badge & CAD seat prompt    │
├───────────────────────────────┼────────────────────────────────────────────────────────┤
│ Module 2: Danger Zone         │ • Super Admin "Wipe Class Data" under Precaution Active │
│ Class Purge Tool              │ • Cascading test data obliteration with typed confirm  │
│                               │ • Comprehensive structured JSONB audit ledger receipt  │
├───────────────────────────────┼────────────────────────────────────────────────────────┤
│ Module 3: Smart Sync          │ • Tiered Match: Bucket 1 (admission_no) vs Bucket 2    │
│ ERP Reconciliation            │ • Side-by-side comparison table (DOB, Gender, Class)   │
│                               │ • Pre-flight collision warning & Seat Release warning  │
├───────────────────────────────┼────────────────────────────────────────────────────────┤
│ Module 4: Roll Governance     │ • 1-click "Sort Rolls Alphabetically (A–Z)" utility    │
│ & Latecomer Escape Hatch      │ • Atomic renumbering 1..N when practical logs = 0      │
│                               │ • Pre-save duplicate roll collision check on edit      │
├───────────────────────────────┼────────────────────────────────────────────────────────┤
│ Module 5: Principal Audit     │ • Read-only Audit Trail & Ledger table in /admin Tab 04 │
│ Ledger Consumption UI         │ • Parsed human-readable columns & JSONB inspector modal│
└───────────────────────────────┴────────────────────────────────────────────────────────┘
```

---

### Module 1: Roster UI Segmented Tabs & Universal Archival Browser
* **Files**: `components/roster/class-roster-view.tsx`, `app/actions/students.ts`
* **Changes**:
  1. In `app/actions/students.ts`, update `getStudentsByClass`:
     ```typescript
     export async function getStudentsByClass(params: {
       classId: string
       academicYearId?: string
       statusFilter?: 'active' | 'archived' | 'all'
     })
     ```
     - `statusFilter === 'active'` (default): queries `status = 'active'`.
     - `statusFilter === 'archived'`: queries `status IN ('archived', 'transferred', 'completed')`.
     - `statusFilter === 'all'`: queries all enrollments regardless of status.
  2. In `components/roster/class-roster-view.tsx`:
     - Add a clean segmented tab control above the table:
       `[ Active (22) ]` `[ Archived (3) ]` `[ All (25) ]`.
     - In the **Archived** tab:
       - Displays student names, original roll numbers, admission numbers, and archive reason/status badge.
       - Each row provides a **"Restore to Active"** button (`<RotateCcw className="h-3 w-3" />`).
       - Allows full CSV and Excel export of historical/archived student records.
  3. **Workstation Seat Release on Archival**:
     - When an enrollment's status transitions to `'archived'`, execute:
       ```typescript
       await supabase.from('workstation_seat_plans').delete().eq('enrollment_id', enrollmentId)
       ```
     - This immediately frees their physical desk (e.g. PC-15) on the CAD workstation floor for new incoming students.
  4. **The "Active, Unseated" State on Restore**:
     - When restored, the student has no row in `workstation_seat_plans`.
     - Render an amber status pill: `Active (Unseated)`.
     - Provide an action button: `[ Assign PC ]` opening the CAD floor plan seat assigner.

---

### Module 2: Super Admin "Wipe Class Data" Danger Zone
* **Files**: `app/actions/admin-maintenance.ts`, `components/admin/admin-console.tsx`
* **Changes**:
  1. Create Server Action `wipeClassCohortDataAction`:
     ```typescript
     export async function wipeClassCohortDataAction(params: {
       classId: string
       academicYearId: string
       confirmationPhrase: string
     }): Promise<{ success: boolean; deletedCounts?: Record<string, number>; error?: string }>
     ```
     - Strictly guards execution to `super_admin` role.
     - Validates that `confirmationPhrase` exactly equals `WIPE <CLASS_NAME>`.
     - Executes a single, atomic PostgreSQL transaction:
       1. Deletes `log_attendance` records attached to logs of that class/year.
       2. Deletes `practical_logs` for that class/year.
       3. Deletes `session_seat_overrides` and `workstation_seat_plans` for that class/year.
       4. Deletes `student_enrollments` for that class/year.
       5. Deletes orphaned `students` records that have zero enrollments remaining in any year.
       6. Writes an exhaustive JSONB receipt to `public.audit_ledger` (Guardrail 9).
  2. Embed in the Super Admin Console under Tab 04 (Database & System Maintenance), guarded by the **Precaution Active** safety switch.

---

### Module 3: Smart Sync ERP Reconciliation Ingestion Engine
* **Files**: `lib/roster-ingestion/validator.ts`, `components/roster/roster-import-modal.tsx`
* **Changes**:
  1. **Tiered Match Ladder**:
     - Match primarily by `admission_no` &rarr; **Bucket 1 (Auto-Confirmed)**.
     - Match by `full_name` only &rarr; **Bucket 2 (Manual Review)** with side-by-side contextual table rendering DOB, Gender, and prior class (Guardrail 2).
  2. **Pre-Flight `admission_no` Collision Interception**:
     - Pre-checks whether incoming admission numbers are already occupied by another student UUID in PostgreSQL, displaying an inline warning banner instead of crashing on commit (Guardrail 3).
  3. **Workstation Seat Release Warning**:
     - In **Bucket 4 (Unmatched in File)**, clearly warn the user:
       *"Archiving these N students will immediately release N assigned physical workstation seats."* (Guardrail 4).

---

### Module 4: Alphabetical A-Z Roll Re-Sequencing Engine
* **Files**: `app/actions/students.ts`, `components/roster/class-roster-view.tsx`
* **Changes**:
  1. Create Server Action `resequenceClassRollsAlphabeticallyAction`:
     ```typescript
     export async function resequenceClassRollsAlphabeticallyAction(params: {
       classId: string
       academicYearId: string
     }): Promise<{ success: boolean; count?: number; error?: string }>
     ```
     - Verifies that `COUNT(log_attendance) === 0` for this class in this academic year.
     - If practical logs exist: rejects renumbering with error:  
       `"Cannot renumber rolls: Active practical logs have already been recorded and signed for this cohort."`
     - If 0 logs: queries all active enrollments, sorts by `full_name ASC`, and updates `roll_number = 1, 2, 3... N` in an atomic transaction.
  2. In `components/roster/class-roster-view.tsx`:
     - Add a **"Sort Rolls (A–Z)"** button in the header toolbar.
     - Enabled when 0 practical logs exist; cleanly disabled with a descriptive tooltip once sessions begin.
  3. **Latecomer Escape Hatch & Pre-Save Roll Collision Check**:
     - In `updateStudentDetailsAction`, check if the requested roll number is already occupied by another student in that cohort.
     - If occupied: surfaces friendly UI toast: `"Roll 15 is already occupied by [Name]. Please choose an empty roll number."` (Guardrail 5 & 6).

---

### Module 5: Principal's Audit Ledger Consumption UI
* **Files**: `app/actions/audit.ts`, `components/admin/admin-console.tsx`
* **Changes**:
  1. Create Server Action `getAuditLedgerAction`:
     ```typescript
     export async function getAuditLedgerAction(params?: {
       limit?: number
       entityType?: string
     }): Promise<{ success: boolean; data?: AuditLedgerRow[]; error?: string }>
     ```
  2. In `components/admin/admin-console.tsx` (Tab 04 - System Maintenance):
     - Embed the read-only **Audit Trail & Ledger** data table.
     - Columns: `Timestamp`, `Actor`, `Action`, `Target Entity`, `Summary Details`.
     - Clicking any row opens a clean JSON Inspector modal revealing the full `metadata` diff (Guardrail 10).

---

## 5. Standard Operating Procedures (SOPs)

### SOP A: Academic Year Rollover (Transitioning 2083 &rarr; 2084)
1. **End of Year**: Super Admin creates the new Academic Year `2084 B.S.` in Settings and sets it as active.
2. **ERP Finalization**: School administration finalizes passing lists, repeaters, and new admissions in the central School ERP.
3. **ERP Export**: Admin exports the confirmed Class 10/11/12 roster from the School ERP (already sorted alphabetically with permanent admission numbers).
4. **LabSync Ingestion**:
   - In LabSync, select Academic Year `2084 B.S.`.
   - Open Class Roster &rarr; Click **"Import Excel"**.
   - Upload the ERP export.
   - LabSync automatically:
     - Recognizes returning students by `admission_no` and creates their 2084 enrollments.
     - Creates new identities for fresh admissions.
     - Assigns the ERP's alphabetical roll numbers.
   - 2083 enrollments and logs remain 100% intact as historical archives.

### SOP B: Mid-Term Student Departure & Seat Release
1. A student leaves or transfers mid-semester.
2. In Class Roster View, locate the student &rarr; click **Delete / Remove**.
3. LabSync automatically:
   - Sets enrollment status to `'archived'` (preserving past practical attendance for board inspection).
   - Deletes their `workstation_seat_plans` entry, immediately freeing their lab PC.
   - Preserves their roll number on the archived record (does NOT shift remaining students down).
   - The student moves to the **"Archived"** tab and disappears from the active roll-call cockpit.

### SOP C: Purging a Mistaken Test Cohort
1. You tested the system with dummy students and fake logs in `12 Eng`.
2. Navigate to `/admin` &rarr; Tab 04 (System Maintenance).
3. Toggle **Precaution Active** to unlock the Danger Zone.
4. Select Class `12 Eng` & Year `2083` &rarr; Click **"Wipe Class Data"**.
5. Type `WIPE 12 ENG` to confirm.
6. The test logs, seat plans, and dummy enrollments are cleanly obliterated.
7. An exhaustive JSONB receipt is written to `public.audit_ledger`.
8. Clean Slate mode is now 100% unlocked to ingest the true class roster.

---

## 6. Verification & Quality Assurance Gate

Prior to deployment, the system must satisfy the following checklist:
* [ ] **TypeScript Check**: `npx tsc --noEmit` passes with **0 errors**.
* [ ] **Test Suite Parity**: `npm test` passes all 21 test suites and 163+ unit/relational tests.
* [ ] **Relational Constraint Test**: Verifies that deleting an enrollment with active logs is strictly rejected by the database via `ON DELETE RESTRICT`.
* [ ] **Zero Data Loss Verification**: Verifies that editing names via Smart Sync preserves all existing `log_attendance` records.
* [ ] **Roll Collision Test**: Verifies that editing a student to an occupied roll number triggers a clean validation message instead of a database crash.
* [ ] **Disambiguation Context Test**: Verifies that Bucket 2 cards render DOB, gender, and past class status side-by-side.
* [ ] **Audit Trail Ledger Test**: Verifies that the Principal's Audit Ledger in `/admin` correctly renders and parses `WIPE_COHORT_DANGER_ZONE` receipts.

---
*End of Master Engineering Specification v2.1. Approved for immediate execution.*
