import fs from 'node:fs'
import path from 'node:path'

const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
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
  const years = await pool.query('SELECT id, name, is_current, start_date, end_date FROM academic_years ORDER BY id DESC')
  console.log('--- ACADEMIC YEARS ---')
  console.table(years.rows)

  const classes = await pool.query('SELECT * FROM classes')
  console.log('--- CLASSES ---')
  console.table(classes.rows)

  const enrollments = await pool.query(`
    SELECT academic_year_id, status, count(*) 
    FROM student_enrollments 
    GROUP BY academic_year_id, status 
    ORDER BY academic_year_id DESC, status
  `)
  console.log('--- ENROLLMENTS BY YEAR & STATUS ---')
  console.table(enrollments.rows)

  const trashAndArchive = await pool.query(`
    SELECT 
      is_active, 
      archive_reason, 
      count(*) 
    FROM students 
    GROUP BY is_active, archive_reason
  `)
  console.log('--- STUDENTS STATUS & ARCHIVE REASONS ---')
  console.table(trashAndArchive.rows)

  const logs = await pool.query(`
    SELECT 
      academic_year_id, 
      count(*) as session_count,
      sum(case when status = 'conducted' then 1 else 0 end) as conducted_count
    FROM practical_logs 
    GROUP BY academic_year_id 
    ORDER BY academic_year_id DESC
  `)
  console.log('--- PRACTICAL LOGS BY YEAR ---')
  console.table(logs.rows)

} catch (err) {
  console.error('Inspection error:', err)
} finally {
  await pool.end()
}
