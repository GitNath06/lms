# Task 56: Phase 2 — Admin Console Unification & Canonical PostgreSQL Operations

> **Task ID**: `2026-10-18-task-56-phase2-admin-console-unification`  
> **Type**: Architecture, Frontend-Backend Unification & Relational Migration  
> **Status**: Completed  
> **Target Subsystems**: `app/(dashboard)/admin/page.tsx`, `components/admin/incident-categories-manager.tsx`, `components/dashboard/report-incident-modal.tsx`, `hooks/use-infrastructure-state.ts`, `types/workstations.ts`, `tests/phase2-admin-unification.test.mjs`  
> **Pre-requisite Audit Document**: [`doc/audits/2026-10-18-full-system-gap-analysis-and-production-roadmap.md`](../audits/2026-10-18-full-system-gap-analysis-and-production-roadmap.md)  
> **Previous Task**: [`doc/tasks/2026-10-18-task-55-phase1-canonical-actions-and-security-hardening.md`](./2026-10-18-task-55-phase1-canonical-actions-and-security-hardening.md)  

---

## 1. Objective & Problem Statement

Phase 1 established the canonical PostgreSQL Server Actions for subjects, classes, relational class-subject allocations, and security hardening. However, the Super Admin Console (`/admin`) and incident reporting interfaces still suffered from prototype shadow state:
1. **Curriculum Classes Sub-tab**: Read from `classes` in `useInfrastructureState` (which synced to `institution_settings` JSON blob `admin_classes_v2`) and wrote via prototype hooks (`addClass`, `updateClass`, `deleteClass`).
2. **Curriculum Subjects Sub-tab**: Read and mutated flat prototype subject arrays in `institution_settings` JSON blobs rather than querying `public.class_subjects` and `public.subjects`.
3. **Hardcoded Fallback Categories**: `DEFAULT_INCIDENT_CATEGORIES` mock array in `hooks/use-infrastructure-state.ts` shadowed live `public.issue_categories`, leading to schema disconnects in `ReportIncidentModal` and `/admin` Facilities categories governance.
4. **Foreign Key Integrity Risk**: Removing a class subject assignment without checking for existing `public.practical_logs(class_subject_id)` could orphan historical institutional logs.

Phase 2 unifies the entire Admin Console curriculum and incident governance workflows with canonical PostgreSQL tables, eradicating mock states, shadow JSON blobs, and prototype hooks.

---

## 2. Key Changes Implemented

### A. Admin Console Classes Sub-tab Canonical Relational Rewiring (`app/(dashboard)/admin/page.tsx`)
- Imported canonical actions: `getClassesAction`, `createClassAction`, `updateClassAction`, `deactivateClassAction`.
- Added reactive state `dbClasses: ClassRecord[]` loaded via `loadClassesData()`.
- Defined `effectiveClasses` prioritizing live PostgreSQL records:
  ```typescript
  const effectiveClasses: ClassEnrollmentItem[] = useMemo(() => {
    if (dbClasses && dbClasses.length > 0) {
      return dbClasses.map((c) => ({
        id: c.id,
        name: c.name,
        section: c.section || '',
        capacity: c.capacity,
        stream: c.stream_id || 'General Science',
        is_active: c.is_active,
      }))
    }
    return classes
  }, [dbClasses, classes])
  ```
- Rewired `handleSaveClass` to execute `createClassAction` and `updateClassAction`.
- Rewired class table rendering, active/archived status badges, and danger action deactivation via `deactivateClassAction`.
- Rewired `ClassRosterView`, `CohortPromotionWizard`, and Danger Zone Cohort Wipe dropdowns to consume `effectiveClasses`.

### B. Curriculum Catalog & Class-Subject Junction Rewiring (`app/(dashboard)/admin/page.tsx`)
- Imported canonical actions: `getSubjectsAction`, `getClassSubjectsAction`, `createSubjectAction`, `updateSubjectAction`, `assignSubjectToClassAction`, `removeClassSubjectAction`, and `getTeachers`.
- Added database states `dbSubjects`, `dbClassSubjects`, and `dbTeachers` loaded via `loadSubjectsData()`.
- Transformed relational junction rows into structured `DisplaySubjectItem[]`:
  - Enriched with class name, subject code, credit hours, default laboratory, and assigned instructor.
  - Grouped view: Groups assignments by Class Grade/Section.
  - Flat view: Direct searchable tabular layout.
- Rewired Add/Edit Subject modal to assign teachers and labs through `assignSubjectToClassAction`.
- Rewired Delete Subject action to execute `removeClassSubjectAction(s.classSubjectId)`.

### C. Incident Categories Direct PostgreSQL Migration (`components/admin/incident-categories-manager.tsx`, `components/dashboard/report-incident-modal.tsx`)
- Seeded laboratory safety and equipment categories into `public.issue_categories` (now totaling 16 active categories).
- Rewired `IncidentCategoriesManager` to read/write directly via `getIssueCategories()` and `manageIssueCategory()`.
- Removed deprecated prototype hook props (`categories`, `onAddCategory`, `onUpdateCategory`, etc.) from `/admin` page JSX.
- Rewired `ReportIncidentModal` to load categories directly from `getIssueCategories()` with `useEffect`, eliminating `incidentCategories` prop drilling.
- Deprecated and emptied `DEFAULT_INCIDENT_CATEGORIES = []` in `hooks/use-infrastructure-state.ts`.

