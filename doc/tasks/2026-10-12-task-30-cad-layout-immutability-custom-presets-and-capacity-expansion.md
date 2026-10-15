# Task 30: CAD Floor Architect — Default Layout Immutability, Custom Layout Preset Governance, Canonical Slot Gaps & Lab Capacity Expansion

> **Date**: October 12, 2026  
> **Status**: COMPLETED  
> **Target Subsystems**: CAD Floor Architect (`/admin`), Layout Engine (`lib/workstations/layout-engine.ts`), Component UI (`components/admin/admin-floor-architect.tsx`), Automated Test Suite (`tests/cad-floor-architect.test.mjs`).

---

## 1. Problem Statement & User Requirements

The CAD Floor Architect tool in the Super Admin Console (`/admin`) required critical architecture and UX elevations:
1. **Default Layout Immutability & Custom Preset Naming**:
   - The "Default Lab Layout (48 PCs)" is canonical institutional standard and must **never** be overwritten.
   - When modifications are made with Default selected, clicking "Save Layout" must prompt to save as a custom preset with an editable system-generated name (`Custom 1`, `Custom 2`, etc.).
   - When a custom layout is already active, clicking "Save Layout" must offer two distinct options: **"Update '<Current Custom Name>'"** (in place) or **"Save as New Layout"** (with editable name).
   - If unsaved changes exist (`hasUnsavedChanges === true`), attempting to **Discard**, **Refresh / Reload**, switch presets in the dropdown, or reload/leave the browser page must prompt confirmation to guard against accidental data loss.
2. **Streamlined & Usable Custom Grid Modal**:
   - Strip out cluttered and non-functional options (3/4-sided room variants, sequential prefix algorithms, row rename dictionaries).
   - Provide a clean, elegant layout builder: Corridor structure (2 Sides with center aisle vs. 1 Single block), Rows (2–8), Columns (2–6), Live capacity badge, optional preset name, and a single primary action: **"Apply Custom Grid"**.
3. **Canonical Gaps & Out-of-Range PC Isolation**:
   - Canonical slots $1..48$ correspond strictly to their matching numbered PCs (`PC-01` $\leftrightarrow$ Slot 1, ..., `PC-48` $\leftrightarrow$ Slot 48).
   - If `PC-09` is missing/deleted, Slot 9 (`C1`) must **remain vacant** as an interactive dashed ghost slot.
   - Out-of-range PCs (e.g. `PC-409` or `PC-498`) must **never** steal empty canonical slots (like Slot 9). Instead, they are isolated into an **Extension Row** (Row M at $y = 96$), preserving all canonical 1..48 vacant slots.
   - If `PC-09` is added later, selecting the Default layout must match `PC-09` directly to Slot 9.
   - Key Principle: **Any layout must never miss or drop existing PCs**.
4. **Lab Capacity Expansion ("Add Row")**:
   - Provide direct **"Add Row (L)"** and **"(R)"** actions in the top toolbar to expand room capacity on demand (adding 4 desk positions per row as interactive ghost slots on the canvas that PCs can magnetically snap to).
5. **Direct Layout Switching (Purge Apply Button)**:
   - Remove the `<Apply>` button from the top toolbar.
   - Directly apply the layout immediately upon selecting it in the `<Select>` dropdown (with confirmation guard if unsaved changes exist).

---

## 2. Architectural Implementation

### A. Layout Engine (`lib/workstations/layout-engine.ts`)
- **Canonical Gap & Out-of-Range PC Isolation**:
  - In `calculateAutoArrangement` for `'official_dual_wing'`, PCs with numbers $1..48$ map directly to their canonical desk slot index.
  - Missing PCs (such as missing `PC-09`) leave their canonical slot vacant (`slotIndex = 8`, position `C1`), rendering as interactive ghost slots.
  - Unassigned and out-of-range PCs (such as `PC-498`) are filtered into `unassignedNodes` and placed in `Row M (Extension)` starting at $y = 96$, completely preventing them from stealing vacant slots in rows A–L.
- **Custom Room Grid Positions Preservation**:
  - `CustomRoomGridConfig` updated with optional `positions?: WorkstationPositionUpdate[]` to support exact spatial placement in custom presets.

### B. Admin Floor Architect (`components/admin/admin-floor-architect.tsx`)
- **Default Layout Immutability & Custom Layout Save Dialog**:
  - Added `handleInitiateSaveLayout()`:
    - If `selectedPreset === 'official_dual_wing'`, opens `SaveCustomLayoutModal` in `create_new` mode, proposing `Custom 1` (or next unused index), which is fully editable before saving.
    - If already on a custom preset (`tpl_...`), opens modal in `update_or_new` mode with two options: Update existing preset in place or Save as new preset.
- **Unsaved Changes Guards**:
  - Window `beforeunload` listener prevents accidental tab close or page reload when `hasUnsavedChanges` is true.
  - `handleDiscardChanges` checks `hasUnsavedChanges` and prompts via `window.confirm`.
  - `handleRefreshData` checks `hasUnsavedChanges` and prompts via `window.confirm`.
  - `handlePresetChange(newKey)` checks `hasUnsavedChanges`, prompts before switching, and immediately applies the new layout.
- **Direct Layout Switching (Removed Apply Button)**:
  - Purged `<Button> Apply </Button>` from the toolbar.
  - Switching `<Select value={selectedPreset}>` immediately activates the layout.
- **Lab Capacity Expansion**:
  - Added `handleAddExtensionRow('left' | 'right')` creating 4 ghost desk slots ($M1..M4$) on Left or Right Wing.
  - Added `<Button> Add Row (L) </Button>` and `<Button> (R) </Button>` to the toolbar conforming strictly to Rule 1 (zero literal `+` in text, Lucide icon only).
- **Streamlined Custom Grid Modal**:
  - Simplified options to 2 corridor structures (Dual Wings vs. Single Block), row pills (2–8), column pills (2–6), live capacity calculation, and optional preset name.
  - Consolidated actions into Cancel and "Apply Custom Grid".

---

## 3. Verification & Automated Test Coverage

- **Automated Test Suite**:
  - Added Subtest 8 to `tests/cad-floor-architect.test.mjs`:
    - Tests direct layout switching and absence of `<Apply>` button.
    - Tests `handleInitiateSaveLayout` with default immutability and custom naming.
    - Tests `beforeunload`, discard, and refresh unsaved changes confirmation guards.
    - Tests `handleAddExtensionRow` buttons adhering to Rule 1.
    - Tests `calculateAutoArrangement` leaving missing `PC-09` vacant and placing `PC-498` in Extension Row M.
  - Result: **9/9 test suites passing (0 failures)**.
- **TypeScript Strict Compilation**:
  - `npx tsc --noEmit` passed with **0 errors**.
