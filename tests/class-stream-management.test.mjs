import test from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

process.env.TEST_USER_OVERRIDE = JSON.stringify({
  id: 'test-admin',
  email: 'admin@rrl.edu.np',
  full_name: 'Super Admin',
  role: 'super_admin',
  approval_status: 'approved',
  is_active: true,
  permissions: { can_access_admin: true, can_manage_users: true },
})

const { Pool } = pg
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

test('Class and Academic Stream Management Invariant Suite', async (t) => {
  const { getClassesAction, updateClassAction, createClassAction } = await import('../app/actions/classes.ts')

  await t.test('1. Reference table public.streams contains canonical streams', async () => {
    const res = await pool.query('SELECT id, name FROM public.streams;')
    const streamIds = res.rows.map((r) => r.id)
    assert.ok(streamIds.includes('Computer Engineering'), 'Must include Computer Engineering stream')
    assert.ok(streamIds.includes('Management'), 'Must include Management stream')
    assert.ok(streamIds.includes('General Science'), 'Must include General Science stream')
    assert.ok(streamIds.includes('Basic Science & Computing'), 'Must include Basic Science & Computing stream')
  })

  await t.test('2. public.classes records have non-null stream_id and clean section', async () => {
    const res = await getClassesAction({ activeOnly: false })
    assert.equal(res.success, true)
    assert.ok(res.data.length >= 9, 'Must have at least 9 institutional classes')

    const c12 = res.data.find((c) => c.id === '12eng')
    assert.ok(c12, 'Class 12 Eng must exist')
    assert.equal(c12.name, '12 Eng')
    assert.equal(c12.section, 'Eng')
    assert.equal(c12.stream_id, 'Computer Engineering')

    const c12mgt = res.data.find((c) => c.id === '12mgt')
    assert.ok(c12mgt, 'Class 12 Mgt must exist')
    assert.equal(c12mgt.name, '12 Mgt')
    assert.equal(c12mgt.section, 'Mgt')
    assert.equal(c12mgt.stream_id, 'Management')

    const c8a = res.data.find((c) => c.id === '8a')
    assert.ok(c8a, 'Class 8A must exist')
    assert.equal(c8a.section, 'A')
    assert.equal(c8a.stream_id, 'General Science')
  })

  await t.test('3. updateClassAction with custom stream dynamically upserts stream and succeeds', async () => {
    const testCustomStream = 'Information Technology & AI'
    const res = await updateClassAction('12eng', {
      name: '12 Eng',
      grade: 12,
      section: 'Eng',
      stream_id: testCustomStream,
      capacity: 38,
    })
    assert.equal(res.success, true, `updateClassAction failed: ${res.error}`)
    assert.equal(res.data?.stream_id, testCustomStream)

    // Revert back to Computer Engineering
    const revertRes = await updateClassAction('12eng', {
      name: '12 Eng',
      grade: 12,
      section: 'Eng',
      stream_id: 'Computer Engineering',
      capacity: 38,
    })
    assert.equal(revertRes.success, true)
    assert.equal(revertRes.data?.stream_id, 'Computer Engineering')
  })

  t.after(async () => {
    await pool.end()
  })
})
