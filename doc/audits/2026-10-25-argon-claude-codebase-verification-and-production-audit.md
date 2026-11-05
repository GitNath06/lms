# LabSync LIMS (LMR) — Codebase Verification Audit Report
## Cross-Examination of External Reviews (Argon & Claude) Against Active Repository

> **Document ID**: `doc/audits/2026-10-25-argon-claude-codebase-verification-and-production-audit.md`  
> **Date**: October 25, 2026  
> **Auditor**: Antigravity Technical Pair-Programmer & Security Agent  
> **Subject**: Verification of Claims made by external evaluators ("Argon" and "Claude") against active code in `d:\Projects\LMR`.  
> **Target Production Milestone**: Ratna Rajya Laxmi Secondary School (Gaindakot) Lab Deployment  

---

## Executive Summary & Scorecard Verdict

Both external reviewers correctly identified that LabSync LIMS is an enterprise-grade academic system with high domain fidelity (NEB 75% attendance rule, dual Bikram Sambat calendar, CAD floor architect, and hardware-bound terminal agent). However, their security findings and architecture critique contain a mixture of **critical verified zero-day vulnerabilities**, **partially accurate claims**, and **debunked false positives** (where external reviewers inspected obsolete export files rather than active source code).

### Overall Readiness Rating
- **Feature Completeness**: **92%** (All operational, scheduling, CAD, reporting, and maintenance features are functional).
- **Production Hardening / Security**: **62%** (Vulnerable to credential harvesting, fail-open privilege bypass, unauthenticated simulator mutations, and trigger loops).
- **Stabilization Gap**: **3 to 4 Days of focused hardening** (Zero new features needed; exclusively security guards, trigger optimization, RLS policies, and production gating).

---

## 1. Line-by-Line Claim Verification Matrix

