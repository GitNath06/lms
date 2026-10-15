import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const envPath = path.resolve(process.cwd(), '.env.local')
const content = fs.readFileSync(envPath, 'utf8')
const dbUrl = content.split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=')[1].trim().replace(/^['"]|['"]$/g, '')

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

const SQL = `
-- ============================================================================
-- 1. CONTEXT-SCOPED ROW LEVEL SECURITY (RLS) HARDENING
-- ============================================================================

-- A. STUDENTS TABLE
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read students" ON public.students;
DROP POLICY IF EXISTS "read_students_scoped" ON public.students;
DROP POLICY IF EXISTS "Allow manage students" ON public.students;
DROP POLICY IF EXISTS "manage_students_privileged" ON public.students;

-- Read: Privileged users see all; Teachers see ONLY students in their assigned classes
CREATE POLICY "read_students_scoped" ON public.students
  FOR SELECT TO authenticated
  USING (
    public.is_privileged() OR
    EXISTS (
      SELECT 1 FROM public.student_enrollments se
      JOIN public.class_subjects cs ON cs.class_id = se.class_id
      WHERE se.student_id = students.id
        AND cs.teacher_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.student_enrollments se
      JOIN public.schedules s ON (s.batch_name = se.class_id OR s.batch_name IN (SELECT name FROM public.classes WHERE id = se.class_id))
      WHERE se.student_id = students.id
        AND s.teacher_id = auth.uid()
    )
  );

CREATE POLICY "manage_students_privileged" ON public.students
  FOR ALL TO authenticated
  USING ( public.is_privileged() )
  WITH CHECK ( public.is_privileged() );


-- B. STUDENT ENROLLMENTS TABLE
ALTER TABLE public.student_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read student_enrollments" ON public.student_enrollments;
DROP POLICY IF EXISTS "read_student_enrollments_scoped" ON public.student_enrollments;
DROP POLICY IF EXISTS "Allow manage student_enrollments" ON public.student_enrollments;
DROP POLICY IF EXISTS "manage_student_enrollments_privileged" ON public.student_enrollments;

CREATE POLICY "read_student_enrollments_scoped" ON public.student_enrollments
  FOR SELECT TO authenticated
  USING (
    public.is_privileged() OR
    EXISTS (
      SELECT 1 FROM public.class_subjects cs
      WHERE cs.class_id = student_enrollments.class_id
        AND cs.teacher_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.schedules s
      WHERE (s.batch_name = student_enrollments.class_id OR s.batch_name IN (SELECT name FROM public.classes WHERE id = student_enrollments.class_id))
        AND s.teacher_id = auth.uid()
    )
  );

CREATE POLICY "manage_student_enrollments_privileged" ON public.student_enrollments
  FOR ALL TO authenticated
  USING ( public.is_privileged() )
  WITH CHECK ( public.is_privileged() );


-- C. WORKSTATION SEAT PLANS TABLE
ALTER TABLE public.workstation_seat_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read workstation_seat_plans" ON public.workstation_seat_plans;
DROP POLICY IF EXISTS "read_workstation_seat_plans_scoped" ON public.workstation_seat_plans;
DROP POLICY IF EXISTS "Allow manage workstation_seat_plans" ON public.workstation_seat_plans;
DROP POLICY IF EXISTS "manage_workstation_seat_plans_scoped" ON public.workstation_seat_plans;

CREATE POLICY "read_workstation_seat_plans_scoped" ON public.workstation_seat_plans
  FOR SELECT TO authenticated
  USING (
    public.is_privileged() OR
    EXISTS (
      SELECT 1 FROM public.class_subjects cs
      WHERE cs.class_id = workstation_seat_plans.class_id
        AND cs.teacher_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.schedules s
      WHERE (s.batch_name = workstation_seat_plans.class_id OR s.batch_name IN (SELECT name FROM public.classes WHERE id = workstation_seat_plans.class_id))
        AND s.teacher_id = auth.uid()
    )
  );

CREATE POLICY "manage_workstation_seat_plans_scoped" ON public.workstation_seat_plans
  FOR ALL TO authenticated
  USING (
    public.is_privileged() OR
    EXISTS (
      SELECT 1 FROM public.class_subjects cs
      WHERE cs.class_id = workstation_seat_plans.class_id
        AND cs.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_privileged() OR
    EXISTS (
      SELECT 1 FROM public.class_subjects cs
      WHERE cs.class_id = workstation_seat_plans.class_id
        AND cs.teacher_id = auth.uid()
    )
  );


-- D. SESSION SEAT OVERRIDES TABLE
ALTER TABLE public.session_seat_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read session_seat_overrides" ON public.session_seat_overrides;
DROP POLICY IF EXISTS "read_session_seat_overrides_scoped" ON public.session_seat_overrides;
DROP POLICY IF EXISTS "Allow manage session_seat_overrides" ON public.session_seat_overrides;
DROP POLICY IF EXISTS "manage_session_seat_overrides_scoped" ON public.session_seat_overrides;

CREATE POLICY "read_session_seat_overrides_scoped" ON public.session_seat_overrides
  FOR SELECT TO authenticated
  USING (
    public.is_privileged() OR
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.schedules s
      WHERE s.id = session_seat_overrides.schedule_id
        AND s.teacher_id = auth.uid()
    )
  );

CREATE POLICY "manage_session_seat_overrides_scoped" ON public.session_seat_overrides
  FOR ALL TO authenticated
  USING (
    public.is_privileged() OR
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.schedules s
      WHERE s.id = session_seat_overrides.schedule_id
        AND s.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_privileged() OR
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.schedules s
      WHERE s.id = session_seat_overrides.schedule_id
        AND s.teacher_id = auth.uid()
    )
  );


-- E. WORKSTATION SEAT PLANS DEFERRABLE CONSTRAINTS FOR ATOMIC IN-PLACE SWAP
ALTER TABLE public.workstation_seat_plans
  DROP CONSTRAINT IF EXISTS uq_seat_plan_workstation,
  ADD CONSTRAINT uq_seat_plan_workstation UNIQUE (lab_id, academic_year_id, class_id, workstation_id) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE public.workstation_seat_plans
  DROP CONSTRAINT IF EXISTS uq_seat_plan_enrollment,
  ADD CONSTRAINT uq_seat_plan_enrollment UNIQUE (lab_id, academic_year_id, class_id, enrollment_id) DEFERRABLE INITIALLY IMMEDIATE;


-- ============================================================================
-- 2. ATOMIC POSTGRESQL STORED PROCEDURES (RPCs)
-- ============================================================================

-- Function 1: Atomic Student Creation + Enrollment (Guarantees rollback on error)
CREATE OR REPLACE FUNCTION public.create_student_with_enrollment_tx(
  p_full_name text,
  p_academic_year_id text,
  p_class_id text,
  p_roll_number int,
  p_admission_no text DEFAULT NULL,
  p_gender text DEFAULT NULL,
  p_section text DEFAULT NULL,
  p_guardian_name text DEFAULT NULL,
  p_guardian_phone text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid;
  v_enrollment_id uuid;
BEGIN
  -- 1. Validate mandatory fields
  IF p_full_name IS NULL OR trim(p_full_name) = '' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Student full name is required.';
  END IF;

  IF p_academic_year_id IS NULL OR p_class_id IS NULL OR p_roll_number IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Academic year, class, and roll number are required.';
  END IF;

  -- 2. Pre-check roll collision in target cohort
  IF EXISTS (
    SELECT 1 FROM public.student_enrollments
    WHERE academic_year_id = p_academic_year_id
      AND class_id = p_class_id
      AND roll_number = p_roll_number
  ) THEN
    RAISE EXCEPTION 'ROLL_COLLISION: Roll number % is already assigned in class % for academic year %.', p_roll_number, p_class_id, p_academic_year_id;
  END IF;

  -- 3. Resolve student identity by admission_no if provided
  IF p_admission_no IS NOT NULL AND trim(p_admission_no) <> '' THEN
    SELECT id INTO v_student_id
    FROM public.students
    WHERE admission_no = trim(p_admission_no)
    LIMIT 1;
  END IF;

  -- 4. Insert or update student person record
  IF v_student_id IS NULL THEN
    INSERT INTO public.students (
      full_name,
      admission_no,
      gender,
      guardian_name,
      guardian_phone,
      email,
      is_active
    ) VALUES (
      trim(p_full_name),
      nullif(trim(p_admission_no), ''),
      p_gender,
      nullif(trim(p_guardian_name), ''),
      nullif(trim(p_guardian_phone), ''),
      nullif(trim(p_email), ''),
      true
    )
    RETURNING id INTO v_student_id;
  ELSE
    UPDATE public.students
    SET full_name = trim(p_full_name),
        gender = coalesce(p_gender, gender),
        guardian_phone = coalesce(nullif(trim(p_guardian_phone), ''), guardian_phone)
    WHERE id = v_student_id;
  END IF;

  -- 5. Insert enrollment record
  INSERT INTO public.student_enrollments (
    academic_year_id,
    class_id,
    student_id,
    roll_number,
    section,
    status
  ) VALUES (
    p_academic_year_id,
    p_class_id,
    v_student_id,
    p_roll_number,
    nullif(trim(p_section), ''),
    'active'
  )
  RETURNING id INTO v_enrollment_id;

  RETURN jsonb_build_object(
    'student_id', v_student_id,
    'enrollment_id', v_enrollment_id
  );
END;
$$;


-- Function 2: Atomic Workstation Seat Swap (Guarantees zero data loss and zero constraint violation)
CREATE OR REPLACE FUNCTION public.swap_workstation_seat_plans_tx(
  p_lab_id text,
  p_academic_year_id text,
  p_class_id text,
  p_ws_a uuid,
  p_ws_b uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_a record;
  v_plan_b record;
BEGIN
  -- Fetch existing assignments for both workstations
  SELECT id, enrollment_id INTO v_plan_a
  FROM public.workstation_seat_plans
  WHERE lab_id = p_lab_id
    AND academic_year_id = p_academic_year_id
    AND class_id = p_class_id
    AND workstation_id = p_ws_a;

  SELECT id, enrollment_id INTO v_plan_b
  FROM public.workstation_seat_plans
  WHERE lab_id = p_lab_id
    AND academic_year_id = p_academic_year_id
    AND class_id = p_class_id
    AND workstation_id = p_ws_b;

  IF v_plan_a.id IS NULL AND v_plan_b.id IS NULL THEN
    RAISE EXCEPTION 'INVALID_SWAP: Neither workstation has an active student assignment to swap.';
  END IF;

  -- Case 1: Both workstations are assigned -> swap enrollment_ids in place!
  IF v_plan_a.id IS NOT NULL AND v_plan_b.id IS NOT NULL THEN
    -- Defer unique checks until end of statement for atomic swap
    SET CONSTRAINTS uq_seat_plan_workstation, uq_seat_plan_enrollment DEFERRED;

    -- In PostgreSQL, a single UPDATE with CASE swaps enrollment_id atomically without constraint failure
    UPDATE public.workstation_seat_plans
    SET enrollment_id = CASE
          WHEN id = v_plan_a.id THEN v_plan_b.enrollment_id
          ELSE v_plan_a.enrollment_id
        END,
        assigned_by = coalesce(p_user_id, assigned_by)
    WHERE id IN (v_plan_a.id, v_plan_b.id);

  -- Case 2: Only ws_a is assigned -> move student to empty ws_b
  ELSIF v_plan_a.id IS NOT NULL AND v_plan_b.id IS NULL THEN
    UPDATE public.workstation_seat_plans
    SET workstation_id = p_ws_b,
        assigned_by = coalesce(p_user_id, assigned_by)
    WHERE id = v_plan_a.id;

  -- Case 3: Only ws_b is assigned -> move student to empty ws_a
  ELSE
    UPDATE public.workstation_seat_plans
    SET workstation_id = p_ws_a,
        assigned_by = coalesce(p_user_id, assigned_by)
    WHERE id = v_plan_b.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'swapped_a', v_plan_a.id,
    'swapped_b', v_plan_b.id
  );
END;
$$;
`

async function main() {
  const client = await pool.connect()
  try {
    console.log('⚡ Deploying Context-Scoped RLS Policies & Atomic Database Functions...')
    await client.query(SQL)
    console.log('✅ Successfully applied hardened RLS policies and atomic RPCs!')
  } catch (err) {
    console.error('❌ Migration failed:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

main()
