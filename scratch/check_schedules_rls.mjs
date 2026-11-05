import pg from 'pg'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})

const { rows } = await pool.query(`
  SELECT id, title, target_role, severity, is_read, created_at 
  FROM public.lab_notifications 
  ORDER BY created_at DESC 
  LIMIT 25;
`)
console.table(rows)

await pool.end()
