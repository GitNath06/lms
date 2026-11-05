# Mobile Responsiveness Visual Audit — Master Forensic Inspection (Screenshots 1–15)

**Date**: 2026-10-24  
**Audit Target**: Mobile Viewport Ergonomics ($360\text{px}-430\text{px}$) across iPhone SE ($375\text{px}$), Samsung Galaxy ($360\text{px}$), and modern viewports ($390\text{px}-430\text{px}$)  
**Components Covered**: 
- **Dashboard**: Main `/`, KPI Grid, Facility Cards, Equipment Breakages List (`incident-registry-card.tsx`)
- **Records & Reporting**: Practical Filters (`practical-filter-bar.tsx`), Equipment Breakage Data Grid (`incident-records-table.tsx`)
- **Drawers & Modals**: Incident Resolution & Triage Drawer (`incident-detail-drawer.tsx`)
- **System Telemetry & Notifications**: Notification Popover Feed (`notification-bell.tsx`)
- **Computer Lab Operations**: Workstation CAD Canvas & Seating Plan (`computer-lab-workspace.tsx`, `workstation-node.tsx`)
- **Maintenance & Diagnostics**: Maintenance Workbench Header & KPI Grid (`maintenance-client-page.tsx`), Fault Ticket Feed (`diagnostics-triage-hub.tsx`)
- **Super Admin Console**:
  - Teacher & Staff Directory Table (`user-access-manager.tsx`)
  - Curriculum Sub-Navigation Clutter (`app/(dashboard)/admin/page.tsx`)
  - Academic Years Operational Cycles & Raw ISO Timestamps (`academic-years-manager.tsx`)
  - Horizontal Viewport Drift & Blowout Defect (`app/(dashboard)/admin/page.tsx`)
  - Dual Calendar Miti Picker & Truncated Chips (`dual-calendar-picker.tsx`)

---

## 1. Batch 1 (Screenshots 1–5): Dashboard, Records & Incident Resolution

### Screenshot 1: Dashboard Top Fold & Schedule Telemetry
- **Component**: `app/(dashboard)/page.tsx`, `components/layout/live-clock-header.tsx`, `components/dashboard/kpi-card-grid.tsx`
- **What is Working Well**:
  - Header row (Hamburger menu, Nepali Bikram Sambat Date, Search, Notifications, Theme toggle) fits within ~375px without wrapping.
  - KPI metric cards (`SLOTS`, `ATTENDANCE`, `LOGGED`) stack cleanly in a vertical layout.
  - The Break/Recess banner ("No sessions scheduled today") is crisp, well-spaced, and informative.
- **Friction Points**:
  - **Bottom Dev Bar / Overlay Collision**: The bottom floating rig (`[N]`, `Test Time ^`, `● Station Rig ^`) directly collides with and obscures the session feed tab headers (`Upcoming | Pending | Logged`).
  - **Content Padding**: The bottom of the scrollable container lacks sufficient safe bottom padding (`pb-20` to `pb-28`), leaving lower interactive elements susceptible to obstruction by floating bars or mobile browser UI.

---

### Screenshot 2: Dashboard Facilities & Equipment Breakages List
- **Component**: `components/dashboard/incident-registry-card.tsx`, `components/dashboard/lab-facility-card.tsx`
- **What is Working Well**:
  - Laboratory facility cards (`Computer Lab`, `Physics Lab`) render cleanly with capacity and "Book Lab Slot" actions.
  - `Report Damage` button properly uses the Lucide `<Plus />` icon with compliant text styling.
- **Friction Points**:
  - **Severe Title Truncation**: In the breakage list rows, items such as `Lab Equipment / ...` are heavily truncated (~18 characters) because five distinct horizontal elements (`[Icon]`, `[Title]`, `[CHEM Badge]`, `[ESCALATED_TO_HOD Badge]`, `[>]`) compete for space on a single row.
  - **Long Status Badges**: The badge `ESCALATED_TO_HOD` takes up a large portion of the row's horizontal real estate, forcing the title into premature truncation and hiding the actual fault summary (e.g., OS Boot Failure).
  - **Bottom List Occlusion**: The final items in the list (`PC_05`) are cut off and partially hidden beneath the floating bottom status bar.

