# Frontend Performance, 1:1 Layout-True Skeletons & SWR Caching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate 8–12s initial loading waterfalls, jarring Cumulative Layout Shift (CLS), and frozen page switches by implementing a consolidated Master Bootstrap RPC, pixel-accurate 1:1 layout-true skeletons for all primary views, client-side SWR caching, windowed list virtualization, and 60 FPS specular shimmer transitions.

**Architecture:** 
1. **Master Bootstrap Pattern**: Replace 9–11 fragmented Server Action waterfalls on page mount with 1 consolidated atomic database query (`getLabSyncBootstrapData()`) delivered through an in-memory `BootstrapProvider`.
2. **1:1 Layout-True Structural Skeletons**: Rebuild all `loading.tsx` and skeleton primitives to match the exact DOM grid, aspect ratio, and component heights (e.g., matching the ~76px 3-card KPI row, 8-period timetable grid, CAD room floor with minimap, and tabular data tables) so incoming data drops in with zero Cumulative Layout Shift.
3. **Hybrid SWR & Virtualization**: Client memory cache with silent background revalidation for 0ms tab navigation, paired with `@tanstack/react-virtual` for silky-smooth 60 FPS roster scrolling and server-side 25-item chunking for practical records.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict mode, `@tanstack/react-virtual`, Tailwind CSS, PostgreSQL connection pooling (`pg`), Lucide React.

**Spec:** `doc/plans/2026-11-02-comprehensive-system-audit-and-future-architecture-roadmap.md` (Sections 3, 4, and 5).

---

## Global Constraints

- **Rule #1**: Never put literal `+` inside button or action text (use `<Plus className="h-4 w-4" />` with a space).
- **Rule #7**: Never apply `backdrop-blur-*` to repeated card grids or list items; reserve backdrop-filter strictly for sticky headers or modals; use `.glass-card`.
- **Rule #8**: Strict TypeScript verification: every task must pass `npx tsc --noEmit` with 0 errors.
- **Rule #10**: High-density card pattern: zero card-in-card nesting for metrics. KPI cards are standalone top-level `.glass-card` elements (~76px total height).
- **Rule #11**: Continuous command center layout symmetry: Left column `lg:col-span-8` (KPI cards, Cockpit, Session feed), Right column `lg:col-span-4` (Quick Operations ~76px, Facility Telemetry, Incidents).
- **Rule #13**: Next.js `'use server'` RPC export rules: files in `app/actions/*` MUST ONLY export `async function`s.
- **Rule #16**: Zero shadow databases: query live PostgreSQL tables directly.

---

## Review Focus

1. **Cumulative Layout Shift (CLS)**: Skeletons must not differ in height, margin, or grid column structure from real loaded components. (Test: Verify rendered container heights match within 2px).
2. **SSR Hydration Mismatch**: In-memory bootstrap caching and skeleton fallbacks must not use client-only timestamps (`new Date()`, random IDs) during server render.
3. **Memory Leaks in SWR Cache**: Tab switching between `/schedules`, `/records`, and `/` must not create unbounded cache growth or duplicate event listener leaks.
4. **Virtualization Scroll Jump**: In 50+ student rosters, windowed virtualization must preserve scroll offset when toggling attendance or editing student roll.
5. **Database Connection Pool Starvation**: The Master Bootstrap RPC must use a single pool client transaction or parallel `Promise.all` over 1 connection rather than holding open connections indefinitely.

---

## Task Decomposition

### Task 1: Master Bootstrap RPC & In-Memory Context Provider

**Files:**
- Create: `app/actions/bootstrap.ts`
- Create: `lib/bootstrap/bootstrap-provider.tsx`
- Create: `hooks/use-bootstrap-data.ts`
- Create: `tests/bootstrap-consolidation.test.mjs`

**Description:**
Consolidate 9–11 fragmented Server Action queries fired during mount into a single high-performance RPC query `getLabSyncBootstrapData()`. Deliver results into a root-level `BootstrapProvider` that pre-warms hooks with institutional metadata (classes, subjects, facilities, time slots, calendar settings, and current user profile).

