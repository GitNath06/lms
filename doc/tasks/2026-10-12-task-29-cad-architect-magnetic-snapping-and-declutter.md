# Task Log: CAD Floor Architect Magnetic Snapping, Capitalized Position IDs & Toolbar Decluttering

**Task ID**: `2026-10-12-task-29-cad-architect-magnetic-snapping-and-declutter`  
**Date**: 2026-10-12  
**Target Subsystems**: CAD Floor Architect (`components/admin/admin-floor-architect.tsx`), CAD Inspector Drawer (`components/admin/cad-inspector-drawer.tsx`), Canvas Controls HUD (`components/computer-lab/canvas-controls-hud.tsx`), Workstations Backend RPC (`app/actions/workstations.ts`), Layout Engine (`lib/workstations/layout-engine.ts`)

---

## 1. Context & User Objectives

The user reported five usability issues in the newly relocated CAD Floor Architect in the Super Admin console (`/admin`):
1. **Dragging PC to Location Grid Alignment**: Dragging a PC onto or near a canonical desk position did not magnetically catch or lock to the exact coordinate $(x, y)$ of that desk slot.
2. **Desk Position ID & Row Label Typing**: Typing desk position ID did not auto-uppercase (e.g. typing `f4` stayed lowercase or mismatched canonical uppercase `F4`), and editing `position_id` in the inspector drawer failed to persist because it was omitted from the local React state update and was ignored in SQL batch updates.
3. **Suppress Inspector Drawer on Drag**: Releasing a dragged PC accidentally opened the technical inspector side drawer because browsers fire a synthetic DOM `click` event on pointerup.
4. **Default Layout PC Number Matching & Vacant Slots**: Applying the default layout previously sorted PCs sequentially, squishing all terminals into slots $1 \dots N$ and filling gaps where PCs had been deleted. Missing/deleted PCs (e.g., `PC-09`, `PC-21`–`PC-24`) must leave their canonical positions completely vacant rather than renumbering/compressing subsequent PCs. Dropdown title shortened to `"Default Lab Layout (48 PCs)"`.
5. **Top Command Toolbar Clutter**: The toolbar was overcrowded with a redundant facility selector dropdown, `Enterprise Suite` and `43 Terminals` badges, and scale/snap controls taking excessive horizontal space.

---

## 2. Technical Changes Implemented

### A. Magnetic Grid Snapping on Drag Release
- In `components/admin/admin-floor-architect.tsx` (`handleWorkstationDragStart` on `pointerup`):
  - Added spatial catch detection against all `canonicalGridSlots`: if a workstation is released within distance $\le 6.5\%$ of any canonical desk slot, it snaps to `targetSlot.pos_x` and `targetSlot.pos_y`.
  - Auto-assigns `row_label = targetSlot.rowLabel` and `position_id = targetSlot.positionId`.
  - If another workstation already occupies that canonical slot, smoothly swaps their coordinates and metadata.
  - If dropped outside the canonical catch radius, applies standard coordinate clamping with `snapGrid`.

### B. Suppress Inspector Drawer on Drag Release
- Implemented `justDraggedRef = useRef<boolean>(false)`.
- On `pointerup` when `hasDragged === true`, sets `justDraggedRef.current = true` with a 200ms expiration timer.
- Both `handleSelectWorkstation` and `handleSelectLandmark` immediately exit early if `justDraggedRef.current` is true, ensuring the side drawer only opens on genuine mouse clicks.

### C. Desk Position ID Auto-Uppercase & Row Label Capitalization
- In `components/admin/cad-inspector-drawer.tsx`:
  - `wsPositionId` input: `onChange={(e) => setWsPositionId(e.target.value.toUpperCase())}` with `uppercase font-mono` styling.
  - `wsRowLabel` input: `onChange={(e) => setWsRowLabel(e.target.value.replace(/\b\w/g, (c) => c.toUpperCase()))}` for clean Title Case.
- In `components/admin/admin-floor-architect.tsx`:
  - Fixed `handleDrawerUpdateWorkstation`: properly spread `position_id: updated.position_id || null` into `localWorkstations` and `selectedWs`, and flagged `setHasUnsavedChanges(true)`.
  - In Add Workstation modal: added auto-uppercase `newWsPositionId` and auto-capitalize `newWsRow`.
- In `app/actions/workstations.ts` (`batchUpdateWorkstationPositions`):
  - Refactored SQL query so that `row_label` and `position_id` are explicitly updated whenever passed (handling empty/cleared strings properly rather than preserving old values with `COALESCE`).

### D. Layout Engine Canonical Slot Alignment ($PC-N \leftrightarrow Slot-N$)
- In `lib/workstations/layout-engine.ts` (`calculateAutoArrangement`):
  - Workstations with numeric labels map directly to `SlotIndex = pcNum - 1`.
  - Missing/deleted PCs (e.g. `PC-09`, `PC-21`–`PC-24`) leave their canonical desk slots completely vacant as interactive ghost slots.
  - Renamed preset to `"Default Lab Layout (48 PCs)"`.

### E. Top Command Toolbar Decluttering & Canvas HUD Integration
- Top command bar cleaned up:
  - Removed redundant facility selector dropdown (locked to Computer Lab 01).
  - Purged `Enterprise Suite` and terminal count badges.
  - Embedded `terminalScale` (80% / 100% / 120%) and `snapGrid` (Off / 2% / 4%) directly into the floating `CanvasControlsHud` on the top-right corner of the canvas.
  - Retained essential high-clarity controls: `CAD Floor Architect` title, unsaved changes pulse badge, `Add PC`, `Add Landmark`, `Custom Grid`, preset dropdown + `Apply`, `Discard`, `Save Layout`, reload button, and `Open Live Lab`.

---

## 3. Verification & Invariants

- **Test Suite**: `tests/cad-floor-architect.test.mjs` passed with 8/8 tests.
- **Strict TypeScript**: `npx tsc --noEmit` passed with 0 compile errors.
- **Rule 1 (No literal `+` in button text)**: Verified intact across all buttons (`<Plus className="h-3.5 w-3.5" />`).
- **Rule 3 (Precaution Active)**: Kept safety guard and warning banner intact for locked mode.
