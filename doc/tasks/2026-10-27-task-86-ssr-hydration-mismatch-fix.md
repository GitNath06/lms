# Task 86: Fix Timetable Slot Select SSR Hydration Mismatch

**Date**: 2026-10-27  
**Category**: Bug Fix & SSR / Client Hydration Hardening  
**Target Files**:
- `app/(dashboard)/computer-lab/page.tsx`
- `components/computer-lab/computer-lab-workspace.tsx`
- `doc/tasks/README.md`

---

## 1. Problem Root Cause

When loading `/computer-lab`, Turbopack raised a `Recoverable Error: Hydration failed because the server rendered text didn't match the client`:
```
<option
  value="m-1792851174758"
- disabled=""
>
+ {"✓ "}
```
at `components/computer-lab/computer-lab-workspace.tsx (1725:29)`.

### Root Cause:
1. **Server-Side Render (SSR)**: The server rendered `ComputerLabPage` using real wall-clock server time, where either no routine sessions were scheduled or different sessions were active for the day. `todaySessions.length === 0` rendered `<option value="" disabled>No scheduled sessions today</option>`.
2. **Client-Side Hydration**: On the client's initial render, `useState<Date>(() => getEffectiveDate())` executed in the browser, reading simulated dev time from `localStorage` (`lmr_simulated_time`). Because simulated time pointed to an active routine session period, `todaySessions` had entries, rendering `<option value="m-1792851174758">✓ ...</option>`.
3. **Hydration Conflict**: React detected the mismatch between the server-rendered HTML and client initial DOM.

---

## 2. Solution Implemented

1. **Server & Client Time Synchronization (`getServerEffectiveTime`)**:
   - In [`app/(dashboard)/computer-lab/page.tsx`](file:///d:/Projects/LMR/app/(dashboard)/computer-lab/page.tsx), called `getServerEffectiveTime()` (which reads the synchronized `lmr_simulated_time` cookie).
   - Passed `initialServerTimeIso={serverTime.effectiveDate.toISOString()}` as a prop to [`ComputerLabWorkspace`](file:///d:/Projects/LMR/components/computer-lab/computer-lab-workspace.tsx).
   - Initialized `effectiveDate` from `initialServerTimeIso` so both the server and initial client render share the exact same timestamp.

2. **Hydration Guard on `<Select>` Options**:
   - Added `!isMounted` guard to the `<Select>` timetable options. Before mounting, both SSR and initial client hydration render matching placeholder states.
   - Synchronized simulated time and `isMounted` state in `useEffect`, which runs strictly post-hydration.
   - Attached `suppressHydrationWarning` to the `<Select>` component to protect against interval tick variations.

---

## 3. Verification

- `npx tsc --noEmit` &rarr; **0 errors**.
- `tests/unit-domain-invariants.test.mjs` &rarr; **12/12 passing** (100% success).
