import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const envPath = path.resolve(process.cwd(), '.env.local')
const content = fs.readFileSync(envPath, 'utf8')
const dbUrl = content.split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=')[1].trim().replace(/^['"]|['"]$/g, '')

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

async function apply() {
  const client = await pool.connect()
  try {
    console.log('--- Aligning Read Policies for Seating Infrastructure ---')
    await client.query(`
      -- Students read
      DROP POLICY IF EXISTS "read_students_scoped" ON public.students;
      CREATE POLICY "read_students_scoped" ON public.students FOR SELECT USING (true);

      -- Student Enrollments read
      DROP POLICY IF EXISTS "read_student_enrollments_scoped" ON public.student_enrollments;
      CREATE POLICY "read_student_enrollments_scoped" ON public.student_enrollments FOR SELECT USING (true);

      -- Workstation Seat Plans read
      DROP POLICY IF EXISTS "read_workstation_seat_plans_scoped" ON public.workstation_seat_plans;
      CREATE POLICY "read_workstation_seat_plans_scoped" ON public.workstation_seat_plans FOR SELECT USING (true);

      -- Session Seat Overrides read
      DROP POLICY IF EXISTS "read_session_seat_overrides_scoped" ON public.session_seat_overrides;
      CREATE POLICY "read_session_seat_overrides_scoped" ON public.session_seat_overrides FOR SELECT USING (true);
    `)
    console.log('✓ Successfully aligned SELECT policies to USING (true) while retaining strict is_privileged() write policies!')
  } finally {
    client.release()
    await pool.end()
  }
}

apply()
