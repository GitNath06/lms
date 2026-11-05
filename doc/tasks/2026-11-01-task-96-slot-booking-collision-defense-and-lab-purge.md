# Task 96: Slot Booking Facility Collision Defense, Optimistic Desync Elimination & Extraneous Lab Purge

**Date**: 2026-11-01  
**Status**: Completed  
**Author**: Antigravity Assistant  
**Impacted Files**:
- `components/schedules/session-action-modal.tsx`
- `app/(dashboard)/schedules/page.tsx`
- `hooks/use-routine-state.ts`
- `app/actions/schedules.ts`
- `app/actions/logs.ts`
- `components/records/practical-filter-bar.tsx`
- `components/dashboard/report-incident-modal.tsx`
- `lib/audit-presenter.ts`
- `scripts/seed-supabase.mjs`
- `scripts/seed-master-schedules.mjs`
- `public.labs` (PostgreSQL)

---

## 1. Problem Statement & User Bug Reports
1. **Teacher Slot Booking Collision & Desync**:
   - From `testteacher` profile, the user requested to book `COMP-12` in Computer Lab during Period 2 on Monday, despite the slot already having an active recurring session (`FCA-9 - Fundamental Computer Applications Lab` with Dinanath Shah).
   - The UI allowed the teacher to submit the request, and the teacher's browser showed a yellow dashed card (`CO... 12C PEND COMP`).
   - However, in the System Administrator profile, the session never appeared on the timetable, and zero notifications showed up in the notification bell.
2. **Extraneous Facility Rooms in Laboratory Directory**:
   - The user noticed two extra laboratories in the Laboratory Facility Directory (`/admin`): "Biology & Life Sciences Lab (LAB-BIO-01)" and "Electronics & Hardware Lab (LAB-ELEC-01)".
   - The academic institution only operates 3 physical laboratories: Computer Lab (`comp`, 48 stations), Chemistry Lab (`chem`, 40 stations), and Physics Lab (`phys`, 38 stations).
3. **React Key Warning in Records Filter Bar**:
   - Browser console logged duplicate key warnings for `COMP-11` and `COMP-12` inside `components/records/practical-filter-bar.tsx`.

---

## 2. Root Cause Analysis
1. **Modal Props Omission**: In `app/(dashboard)/schedules/page.tsx`, the `+ Book Slot` trigger mounted `<SessionActionModal>` without passing `allRoutines={routines}`. `SessionActionModal` defaulted `allRoutines = []`, completely blinding client collision checks.
2. **Dropdown Primary Lab Check Flaw**: In `components/schedules/session-action-modal.tsx`, `disabled={(isOcc && !isPrimary) || isMaint}` had `&& !isPrimary`. When `bookLabKey` defaulted to `'comp'`, `isPrimary` was true, leaving Computer Lab selectable even when occupied.
3. **Silent Optimistic State Desync**: In `hooks/use-routine-state.ts`, `requestSlotBooking` optimistically pushed the requested session into local React state and `localStorage` before the server responded. When server-side `createSchedule` caught the facility collision with `FCA-9` and returned `{ error: 'Facility Collision...' }`, `requestSlotBooking` did not revert local storage or alert the teacher.
4. **Hardcoded Extra Laboratories in Seeds & Reset Routine**: In `app/actions/schedules.ts` (`resetSchedulesToMaster`), `scripts/seed-supabase.mjs`, and `scripts/seed-master-schedules.mjs`, standard labs included 5 entries (`comp`, `phys`, `chem`, `bio`, `elec`), repeatedly re-inserting `bio` and `elec` into `public.labs`.
5. **Approval State Persistence Flaw**: In `app/actions/schedules.ts` (`updateScheduleStatus`), approving a requested slot did not set `metadata.status = 'confirmed'`, leaving the request stuck in pending metadata.

---

## 3. Implementation Details

### A. Client-Side Facility-Specific Collision Defense (`session-action-modal.tsx`)
- Passed `allRoutines={routines}` in `app/(dashboard)/schedules/page.tsx`.
- Removed `!isPrimary` bypass so occupied laboratories in the selected period are strictly disabled with `• [OCCUPIED IN THIS PERIOD]`.
- Implemented facility-specific collision evaluation:
  - If Computer Lab is occupied in Monday Period 2, selecting Computer Lab triggers an inline alert banner:
    `"Selected laboratory is already occupied in Period T2 on Monday. Please choose an unoccupied laboratory or another period."`
  - The submit button is disabled while an occupied lab is selected.
  - If the teacher switches the dropdown to an unoccupied laboratory (e.g. Physics Lab), the collision warning clears immediately and the submit button is enabled.
