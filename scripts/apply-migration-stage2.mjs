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

if (!dbUrl) {
  console.error('❌ DATABASE_URL not found in .env.local')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

async function runStage2Migration() {
  const client = await pool.connect()
  try {
    console.log('🛡️ STEP 10 PRE-FLIGHT: Checking Stop-Gates before Stage 2 enforcement...')

    // 1. Check Step 06 Gates
    const gateRes = await client.query(`
      SELECT 
        (SELECT count(*) FROM public.schedules WHERE class_subject_id IS NULL) AS unlinked_schedules,
        (SELECT count(*) FROM public.practical_logs WHERE class_subject_id IS NULL) AS unlinked_logs,
        (SELECT count(*) FROM public.class_subjects WHERE academic_year_id IS NULL) AS unlinked_assignments,
        (SELECT count(*) FROM public.log_attendance WHERE enrollment_id IS NULL OR student_id IS NULL) AS unlinked_attendance;
    `)
    const gate = gateRes.rows[0]
    console.log(`Gate metrics:
  - unlinked_schedules: ${gate.unlinked_schedules}
  - unlinked_logs: ${gate.unlinked_logs}
  - unlinked_assignments: ${gate.unlinked_assignments}
  - unlinked_attendance: ${gate.unlinked_attendance}`)

    if (
      parseInt(gate.unlinked_schedules, 10) > 0 ||
      parseInt(gate.unlinked_logs, 10) > 0 ||
      parseInt(gate.unlinked_assignments, 10) > 0 ||
      parseInt(gate.unlinked_attendance, 10) > 0
    ) {
      console.error('❌ STOP-GATE TRIGGERED: Unlinked rows detected. Aborting Stage 2 migration.')
      process.exit(1)
    }

    console.log('✅ ALL PRE-FLIGHT STOP-GATES PASSED. Applying Stage 2 DDL Migration...')

    const sqlPath = path.resolve(process.cwd(), 'scripts/migration-phase4-5-stage2-enforce-integrity.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')

    await client.query(sql)

    console.log('✅ STAGE 2 DDL APPLIED SUCCESSFULLY!')

    // Verify NOT NULL status
    const verifyRes = await client.query(`
      SELECT 
        table_name, column_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'class_subjects' AND column_name = 'academic_year_id') OR
          (table_name = 'schedules' AND column_name = 'class_subject_id') OR
          (table_name = 'practical_logs' AND column_name = 'class_subject_id') OR
          (table_name = 'log_attendance' AND column_name IN ('enrollment_id', 'student_id'))
        )
      ORDER BY table_name, column_name;
    `)

    console.log('📋 Verified column nullability status:')
    for (const r of verifyRes.rows) {
      console.log(`  - ${r.table_name}.${r.column_name}: is_nullable = ${r.is_nullable}`)
      if (r.is_nullable !== 'NO') {
        throw new Error(`Column ${r.table_name}.${r.column_name} is still nullable!`)
      }
    }

    console.log('🎉 ALL NOT NULL INVARIANTS CONFIRMED!')
  } catch (err) {
    console.error('❌ Stage 2 migration failed:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

runStage2Migration()
