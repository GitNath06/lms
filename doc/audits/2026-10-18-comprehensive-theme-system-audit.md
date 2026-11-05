# Comprehensive Dark & Light Theme System Audit (Expanded Master Blueprint)

> **Target System**: LabSync LIMS / LMR  
> **Audited Modules**: CAD Floor Plan & Live Cockpit, Lab Diagnostics & Maintenance Workbench, Administration Console, Student Rosters & Terminals, Global UI Primitives & Dropdowns.  
> **Date**: October 18, 2026  
> **Theme Engine**: Tailwind CSS v4 (`@custom-variant dark (&:where(.dark, .dark *));`), NextThemes `class` attribute toggle on `<html>`.

---

## 1. Executive Summary

LabSync LIMS incorporates a sophisticated dual-theme design system:
- **Dark Mode**: Deep Obsidian canvas (`#0B0F19`), rich Midnight Slate surfaces (`#101726`), elevated wells (`#151E32`), and specular border rims (`rgba(255, 255, 255, 0.08)`).
- **Light Mode**: Zinc & Pearl Slate canvas (`#F4F4F5` / `#F8FAFC`), crisp white surface cards (`#FFFFFF`), subtle dividers (`#E4E4E7`), and neutral charcoal text (`#09090B`).

While standard dashboard views (`/`, `/profile`, `/schedules`) adhere well to dual-theme variables, several major core operational views were developed with hardcoded dark-mode hex values (`#0B0F19`, `#101726`, `#151E32`), hardcoded `border-white/10` borders, and low-contrast text tokens (`text-*-300` on light backgrounds). When switching to Light Mode, elements either render as black slabs, low-contrast grey-on-white text, or dark modals superimposed on light pages.

---

## 2. Complete Component-by-Component Defect Inventory

### Area A: CAD Floor Plan & Live Cockpit (`/computer-lab`) — CRITICAL SEVERITY

