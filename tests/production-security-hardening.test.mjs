import test from 'node:test'
import assert from 'node:assert/strict'
import { getPgPool } from '../lib/db.ts'

test('Production Security Hardening: Database Triggers, Foreign Keys & Constraints', async (t) => {
  const pool = getPgPool()

  await t.test('1. student_enrollments_roll_number_check allows up to roll 250', async () => {
    const res = await pool.query(`
      SELECT pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'student_enrollments' AND c.conname = 'student_enrollments_roll_number_check';
    `)
    assert.equal(res.rows.length, 1, 'student_enrollments_roll_number_check must exist')
    assert.match(res.rows[0].def, /250/, 'Constraint must allow up to 250')
  })

  await t.test('2. Lab foreign keys are ON DELETE RESTRICT', async () => {
    const res = await pool.query(`
      SELECT tc.table_name, rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
      WHERE tc.constraint_name IN (
        'practical_logs_lab_id_fkey',
        'lab_incidents_lab_id_fkey',
        'workstations_lab_id_fkey'
      );
    `)
    assert.equal(res.rows.length, 3, 'All 3 foreign keys must exist')
    for (const row of res.rows) {
      assert.equal(row.delete_rule, 'RESTRICT', `${row.table_name} FK must be RESTRICT, got ${row.delete_rule}`)
    }
  })

  await t.test('3. handle_new_user() hardcodes role=teacher and approval_status=pending', async () => {
    const res = await pool.query(`
      SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user';
    `)
    assert.equal(res.rows.length, 1, 'handle_new_user must exist')
    const src = res.rows[0].prosrc
    assert.match(src, /'teacher'/, 'Must hardcode teacher')
    assert.match(src, /'pending'/, 'Must hardcode pending')
    assert.doesNotMatch(src, /raw_user_meta_data->>'role'/, 'Must not read role from metadata')
    assert.doesNotMatch(src, /raw_user_meta_data->>'approval_status'/, 'Must not read approval_status from metadata')
  })

  await t.test('4. protect_profile_escalation() checks role, approval_status, permissions, and is_active', async () => {
    const res = await pool.query(`
      SELECT prosrc FROM pg_proc WHERE proname = 'protect_profile_escalation';
    `)
    assert.equal(res.rows.length, 1, 'protect_profile_escalation must exist')
    const src = res.rows[0].prosrc
    assert.match(src, /OLD\.role IS DISTINCT FROM NEW\.role/, 'Must check role')
    assert.match(src, /OLD\.approval_status IS DISTINCT FROM NEW\.approval_status/, 'Must check approval_status')
    assert.match(src, /OLD\.permissions IS DISTINCT FROM NEW\.permissions/, 'Must check permissions')
    assert.match(src, /OLD\.is_active IS DISTINCT FROM NEW\.is_active/, 'Must check is_active')
  })

  await t.test('5. sync_practical_log_attendance() guards updates and uses set-based upsert', async () => {
    const res = await pool.query(`
      SELECT prosrc FROM pg_proc WHERE proname = 'sync_practical_log_attendance';
    `)
    assert.equal(res.rows.length, 1, 'sync_practical_log_attendance must exist')
    const src = res.rows[0].prosrc
    assert.match(src, /OLD\.absent_rolls IS NOT DISTINCT FROM NEW\.absent_rolls/i, 'Must check absent_rolls on update')
    assert.match(src, /OLD\.total_students IS NOT DISTINCT FROM NEW\.total_students/i, 'Must check total_students on update')
    assert.match(src, /generate_series/i, 'Must use set-based generate_series')
    assert.match(src, /ON CONFLICT/i, 'Must use ON CONFLICT')
  })

  await t.test('6. RLS policies on students and student_enrollments require approved active profile', async () => {
    const res = await pool.query(`
      SELECT tablename, policyname, qual
      FROM pg_policies
      WHERE tablename IN ('students', 'student_enrollments')
        AND cmd = 'SELECT';
    `)
    assert.ok(res.rows.length >= 2, 'Must have SELECT policies on students and student_enrollments')
    for (const row of res.rows) {
      assert.match(row.qual, /approval_status\s*=\s*'approved'/i, `${row.tablename} policy must require approved status`)
      assert.match(row.qual, /is_active\s*=\s*true/i, `${row.tablename} policy must require is_active`)
    }
  })

  await pool.end()
})
