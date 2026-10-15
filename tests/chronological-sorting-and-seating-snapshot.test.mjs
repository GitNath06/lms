import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// Load .env.local into process.env before DB clients initialize
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

const { sortSessionsChronologically, parseTimeToMinutes } = await import('../lib/utils.ts')
const { createPracticalLog } = await import('../app/actions/logs.ts')
const { getPgPool } = await import('../lib/db.ts')

describe('Chronological Sorting, Session Lifecycle & Universal Seating Snapshot', () => {
  it('1. Chronological Sorting: Morning sessions (10:10 AM CHEM & COMP) precede afternoon sessions (01:45 PM COMP)', () => {
    // Recreate the exact scenario from user Image 2 where string sorting put 01:45 ahead of 10:10
    const unsortedSessions = [
      { id: 's-145', startTime: '01:45', endTime: '02:30', slotId: 't7', subjectName: 'DBMS-10', lab_id: 'comp', lab: 'Computer Lab' },
      { id: 's-230', startTime: '02:30', endTime: '03:15', slotId: 't8', subjectName: 'COA-11', lab_id: 'comp', lab: 'Computer Lab' },
      { id: 's-315', startTime: '03:15', endTime: '04:05', slotId: 't9', subjectName: 'VP-12', lab_id: 'comp', lab: 'Computer Lab' },
      { id: 's-1010-comp', startTime: '10:10', endTime: '11:00', slotId: 't2', subjectName: 'DDMP-10', lab_id: 'comp', lab: 'Computer Lab' },
      { id: 's-1010-chem', startTime: '10:10', endTime: '11:00', slotId: 't2', subjectName: 'CHEM-12', lab_id: 'chem', lab: 'Chemistry Laboratory' },
      { id: 's-1100-chem', startTime: '11:00', endTime: '11:45', slotId: 't3', subjectName: 'CHEM-12', lab_id: 'chem', lab: 'Chemistry Laboratory' },
      { id: 's-1230-comp', startTime: '12:30', endTime: '01:15', slotId: 't5', subjectName: 'COMP-7AB', lab_id: 'comp', lab: 'Computer Lab' },
    ]

    const sorted = sortSessionsChronologically(unsortedSessions)

    // Verify 10:10 AM slots are at the very top (indexes 0 and 1)
    const morningSlots = sorted.slice(0, 2).map((s) => s.startTime)
    assert.deepEqual(morningSlots, ['10:10', '10:10'], 'Morning 10:10 AM slots must appear first')

    // Verify Chemistry Lab session at 10:10 AM is present in morning fold alongside Computer Lab
    const morningSubjects = sorted.slice(0, 2).map((s) => s.subjectName).sort()
    assert.deepEqual(morningSubjects, ['CHEM-12', 'DDMP-10'], 'Both CHEM-12 and DDMP-10 morning slots must be in the top fold')

    // Verify 11:00 AM comes before 12:30 PM and afternoon slots
    assert.equal(sorted[2].startTime, '11:00', '11:00 AM CHEM-12 must be 3rd')
    assert.equal(sorted[3].startTime, '12:30', '12:30 PM must be 4th')
    assert.equal(sorted[4].startTime, '01:45', '01:45 PM afternoon slot must appear AFTER morning/midday slots')
    assert.equal(sorted[5].startTime, '02:30', '02:30 PM must follow 01:45 PM')
    assert.equal(sorted[6].startTime, '03:15', '03:15 PM must follow 02:30 PM')
  })

  it('2. Session Timing Lifecycle: At 09:52 AM, a 10:10 AM session is UPCOMING (Starts in 18m), not LIVE', () => {
    const currentMinutes = 9 * 60 + 52 // 09:52 AM = 592 minutes
    const sessionStartTime = '10:10'
    const sessionEndTime = '11:00'

    const startMin = parseTimeToMinutes(sessionStartTime) // 610 minutes
    const endMin = parseTimeToMinutes(sessionEndTime)     // 660 minutes

    const isUpcoming = currentMinutes < startMin
    const startsInMins = startMin - currentMinutes
    const isLive = currentMinutes >= startMin && currentMinutes < endMin
    const isPast = currentMinutes >= endMin

    assert.equal(isUpcoming, true, '09:52 AM must be classified as upcoming for 10:10 AM class')
    assert.equal(startsInMins, 18, 'Starts in minutes must be exactly 18m')
    assert.equal(isLive, false, '09:52 AM must NOT be classified as live for 10:10 AM class')
    assert.equal(isPast, false, '09:52 AM is not past')
  })

  it('3. Universal Seating Snapshot Invariant: Creating a Computer Lab practical log auto-constructs and persists seating_snapshot in DB', async () => {
    const pool = getPgPool()
    if (!pool) {
      console.log('Skipping DB write test: Direct connection pool not available.')
      return
    }

    const testDate = '2026-10-07' // Active Wednesday
    const testLogId = `TEST-LOG-${Date.now()}`

    try {
      const res = await createPracticalLog({
        id: testLogId,
        lab_id: 'comp',
        date: testDate,
        period_label: '10:10 – 11:00',
        subject_name: 'TEST - Computer Science Practical',
        batch_group: '12 Eng',
        practical_title: 'Verification of Seating Snapshot Persistence',
        total_students: 35,
        present_students: 34,
        absent_students: 1,
        absent_rolls: [5],
        status: 'conducted',
      })

      assert.equal(res.success, true, `Log creation should succeed: ${res.error}`)

      // Query database directly to verify seating_snapshot JSONB is stored
      const checkRes = await pool.query(
        'SELECT id, lab_id, seating_snapshot FROM public.practical_logs WHERE id = $1',
        [testLogId]
      )

      assert.equal(checkRes.rows.length, 1, 'Practical log row must exist in database')
      const row = checkRes.rows[0]
      assert.equal(row.lab_id, 'comp', 'Lab ID must be comp')
      assert.ok(row.seating_snapshot, 'seating_snapshot must not be null or undefined')
      assert.ok(Array.isArray(row.seating_snapshot), 'seating_snapshot must be a JSON array')
      assert.ok(row.seating_snapshot.length > 0, 'seating_snapshot must contain workstation entries')

      // Verify roll 5 is marked as is_present: false
      const roll5Entry = row.seating_snapshot.find((s) => s.roll_number === 5)
      if (roll5Entry) {
        assert.equal(roll5Entry.is_present, false, 'Roll 5 absent student must be marked is_present: false')
      }
    } finally {
      // Clean up test row
      await pool.query('DELETE FROM public.practical_logs WHERE id = $1', [testLogId]).catch(() => {})
    }
  })
})
