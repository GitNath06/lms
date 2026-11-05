-- Migration: Harden RLS policies on labs, schedules, and student PII
-- Restricts write operations to authenticated staff and protects student biographical records.

-- 1. Hardening `labs`
DROP POLICY IF EXISTS "Allow insert/update labs" ON public.labs;
DROP POLICY IF EXISTS "Allow manage labs privileged" ON public.labs;

CREATE POLICY "Allow manage labs privileged"
  ON public.labs
  FOR ALL
  TO authenticated
  USING (public.is_privileged())
  WITH CHECK (public.is_privileged());

-- 2. Hardening `schedules`
DROP POLICY IF EXISTS "Allow manage schedules" ON public.schedules;
DROP POLICY IF EXISTS "Allow manage schedules authenticated" ON public.schedules;

CREATE POLICY "Allow manage schedules authenticated"
  ON public.schedules
  FOR ALL
  TO authenticated
  USING (public.is_privileged() OR public.current_role() = 'teacher')
  WITH CHECK (public.is_privileged() OR public.current_role() = 'teacher');

-- 3. Hardening `students` (Shield PII from anonymous scrapers)
DROP POLICY IF EXISTS "read_students_scoped" ON public.students;
DROP POLICY IF EXISTS "read_students_authenticated" ON public.students;

CREATE POLICY "read_students_authenticated"
  ON public.students
  FOR SELECT
  TO authenticated
  USING (true);

-- 4. Hardening `student_enrollments` (Shield cohort rosters from anonymous scrapers)
DROP POLICY IF EXISTS "read_student_enrollments_scoped" ON public.student_enrollments;
DROP POLICY IF EXISTS "read_student_enrollments_authenticated" ON public.student_enrollments;

CREATE POLICY "read_student_enrollments_authenticated"
  ON public.student_enrollments
  FOR SELECT
  TO authenticated
  USING (true);
