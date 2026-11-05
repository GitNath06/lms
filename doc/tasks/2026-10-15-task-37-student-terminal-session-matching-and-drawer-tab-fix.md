# Task 37: Student Terminal Dynamic Session Matching & Drawer Tab Flapping Elimination

**Author**: Antigravity Assistant  
**Date**: October 15, 2026  
**Status**: Completed  
**Branch**: `feature/student-terminal-agent`  

---

## 1. Executive Summary & Problem Analysis

The user reported two critical issues with attached browser screenshots:
1. **Student Terminal Session & Student Mismatch**:
   - In `/computer-lab` (Live Cockpit), Class 10 Eng was in session (`DDMP-10 • Digital Design & Microprocessor Lab`, Period 10:10–11:00, Er. Anish Karki).
   - However, the student terminal page (`/terminal/PC-01`) was stuck pointing to `COMP-12 - Data Structures Lab` with Class 11/12 student `Anch Rana (Roll 1)`.
   - **Root Cause 1**: `getTerminalContext` in `app/actions/terminal.ts` was executing a static query with `LIMIT 1` ordered by `created_at DESC`, ignoring the day of the week, time slot, and active simulated time.
   - **Root Cause 2**: Workstation seat resolution queried `workstation_seat_plans` without filtering by `sp.class_id`. In a shared lab where multiple classes use PC-01, it returned whichever class's seat plan was created in the database (Class 11), ignoring the class currently conducting practicals.
   - **Root Cause 3**: In `student_enrollments`, 41 Class 10 students (`ADM-2083-0107` to `ADM-2083-0147`) existed in `students`, but had never been enrolled in `10eng` for academic year `2083`, which caused `/computer-lab` to show `Enrolled Roster: 0`.
   - **Root Cause 4**: `lib/time-simulator.ts` only stored simulated time in client `localStorage`, making it invisible to Next.js Server Components and Server Actions.

2. **Workstation Issue Drawer Tab Flapping**:
   - On `/computer-lab`, clicking a workstation node (e.g. `PC-02`) opened the `WorkstationIssueDrawer` sidebar drawer.
   - It defaulted to the `ISSUES` tab, but whenever the user clicked `SPECS` or `SEATING`, within 1–2 seconds it automatically switched back to the `ISSUES` tab.
   - **Root Cause**: `computer-lab-workspace.tsx` auto-syncs every few seconds, generating new prop references for `workstation` and `assistanceRequest`. Two conflicting `useEffect` hooks in `workstation-issue-drawer.tsx` re-evaluated on every prop reference change. Because `open_issues_count > 0` on PC-02, it repeatedly executed `setActiveTab('issues')`, wiping out the user's manual tab choice.

---

## 2. Changes Implemented

### A. Drawer Tab Flapping Guard (`workstation-issue-drawer.tsx`)
- Consolidated duplicate `useEffect` hooks into a single smart-default handler.
- Added `prevIsOpenRef` and `prevWorkstationIdRef` guards so that `setActiveTab` is **ONLY** called upon initial opening of the drawer or when switching to a different workstation node.
- Preserved user active tab selection across background polling cycles, allowing uninterrupted inspection of hardware specs, seating assignments, or report filing.

### B. Time Simulator Cookie Synchronization (`lib/time-simulator.ts` & `lib/server-effective-time.ts`)
- Updated `setSimulatedTime()` to synchronize `lmr_simulated_time` into a cookie (`SameSite=Lax; max-age=604800`), cleared on `resetToLiveTime()`.
- Created `lib/server-effective-time.ts`:
  - `getServerEffectiveTime()` reads the cookie and derives Nepal Standard Time (UTC+5:45): `effectiveDate`, `effectiveDateStr` (`YYYY-MM-DD`), `dayKey` (`sun`..`sat`), `currentMinutes`.
  - `parseScheduleTimeToMinutes()` converts routine strings (e.g. `10:10`, `01:15`) to minutes from midnight.

### C. Dynamic Schedule & Class-Scoped Student Resolution (`app/actions/terminal.ts`)
- Replaced the static `ORDER BY created_at LIMIT 1` schedule query with dynamic day/time matching:
  - Queries all schedules for `lab_id` on today's `dayKey`.
  - Finds the currently ongoing routine slot (`currentMinutes >= startMin && currentMinutes < endMin`), falling back to `in_progress`, upcoming today, or first today.
  - Resolves `activeClassId` and `activeYearId` from the linked `class_subjects` record.
- Scoped student seat plan lookup to `sp.class_id = activeClassId` and `sp.academic_year_id = activeYearId`:
  - Dynamically binds PC-01 to the student enrolled in the currently ongoing class.
  - When Class 10 is in session, binds to Class 10 Roll 1 (`Amrit Bahadur Thapa`).
  - When Class 11 is in session, binds to Class 11 Roll 1 (`Anch Rana`).
  - Never leaks students from other classes.

### D. Class 10 Enrollment & Baseline Seating Plan
- Enrolled 41 Class 10 students (`ADM-2083-0107` to `ADM-2083-0147`) into `student_enrollments` for class `10eng`, academic year `2083`, section `A`, status `active`.
- Assigned baseline workstation seating in `workstation_seat_plans` across PC-01 through PC-41.
- Updated `/computer-lab` Live Cockpit roster tally from `0` to `41`.

### E. Live Auto-Sync for Student Terminal (`student-terminal-view.tsx`)
- Added real-time event listeners for `TIME_TRAVEL_EVENT`, cross-tab storage, and `subscribeToSync('workstations')`.
- When time-travel occurs or schedules change, the student terminal automatically re-queries `getTerminalContext` and updates without requiring a manual browser refresh.

---

## 3. Verification & Results

1. **Browser Subagent Test**:
   - Clicked `PC-02` on `/computer-lab`: Drawer opened on `ISSUES` tab (3 active issues).
   - Switched to `SPECS` tab: Remained on `SPECS` past the 4-second auto-sync threshold without flapping back.
   - Switched to `SEATING` tab: Remained on `SEATING` without tab hijacking.
   - Navigated to `/terminal/PC-01`:
     - Active Practical Routine: `CRM-10 - Computer Repair` (Class 10).
     - Teacher: `Er. Anish Karki`.
     - Enrolled Student: `Amrit Bahadur Thapa (Roll 1)` from Class 10.
     - Confirmed zero mismatch with Class 11.
2. **TypeScript Strict Verification**:
   - `npx tsc --noEmit` passed with 0 compile or type errors.
