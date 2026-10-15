import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '../.env.local')

function resolveDatabaseUrl(rawUrl) {
  if (!rawUrl) return rawUrl
  if (rawUrl.includes('db.') && rawUrl.includes('.supabase.co')) {
    const match = rawUrl.match(/postgresql:\/\/([^:]+):(.+)@db\.([a-z0-9]+)\.supabase\.co(?::\d+)?\/(.+)$/)
    if (match) {
      const [, , pass, ref, db] = match
      return `postgresql://postgres.${ref}:${encodeURIComponent(pass)}@aws-0-ap-southeast-1.pooler.supabase.com:5432/${db}`
    }
  }
  return rawUrl
}

let databaseUrl = process.env.DATABASE_URL
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  const match = envContent.match(/DATABASE_URL=(.*)/)?.[1]?.trim().replace(/^['"]|['"]$/g, '')
  if (match) databaseUrl = match
}

const pool = new pg.Pool({
  connectionString: resolveDatabaseUrl(databaseUrl),
  ssl: { rejectUnauthorized: false }
})

async function check() {
  const client = await pool.connect()
  try {
    console.log('=== 1. RLS Status from pg_tables ===')
    const rlsRes = await client.query(`
      SELECT schemaname, tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public' AND tablename IN ('email_otps', 'email_dispatch_logs');
    `)
    console.log('RLS Status:', JSON.stringify(rlsRes.rows, null, 2))

    console.log('\n=== 2. Current Policies from pg_policies ===')
    const polRes = await client.query(`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename IN ('email_otps', 'email_dispatch_logs');
    `)
    console.log('Policies:', JSON.stringify(polRes.rows, null, 2))

    console.log('\n=== 3. Current Role Grants from information_schema.role_table_grants ===')
    const grantsRes = await client.query(`
      SELECT grantee, table_name, privilege_type
      FROM information_schema.role_table_grants
      WHERE table_name IN ('email_otps', 'email_dispatch_logs')
      ORDER BY table_name, grantee, privilege_type;
    `)
    console.table(grantsRes.rows)

    console.log('\n=== 4. Table Schema & Columns ===')
    const colsRes = await client.query(`
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name IN ('email_otps', 'email_dispatch_logs')
      ORDER BY table_name, ordinal_position;
    `)
    console.table(colsRes.rows)

    console.log('\n=== 5. Sample Rows from email_otps (checking plaintext vs hash) ===')
    const sampleOtp = await client.query(`
      SELECT id, email, otp_code, purpose, attempts, is_verified, expires_at, created_at
      FROM public.email_otps
      ORDER BY created_at DESC
      LIMIT 3;
    `)
    console.table(sampleOtp.rows)

  } finally {
    client.release()
    await pool.end()
  }
}

check().catch(e => {
  console.error(e)
  process.exit(1)
})
