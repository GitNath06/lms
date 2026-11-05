# Roster Lifecycle, Curriculum Relational Integrity & Archival Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` or direct task execution to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all relational traps, cascade deletion hazards, shadow JSONB datastores, and hardcoded subject/grade fallbacks across student enrollment lifecycle, cohort promotion, curriculum mapping, and practical logging.

**Architecture:** 
1. Database Integrity: Enforce `ON DELETE RESTRICT` on `log_attendance -> student_enrollments`, make `uq_enrollment_roll` permanently `DEFERRABLE INITIALLY DEFERRED` across migrations and `schema.sql`.
2. Status Lifecycle: Formalize the 5-status invariant (`active`, `completed`, `graduated`, `transferred`, `archived`) so past-year academic rosters remain intact and never pollute the Recycle Bin.
3. Top-Down Waterfall & Newcomer Upsert: Guard cohort promotion with dependency locks (Grade 12 $\rightarrow$ 11 $\rightarrow$ 10) and upsert newcomers by `admission_no` to eliminate duplicate key collisions.
4. Relational Curriculum Pipeline: Connect `use-infrastructure-state.ts` to `public.class_subjects`, purge string-based grade guessing (`-11`/`-12`), purge mock teacher IDs (`'t1'`, `'t4'`), and auto-clone active curriculum upon academic year creation.

**Tech Stack:** Next.js 16 (App Router), React 19, PostgreSQL, Supabase, TypeScript (strict mode).

