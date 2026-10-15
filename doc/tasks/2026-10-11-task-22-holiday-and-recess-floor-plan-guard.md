# Task Log: 22 — Institutional Holiday & Recess Floor Plan Suspension Guard

- **Date**: 2026-10-11
- **Task ID**: `TASK-22`
- **Status**: Completed & 100% Validated (`npx tsc --noEmit` & 7/7 tests passed in `tests/holiday-and-recess-guard.test.mjs`)
- **Target Modules**:
  - `lib/calendar-policy.ts` *(new canonical module)*
  - `components/computer-lab/computer-lab-workspace.tsx`
  - `app/actions/live-session.ts`
  - `app/actions/logs.ts`
  - `tests/holiday-and-recess-guard.test.mjs` *(new test suite)*
  - `tests/resolve-hook.mjs`

---

## 1. Context & User Problem Statement

When an academic date is designated as an institutional holiday (such as **Bada Dashain Vacation** on 10–22 October 2026) or when **Sunday Week Off Policy** is toggled ON:
1. **The Timetable (`/schedules`)** and **Dashboard (`/`)** correctly displayed institutional recess banners stating *"Attendance Not Required"* and *"0 scheduled"*.
2. **Floor Plan & Live Cockpit (`/computer-lab`) completely ignored holidays and recesses!**
   - It fell back to `scheduledSessions[0]` (`DBMS-10`), auto-selected a schedule from another day or Sunday routine, and displayed *"Live Roll-Call in Progress"*.
   - It rendered the **"Save & Submit Practical Log"** action button, allowing faculty to save practical session logs on official holidays!
   - Workstation nodes on the canvas rendered in roll-call mode instead of nominal recess/maintenance state.

---

## 2. Technical Architecture & Implementation

### 2.1 Canonical Calendar Policy Engine (`lib/calendar-policy.ts`)
Created a single authoritative rule engine for holiday suspensions, Saturday statutory weekend, and Sunday week-off policy:
- `evaluateDateSuspension(dateStr, customHolidays, settings)`:
  - Checks official gazetted and cultural holidays (`DEFAULT_HOLIDAYS` and database `academic_holidays`).
  - Checks statutory Saturday off (`saturdayWeekend: true`).
  - Checks institutional Sunday week-off toggle (`sundayWeekend: true`).
  - Returns structured `DateSuspensionStatus`:
    `{ isSuspended: boolean, type: 'holiday' | 'recess', title: string, badge: string, description: string }`.
- `checkServerDateSuspension(dateStr)`:
  - Server-side asynchronous database validator reading `calendar_settings` and `academic_holidays` with fast in-memory caching.

### 2.2 Live Floor Plan & Cockpit Suspension (`computer-lab-workspace.tsx`)
- Hooked `useInfrastructureState()` (holidays) and `useCalendarSettings()` (week-off policies) to calculate `dateSuspension`.
- **Session Auto-Selection Lock**:
  - When `dateSuspension.isSuspended` is true:
    - Sets `todaySessions = []` and `liveOngoingSession = null`.
    - Removed rogue fallback `|| scheduledSessions[0]` which previously loaded sessions across other days.
    - Clears `selectedScheduleId` and `sessionContext`.
- **Institutional Recess Banner in Live Mode**:
  - Instead of `LiveCockpitBar`, renders the official **Institutional Recess / Holiday Suspension Card** with amber styling, holiday title, Nepali date, and directives:
    - 🟢 `Attendance Not Required`
    - 🔧 `Maintenance Access Open`
- **Workstations Idle in Recess**:
  - Workstations display hardware state (operational, under repair, etc.) with zero glowing roll-call rings.
  - Clicking any workstation outside session or during recess opens the Hardware Issue Drawer so staff can report maintenance faults.

### 2.3 Server-Side Defense-in-Depth (`app/actions/live-session.ts` & `app/actions/logs.ts`)
- **`submitLiveSession`**: Calls `checkServerDateSuspension(params.date)` and rejects attempts to submit logs on holidays or recesses with clear user error.
- **`getLiveSessionContext`**: Rejects loading session context for locked holiday dates.
- **`createAdHocSession`**: Rejects starting ad-hoc practicals on suspended dates.
- **`assignSessionSeatOverride`**: Rejects temporary seating overrides on suspended dates.
- **`createPracticalLog`** (`app/actions/logs.ts`): Validates against `checkServerDateSuspension(logPayload.date)` to reject both conducted and skipped log creations across all routes (`/records/new`, timetable modal, and dashboard).

---

## 3. Automated Verification

- **TypeScript Compilation**: `npx tsc --noEmit` passed with 0 errors.
- **Node Test Suite**: `node --experimental-strip-types --import ./tests/register-hooks.mjs --test ./tests/holiday-and-recess-guard.test.mjs`:
  1. Dashain Holiday (2026-10-11) is recognized as suspended gazetted holiday &rarr; `PASS`
  2. Regular Academic Day (2026-10-07) is active &rarr; `PASS`
  3. Saturday 2026-11-21 is suspended under statutory policy &rarr; `PASS`
  4. Sunday 2026-11-22 is normal work day when `sundayWeekend: false` &rarr; `PASS`
  5. Sunday 2026-11-22 is suspended when `sundayWeekend: true` &rarr; `PASS`
  6. Server Guard: `createPracticalLog` rejects submissions on Dashain holiday &rarr; `PASS`
  7. Server Guard: `submitLiveSession` rejects submissions on Dashain holiday &rarr; `PASS`
- All 7 tests passed (100% assertions green).