**Steps:**
- [ ] **Step 1.1**: Write automated test `tests/bootstrap-consolidation.test.mjs` verifying `getLabSyncBootstrapData()` returns consolidated payload with `labs`, `classes`, `subjects`, `periods`, `academicYears`, `calendarSettings`, and `userScope` in under 200ms.
- [ ] **Step 1.2**: Create `app/actions/bootstrap.ts` with `'use server'` exporting `async function getLabSyncBootstrapData()`. Execute parallel single-roundtrip queries against PostgreSQL via `getPgPool()`.
- [ ] **Step 1.3**: Create `lib/bootstrap/bootstrap-provider.tsx` providing `BootstrapContext` with typed state, hydration guard, and silent background revalidation trigger.
- [ ] **Step 1.4**: Create `hooks/use-bootstrap-data.ts` exposing `useBootstrapData()` with instant cache read.
- [ ] **Step 1.5**: Wrap dashboard layout (`app/(dashboard)/layout.tsx`) with `<BootstrapProvider>`.
- [ ] **Step 1.6**: Run `node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/bootstrap-consolidation.test.mjs` and verify passing.
- [ ] **Step 1.7**: Run `npx tsc --noEmit` and verify 0 errors.

---

### Task 2: 1:1 Layout-True Dashboard Overview Skeleton

**Files:**
- Modify: `app/(dashboard)/loading.tsx`
- Modify: `components/ui/skeleton-loader.tsx:4-86`

**Description:**
Rebuild the root dashboard loading skeleton to match the exact 2026 command center layout:
- Executive Greeting bar (single line placeholder).
- 2-Column Command Center layout (`grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4`):
  - Left Column (`lg:col-span-8`):
    - 3 standalone KPI cards in `grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3` (exact 76px height).
    - Live Session Cockpit card placeholder (`h-[148px]`).
    - Sliding Segmented Tabs header (`Upcoming`, `Backlog`, `Completed`, `All`) + 3 session feed items.
  - Right Column (`lg:col-span-4`):
    - Quick Operations card (exact 76px height matching the left KPI row).
    - Facility Telemetry card with 4 room rows (`Computer Lab`, `Physics Lab`, `Chemistry Lab`, `Biology Lab`).
    - Incident Registry card.

**Steps:**
- [ ] **Step 2.1**: Measure and audit exact pixel dimensions of `TodaysActivityCard`, `QuickOperationsCard`, and `LiveSessionCockpit` in `app/(dashboard)/page.tsx`.
- [ ] **Step 2.2**: Update `DashboardOverviewSkeleton` in `components/ui/skeleton-loader.tsx` to match the exact 8/4 grid, 76px KPI heights, and Live Cockpit card structure.
- [ ] **Step 2.3**: Update `app/(dashboard)/loading.tsx` to directly render the refined `DashboardOverviewSkeleton`.
- [ ] **Step 2.4**: Verify in browser that toggling dashboard loading demonstrates **0px Cumulative Layout Shift (CLS)** when real components hydrate.
- [ ] **Step 2.5**: Run `npx tsc --noEmit` and verify 0 errors.

---

### Task 3: 1:1 Layout-True Schedules Timetable Canvas Skeleton

**Files:**
- Modify: `app/(dashboard)/schedules/loading.tsx`
- Modify: `components/ui/skeleton-loader.tsx:89-140`
- Modify: `app/(dashboard)/schedules/page.tsx:16-24`

**Description:**
Replace the outdated 11-column matrix skeleton and the blank `"Loading Timetable Canvas..."` fallback with an exact 8-period horizontal timetable canvas skeleton matching `advanced-calendar.tsx`:
- Top Toolbar: Segmented lab selector, mode switches, and action buttons.
- Timetable Grid: 1 Day column + 8 Period columns (`Period 1 [10:00-10:45]` to `Period 8 [03:10-03:50]`, including recess break slot).
- 6 Academic Day Rows: Sunday through Friday with wireframe cell blocks matching session card dimensions.

