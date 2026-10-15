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

async function runAudit() {
  const client = await pool.connect()
  try {
    console.log('🔍 STEP 09: Running Attendance Classification Audit...')

    const query = `
      SELECT 
        la.id,
        la.log_id,
        la.student_id,
        la.roll_number,
        la.enrollment_id,
        pl.date AS session_date,
        pl.batch_group,
        pl.class_subject_id
      FROM public.log_attendance la
      LEFT JOIN public.practical_logs pl ON pl.id = la.log_id;
    `
    const res = await client.query(query)
    const rows = res.rows

    console.log(`📊 Found ${rows.length} rows in public.log_attendance.`)

    const activeEnrollmentsRes = await client.query(`
      SELECT se.id as enrollment_id, se.student_id, se.academic_year_id, se.class_id, se.roll_number
      FROM public.student_enrollments se
      WHERE se.status = 'active';
    `)
    const enrollments = activeEnrollmentsRes.rows

    const classified = {
      valid: [],
      recoverable: [],
      legacySynthetic: [],
      orphaned: [],
    }

    for (const row of rows) {
      if (row.enrollment_id && row.student_id) {
        // Check if student_id matches enrollment
        const match = enrollments.find(e => e.enrollment_id === row.enrollment_id && e.student_id === row.student_id)
        if (match) {
          classified.valid.push(row)
        } else {
          classified.orphaned.push({ ...row, reason: 'enrollment_id and student_id mismatch' })
        }
      } else if (!row.log_id) {
        classified.orphaned.push({ ...row, reason: 'missing log_id' })
      } else if (row.roll_number) {
        // Try to match active enrollment
        // If row has student_id or roll_number matching practical_logs cohort
        const matches = enrollments.filter(e => e.roll_number === row.roll_number)
        if (matches.length === 1) {
          classified.recoverable.push({ ...row, matchedEnrollment: matches[0] })
        } else if (matches.length === 0 && !row.student_id) {
          classified.legacySynthetic.push(row)
        } else {
          classified.orphaned.push({ ...row, reason: `ambiguous roll_number match count: ${matches.length}` })
        }
      } else {
        classified.legacySynthetic.push(row)
      }
    }

    const report = {
      timestamp: new Date().toISOString(),
      totalRows: rows.length,
      counts: {
        valid: classified.valid.length,
        recoverable: classified.recoverable.length,
        legacySynthetic: classified.legacySynthetic.length,
        orphaned: classified.orphaned.length,
      },
      details: classified,
    }

    const outPath = path.resolve(process.cwd(), 'scratch/attendance-classification-report.json')
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2))
    console.log(`📝 Classification report saved to ${outPath}`)
    console.log(`Results summary: Valid: ${report.counts.valid}, Recoverable: ${report.counts.recoverable}, Legacy-Synthetic: ${report.counts.legacySynthetic}, Orphaned: ${report.counts.orphaned}`)

    return report
  } finally {
    client.release()
    await pool.end()
  }
}

runAudit().catch(err => {
  console.error('Audit failed:', err)
  process.exit(1)
})
