# Task 102: Enterprise PWA Live Hardening — Offline RSC Cache Isolation, Zero Skeleton Flashing, and Teacher Scope Acceleration

**Execution Date**: 2026-11-06  
**Status**: Completed  
**Branch**: `feature/student-terminal-agent`  
**Target Environment**: Production (`https://lms-rrlss.vercel.app`)

---

## 1. Context & Objectives

During live deployment and mobile testing on Vercel (`lms-rrlss.vercel.app`), 4 critical production defects were identified:
1. **Raw Plain-Text RSC Dump on Offline Navigation**: In `public/sw.js`, `normalizeRscUrl()` stripped `?_rsc=` from Next.js `<Link>` Flight requests (`Content-Type: text/x-component`) and stored them under the exact same cache key as full HTML documents (`/schedules`, `/computer-lab`, `/records`). When a user navigated or reloaded while offline, the service worker returned the plain-text RSC stream instead of the HTML page.
2. **Frame-1 Skeleton Flashing on Tab Switching**: When switching between previously loaded tabs, skeletons flashed because Next.js route-level `loading.tsx` Suspense boundaries painted intermediate fallback UI during client-side transitions, and client components initialized `useState(true)` instead of reading `client-query-cache.ts` synchronously.
3. **Offline Functionality & Cache Hydration Race**: If the device was offline on boot, server actions threw network errors before in-memory cache had hydrated from IndexedDB snapshots, causing blank screens.
4. **Teacher Profile Scope Latency**: Non-admin/teacher accounts ran redundant uncached database queries to resolve class/subject scope, adding 100-300ms latency to every page load.

---

## 2. Key Architecture & Changes Executed

### A. Next.js 16 RSC Flight vs. HTML Document Cache Isolation (`public/sw.js`)
- **Strict Content-Type Cache Bucketing**:
  - `CACHE_STATIC = 'labsync-static-v2'` for immutable hashed chunks and static assets.
  - `CACHE_HTML = 'labsync-html-v2'` strictly reserved for full HTML document responses.
  - `CACHE_RSC = 'labsync-rsc-v2'` strictly reserved for Next.js 16 Flight data payloads.
- **Request Type Disambiguation**:
  - `isRsc = req.headers.get('RSC') === '1' || url.searchParams.has('_rsc')`
  - `isDocumentNavigation = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')`
- **Guaranteed HTML Navigation Safety**: Document navigations are fulfilled strictly from `CACHE_HTML`, root app shell `'/'`, or `/offline.html` with explicit `Content-Type: text/html`. RSC payloads are never returned for an HTML navigation.
- **Cache Eviction**: Automatically purges legacy version-1 caches (`labsync-static-v1`, `labsync-pages-v1`, `labsync-rsc-v1`) during service worker activation.

### B. Frame-1 Zero-Flash Tab Switching
- **Segment Suspense Fallback Neutralization**: Converted all 11 `loading.tsx` route files in `app/(dashboard)/**/loading.tsx` to return `null`, allowing client components to render cached data instantaneously without triggering segment-level layout unmounts.
- **Synchronous Frame-1 State Hydration**:
  - `hooks/use-infrastructure-state.ts`: Initialized `periods`, `labs`, `classes`, `faculty`, `subjects`, `holidays`, and `issueCategories` synchronously from `getCachedQuery('bootstrap_data')`.
  - `hooks/use-routine-state.ts`: Initialized `schedules` synchronously from `getCachedData('schedules:formatted')`.
  - `hooks/use-incident-state.ts`: Initialized `incidents` synchronously from `getCachedData('incidents:list')`.
  - `hooks/use-substitution-state.ts`: Initialized `substitutions` synchronously from `getCachedData('substitutions:list')`.
  - `app/(dashboard)/records/page.tsx` & `records/incidents/page.tsx`: Initialized tables, metrics, and pagination counts synchronously from `getCachedData(cacheKey)` with `isLoading: false` on Frame 1.
  - `app/(dashboard)/schedules/schedules-client.tsx`: Initialized `currentUser` synchronously from `initialUser || getCachedData('auth:current-user-profile')`.
  - `components/profile/profile-client-view.tsx`: Synchronous fallback from `auth:current-user-profile`.

