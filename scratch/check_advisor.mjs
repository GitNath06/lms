import fs from 'fs'
import pg from 'pg'

const env = fs.readFileSync('.env.local', 'utf8')
const match = env.match(/postgresql:\/\/([^:]+):(.+)@db\.([a-z0-9]+)\.supabase\.co(?::\d+)?\/(.+)$/m)
const url = match ? `postgresql://postgres.${match[3]}:${encodeURIComponent(match[2])}@aws-0-ap-southeast-1.pooler.supabase.com:5432/${match[4]}` : ''
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } })

const c = await pool.connect()
const res = await c.query(`
  SELECT c.relname, c.relrowsecurity
  FROM pg_class c 
  JOIN pg_namespace n ON n.oid = c.relnamespace 
  WHERE c.relkind = 'r' AND n.nspname = 'public' AND NOT c.relrowsecurity
  ORDER BY c.relname;
`)
console.log('Tables without RLS (Advisor Critical Findings):', res.rows)
c.release()
await pool.end()
