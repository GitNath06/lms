# Task 77: Database Triggers, RLS Lockdown & Foreign Key Safety

> **Task Title**: Database Migration for Triggers, RLS Lockdown & Foreign Key Safety  
> **Status**: COMPLETED  
> **Date**: 2026-10-26  
> **Author**: AI Agent / DeepMind Advanced Agentic Coding Pair  
> **Target Files**:
> - `supabase/migrations/20261024_production_security_hardening.sql`
> - `schema.sql`
> - `supabase/schema.sql`
> - `tests/production-security-hardening.test.mjs`

---

## 1. Objectives & Institutional Context

As part of the institutional production hardening roadmap for **LabSync LIMS / LMR**, this task eliminates critical database-level vulnerabilities and data loss risks identified during the comprehensive security and architectural audit:
1. **Deduplicate & Harden `public.handle_new_user()`**: Prevent malicious signups from assigning themselves `super_admin` or `approved` status by hardcoding `role = 'teacher'` and `approval_status = 'pending'`, never trusting `raw_user_meta_data`.
2. **Expand `public.protect_profile_escalation()`**: Guard against unauthorized modification of `permissions` and `is_active` in addition to `role` and `approval_status`.
3. **Rewrite `public.sync_practical_log_attendance()`**: Optimize attendance synchronization with an update short-circuit guard, replace slow 40-iteration cursor loops with an atomic set-based `generate_series(1, effective_headcount)` upsert (`ON CONFLICT (log_id, roll_number) DO UPDATE SET is_present = EXCLUDED.is_present`), and ensure student and enrollment relationships are never wiped.
4. **Tighten RLS Policies**: Require an approved, active staff profile (`EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND approval_status = 'approved' AND is_active = true)`) for querying `public.students` and `public.student_enrollments`. Guard `public.log_attendance` mutations to privileged staff or the session teacher. Revoke `anon` SELECT access to sensitive workstation tokens (`pairing_token`, `machine_guid`).
5. **Protect Laboratory Operational History**: Prevent catastrophic cascading data loss if a laboratory facility record is deleted by changing `practical_logs_lab_id_fkey`, `lab_incidents_lab_id_fkey`, and `workstations_lab_id_fkey` from `ON DELETE CASCADE` to `ON DELETE RESTRICT`.
6. **Student Roll Number Check Constraint**: Update `student_enrollments_roll_number_check` to accommodate institutional class cohorts up to roll 250 (`CHECK (roll_number > 0 AND roll_number <= 250)`).

---

## 2. Changes Applied

### A. Migration Script (`supabase/migrations/20261024_production_security_hardening.sql`)
- Created clean, reversible SQL migration containing all trigger updates, RLS policy adjustments, foreign key alter commands, column constraint relaxations on `log_attendance` (`student_id` & `enrollment_id` nullable for ad-hoc / partial rosters), and check constraint updates.
- Executed migration directly against live PostgreSQL pool in an atomic transaction with verified success.

### B. Core Schema Synchronization (`schema.sql` & `supabase/schema.sql`)
1. **`public.handle_new_user()`**:
   - Deduplicated duplicate declarations.
   - Hardcoded `role = 'teacher'` and `approval_status = 'pending'`.
   - Omitted `department` string to preserve Rule #5.
   - Guarded `ON CONFLICT (id) DO UPDATE` to only touch safe biographical attributes (`email`, `phone`, `full_name`).
2. **`public.protect_profile_escalation()`**:
   - Expanded BEFORE UPDATE trigger check:
     ```sql
     IF (OLD.role IS DISTINCT FROM NEW.role 
         OR OLD.approval_status IS DISTINCT FROM NEW.approval_status 
         OR OLD.permissions IS DISTINCT FROM NEW.permissions 
         OR OLD.is_active IS DISTINCT FROM NEW.is_active)
     ```
3. **`public.sync_practical_log_attendance()`**:
   - Added update short-circuit:
     ```sql
     IF TG_OP = 'UPDATE' THEN
       IF OLD.absent_rolls IS NOT DISTINCT FROM NEW.absent_rolls 
          AND OLD.total_students IS NOT DISTINCT FROM NEW.total_students THEN
         RETURN NEW;
       END IF;
     END IF;
     ```
   - Replaced cursor loop with single set-based `generate_series(1, v_effective_headcount)` join with `student_enrollments`.
   - Preserves `student_id` and `enrollment_id` on conflict without deletion.
4. **Foreign Keys (Lab History Preservation)**:
   - Changed `practical_logs_lab_id_fkey`, `lab_incidents_lab_id_fkey`, and `workstations_lab_id_fkey` to `ON DELETE RESTRICT`.
5. **RLS Policies**:
   - `students`: `read_students_authenticated` checks `approval_status = 'approved' AND is_active = true`.
   - `student_enrollments`: `read_student_enrollments_authenticated` checks `approval_status = 'approved' AND is_active = true`.
   - `log_attendance`: `Allow manage log_attendance` requires `is_privileged() OR pl.teacher_id = auth.uid() OR pl.logged_by = auth.uid()`.
   - `workstations`: Revoked `SELECT (pairing_token, machine_guid)` from `anon`.
6. **Roll Number Check**:
   - Updated `student_enrollments_roll_number_check` to `CHECK (roll_number > 0 AND roll_number <= 250)`.

---

## 3. Verification & Test Execution

### 1. Integration Test Suite (`tests/production-security-hardening.test.mjs`)
- Test 1: `student_enrollments_roll_number_check` allows up to roll 250 &rarr; PASS
- Test 2: Lab foreign keys (`practical_logs`, `lab_incidents`, `workstations`) are `ON DELETE RESTRICT` &rarr; PASS
- Test 3: `handle_new_user()` hardcodes `role='teacher'` and `approval_status='pending'` &rarr; PASS
- Test 4: `protect_profile_escalation()` guards `role`, `approval_status`, `permissions`, and `is_active` &rarr; PASS
- Test 5: `sync_practical_log_attendance()` guards updates and uses set-based `generate_series` &rarr; PASS
- Test 6: RLS policies on `students` and `student_enrollments` require approved, active profile &rarr; PASS

### 2. Full Regression Suite Run
- `tests/production-security-hardening.test.mjs`
- `tests/terminal-agent-handshake.test.mjs`
- `tests/pending-user-lockdown.test.mjs`
- `tests/unit-domain-invariants.test.mjs`
**Result**: 27/27 tests passed with 0 failures.

### 3. TypeScript Compilation
- Command: `npx tsc --noEmit`
- Result: Exited with code 0 (0 errors).