**Spec References:**
- [audit_context.txt](file:///d:/Projects/LMR/audit_context.txt)
- [AGENTS.md](file:///d:/Projects/LMR/AGENTS.md)
- [ROSTER_LIFECYCLE_IMPLEMENTATION_PLAN.md](file:///d:/Projects/LMR/doc/plans/ROSTER_LIFECYCLE_IMPLEMENTATION_PLAN.md)

---

## Global Constraints

- Every task must pass `npx tsc --noEmit` with 0 errors.
- Never introduce literal `+` inside button or action text (Rule 1).
- Maintain terminology standards: "Attendance", "Timetable", "Logbook" (Rule 2).
- Zero shadow databases or JSONB replicas for entities with canonical PostgreSQL tables (Rule 16).
- Student enrollment status must strictly obey `CHECK (status IN ('active', 'transferred', 'graduated', 'archived', 'completed'))` (Rule 18).
- Node.js test execution must use: `node --experimental-strip-types --import ./tests/register-hooks.mjs --test <test_path>` (Rule 20).

---

## Review Focus

1. **Cascade Deletion Danger**: Deleting a student enrollment must never cascade-delete `public.log_attendance` historical records.
2. **Mid-Loop Roll Collisions**: In-place alphabetical resequencing and promotion of repeaters + promoted students must never crash on `uq_enrollment_roll`.
3. **Past Academic Year Visibility**: Selecting a past academic year (e.g. 2083) in the Class Roster must display all completed/graduated students in the main cohort tab, not 0 students.
4. **Recycle Bin Hygiene**: Archive Hub Recycle Bin must only contain genuine soft-deleted or withdrawn students, never students who successfully graduated or completed a grade.
5. **Curriculum Resolution**: Changing classes or academic years must pull subjects strictly from `public.class_subjects`, never guessing by substring or falling back to `csList[0]`.

---

## Detailed Task Breakdown

### Task 1: Database Engine Integrity & Schema Synchronization

**Files:**
- Modify: `scripts/migration-phase4-5-stage1-add-columns.sql:40-48`
- Modify: `schema.sql:244-252, 755-765`
- Create: `scripts/migration-phase6-engine-integrity.sql`

- [ ] **Step 1: Create SQL Migration Script `scripts/migration-phase6-engine-integrity.sql`**
  - Change `fk_log_attendance_enrollment_student` from `ON DELETE CASCADE` to `ON DELETE RESTRICT`.
  - Drop and re-add `uq_enrollment_roll` with `DEFERRABLE INITIALLY DEFERRED`.
  - Ensure `public.log_attendance` has `enrollment_id uuid` column and foreign key reference.
  - Update any historical promoted enrollments from past academic years currently marked `'archived'` to `'completed'` if they have subsequent active enrollments.
- [ ] **Step 2: Apply Migration to Live PostgreSQL Database**
  - Run via Node script with SSL pool and verify constraint definitions in `pg_constraint`.
- [ ] **Step 3: Synchronize `schema.sql`**
  - Add `enrollment_id uuid` to `CREATE TABLE public.log_attendance` (line 244).
  - Update line 760 to `ALTER TABLE student_enrollments ADD CONSTRAINT uq_enrollment_roll UNIQUE (academic_year_id, class_id, roll_number) DEFERRABLE INITIALLY DEFERRED;`.
- [ ] **Step 4: Verify via Test Suite**
  - Run: `node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/phase6-roster-lifecycle.test.mjs`

---

### Task 2: Academic Year Rollover — Top-Down Waterfall Guard & Safe Newcomers

**Files:**
- Modify: `app/actions/academic-years.ts:145-210, 580-710`
- Modify: `components/admin/cohort-promotion-wizard.tsx:280-370, 530-550`

- [ ] **Step 1: Harden `executeCohortPromotionBatchAction` in `app/actions/academic-years.ts`**
  - Immediately after `await client.query('BEGIN')`, execute:
    ```ts
    await client.query('SET CONSTRAINTS uq_enrollment_roll DEFERRED;')
    ```
  - In promotion and repeat loops: change `status = 'archived'` on the prior year's enrollment to `status = 'completed'` (finished academic year, not soft-deleted trash).
  - In lateral newcomers loop: replace blind `INSERT INTO public.students` with safe identity lookup:
    ```ts
    const existingStudentRes = await client.query(
      `SELECT id FROM public.students WHERE LOWER(admission_no) = LOWER($1) LIMIT 1;`,
      [cleanAdm]
    )
    ```
    If student exists, reuse their `id`; otherwise insert.
- [ ] **Step 2: Add Auto-Curriculum Cloning to `createAcademicYear` in `app/actions/academic-years.ts`**
  - When creating a new academic cycle, query the most recent academic year in `public.class_subjects` and copy active `class_subjects` mappings into the new year with `ON CONFLICT DO NOTHING`.
- [ ] **Step 3: Implement Waterfall Order Guard in `components/admin/cohort-promotion-wizard.tsx`**
  - In `handleProceedToStaging`: when promoting `sourceClassId` to `targetClassId` where `targetClassId` is a higher grade (e.g. 11 Eng $\rightarrow$ 12 Eng), check if `targetClassId` still has active students in `sourceYearId`.
  - If active students exist, set `executionError` with guided prompt and provide 1-click button to switch to the target class first.
- [ ] **Step 4: Fix Terminal Graduation Repeater Roll Assignment**
  - In `cohort-promotion-wizard.tsx`: when a student in a terminal class (Class 12) is marked as `action: 'repeat'`, auto-assign them a valid positive roll number (e.g. `1..N`) instead of leaving them at `0`.
  - Hide the invalid "Promote to 12 Eng" option from the per-row dropdown when `isTerminalGraduation` is active.
- [ ] **Step 5: Verify via Test Suite**
  - Run: `node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/academic-year-lifecycle.test.mjs`

---

### Task 3: Deletion, Past-Year Roster Visibility & Recycle Bin Clean Slate

**Files:**
- Modify: `app/actions/students.ts:95-120, 830-890`
- Modify: `app/actions/archive-hub.ts:40-60, 125-145`
- Modify: `app/actions/logs.ts:470-520`
- Modify: `components/roster/class-roster-view.tsx:210-245, 640-680, 1010-1035, 1120-1135`

- [ ] **Step 1: Fix `getStudentsByClass` Query Filters in `app/actions/students.ts`**
  - Update `statusClause`:
    - `filter === 'active'`: `AND se.status IN ('active', 'completed', 'graduated')`
    - `filter === 'archived'`: `AND se.status IN ('archived', 'transferred')`
    - `filter === 'all'`: `AND se.status IN ('active', 'completed', 'graduated', 'archived', 'transferred')`
- [ ] **Step 2: Add Ghost Practical Logs Cleanup to `wipeClassCohortDataAction` in `app/actions/students.ts`**
  - Prior to deleting enrollments, delete `public.practical_logs` matching `academic_year_id` and `class_subject_id` or `batch_group`.
- [ ] **Step 3: Rewrite `deletePracticalLog` in `app/actions/logs.ts` with Direct PG Pool**
  - Connect via `getPgPool().connect()`, use `BEGIN ... COMMIT`.
  - Check ownership: Allow the instructor who logged the session to delete it if unverified. Allow Super Admin / Lab In-Charge to delete any session.
  - Enforce verification lock: Block regular instructors from deleting logs with verified/stamped remarks.
  - Execute:
    1. Unlink `session_seat_overrides` (`SET practical_log_id = NULL`).
    2. Delete from `public.log_attendance` (`WHERE log_id = $1`).
    3. Delete from `public.practical_logs` (`WHERE id = $1`).
- [ ] **Step 4: Update Class Roster View UI in `components/roster/class-roster-view.tsx`**
  - Define `isMainCohortStatus = (status?: string) => status === 'active' || status === 'completed' || status === 'graduated'`.
  - Use `isMainCohortStatus` for `active` tab filtering and badge rendering.
  - Render `Restore` button for any student where `!isMainCohortStatus(s.enrollment_status)` (supporting both `archived` and `transferred`).
- [ ] **Step 5: Decontaminate Recycle Bin in `app/actions/archive-hub.ts`**
  - Ensure `whereClause` for students checks `(s.is_active = false OR se.status = 'archived' OR se.status = 'transferred') AND se.status NOT IN ('completed', 'graduated')`.
- [ ] **Step 6: Verify via Test Suite**
  - Run: `node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/phase6-roster-lifecycle.test.mjs`

---

### Task 4: Dynamic Relational Curriculum & Hardcoded Purge

**Files:**
- Modify: `app/actions/subjects.ts:240-275`
- Modify: `lib/context/server-user-scope.ts:20-55`
- Modify: `hooks/use-infrastructure-state.ts:65-80, 400-435, 560-580, 830-865`
- Modify: `app/actions/logs.ts:400-430`
- Modify: `app/(dashboard)/schedules/advanced-calendar.tsx:195-215`
- Modify: `app/(dashboard)/records/new/log-form.tsx:195-205`
- Modify: `components/schedules/session-action-modal.tsx:350-355`
- Modify: `app/(dashboard)/admin/page.tsx:420-430, 1225-1230`

- [ ] **Step 1: Default `getClassSubjectsAction` to Active Academic Year in `app/actions/subjects.ts`**
  - If `academicYearId` is not provided, query `SELECT id FROM public.academic_years WHERE is_current = true LIMIT 1;` and filter by that year.
- [ ] **Step 2: Filter Teacher Scope by Active Year in `lib/context/server-user-scope.ts`**
  - Query current active academic year ID and add `.eq('academic_year_id', currentYearId)` to `class_subjects` query.
- [ ] **Step 3: Connect `use-infrastructure-state.ts` to Canonical `class_subjects`**
  - Import `getClassSubjectsAction` and fetch `Promise.all([getClassSubjectsAction(), getSubjectsAction({ activeOnly: true }), ...])`.
  - Map each subject from `class_subjects` with its exact `classId`, `grade` (class name), `classSubjectId`, `teacherId`, and `teacherName`.
  - Purge string guessing (`code.includes('-11')`) and purge `teacherId: 't4'`.
  - Eliminate shadow writes to `institution_settings` with key `'infrastructure_subjects'`.
- [ ] **Step 4: Purge Silent Fallback `csList[0]` in `createPracticalLog` in `app/actions/logs.ts`**
  - Filter `csList` by `effectiveYearId`.
  - Remove `fallback = fallbackByClass || csList[0]`. If no match, leave `resolvedClassSubjectId = null` rather than corrupting the log with an unrelated subject from another class.
- [ ] **Step 5: Purge Lingering Mock Teacher IDs (`'t1'`, `'t4'`) & Dummy Subjects**
  - In `advanced-calendar.tsx` `handleQuickAdd`: pick free lab from `labs` and subject from `subjects` dynamically.
  - In `log-form.tsx`: replace `'t1'` fallback with `effectiveTeachers[0]?.id || ''`.
  - In `session-action-modal.tsx`: replace `'t4'` fallback with `infraFaculty[0]?.id || ''`.
  - In `admin/page.tsx`: replace `'t1'` fallback with `dbTeachers[0]?.id || ''`.
- [ ] **Step 6: Verify via TypeScript & Invariants Test Suite**
  - Run: `npx tsc --noEmit` (target: 0 errors).
  - Run: `node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/unit-domain-invariants.test.mjs`
  - Run: `node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/phase6-conflicts-and-audit.test.mjs`

---

## Plan Verification Command

```powershell
npx tsc --noEmit; node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/unit-domain-invariants.test.mjs; node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/phase6-conflicts-and-audit.test.mjs; node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/phase6-roster-lifecycle.test.mjs
```

