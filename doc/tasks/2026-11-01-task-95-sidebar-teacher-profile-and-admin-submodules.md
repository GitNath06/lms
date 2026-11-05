# Task 95: Sidebar Faculty Profile Integration & Super Admin Sub-Navigation Modules

**Date**: 2026-11-01  
**Category**: UI/UX Architecture, Navigation Ergonomics, Server Action Stability  
**Status**: Completed  
**Verification**: `npx tsc --noEmit` (0 errors), `tests/unit-domain-invariants.test.mjs`, `tests/phase6-conflicts-and-audit.test.mjs`, `tests/verify-empty-array-traps.test.mjs` (All Passing)

---

## 1. Context & Motivation

1. **Teacher Navigation Ergonomics**:
   In previous revisions, faculty profile and preferences were only accessible by clicking the user avatar pill in the top header and selecting "Profile & Preferences" from the dropdown. For teachers and lab in-charges who do not have Super Admin permissions, the bottom navigation area of the collapsible sidebar left an empty gap where Super Admin Control resided for root administrators. Placing **Profile & Preferences** directly into the sidebar gives faculty immediate 1-click access to their assigned curriculum scope, schedule history, and account settings.

2. **Super Admin Module Direct Access & Vertical Space Optimization**:
   The Super Admin console (`/admin`) organizes platform administration into 4 core executive categories:
   - `Identity & Access`
   - `Academic Curriculum`
   - `Facilities & Safety`
   - `Operations & Backup`
   Surfacing these 4 modules directly in the sidebar underneath Super Admin Control allows administrators to deep-link straight to the desired administrative domain from anywhere in the application. With the sidebar tree handling navigation, the redundant horizontal segmented bar across the top of `/admin` has been eliminated, reclaiming vertical screen real estate.

3. **Clean Ordering & Labeling**:
   - In both expanded and collapsed views, **Profile & Preferences** is ordered directly above **Super Admin Control**.
   - Redundant numeric prefixes (`01`, `02`, `03`, `04`) on admin sub-modules have been removed for a clean, distraction-free interface.

4. **Server Action Protocol Protection & Flight Stream Integrity**:
   When network latency or token expiry triggered auth refreshes during Server Action invocations (`POST /admin`, `POST /records`), the auth proxy/middleware catch block could return HTTP redirects to `/login`. In Next.js App Router, intercepting a Server Action Flight request with a non-Flight redirect causes the client router reducer to throw:
   `fetchServerAction: An unexpected response was received from the server`.

5. **React Key De-duplication in Filter Bars**:
   When multiple curriculum mappings or class subjects share identical subject codes (e.g., `COMP-11` across Grade 11 Science and Grade 11 Management), mapping over raw `validSubjects` produced duplicate React key warnings.

---

## 2. Changes Implemented

### A. Collapsible Sidebar Navigation (`components/layout/collapsible-sidebar.tsx`)
- **Gemini-Style Interactive Logo Toggle**:
  - Eliminated the protruding circular `(>)` uncollapse button on the sidebar right border edge.
  - When collapsed, the lab logo (`FlaskConical`, `h-10 w-10`) doubles as the expand trigger. Hovering over it smoothly transitions the logo into `PanelLeftOpen`, inviting the user to click to expand, matching Google Gemini's UX pattern.
- **Bold & Enlarged Icons**:
  - Increased navigation icon footprint from 16px (`h-4 w-4`) to 20px (`h-5 w-5`) with high-contrast `stroke-[2.25]`.
- **Direct 1-Click Sub-Tabs in Collapsed Mode**:
  - When the sidebar is collapsed, the 4 admin sub-module icons (`Users`, `BookOpen`, `Building2`, `CalendarDays`) are rendered vertically below the main `Shield` icon.
  - Admins can switch between tabs (`Identity`, `Curriculum`, `Facilities`, `Operations`) with a single direct click even in collapsed mode, complete with individual tooltips and active state badges.
