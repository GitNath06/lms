import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const envPath = path.resolve(process.cwd(), '.env.local')
const content = fs.readFileSync(envPath, 'utf8')
let dbUrl = null

for (const line of content.split('\n')) {
  const trimmed = line.trim()
  if (trimmed.startsWith('DATABASE_URL=')) {
    dbUrl = trimmed.slice('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '')
    break
  }
}

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

async function check() {
  const client = await pool.connect()
  try {
    const res = await client.query(`
      SELECT trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'practical_logs';
    `)
    console.log('Triggers on practical_logs:', res.rows)

    const funcRes = await client.query(`
      SELECT p.proname, pg_get_functiondef(p.oid) as def
      FROM pg_proc p
      JOIN pg_trigger t ON t.tgfoid = p.oid
      JOIN pg_class c ON c.oid = t.tgrelid
      WHERE c.relname = 'practical_logs';
    `)
    for (const f of funcRes.rows) {
      console.log('Function:', f.proname)
      console.log('Def:\n', f.def)
    }

    const rlsRes = await client.query(`
      SELECT tablename, policyname, roles, cmd, qual
      FROM pg_policies
      WHERE tablename IN ('academic_years', 'classes', 'subjects', 'labs')
      ORDER BY tablename, policyname;
    `)
    console.log('RLS policies on metadata tables:', rlsRes.rows)
  } finally {
    client.release()
    await pool.end()
  }
}

check()
