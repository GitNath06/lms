# Task 62: Complete System Dark & Light Theme Overhaul & Compliance Automation

**Date**: 2026-10-19  
**Category**: Theme System, UI/UX Overhaul, Test Automation, Institutional Compliance  
**Author**: Antigravity Assistant

---

## 1. Context & Motivation
Following the Dark & Light Theme System Audit in Task 61, several critical components across Student Rosters, Diagnostics Triage Hub, CAD Workstation Floor Plan, Computer Lab Workspace, Analytics Tabs, and Student Terminal remained hardcoded to dark hex backgrounds (`#101726`, `#151E32`, `#0B0F19`, `#070A12`). When toggling to Light Mode, these components rendered pitch black toolbars, dropdowns, cards, tables, and modal dialogues.

This task completes the systematic dual-theme conversion across all remaining components and implements an automated test suite (`tests/theme-audit-compliance.test.mjs`) to guarantee zero regression and zero un-prefixed dark hexes across the repository.

---

## 2. Key Components Overhauled

### A. Academic Curriculum & Rosters (`components/roster/`)
1. **`class-roster-view.tsx`**:
   - Filter toolbar: `bg-white dark:bg-[#101726] border-zinc-200 dark:border-white/[0.08]`.
   - Year & Class selectors: `bg-zinc-50 dark:bg-[#151E32] border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white`.
   - Segmented Active/Archived/All pill track: `bg-zinc-100 dark:bg-[#151E32] border-zinc-200 dark:border-white/5`.
   - Search input: `bg-zinc-50 dark:bg-[#151E32] border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-slate-500`.
   - Action buttons: Sort, Add Student, Resequence, and Export converted to high-contrast dual theme.
   - Student Table: Header `bg-zinc-50 dark:bg-[#151E32] text-zinc-600 dark:text-slate-300`, table rows with `hover:bg-zinc-50 dark:hover:bg-white/[0.02]`, avatar circles `bg-indigo-50 dark:bg-[#151E32] text-indigo-700 dark:text-indigo-400`.
   - Modals: All 5 modals (Add Student, Transfer Student, Edit Student, Delete/Archive Dialog, and Resequence Rolls Modal) converted to clean `bg-white dark:bg-[#101726]` with light-friendly form inputs.
2. **`roster-import-modal.tsx`**:
   - Modal container, drag-drop zone, template guidance well, preview table header, rows, and footer dual-themed.
3. **`batch-photo-import-modal.tsx`**:
   - Photo dropzone, KPI cards, student matching dropdowns, confidence pills, and preview table dual-themed.

### B. Diagnostics & Maintenance Workbench (`components/maintenance/`)
1. **`diagnostics-triage-hub.tsx`**:
   - Overview banner: `bg-white dark:bg-[#101726] border-zinc-200 dark:border-white/[0.08]`.
   - Station badges (e.g. PC-26, PC-07): `bg-zinc-100 dark:bg-[#151E32] text-zinc-800 dark:text-white border-zinc-200 dark:border-white/10`.
   - Category & severity pills: High-contrast light backgrounds (`bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300`, etc.).
   - Action buttons: Reopen/Revert and Resolve buttons styled for light/dark contrast.
   - Inline Resolve & Restore Modal: Modal shell `bg-white dark:bg-[#101726]`, textarea `bg-zinc-50 dark:bg-[#151E32] text-zinc-900 dark:text-white border-zinc-200 dark:border-white/10`.
2. **Workstations Suite (`components/maintenance/workstations/`)**:
   - `floor-landmark-node.tsx`: Landmark nodes (doors, windows, pillars, podium, whiteboard) styled with dual borders and texts.
   - `workstation-board.tsx`: Empty state cards and quick help banners converted to dual theme.
   - `category-admin-modal.tsx`: Category manager modal, input forms, and list items converted to dual theme.
   - `seat-planner-tab.tsx`: Seat planner toolbar, class/section dropdowns, and unassigned student tray.
   - `workstation-floor-plan.tsx`: Floor plan canvas background and grid styling.
   - `workstation-issue-drawer.tsx`: Issue drawer, fault resolution notes, and telemetry panels.
   - `workstation-mobile-view.tsx`: Mobile workstation card list and status indicators.

