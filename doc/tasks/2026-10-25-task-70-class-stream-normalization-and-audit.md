# Task 70: Class & Academic Stream Normalization, Foreign Key Repair & Audit

**Date**: 2026-10-25  
**Domain**: Academic Curriculum, Class & Stream Management, Admin Console Unification  
**Status**: Completed  
**Tests Passing**: 12/12 Phase 2 Admin Unification, 5/5 Practical Form Tests, 3/3 Class & Stream Invariant Tests  

---

## 1. Problem Statement & Root Cause Analysis

### A. Non-Persistent Class Edits & Stream Foreign Key Violation
When editing academic classes (e.g. `12 Eng`) in the Admin Console:
1. **Empty Reference Table**: `public.classes.stream_id` has a foreign key constraint referencing `public.streams(id)`. However, `public.streams` was completely empty ($0$ rows). Any attempt to save a stream name like `'Computer Engineering'` failed with PostgreSQL foreign key constraint violation `classes_stream_id_fkey`.
2. **Hardcoded Fallback Masking**: In `app/(dashboard)/admin/page.tsx`, `stream: c.stream_id || 'General Science'` was hardcoded. Because `stream_id` was always `null` in `public.classes`, **every single class** displayed `'General Science'` under "ACADEMIC STREAM" in the table.
3. **Seed Data Inversion**: The original database seed had dumped the stream descriptions (`'Computer Engineering'`, `'Management'`, `'General Science'`, `'Basic Science & Computing'`) into the `section` column of `public.classes`, while leaving `stream_id` as `null`.
4. **Modal Label Ambiguity**: The "Edit Class" modal labeled the class name input as "Grade Level *" and pre-filled it with `12 Eng` (causing users to type `12`), while "Section *" was pre-filled with the stream name `Computer Engineering`.

---

## 2. Surgical Engineering Fixes

### A. Reference Table Population & Data Normalization
- **Populated `public.streams`**: Inserted canonical streams into `public.streams`:
  - `'Computer Engineering'` (`code: 'ENG'`)
  - `'Management'` (`code: 'MGT'`)
  - `'General Science'` (`code: 'SCI'`)
  - `'Basic Science & Computing'` (`code: 'BSC'`)
- **Normalized `public.classes`**:
  - `12eng`: `name: '12 Eng'`, `section: 'Eng'`, `stream_id: 'Computer Engineering'`
  - `12mgt`: `name: '12 Mgt'`, `section: 'Mgt'`, `stream_id: 'Management'`
  - `11eng`: `name: '11 Eng'`, `section: 'Eng'`, `stream_id: 'Computer Engineering'`
  - `11mgt`: `name: '11 Mgt'`, `section: 'Mgt'`, `stream_id: 'Management'`
  - `10eng`: `name: '10 Eng'`, `section: 'Eng'`, `stream_id: 'Computer Engineering'`
  - `9eng`: `name: '9 Eng'`, `section: 'Eng'`, `stream_id: 'Computer Engineering'`
  - `8a`: `name: '8A'`, `section: 'A'`, `stream_id: 'General Science'`
  - `7b`: `name: '7B'`, `section: 'B'`, `stream_id: 'General Science'`
  - `6a`: `name: '6A'`, `section: 'A'`, `stream_id: 'Basic Science & Computing'`

### B. Defensive Auto-Upsert in Server Actions (`app/actions/classes.ts`)
- In `updateClassAction` and `createClassAction`, before modifying `public.classes`, if `data.stream_id` is supplied:
  ```sql
  INSERT INTO public.streams (id, name) VALUES ($1, $1) ON CONFLICT (id) DO NOTHING;
  ```
  Guarantees that any custom stream name entered by an administrator is automatically registered in `public.streams`, permanently eliminating foreign key violation errors.

### C. Admin Console UI & Modal Refinements (`app/(dashboard)/admin/page.tsx`)
- **Dynamic Derivation**: `stream: c.stream_id || (c.section && c.section.length > 4 ? c.section : 'General Science')`
- **Table Row Formatting**: Displays `c.name` on top and the exact section value (e.g. `Eng`, `Mgt`, `A`, `B`) directly in subtext without the word "Section" prefixed. Academic Stream column displays `c.stream` directly.
- **Add / Edit Modal Labels**:
  - Field 1: "Class Name *" (`placeholder="e.g. 12 Eng or Class 12"`)
  - Field 2: "Section *" (`placeholder="e.g. Eng or A"`)
  - Field 3: "Room Quota / Max Capacity"
  - Field 4: "Academic Stream" (`placeholder="e.g. Computer Engineering, Management, General Science"`)
- **Add Class Defaults**: Replaced deceptive pre-filled dummy strings (`'Class 11'`, `'Section A'`, `'Science Stream'`) with empty strings so placeholders are shown.

---

## 3. Verification & Invariant Proofs

- `tests/class-stream-management.test.mjs`:
  - Test 1: Canonical streams present in `public.streams` (Passed).
  - Test 2: `public.classes` records have valid `stream_id` and clean `section` (Passed).
  - Test 3: Updating a class with a brand-new custom stream dynamically upserts stream and succeeds in PostgreSQL without foreign key errors (Passed).
- `tests/phase2-admin-unification.test.mjs`: 12/12 passing.
- `tests/practical-log-form-and-subject-clean.test.mjs`: 5/5 passing.
