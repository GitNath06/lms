# Task 101: Enterprise Mobile-First PWA, Standalone Shell & Idempotent Offline Sync Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform LabSync LIMS into an enterprise-grade installable standalone mobile PWA with zero-loss idempotent offline mutations, Next.js 16 RSC-aware service worker caching, UID-scoped IndexedDB persistence, ergonomic mobile bottom navigation, and mobile tactical aisle mode for laboratory practicals.

**Architecture:** A native-feeling obsidian standalone mobile shell powered by Next.js 16 App Router, featuring an RSC-aware Service Worker with 2.5s Lie-Fi timeout fallback, two-tier IndexedDB storage (`query_snapshots` + `mutation_outbox`), client-generated UUIDv4 idempotency keys, Screen Wake Lock API integration, and automatic background sync reconciliation.

**Tech Stack:** Next.js 16.3+ (App Router), React 19, TypeScript, PostgreSQL via `getPgPool()`, IndexedDB (`idb` v1 pattern), Service Worker API (CacheStorage), Web App Manifest, Web Crypto API, Screen Wake Lock API.

**Spec:** User 6-Part Enterprise Specification (Task 101: Enterprise Mobile-First PWA, Native Standalone Shell & Idempotent Offline Sync Engine).

## Global Constraints

- **Rule 1**: NO literal `+` in button labels (always use `<Plus className="h-4 w-4" /> <span>Label</span>`).
- **Rule 8**: Strict TypeScript verification: `npx tsc --noEmit` must pass with 0 errors across all routes and components.
- **Rule 13**: Server actions in `app/actions/*` MUST only export `async function`s.
- **Display Mode**: Must configure `display: 'standalone'` so the app launches without browser address bar or bottom navigation buttons.
- **Safe-Area Insets**: Header must support `padding-top: env(safe-area-inset-top)` and bottom navigation dock must support `padding-bottom: env(safe-area-inset-bottom)`.
- **RSC Flight Requests**: Service Worker MUST cache both document navigations (`mode === 'navigate'`) and Next.js RSC flight payloads (`request.headers.get('RSC') === '1'`).
- **Server Action Protection**: Service Worker MUST NEVER intercept `POST` requests so Next.js Server Actions execute unhindered.

## Review Focus

1. **RSC Flight Offline Navigation**: An offline `<Link>` navigation requesting `/schedules?_rsc=...` with header `RSC: 1` must hit the normalized service worker cache rather than throwing a client router chunk failure.
2. **Idempotent Mutation Replay**: Replaying a practical log mutation multiple times across intermittent mobile network drops must never create duplicate rows in `public.practical_logs`.
3. **Multi-User Storage Isolation**: Switching accounts or signing out on a shared institutional tablet must completely wipe all IndexedDB snapshots (`labsync_enterprise_idb`) and page caches.
4. **Active Lab Screen Wake Lock**: Opening an active lab session in `/computer-lab` must keep the teacher's phone display awake without dimming, gracefully releasing on tab blur or session end.
5. **Mobile Tactical Aisle Deck Ergonomics**: On viewports `< 768px`, `/computer-lab` defaults to a high-contrast 2-column Aisle Deck with 48px touch targets for Present/Absent/Fault without requiring 2D CAD canvas pinch-zooming.

---

## File Structure & Subsystem Blueprint

