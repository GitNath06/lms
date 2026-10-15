# Task 27: Cockpit Triage Redesign & Cross-Tab Auto-Sync

**Date**: 2026-10-12  
**Status**: Completed  
**Subsystems**: `/computer-lab`, `components/computer-lab/displaced-students-queue.tsx`, `components/computer-lab/computer-lab-workspace.tsx`

---

## 1. Problem Statement & User Friction

1. **Unassigned Student Blindspot after Station Deletion**:
   - When a workstation (e.g. `PC-09`) was deleted from CAD Floor Architect, the assigned student lost their workstation allocation and became unseated.
   - In Live Cockpit mode, the triage bar only tracked faulted workstations from existing seat plan entries. Students in the session roster with no workstation allocated were completely omitted, forcing instructors to manually switch to Baseline Seating to detect unassigned students.

2. **Stale Live Cockpit State on Tab Switch**:
   - When an instructor assigned an unseated student to an available PC (e.g. `PC-20`) in Baseline Seating (or via auto-assign), switching back to "Live Session Cockpit" failed to update the floor plan or session context.
   - `prevPeriodKeyRef.current` skipped re-fetching, and `getWorkstationBoardData` was not re-fetched, leaving the newly assigned workstation looking empty until a hard browser reload (F5).

3. **Bulky AI-Generated Status Bar UI**:
   - The original triage bar used a bulky container with amber gradients, heavy padding, and inconsistent typography that cluttered the cockpit.
   - Dropdown options displayed misleading arrow formatting that appeared like literal `+` symbols (`+ PC-20 (Empty & Operational)`).

---

## 2. Key Architecture Decisions & Implementations

### A. High-Density Institutional Triage Micro-Strip (`DisplacedStudentsQueue`)
- **Compact Profile**: Redesigned from a bulky card into a precision ~32px micro-strip (`h-8`, `bg-[#101726]/95 border border-white/10 dark:border-white/15 rounded-lg px-3`).
- **Support for Both Faulted & Unassigned Students**:
  - `faulted`: Displays faulted station and fault summary (e.g., `PC-07: Power Supply`). Button: `Relocate`.
  - `unassigned`: Displays `Needs workstation allocation`. Button: `Assign Station`.
- **Multi-Student Pager**: For queues with $\le 4$ students, renders neat pill buttons (`R-7 · PC-07`, `R-9 · Unseated`). For queues with $> 4$ students, renders a compact chevron pager with a dropdown selector (`1/N: Roll X`), eliminating horizontal overflow.
- **Rule 1 Compliance**: Purged all literal `+` or arrow artifacts from station select options (formatted cleanly as `PC-20 · Available` or `PC-25 · Vacant — Absent: <Name>`).

### B. Full Triage Memo Enhancement (`displacedStudents`)
- In `components/computer-lab/computer-lab-workspace.tsx`:
  - Iterates over `sessionContext.seatPlan` to identify students seated at broken/under-repair PCs (`type: 'faulted'`).
  - Iterates over `sessionContext.expectedRoster` to identify active enrolled students who have no valid assigned workstation (`type: 'unassigned'`).
  - Honors attendance: students marked absent (`sessionAttendance[rollNumber] === false`) do not clutter the relocation queue.

### C. Comprehensive Real-Time State Synchronization (`refreshLiveSessionAndBoard`)
- Added centralized synchronizer `refreshLiveSessionAndBoard()` that simultaneously refreshes `getWorkstationBoardData` and `getLiveSessionContext`.
- Added `handleSwitchMode('live' | 'baseline')` on mode buttons to guarantee fresh data on tab switch.
- Auto-triggered `refreshLiveSessionAndBoard()` across all baseline seat modification workflows:
  - `handleAssignStudentToStation` (manual baseline assignment & modal assignment)
  - `handleAssignReplacement` (temporary session relocation & initial seat allocation)
  - `autoAssignRemainingSeats` (top bar and tray auto-assign)
  - `clearSeatAssignment` / `handleClearAllSeats` (unseating students)
- Updated `useEffect` to detect mode transitions into `'live'` (`modeJustSwitchedToLive`) so live session context re-fetches immediately without requiring F5 reload.

---

## 3. Verification & Compliance
- **TypeScript Strict Mode**: Passed `npx tsc --noEmit` with 0 errors.
- **Node.js Test Suite**: Passed all 23 tests across:
  - `tests/temporary-relocation-and-terminal.test.mjs`
  - `tests/floor-plan-status-sync.test.mjs`
  - `tests/unified-session-modal-and-standby-cockpit.test.mjs`
- **Visual Browser Verification**: Confirmed sleek 32px triage micro-strip, interactive student switching, and instantaneous tab switching without browser refresh.
