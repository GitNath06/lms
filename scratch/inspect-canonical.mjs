import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

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

async function run() {
  const client = await pool.connect()
  try {
    const classes = await client.query('SELECT id, name, grade, section, stream_id FROM public.classes ORDER BY grade, name;')
    console.log('CLASSES (count=' + classes.rows.length + '):', JSON.stringify(classes.rows, null, 2))

    const subjects = await client.query('SELECT id, code, name, default_lab_id FROM public.subjects ORDER BY name;')
    console.log('SUBJECTS (count=' + subjects.rows.length + '):', JSON.stringify(subjects.rows, null, 2))

    const cs = await client.query(`
      SELECT cs.id, cs.class_id, cs.subject_id, cs.teacher_id, p.full_name as teacher_name, cs.default_lab_id
      FROM public.class_subjects cs
      LEFT JOIN public.profiles p ON p.id = cs.teacher_id
      ORDER BY cs.class_id, cs.subject_id;
    `)
    console.log('CLASS_SUBJECTS (count=' + cs.rows.length + '):', JSON.stringify(cs.rows, null, 2))

    const sched = await client.query(`
      SELECT id, lab_id, teacher_id, subject_name, batch_name, academic_year_id, slot_id, day_key
      FROM public.schedules
      LIMIT 10;
    `)
    console.log('SAMPLE SCHEDULES:', JSON.stringify(sched.rows, null, 2))

    const cols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'practical_logs' 
      ORDER BY ordinal_position;
    `)
    console.log('PRACTICAL_LOGS REAL COLUMNS:', cols.rows.map(r => r.column_name))

    const incidents = await client.query(`
      SELECT id, lab_id, schedule_id, subject_name, batch_name, subject_teacher_name, equipment_name
      FROM public.lab_incidents
      LIMIT 5;
    `)
    console.log('SAMPLE LAB_INCIDENTS:', JSON.stringify(incidents.rows, null, 2))

    const attend = await client.query(`
      SELECT id, log_id, student_id, roll_number, is_present
      FROM public.log_attendance
      LIMIT 5;
    `)
    console.log('SAMPLE LOG_ATTENDANCE:', JSON.stringify(attend.rows, null, 2))

    const enroll = await client.query(`
      SELECT id, academic_year_id, class_id, student_id, roll_number, section, status
      FROM public.student_enrollments
      LIMIT 5;
    `)
    console.log('SAMPLE ENROLLMENTS:', JSON.stringify(enroll.rows, null, 2))

  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(console.error)
