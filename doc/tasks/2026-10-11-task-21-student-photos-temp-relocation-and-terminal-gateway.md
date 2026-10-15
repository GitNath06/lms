# Task Log: 21 — Student Avatars, Temporary Relocation Invariant & Zero-Login Terminal Identity Binding

- **Date**: 2026-10-11
- **Task ID**: `TASK-21`
- **Status**: Completed & 100% Validated
- **Target Modules**:
  - `components/maintenance/workstations/workstation-node.tsx`
  - `components/computer-lab/displaced-students-queue.tsx`
  - `components/computer-lab/computer-lab-workspace.tsx`
  - `app/actions/live-session.ts`
  - `app/actions/terminal.ts`
  - `app/terminal/[code]/page.tsx`
  - `components/terminal/student-terminal-view.tsx`
  - `tests/live-session-relocation.test.mjs`

---

## 1. Context & User Problem Statement

During live computer laboratory sessions, several critical UX and data integrity issues were identified:
1. **Student Avatars Missing**: Student photos/avatars were not rendering properly on living LCD workstation nodes when seated.
2. **Bulky Displaced Student Triage Box**: When a workstation had critical hardware/software faults, the displacement alert box was excessively bulky and intrusive, and failed to collapse/refresh once a temporary seat was assigned.
3. **Temporary Relocation UI Distinction**: Temporarily relocated students needed a distinct, immediately recognizable visual indicator on their node so faculty can distinguish normal baseline seating from temporary seatings.
4. **Dual-Seating Ghost Bug**: When student *Himani* (Roll 07) was temporarily relocated from broken `PC-07` to operational `PC-20`, both nodes showed her seated simultaneously.
5. **Dynamic Student Terminal Identity Binding**: When a student was relocated to `PC-20`, opening the zero-login terminal gateway (`/terminal/PC-20`) was not recognizing her relocated identity; it was either prompt-less or pointing to the original baseline student. Fault reporting needed to be automatically submitted on behalf of the active relocated student on `PC-20`.

---

## 2. Technical Solution & Key Changes

### 2.1 Student Avatar Rendering on Living Nodes (`workstation-node.tsx`)
- Updated workstation node canvas element to properly decode and display student photo URLs (`photoUrl` / `photo_url`) with fallback to stylized initial avatars.
- Added tactile status borders and roll badges reflecting attendance and session state.

### 2.2 Compact Displaced Student Triage Queue (`displaced-students-queue.tsx`)
- Redesigned the triage queue into a compact, professional floating widget:
  - Collapses smoothly into a micro-badge when 0 students remain unassigned.
  - Lists displaced students with broken station label, detected issue, and 1-tap quick destination PC picker.
  - Automatically updates and dismisses once temporary assignment succeeds.

### 2.3 Distinct Visual Indicator for Temporarily Relocated Nodes
- Added amber relocation halo and `TEMP` badge to nodes with active session overrides (`session_override: true`).
- Node tooltip and label clearly display: `"Temporarily relocated from PC-07"`.

### 2.4 Single-Seat Relocation Invariant (`live-session.ts`)
- In `getLiveSessionContext`, enforced an invariant: when a Tier 2 session override is applied for student $S$ to workstation $W_{new}$, any prior workstation $W_{old}$ holding student $S$ is immediately vacated:
  ```ts
  for (const [existingWsId, existingEntry] of Object.entries(effectiveSeatPlan)) {
    if (existingEntry.enrollmentId === student.enrollmentId && existingWsId !== override.workstation_id) {
      delete effectiveSeatPlan[existingWsId]
    }
  }
  ```
- Guaranteed zero ghost duplicate seatings across both database snapshots and canvas DOM nodes.

### 2.5 Zero-Login Terminal Gateway Relocation Binding (`app/actions/terminal.ts` & `app/terminal/[code]/page.tsx`)
- Updated `getTerminalContext(code)`:
  - First queries `session_seat_overrides` for today's active schedule on the machine.
  - If a temporary override exists, binds identity to the relocated student:
    `"Are you Himani (Roll 07)? [Temporarily Assigned to PC-20]"`
  - Issue reports logged via terminal automatically tag both `PC-20` and the active student identity.

---

## 3. Verification & Compliance
- `npx tsc --noEmit`: 0 errors.
- Test suites passed with 100% assertions green.