---

### Screenshot 3: Scope Filter Bar (`practical-filter-bar.tsx`)
- **Component**: `components/records/practical-filter-bar.tsx`
- **What is Working Well**:
  - The card header with icon, title ("Institutional Scope Filters"), and subtitle renders clearly.
  - Group By, Reset, and Search buttons are accessible.
- **Friction Points**:
  - **Dropdown Text Truncation in 2-Column Grid**:
    - In `grid grid-cols-2`, column width is ~160px. Labels like `"All Academic Cycles"` truncate to `"All Academic Cy..."`.
    - The Nepali Date Picker input placeholder `"सुरु मिति / From Date"` is clipped to `"सुरु मिति / From Dat"`.
  - **Miti Presets Awkward Wrapping**:
    - The presets (`यस महिना (This Month)`, `गत महिना (Last Month)`, `यस शैक्षिक सत्र (Academic Year)`) wrap across two uneven, jagged lines, creating visual imbalance.
  - **Bottom Toolbar Clipping**:
    - The page size selector ("Show 10 entries") and export buttons (`CSV`, `Excel`, `Print`) are sliced in half at the bottom of the viewport behind the floating dev tools.

---

### Screenshot 4: Equipment Breakages & Incident Table (`incident-records-table.tsx`)
- **Component**: `components/records/incident-records-table.tsx`
- **Key Architectural Finding**:
  - **Missing Mobile Card Stack**: While `practical-records-table.tsx` was hardened with a responsive mobile card stack (`block md:hidden`) in Task 59, `incident-records-table.tsx` still renders a desktop multi-column `<table>` inside `overflow-x-auto`.
- **Friction Points**:
  - **Horizontal Clipped Columns**: Only the Checkbox, `DATE & CASE`, `FACILITY`, and a fraction of `EQUIPMENT` are visible. Critical columns (`Severity`, `Faculty & Class`, `Status`, `Resolution Notes`, `Actions`) are completely hidden off-screen to the right.
  - **Excessive Header Height**: The top controls (Page size selector, Search input, Columns button, Export CSV/Excel/Print) wrap across 3 vertical rows, taking up ~150px of vertical space before any data is visible.
  - **Truncated Cell Contents**: In the table view on mobile, equipment descriptions are truncated into unreadable fragments like `"Lab Equipme..."` and `"OS BOOT FAIL..."`.

---

### Screenshot 5: Incident Resolution & Triage Drawer (`incident-detail-drawer.tsx`)
- **Component**: `components/records/incident-detail-drawer.tsx`
- **What is Working Well**:
  - Case header (`CASE #INC-0GJX [MINOR]`) with close button is clean and identifiable.
  - Full audit notes textarea and resolution actions are intact.
- **Friction Points**:
  - **Oversized Evidence Photo**:
    - The evidence photo container (`max-h-56 sm:max-h-64`) consumes ~35-40% of the entire mobile screen height. This pushes the actual actionable resolution form and buttons down below the viewport fold.
  - **Button Layout Asymmetry**:
    - `Mark Under Repair` and `Mark Replaced` are stacked vertically on the left with blank space on the right, while `Certify Resolved` sits below with `ml-auto`.
  - **Dev Overlay Collision on HOD Escalation**:
    - The bottom link (`Require institutional intervention? Escalate to HOD`) directly collides with the Next.js dev badge `[N]`, and lacks sufficient safe-area bottom padding.

---

## 2. Batch 2 (Screenshots 6–10): Modals, Notifications, CAD & Maintenance

### Screenshot 6: Incident Detail Modal — Lifecycle & Specifications (`incident-detail-drawer.tsx`)
- **Component**: `components/records/incident-detail-drawer.tsx` (Lines 226–345)
- **Friction Points**:
  - **Timeline Timestamp Wrapping**: In `Lifecycle Audit Timeline`, `flex items-center gap-2` on a ~250px container causes `10/19/2026, 10:16:08` to break onto one line and `PM` to fall onto a second line alone.
  - **Violent Truncation in 2x2 Specifications Grid**:
    - `PERIOD / DATE`: Rendered as `Period 2 (11:00 - 1`! The `truncate` class aggressively chops the period timing in half.
    - `EQUIPMENT & QUANTITY`: Rendered as `Lab Equipment / ...` with equipment name lost to truncation.
  - **Action Form Below the Fold**: The 4-card spec grid + timeline consumes ~350px of vertical space, pushing the actionable `Action Taken & Resolution Certification` notes textarea and buttons down below the fold.

