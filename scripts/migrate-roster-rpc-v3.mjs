import pg from 'pg'
import fs from 'node:fs'
import path from 'node:path'

const envPath = path.resolve(process.cwd(), '.env.local')
const content = fs.readFileSync(envPath, 'utf8')
let dbUrl = ''
for (const line of content.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) {
    dbUrl = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '')
  }
}

if (!dbUrl) {
  console.error('DATABASE_URL not found')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

const sql = `
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
  v_name text;
  v_adm text;
  v_reg text;
  v_roll int;
  v_student_id uuid;
  v_student_id_by_reg uuid;
  v_action text;
  v_enrollment_id uuid;
  v_existing_enrollment_id uuid;
  v_existing_roll int;
  v_rolls_seen int[] := '{}';
  v_created_students int := 0;
  v_matched_students int := 0;
  v_created_enrollments int := 0;
  v_retained_enrollments int := 0;
  v_updated_enrollments int := 0;
  v_old_student_ids uuid[];
  v_attendance_count int := 0;
  v_sample_student_name text := '';
  v_old_enrollment_id uuid;
  v_old_occ_student_id uuid;
  v_old_log_count int;
  v_shift_roll int;
BEGIN
  -- 1. Pre-validation checks
  IF p_academic_year_id IS NULL OR p_class_id IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Academic year and class ID are required.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.academic_years WHERE id = p_academic_year_id) THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Academic year % does not exist.', p_academic_year_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = p_class_id) THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Class % does not exist.', p_class_id;
  END IF;

  IF jsonb_array_length(p_rows) = 0 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Cannot ingest empty roster payload.';
  END IF;

  IF p_mode NOT IN ('sync', 'clean_slate') THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Invalid ingestion mode %. Must be "sync" or "clean_slate".', p_mode;
  END IF;

  -- 2. Clean Slate Mode: Obliterate cohort dummy data IF AND ONLY IF zero practical attendance exists
  IF p_mode = 'clean_slate' THEN
    SELECT count(*), coalesce(min(s.full_name), '') INTO v_attendance_count, v_sample_student_name
    FROM public.log_attendance la
    JOIN public.student_enrollments se ON la.enrollment_id = se.id
    JOIN public.students s ON s.id = se.student_id
    WHERE se.academic_year_id = p_academic_year_id
      AND se.class_id = p_class_id;

    IF v_attendance_count > 0 THEN
      RAISE EXCEPTION 'CANNOT_WIPE_ACTIVE_HISTORY: Student "%" has % attendance record(s) in practical logs. Cannot perform clean slate replacement on a cohort with active practical history.', v_sample_student_name, v_attendance_count;
    END IF;

    SELECT coalesce(array_agg(DISTINCT student_id), '{}') INTO v_old_student_ids
    FROM public.student_enrollments
    WHERE academic_year_id = p_academic_year_id
      AND class_id = p_class_id;

    DELETE FROM public.workstation_seat_plans
    WHERE academic_year_id = p_academic_year_id
      AND class_id = p_class_id;

    DELETE FROM public.session_seat_overrides
    WHERE enrollment_id IN (
      SELECT id FROM public.student_enrollments
      WHERE academic_year_id = p_academic_year_id
        AND class_id = p_class_id
    );

    DELETE FROM public.student_enrollments
    WHERE academic_year_id = p_academic_year_id
      AND class_id = p_class_id;

    IF v_old_student_ids IS NOT NULL AND array_length(v_old_student_ids, 1) > 0 THEN
      DELETE FROM public.students s
      WHERE s.id = ANY(v_old_student_ids)
        AND NOT EXISTS (SELECT 1 FROM public.student_enrollments se WHERE se.student_id = s.id)
        AND NOT EXISTS (SELECT 1 FROM public.log_attendance la WHERE la.student_id = s.id)
        AND NOT EXISTS (SELECT 1 FROM public.lab_incidents li WHERE li.reported_by_id = s.id);
    END IF;
  END IF;

  -- 3. Iterate through all incoming rows
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_name := trim(coalesce(v_row->>'full_name', ''));
    v_adm := nullif(trim(coalesce(v_row->>'admission_no', '')), '');
    v_reg := nullif(trim(coalesce(v_row->>'registration_no', '')), '');
    v_action := coalesce(v_row->>'action', 'sync');

    IF v_name = '' THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: Student name cannot be empty.';
    END IF;

    BEGIN
      v_roll := (v_row->>'roll_number')::int;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: Invalid roll number format for student %.', v_name;
    END;

    -- If user chose 'assign_next_roll', calculate next available roll number
    IF v_action = 'assign_next_roll' THEN
      SELECT coalesce(max(roll_number), 0) + 1 INTO v_roll
      FROM public.student_enrollments
      WHERE academic_year_id = p_academic_year_id
        AND class_id = p_class_id
        AND status = 'active';
    END IF;

    IF v_roll IS NULL OR v_roll < 1 OR v_roll > 200 THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: Roll number % for student % is out of valid bounds (1-200).', v_roll, v_name;
    END IF;

    IF v_roll = ANY(v_rolls_seen) THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: Duplicate roll number % detected inside upload payload.', v_roll;
    END IF;
    v_rolls_seen := array_append(v_rolls_seen, v_roll);

    -- 4. Identity Resolution
    v_student_id := NULL;
    v_student_id_by_reg := NULL;

    -- Check if explicit student_id was provided (from review resolution)
    IF v_row ? 'student_id' AND nullif(trim(v_row->>'student_id'), '') IS NOT NULL THEN
      BEGIN
        v_student_id := (v_row->>'student_id')::uuid;
      EXCEPTION WHEN OTHERS THEN
        v_student_id := NULL;
      END;
    END IF;

    -- If student_id was not explicitly supplied, resolve via identifiers
    IF v_student_id IS NULL THEN
      IF v_adm IS NULL THEN
        v_adm := 'ADM-' || upper(regexp_replace(p_academic_year_id, '[^a-zA-Z0-9]', '', 'g')) || '-' || upper(regexp_replace(p_class_id, '[^a-zA-Z0-9]', '', 'g')) || '-' || lpad(v_roll::text, CASE WHEN v_roll < 100 THEN 2 ELSE 3 END, '0');
      END IF;

      SELECT id INTO v_student_id FROM public.students WHERE admission_no = v_adm LIMIT 1;

      IF v_reg IS NOT NULL THEN
        SELECT id INTO v_student_id_by_reg FROM public.students WHERE registration_no = v_reg LIMIT 1;
      END IF;

      IF v_student_id IS NOT NULL AND v_student_id_by_reg IS NOT NULL AND v_student_id <> v_student_id_by_reg THEN
        RAISE EXCEPTION 'IDENTITY_CONFLICT: Admission number % (student ID %) and registration number % (student ID %) resolve to two different students.',
          v_adm, v_student_id, v_reg, v_student_id_by_reg;
      END IF;

      IF v_student_id IS NULL THEN
        v_student_id := v_student_id_by_reg;
      END IF;
    END IF;

    -- 5. Create or update student person entity
    IF v_student_id IS NULL THEN
      INSERT INTO public.students (full_name, admission_no, registration_no, is_active)
      VALUES (v_name, v_adm, v_reg, true)
      RETURNING id INTO v_student_id;
      v_created_students := v_created_students + 1;
    ELSE
      UPDATE public.students
      SET full_name = v_name,
          registration_no = coalesce(v_reg, registration_no),
          is_active = true
      WHERE id = v_student_id;
      v_matched_students := v_matched_students + 1;
    END IF;

    -- 6. If action = 'replace_occupant', unseat previous occupant at v_roll
    IF v_action = 'replace_occupant' THEN
      SELECT se.id, se.student_id, count(la.id) INTO v_old_enrollment_id, v_old_occ_student_id, v_old_log_count
      FROM public.student_enrollments se
      LEFT JOIN public.log_attendance la ON la.enrollment_id = se.id
      WHERE se.academic_year_id = p_academic_year_id
        AND se.class_id = p_class_id
        AND se.roll_number = v_roll
      GROUP BY se.id, se.student_id;

      IF v_old_enrollment_id IS NOT NULL AND (v_old_occ_student_id <> v_student_id) THEN
        IF v_old_log_count = 0 THEN
          DELETE FROM public.workstation_seat_plans WHERE enrollment_id = v_old_enrollment_id;
          DELETE FROM public.session_seat_overrides WHERE enrollment_id = v_old_enrollment_id;
          DELETE FROM public.student_enrollments WHERE id = v_old_enrollment_id;
          IF NOT EXISTS (SELECT 1 FROM public.student_enrollments WHERE student_id = v_old_occ_student_id) THEN
            DELETE FROM public.students WHERE id = v_old_occ_student_id;
          END IF;
        ELSE
          -- Shift old occupant out of roll collision space to preserve logs
          SELECT coalesce(max(roll_number), 0) + 1 INTO v_shift_roll
          FROM public.student_enrollments
          WHERE academic_year_id = p_academic_year_id AND class_id = p_class_id;

          UPDATE public.student_enrollments
          SET roll_number = v_shift_roll, status = 'archived'
          WHERE id = v_old_enrollment_id;
        END IF;
      END IF;
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
      IF v_existing_roll = v_roll THEN
        v_retained_enrollments := v_retained_enrollments + 1;
      ELSE
        UPDATE public.student_enrollments
        SET roll_number = v_roll,
            status = 'active'
        WHERE id = v_existing_enrollment_id;
        v_updated_enrollments := v_updated_enrollments + 1;
      END IF;
    ELSE
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
`

async function run() {
  const client = await pool.connect()
  try {
    console.log('Migrating commit_roster_ingestion_tx with human-in-the-loop review enhancements...')
    await client.query(sql)
    console.log('Successfully deployed commit_roster_ingestion_tx')
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(console.error)
