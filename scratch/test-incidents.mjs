import pg from 'pg'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})

const start = Date.now()
const { rows } = await pool.query(`
  SELECT id, title, incident_type, equipment_name, lab_id, session_label,
         subject_name, subject_teacher_name, batch_name, date,
         circumstances, quantity, severity, status, resolution_notes,
         escalated_to_hod, fine_paid, photo_url, reported_by,
         reported_by_id, resolved_by_id, resolved_at, created_at
  FROM public.lab_incidents
  ORDER BY created_at DESC LIMIT 100
`)
const elapsed = Date.now() - start
console.log(`Query returned ${rows.length} rows in ${elapsed}ms!`)
await pool.end()

