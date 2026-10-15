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

test('Academic Year Lifecycle & Cohort Governance Test Suite', async (t) => {
  const { getClassEnrollmentStats } = await import('../app/actions/classes.ts')
  const { getAcademicYears, getCurrentAcademicYear } = await import('../app/actions/academic-years.ts')

  await t.test('1. getClassEnrollmentStats: Single query aggregation returns active student counts', async () => {
    const res = await getClassEnrollmentStats('2083')
    assert.equal(res.success, true, 'Action executed successfully')
    assert.ok(res.data, 'Data object is defined')

    // In 2083, Class 12 Eng has active students (34 computer lab workstations)
    assert.ok(res.data['12eng'] >= 30, 'Class 12 Eng has at least 30 enrolled students')
    
    // Other classes without enrolled students should either be 0 or undefined in map
    assert.ok(
      res.data['12mgt'] === undefined || res.data['12mgt'] === 0,
      'Class 12 Mgt has 0 active enrolled students'
    )
  })

  await t.test('2. getAcademicYears: Returns configured academic cycles', async () => {
    const res = await getAcademicYears()
    assert.equal(res.success, true, 'getAcademicYears succeeded')
    assert.ok(Array.isArray(res.data), 'Returns an array of academic years')
    assert.ok(res.data.length >= 2, 'Has at least 2083 and 2084 academic years')

    const currentYear = res.data.find((y) => y.is_current)
    assert.ok(currentYear, 'An active/current academic year is flagged')
    assert.equal(currentYear.id, '2083', 'Current active academic year is 2083 B.S.')
  })

  await t.test('3. getCurrentAcademicYear: Fetches single active operational cycle', async () => {
    const res = await getCurrentAcademicYear()
    assert.equal(res.success, true, 'getCurrentAcademicYear succeeded')
    assert.ok(res.data, 'Current year record is present')
    assert.equal(res.data.id, '2083', 'Matches current active year 2083')
    assert.equal(res.data.is_current, true, 'is_current flag is true')
  })

  await t.test('4. promoteCohortAction: Access control rejects unprivileged calls', async () => {
    const { promoteCohortAction } = await import('../app/actions/academic-years.ts')
    const res = await promoteCohortAction({
      fromClassId: '12eng',
      toClassId: '12eng',
      fromAcademicYearId: '2083',
      toAcademicYearId: '2084',
    })

    assert.equal(res.success, false, 'Unprivileged request rejected')
    assert.match(res.error || '', /Access denied: Only administrators can promote cohorts/i)
  })

  await t.test('5. promoteCohortAction: Validation rejects identical source and destination cohort', async () => {
    const { promoteCohortAction } = await import('../app/actions/academic-years.ts')
    const res = await promoteCohortAction({
      fromClassId: '12eng',
      toClassId: '12eng',
      fromAcademicYearId: '2083',
      toAcademicYearId: '2083',
      internalBypassScopeCheck: true,
    })

    assert.equal(res.success, false, 'Rejects promotion to exact same class and year')
    assert.match(res.error || '', /Cannot promote a cohort to the exact same class and academic year/i)
  })

  await t.test('6. promoteCohortAction: Rejects empty source cohort gracefully without mutating data', async () => {
    const { promoteCohortAction } = await import('../app/actions/academic-years.ts')
    const res = await promoteCohortAction({
      fromClassId: 'nonexistent-class-id',
      toClassId: '12eng',
      fromAcademicYearId: '2083',
      toAcademicYearId: '2084',
      internalBypassScopeCheck: true,
    })

    assert.equal(res.success, false, 'Rejects when no active student enrollments found')
    assert.match(res.error || '', /No active student enrollments found/i)
  })

  await t.test('7. promoteCohortAction: Promotes cohort successfully and updates status without constraint violations', async () => {
    const { promoteCohortAction } = await import('../app/actions/academic-years.ts')
    const { getPgPool } = await import('../lib/db.ts')
    const pool = getPgPool()
    const client = await pool.connect()

    const testStudentId1 = 'a0000000-0000-0000-0000-000000000001'
    const testStudentId2 = 'a0000000-0000-0000-0000-000000000002'
    const testStudentId3 = 'a0000000-0000-0000-0000-000000000003'

    try {
      // Setup test students
      for (const sid of [testStudentId1, testStudentId2, testStudentId3]) {
        await client.query(`
          INSERT INTO public.students (id, admission_no, full_name, is_active)
          VALUES ($1, $2, $3, true)
          ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;
        `, [sid, `ADM-${sid}`, `Student ${sid}`])
      }

      // Cleanup any leftover enrollments
      await client.query(`DELETE FROM public.student_enrollments WHERE student_id IN ($1, $2, $3) OR (academic_year_id IN ('2083', '2084') AND class_id IN ('7b', '8a'));`, [testStudentId1, testStudentId2, testStudentId3])

      // Seed 2083 enrollments in 7b
      await client.query(`
        INSERT INTO public.student_enrollments (academic_year_id, class_id, student_id, roll_number, section, status)
        VALUES 
          ('2083', '7b', $1, 1, 'A', 'active'),
          ('2083', '7b', $2, 2, 'A', 'active'),
          ('2083', '7b', $3, 3, 'A', 'active');
      `, [testStudentId1, testStudentId2, testStudentId3])

      // Execute promotion:
      // student 1: promote to 8a in 2084
      // student 2: repeat in 7b in 2084
      // student 3: archive / left school
      const promoRes = await promoteCohortAction({
        fromClassId: '7b',
        toClassId: '8a',
        fromAcademicYearId: '2083',
        toAcademicYearId: '2084',
        exceptions: [
          { studentId: testStudentId2, action: 'repeat' },
          { studentId: testStudentId3, action: 'archive' },
        ],
        internalBypassScopeCheck: true,
      })

      assert.equal(promoRes.success, true, `Cohort promotion should succeed: ${promoRes.error}`)

      // Verify student 1: prior enrollment is archived, new enrollment is active in 8a
      const s1Old = await client.query(`SELECT status FROM public.student_enrollments WHERE academic_year_id = '2083' AND student_id = $1;`, [testStudentId1])
      assert.equal(s1Old.rows[0]?.status, 'archived', 'Promoted student prior enrollment should be archived')

      const s1New = await client.query(`SELECT status, class_id FROM public.student_enrollments WHERE academic_year_id = '2084' AND student_id = $1;`, [testStudentId1])
      assert.equal(s1New.rows[0]?.status, 'active', 'Promoted student new enrollment should be active')
      assert.equal(s1New.rows[0]?.class_id, '8a', 'Promoted student new class should be 8a')

      // Verify student 2: prior enrollment is archived, new enrollment is active in 7b
      const s2Old = await client.query(`SELECT status FROM public.student_enrollments WHERE academic_year_id = '2083' AND student_id = $1;`, [testStudentId2])
      assert.equal(s2Old.rows[0]?.status, 'archived', 'Repeating student prior enrollment should be archived')

      const s2New = await client.query(`SELECT status, class_id FROM public.student_enrollments WHERE academic_year_id = '2084' AND student_id = $1;`, [testStudentId2])
      assert.equal(s2New.rows[0]?.status, 'active', 'Repeating student new enrollment should be active')
      assert.equal(s2New.rows[0]?.class_id, '7b', 'Repeating student should remain in 7b')

      // Verify student 3: marked transferred, no 2084 enrollment
      const s3Old = await client.query(`SELECT status FROM public.student_enrollments WHERE academic_year_id = '2083' AND student_id = $1;`, [testStudentId3])
      assert.equal(s3Old.rows[0]?.status, 'transferred', 'Archived student prior enrollment should be transferred')

      const s3New = await client.query(`SELECT * FROM public.student_enrollments WHERE academic_year_id = '2084' AND student_id = $1;`, [testStudentId3])
      assert.equal(s3New.rows.length, 0, 'Archived student should have no new enrollment')

    } finally {
      // Clean up test data
      await client.query(`DELETE FROM public.student_enrollments WHERE student_id IN ($1, $2, $3) OR (academic_year_id IN ('2083', '2084') AND class_id IN ('7b', '8a'));`, [testStudentId1, testStudentId2, testStudentId3])
      await client.query(`DELETE FROM public.students WHERE id IN ($1, $2, $3);`, [testStudentId1, testStudentId2, testStudentId3])
      client.release()
    }
  })

  await t.test('8. updateAcademicYearAction: Safely updates display label and dates without altering ID or hampering linked records', async () => {
    const { updateAcademicYearAction } = await import('../app/actions/academic-years.ts')
    const { getPgPool } = await import('../lib/db.ts')
    const pool = getPgPool()
    const client = await pool.connect()

    try {
      // 1. Fetch current 2083 name & dates
      const origRes = await client.query(`SELECT id, name, start_date, end_date FROM public.academic_years WHERE id = '2083';`)
      assert.equal(origRes.rows.length, 1, '2083 exists in database')
      const orig = origRes.rows[0]

      // Count existing linked practical logs & enrollments before edit
      const logsBefore = await client.query(`SELECT COUNT(*) FROM public.practical_logs WHERE academic_year_id = '2083';`)
      const enrollBefore = await client.query(`SELECT COUNT(*) FROM public.student_enrollments WHERE academic_year_id = '2083';`)

      // 2. Perform safe update
      const updateRes = await updateAcademicYearAction({
        id: '2083',
        name: '2083/84 B.S. (Amended)',
        start_date: '2083-01-01',
        end_date: '2083-12-30',
        internalBypassScopeCheck: true,
      })

      assert.equal(updateRes.success, true, 'updateAcademicYearAction should succeed')
      assert.equal(updateRes.data?.id, '2083', 'Primary key ID remains 2083')
      assert.equal(updateRes.data?.name, '2083/84 B.S. (Amended)', 'Display label updated')

      // Verify linked practical logs & enrollments are completely intact (0 data hampered)
      const logsAfter = await client.query(`SELECT COUNT(*) FROM public.practical_logs WHERE academic_year_id = '2083';`)
      const enrollAfter = await client.query(`SELECT COUNT(*) FROM public.student_enrollments WHERE academic_year_id = '2083';`)
      assert.equal(logsAfter.rows[0].count, logsBefore.rows[0].count, 'Practical log count untouched')
      assert.equal(enrollAfter.rows[0].count, enrollBefore.rows[0].count, 'Student enrollment count untouched')

      // 3. Restore original name
      await client.query(`UPDATE public.academic_years SET name = $1, start_date = $2, end_date = $3 WHERE id = '2083';`, [
        orig.name,
        orig.start_date,
        orig.end_date,
      ])
    } finally {
      client.release()
    }
  })

  await t.test('9. checkAcademicYearDependenciesAction: Detects live operational records and blocks deletion', async () => {
    const { checkAcademicYearDependenciesAction } = await import('../app/actions/academic-years.ts')

    const res = await checkAcademicYearDependenciesAction('2083')
    assert.equal(res.success, true, 'checkAcademicYearDependenciesAction succeeded')
    assert.ok(res.data, 'Returns dependency report')
    assert.equal(res.data.yearId, '2083', 'Target year is 2083')
    assert.equal(res.data.isCurrent, true, '2083 is marked current')
    assert.equal(res.data.canDelete, false, 'Deletion is strictly prohibited')
    assert.ok(res.data.totalDependencies > 0, 'Has active linked operational records')
    assert.match(res.data.blockReason || '', /Cannot delete the current active academic year cycle/i)
  })

  await t.test('10. deleteAcademicYearAction: Hard-blocks deletion of academic year with historical records', async () => {
    const { deleteAcademicYearAction } = await import('../app/actions/academic-years.ts')

    // Attempting to delete active/populated 2083
    const res = await deleteAcademicYearAction('2083', true)
    assert.equal(res.success, false, 'Deletion of 2083 should be rejected')
    assert.ok(res.error, 'Returns clear rejection reason')
    assert.match(res.error || '', /Cannot delete the current active academic year cycle/i)
  })

  await t.test('11. deleteAcademicYearAction: Safely deletes empty/accidental academic cycle with 0 records', async () => {
    const { checkAcademicYearDependenciesAction, deleteAcademicYearAction } = await import('../app/actions/academic-years.ts')
    const { getPgPool } = await import('../lib/db.ts')
    const pool = getPgPool()
    const client = await pool.connect()

    const dummyYearId = '2099-accidental'
    try {
      // 1. Create an accidental/empty year
      await client.query(`
        INSERT INTO public.academic_years (id, name, start_date, end_date, is_current)
        VALUES ($1, 'Accidental Year 2099', '2099-01-01', '2099-12-30', false)
        ON CONFLICT (id) DO NOTHING;
      `, [dummyYearId])

      // 2. Pre-flight dependency check confirms 0 records and canDelete = true
      const checkRes = await checkAcademicYearDependenciesAction(dummyYearId)
      assert.equal(checkRes.success, true, 'Pre-flight check succeeded')
      assert.equal(checkRes.data?.canDelete, true, 'canDelete is true for empty year')
      assert.equal(checkRes.data?.totalDependencies, 0, 'Total dependencies is 0')

      // 3. Execute safe delete
      const delRes = await deleteAcademicYearAction(dummyYearId, true)
      assert.equal(delRes.success, true, 'deleteAcademicYearAction succeeded for empty year')

      // 4. Verify year is deleted from DB
      const afterRes = await client.query(`SELECT id FROM public.academic_years WHERE id = $1;`, [dummyYearId])
      assert.equal(afterRes.rows.length, 0, 'Accidental year was permanently removed')

    } finally {
      await client.query(`DELETE FROM public.academic_years WHERE id = $1;`, [dummyYearId])
      client.release()
    }
  })
})

