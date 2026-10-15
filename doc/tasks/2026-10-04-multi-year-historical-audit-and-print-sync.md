# Phase 4: Multi-Year Historical Audit & Print Synchronization

> **Date**: October 4, 2026  
> **Status**: Completed & Verified (`npx tsc --noEmit` & 6/6 tests passed)  
> **Modules**: 
> - Practical Records Hub (`app/(dashboard)/records/page.tsx`, `components/records/practical-filter-bar.tsx`, `components/records/practical-records-table.tsx`)
> - Records Backend & RPC Server Actions (`app/actions/records.ts`)
> - Print Engine & Letterhead Stamping (`app/(dashboard)/print/records/page.tsx`, `components/print/print-layout.tsx`)
> - Report Specification & Filter Codec (`lib/report-spec/filter-codec.ts`, `types/records.ts`, `types/report-spec.ts`)
> - Export Engines (`lib/exports/xlsx.ts`, `lib/exports/csv.ts`)

---

## 1. Problem Statement & Operational Context

In laboratory management, schools operate on an active, moving academic year (e.g. `2083/84` B.S.). However, administrative and audit workflows frequently require:
1. **Historical Compliance Audits**: Department heads, campus principals, and external NEB (National Examination Board) inspectors inspecting practical logs from prior academic cycles (e.g. `2082/83` B.S. or earlier).
2. **Decoupled Audit vs Operational State**: The school must be able to audit and print historical records without accidentally switching or altering the school's live active operational cycle.
3. **Certified Letterhead Stamping**: Government inspection sheets printed via `/print/records` must be stamped with the exact academic cycle audited (e.g., `ACADEMIC YEAR: 2082/83 (B.S.)`), rather than a static default.
4. **Data Integrity & Protection**: Historical records must be linked via foreign key to `public.academic_years(id)` with `ON DELETE RESTRICT` constraints to prevent accidental log loss.

Prior to Phase 4, the Academic Year dropdown in `/records` was an unconnected local mock state (`useState('2081-82')`) with hardcoded choices that were not sent to server actions or URL query parameters, and print sheets only rendered a static fallback year.

---

## 2. Technical Architecture & Implementation Summary

### A. Database-Driven Academic Year Selector (`components/records/practical-filter-bar.tsx`)
- Replaced hardcoded local state with live database-backed `academicYears` retrieved from `public.academic_years`.
- Supports semantic labels:
  - `{cycle.name} • Active` for the active institutional cycle.
  - `{cycle.name} • Archived` for historical cycles.
  - `All Academic Cycles` for consolidated institutional audits.
- Controlled state bound directly to `draftFilters.academic_year_id`.

### B. Server Action Decoupling (`app/actions/records.ts`)
- `getPracticalRecords(filters, groupBy)`:
  - Dynamically extracts `filters.academic_year_id`.
  - Filters `public.practical_logs` on `academic_year_id` when specified (`academic_year_id !== 'all'`).
  - Joins `academic_years:academic_year_id (id, name, is_current)` in both Supabase RPC queries and direct PostgreSQL connection pool fallbacks (`getPgPool()`).
  - Returns `academicYears` list and `activeAcademicYearId` to caller for zero-latency client state synchronization.
  - Added new exported server action: `getAcademicYearsForFilterAction()`.

### C. URL Serialization & Deep-Linking (`lib/report-spec/filter-codec.ts`)
- `filtersToSearchParams`: Serializes `academic_year_id` into URL query parameters (`?academic_year_id=2083`).
- `searchParamsToFilters`: Parses `academic_year_id` from query string, with backward compatibility for legacy alias `?year=2083`.
- Allows bookmarking, browser back/forward, and seamless opening into `/print/records?academic_year_id=2083`.

### D. Official Letterhead Stamping & Print Layout (`app/(dashboard)/print/records/page.tsx`)
- Extracts `academicYearId` from search parameters.
- Resolves official academic cycle label (e.g. `2083/84 (B.S.)`).
- Stamped onto `<PrintLayout>`:
  - `headerAcademicYear={headerAcademicYear}`
  - `headerFacilityName={labDisplayName}`
  - Dynamic `documentTitleBadge`:
    - Specific cycle: `OFFICIAL PRACTICAL EXPERIMENT & ATTENDANCE AUDIT REGISTER (ACADEMIC YEAR 2083/84 (B.S.))`
    - Consolidated: `OFFICIAL PRACTICAL EXPERIMENT & ATTENDANCE AUDIT REGISTER (CONSOLIDATED AUDIT)`

### E. Excel & CSV Export Year Decoupling (`app/actions/records.ts`, `lib/exports/xlsx.ts`)
- `exportPracticalRecordsAction` resolves the target academic year name and passes `academicYear` to `generatePracticalRecordsXlsxBuffer` and `generatePracticalRecordsCsv`.
- Workbook banner row 2: `${INSTITUTION_CONFIG.department} • Academic Year: ${resolvedYearName}`.
- Export filename reflects target year: `practical-records_ay-2083_all-labs_detailed_2026-10-04.xlsx`.

---

## 3. Verification & Automated Test Coverage

The automated test suite in `tests/phase4-multi-year-audit-and-print.test.mjs` verifies:
1. `getAcademicYearsForFilterAction`: Retrieves active & archived cycles with current cycle identification.
2. `filter-codec`: Bidirectional search param conversion preserving `academic_year_id` and legacy `year` alias.
3. `getPracticalRecords`: Scopes queries, metrics, and records to requested academic year.
4. `exportPracticalRecordsAction`: Excel and CSV exports include year metadata in banner and filename.
5. Foreign Key Protection Invariant: Confirms `practical_logs.academic_year_id REFERENCES academic_years(id) ON DELETE RESTRICT`.

All 6 test cases passed:
```
✔ 1. getAcademicYearsForFilterAction: Returns live academic cycles
✔ 2. Filter Codec: Bidirectional URL search params preserve academic_year_id
✔ 3. getPracticalRecords: Scopes queries and metrics to specified academic year
✔ 4. exportPracticalRecordsAction: Excel and CSV exports include year metadata
✔ 5. Foreign Key Protection Invariant: practical_logs reference academic_years
```
