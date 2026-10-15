import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '../.env.local')
const migrationPath = path.resolve(__dirname, '../supabase/migrations/20260921_harden_email_tables_rls.sql')

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
    console.log('🚀 Reading migration file:', migrationPath)
    const sql = fs.readFileSync(migrationPath, 'utf8')

    console.log('Executing migration on live Supabase PostgreSQL...')
    await client.query(sql)
    console.log('✅ Migration applied successfully!')
  } finally {
    client.release()
    await pool.end()
  }
}

applyMigration().catch(err => {
  console.error('❌ Migration failed:', err)
  process.exit(1)
})
