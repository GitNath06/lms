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
      SELECT cs.class_id, cs.subject_id, cs.teacher_id, p.full_name, c.name as class_name
      FROM public.class_subjects cs
      LEFT JOIN public.profiles p ON p.id = cs.teacher_id
      LEFT JOIN public.classes c ON c.id = cs.class_id;
    `)
    console.log('CLASS_SUBJECTS:', res.rows)
  } finally {
    client.release()
    await pool.end()
  }
}

check()
