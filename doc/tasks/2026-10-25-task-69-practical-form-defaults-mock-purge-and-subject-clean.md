# Task 69: Practical Log Form Defaults Overhaul, Mock Purge & Subject Duplication De-duplication

**Author**: Antigravity Assistant  
**Date**: 2026-10-25  
**Status**: Completed  
**Branch**: `main`

---

## 1. Problem Statement & User Pain Points

During real-world operational testing of the Practical Log creation flow (`/records/new`) and Schedule Timetable views (`/schedules`), multiple deceptive default values, mock data leftovers, and display regressions were reported:

1. **Auto-Selection of 2 Academic Periods (Image 1)**:
   - When opening "New Practical Session Log", two period slots (`P2` and `P3`) were selected by default (`['t2', 't3']`).
   - The time slot badge was permanently stuck at `10:10 - 11:00` regardless of which period chips were selected because `infraPeriods` was never passed into `computeMultiPeriodLabel`.
2. **Pre-filled Practical Experiment Topic & Remarks (Image 2)**:
   - The practical experiment topic was pre-filled with actual text (`Verification of Binary Search Tree Operations & Node Insertion`) instead of being an empty input with a placeholder.
   - Changing class or subject automatically overwrote the topic input with hardcoded strings from `defaultTopic`.
   - The optional teacher remarks textarea was pre-filled with `"Workstations functioning normally. Equipment cleaned and restored after practical."` as real value text.
3. **Hardcoded Absent Roll Numbers (Image 3)**:
   - The attendance register initialized with `Roll 14` and `Roll 28` marked as absent (`absentRolls: [14, 28]`, `absentCountInput: 2`), resulting in false attendance penalties right out of the box.
   - When switching classes, `handleClassChange` forcefully re-marked rolls 14 and 28 as absent.
4. **Subject Name Duplication / Redundancy (Image 4)**:
   - On timetable cards (e.g. mobile card), the heading displayed `BIO-12 — BIO-12 – Cell Biology & Genetics Lab`.
   - The database schedule row `subject_name` already contained the code prefix, and `advanced-calendar.tsx` prefixed `{formatCleanSubjectCode(session.subjectCode)} — ` without checking if the title already contained the code.
   - The same issue affected the desktop timetable and the Admin Routine Manager tables.

---

## 2. Root Cause Analysis

| Issue | File Location | Root Cause |
| :--- | :--- | :--- |
| **Two Periods Auto-selected** | `app/(dashboard)/records/new/log-form.tsx:207` | `useState<string[]>(['t2', 't3'])` hardcoded to two periods. |
| **Frozen Time Range `10:10 - 11:00`** | `app/(dashboard)/records/new/log-form.tsx:252` | `computeMultiPeriodLabel(selectedPeriods)` was called without passing `infraPeriods`. It fell back to `10:10` and `11:00`. |
| **Pre-filled Topic & Remarks** | `app/(dashboard)/records/new/log-form.tsx:230-235` | Initial state used `initialSub.defaultTopic || 'Verification of Binary Search...'` and prefilled remarks string. Class/subject change handlers also re-injected `defaultTopic`. |
| **Hardcoded Absent Students** | `app/(dashboard)/records/new/log-form.tsx:214-215, 281-282` & `hooks/use-logs-state.ts:74` | Initial state initialized `absentRolls: [14, 28]` and `absentCountInput: 2`. `INITIAL_MOCK_LOGS` in `use-logs-state.ts` also seeded a mock record with `[14, 28]`. |
| **Subject Title Duplication** | `app/(dashboard)/schedules/advanced-calendar.tsx:514` & `hooks/use-routine-state.ts:205-206` | Calendar cards formatted `${formatCleanSubjectCode(code)} — ${title}` where `title` already had `${code} – ...`. `useRoutineState` also assigned `subjectTitle = s.subject_name` without stripping the code prefix. |

---

## 3. Implementation Details

