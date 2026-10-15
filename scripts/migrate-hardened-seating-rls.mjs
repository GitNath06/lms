import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const envPath = path.resolve(process.cwd(), '.env.local')
const content = fs.readFileSync(envPath, 'utf8')
const dbUrl = content.split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=')[1].trim().replace(/^['"]|['"]$/g, '')

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

const SQL = `
-- 1. HARDEN WORKSTATION SEAT PLANS RLS
-- Read: Privileged sees all; Teachers see only classes/schedules assigned to them
-- Write: ONLY Super Admin / Lab In-Charge / HOD (is_privileged). Teachers CANNOT modify!
DROP POLICY IF EXISTS "manage_workstation_seat_plans_scoped" ON public.workstation_seat_plans;
DROP POLICY IF EXISTS "manage_workstation_seat_plans_privileged" ON public.workstation_seat_plans;

CREATE POLICY "manage_workstation_seat_plans_privileged" ON public.workstation_seat_plans
  FOR ALL TO authenticated
  USING ( public.is_privileged() )
  WITH CHECK ( public.is_privileged() );

-- 2. HARDEN SESSION SEAT OVERRIDES RLS
-- Read: Privileged sees all; Teachers see only their assigned sessions
-- Write: ONLY Super Admin / Lab In-Charge / HOD (is_privileged). Teachers CANNOT modify!
DROP POLICY IF EXISTS "manage_session_seat_overrides_scoped" ON public.session_seat_overrides;
DROP POLICY IF EXISTS "manage_session_seat_overrides_privileged" ON public.session_seat_overrides;

CREATE POLICY "manage_session_seat_overrides_privileged" ON public.session_seat_overrides
  FOR ALL TO authenticated
  USING ( public.is_privileged() )
  WITH CHECK ( public.is_privileged() );
`

async function run() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(SQL)
    await client.query('COMMIT')
    console.log('✅ Successfully hardened seating RLS policies in PostgreSQL!')

    const res = await client.query(`
      SELECT tablename, policyname, cmd, qual, with_check
      FROM pg_policies
      WHERE tablename IN ('workstation_seat_plans', 'session_seat_overrides')
      ORDER BY tablename, policyname;
    `)
    console.log('Updated policies:', JSON.stringify(res.rows, null, 2))
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Migration failed:', err)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
