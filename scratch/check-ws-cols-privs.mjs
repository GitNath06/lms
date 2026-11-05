import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

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

if (dbUrl && dbUrl.includes('db.') && dbUrl.includes('.supabase.co')) {
  const match = dbUrl.match(/postgresql:\/\/([^:]+):(.+)@db\.([a-z0-9]+)\.supabase\.co(?::\d+)?\/(.+)$/)
  if (match) {
    const [, , pass, ref, db] = match
    const decodedPass = decodeURIComponent(pass)
    dbUrl = `postgresql://postgres.${ref}:${encodeURIComponent(decodedPass)}@aws-0-ap-southeast-1.pooler.supabase.com:5432/${db}`
  }
}

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

async function main() {
  const client = await pool.connect()
  try {
    const res = await client.query(`
      SELECT grantee, privilege_type, column_name
      FROM information_schema.column_privileges
      WHERE table_name = 'workstations'
      ORDER BY column_name;
    `)
    console.log('workstations column privileges count:', res.rows.length)
    if (res.rows.length > 0) {
      console.log(res.rows)
    } else {
      console.log('No specific column privileges (all columns inherit table-level SELECT for grantee roles)!')
    }
  } finally {
    client.release()
    await pool.end()
  }
}
main().catch(console.error)
