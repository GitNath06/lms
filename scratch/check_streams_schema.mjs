import pg from 'pg'
const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function run() {
  const client = await pool.connect()
  try {
    const colRes = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'streams'
      ORDER BY ordinal_position;
    `)
    console.log('COLUMNS IN streams:\n', colRes.rows)
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(console.error)
