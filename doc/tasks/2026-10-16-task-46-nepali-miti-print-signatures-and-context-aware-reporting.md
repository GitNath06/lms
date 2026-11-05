# Task 46: Nepali Miti Date Engine, Dynamic Column Pruning, Configurable Signatures & Diagnostics Print/Export

**Date**: 2026-10-16  
**Status**: Completed & Verified  
**Priority**: High (Academic & Institutional Compliance)  
**Target Subsystems**:
- `/records` & `components/records/practical-records-table.tsx`
- `components/records/practical-filter-bar.tsx`
- `lib/nepali-date.ts`
- `components/print/print-layout.tsx`
- `app/(dashboard)/print/records/page.tsx`
- `app/(dashboard)/print/incidents/page.tsx`
- `components/maintenance/print-maintenance-view.tsx`
- `app/(dashboard)/schedules/page.tsx`
- `components/maintenance/diagnostics-triage-hub.tsx`
- `lib/exports/xlsx.ts` & `lib/exports/csv.ts`
- `lib/exports/browser-downloader.ts`

---

## 1. Problem Statement & User Discoveries

From screenshots `img1` through `img5` and user feedback:
1. **Gregorian Date Rendering in Records Table (`img1`)**:
   - Dates in the Practical Records table were displayed as raw Gregorian string `2026-10-12` instead of official Nepali Bikram Sambat (B.S.) Miti `२०८३-०६-२६`.
2. **Nepali Date Filtering Gaps (`img1` note)**:
   - User noted "miti filtering is not working i guess". Date range inputs in filter bars lacked quick Bikram Sambat presets (This Month, Last Month, Academic Year) and did not automatically apply or convert dual dates correctly.
3. **Print Layout Hydration Error (`img2`)**:
   - Next.js console threw `A tree hydrated but some attributes of the server rendered HTML didn't match the client properties` on `components/print/print-layout.tsx` due to `useState` initializing with `localStorage.getItem` during SSR.
4. **Hardcoded Signatures & Missing Seal (`img1`, `img3`)**:
   - Printouts had hardcoded 2-tier signatures without the ability to select required signatories (e.g., Subject Teacher, Lab Incharge, HOD, Principal, or None for quick paperwork) and lacked an official dotted `[ INSTITUTIONAL STAMP / SEAL ]` box.
5. **Print Layout Overflow & Orientation (`img3`, `img4`)**:
   - Incidents print was locked in landscape with excessive whitespace; Timetable schedule routine stretched awkwardly across 2 pages with Saturday/Sunday holidays split.
6. **Diagnostics Triage Hub Missing Print & Export (`img5`)**:
   - In `/maintenance`, the Diagnostics Triage Hub had search and sync controls, but zero buttons to export or print service ledgers and diagnostic reports.

---

## 2. Key Architecture & Architectural Changes

### A. Dedicated Nepali Date Engine (`lib/nepali-date.ts`)
- Implemented `adToBsDate(adDateStr: string): NepaliDateDetail` and `bsToAdDate(bsDateStr: string): string`.
- Implemented `formatToNepaliMiti(dateStr: string)` providing bilingual and Devanagari outputs (`bsFormattedNp`: `२०८३-०६-२६ (12 Oct)`).
- Implemented `getBsDatePreset('current_month' | 'last_month' | 'current_year')` providing accurate B.S. month and year boundaries for Class 11/12 academic cycles.

### B. Practical Records Table & Filter Bar Elevation
- Upgraded `components/records/practical-records-table.tsx` Date column to render official Nepali Miti `२०८३-०६-२६` in bold with Gregorian subtext.
- Upgraded `components/records/practical-filter-bar.tsx` with quick 1-click Miti presets (यस महिना, गत महिना, यस शैक्षिक सत्र) and instant auto-apply on date picker selection.

### C. Context-Aware Dynamic Column Pruning
- Integrated smart pruning in `app/(dashboard)/print/records/page.tsx`, `app/(dashboard)/print/incidents/page.tsx`, and `app/actions/records.ts`:
  - When filtered to a single facility (`lab_id !== 'all'`), the "Facility" column is pruned from tables and exports, and promoted to the official letterhead banner.
  - When filtered to a single subject (`subject_name !== 'all'`), the "Subject" column is pruned and its space reallocated to Experiment and Remarks.
  - When filtered to a single class or teacher, redundant columns are automatically pruned.

### D. Configurable 4-Tier Signatory Engine with Stamp Box
- Upgraded `components/print/print-layout.tsx`:
  - Added interactive Signatures popover allowing users to toggle any combination of:
    - Subject Teacher / Instructor
    - Laboratory In-Charge
    - Head of Department (HOD)
    - Campus Chief / Principal
    - Official Institutional Seal Box `[ STAMP ]`
  - Added 1-click presets: `All 4 + Seal`, `2-Tier (Default)`, and `None (Draft)`.
  - Added `[ STAMP ]` official seal box to the far right of the signature row.

### E. Orientation Switcher & Clean SSR Hydration
- Resolved SSR hydration mismatch by initializing `densityMode` deterministically and synchronizing with `localStorage` in `useEffect` on client mount.
- Added interactive `Landscape` vs `Portrait` toggle with dynamic `@page { size: A4 ${orientation}; }` CSS injection.

### F. Timetable Schedule Print Elevation (`app/(dashboard)/schedules/page.tsx`)
- Added `@media print` style shield:
  - Hides dashboard navigations, sidebars, and control toolbars.
  - Renders official institutional letterhead banner (`hidden print:block`).
  - Renders official 3-tier signature block and seal box (`hidden print:flex`).
  - Fits weekly timetable onto clean 1-page A4 landscape sheet.

### G. Diagnostics Triage Hub Print & Export (`components/maintenance/diagnostics-triage-hub.tsx`)
- Connected official toolbar actions:
  - `Print Logbook` &rarr; links to `/print/maintenance?lab_id=${labId}`.
  - `Excel (.xlsx)` &rarr; triggers `exportMaintenanceRecordsAction(labId, 'xlsx')`.
  - `CSV` &rarr; triggers `exportMaintenanceRecordsAction(labId, 'csv')`.
- Added `downloadBase64File` in `lib/exports/browser-downloader.ts`.

---

## 3. Verification & Compliance Evidence

1. **TypeScript Verification**:
   - `node ./node_modules/typescript/bin/tsc --noEmit` &rarr; **0 errors**.
2. **Automated Test Suites**:
   - `tests/report-spec-architecture.test.mjs` &rarr; **10/10 passing** (469ms).
   - `tests/phase6-board-exports-and-reminders.test.mjs` &rarr; **4/4 passing** (2,228ms).
3. **Browser Visual Inspection (`browser_subagent`)**:
   - Verified Nepali Miti dates in table and Miti presets on `/records`.
   - Verified orientation toggle, signature popover, date formatting, and `[ STAMP ]` box on `/print/records`.
   - Verified Print Logbook, Excel, and CSV buttons in Diagnostics Triage Hub on `/maintenance`.
4. **Critical User Rules Compliance**:
   - Strictly 0 literal `+` in button labels (all use Lucide icons with text).
   - Standardized terminology: "Attendance", "Timetable", "Logbook", "Equipment Breakage".
   - "Precaution Active" safety toggle on `/admin` kept intact.
