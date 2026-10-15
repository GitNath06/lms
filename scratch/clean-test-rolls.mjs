import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const envPath = path.resolve(process.cwd(), '.env.local')
const content = fs.readFileSync(envPath, 'utf8')
const dbUrl = content.split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=')[1].trim().replace(/^['"]|['"]$/g, '')

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

async function clean() {
  const client = await pool.connect()
  try {
    const enrollments = await client.query(`
      SELECT id, student_id FROM public.student_enrollments
      WHERE academic_year_id = '2083' AND class_id = '12eng' AND roll_number IN (71, 72);
    `)
    if (enrollments.rows.length > 0) {
      const eIds = enrollments.rows.map(r => r.id)
      const sIds = enrollments.rows.map(r => r.student_id)
      await client.query(`DELETE FROM public.workstation_seat_plans WHERE enrollment_id = ANY($1);`, [eIds])
      await client.query(`DELETE FROM public.session_seat_overrides WHERE enrollment_id = ANY($1);`, [eIds])
      await client.query(`DELETE FROM public.student_enrollments WHERE id = ANY($1);`, [eIds])
      await client.query(`DELETE FROM public.students WHERE id = ANY($1);`, [sIds])
      console.log('Cleaned test rolls 71 and 72')
    }
    const countRes = await client.query(`
      SELECT count(*) FROM public.student_enrollments
      WHERE academic_year_id = '2083' AND class_id = '12eng';
    `)
    console.log('Total students in 12eng 2083:', countRes.rows[0].count)
  } finally {
    client.release()
    await pool.end()
  }
}

clean()
