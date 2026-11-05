# Task 92: Schedules Timetable Elevation — One-Time Ad-Hoc Sessions, Cadence Architecture, Weekend Recess Streamline, and Class Suffix Isolation

> **Author**: Antigravity  
> **Date**: 2026-10-29  
> **Type**: Architecture & Bug Fix  
> **Status**: Completed  
> **TypeScript**: Passed (`0 errors`)  
> **Tests**: Passed (`unit-domain-invariants.test.mjs`, `phase6-conflicts-and-audit.test.mjs`)

---

## 1. Problem Statement & Root Cause Analysis

### A. One-Time Test Session Recurring Indefinitely Across All Time
- **Issue**: Booking an ad-hoc practical session for testing on a single date caused it to appear every week on that day of the week forever.
- **Root Cause**: `public.schedules` was originally architected as a static weekly timetable matrix without a `specific_date` column. Any session booked into `schedules` only had `day_key`, so weekly grid views and live schedule detectors matched on `s.day_key === currentDayKey`, propagating one-time reservations to every week in perpetuity.

### B. "Unassigned Faculty" Display on Timetable Cards
- **Issue**: Scheduled session cards displayed "Unassigned... COM-LAB" instead of the assigned instructor.
- **Root Cause**: `SessionActionModal` set `teacher: assignedTeacher` (name string) but failed to resolve or propagate `teacher_id` (UUID) or `class_subject_id`. `createSchedule` therefore inserted `NULL` into `schedules.teacher_id`, preventing relational joins from resolving instructor profiles.

### C. Hardcoded Friday Suspension Trap
- **Issue**: Friday displayed a static full-width banner ("Academic Review & Practical Catch-up") locking out bookings whenever 0 schedules existed.
- **Root Cause**: `app/(dashboard)/schedules/advanced-calendar.tsx` had `(day.id === 'fri' && daySchedules.length === 0)` inside `isWholeDaySuspended`.

### D. Bulky Weekend Rows Consuming Screen Height
- **Issue**: When both Saturday and Sunday were marked as weekly recess days, both rows still rendered full-height cards in the grid.
- **Requirement**: Hide Saturday and Sunday rows when both are active institutional recess days. If Sunday recess is ever toggled off, Sunday must automatically appear first in order before Monday (`Sunday`, `Monday`, ...).

### E. Cohort Section Collision (12 C vs 12 M)
- **Issue**: Scheduling for "Class 12 C" erroneously targeted or mapped to "Class 12 M".
- **Root Cause**: `matchesGrade` in `lib/master-data.ts` used loose prefix and numeric extraction without enforcing single-letter section/stream exclusivity, causing `"12C"` and `"12M"` to evaluate to `true`.

---

## 2. Key Changes Implemented

### 1. Database Schema Migration
- Added `specific_date DATE NULL` column and index to `public.schedules`:
  ```sql
  ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS specific_date DATE;
  CREATE INDEX IF NOT EXISTS idx_schedules_specific_date ON public.schedules(specific_date);
  ```
- Backfilled `teacher_id` for orphaned schedules with faculty Dinanath Shah (`67757083-3f8a-44b8-aabe-9adfd5c6b116`).

### 2. TypeScript Domain Models & Interfaces
- **`types/database.ts`**: Added `specific_date?: string | null` to `schedules.Row`, `Insert`, and `Update`.
- **`lib/master-data.ts`**: Added `specificDate?: string | null`, `date?: string`, and `isAdHoc?: boolean` to `MasterRoutineItem`.
- **`lib/master-data.ts`**: Hardened `matchesGrade` to prevent cross-stream matching between single-letter suffixes (e.g. `'c'` vs `'m'`, `'sci'` vs `'mgt'`).

### 3. Server Actions (`app/actions/schedules.ts`)
- Added `specific_date?: string | null` parameter to `createSchedule`.
- Enhanced conflict engine in `createSchedule` so ad-hoc sessions on different calendar dates do not trigger false facility or faculty collisions.
- Persisted `specific_date` into `payload: ScheduleInsert`.

### 4. Client State Management (`hooks/use-routine-state.ts` & `hooks/use-live-schedule.ts`)
- **`useRoutineState`**:
  - `loadRemoteSchedules`: Mapped `specificDate` and `isAdHoc` flags from remote database rows.
  - `addSession` & `requestSlotBooking`: Forwarded `specific_date`, `teacher_id`, and `class_subject_id`.
- **`useLiveSchedule`**:
  - Filtered `todaySessions` to ensure ad-hoc sessions only become active if `s.specificDate === getNepalDateStr(now)`.

