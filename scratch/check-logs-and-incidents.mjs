import fs from 'node:fs'
import path from 'node:path'

const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=')
      const k = trimmed.slice(0, idx).trim()
      const v = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
      if (!process.env[k]) process.env[k] = v
    }
  }
}

const { getPgPool } = await import('../lib/db.ts')
const pool = getPgPool()

try {
  const logs = await pool.query('SELECT id, practical_title, batch_group, subject_name, academic_year_id, date, created_at FROM practical_logs ORDER BY date DESC')
  console.log('--- PRACTICAL LOGS IN DB ---')
  console.table(logs.rows)

  const incidents = await pool.query('SELECT id, equipment_name, incident_type, severity, status, created_at FROM lab_incidents ORDER BY created_at DESC')
  console.log('--- INCIDENTS IN DB ---')
  console.table(incidents.rows)
} finally {
  await pool.end()
}
