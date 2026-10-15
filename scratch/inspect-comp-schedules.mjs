import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const envPath = path.resolve(process.cwd(), '.env.local')
const content = fs.readFileSync(envPath, 'utf8')
const dbUrl = content.split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=')[1].trim().replace(/^['"]|['"]$/g, '')

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

async function check() {
  const client = await pool.connect()
  try {
    const res = await client.query(`
      SELECT id, day_key, start_time, end_time, subject_name, batch_name, class_subject_id
      FROM public.schedules
      WHERE lab_id = 'comp'
      ORDER BY day_key, start_time;
    `)
    console.log('COMP LAB SCHEDULES COUNT:', res.rows.length)
    console.log(JSON.stringify(res.rows, null, 2))
  } finally {
    client.release()
    await pool.end()
  }
}

check()
