# System Loopholes, Logical Flaws & Post-Feature Remediation Register

> **Document**: `doc/plans/SYSTEM_LOOPHOLES_LOGICAL_FLAWS_AND_REMEDIATION_REGISTER.md`  
> **Status**: Comprehensive Inventory Compiled — Deferred for Post-Feature Hardening Phase  
> **Target Institution**: Ratna Rajya Laxmi Secondary School (Gaindakot-10, Pitauji, Nawalpur)  
> **Platform**: LabSync LIMS / LMR

---

## 1. Executive Summary

During an in-depth audit across the database schemas, server actions, client hooks, and UI interfaces of the **LabSync LIMS** platform, multiple edge-case loopholes, logical flaws, UI/UX gaps, and security risks were identified.

Per institutional guidance, **active feature development remains the top priority**. This register serves as the authoritative, permanent inventory of all identified loopholes and architectural gaps to be systematically remediated once all core feature capabilities are complete.

---

## 2. Timetable, Schedules & Session Lifecycle Flaws

### 2.1 Stale Merged End Time & Title Duplication *(RESOLVED in Task 24)*
- **Loophole**: Merging two consecutive 1-period slots (e.g. `CHEM-12` Period 1 at `10:10 - 11:00` and Period 2 at `11:00 - 11:45`) updated `span = 2`, but left `end_time` at `'11:00'`. Titles were concatenated as `CHEM-12 - Chemistry Lab & CHEM-12 - Chemistry Lab`.
- **Status**: **RESOLVED** via [Task 24](file:///d:/Projects/LMR/doc/tasks/2026-10-11-task-24-schedule-merge-end-time-and-title-deduplication.md).
- **Fix Applied**: `mergeSchedules` now computes and updates `end_time = '11:45'`. Automatic deduplication cleans identical titles. `unmergeSchedule` restores the deleted secondary slot atomically from `metadata.original_parts`.

### 2.2 Teacher Substitution Local vs Multi-Device Synchrony
- **Loophole**: When a proxy instructor is assigned via `SessionActionModal`, `useSubstitutionState` records the substitution in `localStorage` (`lmr_substitutions_v2`) with optimistic broadcast. If another faculty member logs in from a different laptop, they may not immediately see that they are assigned as proxy unless a server query syncs it.
- **Remediation**: Migrate proxy assignments into a dedicated PostgreSQL table `public.teacher_substitutions` with Realtime subscription.

### 2.3 Facility Under Maintenance Server Guard
- **Loophole**: While the UI disables booking slots in rooms marked `'Under Maintenance'`, a direct API call to `createSchedule` must enforce a server-side check querying `public.labs.status` and reject any insert if `status !== 'Operational'`.
- **Remediation**: Add explicit check constraint validation in `createSchedule` and `submitLiveSession`.

---

## 3. Security, Authentication & Role Governance (RBAC) Loopholes

### 3.1 `process.env.NODE_ENV === 'development'` Root Privilege Escalation
- **Location**:
  - [`app/actions/workstations.ts:59`](file:///d:/Projects/LMR/app/actions/workstations.ts#L59) (`getAuthContext`)
  - [`app/actions/maintenance.ts:150`](file:///d:/Projects/LMR/app/actions/maintenance.ts#L150) (`getAuthorizedProfile`)
  - [`app/actions/terminal.ts:20`](file:///d:/Projects/LMR/app/actions/terminal.ts#L20) (`getAuthContext`)
  - [`app/actions/maintenance-fleet.ts:25`](file:///d:/Projects/LMR/app/actions/maintenance-fleet.ts#L25) (`getAuthorizedProfile`)
- **Loophole**:
  ```typescript
  const isPrivileged =
    scope.isPrivileged ||
    scope.role === 'super_admin' ||
    scope.role === 'lab_incharge' ||
    scope.role === 'hod' ||
    process.env.NODE_ENV === 'development' // 🚨 ROOT PRIVILEGE ESCALATION
  ```
- **Risk**: Any unauthenticated request or unprivileged user is automatically granted full Super Admin privileges if `NODE_ENV` is unset or development.
- **Remediation**: Remove `process.env.NODE_ENV === 'development'` from all authorization checks; verify strictly against `public.profiles.role`.

### 3.2 Direct Raw SQL Password Hashing & Connection Leaks in `app/actions/auth.ts`
- **Location**: [`app/actions/auth.ts:156-238`](file:///d:/Projects/LMR/app/actions/auth.ts#L156-L238)
- **Loophole**:
  - Account provisioning executes raw SQL: `INSERT INTO auth.users ... crypt($2, gen_salt('bf', 10))` directly touching Supabase internal authentication tables.
  - Opens unpooled `pg.Client()` without a `finally` block, risking connection exhaustion under error scenarios.
  - Inserts legacy `'department'` field during signup, violating Rule #5.
- **Remediation**: Refactor to official Supabase GoTrue Admin API (`createAdminClient().auth.admin.createUser()`) with `try...finally` connection pool safety.

### 3.3 Row-Level Security (RLS) Policy Gaps
- **Location**: PostgreSQL `pg_policies`
- **Loophole**:
  - `public.lab_layout_templates` has RLS disabled (`rowsecurity = false`).
  - `public.labs` and `public.schedules` have public `ALL` policies permitting anonymous modifications via Supabase Anon keys.
  - Student roster read policies permit `{public}` read access.
- **Remediation**: Enable RLS on `lab_layout_templates`, restrict mutations to `{authenticated}` staff with `super_admin`/`lab_incharge` roles, and seal student roster queries to authenticated faculty.

### 3.4 Middleware Fail-Open Behavior
- **Location**: [`middleware.ts:130-132`](file:///d:/Projects/LMR/middleware.ts#L130-L132)
- **Loophole**: Catches auth errors and continues instead of redirecting to login on administrative routes (`/admin/*`).
- **Remediation**: Fail closed for `/admin/*` routes while maintaining graceful fallbacks for public landing pages.

---

## 4. UI, UX & Data Synchronization Flaws

### 4.1 Mock Datasets & Hardcoded Arrays (`MASTER_ROUTINE`)
- **Location**: [`lib/master-data.ts`](file:///d:/Projects/LMR/lib/master-data.ts)
- **Loophole**: `MASTER_ROUTINE` contains ~1,000 lines of mock schedules. If a fresh database has no schedules or a new semester begins, components like Command Palette search (`command-palette.tsx`) and notification digests (`notifications.ts`) fall back to static mock classes instead of live database state.
- **Remediation**: Purge static mock schedule arrays; query `public.schedules` dynamically.

### 4.2 Hardcoded Academic Year String `'2083'`
- **Location**: Over 20 files (`class-roster-view.tsx`, `seat-planner-tab.tsx`, `cohort-promotion-wizard.tsx`, `schedules.ts`, `institutional-reports.ts`)
- **Loophole**: Year `'2083'` is hardcoded as fallback. When the academic year advances to `2084`, UI components will revert to 2083 if not explicitly specified.
- **Remediation**: Centralize active academic year resolution to a server helper querying `SELECT id FROM academic_years WHERE is_current = true`.

### 4.3 Multi-Device `localStorage` Split-Brain
- **Location**: `use-logs-state.ts` (`lmr_logs_v2`), `use-incident-state.ts` (`lmr_incidents_v2`), `use-infrastructure-state.ts` (`lmr_infrastructure_v2`)
- **Loophole**: Persisting operational records in client `localStorage` creates split-brain state between different laptops/tablets used by instructors and lab in-charges.
- **Remediation**: Transition to server-first data fetching via React Server Components and SWR/TanStack Query with Supabase Realtime broadcast.

### 4.4 Development Time Simulator Visibility
- **Location**: [`lib/time-simulator.ts`](file:///d:/Projects/LMR/lib/time-simulator.ts)
- **Loophole**: Allows spoofing system time and days. In production, this must be restricted exclusively to Super Admin debug mode to prevent falsified or backdated practical attendance logs.
- **Remediation**: Guard simulator controls behind `process.env.NODE_ENV !== 'production'` or `role === 'super_admin'`.

---

## 5. Media & Database Bloat Loopholes

### 5.1 Base64 Image Storage in Transactional PostgreSQL
- **Location**: `components/roster/class-roster-view.tsx:586`, `public.students.photo_url`, `public.lab_incidents.photo_url`
- **Loophole**: Student face avatars and incident damage photos are compressed as Base64 JPEG data URLs (`data:image/jpeg;base64,...`) and stored directly in PostgreSQL `TEXT` columns.
- **Risk**: Inflates row sizes by ~33%, drastically balloons database backups, increases WAL traffic, and risks hitting Next.js Server Action 1MB payload limits.

### 5.2 Supabase Free Tier Capacity Breakdown & Storage Quota Optimization
- **Backend Baseline Metrics (Audited October 2026)**:
  - **Database Size**: `32 MB / 500 MB` (6.4% used). Actual institutional data is only ~3.8 MB; the remaining ~28 MB consists of PostgreSQL system catalogs (`pg_catalog`), extensions (`pgcrypto`, `supabase_realtime`), and WAL buffer allocation.
  - **File Storage**: `0 / 1 GB` (0% used). The platform currently utilizes zero object storage, completely ignoring the 1,000 MB free bucket allocation while burdening the 500 MB transactional database.
  - **Monthly Active Users**: `6 / 50,000` (negligible).
  - **Egress**: `0.23 / 5 GB` (4.6% used).
- **Mathematical Impact Analysis (1,000 Students + Incidents)**:
  - *Scenario A: Retaining Base64 in PostgreSQL*:
    - 1,000 avatars × ~20 KB = ~20–30 MB raw text.
    - PostgreSQL TOAST tables, WAL duplication, audit logs, and incident photos push database consumption to **100 MB+**, rapidly consuming 20%+ of the database limit.
    - Every roster query (`SELECT * FROM students`) must transfer megabytes of image strings over the wire, causing latency and GPU/RAM lag on classroom devices.
  - *Scenario B: Migrating to Supabase Object Storage (Phase 3)*:
    - 1,000 avatars stored as WebP files in `avatars` bucket = **~15 MB total** in Supabase Storage (**only 1.5% of the 1,000 MB free quota**).
    - Database `photo_url` column stores only an 80-character public CDN URL (`https://xyz.supabase.co/storage/v1/object/public/avatars/students/<uuid>.webp`), consuming just **80 KB in PostgreSQL**.
    - Browser caches avatar assets automatically (`Cache-Control: public, max-age=31536000`), reducing egress and eliminating database query bloat.

### 5.3 Supabase Free Tier Lifecycle: 7-Day Inactivity Auto-Pause Guard
- **Free Tier Policy**: Supabase automatically pauses inactive free-tier projects if they receive **zero API/database requests for 7 consecutive days**.
- **Institutional Operational Impact**:
  - During extended institutional breaks (e.g. 15-day Bada Dashain / Tihar recess or winter vacation), zero school traffic could cause the Supabase project to enter a paused state.
  - When school resumes, the project requires a manual "Restore Project" action in the Supabase dashboard (~1–2 minutes).
- **Remediation & Defense**:
  - Deploy a lightweight, automated scheduled health-check ping (e.g. a free GitHub Action cron job or Vercel cron hitting `/api/health` once every 72 hours) to maintain active status during school breaks.
  - Document the simple 1-click restore procedure in the administrator disaster recovery guide.

### 5.4 Object Storage Architecture & Phased Implementation Plan
1. **Bucket Configuration**:
   - Bucket `avatars`: Public read access, authenticated write for staff/admin.
   - Bucket `incidents`: Public or signed read access, authenticated write for incident reporters.
2. **Client-Side Direct Upload Flow**:
   - Refactor `components/roster/batch-photo-import-modal.tsx`:
     - Client compresses cropped image to WebP (`image/webp`, quality 0.82, max dimensions 256×256 px).
     - Directly uploads file to Supabase Storage: `supabase.storage.from('avatars').upload(`students/${studentId}.webp`, file, { upsert: true })`.
     - Updates database record with the resulting public CDN URL.
3. **Automated Migration Script (`scripts/migrate-base64-to-storage.mjs`)**:
   - A one-time script will query all existing students and incidents where `photo_url LIKE 'data:image%'`.
   - Converts each Base64 payload into a binary Buffer.
   - Uploads to the respective storage bucket.
   - Rewrites the database `photo_url` column with the permanent HTTPS CDN link.

---

## 6. Multi-Tenant Institutional Configuration Standard

### 6.1 Centralized Multi-Client Standard (`lib/institution.ts`)
- **Official Institution**: **Ratna Rajya Laxmi Secondary School**
- **Official Campus Location**: **Gaindakot-10, Pitauji, Nawalpur, Gandaki Province, Nepal**
- **Architecture**: Centralized in [`lib/institution.ts`](file:///d:/Projects/LMR/lib/institution.ts) with full support for environment variable overrides (`NEXT_PUBLIC_INSTITUTION_NAME`, `NEXT_PUBLIC_INSTITUTION_LOCATION`, `NEXT_PUBLIC_INSTITUTION_CODE`), ensuring zero hardcoded school names in mailers or exports and seamless adaptability for multiple institutional clients in the future.

---

## 7. Execution Checklist for Post-Feature Hardening Phase

```
[ ] Phase 1: Security & RBAC Hardening
    - Remove process.env.NODE_ENV === 'development' bypasses across all action files
    - Refactor auth.ts signup to Supabase GoTrue Admin API
    - Enable RLS on lab_layout_templates and restrict public write policies on labs/schedules
    - Harden middleware.ts to fail closed on /admin/* routes

[ ] Phase 2: Master Data Purge & Dynamic Resolution
    - Purge MASTER_ROUTINE mock arrays from lib/master-data.ts
    - Connect Command Palette and Notification digests to live PostgreSQL queries
    - Dynamically resolve active academic year from public.academic_years WHERE is_current = true

[ ] Phase 3: Supabase Storage Bucket Migration
    - Create avatars and incidents buckets in Supabase Storage
    - Refactor batch photo ingestion to upload WebP files and store CDN URLs
    - Execute one-time script migrating legacy Base64 database strings to object storage

[ ] Phase 4: State Consolidation & Realtime Synchrony
    - Remove localStorage shadow stores for transactional logs and incidents
    - Connect cross-device updates to Supabase Realtime broadcast

[ ] Phase 5: Production Infrastructure Tuning
    - Switch connection pooling in lib/db.ts to Transaction Mode (Port 6543)
    - Guard time simulator UI to Super Admin debug mode only
```