### D. Foreign Key Referential Integrity Guard on `removeClassSubjectAction` (`app/actions/subjects.ts`)
- Added SQL pre-check on `public.practical_logs` before deleting junction rows:
  ```typescript
  const logCheck = await pool.query(
    `SELECT count(*)::int AS log_count FROM public.practical_logs WHERE class_subject_id = $1;`,
    [classSubjectId]
  )
  const logCount = logCheck.rows[0]?.log_count || 0
  if (logCount > 0) {
    return {
      success: false,
      error: `Cannot delete class-subject assignment: ${logCount} historical practical log(s) reference this assignment. Unassign the teacher instead to preserve official audit records.`,
    }
  }
  ```

### E. TypeScript Typings Harmonization (`types/workstations.ts`, `hooks/use-infrastructure-state.ts`)
- Added `is_active?: boolean` to `ClassEnrollmentItem` interface in `hooks/use-infrastructure-state.ts`.
- Made partial fields in `IssueCategoryInput` (`name?: string`, `type?: ...`, `color?: string`, etc.) in `types/workstations.ts` optional to support partial updates and ID-only deletions in `manageIssueCategory`.
- Corrected `IssueCategoryRow` imports to come directly from `@/types/database`.

---

## 3. Verification & Automated Test Suite

### 1. TypeScript Strict Typecheck
Executed `npx tsc --noEmit`:
```text
Exit code: 0
Stdout: Clean (0 errors across entire repository)
```

### 2. Automated Integration Test Suite (`tests/phase2-admin-unification.test.mjs`)
Implemented and executed comprehensive test suite covering all unified actions:
```text
TAP version 13
# Subtest: Phase 2: Admin Console Unification & Canonical PostgreSQL Operations
    # Subtest: 1. getClassesAction retrieves active classes from PostgreSQL
    ok 1 - 1. getClassesAction retrieves active classes from PostgreSQL
    # Subtest: 2. createClassAction creates a canonical class record with RBAC protection
    ok 2 - 2. createClassAction creates a canonical class record with RBAC protection
    # Subtest: 3. updateClassAction updates class capacity, section and attributes
    ok 3 - 3. updateClassAction updates class capacity, section and attributes
    # Subtest: 4. deactivateClassAction soft-archives the class record
    ok 4 - 4. deactivateClassAction soft-archives the class record
    # Subtest: 5. getSubjectsAction retrieves active subjects catalog from PostgreSQL
    ok 5 - 5. getSubjectsAction retrieves active subjects catalog from PostgreSQL
    # Subtest: 6. createSubjectAction creates a canonical subject in the catalog
    ok 6 - 6. createSubjectAction creates a canonical subject in the catalog
    # Subtest: 7. assignSubjectToClassAction creates relational junction mapping in public.class_subjects
    ok 7 - 7. assignSubjectToClassAction creates relational junction mapping in public.class_subjects
    # Subtest: 8. getClassSubjectsAction retrieves enriched relational mapping rows
    ok 8 - 8. getClassSubjectsAction retrieves enriched relational mapping rows
    # Subtest: 9. removeClassSubjectAction foreign key safety check blocks deletion when practical logs exist
    ok 9 - 9. removeClassSubjectAction foreign key safety check blocks deletion when practical logs exist
    # Subtest: 10. removeClassSubjectAction safely deletes assignment when 0 logs exist
    ok 10 - 10. removeClassSubjectAction safely deletes assignment when 0 logs exist
    # Subtest: 11. getIssueCategories returns canonical categories from public.issue_categories
    ok 11 - 11. getIssueCategories returns canonical categories from public.issue_categories
    # Subtest: 12. manageIssueCategory manages dynamic categories (create, update, soft-archive/delete)
    ok 12 - 12. manageIssueCategory manages dynamic categories (create, update, soft-archive/delete)
    1..12
ok 1 - Phase 2: Admin Console Unification & Canonical PostgreSQL Operations
1..1
# tests 13
# suites 0
# pass 13
# fail 0
```

### 3. Regression Test Verification (`tests/phase1-canonical-actions.test.mjs`)
Ran Phase 1 test suite to ensure zero regressions:
```text
ok 1 - Phase 1: Canonical Database Actions & Relational Mapping
# tests 8
# pass 8
# fail 0
```

---

## 4. Invariant Preservation Checklist

- [x] **Rule 1 (No Literal `+` in Buttons)**: Verified `<Plus className="h-4 w-4" />` used across all buttons.
- [x] **Rule 3 (Safety Lock)**: "Precaution Active" safety toggle in `admin/page.tsx` maintained intact.
- [x] **Rule 5 (Zero Department Regressions)**: Profile Role Badges and assigned lab scope used exclusively; zero `department` references reintroduced.
- [x] **Rule 8 (Strict TypeScript)**: `npx tsc --noEmit` passes with 0 errors.
- [x] **Rule 16 (Zero Shadow Databases)**: PostgreSQL `public.classes`, `public.subjects`, `public.class_subjects`, and `public.issue_categories` are the sole sources of truth.
- [x] **Rule 22 (Sequential Task Documentation)**: Task 56 documented and registered in `doc/tasks/README.md`.
