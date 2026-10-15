# Task Log: Phase 3 — Dynamic Seating, Displaced Student Triage & Forensic Audit

> **Date**: 2026-10-05  
> **Status**: Complete  
> **Scope**: Seating Engine, Displaced Student Queue, Session Snapshots, Records Seating Chart, and Forensic Timelines  
> **Related Master Plan**: [doc/plans/2026-10-05-computer-lab-floor-plan-and-projection-elevation.md](file:///d:/Projects/LMR/doc/plans/2026-10-05-computer-lab-floor-plan-and-projection-elevation.md)  
> **Target Files**:
> - `types/database.ts`
> - `lib/types/seat-plans.ts`
> - `app/actions/seat-plans.ts`
> - `app/actions/live-session.ts`
> - `app/actions/institutional-reports.ts`
> - `components/computer-lab/computer-lab-workspace.tsx`
> - `components/computer-lab/displaced-students-queue.tsx`
> - `components/records/practical-detail-modal.tsx`
> - `components/analytics/workstation-biography-drawer.tsx`
> - `tests/phase3-seating-and-forensics.test.mjs`

---

## 1. Objectives & Deliverables

1. **Database Types & Schema Verification**:
   - `public.practical_logs.seating_snapshot jsonb` (already migrated in DB) added to TypeScript definitions in `types/database.ts`.
   - Typed interface `SeatingSnapshotEntry` and `SeatingSnapshot` defined in `lib/types/seat-plans.ts` and `types/records.ts`.
2. **Auto-Assign Strategies & Plan Reset**:
   - Enhance `autoAssignRemainingSeats` in `app/actions/seat-plans.ts` to accept `strategy: 'roll_asc' | 'alphabetical'`.
   - Add `clearAllCohortSeats` in `app/actions/seat-plans.ts` allowing Lab In-Charge/Super Admin to safely reset a cohort's plan with 1 click.
   - Add UI buttons in `components/computer-lab/computer-lab-workspace.tsx` for Roll 1..N, A–Z Names, and Clear Plan with confirmation.
3. **Displaced Student Auto-Detection & Replacement Queue**:
   - In live sessions, compute any assigned student whose workstation has active hardware/software faults (`under_repair` or `flagged` critical/high).
   - Display a prominent amber Displaced Students Alert Queue in the Live Session Cockpit:
     `⚠️ 1 Displaced Student: Kaustuv Thapa (Roll 14) from PC-14 (Under Repair) → [Quick Assign to PC-08 (Operational)]`
   - Provide 1-click temporary session seat assignment via `assignSessionSeatOverride`.
4. **Session Seating Snapshot Persistence**:
   - In `app/actions/live-session.ts` (`submitLiveSession`), automatically serialize the complete active seating configuration (station IDs, labels, student roll, name, presence status, and temporary override flag) into `seating_snapshot` column of `practical_logs`.
5. **Historical Seating Chart Viewer in Practical Records (`/records`)**:
   - In `components/records/practical-detail-modal.tsx`, render an interactive "Seating Chart Snapshot" showing who sat at which PC during that historical practical session, including absent and temporary replacement badges.
6. **Workstation Forensic Usage Timeline**:
   - In `app/actions/institutional-reports.ts` (`getWorkstationTechnicalBiography`), query `practical_logs` where `seating_snapshot` includes that workstation.
   - Render a dedicated "Session Usage Timeline" in `components/analytics/workstation-biography-drawer.tsx` showing the chronological log of which students used that computer across past practicals.
7. **Validation & Integrity**:
   - Unit/integration test suite `tests/phase3-seating-and-forensics.test.mjs`.
   - Strict TypeScript check `npx tsc --noEmit` (0 errors).

---

## 2. Execution Steps

- [x] Step 1: Update TypeScript types in `types/database.ts`, `lib/types/seat-plans.ts`, and `types/records.ts`.
- [x] Step 2: Implement Roll vs Alphabetical sorting and `clearAllCohortSeats` in `app/actions/seat-plans.ts`.
- [x] Step 3: Implement `seating_snapshot` generation and persistence in `app/actions/live-session.ts`.
- [x] Step 4: Implement forensic timeline queries in `app/actions/institutional-reports.ts` (`getWorkstationTechnicalBiography`).
- [x] Step 5: Build `DisplacedStudentsQueue` component and integrate into `components/computer-lab/computer-lab-workspace.tsx`.
- [x] Step 6: Add Seating Chart Snapshot tab/viewer to `components/records/practical-detail-modal.tsx`.
- [x] Step 7: Update `components/analytics/workstation-biography-drawer.tsx` to display session forensic timeline.
- [x] Step 8: Build and execute automated test suite `tests/phase3-seating-and-forensics.test.mjs`.
- [x] Step 9: Verify `npx tsc --noEmit` and update documentation ledger.

---

## 3. Verification & Validation Summary

- **TypeScript Compilation**: `npx tsc --noEmit` passed with **0 errors**.
- **Automated Test Results**:
  - `tests/phase3-seating-and-forensics.test.mjs`: **6/6 passed** (100% success).
    1. `Workstation Natural Alphanumeric Sort`: orders stations logically (`PC-01` .. `PC-10`, `PC-50`).
    2. `Auto-Assign Strategies`: sorts students by `roll_asc` or `alphabetical` A–Z.
    3. `Displaced Student Detection`: accurately flags students on broken/servicing stations.
    4. `Seating Snapshot Serialization`: builds complete station map with presence & override flags.
    5. `Forensic Timeline`: extracts student seating chronology for a target workstation.
    6. `Database Schema`: `public.practical_logs` has column `seating_snapshot` of type `jsonb`.
  - `tests/phase2-auto-grid-and-projector.test.mjs`: **9/9 passed**.
  - `tests/floor-plan-status-sync.test.mjs`: **6/6 passed**.
  - `tests/workstation-floor.test.mjs`: **3/3 passed**.
- **Total Tests Passing**: **24/24 passing** with 0 regressions.

