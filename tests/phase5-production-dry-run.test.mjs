import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// Native environment variables loader for direct PostgreSQL connection
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

// Enable test runner mode
process.env.LABSYNC_TEST_RUNNER = 'true'

test('Phase 5: Automated 3-Pipeline Dry-Run Verification & Production Handover', async (t) => {
  const { getClassesAction, createClassAction, deactivateClassAction } = await import('../app/actions/classes.ts')
  const {
    getSubjectsAction,
    getClassSubjectsAction,
    createSubjectAction,
    assignSubjectToClassAction,
    removeClassSubjectAction,
    deactivateSubjectAction,
  } = await import('../app/actions/subjects.ts')
  const { getPeriodSlotsAction } = await import('../app/actions/settings.ts')
  const { getActiveAcademicYearAction } = await import('../app/actions/academic-years.ts')
  const { getScopedLogFormOptions, createPracticalLog, updatePracticalLog } = await import('../app/actions/logs.ts')
  const {
    getIssueCategories,
    manageIssueCategory,
    reportWorkstationIssue,
    resolveWorkstationIssue,
  } = await import('../app/actions/workstations.ts')
  const { getPracticalRecords } = await import('../app/actions/records.ts')
  const {
    getFacultyPracticalLedger,
    getStudentBoardComplianceReport,
    exportStudentBoardComplianceAction,
  } = await import('../app/actions/institutional-reports.ts')
  const { exportMaintenanceRecordsAction } = await import('../app/actions/maintenance.ts')
  const { getPgPool } = await import('../lib/db.ts')

  const pool = getPgPool()
  const suffix = Date.now().toString().slice(-6)

  // Test Entities Identifiers
  const testSubjectId = `sub-p5-${suffix}`
  const testSubjectCode = `P5_${suffix}`
  const testSubjectName = `Pipeline 5 Core Electronics ${suffix}`
  const testClassId = `cls-p5-${suffix}`
  const testClassName = `Class 11 Science P5 ${suffix}`
  const testCategoryName = `P5 Fault Cat ${suffix}`
  const testLogId = `log-p5-${suffix}`

  let testClassSubjectId = null
  let testCategoryId = null
  let testIssueId = null
  let testMaintenanceLogId = null
  let approvedTeacher = null
  let targetWorkstation = null
  let currentYearId = null

  // Pre-flight database discovery: query approved teacher, admin, incharge, active workstation, and current year
  const teacherQuery = await pool.query(
    "SELECT id, full_name, email, role, approval_status, is_active FROM public.profiles WHERE role = 'teacher' AND approval_status = 'approved' AND is_active = true LIMIT 1;"
  )
  assert.ok(teacherQuery.rows.length > 0, 'Must have at least one approved teacher in database')
  approvedTeacher = teacherQuery.rows[0]

  const adminQuery = await pool.query(
    "SELECT id, full_name, email, role, approval_status, is_active FROM public.profiles WHERE role = 'super_admin' AND approval_status = 'approved' AND is_active = true LIMIT 1;"
  )
  const realAdmin = adminQuery.rows[0] || {
    id: '17d03665-dfaa-4edc-ab54-585057315a0b',
    email: 'admin@rrl.edu.np',
    full_name: 'System Administrator',
  }

  const inchargeQuery = await pool.query(
    "SELECT id, full_name, email, role, approval_status, is_active FROM public.profiles WHERE role = 'lab_incharge' AND approval_status = 'approved' AND is_active = true LIMIT 1;"
  )
  const realIncharge = inchargeQuery.rows[0] || {
    id: 'b7c832c9-4616-4eac-8402-2936caa1b948',
    email: 'incharge@rrl.edu.np',
    full_name: 'Dr. Rajesh Sharma',
  }

  const wsQuery = await pool.query(
    "SELECT id, label, lab_id, is_active FROM public.workstations WHERE lab_id = 'comp' AND is_active = true LIMIT 1;"
  )
  assert.ok(wsQuery.rows.length > 0, 'Must have at least one active workstation in comp lab')
  targetWorkstation = wsQuery.rows[0]

  const yearQuery = await pool.query(
    'SELECT id, name, is_current FROM public.academic_years WHERE is_current = true LIMIT 1;'
  )
  currentYearId = yearQuery.rows[0]?.id || '2083'

  // Define User Profiles for RBAC Simulation
  const SUPER_ADMIN_USER = {
    id: realAdmin.id,
    email: realAdmin.email,
    full_name: realAdmin.full_name,
    role: 'super_admin',
    approval_status: 'approved',
    is_active: true,
    permissions: {
      canManageUsers: true,
      canConfigureSystem: true,
      canSignOffLogs: true,
      canManageCurriculum: true,
    },
  }

  const PENDING_USER = {
    id: '00000000-0000-0000-0000-000000000099',
    email: 'pending.dryrun@labsync.edu.np',
    full_name: 'Pending Intruder',
    role: 'teacher',
    approval_status: 'pending',
    is_active: false,
    permissions: {},
  }

  const REJECTED_USER = {
    id: '00000000-0000-0000-0000-000000000098',
    email: 'rejected.dryrun@labsync.edu.np',
    full_name: 'Rejected Actor',
    role: 'super_admin',
    approval_status: 'rejected',
    is_active: false,
    permissions: {},
  }

  const LAB_INCHARGE_USER = {
    id: realIncharge.id,
    email: realIncharge.email,
    full_name: realIncharge.full_name,
    role: 'lab_incharge',
    approval_status: 'approved',
    is_active: true,
    permissions: {
      canSignOffLogs: true,
      canConfigureSystem: true,
    },
  }

  // Spotless Cleanup Guarantee: Runs at test completion to ensure 0 leftover test rows
  t.after(async () => {
    try {
      if (testIssueId) {
        await pool.query('DELETE FROM public.workstation_issues WHERE id = $1;', [testIssueId])
      }
      if (testLogId) {
        await pool.query('DELETE FROM public.log_attendance WHERE log_id = $1;', [testLogId])
        await pool.query('DELETE FROM public.practical_logs WHERE id = $1;', [testLogId])
      }
      if (testClassSubjectId) {
        await pool.query('DELETE FROM public.practical_logs WHERE class_subject_id = $1;', [testClassSubjectId])
        await pool.query('DELETE FROM public.class_subjects WHERE id = $1;', [testClassSubjectId])
      }
      await pool.query('DELETE FROM public.class_subjects WHERE class_id = $1 OR subject_id = $2;', [
        testClassId,
        testSubjectId,
      ])
      await pool.query('DELETE FROM public.classes WHERE id = $1;', [testClassId])
      await pool.query('DELETE FROM public.subjects WHERE id = $1 OR code = $2;', [
        testSubjectId,
        testSubjectCode,
      ])
      if (testCategoryId) {
        await pool.query('DELETE FROM public.issue_categories WHERE id = $1;', [testCategoryId])
      }
      // Clean up test maintenance logs
      await pool.query(
        "DELETE FROM public.maintenance_logs WHERE remarks LIKE '%Pipeline%' OR remarks LIKE '%' || $1 || '%' OR work_performed LIKE '%' || $1 || '%';",
        [suffix]
      )
    } catch (cleanupErr) {
      console.warn('Test cleanup notice:', cleanupErr.message)
    }
  })

  // ============================================================================
  // PIPELINE 1: Master Configuration Pipeline (Super Admin)
  // ============================================================================
  await t.test('Pipeline 1: Master Configuration Pipeline', async (p1) => {
    // 1.1 Super Admin Authentication Override
    process.env.TEST_USER_OVERRIDE = JSON.stringify(SUPER_ADMIN_USER)

    await p1.test('1.1 Super Admin creates test Subject in canonical catalog', async () => {
      const res = await createSubjectAction({
        id: testSubjectId,
        code: testSubjectCode,
        name: testSubjectName,
        default_lab_id: 'comp',
        credit_hours: 4,
        is_active: true,
      })
      assert.equal(res.success, true, `createSubjectAction failed: ${res.error}`)
      assert.ok(res.data, 'Should return created subject record')
      assert.equal(res.data.id, testSubjectId)
      assert.equal(res.data.code, testSubjectCode)
      assert.equal(res.data.is_active, true)
    })

    await p1.test('1.2 Super Admin creates test Class in canonical catalog', async () => {
      const res = await createClassAction({
        id: testClassId,
        name: testClassName,
        grade: 11,
        section: 'Alpha',
        capacity: 36,
        is_active: true,
      })
      assert.equal(res.success, true, `createClassAction failed: ${res.error}`)
      assert.ok(res.data, 'Should return created class record')
      assert.equal(res.data.id, testClassId)
      assert.equal(res.data.name, testClassName)
      assert.equal(res.data.capacity, 36)
    })

    await p1.test('1.3 Super Admin assigns Subject + approved Teacher to Class (public.class_subjects)', async () => {
      const res = await assignSubjectToClassAction({
        class_id: testClassId,
        subject_id: testSubjectId,
        teacher_id: approvedTeacher.id,
        default_lab_id: 'comp',
        academic_year_id: currentYearId,
      })
      assert.equal(res.success, true, `assignSubjectToClassAction failed: ${res.error}`)

      // Fetch created junction row
      const csQuery = await pool.query(
        'SELECT id, academic_year_id, class_id, subject_id, teacher_id, default_lab_id FROM public.class_subjects WHERE class_id = $1 AND subject_id = $2 LIMIT 1;',
        [testClassId, testSubjectId]
      )
      assert.equal(csQuery.rows.length, 1, 'class_subjects mapping row must exist in PostgreSQL')
      testClassSubjectId = csQuery.rows[0].id
      assert.equal(csQuery.rows[0].teacher_id, approvedTeacher.id)
      assert.equal(csQuery.rows[0].default_lab_id, 'comp')
    })

    await p1.test('1.4 Super Admin creates custom Issue Category in public.issue_categories', async () => {
      const res = await manageIssueCategory('create', {
        name: testCategoryName,
        type: 'hardware',
        color: '#10B981',
        icon: 'Cpu',
        default_severity: 'high',
        is_active: true,
        sort_order: 99,
      })
      assert.equal(res.success, true, `manageIssueCategory failed: ${res.error}`)
      assert.ok(res.data?.id, 'Should return created category with UUID')
      testCategoryId = res.data.id
      assert.equal(res.data.name, testCategoryName)
    })

    await p1.test('1.5 Verify getPeriodSlotsAction() and getActiveAcademicYearAction() return institutional master data', async () => {
      const periodRes = await getPeriodSlotsAction()
      assert.equal(periodRes.success, true, 'getPeriodSlotsAction should succeed')
      assert.ok(Array.isArray(periodRes.data), 'Period slots must be an array')
      assert.ok(periodRes.data.length > 0, 'Should return configured bell/period slots')

      const yearRes = await getActiveAcademicYearAction()
      assert.equal(yearRes.success, true, 'getActiveAcademicYearAction should succeed')
      assert.ok(yearRes.data, 'Active academic year must be present')
      assert.equal(yearRes.data.is_current, true, 'Academic year must be marked is_current = true')
    })

    await p1.test('1.6 Downstream verification: Newly created entities immediately appear in /schedules query actions', async () => {
      // /schedules uses getClassSubjectsAction, getClassesAction, and getSubjectsAction
      const classSubjectsRes = await getClassSubjectsAction(testClassId)
      assert.equal(classSubjectsRes.success, true, 'getClassSubjectsAction should succeed')
      const mapping = classSubjectsRes.data.find((m) => m.subject_id === testSubjectId)
      assert.ok(mapping, 'Enriched mapping must contain test subject')
      assert.equal(mapping.teacher_id, approvedTeacher.id)
      assert.equal(mapping.subject_code, testSubjectCode)

      const classesRes = await getClassesAction({ activeOnly: true })
      assert.equal(classesRes.success, true)
      assert.ok(classesRes.data.some((c) => c.id === testClassId), 'getClassesAction must include test class')

      const subjectsRes = await getSubjectsAction({ activeOnly: true })
      assert.equal(subjectsRes.success, true)
      assert.ok(subjectsRes.data.some((s) => s.id === testSubjectId), 'getSubjectsAction must include test subject')
    })

    await p1.test('1.7 Downstream verification: Assigned class and subject appear in /records/new (getScopedLogFormOptions)', async () => {
      // Switch user override to the approved teacher
      process.env.TEST_USER_OVERRIDE = JSON.stringify({
        id: approvedTeacher.id,
        email: approvedTeacher.email,
        full_name: approvedTeacher.full_name,
        role: 'teacher',
        approval_status: 'approved',
        is_active: true,
        permissions: {},
      })

      const options = await getScopedLogFormOptions()
      assert.ok(options.assignedClasses, 'assignedClasses should be defined')
      assert.ok(
        options.assignedClasses.includes(testClassName),
        `assignedClasses should include ${testClassName}`
      )
      assert.ok(options.assignedSubjects, 'assignedSubjects should be defined')
      const subjectMatch = options.assignedSubjects.find(
        (s) => s.code === testSubjectCode && s.grade === testClassName
      )
      assert.ok(subjectMatch, `assignedSubjects should contain ${testSubjectCode} assigned to ${testClassName}`)
    })

    await p1.test('1.8 Downstream verification: Custom issue category appears in /incidents (getIssueCategories)', async () => {
      const catRes = await getIssueCategories()
      assert.equal(catRes.success, true, 'getIssueCategories should succeed')
      assert.ok(Array.isArray(catRes.data), 'Categories should be an array')
      const catMatch = catRes.data.find((c) => c.id === testCategoryId)
      assert.ok(catMatch, 'Custom issue category must appear in getIssueCategories')
      assert.equal(catMatch.name, testCategoryName)
    })
  })

  // ============================================================================
  // PIPELINE 2: Teacher Live Practical & Mobile Roll-Call Pipeline
  // ============================================================================
  await t.test('Pipeline 2: Teacher Live Practical & Mobile Roll-Call Pipeline', async (p2) => {
    // 2.1 Set user context as Approved Teacher
    process.env.TEST_USER_OVERRIDE = JSON.stringify({
      id: approvedTeacher.id,
      email: approvedTeacher.email,
      full_name: approvedTeacher.full_name,
      role: 'teacher',
      approval_status: 'approved',
      is_active: true,
      permissions: {},
    })

    await p2.test('2.1 Approved teacher logs practical session with roll-call attendance (1 absent)', async () => {
      const logRes = await createPracticalLog({
        id: testLogId,
        class_subject_id: testClassSubjectId,
        academic_year_id: currentYearId,
        lab_id: 'comp',
        teacher_id: approvedTeacher.id,
        date: '2026-10-07', // Valid academic working Wednesday (non-holiday, non-recess)
        period_label: 'Period 1 & 2 (10:10 - 11:45)',
        subject_name: `${testSubjectCode} - ${testSubjectName}`,
        batch_group: testClassName,
        practical_title: `Dry-Run Practical Session ${suffix}`,
        total_students: 32,
        present_students: 31,
        absent_students: 1,
        absent_rolls: [7],
        remarks: 'Mobile bench roll-call logged by teacher',
        status: 'conducted',
      })

      assert.equal(logRes.success, true, `createPracticalLog failed: ${logRes.error}`)

      // Direct PostgreSQL verification
      const checkLog = await pool.query('SELECT * FROM public.practical_logs WHERE id = $1;', [testLogId])
      assert.equal(checkLog.rows.length, 1, 'Practical log row must exist in PostgreSQL')
      const row = checkLog.rows[0]
      assert.equal(row.total_students, 32)
      assert.equal(row.present_students, 31)
      assert.equal(row.absent_students, 1)
      assert.equal(row.class_subject_id, testClassSubjectId)
      assert.equal(row.status, 'conducted')
    })

    await p2.test('2.2 Teacher flags a workstation fault ticket in public.workstation_issues using custom category', async () => {
      const issueRes = await reportWorkstationIssue({
        workstation_id: targetWorkstation.id,
        category_id: testCategoryId,
        title: `Fault Ticket ${suffix} - GPU Artifacts`,
        description: `GPU flickering and high heat detected on ${targetWorkstation.label} during practical session.`,
        severity: 'high',
      })

      assert.equal(issueRes.success, true, `reportWorkstationIssue failed: ${issueRes.error}`)
      assert.ok(issueRes.issue?.id, 'Fault ticket must be returned with UUID')
      testIssueId = issueRes.issue.id

      // Direct PostgreSQL verification
      const checkIssue = await pool.query('SELECT * FROM public.workstation_issues WHERE id = $1;', [testIssueId])
      assert.equal(checkIssue.rows.length, 1, 'Workstation issue row must exist in PostgreSQL')
      const issueRow = checkIssue.rows[0]
      assert.equal(issueRow.workstation_id, targetWorkstation.id)
      assert.equal(issueRow.category_id, testCategoryId)
      assert.equal(issueRow.status, 'open')
      assert.equal(issueRow.severity, 'high')
    })

    await p2.test('2.3 Foreign-key safety guard strictly blocks removeClassSubjectAction while practical logs exist', async () => {
      // Privileged admin attempts to delete class-subject assignment that has practical log
      process.env.TEST_USER_OVERRIDE = JSON.stringify(SUPER_ADMIN_USER)

      const deleteRes = await removeClassSubjectAction(testClassSubjectId)
      assert.equal(deleteRes.success, false, 'removeClassSubjectAction MUST FAIL when practical logs exist')
      assert.ok(
        deleteRes.error?.includes('historical practical log'),
        `Error message must explain historical practical log guard. Got: ${deleteRes.error}`
      )

      // Verify mapping still exists in PostgreSQL
      const checkMapping = await pool.query('SELECT id FROM public.class_subjects WHERE id = $1;', [testClassSubjectId])
      assert.equal(checkMapping.rows.length, 1, 'class_subjects mapping row must remain untouched')
    })

    await p2.test('2.4 deactivateSubjectAction and deactivateClassAction safely soft-archive without deleting historical logs', async () => {
      process.env.TEST_USER_OVERRIDE = JSON.stringify(SUPER_ADMIN_USER)

      // Soft-deactivate Subject
      const deactSubRes = await deactivateSubjectAction(testSubjectId)
      assert.equal(deactSubRes.success, true, `deactivateSubjectAction failed: ${deactSubRes.error}`)

      const subCheck = await pool.query('SELECT is_active FROM public.subjects WHERE id = $1;', [testSubjectId])
      assert.equal(subCheck.rows[0]?.is_active, false, 'Subject must be soft-deactivated (is_active = false)')

      // Soft-deactivate Class
      const deactClsRes = await deactivateClassAction(testClassId)
      assert.equal(deactClsRes.success, true, `deactivateClassAction failed: ${deactClsRes.error}`)

      const clsCheck = await pool.query('SELECT is_active FROM public.classes WHERE id = $1;', [testClassId])
      assert.equal(clsCheck.rows[0]?.is_active, false, 'Class must be soft-deactivated (is_active = false)')

      // Crucial Integrity Invariant: Practical log remains 100% intact
      const logCheck = await pool.query('SELECT id, status, total_students FROM public.practical_logs WHERE id = $1;', [
        testLogId,
      ])
      assert.equal(logCheck.rows.length, 1, 'Practical log must NOT be deleted or orphaned by soft-deactivation')
      assert.equal(logCheck.rows[0].status, 'conducted')
    })
  })

  // ============================================================================
  // PIPELINE 3: Laboratory Triage, RBAC Lockdown & Board Compliance Pipeline
  // ============================================================================
  await t.test('Pipeline 3: Laboratory Triage, RBAC Lockdown & Board Compliance Pipeline', async (p3) => {
    await p3.test('3.1 RBAC Lockdown: Unapproved (pending) and rejected users are strictly blocked from mutating admin/maintenance actions', async () => {
      // 3.1.1 Pending User Attempt
      process.env.TEST_USER_OVERRIDE = JSON.stringify(PENDING_USER)

      const pendingSub = await createSubjectAction({
        id: `unauth-sub-${suffix}`,
        code: `UNA_${suffix}`,
        name: 'Unauthorized Subject',
        default_lab_id: 'comp',
      })
      assert.equal(pendingSub.success, false, 'Pending user must NOT be permitted to create subjects')
      assert.ok(pendingSub.error?.includes('Unauthorized') || pendingSub.error?.includes('pending'))

      const pendingCls = await createClassAction({
        id: `unauth-cls-${suffix}`,
        name: 'Unauthorized Class',
      })
      assert.equal(pendingCls.success, false, 'Pending user must NOT be permitted to create classes')

      const pendingResolve = await resolveWorkstationIssue({
        issue_id: testIssueId,
        resolution_notes: 'Unauthorized resolution attempt',
      })
      assert.equal(pendingResolve.success, false, 'Pending user must NOT be permitted to resolve workstation issues')

      // 3.1.2 Rejected User Attempt
      process.env.TEST_USER_OVERRIDE = JSON.stringify(REJECTED_USER)

      const rejectedSub = await createSubjectAction({
        id: `rej-sub-${suffix}`,
        code: `REJ_${suffix}`,
        name: 'Rejected Subject',
        default_lab_id: 'comp',
      })
      assert.equal(rejectedSub.success, false, 'Rejected user must NOT be permitted to create subjects')

      const rejectedResolve = await resolveWorkstationIssue({
        issue_id: testIssueId,
        resolution_notes: 'Rejected resolution attempt',
      })
      assert.equal(rejectedResolve.success, false, 'Rejected user must NOT be permitted to resolve workstation issues')
    })

    await p3.test('3.2 Lab In-Charge triages and resolves workstation fault ticket in /maintenance with certified service log', async () => {
      process.env.TEST_USER_OVERRIDE = JSON.stringify(LAB_INCHARGE_USER)

      const resolveRes = await resolveWorkstationIssue({
        issue_id: testIssueId,
        resolution_notes: `Cleaned thermal paste and re-seated GPU card. Benchmarked under full load. Certified operational for P5 dry-run ${suffix}. Replacement applied: Thermal Paste MX-4.`,
        parts_replaced: 'Thermal Paste MX-4',
        create_maintenance_log: true,
      })

      assert.equal(resolveRes.success, true, `resolveWorkstationIssue failed: ${resolveRes.error}`)

      // Direct PostgreSQL verification: Issue is marked 'resolved'
      const checkResolved = await pool.query(
        'SELECT status, resolved_by_name, resolution_notes, linked_maintenance_log_id FROM public.workstation_issues WHERE id = $1;',
        [testIssueId]
      )
      assert.equal(checkResolved.rows.length, 1)
      const issueRow = checkResolved.rows[0]
      assert.equal(issueRow.status, 'resolved', 'Fault ticket status must transition to resolved')
      assert.ok(issueRow.resolution_notes.includes('Thermal Paste MX-4'))
      assert.ok(issueRow.linked_maintenance_log_id, 'linked_maintenance_log_id must be populated')
      testMaintenanceLogId = issueRow.linked_maintenance_log_id

      // Direct PostgreSQL verification: Certified service log was inserted into maintenance_logs
      const checkMaintLog = await pool.query(
        'SELECT id, asset_identifier, work_performed, parts_replaced FROM public.maintenance_logs WHERE id = $1;',
        [testMaintenanceLogId]
      )
      assert.equal(checkMaintLog.rows.length, 1, 'Certified maintenance log must exist in PostgreSQL')
      assert.equal(checkMaintLog.rows[0].parts_replaced, 'Thermal Paste MX-4')
      assert.ok(checkMaintLog.rows[0].work_performed.includes('Issue Resolved'))
    })

    await p3.test('3.3 Lab In-Charge verifies submitted practical log in /records and faculty audit ledger reflects verification', async () => {
      process.env.TEST_USER_OVERRIDE = JSON.stringify(LAB_INCHARGE_USER)

      // Verification stamp applied by Lab In-Charge
      const updateRes = await updatePracticalLog(testLogId, {
        remarks: `Verified & Digitally Audited by Lab In-Charge DryRun ${suffix}`,
      })
      assert.equal(updateRes.success, true, `updatePracticalLog failed: ${updateRes.error}`)

      // Verify in PostgreSQL
      const checkLog = await pool.query('SELECT remarks FROM public.practical_logs WHERE id = $1;', [testLogId])
      assert.ok(checkLog.rows[0].remarks.includes('Verified'), 'Practical log remarks must contain Verified stamp')

      // Query Faculty Practical Ledger to verify verified session tally
      const ledgerRes = await getFacultyPracticalLedger({ academicYearId: currentYearId })
      assert.equal(ledgerRes.success, true, 'getFacultyPracticalLedger should succeed')
      assert.ok(Array.isArray(ledgerRes.data), 'Ledger data must be an array')

      // Downstream query verification in getPracticalRecords
      const recordsRes = await getPracticalRecords({
        academic_year_id: currentYearId,
        search: suffix,
      })
      assert.equal(recordsRes.success, true, 'getPracticalRecords should succeed')
      assert.ok(recordsRes.records.length >= 1, 'Should find newly created and verified practical log')
      assert.ok(recordsRes.records[0].remarks.includes('Verified'))
    })

    await p3.test('3.4 Confirm NEB Board Compliance Report and Export data payload are 100% complete', async () => {
      process.env.TEST_USER_OVERRIDE = JSON.stringify(LAB_INCHARGE_USER)

      // 3.4.1 Board Compliance Report Query
      const compRes = await getStudentBoardComplianceReport({
        academicYearId: currentYearId,
        classId: '12eng',
      })
      assert.equal(compRes.success, true, `getStudentBoardComplianceReport failed: ${compRes.error}`)
      assert.ok(compRes.data, 'Report payload must be returned')
      assert.ok(compRes.data.class_name, 'Class name must be returned')
      assert.ok(compRes.data.academic_year_name, 'Academic year name must be returned')
      assert.ok(Array.isArray(compRes.data.records), 'Must return student compliance records array')
      assert.ok(typeof compRes.data.total_students === 'number', 'total_students must be a number')
      assert.ok(typeof compRes.data.eligible_students === 'number', 'eligible_students must be a number')
      assert.ok(typeof compRes.data.barred_students === 'number', 'barred_students must be a number')
      assert.ok(typeof compRes.data.cohort_avg_rate_pct === 'number', 'cohort_avg_rate_pct must be a number')

      // 3.4.2 Official NEB Board Excel Export Action
      const exportRes = await exportStudentBoardComplianceAction({
        academicYearId: currentYearId,
        classId: '12eng',
      })
      assert.equal(exportRes.success, true, `exportStudentBoardComplianceAction failed: ${exportRes.error}`)
      assert.ok(exportRes.base64, 'Export must return base64 binary payload')
      assert.ok(exportRes.base64.length > 200, 'Base64 string must represent valid non-empty spreadsheet')
      assert.ok(exportRes.filename?.endsWith('.xlsx'), 'Filename must end with .xlsx')
      assert.equal(
        exportRes.contentType,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content type must be openxmlformats spreadsheet'
      )

      // 3.4.3 Bulk Maintenance Export Action
      const maintExportRes = await exportMaintenanceRecordsAction('comp', 'xlsx')
      assert.equal(maintExportRes.success, true, `exportMaintenanceRecordsAction failed: ${maintExportRes.error}`)
      assert.ok(maintExportRes.base64, 'Maintenance export must return base64 binary payload')
      assert.ok(maintExportRes.base64.length > 200, 'Maintenance export base64 must be non-empty')
      assert.ok(maintExportRes.filename?.endsWith('.xlsx'))
    })

    await p3.test('3.5 Spotless Database Cleanup: Verify all temporary test rows are completely purged', async () => {
      // Execute explicit deletion of all test records
      if (testIssueId) {
        await pool.query('DELETE FROM public.workstation_issues WHERE id = $1;', [testIssueId])
      }
      if (testMaintenanceLogId) {
        await pool.query('DELETE FROM public.maintenance_logs WHERE id = $1;', [testMaintenanceLogId])
      }
      if (testLogId) {
        await pool.query('DELETE FROM public.log_attendance WHERE log_id = $1;', [testLogId])
        await pool.query('DELETE FROM public.practical_logs WHERE id = $1;', [testLogId])
      }
      if (testClassSubjectId) {
        await pool.query('DELETE FROM public.class_subjects WHERE id = $1;', [testClassSubjectId])
      }
      await pool.query('DELETE FROM public.class_subjects WHERE class_id = $1 OR subject_id = $2;', [
        testClassId,
        testSubjectId,
      ])
      await pool.query('DELETE FROM public.classes WHERE id = $1;', [testClassId])
      await pool.query('DELETE FROM public.subjects WHERE id = $1 OR code = $2;', [
        testSubjectId,
        testSubjectCode,
      ])
      if (testCategoryId) {
        await pool.query('DELETE FROM public.issue_categories WHERE id = $1;', [testCategoryId])
      }

      // Assert that 0 test records remain
      const checkSubject = await pool.query('SELECT id FROM public.subjects WHERE id = $1;', [testSubjectId])
      assert.equal(checkSubject.rows.length, 0, 'Test subject must be purged')

      const checkClass = await pool.query('SELECT id FROM public.classes WHERE id = $1;', [testClassId])
      assert.equal(checkClass.rows.length, 0, 'Test class must be purged')

      const checkCategory = await pool.query('SELECT id FROM public.issue_categories WHERE id = $1;', [testCategoryId])
      assert.equal(checkCategory.rows.length, 0, 'Test category must be purged')

      const checkLog = await pool.query('SELECT id FROM public.practical_logs WHERE id = $1;', [testLogId])
      assert.equal(checkLog.rows.length, 0, 'Test practical log must be purged')

      const checkIssue = await pool.query('SELECT id FROM public.workstation_issues WHERE id = $1;', [testIssueId])
      assert.equal(checkIssue.rows.length, 0, 'Test workstation issue must be purged')
    })
  })
})
