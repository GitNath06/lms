# Task 88: Class Roster Decontamination, 10 C vs 12 C Relational Isolation & Hardcoded Fallback Purge

**Date**: 2026-10-28  
**Category**: Data Integrity, Relational Database Consistency & Clean Architecture  
**Target Files**:
- `components/admin/routine-manager.tsx`
- `app/(dashboard)/computer-lab/page.tsx`
- `app/actions/logs.ts`
- `components/dashboard/report-incident-modal.tsx`
- `doc/tasks/README.md`

---

## 1. Forensic Root Cause & Investigation Summary

The user reported that on `http://localhost:3000/computer-lab`, during the active `DBMS-10` practical session for Class 10 C:
- Workstations PC-01 to PC-27 (22 Desks) were displaying Class 12 C students with photos (Aasbin Aryal R-1 to Swopnil Rawat R-22).
- Workstations PC-28 to PC-48 were displaying Class 10 C students starting from Roll 23 (Pramisha Kandel R-23 to Terina Gurung R-41).
- The triage bar reported Roll 36 and Roll 40 as unseated.

### Forensic Investigation:
1. **Audit Ledger Discovery**:
   - On **October 3, 2026 at 10:34 AM** (`audit_logs` record `2083-10eng`), a bulk CSV containing 41 student rows was ingested into `10eng`. In that spreadsheet, rows 1 to 22 were Aasbin Aryal through Swopnil Rawat (`ADM-2083-0107` to `ADM-2083-0128`), and rows 23 to 41 were Pramisha Kandel through Terina Gurung (`ADM-2083-0129` to `ADM-2083-0147`).
   - On **October 27, 2026 at 3:57 PM** (`audit_logs` record `5c4768e8`), the official roster for **Class 12 C** (`12eng`) was ingested with 22 students (Aasbin Aryal through Swopnil Rawat). The importer matched these 22 students and created active enrollments in `12eng`.
   - However, they were never unenrolled from `10eng`, leaving them enrolled simultaneously in both Class 10 C and Class 12 C.
   - When `getLiveSessionContext` queried `student_enrollments` for `10eng`, it retrieved all 41 records, and `workstation_seat_plans` for `10eng` placed the 22 Class 12 students onto PC-01..PC-27 and pushed the 19 Class 10 students to PC-28..PC-48.

---

## 2. Actions Implemented

### A. Atomic Database Roster Decontamination
1. **Removed Class 12 Duplicates from 10eng**:
   - Cleaned `public.session_seat_overrides` and `public.workstation_seat_plans` for `10eng` that referenced the 22 Class 12 students.
   - Deleted the 22 duplicate `public.student_enrollments` records where `class_id = '10eng'`.
2. **Re-Aligned Genuine Class 10 C Rolls**:
   - Re-indexed the 19 genuine Class 10 students (Pramisha Kandel through Terina Gurung) from Rolls 23..41 to official **Rolls 1 to 19**.
3. **Re-Assigned Workstation Seating**:
   - Assigned the 19 genuine Class 10 students sequentially to PC-01 through PC-20 (accounting for inactive PC-09 podium).
   - Eliminated triage overflow (0 unseated students).
4. **Verified Class 12 C Integrity**:
   - Confirmed Class 12 C (`12eng`) remains untouched with its 22 enrolled students and independent seating plan.
5. **Logged Audit Record**:
   - Recorded structured audit log entry in `public.audit_logs` documenting the decontamination.

### B. Surgical Purge of Hardcoded `'12 Eng'` Fallbacks
Purged hardcoded `'12 Eng'` strings across the application:
1. `components/admin/routine-manager.tsx`:
   - Replaced `initialGrade = dbClasses[0]?.name || '12 Eng'` with dynamic `dbClasses[0]?.name || ''`.
   - Replaced hardcoded fallback subjects `'COMP-12'`, `'Data Structures & Algorithms Lab'`, and teacher `'Er. Anish Karki'` with dynamic database values.
2. `app/(dashboard)/computer-lab/page.tsx`:
   - Replaced fallback `batchName: cs.classes?.name || s.batch_name || 'Class 12 Eng'` with `cs.classes?.name || s.batch_name || ''`.
3. `app/actions/logs.ts`:
   - Replaced fallback `batch_group: ... || '12 Eng'` with `... || ''`.
4. `components/dashboard/report-incident-modal.tsx`:
   - Replaced fallback `batchName: availableClasses[0]?.name || '12 Eng'` with `availableClasses[0]?.name || ''`.

---

## 3. Verification & Evidence
- `npx tsc --noEmit` &rarr; **0 errors**.
- `node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/unit-domain-invariants.test.mjs` &rarr; **12/12 passing** (100% pass).
- `node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/phase6-conflicts-and-audit.test.mjs` &rarr; **8/8 passing** (100% pass).
- `/computer-lab` DBMS-10 Live Cockpit displays strictly the 19 genuine Class 10 students on PC-01..PC-20 with 0 triage unseated students.

