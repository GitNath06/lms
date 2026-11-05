import pg from 'pg'
const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function run() {
  const client = await pool.connect()
  try {
    const res = await client.query(`
      SELECT class_id, count(*), array_agg(DISTINCT section) as sections
      FROM public.student_enrollments
      GROUP BY class_id;
    `)
    console.log('ENROLLMENTS BY CLASS_ID:\n', res.rows)
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(console.error)
