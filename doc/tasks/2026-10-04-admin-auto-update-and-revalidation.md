> **Date**: October 4, 2026  
> **Status**: Completed & Verified (`npx tsc --noEmit` & 26/26 tests passed)  
> **Module**: Admin Operations, Roster Lifecycle, & Real-Time Sync  
> **Target Scope**: `app/actions/students.ts`, `app/actions/roster-ingestion.ts`, `components/roster/class-roster-view.tsx`, `app/(dashboard)/admin/page.tsx`

---

## 1. Problem Statement
The user reported that when updating student records, classes, or enrollments in `/admin`, the admin panel and other views do not update automatically. 
Detailed inspection revealed:
1. **Missing Revalidations**: Multiple server actions in `app/actions/students.ts` (`createStudentWithEnrollment`, `deleteStudentEnrollmentAction`, `bulkArchiveStudentsAction`, `bulkDeleteStudentsAction`, `restoreStudentEnrollmentAction`, `resequenceClassRollsAlphabeticallyAction`, `updateStudentDetailsAction`, `transferStudentEnrollment`) and `app/actions/roster-ingestion.ts` (`commitRosterIngestionAction`) only called `revalidatePath('/maintenance')` and completely missed `revalidatePath('/admin')` and `revalidatePath('/', 'layout')`.
2. **Stale Component State in Parent `/admin` Page**: In `app/(dashboard)/admin/page.tsx`, `loadYearsAndStats()` was only executed when `selectedYearForClasses` changed. When users switch sub-tabs (e.g. from Roster back to Classes) or modify student rosters, the "Enrolled Classes & Headcounts" table rendered stale headcount metrics.
3. **Decoupled Roster View**: In `components/roster/class-roster-view.tsx`, metadata (`academicYears`, `classes`) was fetched once on mount. When child actions modified student enrollments, there was no callback informing the parent page to refresh its statistics.

---

## 2. Implementation Summary

### Step 1: Server Actions Revalidation Standardization
Created `revalidateStudentPaths()` in `app/actions/students.ts`:
- `revalidatePath('/admin')`
- `revalidatePath('/admin', 'layout')`
- `revalidatePath('/maintenance')`
- `revalidatePath('/maintenance/workstations')`
- `revalidatePath('/records')`
- `revalidatePath('/', 'layout')`

Applied across:
- `createStudentWithEnrollment`
- `updateEnrollment`
- `softDeleteStudent`
- `transferStudentEnrollment`
- `updateStudentDetailsAction`
- `deleteStudentEnrollmentAction`
- `bulkArchiveStudentsAction`
- `bulkDeleteStudentsAction`
- `restoreStudentEnrollmentAction`
- `resequenceClassRollsAlphabeticallyAction`
- `commitRosterIngestionAction` in `app/actions/roster-ingestion.ts`

### Step 2: Bi-Directional Auto-Sync in `ClassRosterView`
- Added `onDataUpdated?: () => void` prop to `ClassRosterViewProps`.
- Implemented `triggerDataSync()` calling `fetchRoster()`, `onDataUpdated?.()`, and dispatching `student-roster-updated` & `infrastructure-updated` events on `window`.
- Added listeners for `student-roster-updated` & `infrastructure-updated` to automatically re-fetch roster without manual page reload.
- Synchronized `classes` state when parent `initialClasses` change.

### Step 3: Admin Page Live Refresh on Tab Switch & Mutation
- Wrapped `loadYearsAndStats()` in `useCallback` in `app/(dashboard)/admin/page.tsx`.
- Automatically executes when `curriculumSubTab` switches (e.g. from Roster back to Classes).
- Listens to `student-roster-updated` and `infrastructure-updated` window events.
- Passed `onDataUpdated={loadYearsAndStats}` to `<ClassRosterView />`.
- Dispatched `student-roster-updated` upon cohort promotion execution and 24-hr disaster rollback in `components/admin/cohort-promotion-wizard.tsx`.

---

## 3. Verification & Test Results
- `npx tsc --noEmit`: **0 errors**.
- `tests/academic-year-lifecycle.test.mjs`: **8/8 passed**.
- `tests/staff-profile-photos.test.mjs`: **4/4 passed**.
- `tests/phase4-roster-ingestion.test.mjs`: **14/14 passed**.
- **Total: 26/26 tests passed (100% pass rate)**.
