import pg from 'pg'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})

const del = await pool.query("DELETE FROM public.labs WHERE id IN ('bio', 'elec');")
console.log('Purged legacy labs rows:', del.rowCount)

const { rows } = await pool.query('SELECT id, name, code, type, status, is_active FROM public.labs ORDER BY created_at ASC')
console.log('CURRENT ACTIVE LABS:')
console.table(rows)
await pool.end()
