# Task 66: Notification Panel & Student Issues Real-time Repair

## 1. Context & Objective
The user identified critical operational gaps in the LabSync LIMS / LMR notification system:
1. **Teacher Incident Reports Missing in Admin/HOD/In-Charge Panels**: When a teacher account (e.g. `xygteacher`) created 3 test incident reports across minor (`hhhhhh`), moderate (`hhhhhh2`), and major critical (`hhhhhh4`) severities, zero notifications appeared on the notification panels of `super_admin`, `lab_incharge`, or `hod`. Instead, notifications only appeared for the teacher account itself.
2. **Student Terminal Issues Not Notified**: Terminal assistance requests and student-reported workstation issues (`reportStudentAssistance`, `reportSimulatedStudentIssue`, `reportWorkstationIssue`) created rows in `public.workstation_issues`, but dispatched zero notifications to `super_admin` or `lab_incharge`.
3. **Comprehensive System Notification Audit**: Inspect all system notification pathways (incident reports, HOD escalations, student terminal assistance, workstation triage, schedule slot requests, teacher registrations) to ensure guaranteed cross-role delivery in PostgreSQL and Supabase Realtime.

---

## 2. Root Cause Analysis (Forensic Findings)

### Root Cause 1: RLS Policy Violation on `public.lab_notifications`
In PostgreSQL, the `write lab notifications` policy was defined as:
```sql
CREATE POLICY "write lab notifications" ON public.lab_notifications
  AS PERMISSIVE FOR ALL TO public
  USING (is_privileged()) WITH CHECK (is_privileged());
```
Because `is_privileged()` strictly checks for `('super_admin', 'lab_incharge', 'hod', 'admin')`, when an authenticated user with role `'teacher'` submitted an incident, any Supabase client write to `lab_notifications` failed with:
`new row violates row-level security policy for table "lab_notifications"`.

### Root Cause 2: Client-Bound Supabase Client in Server Actions
In `app/actions/incidents.ts` and `app/actions/records.ts`, notification inserts were dispatched via `createServerClient()` with the caller's session cookies. When a non-privileged caller (e.g. `xygteacher`) invoked the server action, the RLS policy blocked the insert. Furthermore, the error was swallowed in a generic `try/catch` block, resulting in the incident record being created in `lab_incidents` while creating 0 notifications in `lab_notifications`.

### Root Cause 3: Client `localStorage` Fallback Hijacking
In `hooks/use-incident-state.ts`, when a teacher submitted an incident, the client optimistically generated a synthetic notification and saved it in browser `localStorage`.
In `components/layout/notification-bell.tsx`:
```tsx
const matchingInc = incidents.find(i => i.id === n.incident_id);
if (matchingInc && matchingInc.reported_by === currentUserName) return true;
```
Because of this check, the notification intended for `super_admin` or `lab_incharge` was displayed to the teacher who reported it, while zero records existed in the database for the actual intended recipients!

### Root Cause 4: Student Terminal Assistance Lacked Notification Dispatch
In `app/actions/terminal.ts` (`reportStudentAssistance`), `app/actions/terminal-simulator.ts` (`reportSimulatedStudentIssue`), and `app/actions/workstations.ts` (`reportWorkstationIssue`), student issues were successfully written to `public.workstation_issues`, but there was no code inserting rows into `public.lab_notifications`.

---

## 3. Implemented Solutions & Architecture Upgrades

### A. Database RLS Policy Migration & Realtime Publication
Executed `scripts/migrate-notifications-fix.mjs` to reform PostgreSQL security:
1. **Permissive Read Policy**:
   ```sql
   CREATE POLICY "read lab notifications" ON public.lab_notifications
     AS PERMISSIVE FOR SELECT TO public
     USING (
       is_privileged() 
       OR target_role = 'all' 
       OR target_role = 'teacher'
       OR target_role = (SELECT role FROM public.profiles WHERE id = auth.uid())
     );
   ```