**Steps:**
- [ ] **Step 3.1**: Inspect `components/schedules/advanced-calendar.tsx` to map exact column definitions, time slot widths, and day row heights.
- [ ] **Step 3.2**: Rewrite `ScheduleMatrixSkeleton` in `components/ui/skeleton-loader.tsx` to render the exact 8-period grid with Sunday–Friday headers.
- [ ] **Step 3.3**: Update `app/(dashboard)/schedules/loading.tsx` to use the modernized 8-period `ScheduleMatrixSkeleton`.
- [ ] **Step 3.4**: Replace the text fallback in `app/(dashboard)/schedules/page.tsx` with `<ScheduleMatrixSkeleton />`.
- [ ] **Step 3.5**: Run `npx tsc --noEmit` and verify 0 errors.

---

### Task 4: 1:1 Layout-True Computer Lab CAD Floor & Cockpit Skeleton

**Files:**
- Create: `app/(dashboard)/computer-lab/loading.tsx`
- Modify: `components/ui/skeleton-loader.tsx` (export `ComputerLabFloorSkeleton`)

**Description:**
Create a dedicated loading skeleton for `/computer-lab` that eliminates the jarring flash of parent dashboard skeletons:
- Top: Live Cockpit Bar skeleton (`h-[88px]`) with session badge, roll-call stats, and action pills.
- CAD Floor Canvas: Exact room aspect ratio viewport containing:
  - Teacher podium anchor on the left/front.
  - 4 row clusters (Rows A, B, C, D) with 34 workstation outline nodes.
  - Floating Canvas HUD Controls placeholder (bottom-left).
  - Radar Minimap placeholder (bottom-right).
- Right Drawer: Displaced student triage queue placeholder.

**Steps:**
- [ ] **Step 4.1**: Build `ComputerLabFloorSkeleton` in `components/ui/skeleton-loader.tsx` matching the CAD canvas viewport and node coordinates.
- [ ] **Step 4.2**: Create `app/(dashboard)/computer-lab/loading.tsx` rendering `ComputerLabFloorSkeleton`.
- [ ] **Step 4.3**: Verify in browser that clicking `/computer-lab` immediately displays the room floor layout without flashing KPI cards.
- [ ] **Step 4.4**: Run `npx tsc --noEmit` and verify 0 errors.

---

### Task 5: 1:1 Layout-True Practical Records & Admin Roster Skeletons

**Files:**
- Modify: `app/(dashboard)/records/loading.tsx`
- Modify: `app/(dashboard)/admin/loading.tsx`
- Modify: `components/ui/skeleton-loader.tsx`

**Description:**
Align the Records Logbook and Admin Console skeletons with their real production layouts:
- `/records`: Header with search/filter bar, 3 KPI metric tiles, and an 8-row table skeleton with exact column widths (`Date`, `Class`, `Subject`, `Title`, `Roll Call`, `Status`, `Actions`).
- `/admin`: Tab bar skeleton (4 modules: Users, Roster, Routines, Settings) and tabular content area.

**Steps:**
- [ ] **Step 5.1**: Update `app/(dashboard)/records/loading.tsx` to mirror the 3 KPI summary cards and table column widths.
- [ ] **Step 5.2**: Update `AdminCommandCenterSkeleton` in `components/ui/skeleton-loader.tsx` to mirror the 4 administrative modules.
- [ ] **Step 5.3**: Run `npx tsc --noEmit` and verify 0 errors.

---

### Task 6: 60 FPS Specular Shimmer Waves & Fluid View Transitions

**Files:**
- Modify: `components/ui/skeleton.tsx`
- Modify: `app/globals.css`

**Description:**
Upgrade the flat gray pulse animation into a fluid 60 FPS **specular shimmer wave** that sweeps smoothly across cards in both Dark and Light themes. Add CSS view-transition definitions to smooth page-to-page navigation.

