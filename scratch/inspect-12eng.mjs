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
  const { rows: e } = await pool.query(`
    SELECT se.roll_number, s.id, s.full_name, s.admission_no 
    FROM student_enrollments se 
    JOIN students s ON s.id = se.student_id 
    WHERE se.class_id = '12eng' AND se.academic_year_id = '2083' 
    ORDER BY se.roll_number LIMIT 10;
  `)
  console.log('12eng students sample:', e)

  const { rows: l } = await pool.query(`
    SELECT count(*) 
    FROM log_attendance la 
    JOIN student_enrollments se ON la.enrollment_id = se.id 
    WHERE se.class_id = '12eng' AND se.academic_year_id = '2083';
  `)
  console.log('12eng attendance log count:', l[0].count)
  await pool.end()
}

run().catch(console.error)
