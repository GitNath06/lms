import pg from 'pg'

const { Pool } = pg

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL not set')
  process.exit(1)
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

async function run() {
  const client = await pool.connect()
  try {
    const res = await client.query('SELECT id, name, grade, section, stream_id, capacity, is_active FROM public.classes ORDER BY grade DESC, name ASC;')
    console.log('CLASSES IN DB:\n', JSON.stringify(res.rows, null, 2))
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
