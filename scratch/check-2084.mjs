import pg from 'pg'
import fs from 'node:fs'
import path from 'node:path'

const envPath = path.resolve(process.cwd(), '.env.local')
const content = fs.readFileSync(envPath, 'utf8')
let dbUrl = ''
for (const line of content.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) {
    dbUrl = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '')
  }
}
const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

async function run() {
  const { rows } = await pool.query(`
    SELECT academic_year_id, class_id, status, count(*)::int as count 
    FROM student_enrollments 
    GROUP BY academic_year_id, class_id, status
    ORDER BY academic_year_id, class_id;
  `)
  console.table(rows)
  await pool.end()
}
run()
