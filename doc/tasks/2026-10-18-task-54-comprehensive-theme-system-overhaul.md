# Task 54: System-Wide Dark & Light Theme Overhaul & CAD Floor Plan Elevation

**Date**: 2026-10-18  
**Author**: Antigravity Assistant  
**Status**: Completed & Verified  
**Subsystems**: CAD Floor Plan, Live Cockpit Bar, Workstation Monitor Nodes, Diagnostics Triage Hub, Admin Floor Architect, Cohort Promotion Wizard, CSS Theme Tokens

---

## 1. Executive Summary & Objective

Laboratory operations in LMR (LabSync LIMS) require seamless readability and aesthetic excellence across both dark mode (`Deep Obsidian #0B0F19`) and light mode (`Pearl Slate #F8FAFC` / `Zinc 50–200`). Prior to this task, several high-impact UI areas were hardcoded with dark background colors (`bg-[#0B0F19]`, `bg-[#101726]`, `bg-[#151E32]`, `bg-zinc-900`) and dark text classes (`text-white`, `text-slate-100`), causing broken contrast, pitch-black canvases, and unreadable text when operating in Light Mode.

This task executed a comprehensive, system-wide dark and light theme overhaul resolving all 5 user screenshots and the 4 critical visual gaps identified during the system audit:
1. **Workstation Monitor Cards (PC-01 to PC-40)**: Recessed LCD monitor screens, bezels, roll badges, avatars, and stand bases.
2. **Active Live Session Banner (DBMS-10)**: Elevated from dark green/obsidian to a crisp emerald surface on light mode with high-contrast search and buttons.
3. **Admin CAD Floor Architect Canvas & HUD**: Dual blueprint radial grid, ghost slot nodes, top action command bar, terminal quick selector, and custom builder modals.
4. **Global Floating "Station Rig" Pill & Bottom Legend Bar**: Converted from hardcoded black pills to dual-theme floating elevated glass surfaces.
5. **Admin SIS Cohort Promotion Wizard & Modals**: Complete dual-theme transformation of setup cards, staging table, pre-flight confirmation ledger, receipts, disaster rollback drawer, and newcomer modals.

---

## 2. Detailed Subsystem Changes

### A. Theme Utility & Blueprint Grid Engine (`app/globals.css`)
- Replaced dark-only SVG background radial dots with a unified `.cad-canvas-grid` token.
- Light mode renders subtle slate-800 dots (`rgba(30, 41, 59, 0.15)` on `bg-slate-100`).
- Dark mode renders luminous indigo dots (`rgba(255, 255, 255, 0.08)` and `rgba(99, 102, 241, 0.1)` on `bg-[#0B0F19]`).

### B. Living LCD Workstation Nodes (`components/maintenance/workstations/workstation-node.tsx`)
- Monitor Bezel & Frame: Elevated to `bg-slate-200 dark:bg-[#111827]` with a crisp, defined `border-2 border-slate-400 dark:border-white/[0.08]` providing clear structural contrast against the `bg-slate-100` canvas.
- Recessed LCD Screen Fill: `bg-white dark:bg-gradient-to-b dark:from-[#151E32] dark:to-[#0B0F19]` with a distinct `border border-slate-300 dark:border-black/70`.
- Student Name & Station Typography: High-contrast `text-zinc-900 dark:text-white`.
- Chin Bar: Matching `bg-slate-200 dark:bg-[#182235]` with `border-t border-slate-300 dark:border-white/[0.06]` and a subtle ring on the power status LED.
- Monitor Stand Neck: Metallic gunmetal gradient `bg-gradient-to-b from-slate-400 via-slate-500 to-slate-600 dark:from-slate-700 dark:via-slate-800 dark:to-slate-900 border-x border-slate-400 dark:border-slate-600/60 shadow-xs`.
- Deskpart Pedestal Base: Polished aluminum pedestal foot `w-14 sm:w-16 h-1.5 sm:h-2 bg-gradient-to-r from-slate-500 via-slate-400 to-slate-500 border border-slate-600/80 shadow-[0_2px_5px_rgba(15,23,42,0.28)]` anchored by a grounding desk-contact shadow (`bg-slate-400/50 dark:bg-black/60 blur-[1px]`) for clean separation from the grid.
- Ambient Aura & Status LEDs: Preserved semantic glowing rings (Emerald for present, Amber for unresolved fault, Rose for critical/repair).

### C. Live Cockpit Command Bar (`components/computer-lab/live-cockpit-bar.tsx`)
- Active Live Session Ribbon: Light mode uses `bg-emerald-50/90 border-emerald-200 text-emerald-950`; dark mode retains midnight emerald gradient.
- Jump to Roll Combobox: Light mode `bg-white border-emerald-300 text-zinc-900 placeholder:text-zinc-500`.
- Fast Roll-Call Action Buttons: High-contrast emerald and white buttons with smooth hover transitions.

### D. Operational Workspace & Controls (`components/computer-lab/`)
- CAD Canvas Container: `bg-slate-100 dark:bg-[#0B0F19]`.
- Floating Controls HUD (`canvas-controls-hud.tsx`): `bg-white/90 dark:bg-[#101726]/90 border-zinc-200 dark:border-white/[0.1] text-zinc-700 dark:text-slate-300`.
- Radar Minimap (`canvas-minimap-radar.tsx`): Light viewport container `bg-white/95 border-zinc-300`.
- Displaced Student Triage Queue (`displaced-students-queue.tsx`): `bg-white/95 dark:bg-[#101726]/95 border-amber-300 dark:border-amber-500/30 text-zinc-900 dark:text-white`.
- Station Quick Popover (`station-quick-popover.tsx`): Dual-theme modal dialog, high-contrast roll pills, tab buttons, reassign select, and fault ticket actions.

