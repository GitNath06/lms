import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const envPath = path.resolve(process.cwd(), '.env.local')
const content = fs.readFileSync(envPath, 'utf8')
const dbUrl = content.split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=')[1].trim().replace(/^['"]|['"]$/g, '')

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

async function inspectWorkstationPolicies() {
  const client = await pool.connect()
  try {
    const res = await client.query(`
      SELECT tablename, policyname, cmd, qual, with_check 
      FROM pg_policies 
      WHERE tablename = 'workstations';
    `)
    console.log('WORKSTATIONS POLICIES:\n', res.rows)
  } finally {
    client.release()
    await pool.end()
  }
}

inspectWorkstationPolicies()
