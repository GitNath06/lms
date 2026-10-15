import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'

// 1. Load environment variables
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

const { getPgPool } = await import('../lib/db.ts')
const pool = getPgPool()

// Import server actions
const {
  createAcademicYear,
  updateAcademicYearAction,
  deleteAcademicYearAction,
  getAcademicYears,
} = await import('../app/actions/academic-years.ts')

const {
  getStudentsByClass,
  updateStudentDetailsAction,
  deleteStudentEnrollmentAction,
} = await import('../app/actions/students.ts')

const {
  getArchiveHubTelemetryAction,
  getArchivedStudentsAction,
  restoreStudentAction,
  permanentPurgeTrashAction,
} = await import('../app/actions/archive-hub.ts')

const {
  getPracticalRecords,
  getAcademicYearsForFilterAction,
  exportPracticalRecordsAction,
} = await import('../app/actions/records.ts')

console.log('========================================================================')
console.log('🧪 RUNNING PHASE 5: LIVE SCENARIO TESTING WITH DEMO DATA')
console.log('========================================================================\n')

async function runScenario1() {
  console.log('▶ [Scenario 1]: Accidental Academic Year Creation & Safe Deletion')
  
  // 1. Create a mistakenly created academic year
  const mistakeId = '2089-mistake'
  const createRes = await createAcademicYear({
    id: mistakeId,
    name: '2089/90 Mistake Test Year',
    start_date: '2032-04-14',
    end_date: '2033-04-13',
    is_current: false,
  })
  assert.equal(createRes.success, true, 'Created mistaken test academic year')
  console.log('  ✔ Created mistake year: 2089-mistake')

  // Verify it exists in DB
  const checkDb = await pool.query('SELECT id, name FROM academic_years WHERE id = $1', [mistakeId])
  assert.equal(checkDb.rows.length, 1, 'Year exists in database')

  // 2. Safe deletion of the mistake year (0 enrollments, 0 logs)
  const deleteRes = await deleteAcademicYearAction(mistakeId, true)
  assert.equal(deleteRes.success, true, 'deleteAcademicYearAction succeeded for 0-dependency year')
  console.log('  ✔ Safely deleted mistake year without errors')

  // Verify it is completely removed
  const checkDbAfter = await pool.query('SELECT id FROM academic_years WHERE id = $1', [mistakeId])
  assert.equal(checkDbAfter.rows.length, 0, 'Year is completely purged from database')
  console.log('  ✔ Verified 2089-mistake is permanently removed\n')
}

async function runScenario2() {
  console.log('▶ [Scenario 2]: Historical Academic Year Delete-Lock Protection (1000-Log Lock)')
  
  // Year 2083 has active/archived enrollments and practical logs
  const deleteAttemptRes = await deleteAcademicYearAction('2083', true)
  assert.equal(deleteAttemptRes.success, false, 'Deletion of year with dependencies is blocked')
  assert.match(
    deleteAttemptRes.error || '',
    /Deletion Blocked|cannot be deleted/i,
    'Returned clear human-readable error explaining dependency lock'
  )
  console.log('  ✔ Server action safety lock successfully BLOCKED deletion of year 2083')
  console.log(`  ✔ Error message provided to user: "${deleteAttemptRes.error}"`)

  // Verify year 2083 still exists intact
  const check2083 = await pool.query('SELECT id, name FROM academic_years WHERE id = $1', ['2083'])
  assert.equal(check2083.rows.length, 1, 'Year 2083 remains 100% intact in database')
  console.log('  ✔ Database record for 2083 verified untouched\n')
}

