-- Migration: Phase 4.5 Stage 1 - Add Nullable Canonical Columns & Composite Constraints
-- Description: Non-destructive, additive DDL establishing relational bridges.

BEGIN;

-- 1. class_subjects: Add academic_year_id (nullable initially for staged backfill)
ALTER TABLE public.class_subjects 
ADD COLUMN IF NOT EXISTS academic_year_id text 
REFERENCES public.academic_years(id) ON DELETE RESTRICT;

-- Replace legacy 3-column constraint with 4-column co-teaching unique constraint
DO $$ BEGIN
  ALTER TABLE public.class_subjects 
  DROP CONSTRAINT IF EXISTS class_subjects_class_id_subject_id_teacher_id_key;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.class_subjects 
  ADD CONSTRAINT uq_class_subject_teaching_assignment 
  UNIQUE (academic_year_id, class_id, subject_id, teacher_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_class_subjects_year_class 
ON public.class_subjects(academic_year_id, class_id);

-- 2. student_enrollments: Add composite unique anchor (id, student_id)
DO $$ BEGIN
  ALTER TABLE public.student_enrollments 
  ADD CONSTRAINT uq_student_enrollments_id_student 
  UNIQUE (id, student_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. log_attendance: Add enrollment_id & composite foreign key
ALTER TABLE public.log_attendance 
ADD COLUMN IF NOT EXISTS enrollment_id uuid;

DO $$ BEGIN
  ALTER TABLE public.log_attendance 
  ADD CONSTRAINT fk_log_attendance_enrollment_student 
  FOREIGN KEY (enrollment_id, student_id) 
  REFERENCES public.student_enrollments(id, student_id) 
  ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_log_attendance_enrollment 
ON public.log_attendance(enrollment_id);

-- 4. schedules: Add class_subject_id (nullable initially)
ALTER TABLE public.schedules 
ADD COLUMN IF NOT EXISTS class_subject_id text 
REFERENCES public.class_subjects(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_schedules_class_subject 
ON public.schedules(class_subject_id);

-- 5. practical_logs: Add class_subject_id (nullable initially)
ALTER TABLE public.practical_logs 
ADD COLUMN IF NOT EXISTS class_subject_id text 
REFERENCES public.class_subjects(id) ON DELETE RESTRICT;

DO $$ BEGIN
  ALTER TABLE public.practical_logs 
  ADD CONSTRAINT fk_practical_logs_schedule 
  FOREIGN KEY (schedule_id) REFERENCES public.schedules(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_practical_logs_class_subject 
ON public.practical_logs(class_subject_id);

-- 6. lab_incidents: Add relational context columns
ALTER TABLE public.lab_incidents 
ADD COLUMN IF NOT EXISTS class_id text REFERENCES public.classes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS subject_id text REFERENCES public.subjects(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS subject_teacher_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lab_incidents_class_subject 
ON public.lab_incidents(class_id, subject_id);

COMMIT;
