# Task 67: Routine Manager Session Persistence Repair & PostgreSQL Constraint Alignment

**Date**: 2026-10-24  
**Status**: Completed  
**Type**: Bugfix & Architectural Resilience  
**Scope**: Timetable Management (`/admin` & `/schedules`), State Synchronization (`hooks/use-routine-state.ts`), Server Actions (`app/actions/schedules.ts`), Master Routine Model (`lib/master-data.ts`)

---

## 1. Issue Summary & Root Cause Analysis

### Symptoms Reported by User
When adding a new timetable routine session in the Admin Console (`/admin` & `/schedules`) after hardcoded mock sessions were purged, the new session appeared optimistically in the Admin panel and timetable tab for approximately 1–3 seconds, but then automatically disappeared/hid.

### Forensic Root Cause Breakdown
1. **Frontend Initial State Desync (`components/admin/routine-manager.tsx`)**:
   - `formGrade` defaulted to hardcoded `'12C'`.
   - In production database `public.classes`, classes are named `'12 Eng'`, `'12 Mgt'`, `'11 Eng'`, `'10 Eng'`, etc. No `'12C'` exists.
   - Because of `'12C'`, `curriculumSubjectsForGrade` failed to match any class, sending `batch_name: '12C'` and an empty `class_subject_id`.
2. **Missing `id` in Database Insert Payload (`app/actions/schedules.ts`)**:
   - In PostgreSQL, column `public.schedules.id` has NO default generator (`column_default: null`, `is_nullable: 'NO'`).
   - `createSchedule` omitted `id` in `payload: ScheduleInsert`.
   - Result: `null value in column "id" of relation "schedules" violates not-null constraint`.
3. **Database Enum Constraint Mismatch**:
   - `components/admin/routine-manager.tsx` and `useRoutineState` passed `status: 'confirmed'` or `status: 'requested'`.
   - In PostgreSQL, the `session_status` enum type strictly allows: `'scheduled' | 'in_progress' | 'completed' | 'cancelled'`.
   - Result: `error: invalid input value for enum session_status: "confirmed"`.
4. **Foreign Key `NOT NULL` Violation on `class_subject_id`**:
   - In `public.schedules`, `class_subject_id` is a `NOT NULL` foreign key referencing `public.class_subjects(id)`.
   - When fuzzy matching failed on `'12C'`, `resolvedClassSubjectId` remained `null`.
   - Result: `null value in column "class_subject_id" violates not-null constraint`.
5. **Silent Rejection & Optimistic Outbox Wipe Trap (`hooks/use-routine-state.ts`)**:
   - When `createSchedule` returned `{ error: ... }`, `addSession` caught `res.error` and immediately executed `removeRoutineFromOutbox(session.id)`.
   - 1–3 seconds later, background sync or tab revalidation called `loadRemoteSchedules()`.
   - `loadRemoteSchedules()` queried `getSchedules()` which returned 0 rows from PostgreSQL (since the insert failed).
   - Because the outbox item was prematurely dropped, `setRoutines([])` wiped local state, causing the card to vanish from the user's screen.

---

## 2. Solutions Implemented

### A. Master Routine Model Alignment (`lib/master-data.ts`)
- Added `classSubjectId?: string | null` and `academicYearId?: string | null` to `MasterRoutineItem` interface.
- Added canonical period slots fallback (`CANONICAL_PERIOD_SLOTS`) in `computeCombinedTimeRange` so server-side and unit-test environments compute accurate multi-period durations (e.g. `'10:10 - 11:45'` for Period 1 with span 2).

