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
    const profs = await client.query('SELECT id, full_name, email, role, approval_status FROM public.profiles ORDER BY full_name;')
    console.log('=== PROFILES in Live DB ===')
    console.log(JSON.stringify(profs.rows, null, 2))

    const subs = await client.query('SELECT id, code, name, default_lab_id, credit_hours FROM public.subjects ORDER BY code;')
    console.log('=== SUBJECTS in Live DB ===')
    console.log(JSON.stringify(subs.rows, null, 2))

    const cls = await client.query('SELECT id, name, grade, section FROM public.classes ORDER BY grade, name;')
    console.log('=== CLASSES in Live DB ===')
    console.log(JSON.stringify(cls.rows, null, 2))

    const scheds = await client.query('SELECT id, lab_id, teacher_id, subject_name, batch_name FROM public.schedules LIMIT 10;')
    console.log('=== SAMPLE SCHEDULES ===')
    console.log(JSON.stringify(scheds.rows, null, 2))

  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
