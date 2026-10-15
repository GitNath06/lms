# Task 23: Chronological Timetable Sorting, Upcoming Session Lifecycle Lockout, and Universal Computer Lab Seating Snapshot Invariant

**Execution Date**: 2026-10-11  
**Status**: Completed  
**Subsystems**: `lib/utils.ts`, `app/actions/schedules.ts`, `app/actions/logs.ts`, `app/actions/live-session.ts`, `components/computer-lab/live-cockpit-bar.tsx`, `components/computer-lab/computer-lab-workspace.tsx`, `app/(dashboard)/page.tsx`, `app/(dashboard)/computer-lab/page.tsx`

---

## 1. Context & Architectural Root Causes

### Problem 1: Broken Chronological Sorting Across Academic Timetable Views
In PostgreSQL queries and frontend arrays, sorting by `start_time ASC` sorted strings alphabetically. Because afternoon slots were stored without 24-hour leading zeroes (e.g. `'01:45'`), `'01:45'` evaluated as less than `'10:10'`. Consequently, afternoon sessions (1:45 PM – 4:50 PM in Computer Lab) were presented *ahead* of morning sessions (10:10 AM Chemistry Lab and 10:10 AM Computer Lab). This gave the misleading impression that the system prioritized Computer Lab sessions over Chemistry and Physics labs.

### Problem 2: Premature Live Cockpit State & Missing Skip Action
At simulated time `09:52 AM` (Pre-Period: 09:15 – 10:00), upcoming session `DDMP-10` (`10:10 – 11:00`) was automatically previewed but incorrectly displayed with a pulsating green beacon as *"Live Roll-Call in Progress"* and an active *"Save & Submit Practical Log"* button. The session had not started yet. It needed to show as *"Upcoming Next (Starts in 18m / 10:10 AM)"*, lock attendance log submission until period start, and provide a *"Skip Session"* action so faculty/in-charge can record skipped sessions in advance.

### Problem 3: Computer Lab Floor Map Scoping
In `/computer-lab` (Floor Map), selectors and queues needed to be strictly scoped to Computer Lab sessions (`lab_id === 'comp'`), sorted in natural chronological order with explicit status tags (`🟢 LIVE NOW`, `🕒 UPCOMING`, `✓ PAST`).

### Problem 4: Universal Seating Snapshot Invariant
When practical logs are submitted from the Floor Map, a frozen `seating_snapshot` JSONB was recorded into PostgreSQL. However, logs created from the Dashboard quick log modal (`SessionActionModal`), `/records/new`, or the timetable failed to construct or save `seating_snapshot`. For Computer Lab sessions, the full 48-workstation seating arrangement snapshot must be saved regardless of which route or modal created the log.

---

## 2. Implementations Completed

### A. Universal Chronological Sorter (`lib/utils.ts`)
- Added `parseTimeToMinutes(timeStr)` converting 12-hour academic slots into 24-hour minutes from midnight:
  - Hours 1..7 (e.g. 01:15, 01:45, 02:30, 03:15, 04:05) convert to 13:00..17:00 PM.
  - Hours 8..11 (09:15, 10:10, 11:00, 11:45) remain AM.
  - Hour 12 (12:30) is Midday (12:00 PM).
- Implemented `sortSessionsChronologically<T>(items: T[]): T[]`:
  - 1st Priority: Master slot ordering (`t1`..`t10`).
  - 2nd Priority: 24-hour start time minutes from midnight.
  - 3rd Priority: Lab name tie-breaker (stable grouping).
- Applied across all schedule retrieval and presentation endpoints:
  - `app/actions/schedules.ts`: `getSchedules` returns chronologically sorted timetable slots.
  - `hooks/use-routine-state.ts`: `deduplicateRoutines` returns sorted rows.
  - `hooks/use-live-schedule.ts`: `todaySessions` filtered and sorted chronologically.
  - `app/(dashboard)/page.tsx`: `effectiveSessions` sorted chronologically.
  - `app/(dashboard)/computer-lab/page.tsx`: strictly scoped to `lab_id = 'comp'` and chronologically sorted.

### B. Session Timing Lifecycle & Upcoming Lockout (`components/computer-lab/live-cockpit-bar.tsx`)
- Extended `LiveCockpitBarProps` with `timingStatus: { status: 'live' | 'upcoming' | 'past'; startsInMins?: number; minsRemaining?: number }` and `onSkipSession?: () => void`.
- When `status === 'upcoming'`:
  - Beacon switches from green pulse to solid amber: `bg-amber-400 shadow-[0_0_8px_#f59e0b]`.
  - Displays amber badge: `Upcoming Next • Starts in X mins (10:10 AM)`.
  - Practical log submission button is disabled: `disabled={true}`, labeled `Starts at 10:10 AM`, with explanatory title tooltip.
- Added `Skip Session` button:
  - Rendered when `onSkipSession` is provided and session is not locked.
  - Styled with amber outline (`RotateCcw` icon + text, zero literal `+`).

### C. Skip Session Modal & Floor Plan Selector (`components/computer-lab/computer-lab-workspace.tsx`)
- Added `sessionTimingStatus` memo calculating exact starts-in or remaining minutes from simulated/effective time.
- Implemented `handleSkipSession` recording skipped sessions via `createPracticalLog({ status: 'skipped', skip_reason: reason })`.
- Added modal allowing instructors to choose official skip justification (theory in lecture room, faculty leave, campus event, power outage, exam) and custom remarks.
- Scoped timetable slot dropdown strictly to today's Computer Lab sessions, displaying clear status prefixes (`🟢 LIVE NOW`, `🕒 UPCOMING`, `✓ PAST`).

### D. Universal Seating Snapshot Invariant (`app/actions/logs.ts`)
- In `createPracticalLog`:
  - If `safeLabId === 'comp'` and `seating_snapshot` is empty/missing:
    - Queries active workstations in `comp` (ordered by label).
    - Resolves Tier 1 baseline seat plan from `workstation_seat_plans` for the cohort.
    - Applies Tier 2 session seat overrides from `session_seat_overrides`.
    - Maps student presence based on `absent_rolls`.
    - Generates and persists the complete 48-node `seating_snapshot` JSONB.
  - Added direct PostgreSQL connection pool (`getPgPool`) fallback to guarantee atomic persistence even when called from unauthenticated script/background workers.

---

## 3. Verification & Automated Test Results

Executed test suite: `tests/chronological-sorting-and-seating-snapshot.test.mjs`
```bash
node --experimental-strip-types --import ./tests/register-hooks.mjs --test ./tests/chronological-sorting-and-seating-snapshot.test.mjs
```
- **Test 1**: Morning sessions (10:10 AM CHEM & COMP) precede afternoon sessions (01:45 PM COMP) &rarr; **PASS**
- **Test 2**: At 09:52 AM, a 10:10 AM session is UPCOMING (Starts in 18m), not LIVE &rarr; **PASS**
- **Test 3**: Universal Seating Snapshot Invariant persists `seating_snapshot` JSONB with workstation entries into PostgreSQL &rarr; **PASS**

TypeScript compilation:
```bash
npx tsc --noEmit
```
&rarr; **0 errors across all routes and components.**
