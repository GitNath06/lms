# Task 75: Production Gate for Dev Tools, Time Cookie, and Login Demo Accounts

> **Date**: 2026-10-26  
> **Status**: Completed & Verified  
> **Type**: Security Hardening & Production Gate  
> **Verification**: `npx tsc --noEmit` &rarr; 0 errors; Unit & Auth test suites &rarr; 15/15 passing.

---

## 1. Overview & Objectives

In response to the security findings verified during the cross-verification audit (`doc/audits/2026-10-25-argon-claude-codebase-verification-and-production-audit.md`), this task enforces strict production gates across dev tools, time simulation cookies, login demo accounts, and repository hygiene:

1. **Gate Dev Tool Controllers in Dashboard**: Only render `<TimeTravelController />` and `<TerminalSimulatorController />` when `process.env.NODE_ENV === 'development'`.
2. **Production Gate for Time Simulation Engine**: Ignore the `lmr_simulated_time` cookie and `localStorage` unless `process.env.NODE_ENV === 'development'`. In production, both `getServerEffectiveTime()` and `getEffectiveDate()` strictly return real wall-clock Nepal Standard Time (UTC+5:45).
3. **Strip Passwords from Client Bundle**: Remove hardcoded passwords from `DEMO_ACCOUNTS` in `app/(auth)/login/page.tsx`. Gated credential retrieval behind a server-only action (`getDemoAccountPassword`) that returns `null` in production.
4. **Repository Hygiene**: Permanently delete `scratch_db_dump.json` from the root directory and add `scratch_db_dump.json` and `*_db_dump.json` to `.gitignore`.

---

## 2. Key Code Changes

### A. Dashboard Layout Dev Tool Gate
- **File**: [`app/(dashboard)/layout.tsx`](file:///d:/Projects/LMR/app/%28dashboard%29/layout.tsx)
- Gated `<TimeTravelController />` and `<TerminalSimulatorController />` behind `process.env.NODE_ENV === 'development'`.

### B. Time Simulation Engine Production Gates
- **Files**:
  - [`lib/server-effective-time.ts`](file:///d:/Projects/LMR/lib/server-effective-time.ts)
  - [`lib/time-simulator.ts`](file:///d:/Projects/LMR/lib/time-simulator.ts)
- In `lib/server-effective-time.ts`: `getServerEffectiveTime()` skips reading the `lmr_simulated_time` cookie and overrides unless `process.env.NODE_ENV === 'development'`. In production, it derives Nepal Standard Time strictly from live `new Date()`.
- In `lib/time-simulator.ts`: `getEffectiveDate()`, `isSimulatingTime()`, and `setSimulatedTime()` immediately return live `new Date()` / `false` / no-op if `process.env.NODE_ENV !== 'development'`.

### C. Login Demo Accounts Client Bundle Hardening
- **Files**:
  - [`app/(auth)/login/page.tsx`](file:///d:/Projects/LMR/app/%28auth%29/login/page.tsx)
  - [`app/actions/auth.ts`](file:///d:/Projects/LMR/app/actions/auth.ts)
- Removed `password` fields from `DEMO_ACCOUNTS` in `login/page.tsx`.
- Exported server action `getDemoAccountPassword(email)` in `app/actions/auth.ts` which returns `null` in production and only resolves passwords during local development.
- Updated `handleSelectDemo` and `handleInstantDemoLogin` to asynchronously fetch credentials from the server action in development mode.

### D. Repository Hygiene
- **Files**:
  - [`.gitignore`](file:///d:/Projects/LMR/.gitignore)
  - Deleted `scratch_db_dump.json` from workspace root.
- Added `scratch_db_dump.json` and `*_db_dump.json` to `.gitignore`.

---

## 3. Verification & Results

- **TypeScript Compilation**: `npx tsc --noEmit` &rarr; 0 errors.
- **Unit & Auth Test Suites**:
  - `tests/pending-user-lockdown.test.mjs` &rarr; 3/3 passing.
  - `tests/unit-domain-invariants.test.mjs` &rarr; 12/12 passing.
  - `tests/floor-plan-status-sync.test.mjs` &rarr; 8/8 passing.
