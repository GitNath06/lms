# Incident Deduplication, Double-Notification Elimination & Mobile Quick-Snap Camera Documentation

> **Date**: October 3, 2026  
> **Status**: Completed & Verified (`npx tsc --noEmit` & 36/36 test cases passing)  
> **Modules Affected**:  
> - `hooks/use-incident-state.ts`
> - `app/actions/incidents.ts`
> - `app/(dashboard)/records/incidents/page.tsx`
> - `app/(dashboard)/incidents/page.tsx`
> - `components/records/incident-records-table.tsx`
> - `components/layout/notification-bell.tsx`
> - `components/incidents/incident-photo-uploader.tsx`
> - `components/dashboard/report-incident-modal.tsx`
> - `components/records/incident-detail-drawer.tsx`
> - `components/dashboard/incident-drawer.tsx`
> - `lib/image-compression.ts`

---

## 1. Issues Identified & Root Cause Analysis

### 1.1 Double Records & React Unique Key Collision
- **Symptom**:
  Console error: `Encountered two children with the same key, 'inc-1791040964741-gunx'`.
  The Laboratory Incident & Damage Register table rendered duplicate rows for single reported incidents (e.g. PC_05 "office not activated").
- **Root Cause**:
  1. **Dual ID Generation**: When logging an incident via `useIncidentState.logIncident()`, an optimistic record was created with `recordId` (e.g., `inc-1791040964741-gunx`). Then `reportIncident(data)` was invoked where `data` lacked an `id`. The server action `reportIncident` in `app/actions/incidents.ts` generated a *second* ID, saving a duplicate into the store/database.
  2. **Storage Concatenation without Deduplication**: In `app/(dashboard)/records/incidents/page.tsx`, `reconcileWithLocalStorage` loaded both `lab_incidents_v1` and `lab_pending_incidents_outbox_v1` and concatenated them (`allLocal = [...pending, ...stored]`) without deduplicating by `id`. When an item existed in both lists or was re-emitted by the storage event listener, duplicates with identical keys were rendered.
  3. **Table Array Mapping**: `IncidentRecordsTable` mapped over `incidents` directly without an internal identity set check.

### 1.2 Double Notifications
- **Symptom**: Reporting an incident caused duplicate toast notifications and duplicate bell notification items in the top bar.
- **Root Cause**: Both the client-side optimistic notification insertion (`persistNotifs`) and the server action (`reportIncident`) created notifications for the incident with different notification IDs. When the client reconciled with server notifications, both sets displayed simultaneously. Furthermore, `reportIncident` created multiple notifications for `lab_incharge` and `hod` without clearing previous notifications with the same `incident_id`.

### 1.3 Missing Image UI/UX & Mobile Camera Quick-Snap
- **Symptom**:
  1. Photo files selected or captured in desktop/mobile were uploaded, but never rendered in the Incident Register table or the detail inspection drawers.
  2. Mobile users lacked a 1-tap quick snap camera button to directly trigger the hardware camera to photograph damaged lab equipment.

---

## 2. Solutions Implemented

### 2.1 Deduplication & Idempotent ID Flow
1. **Pass-Through Record ID**: In `hooks/use-incident-state.ts`, `reportIncident` is now called with `{ ...data, id: recordId }`. The server action `reportIncident` respects the incoming `data.id` if provided instead of generating a secondary ID.
2. **Notification Idempotency**:
   - In `app/actions/incidents.ts`, before inserting notifications for `lab_incharge` or `hod`, any pre-existing notifications for that `incident_id` are removed from both memory store and Supabase database (`.delete().eq('incident_id', recordId)`).
   - `getNotifications` deduplicates records by `id`.
   - In `components/layout/notification-bell.tsx`, notifications are deduplicated by `incident_id:target_role` to prevent ghost entries.
3. **Map-Based Local Reconciler**: In `app/(dashboard)/records/incidents/page.tsx`, `reconcileWithLocalStorage` uses `localMap = new Map<string, any>()` keyed by `id`, ensuring an incident is never duplicated regardless of whether it is in the pending outbox or saved storage.
4. **Table Identity Memo**: In `components/records/incident-records-table.tsx`, `uniqueIncidents` is memoized with a Set of IDs, strictly guaranteeing unique React keys and row entries.

### 2.2 Mobile Quick-Snap Camera & File Uploader
- Updated `components/incidents/incident-photo-uploader.tsx` with dual upload triggers:
  1. **"Quick Snap Camera"**: `<input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="sr-only" />` launches the rear hardware camera directly on Android/iOS devices for instant equipment damage photo capture.
  2. **"Upload Photo"**: Standard gallery/file picker for uploading screenshots or existing photos.
- Added `fileToBase64` in `lib/image-compression.ts`: Compressed images (~60–120 KB) are converted to base64 Data URLs, stored reliably in the `photo_url` column and displayed across all client offline/online views.

### 2.3 Comprehensive Image Display UI/UX
- **Register Table Rows (`components/records/incident-records-table.tsx`)**:
  - Attached evidence photos appear as compact `h-9 w-9` rounded thumbnail chips in the "Circumstances & Description" column alongside the text.
  - Hovering reveals a subtle zoom icon; clicking the thumbnail opens a full-screen Lightbox modal preview without triggering the row's drawer toggle (`e.stopPropagation()`).
- **Incident Detail Drawer (`components/records/incident-detail-drawer.tsx`)**:
  - Added an "Evidence Photo / Damage Documentation" card showcasing the photo with zoom controls and a Lightbox modal.
- **Dashboard Quick-Inspect Drawer (`components/dashboard/incident-drawer.tsx`)**:
  - Added the matching evidence photo card and Lightbox modal.

---

## 3. Verification & Quality Gates
- **TypeScript Typecheck**: `npx tsc --noEmit` &rarr; 0 errors.
- **Integration Test Suites**: 36/36 tests passed across 4 test suites:
  - `tests/academic-year-lifecycle.test.mjs`
  - `tests/phase4-roster-ingestion.test.mjs`
  - `tests/phase6-roster-clean-slate.test.mjs`
  - `tests/phase6-roster-lifecycle.test.mjs`
