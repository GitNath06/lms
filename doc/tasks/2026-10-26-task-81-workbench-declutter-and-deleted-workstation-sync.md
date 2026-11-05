# Task 81: Declutter & Redesign Lab Diagnostics & Maintenance Workbench & Fix Deleted Workstation Sync

**Date**: 2026-10-26  
**Status**: Completed  
**Scope**: Workstation fleet synchronization, Fleet Radar chip ergonomics, issue triage card density, and Rule #1 toolbar compliance.

---

## 1. Problem Statement & Background

1. **Deleted / Ghost Workstations in Maintenance**:
   - Inactive or surplus workstations (e.g., `PC-41`, `PC-490`) were still appearing in `/maintenance` and `DiagnosticsTriageHub` due to an unconstrained fallback query in `getWorkstationBoardData` and missing `revalidatePath('/maintenance')` in layout position saving and deletion.
   - Stray test workstation `PC-490` existed in the database without being tied to an active physical bench.
2. **Hardware Fleet Radar Chip Truncation & Clutter**:
   - Workstation chips in `diagnostics-triage-hub.tsx` rendered internal `"OK"` or `"⚠️ 1"` badges alongside labels in narrow 11-column grid slots, forcing labels like `PC-04` and `PC-37` to truncate to `PC...`.
   - A redundant legend footer (`Operational (41) • Flagged Fault (1) • Under Repair (1)`) duplicated the information already presented in top filter chips.
3. **Issue Ticket Card Visual Clutter**:
   - When faults occurred, the issue list defaulted to `'all'`, burying active open issues beneath a wall of green resolved cards.
   - Tickets displayed redundant category pills when the category name duplicated or closely matched the issue title (e.g., `"LAN / Internet Disconnected"`).
   - Resolved tickets rendered bulky multi-line green resolution boxes with heavy full borders.
4. **Toolbar Overflow & Rule #1 Compliance**:
   - Toolbar export buttons wrapped `CSV` onto an orphan second row on standard desktop screens.
   - Strict AGENTS.md Rule #1 required zero literal `+` in buttons.

---

## 2. Technical Modifications

### A. Strict Active Workstation Synchronization (`app/actions/workstations.ts`)
- **Direct PostgreSQL Pool Queries**: Updated `getWorkstationBoardData` and `getDiagnosticsTriageData` to execute direct queries via `getPgPool()` with `WHERE lab_id = $1 AND is_active = true ORDER BY label ASC`, completely bypassing RLS discrepancies and eliminating the unsafe fallback query without `is_active`.
- **Canvas Deactivation Cross-Check**: Updated `updateWorkstationPositions` and verified `batchUpdateWorkstationPositions` to automatically cross-check the active IDs from CAD Floor Architect and set `is_active = false` for any room workstations omitted from the canvas.
- **Cross-Route Revalidation**: Added `revalidatePath('/maintenance')` and `revalidatePath('/maintenance/workstations')` alongside `/admin` and `/computer-lab` in `updateWorkstationPositions`, `batchUpdateWorkstationPositions`, and `deleteWorkstation`.
- **Database Purge**: Permanently purged stray test nodes `PC-490` and `PC-41` from `public.workstations` and associated foreign key tables.

### B. Fleet Radar Chip Redesign (`components/maintenance/diagnostics-triage-hub.tsx`)
- **Removed "OK" and Issue Count Badges**: Eliminated internal badge clutter from both Matrix and Architectural Bay views.
- **High-Density Node Pill**: Rendered each node as a clean compact pill (`h-8 px-2 sm:px-2.5 rounded-lg border flex items-center justify-center gap-1.5`) showing strictly the 6px status dot + full label (`● PC-04`) with `whitespace-nowrap font-mono text-xs font-bold`.
- **Subtle Semantic Palette**:
  - Operational: `bg-zinc-50 dark:bg-white/[0.03] border-zinc-200/80 dark:border-white/[0.07] text-zinc-700 dark:text-slate-300` with 6px emerald dot.
  - Flagged: `bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30` with pulsing amber dot.
  - Under Repair: `bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/30` with pulsing rose dot.
- **Removed Redundant Legend**: Deleted the bottom footer row (`Operational (41) • Flagged Fault (1) • Under Repair (1)`).

### C. Issue Ticket Card High-Density Clarity (`components/maintenance/diagnostics-triage-hub.tsx`)
- **Default Filter to Active Faults**: Initialized `statusFilter` to `'active'` whenever `open_count > 0 || in_progress_count > 0`, prioritizing actionable triage over resolved cards.
- **Category Badge Deduplication**: Added check `Boolean(issue.category && (issue.category.name.trim().toLowerCase() === issue.title.trim().toLowerCase() || ...))` to hide redundant category pills when the title matches.
- **Compact 2-Row Resolved Card (~68px)**:
  - Container: Subtle left border `border-l-2 border-l-emerald-500/60` on a neutral card (NO heavy full green border).
  - Row 1: `[PC-01]` badge + Issue Title + `[LOW]` + `[✓ Resolved]` on left | `[Reopen]` ghost button on right.
  - Row 2: Inline metadata line `✓ Resolution: "..." • Closed by <name> (<date>) • Reported <date>`.
- **Active Fault Tickets**: Preserved full triage detail (description, reporter metadata, "Mark Under Repair", "Resolve & Restore") with deduplicated category pills.

### D. Toolbar Cleanup & Rule #1 Compliance (`components/maintenance/maintenance-client-page.tsx` & `diagnostics-triage-hub.tsx`)
- **Rule #1 Compliance**: Verified `Add Routine` button uses `<Plus className="h-4 w-4" /> <span>Add Routine</span>` with zero literal `+` characters.
- **Single-Row Action Bar**: Grouped `Sync`, `Print Logbook`, `Excel`, and `CSV` inside `flex items-center gap-1.5 flex-nowrap shrink-0` on desktop, hiding `Print Logbook`, `Excel`, and `CSV` on mobile (`hidden md:inline-flex`) to prevent orphan row wrapping.

---

## 3. Verification & Test Evidence

- **TypeScript Typecheck**:
  ```bash
  npx tsc --noEmit
  # Result: 0 errors (Exit code 0)
  ```
- **Unit Domain Invariant Test Suite**:
  ```bash
  npm run test:unit
  # Result: 52 tests passed, 0 failed, 5 suites passed (Exit code 0)
  ```
- **Database Verification**:
  - `PC-490`: Deleted from `public.workstations`.
  - `PC-41`: Purged cleanly from `public.workstations`.
  - Active nodes for `comp` strictly align with the physical 40-seat laboratory configuration.
