import pg from 'pg'
const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function run() {
  const client = await pool.connect()
  try {
    await client.query("UPDATE public.classes SET name = '12 Eng' WHERE id = '12eng'")
    console.log('Fixed 12 Eng name!')
  } finally {
    client.release()
    await pool.end()
  }
}

run()
