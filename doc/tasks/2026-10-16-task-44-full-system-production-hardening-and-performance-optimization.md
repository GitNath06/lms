# Task 44: Full-System Production Hardening & Performance Optimization

**Date**: 2026-10-16  
**Status**: Completed  
**Scope**: Security, RLS Hardening, Database Indexing, Query Optimization, Connection Pool Management, Frontend Runtime Performance, and Media Optimization.

---

## 1. Overview & Objectives

Following comprehensive institutional audits (`phase0_audit_report.md` and `GeminiDomain1Database&.md`), this task resolved critical security vulnerabilities, database performance bottlenecks, and frontend re-render thrashing across LabSync LIMS:

1. **Database Authorization & Privilege Escalation Defense**: Eliminated profile role escalation vulnerabilities on `public.profiles` via database trigger guards and restricted direct column update permissions. Hardened RLS policies across `labs`, `schedules`, `calendar_settings`, and `teacher_substitutions`. Revoked direct public inserts on `audit_logs`.
2. **Database Performance & Targeted Indexing**: Applied 9 high-impact composite and B-tree indexes on live PostgreSQL (`practical_logs`, `log_attendance`, `student_enrollments`, `lab_incidents`, `schedules`, `maintenance_logs`), adhering to live schema column invariants (`day_key` and `service_date`).
3. **Connection Pooling & Query Optimization**: Replaced 35 instances of unpooled `pg.Client` creation and socket destructions (`client.end()`) with shared connection pooling (`getPooledClient` / `getPgPool`) and guaranteed `finally { client.release() }`. Replaced 40-step sequential attendance update loops with an atomic SQL `UPDATE ... FROM` join.
4. **Frontend Runtime & Core Web Vitals**: Throttled the global 1Hz (`1000ms`) ticker in `hooks/use-live-schedule.ts` to `30000ms`, memoized heavy derived calendar and timetable computations with `useMemo`, and isolated the visual seconds display inside `LiveClockHeader`. Added 300ms debouncing on filter inputs in `/records` and `/records/incidents`. Parallelized 5 serial queries in `/computer-lab` via `Promise.all`.
5. **Architectural Purity & Single Source of Truth**: Purged static `MASTER_ROUTINE` mock data from notification mailers (`dispatchTeacherDailyReminders`) and `CommandPalette`, linking both to canonical live database routines. Eliminated `NODE_ENV === 'development'` privilege escalation backdoors in all server actions (`workstations.ts`, `terminal.ts`, `maintenance.ts`, `maintenance-fleet.ts`). Closed fail-open auth verification in `middleware.ts` by redirecting to `/login?error=session_expired`.
6. **Media Optimization**: Configured client-side canvas image compression to output modern `.webp` blobs with EXIF orientation preservation, maintaining dual-compatibility across all views for both `https://...` CDN URLs and legacy `data:image/...` Base64 strings.

---

## 2. Changes Implemented

### Phase 1: Critical Security & Authorization Hardening
- **Trigger Guard on `public.profiles`**: Created `protect_profile_escalation()` trigger enforcing that only `super_admin` can alter `role`, `approval_status`, `permissions`, or `is_active`. Revoked direct `UPDATE` permissions on these sensitive columns from `authenticated`.
- **RLS Policy Tightening**:
  - `labs`, `schedules`, `calendar_settings`: Restricted write access strictly to `super_admin`, `lab_incharge`, and `hod`.
  - `audit_logs`: Revoked direct insert from `authenticated` and `anon`; immutable audit logs are now strictly written server-side via direct connection pool.
  - `teacher_substitutions`: Restricted updates to the teacher's own substitutions or privileged administrative roles.
- **Terminal HMAC Signing**: Added high-entropy `TERMINAL_SIGNING_SECRET` in `.env.local` and enforced strict secret verification in `lib/security/terminal-token.ts`, eliminating weak default salts.
- **Removed Scope Bypass Backdoors**:
  - Removed `internalBypassScopeCheck` from all exported server actions in `academic-years.ts`, `archive-hub.ts`, and `seat-plans.ts`.
