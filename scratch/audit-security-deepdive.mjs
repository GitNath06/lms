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

async function run() {
  const client = await pool.connect()
  try {
    console.log('--- 1. TABLES WITH RLS DISABLED ---')
    const rlsDisabled = await client.query(`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public' AND rowsecurity = false;
    `)
    console.log(rlsDisabled.rows)

    console.log('\n--- 2. POLICIES WITH WIDE / PERMISSIVE ACCESS (cmd != SELECT or roles includes anon/public or qual = true) ---')
    const polRes = await client.query(`
      SELECT tablename, policyname, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, cmd;
    `)
    
    const writePolicies = polRes.rows.filter(p => p.cmd !== 'SELECT')
    console.log(`Total policies: ${polRes.rows.length}, Write policies (INSERT/UPDATE/DELETE/ALL): ${writePolicies.length}`)
    console.log(JSON.stringify(writePolicies, null, 2))

    console.log('\n--- 3. TABLE GRANTS TO anon AND authenticated ---')
    const grantsRes = await client.query(`
      SELECT grantee, table_name, privilege_type
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
      ORDER BY table_name, grantee, privilege_type;
    `)
    console.log(`Total role table grants: ${grantsRes.rows.length}`)
    const anonGrants = grantsRes.rows.filter(g => g.grantee === 'anon')
    console.log('Anon grants count:', anonGrants.length)
    console.log(anonGrants)

    console.log('\n--- 4. AUDIT LEDGER POLICIES & CONSTRAINTS ---')
    const auditPol = polRes.rows.filter(p => p.tablename === 'audit_ledger')
    console.log('Audit ledger policies:', auditPol)

    console.log('\n--- 5. ALL DATABASE TRIGGERS IN PUBLIC SCHEMA ---')
    const trigRes = await client.query(`
      SELECT trigger_name, event_object_table, event_manipulation, action_statement
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
      ORDER BY event_object_table;
    `)
    console.log('Triggers:', trigRes.rows)

    console.log('\n--- 6. RECENT PRACTICAL LOGS SAMPLE & VERIFICATION STAMPS ---')
    const logCols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'practical_logs'
      ORDER BY ordinal_position;
    `)
    console.log('practical_logs columns:', logCols.rows.map(c => `${c.column_name} (${c.data_type})`).join(', '))

  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(console.error)
