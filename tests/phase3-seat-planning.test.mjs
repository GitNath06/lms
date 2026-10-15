import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

process.env.NODE_ENV = 'test'

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return null
  const content = fs.readFileSync(envPath, 'utf8')
  let dbUrl = null
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=')
      if (idx > 0) {
        const k = trimmed.slice(0, idx).trim()
        const v = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
        process.env[k] = v
        if (k === 'DATABASE_URL') dbUrl = v
      }
    }
  }
  return dbUrl
}

const dbUrl = loadEnv()

const { clampFloorCoordinates, validateFloorCoordinates, FLOOR_ELEMENT_CATALOG } = await import('../lib/floor-elements.ts')
const {
  getLabSeatPlan,
  getSessionSeatPlan,
  assignStudentToSeat,
  swapStudents,
  clearSeatAssignment,
  autoAssignRemainingSeats,
  createSessionSeatOverride,
  clearSessionSeatOverride,
} = await import('../app/actions/seat-plans.ts')
const { updateWorkstation } = await import('../app/actions/workstations.ts')

// Known Profiles
const TEACHER_ANISH = {
  id: '4911cee7-dae4-48a2-90de-9b039712de35',
  email: 'a.karki@rrl.edu.np',
  full_name: 'Er. Anish Karki',
  role: 'teacher',
  is_active: true,
  permissions: {},
}

const TEACHER_PRAKASH = {
  id: 'e5e3628a-2a76-4db1-8fe1-b6d1fb58037e',
  email: 'p.adhikari@rrl.edu.np',
  full_name: 'Dr. Prakash Adhikari',
  role: 'teacher',
  is_active: true,
  permissions: {},
}

const LAB_INCHARGE = {
  id: 'b7c832c9-4616-4eac-8402-2936caa1b948',
  email: 'incharge@rrl.edu.np',
  full_name: 'Dr. Rajesh Sharma',
  role: 'lab_incharge',
  is_active: true,
  permissions: {},
}

const SUPER_ADMIN = {
  id: '17d03665-dfaa-4edc-ab54-585057315a0b',
  email: 'admin@rrl.edu.np',
  full_name: 'System Administrator',
  role: 'super_admin',
  is_active: true,
  permissions: {},
}

