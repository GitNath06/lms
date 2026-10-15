import pg from 'pg'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const match = env.match(/DATABASE_URL=['"]?([^'"\r\n]+)/)
const pool = new pg.Pool({ connectionString: match[1], ssl: { rejectUnauthorized: false } })

const res = await pool.query(`
  SELECT conname, pg_get_constraintdef(oid) 
  FROM pg_constraint 
  WHERE conrelid = 'public.student_enrollments'::regclass;
`)
console.log(JSON.stringify(res.rows, null, 2))
await pool.end()
