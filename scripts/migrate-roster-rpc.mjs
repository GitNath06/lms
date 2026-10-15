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
-- Phase 4: Atomic Roster Ingestion RPC Function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.commit_roster_ingestion_tx(
  p_academic_year_id text,
  p_class_id text,
  p_rows jsonb
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
  v_rolls_seen int[] := '{}';
BEGIN
  -- 1. Authorization check inside database function
  IF NOT public.is_privileged() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Administrative role required to commit roster ingestion.';
  END IF;

  -- 2. Validate parameters & structural integrity of p_rows
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

  -- 3. Iterate through all rows with strict invariant validation
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

    -- 4. Identity Resolution & Strong Identifier Conflict Guard
    v_student_id := NULL;
    v_student_id_by_reg := NULL;

    IF v_adm IS NOT NULL THEN
      SELECT id INTO v_student_id FROM public.students WHERE admission_no = v_adm LIMIT 1;
    END IF;

    IF v_reg IS NOT NULL THEN
      SELECT id INTO v_student_id_by_reg FROM public.students WHERE registration_no = v_reg LIMIT 1;
    END IF;

    -- If both identifiers are provided, verify they resolve to the exact same student
    IF v_student_id IS NOT NULL AND v_student_id_by_reg IS NOT NULL AND v_student_id <> v_student_id_by_reg THEN
      RAISE EXCEPTION 'IDENTITY_CONFLICT: Admission number % (student ID %) and registration number % (student ID %) resolve to two different students.',
        v_adm, v_student_id, v_reg, v_student_id_by_reg;
    END IF;

    -- Consolidate student identity
    IF v_student_id IS NULL THEN
      v_student_id := v_student_id_by_reg;
    END IF;

    -- 5. Create student person record if not found by strong identifiers
    IF v_student_id IS NULL THEN
      -- Auto-synthesize standard institutional admission number if omitted: ADM-[YEAR]-[CLASS]-[ROLL]
      IF v_adm IS NULL THEN
        v_adm := 'ADM-' || upper(regexp_replace(p_academic_year_id, '[^a-zA-Z0-9]', '', 'g')) || '-' || upper(regexp_replace(p_class_id, '[^a-zA-Z0-9]', '', 'g')) || '-' || lpad(v_roll::text, CASE WHEN v_roll < 100 THEN 2 ELSE 3 END, '0');
      END IF;

      INSERT INTO public.students (full_name, admission_no, registration_no, is_active)
      VALUES (v_name, v_adm, v_reg, true)
      RETURNING id INTO v_student_id;
      v_created_students := v_created_students + 1;
    ELSE
      v_matched_students := v_matched_students + 1;
    END IF;

    -- 6. Cohort Enrollment & Roll Mismatch Idempotency Guard
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
        -- Different roll -> explicit conflict error
        RAISE EXCEPTION 'ROLL_MISMATCH_CONFLICT: Student % is already enrolled with roll number %, but spreadsheet specifies roll %. Roll changes require an explicit enrollment management operation.',
          v_name, v_existing_roll, v_roll;
      END IF;
    ELSE
      -- Check if target roll number is already occupied by another student in this cohort
      IF EXISTS (
        SELECT 1 FROM public.student_enrollments
        WHERE academic_year_id = p_academic_year_id
          AND class_id = p_class_id
          AND roll_number = v_roll
      ) THEN
        RAISE EXCEPTION 'ROLL_COLLISION: Roll number % is already occupied in class % by another student.', v_roll, p_class_id;
      END IF;

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
    'processed_rows', jsonb_array_length(p_rows),
    'students_created', v_created_students,
    'students_matched', v_matched_students,
    'enrollments_created', v_created_enrollments,
    'enrollments_retained', v_retained_enrollments
  );
END;
$$;

-- Security hardening: revoke public execution and grant strictly to authenticated role
REVOKE EXECUTE ON FUNCTION public.commit_roster_ingestion_tx(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.commit_roster_ingestion_tx(text, text, jsonb) TO authenticated;
`

async function migrate() {
  console.log('Connecting to PostgreSQL database...')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    console.log('Deploying public.commit_roster_ingestion_tx...')
    await client.query(SQL)
    await client.query('COMMIT')
    console.log('✓ Successfully deployed and hardened public.commit_roster_ingestion_tx!')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Migration failed:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