```
├── app/
│   ├── manifest.ts                                   # Next.js 16 App Router metadata manifest
│   ├── layout.tsx                                     # Viewport export + safe-area body config
│   ├── globals.css                                    # Standalone touch polish & overscroll shield
│   └── actions/
│       ├── logs.ts                                    # Idempotent practical log mutations (ON CONFLICT)
│       └── auth.ts                                    # Sign-out cache wipe trigger
├── public/
│   ├── sw.js                                          # RSC-aware, POST-bypassing service worker
│   └── icons/
│       ├── icon-192x192.png                           # PWA standard Android icon
│       ├── icon-512x512.png                           # PWA high-res Android splash icon
│       ├── maskable-icon-512x512.png                  # Adaptive maskable icon
│       └── apple-touch-icon.png                       # iOS Safari home screen icon
├── components/
│   ├── layout/
│   │   ├── mobile-bottom-nav.tsx                      # 5-destination persistent bottom dock (< 768px)
│   │   └── cloud-sync-status.tsx                      # Header offline pill & outbox telemetry
│   ├── pwa/
│   │   ├── pwa-register.tsx                           # Service worker registration & update toast
│   │   └── pwa-install-prompt.tsx                     # Android beforeinstallprompt & iOS guide drawer
│   └── computer-lab/
│       ├── mobile-tactical-aisle-deck.tsx             # 2-column 48px touch aisle deck (< 768px)
│       └── computer-lab-workspace.tsx                 # Wake lock + Aisle vs CAD canvas switcher
├── hooks/
│   └── use-wake-lock.ts                               # Screen Wake Lock API lifecycle hook
├── lib/
│   ├── offline/
│   │   ├── offline-store.ts                           # UID-scoped IndexedDB (query_snapshots + mutation_outbox)
│   │   └── sync-manager.ts                            # Resilient FIFO outbox replayer with exponential backoff
│   └── cache/
│       └── client-query-cache.ts                      # Write-through persistence & cold start hydration
├── scripts/
│   └── migrations/
│       └── 20261104_offline_idempotency_keys.sql       # PostgreSQL migration: idempotency_key column & index
└── tests/
    └── pwa-and-offline-engine.test.mjs                # Comprehensive automated verification suite
```

---

## Task Decomposition

### Task 1: Web App Manifest, PWA Icons & Native Standalone Viewport

**Files:**
- Create: `app/manifest.ts`
- Create: `public/icons/icon-192x192.png`, `public/icons/icon-512x512.png`, `public/icons/maskable-icon-512x512.png`, `public/icons/apple-touch-icon.png`
- Modify: `app/layout.tsx:1-36`
- Modify: `app/globals.css:1-50`
- Test: `tests/pwa-and-offline-engine.test.mjs`

**Interfaces:**
- Produces: `export default function manifest(): MetadataRoute.Manifest`
- Produces: `export const viewport: Viewport` in `app/layout.tsx`

- [ ] **Step 1: Write test for manifest and viewport metadata**
  In `tests/pwa-and-offline-engine.test.mjs`, write test asserting `manifest()` returns `display: 'standalone'`, theme `#09090b`, `start_url: '/'`, valid icon paths, and shortcuts for `/computer-lab`, `/schedules`, and `/records`.
- [ ] **Step 2: Run test to verify it fails**
  Run: `node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/pwa-and-offline-engine.test.mjs`
  Expected: FAIL (manifest.ts does not exist).
- [ ] **Step 3: Generate high-resolution PWA icons in `public/icons/`**
  Generate crisp, brand-compliant PNG icon suite (`192x192`, `512x512`, `maskable`, `apple-touch-icon`) using Node canvas/png script or SVG rasterization.
- [ ] **Step 4: Implement `app/manifest.ts`**
  Return `MetadataRoute.Manifest` with standalone mode, obsidian theme `#09090b`, icons array, and operational shortcuts.
- [ ] **Step 5: Configure `export const viewport: Viewport` in `app/layout.tsx`**
  Configure `themeColor: '#09090b'`, `viewportFit: 'cover'`, `width: 'device-width'`, `initialScale: 1`, `maximumScale: 1`, `userScalable: false`. Add Apple web app meta tags.
- [ ] **Step 6: Enforce touch polish in `app/globals.css`**
  Add `overscroll-behavior-y: none;` and `-webkit-tap-highlight-color: transparent;` to `html, body`.
- [ ] **Step 7: Run test to verify it passes**
  Expected: PASS.

---

### Task 2: Persistent Mobile Bottom Navigation Dock & Screen Wake Lock

**Files:**
- Create: `components/layout/mobile-bottom-nav.tsx`
- Create: `hooks/use-wake-lock.ts`
- Modify: `app/(dashboard)/layout.tsx:50-80`
- Test: `tests/pwa-and-offline-engine.test.mjs`

**Interfaces:**
- Produces: `export function MobileBottomNav(): React.JSX.Element`
- Produces: `export function useWakeLock(isActive: boolean): { isLocked: boolean; error: Error | null }`

- [ ] **Step 1: Write test for wake lock hook lifecycle and bottom nav items**
  Assert `useWakeLock` requests screen lock on mount when `isActive=true`, releases on unmount, and degrades gracefully on unsupported environments. Assert `MobileBottomNav` exposes the 5 primary destinations (`/`, `/computer-lab`, `/schedules`, `/records`, `/profile` or menu).
