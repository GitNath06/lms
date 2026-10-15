# Task 32: Institutional Default Modification, Warning Confirmation & Layout Discard Synchronization

**Date**: 2026-10-13  
**Status**: Completed  
**Branch**: `new-floor-features`  

---

## 1. Problem Statement & Root Cause Analysis

### Issues Identified by User
1. **Unsaved Changes Flag on Layout Switch (`img1`)**:
   - Switching between layout presets and back to "Default Lab Layout (48 PCs)" triggered `CAD Floor Architect [Unsaved Changes]`.
   - The user had not moved any PC manually, so they clicked **"Discard"**.
2. **Layout Disruption upon Discard (`img2`)**:
   - Clicking "Discard" mangled the workstation coordinates across both wings:
     - Left Wing: `PC-10..13` shifted up to Row C, `PC-14..17` to Row D, `PC-26..29` shifted into Row F.
     - Right Wing: `PC-30..33` on Row G, `PC-46..48 + PC-490` on Row K, and `PC-25` got banished to Row L at the bottom.
3. **Institutional Default Modification Requirement**:
   - The user explicitly requested the ability to modify/update the institutional default layout with a proper warning confirmation when adding or deleting workstations:
     *"also, i think we need to have modify feature with necessary warning to edit that default one too , because we are like gonna add or delete pcs which is causing the pc to adjust accordingly"*

### Root Cause
1. **Sequential Mapping in `calculateCustomRoomLayout`**:
   - `calculateCustomRoomLayout` mapped `studentNodes` to `slots` purely sequentially (`for (let idx = 0; idx < activeCount; idx++) { const node = studentNodes[idx]; const slot = slots[idx]; ... }`).
   - Because `PC-09` and `PC-21..24` are absent from `studentNodes`, `PC-10` took Slot 9 (C1), `PC-13` took Slot 12 (C4), `PC-26..29` took Row F (Left), and `PC-25` ended up in Row L (Right).
2. **Unconditional `setHasUnsavedChanges(true)` on Preset Selection**:
   - `handleApplyDefaultCanonicalLayout` and `handlePresetChange` hardcoded `setHasUnsavedChanges(true)`, making the UI claim there were unsaved changes even when the layout already matched the canonical default baseline.
3. **Rigid Immutability Lockout**:
   - The Default Lab Layout was locked as read-only. Dragging a terminal forcefully kicked the admin into a draft preset, preventing the Super Admin from updating the institutional baseline in the database when terminals were provisioned or decommissioned.

---

## 2. Solutions Implemented

### 1. Smart Gap Preservation in `calculateCustomRoomLayout` (`lib/workstations/layout-engine.ts`)
- **Direct Coordinate Preservation**: If `config.positions` is present, nodes map directly to their saved coordinates.
- **Terminal Number & Position ID Matching**: Nodes matching `/PC-(\d+)/i` or position IDs map to their corresponding room slot (`slotIndex + 1 = pcNum`), leaving slots for missing/deleted terminals (`PC-09`, `PC-21..24`) completely vacant.
- **Extension Isolation**: Out-of-range terminals (`pcNum > slots.length` or `PC-490`) are never placed into vacant canonical slots; they are routed cleanly to extension rows (`Row M`, `posId = EXT-1`).

### 2. Super Admin "Modify Institutional Default" with Warning Confirmation (`components/admin/admin-floor-architect.tsx`)
- **Warning-Guarded Save Modal**: When saving while on the Default Layout (or custom draft), Super Admin is presented with two clear choices:
  - **Option 1: Update Institutional Default Layout** (Amber warning banner):
    *"Warning: This will modify the official default layout in the database. All live lab sessions, student seating plans, and default layout resets will reflect these updated workstation coordinates."*
    Action: `[Check] Confirm & Update Institutional Default`
  - **Option 2: Save as Custom Layout**: Allows saving as a named custom preset (e.g. `Custom 1`).
- **Option 3 Promotion for Custom Templates**: Saved custom templates also include an option to promote to Institutional Default with the same warning guard.
- **Database Baseline Synchronization**:
  - `handleConfirmUpdateInstitutionalDefault` writes coordinates directly to PostgreSQL `public.workstations` via `batchUpdateWorkstationPositions`.
  - In-memory `boardData.workstations` is synchronized with `localWorkstations`, guaranteeing that clicking "Discard" or refreshing the view preserves the pristine saved state.

### 3. Intelligent Unsaved Changes Detection (`areWorkstationsMatching`)
- Implemented `areWorkstationsMatching(a, b)` helper comparing position ($x, y$ within 0.5px tolerance), label, row label, and position ID.
- In `handleApplyDefaultCanonicalLayout`:
  - Compares the canonical arrangement against `boardData.workstations`.
  - If identical, `hasUnsavedChanges` is set to `false`, eliminating the false "Unsaved Changes" indicator shown in `img1`.
- In `triggerLayoutModification`:
  - Marks `hasUnsavedChanges = true` without forcefully kicking the admin off the default layout into a draft preset.

---

## 3. Verification & Compliance

1. **Test Suite Execution**:
   - `node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/cad-floor-architect.test.mjs`
   - **Result**: 9/9 tests passed (100% pass rate).
2. **Strict TypeScript Compilation**:
   - `npx tsc --noEmit`
   - **Result**: 0 errors across the entire codebase.
3. **Critical User Rules Adherence**:
   - **Rule 1 (No literal `+` in buttons)**: Fully preserved; all buttons use Lucide `<Plus />`, `<Bookmark />`, or `<Check />`.
   - **Rule 3 (`Precaution Active`)**: Safety lock switch remains intact and respected.
   - **Rule 8 (Strict TypeScript)**: 0 errors verified.