- **Profile & Preferences Above Super Admin**:
  - Reordered the sidebar so **Profile & Preferences** is rendered directly above **Super Admin Control** for all verified users (`!isPending`).
  - Active state indicator with indigo accent when `pathname === '/profile'`.
- **Super Admin Sub-Navigation Tree**:
  - Implemented `ADMIN_SUB_MODULES` array (`identity`, `curriculum`, `facilities`, `operations`) with clean titles (numbering removed), icons, and query routes (`/admin?tab=<module>`).
  - Added an interactive chevron toggle to expand/collapse the sub-module tree, auto-expanding whenever the user is on `/admin*`.
  - Wrapped `AdminSubTreeInner` in `<Suspense fallback={null}>` to prevent de-opting layout rendering while reading `useSearchParams()`.

### B. Admin Console Header Streamlining (`app/(dashboard)/admin/page.tsx`)
- **Eliminated Top Segmented Bar**:
  - Removed the bulky horizontal tab bar (`Identity & Access`, `Academic Curriculum`, `Facilities & Safety`, `Operations & Backup`) from the top fold of the admin page.
  - Screen space is maximized for the active administrative console table/controls.
- **Query Parameter Synchronization**:
  - Synchronizes `activeCategory` with the URL `tab` parameter (`identity`, `curriculum`, `facilities`, `operations`).
  - Deep links and cross-section links (such as the Archive Hub redirect) call `handleCategoryChange` to keep URL search parameters and active views in lockstep.
- Wrapped `SuperAdminPageContent` in `<Suspense>` boundary in `app/(dashboard)/admin/page.tsx` for clean App Router static optimization.

### C. Mobile Navigation Drawer (`components/layout/mobile-nav.tsx`)
- Mirrored sidebar hierarchy in the mobile navigation drawer:
  - Positioned `Profile & Preferences` directly above `Super Admin Control`.
  - Added clean, unnumbered `ADMIN_SUB_MODULES` sub-links under Super Admin Control for mobile admins.

### D. Server Action Flight Stream Protection (`proxy.ts`)
- In `proxy.ts`, ensured that any request containing the `next-action` header:
  - Refreshes Supabase session tokens via `supabase.auth.getUser()`.
  - **Never** returns raw HTTP 307/308 redirects or non-Flight JSON responses from the proxy catch block.
  - Allows Server Actions to execute their own server-side RBAC and return structured `{ success: false, error: '...' }` objects that the client-side Flight reducer consumes safely.

### E. Practical Records Filter Bar De-duplication
- Verified and enforced strict Set-based deduplication by subject code (`s.code.trim().toUpperCase()`) and class key (`(c.id || c.name).trim().toLowerCase()`) in both `components/records/practical-filter-bar.tsx` and `lib/context/cascading-filters.ts`.

---

## 3. Invariants & Rules Preserved

1. **Zero Literal `+` in Buttons**: All action buttons use Lucide icons (e.g. `<Plus className="h-4 w-4" />`) with zero literal `+` strings in UI text.
2. **Standard Terminology**: Strict adherence to "Attendance", "Timetable", "Equipment" (zero "apparatus"), and "Logbook".
3. **Safety Lock Integrity**: "Precaution Active" toggle retained and respected in Super Admin console.
4. **Strict TypeScript & App Router Standards**: All components pass `npx tsc --noEmit` with 0 errors; all `useSearchParams()` calls enclosed within `<Suspense>` boundaries.

---

## 4. Verification & Testing

- **TypeScript Typecheck**:
  `npx tsc --noEmit` &rarr; **0 errors**.
- **Pure Domain & Timetable Invariants**:
  `node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/unit-domain-invariants.test.mjs tests/phase6-conflicts-and-audit.test.mjs`
  - **20 / 20 passing**.
- **Empty Array Traps & Cascading Integrity**:
  `node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/verify-empty-array-traps.test.mjs`
  - **11 / 11 passing**.