---

### Screenshot 7: Notification Feed Panel (`notification-bell.tsx`)
- **Component**: `components/layout/notification-bell.tsx` (Lines 354–444)
- **What is Working Well**:
  - Distinct notification badges (`[CRITICAL]`, `[WARNING]`, `[NOTICE]`) and clear laboratory scope tagging (`[CHEM LAB]`).
  - Quick action CTA button `[Review & Manage >]`.
- **Friction Points**:
  - **Panel Width & Alignment on Mobile Viewports**:
    - The dropdown uses `w-88` (352px) with `right-0`. On a 360px viewport, a 352px popover has only 8px total breathing room and can press awkwardly against screen edges or cause horizontal scroll bounce.
  - **Filter Segment Tabs Disconnected Styling**:
    - The active tab `[All 12]` is a stark white pill, while `Unread` is plain grey text, and `Critical 2` has a red chip without a continuous background segment container.
  - **Severe Bottom Occlusion**: The 3rd notification card and bottom controls are 100% blocked and obscured by bottom floating overlays.

---

### Screenshot 8: Computer Lab Seating Plan CAD Floor Mode (`computer-lab-workspace.tsx` & `workstation-node.tsx`)
- **Component**: `components/computer-lab/computer-lab-workspace.tsx`, `components/maintenance/workstations/workstation-node.tsx`
- **Key Visual Defect**:
  - **Ghost Student Text Overlapping `PC-37`**:
    - Workstation `PC-37` has status `under_repair` (cyan border `border-cyan-500/80` and semi-transparent background `bg-cyan-950/40`).
    - In the CAD canvas, `PC-37` is rendered directly on top of an underlying node / student assignment (`... Kandel R-16`), resulting in the student's name and roll number bleeding through behind the large bold text `PC-37`.
- **Ergonomic Friction Points on Mobile**:
  - On a smartphone, CAD Floor view is extremely cramped: 4 Top action buttons (2 rows) + View Mode Switcher card + Zoom HUD controls consume **>50% of screen height**, leaving only a tiny horizontal band for the entire CAD floor plan.

---

### Screenshot 9: Maintenance Workbench & Subtitle Truncation (`maintenance-client-page.tsx`)
- **Component**: `components/maintenance/maintenance-client-page.tsx`, `components/layout/page-header.tsx`
- **Friction Points**:
  - **Page Header Subtitle Chop**: Under the top navbar, `PageHeader`'s paragraph has `truncate`, which turns `"Institutional hardware diagnostics, workstation floor radar, and certified service history."` into `"Institutional hardware diagnostics, workstation flo..."`.
  - **Staggered 3-Row Action Button Clutter**: Five action buttons are crammed into an unconstrained flex-wrap row (`2 + 2 + 1`), with `+ Add Routine` stranded alone on row 3.
  - **Tab List Vertical Clutter**: The 3 tabs (`Diagnostics & Triage (1)`, `Routine Tasks (1)`, `Maintenance History (15)`) stack vertically, consuming another ~130px.

---

### Screenshot 10: Diagnostics & Triage Workstation Fault Feed (`diagnostics-triage-hub.tsx`)
- **Component**: `components/maintenance/diagnostics-triage-hub.tsx` (Lines 1012–1170)
- **Friction Points**:
  - **Inconsistent Card Title / Badge Stacking**: Inside `flex items-center gap-2 flex-wrap`, short titles like `Overheating / Fan Noise` stay inline with `[PC-08]`, while longer titles like `Loose Network Cable / No Internet` wrap onto line 2 below `[PC-37]`.
  - **Mobile Action Button Layout**: For `PC-37`, `[Resolve & Restore]` and `[Revert]` sit side-by-side in a flex container; on 360px viewports, they touch or squeeze.
  - **Bottom List Occlusion**: Ticket 3 (`PC-14`) is cut in half by floating dev widgets.

---

## 3. Batch 3 (Screenshots 11–15): Admin Console, Calendars & Layout Integrity

