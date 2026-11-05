# Task 71: Practical Log Class Dropdown Formatting & Database Data Synchronization

**Date**: 2026-10-25  
**Scope**: Canonical Dropdown Option Formatting, Elimination of Deceptive Capacity & Redundant Stream Labels, Server-Side Class Preloading  
**Status**: Completed  
**Verification**: Strict TypeScript (`npx tsc --noEmit`) 0 errors, Automated Test Suite (`tests/practical-log-form-and-subject-clean.test.mjs`, `tests/class-stream-management.test.mjs`, `tests/phase2-admin-unification.test.mjs`) 17/17 passed.

---

## 1. Context & User Problem

In `/records/new` (New Practical Session Log), the user reported that the dropdown labeled **"Class / Batch Section \*"** did not match the database and configured data:
1. **Misleading Capacity**: Options displayed deceptive room capacities such as `(38 Students)`, which contradicted configured active student enrollments (e.g., Class 12 Eng has 36 enrolled students, while 12 Mgt has 0, but both showed room capacity quotas).
2. **Redundant Academic Stream Names**: The option labels appended the stream name (e.g. `— Computer Engineering`), cluttering the class/section selector.
3. **Redundant "Section" Literals**: Where section names were prefixed with `Section` or `Sec`, the redundant prefix cluttered the options.
4. **Client-Side Cache Delay**: The form relied on `useInfrastructureState` client mounting which could initially load stale classes from `localStorage` rather than canonical PostgreSQL data.

---

## 2. Key Changes Implemented

### A. Canonical Formatter Helper (`lib/master-data.ts`)
- Implemented `formatClassBatchLabel(cls: { name?: string; section?: string | null })`:
  - Strips any `Section` or `Sec` word prefixes from `cls.section`.
  - Intelligently checks if `cls.name` already contains the section (e.g., `12 Eng` already contains `Eng`, `8A` contains `A`).
  - Returns clean, concise grade & section (e.g., `12 Eng`, `12 Mgt`, `11 Eng`, `11 Mgt`, `10 Eng`, `9 Eng`, `8A`, `7B`, `6A`).
  - Completely omits stream names and deceptive capacity counts from the class option text.

### B. Direct Server-Side Class Preloading (`app/(dashboard)/records/new/page.tsx`)
- Updated `NewLogPage` to invoke `getClassesAction({ activeOnly: true })` on the server in parallel with `getActiveLabs()`, `getTeachers()`, and `getScopedLogFormOptions()`.
- Passes `initialClasses` directly to `<LogForm>` so the page renders canonical PostgreSQL classes with zero reliance on client-side cache or hydration delay.

### C. Dropdown UI Standardisation (`app/(dashboard)/records/new/log-form.tsx`)
- Updated `LogForm` to accept `initialClasses` and prioritize them in `rawClasses`.
- In the `Class / Batch Section *` select dropdown, mapped options with `formatClassBatchLabel(c)`.
- Updated subject section headings (`Practical Curriculum Subject (...)`) to use `formatClassBatchLabel(activeClassObj)`.

### D. System-Wide Dropdown Alignment
- Standardized `formatClassBatchLabel` across:
  - `components/schedules/session-action-modal.tsx` (Ad-hoc timetable session booking modal)
  - `components/dashboard/report-incident-modal.tsx` (Incident report batch selector)
  - `app/(dashboard)/admin/page.tsx` (Curriculum subject assignment class selector)

---

## 3. Verification & Evidence

- **Strict TypeScript**: `npx tsc --noEmit` completed with 0 errors.
- **Unit & Integration Tests**:
  - `tests/practical-log-form-and-subject-clean.test.mjs` (Subtest 5 & 6): 6/6 passed.
  - `tests/class-stream-management.test.mjs`: 3/3 passed.
  - `tests/phase2-admin-unification.test.mjs`: 12/12 passed.
