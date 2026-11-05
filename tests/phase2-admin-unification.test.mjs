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

// Set up Super Admin test override for RBAC protected server actions
process.env.LABSYNC_TEST_RUNNER = 'true'
process.env.TEST_USER_OVERRIDE = JSON.stringify({
  id: '00000000-0000-0000-0000-000000000001',
  email: 'admin@labsync.edu.np',
  full_name: 'Super Admin Test',
  role: 'super_admin',
  approval_status: 'approved',
  is_active: true,
  permissions: {
    canManageUsers: true,
    canConfigureSystem: true,
    canSignOffLogs: true,
    canManageCurriculum: true,
  },
})

test('Phase 2: Admin Console Unification & Canonical PostgreSQL Operations', async (t) => {
  const { getClassesAction, createClassAction, updateClassAction, deactivateClassAction } = await import('../app/actions/classes.ts')
  const {
    getSubjectsAction,
    getClassSubjectsAction,
    createSubjectAction,
    updateSubjectAction,
    assignSubjectToClassAction,
    removeClassSubjectAction,
  } = await import('../app/actions/subjects.ts')
  const { getIssueCategories, manageIssueCategory } = await import('../app/actions/workstations.ts')
  const { getPgPool } = await import('../lib/db.ts')

  const pool = getPgPool()
  const testSuffix = Date.now().toString().slice(-6)
  const testClassId = `test-cls-${testSuffix}`
  const testSubjectCode = `TP2_${testSuffix}`
  const testSubjectId = `test-sub-${testSuffix}`
  let testClassSubjectId = null
  let testCategoryId = null

  t.after(async () => {
    // Clean up test rows directly
    try {
      if (testClassSubjectId) {
        await pool.query('DELETE FROM public.practical_logs WHERE class_subject_id = $1;', [testClassSubjectId])
        await pool.query('DELETE FROM public.class_subjects WHERE id = $1;', [testClassSubjectId])
      }
      await pool.query('DELETE FROM public.class_subjects WHERE class_id = $1;', [testClassId])
      await pool.query('DELETE FROM public.classes WHERE id = $1;', [testClassId])
      await pool.query('DELETE FROM public.subjects WHERE id = $1 OR code = $2;', [testSubjectId, testSubjectCode])
      if (testCategoryId) {
        await pool.query('DELETE FROM public.issue_categories WHERE id = $1;', [testCategoryId])
      }
    } catch (cleanupErr) {
      console.warn('Test cleanup notice:', cleanupErr.message)
    }
  })

  await t.test('1. getClassesAction retrieves active classes from PostgreSQL', async () => {
    const res = await getClassesAction({ activeOnly: true })
    assert.equal(res.success, true, 'getClassesAction should succeed')
    assert.ok(Array.isArray(res.data), 'res.data should be an array')
    assert.ok(res.data.length >= 1, 'Should return at least one class')
    assert.ok(res.data.every((c) => c.is_active === true), 'All returned classes should be active')
  })

  await t.test('2. createClassAction creates a canonical class record with RBAC protection', async () => {
    const res = await createClassAction({
      id: testClassId,
      name: `Class 11 Test ${testSuffix}`,
      grade: 11,
      section: 'Alpha',
      stream_id: null,
      capacity: 36,
      is_active: true,
    })

    assert.equal(res.success, true, `createClassAction failed: ${res.error}`)
    assert.ok(res.data, 'Should return created class record')
    assert.equal(res.data.id, testClassId)
    assert.equal(res.data.name, `Class 11 Test ${testSuffix}`)
    assert.equal(res.data.capacity, 36)
  })

  await t.test('3. updateClassAction updates class capacity, section and attributes', async () => {
    const res = await updateClassAction(testClassId, {
      capacity: 42,
      section: 'Beta',
    })

    assert.equal(res.success, true, `updateClassAction failed: ${res.error}`)
    assert.ok(res.data, 'Should return updated class record')
    assert.equal(res.data.capacity, 42)
    assert.equal(res.data.section, 'Beta')
  })

  await t.test('4. deactivateClassAction soft-archives the class record', async () => {
    const res = await deactivateClassAction(testClassId)
    assert.equal(res.success, true, `deactivateClassAction failed: ${res.error}`)

    // Verify in database that is_active is false
    const check = await pool.query('SELECT is_active FROM public.classes WHERE id = $1;', [testClassId])
    assert.equal(check.rows[0]?.is_active, false, 'Class should be soft-deactivated')

    // Re-activate for downstream mapping test
    await pool.query('UPDATE public.classes SET is_active = true WHERE id = $1;', [testClassId])
  })

  await t.test('5. getSubjectsAction retrieves active subjects catalog from PostgreSQL', async () => {
    const res = await getSubjectsAction({ activeOnly: true })
    assert.equal(res.success, true, 'getSubjectsAction should succeed')
    assert.ok(Array.isArray(res.data), 'res.data should be an array')
    assert.ok(res.data.length >= 10, `Expected at least 10 subjects, got ${res.data.length}`)
  })

  await t.test('6. createSubjectAction creates a canonical subject in the catalog', async () => {
    const res = await createSubjectAction({
      id: testSubjectId,
      code: testSubjectCode,
      name: `Automated Test Subject ${testSuffix}`,
      default_lab_id: 'comp',
      credit_hours: 4,
      is_active: true,
    })

    assert.equal(res.success, true, `createSubjectAction failed: ${res.error}`)
    assert.ok(res.data, 'Should return created subject record')
    assert.equal(res.data.code, testSubjectCode)
    assert.equal(res.data.default_lab_id, 'comp')
  })

  await t.test('7. assignSubjectToClassAction creates relational junction mapping in public.class_subjects', async () => {
    const res = await assignSubjectToClassAction({
      class_id: testClassId,
      subject_id: testSubjectId,
      default_lab_id: 'comp',
    })

    assert.equal(res.success, true, `assignSubjectToClassAction failed: ${res.error}`)

    // Query mapping row
    const mapping = await pool.query(
      'SELECT id, class_id, subject_id, default_lab_id FROM public.class_subjects WHERE class_id = $1 AND subject_id = $2;',
      [testClassId, testSubjectId]
    )
    assert.equal(mapping.rows.length, 1, 'Junction mapping row must exist')
    testClassSubjectId = mapping.rows[0].id
    assert.equal(mapping.rows[0].default_lab_id, 'comp')
  })

  await t.test('8. getClassSubjectsAction retrieves enriched relational mapping rows', async () => {
    const res = await getClassSubjectsAction(testClassId)
    assert.equal(res.success, true, 'getClassSubjectsAction should succeed')
    assert.ok(Array.isArray(res.data), 'res.data should be an array')
    const match = res.data.find((m) => m.subject_id === testSubjectId)
    assert.ok(match, 'Enriched mapping should include the test subject')
    assert.equal(match.subject_code, testSubjectCode)
  })

  await t.test('9. removeClassSubjectAction foreign key safety check blocks deletion when practical logs exist', async () => {
    assert.ok(testClassSubjectId, 'testClassSubjectId must be populated')

    // Insert a dummy practical log referencing this class_subject_id
    const logInsert = await pool.query(
      `INSERT INTO public.practical_logs (
        id, lab_id, class_subject_id, period_label, subject_name, batch_group, practical_title,
        total_students, present_students, absent_students, status, created_at
      ) VALUES (
        gen_random_uuid(), 'comp', $1, 'P1-2', 'Safety Test Subject', 'Batch A', 'Phase 2 Safety Test Log',
        30, 28, 2, 'completed', now()
      ) RETURNING id;`,
      [testClassSubjectId]
    )
    const dummyLogId = logInsert.rows[0]?.id

    try {
      // Attempt to delete mapping should fail due to foreign key protection
      const deleteRes = await removeClassSubjectAction(testClassSubjectId)
      assert.equal(deleteRes.success, false, 'Should reject deletion when practical logs reference assignment')
      assert.ok(deleteRes.error?.includes('historical practical log'), `Unexpected error msg: ${deleteRes.error}`)
    } finally {
      // Clean up dummy practical log
      await pool.query('DELETE FROM public.practical_logs WHERE id = $1;', [dummyLogId])
    }
  })

  await t.test('10. removeClassSubjectAction safely deletes assignment when 0 logs exist', async () => {
    const deleteRes = await removeClassSubjectAction(testClassSubjectId)
    assert.equal(deleteRes.success, true, `removeClassSubjectAction failed: ${deleteRes.error}`)

    const check = await pool.query('SELECT id FROM public.class_subjects WHERE id = $1;', [testClassSubjectId])
    assert.equal(check.rows.length, 0, 'Mapping should be completely deleted from public.class_subjects')
    testClassSubjectId = null

    // Clean up created test class so subsequent test suites operate on clean canonical counts
    if (testClassId) {
      await pool.query('DELETE FROM public.classes WHERE id = $1;', [testClassId])
    }
  })

  await t.test('11. getIssueCategories returns canonical categories from public.issue_categories', async () => {
    const res = await getIssueCategories()
    assert.equal(res.success, true, 'getIssueCategories should succeed')
    assert.ok(Array.isArray(res.data), 'res.data should be an array')
    assert.ok(res.data.length >= 10, `Expected at least 10 issue categories, got ${res.data.length}`)

    // Verify laboratory equipment / safety categories are present
    const hardwareCats = res.data.filter((c) => c.type === 'hardware' || c.type === 'other')
    assert.ok(hardwareCats.length >= 5, 'Should have hardware and safety incident categories')
  })

  await t.test('12. manageIssueCategory manages dynamic categories (create, update, soft-archive/delete)', async () => {
    const catName = `P2 Test Category ${testSuffix}`
    const createRes = await manageIssueCategory('create', {
      name: catName,
      type: 'hardware',
      color: '#6366F1',
      icon: 'Cpu',
      default_severity: 'medium',
      is_active: true,
      sort_order: 99,
    })

    assert.equal(createRes.success, true, `create category failed: ${createRes.error}`)
    assert.ok(createRes.data?.id, 'Category should have an ID')
    testCategoryId = createRes.data.id

    // Update
    const updateRes = await manageIssueCategory('update', {
      id: testCategoryId,
      name: `${catName} Updated`,
      default_severity: 'high',
    })
    assert.equal(updateRes.success, true, `update category failed: ${updateRes.error}`)
    assert.equal(updateRes.data?.name, `${catName} Updated`)
    assert.equal(updateRes.data?.default_severity, 'high')

    // Delete (hard delete since 0 issues reference it)
    const deleteRes = await manageIssueCategory('delete', {
      id: testCategoryId,
    })
    assert.equal(deleteRes.success, true, `delete category failed: ${deleteRes.error}`)

    const check = await pool.query('SELECT id FROM public.issue_categories WHERE id = $1;', [testCategoryId])
    assert.equal(check.rows.length, 0, 'Unreferenced category should be deleted')
    testCategoryId = null
  })
})