async function runScenario3() {
  console.log('▶ [Scenario 3]: Delete vs Archive Conflict & Institutional Recycle Bin (Trash)')
  
  const studentId = 'b0000000-0000-0000-0000-000000000099'
  const enrollmentId = 'c0000000-0000-0000-0000-000000000099'

  try {
    // 1. Create a demo student in Class 11 Eng (Year 2084)
    await pool.query(`
      INSERT INTO public.students (id, admission_no, full_name, gender, is_active)
      VALUES ($1, 'ADM-DEMO-99', 'Dipesh Shrestha (Demo Test)', 'male', true)
      ON CONFLICT (id) DO UPDATE SET is_active = true, archive_reason = null, archived_at = null;
    `, [studentId])

    await pool.query(`
      INSERT INTO public.student_enrollments (id, academic_year_id, class_id, student_id, roll_number, status)
      VALUES ($1, '2084', '11eng', $2, 99, 'active')
      ON CONFLICT (id) DO UPDATE SET status = 'active', roll_number = 99;
    `, [enrollmentId, studentId])

    console.log(`  ✔ Created demo student: Dipesh Shrestha (ID: ${studentId}, Roll: 99) in Class 11 Eng (2084)`)

    // 2. Perform a "Soft Delete" (Move to Recycle Bin)
    await pool.query(`
      UPDATE public.students 
      SET is_active = false, archive_reason = 'soft_delete', archived_at = NOW() 
      WHERE id = $1;
    `, [studentId])
    await pool.query(`
      UPDATE public.student_enrollments 
      SET status = 'archived' 
      WHERE id = $1;
    `, [enrollmentId])
    console.log('  ✔ Soft-deleted student to Institutional Recycle Bin')

    // Verify in Database: Soft-deleted, NOT destroyed
    const dbStudent = await pool.query(
      'SELECT is_active, archive_reason, archived_at FROM students WHERE id = $1',
      [studentId]
    )
    assert.equal(dbStudent.rows[0].is_active, false, 'is_active set to false')
    assert.equal(dbStudent.rows[0].archive_reason, 'soft_delete', 'archive_reason tagged as soft_delete')
    assert.ok(dbStudent.rows[0].archived_at, 'archived_at timestamp populated')
    console.log('  ✔ Verified soft-delete: is_active=false, archive_reason="soft_delete"')

    // 3. Verify student appears in the Archive Hub / Recycle Bin (Trash Tab)
    const trashList = await getArchivedStudentsAction({ category: 'trash', internalBypassScopeCheck: true })
    assert.equal(trashList.success, true, 'getArchivedStudentsAction for trash succeeded')
    const foundInTrash = trashList.data.find((s) => s.studentId === studentId)
    assert.ok(foundInTrash, 'Student found in Institutional Recycle Bin / Trash')
    console.log('  ✔ Student instantly visible in Recycle Bin (Trash tab)')

    // 4. Test 1-Click Restore
    const restoreRes = await restoreStudentAction({
      studentId,
      enrollmentId,
      internalBypassScopeCheck: true,
    })
    assert.equal(restoreRes.success, true, 'restoreStudentAction succeeded')
    console.log('  ✔ Clicked "Restore" from Recycle Bin')

    // Verify restored state in DB and active roster
    const restoredDb = await pool.query(
      'SELECT is_active, archive_reason, archived_at FROM students WHERE id = $1',
      [studentId]
    )
    assert.equal(restoredDb.rows[0].is_active, true, 'is_active restored to true')
    assert.equal(restoredDb.rows[0].archive_reason, null, 'archive_reason cleared to null')
    assert.equal(restoredDb.rows[0].archived_at, null, 'archived_at cleared to null')

    const activeRoster = await getStudentsByClass({ classId: '11eng', academicYearId: '2084' })
    assert.equal(activeRoster.success, true, 'getStudentsByClass succeeded')
    const inActiveRoster = activeRoster.data.find((s) => s.student_id === studentId)
    assert.ok(inActiveRoster, 'Student is back in Class 11 Eng active roster')
    assert.equal(inActiveRoster.roll_number, 99, 'Roll number 99 preserved intact')
    console.log('  ✔ Restored student is back in Class 11 Eng active roster with roll 99 intact')

    // 5. Clean up demo student via permanent purge (since 0 logs)
    await pool.query(`UPDATE public.students SET is_active = false, archive_reason = 'soft_delete' WHERE id = $1;`, [studentId])
    const purgeRes = await permanentPurgeTrashAction({ studentId, enrollmentId, internalBypassScopeCheck: true })
    assert.equal(purgeRes.success, true, 'permanentPurgeTrashAction succeeded for 0-log student')
    console.log('  ✔ Cleaned up test student via permanent purge (permitted for 0 logs)\n')
  } finally {
    await pool.query('DELETE FROM public.student_enrollments WHERE id = $1;', [enrollmentId]).catch(() => {})
    await pool.query('DELETE FROM public.students WHERE id = $1;', [studentId]).catch(() => {})
  }
}

