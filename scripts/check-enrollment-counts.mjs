import pg from 'pg'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const dbUrl = env.split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=')[1].trim().replace(/^['"]|['"]$/g, '')
const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
await client.connect()

const res = await client.query(`
  SELECT cs.id as cs_id, cs.class_id, cs.subject_id, cs.academic_year_id, count(se.id) as enrollment_count
  FROM class_subjects cs
  LEFT JOIN student_enrollments se ON se.class_id = cs.class_id AND se.academic_year_id = cs.academic_year_id AND se.status = 'active'
  GROUP BY cs.id, cs.class_id, cs.subject_id, cs.academic_year_id
  ORDER BY enrollment_count DESC;
`)
console.table(res.rows.slice(0, 10))
await client.end()
