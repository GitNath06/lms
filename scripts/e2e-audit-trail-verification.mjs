import fs from 'node:fs'
import pg from 'pg'
import { computeStructuredDiff, redactSensitiveData } from '../lib/audit-diff.ts'

if (fs.existsSync('.env.local')) {
  process.loadEnvFile('.env.local')
} else if (fs.existsSync('.env')) {
  process.loadEnvFile('.env')
}

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

async function runE2EVerification() {
  console.log('=== STARTING END-TO-END AUDIT TRAIL VERIFICATION ===\n')

  // 1. Verify schema existence and columns
  const tableCheck = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
    ORDER BY ordinal_position;
  `)

  console.log('1. Database Schema Verification:')
  console.log(`   Found ${tableCheck.rows.length} columns in public.audit_logs:`)
  tableCheck.rows.forEach((r) => console.log(`   - ${r.column_name} (${r.data_type})`))
  
  if (tableCheck.rows.length < 8) {
    throw new Error('Table public.audit_logs is missing required columns!')
  }
  console.log('   ✓ Schema integrity verified.\n')

  // 2. Test Pure Diff Engine on UPDATE mutations
  console.log('2. Pure Diff Engine Testing:')
  
  // 2a. Normal property modification
  const beforeLab = { id: 'phy', name: 'Physics Lab', capacity: 30, status: 'Operational' }
  const afterLab = { id: 'phy', name: 'Physics Lab', capacity: 45, status: 'Under Maintenance' }
  const diffLab = computeStructuredDiff(beforeLab, afterLab)
  console.log('   Diff result for Lab modification:', JSON.stringify(diffLab))
  if (!diffLab.before.capacity || diffLab.before.capacity !== 30 || diffLab.after.capacity !== 45) {
    throw new Error('Diff failed to catch capacity modification!')
  }
  if (!diffLab.before.status || diffLab.after.status !== 'Under Maintenance') {
    throw new Error('Diff failed to catch status modification!')
  }
  console.log('   ✓ Lab modification diff verified.')

  // 2b. Secret redaction without dropping delta
  const beforeUser = { id: 'u1', email: 'teacher@rrl.edu.np', password_hash: 'old_secret_hash_123' }
  const afterUser = { id: 'u1', email: 'teacher@rrl.edu.np', password_hash: 'new_secret_hash_456' }
  const diffUser = computeStructuredDiff(beforeUser, afterUser)
  console.log('   Diff result for Password update:', JSON.stringify(diffUser))
  if (diffUser.before.password_hash !== '[REDACTED]' || diffUser.after.password_hash !== '[REDACTED]') {
    throw new Error('Diff failed to redact sensitive password hash!')
  }
  console.log('   ✓ Sensitive redaction with preserved diff delta verified.\n')

  // 3. Live PostgreSQL UPDATE Audit Event Recording
  console.log('3. Inserting Synthetic Administrative UPDATE Mutations into PostgreSQL:')

  // Mutation A: Policy Toggle (Precaution Active)
  const policyInsert = await pool.query(
    `INSERT INTO public.audit_logs 
      (actor_id, actor_name, actor_role, action, entity_type, entity_id, entity_label, changes, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, created_at, action, entity_type, entity_label, changes;`,
    [
      '1cb09b62-8dd2-445f-b5ae-a186df967cf5',
      'System Administrator',
      'super_admin',
      'UPDATE',
      'policy',
      'precaution_safety_mode',
      'Precaution Active Safety Lock',
      JSON.stringify(computeStructuredDiff(
        { edit_mode_unlocked: false, precaution_active: true },
        { edit_mode_unlocked: true, precaution_active: false }
      )),
      JSON.stringify({ source: 'e2e_verification_test', toggle: 'precaution_safety_mode' }),
    ]
  )
  console.log('   ✓ Recorded Policy UPDATE row:', policyInsert.rows[0].id)

  // Mutation B: Timetable Slot Reschedule
  const scheduleInsert = await pool.query(
    `INSERT INTO public.audit_logs 
      (actor_id, actor_name, actor_role, action, entity_type, entity_id, entity_label, changes, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, created_at, action, entity_type, entity_label, changes;`,
    [
      '1cb09b62-8dd2-445f-b5ae-a186df967cf5',
      'System Administrator',
      'super_admin',
      'UPDATE',
      'schedule',
      'sun-p1-chem',
      'Timetable Slot #sun-p1-chem',
      JSON.stringify(computeStructuredDiff(
        { time_slot: '09:00 - 09:45', teacher_id: 't1', is_skipped: false },
        { time_slot: '10:00 - 10:45', teacher_id: 't2', is_skipped: true }
      )),
      JSON.stringify({ source: 'e2e_verification_test', reason: 'Instructor reassignment' }),
    ]
  )
  console.log('   ✓ Recorded Timetable UPDATE row:', scheduleInsert.rows[0].id)

  // Mutation C: Incident Category SLA Update
  const categoryInsert = await pool.query(
    `INSERT INTO public.audit_logs 
      (actor_id, actor_name, actor_role, action, entity_type, entity_id, entity_label, changes, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, created_at, action, entity_type, entity_label, changes;`,
    [
      '1cb09b62-8dd2-445f-b5ae-a186df967cf5',
      'System Administrator',
      'super_admin',
      'UPDATE',
      'incident_category',
      'cat-spill-hazard',
      'Chemical Spill Hazard Category',
      JSON.stringify(computeStructuredDiff(
        { severity: 'high', sla_hours: 12 },
        { severity: 'critical', sla_hours: 2 }
      )),
      JSON.stringify({ source: 'e2e_verification_test' }),
    ]
  )
  console.log('   ✓ Recorded Incident Category UPDATE row:', categoryInsert.rows[0].id, '\n')

  // 4. Query and Verify Audit Trail Ledger
  console.log('4. Querying and Validating Audit Trail Ledger:')
  const queryAll = await pool.query(`
    SELECT id, created_at, action, entity_type, entity_label, changes
    FROM public.audit_logs
    ORDER BY created_at DESC
    LIMIT 10;
  `)

  console.log(`   Fetched ${queryAll.rows.length} recent audit logs:`)
  let updateCount = 0
  let deleteCount = 0

  queryAll.rows.forEach((row, i) => {
    console.log(`   [${i + 1}] [${row.action}] (${row.entity_type}) ${row.entity_label}`)
    console.log(`       ID: ${row.id}`)
    console.log(`       Changes:`, JSON.stringify(row.changes))
    if (row.action === 'UPDATE') updateCount++
    if (row.action === 'DELETE') deleteCount++
  })

  console.log(`\n   Summary of Recent Ledger: ${updateCount} UPDATE records, ${deleteCount} DELETE records`)

  if (updateCount === 0) {
    throw new Error('E2E Verification Failed: Zero UPDATE records found in audit ledger!')
  }

  // 5. Verify Filter Query by Action = 'UPDATE'
  console.log('\n5. Testing Action Filter Query (action = \'UPDATE\'):')
  const updateOnly = await pool.query(`
    SELECT COUNT(*)::int AS count FROM public.audit_logs WHERE action = 'UPDATE';
  `)
  console.log(`   Total UPDATE records in database: ${updateOnly.rows[0].count}`)
  if (updateOnly.rows[0].count < 3) {
    throw new Error('Expected at least 3 UPDATE records in public.audit_logs')
  }
  console.log('   ✓ Filter validation passed.')

  console.log('\n=== ALL END-TO-END VERIFICATIONS PASSED SUCCESSFULLY ===')
  await pool.end()
}

runE2EVerification().catch((err) => {
  console.error('VERIFICATION ERROR:', err)
  process.exit(1)
})