async function runScenario4() {
  console.log('▶ [Scenario 4]: Academic Alumni Archiving vs Trash Differentiation')
  
  const studentId = 'b0000000-0000-0000-0000-000000000098'
  const enrollmentId = 'c0000000-0000-0000-0000-000000000098'

  try {
    // 1. Seed a graduating student
    await pool.query(`
      INSERT INTO public.students (id, admission_no, full_name, gender, is_active)
      VALUES ($1, 'ADM-GRAD-001', 'Pooja Bhattarai (Graduating Alumni)', 'female', true)
      ON CONFLICT (id) DO UPDATE SET is_active = true;
    `, [studentId])

    await pool.query(`
      INSERT INTO public.student_enrollments (id, academic_year_id, class_id, student_id, roll_number, status)
      VALUES ($1, '2084', '12eng', $2, 98, 'graduated')
      ON CONFLICT (id) DO UPDATE SET status = 'graduated';
    `, [enrollmentId, studentId])
    console.log('  ✔ Enrolled student in Class 12 Eng with status="graduated"')

    // 2. Verify categorization in Archive Hub:
    // Must NOT appear in Trash!
    const trashCheck = await getArchivedStudentsAction({ category: 'trash', internalBypassScopeCheck: true })
    const inTrash = trashCheck.data.some((s) => s.studentId === studentId)
    assert.equal(inTrash, false, 'Graduated student does NOT appear in Trash Bin')

    // MUST appear in Graduated Alumni Register!
    const gradList = await getArchivedStudentsAction({ category: 'graduated', internalBypassScopeCheck: true })
    const inGrad = gradList.data.some((s) => s.studentId === studentId)
    assert.equal(inGrad, true, 'Graduated student appears in Graduated Alumni Register')
    console.log('  ✔ Verified separation: Alumni appears in Graduation Register, NOT in Recycle Bin (Trash)')

    // 3. Test Transferred Category
    await pool.query(`UPDATE public.student_enrollments SET status = 'transferred' WHERE id = $1;`, [enrollmentId])
    const transList = await getArchivedStudentsAction({ category: 'transferred', internalBypassScopeCheck: true })
    const inTrans = transList.data.some((s) => s.studentId === studentId)
    assert.equal(inTrans, true, 'Transferred student appears in Transferred Out Register')
    console.log('  ✔ Transferred student appears in Transfer Register, NOT in Recycle Bin (Trash)\n')
  } finally {
    await pool.query('DELETE FROM public.student_enrollments WHERE id = $1;', [enrollmentId]).catch(() => {})
    await pool.query('DELETE FROM public.students WHERE id = $1;', [studentId]).catch(() => {})
  }
}

async function runScenario5() {
  console.log('▶ [Scenario 5]: Live Admin Auto-Revalidation & Roster Sync')

  const studentId = 'b0000000-0000-0000-0000-000000000095'
  const enrollmentId = 'c0000000-0000-0000-0000-000000000095'

  try {
    // 1. Seed initial student
    await pool.query(`
      INSERT INTO public.students (id, admission_no, full_name, gender, is_active)
      VALUES ($1, 'ADM-SYNC-101', 'Bikram Thapa (Live Sync Test)', 'male', true)
      ON CONFLICT (id) DO UPDATE SET full_name = 'Bikram Thapa (Live Sync Test)', is_active = true;
    `, [studentId])

    await pool.query(`
      INSERT INTO public.student_enrollments (id, academic_year_id, class_id, student_id, roll_number, status)
      VALUES ($1, '2084', '11eng', $2, 95, 'active')
      ON CONFLICT (id) DO UPDATE SET roll_number = 95, status = 'active';
    `, [enrollmentId, studentId])

    // Verify instant fetch reflects the new student
    const list1 = await getStudentsByClass({ classId: '11eng', academicYearId: '2084' })
    assert.ok(list1.data.some((s) => s.student_id === studentId), 'New student immediately visible in class roster')
    console.log('  ✔ Student instantly appears in class roster after create (Roll: 95)')

    // 2. Update student name and roll via server action
    const updateRes = await updateStudentDetailsAction({
      enrollmentId,
      studentId,
      fullName: 'Bikram Thapa (Updated)',
      rollNumber: 96,
      admissionNo: 'ADM-SYNC-101',
      gender: 'male',
    })
    assert.equal(updateRes.success, true, 'updateStudentDetailsAction succeeded')

    // 3. Verify instant fetch reflects the updated details
    const list2 = await getStudentsByClass({ classId: '11eng', academicYearId: '2084' })
    const updatedStudent = list2.data.find((s) => s.student_id === studentId)
    assert.equal(updatedStudent.full_name, 'Bikram Thapa (Updated)', 'Name updated in roster')
    assert.equal(updatedStudent.roll_number, 96, 'Roll number updated in roster')
    console.log('  ✔ Student update reflected immediately (Name: Bikram Thapa (Updated), Roll: 96)\n')
  } finally {
    await pool.query('DELETE FROM public.student_enrollments WHERE id = $1;', [enrollmentId]).catch(() => {})
    await pool.query('DELETE FROM public.students WHERE id = $1;', [studentId]).catch(() => {})
  }
}

