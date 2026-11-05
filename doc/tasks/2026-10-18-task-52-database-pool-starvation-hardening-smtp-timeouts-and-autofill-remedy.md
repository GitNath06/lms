# Task 52: Database Pool Starvation Hardening, SMTP Timeouts & Registration Autofill Remedy

> **Authoritative Log**: Executed on October 18, 2026  
> **Status**: COMPLETED  
> **Target Subsystems**: `app/actions/otp.ts`, `lib/mailer.ts`, `lib/db.ts`, `app/(auth)/login/page.tsx`, `tests/password-policy-and-approval.test.mjs`, `tests/profile-credentials.test.mjs`

---

## 1. Problem Statement & Root Cause Discovery

### A. Database Connection Pool Starvation & 71-Second Request Hang
1. **The Anti-Pattern**: In `app/actions/otp.ts`, both `generateAndSendSignupOtp` and `generateAndSendPasswordResetOtp` previously used manual checkouts (`const client = await pool.connect()`) across 5 sequential queries and held that client checked out while awaiting external network dispatch (`await sendPasswordResetOtpEmail(...)`).
2. **The 71-Second Hang**: In `lib/mailer.ts`, Nodemailer's `createTransport` had no configured network timeouts (relying on Node's default 120s socket timeout). When Gmail SMTP experienced latency or dropped packets, the server action stalled for 71 seconds while holding a database client out of the pool's 20-connection ceiling.
3. **Connection Starvation**: Holding checked-out connections across external network I/O quickly exhausted the PostgreSQL transaction pooler (`aws-0-ap-southeast-1.pooler.supabase.com:6543`), triggering `Connection terminated due to connection timeout` and 500 errors.

### B. Admin Credentials Auto-Injected in Registration Modal (IMG1)
1. **The Cause**: When opening the new user registration modal on `/login`, Chrome's Password Manager detected generic `<Input type="email">` and `<Input type="password">` elements in the DOM without `autoComplete="new-password"`.
2. Chrome assumed the modal was a re-login challenge on the same domain and automatically populated the saved institutional administrator credentials (`admin@rrl.edu.np` and `Admin@12345`), firing synthetic `input` events that inadvertently validated the password policy strength checklist with the admin's secret.

---

## 2. Architecture & Technical Remedies Applied

### A. Non-Blocking Direct Pool Queries (`app/actions/otp.ts`)
1. **Eliminated Client Check-Out Anti-Pattern**: Refactored `generateAndSendSignupOtp` and `generateAndSendPasswordResetOtp` to use `pool.query(...)` directly for all operations (rate limit validation, cooldown check, user verification, OTP invalidation, and OTP insertion).
2. **Instant Connection Return**: Every query borrows a connection for `< 2ms` and returns it immediately to the pool.
3. **Zero DB Connections Held During External I/O**: When `sendVerificationOtpEmail` or `sendPasswordResetOtpEmail` runs, **zero database connections are checked out or locked**.
4. **Transaction Reservation Invariant**: Manual checkouts (`pool.connect()`) are strictly restricted to atomic multi-table transactions (e.g. `verifySignupAndCreateAccount`, `confirmDualOtpEmailChange`), and are committed/released before background alerts.

### B. Strict SMTP Network Timeouts & Racing Ceiling (`lib/mailer.ts`)
1. **Nodemailer Transport Configuration**:
   - `connectionTimeout: 8000` (8s max to establish SMTP connection).
   - `greetingTimeout: 5000` (5s max for SMTP handshake greeting).
   - `socketTimeout: 10000` (10s socket inactivity limit).
2. **Hard Fallback Race Ceiling**: Wrapped `sendMail` with `Promise.race` against an **8.5-second timeout safeguard**. If SMTP stalls, the action terminates cleanly within 8.5s and returns a graceful `{ error: 'SMTP delivery timeout' }` instead of stalling the server action for 70+ seconds.

### C. Database Pool Runway & Resiliency (`lib/db.ts`)
1. Adjusted `connectionTimeoutMillis` to `15000` (15s) and `idleTimeoutMillis` to `30000` (30s) to absorb cross-region network latency to AWS Singapore poolers.

### D. Chrome Autofill Isolation & Registration Decoy Trap (`app/(auth)/login/page.tsx`)
1. **Decoy Input Fields**: Inserted hidden decoy inputs (`fake_usernameremembered` and `fake_passwordremembered`) at the top of the registration modal `<form autoComplete="off">` to trap Chrome's heuristic crawler.
2. **Explicit Attributes**:
   - Email: `name="new_faculty_email"`, `autoComplete="off"`, `data-lpignore="true"`.
   - Password: `name="new_faculty_password"`, `autoComplete="new-password"`, `data-lpignore="true"`.
   - Confirm Password: `name="new_faculty_confirm_password"`, `autoComplete="new-password"`, `data-lpignore="true"`.
   - Applied `autoComplete="new-password"` to the Password Recovery modal as well.
3. **State Purge on Modal Open**: The "Request Access" trigger now explicitly flushes all registration state (`regName`, `regEmail`, `regPhone`, `regPass`, `regConfirmPass`, `regOtp`) to empty strings when opening the dialog.

---

## 3. Verification & Invariants

- **TypeScript Verification**: Ran `npx tsc --noEmit` &rarr; **0 errors**.
- **Automated Test Suites**: All 13 unit and regression tests passed cleanly (`tests/password-policy-and-approval.test.mjs`, `tests/profile-credentials.test.mjs`).
- **Rule #1 Preserved**: Zero literal `+` buttons across all modified modal surfaces.
