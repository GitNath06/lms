# Task 83: Notification Panel Z-Index Overlap Fix, Collapsible Right-Side Canvas Dock, 15-Minute Standby Window, Ad-Hoc Collision Repair, Workstation Deduplication & Pure Projector Fullscreen

**Date**: 2026-10-27  
**Status**: Completed  
**Author**: Antigravity Assistant  
**Subsystems Involved**: Notification Panel (`components/layout/notification-bell.tsx`, `app/(dashboard)/layout.tsx`), CAD Canvas HUD & Viewport (`components/computer-lab/canvas-controls-hud.tsx`, `hooks/use-canvas-viewport.ts`), Workstation Layout Engine (`lib/workstations/layout-engine.ts`), Scheduling Conflict Engine (`lib/scheduling/conflict-engine.ts`), Ad-Hoc Modal (`components/computer-lab/start-adhoc-session-modal.tsx`), Cockpit Bar & Workspace (`components/computer-lab/computer-lab-workspace.tsx`, `components/computer-lab/live-cockpit-bar.tsx`), Projector Screen (`components/computer-lab/projector-view.tsx`, `app/(dashboard)/computer-lab/projector/page.tsx`).

---

## 1. Executive Summary & Root Cause Analysis

### Issue 1: Canvas HUD Bar Overlapped the Notification Panel
- **Root Cause**: In `app/(dashboard)/layout.tsx`, `<header>` was set to `z-20`, trapping the `NotificationBell` dropdown inside the header's `z-20` stacking context. Meanwhile, `CanvasControlsHud` inside `<main>` was configured with `z-30`/`z-40`, causing it to render directly above the header's notification dropdown.
- **Resolution**:
  - Upgraded `<header>` in `app/(dashboard)/layout.tsx` from `z-20` to `z-40`.
  - Confirmed `NotificationBell` panel popover uses `z-50`.
  - Re-anchored `CanvasControlsHud` to `z-10` on the right side of the canvas.
  - Deleted the redundant floating green `"● LIVE SESSION ACTIVE"` capsule from the top center of the 2D canvas in `computer-lab-workspace.tsx`.

### Issue 2: Canvas HUD In-Canvas Clutter & Broken Fit / 1:1
- **Root Cause**: The horizontal floating HUD was placed along the top edge of the canvas, obstructing student nodes and overlapping header dropdowns. The `fitToScreen()` and `resetZoom()` methods in `use-canvas-viewport.ts` lacked auto-centering for the canonical 1360x780 stage.
- **Resolution**:
  - Redesigned `CanvasControlsHud` into a collapsible vertical dock on the right edge (`absolute right-3 top-3 z-10 flex flex-col items-end gap-1.5`).
  - Added a toggle button with current zoom percentage that expands the vertical toolbar on demand.
  - Upgraded `fitToScreen()` to compute `scale = Math.min((rect.width - 48) / 1360, (rect.height - 48) / 780)` and calculate the exact center offset.
  - Upgraded `resetZoom()` (1:1) to reset zoom to `1.0` and center the stage.
  - Added variable PC card size stepper (75% to 130%, step 5%) compliant with Rule 1 (zero literal `+` in button labels, using `<Plus>` / `<Minus>` icons).

### Issue 3: Duplicate Ghost Cards Stacked at Row 5 Col 4 (PC-20 / "Kismat Khatri")
- **Root Cause**: Multiple workstations shared identical or colliding `(pos_x, pos_y)` coordinates (e.g. falling back to slot 20 at E4), causing multiple workstation cards to render on top of each other.
- **Resolution**:
  - Implemented `deduplicateWorkstationCoordinates` in `lib/workstations/layout-engine.ts`.
  - For each station, checks if any existing station is within 3% distance (`Math.hypot(p.x - ws.pos_x, p.y - ws.pos_y) < 3`).
  - If a collision occurs, dynamically moves the colliding workstation to its natural canonical slot number (e.g., PC-N -> Slot N) or the next free canonical grid slot.
  - Applied `renderedWorkstations = deduplicateWorkstationCoordinates(boardData.workstations)` across `computer-lab-workspace.tsx` and `projector-view.tsx`.

### Issue 4: "Starts in 847m" Flashing & Midnight Off-Hours Display
- **Root Cause**: At off-hours/midnight (00:18), the next upcoming session (COA-11 at 14:25) was 847 minutes away ($14\text{h }25\text{m} - 0\text{h }18\text{m} = 847\text{m}$). Client-side state also briefly flashed local midnight time before hydrating simulated time.
- **Resolution**:
  - Initialized `effectiveDate` synchronously in `computer-lab-workspace.tsx` with `useState<Date>(() => getEffectiveDate())`.
  - Enforced the 15-minute upcoming standby window rule: a scheduled session is only considered an "Upcoming Session" if `0 < minutesUntilStart <= 15`.
  - If no session is live and no session starts within 15 minutes, the lab renders the clean **Lab Available (Standby Mode)** bar (`"● No active session running right now"`) with the prominent "Start Unscheduled Session" button.
  - In `live-cockpit-bar.tsx`, only displays `"Starts in Xm"` if `startsIn <= 15`. Otherwise displays `"Starts at HH:mm"`.

