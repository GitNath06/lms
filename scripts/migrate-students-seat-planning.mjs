import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const envPath = path.resolve(process.cwd(), '.env.local')
const content = fs.readFileSync(envPath, 'utf8')
let dbUrl = ''
for (const line of content.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) {
    dbUrl = line.split('=')[1].trim().replace(/^["']|["']$/g, '')
    break
  }
}

if (!dbUrl) {
  console.error('DATABASE_URL not found in .env.local')
  process.exit(1)
}

const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
})

const MIGRATION_SQL = `
-- ==============================================================================
-- PHASE 1: ACADEMIC YEARS, STUDENT ROSTER & TWO-TIER SEAT PLANNING DDL
-- ==============================================================================

-- 1. ACADEMIC YEARS
CREATE TABLE IF NOT EXISTS public.academic_years (
  id text PRIMARY KEY,                                      -- e.g. '2083'
  name text NOT NULL,                                       -- '2083 B.S. (2026/27 A.D.)'
  start_date date NOT NULL,                                 -- '2026-04-14'
  end_date date NOT NULL,                                   -- '2027-04-13'
  is_current boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_academic_years_single_current 
  ON public.academic_years (is_current) 
  WHERE (is_current = true);

-- Seed Initial Academic Year
INSERT INTO public.academic_years (id, name, start_date, end_date, is_current, is_archived)
VALUES ('2083', '2083 B.S. (2026/27 A.D.)', '2026-04-14', '2027-04-13', true, false)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_current = EXCLUDED.is_current;

-- 2. CANONICAL STUDENTS IDENTITY
CREATE TABLE IF NOT EXISTS public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_no text UNIQUE,                                 -- e.g. 'ADM-2081-0042'
  registration_no text UNIQUE,                              -- institutional / board registration
  full_name text NOT NULL,
  gender text CHECK (gender IN ('male', 'female', 'other')),
  dob_bs text,                                              -- e.g. '2065-03-12'
  dob_ad date,
  guardian_name text,
  guardian_phone text,
  email text,
  is_active boolean NOT NULL DEFAULT true,
  archived_at timestamptz,
  archive_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_students_active ON public.students (is_active);
CREATE INDEX IF NOT EXISTS idx_students_name ON public.students (lower(full_name));

-- 3. STUDENT ENROLLMENTS (Year <-> Cohort <-> Student <-> Roll)
CREATE TABLE IF NOT EXISTS public.student_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id text REFERENCES public.academic_years(id) ON DELETE RESTRICT NOT NULL,
  class_id text REFERENCES public.classes(id) ON DELETE RESTRICT NOT NULL,
  student_id uuid REFERENCES public.students(id) ON DELETE RESTRICT NOT NULL,
  roll_number integer NOT NULL CHECK (roll_number > 0 AND roll_number <= 200),
  section text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'transferred', 'graduated', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT uq_enrollment_roll UNIQUE (academic_year_id, class_id, roll_number),
  CONSTRAINT uq_enrollment_student UNIQUE (academic_year_id, class_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_cohort ON public.student_enrollments (academic_year_id, class_id, status);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON public.student_enrollments (student_id);

-- 4. TIER 1: DEFAULT WORKSTATION SEAT PLANS
CREATE TABLE IF NOT EXISTS public.workstation_seat_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id text REFERENCES public.labs(id) ON DELETE CASCADE NOT NULL,
  academic_year_id text REFERENCES public.academic_years(id) ON DELETE RESTRICT NOT NULL,
  class_id text REFERENCES public.classes(id) ON DELETE RESTRICT NOT NULL,
  workstation_id uuid REFERENCES public.workstations(id) ON DELETE RESTRICT NOT NULL,
  enrollment_id uuid REFERENCES public.student_enrollments(id) ON DELETE RESTRICT NOT NULL,
  notes text,                                               -- e.g. 'Requires accessibility seat', 'Left-handed'
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT uq_seat_plan_workstation UNIQUE (lab_id, academic_year_id, class_id, workstation_id),
  CONSTRAINT uq_seat_plan_enrollment UNIQUE (lab_id, academic_year_id, class_id, enrollment_id)
);

CREATE INDEX IF NOT EXISTS idx_seat_plans_lookup ON public.workstation_seat_plans (lab_id, academic_year_id, class_id);

-- 5. TIER 2: SESSION SEAT OVERRIDES (Temporary Fault / Swap Reallocations)
CREATE TABLE IF NOT EXISTS public.session_seat_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id text REFERENCES public.schedules(id) ON DELETE SET NULL,
  session_date date NOT NULL,
  practical_log_id text REFERENCES public.practical_logs(id) ON DELETE CASCADE,
  enrollment_id uuid REFERENCES public.student_enrollments(id) ON DELETE RESTRICT NOT NULL,
  workstation_id uuid REFERENCES public.workstations(id) ON DELETE RESTRICT NOT NULL,
  original_workstation_id uuid REFERENCES public.workstations(id) ON DELETE SET NULL,
  reason text,                                              -- e.g. 'PC-04 PSU burning smell', 'Monitor flickering'
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT uq_session_override_student UNIQUE (schedule_id, session_date, enrollment_id),
  CONSTRAINT uq_session_override_workstation UNIQUE (schedule_id, session_date, workstation_id)
);

CREATE INDEX IF NOT EXISTS idx_session_overrides_date ON public.session_seat_overrides (session_date, schedule_id);

-- 6. EXTENSIBLE LAB FLOOR ELEMENTS (Landmarks, Doors, Desks)
CREATE TABLE IF NOT EXISTS public.lab_floor_elements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id text REFERENCES public.labs(id) ON DELETE CASCADE NOT NULL,
  element_type text NOT NULL,                               -- extensible: 'teacher_desk', 'whiteboard', 'door', etc.
  label text NOT NULL,                                      -- e.g. 'Teacher Podium', 'Main Lab Entrance'
  pos_x double precision NOT NULL CHECK (pos_x >= 0 AND pos_x <= 100),
  pos_y double precision NOT NULL CHECK (pos_y >= 0 AND pos_y <= 100),
  width double precision NOT NULL DEFAULT 12.0 CHECK (width > 0 AND width <= 100),
  height double precision NOT NULL DEFAULT 4.0 CHECK (height > 0 AND height <= 100),
  rotation integer NOT NULL DEFAULT 0 CHECK (rotation IN (0, 90, 180, 270)),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,              -- colors, custom icons, remarks
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_floor_elements_lab ON public.lab_floor_elements (lab_id) WHERE (is_active = true);

-- Seed Default Floor Elements for Computer Lab 01 ('comp')
INSERT INTO public.lab_floor_elements (lab_id, element_type, label, pos_x, pos_y, width, height, rotation)
VALUES
  ('comp', 'teacher_desk', 'Teacher Podium / Master Console', 12.0, 8.0, 16.0, 6.0, 0),
  ('comp', 'whiteboard', 'Interactive Whiteboard & Projector Screen', 48.0, 4.0, 32.0, 3.0, 0),
  ('comp', 'door', 'Main Corridor Entrance', 92.0, 88.0, 6.0, 10.0, 0)
ON CONFLICT DO NOTHING;

-- 7. ATTENDANCE BRIDGE COLUMN (Nullable, Non-destructive)
ALTER TABLE public.log_attendance 
  ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.students(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_log_attendance_student ON public.log_attendance (student_id);

-- 8. CONTEXT FK COLUMNS ON SCHEDULES & PRACTICAL LOGS
ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS academic_year_id text REFERENCES public.academic_years(id) ON DELETE RESTRICT DEFAULT '2083';

ALTER TABLE public.practical_logs
  ADD COLUMN IF NOT EXISTS academic_year_id text REFERENCES public.academic_years(id) ON DELETE RESTRICT DEFAULT '2083';

-- 9. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workstation_seat_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_seat_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_floor_elements ENABLE ROW LEVEL SECURITY;

-- Read policies: all authenticated users can read academic context
DROP POLICY IF EXISTS "Allow read academic_years" ON public.academic_years;
CREATE POLICY "Allow read academic_years" ON public.academic_years FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow read students" ON public.students;
CREATE POLICY "Allow read students" ON public.students FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow read student_enrollments" ON public.student_enrollments;
CREATE POLICY "Allow read student_enrollments" ON public.student_enrollments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow read workstation_seat_plans" ON public.workstation_seat_plans;
CREATE POLICY "Allow read workstation_seat_plans" ON public.workstation_seat_plans FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow read session_seat_overrides" ON public.session_seat_overrides;
CREATE POLICY "Allow read session_seat_overrides" ON public.session_seat_overrides FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow read lab_floor_elements" ON public.lab_floor_elements;
CREATE POLICY "Allow read lab_floor_elements" ON public.lab_floor_elements FOR SELECT TO authenticated USING (true);

-- Privileged management policies: super_admin, lab_incharge, hod
DROP POLICY IF EXISTS "Allow manage academic_years" ON public.academic_years;
CREATE POLICY "Allow manage academic_years" ON public.academic_years FOR ALL TO authenticated USING (public.is_privileged());

DROP POLICY IF EXISTS "Allow manage students" ON public.students;
CREATE POLICY "Allow manage students" ON public.students FOR ALL TO authenticated USING (public.is_privileged());

DROP POLICY IF EXISTS "Allow manage student_enrollments" ON public.student_enrollments;
CREATE POLICY "Allow manage student_enrollments" ON public.student_enrollments FOR ALL TO authenticated USING (public.is_privileged());

DROP POLICY IF EXISTS "Allow manage lab_floor_elements" ON public.lab_floor_elements;
CREATE POLICY "Allow manage lab_floor_elements" ON public.lab_floor_elements FOR ALL TO authenticated USING (public.is_privileged());

-- Workstation seat plans: Admins manage all; Teachers manage their assigned classes
DROP POLICY IF EXISTS "Allow manage workstation_seat_plans" ON public.workstation_seat_plans;
CREATE POLICY "Allow manage workstation_seat_plans" ON public.workstation_seat_plans FOR ALL TO authenticated
  USING (
    public.is_privileged() OR 
    EXISTS (
      SELECT 1 FROM public.class_subjects cs
      WHERE cs.class_id = workstation_seat_plans.class_id AND cs.teacher_id = auth.uid()
    )
  );

-- Session seat overrides: Admins manage all; Teachers manage their own session overrides
DROP POLICY IF EXISTS "Allow manage session_seat_overrides" ON public.session_seat_overrides;
CREATE POLICY "Allow manage session_seat_overrides" ON public.session_seat_overrides FOR ALL TO authenticated
  USING (
    public.is_privileged() OR 
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.schedules s
      WHERE s.id = session_seat_overrides.schedule_id AND s.teacher_id = auth.uid()
    )
  );

-- 10. REALTIME SUBSCRIPTIONS
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.academic_years; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.students; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.student_enrollments; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.workstation_seat_plans; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.session_seat_overrides; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.lab_floor_elements; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;
`

async function run() {
  console.log('Running Phase 1 migration...')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(MIGRATION_SQL)
    await client.query('COMMIT')
    console.log('Phase 1 migration executed successfully!')

    // Verification queries
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN (
          'academic_years', 
          'students', 
          'student_enrollments', 
          'workstation_seat_plans', 
          'session_seat_overrides', 
          'lab_floor_elements'
        )
      ORDER BY table_name;
    `)
    console.log('Verified tables in DB:', tablesRes.rows.map(r => r.table_name))

    const yearsRes = await client.query('SELECT * FROM public.academic_years;')
    console.log('Seeded academic years:', yearsRes.rows)

    const floorRes = await client.query('SELECT lab_id, element_type, label FROM public.lab_floor_elements;')
    console.log('Seeded floor elements count:', floorRes.rows.length)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Migration failed:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
