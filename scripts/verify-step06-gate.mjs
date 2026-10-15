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
    console.log('🛡️ STEP 06: EXECUTING COMPREHENSIVE STOP-GATE VERIFICATION...')

    const res = await client.query(`
      SELECT 
        (SELECT count(*) FROM public.schedules WHERE class_subject_id IS NULL) AS unlinked_schedules,
        (SELECT count(*) FROM public.practical_logs WHERE class_subject_id IS NULL) AS unlinked_logs,
        (SELECT count(*) FROM public.class_subjects WHERE academic_year_id IS NULL) AS unlinked_assignments;
    `)

    const row = res.rows[0]
    const unlinkedSchedules = parseInt(row.unlinked_schedules, 10)
    const unlinkedLogs = parseInt(row.unlinked_logs, 10)
    const unlinkedAssignments = parseInt(row.unlinked_assignments, 10)

    console.log(`- Unlinked Schedules: ${unlinkedSchedules}`)
    console.log(`- Unlinked Practical Logs: ${unlinkedLogs}`)
    console.log(`- Unlinked Teaching Assignments: ${unlinkedAssignments}`)

    const failures = []
    if (unlinkedSchedules > 0) failures.push(`${unlinkedSchedules} unlinked schedules`)
    if (unlinkedLogs > 0) failures.push(`${unlinkedLogs} unlinked practical logs`)
    if (unlinkedAssignments > 0) failures.push(`${unlinkedAssignments} unlinked assignments`)

    if (failures.length > 0) {
      fs.writeFileSync('scratch/reconciliation-gate-failures.json', JSON.stringify({
        unlinkedSchedules,
        unlinkedLogs,
        unlinkedAssignments,
        failures
      }, null, 2))
      console.error(`❌ STOP-GATE TRIGGERED: Found ${failures.join(', ')}. Halting migration.`)
      process.exit(1)
    }

    console.log('✅ STEP 06 STOP-GATE PASSED! Zero unlinked schedules, logs, and assignments.')
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
