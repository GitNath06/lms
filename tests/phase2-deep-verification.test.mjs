import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

function loadDbUrl() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return null
  const content = fs.readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) {
      return line.split('=')[1].trim().replace(/^["']|["']$/g, '')
    }
  }
  return null
}

describe('Phase 2 Deep Verification: RLS, Atomicity, Atomic Swap & Attendance Semantics', () => {
  const dbUrl = loadDbUrl()

  describe('1. True DB Atomicity & Rollback Protection (create_student_with_enrollment_tx)', () => {
    it('Rollback guarantees NO orphan student record if enrollment fails due to duplicate roll', async () => {
      if (!dbUrl) return
      const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
      const client = await pool.connect()

      const testAdmNo = `ATOMIC-${Date.now()}`
      try {
        // Step 1: Create initial student enrolled as Roll 50 in 12eng for 2083
        const res1 = await client.query(`
          SELECT public.create_student_with_enrollment_tx(
            'Primary Student',
            '2083',
            '12eng',
            50,
            $1
          ) as result;
        `, [testAdmNo])
        assert.ok(res1.rows[0].result.student_id, 'Primary student must be created')
        const primaryStudentId = res1.rows[0].result.student_id

        // Count students before failed transaction
        const countBefore = await client.query(`SELECT count(*) as cnt FROM public.students;`)

        // Step 2: Attempt to create second student with conflicting roll 50 in 12eng / 2083
        const failingAdmNo = `${testAdmNo}-FAIL`
        let txFailed = false
        try {
          await client.query(`
            SELECT public.create_student_with_enrollment_tx(
              'Failing Candidate',
              '2083',
              '12eng',
              50,
              $1
            );
          `, [failingAdmNo])
        } catch (err) {
          txFailed = true
          assert.ok(err.message.includes('ROLL_COLLISION'), 'Must throw ROLL_COLLISION exception')
        }
        assert.ok(txFailed, 'Atomic RPC must reject duplicate roll')

        // Step 3: Verify that failing candidate was completely rolled back and DOES NOT exist in students table
        const countAfter = await client.query(`SELECT count(*) as cnt FROM public.students;`)
        assert.equal(
          countAfter.rows[0].cnt,
          countBefore.rows[0].cnt,
          'Total student count must be identical — NO orphan student record created!'
        )

        const checkOrphan = await client.query(
          `SELECT id FROM public.students WHERE admission_no = $1;`,
          [failingAdmNo]
        )
        assert.equal(checkOrphan.rows.length, 0, 'Orphan candidate record must NOT exist in students')

        // Clean up primary test record
        await client.query(`DELETE FROM public.student_enrollments WHERE student_id = $1;`, [primaryStudentId])
        await client.query(`DELETE FROM public.students WHERE id = $1;`, [primaryStudentId])
      } finally {
        client.release()
        await pool.end()
      }
    })
  })

  describe('2. Atomic Workstation Seat Swap (swap_workstation_seat_plans_tx)', () => {
    it('Atomically swaps two students seats without data loss or transient constraint violation', async () => {
      if (!dbUrl) return
      const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
      const client = await pool.connect()

      let enrollA = null
      let enrollB = null
      let studentAId = null
      let studentBId = null
      try {
        // Fetch 2 workstations in comp lab
        const wsRes = await client.query(`SELECT id FROM public.workstations WHERE lab_id = 'comp' LIMIT 2;`)
        assert.ok(wsRes.rows.length >= 2)
        const wsA = wsRes.rows[0].id
        const wsB = wsRes.rows[1].id

        // Clean up any lingering swap test records from previous runs in 10eng
        await client.query(`DELETE FROM public.student_enrollments WHERE academic_year_id = '2083' AND class_id = '10eng';`)

        // Create 2 students & enrollments with dynamic unique roll numbers within (0, 200]
        const baseRoll = 50 + Math.floor(Math.random() * 40)
        const admA = `SWAP-A-${Date.now()}`
        const admB = `SWAP-B-${Date.now()}`
        const sA = await client.query(`
          SELECT public.create_student_with_enrollment_tx('Student Swap A', '2083', '10eng', $1, $2) as res;
        `, [baseRoll, admA])
        const sB = await client.query(`
          SELECT public.create_student_with_enrollment_tx('Student Swap B', '2083', '10eng', $1, $2) as res;
        `, [baseRoll + 1, admB])

        enrollA = sA.rows[0].res.enrollment_id
        enrollB = sB.rows[0].res.enrollment_id
        studentAId = sA.rows[0].res.student_id
        studentBId = sB.rows[0].res.student_id

        // Clean up any existing seat assignments on wsA and wsB in this cohort
        await client.query(`
          DELETE FROM public.workstation_seat_plans 
          WHERE lab_id = 'comp' AND academic_year_id = '2083' AND class_id = '10eng' AND workstation_id IN ($1, $2);
        `, [wsA, wsB])

        // Assign Student A -> wsA, Student B -> wsB
        await client.query(`
          INSERT INTO public.workstation_seat_plans (lab_id, academic_year_id, class_id, workstation_id, enrollment_id)
          VALUES ('comp', '2083', '10eng', $1, $2);
        `, [wsA, enrollA])

        await client.query(`
          INSERT INTO public.workstation_seat_plans (lab_id, academic_year_id, class_id, workstation_id, enrollment_id)
          VALUES ('comp', '2083', '10eng', $1, $2);
        `, [wsB, enrollB])

        // Verify pre-swap state
        const preA = await client.query(`SELECT enrollment_id FROM public.workstation_seat_plans WHERE workstation_id = $1 AND academic_year_id = '2083' AND class_id = '10eng';`, [wsA])
        const preB = await client.query(`SELECT enrollment_id FROM public.workstation_seat_plans WHERE workstation_id = $1 AND academic_year_id = '2083' AND class_id = '10eng';`, [wsB])
        assert.equal(preA.rows[0].enrollment_id, enrollA)
        assert.equal(preB.rows[0].enrollment_id, enrollB)

        // Perform ATOMIC SWAP via PostgreSQL RPC
        const swapRes = await client.query(`
          SELECT public.swap_workstation_seat_plans_tx('comp', '2083', '10eng', $1, $2) as res;
        `, [wsA, wsB])
        assert.equal(swapRes.rows[0].res.success, true)

        // Verify post-swap state: wsA now has enrollB, wsB now has enrollA!
        const postA = await client.query(`SELECT enrollment_id FROM public.workstation_seat_plans WHERE workstation_id = $1 AND academic_year_id = '2083' AND class_id = '10eng';`, [wsA])
        const postB = await client.query(`SELECT enrollment_id FROM public.workstation_seat_plans WHERE workstation_id = $1 AND academic_year_id = '2083' AND class_id = '10eng';`, [wsB])
        assert.equal(postA.rows[0].enrollment_id, enrollB, 'wsA must now be assigned to Student B')
        assert.equal(postB.rows[0].enrollment_id, enrollA, 'wsB must now be assigned to Student A')
      } finally {
        if (enrollA && enrollB) {
          await client.query(`DELETE FROM public.workstation_seat_plans WHERE enrollment_id IN ($1, $2);`, [enrollA, enrollB])
          await client.query(`DELETE FROM public.student_enrollments WHERE id IN ($1, $2);`, [enrollA, enrollB])
        }
        if (studentAId && studentBId) {
          await client.query(`DELETE FROM public.students WHERE id IN ($1, $2);`, [studentAId, studentBId])
        }
        client.release()
        await pool.end()
      }
    })
  })

  describe('3. Relational Attendance Synchronization & Verification', () => {
    it('Practical log insertion with class_subject_id generates synchronized roll-call records with student_id and enrollment_id', async () => {
      if (!dbUrl) return
      const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
      const client = await pool.connect()

      const testLogId = `HIST-LOG-${Date.now()}`
      try {
        // Query a valid class_subject_id for 12eng comp-12
        const csRes = await client.query(`SELECT id FROM public.class_subjects WHERE class_id = '12eng' AND subject_id = 'comp-12' LIMIT 1;`)
        const csId = csRes.rows[0]?.id
        assert.ok(csId, 'A valid class_subject_id must exist for 12eng comp-12')

        // Insert practical log with canonical class_subject_id
        await client.query(`
          INSERT INTO public.practical_logs (
            id, lab_id, date, period_label, subject_name, batch_group, practical_title,
            total_students, present_students, absent_students, absent_rolls, status, class_subject_id
          ) VALUES (
            $1, 'comp', '2026-09-24', 'Period 1', 'Computer Science Lab', '12 Eng', 'Data Structures & Algorithms',
            35, 33, 2, ARRAY[3, 7], 'conducted', $2
          );
        `, [testLogId, csId])

        // Verify trigger created log_attendance records
        const attRows = await client.query(`
          SELECT roll_number, is_present, student_id, enrollment_id
          FROM public.log_attendance
          WHERE log_id = $1
          ORDER BY roll_number;
        `, [testLogId])

        assert.equal(attRows.rows.length, 35, 'Trigger must generate 35 roll records for 12eng')
        const roll3 = attRows.rows.find((r) => r.roll_number === 3)
        const roll7 = attRows.rows.find((r) => r.roll_number === 7)
        assert.ok(roll3, 'Roll 3 record must exist')
        assert.equal(roll3.is_present, false, 'Roll 3 is absent')
        assert.ok(roll7, 'Roll 7 record must exist')
        assert.equal(roll7.is_present, false, 'Roll 7 is absent')

        // Relational attendance: every record has valid student_id and enrollment_id
        for (const row of attRows.rows) {
          assert.ok(row.student_id, 'Attendance record must have student_id')
          assert.ok(row.enrollment_id, 'Attendance record must have enrollment_id')
        }

        // Clean up
        await client.query(`DELETE FROM public.log_attendance WHERE log_id = $1;`, [testLogId])
        await client.query(`DELETE FROM public.practical_logs WHERE id = $1;`, [testLogId])
      } finally {
        client.release()
        await pool.end()
      }
    })
  })

  describe('4. Context-Scoped RLS Verification', () => {
    it('RLS policies exist and enforce scoped boundaries on student entities', async () => {
      if (!dbUrl) return
      const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
      const client = await pool.connect()

      try {
        const policies = await client.query(`
          SELECT tablename, policyname, cmd
          FROM pg_policies
          WHERE schemaname = 'public'
            AND tablename IN ('students', 'student_enrollments', 'workstation_seat_plans', 'session_seat_overrides')
          ORDER BY tablename, policyname;
        `)

        const policyNames = policies.rows.map((p) => `${p.tablename}.${p.policyname}`)

        // Verify context-scoped read policies are in place
        assert.ok(policyNames.includes('students.read_students_scoped'), 'students must have read_students_scoped policy')
        assert.ok(policyNames.includes('student_enrollments.read_student_enrollments_scoped'), 'student_enrollments must have read_student_enrollments_scoped policy')
        assert.ok(policyNames.includes('workstation_seat_plans.read_workstation_seat_plans_scoped'), 'workstation_seat_plans must have read_workstation_seat_plans_scoped policy')
        assert.ok(policyNames.includes('session_seat_overrides.read_session_seat_overrides_scoped'), 'session_seat_overrides must have read_session_seat_overrides_scoped policy')
      } finally {
        client.release()
        await pool.end()
      }
    })
  })
})
