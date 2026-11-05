import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getPgPool } from '../lib/db.ts'
import { parseTimeToMinutes, sortPeriodSlots } from '../lib/utils.ts'

describe('Period Slots Chronological Order & Key Synchronization', () => {
  it('1. sortPeriodSlots sorts arbitrary period slots chronologically by start time', () => {
    const unsorted = [
      { id: 't4', name: 'Period 4', label: '12:15 - 01:00 PM' },
      { id: 't8', name: 'Period 8', label: '03:55 - 04:30 PM' },
      { id: 't0', name: 'Pre-Period', label: '09:15 - 09:50' },
      { id: 't1', name: 'Period 1', label: '10:00 - 10:45 AM' },
      { id: 'break', name: 'Recess Break', label: '01:00 - 01:40 PM' },
      { id: 't2', name: 'Period 2', label: '10:45 - 11:30 AM' },
    ]

    const sorted = sortPeriodSlots(unsorted)

    assert.equal(sorted[0].name, 'Pre-Period', 'Pre-Period (09:15) must be first')
    assert.equal(sorted[1].name, 'Period 1', 'Period 1 (10:00) must be second')
    assert.equal(sorted[2].name, 'Period 2', 'Period 2 (10:45) must be third')
    assert.equal(sorted[3].name, 'Period 4', 'Period 4 (12:15) must be fourth')
    assert.equal(sorted[4].name, 'Recess Break', 'Recess Break (01:00 PM) must be fifth')
    assert.equal(sorted[5].name, 'Period 8', 'Period 8 (03:55 PM) must be last')
  })

  it('2. PostgreSQL master_time_slots and infrastructure_periods are synchronized and in order', async () => {
    const pool = getPgPool()
    if (!pool) {
      console.log('Skipping DB check: pool not available')
      return
    }

    const res = await pool.query(
      `SELECT key, value FROM public.institution_settings WHERE key IN ('master_time_slots', 'infrastructure_periods')`
    )

    const masterRow = res.rows.find((r) => r.key === 'master_time_slots')
    const infraRow = res.rows.find((r) => r.key === 'infrastructure_periods')

    assert.ok(masterRow?.value, 'master_time_slots must exist in institution_settings')
    assert.ok(infraRow?.value, 'infrastructure_periods must exist in institution_settings')

    const masterSlots = masterRow.value
    const infraSlots = infraRow.value

    assert.equal(masterSlots.length, infraSlots.length, 'Both slot configs must have same length')
    assert.ok(masterSlots.length >= 8, 'Must have at least 8 periods')

    // First period must be valid
    assert.ok(masterSlots[0].name, 'First period must have a name')
    assert.ok(masterSlots[0].label, 'First period must have a label')

    // Ensure all periods are monotonically increasing in start minutes
    for (let i = 1; i < masterSlots.length; i++) {
      const prevMin = parseTimeToMinutes(masterSlots[i - 1].label)
      const currMin = parseTimeToMinutes(masterSlots[i].label)
      assert.ok(
        currMin >= prevMin,
        `Slot ${masterSlots[i].name} (${currMin}m) must be >= previous slot ${masterSlots[i - 1].name} (${prevMin}m)`
      )
    }
  })
})
