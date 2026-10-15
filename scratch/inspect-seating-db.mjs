import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const envPath = path.resolve(process.cwd(), '.env.local')
const content = fs.readFileSync(envPath, 'utf8')
const dbUrl = content.split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=')[1].trim().replace(/^['"]|['"]$/g, '')

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

async function inspect() {
  const client = await pool.connect()
  try {
    const students = await client.query(`
      SELECT se.id as enrollment_id, se.roll_number, s.full_name, se.status
      FROM public.student_enrollments se
      JOIN public.students s ON s.id = se.student_id
      WHERE se.academic_year_id = '2083' AND se.class_id = '12eng'
      ORDER BY se.roll_number;
    `)
    console.log('Students in 12eng 2083 (count:', students.rows.length, '):')
    console.log(students.rows.map(s => `Roll ${s.roll_number}: ${s.full_name} (${s.status})`))
  } finally {
    client.release()
    await pool.end()
  }
}

inspect()
