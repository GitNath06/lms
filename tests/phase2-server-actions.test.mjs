import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { resolveUserScope } from '../lib/context/user-scope.ts'
import { validateFloorCoordinates, clampFloorCoordinates, FLOOR_ELEMENT_CATALOG } from '../lib/floor-elements.ts'

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

describe('Phase 2: Security Context Hardening & Server Operations Suite', () => {
  const dbUrl = loadDbUrl()

  describe('1. Security Context Hardening & Teacher Fallback Protection', () => {
    it('CRITICAL: Unassigned teacher receives empty scope and NEVER defaults to institutional classes/labs', () => {
      const unassignedTeacherProfile = {
        id: '99999999-0000-0000-0000-000000000000',
        email: 'unassigned.teacher@rrl.edu.np',
        full_name: 'Unassigned Test Teacher',
        role: 'teacher',
        is_active: true,
        permissions: {},
        created_at: new Date().toISOString(),
      }

      const scope = resolveUserScope(unassignedTeacherProfile)

      // Verified: must NOT fall back to DEFAULT_CLASSES / DEFAULT_SUBJECTS / LAB_ROOMS
      assert.equal(scope.isPrivileged, false, 'Teacher must not be privileged')
      assert.equal(scope.isTeacher, true, 'isTeacher must be true')
      assert.deepEqual(scope.assignedClasses, [], 'Unassigned teacher must receive empty assignedClasses')
      assert.deepEqual(scope.assignedSubjects, [], 'Unassigned teacher must receive empty assignedSubjects')
      assert.deepEqual(scope.assignedLabIds, [], 'Unassigned teacher must receive empty assignedLabIds')
      assert.equal(scope.defaultViewMode, 'my_data', 'Unassigned teacher must have view mode my_data')
    })

    it('Assigned teacher receives strictly their authorized curriculum scope', () => {
      // Er. Anish Karki (t4)
      const assignedTeacherProfile = {
        id: 'f3ad9570-a56c-4727-82b7-b3edd942896c',
        email: 'a.karki@rrl.edu.np',
        full_name: 'Er. Anish Karki',
        role: 'teacher',
        is_active: true,
        permissions: {},
        created_at: new Date().toISOString(),
      }

      const scope = resolveUserScope(assignedTeacherProfile)

      assert.equal(scope.isPrivileged, false)
      assert.ok(scope.assignedClasses.includes('12C'), 'Must include 12C')
      assert.ok(scope.assignedClasses.includes('11C'), 'Must include 11C')
      assert.ok(scope.assignedLabIds.includes('comp'), 'Must include comp lab')
      assert.ok(!scope.assignedClasses.includes('12 Sc'), 'Must NOT include 12 Sc (General Science)')
      assert.ok(!scope.assignedLabIds.includes('bio'), 'Must NOT include biology lab')
    })

    it('Privileged user (Super Admin / In-Charge / HOD) receives institutional scope', () => {
      const superAdminProfile = {
        id: '11111111-0000-0000-0000-000000000000',
        email: 'admin@rrl.edu.np',
        full_name: 'Super Administrator',
        role: 'super_admin',
        is_active: true,
        permissions: {},
        created_at: new Date().toISOString(),
      }

      const scope = resolveUserScope(superAdminProfile)
      assert.equal(scope.isPrivileged, true)
      assert.equal(scope.isTeacher, false)
      assert.ok(scope.assignedClasses.length > 0, 'Admin receives all classes')
      assert.ok(scope.assignedLabIds.length > 0, 'Admin receives all labs')
      assert.equal(scope.defaultViewMode, 'institutional')
    })
  })

  describe('2. Floor Landmarks Catalog & Coordinate Validation', () => {
    it('Floor element catalog contains valid default dimensions and categories', () => {
      assert.ok(FLOOR_ELEMENT_CATALOG.teacher_desk, 'teacher_desk must exist in catalog')
      assert.ok(FLOOR_ELEMENT_CATALOG.whiteboard, 'whiteboard must exist in catalog')
      assert.ok(FLOOR_ELEMENT_CATALOG.door, 'door must exist in catalog')
      assert.ok(FLOOR_ELEMENT_CATALOG.network_rack, 'network_rack must exist in catalog')

      assert.equal(FLOOR_ELEMENT_CATALOG.teacher_desk.category, 'teaching')
      assert.equal(FLOOR_ELEMENT_CATALOG.door.category, 'boundary')
      assert.equal(FLOOR_ELEMENT_CATALOG.network_rack.category, 'infrastructure')
    })

    it('validateFloorCoordinates rejects negative numbers and numbers above 100', () => {
      assert.equal(validateFloorCoordinates(0, 0), true)
      assert.equal(validateFloorCoordinates(100, 100), true)
      assert.equal(validateFloorCoordinates(48.5, 32.2), true)

      assert.equal(validateFloorCoordinates(-1, 50), false)
      assert.equal(validateFloorCoordinates(50, 101), false)
      assert.equal(validateFloorCoordinates(NaN, 50), false)
    })

    it('clampFloorCoordinates bounds values to specified limits safely', () => {
      assert.deepEqual(clampFloorCoordinates(-10, 120), { x: 0, y: 100 })
      assert.deepEqual(clampFloorCoordinates(45.67, 88.12), { x: 45.7, y: 88.1 })
    })
  })

  describe('3. Database Operations: Students, Enrollments & Two-Tier Seating', () => {
    it('Transactional Student Creation + Enrollment + Duplicate Roll Protection', async () => {
      if (!dbUrl) return
      const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
      const client = await pool.connect()

      const testAdmNo = `TEST-${Date.now()}`
      let testStudentId = null
      let testEnrollmentId = null

      try {
        await client.query('BEGIN')

        // 1. Insert test student
        const studentRes = await client.query(`
          INSERT INTO public.students (full_name, admission_no, is_active)
          VALUES ('Test Student Alpha', $1, true)
          RETURNING id;
        `, [testAdmNo])
        testStudentId = studentRes.rows[0].id
        assert.ok(testStudentId, 'Student ID must be returned')

        // 2. Enroll student into Class 12 Eng (12eng) for 2083 as Roll 99
        const enrollRes = await client.query(`
          INSERT INTO public.student_enrollments (academic_year_id, class_id, student_id, roll_number, status)
          VALUES ('2083', '12eng', $1, 99, 'active')
          RETURNING id;
        `, [testStudentId])
        testEnrollmentId = enrollRes.rows[0].id
        assert.ok(testEnrollmentId, 'Enrollment ID must be returned')

        // 3. Duplicate Roll Test: Enrolling another student with Roll 99 in 2083 / 12eng MUST FAIL
        const studentRes2 = await client.query(`
          INSERT INTO public.students (full_name, admission_no, is_active)
          VALUES ('Test Student Beta', $1, true)
          RETURNING id;
        `, [`${testAdmNo}-B`])
        const testStudentId2 = studentRes2.rows[0].id

        let duplicateRollFailed = false
        try {
          await client.query(`
            INSERT INTO public.student_enrollments (academic_year_id, class_id, student_id, roll_number, status)
            VALUES ('2083', '12eng', $1, 99, 'active');
          `, [testStudentId2])
          // Because uq_enrollment_roll is DEFERRABLE INITIALLY DEFERRED, trigger check within transaction
          await client.query('SET CONSTRAINTS ALL IMMEDIATE;')
        } catch (dupErr) {
          duplicateRollFailed = true
          assert.equal(dupErr.code, '23505', 'PostgreSQL error code must be unique_violation (23505)')
        }
        assert.ok(duplicateRollFailed, 'Duplicate roll number in same cohort must be rejected by uq_enrollment_roll')

        await client.query('ROLLBACK')
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
        await pool.end()
      }
    })

    it('Two-Tier Seating: Default Allocation & Session Override Collision Protection', async () => {
      if (!dbUrl) return
      const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
      const client = await pool.connect()

      try {
        await client.query('BEGIN')

        // Get a valid workstation in comp lab
        const wsRes = await client.query(`SELECT id FROM public.workstations WHERE lab_id = 'comp' LIMIT 2;`)
        assert.ok(wsRes.rows.length >= 2, 'Need at least 2 workstations')
        const wsA = wsRes.rows[0].id
        const wsB = wsRes.rows[1].id

        // Create 2 test students and enrollments
        const s1Res = await client.query(`
          INSERT INTO public.students (full_name, admission_no) VALUES ('Seat Student A', $1) RETURNING id;
        `, [`SEAT-A-${Date.now()}`])
        const e1Res = await client.query(`
          INSERT INTO public.student_enrollments (academic_year_id, class_id, student_id, roll_number)
          VALUES ('2083', '12eng', $1, 88) RETURNING id;
        `, [s1Res.rows[0].id])

        const s2Res = await client.query(`
          INSERT INTO public.students (full_name, admission_no) VALUES ('Seat Student B', $1) RETURNING id;
        `, [`SEAT-B-${Date.now()}`])
        const e2Res = await client.query(`
          INSERT INTO public.student_enrollments (academic_year_id, class_id, student_id, roll_number)
          VALUES ('2083', '12eng', $1, 89) RETURNING id;
        `, [s2Res.rows[0].id])

        const enrollA = e1Res.rows[0].id
        const enrollB = e2Res.rows[0].id

        // Pre-clean any leftover seat plans on wsA and wsB to ensure isolated test state
        await client.query(`
          DELETE FROM public.workstation_seat_plans 
          WHERE lab_id = 'comp' AND academic_year_id = '2083' AND workstation_id IN ($1, $2);
        `, [wsA, wsB])

        // 1. Assign Student A to Workstation A (Tier 1 Default)
        await client.query(`
          INSERT INTO public.workstation_seat_plans (lab_id, academic_year_id, class_id, workstation_id, enrollment_id)
          VALUES ('comp', '2083', '12eng', $1, $2);
        `, [wsA, enrollA])

        // 2. Duplicate Workstation Check: Attempting to assign Student B to Workstation A in same cohort MUST FAIL
        let duplicateWsFailed = false
        try {
          await client.query('SAVEPOINT sp_dup_ws;')
          await client.query(`
            INSERT INTO public.workstation_seat_plans (lab_id, academic_year_id, class_id, workstation_id, enrollment_id)
            VALUES ('comp', '2083', '12eng', $1, $2);
          `, [wsA, enrollB])
        } catch (dupWsErr) {
          await client.query('ROLLBACK TO SAVEPOINT sp_dup_ws;')
          duplicateWsFailed = true
          assert.equal(dupWsErr.code, '23505', 'Must fail with unique_violation')
        }
        assert.ok(duplicateWsFailed, 'Workstation cannot have 2 students assigned in same cohort')

        // 3. Multi-Cohort Workstation Sharing: Assigning Student in Class 11 Eng to Workstation A MUST SUCCEED
        const e11Res = await client.query(`
          INSERT INTO public.student_enrollments (academic_year_id, class_id, student_id, roll_number)
          VALUES ('2083', '11eng', $1, 88) RETURNING id;
        `, [s1Res.rows[0].id])
        await client.query(`
          INSERT INTO public.workstation_seat_plans (lab_id, academic_year_id, class_id, workstation_id, enrollment_id)
          VALUES ('comp', '2083', '11eng', $1, $2);
        `, [wsA, e11Res.rows[0].id])
        // Succeeded: PC-01 is safely shared between 12eng and 11eng!

        // 4. Session Seat Override (Tier 2): Temporarily assign Student A to Workstation B for a specific schedule session
        const schedRes = await client.query("SELECT id FROM public.schedules WHERE lab_id = 'comp' LIMIT 1;")
        const testSchedId = schedRes.rows[0]?.id || 'sun-1'
        const today = new Date().toISOString().split('T')[0]
        await client.query(`
          INSERT INTO public.session_seat_overrides (schedule_id, session_date, enrollment_id, workstation_id, reason)
          VALUES ($1, $2, $3, $4, 'PC-01 mouse fault');
        `, [testSchedId, today, enrollA, wsB])

        // 5. Override Collision Guard: Attempting to reassign Student B to Workstation B in same session MUST FAIL
        let overrideCollisionFailed = false
        try {
          await client.query('SAVEPOINT sp_ov_col;')
          await client.query(`
            INSERT INTO public.session_seat_overrides (schedule_id, session_date, enrollment_id, workstation_id, reason)
            VALUES ($1, $2, $3, $4, 'Another override');
          `, [testSchedId, today, enrollB, wsB])
        } catch (ovColErr) {
          await client.query('ROLLBACK TO SAVEPOINT sp_ov_col;')
          overrideCollisionFailed = true
          assert.equal(ovColErr.code, '23505', 'Must fail with uq_session_override_workstation')
        }
        assert.ok(overrideCollisionFailed, 'Destination workstation collision guard must reject second override')

        await client.query('ROLLBACK')
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
        await pool.end()
      }
    })
  })
})
