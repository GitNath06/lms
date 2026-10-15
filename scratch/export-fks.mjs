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
    fs.writeFileSync('scratch/fks.json', JSON.stringify(fks.rows, null, 2))

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
    fs.writeFileSync('scratch/uqs.json', JSON.stringify(uqs.rows, null, 2))

    console.log('Saved fks.json and uqs.json successfully!')
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
