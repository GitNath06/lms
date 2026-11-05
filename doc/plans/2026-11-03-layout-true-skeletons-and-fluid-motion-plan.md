
# 1:1 Layout-True Skeletons & Fluid Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate jarring visual flashes, blank loading screens, and Cumulative Layout Shift (CLS) across all primary laboratory routes by engineering pixel-accurate 1:1 structural skeletons matching the exact background grid layouts, powered by a hardware-accelerated 60 FPS metallic specular shimmer engine and smooth view transitions.

**Architecture:**
1. **Hardware-Accelerated 60 FPS Shimmer Engine (`app/globals.css` & `components/ui/skeleton.tsx`)**: Strictly animates `transform: translateX(...)` on an `::after` pseudo-element with `will-change: transform`. Never animates `background-position` or `width`, and avoids stacking `backdrop-blur` on repeated grid cells to ensure 60 FPS performance on integrated school lab GPUs.
2. **1:1 Structural Background Skeletons**:
   - **Dashboard (`/`)**: 3 standalone KPI cards (~76px, `grid-cols-3`), Live Practical Cockpit ribbon (`~148px`), segmented tabs, and matching Quick Operations card (~76px) in an 8/4 grid.
   - **Timetable (`/schedules`)**: 8-period horizontal columns (`10:00-10:45` to `03:10-03:50` + recess break) across Sunday–Friday rows with top toolbar.
   - **Computer Lab (`/computer-lab`)**: Matches production `image_2ca003.png`:
     - Header Row: Title (`Floor Plan & Live Cockpit`) + 3-button mode switcher pill (`Live Session Cockpit | Baseline Seating | Projector View`).
     - 4-Column Top KPI Row (`grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3`): Exactly 4 KPI cards (`Total Stations`, `Operational`, `Flagged Issues`, `Under Repair` at ~76px).
     - Full-Width Live Cockpit Ribbon (`~110px` height): Single full-width rounded bar above canvas.
     - Full-Width Dual-Wing CAD Canvas (Zero Right Sidebar): Left Wing (4 cols x 4 rows) + Center Aisle Gap + Right Wing (4 cols x 4 rows) + Teacher Podium + Floating HUD & Radar Minimap.
   - **Practical Logbook (`/records`)**: 3 metric cards (~76px) + search & filter bar + 8-row table matching production column widths.
   - **Incidents & Maintenance (`/maintenance` & `/records/incidents`)**: Diagnostics Workbench tab bar + asset fault cards.
   - **Admin Control (`/admin`)**: 4-module sub-navigation tab bar and surface skeleton.
   - **Daily Lab Report (`/print/records`)** & **User Profile (`/profile`)**: Dedicated layout-true skeletons.
3. **Double-Flash Elimination**: Reusable skeleton components in `components/ui/skeleton-loader.tsx` are shared between `app/(dashboard)/*/loading.tsx` AND internal client component `isLoading` / `!mounted` fallbacks.
4. **Complete Sidebar Route Coverage**: Every single route in the sidebar navigation has its own dedicated `loading.tsx` so Next.js never falls back to the parent `/` Dashboard skeleton.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict mode, Tailwind CSS, Lucide React.

---

## Global Constraints

- **Rule #1**: Never put literal `+` inside button or action text (use `<Plus className="h-4 w-4" />` with a space).
- **Rule #7**: Never apply `backdrop-blur-*` to repeated card grids or list items; reserve backdrop-filter strictly for sticky headers or modals; use `.glass-card`.
- **Rule #8**: Strict TypeScript verification: every task must pass `npx tsc --noEmit` with 0 errors.
- **Rule #10**: High-density card pattern: zero card-in-card nesting for metrics. KPI cards are standalone top-level `.glass-card` elements (~76px total height).
- **Rule #11**: Continuous command center layout symmetry: Left column `lg:col-span-8` (KPI cards, Cockpit, Session feed), Right column `lg:col-span-4` (Quick Operations ~76px, Facility Telemetry, Incidents).
- **Zero Backend Mutation**: Do not alter database schemas, Server Action RPC queries, or session cookies in this task.

---

## Review Focus

1. **True 0px Cumulative Layout Shift (CLS)**: Skeletons must exactly match real component heights, margins, and grid column configurations (verified by DOM bounding rects).
2. **Double-Flash Elimination**: Client workspace components must import and render the exact same skeleton component used in `loading.tsx` during initial hydration.
3. **Sidebar Route Isolation**: Clicking `/computer-lab`, `/schedules`, `/records`, `/maintenance`, `/admin`, or `/profile` must render its dedicated skeleton immediately.
4. **Hardware-Accelerated 60 FPS Sweep**: Shimmer animation must exclusively use `transform: translateX` with no layout reflow triggers.
5. **Reduced Motion Accessibility**: Respects `@media (prefers-reduced-motion: reduce)` with a static gentle opacity pulse.

---

