import pg from 'pg'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf-8')
let dbUrl = ''
for (const line of env.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) {
    dbUrl = line.substring('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '')
  }
}

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

async function run() {
  const client = await pool.connect()
  try {
    const classes = await client.query('SELECT * FROM public.classes LIMIT 5;')
    console.log('CLASSES:', classes.rows)

    const years = await client.query('SELECT id, name, is_current FROM public.academic_years ORDER BY id DESC;')
    console.log('YEARS:', years.rows)

    const ws = await client.query("SELECT count(*) as cnt FROM public.workstations WHERE lab_id = 'comp';")
    console.log('COMP WORKSTATIONS:', ws.rows[0].cnt)

    const fe = await client.query("SELECT id, element_type, label, pos_x, pos_y, width, height, rotation FROM public.lab_floor_elements WHERE lab_id = 'comp' AND is_active = true;")
    console.log('COMP FLOOR ELEMENTS:', fe.rows)

    const enroll = await client.query("SELECT academic_year_id, class_id, count(*) as cnt FROM public.student_enrollments GROUP BY academic_year_id, class_id;")
    console.log('ENROLLMENTS BY COHORT:', enroll.rows)

    const sp = await client.query("SELECT academic_year_id, class_id, count(*) as cnt FROM public.workstation_seat_plans GROUP BY academic_year_id, class_id;")
    console.log('SEAT PLANS BY COHORT:', sp.rows)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