### Issue 5: Start Unscheduled Session False Period T2 Collision Bug
- **Root Cause**:
  1. `start-adhoc-session-modal.tsx` hardcoded default `startTime` to `10:00 AM` and `endTime` to `11:00 AM` (which overlaps Period T2 at 10:10 AM) instead of reading current time.
  2. `lib/scheduling/conflict-engine.ts` compared raw strings (`params.startTime < existing.end_time`), causing afternoon times (e.g. `02:00 PM`) to falsely collide with morning classes (e.g. `10:10 AM`), and checked `slot_id === 't2'` if a default slot was present.
- **Resolution**:
  - Updated `start-adhoc-session-modal.tsx` to initialize `startTime` dynamically to current time (HH:mm from `getEffectiveDate()`) and `endTime` to `+45m`.
  - Upgraded `conflict-engine.ts` with `normalizeTimeToMinutes(t)` which parses 12h/24h AM/PM strings to numerical minutes from midnight.
  - Updated `timeRangesOverlap` to compare numerical minutes from midnight.
  - Updated `hasOverlap` to prioritize `timeRangesOverlap` whenever custom `startTime` and `endTime` are provided, ensuring afternoon ad-hoc sessions are never blocked by morning timetable periods.

### Issue 6: Projector View Pure Fullscreen Canvas Only
- **Root Cause**: `/computer-lab/projector` was rendering redundant headers, KPI strips, footers, and legends, cluttering large projection screens.
- **Resolution**:
  - Completely stripped top header, footer, legends, and status pills from `ProjectorView`.
  - Set container to `fixed inset-0 z-[100] w-screen h-screen overflow-hidden bg-slate-900 dark:bg-[#070A12] flex items-center justify-center select-none`.
  - Automatically triggers browser fullscreen on mount via `document.documentElement.requestFullscreen?.()`.
  - Added subtle hover-only controls in the top-right corner (`opacity-0 hover:opacity-100 transition-opacity`) with Fullscreen toggle and Return to Cockpit button.
  - Implemented responsive auto-scaling for the 1360x780 stage (`scale = Math.min((window.innerWidth - 24) / 1360, (window.innerHeight - 24) / 780)`), ensuring all 48 workstations fill 100% of the screen centered with zero scrollbars.
  - Applied `deduplicateWorkstationCoordinates` to prevent duplicate nodes.

---

## 2. Key Files Modified & Created

| File | Changes Made |
| :--- | :--- |
| `app/(dashboard)/layout.tsx` | Upgraded `<header>` from `z-20` to `z-40` so header dropdowns render above page content. |
| `components/layout/notification-bell.tsx` | Verified `z-50` popover panel and backdrop layering. |
| `components/computer-lab/canvas-controls-hud.tsx` | Converted into collapsible vertical right-side dock (`z-10`) with variable PC size stepper (75%–130%, step 5%) and zero literal `+`. |
| `hooks/use-canvas-viewport.ts` | Expanded zoom range (0.25 to 2.0), implemented exact 1360x780 stage centering in `fitToScreen()` and `resetZoom()`. |
| `lib/workstations/layout-engine.ts` | Implemented `deduplicateWorkstationCoordinates` to detect and reposition colliding workstations. |
| `lib/scheduling/conflict-engine.ts` | Added `normalizeTimeToMinutes` for 12h/24h AM/PM parsing; upgraded `timeRangesOverlap` and `hasOverlap` collision detection. |
| `components/computer-lab/start-adhoc-session-modal.tsx` | Initialized `startTime` from current effective date and `endTime` to `+45m`. |
| `components/computer-lab/live-cockpit-bar.tsx` | Enforced 15-minute countdown threshold (`isImminent = startsIn <= 15`). |
| `components/computer-lab/computer-lab-workspace.tsx` | Removed redundant canvas `LIVE SESSION ACTIVE` green pill; integrated `renderedWorkstations`; enforced 15-minute upcoming standby window. |
| `components/computer-lab/projector-view.tsx` | Overhauled into pure fullscreen 2D floor canvas with auto-fit scaling, hover-only controls, and auto-fullscreen on mount. |
| `tests/unit-domain-invariants.test.mjs` | Added unit tests for `deduplicateWorkstationCoordinates` and afternoon vs. morning `timeRangesOverlap`. |

---

## 3. Verification & Test Evidence

1. **TypeScript Type Safety**:
   ```bash
   npx tsc --noEmit
   # Exit code: 0 (Zero type errors)
   ```

2. **Pure Domain Invariants Test Suite**:
   ```bash
   node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/unit-domain-invariants.test.mjs
   # Output:
   # tests 12
   # suites 5
   # pass 12
   # fail 0
   # duration_ms 1248.0257
   ```

---

## 4. Invariants Preserved
- **Rule 1**: Zero literal `+` in buttons (all stepper buttons use Lucide icons `<Plus className="h-3 w-3" />`).
- **Rule 2**: Academic terminology preserved ("Attendance", "Timetable", "Equipment Breakage", "Logbook").
- **Rule 5**: Zero department regressions (Role badges & assigned labs only).
- **Rule 8**: Strict TypeScript verification (0 errors).
- **Rule 17**: Triple-Collision Defense Invariant enhanced with normalized numerical minute comparisons.
- **Rule 19**: Workstation Status dynamically derived from `workstation_issues`.
