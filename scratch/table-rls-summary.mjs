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
    const tablesRes = await client.query(`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `)
    
    console.log(`TOTAL PUBLIC TABLES: ${tablesRes.rows.length}`)
    for (const t of tablesRes.rows) {
      const polCount = await client.query(
        `SELECT COUNT(*)::int as count FROM pg_policies WHERE schemaname = 'public' AND tablename = $1`,
        [t.tablename]
      )
      console.log(`- ${t.tablename.padEnd(28)} | RLS: ${t.rowsecurity ? 'ENABLED' : 'DISABLED'} | Policies: ${polCount.rows[0].count}`)
    }
  } finally {
    client.release()
    await pool.end()
  }
}
main().catch(console.error)
