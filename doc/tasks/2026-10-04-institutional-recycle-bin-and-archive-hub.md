# Task Log: Phase 3 — Institutional Recycle Bin & Archive Hub

> **Date**: October 4, 2026  
> **Status**: Complete  
> **Module**: Archive Management, Soft-Delete Disambiguation & Historical Audit  
> **Target Scope**: `app/actions/archive-hub.ts`, `lib/types/archive-hub.ts`, `components/admin/institutional-archive-hub.tsx`, `app/(dashboard)/admin/page.tsx`, `tests/archive-hub-and-recycle-bin.test.mjs`

---

## 1. Requirements & Operational Objectives

The user explicitly highlighted the need for a dedicated, integrated, and crystal-clear archive and recycle bin system:
> *"where is the proper system to manage view download extract and all required control system and ui for archieve datas , lets say we did archieve by deleting something then what now where do u acces them like of things, and yes sometime archieve is bing ambigious . so i recommend build clear system for that like create something soft delete or like kind of trashbin for those items which can act as recycle bin and build proper intigrated system for that with best ui as well."*

### Key Architecture & Disambiguation:
1. **Recycle Bin (Trash / Soft-Deleted Items)**:
   - Soft-deleted students (`students.is_active = false`) and archived enrollments (`student_enrollments.status = 'archived'`).
   - Displays student name, admission number, prior class, cycle, reason, archived timestamp, and recorded practical log count.
   - **1-Click Restore**: Restores the student back to active roster (`is_active = true`, `status = 'active'`). Auto-offsets roll collisions if their former roll was taken during their absence.
   - **Permanent Purge with NEB Compliance Lock**: If a student has ANY practical attendance records (`log_attendance`), permanent purge is **HARD-BLOCKED** to prevent corrupting historical logbooks and board audit compliance.
   - If 0 logs exist, allows permanent purge with "Precaution Active" safety guard.
2. **Academic Archives (Permanent Historical Cohorts)**:
   - Graduated alumni cohorts (`status = 'graduated'`) and transferred students (`status = 'transferred'`).
   - Preserved for permanent institutional audit, NEB board verification, and transcript issuance.
   - Read-only historical status with **1-Click CSV / Excel Export Engine** formatted with UTF-8 BOM for Nepali text support.
3. **System & Infrastructure Archives**:
   - Past academic years (read-only historical cycles with log count and student stats).
   - Inactive laboratories (`status = 'Inactive'`) with 1-click **Reactivate Facility** button.
   - Soft-archived incident categories with 1-click **Restore Category** button.
4. **Admin Console Integration**:
   - Integrated as a top-level station in `Admin Console -> Operations & Backup -> Recycle Bin & Archives` with telemetry count badges.
   - Cross-linked from `Curriculum -> Student Rosters & Cohorts` so users working with rosters can immediately access archived students.

---

## 2. Implementation Roadmap

- [x] Create `lib/types/archive-hub.ts` with telemetry, student, year, and infrastructure record interfaces.
- [x] Create server action module `app/actions/archive-hub.ts`:
  - `getArchiveHubTelemetryAction`
  - `getArchivedStudentsAction` (trash, graduated, transferred)
  - `getArchivedAcademicYearsAction`
  - `getArchivedInfrastructureAction`
  - `restoreStudentAction` (with roll collision auto-offset)
  - `permanentPurgeTrashAction` (with 0-log safety constraint)
  - `restoreInfrastructureItemAction`
- [x] Create modern UI component `components/admin/institutional-archive-hub.tsx`:
  - Top 4 high-density KPI cards (~76px layout)
  - Segmented sub-tabs (Recycle Bin, Graduated Alumni, Transferred Students, System Archives)
  - Client-side CSV download engine with UTF-8 BOM
  - Safety modal for permanent purge with NEB audit explanation
- [x] Integrate into `app/(dashboard)/admin/page.tsx`:
  - Add `archive-hub` sub-tab in Operations & Backup
  - Add quick link banner inside Student Rosters view
- [x] Verify with `npx tsc --noEmit` and run full automated test suite `tests/archive-hub-and-recycle-bin.test.mjs` (10/10 tests passed).

---

## 3. Automated Test Verification Summary

Command executed:
`node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/archive-hub-and-recycle-bin.test.mjs`

Results:
- **10/10 passed (100%)**
  - Subtest 1: `getArchiveHubTelemetryAction` returns valid telemetry counts.
  - Subtest 2: `getArchivedStudentsAction` returns records for trash, graduated, and transferred.
  - Subtest 3: `getArchivedAcademicYearsAction` returns past non-current cycles with counts.
  - Subtest 4: `getArchivedInfrastructureAction` returns inactive labs & archived incident categories.
  - Subtest 5: `restoreStudentAction` restores soft-deleted student to active status.
  - Subtest 6: `restoreStudentAction` auto-resolves roll collision when restoring enrollment.
  - Subtest 7: `permanentPurgeTrashAction` safely purges zero-history student from Recycle Bin.
  - Subtest 8: `restoreInfrastructureItemAction` reactivates lab facility and incident category.
  - Subtest 9: `permanentPurgeTrashAction` HARD-BLOCKS purge if student has recorded practical attendance logs.
- `npx tsc --noEmit` executed with code 0 (zero compile errors).