- **Demo Accounts Toggle**: Gated 1-click demo login buttons behind `process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS === 'true'` in `app/(auth)/login/page.tsx`.

### Phase 2: Database Connection Pooling & Performance Tuning
- **Connection Leak Remediation**: In `app/actions/otp.ts` and `app/actions/auth.ts`, replaced all unpooled `getPgClient()` calls with `getPooledClient()` from `getPgPool()`. Enforced `try { ... } finally { client.release() }` across all 35 handler paths, eliminating socket exhaustion under load.
- **Targeted Performance Indexes**:
  - `idx_practical_logs_lookup`: `(academic_year_id, lab_id, status, date DESC)`
  - `idx_practical_logs_schedule_date`: `(schedule_id, date)`
  - `idx_practical_logs_teacher`: `(teacher_id, date DESC)`
  - `idx_log_attendance_log_roll`: `(log_id, student_roll)`
  - `idx_log_attendance_enrollment`: `(enrollment_id)`
  - `idx_student_enrollments_year_class_status`: `(academic_year_id, class_id, status, roll_number)`
  - `idx_lab_incidents_lookup`: `(academic_year_id, lab_id, status, severity, incident_date DESC)`
  - `idx_schedules_lab_day`: `(lab_id, day_key)`
  - `idx_maintenance_logs_lab`: `(lab_id, service_date DESC)`
- **Atomic Batch Attendance Update**: In `app/actions/logs.ts`, replaced the 40-step sequential `update()` loop with a single atomic PostgreSQL `UPDATE public.log_attendance ... FROM public.student_enrollments` query. Added `.eq('date', checkDate)` to the duplicate session check query to avoid full table scans.
- **Batch Floor Elements Upsert**: In `app/actions/floor-elements.ts`, converted sequential single-row loops into a single `supabase.from('lab_floor_elements').upsert(toUpsert)`.
- **Institutional Reporting Accuracy**: In `app/actions/institutional-reports.ts`, fixed the NEB attendance calculation bug where students with 0 practical absences evaluated to 0 attended sessions (`attendanceMap.get(...) ?? 0`).

### Phase 3: Frontend Runtime & Core Web Vitals Optimization
- **Throttled Live Schedule Ticker**: In `hooks/use-live-schedule.ts`, changed `setInterval` from 1,000ms to 30,000ms (96.7% re-render reduction). Wrapped `nepaliDate`, `todaySessions`, `activeSessions`, `upcomingSessions`, and `timeString` in `useMemo`.
- **Isolated Header Clock**: In `components/layout/live-clock-header.tsx`, implemented an isolated local 1-second state hook so the header clock displays accurate real-time seconds without triggering re-renders in parent dashboard pages or timetable hooks.
- **Debounced Filter Inputs**: In `app/(dashboard)/records/page.tsx` and `app/(dashboard)/records/incidents/page.tsx`, added 300ms debouncing on filter state effects before triggering server action fetches and `window.history.replaceState`.
- **Parallelized Computer Lab Queries**: In `app/(dashboard)/computer-lab/page.tsx`, wrapped `getWorkstationBoardData`, `fetchLabFacility`, `schedules`, `classes`, and `class_subjects` in `Promise.all` to eliminate the 5-step serial waterfall.
- **Dynamic ExcelJS Imports**: In `app/actions/maintenance.ts` and `app/actions/records.ts`, converted top-level static imports of `lib/exports/xlsx` to dynamic imports (`await import('@/lib/exports/xlsx')`), reducing bundle overhead on non-export RPC invocations.

