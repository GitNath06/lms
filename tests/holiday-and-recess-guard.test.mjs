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

const { evaluateDateSuspension } = await import('../lib/calendar-policy.ts')
const { DEFAULT_HOLIDAYS } = await import('../lib/master-data.ts')

describe('Institutional Holiday & Recess Policy Guard', () => {
  it('1. Bada Dashain Holiday: 2026-10-11 (Sunday) is recognized as suspended gazetted holiday', () => {
    const status = evaluateDateSuspension('2026-10-11', DEFAULT_HOLIDAYS, {
      sundayWeekend: false,
      saturdayWeekend: true,
    })

    assert.equal(status.isSuspended, true, 'Dashain holiday must suspend operations')
    assert.equal(status.type, 'holiday', 'Suspension type must be holiday')
    assert.ok(status.title?.includes('Bada Dashain'), 'Title must reference Bada Dashain')
    assert.equal(status.badge, 'Gazetted Public Holiday', 'Badge must state Gazetted Public Holiday')
  })

  it('2. Regular Academic Day: 2026-10-07 (Wednesday) is NOT suspended', () => {
    const status = evaluateDateSuspension('2026-10-07', DEFAULT_HOLIDAYS, {
      sundayWeekend: false,
      saturdayWeekend: true,
    })

    assert.equal(status.isSuspended, false, 'Wednesday 2026-10-07 is an active academic day')
  })

  it('3. Statutory Weekend: Saturday 2026-11-21 is suspended under Nepal statutory policy', () => {
    // 2026-11-21 is a Saturday outside Dashain/Tihar
    const status = evaluateDateSuspension('2026-11-21', DEFAULT_HOLIDAYS, {
      sundayWeekend: false,
      saturdayWeekend: true,
    })

    assert.equal(status.isSuspended, true, 'Saturday must be suspended')
    assert.equal(status.type, 'recess', 'Saturday must be classified as recess')
    assert.equal(status.title, 'Saturday Statutory Weekend')
    assert.equal(status.badge, 'Official Weekly Off')
  })

  it('4. Sunday Standard Work Day: Sunday 2026-11-22 is NOT suspended when sundayWeekend is false', () => {
    const status = evaluateDateSuspension('2026-11-22', DEFAULT_HOLIDAYS, {
      sundayWeekend: false,
      saturdayWeekend: true,
    })

    assert.equal(status.isSuspended, false, 'Sunday in Nepal is an active work day by default')
  })

  it('5. Sunday Week Off Policy: Sunday 2026-11-22 IS suspended when sundayWeekend policy is ON', () => {
    const status = evaluateDateSuspension('2026-11-22', DEFAULT_HOLIDAYS, {
      sundayWeekend: true,
      saturdayWeekend: true,
    })

    assert.equal(status.isSuspended, true, 'Sunday must be suspended when Sunday Week Off Policy is ON')
    assert.equal(status.type, 'recess', 'Suspension type must be recess')
    assert.equal(status.title, 'Sunday Institutional Week Off')
    assert.equal(status.badge, 'Week Off Active')
  })

  it('6. Server Guard: Practical log creation rejects submissions on Dashain holiday', async () => {
    const { createPracticalLog } = await import('../app/actions/logs.ts')
    const res = await createPracticalLog({
      schedule_id: 'test-sched',
      lab_id: 'comp',
      date: '2026-10-11',
      period_label: '10:10 - 11:00',
      subject_name: 'Database Management Systems',
      practical_title: 'DBMS Lab 1',
      total_students: 40,
      present_students: 40,
      absent_students: 0,
      status: 'conducted',
    })

    assert.equal(res.success, false, 'Practical log on 2026-10-11 must be rejected')
    assert.ok(res.error?.includes('Practical log rejected'), 'Error must inform user of suspension')
    assert.ok(res.error?.includes('Bada Dashain Vacation'), 'Error must specify holiday title')
  })

  it('7. Server Guard: Live session log submission rejects on Dashain holiday', async () => {
    const { submitLiveSession } = await import('../app/actions/live-session.ts')
    const res = await submitLiveSession({
      scheduleId: 'test-sched-01',
      practicalTitle: 'DBMS Practical',
      date: '2026-10-11',
      attendance: [],
    })

    assert.equal(res.success, false, 'Live session submission must be rejected on Dashain holiday')
    assert.ok(res.error?.includes('Practical log submission rejected'), 'Error must explain log rejection')
  })
})
