import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '../.env.local')
const migrationPath = path.resolve(__dirname, '../supabase/migrations/20260921_create_print_selection_tokens.sql')

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

const envContent = fs.readFileSync(envPath, 'utf8')
const rawUrl = envContent.match(/DATABASE_URL=(.*)/)?.[1]?.trim().replace(/^['"]|['"]$/g, '')
const resolvedUrl = resolveDatabaseUrl(rawUrl)

const pool = new pg.Pool({ connectionString: resolvedUrl, ssl: { rejectUnauthorized: false } })

async function applyMigration() {
  const client = await pool.connect()
  try {
    console.log('Reading migration file:', migrationPath)
    const sql = fs.readFileSync(migrationPath, 'utf8')

    console.log('Executing migration on Supabase PostgreSQL...')
    await client.query(sql)
    console.log('Migration applied successfully!')

    // Check table and RLS
    const tableRes = await client.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = 'print_selection_tokens';
    `)
    console.log('Table verification:', tableRes.rows)

    const grantsRes = await client.query(`
      SELECT grantee, privilege_type 
      FROM information_schema.role_table_grants 
      WHERE table_schema = 'public' AND table_name = 'print_selection_tokens' AND grantee IN ('anon', 'authenticated');
    `)
    console.log('Client grants (should be empty):', grantsRes.rows)
  } finally {
    client.release()
    await pool.end()
  }
}

applyMigration().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