- Awaited `onAddSession` inside `handleActionSubmit`; if the server rejects the request, the modal remains open and surfaces the server's error message.

### B. Robust Server Sync in `useRoutineState` (`hooks/use-routine-state.ts`)
- Rebuilt `requestSlotBooking` to await `createSchedule` before mutating local state.
- If `createSchedule` returns `{ error: ... }`, local state is left untouched, and the error is returned to the modal for display.
- Only upon verified server success is the requested session added to local state.

### C. Approval / Decline Workflow & Teacher Notification (`app/actions/schedules.ts`)
- Fixed `updateScheduleStatus` so that approving sets `metadata.status = 'confirmed'` and `is_skipped = false`.
- Dispatched return notifications to `public.lab_notifications` with `target_role: 'teacher'` when an administrator approves or declines a slot booking request.

### D. Purge Extraneous Labs (`public.labs`)
- Cleanly deleted `bio` (`Biology & Life Sciences Lab`) and `elec` (`Electronics & Hardware Lab`) from PostgreSQL `public.labs`.
- Updated `resetSchedulesToMaster` in `app/actions/schedules.ts` and seed scripts to strictly maintain the 3 institutional facilities:
  - `comp`: Computer Lab (48 stations)
  - `phys`: Physics Lab (38 stations)
  - `chem`: Chemistry Lab (40 stations)
- Purged legacy `bio` and `elec` mappings from `app/actions/logs.ts`, `components/dashboard/report-incident-modal.tsx`, and `lib/audit-presenter.ts`.

### E. Practical Filter Bar React Unique Keys (`practical-filter-bar.tsx`)
- Appended indices to class, subject, and teacher option keys (`key={`subj-${s.code}-${idx}`}`, `key={`cls-${c.id || c.name}-${idx}`}`, `key={`tch-${t.id}-${idx}`}`) to eliminate duplicate key collisions.

### F. Enterprise Row-Level Security (RLS) on `public.schedules` (Zero-Bypass Architecture)
- **Root Cause**: `public.schedules` had RLS enabled with only `"Privileged manage schedules"` for `authenticated` checking `is_privileged()`. Since `is_privileged()` checks `super_admin | lab_incharge | hod | admin`, approved teachers (`role = 'teacher'`) evaluated to `false`, triggering `new row violates row-level security policy for table "schedules"`.
- **Enterprise Solution (Without RLS Bypass)**:
  - Preserved strict `is_privileged()` lockdown on direct confirmed session creation, timetable reset, and administrative updates.
  - Added PostgreSQL RLS policy `"Teacher request slot booking"` (INSERT):
    - `WITH CHECK (is_privileged() OR (is_approved_staff() AND teacher_id = auth.uid() AND metadata->>'status' = 'requested'))`.
  - Added PostgreSQL RLS policy `"Teacher cancel pending slot request"` (DELETE):
    - `USING (is_privileged() OR (is_approved_staff() AND teacher_id = auth.uid() AND metadata->>'status' = 'requested'))`.
  - Added PostgreSQL RLS policy `"Teacher update own pending slot request"` (UPDATE):
    - Enforced `WITH CHECK (metadata->>'status' = 'requested')` so teachers can edit pending request parameters but cannot self-approve into `'confirmed'`.
  - Updated `schema.sql` and `supabase/schema.sql` to include all three policies.
  - In `hooks/use-routine-state.ts`, mapped `s.metadata?.status === 'requested'` to `status: 'requested'`, ensuring remote database requests display the amber `PEND` badge and dashed styling on the timetable grid.
  - Verified with simulated teacher transactions in `scripts/test-schedules-rls.mjs`:
    - Permitted valid teacher booking request.
    - Blocked direct confirmed session insertion.
    - Blocked spoofed teacher ID insertion.
    - Blocked self-approval via UPDATE.

