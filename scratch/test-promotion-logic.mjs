import pg from 'pg'
import fs from 'fs'
import path from 'path'

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

async function test() {
  const client = await pool.connect()
  try {
    const res = await client.query(`
      SELECT se.id, se.student_id, se.roll_number, se.section, s.full_name, s.admission_no, s.gender
      FROM public.student_enrollments se
      JOIN public.students s ON s.id = se.student_id
      WHERE se.class_id = $1 AND se.academic_year_id = $2 AND se.status = 'active'
      ORDER BY se.roll_number ASC
      LIMIT 3;
    `, ['12eng', '2083'])
    console.log('Sample students for promotion:', res.rows)

    const auditCheck = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'audit_logs';
    `)
    console.log('audit_logs columns:', auditCheck.rows.map(r => `${r.column_name} (${r.data_type})`))
  } finally {
    client.release()
    await pool.end()
  }
}

test().catch(console.error)
