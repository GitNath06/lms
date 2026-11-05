import fs from 'fs'
import path from 'path'
import pg from 'pg'

const envPath = path.resolve(process.cwd(), '.env.local')
const content = fs.readFileSync(envPath, 'utf8')
for (const line of content.split('\n')) {
  const trimmed = line.trim()
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const idx = trimmed.indexOf('=')
    const key = trimmed.slice(0, idx).trim()
    const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
}
function resolveDatabaseUrl(rawUrl) {
  if (!rawUrl) return rawUrl
  const match = rawUrl.match(/postgresql:\/\/([^:]+):(.+)@db\.([a-z0-9]+)\.supabase\.co(?::\d+)?\/(.+)$/)
  if (match) {
    const [, , pass, ref, db] = match
    return 'postgresql://postgres.' + ref + ':' + encodeURIComponent(decodeURIComponent(pass)) + '@aws-0-ap-southeast-1.pooler.supabase.com:5432/' + db
  }
  return rawUrl
}
const pool = new pg.Pool({ connectionString: resolveDatabaseUrl(process.env.DATABASE_URL), ssl: { rejectUnauthorized: false } })

// Let's check public.schedules where status = 'in_progress'
const inProgress = await pool.query(`
  SELECT id, day_key, start_time, end_time, subject_name, lab_id, status
  FROM public.schedules
  WHERE status = 'in_progress'
`)
console.log('IN_PROGRESS SCHEDULES:', JSON.stringify(inProgress.rows, null, 2))

// Let's check public.schedules for CT-12
const ct12 = await pool.query(`
  SELECT * FROM public.schedules WHERE subject_name ILIKE '%CT-12%'
`)
console.log('CT-12 ROW:', JSON.stringify(ct12.rows, null, 2))

// Let's check all schedules sorted by start_time ASC
const all = await pool.query(`
  SELECT id, day_key, start_time, end_time, subject_name, lab_id, status
  FROM public.schedules
  WHERE lab_id = 'comp'
`)
console.log('TOTAL COMP LAB SCHEDULES:', all.rows.length)

await pool.end()
