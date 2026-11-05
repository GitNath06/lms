import fs from 'fs'
import path from 'path'
import pg from 'pg'
import crypto from 'crypto'

const envPath = path.resolve(process.cwd(), '.env.local')
const content = fs.readFileSync(envPath, 'utf8')
for (const line of content.split('\n')) {
  const trimmed = line.trim()
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const idx = trimmed.indexOf('=')
    const key = trimmed.slice(0, idx).trim()
    const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
}
function resolveDatabaseUrl(rawUrl) {
  if (!rawUrl) return rawUrl
  const match = rawUrl.match(/postgresql:\/\/([^:]+):(.+)@db\.([a-z0-9]+)\.supabase\.co(?::\d+)?\/(.+)$/)
  if (match) {
    const [, , pass, ref, db] = match
    return 'postgresql://postgres.' + ref + ':' + encodeURIComponent(decodeURIComponent(pass)) + '@aws-0-ap-southeast-1.pooler.supabase.com:5432/' + db
  }
  return rawUrl
}
const pool = new pg.Pool({ connectionString: resolveDatabaseUrl(process.env.DATABASE_URL), ssl: { rejectUnauthorized: false } })

try {
  // 1. Get Class 10 unenrolled students sorted by admission_no
  const studentsRes = await pool.query(`
    SELECT s.id, s.admission_no, s.full_name
    FROM public.students s
    LEFT JOIN public.student_enrollments e ON e.student_id = s.id AND e.class_id = '10eng'
    WHERE e.id IS NULL AND s.admission_no LIKE 'ADM-2083-01%'
    ORDER BY s.admission_no ASC
  `)
  console.log(`Found ${studentsRes.rows.length} Class 10 students to enroll.`)

  // 2. Get workstations for comp lab sorted by label numerically
  const wsRes = await pool.query(`
    SELECT id, label 
    FROM public.workstations 
    WHERE lab_id = 'comp' AND is_active = true
  `)
  const sortedStations = wsRes.rows.sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' })
  )
  console.log(`Found ${sortedStations.length} workstations in comp lab.`)

  // 3. Begin transaction
  await pool.query('BEGIN')

  for (let i = 0; i < studentsRes.rows.length; i++) {
    const student = studentsRes.rows[i]
    const rollNumber = i + 1
    const enrollmentId = crypto.randomUUID()

    // Insert student_enrollment
    await pool.query(`
      INSERT INTO public.student_enrollments (id, academic_year_id, class_id, student_id, roll_number, section, status, created_at, updated_at)
      VALUES ($1, '2083', '10eng', $2, $3, 'A', 'active', NOW(), NOW())
    `, [enrollmentId, student.id, rollNumber])

    // Assign to workstation if available
    if (i < sortedStations.length) {
      const station = sortedStations[i]
      const planId = crypto.randomUUID()
      await pool.query(`
        INSERT INTO public.workstation_seat_plans (id, lab_id, academic_year_id, class_id, workstation_id, enrollment_id, created_at, updated_at)
        VALUES ($1, 'comp', '2083', '10eng', $2, $3, NOW(), NOW())
      `, [planId, station.id, enrollmentId])

      if (i < 5 || i === studentsRes.rows.length - 1) {
        console.log(`Enrolled & Seated: Roll ${rollNumber} (${student.full_name}) -> ${station.label}`)
      }
    }
  }

  await pool.query('COMMIT')
  console.log('Successfully enrolled Class 10 students and created baseline seat plan!')
} catch (err) {
  await pool.query('ROLLBACK')
  console.error('Error seeding Class 10:', err)
} finally {
  await pool.end()
}
