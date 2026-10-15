import pg from 'pg'
import fs from 'fs'
import path from 'path'

const envPath = path.resolve(process.cwd(), '.env.local')
const content = fs.readFileSync(envPath, 'utf8')
let rawUrl = null

for (const line of content.split('\n')) {
  const trimmed = line.trim()
  if (trimmed.startsWith('DATABASE_URL=')) {
    rawUrl = trimmed.slice('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '')
    break
  }
}

function resolveDatabaseUrl(url) {
  if (!url) return url
  if (url.includes('db.') && url.includes('.supabase.co')) {
    const match = url.match(/postgresql:\/\/([^:]+):(.+)@db\.([a-z0-9]+)\.supabase\.co(?::\d+)?\/(.+)$/)
    if (match) {
      const [, , pass, ref, db] = match
      const decodedPass = decodeURIComponent(pass)
      return `postgresql://postgres.${ref}:${encodeURIComponent(decodedPass)}@aws-0-ap-southeast-1.pooler.supabase.com:5432/${db}`
    }
  }
  return url
}

const connectionString = resolveDatabaseUrl(rawUrl)
const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } })

async function inspect() {
  const client = await pool.connect()
  try {
    const classes = await client.query('SELECT * FROM public.classes;')
    console.log('COUNT in public.classes:', classes.rows.length)
    console.log('ROWS in public.classes:', classes.rows)

    const enrollments = await client.query('SELECT count(*)::int, class_id, academic_year_id FROM public.student_enrollments GROUP BY class_id, academic_year_id;')
    console.log('Enrollments summary:', enrollments.rows)

    const settings = await client.query("SELECT key, value FROM public.institution_settings WHERE key LIKE '%class%';")
    console.log('Class settings in institution_settings:', settings.rows)
  } catch (err) {
    console.error('Error querying DB:', err)
  } finally {
    client.release()
    await pool.end()
  }
}

inspect()
