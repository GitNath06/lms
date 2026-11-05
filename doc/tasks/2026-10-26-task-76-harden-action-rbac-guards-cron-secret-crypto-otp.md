# Task 76: Harden Server Action RBAC Guards, Cron Secret & Crypto OTP

> **Date**: 2026-10-26  
> **Status**: Completed & Verified  
> **Type**: Security Hardening & Zero-Day Mitigation  
> **Verification**: `npx tsc --noEmit` &rarr; 0 errors; Unit, Auth & Handshake test suites &rarr; 20/20 passing.

---

## 1. Overview & Objectives

Following the cross-examination findings in `doc/audits/2026-10-25-argon-claude-codebase-verification-and-production-audit.md`, this task enforces strict server-side authentication, fail-closed privilege scoping, cron secret validation, cryptographically secure OTP generation, and cross-serverless replay protection:

1. **Harden Notification & Terminal Simulator Server Actions**:
   - In [`app/actions/notifications.ts`](file:///d:/Projects/LMR/app/actions/notifications.ts): Added `assertCallerAuthorized()` with `getServerUserScope()` across all exported actions. Permits Vercel Cron via `Authorization: Bearer <CRON_SECRET>` or authenticated approved accounts. Converted internal helper `checkAndRecordDispatch` to a non-exported function.
   - In [`app/actions/terminal-simulator.ts`](file:///d:/Projects/LMR/app/actions/terminal-simulator.ts): Added `assertSimulatorPermitted()` which hard-blocks execution in production (`process.env.NODE_ENV === 'production'`) and verifies approved privileged administrator status for all 10 exported simulation functions.
2. **Fail-Closed Privilege Scoping**:
   - In [`app/actions/workstations.ts`](file:///d:/Projects/LMR/app/actions/workstations.ts), [`app/actions/terminal.ts`](file:///d:/Projects/LMR/app/actions/terminal.ts), [`app/actions/maintenance.ts`](file:///d:/Projects/LMR/app/actions/maintenance.ts), and [`app/actions/maintenance-fleet.ts`](file:///d:/Projects/LMR/app/actions/maintenance-fleet.ts):
     - Removed any fallback privilege elevation to `lab_incharge`.
     - Ensured `isPrivileged` strictly checks `!scope.isPending && scope.approvalStatus === 'approved'`.
     - Wrapped scoping checks in fail-closed try/catch blocks that return an unprivileged guest (`isPrivileged: false`, `isPending: true`).
3. **Audit Exported Server Action Signatures**:
   - Verified that no exported server action in [`app/actions/academic-years.ts`](file:///d:/Projects/LMR/app/actions/academic-years.ts), [`app/actions/archive-hub.ts`](file:///d:/Projects/LMR/app/actions/archive-hub.ts), or [`app/actions/seat-plans.ts`](file:///d:/Projects/LMR/app/actions/seat-plans.ts) exposes an `internalBypassScopeCheck` parameter to client RPC callers.
4. **Enforce CRON_SECRET & 60s Duration on Cron Reminders**:
   - In [`app/api/cron/reminders/route.ts`](file:///d:/Projects/LMR/app/api/cron/reminders/route.ts): Added `export const maxDuration = 60;`. Enforced that `process.env.CRON_SECRET` must be non-empty and match `Bearer ${CRON_SECRET}` (with fallback only for an authenticated Super Admin session).
5. **Cryptographically Secure OTP Generation**:
   - In [`app/actions/otp.ts`](file:///d:/Projects/LMR/app/actions/otp.ts): Replaced pseudo-random `Math.random()` with CSPRNG `crypto.randomInt(100000, 999999)` from `node:crypto`.
6. **Cross-Serverless Replay Protection for Terminal Handshake**:
   - In [`lib/security/terminal-token.ts`](file:///d:/Projects/LMR/lib/security/terminal-token.ts) & [`app/terminal/auth/route.ts`](file:///d:/Projects/LMR/app/terminal/auth/route.ts): Persist redeemed ticket signatures into `public.rate_limit_events` table (in addition to in-memory `REDEEMED_TICKETS` Map) and added `isHandshakeSignatureRedeemedInDb()` pre-check to eliminate multi-instance serverless replay windows.

---

## 2. Key Code Changes

### A. Notifications & Terminal Simulator RBAC
- **Files**:
  - [`app/actions/notifications.ts`](file:///d:/Projects/LMR/app/actions/notifications.ts)
  - [`app/actions/terminal-simulator.ts`](file:///d:/Projects/LMR/app/actions/terminal-simulator.ts)
- `assertCallerAuthorized()` checks `Authorization: Bearer <CRON_SECRET>` or `getServerUserScope()`.
- `assertSimulatorPermitted()` blocks all simulator functions in production (`NODE_ENV === 'production'`) and requires `isPrivileged === true`.

### B. Fail-Closed Workstation, Terminal & Maintenance Scope
- **Files**:
  - [`app/actions/workstations.ts`](file:///d:/Projects/LMR/app/actions/workstations.ts)
  - [`app/actions/terminal.ts`](file:///d:/Projects/LMR/app/actions/terminal.ts)
  - [`app/actions/maintenance.ts`](file:///d:/Projects/LMR/app/actions/maintenance.ts)
  - [`app/actions/maintenance-fleet.ts`](file:///d:/Projects/LMR/app/actions/maintenance-fleet.ts)
- Eliminated all mock fallbacks that previously defaulted unauthenticated callers to `lab_incharge`. The catch blocks now strictly return `isPrivileged: false, isPending: true`.

### C. Cron Secret & Timeout Hardening
- **File**: [`app/api/cron/reminders/route.ts`](file:///d:/Projects/LMR/app/api/cron/reminders/route.ts)
- Exported `maxDuration = 60` to prevent serverless function termination during mass SMTP dispatch.
- Mandatory `CRON_SECRET` validation rejects any unauthenticated request without a secret match.

### D. Cryptographically Secure OTP
- **File**: [`app/actions/otp.ts`](file:///d:/Projects/LMR/app/actions/otp.ts)
- Switched to `crypto.randomInt(100000, 999999)` from `node:crypto`.

### E. PostgreSQL Replay Store for Terminal Tickets
- **Files**:
  - [`lib/security/terminal-token.ts`](file:///d:/Projects/LMR/lib/security/terminal-token.ts)
  - [`app/terminal/auth/route.ts`](file:///d:/Projects/LMR/app/terminal/auth/route.ts)
- When a ticket is redeemed, its signature is persisted to `public.rate_limit_events` with action `'handshake_redeemed'`. The terminal auth exchange checks this table before minting session cookies, stopping cross-instance replays.

---

## 3. Verification & Results

- **TypeScript Compilation**: `npx tsc --noEmit` &rarr; 0 errors.
- **Automated Test Suites**:
  - `tests/pending-user-lockdown.test.mjs` &rarr; 3/3 passing.
  - `tests/terminal-agent-handshake.test.mjs` &rarr; 5/5 passing.
  - `tests/unit-domain-invariants.test.mjs` &rarr; 12/12 passing.
  - Total: 20/20 passing across all suites.
