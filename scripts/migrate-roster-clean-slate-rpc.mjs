import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const envPath = path.resolve(process.cwd(), '.env.local')
const content = fs.readFileSync(envPath, 'utf8')
let dbUrl = ''
for (const line of content.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) {
    dbUrl = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '')
  }
}

if (!dbUrl) {
  console.error('DATABASE_URL not found in .env.local')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

const SQL = `
-- ============================================================================
-- Phase 6: Deferrable Roll Constraint & Clean Slate Roster Ingestion RPC
-- ============================================================================

-- 1. Make unique roll constraint deferrable so roll swaps / shifts do not fail prematurely
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'uq_enrollment_roll'
      AND table_schema = 'public'
      AND table_name = 'student_enrollments'
  ) THEN
    ALTER TABLE public.student_enrollments DROP CONSTRAINT uq_enrollment_roll;
  END IF;

  ALTER TABLE public.student_enrollments
    ADD CONSTRAINT uq_enrollment_roll
    UNIQUE (academic_year_id, class_id, roll_number)
    DEFERRABLE INITIALLY DEFERRED;
END $$;

-- 2. Drop legacy 3-parameter function signature if needed
DROP FUNCTION IF EXISTS public.commit_roster_ingestion_tx(text, text, jsonb);

-- 3. Create upgraded atomic function supporting both 'sync' and 'clean_slate'
CREATE OR REPLACE FUNCTION public.commit_roster_ingestion_tx(
  p_academic_year_id text,
  p_class_id text,
  p_rows jsonb,
  p_mode text DEFAULT 'sync'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row jsonb;
  v_student_id uuid;
  v_student_id_by_reg uuid;
  v_enrollment_id uuid;
  v_existing_enrollment_id uuid;
  v_existing_roll int;
  v_roll int;
  v_name text;
  v_adm text;
  v_reg text;
  v_created_students int := 0;
  v_matched_students int := 0;
  v_created_enrollments int := 0;
  v_retained_enrollments int := 0;
  v_updated_enrollments int := 0;
  v_rolls_seen int[] := '{}';
  v_attendance_count int := 0;
  v_sample_student_name text := '';
  v_old_student_ids uuid[] := '{}';
BEGIN
  -- 1. Authorization check inside database function
  IF NOT public.is_privileged() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Administrative role required to commit roster ingestion.';
  END IF;

  -- 2. Validate parameters & structural integrity
  IF p_academic_year_id IS NULL OR trim(p_academic_year_id) = '' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Target academic year is required.';
  END IF;

  IF p_class_id IS NULL OR trim(p_class_id) = '' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Target class is required.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.academic_years WHERE id = p_academic_year_id) THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Academic year % does not exist.', p_academic_year_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = p_class_id) THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Class % does not exist.', p_class_id;
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Roster payload must be a non-null JSON array.';
  END IF;

  IF jsonb_array_length(p_rows) = 0 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Roster payload contains zero rows.';
  END IF;

  IF p_mode NOT IN ('sync', 'clean_slate') THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Invalid ingestion mode %. Must be "sync" or "clean_slate".', p_mode;
  END IF;

  -- 3. Clean Slate Mode: Obliterate cohort dummy data IF AND ONLY IF zero practical attendance exists
  IF p_mode = 'clean_slate' THEN
    -- Check if ANY student in this cohort has attendance recorded in practical logs
    SELECT count(*), coalesce(min(s.full_name), '') INTO v_attendance_count, v_sample_student_name
    FROM public.log_attendance la
    JOIN public.student_enrollments se ON la.enrollment_id = se.id
    JOIN public.students s ON s.id = se.student_id
    WHERE se.academic_year_id = p_academic_year_id
      AND se.class_id = p_class_id;

    IF v_attendance_count > 0 THEN
      RAISE EXCEPTION 'CANNOT_WIPE_ACTIVE_HISTORY: Student "%" has % attendance record(s) in practical logs. Cannot perform clean slate replacement on a cohort with active practical history.', v_sample_student_name, v_attendance_count;
    END IF;

    -- Collect student IDs currently enrolled in this cohort
    SELECT coalesce(array_agg(DISTINCT student_id), '{}') INTO v_old_student_ids
    FROM public.student_enrollments
    WHERE academic_year_id = p_academic_year_id
      AND class_id = p_class_id;

    -- Delete workstation CAD seat plans for this cohort
    DELETE FROM public.workstation_seat_plans
    WHERE academic_year_id = p_academic_year_id
      AND class_id = p_class_id;

    -- Delete session seat overrides for this cohort
    DELETE FROM public.session_seat_overrides
    WHERE enrollment_id IN (
      SELECT id FROM public.student_enrollments
      WHERE academic_year_id = p_academic_year_id
        AND class_id = p_class_id
    );

    -- Delete student enrollments for this cohort
    DELETE FROM public.student_enrollments
    WHERE academic_year_id = p_academic_year_id
      AND class_id = p_class_id;

    -- Delete dummy students who have NO remaining enrollments, NO attendance logs, and NO incident reports
    IF v_old_student_ids IS NOT NULL AND array_length(v_old_student_ids, 1) > 0 THEN
      DELETE FROM public.students s
      WHERE s.id = ANY(v_old_student_ids)
        AND NOT EXISTS (SELECT 1 FROM public.student_enrollments se WHERE se.student_id = s.id)
        AND NOT EXISTS (SELECT 1 FROM public.log_attendance la WHERE la.student_id = s.id)
        AND NOT EXISTS (SELECT 1 FROM public.lab_incidents li WHERE li.reported_by_id = s.id);
    END IF;
  END IF;

  -- 4. Iterate through all incoming rows
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    -- Extract and sanitize row values
    v_name := trim(coalesce(v_row->>'full_name', ''));
    v_adm := nullif(trim(coalesce(v_row->>'admission_no', '')), '');
    v_reg := nullif(trim(coalesce(v_row->>'registration_no', '')), '');

    -- Check required name
    IF v_name = '' THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: Student name cannot be empty.';
    END IF;

    -- Check valid roll number
    BEGIN
      v_roll := (v_row->>'roll_number')::int;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: Invalid roll number format for student %.', v_name;
    END;

    IF v_roll IS NULL OR v_roll < 1 OR v_roll > 200 THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: Roll number % for student % is out of valid bounds (1-200).', v_roll, v_name;
    END IF;

    -- Check intra-payload duplicate roll numbers
    IF v_roll = ANY(v_rolls_seen) THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: Duplicate roll number % detected inside upload payload.', v_roll;
    END IF;
    v_rolls_seen := array_append(v_rolls_seen, v_roll);

    -- 5. Identity Resolution & Strong Identifier Conflict Guard
    v_student_id := NULL;
    v_student_id_by_reg := NULL;

    -- If admission_no was not provided, check if standard synthesized ADM already exists
    -- OR auto-synthesize standard institutional format: ADM-[YEAR]-[CLASS]-[ROLL]
    IF v_adm IS NULL THEN
      v_adm := 'ADM-' || upper(regexp_replace(p_academic_year_id, '[^a-zA-Z0-9]', '', 'g')) || '-' || upper(regexp_replace(p_class_id, '[^a-zA-Z0-9]', '', 'g')) || '-' || lpad(v_roll::text, CASE WHEN v_roll < 100 THEN 2 ELSE 3 END, '0');
    END IF;

    SELECT id INTO v_student_id FROM public.students WHERE admission_no = v_adm LIMIT 1;

    IF v_reg IS NOT NULL THEN
      SELECT id INTO v_student_id_by_reg FROM public.students WHERE registration_no = v_reg LIMIT 1;
    END IF;

    -- If both identifiers are provided, verify they resolve to the exact same student
    IF v_student_id IS NOT NULL AND v_student_id_by_reg IS NOT NULL AND v_student_id <> v_student_id_by_reg THEN
      RAISE EXCEPTION 'IDENTITY_CONFLICT: Admission number % (student ID %) and registration number % (student ID %) resolve to two different students.',
        v_adm, v_student_id, v_reg, v_student_id_by_reg;
    END IF;

    IF v_student_id IS NULL THEN
      v_student_id := v_student_id_by_reg;
    END IF;

    -- 6. Create student person record if not found
    IF v_student_id IS NULL THEN
      INSERT INTO public.students (full_name, admission_no, registration_no, is_active)
      VALUES (v_name, v_adm, v_reg, true)
      RETURNING id INTO v_student_id;
      v_created_students := v_created_students + 1;
    ELSE
      -- Existing student: keep active and update name if needed
      UPDATE public.students
      SET full_name = v_name,
          registration_no = coalesce(v_reg, registration_no),
          is_active = true
      WHERE id = v_student_id;
      v_matched_students := v_matched_students + 1;
    END IF;

    -- 7. Cohort Enrollment
    v_existing_enrollment_id := NULL;
    v_existing_roll := NULL;

    SELECT id, roll_number INTO v_existing_enrollment_id, v_existing_roll
    FROM public.student_enrollments
    WHERE academic_year_id = p_academic_year_id
      AND class_id = p_class_id
      AND student_id = v_student_id;

    IF v_existing_enrollment_id IS NOT NULL THEN
      -- Student is already enrolled in this cohort
      IF v_existing_roll = v_roll THEN
        -- Exact same roll -> idempotent retention
        v_retained_enrollments := v_retained_enrollments + 1;
      ELSE
        -- Roll updated in sync mode (deferred constraint ensures no premature collision)
        UPDATE public.student_enrollments
        SET roll_number = v_roll,
            status = 'active'
        WHERE id = v_existing_enrollment_id;
        v_updated_enrollments := v_updated_enrollments + 1;
      END IF;
    ELSE
      -- Clean insert
      INSERT INTO public.student_enrollments (
        academic_year_id,
        class_id,
        student_id,
        roll_number,
        status
      ) VALUES (
        p_academic_year_id,
        p_class_id,
        v_student_id,
        v_roll,
        'active'
      )
      RETURNING id INTO v_enrollment_id;
      v_created_enrollments := v_created_enrollments + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'mode', p_mode,
    'processed_rows', jsonb_array_length(p_rows),
    'students_created', v_created_students,
    'students_matched', v_matched_students,
    'enrollments_created', v_created_enrollments,
    'enrollments_retained', v_retained_enrollments,
    'enrollments_updated', v_updated_enrollments
  );
END;
$$;

-- 4. Permissions
REVOKE EXECUTE ON FUNCTION public.commit_roster_ingestion_tx(text, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.commit_roster_ingestion_tx(text, text, jsonb, text) TO authenticated;
`

async function run() {
  const client = await pool.connect()
  try {
    console.log('Deploying Clean Slate & Deferrable Roll Ingestion RPC...')
    await client.query(SQL)
    console.log('✓ Successfully deployed commit_roster_ingestion_tx and deferrable uq_enrollment_roll!')
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
