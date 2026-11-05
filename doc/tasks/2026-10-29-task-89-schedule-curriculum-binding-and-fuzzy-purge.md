# Task 89: Schedule Curriculum Relational Binding, Strict Alphanumeric Cohort Matching & Heuristic Purge

**Date**: 2026-10-29  
**Category**: Relational Integrity, Routine Scheduling & Floor Plan Cockpit Sync  
**Target Files**:
- `app/actions/schedules.ts`
- `components/admin/routine-manager.tsx`
- `components/computer-lab/computer-lab-workspace.tsx`
- `doc/tasks/README.md`

---

## 1. Forensic Root Cause & Investigation Summary

The user reported that on `http://localhost:3000/computer-lab`:
- A practical session was scheduled for **Class 12 C** (`COMP-12 • Data Structures & Algorithms`), but the Live Session Cockpit targeted **12 M** instead of **12 C**.
- Consequently, `Enrolled Roster: 0 | Present: 0 | Absent: 0`, and all 40 workstation LCD nodes rendered completely blank.

### Forensic Investigation:
1. **The Database Anomaly**:
   - Examination of `public.schedules` row `sess-1793113376569-fdn7b` revealed:
     - `batch_name`: `'12 C'`
     - `subject_name`: `'COMP-12 - Data Structures & Algorithms'`
     - `class_subject_id`: `'a5622a5a-284c-45af-b17a-a5b3d9308be8'`
   - A query on `class_subjects` revealed that `a5622a5a-284c-45af-b17a-a5b3d9308be8` belongs to **`12mgt` (Class 12 M)**, NOT **`12eng` (Class 12 C)**!
   - Class 12 C's genuine `COMP-12` class subject record is `'21b3ac5d-f594-43c3-b55f-9ae241cf6a08'`.

2. **The Root Cause in Routine Creation**:
   - In `components/admin/routine-manager.tsx`:
     - The Add/Edit routine modal allowed selecting class (`formGrade`) and curriculum subjects, but **did not store or pass `classSubjectId`** in the payload passed to `useRoutineState().addSession()` or `updateSession()`.
   - In `app/actions/schedules.ts` (`createSchedule` lines 206–244):
     - Because `data.class_subject_id` was `undefined`, the server action fell back to a heuristic candidate matcher.
     - Line 224 contained this condition:
       ```ts
       const classMatch = normBatch === clsName || normBatch === clsId || normBatch.includes(clsName) || (cs.classes?.grade && normBatch.includes(String(cs.classes.grade)))
       ```
     - For `batch_name = '12 C'`, `normBatch` contained `'12'`.
     - `(cs.classes?.grade && normBatch.includes('12'))` evaluated to `true` for **every** Grade 12 class in the school (both `12mgt` and `12eng`)!
     - Because `12mgt` happened to appear before `12eng` in the Supabase query results, `12mgt` was matched, its `class_subject_id` was linked, and `displayBatchName` was overwritten to `'12 M'`.
   - In `app/(dashboard)/computer-lab/page.tsx`:
     - Line 114 prioritized `cs.classes?.name` (`'12 M'`) over `s.batch_name` (`'12 C'`).
   - In `app/actions/live-session.ts`:
     - `getLiveSessionContext` queried `student_enrollments` for `class_id = cs.class_id` (`'12mgt'`). Because `12mgt` has 0 enrolled students, the cockpit loaded 0 students and rendered empty workstation nodes.

---

## 2. Actions Implemented

### A. Database Record Correction
- Executed direct PostgreSQL update on `public.schedules`:
  ```sql
  UPDATE public.schedules 
  SET class_subject_id = '21b3ac5d-f594-43c3-b55f-9ae241cf6a08' 
  WHERE id = 'sess-1793113376569-fdn7b';
  ```
- Verified that `sess-1793113376569-fdn7b` now links directly to `12eng` / Class 12 C, resolving the 22 enrolled students and placing them onto PC-01..PC-27.

### B. Eradication of Loose Grade Substring Matching
In `app/actions/schedules.ts`:
- Completely purged the `(cs.classes?.grade && normBatch.includes(String(cs.classes.grade)))` loose heuristic matcher.
- Replaced with strict alphanumeric equality and exact class identifier matching:
  ```ts
  const classMatch =
    normBatch === clsName ||
    normBatch === clsId ||
    (cleanBatch.length > 0 && cleanBatch === cleanClsName) ||
    (cleanBatch.length > 0 && cleanBatch === cleanClsId) ||
    (cleanClsName.length > 1 && cleanBatch.startsWith(cleanClsName))
  ```
- Guaranteed that `12 C` (`12c`) will never match `12 M` (`12m`) or any other section.
- Ensured `displayBatchName` is only populated from `cls.name` if `displayBatchName` was not already provided by the user.

### C. Relational Class-Subject Binding in Routine Manager
In `components/admin/routine-manager.tsx`:
1. **Added `classSubjectId` to Curriculum Catalog Items**:
   - `curriculumSubjectsForGrade` now maps each assigned subject to include its authoritative `classSubjectId: cs.id`.
2. **Added Component State**:
   - `const [formClassSubjectId, setFormClassSubjectId] = useState<string | null>(null)`.
3. **Synchronized Form Handlers**:
   - `handleOpenAddModal`: Initialized `formClassSubjectId` to the first assigned class-subject ID.
   - `handleOpenEditModal`: Populated `formClassSubjectId` directly from `session.classSubjectId`.
   - `formGrade` `<select onChange>`: Re-evaluated and bound `formClassSubjectId` to match the newly selected class.
   - Curriculum Subject Catalog `<select onChange>`: Bound `formClassSubjectId` directly upon subject selection.
4. **Resolved & Passed Authoritative Key on Save**:
   - In `handleSaveSession`, resolved `resolvedCsId = formClassSubjectId || exactCs?.id || null` and passed `classSubjectId: resolvedCsId` in both `updateSession` and `newSession`.

### D. Cleaned Workspace Fallbacks
In `components/computer-lab/computer-lab-workspace.tsx`:
- Replaced hardcoded fallback `'11sci'` in `selectedClassId` with `authorizedClasses[0]?.id || ''`.

---

## 3. Verification & Evidence

1. **TypeScript Typecheck**:
   - Executed `npx tsc --noEmit` &rarr; **0 compile or type errors across the entire codebase**.
2. **Pure Domain Invariants**:
   - Executed `node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/unit-domain-invariants.test.mjs` &rarr; **12/12 passed (0 failed)**.
3. **Phase 6 Collision & Audit Tests**:
   - Executed `node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/phase6-conflicts-and-audit.test.mjs` &rarr; **8/8 passed (0 failed)**.
4. **Database Schedule Verification**:
   - Queried all 6 schedules in `public.schedules`: 100% have valid `class_subject_id` pointing to their respective class and subject without contamination.

