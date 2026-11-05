import fs from 'fs'
import path from 'path'
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

async function checkProfiles() {
  const client = await pool.connect()
  try {
    console.log('=== TRIGGERS ON PROFILES ===')
    const trigRes = await client.query(`
      SELECT trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'profiles';
    `)
    console.log(trigRes.rows)

    console.log('=== COLUMN GRANTS ON PROFILES ===')
    const grantRes = await client.query(`
      SELECT grantee, privilege_type, column_name
      FROM information_schema.column_privileges
      WHERE table_name = 'profiles';
    `)
    console.log(grantRes.rows)

    console.log('=== PROFILES POLICIES ===')
    const polRes = await client.query(`
      SELECT policyname, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE tablename = 'profiles';
    `)
    console.log(polRes.rows)
  } finally {
    client.release()
    await pool.end()
  }
}

checkProfiles().catch(console.error)
