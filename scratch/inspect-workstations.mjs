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
  const countRes = await pool.query("SELECT count(*), min(label), max(label) FROM workstations WHERE lab_id = 'comp' AND is_active = true")
  console.log('Workstation counts:', countRes.rows[0])
  const sample = await pool.query("SELECT id, label, pos_x, pos_y, row_label FROM workstations WHERE lab_id = 'comp' AND is_active = true ORDER BY label ASC LIMIT 10")
  console.table(sample.rows)
  await pool.end()
}
run()
