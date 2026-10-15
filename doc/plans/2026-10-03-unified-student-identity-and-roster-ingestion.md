# LabSync LIMS — Unified Student Identity & Roster Ingestion Architecture
## Master Engineering Specification & Implementation Plan

> **Date**: 2026-10-03  
> **Status**: APPROVED FOR EXECUTION  
> **Target Environment**: Next.js 16 App Router · Supabase PostgreSQL · LabSync LIMS  
> **Institutional Grounding**: Secondary & Higher Secondary Education (Class 11 & 12, Nepal)  
> **Reference Data Source**: Real-world school student register with hardware RFID Smart Cards (`Gaindakot, Nawalpur`)  

---

## 1. Executive Summary & Problem Diagnosis

### 1.1 The Fundamental Flaw of the Legacy Ingestion Modal (`img1`)
The legacy import interface in `components/roster/roster-import-modal.tsx` suffered from severe usability and architectural defects:
1. **Developer Jargon Overload**: Confronted school administrators with scary and obscure technical labels: *"Smart Sync Mid-Term"*, *"Clean Slate Fresh Cohort"*, *"Deterministic Ingestion Protocol"*, and *"Bucket 1 to Bucket 4"*.
2. **Coupling Admission ID to Mutable Roll Numbers**: Synthesized artificial admission IDs like `ADM-2083-11SCI-14`. When students changed class (11 &rarr; 12) or when rolls were re-sequenced alphabetically, their permanent institutional ID became mathematically wrong and out-of-sync.
3. **Mandatory Roll Number Barrier**: Forbade importing students unless the spreadsheet already had strict roll numbers, even though schools do not have final rolls during new admissions or before academic turnover.
4. **Rigid Column Schema**: Threw errors on real-world school spreadsheets that contain modern school ERP columns such as `RFID No.`, `Username`, `Contact`, or `Address`.

### 1.2 The Breakthrough Discovery
Analysis of authentic institutional registers in Nepal revealed that modern secondary schools and +2 colleges issue physical **RFID Smart Cards** to every student (e.g. `1641052469`). This 10-digit hardware UID is:
- **100% Unique** across the entire student body.
- **Permanent** from Class 11 admission to Class 12 graduation.
- **Completely Independent** of mutable class rolls or changing sections.
- **Hardware-Ready** for future tap-in roll-call at the Computer Lab workstation door.

---

## 2. The 3-Tier Student Identifier Architecture

Every student entity is governed by three distinct identifier layers:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                             3-TIER STUDENT IDENTIFIER ARCHITECTURE                             │
├──────────────────────┬────────────────────────┬─────────────┬─────────────┬──────────────────────┤
│ IDENTIFIER LAYER     │ DATABASE ATTRIBUTE     │ VISIBILITY  │ LIFECYCLE   │ INSTITUTIONAL ROLE   │
├──────────────────────┼────────────────────────┼─────────────┼─────────────┼──────────────────────┤
│ 1. The System ID     │ public.students.id     │ Hidden      │ Immutable   │ Internal PostgreSQL  │
│    (Primary Key)     │ (UUID v4)              │ (Zero UI)   │ (Lifetime)  │ foreign keys for     │
│                      │                        │             │             │ attendance & logs.   │
├──────────────────────┼────────────────────────┼─────────────┼─────────────┼──────────────────────┤
│ 2. Institutional ID  │ students.admission_no  │ Visible     │ Permanent   │ Physical RFID Smart  │
│    (Human / Display) │ (e.g. 1641052469 or    │ (Official)  │ (Lifetime)  │ Card, Fee Register,  │
│                      │  ADM-2083-0042)        │             │             │ Board Transcripts.   │
├──────────────────────┼────────────────────────┼─────────────┼─────────────┼──────────────────────┤
│ 3. Operational Roll  │ enrollments.roll_number│ Visible     │ Annual /    │ Daily lab attendance,│
│    (Annual Cohort)   │ (1, 2, 3 ... N)        │ (Classroom) │ Ephemeral   │ CAD workstation seat,│
│                      │                        │             │             │ A–Z alphabetical lock│
└──────────────────────┴────────────────────────┴─────────────┴─────────────┴──────────────────────┘
```

### Invariant Rules:
1. **System ID (`id` UUID)**: Generated via `gen_random_uuid()`. Never visible to users. Links `student_enrollments`, `log_attendance`, `workstation_seat_plans`, and `lab_incidents`.
2. **Institutional ID (`admission_no`)**:
   - If the spreadsheet contains `RFID No.`, `Card No`, `Admission No`, or `Student ID` &rarr; store that exact string verbatim.
   - If left blank in the spreadsheet &rarr; auto-generate a clean, sequential, year-based institutional sequence: `ADM-[YEAR]-[0001..9999]` (e.g. `ADM-2083-0001`), **completely decoupled from class or roll number**.
3. **Operational Roll (`roll_number`)**:
   - Belongs to `public.student_enrollments`, NOT `public.students`.
   - Initial import assigns temporary collision-free provisional integers ($1 \dots N$).
   - Official roll numbers are finalized via the **"Finalize & Lock Official Rolls (A–Z)"** action on the class roster.

---

## 3. Database Schema & Optional Fields Strategy

### 3.1 Strict vs. Optional Fields
To keep the system lightweight and avoid administrative friction, only **Full Name** is mandatory. All other biographical and contact attributes remain strictly optional:

```
public.students:
  ├── id (UUID, PK) ---------------------- [REQUIRED, System Generated]
  ├── full_name (TEXT) ------------------- [REQUIRED]
  ├── admission_no (TEXT) ---------------- [OPTIONAL / Auto-Sequential fallback] (Holds RFID No.)
  ├── registration_no (TEXT) ------------- [OPTIONAL] (NEB Board Registration)
  ├── gender (TEXT) ---------------------- [OPTIONAL] ('male' | 'female' | 'other' | NULL)
  ├── guardian_phone (TEXT) -------------- [OPTIONAL] (Contact phone number)
  ├── guardian_name (TEXT) --------------- [OPTIONAL]
  ├── email (TEXT) ----------------------- [OPTIONAL]
  ├── is_active (BOOLEAN) ---------------- [DEFAULT TRUE]
  └── created_at / updated_at ------------ [TIMESTAMPS]

