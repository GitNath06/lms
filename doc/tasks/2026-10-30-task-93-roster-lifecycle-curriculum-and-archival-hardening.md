# Task 93: Roster Lifecycle, Curriculum Architecture & Archival Hardening

## Overview
Comprehensive verification and systematic resolution of relational traps, cascade deletion hazards, shadow JSONB datastores, and hardcoded fallbacks across student enrollment lifecycles, cohort promotions, curriculum mapping, practical logs, and timetable schedules.

---

## 1. Relational Engine Integrity & Schema Synchronization

### Database Constraints Hardened
1. **`fk_log_attendance_enrollment_student`**:
   - Converted constraint from legacy `ON DELETE CASCADE` / `ON DELETE SET NULL` to **`ON DELETE RESTRICT`**.
   - PostgreSQL error `23503` strictly rejects deletion of student enrollments if practical session attendance logs exist, protecting institutional NEB 75% compliance records from accidental destruction.
2. **`uq_enrollment_roll`**:
   - Altered `student_enrollments (academic_year_id, class_id, roll_number)` to be **`DEFERRABLE INITIALLY DEFERRED`**.
   - Allows atomic alphabetical re-sequencing and multi-student roll swaps inside a single transaction without triggering interim `23505 unique constraint violation` errors.
3. **Database Schema Sync**:
   - Synchronized `schema.sql`, `scripts/migration-phase4-5-stage1-add-columns.sql`, and live PostgreSQL via `scripts/migration-phase6-engine-integrity.sql`.
   - Added `enrollment_id uuid` and foreign key reference to `CREATE TABLE public.log_attendance`.

---

## 2. 5-Status Student Enrollment Lifecycle & Recycle Bin Clean Slate

### Multi-Year Status Segregation
- **Active Cohorts**: Students actively studying in the current academic year (`status = 'active'`).
- **Completed Academic Years**: Students successfully promoted to the next grade retain prior-year enrollment records marked as `status = 'completed'`.
- **Graduated Students**: Senior Class 12 students completing high school retain historical enrollments marked as `status = 'graduated'`.
- **Departed / Mid-Year Exits**: Mid-year dropouts marked as `status = 'transferred'` or `status = 'archived'`.

### Recycle Bin (Archive Hub) Isolation
- In `app/actions/archive-hub.ts`, the trash query strictly filters out `completed`, `graduated`, and `active` enrollments.
- Prior-year academic enrollments never pollute the Archive Hub Recycle Bin as "trash".
- In `components/roster/class-roster-view.tsx`, past-year rosters render badges for `Active`, `Completed`, `Graduated`, `Transferred`, and `Archived`, preserving historical records.

---

## 3. Academic Year Rollover & Top-Down Waterfall Guard

### Waterfall Cohort Dependency Guard
- In `components/admin/cohort-promotion-wizard.tsx`:
  - Added the Top-Down Waterfall Guard: checks if the destination class (e.g. Class 12) still has active ungraduated students in the source year before Class 11 is promoted.
  - Hides `<option value="promote">` when graduating terminal cohorts (Grade 12).
- In `app/actions/academic-years.ts`:
  - Added transaction-level `SET CONSTRAINTS uq_enrollment_roll DEFERRED;`.
  - Promoted students' prior enrollments transition cleanly from `active` to `completed`.
  - In newcomer ingestion loop, queries existing students by `LOWER(admission_no)` before generating new identity UUIDs, eliminating duplicate key collisions.
  - In `createAcademicYear`, auto-clones active curriculum mapping from the most recent cycle in `public.class_subjects` into the newly created academic year with `ON CONFLICT DO NOTHING`.

---

## 4. Practical Log Deletion & Roster Unlocking

### Direct PostgreSQL Pool Execution
- Rewrote `deletePracticalLog` in `app/actions/logs.ts` using direct connection pool (`getPgPool().connect()`).
- Protected by verified-stamp and ownership guards: verified practical logs cannot be deleted by teachers.
- Unlinks `session_seat_overrides`, deletes `log_attendance` records, and deletes `practical_logs` in an atomic transaction (`BEGIN ... COMMIT`).
- Unlocks the student roster when an unverified practical session was logged by mistake.

---

## 5. Canonical Relational Curriculum Mapping & Hardcoded Purge

### Removal of Shadow Datastores & Mock IDs
- In `hooks/use-infrastructure-state.ts`:
  - Replaced shadow writes to `institution_settings` (`key: 'infrastructure_subjects'`) with real-time subscription to canonical `public.class_subjects`.
  - Replaced string guessing (`s.code.includes('-11')`) with explicit `class_id` bindings.
  - Subscribed to PostgreSQL real-time table changes on `public.class_subjects`.
- Purged all mock teacher IDs (`'t1'`, `'t4'`) across:
  - `app/(dashboard)/admin/page.tsx`
  - `app/actions/logs.ts`
  - `app/(dashboard)/records/new/log-form.tsx`
  - `components/schedules/session-action-modal.tsx`
- In `app/actions/subjects.ts`: `getClassSubjectsAction` defaults to active academic year (`WHERE is_current = true`).

---

