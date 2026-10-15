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
  console.log('Adding seating_snapshot column to public.practical_logs...')
  await pool.query(`
    ALTER TABLE public.practical_logs
    ADD COLUMN IF NOT EXISTS seating_snapshot jsonb;
  `)
  console.log('Successfully ensured seating_snapshot column exists on practical_logs.')
  await pool.end()
}
run()