public.student_enrollments:
  ├── id (UUID, PK) ---------------------- [REQUIRED, System Generated]
  ├── academic_year_id (TEXT, FK) -------- [REQUIRED]
  ├── class_id (TEXT, FK) ---------------- [REQUIRED]
  ├── student_id (UUID, FK) -------------- [REQUIRED]
  ├── roll_number (INT) ------------------ [REQUIRED, 1..200, Unique per Cohort]
  ├── section (TEXT) --------------------- [OPTIONAL]
  └── status (TEXT) ---------------------- ['active' | 'transferred' | 'graduated' | 'archived']
```

---

## 4. Intelligent Spreadsheet Parser Redesign

### 4.1 Native Support for Authentic School Spreadsheets
The spreadsheet parser in `lib/roster-ingestion/parser.ts` is upgraded to recognize authentic school export formats directly:

```
Sample Input: [ Roll | Name | Username | Gender | RFID No. | Contact | Address ]
```

### 4.2 Flexible Column Matching Dictionary:
- **Student Full Name (Required)**: `['name', 'studentname', 'fullname', 'nameofstudent']`
- **Institutional / RFID ID (Optional)**: `['rfidno', 'rfid', 'rfidnumber', 'cardno', 'smartcardno', 'admissionno', 'admno', 'studentid', 'idno']`
- **Roll Number Hint (Optional)**: `['roll', 'rollno', 'rollnumber', 'sn', 'snno', 'symbolno']`
- **Gender (Optional)**: `['gender', 'sex']` (Normalized to lowercase `'male'`, `'female'`, `'other'`)
- **Contact Phone (Optional)**: `['contact', 'phone', 'phoneno', 'mobile', 'guardianphone']`
- **Board Registration (Optional)**: `['registrationno', 'regno', 'boardreg', 'symbolnumber']`
- **Extraneous Columns (Gracefully Ignored)**: `['username', 'address', 'dob', 'photo', ...]` pass through with zero errors.

---

## 5. Modern 3-Step Import Experience (Replacing `img1`)

### 5.1 Elimination of Developer Jargon
- ❌ Drop "Smart Sync Mid-Term" and "Clean Slate Fresh Cohort".
- ❌ Drop "Deterministic Ingestion Protocol".
- ❌ Drop "Bucket 1", "Bucket 2", "Bucket 3", "Bucket 4".
- ❌ Drop "Replace Occupant" and "Assign Next Roll" developer switches.

### 5.2 The Streamlined 3-Step Workflow:

#### Step 1: Drag & Drop Upload
- Clean, focused dropzone supporting `.xlsx`, `.xls`, `.csv`.
- Clear guidance banner:
  > *"Upload your class list. Only **Student Name** is required. If your sheet contains **RFID No.**, **Roll**, or **Gender**, they will be automatically captured."*
- Prominent button: `<Download className="h-4 w-4" /> Download Clean Excel Template`.

#### Step 2: High-Clarity Reconciliation Summary
A 3-card executive overview replaces the confusing bucket tabs:
```
┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────┐
│ 🟢 New Admissions       │  │ 🔵 Existing Recognized  │  │ ⚪ Not in Uploaded File │
│    18 students to add   │  │    14 students matched  │  │    2 currently enrolled │
└─────────────────────────┘  └─────────────────────────┘  └─────────────────────────┘
```
- **Student Reconciliation Table**: Clean rows with visual badges:
  - `🟢 New Student`: Ready to be enrolled. Shows auto-assigned or parsed RFID/ID.
  - `🔵 Matched Profile`: Recognized by RFID or normalized name.
- **Handling Missing Students**:
  A single, plain-English setting:
  - `[✓] Keep enrolled students active (Add missing newcomers alongside them)`
  - `[ ] Mark missing students as Transferred / Left School (Reconcile master list)`

#### Step 3: Success & Roll Finalization Handoff
- Clear confirmation: *"✓ Successfully updated roster for Class 12 Science (32 students active)."*
- Action button: **"Go to Class Roster to Finalize Official Rolls (A–Z)"**.

---

## 6. Operational Workflows for All 4 School Scenarios

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        4 INSTITUTIONAL OPERATIONAL SCENARIOS                           │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│  SCENARIO A: First-Time Database Setup (Fresh School Onboarding)                       │
│  ───────────────────────────────────────────────────────────────                       │
│  1. Admin opens Class (e.g. Class 11 Science) → clicks "Import Students".              │
│  2. Uploads existing school Excel sheet (names + RFID numbers).                        │
│  3. System creates student person records with permanent RFID IDs.                     │
│  4. Admin clicks "Finalize & Lock Official Rolls (A–Z)" on the Class Roster.           │
│     → 1-Click alphabetical 1..N roll assignment completed!                             │
│                                                                                        │
│  SCENARIO B: Annual Academic Year Turnover (Class 11 → Class 12)                       │
│  ───────────────────────────────────────────────────────────────                       │
│  1. Admin executes Cohort Promotion Wizard:                                            │
│     - Promoted students advance from 11 Sci → 12 Sci.                                  │
│     - Repeaters remain in 11 Sci.                                                      │
│  2. If new lateral transfer students arrive in Class 12:                               │
│     - Admin clicks "Import Students" on Class 12 → uploads their names / RFIDs.        │
│  3. Admin opens Class 12 Roster:                                                       │
│     - Promoted students + Newcomers are displayed together.                            │
│     - Admin clicks "Finalize & Lock Official Rolls (A–Z)".                             │
│     - Rolls 1..N are re-indexed across the complete unified cohort!                    │
│                                                                                        │
│  SCENARIO C: New Academic Year Class 11 Intake                                         │
│  ─────────────────────────────────────────────                                         │
│  1. In Class 11, repeaters from last year are already sitting safely with rolls.       │
│  2. Admin uploads the new SEE admission Excel sheet to Class 11.                       │
│  3. System recognizes repeaters, adds new admissions, and merges them safely.          │
│  4. Admin clicks "Finalize & Lock Official Rolls (A–Z)".                               │
│     → Blends repeaters and new intake into one official A–Z sequence!                  │
│                                                                                        │
│  SCENARIO D: Mid-Term Departures & Arrivals (TC / Late Admission)                      │
│  ────────────────────────────────────────────────────────────────                      │
│  • Departure (Transfer Certificate / Dropped Out):                                     │
│    - DO NOT DELETE (preserves historical lab logs & attendance compliance).            │
│    - Admin sets status to "Transferred / Archived".                                    │
│    - Physical workstation CAD seat is released immediately.                            │
│  • Late Arrival:                                                                       │
│    - Admin clicks "Add Student" or imports 1-row Excel.                                │
│    - Receives next available provisional roll without disturbing other students.       │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Implementation Roadmap & Technical Deliverables

### Phase 1: Core Parsing & Identity Engine
1. Update `lib/roster-ingestion/parser.ts`:
   - Add column aliases for `RFID No.`, `Gender`, `Contact`.
   - Relax `Roll Number` requirement (treat as optional integer hint).
2. Update `lib/roster-ingestion/template.ts`:
   - Generate single unified template with columns: `[Full Name * | RFID / Admission No | Roll No | Gender | Contact]`.
3. Update `lib/roster-ingestion/validator.ts`:
   - Purge `formatAutoAdmissionNo(year, class, roll)` function.
   - Replace with sequential `ADM-[YEAR]-[SEQUENCE]` or preserve provided RFID string.

### Phase 2: Database RPC & Backend Hardening
1. Update `commit_roster_ingestion_tx` stored procedure:
   - Accept raw `admission_no` (RFID) without synthetic class/roll prefixes.
   - Support optional `gender` and `guardian_phone`.
2. Ensure collision-free provisional roll assignment for incoming batches.

### Phase 3: UI Redesign of `RosterImportModal`
1. Re-skin `components/roster/roster-import-modal.tsx`:
   - Replace old two-card strategy selector with clean drag-and-drop upload zone.
   - Build 3-card reconciliation summary (New Admissions, Matched Existing, Missing from Sheet).
   - Add clear toggle for missing students: `Keep Active` vs. `Mark as Transferred`.
   - Replace results screen with direct link to Class Roster.

### Phase 4: Verification & Automated Tests
1. Run `npx tsc --noEmit` to ensure strict 0 TypeScript errors.
2. Update and run test suites:
   - `tests/phase4-roster-ingestion.test.mjs`
   - `tests/phase6-roster-clean-slate.test.mjs`
   - `tests/phase6-roster-lifecycle.test.mjs`