async function runScenario6() {
  console.log('▶ [Scenario 6]: Multi-Year Historical Practical Logbook & Audit Print Parity')

  // 1. Check existing verified practical log in 2083
  const records2083 = await getPracticalRecords({ academic_year_id: '2083' }, 'none')
  assert.equal(records2083.success, true, 'Query for 2083 practical records succeeded')
  console.log(`  ✔ Retrieved ${records2083.totalCount} historical practical log(s) for Academic Year 2083`)

  // 2. Query for 2084 practical records
  const records2084 = await getPracticalRecords({ academic_year_id: '2084' }, 'none')
  assert.equal(records2084.success, true, 'Query for 2084 practical records succeeded')
  
  // Verify 2083 log is NOT in 2084 query
  const records2083Flat = records2083.sections.flatMap((s) => s.records)
  const records2084Flat = records2084.sections.flatMap((s) => s.records)
  for (const r83 of records2083Flat) {
    const leakedInto2084 = records2084Flat.some((r84) => r84.id === r83.id)
    assert.equal(leakedInto2084, false, 'Historical 2083 log did not leak into 2084 query')
  }
  console.log('  ✔ Strict isolation: 2083 practical logs are isolated from 2084 live query')

  // 3. Test Export for Historical Year 2083
  const exportRes = await exportPracticalRecordsAction(
    { academic_year_id: '2083' },
    'none',
    'xlsx',
    { visibleColumns: ['date', 'period', 'facility', 'class_batch', 'subject', 'attendance', 'status'] }
  )
  assert.equal(exportRes.success, true, 'Export for 2083 succeeded')
  assert.ok(exportRes.filename.includes('ay-2083'), `Filename reflects academic year 2083: ${exportRes.filename}`)
  console.log(`  ✔ Excel export generated with year metadata: ${exportRes.filename}`)

  // 4. Test Academic Years Filter Options
  const ayFilterRes = await getAcademicYearsForFilterAction()
  assert.equal(ayFilterRes.success, true, 'getAcademicYearsForFilterAction succeeded')
  const ay2083 = ayFilterRes.data.find((y) => y.id === '2083')
  const ay2084 = ayFilterRes.data.find((y) => y.id === '2084')
  assert.ok(ay2083, 'Academic Year 2083 available in filter options')
  assert.ok(ay2084, 'Academic Year 2084 available in filter options')
  assert.equal(ay2084.isCurrent, true, '2084 is designated as Active')
  assert.equal(ay2083.isCurrent, false, '2083 is designated as Archived')
  console.log('  ✔ Academic Year selector options verified: 2084 (Active) vs 2083 (Archived)\n')
}

try {
  await runScenario1()
  await runScenario2()
  await runScenario3()
  await runScenario4()
  await runScenario5()
  await runScenario6()

  console.log('========================================================================')
  console.log('🎉 ALL 6 SCENARIOS VALIDATED & PASSED WITH 100% SUCCESS!')
  console.log('========================================================================')
} catch (err) {
  console.error('\n❌ SCENARIO RUN FAILED:', err)
  process.exit(1)
} finally {
  await pool.end()
}
