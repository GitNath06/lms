import pg from 'pg'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const dbUrl = env.split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=')[1].trim().replace(/^['"]|['"]$/g, '')
const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
await client.connect()

const res = await client.query(`
  SELECT tablename, policyname, roles, cmd, qual 
  FROM pg_policies 
  WHERE schemaname = 'public' 
    AND tablename IN ('academic_years', 'classes', 'subjects', 'labs', 'class_subjects', 'students', 'student_enrollments', 'schedules', 'practical_logs', 'log_attendance')
  ORDER BY tablename, policyname;
`)
console.table(res.rows)
await client.end()
