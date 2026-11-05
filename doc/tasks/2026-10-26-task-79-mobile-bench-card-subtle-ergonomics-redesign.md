# Task Log: Mobile Bench List PC Card Subtle Ergonomics Redesign

- **Date**: 2026-10-26
- **Task ID**: Task 79
- **Scope**: Mobile Workstation Bench List view in `/computer-lab` (`<768px` / mobile Bench List mode)
- **Files Modified**:
  - `components/computer-lab/mobile-bench-rollcall-view.tsx`
  - `components/computer-lab/computer-lab-workspace.tsx`

---

## 1. Context & Motivation
In the mobile responsive view of `/computer-lab` (specifically the Bench List view), the workstation cards were visually heavy and cluttered:
- A bulky yellow `[⚠️ Report Fault]` button stretched across every single card.
- The terminal's long physical position string (e.g., `Row H (Right)`) consumed valuable mobile horizontal width.
- Vacant stations rendered a heavy 40px box button (`[ Vacant ]`).
- Student avatars were absent from the bench list cards, forcing users to rely solely on text names without visual recognition.
- Tapping to report issues was tied to an obtrusive inline button rather than a clean card action opening the unified `WorkstationIssueDrawer`.

---

## 2. Key Architecture & UI Changes

### A. Sleek Single-Row Horizontal Flex Card
- Redesigned each workstation bench card into a compact horizontal layout:
  `p-3 rounded-2xl glass-card border flex items-center justify-between gap-3 active:scale-[0.99] transition-all cursor-pointer select-none`
- Contextual presence styling:
  - Present: `border-emerald-500/30 bg-emerald-500/[0.03] dark:bg-emerald-950/10`
  - Absent: `border-rose-500/30 bg-rose-500/[0.03] dark:bg-rose-950/10`
  - Unassigned / Standby: Clean glass surface with neutral border.

### B. Top-Left Corner Badges & 2-Letter Coordinate
- **Hardware Badge**: Compact `PC-30` badge with crisp contrast.
- **Status LED Dot**:
  - 🟢 Operational: `h-2 w-2 rounded-full bg-emerald-500`
  - 🟡 Flagged: `h-2 w-2 rounded-full bg-amber-500 ring-2 ring-amber-500/20`
  - 🔴 Under Repair: `h-2 w-2 rounded-full bg-rose-500 ring-2 ring-rose-500/20`
- **Micro 2-Letter Grid Coordinate**:
  - Monospace pill (e.g. `H2`, `A3`) via `getShortAddress()`.
  - Intelligently extracts `position_id` or derives letter from `row_label` (`Row H (Right)` &rarr; `H`) and column index (`((pcNum - 1) % 4) + 1`), completely hiding bulky strings like `Row H (Right)`.
- **Active Faults Pill**: Small, subtle amber/rose indicator pill (`1 Issue` or `Under Repair`) next to the PC badge, completely removing the bulky yellow button.

### C. Left-Center Middle Content
- **Assigned Student**:
  - Full Name prominently displayed: `text-sm font-bold font-heading text-zinc-900 dark:text-white truncate`.
  - Micro-status subtitle:
    - If active fault: Displays fault title with micro alert icon.
    - If live session: `"Present • Tap to toggle / report"` or `"Absent • Tap to toggle / report"`.
    - If relocated: `"Moved from ${seat.originalWorkstationLabel}"`.
- **Unassigned Station**:
  - Muted italic `"Vacant Bench"` (`text-xs text-zinc-400 dark:text-slate-500 italic`).
  - Subtitle: `"Tap to report issue or allocate"`.

### D. Right Side Column (Student Avatar + Roll Number)
- **Assigned Student**:
  - Circular avatar (`h-10 w-10 rounded-full object-cover ring-2`):
    - Emerald ring if present (`ring-emerald-500 ring-offset-1`).
    - Rose ring if absent (`ring-rose-500 ring-offset-1`).
    - Fallback monogram initials (`getInitials(seat.fullName)`).
  - Directly below avatar: `Roll #${seat.rollNumber}` in `text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-1 tabular-nums`.
  - 1-tap touch target on the avatar toggles attendance directly during live sessions with `e.stopPropagation()`.
- **Unassigned Station**:
  - Replaced bulky 40px Vacant button with a subtle dashed pill: `text-[10px] font-mono text-zinc-400 dark:text-slate-500 px-2 py-1 rounded-lg border border-dashed border-zinc-200 dark:border-white/10`.

### E. Card Tap Action Sheet / Drawer Wiring
- Tapping anywhere on the mobile card invokes `onViewWorkstation(workstation)`, which sets `selectedWorkstationId` and opens the unified `WorkstationIssueDrawer`.
- Allows 1-tap fault reporting, viewing active issues, and student relocation.

---

## 3. Verification & Compliance
- **TypeScript**: `npx tsc --noEmit` passed with 0 compile or type errors.
- **Unit & Domain Tests**: All 52/52 tests in `npm run test:unit` passed.
- **Desktop Invariant**: The desktop CAD floor plan and `workstation-node.tsx` remain untouched.
