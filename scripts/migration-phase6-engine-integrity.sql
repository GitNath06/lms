-- =========================================================================
-- Migration: Phase 6 Database Engine Integrity & Constraint Hardening
-- Description:
--   1. Replace ON DELETE CASCADE with ON DELETE RESTRICT on log_attendance -> student_enrollments.
--   2. Ensure uq_enrollment_roll is permanently DEFERRABLE INITIALLY DEFERRED.
--   3. Ensure log_attendance has enrollment_id uuid column and foreign key reference.
--   4. Normalize past promoted enrollments from 'archived' to 'completed'.
-- =========================================================================

BEGIN;

-- 1. Ensure enrollment_id column exists on log_attendance
ALTER TABLE public.log_attendance 
ADD COLUMN IF NOT EXISTS enrollment_id uuid;

CREATE INDEX IF NOT EXISTS idx_log_attendance_enrollment 
ON public.log_attendance(enrollment_id);

-- 2. Drop existing foreign key constraints on log_attendance for enrollment
ALTER TABLE public.log_attendance
  DROP CONSTRAINT IF EXISTS fk_log_attendance_enrollment_student,
  DROP CONSTRAINT IF EXISTS log_attendance_enrollment_id_fkey;

-- 3. Add composite foreign key with ON DELETE RESTRICT
ALTER TABLE public.log_attendance
  ADD CONSTRAINT fk_log_attendance_enrollment_student
  FOREIGN KEY (enrollment_id, student_id)
  REFERENCES public.student_enrollments(id, student_id)
  ON DELETE RESTRICT;

-- 4. Ensure uq_enrollment_roll is DEFERRABLE INITIALLY DEFERRED
ALTER TABLE public.student_enrollments
  DROP CONSTRAINT IF EXISTS uq_enrollment_roll;

ALTER TABLE public.student_enrollments
  ADD CONSTRAINT uq_enrollment_roll
  UNIQUE (academic_year_id, class_id, roll_number)
  DEFERRABLE INITIALLY DEFERRED;

-- 5. Normalize past-year promoted student enrollments from 'archived' to 'completed'
-- If a student was promoted to a subsequent academic year, their previous year record
-- is 'completed' (academic milestone reached), not 'archived' (trash/withdrawn).
UPDATE public.student_enrollments se_old
SET status = 'completed', updated_at = NOW()
WHERE se_old.status = 'archived'
  AND se_old.academic_year_id != (SELECT id FROM public.academic_years WHERE is_current = true LIMIT 1)
  AND EXISTS (
    SELECT 1 FROM public.student_enrollments se_new
    WHERE se_new.student_id = se_old.student_id
      AND se_new.academic_year_id != se_old.academic_year_id
  );

COMMIT;

