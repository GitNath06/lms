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
    const polRes = await client.query(`
      SELECT tablename, policyname, roles, cmd, qual
      FROM pg_policies
      WHERE schemaname = 'public' AND (cmd = 'SELECT' OR cmd = 'ALL')
      ORDER BY tablename, cmd;
    `)
    console.log(`=== SELECT / ALL POLICIES (${polRes.rows.length} total) ===`)
    for (const p of polRes.rows) {
      console.log(`Table: ${p.tablename.padEnd(25)} | Cmd: ${p.cmd.padEnd(6)} | Roles: ${JSON.stringify(p.roles)} | Qual: ${p.qual}`)
    }
  } finally {
    client.release()
    await pool.end()
  }
}
main().catch(console.error)
