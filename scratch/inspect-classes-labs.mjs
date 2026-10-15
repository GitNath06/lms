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

async function main() {
  const client = await pool.connect()
  const classes = await client.query('SELECT id, name FROM public.classes;')
  console.log('Classes:', classes.rows)
  const enrollments = await client.query("SELECT se.id, se.roll_number, s.admission_no, s.full_name FROM public.student_enrollments se JOIN public.students s ON s.id = se.student_id WHERE se.academic_year_id = '2083' AND se.class_id = '12eng' ORDER BY se.roll_number;")
  console.log('Enrollments in 12eng (total ' + enrollments.rows.length + '):')
  enrollments.rows.forEach(r => console.log(`Roll ${r.roll_number}: ${r.full_name} (${r.admission_no}) [${r.id}]`))

  const labs = await client.query('SELECT id, name, type FROM public.labs;')
  console.log('Labs:', labs.rows)
  const csByClass = await client.query(`
    SELECT cs.class_id, count(*), array_agg(s.name) as subjects
    FROM public.class_subjects cs
    JOIN public.subjects s ON s.id = cs.subject_id
    WHERE cs.academic_year_id = '2083'
    GROUP BY cs.class_id;
  `)
  console.log('Class Subjects by class in 2083:', csByClass.rows)


  // Also check existing workstations and their labs
  const ws = await client.query('SELECT lab_id, count(*) FROM public.workstations GROUP BY lab_id;')
  console.log('Workstations per lab:', ws.rows)

  client.release()
  await pool.end()
}

main().catch(console.error)
