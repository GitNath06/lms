# Task 72: Practical Log Session Date Nepali (Bikram Sambat) Calendar Integration

**Date**: 2026-10-25  
**Scope**: Elimination of Native Browser Gregorian `<Input type="date">`, Full Integration of `NepaliDatePicker` with Bikram Sambat (BS) Calendar and Devanagari Miti  
**Status**: Completed  
**Verification**: Strict TypeScript (`npx tsc --noEmit`) 0 errors, Automated Test Suite (`tests/practical-log-form-and-subject-clean.test.mjs`) 8/8 passed.

---

## 1. Context & User Problem

In `/records/new` (New Practical Session Log), the user reported that clicking the **Session Date** field opened a native browser Gregorian calendar picker (October 2026, standard English weekdays) instead of the institutional Bikram Sambat (BS) Nepali calendar.
- The institutional standard across LabSync LIMS is Bikram Sambat (e.g. 2083 Kartik, Miti display in Devanagari with Gregorian dual subtext).
- Native browser `<Input type="date">` bypassed the Nepali calendar policy and showed non-Nepali Gregorian dates.

---

## 2. Key Changes Implemented

### A. Extended `NepaliDatePicker` Prop Support (`components/ui/nepali-date-picker.tsx`)
- Added `inputClassName` prop to `NepaliDatePickerProps` and wired it into the popover trigger button.
- Enables direct control of button height (`h-10`), font sizing (`text-sm font-sans`), and dynamic validation/holiday highlight borders (`border-amber-500 bg-amber-50/50`).

### B. Practical Log Form Session Date (`app/(dashboard)/records/new/log-form.tsx`)
- Completely replaced `<Input type="date">` with `<NepaliDatePicker>`.
- Displays the full Bikram Sambat date (e.g. `२०८३ कार्तिक ०९ (2026-10-25)`).
- When opened, renders the interactive Bikram Sambat calendar modal:
  - BS Year selector (2078–2090 B.S.)
  - Nepali months (Baisakh, Jestha, ..., Kartik, Chaitra)
  - Nepali day headers (`आइत`, `सोम`, `मंग`, `बुध`, `बिही`, `शुक्र`, `शनि`)
  - Devanagari day numbers with micro AD date labels beneath
  - Real-time holiday recess warning pill integration.

### C. Incident Register Date Filter (`app/(dashboard)/incidents/page.tsx`)
- Replaced the remaining native `<Input type="date">` in the incident filter bar with `<NepaliDatePicker>`.
- Purged all instances of `type="date"` from the codebase.

---

## 3. Verification & Evidence

- **Strict TypeScript**: `npx tsc --noEmit` passed with 0 compile/type errors.
- **Unit & Integration Tests**:
  - `tests/practical-log-form-and-subject-clean.test.mjs`: Subtest 7 added, all 8/8 passed.
  - Verified 0 remaining instances of `type="date"` in project tsx files.
