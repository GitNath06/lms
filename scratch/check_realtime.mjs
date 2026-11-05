import pg from 'pg'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})

const { rows } = await pool.query("SELECT value FROM public.institution_settings WHERE key = 'calendar_settings';")
console.log('VALUE:', rows[0]?.value)

await pool.end()
