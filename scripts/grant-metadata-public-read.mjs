import pg from 'pg'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const dbUrl = env.split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=')[1].trim().replace(/^['"]|['"]$/g, '')
const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
await client.connect()

console.log('--- Granting Public Read on Reference & Metadata Tables ---')

await client.query(`
  ALTER POLICY "Allow read academic_years" ON public.academic_years TO public;
  ALTER POLICY "Allow read classes" ON public.classes TO public;
  ALTER POLICY "Allow read subjects" ON public.subjects TO public;
  ALTER POLICY "Allow read class_subjects" ON public.class_subjects TO public;
`)

console.log('Successfully updated RLS policies to public for academic_years, classes, subjects, class_subjects.')
await client.end()
