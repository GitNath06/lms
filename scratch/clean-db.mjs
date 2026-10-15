import pg from 'pg'
import fs from 'fs'
import path from 'path'

const envPath = path.resolve(process.cwd(), '.env.local')
const content = fs.readFileSync(envPath, 'utf8')
let dbUrl = null

for (const line of content.split('\n')) {
  const trimmed = line.trim()
  if (trimmed.startsWith('DATABASE_URL=')) {
    dbUrl = trimmed.slice('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '')
    break
  }
}

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

async function clean() {
  const client = await pool.connect()
  try {
    // Delete any lingering swap test records
    await client.query(`
      DELETE FROM public.workstation_seat_plans 
      WHERE enrollment_id IN (
        SELECT id FROM public.student_enrollments WHERE roll_number >= 100 OR roll_number > 35
      );
    `)
    await client.query(`
      DELETE FROM public.student_enrollments 
      WHERE roll_number >= 100 OR roll_number > 35;
    `)
    await client.query(`
      DELETE FROM public.students 
      WHERE admission_no LIKE 'SWAP-%'
         OR admission_no LIKE 'TEST-P5-%'
         OR admission_no LIKE 'SUCCESS-%'
         OR admission_no LIKE 'FAIL-%'
         OR admission_no LIKE 'IDEM-%';
    `)

    // Delete any lingering test workstations (e.g. PC-99)
    await client.query(`
      DELETE FROM public.workstation_seat_plans 
      WHERE workstation_id IN (
        SELECT id FROM public.workstations WHERE label = 'PC-99'
      );
    `)
    await client.query(`
      DELETE FROM public.session_seat_overrides 
      WHERE workstation_id IN (
        SELECT id FROM public.workstations WHERE label = 'PC-99'
      );
    `)
    await client.query(`
      DELETE FROM public.workstations 
      WHERE label = 'PC-99';
    `)

    const studCount = await client.query(`
      SELECT count(*) FROM public.student_enrollments 
      WHERE academic_year_id = '2083' AND class_id = '12eng' AND status = 'active';
    `)
    console.log('12eng active enrollments count:', studCount.rows[0].count)

    const wsCount = await client.query(`
      SELECT count(*) FROM public.workstations WHERE lab_id = 'comp';
    `)
    console.log('comp workstations count:', wsCount.rows[0].count)
  } finally {
    client.release()
    await pool.end()
  }
}

clean().catch(console.error)