2. **System & Authenticated Insert Policy**:
   ```sql
   CREATE POLICY "insert lab notifications" ON public.lab_notifications
     AS PERMISSIVE FOR INSERT TO public
     WITH CHECK (true);
   ```
3. **Self & Privileged Update Policy**:
   ```sql
   CREATE POLICY "update lab notifications" ON public.lab_notifications
     AS PERMISSIVE FOR UPDATE TO public
     USING (
       is_privileged() 
       OR target_role = 'all'
       OR target_role = (SELECT role FROM public.profiles WHERE id = auth.uid())
     )
     WITH CHECK (true);
   ```
4. **Supabase Realtime Registration**: Added `public.lab_notifications` to `supabase_realtime` publication and issued `NOTIFY pgrst, 'reload schema'`.

### B. Direct PostgreSQL Pool Dispatch (`getPgPool()`)
Refactored all notification-producing server actions to use the authoritative direct pool (`getPgPool()`) from `lib/db.ts`:
- **`app/actions/incidents.ts`**:
  - `reportIncident`: Now inserts distinct notification records for `super_admin`, `lab_incharge`, `hod` (if critical), and a confirmation notice for `teacher`.
  - `escalateIncidentToHOD`: Generates high-priority `hod` and `super_admin` alerts.
  - `updateIncidentStatus`: Generates status update notifications for the reporting teacher and administrators.
  - `getNotifications`, `markNotificationRead`, and `markAllNotificationsRead`: Implemented via direct PostgreSQL queries.
- **`app/actions/records.ts`**:
  - `reportIncidentRecord` and `updateIncidentWorkflow`: Upgraded to direct PostgreSQL pool for guaranteed atomic notification creation.
- **`app/actions/terminal.ts` & `app/actions/terminal-simulator.ts`**:
  - `reportStudentAssistance` and `reportSimulatedStudentIssue`: Now immediately generate notifications for `super_admin` (`🚨 Student Assistance: [Station]`) and `lab_incharge`.
  - `acknowledgeAssistanceRequest`: Automatically marks associated student assistance notifications as read (`is_read = true`).
- **`app/actions/workstations.ts`**:
  - `reportWorkstationIssue`: Generates alerts for `super_admin` and `lab_incharge` (and `hod` if critical).
  - `resolveWorkstationIssue`: Automatically marks associated workstation notifications as read upon resolution.
- **`app/actions/schedules.ts`**:
  - `createSchedule`: Generates slot request notifications for `super_admin` and `lab_incharge`.
  - `updateScheduleStatus`: Generates approval/rejection notifications for the requesting teacher.

### C. Client Notification Bell & Realtime Hardening
1. **Strict Role-Based Filtering**:
   - `components/layout/notification-bell.tsx` now enforces strict role visibility:
     - `super_admin`, `admin`, `lab_incharge`: See all system alerts, student issues, registrations, and incidents.
     - `hod`: Sees department notices, HOD escalations, critical incidents, and timetable alerts.
     - `teacher`: Sees exclusively `teacher` and `all` notifications (e.g. incident submission confirmation, routine approvals). Never hijacks admin/incharge alerts.
2. **Multi-Channel Realtime Subscriptions**:
   - `hooks/use-incident-state.ts` now listens to changes on `lab_notifications`, `lab_incidents`, and `workstation_issues`.
   - Added a 20-second active fallback polling interval to guarantee synchronization in offline/reconnecting environments.
3. **Notification Deep Linking**:
   - Clicking a student assistance notification navigates directly to `/computer-lab`.
   - Clicking a registration notification opens `/admin`.
   - Clicking a schedule request navigates to `/schedules`.
   - Clicking an incident notification opens the incident review drawer.

