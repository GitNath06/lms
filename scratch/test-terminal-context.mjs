import fs from 'fs'
import path from 'path'
import pg from 'pg'

const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=')
      const key = trimmed.slice(0, idx).trim()
      const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
      if (!process.env[key]) {
        process.env[key] = val
      }
    }
  }
}

function resolveDatabaseUrl(rawUrl) {
  if (!rawUrl) return rawUrl
  if (rawUrl.includes('db.') && rawUrl.includes('.supabase.co')) {
    const match = rawUrl.match(/postgresql:\/\/([^:]+):(.+)@db\.([a-z0-9]+)\.supabase\.co(?::\d+)?\/(.+)$/)
    if (match) {
      const [, , pass, ref, db] = match
      const decodedPass = decodeURIComponent(pass)
      return `postgresql://postgres.${ref}:${encodeURIComponent(decodedPass)}@aws-0-ap-southeast-1.pooler.supabase.com:5432/${db}`
    }
  }
  return rawUrl
}

const pool = new pg.Pool({ connectionString: resolveDatabaseUrl(process.env.DATABASE_URL), ssl: { rejectUnauthorized: false } })

// Let's check what schedules exist in public.schedules
// And check workstation_seat_plans for PC-01!
try {
  const wsRes = await pool.query(`SELECT id, label FROM public.workstations WHERE label = 'PC-01'`)
  const wsId = wsRes.rows[0]?.id
  console.log('Workstation PC-01 ID:', wsId)

  const seatPlans = await pool.query(`
    SELECT sp.id, sp.class_id, sp.academic_year_id, e.roll_number, st.full_name, c.name as class_name
    FROM public.workstation_seat_plans sp
    JOIN public.student_enrollments e ON e.id = sp.enrollment_id
    JOIN public.students st ON st.id = e.student_id
    LEFT JOIN public.classes c ON c.id = sp.class_id
    WHERE sp.workstation_id = $1
  `, [wsId])
  console.log('Seat plans for PC-01:')
  console.table(seatPlans.rows)

  // Check schedules and their class_id
  const scheds = await pool.query(`
    SELECT s.id, s.subject_name, s.day_key, s.start_time, s.end_time, cs.class_id, cs.academic_year_id
    FROM public.schedules s
    LEFT JOIN public.class_subjects cs ON cs.id = s.class_subject_id
    WHERE s.id IN ('tue-5', 'fri-4b')
  `)
  console.log('Schedules tue-5 vs fri-4b:')
  console.table(scheds.rows)
} catch (e) {
  console.error(e)
} finally {
  await pool.end()
}
