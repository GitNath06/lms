# Task 103: Mobile Dock Z-Index Layering, Sticky Bar Clearance & Unobstructed Modal Stacking

**Execution Date**: 2026-11-12  
**Status**: Completed  
**Branch**: `feature/student-terminal-agent`  
**Target Environment**: Production (`https://lms-rrlss.vercel.app`)

---

## 1. Context & Identified Defects

During mobile and live device testing on small viewports (360px–390px, iPhone SE, Pixel 7, iPhone 14), teachers reported:
1. **Dock Occlusion of Modal Actions**: The mobile bottom navigation dock (`MobileBottomNav`) sat on top of opened modals and drawers (`WorkstationIssueDrawer`, `ReportIncidentModal`, `SeatPlannerTab` modals, `StationQuickPopover`, `PracticalDetailModal`, `IncidentDetailDrawer`), covering buttons like "Cancel", "File Incident Report", "Confirm Swap", and "Save".
2. **Sticky Submit Bar Overlap**: On `/records/new`, the action bar used `sticky bottom-0 z-30`, which caused it to stick behind the 64px `MobileBottomNav` fixed dock.
3. **Button Text Squishing & Wrapping**: Long labels such as "Save & Submit Practical Log" in constrained flex rows caused horizontal overflow and awkward line breaks on narrow phone screens.

---

## 2. Key Architecture & Fixes Implemented

### A. CSS Stacking Context & Z-Index Layering Standard
- **Dock Layering (`MobileBottomNav`)**: Lowered from `z-50` to **`z-30`**.
- **Header Topbar**: Standardized at **`z-40`**.
- **Modal & Drawer Overlays**: Elevated all modal, drawer, sheet, and popover backdrops to **`z-[70]`** (and nested confirmation dialogs to **`z-[75]`**, command palette to **`z-[80]`**).
- **Result**: Because all modal overlays have `z-[70]` > `z-30`, their full-screen dark backdrops (`fixed inset-0 bg-black/...`) completely cover both the top header and the bottom navigation dock. When any modal or drawer is open, modal action buttons are 100% visible and unobstructed.

### B. Route-Aware Dock Suppression
- In `components/layout/mobile-bottom-nav.tsx`, added route-level suppression:
  ```tsx
  if (pathname?.startsWith('/records/new') || pathname?.startsWith('/print')) {
    return null
  }
  ```
- Maximizes screen real estate for intensive creation forms like practical session logging and avoids any dual-dock confusion.

### C. Sticky Submit Bar Safe-Area Clearance
- In `app/(dashboard)/records/new/log-form.tsx`, updated the sticky action bar to:
  ```tsx
  sticky bottom-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] md:bottom-0 z-30
  ```
- Adds `shrink-0` to Cancel and responsive truncation on Submit:
  - Phone: `Submit Log`
  - Desktop: `Save & Submit Practical Log`

### D. Live Cockpit Bar Mobile Ergonomics
- In `components/computer-lab/live-cockpit-bar.tsx`, added responsive button labels:
  - Phone: `Submit Log` / `Update Log`
  - Desktop: `Save & Submit Practical Log` / `Update Session Log`
- Enforced `min-h-[38px]` and `touch-manipulation` for quick aisle tapping.

### E. Playwright Mobile Configuration & E2E Regression Suite
- In `playwright.config.ts`, added native device projects:
  - `mobile-chrome` (`Pixel 7`)
  - `mobile-safari` (`iPhone 14`)
- In `tests/e2e/05-mobile-375x812-verification.spec.ts`, added tests asserting:
  - `MobileBottomNav` has `z-index <= 30` and stays below modal overlays.
  - `MobileBottomNav` is hidden on `/records/new`.
  - Zero document horizontal overflow on 375px screens.

---

## 3. Verification & Evidence

1. **TypeScript Typecheck**:
   - `node ./node_modules/typescript/bin/tsc --noEmit`
   - **Result**: Passed with 0 errors.

2. **PWA & Offline Standards Test Suite**:
   - `node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/pwa-and-offline-engine.test.mjs`
   - **Result**: 5 test suites, 20 assertions passed (including `z-30` verification, route suppression on `/records/new`, and safe-area clearance in `log-form.tsx`).

---

## 4. Modified Files Register

- `components/layout/mobile-bottom-nav.tsx`
- `app/(dashboard)/records/new/log-form.tsx`
- `components/computer-lab/live-cockpit-bar.tsx`
- `components/maintenance/workstations/workstation-issue-drawer.tsx`
- `components/dashboard/report-incident-modal.tsx`
- `components/maintenance/workstations/seat-planner-tab.tsx`
- `components/computer-lab/station-quick-popover.tsx`
- `components/records/practical-detail-modal.tsx`
- `components/records/incident-detail-drawer.tsx`
- `components/computer-lab/start-adhoc-session-modal.tsx`
- `components/calendar/academic-calendar-modal.tsx`
- `components/admin/cad-inspector-drawer.tsx`
- `components/roster/roster-import-modal.tsx`
- `components/roster/batch-photo-import-modal.tsx`
- `components/command-palette.tsx`
- `components/pwa/pwa-install-prompt.tsx`
- `playwright.config.ts`
- `tests/e2e/05-mobile-375x812-verification.spec.ts`
- `tests/pwa-and-offline-engine.test.mjs`