- [ ] **Step 2: Run test to verify it fails**
  Expected: FAIL (modules not found).
- [ ] **Step 3: Implement `hooks/use-wake-lock.ts`**
  Use `navigator.wakeLock.request('screen')` with visibility listener (`visibilitychange`) to reacquire on tab restore and release on cleanup.
- [ ] **Step 4: Implement `components/layout/mobile-bottom-nav.tsx`**
  Render fixed obsidian bar (`md:hidden`, `h-16`, `pb-[env(safe-area-inset-bottom)]`, `bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800/80`) with 5 thumb-friendly buttons and subtle haptic feedback `navigator.vibrate?.(8)`.
- [ ] **Step 5: Integrate `MobileBottomNav` into `app/(dashboard)/layout.tsx`**
  Mount `MobileBottomNav` and add `pb-20 md:pb-0` to the main viewport container so the bottom dock never obscures table rows, cards, or buttons.
- [ ] **Step 6: Run test to verify it passes**
  Expected: PASS.

---

### Task 3: Mobile Tactical Aisle Mode in `/computer-lab`

**Files:**
- Create: `components/computer-lab/mobile-tactical-aisle-deck.tsx`
- Modify: `components/computer-lab/computer-lab-workspace.tsx`
- Test: `tests/pwa-and-offline-engine.test.mjs`

**Interfaces:**
- Produces: `export function MobileTacticalAisleDeck(props: MobileTacticalAisleDeckProps): React.JSX.Element`
- Consumes: `useWakeLock` inside `computer-lab-workspace.tsx`

- [ ] **Step 1: Write test for MobileTacticalAisleDeck rendering & roll-call toggling**
  Assert `MobileTacticalAisleDeck` groups workstations by row/bay, renders large 48px touch targets for Present/Absent toggles, and fires fast station callbacks.
- [ ] **Step 2: Run test to verify it fails**
  Expected: FAIL (module not found).
- [ ] **Step 3: Implement `components/computer-lab/mobile-tactical-aisle-deck.tsx`**
  Build high-contrast 2-column cards (PC-01 to PC-48) with status LEDs, assigned student names, and 48px tactile buttons for Attendance flip, Hand Raise resolve, and Quick Fault ticket.
- [ ] **Step 4: Wire Aisle Deck toggle and Wake Lock into `computer-lab-workspace.tsx`**
  Add segmented switcher on mobile screens (`< 768px`): `[Aisle Deck (Fast)] | [2D Floor Map]`, defaulting to Aisle Deck on phones. Wire `useWakeLock(Boolean(activeLiveSession))` so the phone never dims during practicals.
- [ ] **Step 5: Run test to verify it passes**
  Expected: PASS.

---

### Task 4: Next.js 16 RSC-Aware Service Worker (`public/sw.js`) & Registration

**Files:**
- Create: `public/sw.js`
- Create: `components/pwa/pwa-register.tsx`
- Modify: `app/providers.tsx`
- Test: `tests/pwa-and-offline-engine.test.mjs`

**Interfaces:**
- Produces: Service Worker with `labsync-static-v1` and `labsync-pages-v1`
- Produces: `export function PwaRegister(): React.JSX.Element`

- [ ] **Step 1: Write test for Service Worker fetch routing logic**
  Simulate Service Worker fetch events:
  - Assert `method !== 'GET'` is immediately bypassed (`POST` Server Actions bypass cache).
  - Assert `mode === 'navigate'` and `request.headers.get('RSC') === '1'` use 2,500ms network timeout falling back to cached shell.
  - Assert dynamic `_rsc` search params are normalized when indexing the cache.
  - Assert static assets use Cache-First strategy.
- [ ] **Step 2: Run test to verify it fails**
  Expected: FAIL (`public/sw.js` does not exist).
- [ ] **Step 3: Implement `public/sw.js`**
  Implement:
  - Cache names: `labsync-static-v1`, `labsync-pages-v1`.
  - Install phase: Precache core shells (`/`, `/computer-lab`, `/schedules`, `/records`, `/maintenance`, `/profile`, `/admin`).
  - Fetch phase: Strict non-GET bypass; static Cache-First; navigation & RSC Network-First with 2.5s timeout fallback.
  - Skip waiting & upgrade message handler.
