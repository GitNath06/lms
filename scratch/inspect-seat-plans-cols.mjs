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
  const { rows } = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'workstation_seat_plans' ORDER BY ordinal_position")
  console.table(rows)
  const sample = await pool.query("SELECT * FROM workstation_seat_plans LIMIT 3")
  console.log('Sample rows:', sample.rows)
  await pool.end()
}
run()
