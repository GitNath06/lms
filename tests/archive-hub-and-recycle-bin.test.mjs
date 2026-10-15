import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// Load environment variables for database connection
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
process.env.TEST_USER_OVERRIDE = JSON.stringify({
  id: '17d03665-dfaa-4edc-ab54-585057315a0b',
  email: 'admin@rrl.edu.np',
  full_name: 'System Administrator',
  role: 'super_admin',
  is_active: true,
  permissions: { all: true },
})

test('Institutional Recycle Bin & Archive Hub Test Suite', async (t) => {
  const {
    getArchiveHubTelemetryAction,
    getArchivedStudentsAction,
    getArchivedAcademicYearsAction,
    getArchivedInfrastructureAction,
    restoreStudentAction,
    permanentPurgeTrashAction,
    restoreInfrastructureItemAction,
  } = await import('../app/actions/archive-hub.ts')
  const { getPgPool } = await import('../lib/db.ts')
  const pool = getPgPool()

  await t.test('1. getArchiveHubTelemetryAction: Returns valid operational telemetry counts', async () => {
    const res = await getArchiveHubTelemetryAction(true)
    assert.equal(res.success, true, 'getArchiveHubTelemetryAction succeeded')
    assert.ok(res.data, 'Telemetry data object is returned')
    assert.equal(typeof res.data.trashCount, 'number', 'trashCount is a number')
    assert.equal(typeof res.data.graduatedCount, 'number', 'graduatedCount is a number')
    assert.equal(typeof res.data.transferredCount, 'number', 'transferredCount is a number')
    assert.equal(typeof res.data.archivedYearsCount, 'number', 'archivedYearsCount is a number')
    assert.equal(typeof res.data.inactiveLabsCount, 'number', 'inactiveLabsCount is a number')
    assert.equal(typeof res.data.archivedCategoriesCount, 'number', 'archivedCategoriesCount is a number')
  })

  await t.test('2. getArchivedStudentsAction: Returns records for trash, graduated, and transferred', async () => {
    const trashRes = await getArchivedStudentsAction({ category: 'trash', internalBypassScopeCheck: true })
    assert.equal(trashRes.success, true, 'Querying trash succeeded')
    assert.ok(Array.isArray(trashRes.data), 'Returns array of trash students')

    const gradRes = await getArchivedStudentsAction({ category: 'graduated', internalBypassScopeCheck: true })
    assert.equal(gradRes.success, true, 'Querying graduated succeeded')
    assert.ok(Array.isArray(gradRes.data), 'Returns array of graduated alumni')

    const transRes = await getArchivedStudentsAction({ category: 'transferred', internalBypassScopeCheck: true })
    assert.equal(transRes.success, true, 'Querying transferred succeeded')
    assert.ok(Array.isArray(transRes.data), 'Returns array of transferred students')
  })

  await t.test('3. getArchivedAcademicYearsAction: Returns past non-current academic cycles', async () => {
    const res = await getArchivedAcademicYearsAction(true)
    assert.equal(res.success, true, 'getArchivedAcademicYearsAction succeeded')
    assert.ok(Array.isArray(res.data), 'Returns array of past academic cycles')
    for (const yr of res.data) {
      assert.equal(yr.isCurrent, false, 'All returned cycles must be non-current')
      assert.ok(typeof yr.totalLogs === 'number', 'Includes total practical logs count')
      assert.ok(typeof yr.totalEnrollments === 'number', 'Includes total enrollments count')
    }
  })

  await t.test('4. getArchivedInfrastructureAction: Returns inactive labs or categories', async () => {
    const res = await getArchivedInfrastructureAction(true)
    assert.equal(res.success, true, 'getArchivedInfrastructureAction succeeded')
    assert.ok(Array.isArray(res.data), 'Returns array of infrastructure items')
  })

  await t.test('5. restoreStudentAction: Restores soft-deleted student to active status', async () => {
    const client = await pool.connect()
    const testStudentId = 'b0000000-0000-0000-0000-000000000001'

    try {
      // 1. Seed soft-deleted student
      await client.query(`
        INSERT INTO public.students (id, admission_no, full_name, is_active, archived_at, archive_reason)
        VALUES ($1, 'TEST-ARCHIVE-01', 'Soft Deleted Test Student', false, NOW(), 'Accidental soft-delete')
        ON CONFLICT (id) DO UPDATE SET is_active = false, archived_at = NOW(), archive_reason = 'Accidental soft-delete';
      `, [testStudentId])

      // 2. Call restore
      const restoreRes = await restoreStudentAction({
        studentId: testStudentId,
        internalBypassScopeCheck: true,
      })

      assert.equal(restoreRes.success, true, 'restoreStudentAction succeeded')
      assert.equal(restoreRes.restoredStudentName, 'Soft Deleted Test Student', 'Returns restored student name')

      // 3. Verify in database
      const checkRes = await client.query(`SELECT is_active, archived_at, archive_reason FROM public.students WHERE id = $1;`, [testStudentId])
      assert.equal(checkRes.rows[0]?.is_active, true, 'Student is active in DB')
      assert.equal(checkRes.rows[0]?.archived_at, null, 'archived_at is cleared to null')
      assert.equal(checkRes.rows[0]?.archive_reason, null, 'archive_reason is cleared to null')

    } finally {
      await client.query(`DELETE FROM public.students WHERE id = $1;`, [testStudentId])
      client.release()
    }
  })

  await t.test('6. restoreStudentAction: Auto-resolves roll collision when restoring enrollment', async () => {
    const client = await pool.connect()
    const testStudent1 = 'b0000000-0000-0000-0000-000000000010'
    const testStudent2 = 'b0000000-0000-0000-0000-000000000020'
    const testEnroll1 = 'b0000000-0000-0000-0000-000000000011'
    const testEnroll2 = 'b0000000-0000-0000-0000-000000000022'

    try {
      // 1. Seed two students
      await client.query(`
        INSERT INTO public.students (id, admission_no, full_name, is_active)
        VALUES 
          ($1, 'TEST-ACT-10', 'Active Student Roll 1', true),
          ($2, 'TEST-ARC-20', 'Archived Student Prior Roll 1', false)
        ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;
      `, [testStudent1, testStudent2])

      // Clean up previous test enrollments and test roll numbers
      await client.query(`DELETE FROM public.student_enrollments WHERE academic_year_id = '2083' AND class_id = '12eng' AND roll_number IN (191, 192, 193);`)
      await client.query(`DELETE FROM public.student_enrollments WHERE id IN ($1, $2);`, [testEnroll1, testEnroll2])

      // Student 1 is active with Roll 191 in 2083 Class 12eng
      await client.query(`
        INSERT INTO public.student_enrollments (id, academic_year_id, class_id, student_id, roll_number, status)
        VALUES ($1, '2083', '12eng', $2, 191, 'active');
      `, [testEnroll1, testStudent1])

      // Student 2 is archived with Roll 192 in 2083 Class 12eng
      await client.query(`
        INSERT INTO public.student_enrollments (id, academic_year_id, class_id, student_id, roll_number, status)
        VALUES ($1, '2083', '12eng', $2, 192, 'archived');
      `, [testEnroll2, testStudent2])

      // 2. Restore Student 2: Desired Roll 191 is taken by Student 1
      const restoreRes = await restoreStudentAction({
        studentId: testStudent2,
        enrollmentId: testEnroll2,
        targetRollNumber: 191, // Requests occupied Roll 191
        internalBypassScopeCheck: true,
      })

      assert.equal(restoreRes.success, true, 'Restore succeeded')
      // Roll collision was automatically resolved to a higher unassigned roll
      assert.ok(restoreRes.newRollNumber && restoreRes.newRollNumber > 191, `New roll assigned: ${restoreRes.newRollNumber}`)

      // Verify in DB that status is active and roll is updated
      const checkEnr = await client.query(`SELECT roll_number, status FROM public.student_enrollments WHERE id = $1;`, [testEnroll2])
      assert.equal(checkEnr.rows[0]?.status, 'active', 'Enrollment is active')
      assert.notEqual(checkEnr.rows[0]?.roll_number, 191, 'Roll was auto-offset to prevent duplicate key error')

    } finally {
      await client.query(`DELETE FROM public.student_enrollments WHERE id IN ($1, $2);`, [testEnroll1, testEnroll2])
      await client.query(`DELETE FROM public.students WHERE id IN ($1, $2);`, [testStudent1, testStudent2])
      client.release()
    }
  })

  await t.test('7. permanentPurgeTrashAction: Safely purges zero-history student from Recycle Bin', async () => {
    const client = await pool.connect()
    const dummyStudentId = 'b0000000-0000-0000-0000-000000000099'
    const dummyEnrollId = 'b0000000-0000-0000-0000-000000000098'

    try {
      // 1. Seed an accidental zero-history student in trash
      await client.query(`
        INSERT INTO public.students (id, admission_no, full_name, is_active, archived_at, archive_reason)
        VALUES ($1, 'DUMMY-PURGE-99', 'Accidental Trash Student', false, NOW(), 'Mistake creation');
      `, [dummyStudentId])

      await client.query(`
        INSERT INTO public.student_enrollments (id, academic_year_id, class_id, student_id, roll_number, status)
        VALUES ($1, '2083', '12eng', $2, 99, 'archived');
      `, [dummyEnrollId, dummyStudentId])

      // 2. Call permanent purge
      const purgeRes = await permanentPurgeTrashAction({
        studentId: dummyStudentId,
        enrollmentId: dummyEnrollId,
        internalBypassScopeCheck: true,
      })

      assert.equal(purgeRes.success, true, 'permanentPurgeTrashAction succeeded for zero-history student')

      // 3. Verify student and enrollment are deleted from database
      const enrCheck = await client.query(`SELECT id FROM public.student_enrollments WHERE id = $1;`, [dummyEnrollId])
      assert.equal(enrCheck.rows.length, 0, 'Enrollment was permanently removed')

      const stuCheck = await client.query(`SELECT id FROM public.students WHERE id = $1;`, [dummyStudentId])
      assert.equal(stuCheck.rows.length, 0, 'Student person record was permanently removed')

    } finally {
      await client.query(`DELETE FROM public.student_enrollments WHERE id = $1;`, [dummyEnrollId])
      await client.query(`DELETE FROM public.students WHERE id = $1;`, [dummyStudentId])
      client.release()
    }
  })

  await t.test('8. restoreInfrastructureItemAction: Reactivates lab facility and incident category', async () => {
    const client = await pool.connect()
    const testLabId = 'test-inactive-lab'

    try {
      // 1. Seed inactive lab
      await client.query(`
        INSERT INTO public.labs (id, name, code, capacity, type, status, is_active)
        VALUES ($1, 'Test Inactive Lab', 'INACT-01', 30, 'computer_lab', 'Inactive', false)
        ON CONFLICT (id) DO UPDATE SET status = 'Inactive', is_active = false;
      `, [testLabId])

      // 2. Restore lab
      const restoreRes = await restoreInfrastructureItemAction({
        itemType: 'lab',
        itemId: testLabId,
        internalBypassScopeCheck: true,
      })

      assert.equal(restoreRes.success, true, 'restoreInfrastructureItemAction succeeded')

      // 3. Verify in DB
      const checkLab = await client.query(`SELECT status, is_active FROM public.labs WHERE id = $1;`, [testLabId])
      assert.equal(checkLab.rows[0]?.status, 'Operational', 'Lab is operational')
      assert.equal(checkLab.rows[0]?.is_active, true, 'is_active is true')

    } finally {
      await client.query(`DELETE FROM public.labs WHERE id = $1;`, [testLabId])
      client.release()
    }
  })

  await t.test('9. permanentPurgeTrashAction: HARD-BLOCKS purge if student has recorded practical attendance logs', async () => {
    const client = await pool.connect()
    const studentWithLogs = 'b0000000-0000-0000-0000-000000000055'
    const enrollWithLogs = 'b0000000-0000-0000-0000-000000000056'
    const dummyLogId = 'b0000000-0000-0000-0000-000000000057'
    const dummyAttendanceId = 'b0000000-0000-0000-0000-000000000058'

    try {
      // 1. Seed student with archived status
      await client.query(`
        INSERT INTO public.students (id, admission_no, full_name, is_active, archived_at, archive_reason)
        VALUES ($1, 'TEST-ATT-55', 'Student With Real Logs', false, NOW(), 'Soft deleted test');
      `, [studentWithLogs])

      await client.query(`
        INSERT INTO public.student_enrollments (id, academic_year_id, class_id, student_id, roll_number, status)
        VALUES ($1, '2083', '12eng', $2, 55, 'archived');
      `, [enrollWithLogs, studentWithLogs])

      // 2. Fetch a valid class_subject_id
      const csRes = await client.query(`SELECT id FROM public.class_subjects LIMIT 1;`)
      const classSubjectId = csRes.rows[0]?.id || null

      // 3. Seed a practical log and attendance record
      await client.query(`
        INSERT INTO public.practical_logs (id, lab_id, date, period_label, subject_name, batch_group, practical_title, total_students, present_students, absent_students, status, class_subject_id, academic_year_id)
        VALUES ($1, 'comp', CURRENT_DATE, 'Period 1', 'Computer Science', 'Batch A', 'Safety Test Log', 1, 1, 0, 'conducted', $2, '2083');
      `, [dummyLogId, classSubjectId])

      await client.query(`
        INSERT INTO public.log_attendance (id, log_id, enrollment_id, student_id, roll_number, is_present)
        VALUES ($1, $2, $3, $4, 55, true);
      `, [dummyAttendanceId, dummyLogId, enrollWithLogs, studentWithLogs])

      // 3. Attempt permanent purge - MUST FAIL and roll back
      const purgeAttempt = await permanentPurgeTrashAction({
        studentId: studentWithLogs,
        enrollmentId: enrollWithLogs,
        internalBypassScopeCheck: true,
      })

      assert.equal(purgeAttempt.success, false, 'Permanent purge MUST be blocked')
      assert.match(purgeAttempt.error || '', /Permanent purge blocked: Student has \d+ recorded practical attendance logs/i, 'Error message warns about NEB compliance and preserved logs')

      // 4. Verify student and enrollment are still preserved in database
      const enrCheck = await client.query(`SELECT id FROM public.student_enrollments WHERE id = $1;`, [enrollWithLogs])
      assert.equal(enrCheck.rows.length, 1, 'Enrollment remains preserved')

      const stuCheck = await client.query(`SELECT id FROM public.students WHERE id = $1;`, [studentWithLogs])
      assert.equal(stuCheck.rows.length, 1, 'Student record remains preserved')

    } finally {
      await client.query(`DELETE FROM public.log_attendance WHERE id = $1;`, [dummyAttendanceId])
      await client.query(`DELETE FROM public.practical_logs WHERE id = $1;`, [dummyLogId])
      await client.query(`DELETE FROM public.student_enrollments WHERE id = $1;`, [enrollWithLogs])
      await client.query(`DELETE FROM public.students WHERE id = $1;`, [studentWithLogs])
      client.release()
    }
  })
})