## Task Decomposition

### Task 1: Hardware-Accelerated 60 FPS Shimmer Engine & Base Skeleton

**Files:**
- Modify: `app/globals.css`
- Modify: `components/ui/skeleton.tsx`

**Description:**
Implement the metallic specular shimmer strictly using `transform: translateX(...)` on an `::after` pseudo-element with `will-change: transform`. Avoid layout reflows, avoid animating width or background position, and ensure smooth 60 FPS rendering on integrated GPUs.

**Steps:**
- [ ] **Step 1.1**: Define `@keyframes shimmer-sweep` in `app/globals.css` with `transform: translateX(-100%)` to `transform: translateX(100%)`.
- [ ] **Step 1.2**: Update `components/ui/skeleton.tsx` to use the hardware-accelerated `::after` specular sheen overlay with dark/light gradients.
- [ ] **Step 1.3**: Add `@media (prefers-reduced-motion: reduce)` fallback in `app/globals.css`.
- [ ] **Step 1.4**: Add `.page-fade-in` utility for 150ms opacity crossfade transitions.
- [ ] **Step 1.5**: Run `npx tsc --noEmit` and verify 0 errors.

---

### Task 2: Reusable 1:1 Dashboard Skeleton & Double-Flash Elimination

**Files:**
- Modify: `components/ui/skeleton-loader.tsx` (export `DashboardSkeleton`)
- Modify: `app/(dashboard)/loading.tsx`
- Modify: `app/(dashboard)/page.tsx:290-295`

**Description:**
Build `DashboardSkeleton` matching the exact 8/4 command center layout:
- Top Greeting line (`h-9 w-64 rounded-xl`).
- Left Column (`lg:col-span-8`):
  - 3 standalone KPI cards in `grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3` (exact 76px height).
  - Live Practical Cockpit ribbon (`h-[148px] rounded-2xl`).
  - Sliding Segmented Tabs bar (`Upcoming`, `Backlog`, `Completed`, `All`) + 3 session feed items.
- Right Column (`lg:col-span-4`):
  - Quick Operations card (~76px height matching the left KPI row).
  - Facility Telemetry card with 4 room badges.
  - Incident Registry card.
Share this identical `DashboardSkeleton` in both `app/(dashboard)/loading.tsx` and `app/(dashboard)/page.tsx` (`if (!mounted) return <DashboardSkeleton />`).

**Steps:**
- [ ] **Step 2.1**: Rewrite `DashboardSkeleton` in `components/ui/skeleton-loader.tsx` with exact 76px KPI heights, 148px cockpit ribbon, and 8/4 grid.
- [ ] **Step 2.2**: Update `app/(dashboard)/loading.tsx` to render `<DashboardSkeleton />`.
- [ ] **Step 2.3**: Update `app/(dashboard)/page.tsx` pre-hydration check to render `<DashboardSkeleton />`.
- [ ] **Step 2.4**: Run `npx tsc --noEmit` and verify 0 errors.

---

### Task 3: Reusable 1:1 Schedules Timetable Canvas Skeleton

**Files:**
- Modify: `components/ui/skeleton-loader.tsx` (export `TimetableSkeleton`)
- Modify: `app/(dashboard)/schedules/loading.tsx`
- Modify: `app/(dashboard)/schedules/page.tsx:16-24`
- Modify: `components/schedules/advanced-calendar.tsx`

**Description:**
Build `TimetableSkeleton` matching the real 8-period horizontal timetable canvas:
- Top Toolbar: Lab selector dropdown, view mode pills, Precaution Active toggle, date filter.
- Timetable Header: Day column + 8 Period Columns (`10:00-10:45` to `03:10-03:50` + recess break).
- 6 Day Rows: Sunday through Friday with wireframe slot outlines matching real session card bounds.
Share this identical `TimetableSkeleton` in both `app/(dashboard)/schedules/loading.tsx` and `schedules/page.tsx` fallback.

**Steps:**
- [ ] **Step 3.1**: Create `TimetableSkeleton` in `components/ui/skeleton-loader.tsx` matching `advanced-calendar.tsx`.
- [ ] **Step 3.2**: Update `app/(dashboard)/schedules/loading.tsx` to render `<TimetableSkeleton />`.
- [ ] **Step 3.3**: Replace `"Loading Timetable Canvas..."` fallback in `app/(dashboard)/schedules/page.tsx` with `<TimetableSkeleton />`.
- [ ] **Step 3.4**: Run `npx tsc --noEmit` and verify 0 errors.

---

### Task 4: Reusable 1:1 Computer Lab CAD Floor & Cockpit Skeleton (Matching `image_2ca003.png`)

**Files:**
- Create: `app/(dashboard)/computer-lab/loading.tsx`
- Modify: `components/ui/skeleton-loader.tsx` (export `ComputerLabSkeleton`)
- Modify: `components/computer-lab/computer-lab-workspace.tsx`

