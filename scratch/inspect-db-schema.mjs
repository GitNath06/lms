import pg from 'pg'

process.loadEnvFile('.env.local')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

async function check() {
  const cols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'subjects' AND table_schema = 'public'")
  console.log('subjects columns:', cols.rows)

  const sample = await pool.query('SELECT * FROM public.subjects LIMIT 5')
  console.log('sample subjects:', sample.rows)

  const csSample = await pool.query(`
    SELECT cs.id, cs.class_id, cs.subject_id, s.code, s.name, c.name as class_name, c.grade
    FROM public.class_subjects cs
    JOIN public.subjects s ON s.id = cs.subject_id
    JOIN public.classes c ON c.id = cs.class_id
    LIMIT 5;
  `)
  console.log('sample class_subjects with joined classes and subjects:', csSample.rows)

  await pool.end()
}

check()
