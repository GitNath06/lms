import fs from 'fs'
import path from 'path'
import pg from 'pg'

const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=')
      const key = trimmed.slice(0, idx).trim()
      const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
      if (!process.env[key]) {
        process.env[key] = val
      }
    }
  }
}

function resolveDatabaseUrl(rawUrl) {
  if (!rawUrl) return rawUrl
  if (rawUrl.includes('db.') && rawUrl.includes('.supabase.co')) {
    const match = rawUrl.match(/postgresql:\/\/([^:]+):(.+)@db\.([a-z0-9]+)\.supabase\.co(?::\d+)?\/(.+)$/)
    if (match) {
      const [, , pass, ref, db] = match
      const decodedPass = decodeURIComponent(pass)
      return `postgresql://postgres.${ref}:${encodeURIComponent(decodedPass)}@aws-0-ap-southeast-1.pooler.supabase.com:5432/${db}`
    }
  }
  return rawUrl
}

const connectionString = resolveDatabaseUrl(process.env.DATABASE_URL)
const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } })

const shouldReset = process.argv.includes('--reset')
const shouldCleanIssues = process.argv.includes('--clean-issues')

try {
  if (shouldCleanIssues) {
    await pool.query(`DELETE FROM public.workstation_issues WHERE id = 'd51bc5bf-433a-4d72-88f5-fb42b666a3b0'`)
    console.log('--- CLEANED TEST ISSUE ---')
  }

  if (shouldReset) {
    await pool.query(`
      UPDATE public.workstations 
      SET machine_guid = NULL, hardware_specs = NULL, last_seen_at = NULL 
      WHERE label = 'PC-01'
    `)
    console.log('--- RESET PC-01 TO NULL SUCCESS ---')
  }

  const res = await pool.query(`
    SELECT id, label, machine_guid, hardware_specs, last_seen_at 
    FROM public.workstations 
    WHERE label = 'PC-01' 
    LIMIT 1
  `)
  console.log('--- WORKSTATION ROW IN POSTGRESQL ---')
  console.log(JSON.stringify(res.rows[0], null, 2))
} catch (err) {
  console.error('Database query error:', err.message)
} finally {
  await pool.end()
}
