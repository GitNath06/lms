-- ============================================================================
-- Migration: 20261024_production_security_hardening.sql
-- Description: Database Migration for Triggers, RLS Lockdown & Foreign Key Safety
--
-- 1. Deduplicate & harden public.handle_new_user() (hardcode 'teacher' / 'pending')
-- 2. Expand public.protect_profile_escalation() to guard permissions & is_active
-- 3. Rewrite public.sync_practical_log_attendance() with update guard & set-based upsert
-- 4. Tighten RLS policies on students, student_enrollments, and log_attendance
-- 5. Revoke SELECT (pairing_token, machine_guid) on public.workstations from anon
-- 6. Protect Lab History: practical_logs, lab_incidents, workstations lab_id FK ON DELETE RESTRICT
-- 7. Update student_enrollments roll_number check constraint to <= 250
-- ============================================================================

-- 1. Deduplicate & Harden handle_new_user() Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    phone,
    full_name,
    role,
    approval_status,
    is_active,
    permissions
  ) VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'phone',
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'teacher',
    'pending',
    true,
    '{}'::jsonb
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    phone = coalesce(EXCLUDED.phone, public.profiles.phone),
    full_name = EXCLUDED.full_name;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Expand protect_profile_escalation() to Guard permissions and is_active
CREATE OR REPLACE FUNCTION public.protect_profile_escalation()
RETURNS TRIGGER AS $$
BEGIN
  -- Bypass check for direct database pool / superuser / service_role connections (server actions)
  IF current_user IN ('postgres', 'supabase_admin') 
     OR (current_setting('request.jwt.claim.role', true) = 'service_role') 
     OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- For authenticated client sessions (e.g. Supabase REST API), verify Super Admin role
  IF (OLD.role IS DISTINCT FROM NEW.role 
      OR OLD.approval_status IS DISTINCT FROM NEW.approval_status 
      OR OLD.permissions IS DISTINCT FROM NEW.permissions 
      OR OLD.is_active IS DISTINCT FROM NEW.is_active) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'super_admin' AND is_active = true
    ) THEN
      RAISE EXCEPTION 'Access Denied: Only Super Administrators can alter user roles, approval statuses, permissions, or active status.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Rewrite sync_practical_log_attendance() with Update Guard & Set-Based Upsert
ALTER TABLE public.log_attendance 
  ALTER COLUMN student_id DROP NOT NULL,
  ALTER COLUMN enrollment_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_practical_log_attendance()
RETURNS TRIGGER AS $$
DECLARE
  v_effective_headcount integer;
  v_academic_year_id text;
  v_class_id text;
BEGIN
  -- Optimization: On UPDATE, exit immediately if attendance inputs haven't changed
  IF TG_OP = 'UPDATE' THEN
    IF OLD.absent_rolls IS NOT DISTINCT FROM NEW.absent_rolls 
       AND OLD.total_students IS NOT DISTINCT FROM NEW.total_students THEN
      RETURN NEW;
    END IF;
  END IF;

  v_effective_headcount := COALESCE(NEW.total_students, 0);

  IF v_effective_headcount > 0 THEN
    -- Look up academic_year_id and class_id if class_subject_id is provided
    IF NEW.class_subject_id IS NOT NULL THEN
      SELECT academic_year_id, class_id 
      INTO v_academic_year_id, v_class_id
      FROM public.class_subjects
      WHERE id = NEW.class_subject_id;
    END IF;

    -- Set-based insert using generate_series(1, effective_headcount)
    INSERT INTO public.log_attendance (
      id,
      log_id,
      roll_number,
      is_present,
      student_id,
      enrollment_id,
      created_at
    )
    SELECT
      gen_random_uuid()::text,
      NEW.id,
      s.roll,
      NOT (NEW.absent_rolls IS NOT NULL AND s.roll = ANY(NEW.absent_rolls)),
      se.student_id,
      se.id AS enrollment_id,
      NOW()
    FROM generate_series(1, v_effective_headcount) AS s(roll)
    LEFT JOIN public.student_enrollments se
      ON se.academic_year_id = v_academic_year_id
     AND se.class_id = v_class_id
     AND se.roll_number = s.roll
     AND se.status = 'active'
    ON CONFLICT (log_id, roll_number) DO UPDATE SET
      is_present = EXCLUDED.is_present,
      student_id = COALESCE(public.log_attendance.student_id, EXCLUDED.student_id),
      enrollment_id = COALESCE(public.log_attendance.enrollment_id, EXCLUDED.enrollment_id);

    -- Prune any roll numbers beyond effective_headcount
    DELETE FROM public.log_attendance 
    WHERE log_id = NEW.id AND roll_number > v_effective_headcount;
  ELSE
    DELETE FROM public.log_attendance WHERE log_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Tighten RLS Policies on Students, Enrollments & Log Attendance
