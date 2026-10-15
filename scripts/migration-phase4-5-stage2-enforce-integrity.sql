-- ==============================================================================
-- PHASE 4.5 MIGRATION: STAGE 2 - ENFORCE CANONICAL INTEGRITY & NOT NULL
-- ==============================================================================
-- Invariants Enforced:
-- 1. class_subjects.academic_year_id IS NOT NULL
-- 2. schedules.class_subject_id IS NOT NULL
-- 3. practical_logs.class_subject_id IS NOT NULL
-- 4. log_attendance.enrollment_id IS NOT NULL and log_attendance.student_id IS NOT NULL
-- 5. Drop silent '2083' defaults from schedules & practical_logs
-- ==============================================================================

BEGIN;

-- 1. Enforce academic_year_id NOT NULL on class_subjects
ALTER TABLE public.class_subjects 
ALTER COLUMN academic_year_id SET NOT NULL;

-- 2. Enforce class_subject_id NOT NULL on schedules
ALTER TABLE public.schedules 
ALTER COLUMN class_subject_id SET NOT NULL;

-- 3. Enforce class_subject_id NOT NULL on practical_logs
ALTER TABLE public.practical_logs 
ALTER COLUMN class_subject_id SET NOT NULL;

-- 4. Enforce enrollment_id and student_id NOT NULL on log_attendance
ALTER TABLE public.log_attendance 
ALTER COLUMN enrollment_id SET NOT NULL,
ALTER COLUMN student_id SET NOT NULL;

-- 5. Drop silent '2083' defaults from schema
ALTER TABLE public.schedules 
ALTER COLUMN academic_year_id DROP DEFAULT;

ALTER TABLE public.practical_logs 
ALTER COLUMN academic_year_id DROP DEFAULT;

COMMIT;
