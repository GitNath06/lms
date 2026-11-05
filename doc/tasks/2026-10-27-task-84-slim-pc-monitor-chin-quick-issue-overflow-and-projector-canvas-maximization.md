# Task 84: Slim PC Monitor Chin, Fix Quick Issue Preset Overflow, Clean Upcoming Session Banner & Maximize Projector View Canvas

**Date**: 2026-10-27  
**Status**: Completed  
**Author**: Antigravity Assistant  
**Subsystems Involved**: Workstation Nodes (`components/maintenance/workstations/workstation-node.tsx`), Workstation Issue Drawer (`components/maintenance/workstations/workstation-issue-drawer.tsx`), Computer Lab Workspace (`components/computer-lab/computer-lab-workspace.tsx`), Projector Screen (`components/computer-lab/projector-view.tsx`).

---

## 1. Executive Summary & Root Cause Analysis

### Refinement 1: Slim Down PC Monitor Node Chin & Maximize Screen Area
- **Problem**: In light and dark modes, the bottom chin bar of the monitor node was taking up excessive vertical height, cramping the inner LCD screen and leaving the PC label with constrained breathing room. The light mode outer border was also washed out against the canvas background.
- **Resolution**:
  - Reduced the bottom chin bar to a sleek `h-2.5` strip with a micro status LED indicator and tiny horizontal dash.
  - Set the inner recessed LCD screen glass to `flex-1` with `p-0.5` outer bezel padding, maximizing vertical and horizontal space for labels (e.g. `PC-31`, `PC-42`).
  - Enforced a crisp framed dark border (`border border-zinc-700/80 dark:border-white/15`) across nominal and default workstation states in both light and dark modes.

### Refinement 2: Fix Quick Issue Preset Text Overflow
- **Problem**: In the Workstation Issue Drawer's REPORT tab, the button label `"Missing Lab Software (VS Code/Python/C++)"` wrapped awkwardly into 3 cramped lines and overflowed its grid cell.
- **Resolution**:
  - Shortened the primary button label to `"Missing Software"` with a clean subtitle (`"VS Code, Python"`) and descriptive tooltip (`"Missing Lab Software (VS Code/Python/C++)"`).
  - Applied structured two-line layouts with `min-h-[48px]` and `justify-between` across all 8 preset buttons in the 4-column grid.

### Refinement 3: Clean Up Upcoming Session List & Standby Banner
- **Problem**: The Standby / Upcoming session banner and timetable slot dropdown rendered unevenly with multi-line stacking and verbose option strings (`✓ PAST (10:45): 9 C • Fundamental Computer Applications Lab (10:45–11:30 AM)`), causing visual clutter.
- **Resolution**:
  - Streamlined the standby/upcoming banner into a single balanced horizontal flex row:
    - **Left Side**: Pulsing status dot, bold upcoming session title, subtle badge (`Starts in 10m`), and clean period micro-info (`02:25 – 03:10 PM`).
    - **Right Side**: Clean styled select dropdown (`min-w-[220px] sm:min-w-[260px]`) with concise options (`🕒 02:25 • 11 C (COA-11)`), alongside the indigo "Start Unscheduled Session" button.

### Refinement 4: Maximize Projector View Canvas
- **Problem**: Projector View left large empty black dead space around the workstations instead of expanding to fill 100% of the display window.
- **Resolution**:
  - Wrapped the 2D floor canvas inside `ref={containerRef}` with `w-full h-full flex-1 flex items-center justify-center p-4 overflow-hidden`.
  - Integrated `ResizeObserver` to dynamically measure container client width and height, calculating `scale = Math.min(width / 1360, height / 780)` so the stage maximizes 100% of available viewport bounds while preserving exact 1360x780 layout proportions.
  - Maintained hover-only controls for fullscreen and return-to-cockpit.

---

## 2. Key Files Modified

| File | Changes Made |
| :--- | :--- |
| `components/maintenance/workstations/workstation-node.tsx` | Slimmed chin bar to `h-2.5`, maximized LCD screen area with `flex-1`, updated nominal border to `border-zinc-700/80 dark:border-white/15`. |
| `components/maintenance/workstations/workstation-issue-drawer.tsx` | Shortened preset to `Missing Software`, added subtitles and tooltips, normalized `min-h-[48px]` across all 8 chips. |
| `components/computer-lab/computer-lab-workspace.tsx` | Redesigned standby/upcoming banner into single horizontal row with concise timetable select options. |
| `components/computer-lab/projector-view.tsx` | Added `ResizeObserver` scale wrapper in `w-full h-full flex-1 flex items-center justify-center p-4 overflow-hidden` container. |

---

## 3. Verification Evidence

1. **TypeScript Verification**:
   ```bash
   npx tsc --noEmit
   # Exit code: 0 (0 errors)
   ```

2. **Domain Invariants Suite**:
   ```bash
   node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/unit-domain-invariants.test.mjs
   # Output: 12 tests passed, 0 failed, 5 suites passed
   ```

---

## 4. Invariants Preserved
- **Rule 1**: Zero literal `+` in buttons (uses `<Plus className="h-3.5 w-3.5" />`).
- **Rule 2**: Standardized academic terminology ("Attendance", "Timetable", "Equipment Breakage", "Logbook").
- **Rule 5**: Zero department regressions.
- **Rule 8**: Strict TypeScript verification (0 errors).
