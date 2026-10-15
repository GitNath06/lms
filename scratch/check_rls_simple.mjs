import fs from 'fs'
import pg from 'pg'

const env = fs.readFileSync('.env.local', 'utf8')
const match = env.match(/postgresql:\/\/([^:]+):(.+)@db\.([a-z0-9]+)\.supabase\.co(?::\d+)?\/(.+)$/m)
const url = match ? `postgresql://postgres.${match[3]}:${encodeURIComponent(match[2])}@aws-0-ap-southeast-1.pooler.supabase.com:5432/${match[4]}` : ''
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } })

const c = await pool.connect()
const r1 = await c.query("SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('email_otps', 'email_dispatch_logs');")
console.log('TABLES:', r1.rows)
const r2 = await c.query("SELECT policyname, tablename, cmd, roles FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('email_otps', 'email_dispatch_logs');")
console.log('POLICIES:', r2.rows)
c.release()
await pool.end()
