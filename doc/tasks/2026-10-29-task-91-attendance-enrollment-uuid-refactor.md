# Task 91: Live Session Attendance Enrollment UUID Refactoring & Dual-Index Defense

**Date**: 2026-10-29  
**Category**: Live Session Cockpit, Student Attendance Architecture & Type Safety  
**Target Files**:
- `app/actions/live-session.ts`
- `components/computer-lab/computer-lab-workspace.tsx`
- `components/computer-lab/station-quick-popover.tsx`
- `components/maintenance/workstations/workstation-issue-drawer.tsx`
- `components/computer-lab/mobile-bench-rollcall-view.tsx`
- `components/computer-lab/projector-view.tsx`
- `components/maintenance/workstations/workstation-node.tsx`
- `doc/tasks/README.md`

---

## 1. Problem & Architectural Rationale

Previously, the live roll-call attendance map in `components/computer-lab/computer-lab-workspace.tsx` was typed as:
```ts
const [sessionAttendance, setSessionAttendance] = useState<Record<number, boolean>>({})
```
where keys were integer roll numbers (`1`, `2`, `3`...).

### Architectural Risks of Integer Roll-Number Keying:
1. **Collisions Across Mixed Rosters / Cohorts**:
   If an ad-hoc or merged session involved students from different classes who shared the same roll number (e.g. Roll 5 in Class 10 C vs Roll 5 in Class 12 C), toggling attendance for one would erroneously mutate the other.
2. **Loss of Relational Referential Integrity**:
   In PostgreSQL, attendance records (`public.log_attendance`) and seat allocations (`public.workstation_seat_plans`) are relationally identified by `enrollment_id` (UUID) or `student_id` (UUID). Keying client-side state solely by integer roll numbers decoupled the frontend live session cockpit from the immutable database keys.
3. **Fragile Overrides & Displaced Students Handling**:
   When students were temporarily relocated (Tier 2 session seat override) or unseated, workstation nodes and drawer components had to hunt by `rollNumber` rather than passing the authoritative `enrollmentId`.

---

## 2. Actions Implemented

### A. Dual-Indexed Server Attendance Contract (`app/actions/live-session.ts`)
1. **Upgraded `LiveSessionContext`**:
   ```ts
   existingAttendance?: Record<string | number, boolean>
   ```
2. **Dual-Index Population in `getLiveSessionContext`**:
   When loading attendance rows from `public.log_attendance` for an existing practical log, rows are now indexed by **both** `enrollment_id` and `roll_number`:
   ```ts
   const { data: attRows } = await (supabase
     .from('log_attendance') as any)
     .select('roll_number, is_present, enrollment_id')
     .eq('log_id', existingLogData.id)

   if (attRows) {
     existingAttendance = {}
     for (const row of attRows as any[]) {
       if (row.enrollment_id) existingAttendance[row.enrollment_id] = row.is_present
       if (row.roll_number !== null && row.roll_number !== undefined) {
         existingAttendance[row.roll_number] = row.is_present
       }
     }
   }
   ```
   This provides complete backwards compatibility while allowing all consumers to query by enrollment UUID as their primary key.

### B. Workspace Live Attendance State Refactoring (`components/computer-lab/computer-lab-workspace.tsx`)
1. **State Definition**:
   Changed from `Record<number, boolean>` to `Record<string, boolean>`:
   ```ts
   const [sessionAttendance, setSessionAttendance] = useState<Record<string, boolean>>({})
   ```
2. **Dual-Lookup Getter Utility**:
   Throughout all computed memos and filters, attendance presence is safely evaluated via dual-lookup:
   ```ts
   const isPres =
     sessionAttendance[student.enrollmentId] ??
     (sessionAttendance[student.rollNumber] !== undefined ? sessionAttendance[student.rollNumber] : true)
   ```
   This pattern was implemented across:
   - `liveAbsentRolls` (CAD absent rolls calculation for practical logs)
   - `currentSeatingSnapshot` (48-station universal snapshot generation)
   - `livePresentCount` (present counter in Live Cockpit HUD)
   - `displacedStudents` (triage queue exclusion for absent students)
   - `availableRelocationStations` (operational stations vacated by absent students)
   - `activeDrawerWorkstation` (workstation triage drawer presence state)
   - `CanvasMinimapRadar` & `renderedWorkstations.map` (green glowing attendance rings)
   - `handleSubmitSession` (payload mapper using `s.enrollmentId`)
3. **Flexible Action Handlers (`identifier: string | number`)**:
   - `handleToggleRollPresence`: Accepts `identifier: string | number`. Resolves student by `enrollmentId`, `studentId`, or `rollNumber`, then updates state keyed by `enrollmentId`.
   - `handleMarkAllPresent`: Keys all students in `expectedRoster` by `s.enrollmentId = true`.
   - `handleInvertAttendance`: Inverts marks for each enrolled student keyed by `s.enrollmentId`.
   - `MobileBenchRollcallView`: Replaced inline anonymous closures with direct bindings to `handleToggleRollPresence`, `handleMarkAllPresent`, and `handleInvertAttendance`.

### C. Component Prop Modernization
1. **`station-quick-popover.tsx`**:
   - Updated `onTogglePresence?: (identifier: string | number) => void`.
   - Updated `session_override` type definition to include `enrollment_id?: string | null`.
   - Passes `studentIdentifier = enrollmentId || rollNumber` to `onTogglePresence`.
2. **`workstation-issue-drawer.tsx`**:
   - Updated `onTogglePresence?: (identifier: string | number) => void`.
   - Resolves `studentIdentifier = enrollmentId || rollNumber` and passes it on toggle.
3. **`mobile-bench-rollcall-view.tsx`**:
   - Upgraded props: `sessionAttendance: Record<string, boolean>` and `onToggleAttendance: (identifier: string | number) => void`.
   - Evaluates presence using dual-lookup: `enrollmentId ? sessionAttendance[enrollmentId] ?? (sessionAttendance[rollNumber] ?? true) : ...`.
   - Passes `enrollmentId || rollNumber` on avatar/card tap.
4. **`projector-view.tsx`**:
   - Upgraded attendance check to dual-lookup:
     ```ts
     isPresent =
       sessionContext.existingAttendance?.[liveAssigned.enrollmentId] ??
       (sessionContext.existingAttendance?.[liveAssigned.rollNumber] !== false)
     ```
5. **`workstation-node.tsx`**:
   - Restored distinct `TEMP` badge for temporarily relocated students (`isTemporary && !isTeacher && !isStandby`) with top-right positioning (`absolute top-0.5 right-0.5`).

---

## 3. Verification & Test Evidence

1. **Strict TypeScript Compilation**:
   - Command: `npx tsc --noEmit`
   - Result: **0 errors** (clean build).
2. **Unit Domain Invariants**:
   - Command: `node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/unit-domain-invariants.test.mjs`
   - Result: **12 / 12 passing** (100%).
3. **Phase 6 Conflicts & Audit Suite**:
   - Command: `node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/phase6-conflicts-and-audit.test.mjs`
   - Result: **8 / 8 passing** (100%).
4. **Temporary Relocation & Terminal Gateway Suite**:
   - Command: `node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/temporary-relocation-and-terminal.test.mjs`
   - Result: **7 / 7 passing** (100%).