### E. Diagnostics Triage Hub & Issue Drawer (`components/maintenance/`)
- **Hardware Fleet Radar Overhaul**:
  - Eliminated the unstructured, unstyled wall of 44 pill buttons and fixed the row height distortion bug (where stations with issues like `PC-37` with `1 issue` rendered multiline children that stretched button and grid track heights).
  - Designed uniform fixed-height living squircle node chips (`h-9`) with left-aligned glowing status LED dot, bold monospace station label, and right-aligned inline telemetry pill (`OK` or compact `[▲ 1]` issue badge).
  - Added an Executive Telemetry Bar with animated live beacon, total monitored node counter, and live `{fleetHealthRate}% Health` pill badge.
  - Added interactive 1-tap quick status filters (`All`, `Healthy`, `Faults`), real-time node search input (`Find PC...`), and a dual layout toggle (`Matrix Grid` for dense calibration vs `Architectural Bays` for row-by-row physical context).
  - Added an elevated **Active Station Telemetry Inspector Bar** on node selection with physical location, derived status, open tickets, 1-click CAD Floor Plan navigation (`/computer-lab?station=...`), and quick clear filter action.
  - Added active node filter indicator chip in the issues resolver board toolbar for immediate filtering context.
- Workstation Badges & Severity Tags: High-contrast badges with dual-theme border and pill tokens.
- Resolve & Restore Modal: Pure white elevated dialog on light mode, dark obsidian on dark mode.
- Workstation Issue Drawer (`workstation-issue-drawer.tsx`): Dual-theme sliding sheet with high-contrast tab navigator and seating roster cards.

### F. CAD Floor Architect & CAD Inspector (`components/admin/`)
- Admin Floor Architect (`admin-floor-architect.tsx`): Top command bar, terminal quick selector combobox, ghost slot nodes (`+ PC-09`), Add Workstation Modal, Add Landmark Modal, Save Custom Layout Modal, and Custom Grid Builder Modal converted to dual theme.
- CAD Inspector Drawer (`cad-inspector-drawer.tsx`): Floating side drawer with light-slate operational health well, dual coordinate steppers, and smart deletion confirmation dialog.

### G. Cohort Promotion & Lifecycle Wizard (`components/admin/cohort-promotion-wizard.tsx`)
- Header Banner & Step Indicator: High-contrast title, breadcrumb step indicator (`bg-zinc-100 dark:bg-[#151E32]`).
- Source & Destination Cohort Setup Cards: Light-slate backgrounds (`bg-white dark:bg-[#101726] border-zinc-200 dark:border-white/[0.08]`), clear input selects without hardcoded dark options.
- Step 2 Staging Table & Toolbar: High-contrast column headers, row hovers, draft roll inputs, and action dropdowns (`bg-indigo-50`, `bg-amber-50`, `bg-rose-50`, `bg-emerald-50`).
- Pre-Flight Confirmation Ledger: High-contrast KPI cards, audit notes textarea, and safety lock warning banner.
- Execution Success Receipt: Clean emerald light surface.
- 24-Hour Disaster Rollback Card & Modals: Pure white/slate dialog surfaces with dark obsidian fallbacks.

### H. Global Station Rig Dev Pill (`components/dev/terminal-simulator-controller.tsx`)
- Floating Rig Trigger: Converted from hardcoded black `bg-zinc-900/90 text-zinc-100` to `bg-white/95 text-zinc-800 dark:bg-[#151E32]/90 dark:text-zinc-200 border-zinc-200 dark:border-white/[0.1] shadow-lg`.

---

## 3. Invariants & Repository Rule Compliance

1. **Rule 1 (No Literal `+` in Button Labels)**: All action buttons use Lucide icons (e.g. `<Plus className="h-4 w-4" /> <span>...</span>`).
2. **Rule 3 (Safety Lock)**: "Precaution Active" safety lock switch and label remain intact in Super Admin console.
3. **Rule 8 (Strict TypeScript Checking)**: `npx tsc --noEmit` passed with 0 compile and type errors across all files.
4. **Rule 9 (Semantic Color Palette)**: Standardized Emerald (`>= 85%`), Slate/Neutral (`75%–84%`), and Rose (`< 75%`) attendance tiers.
5. **Rule 19 (Workstation Status Derivation)**: Maintained dynamic derivation from `public.workstation_issues`.
6. **Rule 22 (Sequential Documentation)**: Authoritative record logged as Task 54 with master index updated in `doc/tasks/README.md`.

---

## 4. Verification & Test Evidence

- **TypeScript Compilation**:
  - Command: `npx tsc --noEmit`
  - Result: 0 errors, exit code 0.
- **CAD Floor Architect Regression Suite**:
  - Command: `node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/cad-floor-architect.test.mjs`
  - Result: 9/9 tests passed, 0 failures.
- **Unit Domain Invariants & Workstation Floor Suite**:
  - Command: `node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/unit-domain-invariants.test.mjs tests/workstation-floor.test.mjs`
  - Result: 14/14 tests passed, 0 failures.
