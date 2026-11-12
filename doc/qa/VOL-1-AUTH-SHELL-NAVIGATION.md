# LabSync LIMS — IEEE 29119 QA Specification Suite
## VOLUME 1: Authentication, Security Proxy, Shell Layout, Navigation & Executive Dashboard

> **Document Reference**: `LMR-QA-VOL1-2026-V1`  
> **Standard**: ISO/IEC/IEEE 29119-3:2021 (Test Documentation), IEEE 829  
> **Traceability Root**: [00-MASTER-QA-INDEX-AND-RTM.md](file:///d:/Projects/LMR/doc/qa/00-MASTER-QA-INDEX-AND-RTM.md)  
> **Scope**: Route `/(auth)/login`, Root Dashboard `/`, Layout Shell, Navigation Components, Session Claims, OTP Pipelines  
> **Status**: APPROVED & CANONICAL  
> **Last Verified**: 2026-11-12

---

## 1. Authentication, OTP Security & Cryptographic Erasure

### TC-VOL1-001: Email/Password Authentication & Session Cookie Creation
* **Test ID & Classification Tag**: `TC-VOL1-001` • `[AUTO-E2E-GEOMETRY]` + `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Route: `app/(auth)/login/page.tsx`
  * Components: `components/auth/login-form.tsx`
  * Action: `app/actions/auth.ts` &rarr; `signIn(email, password)`
  * Security: `lib/security/session-claim.ts` &rarr; `mintSessionToken(profile)`
* **Preconditions & RBAC Matrix**:
  * User state: Registered and approved institutional account (`super_admin`, `lab_incharge`, or `teacher`).
  * Network: Online (4G / Broadband).
  * Viewports: 393×873 (Vivo V23 5G), 768×858, 1686×858.
* **Sequential Step-by-Step Path**:
  1. Navigate to `/login` via browser.
  2. Input valid institutional email `admin@labsync.edu.np` into `input[type="email"]`.
  3. Input password into `input[type="password"]`.
  4. Click `button[type="submit"]` labeled `"Sign In to Laboratory"`.
  5. Monitor window transition and verify redirection to `/`.
* **Combinatorial & Edge Permutations**:
  * Whitespace-padded email (`  admin@labsync.edu.np  `) &rarr; Auto-trimmed on client.
  * Rapid double-click on Submit (< 50ms) &rarr; Button disabled with `Loader2` spinner; single server request sent.
  * Incorrect password &rarr; Form displays inline alert `"Invalid credentials. Please verify your email and password."`
* **Layer 1: UI & Geometry Proof**:
  * Form card is horizontally centered: `Math.abs((window.innerWidth - card.getBoundingClientRect().right) - card.getBoundingClientRect().left) <= 2`.
  * Touch target for Submit button: `submitBtn.getBoundingClientRect().height >= 44px`.
  * Document scroll width equals viewport: `document.documentElement.scrollWidth <= window.innerWidth`.
* **Layer 2 & 3: Cache & Network Proof**:
  * Network POST to server action `signIn` returns HTTP 200 with `{ success: true, redirectUrl: '/' }`.
  * Response header `Set-Cookie` contains `sb-access-token` (HttpOnly, Secure, SameSite=Lax).
  * Fast-path session cookie `labsync_session_claim` set with signed HMAC SHA-256 payload.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Row in `public.profiles` has `last_sign_in_at` timestamp updated within 5000ms.
  * Audit ledger mutation:
    ```sql
    SELECT COUNT(*) FROM public.audit_ledger 
    WHERE entity_type = 'auth' AND action = 'login' AND actor_id = 'user-uuid-123' 
    AND created_at >= NOW() - INTERVAL '1 minute';
    -- Assert: count === 1
    ```

---

### TC-VOL1-002: Demo Account 1-Tap Quick-Fill Acceleration
* **Test ID & Classification Tag**: `TC-VOL1-002` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Route: `app/(auth)/login/page.tsx`
  * Action: `app/actions/auth.ts` &rarr; `getDemoAccountPassword(role)`
* **Preconditions & RBAC Matrix**:
  * Preconditions: Unauthenticated visitor accessing staging/development environment.
  * Viewports: 393×873, 1106×858.
* **Sequential Step-by-Step Path**:
  1. Open `/login`.
  2. Locate `"Demo Accounts"` role selector badge group.
  3. Click `"Super Admin"` preset button.
  4. Verify email field populates with demo admin email and password field fills automatically.
  5. Click `"Sign In to Laboratory"`.
* **Combinatorial & Edge Permutations**:
  * Production environment (`NODE_ENV === 'production'`) &rarr; Demo selector is conditionally unmounted from DOM (`expect(page.locator('.demo-accounts-pill')).toHaveCount(0)`).
* **Layer 1: UI & Geometry Proof**:
  * Demo badge buttons have minimum touch target: `badge.getBoundingClientRect().height >= 36px`.
  * Gap between preset badges: `gap >= 8px`.
* **Layer 2 & 3: Cache & Network Proof**:
  * `getDemoAccountPassword` resolves within 120ms with obfuscated credential payload.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Demo credentials authenticate against pre-seeded records in `auth.users` without modifying user privileges.

---

### TC-VOL1-003: User Registration & 6-Digit SMS/Email OTP Verification
* **Test ID & Classification Tag**: `TC-VOL1-003` • `[AUTO-DB-INTEGRATION]` + `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Route: `app/(auth)/login/page.tsx`
  * Actions: `app/actions/otp.ts` &rarr; `generateAndSendSignupOtp`, `verifySignupAndCreateAccount`
  * Components: `components/auth/signup-otp-modal.tsx`
* **Preconditions & RBAC Matrix**:
  * User state: Unregistered teacher applying for laboratory access.
  * Network: Online.
  * Viewports: 393×873 (Vivo V23 5G), 1280×800.
* **Sequential Step-by-Step Path**:
  1. On `/login`, toggle tab to `"Create Account"`.
  2. Fill `Full Name`, `Institutional Email`, `Mobile Number (+977)`, and `Proposed Role` (`Teacher`).
  3. Enter password matching all 4 security criteria.
  4. Click `"Send Verification Code"`.
  5. Intercept generated 6-digit OTP from database or test mailbox.
  6. Enter `6-digit OTP` into segmented inputs `[0]..[5]`.
  7. Click `"Confirm & Submit Registration"`.
* **Combinatorial & Edge Permutations**:
  * Wrong OTP entered &rarr; Border turns rose-500, input shakes (`animate-shake`), error message `"Incorrect 6-digit code. 2 attempts remaining."`
  * Expired OTP (> 10 minutes) &rarr; Inline message `"Verification code expired. Please request a new code."`
  * Resend cooldown &rarr; `"Resend Code"` button disabled with live countdown timer (`59s... 58s...`).
* **Layer 1: UI & Geometry Proof**:
  * OTP inputs: 6 discrete boxes, each `width >= 40px` and `height >= 48px`.
  * Dialog modal centered in viewport with backdrop overlay `z-index >= 50`.
* **Layer 2 & 3: Cache & Network Proof**:
  * `generateAndSendSignupOtp` returns `{ success: true, cooldownSeconds: 60 }`.
  * `verifySignupAndCreateAccount` executes atomically; returns `{ success: true, pendingApproval: true }`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Row inserted into `public.profiles`:
    ```sql
    SELECT role, approval_status FROM public.profiles WHERE email = 'newteacher@labsync.edu.np';
    -- Assert: role === 'teacher' AND approval_status === 'pending'
    ```
  * Row in `public.otp_verifications` marked `is_consumed = TRUE` with `consumed_at IS NOT NULL`.

---

### TC-VOL1-004: Self-Service Password Reset via Time-Limited OTP
* **Test ID & Classification Tag**: `TC-VOL1-004` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Actions: `app/actions/otp.ts` &rarr; `generateAndSendPasswordResetOtp`, `verifyAndResetPassword`
  * Route: `app/(auth)/login/page.tsx`
* **Preconditions & RBAC Matrix**:
  * Preconditions: Existing faculty account with forgotten password.
* **Sequential Step-by-Step Path**:
  1. Click `"Forgot Password?"` link below login form.
  2. Submit registered email address.
  3. Fetch OTP token from `public.otp_verifications`.
  4. Submit valid OTP along with `New Password` and `Confirm Password`.
* **Combinatorial & Edge Permutations**:
  * Non-existent email &rarr; Generic success message displayed to prevent user enumeration attacks: `"If that email is registered, a code has been sent."`
* **Layer 1: UI & Geometry Proof**:
  * Modal input focus ring: `ring-2 ring-indigo-500` without horizontal layout shift.
* **Layer 2 & 3: Cache & Network Proof**:
  * Prior session cookies and cache entries purged upon password change.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * `encrypted_password` in `auth.users` updated.
  * Audit ledger logs `action = 'password_reset_self_service'`.

---

### TC-VOL1-005: Deactivated & Pending Verification User Access Gates
* **Test ID & Classification Tag**: `TC-VOL1-005` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Layout: `app/(dashboard)/layout.tsx`
  * Components: `components/dashboard/pending-verification-banner.tsx`
* **Preconditions & RBAC Matrix**:
  * Account state: `approval_status = 'pending'` or `is_active = FALSE`.
  * Roles: `teacher`.
* **Sequential Step-by-Step Path**:
  1. Authenticate as pending user.
  2. Arrive on dashboard `/`.
  3. Observe banner and attempt navigation to `/records/new` or `/maintenance`.
* **Combinatorial & Edge Permutations**:
  * Direct URL access to `/records/new` &rarr; Server Action rejects submission; redirect to `/` with query `?error=verification_required`.
* **Layer 1: UI & Geometry Proof**:
  * `PendingVerificationBanner` spans 100% of main content width with amber-500/10 background.
  * Height of banner: `banner.getBoundingClientRect().height >= 56px`.
* **Layer 2 & 3: Cache & Network Proof**:
  * Server actions check `profile.approval_status === 'approved'` before mutating any tables.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Any attempted write by a pending user throws PostgreSQL application error: `"Unauthorized: Profile awaiting administrative verification."`

---

### TC-VOL1-006: Cryptographic Sign-Out & Offline Datastore Erasure
* **Test ID & Classification Tag**: `TC-VOL1-006` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Action: `app/actions/auth.ts` &rarr; `signOut()`
  * Offline Store: `lib/offline/offline-store.ts` &rarr; `purgeAllOfflineData()`
  * Storage Evictor: `components/layout/client-storage-evictor.tsx`
* **Preconditions & RBAC Matrix**:
  * User state: Logged in with offline cache snapshots in IndexedDB.
* **Sequential Step-by-Step Path**:
  1. Open User Profile Menu in top navbar.
  2. Click `"Sign Out"` action button.
  3. Await redirect to `/login`.
* **Combinatorial & Edge Permutations**:
  * Network offline during signout &rarr; Local IndexedDB data purged immediately; redirection occurs; server session cookies cleared upon reconnection.
* **Layer 1: UI & Geometry Proof**:
  * Redirection to `/login` within 800ms; login card rendered cleanly.
* **Layer 2 & 3: Cache & Network Proof**:
  * IndexedDB database `labsync_enterprise_idb` stores `query_snapshots` and `outbox_mutations` cleared (`count === 0`).
  * `localStorage.getItem('labsync_active_uid')` returns `null`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Session token invalidated in Supabase Auth session store.

---

### TC-VOL1-007: Password Requirements Real-Time Dynamic Validator
* **Test ID & Classification Tag**: `TC-VOL1-007` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Component: `components/auth/password-requirements-checklist.tsx`
* **Preconditions & RBAC Matrix**:
  * Preconditions: Sign-up or password change form active.
* **Sequential Step-by-Step Path**:
  1. Enter password `"short"`. Verify 4 requirement pills: (Min 8 chars: Fail, Upper: Fail, Number: Fail, Special: Fail).
  2. Type `"Admin123!"`. Observe all 4 pills flip synchronously to Emerald green with `<Check />` icon.
* **Layer 1: UI & Geometry Proof**:
  * Each requirement pill: `pill.querySelector('svg.text-emerald-500')` present when valid.
* **Layer 2 & 3: Cache & Network Proof**:
  * Pure client-side validation running synchronously on input event (`0 network requests`).

---

### TC-VOL1-008: Brute Force Login Throttling & Rate-Limit Lockout
* **Test ID & Classification Tag**: `TC-VOL1-008` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Action: `app/actions/auth.ts` &rarr; `signIn`
* **Preconditions & RBAC Matrix**:
  * Unauthenticated client submitting rapid invalid passwords.
* **Sequential Step-by-Step Path**:
  1. Fire 5 consecutive failed `signIn` requests within 10 seconds for the same email.
  2. Fire 6th attempt.
* **Layer 1: UI & Geometry Proof**:
  * UI displays red lockout badge: `"Too many failed attempts. Account locked for 60 seconds."`
* **Layer 2 & 3: Cache & Network Proof**:
  * 6th request rejected with HTTP 429 Too Many Requests.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * IP address and target email recorded in `public.security_rate_limits` with active lockout expiry timestamp.

---

## 2. Security Proxy & Fast-Path HMAC Claims

### TC-VOL1-009: Unauthenticated Root & Dashboard Route Interception
* **Test ID & Classification Tag**: `TC-VOL1-009` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Edge Proxy: `proxy.ts` (Next.js Edge Middleware)
* **Preconditions & RBAC Matrix**:
  * User state: Unauthenticated (zero cookies present).
* **Sequential Step-by-Step Path**:
  1. Directly request URL `http://localhost:3000/`.
  2. Directly request URL `http://localhost:3000/schedules`.
  3. Directly request URL `http://localhost:3000/admin`.
* **Combinatorial & Edge Permutations**:
  * Request with malformed/expired JWT &rarr; Proxy intercepts and redirects to `/login`.
* **Layer 1: UI & Geometry Proof**:
  * Final URL in browser address bar: `http://localhost:3000/login`.
* **Layer 2 & 3: Cache & Network Proof**:
  * HTTP 307 Temporary Redirect issued by `proxy.ts` before any server components execute.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Zero database queries executed due to early edge rejection.

---

### TC-VOL1-010: PWA Public Static Assets Pass-Through Routing
* **Test ID & Classification Tag**: `TC-VOL1-010` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Edge Proxy: `proxy.ts`
  * Service Worker: `public/sw.js`
  * Manifest: `app/manifest.ts` &rarr; `/manifest.webmanifest`
* **Preconditions & RBAC Matrix**:
  * Unauthenticated client browser or PWA install engine.
* **Sequential Step-by-Step Path**:
  1. Fetch `GET /manifest.webmanifest`.
  2. Fetch `GET /sw.js`.
  3. Fetch `GET /offline.html`.
  4. Fetch `GET /icons/icon-192x192.png`.
* **Layer 1: UI & Geometry Proof**:
  * Assets load with zero auth redirect walls.
* **Layer 2 & 3: Cache & Network Proof**:
  * All 4 endpoints return HTTP 200 OK with correct content types:
    * `/manifest.webmanifest` &rarr; `application/manifest+json`
    * `/sw.js` &rarr; `application/javascript`
    * `/offline.html` &rarr; `text/html`
    * `/icons/*.png` &rarr; `image/png`
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Zero database access.

---

### TC-VOL1-011: Fast-Path HMAC Session Signature Tampering Detection
* **Test ID & Classification Tag**: `TC-VOL1-011` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Security Lib: `lib/security/session-claim.ts` &rarr; `verifySessionClaim`
  * Edge Proxy: `proxy.ts`
* **Preconditions & RBAC Matrix**:
  * Attacker modifies `labsync_session_claim` cookie payload to elevate role from `'teacher'` to `'super_admin'`.
* **Sequential Step-by-Step Path**:
  1. Capture legitimate teacher session cookie.
  2. Modify base64 payload to `role: "super_admin"`, leaving HMAC signature untouched.
  3. Submit request to `/admin`.
* **Layer 1: UI & Geometry Proof**:
  * Access denied; redirected immediately to `/login?error=invalid_session`.
* **Layer 2 & 3: Cache & Network Proof**:
  * `crypto.subtle.verify()` in `session-claim.ts` fails cryptographic HMAC comparison.
  * Tampered cookie discarded.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Critical security anomaly recorded in `public.audit_ledger`:
    ```sql
    SELECT * FROM public.audit_ledger 
    WHERE action = 'security_tampering_detected' AND entity_type = 'session_claim';
    ```

---

### TC-VOL1-012: Rolling Session TTL Auto-Refresh Under Active Navigation
* **Test ID & Classification Tag**: `TC-VOL1-012` • `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Edge Proxy: `proxy.ts`
  * Lib: `lib/security/session-claim.ts`
* **Preconditions & RBAC Matrix**:
  * Authenticated user navigating between `/` and `/schedules` within 10 minutes of cookie expiration.
* **Sequential Step-by-Step Path**:
  1. Navigate to `/records`.
  2. Inspect response header `Set-Cookie: labsync_session_claim`.
* **Layer 2 & 3: Cache & Network Proof**:
  * New cookie issued with updated expiration timestamp extending TTL by 8 hours.

---

## 3. Top Navbar, Responsive Breakpoints & Live Role Status Dot

### TC-VOL1-013: Two-Group Header Layout & Middle Spacer Elimination
* **Test ID & Classification Tag**: `TC-VOL1-013` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Layout: `app/(dashboard)/layout.tsx`
  * Header Component: `components/layout/live-clock-header.tsx`
* **Preconditions & RBAC Matrix**:
  * User: Any authenticated role.
  * Viewports: 768px, 842px, 1106px, 1686px.
* **Sequential Step-by-Step Path**:
  1. Open `/` at 842×858 viewport.
  2. Inspect `<header>` DOM hierarchy.
* **Combinatorial & Edge Permutations**:
  * Verify that NO empty `<div className="flex-1" />` exists in header.
* **Layer 1: UI & Geometry Proof**:
  * `<header>` contains exactly 2 direct child groups:
    ```js
    const headerChildren = document.querySelectorAll('header > div');
    expect(headerChildren.length).toBe(2);
    ```
  * Left Group has `flex-1 min-w-0`; Right Group has `shrink-0`.
  * Horizontal distance between Left and Right groups: `rightGroup.left - leftGroup.right >= 10px`.

---

### TC-VOL1-014: Viewport Budget Sweep (768px – 1106px) Zero-Overlap Proof
* **Test ID & Classification Tag**: `TC-VOL1-014` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Layout: `app/(dashboard)/layout.tsx`
  * Header: `components/layout/live-clock-header.tsx`
  * User Menu: `components/layout/user-profile-menu.tsx`
* **Preconditions & RBAC Matrix**:
  * Authenticated Super Admin user on Desktop Chrome / Tablet emulator.
  * Viewports tested in continuous sweep: 768px, 842px, 950px, 1106px.
* **Sequential Step-by-Step Path**:
  1. Set viewport to 768×858 (Sidebar visible at 256px, leaving exactly 512px for header).
  2. Assert bounding boxes of all navbar elements.
  3. Increase viewport progressively to 842px, 950px, 1106px.
* **Layer 1: UI & Geometry Proof**:
  * At 768px:
    * Left status badge displays compact `"BREAK"` (width ~80px).
    * Date button displays `"२०८३ कात्तिक २६"` without clock seconds (width ~145px).
    * Right utility cluster (Search + Bell + Theme + Avatar) has width ~176px.
    * Sum: `80px + 145px + 176px = 401px <= 512px` (Over 100px empty clearance).
    * Bounding box check: `leftGroup.getBoundingClientRect().right <= rightGroup.getBoundingClientRect().left - 12`.
  * Zero text truncation with ellipses (`२०...` or `05...` never painted).
  * Document horizontal scroll: `document.documentElement.scrollWidth <= window.innerWidth`.

---

### TC-VOL1-015: Mobile 393px (Vivo V23 5G) Topbar Header Fit & Zero Horizontal Scroll
* **Test ID & Classification Tag**: `TC-VOL1-015` • `[MANUAL-DEVICE]` + `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Layout: `app/(dashboard)/layout.tsx`
  * Components: `components/layout/mobile-nav.tsx`, `components/layout/live-clock-header.tsx`
* **Preconditions & RBAC Matrix**:
  * Viewport: 393×873 px (Device: Vivo V23 5G standalone PWA).
* **Sequential Step-by-Step Path**:
  1. Open app on Vivo V23 5G.
  2. Inspect topbar contents: Hamburger menu, Nepali date pill, Search trigger, Bell, Theme toggle, Avatar.
* **Layer 1: UI & Geometry Proof**:
  * Status badge `[BREAK / OFF-HOURS]` is hidden (`display: none` via `hidden md:inline-flex`).
  * Right avatar is fully visible with right edge inset by `12px` (`right <= 381px`).
  * Zero horizontal scroll on entire document: `window.scrollX === 0` and `document.documentElement.scrollWidth === 393`.

---

### TC-VOL1-016: Clean Circular Avatar (Zero Dot) & Inline Role Status Dot
* **Test ID & Classification Tag**: `TC-VOL1-016` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Component: `components/layout/user-profile-menu.tsx`
* **Preconditions & RBAC Matrix**:
  * User: Super Admin or Teacher logged in.
  * Viewports: 768px, 1106px, 1686px.
* **Sequential Step-by-Step Path**:
  1. Observe circular profile avatar in top navbar.
  2. Verify that NO green/amber dot is positioned over the avatar image.
  3. Expand viewport to 1686px. Locate user role text next to name (`👑 Super Admin ●`).
* **Layer 1: UI & Geometry Proof**:
  * Avatar element: `avatarContainer.querySelectorAll('.absolute').length === 0`.
  * Status dot element: Located inside the role text span with dimensions `height === 8px` and `width === 8px`.
  * Avatar image retains clean border radius: `border-radius: 9999px`.

---

### TC-VOL1-017: Online/Offline Dynamic State Flip & SSR Hydration Mismatch Defense
* **Test ID & Classification Tag**: `TC-VOL1-017` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Component: `components/layout/user-profile-menu.tsx`
* **Preconditions & RBAC Matrix**:
  * Authenticated user inspecting initial SSR HTML vs client mount.
* **Sequential Step-by-Step Path**:
  1. Hard refresh `/` with DevTools console open.
  2. Verify console contains 0 React Hydration warnings (`"Hydration failed because the server rendered HTML didn't match the client"`).
  3. Execute `window.dispatchEvent(new Event('offline'))`.
  4. Verify dot turns Amber (`#FBBF24`).
  5. Execute `window.dispatchEvent(new Event('online'))`.
  6. Verify dot turns Emerald (`#10B981`).
* **Layer 1: UI & Geometry Proof**:
  * Online: Dot has class `bg-emerald-500` and computed background color `rgb(16, 185, 129)`.
  * Offline: Dot has class `bg-amber-400` and computed background color `rgb(251, 191, 36)`.
* **Layer 2 & 3: Cache & Network Proof**:
  * Initial state initialized to `isOnline = true` on server frame and client frame 0, preventing hydration mismatch.

---

### TC-VOL1-018: Bikram Sambat / Gregorian Dual Calendar Modal Trigger
* **Test ID & Classification Tag**: `TC-VOL1-018` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Component: `components/calendar/academic-calendar-modal.tsx`
  * Action: `app/actions/holidays.ts` &rarr; `getAcademicHolidays`
* **Preconditions & RBAC Matrix**:
  * Any user role on dashboard.
* **Sequential Step-by-Step Path**:
  1. Click Nepali Date Pill in topbar (`button:has(svg.lucide-calendar)`).
  2. Academic Calendar Modal opens.
  3. Browse current month festivals (e.g., Dashain, Tihar, Constitution Day).
  4. Press `Escape` or click `"Close"`.
* **Layer 1: UI & Geometry Proof**:
  * Modal has `z-index >= 70` covering both header and mobile dock.
  * High-contrast calendar grid renders both BS date (large Devanagari numerals) and AD date (small English numerals).
* **Layer 2 & 3: Cache & Network Proof**:
  * Holiday data cached in memory for 300,000ms (`staleTimeMs = 5min`).

---

### TC-VOL1-019: Global Command Palette (Ctrl+K / ⌘K) Navigation
* **Test ID & Classification Tag**: `TC-VOL1-019` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Component: `components/command-palette.tsx`
  * Trigger: `components/layout/header-search-trigger.tsx`
* **Preconditions & RBAC Matrix**:
  * Any role. Desktop keyboard or mobile touch.
* **Sequential Step-by-Step Path**:
  1. Press `Ctrl + K` (Windows) or `Cmd + K` (macOS), or tap magnifying glass icon on mobile.
  2. Command palette dialog opens with input autofocus.
  3. Type `"Physics"`.
  4. Press `ArrowDown` & `Enter` to navigate to Class 11 Physics practicals.
* **Layer 1: UI & Geometry Proof**:
  * Command palette rendered in portal with `z-index: 80`.
  * Keyboard navigation shifts active item highlighted background to `bg-indigo-500/10`.

---

### TC-VOL1-020: Notification Bell Real-Time Badge & Read/Clear Workflow
* **Test ID & Classification Tag**: `TC-VOL1-020` • `[AUTO-DB-INTEGRATION]` + `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Component: `components/layout/notification-bell.tsx`
  * Actions: `app/actions/incidents.ts` &rarr; `getNotifications`, `markNotificationRead`, `markAllNotificationsRead`, `clearReadNotifications`
* **Preconditions & RBAC Matrix**:
  * User: Lab Incharge with 3 unread equipment breakage alerts.
* **Sequential Step-by-Step Path**:
  1. Inspect notification bell. Red badge displays count `"3"`.
  2. Click bell icon to open popover.
  3. Click `"Mark All as Read"`.
  4. Observe badge disappears. Click `"Clear Read Notifications"`.
* **Layer 1: UI & Geometry Proof**:
  * Badge pill centered over bell: `top: -2px, right: -2px`.
* **Layer 2 & 3: Cache & Network Proof**:
  * Optimistic UI decrement on click; background mutation revalidates query cache.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Rows in `public.notifications` have `is_read = TRUE` and `read_at IS NOT NULL`.

---

## 4. Navigation Chrome & Persistent Mobile Bottom Dock

### TC-VOL1-021: Desktop Collapsible Sidebar Persistence
* **Test ID & Classification Tag**: `TC-VOL1-021` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Component: `components/layout/collapsible-sidebar.tsx`
* **Preconditions & RBAC Matrix**:
  * Desktop viewport >= 1024px.
* **Sequential Step-by-Step Path**:
  1. Open dashboard. Sidebar default width is `256px` (`w-64`).
  2. Click collapse toggle button (`<PanelLeftClose />`).
  3. Sidebar animates to `72px` (`w-[72px]`).
  4. Refresh page. Verify sidebar remains collapsed (`72px`).
* **Layer 1: UI & Geometry Proof**:
  * Collapsed width: `sidebar.getBoundingClientRect().width === 72`.
  * Expanded width: `sidebar.getBoundingClientRect().width === 256`.
* **Layer 2 & 3: Cache & Network Proof**:
  * State persisted in `localStorage.getItem('labsync_sidebar_collapsed') === 'true'`.

---

### TC-VOL1-022: Mobile 5-Tab Bottom Dock Geometry & z-Index Layering
* **Test ID & Classification Tag**: `TC-VOL1-022` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Component: `components/layout/mobile-bottom-nav.tsx`
* **Preconditions & RBAC Matrix**:
  * Viewport: 393×873 px.
* **Sequential Step-by-Step Path**:
  1. Open app at 393px width.
  2. Inspect bottom dock: 5 tabs (`Home`, `Live Lab`, `Schedule`, `Records`, `Profile`).
  3. Open an incident modal or workstation triage drawer.
* **Layer 1: UI & Geometry Proof**:
  * Dock fixed at bottom: `dock.getBoundingClientRect().bottom === window.innerHeight`.
  * Dock height: `dock.getBoundingClientRect().height === 64px` (`h-16`).
  * Dock z-index is `z-30`. Drawer/modal backdrop has `z-[70]`, guaranteeing that modal covers the dock completely.

---

### TC-VOL1-023: Mobile Haptic Micro-Feedback & Touch Target Geometry
* **Test ID & Classification Tag**: `TC-VOL1-023` • `[MANUAL-DEVICE]`
* **Exact Target Files**:
  * Component: `components/layout/mobile-bottom-nav.tsx`
* **Preconditions & RBAC Matrix**:
  * Device: Vivo V23 5G smartphone with vibration hardware enabled.
* **Sequential Step-by-Step Path**:
  1. Tap each of the 5 bottom dock tabs in sequence.
  2. Feel physical haptic pulse on finger tap.
* **Layer 1: UI & Geometry Proof**:
  * Each tab touch area: `tab.getBoundingClientRect().width >= 60px` and `tab.getBoundingClientRect().height >= 56px`.
* **Layer 2 & 3: Cache & Network Proof**:
  * Call to `navigator.vibrate(10)` succeeds without throwing exceptions.

---

### TC-VOL1-024: Viewport Bottom Clearance (pb-28) & Floating Action Protection
* **Test ID & Classification Tag**: `TC-VOL1-024` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Layout: `app/(dashboard)/layout.tsx` &rarr; `<main className="... pb-28 md:pb-8">`
* **Preconditions & RBAC Matrix**:
  * Viewport: 393×873 px.
* **Sequential Step-by-Step Path**:
  1. Open `/records` on mobile.
  2. Scroll to the very bottom of the table list.
* **Layer 1: UI & Geometry Proof**:
  * The last record row or pagination button is fully readable above the bottom dock:
    ```js
    const lastRow = document.querySelector('table tbody tr:last-child');
    const dock = document.querySelector('nav.fixed.bottom-0');
    expect(lastRow.getBoundingClientRect().bottom).toBeLessThanOrEqual(dock.getBoundingClientRect().top - 8);
    ```

---

## 5. Executive Overview Command Center & Facility Telemetry

### TC-VOL1-025: Executive Practical Operations KPI Summary Cards
* **Test ID & Classification Tag**: `TC-VOL1-025` • `[AUTO-E2E-GEOMETRY]` + `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Route: `app/(dashboard)/page.tsx`
  * Component: `components/dashboard/executive-kpi-summary.tsx`
  * Action: `app/actions/logs.ts` &rarr; `getTodayLogStats`
* **Preconditions & RBAC Matrix**:
  * Authenticated Super Admin, HOD, or Lab Incharge.
* **Sequential Step-by-Step Path**:
  1. Open `/`.
  2. Inspect the 3 top-row KPI cards:
     * Card 1: Practical Sessions Conducted Today.
     * Card 2: Overall Student Attendance Percentage.
     * Card 3: Active Equipment Incidents / Broken Nodes.
* **Layer 1: UI & Geometry Proof**:
  * High-density 2-row layout with height `~76px`: `card.getBoundingClientRect().height <= 82px`.
  * Bold metric typography: `font-heading font-extrabold tabular-nums`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Values match live queries against `public.practical_logs` and `public.workstation_issues`.

---

### TC-VOL1-026: Live Session Cockpit Card & Quick Practical Log Navigation
* **Test ID & Classification Tag**: `TC-VOL1-026` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Component: `components/dashboard/live-session-cockpit.tsx`
* **Preconditions & RBAC Matrix**:
  * Time: During an active timetable practical period (e.g., Period 3, Class 11 Science A, Computer Lab).
* **Sequential Step-by-Step Path**:
  1. Open dashboard. Cockpit card highlights current session in Emerald pulse border.
  2. Click `"Launch Roll-Call Cockpit"` button.
  3. Redirection opens `/computer-lab` with class cohort pre-selected.
* **Layer 1: UI & Geometry Proof**:
  * Glowing beacon: `.ring-2.ring-emerald-500\/30.animate-pulse` active.

---

### TC-VOL1-027: Real-Time Laboratory Facility Pods Telemetry
* **Test ID & Classification Tag**: `TC-VOL1-027` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Component: `components/dashboard/live-lab-pods.tsx`
  * Action: `app/actions/labs.ts` &rarr; `getLabFacilitiesAction`
* **Preconditions & RBAC Matrix**:
  * All roles on desktop and mobile.
* **Sequential Step-by-Step Path**:
  1. Scroll to `"Laboratory Facilities"` section on `/`.
  2. Inspect pod cards for Computer Lab 1, Physics Lab, Chemistry Lab, Biology Lab.
* **Layer 1: UI & Geometry Proof**:
  * On mobile (< 768px): Renders as swipeable/stacked compact cards with touch target >= 44px.
  * Status pills: Green `"Operational"`, Amber `"Under Maintenance"`, Gray `"Inactive"`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Pod status strictly matches `CHECK (status IN ('Operational', 'Under Maintenance', 'Inactive'))` constraint on `public.labs`.

---

### TC-VOL1-028: Emergency Equipment Breakage Quick Report Trigger
* **Test ID & Classification Tag**: `TC-VOL1-028` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Component: `components/dashboard/report-incident-modal.tsx`
  * Action: `app/actions/incidents.ts` &rarr; `reportIncident`
* **Preconditions & RBAC Matrix**:
  * Instructor witnessing broken hardware (e.g., shattered prism, burnt PC PSU).
* **Sequential Step-by-Step Path**:
  1. On dashboard, locate `"Quick Operations"` card.
  2. Click `"Report Broken Equipment"` button.
  3. Modal dialog opens with autofocus on Equipment Name field.
  4. Select Lab: `"Computer Lab 1"`, Severity: `"Critical"`, Description: `"PC-04 sparks on boot"`.
  5. Click `"Submit Damage Ticket"`.
* **Layer 1: UI & Geometry Proof**:
  * Modal has `z-index: 70`, properly dimming entire screen.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Row created in `public.lab_incidents`:
    ```sql
    SELECT severity, status FROM public.lab_incidents WHERE title LIKE '%PC-04 sparks%';
    -- Assert: severity === 'major_critical' AND status === 'reported'
    ```

---

### TC-VOL1-029: Interactive Recent Incidents Drawer & Workflow Routing
* **Test ID & Classification Tag**: `TC-VOL1-029` • `[AUTO-E2E-GEOMETRY]`
* **Exact Target Files**:
  * Component: `components/dashboard/incident-drawer.tsx`
* **Preconditions & RBAC Matrix**:
  * Super Admin or HOD inspecting incident details from dashboard.
* **Sequential Step-by-Step Path**:
  1. Click any incident item inside the `"Recent Incidents"` dashboard card.
  2. Slide-out drawer animates from right edge of screen.
  3. Verify incident details, reporter name, timestamp, and action buttons (`"Escalate to HOD"`, `"Mark Resolved"`).
* **Layer 1: UI & Geometry Proof**:
  * Drawer width: `min(450px, 100vw)` with spring transition.

---

### TC-VOL1-030: Institutional Syllabus Progress Ledger Telemetry
* **Test ID & Classification Tag**: `TC-VOL1-030` • `[AUTO-E2E-GEOMETRY]` + `[AUTO-DB-INTEGRATION]`
* **Exact Target Files**:
  * Component: `components/dashboard/syllabus-progress.tsx`
  * Action: `app/actions/institutional-reports.ts` &rarr; `getSyllabusProgressLedger`
* **Preconditions & RBAC Matrix**:
  * Authenticated user inspecting semester practical syllabus quota.
* **Sequential Step-by-Step Path**:
  1. Scroll to `"Curricular Syllabus Progress"` on `/` or `/records`.
  2. Inspect progress bars for Class 11 Computer Science, Class 12 Physics, Class 11 Chemistry.
* **Layer 1: UI & Geometry Proof**:
  * Progress indicator bar filled to exact percentage: `style="width: 65%"`.
* **Layer 4: PostgreSQL & Audit Invariant**:
  * Percentage computed directly from live table counts: `(conducted_practicals / weekly_quota_target) * 100%`.

