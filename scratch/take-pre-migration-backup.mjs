import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const envPath = path.resolve(process.cwd(), '.env.local')
const content = fs.readFileSync(envPath, 'utf8')
let dbUrl = null

for (const line of content.split('\n')) {
  const trimmed = line.trim()
  if (trimmed.startsWith('DATABASE_URL=')) {
    dbUrl = trimmed.slice('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '')
    break
  }
}

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

async function run() {
  const client = await pool.connect()
  try {
    console.log('🔄 Taking pre-migration snapshot of operational tables...')
    const tables = [
      'schedules', 'class_subjects', 'practical_logs', 'log_attendance',
      'classes', 'subjects', 'profiles', 'student_enrollments'
    ]
    const backup = {}
    for (const t of tables) {
      const res = await client.query(`SELECT * FROM public.${t};`)
      backup[t] = res.rows
      console.log(`- Backed up ${t}: ${res.rows.length} rows`)
    }
    fs.writeFileSync('scratch/pre-phase4-5-data-backup.json', JSON.stringify(backup, null, 2))
    console.log('✅ Pre-migration data snapshot saved to scratch/pre-phase4-5-data-backup.json')
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(err => {
  console.error('❌ Backup error:', err)
  process.exit(1)
})
