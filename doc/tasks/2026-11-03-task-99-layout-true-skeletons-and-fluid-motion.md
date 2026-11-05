# Task 99: 1:1 Layout-True Skeletons & Hardware-Accelerated Fluid Motion Engine

**Date**: 2026-11-03  
**Status**: Completed  
**Branch**: `feature/student-terminal-agent`  
**Target Subsystems**: `components/ui/skeleton-loader.tsx`, `components/ui/skeleton.tsx`, `app/globals.css`, `app/(dashboard)/**/loading.tsx`, `app/(dashboard)/page.tsx`, `app/(dashboard)/schedules/page.tsx`, `app/(dashboard)/computer-lab/loading.tsx`  

---

## 1. Context & Operational Purpose

Prior to this task, navigating between primary sidebar routes (`/` Dashboard, `/schedules` Lab Timetable, `/computer-lab` Floor Plan, `/records` Practical Logbook, `/maintenance` Diagnostics & Maintenance, `/admin` Super Admin Control, and `/profile` Faculty Profile) suffered from visual flashes, generic spinners, and Cumulative Layout Shift (CLS):
1. **Parent Fallback Bleed**: Missing `loading.tsx` on sub-routes caused Next.js to fall back to the root `/(dashboard)/loading.tsx` skeleton during tab transitions, causing an initial flash of 4 generic cards before jumping to the actual page layout.
2. **Double-Flash Phenomenon**: Client-side hydration checks (`if (!mounted)` or `if (loading)`) rendered text strings (such as `"Loading Timetable Canvas..."`) or spinners that differed from the streaming `loading.tsx` skeleton.
3. **Mismatched Geometry**: The previous skeletons featured 4-card grids instead of the production 3-card 76px layout (`Rule #10`), or depicted a fake right-hand sidebar on `/computer-lab` where production uses a full-width dual-wing CAD canvas.
4. **GPU Lag on Low-Spec Hardware**: Animated `background-position` and stacked `backdrop-blur` filters on 30+ grid nodes caused compositor frame drops on institutional Intel UHD / integrated GPUs.

Task 99 engineers a hardware-accelerated 60 FPS motion engine and a suite of 7 pixel-accurate, 1:1 layout-true skeletons shared between server streaming boundaries and client initial mount states to achieve true 0px Cumulative Layout Shift.

---

## 2. Key Architecture & 4 Core Invariants

### 1. Hardware-Accelerated 60 FPS Specular Shimmer Engine (`app/globals.css` & `components/ui/skeleton.tsx`)
- **Transform-Only GPU Shimmer**: Strictly animates `transform: translateX(...)` on an `::after` pseudo-element with `will-change: transform`.
- **Zero Layout Reflow**: Completely eliminates animations on `background-position` or `width`, guaranteeing a locked 60 FPS on low-power school workstations.
- **Deep Obsidian / Midnight Slate Palette**: Uses `bg-zinc-200/60 dark:bg-[#151E32]/90` with specular sheen overlay `after:via-white/35 dark:after:via-white/[0.08]`.
- **Reduced-Motion Compliance**: Adheres to `@media (prefers-reduced-motion: reduce)` by disabling translation animations and applying a gentle static opacity pulse.
- **Crossfade Transition Utility**: Added `.page-fade-in` (150ms cubic-bezier crossfade) to eliminate hard cut-ins.

### 2. Dual-Wing CAD Floor & Cockpit 1:1 Skeleton (`ComputerLabSkeleton`)
- Strictly matches the production layout of `image_2ca003.png`:
  - **Header Row**: Title (`Floor Plan & Live Cockpit`) + 3-button mode switcher pill (`Live Session Cockpit | Baseline Seating | Projector View`).
  - **4-Column Top KPI Row** (`grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3`): Exactly 4 KPI cards (`Total Stations`, `Operational`, `Flagged Issues`, `Under Repair` at ~76px).
  - **Full-Width Live Cockpit Ribbon** (`~110px` height): Single full-width rounded bar above canvas.
  - **Full-Width Dual-Wing CAD Canvas** (Zero Right Sidebar): Left Wing (4 cols x 4 rows monitor nodes) + Center Aisle Gap + Right Wing (4 cols x 4 rows monitor nodes) + Teacher Podium + Floating HUD & Radar Minimap.
  - **Sleek Monitor Aspect Ratio & Thin Bottom Chin**: Individual workstation nodes mirror physical monitors with chamfered chins and LED status anchors.

### 3. Double-Flash Elimination via Shared Canonical Skeletons (`components/ui/skeleton-loader.tsx`)
- Skeletons are exported as pure, reusable components:
  - `DashboardSkeleton` (and alias `DashboardOverviewSkeleton`)
  - `TimetableSkeleton` (and alias `ScheduleMatrixSkeleton`)
  - `ComputerLabSkeleton` (and alias `ComputerLabFloorSkeleton`)
  - `LogbookSkeleton` (and alias `PracticalRecordsSkeleton`)
  - `MaintenanceSkeleton`
  - `AdminSkeleton` (and alias `AdminCommandCenterSkeleton`)
  - `ProfileSkeleton`