### D. Backfilled Existing Incidents
Audited and backfilled notifications in `public.lab_notifications` for the user's test incidents:
- `inc-1792421528475-1ze5` (`hhhhhh4` - `major_critical`): Backfilled for Admin, In-Charge, HOD, and Teacher.
- `inc-1792421508680-o5kq` (`hhhhhh2` - `moderate`): Backfilled for Admin, In-Charge, HOD, and Teacher.
- `inc-1792421426593-vixy` (`hhhhhh` - `minor`): Backfilled for Admin, In-Charge, and Teacher.
- `inc-1791438968259-bjn3` (`PC blackout` - `moderate`): Backfilled for Admin, In-Charge, and HOD.

---

## 4. Verification & Testing

1. **End-to-End Integration Test (`scripts/test-notifications-e2e.mjs`)**:
   - Test 1 (RLS Policies): Verified `read lab notifications` and `insert lab notifications` active on `lab_notifications`.
   - Test 2 (Realtime Publication): Verified `lab_notifications` in `supabase_realtime`.
   - Test 3 (Incident Notifications): Verified all 3 test incidents have active notifications for Admin (3), Lab In-Charge (3), HOD (2), and Teacher (3).
   - Test 4 (Student Assistance Dispatch): Verified student assistance notifications successfully dispatch to `super_admin` and `lab_incharge`.
   - Test 5 (Acknowledge & Mark Read): Verified acknowledge workflows mark notifications as read.
   - Result: **All 5 integration tests passed**.
2. **TypeScript Strict Verification**:
   - Executed `npx tsc --noEmit`.
   - Result: **0 errors**.
3. **Unit Domain Invariants & Canonical Actions**:
   - `tests/unit-domain-invariants.test.mjs`: **11/11 passed**.
   - `tests/phase1-canonical-actions.test.mjs`: **8/8 passed**.

---

## 5. Role Isolation Hardening & Unread Badge Fix

### Issue 1: Why the notification panel was always pinned at "9+"
- **Root Cause**: In [components/layout/notification-bell.tsx](file:///d:/Projects/LMR/components/layout/notification-bell.tsx), when checking `super_admin`, the condition was:
  `if (role === 'super_admin') return true`
  Because each incident creates 4 separate targeted notifications (`notif-xxx-admin`, `notif-xxx-incharge`, `notif-xxx-teacher`, `notif-xxx-hod`), Super Admin was receiving all 4 copies for every single incident. With 37 total notifications in the database, Super Admin's unread list was 30+ items. In the UI, line 300 had:
  `userUnreadCount > 9 ? '9+' : userUnreadCount`
  Which permanently displayed `9+`.
- **Solution**:
  1. Updated the filter so `super_admin` only sees notifications intended for `super_admin` or `all`.
  2. Upgraded the counter limit to `userUnreadCount > 99 ? '99+' : userUnreadCount` so users see true exact counts (e.g. 1, 2, 3, 5, 12) rather than prematurely capping at 9.

### Issue 2: Why "Mark all read" from the system account cleared notifications for other accounts
- **Root Cause**: In [app/actions/incidents.ts](file:///d:/Projects/LMR/app/actions/incidents.ts), `markAllNotificationsRead` previously had:
  `if (!role || role === 'super_admin') { await pool.query('UPDATE public.lab_notifications SET is_read = true WHERE is_read = false;') }`
  This unconditionally wiped every notification in the database to `is_read = true` across all roles (teacher, lab in-charge, and HOD included).
- **Solution**:
  1. Removed the global database wipe. Both client and server actions now strictly scope updates to the caller's role:
     ```sql
     UPDATE public.lab_notifications 
     SET is_read = true 
     WHERE is_read = false AND (target_role = $1 OR target_role = 'all');
     ```
  2. Verified with automated test suite [scripts/test-notification-role-isolation.mjs](file:///d:/Projects/LMR/scripts/test-notification-role-isolation.mjs) that when Super Admin marks all as read, Super Admin drops to 0 while Teacher (4), Lab In-Charge (4), and HOD (3) remain completely untouched and unread.

