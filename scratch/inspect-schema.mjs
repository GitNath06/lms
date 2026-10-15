import pg from 'pg'
import fs from 'fs'
import path from 'path'

const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8')
let dbUrl = ''
for (const line of envContent.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) {
    dbUrl = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '')
  }
}
const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

async function run() {
  const tables = ['students', 'student_enrollments', 'academic_years', 'classes']
  for (const t of tables) {
    const res = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `, [t])
    console.log('=== TABLE:', t, '===')
    console.table(res.rows)
  }

  const cRes = await pool.query(`
    SELECT conrelid::regclass AS table_name, conname, contype, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid IN ('public.students'::regclass, 'public.student_enrollments'::regclass);
  `)
  console.log('=== CONSTRAINTS ===')
  console.table(cRes.rows)

  // Also check existing student counts and enrollments
  const stCount = await pool.query('SELECT count(*) FROM public.students;')
  const enCount = await pool.query('SELECT count(*) FROM public.student_enrollments;')
  const years = await pool.query('SELECT * FROM public.academic_years;')
  const classes = await pool.query('SELECT * FROM public.classes ORDER BY id;')

  console.log('=== COUNTS & SEEDED DATA ===')
  console.log('Students count:', stCount.rows[0].count)
  console.log('Enrollments count:', enCount.rows[0].count)
  console.log('Academic Years:', years.rows)
  console.log('Classes:', classes.rows.map(c => `${c.id} (${c.name})`))

  await pool.end()
}

run().catch(console.error)
