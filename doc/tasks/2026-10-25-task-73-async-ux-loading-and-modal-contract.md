# Task 73: Async UX, Loading Skeleton & Modal Feedback Contract

**Date**: 2026-10-25  
**Scope**: Systematic enforcement of the 4-Rule Async UX, Loading Skeleton & Modal Feedback Contract across `app/`, `components/`, and `hooks/`  
**Status**: Completed  
**Verification**: Strict TypeScript (`npx tsc --noEmit`) 0 errors, Automated Test Suite (`tests/ux-loading-and-modal-contract.test.mjs`) 7/7 passed, Regression Suites 26/26 passed.

---

## 1. Context & Motivation

The application previously experienced subtle UX issues:
1. **Empty Data Flash**: Several views and hooks initialized `isLoading` to `false` before fetching remote data, causing a brief flicker of "No records found" or "System unconfigured" before remote data loaded. Mobile card stacks in practical records also lacked loading guards.
2. **Modal Backdrop Toast Collisions**: Floating notification toasts previously used `z-50`, the exact same z-index as modal backdrops and dialog containers (`z-50 backdrop-blur-sm`). When submitting a modal, toast notifications could become obscured or blurred underneath modal backdrops.
3. **Modal Mutation Feedback Inconsistency**: Several modal forms lacked disabled states, spinners, and standard `"Saving..."` action text on submission buttons, or did not follow the proper sequencing (close modal first, revalidate, then toast on success; keep open and display inline error banner on failure).
4. **Residual Mock Artifacts**: Legacy baseline routines and institutional relationships mock files remained in the repository, along with fallback masks such as `'General Science'` or `localStorage` access for infrastructure period timings.

---

## 2. Key Changes Implemented

### A. Rule 1: Eliminate the "Empty Data Flash"
- **Custom Hook Initializers**:
  - `hooks/use-logs-state.ts`: Initialized `isLoading: true`, `hasFetchedOnce: false`. Exported `hasFetchedOnce`.
  - `hooks/use-routine-state.ts`: Initialized `isLoading: true`, `hasFetchedOnce: false`. Wrapped fetch in `try/finally` to guarantee `hasFetchedOnce: true` and `isLoading: false`. Exported `isLoading`, `hasFetchedOnce`, and `refreshSchedules`.
  - `hooks/use-incident-state.ts`: Initialized `isLoading: true`, `hasFetchedOnce: false`. Exported `hasFetchedOnce` and `refreshIncidents`.
  - `hooks/use-infrastructure-state.ts`: Initialized `hasFetchedOnce: false`. Set `hasFetchedOnce(true)` in `Promise.allSettled`. Exported `hasFetchedOnce`.
- **View Guards**:
  - `app/(dashboard)/admin/page.tsx`: Initialized `isLoadingClasses: true` and `isLoadingSubjects: true`. Added structural spinner rows before empty state checks.
  - `components/records/practical-records-table.tsx`: Added an `isLoading` spinner guard to the mobile card stack (line 686) so it never flashes "No practical session records found" while loading.
  - `components/roster/class-roster-view.tsx`: Initialized `isClassesLoading` to `!initialClasses || initialClasses.length === 0`. Added early return loading skeleton container.
  - `components/admin/incident-categories-manager.tsx`: Initialized `isLoading: true` and added loading spinner row before empty state check.

### B. Rule 2: Enforce the Modal Mutation & Toast Z-Index Contract
- **Toast Z-Index Upgrade**:
  - Upgraded all floating toasts across the application to `z-[100]` (preventing any collision with `z-50` modal backdrop dialogs):
    - `app/(dashboard)/admin/page.tsx`
    - `app/(dashboard)/incidents/page.tsx`
    - `app/(dashboard)/page.tsx`
    - `components/admin/routine-manager.tsx`
    - `components/computer-lab/computer-lab-workspace.tsx`
    - `components/layout/notification-bell.tsx`
    - `components/maintenance/maintenance-ledger-table.tsx`
    - `components/records/incident-records-table.tsx`
    - `components/records/practical-records-table.tsx`
- **Modal Submission Contract**:
  - **Button Feedback**: Submit buttons disable during submission (`disabled={isSubmitting}`), render `<Loader2 className="animate-spin" />`, and display `"Saving..."` (or appropriate action progress like `"Removing..."`, `"Sorting..."`).
  - **Success Sequencing**: Modals close FIRST (`setIsModalOpen(false)` / `onClose()`), refresh data, and then display the success toast.
  - **Failure Handling**: On error, modal stays open, `isSubmitting` resets to `false`, and an inline red error banner displays the server error message.
  - **Covered Modals**:
    - `app/(dashboard)/admin/page.tsx`: Class and Subject modals (added `isSubmittingClass`, `classFormError`, `isSubmittingSubject`, `subFormError`).
    - `components/schedules/session-action-modal.tsx`: Routine action and booking modal.
    - `components/dashboard/report-incident-modal.tsx`: Incident reporting modal.
    - `components/maintenance/log-maintenance-modal.tsx`: Certified maintenance service logging modal.
    - `components/admin/user-access-manager.tsx`: Add/Edit user modal.
    - `components/admin/academic-years-manager.tsx`: Academic year create/edit modal.
    - `components/admin/incident-categories-manager.tsx`: Category creation/edit modal.
    - `components/roster/class-roster-view.tsx`: Add, Transfer, Edit, Remove, and Resequence modals.

### C. Rule 3: Purge Hardcoded Fallbacks & Dead Mocks
- **Deleted Dead Files**:
  - `app/(dashboard)/schedules/routine-matrix.tsx`
  - `lib/baseline-routines.ts`
  - `lib/context/institutional-relationships.ts`
- **Master Data Cleanup (`lib/master-data.ts`)**:
  - Relocated and exported canonical `matchesGrade` helper.
  - Removed `localStorage.getItem('infrastructure_periods')` fallback lookups from `computeCombinedTimeRange` and `computeMultiPeriodLabel`.
- **Purged Fallback Strings**:
  - Removed `'General Science'` and `'Science Department'` fallback strings in `app/(dashboard)/admin/page.tsx` and `app/(auth)/login/page.tsx`.

---

## 3. Verification & Evidence

1. **Automated Verification Test Suite**:
   - Created `tests/ux-loading-and-modal-contract.test.mjs` verifying:
     - Rule 3: 0 `INITIAL_MOCK_*` occurrences, 0 deleted files on disk.
     - Rule 3: `matchesGrade` properly exported and functional, zero localStorage period lookups.
     - Rule 1: `useLogsState`, `useRoutineState`, `useIncidentState`, and `useInfrastructureState` initialize `isLoading: true` and export `hasFetchedOnce`.
     - Rule 1: Table and mobile card stack empty flash guards active.
     - Rule 2: Floating notification toasts all use `z-[100]`.
     - Rule 2: Modal submit buttons implement `disabled`, `Loader2`, and `"Saving..."` states.
   - Result: **7/7 tests passed**.
2. **Regression Test Suites**:
   - `tests/phase3-mock-purge.test.mjs` (6/6 passed).
   - `tests/verify-empty-array-traps.test.mjs` (11/11 passed).
   - `tests/practical-log-form-and-subject-clean.test.mjs` (8/8 passed).
3. **Strict TypeScript Compilation**:
   - `npx tsc --noEmit` passed with **0 errors**.