| # | Evaluation Claim | Origin | Verification Status | Exact Code Reference | Severity |
|---|---|---|---|---|---|
| **01** | Plaintext Demo Passwords bundled into Public Client Bundle | Argon / Claude | **CONFIRMED** | [`app/(auth)/login/page.tsx:L41-L96`](file:///d:/Projects/LMR/app/%28auth%29/login/page.tsx#L41-L96) | **CRITICAL** |
| **02** | Fail-Open Privilege Escalation to `lab_incharge` in Workstations | Claude | **CONFIRMED** | [`app/actions/workstations.ts:L70-L84`](file:///d:/Projects/LMR/app/actions/workstations.ts#L70-L84) | **CRITICAL** |
| **03** | Unguarded Server Action Mutations (No Auth Check) | Claude | **CONFIRMED** | [`app/actions/notifications.ts:L67`](file:///d:/Projects/LMR/app/actions/notifications.ts#L67), [`app/actions/terminal-simulator.ts:L194`](file:///d:/Projects/LMR/app/actions/terminal-simulator.ts#L194) | **CRITICAL** |
| **04** | Double Definition of `handle_new_user()` & Trusting Client Role | Argon | **CONFIRMED** | [`schema.sql:L1634`](file:///d:/Projects/LMR/schema.sql#L1634), [`schema.sql:L2321`](file:///d:/Projects/LMR/schema.sql#L2321) | **CRITICAL** |
| **05** | Incomplete `protect_profile_escalation()` Trigger | Argon | **CONFIRMED** | [`schema.sql:L2302-L2309`](file:///d:/Projects/LMR/schema.sql#L2302-L2309) | **HIGH** |
| **06** | Permissive RLS Policies (`USING (true)`) on Sensitive Tables | Argon / Claude | **CONFIRMED** | [`schema.sql:L2008`](file:///d:/Projects/LMR/schema.sql#L2008), [`schema.sql:L2230`](file:///d:/Projects/LMR/schema.sql#L2230) | **HIGH** |
| **07** | CRON Secret Bypass & Vercel 10s Serverless Timeout | Argon / Claude | **CONFIRMED** | [`app/api/cron/reminders/route.ts:L23`](file:///d:/Projects/LMR/app/api/cron/reminders/route.ts#L23), [`vercel.json`](file:///d:/Projects/LMR/vercel.json) | **HIGH** |
| **08** | Dev Controllers Mounted in Production & Unchecked Time Travel Cookie | Claude | **CONFIRMED** | [`app/(dashboard)/layout.tsx:L63-L66`](file:///d:/Projects/LMR/app/%28dashboard%29/layout.tsx#L63-L66), [`lib/server-effective-time.ts:L45-L54`](file:///d:/Projects/LMR/lib/server-effective-time.ts#L45-L54) | **HIGH** |
| **09** | Plaintext OTP Storage & Insecure `Math.random()` PRNG | Claude | **CONFIRMED** | [`app/actions/otp.ts:L39`](file:///d:/Projects/LMR/app/actions/otp.ts#L39), [`app/actions/otp.ts:L196`](file:///d:/Projects/LMR/app/actions/otp.ts#L196), [`otp.ts:L215`](file:///d:/Projects/LMR/app/actions/otp.ts#L215) | **HIGH** |
| **10** | Database Dump with Live Profiles Committed to Root | Argon / Claude | **CONFIRMED** | [`scratch_db_dump.json`](file:///d:/Projects/LMR/scratch_db_dump.json) | **HIGH** |
| **11** | Dangerous `ON DELETE CASCADE` Referencing `labs(id)` | Argon | **CONFIRMED** | [`schema.sql:L958`](file:///d:/Projects/LMR/schema.sql#L958), [`schema.sql:L1060`](file:///d:/Projects/LMR/schema.sql#L1060), [`schema.sql:L1090`](file:///d:/Projects/LMR/schema.sql#L1090) | **HIGH** |
| **12** | Destructive Attendance Sync Trigger on Practical Log Edit | Argon | **CONFIRMED** | [`schema.sql:L1760-L1776`](file:///d:/Projects/LMR/schema.sql#L1760-L1776) | **HIGH** |
| **13** | Multi-Instance In-Memory Ticket Replay in Serverless | Argon | **CONFIRMED** | [`lib/security/terminal-token.ts:L87`](file:///d:/Projects/LMR/lib/security/terminal-token.ts#L87) | **MEDIUM** |
| **14** | Roll Number Constraint Mismatch (`200` DB vs `250` UI) | Argon | **CONFIRMED** | [`schema.sql:L874`](file:///d:/Projects/LMR/schema.sql#L874), [`cohort-promotion-wizard.tsx:L1239`](file:///d:/Projects/LMR/components/admin/cohort-promotion-wizard.tsx#L1239) | **MEDIUM** |
| **15** | Hardcoded Dev Origin IP in `next.config.ts` | Argon | **CONFIRMED** | [`next.config.ts:L4`](file:///d:/Projects/LMR/next.config.ts#L4) | **LOW** |
| **16** | Obsolete Department String in Database Triggers (Rule #5) | Argon | **CONFIRMED** | [`schema.sql:L1647`](file:///d:/Projects/LMR/schema.sql#L1647), [`schema.sql:L2340`](file:///d:/Projects/LMR/schema.sql#L2340) | **LOW** |
| **17** | Unfinished Mock Purge (`institutional-relationships.ts`, `baseline-routines.ts`) | Argon | **DEBUNKED** | *Files do not exist in repo; purged in Task 73 & 74* | **N/A** |
| **18** | `localStorage.getItem('infrastructure_periods')` in `master-data.ts` | Argon | **DEBUNKED** | *Zero occurrences; purged in Task 73 & 74* | **N/A** |
| **19** | Zero Input Validation (`zod`) in Entire Repository | Claude | **PARTIALLY TRUE** | Custom domain validators in `lib/report-spec/` and `lib/auth-policy.ts` exist, but no Zod schemas. | **MEDIUM** |

---

## 2. In-Depth Technical Verification & Proof

### Finding 1: Plaintext Demo Account Passwords in Public Bundle
- **Location**: [`app/(auth)/login/page.tsx:L41-L96`](file:///d:/Projects/LMR/app/%28auth%29/login/page.tsx#L41-L96)
- **Status**: **CONFIRMED (CRITICAL)**
- **Code Evidence**:
  ```typescript
  // File is marked 'use client' at top
  const DEMO_ACCOUNTS = [
    { roleLabel: 'Super Admin', email: 'admin@rrl.edu.np', password: 'Admin@12345' },
    { roleLabel: 'Lab Incharge', email: 'incharge@rrl.edu.np', password: 'Incharge@12345' },
    { roleLabel: 'HOD', email: 'hod@rrl.edu.np', password: 'Hod@12345' },
    { roleLabel: 'Teacher (Phys)', email: 'p.adhikari@rrl.edu.np', password: 'Teacher@12345' },
  ]
  ```
- **Risk Analysis**: Although conditional rendering `{process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS === 'true'}` protects the UI visibility, `DEMO_ACCOUNTS` is declared in module scope in a client-rendered component. Webpack/Next.js compiles this constant directly into the publicly downloaded JavaScript bundle (`/_next/static/chunks/app/(auth)/login/page-*.js`). Any visitor can open Chrome DevTools, search for `Admin@12345`, and log in as root Super Admin.
- **Remediation**: Remove `password` from the client array. If demo buttons are needed in staging, populate credentials via a secure server action that only returns them when `process.env.ENABLE_DEMO_LOGIN === 'true'` and `NODE_ENV !== 'production'`.

---

### Finding 2: Fail-Open Security Bypass in `workstations.ts`
- **Location**: [`app/actions/workstations.ts:L70-L84`](file:///d:/Projects/LMR/app/actions/workstations.ts#L70-L84)
- **Status**: **CONFIRMED (CRITICAL)**
- **Code Evidence**:
  ```typescript
    } catch {
      // Graceful fallback for automated integration test runners & scripts
      return {
        scope: {
          role: 'lab_incharge',
          userId: '00000000-0000-0000-0000-000000000001',
          fullName: 'Lab In-Charge (System/Automated)',
          isPrivileged: true,
          assignedLabs: ['comp', 'physics', 'chem', 'bio'],
          assignedClasses: [],
          assignedSubjects: [],
        } as any,
        isPrivileged: true,
      }
    }
  ```
- **Risk Analysis**: When an unauthenticated client or student terminal invokes `getWorkstationBoardData()` or any workstation server action, `getServerUserScope()` throws an authorization error. The catch block catches this and **grants full `lab_incharge` permissions with `isPrivileged: true`**!
- **Remediation**: Fail-closed immediately. If `process.env.NODE_ENV !== 'test'`, rethrow or return `{ scope: null, isPrivileged: false }`.

---

### Finding 3: Unguarded Server Action Mutations
- **Location**: [`app/actions/notifications.ts:L67`](file:///d:/Projects/LMR/app/actions/notifications.ts#L67), [`app/actions/terminal-simulator.ts:L194, L243`](file:///d:/Projects/LMR/app/actions/terminal-simulator.ts#L194)
- **Status**: **CONFIRMED (CRITICAL)**
- **Code Evidence**:
  - `export async function dispatchTeacherDailyReminders(force = false)` has zero session or permission verification.
  - `export async function resetStationTelemetry(stationCode: string)` executes `UPDATE public.workstations SET machine_guid = NULL...` without checking if the caller is an authenticated administrator.
  - `export async function mintSimulatorTerminalTicket(stationCode: string)` mints valid 60-second HMAC handshake tickets for any workstation without session verification.
- **Risk Analysis**: Server actions are publicly accessible HTTP POST endpoints with stable IDs generated at build time. Any actor can send a fetch request to trigger unwanted mass emails or wipe hardware locks from lab workstations.
- **Remediation**: Introduce a mandatory `requirePrivilegedRole('super_admin', 'lab_incharge')` check at the start of every mutating server action.

---

### Finding 4: Schema Trigger Insecurity & Privilege Self-Granting
- **Location**: [`schema.sql:L1634`](file:///d:/Projects/LMR/schema.sql#L1634), [`schema.sql:L2321`](file:///d:/Projects/LMR/schema.sql#L2321)
- **Status**: **CONFIRMED (CRITICAL)**
- **Code Evidence**:
  ```sql
  -- First definition at line 1634:
  coalesce(new.raw_user_meta_data->>'approval_status', 'approved')
  -- Second definition at line 2321:
  coalesce(new.raw_user_meta_data->>'role', 'teacher')
  ```
- **Risk Analysis**: `handle_new_user()` is declared twice in `schema.sql`. Both versions read `raw_user_meta_data` from Supabase Auth. Because users can pass arbitrary metadata during `supabase.auth.signUp({ options: { data: { role: 'super_admin', approval_status: 'approved' } } })`, the trigger will blindly assign them `super_admin` with approved status.
- **Remediation**: Hardcode `'teacher'` and `'pending'` unconditionally in PostgreSQL. Deduplicate the trigger.

---

### Finding 5: Incomplete `protect_profile_escalation()` Trigger
- **Location**: [`schema.sql:L2302-L2309`](file:///d:/Projects/LMR/schema.sql#L2302-L2309)
- **Status**: **CONFIRMED (HIGH)**
- **Code Evidence**:
  ```sql
  IF (OLD.role IS DISTINCT FROM NEW.role OR OLD.approval_status IS DISTINCT FROM NEW.approval_status) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'super_admin' AND is_active = true
    ) THEN
      RAISE EXCEPTION 'Access Denied: Only Super Administrators can alter user roles or approval statuses.';
    END IF;
  END IF;
  ```
- **Risk Analysis**: The trigger checks `role` and `approval_status`, but omits `permissions` and `is_active`. A regular teacher could update their profile row via PostgREST to set `{"can_access_admin": true, "can_manage_users": true}` or reactivate an inactive profile.
- **Remediation**: Expand the condition:
  ```sql
  IF (OLD.role IS DISTINCT FROM NEW.role 
      OR OLD.approval_status IS DISTINCT FROM NEW.approval_status
      OR OLD.permissions IS DISTINCT FROM NEW.permissions
      OR OLD.is_active IS DISTINCT FROM NEW.is_active) THEN
  ```

---

### Finding 6: Permissive PostgREST RLS (`USING (true)`)
- **Location**: [`schema.sql:L2008`](file:///d:/Projects/LMR/schema.sql#L2008), [`schema.sql:L2230`](file:///d:/Projects/LMR/schema.sql#L2230)
- **Status**: **CONFIRMED (HIGH)**
- **Code Evidence**:
  - `CREATE POLICY "Allow manage log_attendance" ON public.log_attendance AS PERMISSIVE FOR ALL TO public USING (true);`
  - `CREATE POLICY "Allow read workstations" ON public.workstations AS PERMISSIVE FOR SELECT TO public USING (true);`
- **Risk Analysis**: Any unauthenticated client possessing the Supabase anonymous key can modify student attendance records and inspect workstation hardware identifiers via PostgREST.
- **Remediation**: Restrict `log_attendance` to authenticated users with teacher/in-charge roles, and restrict `workstations` pairing tokens from anonymous reads.

---

### Finding 7: Cron Endpoint Authorization & Execution Duration
- **Location**: [`app/api/cron/reminders/route.ts:L23`](file:///d:/Projects/LMR/app/api/cron/reminders/route.ts#L23), [`vercel.json`](file:///d:/Projects/LMR/vercel.json)
- **Status**: **CONFIRMED (HIGH)**
- **Code Evidence**:
  ```typescript
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  ```
- **Risk Analysis**: If `CRON_SECRET` is not configured in the hosting environment, `process.env.CRON_SECRET` evaluates to `undefined`, bypassing the entire authorization check. Furthermore, the route lacks `export const maxDuration = 60;`, causing Vercel serverless functions on hobby tiers to abort after 10 seconds during bulk email dispatch.
- **Remediation**: Fail if `!process.env.CRON_SECRET`. Export `maxDuration = 60`.

---

### Finding 8: Dev Controllers Mounted in Production
- **Location**: [`app/(dashboard)/layout.tsx:L63-L66`](file:///d:/Projects/LMR/app/%28dashboard%29/layout.tsx#L63-L66), [`lib/server-effective-time.ts:L45-L54`](file:///d:/Projects/LMR/lib/server-effective-time.ts#L45-L54)
- **Status**: **CONFIRMED (HIGH)**
- **Code Evidence**: `<TimeTravelController />` and `<TerminalSimulatorController />` are unconditionally rendered in `layout.tsx`. In `server-effective-time.ts`, the server trusts the `lmr_simulated_time` cookie regardless of environment.
- **Risk Analysis**: A user in production can set the `lmr_simulated_time` cookie to manipulate academic dates, bypass holiday attendance locks, or backdate practical logs.
- **Remediation**: Wrap both components in `{process.env.NODE_ENV === 'development' && ...}` and ignore `lmr_simulated_time` in production.

---

### Finding 9: Plaintext OTP Storage & `Math.random()`
- **Location**: [`app/actions/otp.ts:L39, L196, L215`](file:///d:/Projects/LMR/app/actions/otp.ts#L39)
- **Status**: **CONFIRMED (HIGH)**
- **Code Evidence**:
  - `generateNumericOtp()` uses `Math.random()`.
  - OTP is inserted into `public.email_otps` as unhashed plaintext.
  - `devOtp` is returned if `mailRes.mode === 'dev-preview'`.
- **Risk Analysis**: `Math.random()` is not cryptographically secure and is predictable under seed analysis. Storing OTPs in plaintext creates a hazard if read access is obtained.
- **Remediation**: Use `crypto.randomInt(100000, 999999)` and store SHA-256 hashes of OTP codes in the database.

---

### Finding 10: Committed Database Dump
- **Location**: [`scratch_db_dump.json`](file:///d:/Projects/LMR/scratch_db_dump.json)
- **Status**: **CONFIRMED (HIGH)**
- **Risk Analysis**: Contains 335 lines of JSON including institutional staff emails, roles, and profile UUIDs.
- **Remediation**: Delete `scratch_db_dump.json` and add `*_db_dump.json` to `.gitignore`.

---

### Finding 11: Dangerous `ON DELETE CASCADE` Referencing `labs(id)`
- **Location**: [`schema.sql:L958, L1060, L1090`](file:///d:/Projects/LMR/schema.sql#L958)
- **Status**: **CONFIRMED (HIGH)**
- **Code Evidence**:
  - `ALTER TABLE practical_logs ADD CONSTRAINT practical_logs_lab_id_fkey FOREIGN KEY (lab_id) REFERENCES labs(id) ON DELETE CASCADE;`
  - `ALTER TABLE schedules ADD CONSTRAINT schedules_lab_id_fkey FOREIGN KEY (lab_id) REFERENCES labs(id) ON DELETE CASCADE;`
- **Risk Analysis**: Deleting a lab facility row will instantly cascade and permanently delete all historical practical log records and timetable entries associated with that laboratory.
- **Remediation**: Alter foreign keys to `ON DELETE RESTRICT`. Labs should only be deactivated (`status = 'Inactive'`).

---

### Finding 12: Destructive Attendance Sync Trigger on Practical Log Edit
- **Location**: [`schema.sql:L1760-L1776`](file:///d:/Projects/LMR/schema.sql#L1760-L1776)
- **Status**: **CONFIRMED (HIGH)**
- **Code Evidence**:
  ```sql
  delete from public.log_attendance where log_id = new.id;
  for r in 1..effective_headcount loop
    insert into public.log_attendance (id, log_id, roll_number, is_present, created_at)
    ...
  ```
- **Risk Analysis**: Trigger `trg_sync_practical_log_attendance` executes on `AFTER UPDATE` of `practical_logs`. Modifying remarks or topic wipes all existing `log_attendance` records for that log, severing bridged `student_id` and `enrollment_id` references, and executes 40 iterative single-row insert queries.
- **Remediation**: Execute sync only when `absent_rolls` or `total_students` changes. Use set-based `generate_series` with `ON CONFLICT (log_id, roll_number) DO UPDATE SET is_present = EXCLUDED.is_present`.

---

### Finding 13: In-Memory Ticket Cache in Serverless Environment
- **Location**: [`lib/security/terminal-token.ts:L87`](file:///d:/Projects/LMR/lib/security/terminal-token.ts#L87)
- **Status**: **CONFIRMED (MEDIUM)**
- **Risk Analysis**: `REDEEMED_TICKETS = new Map<string, number>()` resides in process memory. Across multiple Vercel serverless function instances or container recycles, tickets can be replayed within their 60-second validity window.
- **Remediation**: Store redeemed signatures in `public.rate_limit_events` with an expiration timestamp.

---

### Finding 14: Roll Number Constraint Mismatch
- **Location**: [`schema.sql:L874`](file:///d:/Projects/LMR/schema.sql#L874), [`components/admin/cohort-promotion-wizard.tsx:L1239`](file:///d:/Projects/LMR/components/admin/cohort-promotion-wizard.tsx#L1239)
- **Status**: **CONFIRMED (MEDIUM)**
- **Code Evidence**:
  - DB Constraint: `CHECK (roll_number > 0 AND roll_number <= 200)`
  - UI Input: `<input type="number" min="1" max="250" />`
- **Risk Analysis**: If an administrator assigns roll numbers between 201 and 250 in the wizard, the batch promotion transaction will crash with an unhandled PostgreSQL constraint error.
- **Remediation**: Update `student_enrollments_roll_number_check` to `<= 250`.

---

### Finding 15: Obsolete Department String in Database Triggers (Rule #5)
- **Location**: [`schema.sql:L1647, L2340`](file:///d:/Projects/LMR/schema.sql#L1647)
- **Status**: **CONFIRMED (LOW)**
- **Risk Analysis**: `handle_new_user()` populates `department: 'Science Department'`, which violates AGENTS.md Rule #5 ("Department strings have been purged from the data model").
- **Remediation**: Remove `department` column reference or pass `NULL`.

---

### Findings 17 & 18: Unfinished Mock Purge & `infrastructure_periods`
- **Claimed by Argon**: `lib/baseline-routines.ts`, `institutional-relationships.ts`, and `master-data.ts` reading `localStorage` still exist in the repository.
- **Status**: **DEBUNKED (FALSE POSITIVE)**
- **Proof**: 
  - Verified that `lib/baseline-routines.ts` does not exist on disk (deleted in Task 73).
  - Verified that `lib/context/institutional-relationships.ts` does not exist on disk (deleted in Task 73).
  - Grep search for `infrastructure_periods` in `lib/` returned 0 matches.
  - Argon inspected obsolete export bundle artifacts (`export-output/3_lib_supabase_and_scripts.txt`) rather than the active workspace files.

---

## 3. Actionable 4-Day Production Stabilization Roadmap

```mermaid
gantt
    title LabSync LIMS Production Stabilization Roadmap
    dateFormat  YYYY-MM-DD
    section Day 1: Auth & Access Lockdown
    Strip Demo Passwords from Client Bundle       :active, d1_1, 2026-10-26, 1d
    Fail-Closed Guard in workstations.ts          :active, d1_2, 2026-10-26, 1d
    Guard Server Actions (Notifications/Sim)       :active, d1_3, 2026-10-26, 1d
    Fix handle_new_user() & protect_profile_escalation: active, d1_4, 2026-10-26, 1d
    section Day 2: Relational & Trigger Integrity
    Harden Attendance Sync Trigger (Set-Based)     :d2_1, 2026-10-27, 1d
    Replace ON DELETE CASCADE with RESTRICT on Labs:d2_2, 2026-10-27, 1d
    Lock Down RLS Policies (log_attendance & ws)   :d2_3, 2026-10-27, 1d
    Align Roll Number Check Constraint to 250     :d2_4, 2026-10-27, 1d
    section Day 3: Environment Gating & Hygiene
    Gate Dev Controllers & Time Travel Cookie      :d3_1, 2026-10-28, 1d
    Enforce CRON_SECRET & maxDuration = 60        :d3_2, 2026-10-28, 1d
    Purge scratch_db_dump.json & Ignore Dumps     :d3_3, 2026-10-28, 1d
    Dynamic Dev LAN Origin in next.config.ts       :d3_4, 2026-10-28, 1d
    section Day 4: Cryptography & Final Verification
    Crypto-Secure OTP (randomInt & SHA-256)        :d4_1, 2026-10-29, 1d
    Stateless Terminal Ticket Anti-Replay Store    :d4_2, 2026-10-29, 1d
    Full TypeScript & Playwright Regression Run   :d4_3, 2026-10-29, 1d
```

### Day 1: Auth & Access Control Lockdown (Critical Blockers)
1. **Client Password Removal**: Remove `DEMO_ACCOUNTS` passwords from [`app/(auth)/login/page.tsx`](file:///d:/Projects/LMR/app/%28auth%29/login/page.tsx). Replace with server-only dev action if needed in preview mode.
2. **Fail-Closed Workstation Scope**: In [`app/actions/workstations.ts`](file:///d:/Projects/LMR/app/actions/workstations.ts#L70), change `getAuthContext()` catch block to fail-closed (`return { scope: null, isPrivileged: false }`).
3. **Guard Server Action RPCs**: In [`app/actions/notifications.ts`](file:///d:/Projects/LMR/app/actions/notifications.ts) and [`app/actions/terminal-simulator.ts`](file:///d:/Projects/LMR/app/actions/terminal-simulator.ts), add session and role verification (`requirePrivilegedRole`) to all mutating endpoints.
4. **PostgreSQL Trigger Security**: In `schema.sql`:
   - Deduplicate `handle_new_user()` into a single function that hardcodes `role = 'teacher'` and `approval_status = 'pending'`, never trusting `raw_user_meta_data`.
   - Update `protect_profile_escalation()` to guard `permissions` and `is_active` modifications.

### Day 2: Relational & Trigger Integrity (Data Safety)
1. **Optimize Attendance Sync Trigger**: Rewrite `sync_practical_log_attendance()` to avoid destructive row deletion and replace the 40-iteration loop with an atomic `generate_series` set-based upsert on conflict.
2. **Eliminate Cascade Traps**: Change `ON DELETE CASCADE` to `ON DELETE RESTRICT` on foreign keys referencing `labs(id)` across `practical_logs`, `schedules`, and `lab_incidents`.
3. **Lock Down PostgREST RLS**: Replace `Allow manage log_attendance USING (true)` and `Allow read workstations USING (true)` with authenticated and privileged user checks.
4. **Align Constraints**: Update `student_enrollments_roll_number_check` in PostgreSQL to `roll_number <= 250`.

### Day 3: Environment Gating & Repository Hygiene
1. **Gate Dev Controllers**: In [`app/(dashboard)/layout.tsx`](file:///d:/Projects/LMR/app/%28dashboard%29/layout.tsx), conditionally render `<TimeTravelController />` and `<TerminalSimulatorController />` only when `process.env.NODE_ENV === 'development'`.
2. **Ignore Simulated Time in Production**: In [`lib/server-effective-time.ts`](file:///d:/Projects/LMR/lib/server-effective-time.ts), do not parse `lmr_simulated_time` when `NODE_ENV === 'production'`.
3. **Harden Cron Route**: In [`app/api/cron/reminders/route.ts`](file:///d:/Projects/LMR/app/api/cron/reminders/route.ts), require `CRON_SECRET` to be defined and match bearer header. Add `export const maxDuration = 60;`.
4. **Repository Cleanup**: Delete `scratch_db_dump.json`, add `*_db_dump.json` to `.gitignore`.
5. **Config Dynamic Origins**: Update `next.config.ts` to allow dynamic local subnet IPs or read from `process.env.ALLOWED_DEV_ORIGIN`.

### Day 4: Cryptography & System Verification
1. **Harden OTP Engine**: In [`app/actions/otp.ts`](file:///d:/Projects/LMR/app/actions/otp.ts), use `crypto.randomInt(100000, 999999)` and store SHA-256 hashed OTPs in `public.email_otps`.
2. **Stateless Anti-Replay Store**: In [`lib/security/terminal-token.ts`](file:///d:/Projects/LMR/lib/security/terminal-token.ts), store redeemed handshake signatures in PostgreSQL (`rate_limit_events`) to prevent multi-instance replays on serverless platforms.
3. **Full System Verification**:
   - Run `npx tsc --noEmit` (ensure 0 errors).
   - Run complete suite of unit, integration, and Playwright E2E tests.

---

## 4. Conclusion

The external reviews from Argon and Claude accurately surfaced **several genuine, high-severity vulnerabilities** (specifically the client password bundle, the fail-open fallback in `workstations.ts`, unguarded simulator mutations, and permissive RLS). At the same time, their assessment that mock data remains active was debunked, as those prototype files were already eliminated in recent tasks.

With a focused **3 to 4 day stabilization sprint** implementing the recommendations above, the codebase will be completely hardened and ready for production deployment at Ratna Rajya Laxmi Secondary School.
