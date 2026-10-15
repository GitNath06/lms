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

import {
  getStudentBoardComplianceReport,
  getSyllabusProgressLedger,
  getFacultyPracticalLedger,
  getLabOccupancyIndex,
  getWorkstationReliabilityAnalytics,
  getWorkstationTechnicalBiography,
} from '../app/actions/institutional-reports.ts'

test('Phase 6: Sprint 2 — Institutional Reporting & Workstation Operational Intelligence Suite', async (t) => {
  await t.test('1. Student Practical Attendance & NEB Board Exam Compliance (75% Threshold)', async () => {
    const res = await getStudentBoardComplianceReport({
      academicYearId: '2083',
      classId: '12eng',
    })

    assert.equal(res.success, true, 'Report queries successfully')
    assert.ok(res.data, 'Report data exists')
    assert.equal(typeof res.data.total_students, 'number')
    assert.equal(typeof res.data.eligible_students, 'number')
    assert.equal(typeof res.data.barred_students, 'number')
    assert.equal(
      res.data.total_students,
      res.data.eligible_students + res.data.barred_students,
      'Total students equals eligible + barred count'
    )

    // Verify each record adheres to 75% rule
    for (const record of res.data.records) {
      if (record.attendance_rate_pct >= 75) {
        assert.equal(record.is_eligible, true, `Roll ${record.roll_number} with rate >= 75% must be eligible`)
      } else {
        assert.equal(record.is_eligible, false, `Roll ${record.roll_number} with rate < 75% must be barred`)
      }
    }
  })

  await t.test('2. Syllabus Practical Quota Completion & Skipped Sessions Ledger', async () => {
    const res = await getSyllabusProgressLedger({
      classId: '12eng',
    })

    assert.equal(res.success, true, 'Syllabus ledger queries successfully')
    assert.ok(res.data, 'Syllabus data exists')
    assert.equal(res.data.prescribed_quota, 20, 'Standard NEB prescribed practical quota is 20')
    assert.equal(typeof res.data.completed_count, 'number')
    assert.equal(typeof res.data.completion_pct, 'number')
    assert.ok(res.data.completion_pct >= 0 && res.data.completion_pct <= 100, 'Completion % within 0-100%')
    assert.ok(Array.isArray(res.data.practicals), 'Practicals list returned as array')
    assert.ok(typeof res.data.skipped_reasons_tally === 'object', 'Skipped reasons tally returned as object')
  })

  await t.test('3. Faculty Practical Operations & Lab In-Charge Dual Sign-Off Audit', async () => {
    const res = await getFacultyPracticalLedger({})

    assert.equal(res.success, true, 'Faculty ledger queries successfully')
    assert.ok(Array.isArray(res.data), 'Faculty records returned as array')

    for (const record of res.data) {
      assert.ok(record.teacher_id, 'Teacher ID present')
      assert.ok(record.teacher_name, 'Teacher name present')
      assert.equal(typeof record.total_sessions_logged, 'number')
      assert.equal(typeof record.incharge_verified_count, 'number')
      assert.ok(
        record.incharge_verified_count <= record.conducted_count,
        'Verified count cannot exceed conducted count'
      )
      assert.ok(
        record.verification_rate_pct >= 0 && record.verification_rate_pct <= 100,
        'Verification rate is between 0% and 100%'
      )
    }
  })

  await t.test('4. Laboratory Room Occupancy & Capacity Utilization Index', async () => {
    const res = await getLabOccupancyIndex({})

    assert.equal(res.success, true, 'Lab occupancy index queries successfully')
    assert.ok(Array.isArray(res.data), 'Lab records returned as array')
    assert.ok(res.data.length > 0, 'At least 1 active lab returned')

    for (const lab of res.data) {
      assert.ok(lab.lab_id, 'Lab ID present')
      assert.ok(lab.lab_name, 'Lab name present')
      assert.ok(lab.lab_capacity > 0, 'Lab capacity is greater than 0')
      assert.ok(
        lab.occupancy_rate_pct >= 0 && lab.occupancy_rate_pct <= 100,
        'Occupancy rate within bounds'
      )
      assert.ok(
        lab.capacity_utilization_pct >= 0 && lab.capacity_utilization_pct <= 100,
        'Capacity utilization within bounds'
      )
    }
  })

  await t.test('5. Workstation Reliability Analytics & Hardware MTTR Hotspots', async () => {
    const res = await getWorkstationReliabilityAnalytics({ labId: 'comp' })

    assert.equal(res.success, true, 'Workstation reliability analytics queries successfully')
    assert.ok(res.data, 'Reliability report data exists')
    assert.equal(res.data.total_workstations, 34, 'Computer Lab has 34 physical workstations')
    assert.ok(
      res.data.overall_uptime_pct >= 0 && res.data.overall_uptime_pct <= 100,
      'Overall hardware uptime % within 0-100%'
    )
    assert.ok(res.data.overall_mttr_hours > 0, 'MTTR hours is greater than 0')
    assert.ok(Array.isArray(res.data.hotspot_workstations), 'Hotspots returned as array')
    assert.ok(Array.isArray(res.data.workstations), 'All workstations returned as array')
  })

  await t.test('6. Workstation Technical Lifecycle Biography Integration', async () => {
    // Test with PC-01 (known workstation)
    const relRes = await getWorkstationReliabilityAnalytics({ labId: 'comp' })
    const testWsId = relRes.data.workstations[0].workstation_id

    const bioRes = await getWorkstationTechnicalBiography(testWsId)
    assert.equal(bioRes.success, true, 'Biography queries successfully for workstation')
    assert.ok(bioRes.data, 'Biography data returned')
    assert.equal(bioRes.data.workstation_id, testWsId, 'Biography matches target workstation')
    assert.ok(Array.isArray(bioRes.data.issues), 'Issues history is array')
    assert.ok(Array.isArray(bioRes.data.maintenance_history), 'Maintenance servicing history is array')
    assert.ok(Array.isArray(bioRes.data.student_seating_history), 'Student seating history is array')
  })
})
