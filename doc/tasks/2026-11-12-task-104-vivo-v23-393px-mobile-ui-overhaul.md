# Task 104: Vivo V23 5G (393px Viewport) Mobile UI Overhaul — Top Navbar Avatar, Bottom Dock Clearance, Profile Ergonomics & Mobile Obsidian Cards

**Execution Date**: 2026-11-12  
**Status**: Completed  
**Branch**: `feature/student-terminal-agent`  
**Target Environment**: Production (`https://lms-rrlss.vercel.app`), Vivo V23 5G (393px CSS width), Mobile Browsers & PWA Standalone Mode

---

## 1. Context & Mobile Defects on 393px Viewports

Testing on physical devices (specifically a Vivo V23 5G with a 393px CSS viewport width running the PWA in standalone mode) revealed five visual and interactive defects:

1. **Top Navbar Profile Avatar Squashed/Pushed Off-Screen**:
   - In `app/(dashboard)/layout.tsx`, the top navigation bar accumulated elements totaling > 400px in width (navigation toggle, live clock with Bikram Sambat date beacon, global search, cloud sync status, notifications, theme toggle, and profile avatar).
   - On a 393px screen, the left-side containers lacked width constraints (`min-w-0`), allowing long titles and timestamps to expand and push the user profile menu avatar off the right edge of the viewport.
2. **Bottom Dock Occlusion**:
   - The fixed `MobileBottomNav` (64px / `h-16`) covered page content at the bottom of long views (e.g. `/profile`, `/records`, `/maintenance`) and overlapped sticky form action footers.
3. **Profile Page (`/profile`) Mobile Ergonomics**:
   - The 3-tab navigation switcher used desktop widths and wrapped poorly on narrow screens.
   - User identity details and avatar were misaligned.
   - Inputs lacked high-contrast styling in dark mode and had font sizes that triggered mobile browser auto-zooming.
4. **Desktop Tables on Small Screens**:
   - Tables in `/records` and `/maintenance` relied on wide horizontal scrolling or squashed desktop columns on mobile screens (< 768px).
5. **Toolbar Button Misalignments**:
   - Filter and action bars in `/records` and `/records/incidents` overflowed or wrapped inconsistently on 393px screens.

---

## 2. Key Architecture & Fixes Implemented

### A. Top Header Geometry Optimization (393px Viewport Fit)
- **Top Header Bar (`app/(dashboard)/layout.tsx`)**:
  - Configured with `w-full max-w-[100vw] px-2.5 sm:px-6 flex items-center justify-between gap-1.5 sm:gap-4 overflow-hidden z-40 print:hidden`.
  - **Zone 1 (Left)**: Configured as `flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1 overflow-hidden`, allowing the title and date elements to shrink cleanly when space is tight.
  - **LiveClockHeader (`components/layout/live-clock-header.tsx`)**:
    - Wrapped date trigger button with `max-w-[125px] xs:max-w-[155px] sm:max-w-none shrink min-w-0` and text `truncate`.
  - **CloudSyncStatus (`components/layout/cloud-sync-status.tsx`)**:
    - Trigger button standardized to `h-8 w-8 sm:h-9 sm:w-9 shrink-0`.
    - Text labels ("Syncing (X)", "X Offline") hidden on mobile screens (`hidden sm:inline`) and replaced with a compact badge (`sm:hidden`).
  - **UserProfileMenu (`components/layout/user-profile-menu.tsx`)**:
    - Avatar trigger button given explicit `shrink-0`, `h-9 w-9`, `ring-2 ring-zinc-700/80`, high-contrast text initials, and an active online green indicator badge (`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 bg-emerald-500 rounded-full ring-2 ring-zinc-900`).
  - **Zone 3 (Right)**: Wrapped in `flex items-center gap-1 sm:gap-2.5 shrink-0`, preventing the profile menu and action buttons from ever being compressed or pushed off-screen.

### B. Viewport Overflow Shield & Dock Safe-Area Clearance
- **Global CSS (`app/globals.css`)**:
  - Added global horizontal overflow containment:
    ```css
    html, body {
      overflow-x: hidden;
      max-width: 100vw;
    }
    ```
  - Added `.pb-mobile-dock` utility:
    ```css
    .pb-mobile-dock {
      padding-bottom: calc(5.5rem + env(safe-area-inset-bottom, 0px));
    }
    @media (min-width: 768px) {
      .pb-mobile-dock {
        padding-bottom: 2rem;
      }
    }
    ```
- **Main Layout Container (`app/(dashboard)/layout.tsx`)**:
  - Increased bottom padding from `pb-24` to `pb-28 md:pb-8` to ensure page content scrolls cleanly above the 64px `MobileBottomNav`.
