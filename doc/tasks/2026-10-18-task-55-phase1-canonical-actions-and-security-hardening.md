# Task 55: Phase 1 — Canonical Database Actions, Relational Schema & Security Hardening

> **Task ID**: `2026-10-18-task-55-phase1-canonical-actions-and-security-hardening`  
> **Type**: Architecture, Data Normalization & Enterprise Security  
> **Status**: Completed  
> **Target Subsystems**: `app/actions/subjects.ts`, `app/actions/classes.ts`, `app/actions/logs.ts`, `app/actions/settings.ts`, `app/actions/academic-years.ts`, `app/actions/holidays.ts`, `app/actions/substitutions.ts`, `middleware.ts`, `components/layout/client-storage-evictor.tsx`, `tests/phase1-canonical-actions.test.mjs`  
> **Pre-requisite Audit Document**: [`doc/audits/2026-10-18-full-system-gap-analysis-and-production-roadmap.md`](../audits/2026-10-18-full-system-gap-analysis-and-production-roadmap.md)  

---

## 1. Objective & Problem Statement
During the development phase, the application relied on prototype fallback arrays in `lib/master-data.ts` and shadow state in `localStorage` and `institution_settings` JSON blobs. This created:
1. **Teacher Duplication & Leakage**: `getTeachers()` returned rejected accounts (`dnathshah11@gmail.com`) and administrators instead of approved active instructors.
2. **Missing Relational Junction Actions**: No canonical CRUD actions existed for `public.subjects`, `public.classes`, and the vital `public.class_subjects` relational mapping.
3. **Route & Action Vulnerabilities**: Next.js Server Actions bypassed middleware via `next-action` headers, while direct `pg.Pool` database connections bypassed Supabase RLS. Several mutating actions lacked server-side role validation (`getServerUserScope()`).
4. **Maintenance Route Exposure**: `/maintenance` was not guarded in `middleware.ts`.
5. **Ghost `localStorage` Caches**: Stale prototype keys in browser storage overrode live database records.

---

## 2. Key Changes Implemented

### A. Canonical Subject & Relational Junction Server Actions (`app/actions/subjects.ts`, `lib/types/subjects.ts`)
- Created `lib/types/subjects.ts` defining `SubjectRecord`, `CreateSubjectInput`, `UpdateSubjectInput`, `ClassSubjectRecord`, and `AssignSubjectToClassInput`.
- Implemented `app/actions/subjects.ts`:
  - `getSubjectsAction(filter?)`: Directly queries `public.subjects` with active/lab filters.
  - `createSubjectAction(data)`: RBAC-guarded (`super_admin` / privileged approved faculty), validates uppercase code uniqueness, inserts into `public.subjects`, and calls `revalidatePath`.
  - `updateSubjectAction(id, data)`: RBAC-guarded mutation with `revalidatePath`.
  - `deactivateSubjectAction(id)`: Enforces soft-deactivation (`is_active = false`) instead of hard deletion to protect foreign key integrity with historical `practical_logs`.
  - `getClassSubjectsAction(classId?, academicYearId?)`: Enriched SQL join querying `public.class_subjects` with `classes`, `subjects`, `profiles` (teachers), and `labs`.
  - `assignSubjectToClassAction(data)`: Upserts relational mappings in `public.class_subjects`.
  - `removeClassSubjectAction(classSubjectId)`: Safely removes mapping rows with RBAC guard.

### B. Class Mutations & Enrollment Safety (`app/actions/classes.ts`)
- Added `createClassAction`, `updateClassAction`, and `deactivateClassAction` with `getServerUserScope()` checks.
- Enforced soft-deactivation (`is_active = false`) on classes to preserve historical student enrollments.
- Removed hardcoded `'2083'` fallback from `getClassEnrollmentStats` in favor of dynamic `public.academic_years` resolution.

