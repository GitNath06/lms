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
    const cols = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'schedules' ORDER BY ordinal_position;
    `)
    console.log('SCHEDULES COLS:', cols.rows)

    const schedules = await client.query(`
      SELECT * FROM public.schedules LIMIT 10;
    `)
    console.log('SAMPLE SCHEDULES:', JSON.stringify(schedules.rows.slice(0, 3), null, 2))

    const classes = await client.query(`
      SELECT id, name, grade, section FROM public.classes;
    `)
    console.log('CLASSES:', JSON.stringify(classes.rows, null, 2))

    const profiles = await client.query(`
      SELECT id, full_name, role, email FROM public.profiles;
    `)
    console.log('PROFILES:', JSON.stringify(profiles.rows, null, 2))
  } finally {
    client.release()
    await pool.end()
  }
}

inspect()