## 6. Schedules Collision Engine & Multi-Lab Fixes

### Ad-Hoc Date Collision Resolution
- In `lib/scheduling/conflict-engine.ts`, `lib/master-data.ts`, and `components/schedules/session-action-modal.tsx`:
  - Added date specificity guards: ad-hoc sessions on distinct calendar dates (`specific_date`) do not collide with each other or block master weekly routines.
- In `app/actions/schedules.ts`:
  - Enforced valid enum values for `session_status` (`'scheduled'`, `'in_progress'`, `'completed'`, `'cancelled'`), eliminating PostgreSQL rejection on UI status `'confirmed'`.
  - In `getSchedules`: added secondary lab filter support (`s.metadata->>'secondary_lab_id'`), ensuring multi-lab sessions appear when filtering by secondary laboratory.
- In `app/(dashboard)/schedules/advanced-calendar.tsx`:
  - Cleaned up Friday hardcoding and unified holiday and weekend recess banners.

---

## 7. Verification & Invariants

All test suites and strict TypeScript compilation checks verified:
1. `npx tsc --noEmit` &rarr; **0 errors**.
2. `node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/unit-domain-invariants.test.mjs` &rarr; **12/12 passing**.
3. `node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/phase6-conflicts-and-audit.test.mjs` &rarr; **8/8 passing**.
4. `node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/phase6-roster-lifecycle.test.mjs` &rarr; **7/7 passing**.
5. `node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/academic-year-lifecycle.test.mjs` &rarr; **13/13 passing**.



---

## 8. Resolution of 7 Deep Audit Flaws (Gemini Argon Audit)

1. **Flaw 1: Eliminated `fallbackByClass` Subject Guessing**:
   - In `app/actions/logs.ts` and `app/actions/schedules.ts`, removed `fallbackByClass` completely so unmapped practical logs are never silently attached to an unrelated subject in the class cohort.
   - Filtered candidate curriculum lookups by active `academic_year_id`.
   - When curriculum is unmapped, sets `resolvedClassSubjectId = null` while resolving `targetClassId` directly from `public.classes` for seating snapshots.
2. **Flaw 2: Academic Year Curriculum Cloning Hardened**:
   - In `app/actions/academic-years.ts` (`createAcademicYear`), captures `previousCurrentYearId` before updating `is_current = false`.
   - Clones only active classes (`c.is_active = true`) and active subjects (`s.is_active = true`) with newly generated explicit UUIDs (`gen_random_uuid()`).
3. **Flaw 3: Synchronized Student Soft Delete with Archive Hub Trash Query**:
   - In `app/actions/students.ts` (`softDeleteStudent`), wraps execution in an atomic PostgreSQL transaction that sets `students.is_active = false`, marks active enrollments as `status = 'archived'`, and clears linked `workstation_seat_plans`.
   - In `app/actions/archive-hub.ts`, updated `trash_count` and trash query where-clause to include inactive students whose latest enrollment was archived, ensuring students with prior `completed` years who drop out appear properly in the Recycle Bin.
4. **Flaw 4: Purged Orphan Practical Logs in Empty Cohorts**:
   - In `app/actions/students.ts` (`wipeClassCohortDataAction`), moved practical logs and attendance cleanup outside `if (enrollmentIds.length > 0)`.
   - Matches `LOWER(TRIM(batch_group)) IN (LOWER(TRIM($1)), LOWER(TRIM($2)))` against both class ID (`'12eng'`) and display name (`'12 Eng'`), guaranteeing ghost practical logs are wiped even when 0 student enrollments exist.
5. **Flaw 5: Purged Residual Shadow JSONB Writes & Multi-Class Subject Mapping**:
   - In `hooks/use-infrastructure-state.ts`, eliminated residual shadow writes and real-time listeners on `institution_settings` for `infrastructure_classes` and `infrastructure_subjects`.
   - In `app/(dashboard)/records/new/log-form.tsx`, matches subjects by both subject code and class identifier/grade to prevent cross-class collisions when multiple grades share the same subject code (e.g. `COMP`).
6. **Flaw 6: Purged Hardcoded Fallbacks & Cycle Strings**:
   - In `components/roster/class-roster-view.tsx`, eliminated hardcoded initial states `'12eng'` and `'2083'`, replaced fallback `<option value="2083">` with dynamic loader, and guarded initial roster fetch.
   - In `components/admin/cohort-promotion-wizard.tsx`, replaced hardcoded `'2083'`, `'2084'`, and `'12eng'` initial states with dynamic props and first loaded class/year values.
   - In `app/(dashboard)/schedules/advanced-calendar.tsx`, replaced hardcoded `DAY // 2083` with dynamic Bikram Sambat year computation `DAY // {currentBsYear}` using `getNepaliDate(baseDate).bsYear`.
7. **Flaw 7: Live Database Schema Constraints Verified**:
   - Verified live PostgreSQL constraints directly: `fk_log_attendance_enrollment_student` is `ON DELETE RESTRICT` and `uq_enrollment_roll` is `DEFERRABLE INITIALLY DEFERRED`. All 60 active and 43 archived student enrollments in 2083 intact without data corruption.
