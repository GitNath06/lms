# Task 80: CAD Workstation Node Spacing, Border Declutter & Top Navbar/Sidebar Streamline

**Author**: Antigravity Assistant  
**Date**: 2026-10-26  
**Status**: Completed  
**Branch**: `main`

---

## 1. Overview & Context

During continuous CAD laboratory testing and mobile/desktop responsive QA, three specific visual density and layout collisions were identified:

1. **CAD Workstation Node Touching/Overlap**: In `WorkstationNode` (`components/maintenance/workstations/workstation-node.tsx`) and ghost slot cards in `admin-floor-architect.tsx`, previous outer monitor dimensions (`144px–150px` width and `80px–84px` height) plus a bulky monitor neck and pedestal base caused adjacent nodes in 12% grid intervals to collide or stick as soon as the viewport changed.
2. **Heavy Neon Green Rings**: Every Present student avatar and workstation monitor bezel had a bulky `ring-2 ring-emerald-500` / `border-emerald-500/30`, resulting in a noisy, neon-heavy aesthetic across the room instead of subtle presence indication.
3. **Top Navbar Clutter & Collapsed Sidebar Logo Bug**:
   - Collapsing the sidebar replaced the purple `FlaskConical` brand logo with `PanelLeftOpen`.
   - The top header featured a bulky `max-w-md` search input and an expansive `[● Supabase Live]` pill button that crowded the header.
   - `<ThemeToggle />` was hidden on screens `< 640px` (`hidden sm:block`).

---

## 2. Changes Executed

### Task 1: CAD Workstation Compact Breathing Room & Auto-Fit
- **WorkstationNode (`components/maintenance/workstations/workstation-node.tsx`)**:
  - Reduced default monitor dimensions from `w-[136px] sm:w-[144px] md:w-[150px]` and `h-[74px] sm:h-[80px] md:h-[84px]` to `w-[114px] sm:w-[122px] xl:w-[130px]` and `h-[62px] sm:h-[66px] xl:h-[70px]`.
  - Slimmed down monitor stand neck to `w-2.5 h-1` and pedestal base to `w-6 sm:w-8 h-1`, reducing vertical height impact to ~2px.
  - Adjusted inner padding (`p-0.5 sm:p-1` on outer bezel, `p-1 sm:p-1.5` on inner LCD screen).
  - Scaled portrait student avatar to `w-9 sm:w-10 h-10 sm:h-11 rounded-md` with proportional typography (`text-[10px] sm:text-[10.5px]` line-clamp-2 for name, `text-[8px] sm:text-[8.5px]` for roll/PC metadata row).
  - Ensured workstation labels truncate cleanly (`max-w-[44px] truncate`).
- **Ghost Slot Cards (`components/admin/admin-floor-architect.tsx`)**:
  - Matched ghost slot card dimensions to `w-[114px] sm:w-[122px] xl:w-[130px]` and `h-[62px] sm:h-[66px] xl:h-[70px]` with `p-1.5 sm:p-2` compact padding.
- **CAD Floor Responsive Auto-Fit (`components/computer-lab/computer-lab-workspace.tsx`)**:
  - Added responsive effect listener triggering `viewport.fitToScreen()` on mount and window resize when viewport width is between 768px and 1280px to guarantee 8 columns across both wings maintain clean breathing room.
- **Database Stray Node PC-490**:
  - Soft-deactivated rogue stress-test node `PC-490` (`is_active = false`), removing it from all active CAD floor and bench queries.

### Task 2: Border Declutter & Hairline Neutral Aesthetics
- **Desktop 2D CAD Floor (`workstation-node.tsx`)**:
  - Removed `haloGlow = 'ring-2 ring-emerald-500/80 ...'` on Present monitors.
  - Set monitor bezel to sleek neutral `border-zinc-300 dark:border-white/[0.12]` with micro status LED dot on bottom chin indicating nominal state.
  - Colored borders reserved strictly for Absent (`border-rose-500/60`), Temporary Relocation (`border-indigo-400/80`), Hardware Faults (`border-amber-400/80`), and Under Repair (`border-cyan-500/80`).
- **Mobile Bench List (`mobile-bench-rollcall-view.tsx`)**:
  - Removed `border-emerald-500/30` from the card container; default/present benches now use clean neutral `border-zinc-200/80 dark:border-white/[0.08]`. Colored card borders are only applied for Absent (`border-rose-500/30`) or Active Faults (`border-amber-500/40`).
  - Replaced `ring-2 ring-emerald-500` on the student avatar with a subtle hairline border (`ring-1 ring-zinc-200 dark:ring-white/10`). Only Absent (`ring-2 ring-rose-500/60`) and Active Faults (`ring-2 ring-amber-500/50`) display a colored ring.

### Task 3: Top Navbar Streamline, Theme Toggle & Sidebar Brand Logo
- **Collapsible Sidebar (`components/layout/collapsible-sidebar.tsx`)**:
  - Brand header now preserves the purple `FlaskConical` brand icon permanently in both collapsed and expanded states.
  - Moved the collapse/expand toggle button:
    - Collapsed: Clean circular toggle button with `ChevronRight` placed on the sidebar's right border edge (`absolute -right-3 top-5`).
    - Expanded: Sleek `PanelLeftClose` toggle button beside the brand logo.
- **Top Header Search Trigger (`components/layout/header-search-trigger.tsx` & `app/(dashboard)/layout.tsx`)**:
  - Removed bulky `max-w-md` centered input bar.
  - Replaced with a compact Search Icon button (`<Search className="h-4 w-4"/>`) on mobile/tablet and an ultra-compact icon + ⌘K pill on desktop large screens.
- **Relocated Supabase Live Pill (`components/layout/cloud-sync-status.tsx` & `components/layout/user-profile-menu.tsx`)**:
  - In top navbar, replaced wide text button with a minimal, clean pulsing emerald status dot (`h-2.5 w-2.5 rounded-full bg-emerald-500`) with hover/tap tooltip (text is only shown if offline/syncing outbox).
  - Added permanent `"Database: Supabase Live (Synced)"` active status row inside `UserProfileMenu` dropdown card.
- **Theme Toggle on Mobile & Desktop (`app/(dashboard)/layout.tsx`)**:
  - Removed `hidden sm:block` from `<ThemeToggle />`, making it permanently accessible on all viewports right beside Notification Bell and User Profile Avatar with zero right-edge clipping.

---

## 3. Verification & Test Results

1. **TypeScript Verification**:
   - `npx tsc --noEmit` &rarr; **0 errors**.
2. **Unit Test Invariants**:
   - `npm run test:unit` &rarr; **52 tests passed, 0 failed (100% pass rate)**.
