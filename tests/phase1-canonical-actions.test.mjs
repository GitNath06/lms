import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

// Load .env.local into process.env so DB connection resolves
try {
  const envContent = fs.readFileSync('.env.local', 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=')
      const key = trimmed.slice(0, idx).trim()
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
      if (!process.env[key]) {
        process.env[key] = val
      }
    }
  }
} catch (e) {}

test('Phase 1: Canonical Database Actions & Relational Mapping', async (t) => {
  const { getSubjectsAction, getClassSubjectsAction } = await import('../app/actions/subjects.ts')
  const { getClassesAction, getClassEnrollmentStats } = await import('../app/actions/classes.ts')
  const { getTeachers } = await import('../app/actions/logs.ts')
  const { getPeriodSlotsAction } = await import('../app/actions/settings.ts')
  const { getActiveAcademicYearAction } = await import('../app/actions/academic-years.ts')

  await t.test('1. getSubjectsAction returns active subjects from PostgreSQL', async () => {
    const res = await getSubjectsAction({ activeOnly: true })
    assert.equal(res.success, true, 'getSubjectsAction should succeed')
    assert.ok(Array.isArray(res.data), 'res.data should be an array')
    assert.ok(res.data.length >= 20, `Expected at least 20 subjects, got ${res.data.length}`)
    
    // Verify subject structure
    const first = res.data[0]
    assert.ok(first.code, 'Subject should have code')
    assert.ok(first.name, 'Subject should have name')
    assert.equal(first.is_active, true, 'Subject should be active')
  })

  await t.test('2. getClassSubjectsAction returns relational mapping rows', async () => {
    const res = await getClassSubjectsAction()
    assert.equal(res.success, true, 'getClassSubjectsAction should succeed')
    assert.ok(Array.isArray(res.data), 'res.data should be an array')
    assert.ok(res.data.length >= 10, `Expected at least 10 class_subject mappings, got ${res.data.length}`)

    // Verify mapping has joined subject and class
    const sample = res.data[0]
    assert.ok(sample.class_id, 'Mapping should have class_id')
    assert.ok(sample.subject_id, 'Mapping should have subject_id')
  })

  await t.test('3. getClassesAction returns active class batches', async () => {
    const res = await getClassesAction({ activeOnly: true })
    assert.equal(res.success, true, 'getClassesAction should succeed')
    assert.ok(Array.isArray(res.data), 'res.data should be an array')
    assert.ok(res.data.length >= 5, `Expected at least 5 classes, got ${res.data.length}`)
  })

  await t.test('4. getTeachers() strictly filters for approved and active faculty', async () => {
    const teachers = await getTeachers()
    assert.ok(Array.isArray(teachers), 'Teachers should be an array')
    assert.ok(teachers.length > 0, 'Should return approved teachers')

    // Verify no dummy teacher codes like COMP12-Teacher leak in
    const hasDummy = teachers.some((t) => t.full_name.includes('COMP12-Teacher') || t.full_name.includes('CN12-Teacher'))
    assert.equal(hasDummy, false, 'getTeachers() must not contain dummy routine placeholders')

    // Verify Dinanath Shah is not duplicated
    const dinanathEntries = teachers.filter((t) => t.full_name.toLowerCase().includes('dinanath'))
    assert.ok(dinanathEntries.length <= 1, `Dinanath Shah should not be duplicated, found: ${dinanathEntries.length}`)
  })

  await t.test('5. getPeriodSlotsAction returns period schedule', async () => {
    const res = await getPeriodSlotsAction()
    assert.equal(res.success, true, 'getPeriodSlotsAction should succeed')
    assert.ok(Array.isArray(res.data), 'res.data should be an array')
  })

  await t.test('6. getActiveAcademicYearAction returns current academic year', async () => {
    const res = await getActiveAcademicYearAction()
    assert.equal(res.success, true, 'getActiveAcademicYearAction should succeed')
    if (res.data) {
      assert.equal(res.data.is_current, true, 'Returned year must be current')
      assert.ok(res.data.name, 'Academic year should have name')
    }
  })

  await t.test('7. resolveUserScope security matrix blocks unapproved/deactivated accounts', async () => {
    const { resolveUserScope } = await import('../lib/context/user-scope.ts')
    
    // Unauthenticated guest
    const guest = resolveUserScope(null)
    assert.equal(guest.isPrivileged, false)
    assert.notEqual(guest.approvalStatus, 'approved')

    // Rejected admin
    const rejectedAdmin = resolveUserScope({ id: 'u1', role: 'super_admin', approval_status: 'rejected', is_active: true })
    assert.equal(rejectedAdmin.isPrivileged, false)
    assert.notEqual(rejectedAdmin.approvalStatus, 'approved')

    // Deactivated admin
    const deactivatedAdmin = resolveUserScope({ id: 'u2', role: 'super_admin', approval_status: 'approved', is_active: false })
    assert.equal(deactivatedAdmin.isPrivileged, false)
    assert.notEqual(deactivatedAdmin.approvalStatus, 'approved')

    // Pending admin
    const pendingAdmin = resolveUserScope({ id: 'u3', role: 'super_admin', approval_status: 'pending', is_active: true })
    assert.equal(pendingAdmin.isPrivileged, false)
    assert.notEqual(pendingAdmin.approvalStatus, 'approved')

    // Approved & active admin
    const approvedAdmin = resolveUserScope({ id: 'u4', role: 'super_admin', approval_status: 'approved', is_active: true })
    assert.equal(approvedAdmin.isPrivileged, true)
    assert.equal(approvedAdmin.approvalStatus, 'approved')
  })

  // Clean exit after completion
  setTimeout(() => process.exit(0), 100)
})

