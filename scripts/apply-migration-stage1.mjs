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
    console.log('🚀 Applying Phase 4.5 Stage 1 DDL Migration...')
    const sqlPath = path.resolve(process.cwd(), 'scripts/migration-phase4-5-stage1-add-columns.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')

    await client.query(sql)
    console.log('✅ Stage 1 DDL executed successfully!')

    // Verification of added columns and constraints
    console.log('🔍 Verifying schema changes...')
    const cols = await client.query(`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'class_subjects' AND column_name = 'academic_year_id') OR
          (table_name = 'schedules' AND column_name = 'class_subject_id') OR
          (table_name = 'practical_logs' AND column_name = 'class_subject_id') OR
          (table_name = 'log_attendance' AND column_name = 'enrollment_id') OR
          (table_name = 'lab_incidents' AND column_name IN ('class_id', 'subject_id', 'subject_teacher_id'))
        )
      ORDER BY table_name, column_name;
    `)
    console.log('Verified Columns:', JSON.stringify(cols.rows, null, 2))

    const constraints = await client.query(`
      SELECT tc.table_name, tc.constraint_name, tc.constraint_type
      FROM information_schema.table_constraints tc
      WHERE tc.table_schema = 'public'
        AND tc.constraint_name IN (
          'uq_class_subject_teaching_assignment',
          'uq_student_enrollments_id_student',
          'fk_log_attendance_enrollment_student',
          'fk_practical_logs_schedule'
        )
      ORDER BY tc.table_name, tc.constraint_name;
    `)
    console.log('Verified Constraints:', JSON.stringify(constraints.rows, null, 2))

  } catch (err) {
    console.error('❌ Stage 1 Migration Failed:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
