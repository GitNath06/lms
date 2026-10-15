import pg from 'pg'
import fs from 'node:fs'
import path from 'node:path'

const envPath = path.resolve(process.cwd(), '.env.local')
const content = fs.readFileSync(envPath, 'utf8')
let dbUrl = ''
for (const line of content.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) {
    dbUrl = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '')
  }
}
const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

async function run() {
  console.log('--- Phase 1: Zero-Login Student Terminal Migration ---')
  
  // 1. Add lan_ip and pairing_token to public.workstations
  console.log('Adding lan_ip and pairing_token to public.workstations...')
  await pool.query(`
    ALTER TABLE public.workstations
    ADD COLUMN IF NOT EXISTS lan_ip text,
    ADD COLUMN IF NOT EXISTS pairing_token text;
  `)

  // 2. Adjust public.workstation_issues to allow zero-login student reports
  console.log('Updating public.workstation_issues for student self-reporting...')
  await pool.query(`
    ALTER TABLE public.workstation_issues
    ALTER COLUMN reported_by_id DROP NOT NULL;

    ALTER TABLE public.workstation_issues
    ADD COLUMN IF NOT EXISTS source text DEFAULT 'staff',
    ADD COLUMN IF NOT EXISTS student_name text,
    ADD COLUMN IF NOT EXISTS student_roll text;
  `)

  // 3. Verify columns
  const wsCols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'workstations' AND column_name IN ('lan_ip', 'pairing_token');
  `)
  console.log('Workstation columns verified:', wsCols.rows)

  const issueCols = await pool.query(`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'workstation_issues' AND column_name IN ('reported_by_id', 'source', 'student_name', 'student_roll');
  `)
  console.log('Workstation issues columns verified:', issueCols.rows)

  await pool.end()
  console.log('Migration completed successfully!')
  process.exit(0)
}

run().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