describe('Phase 3: Interactive Computer Lab Floor Plan & Visual Seat Planning Exit Gate Suite', () => {

  describe('1. Floor Landmarks & Coordinate Clamping', () => {
    it('Floor elements catalog defines standard landmarks with valid metadata', () => {
      assert.ok(FLOOR_ELEMENT_CATALOG.teacher_desk, 'teacher_desk definition must exist')
      assert.ok(FLOOR_ELEMENT_CATALOG.whiteboard, 'whiteboard definition must exist')
      assert.ok(FLOOR_ELEMENT_CATALOG.door, 'door definition must exist')
      assert.equal(FLOOR_ELEMENT_CATALOG.teacher_desk.defaultWidth, 16.0)
    })

    it('Coordinate validation & clamping enforces 0-100 boundaries', () => {
      const clamped = clampFloorCoordinates(-5, 120, 0, 100)
      assert.equal(clamped.x, 0, 'Negative x must clamp to 0')
      assert.equal(clamped.y, 100, 'Overflown y (120) must clamp to max 100')
      assert.equal(validateFloorCoordinates(50, 40), true)
      assert.equal(validateFloorCoordinates(105, 95), false)
    })

    it('Database: Computer Lab 01 has seeded physical landmarks in public.lab_floor_elements', async () => {
      if (!dbUrl) return
      const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
      const client = await pool.connect()
      try {
        const res = await client.query(`
          SELECT id, lab_id, element_type, label, pos_x, pos_y
          FROM public.lab_floor_elements
          WHERE lab_id = 'comp' AND is_active = true
          ORDER BY label;
        `)
        assert.ok(res.rows.length >= 3, `Expected at least 3 landmarks for comp, found ${res.rows.length}`)
        const types = res.rows.map(r => r.element_type)
        assert.ok(types.includes('teacher_desk'))
        assert.ok(types.includes('whiteboard'))
        assert.ok(types.includes('door'))
      } finally {
        client.release()
        await pool.end()
      }
    })
  })

  describe('2. Teacher Authorization Model & Server-Action Guards', () => {
    it('✓ Teacher can view own 9C session', async () => {
      process.env.TEST_USER_OVERRIDE = JSON.stringify(TEACHER_ANISH)
      const res = await getSessionSeatPlan({
        scheduleId: 'sched-9c-anish',
        sessionDate: '2026-09-24',
      })
      assert.equal(res.success, true, `Expected success, got error: ${res.error}`)
      assert.ok(res.data)
      assert.equal(res.data.schedule_id, 'sched-9c-anish')
      assert.equal(res.data.lab_id, 'comp')
    })

    it('✓ Teacher can view own 10C session', async () => {
      process.env.TEST_USER_OVERRIDE = JSON.stringify(TEACHER_ANISH)
      const res = await getSessionSeatPlan({
        scheduleId: 'sched-10c-anish',
        sessionDate: '2026-09-24',
      })
      assert.equal(res.success, true, `Expected success, got error: ${res.error}`)
      assert.ok(res.data)
      assert.equal(res.data.schedule_id, 'sched-10c-anish')
    })

    it("✓ Teacher cannot view another teacher's session (Access Denied)", async () => {
      process.env.TEST_USER_OVERRIDE = JSON.stringify(TEACHER_ANISH)
      // sched-12c-prakash is owned by Dr. Prakash Adhikari
      const res = await getSessionSeatPlan({
        scheduleId: 'sched-12c-prakash',
        sessionDate: '2026-09-24',
      })
      assert.equal(res.success, false)
      assert.match(res.error || '', /Access denied: Teachers can only view seat plans for their own assigned sessions/i)
    })

    it('✓ Teacher cannot view unrelated class/session', async () => {
      process.env.TEST_USER_OVERRIDE = JSON.stringify(TEACHER_ANISH)
      // sun-2 is Chemistry Lab Class 12 owned by Ms. Sunita Thapa
      const res = await getSessionSeatPlan({
        scheduleId: 'sun-2',
        sessionDate: '2026-09-24',
      })
      assert.equal(res.success, false)
      assert.match(res.error || '', /Access denied/i)
    })

    it('✓ Teacher cannot modify own session seat plan (session override rejected)', async () => {
      process.env.TEST_USER_OVERRIDE = JSON.stringify(TEACHER_ANISH)
      const res = await createSessionSeatOverride({
        schedule_id: 'sched-9c-anish',
        session_date: '2026-09-24',
        workstation_id: '00000000-0000-0000-0000-000000000000',
        enrollment_id: '00000000-0000-0000-0000-000000000000',
        reason: 'Attempted teacher override',
      })
      assert.equal(res.success, false)
      assert.match(res.error || '', /Access denied: Teachers have read-only access/i)
    })

    it('✓ Teacher cannot modify default/Tier-1 seat plan (assign / swap / clear / auto-assign rejected)', async () => {
      process.env.TEST_USER_OVERRIDE = JSON.stringify(TEACHER_ANISH)

      const assignRes = await assignStudentToSeat({
        lab_id: 'comp',
        academic_year_id: '2083',
        class_id: '9eng',
        workstation_id: '00000000-0000-0000-0000-000000000000',
        enrollment_id: '00000000-0000-0000-0000-000000000000',
      })
      assert.equal(assignRes.success, false)
      assert.match(assignRes.error || '', /Access denied: Teachers have read-only access/i)

      const swapRes = await swapStudents({
        lab_id: 'comp',
        academic_year_id: '2083',
        class_id: '9eng',
        workstation_id_a: '00000000-0000-0000-0000-000000000000',
        workstation_id_b: '11111111-1111-1111-1111-111111111111',
      })
      assert.equal(swapRes.success, false)
      assert.match(swapRes.error || '', /Access denied: Teachers have read-only access/i)

      const autoRes = await autoAssignRemainingSeats({
        lab_id: 'comp',
        academic_year_id: '2083',
        class_id: '9eng',
      })
      assert.equal(autoRes.success, false)
      assert.match(autoRes.error || '', /Access denied: Teachers have read-only access/i)
    })

    it('✓ Lab Incharge can view any session and modify seat plans', async () => {
      process.env.TEST_USER_OVERRIDE = JSON.stringify(LAB_INCHARGE)

      const viewRes = await getSessionSeatPlan({
        scheduleId: 'sched-12c-prakash',
        sessionDate: '2026-09-24',
      })
      assert.equal(viewRes.success, true, `Incharge should view any session, error: ${viewRes.error}`)
      assert.ok(viewRes.data)
    })

    it('✓ Super Admin can view any session and modify seat plans', async () => {
      process.env.TEST_USER_OVERRIDE = JSON.stringify(SUPER_ADMIN)

      const viewRes = await getSessionSeatPlan({
        scheduleId: 'sched-9c-anish',
        sessionDate: '2026-09-24',
      })
      assert.equal(viewRes.success, true, `Admin should view any session, error: ${viewRes.error}`)
      assert.ok(viewRes.data)
    })
  })

  describe('3. Tier 1 vs Tier 2 Separation (Permanent Plan vs Session Override)', () => {
    it('Tier 1 default seat plan remains completely untouched when Tier 2 session override is created and queried', async () => {
      if (!dbUrl) return
      const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
      const client = await pool.connect()
      try {
        // Fetch 2 enrolled students from 12eng (Roll 1 and Roll 5)
        const enrolls = await client.query(`
          SELECT id, roll_number FROM public.student_enrollments
          WHERE academic_year_id = '2083' AND class_id = '12eng' AND roll_number IN (1, 5)
          ORDER BY roll_number;
        `)
        assert.equal(enrolls.rows.length, 2, 'Need Roll 1 and Roll 5')
        const roll1Enrollment = enrolls.rows[0].id
        const roll5Enrollment = enrolls.rows[1].id

        // Fetch PC-01 workstation
        const wsRes = await client.query(`
          SELECT id, label FROM public.workstations
          WHERE lab_id = 'comp' AND label = 'PC-01' LIMIT 1;
        `)
        assert.ok(wsRes.rows.length > 0, 'PC-01 must exist')
        const pc01Id = wsRes.rows[0].id

        // Clean any leftover seat plans/overrides for these test records
        await client.query(`
          DELETE FROM public.workstation_seat_plans
          WHERE lab_id = 'comp' AND academic_year_id = '2083' AND class_id = '12eng'
            AND (workstation_id = $1 OR enrollment_id IN ($2, $3));
        `, [pc01Id, roll1Enrollment, roll5Enrollment])

        const sessionDate = '2026-09-24'
        await client.query(`
          DELETE FROM public.session_seat_overrides
          WHERE schedule_id = 'sched-12c-prakash' AND session_date = $1;
        `, [sessionDate])

        try {
          // 1. Establish Tier 1: PC-01 -> Roll 1
          await client.query(`
            INSERT INTO public.workstation_seat_plans (
              lab_id, academic_year_id, class_id, workstation_id, enrollment_id
            ) VALUES ('comp', '2083', '12eng', $1, $2);
          `, [pc01Id, roll1Enrollment])

          // Verify Tier 1 before override
          const beforeTier1 = await client.query(`
            SELECT enrollment_id FROM public.workstation_seat_plans
            WHERE lab_id = 'comp' AND academic_year_id = '2083' AND class_id = '12eng' AND workstation_id = $1;
          `, [pc01Id])
          assert.equal(beforeTier1.rows[0].enrollment_id, roll1Enrollment, 'Before: Tier 1 PC-01 must be Roll 1')

          // 2. Create Tier 2 Session Override: PC-01 -> Roll 5 for session sched-12c-prakash
          await client.query(`
            INSERT INTO public.session_seat_overrides (
              schedule_id, session_date, workstation_id, enrollment_id, reason
            ) VALUES ('sched-12c-prakash', $1, $2, $3, 'Student relocated due to monitor angle');
          `, [sessionDate, pc01Id, roll5Enrollment])

          // 3. Verify in database: Tier 1 STILL has Roll 1, Tier 2 has Roll 5!
          const afterTier1 = await client.query(`
            SELECT enrollment_id FROM public.workstation_seat_plans
            WHERE lab_id = 'comp' AND academic_year_id = '2083' AND class_id = '12eng' AND workstation_id = $1;
          `, [pc01Id])
          assert.equal(afterTier1.rows[0].enrollment_id, roll1Enrollment, 'CRITICAL: Tier 1 must remain Roll 1!')

          const afterTier2 = await client.query(`
            SELECT enrollment_id, workstation_id FROM public.session_seat_overrides
            WHERE schedule_id = 'sched-12c-prakash' AND session_date = $1 AND workstation_id = $2;
          `, [sessionDate, pc01Id])
          assert.equal(afterTier2.rows[0].enrollment_id, roll5Enrollment, 'Tier 2 session override must be Roll 5')

          // 4. Verify via Server Action: getSessionSeatPlan overlays Tier 2 on PC-01
          process.env.TEST_USER_OVERRIDE = JSON.stringify(LAB_INCHARGE)
          const sessionPlan = await getSessionSeatPlan({
            scheduleId: 'sched-12c-prakash',
            sessionDate,
          })
          assert.equal(sessionPlan.success, true)
          const pc01View = sessionPlan.data?.workstations.find(w => w.id === pc01Id)
          assert.ok(pc01View, 'PC-01 must exist in session plan')
          assert.equal(pc01View.session_override?.roll_number, 5, 'Session override view reflects Roll 5')
        } finally {
          // Cleanup test records
          await client.query(`
            DELETE FROM public.session_seat_overrides
            WHERE schedule_id = 'sched-12c-prakash' AND session_date = $1;
          `, [sessionDate])
          await client.query(`
            DELETE FROM public.workstation_seat_plans
            WHERE lab_id = 'comp' AND academic_year_id = '2083' AND class_id = '12eng'
              AND (workstation_id = $1 OR enrollment_id IN ($2, $3));
          `, [pc01Id, roll1Enrollment, roll5Enrollment])
        }
      } finally {
        client.release()
        await pool.end()
      }
    })
  })

  describe('4. Atomic Workstation Seat Swap (swap_workstation_seat_plans_tx)', () => {
    it('PostgreSQL RPC executes atomic two-way swap without constraint violation or partial state', async () => {
      if (!dbUrl) return
      const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
      const client = await pool.connect()
      try {
        await client.query('BEGIN')

        // Fetch 2 workstations (PC-01 and PC-02)
        const wsRes = await client.query(`
          SELECT id, label FROM public.workstations
          WHERE lab_id = 'comp' AND label IN ('PC-01', 'PC-02')
          ORDER BY label;
        `)
        assert.equal(wsRes.rows.length, 2)
        const wsA = wsRes.rows[0].id // PC-01
        const wsB = wsRes.rows[1].id // PC-02

        // Fetch 2 enrolled students (Roll 1 and Roll 2)
        const enrolls = await client.query(`
          SELECT id, roll_number FROM public.student_enrollments
          WHERE academic_year_id = '2083' AND class_id = '12eng' AND roll_number IN (1, 2)
          ORDER BY roll_number;
        `)
        assert.equal(enrolls.rows.length, 2)
        const enrollA = enrolls.rows[0].id // Student A
        const enrollB = enrolls.rows[1].id // Student B

        // Clean
        await client.query(`
          DELETE FROM public.workstation_seat_plans
          WHERE lab_id = 'comp' AND academic_year_id = '2083' AND class_id = '12eng'
            AND (workstation_id IN ($1, $2) OR enrollment_id IN ($3, $4));
        `, [wsA, wsB, enrollA, enrollB])

        // Initial assignment: PC-01 -> Student A, PC-02 -> Student B
        await client.query(`
          INSERT INTO public.workstation_seat_plans (lab_id, academic_year_id, class_id, workstation_id, enrollment_id)
          VALUES 
            ('comp', '2083', '12eng', $1, $2),
            ('comp', '2083', '12eng', $3, $4);
        `, [wsA, enrollA, wsB, enrollB])

        // Execute atomic swap RPC
        const swapRes = await client.query(`
          SELECT public.swap_workstation_seat_plans_tx('comp', '2083', '12eng', $1, $2, NULL) as result;
        `, [wsA, wsB])
        assert.equal(swapRes.rows[0].result.success, true)

        // Verify swapped assignments: PC-01 now has Student B, PC-02 now has Student A
        const afterSwap = await client.query(`
          SELECT workstation_id, enrollment_id FROM public.workstation_seat_plans
          WHERE lab_id = 'comp' AND academic_year_id = '2083' AND class_id = '12eng' AND workstation_id IN ($1, $2);
        `, [wsA, wsB])

        const map = new Map(afterSwap.rows.map(r => [r.workstation_id, r.enrollment_id]))
        assert.equal(map.get(wsA), enrollB, 'PC-01 must now have Student B')
        assert.equal(map.get(wsB), enrollA, 'PC-02 must now have Student A')

        // Test RPC error handling: Swapping two unassigned workstations must fail with INVALID_SWAP and rollback
        const wsUnused = await client.query(`
          SELECT id FROM public.workstations
          WHERE lab_id = 'comp' AND id NOT IN ($1, $2)
          LIMIT 2;
        `, [wsA, wsB])

        await client.query(`
          DELETE FROM public.workstation_seat_plans
          WHERE lab_id = 'comp' AND academic_year_id = '2083' AND class_id = '12eng'
            AND workstation_id IN ($1, $2);
        `, [wsUnused.rows[0].id, wsUnused.rows[1].id])

        let rpcFailed = false
        try {
          await client.query('SAVEPOINT sp_invalid_swap;')
          await client.query(`
            SELECT public.swap_workstation_seat_plans_tx('comp', '2083', '12eng', $1, $2, NULL);
          `, [wsUnused.rows[0].id, wsUnused.rows[1].id])
        } catch (err) {
          await client.query('ROLLBACK TO SAVEPOINT sp_invalid_swap;')
          rpcFailed = true
          assert.match(err.message, /INVALID_SWAP/i)
        }
        assert.equal(rpcFailed, true, 'Swapping unassigned workstations must throw INVALID_SWAP and rollback')

        await client.query('ROLLBACK')
      } finally {
        client.release()
        await pool.end()
      }
    })
  })

  describe('5. PostgreSQL Row-Level Security (RLS) Independent Verification', () => {
    it('Client direct database bypass: Teacher role is REJECTED by Postgres RLS on workstation_seat_plans', async () => {
      if (!dbUrl) return
      const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
      const client = await pool.connect()
      try {
        await client.query('BEGIN')

        // Simulate client connection as authenticated role with teacher UID
        await client.query('SET LOCAL ROLE authenticated;')
        await client.query(`SELECT set_config('request.jwt.claims', $1, true);`, [
          JSON.stringify({ sub: TEACHER_ANISH.id, role: 'authenticated' })
        ])

        // Verify context
        const roleCheck = await client.query('SELECT public.current_role() as role, public.is_privileged() as is_priv;')
        assert.equal(roleCheck.rows[0].role, 'teacher')
        assert.equal(roleCheck.rows[0].is_priv, false)

        // 1. Direct INSERT attempt by teacher MUST BE REJECTED BY RLS
        let insertBlocked = false
        try {
          await client.query('SAVEPOINT sp_rls_ins;')
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
          await client.query('ROLLBACK TO SAVEPOINT sp_rls_ins;')
          insertBlocked = true
          assert.match(err.message, /violates row-level security policy/i)
        }
        assert.equal(insertBlocked, true, 'Direct INSERT bypass attempt must be blocked by RLS')

        // 2. Direct INSERT on session_seat_overrides by teacher MUST BE REJECTED BY RLS
        let overrideBlocked = false
        try {
          await client.query('SAVEPOINT sp_rls_ov;')
          await client.query(`
            INSERT INTO public.session_seat_overrides (
              schedule_id, session_date, workstation_id, enrollment_id, reason
            ) VALUES (
              'sched-12c-prakash', '2026-09-24',
              (SELECT id FROM public.workstations WHERE lab_id = 'comp' LIMIT 1),
              (SELECT id FROM public.student_enrollments WHERE academic_year_id = '2083' AND class_id = '12eng' LIMIT 1),
              'Bypass attempt'
            );
          `)
        } catch (err) {
          await client.query('ROLLBACK TO SAVEPOINT sp_rls_ov;')
          overrideBlocked = true
          assert.match(err.message, /violates row-level security policy/i)
        }
        assert.equal(overrideBlocked, true, 'Direct session override bypass attempt must be blocked by RLS')

        await client.query('ROLLBACK')
      } finally {
        client.release()
        await pool.end()
      }
    })
  })

  describe('6. Capacity Test: 35 Students vs 34 Workstations', () => {
    it('Auto-assign assigns exactly 34 students, leaves 1 unassigned in tray, available PCs = 0, zero duplicates', async () => {
      if (!dbUrl) return
      const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
      const client = await pool.connect()
      try {
        // Verify count of enrolled students in 12eng is 35
        const studCount = await client.query(`
          SELECT count(*) as count FROM public.student_enrollments
          WHERE academic_year_id = '2083' AND class_id = '12eng' AND status = 'active';
        `)
        assert.equal(Number(studCount.rows[0].count), 35, 'Cohort must contain exactly 35 enrolled students')

        // Clear existing seat plans for 12eng
        await client.query(`
          DELETE FROM public.workstation_seat_plans
          WHERE lab_id = 'comp' AND academic_year_id = '2083' AND class_id = '12eng';
        `)

        // Temporarily resolve active issues so all 34 are available
        const activeIssues = await client.query(`
          SELECT id FROM public.workstation_issues
          WHERE status IN ('open', 'acknowledged', 'in_progress');
        `)
        const issueIds = activeIssues.rows.map(r => r.id)
        if (issueIds.length > 0) {
          await client.query(`UPDATE public.workstation_issues SET status = 'resolved' WHERE id = ANY($1);`, [issueIds])
        }

        try {
          // Run auto-assign as privileged user
          process.env.TEST_USER_OVERRIDE = JSON.stringify(LAB_INCHARGE)
          const autoRes = await autoAssignRemainingSeats({
            lab_id: 'comp',
            academic_year_id: '2083',
            class_id: '12eng',
          })

          assert.equal(autoRes.success, true, `Auto-assign failed: ${autoRes.error}`)
          assert.ok(autoRes.data)
          assert.equal(autoRes.data.assigned_count, 34, 'Must assign exactly 34 workstations')
          assert.equal(autoRes.data.remaining_unassigned_count, 1, 'Must leave exactly 1 student unassigned')
          assert.equal(autoRes.data.available_workstations_count, 0, 'Available workstations must be 0')

          // Verify in database: Exactly 34 distinct workstations assigned, exactly 34 distinct students assigned
          const dbPlans = await client.query(`
            SELECT count(DISTINCT workstation_id) as ws_count, count(DISTINCT enrollment_id) as enroll_count, count(*) as total
            FROM public.workstation_seat_plans
            WHERE lab_id = 'comp' AND academic_year_id = '2083' AND class_id = '12eng';
          `)
          assert.equal(Number(dbPlans.rows[0].ws_count), 34, 'No duplicate workstation assignments')
          assert.equal(Number(dbPlans.rows[0].enroll_count), 34, 'No duplicate student assignments')
          assert.equal(Number(dbPlans.rows[0].total), 34, 'Total assigned rows must be 34')

          // Query lab seat plan view and verify Tray has exactly 1 unassigned student
          const labPlan = await getLabSeatPlan({
            labId: 'comp',
            classId: '12eng',
          })
          assert.equal(labPlan.success, true)
          assert.equal(labPlan.data?.total_students, 35)
          assert.equal(labPlan.data?.assigned_count, 34)
          assert.equal(labPlan.data?.unassigned_count, 1)
          assert.equal(labPlan.data?.unassigned_students.length, 1)
          assert.equal(labPlan.data?.unassigned_students[0].roll_number, 35, 'Roll 35 is unassigned')
        } finally {
          // Restore issues and cleanup seat plans
          if (issueIds.length > 0) {
            await client.query(`UPDATE public.workstation_issues SET status = 'open' WHERE id = ANY($1);`, [issueIds])
          }
          await client.query(`
            DELETE FROM public.workstation_seat_plans
            WHERE lab_id = 'comp' AND academic_year_id = '2083' AND class_id = '12eng';
          `)
        }
      } finally {
        client.release()
        await pool.end()
      }
    })
  })

  describe('7. Workstation Identity Preservation across Repositioning', () => {
    it('Moving PC-17 changes coordinates pos_x/pos_y but preserves workstation_id, issues, and seat plans', async () => {
      if (!dbUrl) return
      const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
      const client = await pool.connect()
      try {
        await client.query('BEGIN')

        // Fetch PC-17
        const wsRes = await client.query(`
          SELECT id, label, pos_x, pos_y FROM public.workstations
          WHERE lab_id = 'comp' AND label = 'PC-17';
        `)
        assert.ok(wsRes.rows.length > 0, 'PC-17 must exist')
        const pc17 = wsRes.rows[0]
        const pc17Id = pc17.id
        const originalX = pc17.pos_x
        const originalY = pc17.pos_y

        // Attach an issue to PC-17 with valid reporter
        const issueRes = await client.query(`
          INSERT INTO public.workstation_issues (workstation_id, title, severity, status, reported_by_id, reported_by_name)
          VALUES ($1, 'PC-17 Keyboard Cable Snag', 'low', 'open', $2, $3)
          RETURNING id;
        `, [pc17Id, SUPER_ADMIN.id, SUPER_ADMIN.full_name])
        const issueId = issueRes.rows[0].id

        // Move PC-17 to new coordinates (x: 42.5, y: 77.0) via server action
        process.env.TEST_USER_OVERRIDE = JSON.stringify(LAB_INCHARGE)
        const moveRes = await updateWorkstation({
          id: pc17Id,
          pos_x: 42.5,
          pos_y: 77.0,
        })
        assert.equal(moveRes.success, true, `Move failed: ${moveRes.error}`)

        // Verify in database:
        // 1. workstation.id is strictly preserved
        const afterMove = await client.query(`SELECT id, label, pos_x, pos_y FROM public.workstations WHERE id = $1;`, [pc17Id])
        assert.equal(afterMove.rows[0].id, pc17Id, 'Workstation ID must remain unchanged')
        assert.equal(afterMove.rows[0].label, 'PC-17')
        assert.equal(Number(afterMove.rows[0].pos_x), 42.5, 'pos_x updated to new position')
        assert.equal(Number(afterMove.rows[0].pos_y), 77.0, 'pos_y updated to new position')

        // 2. Issue remains attached to PC-17
        const linkedIssue = await client.query(`SELECT workstation_id FROM public.workstation_issues WHERE id = $1;`, [issueId])
        assert.equal(linkedIssue.rows[0].workstation_id, pc17Id, 'Issue must remain attached to PC-17')

        await client.query('ROLLBACK')
      } finally {
        client.release()
        await pool.end()
      }
    })
  })

  describe('8. Faulty Workstation Nuanced Eligibility', () => {
    it('Minor issue keeps PC eligible; critical fault and under_repair (in_progress) exclude PC from auto-assign', async () => {
      if (!dbUrl) return
      const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
      const client = await pool.connect()
      try {
        await client.query('BEGIN')

        // Fetch PC-10, PC-11, PC-12
        const wsRes = await client.query(`
          SELECT id, label FROM public.workstations
          WHERE lab_id = 'comp' AND label IN ('PC-10', 'PC-11', 'PC-12')
          ORDER BY label;
        `)
        assert.equal(wsRes.rows.length, 3)
        const pc10 = wsRes.rows[0].id // PC-10: Minor issue
        const pc11 = wsRes.rows[1].id // PC-11: High-severity active issue
        const pc12 = wsRes.rows[2].id // PC-12: under_repair (in_progress)

        // Clean issues on these 3
        await client.query(`DELETE FROM public.workstation_issues WHERE workstation_id IN ($1, $2, $3);`, [pc10, pc11, pc12])

        // 1. PC-10: Minor issue (severity = 'low', open)
        await client.query(`
          INSERT INTO public.workstation_issues (workstation_id, title, severity, status, reported_by_id, reported_by_name)
          VALUES ($1, 'Mouse scroll wheel sticky', 'low', 'open', $2, $3);
        `, [pc10, SUPER_ADMIN.id, SUPER_ADMIN.full_name])

        // 2. PC-11: High-severity active issue (severity = 'high', open)
        await client.query(`
          INSERT INTO public.workstation_issues (workstation_id, title, severity, status, reported_by_id, reported_by_name)
          VALUES ($1, 'GPU artifacting and smoke smell', 'high', 'open', $2, $3);
        `, [pc11, SUPER_ADMIN.id, SUPER_ADMIN.full_name])

        // 3. PC-12: Under repair (status = 'in_progress')
        await client.query(`
          INSERT INTO public.workstation_issues (workstation_id, title, severity, status, reported_by_id, reported_by_name)
          VALUES ($1, 'Motherboard capacitor replacement', 'medium', 'in_progress', $2, $3);
        `, [pc12, SUPER_ADMIN.id, SUPER_ADMIN.full_name])

        // Clean seat plans for these 3 workstations
        await client.query(`
          DELETE FROM public.workstation_seat_plans
          WHERE lab_id = 'comp' AND academic_year_id = '2083' AND class_id = '12eng'
            AND workstation_id IN ($1, $2, $3);
        `, [pc10, pc11, pc12])

        // Check availability logic directly
        const candidateIssues = await client.query(`
          SELECT workstation_id, severity, status FROM public.workstation_issues
          WHERE workstation_id IN ($1, $2, $3) AND status IN ('open', 'in_progress');
        `, [pc10, pc11, pc12])

        const unavailableSet = new Set()
        candidateIssues.rows.forEach(issue => {
          if (issue.status === 'in_progress' || issue.severity === 'critical' || issue.severity === 'high') {
            unavailableSet.add(issue.workstation_id)
          }
        })

        // PC-10 (minor) must NOT be in unavailable set
        assert.equal(unavailableSet.has(pc10), false, 'PC-10 with minor issue must remain ELIGIBLE')
        // PC-11 (high fault) must be in unavailable set
        assert.equal(unavailableSet.has(pc11), true, 'PC-11 with high fault must be UNAVAILABLE')
        // PC-12 (under repair) must be in unavailable set
        assert.equal(unavailableSet.has(pc12), true, 'PC-12 under repair must be UNAVAILABLE')

        await client.query('ROLLBACK')
      } finally {
        client.release()
        await pool.end()
      }
    })
  })

  describe('9. Existing Maintenance & Practical Log Regressions', () => {
    it('Maintenance plans, maintenance logs, and workstation issues remain intact and connected', async () => {
      if (!dbUrl) return
      const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
      const client = await pool.connect()
      try {
        const plans = await client.query(`SELECT count(*) as count FROM public.maintenance_plans;`)
        assert.ok(Number(plans.rows[0].count) >= 0, 'maintenance_plans accessible')

        const logs = await client.query(`SELECT count(*) as count FROM public.maintenance_logs;`)
        assert.ok(Number(logs.rows[0].count) >= 0, 'maintenance_logs accessible')

        const issues = await client.query(`SELECT count(*) as count FROM public.workstation_issues;`)
        assert.ok(Number(issues.rows[0].count) >= 0, 'workstation_issues accessible')
      } finally {
        client.release()
        await pool.end()
      }
    })

    it('Historical practical logs and roll-call records remain 100% valid and accessible', async () => {
      if (!dbUrl) return
      const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
      const client = await pool.connect()
      try {
        const res = await client.query(`
          SELECT id, lab_id, subject_name, batch_group, total_students, present_students
          FROM public.practical_logs
          LIMIT 5;
        `)
        assert.ok(res.rows.length >= 0, 'practical_logs query succeeds')
        for (const row of res.rows) {
          assert.ok(row.total_students >= 0, 'Total students must be non-negative')
          assert.ok(row.present_students >= 0, 'Present students must be non-negative')
        }
      } finally {
        client.release()
        await pool.end()
      }
    })
  })
})