**Description:**
Build `ComputerLabSkeleton` strictly adhering to the real production layout of `image_2ca003.png`:
- Header Row: Title (`Floor Plan & Live Cockpit`) + 3-button mode switcher pill (`Live Session Cockpit | Baseline Seating | Projector View`).
- 4-Column Top KPI Row (`grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3`): Exactly 4 KPI cards (`Total Stations`, `Operational`, `Flagged Issues`, `Under Repair` at ~76px).
- Full-Width Live Cockpit Ribbon (`~110px` height): Single full-width rounded bar above canvas.
- Full-Width Dual-Wing CAD Canvas (NO Right Sidebar!):
  - Left Wing: 4 columns x 4 rows monitor grid (16 nodes).
  - Center Aisle gap.
  - Right Wing: 4 columns x 4 rows monitor grid (16 nodes).
  - Teacher podium anchor on front left.
  - Floating HUD controls placeholder (bottom-left).
  - Radar Minimap box placeholder (bottom-right).
Create `app/(dashboard)/computer-lab/loading.tsx` and share `ComputerLabSkeleton` inside `computer-lab-workspace.tsx` for client loading.

**Steps:**
- [ ] **Step 4.1**: Build `ComputerLabSkeleton` in `components/ui/skeleton-loader.tsx` matching the dual-wing monitor nodes, 4 KPI cards, and full-width cockpit.
- [ ] **Step 4.2**: Create `app/(dashboard)/computer-lab/loading.tsx` rendering `<ComputerLabSkeleton />`.
- [ ] **Step 4.3**: Connect `ComputerLabSkeleton` to `computer-lab-workspace.tsx` loading state.
- [ ] **Step 4.4**: Run `npx tsc --noEmit` and verify 0 errors.

---

### Task 5: Complete Sidebar Route Coverage (Records, Maintenance, Incidents, Admin, Profile)

**Files:**
- Create/Modify: `app/(dashboard)/records/loading.tsx`
- Create/Modify: `app/(dashboard)/records/incidents/loading.tsx`
- Create/Modify: `app/(dashboard)/maintenance/loading.tsx`
- Create/Modify: `app/(dashboard)/admin/loading.tsx`
- Create/Modify: `app/(dashboard)/profile/loading.tsx`
- Modify: `components/ui/skeleton-loader.tsx` (export `LogbookSkeleton`, `MaintenanceSkeleton`, `AdminSkeleton`, `ProfileSkeleton`)

**Description:**
Ensure every single route in the sidebar navigation has a dedicated `loading.tsx` to eliminate parent dashboard fallback flashing.
- `/records`: Header, 3 KPI metric tiles (~76px), search & filter bar, 8-row table skeleton matching exact column widths (`LogbookSkeleton`).
- `/records/incidents` & `/maintenance`: Diagnostics Workbench tab bar + asset fault cards (`MaintenanceSkeleton`).
- `/admin`: Tab bar mirroring 4 administrative modules (`AdminSkeleton`).
- `/profile`: User identity card + credentials security card (`ProfileSkeleton`).

**Steps:**
- [ ] **Step 5.1**: Build `LogbookSkeleton`, `MaintenanceSkeleton`, `AdminSkeleton`, and `ProfileSkeleton` in `components/ui/skeleton-loader.tsx`.
- [ ] **Step 5.2**: Update/create `loading.tsx` in `app/(dashboard)/records/`, `app/(dashboard)/records/incidents/`, `app/(dashboard)/maintenance/`, `app/(dashboard)/admin/`, and `app/(dashboard)/profile/`.
- [ ] **Step 5.3**: Run `npx tsc --noEmit` and verify 0 errors.

---

### Task 6: Visual CLS Audit, TypeScript Verification & Task Documentation

**Files:**
- Modify: `doc/tasks/README.md`
- Create: `doc/tasks/2026-11-03-task-99-layout-true-skeletons-and-fluid-motion.md`

**Description:**
Perform a visual audit across all sidebar routes, verify 0px Cumulative Layout Shift (CLS), verify `npx tsc --noEmit` exits with 0 errors, run regression test suites, and record Task 99 documentation.

**Steps:**
- [ ] **Step 6.1**: Run `npx tsc --noEmit` to guarantee 0 errors.
- [ ] **Step 6.2**: Run test suites:
  - `tests/phase1-student-terminal.test.mjs`
  - `tests/terminal-agent-handshake.test.mjs`
- [ ] **Step 6.3**: Verify in browser that clicking between `/`, `/schedules`, `/computer-lab`, `/records`, `/maintenance`, `/admin`, and `/profile` displays dedicated 1:1 skeletons with smooth crossfades and zero layout shift.
- [ ] **Step 6.4**: Create `doc/tasks/2026-11-03-task-99-layout-true-skeletons-and-fluid-motion.md`.
- [ ] **Step 6.5**: Update master index in `doc/tasks/README.md`.
