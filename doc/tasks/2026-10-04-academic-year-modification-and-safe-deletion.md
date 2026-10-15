# Task Log: Phase 2 — Academic Year Modification & Ultra-Safe Deletion

> **Date**: October 4, 2026  
> **Status**: In Progress  
> **Module**: Academic Year Management & Institutional Cycle Governance  
> **Target Scope**: `app/actions/academic-years.ts`, `components/admin/academic-years-manager.tsx`, `tests/academic-year-lifecycle.test.mjs`

---

## 1. Requirements & Operational Safety Objectives

The user requested two key capabilities:
1. **Academic Year Modification (Editing)**:
   - Allow editing an academic year's display label (`name`), `start_date`, and `end_date` without deleting or resetting any data.
   - **Immutable Primary Key Invariant**: The `id` (e.g. `'2083'`) is NEVER changed. This guarantees that all foreign keys in `practical_logs`, `student_enrollments`, `schedules`, and `workstation_seat_plans` remain completely unharmed.
2. **Ultra-Safe Deletion (Protecting Historical Data)**:
   - "What if an original year having 1000s of logs is tried to be deleted? Take care of that."
   - **Active Cycle Lock**: Block deletion if `is_current = true`.
   - **Relational Impact Pre-Flight Analysis**:
     - Query `practical_logs` (`academic_year_id`)
     - Query `student_enrollments` (`academic_year_id`)
     - Query `workstation_seat_plans` (`academic_year_id`)
     - Query `schedules` (`academic_year_id`)
   - **Hard Block Policy**: If ANY practical logs or enrollments exist, deletion is **strictly blocked** with an informative breakdown of existing records.
   - **Accidental Year Cleanup**: If and only if all dependent record counts are 0 (e.g. someone accidentally created `2085/86` with 0 records), allow clean deletion.
   - **Precaution Active Safety Guard**: Requires "Precaution Active" to be unlocked.

---

## 2. Implementation Roadmap

- [x] Implement `updateAcademicYearAction` in `app/actions/academic-years.ts`.
- [x] Implement `checkAcademicYearDependenciesAction` and `deleteAcademicYearAction` in `app/actions/academic-years.ts`.
- [x] Update `components/admin/academic-years-manager.tsx`:
  - Add Edit button + Edit Modal (name, start_date, end_date) with Nepali date inputs.
  - Add Delete button + Safe Deletion Confirmation Dialog showing pre-flight dependency counts.
  - Honor "Precaution Active" lock.
- [x] Update test suite `tests/academic-year-lifecycle.test.mjs` with tests for:
  - Safe editing of year name and dates.
  - Blocking deletion of current active year.
  - Blocking deletion of year with existing logs/enrollments (simulating the 1000-log safety rule).
  - Clean deletion of an empty/accidental academic year.
- [x] Verify with `npx tsc --noEmit` (0 errors) and run tests (11/11 passed).

---

## 3. Verification & Safety Proof

1. **Immutable Primary Key Invariant**:
   - `updateAcademicYearAction` takes `{ id, name, start_date, end_date }`. The `UPDATE` query only sets `name`, `start_date`, and `end_date`. The primary key `id` (`2083`) is never altered.
   - All foreign keys referencing `academic_year_id = '2083'` in `practical_logs`, `student_enrollments`, `workstation_seat_plans`, `class_subjects`, and `schedules` remain 100% untouched and intact.
   - Tested in Subtest 8: count before edit = count after edit.

2. **Ultra-Safe Deletion / 1000-Log Protection**:
   - `checkAcademicYearDependenciesAction` inspects all 5 relational tables (`practical_logs`, `student_enrollments`, `workstation_seat_plans`, `class_subjects`, `schedules`).
   - If `is_current = true`, deletion is forbidden (`canDelete: false`).
   - If `totalDependencies > 0` (e.g., 1000 logs or student enrollments), deletion is strictly blocked with a clear breakdown explaining NEB compliance lock.
   - Tested in Subtests 9 & 10: attempting to delete `2083` is rejected.
   - Subtest 11 proves accidental/empty years (e.g. `2099-accidental` with 0 records) can be deleted cleanly.

3. **Audit Ledger & Precaution Active**:
   - Recorded `UPDATE` and `DELETE` audit events in `public.audit_logs`.
   - UI blocks edit and delete modals unless "Precaution Active" is unlocked.