- **Sticky Form Submit Bar (`app/(dashboard)/records/new/log-form.tsx`)**:
  - Updated positioning to `sticky bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] md:bottom-0 z-30`.
  - On mobile screens, the bar floats directly above the dock without visual collision.

### C. Profile Page Mobile Ergonomics (`/profile`)
- **Responsive 3-Column Tab Bar (`components/profile/teacher-profile-form.tsx`)**:
  - Converted tab list into full-width grid: `grid grid-cols-3 w-full bg-zinc-100/90 dark:bg-zinc-950 p-1 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 text-xs sm:text-sm font-sans gap-1`.
  - Added responsive tab labels: "Profile", "Security", "Preferences" on mobile; full titles on desktop.
- **Centered Identity Card**:
  - Configured as `flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 p-4 sm:p-6 rounded-2xl`.
- **High-Contrast Obsidian Inputs**:
  - Applied `dark:bg-zinc-950 dark:border-zinc-700/80 dark:text-white min-h-[44px] text-base sm:text-xs` to prevent mobile browser auto-zoom on input focus.
  - Full-width CTA buttons: `w-full sm:w-auto min-h-[48px] justify-center`.

### D. High-Performance Mobile Obsidian Cards (< 768px)
- **Practical Records (`components/records/practical-records-table.tsx`)**:
  - Replaced raw list with high-density obsidian cards on `< 768px`:
    - Row 1: Subject name + Class badge (left), Conducted/Skipped uppercase badge (right).
    - Row 2: 2x2 metadata grid (Facility, Date & Period, Instructor, Attendance e.g. `28/30 • 93%`).
    - Row 3: Topic learned summary and touch-target action buttons (`h-10` View Details and Print).
- **Maintenance Service History (`components/maintenance/maintenance-ledger-table.tsx`)**:
  - Added mobile obsidian card stack (`md:hidden`) displaying Routine Title, Lab badge, 2-column metadata, checklist completion count, and touch-target details button.
  - Desktop table isolated within `hidden md:block overflow-x-auto`.

### E. Action Toolbar Wrap Alignment
- **`components/records/practical-filter-bar.tsx`**: Updated top action controls to `grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto` with `h-9` buttons for clean 2x2 grid wrapping on 393px screens.
- **`components/records/incident-filter-bar.tsx`**: Updated controls to `grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto`.

### F. SSR Hydration Invariant & Localhost SW Chunk Bypass
- **Root Cause of Hydration Error**: In `app/(dashboard)/records/page.tsx` and `app/(dashboard)/records/incidents/page.tsx`, `isLoading` was initialized via `useState(() => !initialCached)`. On Node.js SSR, `initialCached` was null (rendering skeleton pulse bars), whereas during client hydration frame 0, `initialCached` was populated from memory/IndexedDB (rendering metrics numbers `<span ...>`), causing React to throw `Hydration failed because the server rendered HTML didn't match the client`.
- **SSR Hydration Guard**: Added `const [mounted, setMounted] = useState<boolean>(false)` and initialized `filters` with deterministic default values (avoiding `typeof window !== 'undefined'` branching during render). Guarded analytics summary strips and records tables with `isLoading={!mounted || isLoading || isPending}`, guaranteeing that both the server-rendered HTML and client frame-0 hydration tree produce identical DOM structures.
- **Service Worker Localhost Bypass**: In `public/sw.js`, added an explicit `isDev` check (`localhost` / `127.0.0.1`) that immediately bypasses `/_next/` chunks so Turbopack HMR chunks are never cached or served stale in local development. Added automated purge of `/_next/` chunks in `components/pwa/pwa-register.tsx`.

---

## 3. Verification & Test Outcomes

### A. TypeScript Type Check
```bash
npx tsc --noEmit
# Output: Exit code 0 (0 type errors across all files)
```

### B. Playwright Mobile Verification (375px & 393px Viewports)
```bash
npx playwright test tests/e2e/05-mobile-375x812-verification.spec.ts --project=chromium
```
- **Test 1**: Top Navbar has zero horizontal overflow and no overlapping elements at 375px — **PASSED**
- **Test 2**: `/records/new` Sticky Bottom Submit Bar renders cleanly without overlapping at 375px — **PASSED**
- **Test 3**: `/computer-lab` Mobile Bench List renders cleanly with zero horizontal overflow at 375px — **PASSED**
- **Test 4**: `MobileBottomNav` dock is visible on `/records/new` — **PASSED**
- **Test 5**: `MobileBottomNav` dock is visible on home/records and positioned below modal overlays — **PASSED**
- **Summary**: `5 passed (2.8m)`

### C. Node PWA & Offline Engine Unit Suite
```bash
node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/pwa-and-offline-engine.test.mjs
```
- **Result**: `25/25 subtests passed (duration ~32s)`.

