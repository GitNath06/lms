# Task 63: Faculty Relational Linkage & Timetable Single Source of Truth

**Date**: 2026-10-19  
**Status**: Completed  
**Type**: Architectural Integrity, Data Relational Alignment & Defect Elimination  

---

## 1. Context & User Core Inquiry

The user observed that after deleting old prototype accounts and leaving only 3 legitimate users in `public.profiles` (`Dinanath Shah`, `Head of Department`, `System Administrator`), the timetable weekly routine page (`/schedules`) continued to display over 20 old prototype/dummy faculty names (e.g. `CRM10-Teacher`, `COMP12-Teacher`, `Dr. Prakash Adhikari`, `Er. Anish Karki`, etc.) in the "All Subject Teachers" filter dropdown.

The user asked:
> *"Why does schedule have its own teacher names, instead of directly connected to the actual teacher names? If so, what is left as the meaning of managing teacher accounts in the database?"*

---

## 2. Root Cause Analysis

1. **Database Relational Detachment in Prior Seeds**:
   - In earlier development/seeding scripts (`scripts/seed-master-schedules.mjs`), 42 routine sessions were inserted into `public.schedules`.
   - In those rows, `teacher_id` was left `NULL`, and teacher names were dumped as freeform strings into the JSON blob `metadata->>'teacher'` (e.g. `'COMP12-Teacher'`, `'Er. Anish Karki'`).
   - Although the schema defined `teacher_id uuid REFERENCES public.profiles(id)`, the actual rows lacked foreign key linkages.

2. **Frontend UI Scraped Routine Session Cards**:
   - In `app/(dashboard)/schedules/page.tsx`:
     ```typescript
     const teacherList = useMemo(() => {
       const set = new Set<string>()
       infraFaculty.forEach((f) => { if (f.name) set.add(f.name) })
       routines.forEach((r) => { if (r.teacher) set.add(r.teacher) }) // <--- DEFECT
       return Array.from(set).sort()
     }, [infraFaculty, routines])
     ```
   - Instead of deriving the dropdown strictly from approved teacher profiles (`WHERE role = 'teacher' AND approval_status = 'approved'`), the page scraped whatever string happened to be printed on any routine card on the grid.

3. **Client Hook Fallback to Stale JSON Metadata**:
   - In `hooks/use-routine-state.ts`, `loadRemoteSchedules` mapped:
     ```typescript
     teacher: s.metadata?.teacher || s.profiles?.full_name || 'Assigned Faculty'
     ```
   - Since `s.teacher_id` was `NULL`, `s.profiles` returned null, and the UI continually picked up `s.metadata.teacher`.

4. **Foreign Key Constraint Block when Deleting Class Subjects**:
   - Because 42 schedule rows were attached to `class_subjects.id`, attempting to delete a curriculum subject in `/admin` triggered:
     `violates foreign key constraint "schedules_class_subject_id_fkey" on table "schedules"`.

5. **React Duplicate Key Warning in Admin Curriculum Table**:
   - In `app/(dashboard)/admin/page.tsx:1358`, course units across different classes with the same course code (e.g. `COMP-11`) used `key={s.code}`, causing console key collision warnings.

---

## 3. Architectural Rectifications Executed

1. **Server Action Relational Resolution (`app/actions/schedules.ts`)**:
   - Joined `public.profiles` on `s.teacher_id = p.id` with role check `WHERE role = 'teacher' AND approval_status = 'approved'`.
   - Assigned `resolved_teacher_id` and `teacher_name` from live relational profiles.
   - Cleaned up fallback to return `"Unassigned Faculty"` instead of fabricating mock identities.
   - Reconnected conflict engine utility functions `getSlotRange` and `slotRangesOverlap as rangesOverlap` from `@/lib/scheduling/conflict-engine`.

2. **Purge of `metadata.teacher` Scraping (`hooks/use-routine-state.ts`)**:
   - Mapped `teacher: s.teacher_name || s.profiles?.full_name || 'Unassigned Faculty'`.
   - Added `teacherId: s.resolved_teacher_id || s.teacher_id || s.profiles?.id || null` to `MasterRoutineItem` in `lib/master-data.ts`.
   - Prevented dead cache revival: if database returns `[]`, state and `localStorage` are updated to `[]` instead of resurrecting old data.

3. **Strict Teacher List Derivation (`app/(dashboard)/schedules/page.tsx`)**:
   - Removed `routines.forEach((r) => set.add(r.teacher))` completely.
   - `teacherList` now depends exclusively on `infraFaculty` (approved teacher accounts in `public.profiles`).

4. **ID & Exact Name Filter Matching (`app/(dashboard)/schedules/advanced-calendar.tsx`)**:
   - Upgraded `my_sessions` and teacher filter dropdown to compare `item.teacherId === currentUser.id` and exact names, eliminating loose substring false positives.

5. **React Unique Key Hardening (`app/(dashboard)/admin/page.tsx`)**:
   - Upgraded grouped and flat curriculum subject table keys to `key={s.classSubjectId || `${grade}-${s.code}-${idx}`}`.

---

## 4. Verification & Validation

- `npx tsc --noEmit`: **0 errors** across all project files.
- `tests/theme-audit-compliance.test.mjs`: **0 violations**, 100% compliant.
- `tests/verify-empty-array-traps.test.mjs`: **12/12 passing**, verified zero hardcoded arrays and canonical PostgreSQL authority.
