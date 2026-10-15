import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const envPath = path.resolve(process.cwd(), '.env.local')
const content = fs.readFileSync(envPath, 'utf8')
const dbUrl = content.split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=')[1].trim().replace(/^['"]|['"]$/g, '')

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

async function testRls() {
  const client = await pool.connect()
  try {
    // 1. Get a teacher profile id: Er. Anish Karki
    const teacherId = '4911cee7-dae4-48a2-90de-9b039712de35'
    // 2. Get a super_admin profile id: System Administrator
    const adminId = '17d03665-dfaa-4edc-ab54-585057315a0b'

    await client.query('BEGIN')

    // Simulate connection as authenticated role with teacher UID
    await client.query('SET LOCAL ROLE authenticated;')
    await client.query(`SELECT set_config('request.jwt.claims', $1, true);`, [
      JSON.stringify({ sub: teacherId, role: 'authenticated' })
    ])

    // Verify current_role and is_privileged
    const roleCheck = await client.query('SELECT public.current_role() as role, public.is_privileged() as is_priv;')
    console.log('Teacher context check:', roleCheck.rows[0])

    // Attempt direct INSERT as teacher into workstation_seat_plans -> MUST FAIL RLS
    let rlsInsertBlocked = false
    try {
      await client.query(`
        INSERT INTO public.workstation_seat_plans (
          lab_id, academic_year_id, class_id, workstation_id, enrollment_id
        ) VALUES (
          'comp', '2083', '12eng',
          (SELECT id FROM public.workstations WHERE lab_id = 'comp' LIMIT 1),
          (SELECT id FROM public.student_enrollments WHERE academic_year_id = '2083' AND class_id = '12eng' LIMIT 1)
        );
      `)
    } catch (err) {
      rlsInsertBlocked = true
      console.log('Teacher direct INSERT blocked by RLS as expected:', err.message)
    }

    // Now test with admin context
    await client.query(`SELECT set_config('request.jwt.claims', $1, true);`, [
      JSON.stringify({ sub: adminId, role: 'authenticated' })
    ])
    const adminCheck = await client.query('SELECT public.current_role() as role, public.is_privileged() as is_priv;')
    console.log('Admin context check:', adminCheck.rows[0])

    await client.query('ROLLBACK')
    console.log('RLS test completed. Blocked for teacher:', rlsInsertBlocked)
  } finally {
    client.release()
    await pool.end()
  }
}

testRls()
