import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// Load .env.local into process.env if needed
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=')
      const key = trimmed.slice(0, idx).trim()
      const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
      if (!process.env[key]) {
        process.env[key] = val
      }
    }
  }
}

import { getPgPool } from '../lib/db.ts'
import {
  checkSchedulingConflicts,
  getSlotRange,
  slotRangesOverlap,
  timeRangesOverlap,
} from '../lib/scheduling/conflict-engine.ts'
import {
  recordAuditEvent,
  recordAttendanceOverrideAudit,
  recordSeatSwapAudit,
  recordWorkstationIssueStatusAudit,
  recordScheduleModificationAudit,
  queryAuditLedger,
  getAuditHistoryForEntity,
} from '../lib/audit/audit-ledger.ts'

test('Phase 6: Sprint 3 — Triple-Collision Defense Engine & Immutable Audit Ledger Suite', async (t) => {
  const pool = getPgPool()

  // Setup test schedule for collision verification
  const testSchedId = `test-sched-c3-${Date.now()}`
  let testTeacherId = ''
  let testTeacherName = 'Prof. Test Instructor'

  await t.before(async () => {
    // Resolve a valid teacher profile
    const teacherRes = await pool.query(
      `SELECT id, full_name FROM public.profiles WHERE role IN ('teacher', 'lab_incharge', 'hod') LIMIT 1`
    )
    if (teacherRes.rows.length > 0) {
      testTeacherId = teacherRes.rows[0].id
      testTeacherName = teacherRes.rows[0].full_name || 'Prof. Test Instructor'
    }

    // Resolve a valid class_subject_id
    const csRes = await pool.query(`SELECT id FROM public.class_subjects LIMIT 1`)
    const testCsId = csRes.rows[0]?.id || 'cs-12eng'

    // Insert baseline schedule for Monday Period 3 (t3)
    await pool.query(
      `INSERT INTO public.schedules (
         id, lab_id, teacher_id, subject_name, batch_name, slot_id, span, 
         start_time, end_time, day_key, status, metadata, class_subject_id
       ) VALUES ($1, 'comp', $2, 'Advanced Computing Practical', 'Class 12 Science A', 't3', 1, '11:45', '12:30', 'mon', 'scheduled', $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [testSchedId, testTeacherId, JSON.stringify({ teacher: testTeacherName }), testCsId]
    )
  })

  await t.after(async () => {
    // Cleanup test schedule and test audit entries
    await pool.query(`DELETE FROM public.schedules WHERE id = $1`, [testSchedId])
    await pool.query(`DELETE FROM public.audit_logs WHERE entity_id LIKE 'test-%'`)
    await pool.end()
  })

  await t.test('1. Slot Range & Time Window Overlap Computation', () => {
    // t1 is index 0, span 2 covers indices 0, 1 (t1, t2)
    const r1 = getSlotRange('t1', 2)
    assert.deepEqual(r1, { start: 0, end: 1 })

    // t2 is index 1, span 1 covers index 1
    const r2 = getSlotRange('t2', 1)
    assert.deepEqual(r2, { start: 1, end: 1 })

    // r1 and r2 overlap at index 1
    assert.equal(slotRangesOverlap(r1, r2), true, 't1 (span 2) and t2 must overlap')

    // t3 is index 2, should NOT overlap with r1
    const r3 = getSlotRange('t3', 1)
    assert.equal(slotRangesOverlap(r1, r3), false, 't1 (span 2) and t3 must not overlap')

    // Time window overlap
    assert.equal(timeRangesOverlap('10:00', '11:30', '11:00', '12:00'), true)
    assert.equal(timeRangesOverlap('10:00', '11:00', '11:00', '12:00'), false)
  })

  await t.test('2. Triple-Collision Engine: Room / Facility Collision Detection', async () => {
    // Attempt to book same lab (comp) at same day (mon) and slot (t3)
    const result = await checkSchedulingConflicts({
      labId: 'comp',
      dayKey: 'mon',
      slotId: 't3',
      span: 1,
      batchName: 'Class 11 Science B',
      teacherName: 'Other Teacher',
    })

    assert.equal(result.hasConflict, true, 'Room collision must be detected')
    assert.equal(result.conflictType, 'room', 'Conflict type must be room')
    assert.ok(result.message?.includes('Facility Collision'), 'Message must indicate facility collision')
    assert.ok(result.message?.includes('comp'), 'Message must mention conflicting lab')
  })

  await t.test('3. Triple-Collision Engine: Faculty Double-Booking Detection', async () => {
    // Attempt to book different lab (phys) at same day (mon) and slot (t3) with SAME teacher
    const result = await checkSchedulingConflicts({
      labId: 'phys',
      teacherId: testTeacherId,
      teacherName: testTeacherName,
      dayKey: 'mon',
      slotId: 't3',
      span: 1,
      batchName: 'Class 11 Physics',
    })

    assert.equal(result.hasConflict, true, 'Faculty double-booking must be detected')
    assert.equal(result.conflictType, 'faculty', 'Conflict type must be faculty')
    assert.ok(result.message?.includes('Faculty Collision'), 'Message must indicate faculty collision')
    assert.ok(result.message?.includes(testTeacherName), 'Message must name conflicting teacher')
  })

  await t.test('4. Triple-Collision Engine: Student Cohort Double-Booking Detection', async () => {
    // Attempt to book different lab (chem) at same day (mon) and slot (t3) with SAME class cohort
    const result = await checkSchedulingConflicts({
      labId: 'chem',
      dayKey: 'mon',
      slotId: 't3',
      span: 1,
      batchName: 'Class 12 Science A',
      teacherName: 'Chemistry Teacher',
    })

    assert.equal(result.hasConflict, true, 'Cohort collision must be detected')
    assert.equal(result.conflictType, 'cohort', 'Conflict type must be cohort')
    assert.ok(result.message?.includes('Class Batch Collision'), 'Message must indicate cohort collision')
    assert.ok(result.message?.includes('Class 12 Science A'), 'Message must name conflicting cohort')
  })

  await t.test('5. Triple-Collision Engine: Clean Free Slot Passes Without Conflict', async () => {
    // Attempt to book an unoccupied slot (e.g. Wednesday Period 5)
    const result = await checkSchedulingConflicts({
      labId: 'comp',
      dayKey: 'wed',
      slotId: 't5',
      span: 1,
      batchName: 'Class 11 Biology',
      teacherName: 'Dr. Available Faculty',
    })

    assert.equal(result.hasConflict, false, 'No conflict on free slot')
    assert.equal(result.conflictType, 'none')
    assert.equal(result.conflicts.length, 0)
  })

  await t.test('6. Immutable Audit Trail: Structured Diff Logging & Query Retrieval', async () => {
    const testEntityId = `test-entity-${Date.now()}`

    // 1. Record Attendance Override Audit
    const attAudit = await recordAttendanceOverrideAudit({
      practicalLogId: testEntityId,
      studentName: 'Aayush Adhikari',
      rollNumber: 101,
      beforePresent: false,
      afterPresent: true,
      reason: 'Late arrival verified by gate record',
    })
    assert.equal(attAudit.success, true, 'Attendance audit logged successfully')

    // 2. Record Workstation Issue Status Audit
    const wsAudit = await recordWorkstationIssueStatusAudit({
      issueId: testEntityId,
      workstationLabel: 'PC-07',
      beforeStatus: 'open',
      afterStatus: 'resolved',
      resolutionNotes: 'RAM module reseated and tested OK',
    })
    assert.equal(wsAudit.success, true, 'Workstation issue status audit logged successfully')

    // 3. Query Audit Ledger filtered by entity_type 'attendance'
    const queryRes = await queryAuditLedger({
      entityType: 'attendance',
      search: 'Aayush Adhikari',
      limit: 10,
    })
    assert.ok(queryRes.logs.length >= 1, 'Found at least 1 attendance audit record')
    const foundLog = queryRes.logs.find((l) => l.entity_id === testEntityId)
    assert.ok(foundLog, 'Found specific test attendance log')
    assert.equal(foundLog.action, 'OVERRIDE')
    assert.equal(foundLog.entity_type, 'attendance')
    assert.ok(foundLog.changes?.after?.is_present, 'After state captures is_present = true')

    // 4. Retrieve Audit History for specific entity
    const history = await getAuditHistoryForEntity('workstation_issue', testEntityId)
    assert.ok(history.length >= 1, 'History for test issue retrieved')
    assert.equal(history[0].changes?.before?.status, 'open')
    assert.equal(history[0].changes?.after?.status, 'resolved')
  })
})