### 5. Interactive Session Modal (`components/schedules/session-action-modal.tsx`)
- Added **Session Booking Cadence** selector with two distinct options:
  - **One-Time Reservation** (Default): Date-specific, applies only to the selected date.
  - **Recurring Master Routine**: Reserved for Super Admin and Lab In-Charge; locked for Teachers.
- Added `bookTeacherId` state and dynamic updates on faculty and subject selection.
- Resolved and passed `classSubjectId` and `teacherId` in `newSessionItem`.

### 6. Timetable Grid Elevation (`app/(dashboard)/schedules/advanced-calendar.tsx`)
- Removed `(day.id === 'fri' && daySchedules.length === 0)` from whole-day suspension logic.
- Implemented `displayedDays` filtering:
  - When `sundayWeekend && saturdayWeekend`: Displays Monday–Friday only (eliminates 160px+ of unused space).
  - When `!sundayWeekend`: Sunday displays first, followed by Monday–Friday.
- Date-filtered sessions (`s.specificDate ? s.specificDate === dayDateInfo.dateStr : true`) across both desktop and mobile views.
- Wired `sessionDate` into `SessionActionModal` and updated slot clicks to preserve column dates.

---

## 3. Verification & Compliance Checklist
- [x] Rule 1: No literal `+` in button labels (`<Plus className="..." /> <span>Book Slot</span>`).
- [x] Rule 2: Terminology strictly adheres to "Attendance", "Timetable", and "Logbook".
- [x] Rule 8: Strict TypeScript compilation passed (`npx tsc --noEmit` with 0 errors).
- [x] Rule 17: Triple-Collision Defense preserved for room, faculty, and cohort.
- [x] Rule 20: Verified with unit tests (`unit-domain-invariants.test.mjs`, `phase6-conflicts-and-audit.test.mjs`).



---

## 4. Post-Deployment Remediation: PostgreSQL `session_status` Enum Guard & Multi-Lab/Multi-Span Propagation

### A. Root Cause of `invalid input value for enum session_status: "confirmed"`
- **Diagnosis**: PostgreSQL column `public.schedules.status` has a custom enum `session_status` with allowed values: `['scheduled', 'in_progress', 'completed', 'cancelled']`.
- **Failure Mode**: When saving sessions, `data.metadata?.status` or `(data as any).status` passed `'confirmed'` (or `'requested'`). In `createSchedule`, `updateSchedule`, and `updateScheduleStatus`, setting `status: 'confirmed'` caused PostgreSQL to abort the transaction with error `invalid input value for enum session_status: "confirmed"`, causing all session additions to fail.
- **Resolution**:
  - `payload.status` in PostgreSQL is strictly validated against `session_status` and defaults to `'scheduled'` (or `'cancelled'` when skipped).
  - The UI lifecycle status (`'confirmed'`, `'requested'`, `'skipped'`) is cleanly stored inside `metadata.status` and `metadata.is_adhoc`.

### B. Multi-Lab Facility Practical Support
- **Diagnosis**: While `SessionActionModal` had checkboxes for dual-lab practicals (`isDualLab`, `secondaryLabKey`, `coTeacher`), `addSession` in `hooks/use-routine-state.ts` failed to forward `secondary_lab_id`, `secondary_lab_name`, `is_multi_lab`, and `co_teacher` in `metadata`. Furthermore, `loadRemoteSchedules` did not map them from `s.metadata`.
- **Resolution**:
  - `hooks/use-routine-state.ts`: `addSession` and `requestSlotBooking` now explicitly forward `secondary_lab_id`, `secondary_lab_name`, `is_multi_lab`, and `co_teacher`.
  - `loadRemoteSchedules`: Re-hydrates `isDualLab`, `secondaryLab`, `secondaryLabKey`, and `coTeacher` from `s.metadata`.

### C. Multi-Period Span ("multitime") Timing & Grid Span
- **Diagnosis**: When selecting `Slot Duration = 2 Periods`, `SessionActionModal` was assigning single-period `slotObj.label` (`10:10 - 11:00`) to `timeSlot` instead of calculating the multi-period range.
- **Resolution**:
  - `components/schedules/session-action-modal.tsx`: Invokes `computeCombinedTimeRange(bookSlotId, effectiveSpan, allPeriods)` to set the combined time range (`10:10 - 11:45`).
  - `app/actions/schedules.ts`: Recalculates `start_time` and `end_time` dynamically when `span > 1`.
  - Timetable desktop grid renders across multiple columns (`gridColumnEnd: startIdx + 1 + span`) with proper track reservation.
