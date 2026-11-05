# Task 97: Real-Time Timetable Synchronization & Zero-Hardcoding Server-Side Calendar Injection

## 1. Context & Objectives
- **User Problem 1 (Real-time Timetable Sync)**:
  - When a subject teacher submitted a slot booking request, it required a manual page refresh on the administrator's `/schedules` timetable to appear.
  - When the administrator approved or declined the slot booking request, the teacher's `/schedules` timetable did not update automatically; reloading still displayed "Waiting for Approval" (`PEND`) because the local outbox snapshot permanently shadowed the database state.
- **User Problem 2 (Sunday Flash & Hardcoded Logic Elimination)**:
  - When reloading `/schedules`, the timetable briefly rendered Sunday with 6 columns, then detected institutional weekend recess settings and abruptly collapsed Sunday, shifting the layout to Monday–Friday.
  - When hardcoding `startDay: 'mon', sundayWeekend: true` was considered, the user rightly identified: *"what if I turn Sunday back ON?"*. If Sunday is turned back ON in PostgreSQL, any hardcoded default in client state would cause the reverse flash (hiding Sunday first, then popping it in).

---

## 2. Root Causes Identified & Remediation

### A. Real-Time Multi-Device Timetable Synchronization
1. **Missing Realtime Channel**:
   - Although `public.schedules` was enrolled in PostgreSQL's `supabase_realtime` publication, `hooks/use-routine-state.ts` only listened to BroadcastChannel and window storage events within the same browser profile.
   - **Fix**: Connected `useRoutineState` to Supabase Realtime (`supabase.channel('schedules-realtime-...').on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' })`) and introduced a high-reliability 10-second background sync heartbeat.
2. **Persistent Outbox Shadowing & Eviction Failure**:
   - `approveSlotBooking` and `rejectSlotBooking` invoked `addRoutineToOutbox(updated)`, erroneously populating `lab_pending_schedules_outbox_v1` with records that should be authoritative in the database.
   - When `loadRemoteSchedules()` executed, it unconditionally filtered out remote database sessions matching `pendingIds.has(s.id)` and substituted the local outbox `{ status: 'requested' }`, locking the teacher's UI into a permanent pending state.
   - **Fix**:
     - `requestSlotBooking`: Removed the session from outbox upon server confirmation and broadcasted `schedules` sync event.
     - `approveSlotBooking` & `rejectSlotBooking`: Removed the session ID from outbox immediately and on server confirmation, preventing local shadowing.
     - `loadRemoteSchedules`: Added automatic eviction of any local outbox items whose corresponding remote database record already reflects an updated state (`confirmed` or `skipped`).

### B. Zero-Hardcoding Architecture: Server-Side Setting Injection (RSC)
1. **RSC Server Page Architecture**:
   - Converted [`app/(dashboard)/schedules/page.tsx`](file:///d:/Projects/LMR/app/\(dashboard\)/schedules/page.tsx) into an `async` Server Component.
   - On every request, `page.tsx` executes `getInstitutionSetting<CalendarSettings>('calendar_settings')` and `getCurrentUserProfile()` directly against PostgreSQL on the server.
   - Passes `initialSettings={calendarSettings}` and `initialUser={currentUser}` directly to [`app/(dashboard)/schedules/schedules-client.tsx`](file:///d:/Projects/LMR/app/\(dashboard\)/schedules/schedules-client.tsx).
2. **Elimination of Hardcoded Bias**:
   - When Sunday is active in PostgreSQL (`sundayWeekend: false`), the server renders HTML with Sunday active.
   - When Sunday is toggled as recess in PostgreSQL (`sundayWeekend: true`), the server renders HTML with Sunday collapsed.
   - Client hydration matches the server HTML 100% on the very first frame.
   - `DEFAULT_SETTINGS` in [`hooks/use-calendar-settings.ts`](file:///d:/Projects/LMR/hooks/use-calendar-settings.ts) is strictly a fallback type guard for an empty/unseeded database.
   - Changes in `/admin` push immediately via the Supabase Realtime channel (`postgres_changes` on `institution_settings`) and revalidate the server route via `revalidatePath('/schedules')`.

---

## 3. Verification & Compliance
- **Strict TypeScript (`npx tsc --noEmit`)**: Passed with **0 errors**.
- **Automated Domain & Security Invariants**:
  - `node --env-file=.env.local --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/unit-domain-invariants.test.mjs tests/phase6-conflicts-and-audit.test.mjs tests/verify-empty-array-traps.test.mjs`
  - **31 of 31 tests passed (0 failures)**.
- **Dynamic Invariant**:
  - Toggling Sunday ON or OFF in PostgreSQL is dynamically reflected on the server and client with zero layout shifts or code modifications.