- [ ] **Step 4: Implement `components/pwa/pwa-register.tsx`**
  Register `/sw.js` on client mount; detect worker updates and display obsidian upgrade toast with 1-tap "Update & Reload".
- [ ] **Step 5: Mount `PwaRegister` in `app/providers.tsx`**
- [ ] **Step 6: Run test to verify it passes**
  Expected: PASS.

---

### Task 5: Database Idempotency Guard & Server Action Hardening

**Files:**
- Create: `scripts/migrations/20261104_offline_idempotency_keys.sql`
- Modify: `app/actions/logs.ts`
- Test: `tests/pwa-and-offline-engine.test.mjs`

**Interfaces:**
- Produces: `public.practical_logs.idempotency_key TEXT UNIQUE`
- Consumes: `idempotencyKey?: string` in `createPracticalLog`

- [ ] **Step 1: Write test for idempotent practical log insertion**
  Execute `createPracticalLog` twice with the same `idempotency_key`. Assert the first succeeds and the second returns the existing record without inserting duplicate rows.
- [ ] **Step 2: Run test to verify it fails**
  Expected: FAIL (`idempotency_key` column not recognized / duplicates inserted).
- [ ] **Step 3: Create and execute migration `scripts/migrations/20261104_offline_idempotency_keys.sql`**
  ```sql
  ALTER TABLE public.practical_logs
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

  CREATE INDEX IF NOT EXISTS idx_practical_logs_idempotency_key
  ON public.practical_logs (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
  ```
- [ ] **Step 4: Update `createPracticalLog` and `markSessionSkipped` in `app/actions/logs.ts`**
  Extract `idempotency_key` from payload and perform `INSERT ... ON CONFLICT (idempotency_key) DO UPDATE SET updated_at = NOW() RETURNING *`.
- [ ] **Step 5: Run test to verify it passes**
  Expected: PASS.

---

### Task 6: UID-Scoped IndexedDB Datastore (`offline-store.ts`) & Cache Integration

**Files:**
- Create: `lib/offline/offline-store.ts`
- Modify: `lib/cache/client-query-cache.ts`
- Modify: `app/actions/auth.ts`
- Test: `tests/pwa-and-offline-engine.test.mjs`

**Interfaces:**
- Produces: `hydrateCacheFromIndexedDB(uid: string): Promise<void>`
- Produces: `persistSnapshotToIndexedDB(uid: string, key: string, data: any): Promise<void>`
- Produces: `purgeAllOfflineData(): Promise<void>`
- Produces: `enqueueOfflineMutation(mutation: OfflineMutationEntry): Promise<void>`

- [ ] **Step 1: Write test for IndexedDB snapshot persistence, cold-start hydration, and sign-out wipe**
  Assert snapshots stored under UID A cannot be read by UID B. Assert `hydrateCacheFromIndexedDB` populates in-memory cache in < 25ms. Assert `purgeAllOfflineData` empties all object stores and deletes page caches.
- [ ] **Step 2: Run test to verify it fails**
  Expected: FAIL (`lib/offline/offline-store.ts` does not exist).
- [ ] **Step 3: Implement `lib/offline/offline-store.ts`**
  Create `labsync_enterprise_idb` (v1) with stores:
  - `query_snapshots` (keyPath: `scopedKey`) where `scopedKey = ${uid}::${cacheKey}`
  - `mutation_outbox` (keyPath: `idempotencyKey`)
  Implement `saveSnapshot`, `getSnapshotsForUser`, `enqueueMutation`, `getPendingMutations`, and `purgeAllOfflineData`.
- [ ] **Step 4: Wire write-through persistence into `lib/cache/client-query-cache.ts`**
  On `setCachedQuery` and `setCachedData`, asynchronously mirror whitelisted datasets (`bootstrap:`, `schedules:`, `workstations:`, `seat-plan:`, `live-session:`, `logs:`, `auth:`) to IndexedDB using `requestIdleCallback`. Provide `hydrateCacheFromIndexedDB(uid)`.
- [ ] **Step 5: Wire `purgeAllOfflineData` into sign-out handlers**
  In `signOutAction` and `UserProfileMenu`, trigger `purgeAllOfflineData()` before session redirect.
- [ ] **Step 6: Run test to verify it passes**
  Expected: PASS.

---

### Task 7: Resilient Offline Sync Manager & Header Telemetry Pill

