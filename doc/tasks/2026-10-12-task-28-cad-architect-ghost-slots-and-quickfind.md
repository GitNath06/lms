# Task 28: CAD Floor Architect Ghost Slots, Minimal Quick-Find, and Preset Governance

**Date**: 2026-10-12  
**Status**: Completed  
**Author**: Antigravity Agent  
**Relevant Files**:
- [components/admin/admin-floor-architect.tsx](file:///d:/Projects/LMR/components/admin/admin-floor-architect.tsx)
- [lib/workstations/layout-engine.ts](file:///d:/Projects/LMR/lib/workstations/layout-engine.ts)
- [tests/cad-floor-architect.test.mjs](file:///d:/Projects/LMR/tests/cad-floor-architect.test.mjs)

---

## 1. Context & Objectives

Users identified 4 key issues in CAD Floor Architect:
1. **Workstation Provisioning Dropping in Center**: Adding a new workstation dropped it at `(50%, 50%)` in the center instead of prompting for the target row, desk position ID, and coordinates.
2. **48-Element Flat Dropdown**: The terminal picker in Section 2 was an unwieldy native `<select>` containing 48 flat options without filtering, wing groupings, or status cues.
3. **Ghost Slots on Canvas**: When a PC was deleted (e.g. PC-09 on Row C), the empty grid slot had no interactive indicator. The user requested hoverable dashed slots with `+` buttons to provision directly onto that position.
4. **Preset Clutter & Current Layout**: Mathematical presets list was cluttered with unwanted layouts ("Dual Island Pods", "Triple Pods", "U-Shape Perimeter Flow") while missing the current standard layout and the ability to save custom presets with custom names and structures.

---

## 2. Architectural Changes & Key Implementations

### A. Canonical & Empty Grid Slots on CAD Canvas
- Utilized `generateRoomGridSlots` to determine the canonical 48 stations for the laboratory (Left Wing Rows A–F cols 1–4, Right Wing Rows G–L cols 1–4).
- Added `emptyGridSlots` memoization detecting canonical positions not currently occupied by any workstation (within 4.5% tolerance).
- Rendered interactive dashed ghost slots on canvas with chamfered geometry, subtle indigo glow on hover, `<Plus />` icon, and slot position labels (`PC-09`, `C1 • Row C`).
- Implemented `handleGhostSlotClick(slot)` pre-filling label, row assignment, position ID, and coordinates before opening the Add Workstation modal.

### B. Add Workstation Modal Upgrades
- Added "Target Grid Location" selector listing empty canonical slots (with recommended hardware labels) and an option for manual custom coordinates.
- Added explicit inputs for:
  - Row Assignment (`Row C (Left)`)
  - Desk Position ID (`C1`, `A3`)
  - X / Y Coordinate steppers (%)
  - Hardware device form factor
- Updated `handleCreateWorkstation` to supply `pos_x`, `pos_y`, `row_label`, and `position_id` to `createWorkstation` server action.

### C. Minimal Quick-Find Combobox (Image 2 Redesign)
- Replaced the 48-item flat native `<select>` with a high-density Quick-Find search input with autocomplete popover.
- Grouped stations into distinct semantic categories:
  - **Instructor Console** (Podium)
  - **Left Wing (Rows A–F)**
  - **Right Wing (Rows G–L)**
- Added real-time filtering across terminal hardware labels, row names, and position IDs.
- Displayed live operational health status LEDs (Emerald: operational, Amber: flagged, Cyan: under repair).
- Added a selected terminal chip with quick clear (`X`) and search toggle.

### D. Presets Cleanup & Custom Presets Saving (Image 4 Redesign)
- Pruned `LAYOUT_PRESETS` in `lib/workstations/layout-engine.ts` to strictly feature `official_dual_wing` ("Official Institutional Layout (Dual-Wing · 48 PCs)").
- Upgraded the top toolbar preset dropdown to display:
  - **Official Standards** (`Official Institutional Layout (Dual-Wing · 48 PCs)`)
  - **Saved Custom Presets** loaded from `public.lab_layout_templates`.
- Added a delete button (`Trash2`) for saved custom presets.
- Added a "Save as Named Preset" section to the Custom Room Grid modal, allowing users to save custom configurations with user-defined names and descriptions.

---

## 3. Verification & Compliance
- **Rule 1 Compliance**: Zero literal `+` in buttons or labels (`<Plus className="h-4 w-4" />` used everywhere).
- **Rule 3 Compliance**: "Precaution Active" safety toggle preserved intact.
- **Rule 8 Strict TypeScript**: `npx tsc --noEmit` passed with 0 compile errors.
- **Rule 20 Node.js Tests**: `tests/cad-floor-architect.test.mjs` and related test suites passed with 100% success.
