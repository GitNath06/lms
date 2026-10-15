# Task 26: CAD Floor Architect Suite & Operational Workspace Separation

- **Date**: 2026-10-12
- **Author**: Antigravity AI
- **Status**: Completed
- **Subsystems Affected**:
  - `app/(dashboard)/admin/page.tsx`
  - `components/admin/admin-floor-architect.tsx` (New)
  - `components/admin/cad-inspector-drawer.tsx` (New)
  - `app/actions/workstations.ts`
  - `components/computer-lab/computer-lab-workspace.tsx`
  - `tests/cad-floor-architect.test.mjs` (New)

---

## 1. Problem Statement & Motivation
Previously:
1. Daily operational floor workspace (`/computer-lab`) exposed an incomplete room layout mode with drag-and-drop handles and toolbar controls, cluttering daily practical logging and roll-calls.
2. The Super Admin Console under Facilities & Safety only had a rudimentary preview (`admin-floor-designer.tsx`) that lacked full enterprise control: there was no ability to add PCs, no ability to delete or remove PCs, no properties inspector drawer, and no layout customization.
3. Deleting or removing PCs had no implementation or safety guardrails in the backend.

---

## 2. Solution & Architectural Changes

### A. Subsystem Relocation
- **Operational Floor Plan (`/computer-lab`)**:
  - Restructured `WorkspaceMode` to strictly `'live' | 'baseline'`.
  - Removed `Room Layout` mode button from top mode switcher.
  - Purged `LayoutEditorBar` rendering and unused drag listeners from `/computer-lab`.
  - Retained viewport viewing controls (Zoom, Pan, Fit, 1:1, Radar Minimap, Terminal Scale).

### B. Enterprise CAD Floor Architect Suite in Admin Console
- **Sub-tab Renamed**: "CAD Floor Architect" under Super Admin Console &rarr; Facilities & Safety.
- **`AdminFloorArchitect` (`components/admin/admin-floor-architect.tsx`)**:
  - **Multi-Lab Facility Selector**: Supports switching between Computer Lab 01, Physics Lab, Chemistry Lab, and Biology Lab.
  - **Precaution Active Lock (Rule 3)**: Guarded by the Super Admin safety lock; layout edits and drags are disabled when locked.
  - **Interactive CAD Viewport**: Smooth zoom ($0.5\times$ to $1.6\times$), pan mode, fit-to-screen, 1:1 reset, and floating radar minimap.
  - **Hardware Provisioning**:
    - **Add PC Modal**: Pre-calculates next sequential terminal label (e.g. `PC-49`), selects form factor (`desktop`, `aio`, `laptop`, `server`), assigns row, and places on floor.
    - **Add Landmark Modal**: Catalog of physical architectural room landmarks (Whiteboard, Projector, Door, Window, Teacher Desk, Pillar, Storage Rack).
    - **Custom Room Grid Generator**: Custom sides (1 to 4), row chips, column chips, alphanumeric naming schemes, template loading and saving.
    - **Math Presets**: Standard 4 Rows, Dual Center Aisle, U-Shape Perimeter, etc.
    - **Terminal Display Scaling & Snap to Grid**: 80%, 100%, 120% scale, and Off, 2%, 4% snapping with visual grid guidelines.
    - **Rule 1 Enforcement**: Zero literal `+` in buttons (uses Lucide `<Plus />` icons with clean text labels).

### C. Technical Inspector Drawer (`components/admin/cad-inspector-drawer.tsx`)
- Slide-out right panel activated by clicking any workstation or landmark on the CAD canvas.
- Real-time editing of:
  - Hardware Label, Desk Position ID, Row Label, Device Type.
  - Exact normalized CAD coordinates (`pos_x`, `pos_y`) with numeric steppers.
  - Operational health telemetry and active fault ticket list.
  - Destructive action: **Remove Workstation** with inline confirmation dialog and Smart Deletion Guard explanation.

### D. Smart Deletion Guard (`app/actions/workstations.ts`)
- Implemented `deleteWorkstation(id: string)`:
  1. Verifies administrative authorization.
  2. Rejects deletion if active unresolved fault tickets exist on the workstation.
  3. Cleans up associated seat plan records and session seat overrides.
  4. Attempts permanent hard deletion, gracefully falling back to soft decommissioning (`is_active = false`) if historical foreign keys constrain.
  5. Records structured audit ledger event.
  6. Revalidates `/admin`, `/computer-lab`, `/maintenance`, and `/maintenance/workstations`.

---

## 3. Verification & Compliance
1. **Automated Test Suite**:
   - `tests/cad-floor-architect.test.mjs` executes and passes 5/5 tests (Admin sub-tab name, `/computer-lab` layout purge, Smart Deletion Guard, Rules 1 & 3 compliance, and Inspector Drawer).
2. **Regression Test Suites**:
   - `tests/unified-session-modal-and-standby-cockpit.test.mjs`, `tests/floor-plan-status-sync.test.mjs`, and `tests/workstation-vacancy-absent-student.test.mjs` all passed 16/16 tests.
3. **TypeScript Compilation**:
   - `npx tsc --noEmit` passed with 0 compile or type errors across the entire codebase.
