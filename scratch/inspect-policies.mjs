import pg from 'pg'

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

const pool = new pg.Pool({
  connectionString: resolveDatabaseUrl(process.env.DATABASE_URL),
  ssl: { rejectUnauthorized: false },
})

import fs from 'fs'

async function run() {
  const sql = fs.readFileSync('supabase/migrations/20261015_harden_rls_policies.sql', 'utf8')
  console.log('Applying RLS Hardening Migration...')
  await pool.query(sql)
  console.log('Migration applied successfully!')

  const policies = await pool.query(`
    SELECT tablename, policyname, permissive, roles, cmd, qual
    FROM pg_policies 
    WHERE tablename IN ('labs', 'schedules', 'students', 'student_enrollments')
    ORDER BY tablename, cmd
  `)
  console.log(JSON.stringify(policies.rows, null, 2))
  await pool.end()
}

run().catch(console.error)