### C. Live Computer Lab & Projection Displays (`components/computer-lab/`)
1. **`station-quick-popover.tsx`**:
   - Floating popover modal `bg-white dark:bg-[#101726] border-zinc-200 dark:border-white/[0.08] text-zinc-950 dark:text-white shadow-2xl`.
   - Student info wells `bg-zinc-50 dark:bg-[#151E32] border-zinc-200 dark:border-white/10`.
   - Direct fault report modal `bg-white dark:bg-[#101726]` with full dual-theme inputs.
2. **`displaced-students-queue.tsx`**:
   - Displaced student strip: `bg-white/95 dark:bg-[#101726]/95 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100`.
   - Quick-reassign select: `bg-zinc-50 dark:bg-[#0B0F19] text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-white/10`.
3. **`canvas-controls-hud.tsx` & `canvas-minimap-radar.tsx`**:
   - HUD pill bar: `bg-white/90 dark:bg-[#101726]/90 border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-slate-300`.
   - Radar minimap: `bg-white/90 dark:bg-[#101726]/90 border-zinc-200 dark:border-white/10` with radar canvas `bg-slate-50 dark:bg-[#0B0F19]`.
4. **`layout-editor-bar.tsx` & `computer-lab-workspace.tsx`**:
   - Layout editor HUD, loading overlays, temporary seat override modal, and floating toast notifications.
5. **`projector-view.tsx`**:
   - Projector header: `bg-white/90 dark:bg-[#0B0F19]/90 border-b border-zinc-200 dark:border-white/[0.08]`.
   - Hero wall canvas: `border-zinc-200 dark:border-white/10 bg-slate-50 dark:bg-[#0B0F19]`.
   - Footer student legend: `bg-white/90 dark:bg-[#0B0F19]/90 border-t border-zinc-200 dark:border-white/[0.08]`.

### D. Institutional Analytics & Reporting (`components/analytics/`)
1. **`faculty-activity-tab.tsx`**: KPI cards, main faculty audit table, header, rows, and in-charge audit badges.
2. **`lab-occupancy-tab.tsx`**: Facility utilization cards, metric wells, and operating density progress bars.
3. **`student-compliance-tab.tsx`**: Class/year selectors, eligibility pills, search input, CSV/Excel export buttons, KPI metrics, and board compliance table.
4. **`syllabus-progress-tab.tsx`**: Curriculum target banner, completion progress bar, syllabus logbook table, and terminology fix (`Turnout %` &rarr; `Attendance %`).
5. **`workstation-biography-drawer.tsx`**: Slide-over biography drawer, subtab navigation (Faults, Servicing, Baseline, Usage Timeline), and technical log cards.
6. **`workstation-reliability-tab.tsx`**: Hardware uptime KPIs, recurrent fault hotspot cards, and complete workstation roster table.

### E. Student Terminal & Pairing Portal (`app/terminal/`)
1. **`app/terminal/page.tsx`**: Student terminal gateway hero, anti-spoofing guide cards, and local dev bypass grid.
2. **`app/terminal/pair/page.tsx`**: Cryptographic pairing card, form inputs, and success confirmation.
3. **`app/terminal/[code]/page.tsx`**: Workstation unrecognized error state and navigation actions.

---

## 3. Verification & Compliance Suite

### Automated Theme Compliance Test
Created `tests/theme-audit-compliance.test.mjs` which scans all `.tsx` files in `components/` and `app/`:
- **Invariant 1**: Verifies that forbidden dark hex classes (`bg-[#0B0F19]`, `bg-[#101726]`, `bg-[#151E32]`, `bg-[#070A12]`) are ALWAYS prefixed by `dark:` or a dark pseudo-variant (`dark:hover:`, `dark:focus:`, `dark:group-hover:`).
- **Invariant 2**: Verifies that no native `<option>` element contains dark background styling (`bg-[#101726]`).
- **Result**: Passed with **0 violations** across all scanned files.

### Critical Institutional Rules Followed
- **Rule 1**: Zero literal `+` in button labels across all overhauled files (used `<Plus className="..." />`).
- **Rule 2**: Terminology enforcement: replaced "Turnout %" with "Attendance %" in `syllabus-progress-tab.tsx`.
- **Rule 4 & 5**: Zero pricing clutter, zero department regressions.

---

## 4. Test Execution
- `node --test tests/theme-audit-compliance.test.mjs` &rarr; **Pass (1/1 tests, 0 violations)**
- `npx tsc --noEmit` &rarr; **Pass (0 errors)**