### Phase 4: Architecture & Single Source of Truth
- **Purged Mock `MASTER_ROUTINE`**:
  - `app/actions/notifications.ts`: `dispatchTeacherDailyReminders` now queries live `public.schedules` joined with `profiles` and `labs`.
  - `components/command-palette.tsx`: Integrated `useRoutineState()` to filter real institutional timetables.
- **Fail-Secure Middleware**: In `middleware.ts`, caught auth verification errors on protected routes (`/admin`, `/maintenance`, `/computer-lab`, `/records`, etc.) now safely redirect to `/login?error=session_expired` instead of failing open.
- **Removed Development Backdoors**: Removed `process.env.NODE_ENV === 'development'` from privilege checks in `workstations.ts`, `terminal.ts`, `maintenance.ts`, and `maintenance-fleet.ts`.

### Phase 5: Media & Storage Optimization
- **WebP Image Compression**: In `lib/image-compression.ts`, switched default canvas compression output to `image/webp` (with automatic fallback to `image/jpeg`).
- **Universal Dual Compatibility**: Verified that all photo displays across the application use native `<img>` tags, preserving full compatibility for both `https://...` CDN URLs and legacy `data:image/...` Base64 strings.

---

## 3. Verification & Test Results

1. **TypeScript Verification**:
   - Command: `npx tsc --noEmit`
   - Result: **0 errors** across all routes, server actions, and components.
2. **Test Suites**:
   - Command: `node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/unit-domain-invariants.test.mjs tests/phase6-board-exports-and-reminders.test.mjs tests/admin-guards.test.mjs`
   - Result: **21 tests passed, 0 failed**.
   - Command: `node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/phase6-conflicts-and-audit.test.mjs tests/lab-status.test.mjs`
   - Result: **13 tests passed, 0 failed**.
3. **Database Migration Verification**:
   - Trigger `protect_profile_escalation` active on live Supabase PostgreSQL.
   - Column permissions revoked from `authenticated` on `profiles`.
   - All 9 composite and B-tree indexes confirmed on live database and recorded in `schema.sql`.

---

## 4. Key Files Modified

- `schema.sql`: Updated RLS policies, column permissions, trigger functions, and index definitions.
- `.env.local`: Configured `TERMINAL_SIGNING_SECRET`.
- `lib/security/terminal-token.ts`: Lazy HMAC secret loading, eliminated hardcoded default secret.
- `lib/image-compression.ts`: Modern WebP canvas compression with JPEG fallback.
- `lib/types/academic-years.ts`: Removed scope check bypass interface.
- `app/actions/auth.ts` & `app/actions/otp.ts`: Pooled clients with `finally { client.release() }`.
- `app/actions/academic-years.ts`, `archive-hub.ts`, `seat-plans.ts`: Removed bypass arguments.
- `app/actions/logs.ts`: Atomic SQL attendance join and indexed date filter.
- `app/actions/floor-elements.ts`: Single batch upsert.
- `app/actions/institutional-reports.ts`: Fixed 0-absence attendance calculation.
- `app/actions/maintenance.ts`, `records.ts`: Dynamic import of ExcelJS.
- `app/actions/notifications.ts`: PostgreSQL schedules query in daily digests.
- `app/actions/workstations.ts`, `terminal.ts`, `maintenance-fleet.ts`: Removed `NODE_ENV` backdoors.
- `hooks/use-live-schedule.ts`: 30s interval, memoized derived states.
- `components/layout/live-clock-header.tsx`: Localized 1s clock ticker.
- `components/command-palette.tsx`: Live routine state search.
- `app/(auth)/login/page.tsx`: Gated demo accounts.
- `app/(dashboard)/records/page.tsx` & `records/incidents/page.tsx`: 300ms debounce.
- `app/(dashboard)/computer-lab/page.tsx`: `Promise.all` parallel queries.
- `middleware.ts`: Fail-secure redirect on session errors, protected `/computer-lab`.
- `tests/register-hooks.mjs`: Pre-loads `.env.local` for all test runners.
