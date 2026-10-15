import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const envPath = path.resolve(process.cwd(), '.env.local')
const content = fs.readFileSync(envPath, 'utf8')
const dbUrl = content.split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=')[1].trim().replace(/^['"]|['"]$/g, '')

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

async function check() {
  const years = await pool.query('SELECT * FROM public.academic_years ORDER BY id DESC;')
  console.log('Academic Years:', years.rows)

  const classes = await pool.query('SELECT * FROM public.classes ORDER BY grade, section;')
  console.log('Classes:', classes.rows)

  const students = await pool.query('SELECT count(*) FROM public.students;')
  console.log('Total students:', students.rows[0].count)

  const enrollments = await pool.query(`
    SELECT c.name as class_name, count(se.id) 
    FROM public.student_enrollments se
    JOIN public.classes c ON c.id = se.class_id
    GROUP BY c.name;
  `)
  console.log('Enrollments per class:', enrollments.rows)

  const workstations = await pool.query('SELECT lab_id, count(*) FROM public.workstations GROUP BY lab_id;')
  console.log('Workstations per lab:', workstations.rows)

  await pool.end()
}

check().catch(console.error)
