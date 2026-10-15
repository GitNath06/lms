import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const envPath = path.resolve(process.cwd(), '.env.local')
const content = fs.readFileSync(envPath, 'utf8')
const dbUrl = content.split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=')[1].trim().replace(/^['"]|['"]$/g, '')

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

async function inspectFunc() {
  const client = await pool.connect()
  try {
    const res = await client.query(`
      SELECT pg_get_functiondef(oid) as def
      FROM pg_proc
      WHERE proname = 'current_role';
    `)
    console.log('current_role() DEFINITION:\n', res.rows[0]?.def)
  } finally {
    client.release()
    await pool.end()
  }
}

inspectFunc()
