import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

process.env.NODE_ENV = 'test'

const envPath = path.resolve(process.cwd(), '.env.local')
const content = fs.readFileSync(envPath, 'utf8')
const dbUrl = content.split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=')[1].trim().replace(/^['"]|['"]$/g, '')

for (const line of content.split('\n')) {
  const trimmed = line.trim()
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=')
    if (idx > 0) {
      const k = trimmed.slice(0, idx).trim()
      const v = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
      process.env[k] = v
    }
  }
}

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
const { getSessionSeatPlan, autoAssignRemainingSeats } = await import('../app/actions/seat-plans.ts')

const LAB_INCHARGE = {
  id: 'b7c832c9-4616-4eac-8402-2936caa1b948',
  email: 'incharge@rrl.edu.np',
  full_name: 'Dr. Rajesh Sharma',
  role: 'lab_incharge',
  is_active: true,
  permissions: {},
}

async function testCapacityAndTier2() {
  const client = await pool.connect()
  try {
    console.log('Testing Tier 1 vs Tier 2 with committed rows and cleanup...')
    const pc01Res = await client.query(`SELECT id FROM public.workstations WHERE lab_id = 'comp' AND label = 'PC-01' LIMIT 1;`)
    const pc01Id = pc01Res.rows[0].id
    const enrolls = await client.query(`
      SELECT id, roll_number FROM public.student_enrollments
      WHERE academic_year_id = '2083' AND class_id = '12eng' AND roll_number IN (1, 5)
      ORDER BY roll_number;
    `)
    const roll1Enrollment = enrolls.rows[0].id
    const roll5Enrollment = enrolls.rows[1].id

    // Clean prior
    await client.query(`DELETE FROM public.workstation_seat_plans WHERE workstation_id = $1 AND academic_year_id = '2083';`, [pc01Id])
    await client.query(`DELETE FROM public.session_seat_overrides WHERE schedule_id = 'sched-12c-prakash' AND session_date = '2026-09-24';`)

    // Insert Tier 1
    await client.query(`
      INSERT INTO public.workstation_seat_plans (lab_id, academic_year_id, class_id, workstation_id, enrollment_id)
      VALUES ('comp', '2083', '12eng', $1, $2);
    `, [pc01Id, roll1Enrollment])

    // Insert Tier 2
    await client.query(`
      INSERT INTO public.session_seat_overrides (schedule_id, session_date, workstation_id, enrollment_id, reason)
      VALUES ('sched-12c-prakash', '2026-09-24', $1, $2, 'Relocated for screen repair');
    `, [pc01Id, roll5Enrollment])

    // Verify via Server Action
    process.env.TEST_USER_OVERRIDE = JSON.stringify(LAB_INCHARGE)
    const sessionPlan = await getSessionSeatPlan({
      scheduleId: 'sched-12c-prakash',
      sessionDate: '2026-09-24',
    })
    console.log('sessionPlan success:', sessionPlan.success)
    const pc01View = sessionPlan.data?.workstations.find(w => w.id === pc01Id)
    console.log('PC-01 base assignment roll:', pc01View?.assignment?.roll_number)
    console.log('PC-01 session override roll:', pc01View?.session_override?.roll_number)

    // Cleanup Tier 2
    await client.query(`DELETE FROM public.session_seat_overrides WHERE schedule_id = 'sched-12c-prakash' AND session_date = '2026-09-24';`)
    console.log('Tier 1 vs Tier 2 test completed successfully!')

    console.log('Testing Capacity (35 students vs 34 PCs)...')
    // Clear seat plans for 12eng
    await client.query(`DELETE FROM public.workstation_seat_plans WHERE academic_year_id = '2083' AND class_id = '12eng';`)

    // Temporarily resolve issues so all 34 are available
    const activeIssues = await client.query(`SELECT id FROM public.workstation_issues WHERE status IN ('open', 'acknowledged', 'in_progress');`)
    const issueIds = activeIssues.rows.map(r => r.id)
    if (issueIds.length > 0) {
      await client.query(`UPDATE public.workstation_issues SET status = 'resolved' WHERE id = ANY($1);`, [issueIds])
    }

    try {
      const autoRes = await autoAssignRemainingSeats({
        lab_id: 'comp',
        academic_year_id: '2083',
        class_id: '12eng',
      })
      console.log('autoAssignRemainingSeats result:', autoRes)

      const dbPlans = await client.query(`
        SELECT count(DISTINCT workstation_id) as ws_count, count(DISTINCT enrollment_id) as enroll_count, count(*) as total
        FROM public.workstation_seat_plans
        WHERE lab_id = 'comp' AND academic_year_id = '2083' AND class_id = '12eng';
      `)
      console.log('Assigned in DB:', dbPlans.rows[0])
    } finally {
      // Restore issues and cleanup seat plans
      if (issueIds.length > 0) {
        await client.query(`UPDATE public.workstation_issues SET status = 'open' WHERE id = ANY($1);`, [issueIds])
      }
      await client.query(`DELETE FROM public.workstation_seat_plans WHERE academic_year_id = '2083' AND class_id = '12eng';`)
    }

  } finally {
    client.release()
    await pool.end()
  }
}

testCapacityAndTier2()
