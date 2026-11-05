# Task 40: Zero-Touch Agent Installer, RLS Hardening & Student Terminal Enrichment

**Date**: 2026-10-15  
**Subsystems**: `scripts/client-agent/`, `supabase/migrations/20261015_harden_rls_policies.sql`, `app/actions/terminal.ts`, `components/terminal/student-terminal-view.tsx`, `lib/types/terminal.ts`  
**Status**: Completed  
**Type Check**: Verified with `tsc --noEmit` (0 errors)

---

## 1. Context & Objectives

Following the 50-workstation extreme stress benchmark, several architectural and operational requirements were addressed:
1. **Zero-Touch Lab Workstation Deployment**: In a 50-PC computer lab, manual IP/station code configuration on every physical computer is error-prone. The agent required intelligent Windows hostname normalization (`$env:COMPUTERNAME` auto-formatting to `PC-01`), automated UAC elevation, silent scheduled task creation (`OnStartup`/`OnLogon`), and an uninstaller.
2. **Laptop Hardware Unbinding**: `PC-01` in the database had been bound to the developer's personal laptop during preliminary testing, which would trigger a TOFU hardware mismatch on the real lab PC.
3. **Database RLS Security Hardening**: Based on the comprehensive production security audit, `public.labs`, `public.schedules`, `public.students`, and `public.student_enrollments` had overly permissive `{public}` PostgREST policies.
4. **Student Terminal Practical Enrichment**: Student terminals needed real-time display of the assigned curriculum experiment (from `practical_logs`) and an active period countdown timer.

---

## 2. Engineering Changes Implemented

### A. Zero-Touch Windows Client Agent & Installer Package (`scripts/client-agent/`)
- **Smart Hostname Normalization** in [`labsync-agent.ps1`](file:///d:/Projects/LMR/scripts/client-agent/labsync-agent.ps1):
  - Automatically reads `$env:COMPUTERNAME` if `station_code` is empty.
  - Normalizes common academic naming formats (e.g. `PC01`, `PC-1`, `LAB-PC-01`, `DESK-1` &rarr; `PC-01`).
- **Elevated 1-Click Installer** in [`setup-labsync.bat`](file:///d:/Projects/LMR/scripts/client-agent/setup-labsync.bat):
  - Automatically requests administrator rights via PowerShell UAC elevation.
  - Installs to `C:\LabSync\`.
  - Registers a silent Windows Scheduled Task (`LabSyncClientAgent`) configured for `OnLogon` with `-WindowStyle Hidden`.
  - Generates a desktop shortcut (`LabSync Student Portal.lnk`) in the Public Desktop folder for all workstation users.
- **Clean Uninstaller** in [`uninstall-labsync.bat`](file:///d:/Projects/LMR/scripts/client-agent/uninstall-labsync.bat):
  - Safely deletes the scheduled task, desktop shortcuts, and removes `C:\LabSync\`.
- **Developer Laptop Unbinding**:
  - Reset `machine_guid`, `lan_ip`, and `hardware_specs` for `PC-01` in `public.workstations` to `NULL`, allowing the real physical workstation to establish the initial TOFU hardware lock.

### B. PostgreSQL Row-Level Security (RLS) Hardening
Applied migration [`supabase/migrations/20261015_harden_rls_policies.sql`](file:///d:/Projects/LMR/supabase/migrations/20261015_harden_rls_policies.sql):
1. **`public.labs`**:
   - Dropped public `ALL` policy.
   - Replaced with `"Allow manage labs privileged"`: restricted to authenticated staff where `public.is_privileged()` is true (`super_admin`, `lab_incharge`, `hod`).
2. **`public.schedules`**:
   - Dropped public `ALL` policy.
   - Replaced with `"Allow manage schedules authenticated"`: restricted to authenticated teachers and privileged staff.
3. **`public.students` & `public.student_enrollments`**:
   - Revoked public `{public}` read access.
   - Replaced with authenticated-only read access (`roles: {authenticated}`), shielding student biographical data and roll rosters from anonymous scrapers.

### C. Student Terminal Practical Focus & Period Countdown Timer
- **Context Extension** in [`lib/types/terminal.ts`](file:///d:/Projects/LMR/lib/types/terminal.ts) & [`app/actions/terminal.ts`](file:///d:/Projects/LMR/app/actions/terminal.ts):
  - Added `practicalTitle`, `topicLearned`, and `remainingMinutes` to `TerminalActiveSession`.
  - Resolved today's active practical log title for the current schedule slot or class subject.
  - Calculated exact remaining minutes relative to real or simulated period time (`currentMinutes < endMin`).
- **Terminal UI Elevation** in [`components/terminal/student-terminal-view.tsx`](file:///d:/Projects/LMR/components/terminal/student-terminal-view.tsx):
  - Added "Today's Practical Focus" banner displaying experiment name, focus topic, instructor name, and period time range.
  - Added a live period timer badge with animated pulse (`X min remaining in Period`) alongside the anti-spoofing hardware lock.

---

## 3. Verification & Invariants

- **Host Name Normalization**: Verified pattern matching against `PC-01`, `PC01`, `LAB-PC-01`.
- **Database RLS Policies**: Verified via `pg_policies` that `public` write access is eliminated across all core tables and student PII is shielded.
- **Laptop Unbinding**: Verified `SELECT machine_guid FROM public.workstations WHERE label = 'PC-01'` returns `NULL`.
- **Type Safety**: Passed `tsc --noEmit` with 0 compile errors.
