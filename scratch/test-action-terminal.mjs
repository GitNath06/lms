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

function parseScheduleTimeToMinutes(timeStr) {
  if (!timeStr) return 0
  const parts = timeStr.trim().split(':')
  let hours = parseInt(parts[0], 10) || 0
  const mins = parseInt(parts[1], 10) || 0
  if (hours >= 1 && hours <= 6) {
    hours += 12
  }
  return hours * 60 + mins
}

// Target: Tuesday 2:46 PM Nepal time (2026-09-29 14:46:00 NPT)
// In UTC: 2026-09-29 09:01:00 UTC
const targetDate = new Date('2026-09-29T09:01:00.000Z')

const nptMs = targetDate.getTime() + 5.75 * 3600000
const nptDate = new Date(nptMs)
const dayIndex = nptDate.getUTCDay()
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const dayKey = DAY_KEYS[dayIndex]
const currentMinutes = nptDate.getUTCHours() * 60 + nptDate.getUTCMinutes()
const year = nptDate.getUTCFullYear()
const month = String(nptDate.getUTCMonth() + 1).padStart(2, '0')
const day = String(nptDate.getUTCDate()).padStart(2, '0')
const effectiveDateStr = `${year}-${month}-${day}`

console.log('Target NPT Date:', { effectiveDateStr, dayKey, currentMinutes })

// Query schedules for Tuesday in comp lab
const scheduleQuery = `
  SELECT 
    s.id,
    s.subject_name,
    s.batch_name,
    s.start_time,
    s.end_time,
    s.status,
    s.class_subject_id,
    cs.class_id,
    cs.academic_year_id,
    p.full_name as teacher_name
  FROM public.schedules s
  LEFT JOIN public.class_subjects cs ON cs.id = s.class_subject_id
  LEFT JOIN public.profiles p ON p.id = s.teacher_id
  WHERE s.lab_id = 'comp' 
    AND LOWER(s.day_key) = LOWER($1)
  ORDER BY s.start_time ASC
`
const schedRes = await pool.query(scheduleQuery, [dayKey])
console.log('Tuesday schedules count:', schedRes.rows.length)

let activeSessionRow = null
for (const row of schedRes.rows) {
  const startMin = parseScheduleTimeToMinutes(row.start_time)
  const endMin = parseScheduleTimeToMinutes(row.end_time)
  console.log(`Slot ${row.id} (${row.subject_name}): ${row.start_time} (${startMin}m) to ${row.end_time} (${endMin}m) | current: ${currentMinutes}m`)
  if (currentMinutes >= startMin && currentMinutes < endMin) {
    activeSessionRow = row
    break
  }
}
console.log('Active session row matched:', activeSessionRow?.subject_name, activeSessionRow?.id)

// Check PC-01 student for active class
if (activeSessionRow) {
  const classId = activeSessionRow.class_id
  const wsRes = await pool.query(`SELECT id FROM public.workstations WHERE label = 'PC-01'`)
  const wsId = wsRes.rows[0]?.id
  const seatRes = await pool.query(`
    SELECT sp.id, e.roll_number, st.full_name, c.name as class_name
    FROM public.workstation_seat_plans sp
    JOIN public.student_enrollments e ON e.id = sp.enrollment_id
    JOIN public.students st ON st.id = e.student_id
    LEFT JOIN public.classes c ON c.id = sp.class_id
    WHERE sp.workstation_id = $1 AND sp.class_id = $2
  `, [wsId, classId])
  console.log('Enrolled student on PC-01 for active session:', seatRes.rows[0])
}

await pool.end()
