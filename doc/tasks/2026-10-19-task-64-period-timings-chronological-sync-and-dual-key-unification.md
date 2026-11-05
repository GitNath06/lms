# Task 64: Institutional Period Timings Chronological Sorting & Dual-Key Setting Unification

**Date**: 2026-10-19  
**Category**: Core Scheduling & Institutional Infrastructure  
**Target Subsystems**:
- `lib/utils.ts` (`sortPeriodSlots`, `sortSessionsChronologically`)
- `lib/scheduling/conflict-engine.ts` (`SLOT_ORDER`)
- `app/actions/settings.ts` (`getPeriodSlotsAction`, `updatePeriodSlotsAction`, `updateInstitutionSetting`)
- `hooks/use-infrastructure-state.ts` (`periods`, `addPeriod`, `updatePeriod`, `deletePeriod`, `resetPeriods`)
- `app/(dashboard)/admin/page.tsx` (`handleSavePeriod`)
- `tests/period-slots-chronological.test.mjs`

---

## 1. Problem Statement & Root Cause Analysis

### A. The Jumbled Period Order
On the Admin Console (`/admin` -> Period Timings), `Pre-Period (09:15 - 09:50)` appeared at the bottom (index 9) or out of sequence instead of preceding Period 1 (`10:00 - 10:45 AM`).

### B. Root Causes
1. **Dual Storage Keys with Schema Drift**:
   - The system maintained two different settings keys in `public.institution_settings`:
     - `'infrastructure_periods'`: Used by `useInfrastructureState` on the frontend.
     - `'master_time_slots'`: Used by server actions in `app/actions/settings.ts` and timetable conflict routines.
   - When periods were modified or added, the updates often hit one key and not the other, leading to data divergence and inconsistent ordering across pages.
2. **Missing Pre-Period (`t0`) in Slot Order**:
   - `SLOT_ORDER` in `lib/scheduling/conflict-engine.ts` started at `t1`, meaning any period with ID `t10` or `pre` was ranked at the end rather than preceding `t1`.
3. **No Authoritative Chronological Sorter**:
   - Periods were stored and rendered in insertion order or array mutation order, with no time-based sort algorithm comparing start minutes (e.g. `09:15` = 555 min vs `10:00` = 600 min).

---

## 2. Architectural Solution Implemented

### A. Universal Chronological Period Slot Sorter (`lib/utils.ts`)
- Added `sortPeriodSlots<T>` which parses start times (converting 12-hour AM/PM to 24-hour total minutes via `parseTimeToMinutes`) and sorts all period slots strictly by their start time.
- Enhanced `sortSessionsChronologically` to explicitly recognize `t0` and `pre` as index 0 (earliest morning period).
- Created `formatPeriodRangeLabel(start, end)` to automatically normalize both start and end times into clean 12-hour standard institutional formats (e.g., `09:15 - 09:50 AM`, `01:25 PM - 02:15 PM`), preventing raw 24-hour formats (`13:25`) or mismatched AM/PM specifiers.
- Added live formatted preview to the Period creation/edit modal in `app/(dashboard)/admin/page.tsx`.

### B. Conflict Engine Slot Order Expansion (`lib/scheduling/conflict-engine.ts`)
- Updated `SLOT_ORDER`:
  ```typescript
  export const SLOT_ORDER = ['t0', 'pre', 't1', 't2', 't3', 't4', 'break', 't5', 't6', 't7', 't8', 't9', 't10']
  ```
  Ensuring Pre-Period (`t0`) always occupies index 0 in slot range calculations and collision detection.

### C. Atomic Lockstep Synchronization (`app/actions/settings.ts`)
- Added `updatePeriodSlotsAction(slots: PeriodSlotRecord[])`:
  - Enforces administrative authorization.
  - Automatically sorts all slots chronologically using `sortPeriodSlots(slots)` before writing to PostgreSQL.
  - Executes an atomic SQL query inserting/updating **BOTH** `'master_time_slots'` AND `'infrastructure_periods'` simultaneously in `public.institution_settings`.
  - Automatically flushes memory cache and triggers route revalidation for `/schedules`, `/admin`, `/records/new`, and `/`.
- In `updateInstitutionSetting`, added automatic interception: if either `'master_time_slots'` or `'infrastructure_periods'` is updated via the generic setter, both keys are automatically updated in tandem with sorted slots.

### D. Frontend Infrastructure State Hardening (`hooks/use-infrastructure-state.ts`)
- Updated `addPeriod`, `updatePeriod`, `deletePeriod`, and `resetPeriods`:
  - Every mutation sorts periods via `sortPeriodSlots`.
  - Dispatches updates directly via `updatePeriodSlotsAction` to ensure PostgreSQL stays in lockstep.
- In Admin Console (`app/(dashboard)/admin/page.tsx`), assigned smart candidate slot IDs: Pre-Period defaults to `t0` if available, and `t1...tN` for standard sequential periods.

### E. PostgreSQL State Reconciliation
- Re-aligned the existing rows in `public.institution_settings` for both `'master_time_slots'` and `'infrastructure_periods'`:
  1. `t0`: `Pre-Period` (09:15 - 09:50)
  2. `t1`: `Period 1` (10:00 - 10:45 AM)
  3. `t2`: `Period 2` (10:45 - 11:30 AM)
  4. `t3`: `Period 3` (11:30 - 12:15 PM)
  5. `t4`: `Period 4` (12:15 - 01:00 PM)
  6. `break`: `Recess Break` (01:00 - 01:40 PM)
  7. `t5`: `Period 5` (01:40 - 02:25 PM)
  8. `t6`: `Period 6` (02:25 - 03:10 PM)
  9. `t7`: `Period 7` (03:10 - 03:55 PM)
  10. `t8`: `Period 8` (03:55 - 04:30 PM)

---

## 3. Verification & Compliance
1. **Unit Test Suite**:
   - `tests/period-slots-chronological.test.mjs`:
     - Test 1: `sortPeriodSlots` arbitrary scrambled slots order verification &rarr; **PASSED (100%)**
     - Test 2: PostgreSQL dual-key synchronization & chronological monotonicity &rarr; **PASSED (100%)**
2. **TypeScript Strict Type Check**:
   - `npx tsc --noEmit` &rarr; **0 errors**.
3. **Theme Audit Compliance**:
   - `tests/theme-audit-compliance.test.mjs` &rarr; **PASSED (0 violations)**.