**Steps:**
- [ ] **Step 6.1**: Refine `@keyframes shimmer` in `app/globals.css` with a smooth ease-in-out curve.
- [ ] **Step 6.2**: Update `components/ui/skeleton.tsx` to use the enhanced specular sheen (`after:bg-gradient-to-r after:from-transparent after:via-white/20 dark:after:via-white/10 after:to-transparent`).
- [ ] **Step 6.3**: Add `.view-transition-page` classes in `app/globals.css` for 150ms opacity crossfade between route transitions.
- [ ] **Step 6.4**: Verify animations run at 60 FPS on low-power device emulation.
- [ ] **Step 6.5**: Run `npx tsc --noEmit` and verify 0 errors.

---

### Task 7: Windowed List Virtualization & Server-Side Pagination

**Files:**
- Modify: `components/roster/class-roster-view.tsx`
- Modify: `app/(dashboard)/records/page.tsx`
- Modify: `app/actions/logs.ts`
- Create: `tests/virtualization-and-pagination.test.mjs`

**Description:**
Implement `@tanstack/react-virtual` in `class-roster-view.tsx` so only the 15–20 visible student rows mount in the DOM, allowing 500+ student rosters to scroll at 60 FPS. Implement server-side pagination (`limit=25`, `offset=X`) for practical logs in `/records`.

**Steps:**
- [ ] **Step 7.1**: Write automated test `tests/virtualization-and-pagination.test.mjs` verifying `getPracticalLogsAction` supports `limit` and `offset` pagination.
- [ ] **Step 7.2**: Install `@tanstack/react-virtual` using `BypassSandbox: true` (or check if already installed).
- [ ] **Step 7.3**: Integrate `useVirtualizer` inside `components/roster/class-roster-view.tsx` for student table rows.
- [ ] **Step 7.4**: Update `app/actions/logs.ts` with paginated query parameters (`limit?: number`, `page?: number`).
- [ ] **Step 7.5**: Add jump controls and page size selector in `app/(dashboard)/records/page.tsx`.
- [ ] **Step 7.6**: Run `node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/virtualization-and-pagination.test.mjs`.
- [ ] **Step 7.7**: Run `npx tsc --noEmit` and verify 0 errors.

---

### Task 8: In-Memory Client SWR Caching & 0ms Tab Switching

**Files:**
- Modify: `hooks/use-routine-state.ts`
- Modify: `hooks/use-infrastructure-state.ts`
- Modify: `hooks/use-logs-state.ts`

**Description:**
Enable Stale-While-Revalidate (SWR) in core state hooks. When a user clicks between tabs in the sidebar, pages render instantly (0ms) from client memory while silent background revalidation updates any changed data without freezing the screen.

**Steps:**
- [ ] **Step 8.1**: Connect `useInfrastructureState` to read from `BootstrapContext` if already populated, eliminating repeated fetches.
- [ ] **Step 8.2**: Add memory caching layer to `useRoutineState` with background sync bus listener.
- [ ] **Step 8.3**: Add optimistic update handling in `useLogsState` for instant feedback on practical log submission.
- [ ] **Step 8.4**: Run `npx tsc --noEmit` and verify 0 errors.

---

### Task 9: System Benchmarks, End-to-End Verification & Task Log

**Files:**
- Modify: `doc/tasks/README.md`
- Create: `doc/tasks/2026-11-03-task-99-frontend-performance-exact-skeletons-and-swr-cache.md`

**Description:**
Run full regression tests, measure cold-start latency improvements, verify Cumulative Layout Shift (CLS) = 0 across all 4 primary views, and commit the complete work with sequentially numbered Task 99 documentation.

**Steps:**
- [ ] **Step 9.1**: Run all test suites:
  - `tests/bootstrap-consolidation.test.mjs`
  - `tests/virtualization-and-pagination.test.mjs`
  - `tests/terminal-agent-handshake.test.mjs`
  - `tests/phase1-student-terminal.test.mjs`
- [ ] **Step 9.2**: Run `npx tsc --noEmit` and verify 0 errors.
- [ ] **Step 9.3**: Create `doc/tasks/2026-11-03-task-99-frontend-performance-exact-skeletons-and-swr-cache.md`.
- [ ] **Step 9.4**: Update master index in `doc/tasks/README.md` with Task 99 entry.

