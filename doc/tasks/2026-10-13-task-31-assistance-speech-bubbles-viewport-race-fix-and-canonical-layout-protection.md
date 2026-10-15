# Task Record: Assistance Speech Bubbles, Viewport Pointer Race Fix, and Canonical Layout Protection

- **Task ID**: `2026-10-13-task-31-assistance-speech-bubbles-viewport-race-fix-and-canonical-layout-protection`
- **Date**: 2026-10-13
- **Author**: Antigravity Assistant & Lab In-Charge
- **Status**: Completed (Zero TypeScript Errors & 9/9 Test Suites Passing)

---

## 1. Problem Statement & User Drivers

1. **`img2`: Default Layout Modification Protection**:
   - The Default Lab Layout (48 PCs dual-wing) must never be permanently modified.
   - Any layout modifications initiated while on Default must automatically branch to a system-generated editable draft (e.g. `Custom 1`), protecting the pristine canonical layout.
   - Re-selecting or resetting to "Default Lab Layout" must reliably restore the pristine canonical 48-PC coordinates, clearing added extension rows.
   - Unsaved layout changes must trigger clear confirmation dialogs before discard or refresh.
   - When saving from an existing custom preset, the user must be offered the choice to update the preset or save as a new layout.

2. **`img3`: Viewport Pointer Null Race Condition & Row Coordinate Misalignment**:
   - Runtime crash `TypeError: Cannot read properties of null (reading 'panX')` occurred at `hooks/use-canvas-viewport.ts:277` when panning or dragging after adding extension rows due to state updater callback dereferencing `dragStartRef.current` asynchronously after it had been nulled by pointerup.
   - Adding rows (`handleAddExtensionRow`) placed slots at misaligned coordinates (`xStart = 10 / 56`, `xStep = 11.33`) instead of matching canonical Left Wing columns (`6, 18, 30, 42`) and Right Wing columns (`58, 70, 82, 94`), and vertical spacing was not aligned with the $12\%$ step of existing rows A–F ($y = 28..88$).

3. **`img1`: Student Assistance Notification Bar Replacement & Sleek Node Highlighting**:
   - The user requested removing the full-width horizontal notification bar across the top/cockpit (`TerminalAssistanceQueue`).
   - Instead: Highlight the specific PC node directly on the floor plan canvas with a high-end, sleek floating speech-bubble message displaying student name, roll number, issue title, description, and a 1-tap "Acknowledge" button.
   - Instead of a harsh solid rectangular amber border (`border-amber-400`), implement an aesthetic, professional glowing radar aura and ambient luminous backlight.

---

## 2. Technical Implementation Details

### A. Viewport Pointer Null Safety (`hooks/use-canvas-viewport.ts`)
- Fixed `handlePointerMove` to synchronously capture `dragStart = dragStartRef.current` into a local variable before computing pan coordinates:
  ```ts
  const dragStart = dragStartRef.current
  if (!isPanning || !dragStart) return
  e.preventDefault()
  const dx = e.clientX - dragStart.x
  const dy = e.clientY - dragStart.y
  const targetPanX = Math.round(dragStart.panX + dx)
  const targetPanY = Math.round(dragStart.panY + dy)
  setViewport((prev) => ({
    ...prev,
    pan: { x: targetPanX, y: targetPanY },
  }))
  ```

### B. Surgical Column & Row Alignment for Capacity Extensions (`components/admin/admin-floor-architect.tsx` & `lib/workstations/layout-engine.ts`)
- Aligned `handleAddExtensionRow` to exact canonical wing column $x$-coordinates:
  - Left Wing: $x \in \{6, 18, 30, 42\}$ ($\text{xStart} = 6, \Delta x = 12\%$).
  - Right Wing: $x \in \{58, 70, 82, 94\}$ ($\text{xStart} = 58, \Delta x = 12\%$).
  - Vertical spacing: $y = 100 + \text{sideExtRowCount} \times 12\%$ (Row 1 at $100\%$, Row 2 at $112\%$, matching rows A–F/G–L step of $12\%$).
- Aligned out-of-range PCs (e.g. `PC-490`) in `calculateAutoArrangement` to exact column positions below Row F/L.

### C. Canonical Layout Immutability & Automatic Draft Branching (`components/admin/admin-floor-architect.tsx`)
- Added `triggerLayoutModification`:
  - When any modification (dragging workstation, dragging landmark, adding row, ghost slot click, custom grid apply) occurs while on `official_dual_wing`, automatically transitions to `draft_custom` with a system-generated name like `Custom 1` and marks `hasUnsavedChanges = true`.
- Added `handleApplyDefaultCanonicalLayout`:
  - Re-calculates and snaps all workstations back to canonical 48-PC coordinates, removes extension ghost slots, and resets preset to `official_dual_wing`.
- Added dedicated `Reset Default` button in the top toolbar.
- In layout dropdown: displays `{customPresetName} (Draft)` when in draft mode.
- In `handleInitiateSaveLayout`:
  - From `draft_custom`: modal opens prefilled with editable `customPresetName`.
  - From saved custom preset: offers choice between "Update Current Preset" or "Save as New Layout".
- Discard and Refresh actions confirm before abandoning unsaved modifications.

### D. Workstation Node Assistance Bubble & Ambient Aura (`components/maintenance/workstations/workstation-node.tsx`)
- Purged harsh solid rectangular border `border-amber-400`.
- Added high-tech layered luminous aura:
  - `statusBorder = 'border-amber-400/70 shadow-[0_0_24px_rgba(245,158,11,0.5)]'`
  - Animated outer radar wave ping: `animate-ping opacity-35 duration-1000`
  - Soft luminous backlight aura: `bg-amber-500/15 blur-xs animate-pulse`
  - Floating speech-bubble card anchored above the monitor with downward pointer arrow:
    - Glowing amber beacon dot & station header
    - 1-click `Acknowledge` action (with `e.stopPropagation()`)
    - Bold issue title, student name, and roll number
- In `components/computer-lab/computer-lab-workspace.tsx`:
  - Purged top horizontal `<TerminalAssistanceQueue />` banner.
  - Linked matched assistance requests to `WorkstationNode` with real-time dismissal upon acknowledgement.

---

## 3. Verification & Compliance

1. **Test Suite**:
   - `node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/cad-floor-architect.test.mjs`
   - All 9 subtests passed with 0 failures.
2. **TypeScript Strict Type Check**:
   - `npx tsc --noEmit` exited with code 0 (zero errors across all routes).
3. **Institutional UI Rules Adherence**:
   - Rule 1: Zero literal `+` in buttons (all actions use Lucide `<Plus />`).
   - Rule 3: Kept `Precaution Active` safety lock intact.
   - Glassmorphic `.glass-card` surfaces without GPU thrashing.