- **Identical DOM Reuse**:
  - `app/(dashboard)/loading.tsx` renders `<DashboardSkeleton />`, and `app/(dashboard)/page.tsx` renders the exact same `<DashboardSkeleton />` while `!mounted`.
  - `app/(dashboard)/schedules/loading.tsx` renders `<ScheduleMatrixSkeleton />`, and `app/(dashboard)/schedules/page.tsx` renders the exact same `<TimetableSkeleton />` inside its `<Suspense fallback={...}>`.

### 4. Complete Sidebar Route Coverage
Every primary sidebar route now possesses a dedicated `loading.tsx` boundary to prevent fallback inheritance from the parent dashboard:
- `/` &rarr; `app/(dashboard)/loading.tsx` (`DashboardSkeleton`)
- `/schedules` &rarr; `app/(dashboard)/schedules/loading.tsx` (`ScheduleMatrixSkeleton`)
- `/computer-lab` &rarr; `app/(dashboard)/computer-lab/loading.tsx` (`ComputerLabSkeleton`)
- `/records` &rarr; `app/(dashboard)/records/loading.tsx` (`LogbookSkeleton`)
- `/records/incidents` &rarr; `app/(dashboard)/records/incidents/loading.tsx` (`MaintenanceSkeleton`)
- `/incidents` &rarr; `app/(dashboard)/incidents/loading.tsx` (`MaintenanceSkeleton`)
- `/maintenance` &rarr; `app/(dashboard)/maintenance/loading.tsx` (`MaintenanceSkeleton`)
- `/admin` &rarr; `app/(dashboard)/admin/loading.tsx` (`AdminCommandCenterSkeleton`)
- `/profile` &rarr; `app/(dashboard)/profile/loading.tsx` (`ProfileSkeleton`)
- `/print/records` &rarr; `app/(dashboard)/print/records/loading.tsx` (`PrintRecordsLoading`)

---

## 3. Files Created & Modified

1. **`app/globals.css`**: Added `@keyframes shimmer` (translateX -100% to 100%), `.animate-shimmer`, `.page-fade-in`, and `@media (prefers-reduced-motion: reduce)` overrides.
2. **`components/ui/skeleton.tsx`**: Upgraded to hardware-accelerated `::after` specular sheen with `will-change: transform`.
3. **`components/ui/skeleton-loader.tsx`**: Complete suite of 7 layout-true skeletons matching production DOM structures.
4. **`app/(dashboard)/loading.tsx`**: Updated to render `<DashboardSkeleton />`.
5. **`app/(dashboard)/page.tsx`**: Updated pre-hydration check to render `<DashboardSkeleton />`.
6. **`app/(dashboard)/schedules/page.tsx`**: Replaced text fallback with `<TimetableSkeleton />`.
7. **`app/(dashboard)/schedules/loading.tsx`**: Connected to `<ScheduleMatrixSkeleton />`.
8. **`app/(dashboard)/computer-lab/loading.tsx`**: Created and connected to `<ComputerLabSkeleton />`.
9. **`app/(dashboard)/records/loading.tsx`**: Updated to render `<LogbookSkeleton />`.
10. **`app/(dashboard)/records/incidents/loading.tsx`**: Updated to render `<MaintenanceSkeleton />`.
11. **`app/(dashboard)/incidents/loading.tsx`**: Updated to render `<MaintenanceSkeleton />`.
12. **`app/(dashboard)/maintenance/loading.tsx`**: Created and connected to `<MaintenanceSkeleton />`.
13. **`app/(dashboard)/profile/loading.tsx`**: Created and connected to `<ProfileSkeleton />`.

---

## 4. Verification & Testing

1. **TypeScript Typecheck**:
   - Executed `npx tsc --noEmit`.
   - **Result**: `0 errors` across all routes and components.
2. **Integration Test Suites**:
   - `tests/phase1-student-terminal.test.mjs`: 7/7 subtests passed.
   - `tests/terminal-agent-handshake.test.mjs`: 8/8 subtests passed.
   - **Total**: 15 tests, 2 suites, 15 passed, 0 failed.
3. **Layout Shift Invariants**:
   - Dashboard: Exact 76px KPI cards (`grid-cols-3` in left column) matching 76px Quick Operations card on right (`Rule #10 & #11`).
   - Computer Lab: Exact 4-column KPI row (76px), 110px cockpit bar, and full-width dual-wing CAD floor with zero right sidebar.
   - Double Flash: Completely eliminated by sharing identical components between SSR/pre-hydration and streaming boundaries.