DROP POLICY IF EXISTS "read_students_authenticated" ON public.students;
DROP POLICY IF EXISTS "Allow read students" ON public.students;
CREATE POLICY "read_students_authenticated" ON public.students
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND approval_status = 'approved'
        AND is_active = true
    )
  );

DROP POLICY IF EXISTS "read_student_enrollments_authenticated" ON public.student_enrollments;
DROP POLICY IF EXISTS "Allow read student_enrollments" ON public.student_enrollments;
CREATE POLICY "read_student_enrollments_authenticated" ON public.student_enrollments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND approval_status = 'approved'
        AND is_active = true
    )
  );

DROP POLICY IF EXISTS "Allow manage log_attendance" ON public.log_attendance;
CREATE POLICY "Allow manage log_attendance" ON public.log_attendance
  FOR ALL
  TO authenticated
  USING (
    public.is_privileged() 
    OR EXISTS (
      SELECT 1 FROM public.practical_logs pl 
      WHERE pl.id = log_attendance.log_id 
        AND (pl.teacher_id = auth.uid() OR pl.logged_by = auth.uid())
    )
  )
  WITH CHECK (
    public.is_privileged() 
    OR EXISTS (
      SELECT 1 FROM public.practical_logs pl 
      WHERE pl.id = log_attendance.log_id 
        AND (pl.teacher_id = auth.uid() OR pl.logged_by = auth.uid())
    )
  );

-- 5. Revoke Sensitive Workstation Column Access from Anon
REVOKE SELECT (pairing_token, machine_guid) ON public.workstations FROM anon;

-- 6. Protect Lab History: Change Lab Foreign Keys to ON DELETE RESTRICT
ALTER TABLE public.practical_logs
  DROP CONSTRAINT IF EXISTS practical_logs_lab_id_fkey,
  ADD CONSTRAINT practical_logs_lab_id_fkey
    FOREIGN KEY (lab_id) REFERENCES public.labs(id) ON DELETE RESTRICT;

ALTER TABLE public.lab_incidents
  DROP CONSTRAINT IF EXISTS lab_incidents_lab_id_fkey,
  ADD CONSTRAINT lab_incidents_lab_id_fkey
    FOREIGN KEY (lab_id) REFERENCES public.labs(id) ON DELETE RESTRICT;

ALTER TABLE public.workstations
  DROP CONSTRAINT IF EXISTS workstations_lab_id_fkey,
  ADD CONSTRAINT workstations_lab_id_fkey
    FOREIGN KEY (lab_id) REFERENCES public.labs(id) ON DELETE RESTRICT;

-- 7. Update student_enrollments Roll Number Check Constraint (roll_number <= 250)
ALTER TABLE public.student_enrollments
  DROP CONSTRAINT IF EXISTS student_enrollments_roll_number_check,
  ADD CONSTRAINT student_enrollments_roll_number_check
    CHECK (roll_number > 0 AND roll_number <= 250);
