# Roster & Cohort Lifecycle Promotion Wizard — Specification & Plan

> **Document**: `doc/plans/ROSTER_PROMOTION_WIZARD_SPEC.md`  
> **Target Tab**: `/admin` &rarr; Tab "Roster & Cohort Lifecycle"  
> **Scope**: All Grades & Classes in LabSync LIMS  
> **Status**: Approved Blueprint  

---

## 1. Core Objectives
1. **Interactive Class Promotion**: Enable administrators to transition student cohorts from any source class/year (e.g. 11 Science 2083) to a target class/year (e.g. 12 Science 2084).
2. **Exception Handling**:
   - **Promote** &rarr; Enrolls student into target class with new roll number.
   - **Repeat** &rarr; Retains student in the same grade for the new academic year.
   - **Transferred / Left** &rarr; Marks student enrollment as `transferred`; does not create a new enrollment.
   - **Graduated** &rarr; For terminal grades (Class 12), marks students as `graduated`.
   - **New Comers (Lateral Admissions)** &rarr; Allows adding newly enrolled students into the target roster.
3. **Roll Number Numbering Engine**:
   - 1-click **Auto-Assign Alphabetical (A-Z by student full name)** to generate sequential roll numbers `1, 2, 3...`.
   - Editable numeric input field for every student row for manual adjustments.
4. **Safety & Disaster Recovery**:
   - Guarded by the system's `"Precaution Active"` toggle.
   - Atomic database transactions.
   - Batch rollback support recorded in `audit_ledger`.

---

## 2. Component Architecture

```
components/admin/roster-lifecycle/
├── roster-lifecycle-tab.tsx          # Main container inside /admin
├── cohort-promotion-wizard.tsx       # 3-step promotion workflow container
├── promotion-student-table.tsx       # Live interactive staging grid with action dropdowns & roll inputs
├── lateral-entry-modal.tsx           # Modal for adding new students to the upcoming cohort
└── batch-rollback-drawer.tsx         # Audit & reversal drawer for undoing accidental promotions
```

---

## 3. Server Actions & Backend Invariants (`app/actions/academic-years.ts`)

1. `getStudentsByClass({ classId, academicYearId, statusFilter: 'active' })`:
   - Single canonical query from `app/actions/students.ts` joining `student_enrollments` and `students` with workstation metadata.
2. `executeCohortPromotionBatch(payload)`:
   - Validates `"Precaution Active"` authorization.
   - Runs in a PostgreSQL transaction:
     - Sets source enrollments to `'archived'`, `'transferred'`, or `'graduated'`.
     - Creates new enrollments for target year/class with specified roll numbers.
     - Logs operation in `public.audit_ledger` with batch metadata.
3. `rollbackPromotionBatch(batchId)`:
   - Reverts new target enrollments and restores source enrollments to `'active'`.

---

## 4. User Approved Architecture & Decisions
1. **Repeater Lifecycle (A1)**:
   - When a student repeats a grade, their previous year enrollment is marked `'archived'`, and a new enrollment is created for the target academic year in the **same class** with a new roll number.
2. **Roll Number Allocation (A2)**:
   - **Unified Alphabetical Sort**: Sorts ALL students (promoted, repeaters, and newcomers) together alphabetically (A to Z by student full name) and assigns sequential rolls `1, 2, 3...`.
   - Every row provides an inline editable input field for manual override when necessary.
3. **Layer 2 Dynamic Database Binding (A3)**:
   - **Single Source of Truth**: Query `public.classes` directly. Hardcoded static arrays are eliminated.
   - **State Caching**: Classes fetched once at the layout/page level and distributed down to rosters and dropdowns.
   - **Strict Empty State**: If `public.classes` is empty, render: *"System unconfigured. Please add classes in the Admin Dashboard to continue."* with an action button to navigate to Curriculum &rarr; Classes.
4. **Disaster Recovery & Safety**:
   - Guarded by `"Precaution Active"` safety toggle in Admin.
   - Every promotion batch logs an audit entry in `public.audit_logs` with a unique `batch_id`.
   - **24-Hour Rollback Drawer**: 1-click revert reverses newly created enrollments and restores previous ones to `'active'`.
   - **Terminal Classes (Class 12)**: Provides a "Mark as Graduated" action (`status = 'graduated'`, archived, no destination class needed).

