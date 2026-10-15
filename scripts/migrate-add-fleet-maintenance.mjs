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
  console.log('Adding affected_machines and fleet_progress columns to public.maintenance_plans...')
  await pool.query(`
    ALTER TABLE public.maintenance_plans
    ADD COLUMN IF NOT EXISTS affected_machines text[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS fleet_progress jsonb DEFAULT '{}'::jsonb;
  `)
  console.log('Successfully added columns to public.maintenance_plans.')

  // Check columns
  const res = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'maintenance_plans' AND column_name IN ('affected_machines', 'fleet_progress');
  `)
  console.log('Columns verified in DB:', res.rows)
  await pool.end()
}
run()
