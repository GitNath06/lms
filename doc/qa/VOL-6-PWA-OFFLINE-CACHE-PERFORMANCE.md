# LabSync LIMS — IEEE 29119 QA Specification Suite
## VOLUME 6: PWA Engine, Service Worker Isolation, Offline Outbox & Sub-50ms Performance

> **Document Reference**: `LMR-QA-VOL6-2026-V1`  
> **Standard**: ISO/IEC/IEEE 29119-3:2021 (Test Documentation), IEEE 829  
> **Traceability Root**: [00-MASTER-QA-INDEX-AND-RTM.md](file:///d:/Projects/LMR/doc/qa/00-MASTER-QA-INDEX-AND-RTM.md)  
> **Scope**: Service Worker `public/sw.js`, PWA Manifest, IndexedDB Engine, Idempotency Replay, Sub-50ms SLA  
> **Status**: APPROVED & CANONICAL  
> **Last Verified**: 2026-11-12

---

## 1. Standalone WebAPK Installation & Manifest

### TC-VOL6-001: Android Chrome WebAPK Native Install Prompt (`beforeinstallprompt`)
* **Test ID & Classification Tag**: `TC-VOL6-001` • `[MANUAL-DEVICE]` + `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Manifest: `app/manifest.ts` &rarr; `/manifest.webmanifest`
  * Component: `components/pwa/pwa-install-prompt.tsx`
* **Preconditions & RBAC Matrix**:
  * Device: Vivo V23 5G / Android 14 Chrome. First-time visitor uninstalled state.
* **Sequential Step-by-Step Path**:
  1. Open LabSync in Android Chrome.
  2. Browser fires `beforeinstallprompt` event.
  3. LabSync custom install prompt surfaces at bottom of screen.
  4. Tap `"Install LabSync App"`.
  5. Native Android WebAPK build progress bar completes.
  6. App installs to home screen with custom lab flask icon.
* **Combinatorial & Edge Permutations**:
  * User dismisses prompt &rarr; Dismissal timestamp recorded in `localStorage`; prompt suppressed for 7 days.
  * Standalone mode already running (`display-mode: standalone`) &rarr; Install prompt remains completely unmounted (`0 elements in DOM`).
* **Layer 1: UI & Geometry Proof**:
  * Install prompt banner has `z-index: 45` resting above content with zero literal `+` in button labels (Rule 1).
  * Uses Lucide `<Download className="h-4 w-4" />`.
* **Layer 2 & 3: Cache & Network Proof**:
  * `manifest.webmanifest` returns HTTP 200 with `start_url: "/"`, `display: "standalone"`, `theme_color: "#09090b"`.

---

### TC-VOL6-002: PWA Manifest Icons Binary Headers & Maskable Proof
* **Test ID & Classification Tag**: `TC-VOL6-002` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Manifest: `app/manifest.ts`
  * Public Assets: `public/icons/icon-192x192.png`, `public/icons/icon-512x512.png`, `public/icons/maskable-icon-512x512.png`
* **Preconditions & RBAC Matrix**:
  * Unauthenticated PWA asset crawler.
* **Sequential Step-by-Step Path**:
  1. Fetch all manifest icons.
* **Layer 2 & 3: Cache & Network Proof**:
  * PNG magic number verified in binary buffer (`0x89, 0x50, 0x4E, 0x47`).
  * Dimensions match manifest declarations: `192×192` and `512×512`.
  * `purpose: "maskable"` present in manifest JSON for Android adaptive icons.

---

### TC-VOL6-003: iOS Safari 3-Step Add to Home Screen Modal Drawer
* **Test ID & Classification Tag**: `TC-VOL6-003` • `[MANUAL-DEVICE]`
* **Exact Target Files**:
  * Component: `components/pwa/pwa-install-prompt.tsx`
* **Preconditions & RBAC Matrix**:
  * Browser: iOS Safari (iPhone 14 / iPad).
* **Sequential Step-by-Step Path**:
  1. Open LabSync in Safari on iOS.
  2. Tap install trigger.
  3. Modal drawer slides up displaying 3-step visual instruction:
     * Step 1: Tap the Share button `<Share className="inline" />` in Safari toolbar.
     * Step 2: Scroll down and select `"Add to Home Screen"`.
     * Step 3: Tap `"Add"` in top right corner.
* **Layer 1: UI & Geometry Proof**:
  * Drawer points down to bottom center toolbar on iPhone.

---

### TC-VOL6-004: Native Home Screen App Shortcuts Navigation
* **Test ID & Classification Tag**: `TC-VOL6-004` • `[MANUAL-DEVICE]`
* **Exact Target Files**:
  * Manifest: `app/manifest.ts` &rarr; `shortcuts`
* **Preconditions & RBAC Matrix**:
  * Installed PWA icon on Android Home Screen.
* **Sequential Step-by-Step Path**:
  1. Long-press LabSync app icon on Android phone home screen.
  2. Native app shortcut menu displays:
     * `"Live Lab Cockpit"` &rarr; Launches directly into `/computer-lab`.
     * `"Weekly Timetable"` &rarr; Launches directly into `/schedules`.
     * `"Practical Records"` &rarr; Launches directly into `/records`.
  3. Tap `"Live Lab Cockpit"`.
* **Layer 1: UI & Geometry Proof**:
  * App opens instantly without address bar, directly mounted on `/computer-lab`.

---

### TC-VOL6-005: Standalone Display Mode Navigation & Status Bar Theme
* **Test ID & Classification Tag**: `TC-VOL6-005` • `[MANUAL-DEVICE]`
* **Exact Target Files**:
  * Manifest: `app/manifest.ts`
  * Layout: `app/(dashboard)/layout.tsx`
* **Preconditions & RBAC Matrix**:
  * PWA running in standalone mode.
* **Sequential Step-by-Step Path**:
  1. Inspect top Android system status bar.
* **Layer 1: UI & Geometry Proof**:
  * Android system status bar background matches dark canvas (`#09090b` / `#0B0F19`).
  * System icons (WiFi, Battery, Clock) rendered in high-contrast crisp white.

---

## 2. Next.js 16 Service Worker (v2) HTML vs. RSC Flight Isolation

### TC-VOL6-006: Strict Non-GET Server Action Bypass Guard
* **Test ID & Classification Tag**: `TC-VOL6-006` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Service Worker: `public/sw.js`
* **Preconditions & RBAC Matrix**:
  * Client executing Next.js Server Action (`POST` request with `Next-Action` header).
* **Sequential Step-by-Step Path**:
  1. Submit a practical log or report an incident (`POST /records`).
  2. Inspect Service Worker fetch intercept telemetry.
* **Layer 2 & 3: Cache & Network Proof**:
  * Service Worker detects `request.method !== 'GET'`.
  * Request bypasses Service Worker cache entirely (`return fetch(request)`).
  * Server Action payload is never cached or hijacked by SW cache storage.

---

### TC-VOL6-007: HTML Cache Isolation from RSC Flight Payloads
* **Test ID & Classification Tag**: `TC-VOL6-007` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Service Worker: `public/sw.js`
* **Preconditions & RBAC Matrix**:
  * Next.js 16 App Router client-side navigation.
* **Sequential Step-by-Step Path**:
  1. Navigate between `/schedules` and `/records`.
  2. Inspect Cache Storage in browser DevTools.
* **Layer 2 & 3: Cache & Network Proof**:
  * Cache `labsync-html-v2` contains strictly HTML documents (`Content-Type: text/html`).
  * Cache `labsync-rsc-v2` contains strictly Next.js RSC Flight query responses (`?_rsc=...`).
  * Zero cross-contamination between HTML documents and React Flight chunks.

---

### TC-VOL6-008: Cold Offline Reload React Flight String Dump Prevention
* **Test ID & Classification Tag**: `TC-VOL6-008` • `[MANUAL-DEVICE]` + `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Service Worker: `public/sw.js`
* **Preconditions & RBAC Matrix**:
  * User navigates to `/computer-lab`, then turns on Airplane Mode (zero network).
* **Sequential Step-by-Step Path**:
  1. With Airplane Mode ON, press browser Reload (`F5` or `Ctrl+R`).
  2. Verify rendered page content.
* **Layer 1: UI & Geometry Proof**:
  * The screen renders the visual HTML dashboard UI cleanly.
  * It NEVER displays raw React Flight strings like `1:"$Sreact.fragment"` or raw JSON dumps on screen!
* **Layer 2 & 3: Cache & Network Proof**:
  * `sw.js` detects `mode === 'navigate'` and guarantees serving from `labsync-html-v2` or falls back to `/offline.html`.

---

### TC-VOL6-009: Offline Fallback Page (`public/offline.html`) Document Route Guard
* **Test ID & Classification Tag**: `TC-VOL6-009` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Public Asset: `public/offline.html`
  * Service Worker: `public/sw.js`
* **Preconditions & RBAC Matrix**:
  * User visits an unvisited route (e.g., `/settings/new`) while in Airplane Mode.
* **Sequential Step-by-Step Path**:
  1. Disconnect network. Navigate to un-cached route.
* **Layer 1: UI & Geometry Proof**:
  * High-contrast offline recovery screen renders:
    * Institutional logo and `"Laboratory Sync Offline"`.
    * Instructions to reconnect to institutional Wi-Fi.
    * 1-tap `"Return to Dashboard"` button.

---

### TC-VOL6-010: Legacy Service Worker Cache Auto-Purge on Activate
* **Test ID & Classification Tag**: `TC-VOL6-010` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Service Worker: `public/sw.js`
* **Preconditions & RBAC Matrix**:
  * User upgrading from legacy v1 deployment with stale cache `labsync-pages-v1`.
* **Sequential Step-by-Step Path**:
  1. Trigger Service Worker update (`registration.update()`).
* **Layer 2 & 3: Cache & Network Proof**:
  * `activate` event handler iterates through `caches.keys()`.
  * Automatically deletes `labsync-pages-v1`, `labsync-v1-cache`, and obsolete static caches.

---

## 3. UID-Scoped IndexedDB Snapshot Store & Airplane Mode

### TC-VOL6-011: UID-Scoped IndexedDB Snapshot Storage Isolation
* **Test ID & Classification Tag**: `TC-VOL6-011` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Storage Lib: `lib/offline/offline-store.ts` &rarr; `saveQuerySnapshot`, `getQuerySnapshot`
* **Preconditions & RBAC Matrix**:
  * Teacher A (`uid-a`) logs in and views schedules.
* **Sequential Step-by-Step Path**:
  1. Query schedules.
  2. Inspect IndexedDB `labsync_enterprise_idb` &rarr; `query_snapshots`.
* **Layer 2 & 3: Cache & Network Proof**:
  * Key stored is strictly formatted: `uid-a::schedules:list`.
  * Data cannot be read by another user logging in on the same physical browser.

---

### TC-VOL6-012: Cold-Start Airplane Mode Offline Boot Hydration
* **Test ID & Classification Tag**: `TC-VOL6-012` • `[MANUAL-DEVICE]` + `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Cache Engine: `lib/cache/client-query-cache.ts` &rarr; `hydrateCacheFromIndexedDB`
* **Preconditions & RBAC Matrix**:
  * Browser completely terminated. Device placed in Airplane Mode. Re-opened.
* **Sequential Step-by-Step Path**:
  1. Launch LabSync app in Airplane Mode.
  2. Measure time until timetable and workstation cards render.
* **Layer 1: UI & Geometry Proof**:
  * UI renders full cached timetable in `< 30ms`.
* **Layer 2 & 3: Cache & Network Proof**:
  * `hydrateCacheFromIndexedDB` populates in-memory `memoryCache` from IndexedDB before component renders.

---

### TC-VOL6-013: Offline Timetable & Workstation Navigation Under Zero Connectivity
* **Test ID & Classification Tag**: `TC-VOL6-013` • `[MANUAL-DEVICE]`
* **Exact Target Files**:
  * Routes: `/schedules`, `/computer-lab`, `/records`
* **Preconditions & RBAC Matrix**:
  * Airplane Mode active. User previously visited all 3 tabs while online.
* **Sequential Step-by-Step Path**:
  1. Tap `"Schedule"` bottom dock tab &rarr; Timetable renders with zero loading spinners.
  2. Tap `"Live Lab"` bottom dock tab &rarr; 34 workstations render with student seat assignments.
  3. Tap `"Records"` bottom dock tab &rarr; Historical logbook renders.

---

### TC-VOL6-014: User Account Switch Storage Eviction & Cryptographic Wipe
* **Test ID & Classification Tag**: `TC-VOL6-014` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Storage Lib: `lib/offline/offline-store.ts` &rarr; `purgeAllOfflineData`
  * Action: `app/actions/auth.ts` &rarr; `signOut`
* **Preconditions & RBAC Matrix**:
  * Shared laboratory laptop used by multiple teachers.
* **Sequential Step-by-Step Path**:
  1. Teacher A signs out.
* **Layer 2 & 3: Cache & Network Proof**:
  * `purgeAllOfflineData()` clears IndexedDB `query_snapshots`, `outbox_mutations`, and `localStorage` session keys.
  * Teacher B signs in &rarr; Sees zero trace of Teacher A's cached attendance or private notes.

---

### TC-VOL6-015: IndexedDB Schema Versioning & Automatic Migration
* **Test ID & Classification Tag**: `TC-VOL6-015` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Storage Lib: `lib/offline/offline-store.ts`
* **Preconditions & RBAC Matrix**:
  * Database version upgraded from `v1` to `v2` (adding `idempotency_key` index).
* **Sequential Step-by-Step Path**:
  1. Open app with legacy `v1` IndexedDB on disk.
* **Layer 2 & 3: Cache & Network Proof**:
  * `onupgradeneeded` handler executes smoothly, adding required indexes without crashing the client or corrupting existing queued mutations.

---

## 4. Idempotent Offline Mutation Outbox & Auto-Replay

### TC-VOL6-016: Offline Practical Log Submission & Optimistic UI Injection
* **Test ID & Classification Tag**: `TC-VOL6-016` • `[MANUAL-DEVICE]` + `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Sync Manager: `lib/offline/sync-manager.ts` &rarr; `queueOfflineMutation`
  * Action: `app/actions/logs.ts` &rarr; `createPracticalLog`
* **Preconditions & RBAC Matrix**:
  * Laboratory Wi-Fi drops mid-practical class. Teacher submits log anyway.
* **Sequential Step-by-Step Path**:
  1. Disconnect Wi-Fi.
  2. On `/records/new`, click `"Save & Submit Practical Log"`.
* **Layer 1: UI & Geometry Proof**:
  * UI displays toast: `"Offline Mode: Log saved locally. Will sync when reconnected."`
  * Logbook immediately shows the new record marked with an Amber `"Pending Sync"` badge.
* **Layer 2 & 3: Cache & Network Proof**:
  * Mutation captured in IndexedDB store `outbox_mutations` with UUID v4 `idempotency_key`.

---

### TC-VOL6-017: Native App Icon Badging for Queued Mutations (`navigator.setAppBadge`)
* **Test ID & Classification Tag**: `TC-VOL6-017` • `[MANUAL-DEVICE]`
* **Exact Target Files**:
  * Sync Manager: `lib/offline/sync-manager.ts`
* **Preconditions & RBAC Matrix**:
  * 3 offline actions queued (1 practical log + 2 workstation fault tickets).
* **Sequential Step-by-Step Path**:
  1. Inspect LabSync app icon on Android/macOS home screen/dock.
* **Layer 1: UI & Geometry Proof**:
  * Native app icon badge displays number `"3"`.
* **Layer 2 & 3: Cache & Network Proof**:
  * When online sync succeeds, `navigator.clearAppBadge()` clears the badge count back to zero.

---

### TC-VOL6-018: Network Online Event FIFO Chronological Replay
* **Test ID & Classification Tag**: `TC-VOL6-018` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Sync Manager: `lib/offline/sync-manager.ts` &rarr; `replayOfflineQueue`
* **Preconditions & RBAC Matrix**:
  * 2 mutations queued while offline. Wi-Fi restored.
* **Sequential Step-by-Step Path**:
  1. Trigger `window.dispatchEvent(new Event('online'))`.
  2. Sync engine activates, reading outbox in FIFO chronological order (`created_at ASC`).
  3. Dispatches each mutation sequentially to its target Server Action.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Mutations committed to PostgreSQL in exact sequence. Both records created with valid timestamps.

---

### TC-VOL6-019: Exponential Backoff Re-try Strategy Under Unstable Connectivity
* **Test ID & Classification Tag**: `TC-VOL6-019` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Sync Manager: `lib/offline/sync-manager.ts`
* **Preconditions & RBAC Matrix**:
  * Flaky edge connection failing 2 times before succeeding on 3rd attempt.
* **Sequential Step-by-Step Path**:
  1. First replay attempt fails &rarr; Delay 1000ms (`retry_count = 1`).
  2. Second attempt fails &rarr; Delay 2000ms (`retry_count = 2`).
  3. Third attempt succeeds &rarr; Mutation removed from outbox.

---

### TC-VOL6-020: PostgreSQL `idempotency_key` Unique Duplicate Drop Proof
* **Test ID & Classification Tag**: `TC-VOL6-020` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/logs.ts`
  * Migration: `20261104_offline_idempotency_keys.sql`
* **Preconditions & RBAC Matrix**:
  * Network packet dropped after server processed request, causing client to re-send same mutation.
* **Sequential Step-by-Step Path**:
  1. Send `createPracticalLog` with `idempotency_key = "abc-123"`.
  2. Send identical request again with same `idempotency_key = "abc-123"`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Database executes:
    ```sql
    INSERT INTO public.practical_logs (...) VALUES (...)
    ON CONFLICT (idempotency_key) DO NOTHING;
    ```
  * Exactly 1 row exists in `public.practical_logs`. Zero duplicate records created!

---

## 5. Zero-Skeleton Frame-1 Render & Sub-50ms Latency SLA

### TC-VOL6-021: Frame-1 Synchronous Hydration (Zero Skeleton Flicker on Revisit)
* **Test ID & Classification Tag**: `TC-VOL6-021` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Component: `components/schedules/schedule-grid-client.tsx`
  * Cache: `lib/cache/client-query-cache.ts` &rarr; `getCachedQuery`
* **Preconditions & RBAC Matrix**:
  * User switches from `/records` back to `/schedules`.
* **Sequential Step-by-Step Path**:
  1. Click `"Records"` tab, then click `"Schedule"` tab.
  2. Record high-speed 60 FPS video capture of screen.
* **Layer 1: UI & Geometry Proof**:
  * Frame 1 (0ms): Timetable grid painted immediately.
  * Number of skeleton pulse frames painted: **0**.
* **Layer 2 & 3: Cache & Network Proof**:
  * Initial state initialized via `useState(() => getCachedQuery('schedules:list'))`.

---

### TC-VOL6-022: Single-RTT Institutional Data Bootstrapping
* **Test ID & Classification Tag**: `TC-VOL6-022` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/bootstrap.ts` &rarr; `getLabSyncBootstrapData()`
* **Preconditions & RBAC Matrix**:
  * Fresh app boot on high-latency 3G connection.
* **Sequential Step-by-Step Path**:
  1. App initializes. Single call to `getLabSyncBootstrapData()` executes.
* **Layer 2 & 3: Cache & Network Proof**:
  * Single RTT returns: Current Academic Year, Active Period Slots, Lab Facility List, and Current User Profile.
  * Replaces 4 waterfall server calls with 1 roundtrip.

---

### TC-VOL6-023: PostgreSQL OID String Parsing (Bypassing UTC Skew on Nepali Dates)
* **Test ID & Classification Tag**: `TC-VOL6-023` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Database Driver: `lib/db.ts` &rarr; PostgreSQL OID type parsers
* **Preconditions & RBAC Matrix**:
  * Practical log recorded on Bikram Sambat date `२०८३ कात्तिक २६` (AD `2026-11-12`).
* **Sequential Step-by-Step Path**:
  1. Query date column via `pg` connection pool.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * OID 1082 (`DATE`), OID 1114 (`TIMESTAMP`), and OID 1184 (`TIMESTAMPTZ`) parsed as pure ISO strings (`"2026-11-12"`).
  * Node.js `Date` timezone offset bug (+05:45 shifting day backwards) is mathematically prevented!

---

### TC-VOL6-024: Fast-Path HMAC Session Claim Evaluation (< 2ms at Edge)
* **Test ID & Classification Tag**: `TC-VOL6-024` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Security Lib: `lib/security/session-claim.ts`
  * Edge Proxy: `proxy.ts`
* **Preconditions & RBAC Matrix**:
  * Every authenticated request passing through edge proxy.
* **Sequential Step-by-Step Path**:
  1. Benchmark edge middleware processing time across 100 requests.
* **Layer 2 & 3: Cache & Network Proof**:
  * Average HMAC claim verification latency: `< 2.1ms`.
  * Zero database trips required to authenticate valid sessions at edge.

---

### TC-VOL6-025: High-Density Surface CSS GPU Optimization
* **Test ID & Classification Tag**: `TC-VOL6-025` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Styles: `app/globals.css` &rarr; `.glass-card`
* **Preconditions & RBAC Matrix**:
  * Low-end smartphone rendering 34 workstation cards.
* **Sequential Step-by-Step Path**:
  1. Scroll through live computer lab floor.
  2. Measure compositor FPS in DevTools Performance panel.
* **Layer 1: UI & Geometry Proof**:
  * Workstation cards use layered surface opacity (`bg-surface-1`, `border-border-subtle`).
  * `backdrop-filter: blur(...)` is strictly absent on repeated card grids (Rule 7), maintaining steady 60 FPS on low-power mobile GPUs.

