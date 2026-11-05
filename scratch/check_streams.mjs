import pg from 'pg'
const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function run() {
  const client = await pool.connect()
  try {
    const res = await client.query('SELECT * FROM public.streams;')
    console.log('STREAMS IN DB:\n', res.rows)
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(console.error)
