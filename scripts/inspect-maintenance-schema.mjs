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
  const plansCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'maintenance_plans'")
  console.log('maintenance_plans:', plansCols.rows)
  const logsCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'maintenance_logs'")
  console.log('maintenance_logs:', logsCols.rows)
  const existingPlans = await pool.query("SELECT id, title, lab_id, category, checklist FROM maintenance_plans LIMIT 5")
  console.log('sample plans:', existingPlans.rows)
  await pool.end()
}
run()
