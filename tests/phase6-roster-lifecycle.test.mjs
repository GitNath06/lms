import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

// 1. Load environment variables from .env.local
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=')
      const k = trimmed.slice(0, idx).trim()
      const v = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
      if (!process.env[k]) process.env[k] = v
    }
  }
}

process.env.NODE_ENV = 'test'

const dbUrl = process.env.DATABASE_URL
assert.ok(dbUrl, 'DATABASE_URL must be defined in .env.local for roster lifecycle integration tests')

test('Phase 6: Unified Roster Lifecycle, Archival & Governance Test Suite', async (t) => {
  const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
  const client = await pool.connect()

  // Dynamic imports for actions under test
  const {
    getStudentsByClass,
    restoreStudentEnrollmentAction,
    resequenceClassRollsAlphabeticallyAction,
    updateStudentDetailsAction,
    wipeClassCohortDataAction,
  } = await import('../app/actions/students.ts')

  // Helper to set mock user context with canonical profile IDs satisfying foreign key constraints
  const setAdminUser = () => {
    process.env.TEST_USER_OVERRIDE = JSON.stringify({
      id: '17d03665-dfaa-4edc-ab54-585057315a0b',
      email: 'admin@rrl.edu.np',
      full_name: 'System Administrator',
      role: 'super_admin',
      is_active: true,
      permissions: { all: true },
    })
  }

  const setTeacherUser = () => {
    process.env.TEST_USER_OVERRIDE = JSON.stringify({
      id: 'e5e3628a-2a76-4db1-8fe1-b6d1fb58037e',
      email: 'p.adhikari@rrl.edu.np',
      full_name: 'Dr. Prakash Adhikari',
      role: 'teacher',
      is_active: true,
      permissions: {},
    })
  }

  t.after(async () => {
    delete process.env.TEST_USER_OVERRIDE
    client.release()
    await pool.end()
  })

  // =========================================================================
  // SUBTEST 1: getStudentsByClass Status Filtering & Derived Workstation Fields
  // =========================================================================
  await t.test('1. getStudentsByClass: Multi-status segmentation & derived workstation metadata', async () => {
    setAdminUser()

    const activeRes = await getStudentsByClass({
      classId: '12eng',
      academicYearId: '2083',
      statusFilter: 'active',
    })

    assert.equal(activeRes.success, true, 'getStudentsByClass active succeeded')
    assert.ok(Array.isArray(activeRes.data), 'Returns array of students')
    assert.ok(activeRes.data.length > 0, 'Class 12 Eng has active students')

    for (const student of activeRes.data) {
      assert.equal(student.enrollment_status, 'active', 'Student enrollment status must be active')
      assert.ok('assigned_workstation_label' in student, 'Includes assigned_workstation_label property')
      assert.ok('is_unseated' in student, 'Includes is_unseated boolean property')
      if (student.assigned_workstation_label) {
        assert.equal(student.is_unseated, false, 'Seated student has is_unseated === false')
      } else {
        assert.equal(student.is_unseated, true, 'Unseated student has is_unseated === true')
      }
    }

    const allRes = await getStudentsByClass({
      classId: '12eng',
      academicYearId: '2083',
      statusFilter: 'all',
    })

    assert.equal(allRes.success, true, 'getStudentsByClass all succeeded')
    assert.ok(allRes.data.length >= activeRes.data.length, 'All filter returns >= active count')
  })

  // =========================================================================
  // SUBTEST 2: restoreStudentEnrollmentAction & Auto-Collision Resolution
  // =========================================================================
  await t.test('2. restoreStudentEnrollmentAction: Enforces permissions and auto-resolves roll collision', async () => {
    // 2a. Reject unprivileged access
    setTeacherUser()
    const unprivRes = await restoreStudentEnrollmentAction('some-enrollment-id')
    assert.equal(unprivRes.success, false, 'Unprivileged teacher call rejected')
    assert.match(unprivRes.error || '', /Access denied: Only administrators can restore archived students/i)

    // Setup clean test cohort in 11mgt
    setAdminUser()
    const testYear = '2083'
    const testClass = '11mgt'
    const studentIdA = 'b0000000-0000-0000-0000-000000000001'
    const studentIdB = 'b0000000-0000-0000-0000-000000000002'

    try {
      // Clean previous 11mgt enrollments to ensure clean slate for roll calculation
      await client.query(`DELETE FROM public.workstation_seat_plans WHERE class_id = $1 AND academic_year_id = $2;`, [testClass, testYear])
      await client.query(`DELETE FROM public.student_enrollments WHERE class_id = $1 AND academic_year_id = $2;`, [testClass, testYear])
      await client.query(`DELETE FROM public.students WHERE id IN ($1, $2);`, [studentIdA, studentIdB])

      // Seed Student A (Active at Roll 15) & Student B (Archived at Roll 14)
      await client.query(`
        INSERT INTO public.students (id, admission_no, full_name, is_active)
        VALUES 
          ($1, 'TEST-RESTORE-A', 'Bikash Tamang', true),
          ($2, 'TEST-RESTORE-B', 'Deepak Shrestha', false);
      `, [studentIdA, studentIdB])

      await client.query(`
        INSERT INTO public.student_enrollments (academic_year_id, class_id, student_id, roll_number, status)
        VALUES ($1, $2, $3, 15, 'active');
      `, [testYear, testClass, studentIdA])

      const enrB = await client.query(`
        INSERT INTO public.student_enrollments (academic_year_id, class_id, student_id, roll_number, status)
        VALUES ($1, $2, $3, 14, 'archived')
        RETURNING id;
      `, [testYear, testClass, studentIdB])

      const enrollmentBId = enrB.rows[0].id

      // 2b. Restore Student B requesting Roll 15 (which is currently occupied by Student A)
      // The restore action detects Roll 15 is occupied in 11mgt, auto-assigns next available roll (15 + 1 = 16)
      const restoreRes = await restoreStudentEnrollmentAction(enrollmentBId, 15)
      assert.equal(restoreRes.success, true, `Restore should succeed: ${restoreRes.error}`)
      assert.equal(restoreRes.newRollNumber, 16, 'Auto-assigned next available roll (15 + 1 = 16)')

      // Verify Student B enrollment in DB is active at Roll 16
      const checkEnr = await client.query(`SELECT roll_number, status FROM public.student_enrollments WHERE id = $1;`, [enrollmentBId])
      assert.equal(checkEnr.rows[0]?.status, 'active', 'Enrollment is active')
      assert.equal(checkEnr.rows[0]?.roll_number, 16, 'Roll is 16')

      // Verify Student B person record is reactivated
      const checkStd = await client.query(`SELECT is_active FROM public.students WHERE id = $1;`, [studentIdB])
      assert.equal(checkStd.rows[0]?.is_active, true, 'Student person record is marked is_active = true')

    } finally {
      await client.query(`DELETE FROM public.student_enrollments WHERE student_id IN ($1, $2);`, [studentIdA, studentIdB])
      await client.query(`DELETE FROM public.students WHERE id IN ($1, $2);`, [studentIdA, studentIdB])
    }
  })

  // =========================================================================
  // SUBTEST 3: resequenceClassRollsAlphabeticallyAction Guards & Execution
  // =========================================================================
  await t.test('3. resequenceClassRollsAlphabeticallyAction: Guards logbook integrity & sorts A-Z', async () => {
    // 3a. Rejects unprivileged caller
    setTeacherUser()
    const unprivRes = await resequenceClassRollsAlphabeticallyAction({ classId: '12eng', academicYearId: '2083' })
    assert.equal(unprivRes.success, false, 'Unprivileged resequence rejected')
    assert.match(unprivRes.error || '', /Access denied: Only administrators can resequence roll numbers/i)

    setAdminUser()

    // 3b. Strictly blocks resequencing when practical attendance logs exist (e.g., 12eng has 105 logs)
    const blockedRes = await resequenceClassRollsAlphabeticallyAction({ classId: '12eng', academicYearId: '2083' })
    assert.equal(blockedRes.success, false, 'Blocked resequence when practical attendance logs exist')
    assert.match(
      blockedRes.error || '',
      /Cannot resequence roll numbers: .* practical attendance record\(s\) already exist for this class/i
    )

    // 3c. Clean resequencing execution for 0-log cohort
    const testYear = '2083'
    const testClass = '11mgt'
    const s1 = 'c0000000-0000-0000-0000-000000000001'
    const s2 = 'c0000000-0000-0000-0000-000000000002'
    const s3 = 'c0000000-0000-0000-0000-000000000003'

    try {
      await client.query(`DELETE FROM public.student_enrollments WHERE academic_year_id = $1 AND class_id = $2;`, [testYear, testClass])
      await client.query(`DELETE FROM public.students WHERE id IN ($1, $2, $3);`, [s1, s2, s3])

      // Seed students in reverse alphabetical order
      await client.query(`
        INSERT INTO public.students (id, admission_no, full_name, is_active)
        VALUES 
          ($1, 'TEST-SEQ-1', 'Zoya Thapa', true),
          ($2, 'TEST-SEQ-2', 'Anil Regmi', true),
          ($3, 'TEST-SEQ-3', 'Manoj Dahal', true);
      `, [s1, s2, s3])

      // Assign non-alphabetical initial rolls:
      // Zoya (s1) -> Roll 1
      // Anil (s2) -> Roll 2
      // Manoj (s3) -> Roll 3
      await client.query(`
        INSERT INTO public.student_enrollments (academic_year_id, class_id, student_id, roll_number, status)
        VALUES 
          ($1, $2, $3, 1, 'active'),
          ($1, $2, $4, 2, 'active'),
          ($1, $2, $5, 3, 'active');
      `, [testYear, testClass, s1, s2, s3])

      // Execute alphabetical resequence
      const seqRes = await resequenceClassRollsAlphabeticallyAction({
        classId: testClass,
        academicYearId: testYear,
      })

      assert.equal(seqRes.success, true, `Resequence should succeed: ${seqRes.error}`)
      assert.equal(seqRes.count, 3, 'Resequenced 3 active students')

      // Verify sorted order A-Z:
      // Anil Regmi -> Roll 1
      // Manoj Dahal -> Roll 2
      // Zoya Thapa -> Roll 3
      const enrCheck = await client.query(`
        SELECT se.roll_number, s.full_name
        FROM public.student_enrollments se
        JOIN public.students s ON s.id = se.student_id
        WHERE se.student_id IN ($1, $2, $3)
        ORDER BY se.roll_number ASC;
      `, [s1, s2, s3])

      assert.equal(enrCheck.rows[0]?.full_name, 'Anil Regmi')
      assert.equal(enrCheck.rows[0]?.roll_number, 1)

      assert.equal(enrCheck.rows[1]?.full_name, 'Manoj Dahal')
      assert.equal(enrCheck.rows[1]?.roll_number, 2)

      assert.equal(enrCheck.rows[2]?.full_name, 'Zoya Thapa')
      assert.equal(enrCheck.rows[2]?.roll_number, 3)

    } finally {
      await client.query(`DELETE FROM public.student_enrollments WHERE student_id IN ($1, $2, $3);`, [s1, s2, s3])
      await client.query(`DELETE FROM public.students WHERE id IN ($1, $2, $3);`, [s1, s2, s3])
    }
  })

  // =========================================================================
  // SUBTEST 4: updateStudentDetailsAction Friendly Collision Handling
  // =========================================================================
  await t.test('4. updateStudentDetailsAction: Pre-save duplicate roll & admission guards', async () => {
    setAdminUser()
    const testYear = '2083'
    const testClass = '11mgt'
    const s1 = 'd0000000-0000-0000-0000-000000000001'
    const s2 = 'd0000000-0000-0000-0000-000000000002'

    try {
      await client.query(`DELETE FROM public.student_enrollments WHERE academic_year_id = $1 AND class_id = $2;`, [testYear, testClass])
      await client.query(`DELETE FROM public.students WHERE id IN ($1, $2);`, [s1, s2])

      await client.query(`
        INSERT INTO public.students (id, admission_no, full_name, is_active)
        VALUES 
          ($1, 'TEST-ADM-COLL-1', 'Gaurav Karki', true),
          ($2, 'TEST-ADM-COLL-2', 'Nabin Bhatta', true);
      `, [s1, s2])

      const enr1Res = await client.query(`
        INSERT INTO public.student_enrollments (academic_year_id, class_id, student_id, roll_number, status)
        VALUES ($1, $2, $3, 10, 'active')
        RETURNING id;
      `, [testYear, testClass, s1])

      const enr2Res = await client.query(`
        INSERT INTO public.student_enrollments (academic_year_id, class_id, student_id, roll_number, status)
        VALUES ($1, $2, $3, 11, 'active')
        RETURNING id;
      `, [testYear, testClass, s2])

      const enr2Id = enr2Res.rows[0].id

      // 4a. Attempt to change Student 2's roll to Roll 10 (already held by Gaurav Karki)
      const rollCollRes = await updateStudentDetailsAction({
        studentId: s2,
        enrollmentId: enr2Id,
        fullName: 'Nabin Bhatta',
        rollNumber: 10,
        admissionNo: 'TEST-ADM-COLL-2',
      })

      assert.equal(rollCollRes.success, false, 'Roll collision rejected')
      assert.match(
        rollCollRes.error || '',
        /Roll 10 is already occupied by Gaurav Karki\. Please choose an unassigned roll number\./i
      )

      // 4b. Attempt to assign Student 1's admission number to Student 2
      const admCollRes = await updateStudentDetailsAction({
        studentId: s2,
        enrollmentId: enr2Id,
        fullName: 'Nabin Bhatta',
        rollNumber: 11,
        admissionNo: 'TEST-ADM-COLL-1',
      })

      assert.equal(admCollRes.success, false, 'Duplicate admission number rejected')
      assert.match(
        admCollRes.error || '',
        /Admission number "TEST-ADM-COLL-1" is already assigned to Gaurav Karki\./i
      )

      // 4c. Valid update succeeds
      const validRes = await updateStudentDetailsAction({
        studentId: s2,
        enrollmentId: enr2Id,
        fullName: 'Nabin Bhatta (Updated)',
        rollNumber: 12,
        admissionNo: 'TEST-ADM-COLL-2-UPDATED',
        gender: 'male',
      })

      assert.equal(validRes.success, true, `Valid update succeeds: ${validRes.error}`)

      const verifyRow = await client.query(`SELECT full_name, admission_no FROM public.students WHERE id = $1;`, [s2])
      assert.equal(verifyRow.rows[0]?.full_name, 'Nabin Bhatta (Updated)')
      assert.equal(verifyRow.rows[0]?.admission_no, 'TEST-ADM-COLL-2-UPDATED')

    } finally {
      await client.query(`DELETE FROM public.student_enrollments WHERE student_id IN ($1, $2);`, [s1, s2])
      await client.query(`DELETE FROM public.students WHERE id IN ($1, $2);`, [s1, s2])
    }
  })

  // =========================================================================
  // SUBTEST 5: wipeClassCohortDataAction Danger Zone Execution & Receipt
  // =========================================================================
  await t.test('5. wipeClassCohortDataAction: Danger zone access guard & atomic cohort purge', async () => {
    // 5a. Access guard: rejects non-super_admin
    setTeacherUser()
    const unprivRes = await wipeClassCohortDataAction({
      classId: '11mgt',
      academicYearId: '2083',
      confirmPhrase: 'WIPE 11MGT',
    })
    assert.equal(unprivRes.success, false, 'Unauthorized non-super_admin rejected')
    assert.match(unprivRes.error || '', /restricted exclusively to Super Administrators/i)

    setAdminUser()

    // 5b. Confirmation phrase mismatch rejected
    const mismatchRes = await wipeClassCohortDataAction({
      classId: '11mgt',
      academicYearId: '2083',
      confirmPhrase: 'DELETE PLEASE',
    })
    assert.equal(mismatchRes.success, false, 'Confirmation phrase mismatch rejected')
    assert.match(mismatchRes.error || '', /Confirmation phrase mismatch/i)

    // 5c. Atomic wipe execution on test class cohort
    const testYear = '2083'
    const testClass = '11mgt'
    const s1 = 'e0000000-0000-0000-0000-000000000001'
    const s2 = 'e0000000-0000-0000-0000-000000000002'

    try {
      await client.query(`
        DELETE FROM public.workstation_seat_plans 
        WHERE enrollment_id IN (SELECT id FROM public.student_enrollments WHERE academic_year_id = $1 AND class_id = $2);
      `, [testYear, testClass])
      await client.query(`DELETE FROM public.student_enrollments WHERE academic_year_id = $1 AND class_id = $2;`, [testYear, testClass])
      await client.query(`DELETE FROM public.students WHERE id IN ($1, $2);`, [s1, s2])

      await client.query(`
        INSERT INTO public.students (id, admission_no, full_name, is_active)
        VALUES 
          ($1, 'TEST-WIPE-1', 'Purge Candidate 1', true),
          ($2, 'TEST-WIPE-2', 'Purge Candidate 2', true);
      `, [s1, s2])

      const enr1Res = await client.query(`
        INSERT INTO public.student_enrollments (academic_year_id, class_id, student_id, roll_number, status)
        VALUES ($1, $2, $3, 101, 'active')
        RETURNING id;
      `, [testYear, testClass, s1])

      const enr2Res = await client.query(`
        INSERT INTO public.student_enrollments (academic_year_id, class_id, student_id, roll_number, status)
        VALUES ($1, $2, $3, 102, 'active')
        RETURNING id;
      `, [testYear, testClass, s2])

      const enr1Id = enr1Res.rows[0].id

      // Seed dummy seat plan
      const wsCheck = await client.query(`SELECT id FROM public.workstations WHERE is_active = true LIMIT 1;`)
      if (wsCheck.rows.length > 0) {
        await client.query(`
          INSERT INTO public.workstation_seat_plans (academic_year_id, class_id, enrollment_id, workstation_id, lab_id)
          VALUES ($1, $2, $3, $4, 'comp');
        `, [testYear, testClass, enr1Id, wsCheck.rows[0].id])
      }

      // Execute wipe action with exact confirmation phrase
      const wipeRes = await wipeClassCohortDataAction({
        classId: testClass,
        academicYearId: testYear,
        confirmPhrase: `WIPE ${testClass.toUpperCase()}`,
        reason: 'Automated Test Suite Verification',
      })

      assert.equal(wipeRes.success, true, `Wipe should succeed: ${wipeRes.error}`)
      assert.ok(wipeRes.receipt, 'Returns receipt object')
      assert.ok(wipeRes.receipt.enrollmentsDeleted >= 2, 'Deleted at least 2 test enrollments')
      assert.ok(wipeRes.receipt.studentsDeleted >= 2, 'Deleted orphaned test students')

      // Verify enrollments are purged from DB
      const enrCheck = await client.query(`
        SELECT count(*) FROM public.student_enrollments 
        WHERE academic_year_id = $1 AND class_id = $2;
      `, [testYear, testClass])
      assert.equal(parseInt(enrCheck.rows[0].count), 0, 'Zero enrollments remain for this class')

      // Verify orphaned test students are deleted
      const stdCheck = await client.query(`SELECT count(*) FROM public.students WHERE id IN ($1, $2);`, [s1, s2])
      assert.equal(parseInt(stdCheck.rows[0].count), 0, 'Orphaned test students completely removed')

      // Verify audit log entry exists in public.audit_logs
      const auditCheck = await client.query(`
        SELECT action, entity_type, entity_label 
        FROM public.audit_logs 
        WHERE metadata->>'action' = 'WIPE_CLASS_COHORT'
        ORDER BY created_at DESC 
        LIMIT 1;
      `)
      assert.equal(auditCheck.rows.length, 1, 'Audit log entry was recorded')
      assert.equal(auditCheck.rows[0]?.action, 'DELETE')
      assert.equal(auditCheck.rows[0]?.entity_type, 'roster')

    } finally {
      await client.query(`
        DELETE FROM public.workstation_seat_plans 
        WHERE enrollment_id IN (SELECT id FROM public.student_enrollments WHERE student_id IN ($1, $2));
      `, [s1, s2])
      await client.query(`DELETE FROM public.student_enrollments WHERE student_id IN ($1, $2);`, [s1, s2])
      await client.query(`DELETE FROM public.students WHERE id IN ($1, $2);`, [s1, s2])
    }
  })
})
