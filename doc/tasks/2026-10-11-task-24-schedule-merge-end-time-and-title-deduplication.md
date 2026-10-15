# Task 24: Schedule Merge End-Time Span Extension, Title Deduplication & Safe Slot Split/Restoration

**Execution Date**: 2026-10-11  
**Status**: Completed  
**Subsystems**: `app/actions/schedules.ts`, `components/schedules/session-action-modal.tsx`, `hooks/use-routine-state.ts`, `public.schedules` PostgreSQL table

---

## 1. Context & Architectural Root Causes

### Problem 1: Stale `end_time` After Merging Multi-Period Sessions
When merging two consecutive academic timetable slots (e.g. `CHEM-12` Period 1 at `10:10 - 11:00` and `CHEM-12` Period 2 at `11:00 - 11:45`):
- `mergeSchedules` updated `span: 2`, but omitted `end_time` from the update payload.
- Consequently, the primary schedule row kept `end_time = '11:00'`.
- Both the Timetable calendar card and the Dashboard Upcoming cards displayed `10:10 - 11:00` instead of the combined multi-period span `10:10 - 11:45`.

### Problem 2: Duplicate Title Concatenation (`CHEM-12 & CHEM-12`)
When merging two consecutive sessions with identical subject codes and titles:
- The UI modal and state hooks concatenated strings as `${current.subjectTitle} & ${next.subjectTitle}` and `${current.subjectCode} + ${next.subjectCode}`.
- This resulted in redundant merged labels such as `CHEM-12 - Chemistry Lab & CHEM-12 - Chemistry Lab` and `CHEM-12 + CHEM-12`.

### Problem 3: Data Loss on Unmerging / Splitting Sessions
When unmerging a consolidated multi-period block:
- `unmergeSchedule` updated `span: 1, is_merged: false`, but never restored the secondary slot that was deleted upon merging.
- Furthermore, the primary's `end_time` was not reset to its original single-period end time (`11:00`).

---

## 2. Implementations Completed

### A. End-Time Span Calculation & Persistence (`app/actions/schedules.ts`)
- Imported `computeCombinedTimeRange` and `parseSlotTimeRange`.
- When merging consecutive sessions (`nextScheduleId` provided):
  - Calculates `newEndTime = secondaryObj.end_time || parseSlotTimeRange(computeCombinedTimeRange(primaryObj.slot_id, combinedSpan)).endTime`.
  - Persists `end_time: newEndTime` into `public.schedules`.
- When extending a single session without a secondary slot:
  - Calculates `newSpan = primaryObj.span + 1` and derives `newEndTime`.
  - Persists `end_time: newEndTime`.

### B. Title and Subject Code Deduplication
- Added `cleanMergedSubjectName(name, fallbackPrimary, fallbackSecondary)`:
  - Normalizes and collapses duplicate split tokens (e.g. `CHEM-12 ... & CHEM-12 ...` &rarr; `CHEM-12 ...`).
- In `components/schedules/session-action-modal.tsx`:
  - Detects `isSameCode` and `isSameTitle`.
  - Avoids adding `+` or `&` when combining identical subjects.
- In `hooks/use-routine-state.ts`:
  - Deduplicates `combinedCode` and `combinedTitle` in `mergeSession`.
  - In `fetchSchedules`, dynamically derives the full span `timeSlot` using `computeCombinedTimeRange(s.slot_id, s.span)` whenever `s.span > 1`, shielding the UI against any legacy stale records.

### C. Safe Unmerge & Secondary Slot Restoration (`app/actions/schedules.ts`)
- In `unmergeSchedule`:
  - Retrieves `metadata.original_parts`.
  - Restores the primary session's original `end_time`, `subject_name`, `batch_name`, and `span: 1`.
  - Atomically re-inserts the secondary session back into `public.schedules` with its original slot, times, and metadata.
  - Zero data loss when splitting consolidated blocks.

### D. Live Database Row Repair
- Repaired live PostgreSQL row `tue-1b`:
  - Set `end_time: '11:45'`.
  - Set `subject_name: 'CHEM-12 - Chemistry Lab'`.
  - Cleaned `original_parts` metadata.

---

## 3. Automated Test Verification

- Executed `tests/merge-unmerge-schedule.test.mjs`:
  - Verified slot `t2` span 2 computes `10:10 - 11:45` &rarr; **PASS**
  - Verified title deduplication for identical merged subjects &rarr; **PASS**
- Executed `tests/chronological-sorting-and-seating-snapshot.test.mjs`:
  - Verified all 3 lifecycle tests pass &rarr; **PASS**
- Executed `npx tsc --noEmit`:
  - Passed with **0 type errors**.
