import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const envPath = path.resolve(process.cwd(), '.env.local')
const content = fs.readFileSync(envPath, 'utf8')
const dbUrl = content.split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=')[1].trim().replace(/^['"]|['"]$/g, '')

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

async function check() {
  const res = await pool.query(`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND (
        (table_name = 'log_attendance' AND column_name = 'student_id') OR
        (table_name = 'schedules' AND column_name = 'academic_year_id') OR
        (table_name = 'practical_logs' AND column_name = 'academic_year_id')
      );
  `)
  console.log('Columns verified:', res.rows)

  const constraintsRes = await pool.query(`
    SELECT conname, conrelid::regclass, contype
    FROM pg_constraint
    WHERE conname IN (
      'uq_session_override_workstation',
      'uq_session_override_student',
      'uq_seat_plan_workstation',
      'uq_seat_plan_enrollment',
      'uq_enrollment_roll',
      'uq_enrollment_student'
    );
  `)
  console.log('Constraints verified:', constraintsRes.rows)
  await pool.end()
}

check()