### C. Teacher Query Sanitization (`app/actions/logs.ts`)
- Updated `getTeachers()` to strictly enforce:
  ```sql
  SELECT id, full_name, email, role
  FROM public.profiles
  WHERE approval_status = 'approved'
    AND is_active = true
    AND role IN ('teacher', 'lab_incharge')
  ORDER BY full_name ASC;
  ```
- **Result**: Instantly resolved duplicate Dinanath Shah account (rejected `dnathshah11@gmail.com` excluded, approved active `suraj.dinsu@gmail.com` retained) and removed non-teaching administrators.

### D. Route Security & Maintenance Guard (`middleware.ts`)
- Added `/maintenance` route guard in `middleware.ts`:
  ```typescript
  if (pathname.startsWith('/maintenance')) {
    const canAccessMaintenance =
      role === 'super_admin' ||
      role === 'lab_incharge' ||
      role === 'hod' ||
      role === 'coordinator' ||
      (profile as any)?.permissions?.can_manage_maintenance === true

    if (!canAccessMaintenance || approvalStatus === 'pending') {
      return NextResponse.redirect(new URL('/?error=unauthorized_maintenance_access', request.url))
    }
  }
  ```

### E. Server Action RBAC Hardening
- **`app/actions/holidays.ts`**: Protected `addAcademicHoliday`, `updateAcademicHoliday`, and `deleteAcademicHoliday` with `getServerUserScope()` checks (`scope.isPrivileged && scope.approvalStatus === 'approved'`).
- **`app/actions/substitutions.ts`**: Protected `assignSubstitute` and `cancelSubstitution` with `getServerUserScope()` instructor authorization checks.
- **`app/actions/settings.ts`**: Added `getPeriodSlotsAction()` querying dynamic PostgreSQL bell timings and restricted period modifications to `super_admin`.
- **`app/actions/academic-years.ts`**: Exported `getActiveAcademicYearAction()` as canonical async function alias.

### F. Ghost `localStorage` Eviction (`components/layout/client-storage-evictor.tsx`)
- Created a lightweight client component mounted in `app/(dashboard)/layout.tsx` that purges legacy prototype keys (`lmr_admin_faculty_v2`, `lmr_admin_classes_v2`, `lmr_admin_subjects_v2`, `lab_master_routine_2083_v6`, `lmr_admin_periods_v2`, `lmr_admin_incident_categories_v2`) once on mount using sentinel key `lmr_prototype_keys_evicted_v1`.

---

## 3. Verification & Automated Test Suite

1. **TypeScript Strict Typecheck**:
   - `npx tsc --noEmit` executed: **0 errors across the entire codebase**.
2. **Automated Integration Test Suite (`tests/phase1-canonical-actions.test.mjs`)**:
   - `getSubjectsAction`: Confirmed returns active PostgreSQL subjects (29 subjects).
   - `getClassSubjectsAction`: Confirmed returns enriched relational mapping rows.
   - `getClassesAction`: Confirmed returns active class batches.
   - `getTeachers()`: Confirmed 0 dummy placeholders, 0 duplicate Dinanath Shah entries.
   - `getPeriodSlotsAction`: Confirmed dynamic slots query succeeds.
   - `getActiveAcademicYearAction`: Confirmed current academic year resolves from PostgreSQL.
   - **Result: 6/6 subtests passed (100%)**.

---

## 4. Invariant Preservation Checklist

- [x] **No Literal `+` in Buttons**: Lucide icons used throughout.
- [x] **Standardized Terminology**: "Attendance", "Timetable", "Logbook" strictly maintained.
- [x] **Zero Department Regressions**: Role badges and facility scope preserved; no legacy department strings.
- [x] **Zero Shadow Databases**: Canonical queries talk directly to live PostgreSQL tables.
- [x] **Soft-Deletions**: No raw `DELETE` queries on curriculum entities.
- [x] **Strict TypeScript Verification**: 0 compiler errors.
