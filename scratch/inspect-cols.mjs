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
const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

async function run() {
  const { rows: logs } = await pool.query(`
    SELECT pl.id, pl.academic_year_id, pl.subject_name, pl.batch_group, cs.class_id
    FROM practical_logs pl
    LEFT JOIN class_subjects cs ON pl.class_subject_id = cs.id
  `)
  console.log('All practical logs:', logs)

  const { rows: att } = await pool.query(`
    SELECT la.id, la.log_id, se.class_id, se.academic_year_id, se.roll_number, s.full_name
    FROM log_attendance la
    JOIN student_enrollments se ON la.enrollment_id = se.id
    JOIN students s ON s.id = se.student_id
  `)
  console.log('All attendance records with cohort:', att)

  await pool.end()
}

run().catch(console.error)
