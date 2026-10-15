# Task Log: Unified Student Identity & Roster Ingestion Redesign

- **Date**: 2026-10-03
- **Author**: Antigravity Assistant & User
- **Status**: Ready for Execution
- **Parent Plan**: [2026-10-03-unified-student-identity-and-roster-ingestion.md](file:///d:/Projects/LMR/doc/plans/2026-10-03-unified-student-identity-and-roster-ingestion.md)

---

## 1. Goal & Context
The user identified critical flaws in the existing student import system (`img1: roster-import-modal.tsx`):
1. **Flawed Synthetic IDs**: The previous implementation generated synthetic admission numbers like `ADM-2083-11SCI-14`, baking mutable roll numbers and class names into permanent student IDs.
2. **Mandatory Roll Numbers**: Spreadsheets were rejected if roll numbers were absent, even though schools do not have finalized roll numbers during initial setup or new admissions.
3. **Bulky & Confusing UI (`img1`)**: The modal exposed engineering internals ("Smart Sync", "Clean Slate", "Buckets 1 to 4", "Replace Occupant") rather than an institutional school experience.
4. **Real School Grounding**: Inspection of actual institutional spreadsheets from Nawalpur/Gaindakot revealed that schools use physical **RFID Smart Cards** (`RFID No.`, e.g. `1641052469`) as permanent student identifiers.

---

## 2. Requirements & Clarifications (Agreed with User)
1. **3-Tier Identity Architecture**:
   - **System ID (`students.id`)**: Hidden UUID primary key for PostgreSQL relational integrity.
   - **Institutional ID (`students.admission_no`)**: Permanent display identifier (RFID Smart Card number or clean sequential `ADM-2083-0001`). Completely decoupled from class and roll numbers.
   - **Operational Roll (`enrollments.roll_number`)**: Annual positional integer, finalized alphabetically (A–Z) per academic year.
2. **Optional Fields Strategy**:
   - Only **Full Name** is mandatory.
   - `Gender`, `Contact Phone`, `Registration No`, and `Roll Number` are strictly optional fields.
   - Address and usernames in school sheets are gracefully ignored.
3. **UI Modernization**:
   - Replace `img1` with a clean 3-step modal: Upload &rarr; Reconciliation Summary &rarr; Handoff to Class Roster for A–Z Finalization.
   - Replace Bucket 1–4 jargon with a 3-card summary: 🟢 New Admissions, 🔵 Existing Recognized, ⚪ Not in Uploaded File.
   - Provide a clear setting for missing students: `[✓] Keep enrolled students active` vs `[ ] Mark as Transferred`.

---

## 3. Execution Roadmap

### Step 1: Parser & Template Updates
- [ ] In `lib/roster-ingestion/parser.ts`:
  - Add column aliases: `rfid`, `rfidno`, `rfidnumber`, `cardno` &rarr; `adm`.
  - Add aliases for `gender` and `contact`.
  - Relax roll number check: treat roll numbers as optional integers ($0$ if absent).
- [ ] In `lib/roster-ingestion/template.ts`:
  - Generate a single unified template with columns: `[Full Name * | RFID / Admission No | Roll No | Gender | Contact]`.

### Step 2: Validator & Server Action Hardening
- [ ] In `lib/roster-ingestion/validator.ts`:
  - Purge `formatAutoAdmissionNo(year, class, roll)`.
  - If `admission_no` is absent, use clean sequential assignment (`ADM-[YEAR]-[SEQ]`).
  - Re-group validation previews into user-friendly categories.
- [ ] In `app/actions/roster-ingestion.ts`:
  - Support passing optional `gender` and `guardian_phone`.
  - Ensure compatibility with PostgreSQL stored functions.

### Step 3: Frontend Modal Overhaul
- [ ] In `components/roster/roster-import-modal.tsx`:
  - Drop the confusing "Smart Sync" / "Clean Slate" choice cards.
  - Create a clean drag-and-drop file upload zone.
  - Implement the 3-card high-density reconciliation diff preview.
  - Provide a 1-click jump to the Class Roster for official roll finalization.

### Step 4: Verification & Test Execution
- [ ] Run `npx tsc --noEmit` (target: 0 errors).
- [ ] Run test suite `tests/phase4-roster-ingestion.test.mjs` and `tests/phase6-roster-clean-slate.test.mjs`.
