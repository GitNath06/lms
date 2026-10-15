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
  const cols = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'student_enrollments';
  `)
  console.table(cols.rows)
  const constrs = await pool.query(`
    SELECT conname, pg_get_constraintdef(c.oid) 
    FROM pg_constraint c 
    JOIN pg_namespace n ON n.oid = c.connamespace 
    WHERE conrelid = 'public.student_enrollments'::regclass;
  `)
  console.table(constrs.rows)
  await pool.end()
}
run()
