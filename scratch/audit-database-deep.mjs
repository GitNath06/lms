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
    console.log('=== 1. FOREIGN KEYS ACROSS ACADEMIC TABLES ===')
    const fkQuery = `
      SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        tc.constraint_name
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name IN (
          'students', 'student_enrollments', 'classes', 'subjects', 'class_subjects',
          'schedules', 'practical_logs', 'log_attendance', 'workstation_seat_plans',
          'session_seat_overrides', 'lab_incidents', 'academic_years', 'workstations'
        )
      ORDER BY tc.table_name, kcu.column_name;
    `
    const fks = await client.query(fkQuery)
    console.log(JSON.stringify(fks.rows, null, 2))

    console.log('=== 2. UNIQUE CONSTRAINTS ===')
    const uqQuery = `
      SELECT
        tc.table_name,
        tc.constraint_name,
        string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'UNIQUE'
        AND tc.table_schema = 'public'
        AND tc.table_name IN (
          'students', 'student_enrollments', 'classes', 'subjects', 'class_subjects',
          'schedules', 'practical_logs', 'log_attendance', 'workstation_seat_plans',
          'session_seat_overrides'
        )
      GROUP BY tc.table_name, tc.constraint_name
      ORDER BY tc.table_name;
    `
    const uqs = await client.query(uqQuery)
    console.log(JSON.stringify(uqs.rows, null, 2))

    console.log('=== 3. ALL COLUMNS OF ACADEMIC TABLES ===')
    const colsQuery = `
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN (
          'students', 'student_enrollments', 'classes', 'subjects', 'class_subjects',
          'schedules', 'practical_logs', 'log_attendance', 'workstation_seat_plans',
          'session_seat_overrides', 'lab_incidents'
        )
      ORDER BY table_name, ordinal_position;
    `
    const cols = await client.query(colsQuery)
    console.log(JSON.stringify(cols.rows, null, 2))

    console.log('=== 4. ROW COUNTS & SAMPLE VALUES ===')
    const tables = [
      'academic_years', 'classes', 'subjects', 'class_subjects',
      'students', 'student_enrollments', 'schedules', 'practical_logs',
      'log_attendance', 'workstation_seat_plans', 'session_seat_overrides', 'lab_incidents'
    ]
    for (const t of tables) {
      const cnt = await client.query(`SELECT count(*) as count FROM public.${t}`)
      console.log(`Table ${t}: ${cnt.rows[0].count} rows`)
    }

  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