### Screenshot 11: Teacher & Staff Directory Table (`user-access-manager.tsx`)
- **Component**: `components/admin/user-access-manager.tsx` (Lines 493–580)
- **What is Working Well**:
  - Search bar and role/status dropdowns stack nicely with clean `min-h-[44px]` touch targets.
  - Avatar, full name, and email render cleanly in the first cell.
- **Friction Points**:
  - **Desktop HTML Table on Mobile**:
    - The directory uses `<table className="w-full text-left ...">` wrapped in `overflow-x-auto`.
    - Only `STAFF MEMBER & EMAIL` and `CONTACT PHONE` fit on screen. The `Institutional Role`, `Access Status`, and critical action buttons (`Edit`, `Reset Password`, `Archive`) are completely clipped off-screen to the right!
  - **Subtext Truncation**: Department/role subtext below the user is clipped into `...partment`.
  - **Floating Rig Collision**: The bottom rows are obscured by dev telemetry bars.

---

### Screenshot 12: Super Admin Command Center Sub-Navigation (`app/(dashboard)/admin/page.tsx`)
- **Component**: `app/(dashboard)/admin/page.tsx` (Lines 1086–1160)
- **What is Working Well**:
  - Executive header card (`Super Admin Command Center`, `Tier-1 Root`, `Precaution Active` safety lock) is clean and executive.
- **Friction Points**:
  - **Ragged, Asymmetrical Sub-Tab Cluster**:
    - Sub-tabs are rendered inside `flex flex-wrap items-center gap-2 w-fit`.
    - Line 1: `Academic Years (2)` (full width)
    - Line 2: `Curriculum Subjects (31)` (full width)
    - Line 3: `Timetable Periods (10)` AND `Classes (9)` accidentally land on the same line!
    - Line 4: `Master Routine & Slots` (full width)
    - Line 5: `Student Rosters & Cohorts` (full width)
    - Line 6: `🎓 Cohort Promotion` (full width)
    - *Fix*: Replace the ragged flex-wrap with a smooth horizontally scrollable tab rail (`overflow-x-auto no-scrollbar flex-nowrap`) or an intentional 2-column grid.

---

### Screenshot 13: Academic Years Operational Cycles (`academic-years-manager.tsx`)
- **Component**: `components/admin/academic-years-manager.tsx` (Lines 488–496)
- **What is Working Well**:
  - Total Cycles and Precaution Guard metric cards stack cleanly.
  - Cycle status badges (`Current Active Cycle`, `Archived / Past`) are distinct and well-colored.
- **CRITICAL DATA FORMATTING DEFECT**:
  - **Raw UTC ISO Timestamp Strings Printed to Screen**:
    - Code renders: `Start: 2082-12-31T18:15:00.000Z • End: 2083-12-29T18:15:00.000Z`
    - In Item 2: `Start: 2027-04-12T18:15:00.000Z • End: 2028-04-11T18:15:00.000Z`
    - This raw ISO string with timezone milliseconds is unformatted, completely unreadable for institutional administrators, and causes awkward line wraps (`2082-12-` on line 1, `31T18:15:00.000Z` on line 2).
    - *Fix*: Cleanly format dates using Gregorian `yyyy-MM-dd` and convert to Nepali Bikram Sambat Miti (`२०८२ चैत्र ...`).

---

### Screenshot 14: Catastrophic Horizontal Viewport Drift / Blowout (`app/(dashboard)/admin/page.tsx`)
- **Component**: `app/(dashboard)/admin/page.tsx`
- **Critical Architectural Defect**:
  - **Horizontal Viewport Blowout**:
    - The mobile viewport is horizontally scrolled or blown out beyond `100vw`.
    - As a result, the entire left half of the page is cut off off-screen:
      - Header says `ommand Center` (`Super Admin C` is cut off on the left).
      - Sub-tabs show `il`, `ation`, `ne` (`Email Notification Engine` is cut off).
      - Policy card title says `eek Off &` (`Institutional W` is cut off).
    - *Root Cause*: One of the child elements (an unconstrained wide table, preformatted code/JSON block, or tab strip without `max-w-full overflow-hidden`) has expanded the `document.body` width beyond the smartphone screen, causing the browser window to drift horizontally when the user interacts with tabs on the right.
    - *Fix*: Enforce strict `overflow-x-hidden` on outer page wrappers and `max-w-[calc(100vw-2rem)]` on all child cards and tables.