### C. Offline Hydration Synchronization (`lib/cache/client-query-cache.ts` & `app/providers.tsx`)
- Added `waitForOfflineHydration()` and `startOfflineHydration(uid)` to guarantee that IndexedDB snapshots are fully deserialized into RAM before offline fetch fallbacks are evaluated.
- Updated `fetchWithClientCache()`:
  - If `!navigator.onLine`, awaits `waitForOfflineHydration()` and returns cached data immediately.
  - On network failure, falls back to hydrated cache snapshot rather than failing.
- Mounted offline hydration initialization in `app/providers.tsx`.

### D. Sub-Millisecond Teacher Scope Resolution
- Extended `SessionClaimPayload` in `lib/security/session-claim.ts` with `teacherId`, `assignedClasses`, `assignedSubjects`, and `assignedLabIds`.
- In `lib/context/server-user-scope.ts`, added fast-path Web Crypto HMAC verification for `labsync_session_claim` cookie, resolving complete teacher scope in < 1ms without PostgreSQL queries.
- In `app/actions/auth.ts`, pre-resolved relational `class_subjects`, `classes`, `subjects`, and `labs` assignments on user sign-in and embedded them into the session claim token.
- In `app/actions/bootstrap.ts`, embedded pre-resolved `user_scope` directly into `getLabSyncBootstrapData()`.

---

## 3. Verification & Test Evidence

1. **TypeScript Typecheck**:
   - `node ./node_modules/typescript/bin/tsc --noEmit`
   - **Result**: Passed with 0 errors.

2. **PWA & Offline Engine Test Suite**:
   - `node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/pwa-and-offline-engine.test.mjs`
   - **Result**: 5 test suites, 18 assertions passed (including Service Worker cache isolation, HTML fallback safety, and proxy pass-through).

3. **Performance & CSR Test Suite**:
   - `node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/verify-performance-and-csr.test.mjs`
   - **Result**: 6 test suites, 11 assertions passed:
     - `getLabSyncBootstrapData` executed in 131.61ms (< 150ms target)
     - HMAC session claim verified in 0.604ms (< 1ms target)
     - Frame-1 cached retrieval in 0.062ms
     - All workspace `page.tsx` components verified with 0 blocking database calls.

---

## 4. Modified Files Register

- `public/sw.js`
- `app/(dashboard)/admin/loading.tsx`
- `app/(dashboard)/computer-lab/loading.tsx`
- `app/(dashboard)/incidents/loading.tsx`
- `app/(dashboard)/loading.tsx`
- `app/(dashboard)/maintenance/loading.tsx`
- `app/(dashboard)/print/records/loading.tsx`
- `app/(dashboard)/profile/loading.tsx`
- `app/(dashboard)/records/incidents/loading.tsx`
- `app/(dashboard)/records/incidents/page.tsx`
- `app/(dashboard)/records/loading.tsx`
- `app/(dashboard)/records/new/loading.tsx`
- `app/(dashboard)/records/page.tsx`
- `app/(dashboard)/schedules/loading.tsx`
- `app/(dashboard)/schedules/schedules-client.tsx`
- `app/actions/auth.ts`
- `app/actions/bootstrap.ts`
- `app/providers.tsx`
- `components/profile/profile-client-view.tsx`
- `hooks/use-incident-state.ts`
- `hooks/use-infrastructure-state.ts`
- `hooks/use-routine-state.ts`
- `hooks/use-substitution-state.ts`
- `lib/cache/client-query-cache.ts`
- `lib/context/server-user-scope.ts`
- `lib/security/session-claim.ts`
- `lib/types/bootstrap.ts`
- `tests/pwa-and-offline-engine.test.mjs`
