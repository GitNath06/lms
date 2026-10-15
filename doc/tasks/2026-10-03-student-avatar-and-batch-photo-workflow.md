# Student Visual Identity & Batch Photo Workflow Task Log

> **Date**: October 3, 2026  
> **Status**: Complete & Verified (`npx tsc --noEmit` & 40/40 tests passing)  
> **Master Plan**: [2026-10-03-student-avatar-and-batch-photo-management.md](file:///d:/Projects/LMR/doc/plans/2026-10-03-student-avatar-and-batch-photo-management.md)

---

## 1. Operational Parameters Established with User

1. **Photo Filename Standard**:
   - Institutional standard: `8_kaustuv_thapa.jpg` (or `08-kaustuv-thapa.png`, `14_aarav_sharma.jpeg`).
   - Strategy: Automated two-factor matching. Extract roll number (`8`), normalize student name (`kaustuv thapa`), cross-verify against database class roster, and auto-match with high confidence.
2. **CAD Floor Map & Workstations**:
   - Workstation nodes (`PC-01`, `PC-02`...) cleanly display the assigned student's face avatar, roll, and name.
   - Zero premature attendance halos: Outside of an active roll-call session, avoid showing speculative present/absent rings. Highlight PC hardware health (Operational vs Flagged vs Under Maintenance).
   - Future Elevation: Dedicated side-panel for displaced students whose assigned PCs are broken/under maintenance, enabling the Lab In-Charge to smoothly reassign them for that session.
3. **Roll-Call Absent Selector (`/logs/new` & Live Cockpit)**:
   - When students are toggled as absent in the roll grid, an interactive "Absent Students" tray renders below with photo avatar, roll badge, and student name, allowing instant visual verification.
4. **Class Roster Management**:
   - Avatar column added to `/admin` Class Roster table.
   - 1-click **"Batch Import Photos"** modal supporting multi-file and folder upload.
   - Individual photo snap/upload for lateral admissions.
5. **Incident Register Cleanliness**:
   - Main register table remains clutter-free with zero extra avatar noise.
   - Incident Detail Drawer displays a dedicated "Student Responsible / Involved" card with student face photo, roll, and class details.

---

## 2. Implementation Summary

1. **Database Schema & Server Actions**:
   - Added `photo_url text` to `public.students` table via atomic PostgreSQL migration.
   - Updated `types/database.ts` and `lib/types/students.ts` to include `photo_url`.
   - Created `updateStudentPhotoAction` and `batchUpdateStudentPhotosAction` in `app/actions/students.ts`.
2. **Deterministic Two-Factor Matcher & Compressor**:
   - Created `lib/student-photos/matcher.ts` with roll extraction, name tokenization, and two-factor confidence rating.
   - Created `lib/student-photos/compressor.ts` center-cropping images to 256×256 square WebP/JPEG (`< 20 KB` each).
3. **Batch Photo Import Modal**:
   - Created `components/roster/batch-photo-import-modal.tsx` with drag-and-drop multi-file upload, auto-match reconciliation matrix, and manual override dropdown.
4. **Class Roster View Integration**:
   - Updated `components/roster/class-roster-view.tsx` with circular student avatar in desktop table rows and mobile card rows.
   - Added **"Batch Photos"** toolbar button.
   - Added 1-click individual photo upload trigger when clicking any student's avatar.
5. **CAD Floor & Workstation Living LCD Nodes**:
   - Updated `components/maintenance/workstations/workstation-node.tsx` and `components/computer-lab/station-quick-popover.tsx` to display circular student face avatars without speculative attendance halos outside active logging.
6. **Roll-Call Absent Selector Tray**:
   - Updated `app/(dashboard)/records/new/log-form.tsx` to automatically load class students and display the **Marked Absent Students Tray** with face avatars and 1-tap unmark button.
7. **Incident Detail Drawer**:
   - Updated `components/records/incident-detail-drawer.tsx` to resolve involved student rolls and display their face avatars cleanly in a dedicated card.

---

## 3. Verification & Test Suite
- `npx tsc --noEmit` exited with code 0 (**0 errors**).
- All 40 integration tests passed across 5 test suites (`tests/student-photo-matcher.test.mjs`, `tests/phase4-roster-ingestion.test.mjs`, `tests/phase6-roster-clean-slate.test.mjs`, `tests/phase6-roster-lifecycle.test.mjs`, `tests/academic-year-lifecycle.test.mjs`).

