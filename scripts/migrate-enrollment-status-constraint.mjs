import pg from 'pg'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const match = env.match(/DATABASE_URL=['"]?([^'"\r\n]+)/)
const pool = new pg.Pool({ connectionString: match[1], ssl: { rejectUnauthorized: false } })

try {
  console.log('Updating student_enrollments_status_check constraint...')
  await pool.query(`
    ALTER TABLE public.student_enrollments 
    DROP CONSTRAINT IF EXISTS student_enrollments_status_check;
  `)
  await pool.query(`
    ALTER TABLE public.student_enrollments 
    ADD CONSTRAINT student_enrollments_status_check 
    CHECK (status = ANY (ARRAY['active'::text, 'transferred'::text, 'graduated'::text, 'archived'::text, 'completed'::text]));
  `)
  console.log('✓ Successfully updated student_enrollments_status_check constraint!')
} catch (err) {
  console.error('Migration failed:', err)
  process.exit(1)
} finally {
  await pool.end()
}
