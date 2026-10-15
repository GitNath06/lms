import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const envPath = path.resolve(process.cwd(), '.env.local')
const content = fs.readFileSync(envPath, 'utf8')
const dbUrl = content.split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=')[1].trim().replace(/^['"]|['"]$/g, '')

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

async function test() {
  const client = await pool.connect()
  try {
    // Check if schedules has profiles FK or teacher_id
    const res = await client.query(`
      SELECT s.id, s.lab_id, s.teacher_id, s.subject_name, s.batch_name, s.metadata, p.full_name as teacher_name
      FROM public.schedules s
      LEFT JOIN public.profiles p ON p.id = s.teacher_id
      WHERE s.id = 'sun-1';
    `)
    console.log('sun-1 query with LEFT JOIN profiles:', res.rows)
  } finally {
    client.release()
    await pool.end()
  }
}

test()
