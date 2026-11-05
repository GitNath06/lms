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
    const r1 = await client.query('SELECT COUNT(*)::int as cnt FROM public.audit_logs')
    const r2 = await client.query('SELECT COUNT(*)::int as cnt FROM public.audit_ledger')
    console.log(`audit_logs count: ${r1.rows[0].cnt}, audit_ledger count: ${r2.rows[0].cnt}`)
    
    // Check columns of both
    const c1 = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'audit_logs'`)
    const c2 = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'audit_ledger'`)
    console.log('audit_logs columns:', c1.rows.map(c => c.column_name))
    console.log('audit_ledger columns:', c2.rows.map(c => c.column_name))
  } finally {
    client.release()
    await pool.end()
  }
}
main().catch(console.error)