| Component | File Path | Line Range | Observed Theme Issue | Exact Fix Required |
| :--- | :--- | :--- | :--- | :--- |
| **Hero CAD Canvas** | [`components/computer-lab/computer-lab-workspace.tsx`](file:///d:/Projects/LMR/components/computer-lab/computer-lab-workspace.tsx) | L1814, L1881–1887 | `bg-[#0B0F19]` and `border-white/[0.08]` are hardcoded. Canvas grid lines use white transparency (`rgba(255,255,255,0.03)`). In light mode, the floor remains pitch black. | Change to `bg-slate-100 dark:bg-[#0B0F19] border-zinc-200 dark:border-white/[0.08]`. Adapt grid lines to dual-mode CSS radial/linear gradient (slate-300 in light, white in dark). |
| **PC Monitor Nodes (Inner Screen, Bezels & Stand)** | [`components/maintenance/workstations/workstation-node.tsx`](file:///d:/Projects/LMR/components/maintenance/workstations/workstation-node.tsx) | L98, L100, L239, L243, L345, L408, L416, L425, L434 | Individual PC cards are pitch-black inside! Outer bezel is `bg-[#111827]`, screen is `bg-[#0A101D]`, chin is `bg-[#182235]`, labels are `text-white`, and stands are dark slate. | Update bezel to `bg-white dark:bg-[#111827] border-zinc-300 dark:border-white/[0.08]`, screen to `bg-slate-50 dark:bg-[#0A101D]`, text to `text-zinc-900 dark:text-white`, roll to `text-indigo-600 dark:text-indigo-300`, chin to `bg-zinc-100 dark:bg-[#182235]`, and stand neck/base to dual slate/zinc gradients. |
| **Active Live Session Banner (DBMS-10)** | [`components/computer-lab/live-cockpit-bar.tsx`](file:///d:/Projects/LMR/components/computer-lab/live-cockpit-bar.tsx) | L108–113, L274, L285, L291, L318 | Active Live Session Banner has hardcoded dark emerald/obsidian background gradient (`bg-gradient-to-r from-[#0a1b18] via-[#101726] to-[#101726]`), `text-white`, and dark "Jump to Roll..." search box (`bg-[#151E32]`). | Update active banner to `border-emerald-500/30 bg-emerald-50/80 dark:bg-gradient-to-r dark:from-[#0a1b18] dark:via-[#101726] dark:to-[#101726] text-zinc-900 dark:text-white`, search box to `bg-white dark:bg-[#151E32] border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white`, and action buttons to dual zinc/white borders. |
| **Floating HUD Controls** | [`components/computer-lab/canvas-controls-hud.tsx`](file:///d:/Projects/LMR/components/computer-lab/canvas-controls-hud.tsx) | L50, L57, L83, L107, L143 | Floating HUD is locked to `bg-[#101726]/90 border-white/[0.08] text-slate-300`. In light mode, it floats as a solid black pill. | Update to `bg-white/90 dark:bg-[#101726]/90 border-zinc-200 dark:border-white/[0.08] text-zinc-700 dark:text-slate-300 shadow-xl backdrop-blur-md`. Dividers to `bg-zinc-200 dark:bg-white/10`. |
| **Radar Minimap** | [`components/computer-lab/canvas-minimap-radar.tsx`](file:///d:/Projects/LMR/components/computer-lab/canvas-minimap-radar.tsx) | L71, L73, L92, L99 | Container is `bg-[#101726]/95 border-white/[0.08]`, inner radar box is `bg-[#0B0F19] border-white/10`. Grid lines use white stroke. | Update to `bg-white/95 dark:bg-[#101726]/95 border-zinc-200 dark:border-white/[0.08]`, inner radar viewport to `bg-slate-50 dark:bg-[#0B0F19] border-zinc-200 dark:border-white/10`. |
| **Station Quick Popover** | [`components/computer-lab/station-quick-popover.tsx`](file:///d:/Projects/LMR/components/computer-lab/station-quick-popover.tsx) | L205, L367, L418, L490, L536 | Popover dialog is hardcoded `bg-[#101726] border-white/[0.08] text-white`. Child wells use `bg-[#151E32]`. | Change to `bg-white dark:bg-[#101726] border-zinc-200 dark:border-white/[0.08] text-zinc-950 dark:text-white`. Sub-wells to `bg-zinc-50 dark:bg-[#151E32] border-zinc-200 dark:border-white/5`. |
| **Bottom Status Legend Bar** | [`components/computer-lab/computer-lab-workspace.tsx`](file:///d:/Projects/LMR/components/computer-lab/computer-lab-workspace.tsx) | L2050 | Legend bar at bottom of canvas is hardcoded `border border-white/[0.08] bg-[#101726] text-slate-300`. | Change to `border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#101726] text-zinc-700 dark:text-slate-300 shadow-sm`. |
| **Station Offline Bar (Displaced Queue)** | [`components/computer-lab/displaced-students-queue.tsx`](file:///d:/Projects/LMR/components/computer-lab/displaced-students-queue.tsx) | L100, L146, L218, L221 | Pill is `bg-[#101726]/95 border-white/10`, select is `bg-[#0B0F19]`, options `bg-[#101726] text-white`. | Change to `bg-white/95 dark:bg-[#101726]/95 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100`. |
| **Floor Landmarks** | [`components/maintenance/workstations/floor-landmark-node.tsx`](file:///d:/Projects/LMR/components/maintenance/workstations/floor-landmark-node.tsx) | L74–86 | Hardcoded `bg-[#151E32]/70 text-slate-300`, `bg-*-950/20 text-*-200`. In light mode, light text is completely unreadable on light backgrounds. | Implement dual classes: e.g. `bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-500/40`. |
| **Ad-Hoc Session Modal** | [`components/computer-lab/start-adhoc-session-modal.tsx`](file:///d:/Projects/LMR/components/computer-lab/start-adhoc-session-modal.tsx) | L119, L121, L163, L242 | Modal dialog is `bg-[#101726] border-white/[0.08] text-white`, header `bg-[#151E32]/60`. | Convert to `bg-white dark:bg-[#101726] border-zinc-200 dark:border-white/[0.08] text-zinc-950 dark:text-white` and header `bg-zinc-50 dark:bg-[#151E32]/60`. |
| **Layout Editor Bar** | [`components/computer-lab/layout-editor-bar.tsx`](file:///d:/Projects/LMR/components/computer-lab/layout-editor-bar.tsx) | L164, L220, L386, L571 | Full bar and configuration modal use `bg-[#0B0F19]`, `bg-[#101726]`, `bg-[#151E32]`. | Apply standard dual-surface classes `bg-white dark:bg-[#0B0F19] border-zinc-200 dark:border-indigo-500/30`. |

---

### Area B: Lab Diagnostics & Maintenance (`/maintenance`) — HIGH SEVERITY

| Component | File Path | Line Range | Observed Theme Issue | Exact Fix Required |
| :--- | :--- | :--- | :--- | :--- |
| **Triage Issue Station Badge** | [`components/maintenance/diagnostics-triage-hub.tsx`](file:///d:/Projects/LMR/components/maintenance/diagnostics-triage-hub.tsx) | L681 | Hardcoded `bg-[#151E32] text-white border border-white/10` on light card. | Change to `bg-zinc-100 dark:bg-[#151E32] text-zinc-800 dark:text-white border-zinc-200 dark:border-white/10`. |
| **Triage Issue Category & Severity Pills** | [`components/maintenance/diagnostics-triage-hub.tsx`](file:///d:/Projects/LMR/components/maintenance/diagnostics-triage-hub.tsx) | L693–712 | Uses `text-indigo-300`, `text-amber-300`, `text-rose-300`, `text-zinc-400` regardless of theme. In light mode, pale pastel text has poor contrast (< 2.2:1). | Use dual tokens: `text-indigo-700 dark:text-indigo-300`, `text-amber-800 dark:text-amber-300`, `text-rose-700 dark:text-rose-300`. |
| **Triage Action Buttons** | [`components/maintenance/diagnostics-triage-hub.tsx`](file:///d:/Projects/LMR/components/maintenance/diagnostics-triage-hub.tsx) | L826, L848 | Buttons use `border-white/10 text-slate-300 hover:text-white hover:bg-white/5`. Invisible borders and unreadable grey text in light mode. | Update to `border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-slate-300 hover:bg-zinc-100 dark:hover:bg-white/5`. |
| **Resolve & Restore Modal** | [`components/maintenance/diagnostics-triage-hub.tsx`](file:///d:/Projects/LMR/components/maintenance/diagnostics-triage-hub.tsx) | L867, L895, L914 | Modal is locked to `bg-[#101726] border-white/10 text-white`, summary box is `bg-[#151E32]/70`, textarea is `bg-[#0B0F19]`. | Convert to `bg-white dark:bg-[#101726] border-zinc-200 dark:border-white/10 text-zinc-950 dark:text-white`, textarea `bg-zinc-50 dark:bg-[#0B0F19] border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white`. |
| **Workstation Issue Drawer** | [`components/maintenance/workstations/workstation-issue-drawer.tsx`](file:///d:/Projects/LMR/components/maintenance/workstations/workstation-issue-drawer.tsx) | L431, L440–500 | Right-side triage drawer is hardcoded `bg-[#101726] border-l border-white/[0.08]`. In light mode, clicking an issue opens a pitch-black drawer. | Convert to `bg-white dark:bg-[#101726] border-l border-zinc-200 dark:border-white/[0.08] text-zinc-900 dark:text-white`. |
| **Workstation Floor Plan Sub-View** | [`components/maintenance/workstations/workstation-floor-plan.tsx`](file:///d:/Projects/LMR/components/maintenance/workstations/workstation-floor-plan.tsx) | L315, L479, L507, L574 | Information strips and modal dialogs hardcoded `bg-[#101726] border-white/[0.08]`. | Switch to `bg-white dark:bg-[#101726] border-zinc-200 dark:border-white/[0.08]`. |
| **Workstation Board Telemetry** | [`components/maintenance/workstations/workstation-board.tsx`](file:///d:/Projects/LMR/components/maintenance/workstations/workstation-board.tsx) | L171, L193, L218, L245 | Telemetry cards are `bg-[#101726] border-white/[0.08]`. | Use `glass-card` or `bg-white dark:bg-[#101726] border-zinc-200 dark:border-white/[0.08]`. |
| **Student Unassigned Tray** | [`components/maintenance/workstations/student-tray.tsx`](file:///d:/Projects/LMR/components/maintenance/workstations/student-tray.tsx) | L51 | Slide drawer container is hardcoded `bg-[#101726] border-white/[0.08]`. | Convert to `bg-white dark:bg-[#101726] border-zinc-200 dark:border-white/[0.08] text-zinc-900 dark:text-white`. |
| **Seat Planner Tab** | [`components/maintenance/workstations/seat-planner-tab.tsx`](file:///d:/Projects/LMR/components/maintenance/workstations/seat-planner-tab.tsx) | L322, L336, L353, L514, L602 | Toolbar, `<option>` tags, and modal dialogs are `bg-[#101726] border-white/[0.08]`. | Convert to `bg-white dark:bg-[#101726] border-zinc-200 dark:border-white/[0.08]`. Remove inline `<option>` dark classes. |
| **Category Admin Modal** | [`components/maintenance/workstations/category-admin-modal.tsx`](file:///d:/Projects/LMR/components/maintenance/workstations/category-admin-modal.tsx) | L152, L154 | Modal is `bg-[#101726] border-white/[0.08]`, header `bg-[#151E32]/70`. | Convert to `bg-white dark:bg-[#101726] border-zinc-200 dark:border-white/[0.08]`, header `bg-zinc-50 dark:bg-[#151E32]/70`. |

---

### Area C: Admin Console (`/admin`) — HIGH SEVERITY

| Component | File Path | Line Range | Observed Theme Issue | Exact Fix Required |
| :--- | :--- | :--- | :--- | :--- |
| **CAD Floor Architect Canvas & HUD** | [`components/admin/admin-floor-architect.tsx`](file:///d:/Projects/LMR/components/admin/admin-floor-architect.tsx) | L1787, L1825–1830 | CAD canvas container is hardcoded `bg-[#0B0F19] border-indigo-500/20`. Radial dot-grid is fixed to `#6366F1` with dark backing. | Change canvas container to `bg-slate-100 dark:bg-[#0B0F19] border-zinc-200 dark:border-indigo-500/20`. Adapt dot-grid to clean slate-400 dots on light canvas. |
| **CAD Architect Empty Ghost Slots** | [`components/admin/admin-floor-architect.tsx`](file:///d:/Projects/LMR/components/admin/admin-floor-architect.tsx) | L1882, L1885, L1888 | Empty slot nodes (`+ PC-09`) use `bg-indigo-500/[0.04]` and `text-indigo-300/80`. On light background, they are washed out and hard to see. | Change to `bg-white/70 dark:bg-indigo-500/[0.04] border-2 border-dashed border-indigo-400 dark:border-indigo-400/30 text-indigo-700 dark:text-indigo-300/80 shadow-xs`. |
| **CAD Architect Toolbars & Combobox** | [`components/admin/admin-floor-architect.tsx`](file:///d:/Projects/LMR/components/admin/admin-floor-architect.tsx) | L1530, L1540, L1598, L1612 | "Select Terminal" toolbar is `bg-[#101726] border-white/10`, combobox input is `bg-[#0B0F19] text-white`, and autocomplete dropdown is `bg-[#0B0F19]`. | Update toolbar to `bg-white dark:bg-[#101726] border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white`, combobox input to `bg-zinc-50 dark:bg-[#0B0F19] border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white`, dropdown to `bg-white dark:bg-[#0B0F19] border-zinc-200 dark:border-indigo-500/30`. |
| **Cohort Promotion Wizard** | [`components/admin/cohort-promotion-wizard.tsx`](file:///d:/Projects/LMR/components/admin/cohort-promotion-wizard.tsx) | L784, L857, L901, L998, L1142, L1342, L1498, L1573, L1675, L1791 | Every wizard step card, student review table, exception pill, and execution dialog uses `bg-[#101726] border-white/[0.08]`. In light mode, the entire wizard renders as a pitch-black box. | Convert all wizard cards and dialogs to `bg-white dark:bg-[#101726] border-zinc-200 dark:border-white/[0.08] text-zinc-900 dark:text-white`. Table headers to `bg-zinc-100 dark:bg-[#151E32]`. |
| **CAD Inspector Drawer** | [`components/admin/cad-inspector-drawer.tsx`](file:///d:/Projects/LMR/components/admin/cad-inspector-drawer.tsx) | L205 | Inspector aside is `bg-[#101726] border-l border-white/10`. | Change to `bg-white dark:bg-[#101726] border-l border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white`. |

---

### Area D: Global Floating Controls & Dev Simulators — HIGH SEVERITY

| Component | File Path | Line Range | Observed Theme Issue | Exact Fix Required |
| :--- | :--- | :--- | :--- | :--- |
| **Global "Station Rig" Floating Trigger** | [`components/dev/terminal-simulator-controller.tsx`](file:///d:/Projects/LMR/components/dev/terminal-simulator-controller.tsx) | L252 | In Light Mode, the bottom-right floating trigger button defaults to `bg-zinc-900/90 text-zinc-100 border border-zinc-700/60`, appearing as an unstyled pitch-black pill across all pages. | Update default state to `bg-white/95 text-zinc-800 dark:bg-[#151E32]/90 dark:text-zinc-200 border border-zinc-200/90 dark:border-white/[0.1] shadow-lg hover:border-zinc-300 dark:hover:border-zinc-500`. |

---

### Area E: Student Rosters & Student Terminal (`components/roster/`, `components/terminal/`) — MEDIUM SEVERITY

| Component | File Path | Line Range | Observed Theme Issue | Exact Fix Required |
| :--- | :--- | :--- | :--- | :--- |
| **Class Roster View** | [`components/roster/class-roster-view.tsx`](file:///d:/Projects/LMR/components/roster/class-roster-view.tsx) | L630, L634, L669, L733, L742, L911, L1559 | Toolbar, search input, actions, table header, and edit student modal use `bg-[#101726]`, `bg-[#151E32]`, `border-white/[0.08]`. | Convert to standard `bg-white dark:bg-[#101726] border-zinc-200 dark:border-white/[0.08]`, inputs `bg-white dark:bg-[#151E32] text-zinc-900 dark:text-white`. |
| **Roster Import Modal** | [`components/roster/roster-import-modal.tsx`](file:///d:/Projects/LMR/components/roster/roster-import-modal.tsx) | L241, L244, L329, L488, L629 | Dialog, header, preview table header, and footer are locked to `bg-[#101726]` and `bg-[#151E32]`. | Convert to `bg-white dark:bg-[#101726] border-zinc-200 dark:border-white/[0.08]` with `bg-zinc-50 dark:bg-[#151E32]` headers. |
| **Batch Photo Import Modal** | [`components/roster/batch-photo-import-modal.tsx`](file:///d:/Projects/LMR/components/roster/batch-photo-import-modal.tsx) | L208, L247, L300, L345 | Upload drop-zone, matching table header, and input boxes use `bg-[#151E32] border-white/[0.08]`. | Convert dropzone to `bg-zinc-50/60 dark:bg-[#151E32]/40 border-zinc-300 dark:border-white/[0.12]`. |
| **Student Terminal View** | [`components/terminal/student-terminal-view.tsx`](file:///d:/Projects/LMR/components/terminal/student-terminal-view.tsx) | L219, L255, L290, L494, L582 | Student kiosk view is hardcoded to dark colors (`bg-[#101726]`, `bg-[#0B0F19]`). | Add dual-theme support so it renders cleanly in light mode (`bg-slate-50 dark:bg-[#070A12]`, cards `bg-white dark:bg-[#101726]`). |

---

### Area F: UI Dropdowns, Buttons & Micro-Elements — MINOR SEVERITY

| Component | File Path | Line Range | Observed Theme Issue | Exact Fix Required |
| :--- | :--- | :--- | :--- | :--- |
| **Native `<select>` & `<option>` tags** | Multiple files (`station-quick-popover`, `displaced-students-queue`, `seat-planner-tab`, `class-roster-view`) | Various | `<option className="bg-[#101726] text-white">` disrupts native select dropdown menus in Chromium/WebKit on light mode. | Remove hardcoded dark classes from `<option>` elements so OS native pickers render in proper light/dark palette. |
| **Button Outlines with `border-white/10`** | `diagnostics-triage-hub`, `layout-editor-bar`, `station-quick-popover` | Various | Buttons using `border-white/10 text-slate-300` have invisible borders and unreadable faint text on light cards. | Replace with `border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-slate-300 hover:bg-zinc-100 dark:hover:bg-white/5`. |
| **Light-on-Light Badge Contrast** | Various components | Various | Badges using `text-amber-300`, `text-rose-300`, `text-emerald-300`, `text-indigo-300` without dark prefix fail WCAG AA contrast on white. | Enforce: `text-amber-700 dark:text-amber-300`, `text-rose-700 dark:text-rose-300`, `text-emerald-700 dark:text-emerald-300`, `text-indigo-700 dark:text-indigo-300`. |

---

## 3. Sequential Execution Blueprint

### Phase 1: CAD Floor Plan & Live Cockpit (`/computer-lab`)
1. [`components/maintenance/workstations/workstation-node.tsx`](file:///d:/Projects/LMR/components/maintenance/workstations/workstation-node.tsx): Convert monitor bezels, inner screen fill, student text, roll badge, chin bar, and stands to dual-theme.
2. [`components/computer-lab/computer-lab-workspace.tsx`](file:///d:/Projects/LMR/components/computer-lab/computer-lab-workspace.tsx): Convert hero floor canvas background, dual-mode grid lines, session launch card, and bottom legend bar.
3. [`components/computer-lab/live-cockpit-bar.tsx`](file:///d:/Projects/LMR/components/computer-lab/live-cockpit-bar.tsx): Convert active session banner, search input, and action buttons.
4. [`components/computer-lab/canvas-controls-hud.tsx`](file:///d:/Projects/LMR/components/computer-lab/canvas-controls-hud.tsx): Convert floating HUD pill.
5. [`components/computer-lab/canvas-minimap-radar.tsx`](file:///d:/Projects/LMR/components/computer-lab/canvas-minimap-radar.tsx): Convert floating radar minimap.
6. [`components/computer-lab/station-quick-popover.tsx`](file:///d:/Projects/LMR/components/computer-lab/station-quick-popover.tsx): Convert station quick popover and modal controls.
7. [`components/computer-lab/displaced-students-queue.tsx`](file:///d:/Projects/LMR/components/computer-lab/displaced-students-queue.tsx): Convert offline triage bar.
8. [`components/dev/terminal-simulator-controller.tsx`](file:///d:/Projects/LMR/components/dev/terminal-simulator-controller.tsx): Convert floating "Station Rig" pill to light/dark.

### Phase 2: Diagnostics & Maintenance Workbench (`/maintenance`)
1. [`components/maintenance/diagnostics-triage-hub.tsx`](file:///d:/Projects/LMR/components/maintenance/diagnostics-triage-hub.tsx): Fix PC badges, high-contrast severity tags, visible action buttons, and resolve modal.
2. [`components/maintenance/workstations/workstation-issue-drawer.tsx`](file:///d:/Projects/LMR/components/maintenance/workstations/workstation-issue-drawer.tsx): Convert right-side slide-over drawer from `#101726` to dual-theme surface.
3. [`components/maintenance/workstations/workstation-floor-plan.tsx`](file:///d:/Projects/LMR/components/maintenance/workstations/workstation-floor-plan.tsx) and [`seat-planner-tab.tsx`](file:///d:/Projects/LMR/components/maintenance/workstations/seat-planner-tab.tsx): Clean up remaining dark containers.

### Phase 3: Admin Console & Rosters (`/admin`, `/roster`)
1. [`components/admin/admin-floor-architect.tsx`](file:///d:/Projects/LMR/components/admin/admin-floor-architect.tsx): Convert architect canvas container, dot-grid, empty slot nodes, and selection toolbars.
2. [`components/admin/cohort-promotion-wizard.tsx`](file:///d:/Projects/LMR/components/admin/cohort-promotion-wizard.tsx): Convert promotion wizard cards and modals.
3. [`components/roster/class-roster-view.tsx`](file:///d:/Projects/LMR/components/roster/class-roster-view.tsx): Convert roster toolbars and import modals.
4. Purge `<option className="bg-[#101726] text-white">` from all native select elements.