### A. Shared Clean Subject Formatting Engine (`lib/master-data.ts`)
- Added `cleanSubjectTitle(subjectCode?: string, subjectTitle?: string): string`:
  - Strips redundant subject code prefixes (`BIO-12 – `, `BIO-12 - `, `BIO-12 — `, `BIO-12: `) from titles.
- Added `formatSubjectHeading(subjectCode?: string, subjectTitle?: string): string`:
  - Combines clean subject code and clean subject title cleanly without repetition. If `title` already contains the code, it prevents double prefixes.

### B. Practical Log Form Overhaul (`app/(dashboard)/records/new/log-form.tsx`)
1. **Single Period Default**:
   - `selectedPeriods` initializes to `['t1']` (single period).
   - Dynamically re-aligns to the first non-break slot in `infraPeriods` when infrastructure settings load.
   - Passes `infraPeriods` to `computeMultiPeriodLabel(selectedPeriods, infraPeriods)` so the time badge accurately updates whenever chips are toggled.
2. **Attendance Register**:
   - `absentRolls` initializes to `[]` (empty array).
   - `absentCountInput` initializes to `0`.
   - In `handleClassChange`, resets `absentRolls` to `[]` and `absentCountInput` to `0`. All students start as 100% present.
3. **Topic & Remarks**:
   - `practicalTitle` initializes to `''` (empty string).
   - `remarks` initializes to `''` (empty string).
   - Removed all `setPracticalTitle(defaultTopic)` side-effects from `handleClassChange` and `handleSubjectChange`.
   - Updated input placeholders to clear, generic institutional examples:
     - Topic: `"e.g. Verification of Ohm's Law / Binary Search Trees / Titration"`
     - Remarks: `"Optional session observations, equipment notes, or student remarks..."`
4. **Clean Subject Submission & Selectors**:
   - In `handleSubmit`, creates `finalFormattedSubject` with `formatSubjectHeading` and sets `subjectTitle` as `cleanSubjectTitleOnly`.
   - In the subject `<Select>`, options are formatted using `formatSubjectHeading(s.code, s.title)`.

### C. Schedule & Routine Views De-duplication (`advanced-calendar.tsx` & `routine-manager.tsx`)
- In `app/(dashboard)/schedules/advanced-calendar.tsx`:
  - Mobile card heading uses `formatSubjectHeading(session.subjectCode, session.subjectTitle)`, eliminating `BIO-12 — BIO-12` repetition.
  - Desktop card title uses `cleanSubjectTitle(session.subjectCode, session.subjectTitle)`, avoiding duplicate codes next to the code badge.
- In `components/admin/routine-manager.tsx`:
  - Table rows for schedule items wrap `session.subjectTitle` in `cleanSubjectTitle(session.subjectCode, session.subjectTitle)`.
- In `hooks/use-routine-state.ts`:
  - Remote DB schedules parse `subjectCode` and `subjectTitle` with `cleanSubjectTitle`, storing pristine data in state and `localStorage`.
- In `hooks/use-logs-state.ts`:
  - Set `INITIAL_MOCK_LOGS = []` to prevent ghost seed records from polluting log history.

---

## 4. Verification & Testing

- Created automated regression suite in `tests/practical-log-form-and-subject-clean.test.mjs`:
  1. `cleanSubjectTitle` strips redundant subject code prefixes.
  2. `formatSubjectHeading` creates clean headings without repetition.
  3. `computeMultiPeriodLabel` computes single periods dynamically from slot list.
  4. `log-form.tsx` static analysis verifies zero hardcoded absent rolls (`[14, 28]`), zero default topic strings, and zero default remarks.
- Execution:
  `node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/practical-log-form-and-subject-clean.test.mjs`
  **Result**: 5/5 tests passing (13.9ms).
- Existing test suites:
  `node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/phase3-mock-purge.test.mjs`
  **Result**: 7/7 tests passing (650ms).
