# Task 43: Enterprise Security, RBAC & Forensic Integrity Audit

**Date**: 2026-10-15  
**Auditor**: Antigravity Enterprise Forensic Agent  
**Goal**: Conduct an exhaustive, zero-code-modification internal security and integrity verification of the entire LabSync LIMS platform, documenting critical privilege escalation vectors, cryptographic threats, RLS leakages, and regulatory compliance risks in a CISO-grade `.md` audit report.

---

## 1. Scope & Execution Methodology

- **Target Systems**:
  - PostgreSQL Row-Level Security (RLS) on all 33 public tables via live information schema introspection.
  - Server Actions exported RPC endpoints (`app/actions/*.ts`) across authorization, input injection, and scope checks.
  - Terminal Handshake & Cryptographic Token Engine (`lib/security/terminal-token.ts`, `app/api/terminal/handshake/route.ts`, `app/terminal/auth/route.ts`).
  - Regulatory 75% practical attendance compliance calculations and academic dual sign-off validity.
  - Database referential integrity, foreign key cascading deletion rules, and connection pooler concurrency.
- **Constraints**:
  - 100% read-only audit posture on production code (zero code changes to application files during discovery).
  - Telemetry gathered using localized scratch introspection scripts.

---

## 2. Key Findings Discovered

### A. Critical Severity (CVSS 8.8 – 9.8)
1. **Direct PostgREST Role Escalation via `public.profiles`**:
   - `Allow users update own profile` has `with_check: null`. Postgres column grants permit `UPDATE (role, approval_status)` to `authenticated`. No trigger exists. Any user can elevate themselves to `super_admin` via PostgREST.
2. **Server Action RBAC Bypass via `internalBypassScopeCheck`**:
   - Public RPC endpoints in `app/actions/academic-years.ts`, `app/actions/archive-hub.ts`, and `app/actions/seat-plans.ts` accept `internalBypassScopeCheck?: boolean` in client payloads, completely bypassing scope authorization.
3. **Hardcoded Cryptographic Salt Fallback in Terminal HMAC Engine**:
   - `lib/security/terminal-token.ts` falls back to `'labsync-lims-default-terminal-signing-salt-2083'` because `TERMINAL_SIGNING_SECRET` is unset in `.env.local`. Handshake tickets and session cookies can be forged offline.

### B. High Severity (CVSS 7.1 – 8.2)
4. **Anonymous Public Read on Hardware Secrets**: `public.workstations` permits `{public}` `SELECT` on `pairing_token` and `machine_guid`.
5. **Staff PII Scraping**: `public.profiles` grants `{public}` `SELECT` on all columns, exposing emails, phone numbers, and roles.
6. **Anonymous Calendar Deletion**: `public.calendar_settings` grants `cmd: ALL` to `{public}` with `qual: true`.
7. **Arbitrary Audit Log Injection**: `public.audit_logs` grants `cmd: INSERT` to `{public}` with `with_check: true`.
8. **Direct Pool Fallback Bypassing RLS**: In `app/actions/logs.ts`, if Supabase returns error `42501` (RLS violation), the action executes raw SQL via `getPgPool()` as superuser.
9. **Permissive Attendance Write Access**: `public.log_attendance` grants `cmd: ALL` to all `{authenticated}` accounts without scoping.

### C. Medium Severity (CVSS 5.0 – 6.5)
10. **Semantic Dual Sign-Off Spoofing**: `institutional-reports.ts` evaluates verification via `remarks ILIKE '%verified%'`, allowing teachers to self-verify by typing "verified" into comments.
11. **NEB 75% Attendance Defaulting to 100%**: Unmarked enrollments default to `totalHeld`, falsely qualifying students for board exams.
12. **Development Mode Blanket Privilege Elevation**: `app/actions/workstations.ts` and `terminal.ts` set `isPrivileged: true` if `NODE_ENV === 'development'`.
13. **Volatile In-Memory Anti-Replay Cache**: `new Map()` in `terminal-token.ts` fails to synchronize across horizontal instances.
14. **Over-Scoped Cookie Path**: `labsync_terminal_session` is set with `path: '/'` instead of `path: '/terminal'`.
15. **Catastrophic Facility Cascade Deletion**: Deleting a lab cascades into deleting all historical practical logs, attendance tallies, and incidents.

---

## 3. Deliverables & Documentation

- **Primary Master Audit Report**:
  [`doc/audits/2026-10-15-enterprise-security-rbac-and-forensic-integrity-audit.md`](file:///d:/Projects/LMR/doc/audits/2026-10-15-enterprise-security-rbac-and-forensic-integrity-audit.md)
  (Complete with CVSS scores, reproduction HTTP requests, and ready-to-run PostgreSQL remediation DDL).
- **Task Log**: `doc/tasks/2026-10-15-task-43-enterprise-security-rbac-and-forensic-integrity-audit.md`
- **Updated Registers**: `doc/tasks/README.md`, `doc/CURRENT_STATUS.md`.
