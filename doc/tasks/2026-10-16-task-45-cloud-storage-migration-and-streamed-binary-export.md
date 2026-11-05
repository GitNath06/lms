# Task 45: Dedicated Cloud Storage for Avatars & Streamed Binary Route Handlers

**Date**: 2026-10-16  
**Status**: Completed  
**Subsystems Involved**: Supabase Cloud Storage, PostgreSQL Database, Student Photos, Staff Avatars, Incident Damage Photos, Route Handlers (`/api/export/*`), ExcelJS, CSV Export.

---

## 1. Problem Statement & Production Architecture Need

Before this task, two architectural bottlenecks threatened the sustainability of the platform on Supabase Free Tier:

1. **PostgreSQL Database Storage Depletion (500 MB Limit)**:
   - Student profile photos, staff avatars, and incident damage photos were stored as Base64 text strings directly inside table rows (`students.photo_url`, `profiles.avatar_url`, and `lab_incidents.photo_url`).
   - Each Base64 image occupied ~40–60 KB in table rows. In an academic institution with ~1,000 students and multi-year historical logs, storing images inside the database would consume >150 MB of database space, risking database lockout.
   - Meanwhile, Supabase's dedicated 1 GB Object Storage remained 100% unused (0 MB).

2. **Bandwidth / Egress Inflation (5 GB Monthly Limit)**:
   - Large Excel and CSV reports (such as the NEB 75% Board Compliance Register and Practical Records) were generated as binary buffers, converted into Base64 strings, and transmitted as JSON payloads over Next.js Server Actions.
   - Base64 encoding inflates payload transfer size by **33%**, wasting network egress on large multi-class student cohorts.

---

## 2. Key Changes & Architectural Implementation