**Files:**
- Create: `lib/offline/sync-manager.ts`
- Modify: `components/layout/cloud-sync-status.tsx`
- Test: `tests/pwa-and-offline-engine.test.mjs`

**Interfaces:**
- Produces: `export function executeResilientMutation(type, payload): Promise<void>`
- Produces: `export function flushMutationOutbox(): Promise<SyncResult>`
- Produces: Enhanced `CloudSyncStatus` pill with three states (Offline Saved / Syncing / Synced)

- [ ] **Step 1: Write test for offline optimistic mutation and FIFO replay**
  Enqueue offline practical log mutation while offline. Assert client cache updates optimistically with `syncStatus: 'pending_offline'`. Trigger `flushMutationOutbox` and assert server action executes and outbox clears.
- [ ] **Step 2: Run test to verify it fails**
  Expected: FAIL (`lib/offline/sync-manager.ts` does not exist).
- [ ] **Step 3: Implement `lib/offline/sync-manager.ts`**
  Implement:
  - `executeResilientMutation`: generates UUIDv4 `idempotencyKey`, updates cache optimistically, enqueues to IndexedDB, updates `navigator.setAppBadge?.(count)`.
  - `flushMutationOutbox`: FIFO execution with exponential backoff on `online` and `visibilitychange`. Clears app badge on completion.
- [ ] **Step 4: Update `components/layout/cloud-sync-status.tsx`**
  Render compact obsidian telemetry pill:
  - Amber badge: `Offline Mode • Saved Locally (X pending)`
  - Animated blue badge: `Syncing X records...`
  - Emerald badge: `Synced`
- [ ] **Step 5: Run test to verify it passes**
  Expected: PASS.

---

### Task 8: Smart PWA Install Manager (Android 1-Tap & iOS Guide Drawer)

**Files:**
- Create: `components/pwa/pwa-install-prompt.tsx`
- Modify: `components/layout/collapsible-sidebar.tsx`
- Modify: `components/layout/mobile-bottom-nav.tsx`
- Test: `tests/pwa-and-offline-engine.test.mjs`

**Interfaces:**
- Produces: `export function PwaInstallPrompt(): React.JSX.Element | null`

- [ ] **Step 1: Write test for PWA install prompt behavior**
  Assert prompt is hidden when `window.matchMedia('(display-mode: standalone)').matches` is true. Assert it captures `beforeinstallprompt` on Android and presents 1-tap install sheet. Assert it renders step-by-step visual drawer on iOS Safari.
- [ ] **Step 2: Run test to verify it fails**
  Expected: FAIL (`components/pwa/pwa-install-prompt.tsx` does not exist).
- [ ] **Step 3: Implement `components/pwa/pwa-install-prompt.tsx`**
  - Standalone detection: automatically hide when already running standalone.
  - Android/Desktop: capture `beforeinstallprompt` and surface 1-tap install button triggering native prompt.
  - iOS/iPadOS: detect Safari user agent and present elegant 3-step visual guide (Share [↑] $\rightarrow$ Add to Home Screen $\rightarrow$ Launch).
- [ ] **Step 4: Mount install prompt in mobile bottom sheet and sidebar**
- [ ] **Step 5: Run test to verify it passes**
  Expected: PASS.

---

### Task 9: Final End-to-End System Verification & Documentation

**Files:**
- Create: `doc/tasks/2026-11-04-task-101-mobile-installable-pwa-and-offline-engine.md`
- Modify: `doc/tasks/README.md`
- Test: Complete test suite execution

- [ ] **Step 1: Execute `npx tsc --noEmit` and confirm 0 errors**
  Run: `node ./node_modules/typescript/bin/tsc --noEmit` (unsandboxed)
  Expected: 0 errors across all routes and components.
- [ ] **Step 2: Run comprehensive performance & offline test suites**
  Run: `node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/performance-bootstrap-and-cache.test.mjs tests/verify-performance-and-csr.test.mjs tests/pwa-and-offline-engine.test.mjs`
  Expected: All tests pass with 100% success rate.
- [ ] **Step 3: Create authoritative task documentation**
  Write `doc/tasks/2026-11-04-task-101-mobile-installable-pwa-and-offline-engine.md` detailing manifest specifications, service worker caching mechanics, IndexedDB schema, and wake lock integration.
- [ ] **Step 4: Update master registry in `doc/tasks/README.md`**