### G. Schedule Primary Key (`id`) Dual-Layer Null Defense
- **Issue**: In `createSchedule`, `payload` omitted `id` despite `data.id` being passed into the action, causing PostgreSQL constraint violation: `null value in column "id" of relation "schedules" violates not-null constraint`.
- **Dual-Layer Fix**:
  1. In `app/actions/schedules.ts`, assigned `id: data.id || ('sess-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8))` inside the insert payload.
  2. In PostgreSQL (`public.schedules`), executed `ALTER TABLE public.schedules ALTER COLUMN id SET DEFAULT ('sess-' || gen_random_uuid()::text);` to guarantee fallback generation even under direct SQL insertions.
  3. Updated `schema.sql` and `supabase/schema.sql` schemas.

### H. Notification Panel Overhaul, Latency Elimination & Direct Slot Request Review
1. **Notification Cleanliness & Noise Elimination (`components/layout/notification-bell.tsx`)**:
   - Replaced bloated ~130px cards with clean, compact (~50-58px) modern list cards.
   - Replaced loud multi-badge tag soup (`ADMIN`, `NOTICE`, `WARNING COMP LAB`) with refined category-tinted icons (`Calendar` for slot requests, `User` for teacher registrations, `Wrench` for workstation faults, `AlertOctagon` for critical incidents).
   - Downgraded routine notifications from `'warning'`/`'critical'` to `'info'`.
   - Notification console now defaults to opening the **"New" (Unread)** tab first.
   - Added **"Clear Read"** button to wipe read notices from PostgreSQL with 1 click.
   - Added real-time sync status indicator in the drawer footer.

2. **Latency Elimination & Direct PostgreSQL Connection (`app/actions/incidents.ts` & `proxy.ts`)**:
   - Rewrote `getIncidents()` in `app/actions/incidents.ts` to query `getPgPool()` directly rather than making external HTTP REST calls to Supabase, slashing execution time from 6043ms down to ~30ms.
   - Added fast paths in `proxy.ts` for Server Actions (`next-action`) and RSC router prefetches (`purpose === 'prefetch'`), preventing concurrent network lockups and Next.js `TypeError: Failed to fetch`.
   - Restricted `profiles` queries in `proxy.ts` strictly to `/admin` and `/maintenance` routes.

3. **Direct Slot Request Review & Focus Flow (`focusSlotId`)**:
   - Extended `public.lab_notifications` with `metadata JSONB` storing `{ schedule_id, slot_id, day_key, specific_date, action_url }`.
   - Clicking "Review Slot" on a notification routes to `/schedules?focusSlotId=${scheduleId}`.
   - In `app/(dashboard)/schedules/page.tsx`:
     - Reads `focusSlotId` within `<Suspense>` wrapper.
     - Automatically computes the target week offset for the session's date and sets `weekOffset` so the timetable navigates to that exact week without requiring manual pagination.
     - Resets filters so the slot is fully visible.
   - In `app/(dashboard)/schedules/advanced-calendar.tsx`:
     - Applies an eye-catching highlight ring (`ring-4 ring-indigo-500 shadow-2xl animate-pulse`) to the focused card.
     - Auto-opens the review modal if the slot has `status === 'requested'`.
   - In `components/schedules/session-action-modal.tsx`:
     - Added an institutional **Slot Booking Review Card** at the top of the modal for requested sessions.
     - Provides Super Admin & Lab Incharge with 1-tap **"Approve Slot"** (Emerald) and **"Decline"** (Rose) actions.
     - Provides the requesting teacher with a **"Cancel Request"** button.
     - Automatically aligns `effectiveSpecificDate` when the day dropdown is changed.

4. **Timetable Period Columns Stability Invariant**:
   - Defaulted `periods` state in `hooks/use-infrastructure-state.ts` and `activeSlots` in `app/(dashboard)/schedules/advanced-calendar.tsx` to `CANONICAL_PERIOD_SLOTS` as an immediate fallback, ensuring period headers and columns are never missing during initial load.

---

## 4. Verification & Invariant Proof
- `npx tsc --noEmit` &rarr; 0 errors across entire workspace.
- Automated tests:
  - `node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/unit-domain-invariants.test.mjs tests/phase6-conflicts-and-audit.test.mjs tests/verify-empty-array-traps.test.mjs`
  - All 31 tests passed (0 failures).
- Verified `public.labs` in database now strictly holds the 3 canonical laboratories (`comp`, `chem`, `phys`).
- Live RLS security verification passed all 4 test vectors.
- Verified database default `id` generation on `public.schedules`.
- Verified notification metadata linking and direct focus navigation to `/schedules?focusSlotId=...`.