---

### Screenshot 15: Dual Calendar / Nepali Miti Picker Grid (`dual-calendar-picker.tsx`)
- **Component**: `components/admin/dual-calendar-picker.tsx` (Lines 308–467)
- **What is Working Well**:
  - The 7-column Nepali month calendar grid (आइत to शनि) fits into the mobile viewport.
  - Numerals, English dates (18 Oct), and the active day badge (`आज`) are clearly positioned.
- **Friction Points**:
  - **Dropdown Label Truncation**:
    - `Year:` dropdown uses `w-32` (128px) -> truncates to `2083 B.S. (`.
    - `Month:` dropdown uses `w-36` (144px) -> truncates to `7. Kartik (का`.
  - **Single-Letter Holiday Chip Truncation**:
    - In a 42px wide calendar cell on mobile, holiday tags truncate into single letters:
      - `"बडा दशैं"` becomes `व...`
      - `"तिहार"` becomes `ति...`
    - These tiny grey boxes with single letters look like corrupted or broken data.
    - *Fix*: On mobile screens (`< sm`), replace text badge chips with a clean colored dot or indicator icon; show full holiday names when the user taps on the day. Expand Year and Month select dropdown widths on mobile.

---

## 4. Comprehensive Master Action Plan

| Priority | Area / Component | Defect | Architecture & UX Solution |
| :--- | :--- | :--- | :--- |
| **P0 (Critical)** | `app/(dashboard)/admin/page.tsx` | Horizontal viewport blowout / drift (Screen 14) | Enforce `overflow-x-hidden` on main layout and `max-w-full min-w-0` on cards to prevent body width blowouts. |
| **P0 (Critical)** | `incident-records-table.tsx` & `user-access-manager.tsx` | Raw desktop `<table>` without mobile card fallback (Screens 4 & 11) | Implement responsive mobile card stacks (`block md:hidden`) showing core identity, badges, and tap-to-inspect drawers. |
| **P0 (Critical)** | `academic-years-manager.tsx` | Raw ISO UTC timestamps printed on UI (Screen 13) | Format dates with Nepali Miti and clean Gregorian `yyyy-MM-dd` (strip `T18:15:00.000Z`). |
| **P1 (High)** | `dual-calendar-picker.tsx` | Single-letter holiday truncation `व...` & clipped select labels (Screen 15) | Replace text badges on mobile cells with colored status dots (`h-1.5 w-1.5 rounded-full bg-rose-500`); make Year/Month selects flexible width. |
| **P1 (High)** | `incident-detail-drawer.tsx` | Giant photo container (`max-h-56`) + truncated 2x2 specs (Screens 5 & 6) | Use compact photo preview card; remove `truncate` from period/equipment specs; format timestamps with line breaks. |
| **P1 (High)** | `page-header.tsx` | Subtitle clipped to `"workstation flo..."` (Screen 9) | Replace `truncate` with `line-clamp-2` or `sm:truncate`. |
| **P1 (High)** | `maintenance-client-page.tsx` | 5 buttons staggered in 3 messy rows `2 + 2 + 1` (Screen 9) | Group secondary actions (`Floor Map`, `Print`, `Refresh`) into a compact icon/more menu; keep 2 primary CTAs. |
| **P1 (High)** | `workstation-node.tsx` & CAD | Ghost student text bleeding through under repair nodes (Screen 8) | Enforce 100% opaque node backgrounds (`bg-zinc-900` / `bg-slate-900`) to prevent bleed-through. |
| **P2 (Medium)** | `notification-bell.tsx` | `w-88` fixed popover pressing against 360px viewport edges (Screen 7) | On mobile (`< sm`), convert to centered floating sheet (`inset-x-2.5 top-16`); wrap tabs in a unified segment rail. |
| **P2 (Medium)** | Global Layout | Floating dev/rig bars occluding bottom cards and tabs (All Screens) | Add global `pb-24 sm:pb-12` safe-area bottom padding to scrollable dashboard views. |
