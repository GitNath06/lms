# Phase 5: Live Scenario Testing with Demo Data & End-to-End Validation

> **Date**: October 4, 2026  
> **Status**: Completed & 100% Validated (All 6 scenarios verified with real DB operations, `npx tsc --noEmit` & 0 errors)  
> **Test Harness**: `scripts/test-phase5-live-scenarios.mjs`

---

## 1. Executive Summary & Verification Outcomes

All 6 real-world user scenarios testing database operations, UI state synchronization, and deletion safety mechanisms were executed with live demo data:

| # | Operational Scenario | Test Trigger | Expected Invariant | Actual Result |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Accidental Academic Year Creation & Safe Deletion** | Created temporary cycle `2089-mistake` ("2089/90 Mistake Test Year") with 0 dependencies, then deleted it. | Clean deletion allowed; year completely purged from database. | **PASSED (100%)** |
| **2** | **Historical Academic Year Delete-Lock Protection (1000-Log Lock)** | Attempted to delete historical academic year `2083` which contains practical logs and enrollments. | Server action blocks deletion with clear error message showing exact counts (1 log, 142 enrollments, 19 seat plans, 44 timetable schedules). | **PASSED (100%)** |
| **3** | **Delete vs Archive Conflict & Institutional Recycle Bin (Trash)** | Soft-deleted demo student Dipesh Shrestha (Roll 99, 11 Eng), inspected Archive Hub, and triggered 1-click restore. | Student is NOT hard-deleted. Moved to Recycle Bin with `archive_reason: 'soft_delete'`, restored cleanly to active roster with Roll 99 intact, then purged permanently. | **PASSED (100%)** |
| **4** | **Academic Alumni Archiving vs Trash Differentiation** | Enrolled student Pooja Bhattarai (12 Eng) with `status = 'graduated'` and tested transferred status. | Graduated alumni appears in Graduation Register, transferred student appears in Transfer Register; neither appears in Trash Bin. Zero ambiguity between trash and alumni. | **PASSED (100%)** |
| **5** | **Live Admin Auto-Revalidation & Roster Sync** | Seeded student Bikram Thapa (Roll 95) and updated name and roll (Roll 96) via server actions. | Next.js server actions call `revalidatePath`, immediately returning fresh data reflecting name and roll 96 without hard browser refresh. | **PASSED (100%)** |
| **6** | **Multi-Year Practical Logbook & Audit Print Parity** | Queried practical records for `2083` vs `2084`, exported Excel, and checked filter options. | Strict isolation: 2083 logs do not leak into 2084 queries. Excel export includes `ay-2083` in filename and metadata. Year selector reflects 2084 (Active) vs 2083 (Archived). | **PASSED (100%)** |

---

## 2. Answers to User's Core Concerns

### Q1: What happens during "Delete" vs "Archive"? Where do I access them?
- **Soft Delete to Trash Bin**:
  - When an admin deletes a student from the active class roster, the student is **not permanently destroyed**.
  - The record is flagged with `is_active: false`, `archive_reason: 'soft_delete'`, and `archived_at: now()`.
  - The student immediately moves to the **Archive Hub & Recycle Bin** (`/admin` &rarr; Archive Hub &rarr; **Recycle Bin (Trash)** tab).
  - From the Recycle Bin, admins can perform **1-Click Restore** (which restores them back to their class with roll collision defense) or **Permanent Purge** (only if the student has 0 historical practical attendance logs).
- **Academic Alumni Archiving**:
  - When a student graduates (e.g. Grade 12 completion) or transfers to another school, they are archived with `status: 'graduated'` or `status: 'transferred'`.
  - They are stored in the **Graduation Register** or **Transfer Register** tabs of the Archive Hub.
  - They do **not** clutter the Trash Bin, ensuring total institutional clarity.

### Q2: What if I created an academic year mistakenly?
- **Mistaken / Empty Academic Year (0 Dependencies)**:
  - If a year was created mistakenly and has 0 classes, 0 student enrollments, and 0 practical logs, it can be safely and immediately deleted by an administrator using `deleteAcademicYearAction`.
- **Historical Year with Records (NEB 1000-Log Protection)**:
  - If an academic year has recorded practical logs or enrollments (e.g. `2083`), deletion is **strictly blocked** by both server action pre-flight validation and database foreign key `ON DELETE RESTRICT` constraints.
  - The system provides a detailed error message explaining why deletion was blocked and advises keeping the year archived.

### Q3: Why did the class and student list in the Admin Panel not update automatically before?
- Prior mutations lacked standardized cache invalidation.
- We deployed unified revalidation across `app/actions/students.ts`, `app/actions/academic-years.ts`, and `app/actions/archive-hub.ts`:
  - Every create, update, delete, archive, and restore action calls `revalidatePath('/admin')` and `revalidatePath('/admin', 'layout')`.
  - Updated data is returned directly in the action response, enabling instant client state updates without requiring a manual browser reload.

### Q4: What is the workflow for viewing, accessing, and printing previous year data?
- In `/records`, select the prior academic cycle (e.g., `2083 B.S. • Archived`) from the Academic Year dropdown.
- The table, KPI cards, and syllabus metrics instantly update to display only that historical year's logs.
- Clicking **Print** opens `/print/records?academic_year_id=2083`, displaying the official landscape A4 sheet stamped with `ACADEMIC YEAR: 2083 B.S. (2026/27 A.D.)` in the letterhead.
- Clicking **Excel** downloads an `.xlsx` workbook stamped with that year in metadata and filename.
