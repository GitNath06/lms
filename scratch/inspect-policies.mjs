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
    const q = `
      SELECT
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename IN (
          'students', 'student_enrollments', 'classes', 'subjects', 'class_subjects',
          'schedules', 'practical_logs', 'log_attendance', 'workstation_seat_plans',
          'session_seat_overrides', 'lab_incidents'
        )
      ORDER BY tablename, policyname;
    `
    const res = await client.query(q)
    fs.writeFileSync('scratch/policies.json', JSON.stringify(res.rows, null, 2))
    console.log(`Found ${res.rows.length} policies across target tables.`)
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