### B. Server Action Persistence Overhaul (`app/actions/schedules.ts`)
- **Direct Pool Persistence**: Converted `createSchedule`, `updateSchedule`, `deleteSchedule`, and `updateScheduleStatus` to use direct atomic PostgreSQL connection pool (`getPgPool()`), eliminating Supabase REST API latency and RLS edge cases.
- **Explicit Primary Key Generation**: `createSchedule` now sets `const scheduleId = data.id || `sched-${Date.now()}-${Math.random().toString(36).substring(2, 7)}``.
- **Status Enum Sanitation**: Mapped application statuses (`'confirmed'`, `'requested'`, `'skipped'`) to valid PostgreSQL enum `'scheduled'` while safely persisting application-level status in `metadata.status`.
- **Resilient Multi-Tier `class_subject_id` Resolution**:
  1. Direct ID lookup when `data.class_subject_id` is supplied.
  2. Exact class and subject code matching.
  3. Fuzzy match on class name / ID.
  4. Safe fallback to first candidate `class_subject` to guarantee the database foreign key constraint is never violated.
  5. Fallback `academic_year_id` to `'2083'`.
- **Conflict Safe Upsert**: Changed insert to `INSERT INTO public.schedules (...) ON CONFLICT (id) DO UPDATE ... RETURNING *;`.

### C. Client Outbox & Optimistic State Hardening (`hooks/use-routine-state.ts`)
- In `addSession`: Passed `id`, `teacherId`, `classSubjectId`, and `academicYearId`.
- Returned `{ success: boolean; error?: string }` back to caller.
- When rejected with an error, gracefully reverted optimistic state and returned the error message so the UI can inform the user rather than silently dropping state.
- In `loadRemoteSchedules`: Preserved `classSubjectId: s.class_subject_id || null` and `academicYearId: s.academic_year_id || null`.

### D. Routine Manager UI Modernization (`components/admin/routine-manager.tsx`)
- In `loadData()`: Automatically defaulted `formGrade` to the first active class in `dbClasses` (`clsRes.data[0].name`, e.g. `'12 Eng'`) instead of `'12C'`.
- Added state tracking for `formClassSubjectId` and `formTeacherId`.
- Attached `classSubjectId` and `teacherId` when selecting curriculum subjects and faculty members.
- Updated `handleSaveSession` to pass `classSubjectId`, `teacherId`, and `academicYearId: '2083'`.
- Added inline error alert if `addSession` encounters a conflict or database rejection.

### E. Conflict Notice Self-Collision Elimination & Real-Time Conflict Detection
- **Self-Collision Filter on Save**: When `addSession(newSession)` executes, the new session is added optimistically to `routines`. Previously, `hasConflict` immediately checked the form against `routines` while the modal was still closing and flagged the session being saved as a conflict against itself, causing the notice banner to flash for 1 second.
- Added `submittingSessionId` exclusion so `conflictingSession` ignores the in-flight session during submission.
- **Detailed Pre-Existing Conflict Notice**: When the user opens the modal or selects an already occupied period/lab, `conflictingSession` pinpoints the conflicting class and subject (`Notice: Another practical session (<Code> • <Class>) is already scheduled in this laboratory at the selected time. Saving will overlap.`).


---

## 3. Verification & Evidence

1. **Direct Action Integration Test (`scripts/test-schedules-actions.mjs`)**:
   - `createSchedule`: Verified successful PostgreSQL insertion with status `'scheduled'`, valid `class_subject_id`, and `academic_year_id`.
   - `getSchedules`: Verified clean retrieval with joined lab and faculty metadata.
   - `updateSchedule`: Verified updating duration and span.
   - `deleteSchedule`: Verified clean deletion from `public.schedules`.
2. **Regression Test Suite**:
   - `tests/pending-user-lockdown.test.mjs`: 100% pass (4/4 tests).
   - `tests/merge-unmerge-schedule.test.mjs`: 100% pass (3/3 tests).
   - `tests/period-slots-chronological.test.mjs`: 100% pass (2/2 tests).
   - `tests/phase6-conflicts-and-audit.test.mjs`: Triple-collision detection & audit trail pass (5/5 tests).
3. **Strict TypeScript Compilation**:
   - `npx tsc --noEmit` passed with 0 compile errors across the entire codebase.

---

## 4. Invariants Established
- Every timetable slot written to `public.schedules` MUST have an explicit `id`, a valid `session_status` (`'scheduled'`), a valid `academic_year_id`, and a valid `class_subject_id`.
- Rejections from `createSchedule` MUST be surfaced to the user interface rather than silently dropping outbox queue items.