### Phase 1: Supabase Storage Buckets & Row Level Security (RLS)
- Executed [`scripts/setup-storage-buckets.mjs`](file:///d:/Projects/LMR/scripts/setup-storage-buckets.mjs) via direct PostgreSQL pool.
- Created two public storage buckets:
  1. `avatars`: 5 MB file size limit, allowed MIME types: `image/webp`, `image/jpeg`, `image/png`.
  2. `incident-photos`: 5 MB file size limit, allowed MIME types: `image/webp`, `image/jpeg`, `image/png`.
- Configured RLS policies on `storage.objects`:
  - `Public read avatars` / `Public read incident photos`: Public `SELECT` allowed for fast CDN delivery.
  - `Authenticated insert photos` / `Authenticated update photos`: Scoped to `authenticated` users.
  - `Privileged delete photos`: Restricted to `super_admin` and `lab_incharge` roles.
- Documented bucket schemas and policies in [`schema.sql`](file:///d:/Projects/LMR/schema.sql) (lines 2217–2272).

### Phase 2: Client & Server Storage Pipelines
- **Storage Utility (`lib/storage/supabase-storage.ts`)**:
  - Implemented `parseBase64Image`: Decodes Data URLs into raw binary Buffers and MIME types.
  - Implemented `uploadImageToStorage`: Uploads binary buffers with `upsert: true` and returns the permanent CDN URL (`https://<supabase-url>/storage/v1/object/public/<bucket>/<path>`). Includes safe fallback preserving original input if storage is unreachable.
  - Specialized helpers: `uploadStudentPhotoToStorage`, `uploadProfilePhotoToStorage`, and `uploadIncidentPhotoToStorage`.
- **Client Avatar Compression (`lib/student-photos/compressor.ts`)**:
  - Upgraded canvas output to `image/webp` (with automatic fallback to `image/jpeg` if WebP is unsupported).
  - Reduces client upload payload size by ~40% (down to ~12–15 KB per avatar).
- **Server Action Pipelines**:
  - In [`app/actions/students.ts`](file:///d:/Projects/LMR/app/actions/students.ts): `updateStudentPhotoAction` and `batchUpdateStudentPhotosAction` route Base64 payloads through Supabase Storage and persist only the lightweight CDN URL in PostgreSQL.
  - In [`app/actions/auth.ts`](file:///d:/Projects/LMR/app/actions/auth.ts): `updateCurrentUserPhoto`, `updateUserProfilePhoto`, and `updateUser` route staff avatars to `avatars/profiles/<userId>.webp`.
  - In [`app/actions/incidents.ts`](file:///d:/Projects/LMR/app/actions/incidents.ts): `reportIncident` routes damage photos to `incident-photos/incidents/<incidentId>.webp`.

### Phase 3: Zero-Data-Loss Migration of Existing Records
- Executed [`scripts/migrate-base64-to-storage.mjs`](file:///d:/Projects/LMR/scripts/migrate-base64-to-storage.mjs):
  - Pre-flight backup created at `scratch/backup-base64-photos.json` capturing all 23 historical records.
  - Converted each Base64 image to WebP binary and uploaded to Supabase Storage.
  - Updated PostgreSQL rows with permanent public CDN URLs.
  - **Results**:
    - Students migrated: 19/19 (100%)
    - Profiles migrated: 1/1 (100%)
    - Incidents migrated: 3/3 (100%)
    - Remaining Base64 strings in PostgreSQL: **0**.

### Phase 4: Streamed Binary Route Handlers (`app/api/export/[type]/route.ts`)
- Created high-performance streaming Route Handler supporting:
  1. `practical-records`: Streams raw `.xlsx` or `.csv` practical logbook exports with active column filters.
  2. `neb-compliance`: Streams official NEB 75% Board Compliance Register `.xlsx` workbooks.
  3. `incident-records`: Streams equipment breakage and damage registers in `.xlsx` or `.csv`.
  4. `maintenance-records`: Streams consolidated certified service logbook in `.xlsx` or `.csv`.
- Headers configured for optimal client streaming:
  - `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` or `text/csv; charset=utf-8`
  - `Content-Disposition: attachment; filename="..."`
  - `Content-Length: <size>`
  - `Cache-Control: no-store, no-cache`
- **Browser Downloader (`lib/exports/browser-downloader.ts`)**:
  - `downloadExportStream`: Directly downloads streaming binary data.
  - Fallback mechanism: If the stream endpoint encounters an issue, automatically invokes the legacy Server Action without disrupting the user.
- Integrated into UI export buttons in:
  - `components/records/practical-records-table.tsx`
  - `components/records/incident-records-table.tsx`
  - `components/maintenance/maintenance-ledger-table.tsx`
  - `components/analytics/student-compliance-tab.tsx`

---

## 3. Verification & Telemetry

1. **Storage & Streaming Test Suite**:
   - Created [`tests/storage-and-stream-export.test.mjs`](file:///d:/Projects/LMR/tests/storage-and-stream-export.test.mjs).
   - 4/4 assertions passed:
     - Verified `parseBase64Image` decodes WebP and JPEG.
     - Verified `uploadImageToStorage` idempotently returns existing HTTP CDN URLs.
     - Verified `uploadImageToStorage` fallback safety.
     - Verified live PostgreSQL contains exactly **0 Base64 strings** across all tables.
2. **Unit Test Suite**:
   - `npm run test:unit`: 52/52 tests passed across 5 test suites.
3. **Database Footprint Impact**:
   - Reduced photo row size in PostgreSQL from ~50 KB per record to ~90 bytes (CDN URL string), saving >99.8% database space per photo.
   - 10,000 students can now be enrolled without image data inflating the PostgreSQL database.

---

## 4. Invariants Preserved

- **Universal Image Compatibility**: All `<img>` tags throughout the application natively render both CDN URLs and legacy `data:image/...` strings.
- **Zero Breaking Changes**: Existing Server Actions (`exportPracticalRecordsAction`, `exportStudentBoardComplianceAction`, `exportMaintenanceRecordsAction`) remain fully functional and serve as fallback handlers.
- **Terminology Standards**: Adheres strictly to `AGENTS.md` (no literal `+` in button labels, standard academic terminology "Attendance", "Timetable", "Logbook", "Equipment Breakage").
