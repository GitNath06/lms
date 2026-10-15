# Cohort Promotion & Student Identity Workflow Refinement

> **Date**: October 3, 2026  
> **Status**: Completed & Verified (`npx tsc --noEmit` & 36/36 tests passed)  
> **Module**: SIS & Academic Lifecycle (`components/admin/cohort-promotion-wizard.tsx`, `app/actions/roster-ingestion.ts`, `app/actions/academic-years.ts`, `lib/types/academic-years.ts`)

---

## 1. Executive Summary of User Feedback & Issues Identified

From testing the Cohort Promotion & Ingestion features with real-world scenarios (testing cohorts with repeaters and newcomers across 2083 &rarr; 2084), four major pain points were identified:

1. **Smart Target Class Auto-Selection (`img4`)**:
   - *Issue*: Selecting Source Class `10 Eng` defaulted to Target Class `12 Eng`, skipping Grade 11 entirely.
   - *Fix*: Implemented `suggestTargetClass(sourceClassId, classes)` to automatically select the sequential grade of the same stream (`10 Eng` &rarr; `11 Eng`, `11 Eng` &rarr; `12 Eng`, `12 Eng` &rarr; Terminal Graduation).

2. **Premature & Disconnected Roll Number Allocation (`img1`, `img3`)**:
   - *Issue*: If target class `11 Eng` in 2084 already had 2 repeaters (Roll 13 and Roll 15), incoming students from `10 Eng` were forced to start at Roll 16, 17, 18... instead of being managed together with the rest of the cohort. Newcomers were not yet imported.
   - *Fix*:
     - Transformed Step 2 into a **Draft Staging Environment**.
     - Automatically merge existing repeaters into the staging roster as `isExistingTarget: true` with a clear badge.
     - Auto-sort all active students (promoted + repeaters) alphabetically (A–Z) to assign clean rolls `1, 2, 3... N` from the very start.
     - Provided a 1-click **"Sort Rolls (A–Z)"** button and ensured that any unassigned or colliding rolls are auto-sequenced A–Z before confirmation/execution.

3. **Bulk Ingestion for Lateral Newcomers in Step 2**:
   - *Issue*: Step 2 only had an "Add Lateral Student" button that added one student at a time.
   - *Fix*: Added **"Import Newcomers (Excel)"** directly to the Step 2 toolbar. Administrators can upload an Excel (.xlsx) or CSV (.csv) containing transfer students. All valid rows are staged as newcomers in 1 click.

4. **Section Column Redundancy (`img3`)**:
   - *Issue*: The staging table displayed a `SECTION` column where every student had `A`. The institution separates classes by name (`11 Eng`, `11 Sci A`, `11 Sci B`).
   - *Fix*: Removed the redundant `SECTION` column from the Step 2 table.

5. **Admission Number Decoupling & Registration Number Purpose**:
   - *RFID & Admission Preservation*: If students possess a 10-digit RFID card (e.g. `1641052469`), the system preserves all 10 digits verbatim without truncation or prefix alteration.
   - *Zero Transient Year Synthetic IDs*: When auto-generating admission numbers for students without an RFID or admission ID, the system no longer embeds the transient academic year (e.g. uses `ADM-XXXXX` instead of `ADM-2083-XXXX`), ensuring the student's ID remains permanent as they are promoted across grades.
   - *Registration Number Purpose*: Clarified why registration numbers are empty (`—`). In Nepal, official NEB Board Registration Numbers are issued by the National Examination Board in mid-Grade 11/12. New admissions and Grade 10 students do not yet have board slips.

---

## 2. Technical Changes & Architecture

### A. Smart Target Class Auto-Suggestion (`suggestTargetClass`)
```typescript
export function suggestTargetClass(
  sourceClassId: string,
  classes: ClassRecord[]
): { targetClassId: string; isTerminal: boolean }
```
- Extracts numeric grade from source class name / ID.
- If grade &ge; 12: sets `isTerminal: true`.
- If grade < 12: targets `grade + 1`, matching specialization stream keywords (`eng`, `sci`, `mgt`, `civil`).
- Automatically updates `targetClassId` and `isTerminalGraduation` on source change and initial mount.

### B. Destination Repeater Auto-Merge & Staging Roster
- In `handleProceedToStaging`:
  - Queries both source cohort (`sourceRes`) and destination target cohort (`targetRes`).
  - Pre-existing students in the target class (repeaters) are automatically staged alongside incoming students with `isExistingTarget: true`.
  - Active students are automatically sorted A–Z and allocated sequential provisional rolls 1..N.

### C. Server Actions & Ingestion Updates
1. **`parseNewcomerSpreadsheetAction(formData: FormData)`** in `app/actions/roster-ingestion.ts`:
   - Parses Excel and CSV files containing lateral transfer students.
   - Preserves full 10-digit RFID numbers and admission strings without alteration.
   - Returns parsed students for instant insertion into the staging roster.
2. **`executeCohortPromotionBatchAction`** in `app/actions/academic-years.ts`:
   - In pre-flight collision check, excludes students who are part of the current promotion batch (their rolls are being updated in this transaction).
   - For `isExistingTarget` students, updates their roll number in place rather than re-creating enrollments.
   - For auto-generated newcomer admission numbers, avoids embedding transient academic years.

---

## 3. Verification & Test Results

1. **TypeScript Static Analysis**:
   - `npx tsc --noEmit`: **0 errors**.
2. **PostgreSQL Integration Test Suites**:
   - `tests/academic-year-lifecycle.test.mjs`: **8/8 passed**.
   - `tests/phase4-roster-ingestion.test.mjs`: **14/14 passed**.
   - `tests/phase6-roster-clean-slate.test.mjs`: **8/8 passed**.
   - `tests/phase6-roster-lifecycle.test.mjs`: **6/6 passed**.
   - **Total Tests Passed: 36 / 36 (100% Pass Rate)**.
