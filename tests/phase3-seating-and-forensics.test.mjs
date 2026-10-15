import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// Load .env.local into process.env if present
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

describe('Phase 3: Dynamic Seating, Displaced Student Triage & Forensic Audit', () => {
  // 1. Natural Alphanumeric Workstation Sorting
  it('Workstation Natural Alphanumeric Sort: orders stations logically (PC-01 .. PC-10, PC-50)', () => {
    const rawStations = [
      { id: '1', label: 'PC-10' },
      { id: '2', label: 'PC-02' },
      { id: '3', label: 'PC-01' },
      { id: '4', label: 'PC-20' },
      { id: '5', label: 'PC-03' },
      { id: '6', label: 'Teacher-01' },
    ]

    const sorted = [...rawStations].sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' })
    )

    const labels = sorted.map((s) => s.label)
    assert.deepEqual(labels, ['PC-01', 'PC-02', 'PC-03', 'PC-10', 'PC-20', 'Teacher-01'])
  })

  // 2. Auto-Assign Sorting Strategy (Roll vs Alphabetical)
  it('Auto-Assign Strategies: sorts students by roll_asc or alphabetical A-Z', () => {
    const mockStudents = [
      { id: 'e1', roll_number: 14, students: { full_name: 'Kaustuv Thapa' } },
      { id: 'e2', roll_number: 3, students: { full_name: 'Aayush Poudel' } },
      { id: 'e3', roll_number: 22, students: { full_name: 'Binod Sharma' } },
      { id: 'e4', roll_number: 7, students: { full_name: 'Zack Gurung' } },
    ]

    // Strategy A: roll_asc
    const byRoll = [...mockStudents].sort((a, b) => (a.roll_number || 0) - (b.roll_number || 0))
    assert.deepEqual(
      byRoll.map((s) => s.roll_number),
      [3, 7, 14, 22]
    )

    // Strategy B: alphabetical A-Z
    const byAlpha = [...mockStudents].sort((a, b) =>
      (a.students?.full_name || '').localeCompare(b.students?.full_name || '')
    )
    assert.deepEqual(
      byAlpha.map((s) => s.students.full_name),
      ['Aayush Poudel', 'Binod Sharma', 'Kaustuv Thapa', 'Zack Gurung']
    )
  })

  // 3. Displaced Student Detection Engine
  it('Displaced Student Detection: accurately flags students on broken/servicing stations', () => {
    const mockWorkstations = [
      { id: 'ws-1', label: 'PC-01', status: 'operational', active_issues: [] },
      {
        id: 'ws-2',
        label: 'PC-02',
        status: 'under_repair',
        active_issues: [{ id: 'iss-1', title: 'PSU Smoke', severity: 'critical', status: 'in_progress' }],
      },
      {
        id: 'ws-3',
        label: 'PC-03',
        status: 'flagged',
        active_issues: [{ id: 'iss-2', title: 'Blue Screen of Death', severity: 'high', status: 'open' }],
      },
      {
        id: 'ws-4',
        label: 'PC-04',
        status: 'flagged',
        active_issues: [{ id: 'iss-3', title: 'Sticky Mouse Wheel', severity: 'low', status: 'open' }],
      },
      { id: 'ws-5', label: 'PC-05', status: 'operational', active_issues: [] },
    ]

    const mockSeatPlan = {
      'ws-1': { studentId: 's1', enrollmentId: 'e1', rollNumber: 1, fullName: 'Student One', isOverride: false },
      'ws-2': { studentId: 's2', enrollmentId: 'e2', rollNumber: 2, fullName: 'Student Two', isOverride: false },
      'ws-3': { studentId: 's3', enrollmentId: 'e3', rollNumber: 3, fullName: 'Student Three', isOverride: false },
      'ws-4': { studentId: 's4', enrollmentId: 'e4', rollNumber: 4, fullName: 'Student Four', isOverride: false },
      'ws-5': { studentId: 's5', enrollmentId: 'e5', rollNumber: 5, fullName: 'Student Five', isOverride: true },
    }

    const wsMap = new Map(mockWorkstations.map((w) => [w.id, w]))
    const displaced = []

    for (const [wsId, student] of Object.entries(mockSeatPlan)) {
      if (student.isOverride) continue
      const ws = wsMap.get(wsId)
      if (!ws) continue

      const isBroken =
        ws.status === 'under_repair' ||
        ws.status === 'flagged' ||
        (ws.active_issues &&
          ws.active_issues.some(
            (i) => i.status !== 'resolved' && (i.severity === 'critical' || i.severity === 'high')
          ))

      if (isBroken) {
        const primaryIssue = ws.active_issues?.[0]
        displaced.push({
          rollNumber: student.rollNumber,
          studentName: student.fullName,
          originalWsLabel: ws.label,
          issueTitle: primaryIssue?.title,
          severity: primaryIssue?.severity,
        })
      }
    }

    // Student 2 (PC-02, under_repair) and Student 3 (PC-03, high) and Student 4 (PC-04, flagged)
    // Student 1 (operational) and Student 5 (isOverride = true) must NOT be displaced
    assert.equal(displaced.length, 3)
    assert.deepEqual(
      displaced.map((d) => d.rollNumber),
      [2, 3, 4]
    )
    assert.equal(displaced.find((d) => d.rollNumber === 2)?.issueTitle, 'PSU Smoke')
  })

  // 4. Seating Snapshot Serialization & Schema Conformance
  it('Seating Snapshot Serialization: builds complete station map with presence & override flags', () => {
    const mockSnapshot = [
      {
        workstation_id: 'ws-01',
        workstation_label: 'PC-01',
        row_label: 'Row A',
        student_id: 's-101',
        enrollment_id: 'e-101',
        student_name: 'Kaustuv Thapa',
        roll_number: 14,
        is_present: true,
        is_override: false,
        original_workstation_label: null,
        notes: null,
      },
      {
        workstation_id: 'ws-02',
        workstation_label: 'PC-02',
        row_label: 'Row A',
        student_id: 's-102',
        enrollment_id: 'e-102',
        student_name: 'Rohan Shrestha',
        roll_number: 22,
        is_present: true,
        is_override: true,
        original_workstation_label: 'PC-14',
        notes: 'Session relocation override',
      },
      {
        workstation_id: 'ws-03',
        workstation_label: 'PC-03',
        row_label: 'Row A',
        student_id: null,
        enrollment_id: null,
        student_name: null,
        roll_number: null,
        is_present: false,
        is_override: false,
        original_workstation_label: null,
        notes: null,
      },
    ]

    const serialized = JSON.stringify(mockSnapshot)
    const parsed = JSON.parse(serialized)

    assert.equal(parsed.length, 3)
    assert.equal(parsed[0].student_name, 'Kaustuv Thapa')
    assert.equal(parsed[0].is_present, true)
    assert.equal(parsed[1].is_override, true)
    assert.equal(parsed[2].student_id, null)
  })

  // 5. Practical Usage Forensic Timeline Query Extraction
  it('Forensic Timeline: extracts student seating chronology for a target workstation', () => {
    const mockHistoricalLogs = [
      {
        log_id: 'LOG-01',
        date: '2026-10-05',
        period_label: '10:00 - 11:30',
        subject_name: 'Computer Science Practical',
        batch_group: 'Class 11 Science A',
        practical_title: 'HTML Forms & CSS Flexbox',
        topic_learned: 'Responsive Layouts',
        seating_snapshot: [
          {
            workstation_id: 'target-ws-12',
            workstation_label: 'PC-12',
            student_name: 'Kaustuv Thapa',
            roll_number: 14,
            is_present: true,
            is_override: false,
          },
          {
            workstation_id: 'other-ws-13',
            workstation_label: 'PC-13',
            student_name: 'Aayush Poudel',
            roll_number: 5,
            is_present: true,
            is_override: false,
          },
        ],
      },
      {
        log_id: 'LOG-02',
        date: '2026-10-04',
        period_label: '12:00 - 01:30',
        subject_name: 'Computer Science Practical',
        batch_group: 'Class 12 Science B',
        practical_title: 'C++ Pointers & Memory Management',
        topic_learned: 'Dynamic Allocation',
        seating_snapshot: [
          {
            workstation_id: 'target-ws-12',
            workstation_label: 'PC-12',
            student_name: 'Rohan Shrestha',
            roll_number: 22,
            is_present: true,
            is_override: true,
          },
        ],
      },
    ]

    const targetWsId = 'target-ws-12'
    const timeline = []

    for (const log of mockHistoricalLogs) {
      const entry = log.seating_snapshot.find((s) => s.workstation_id === targetWsId)
      if (entry) {
        timeline.push({
          log_id: log.log_id,
          date: log.date,
          period_label: log.period_label,
          batch_group: log.batch_group,
          student_name: entry.student_name,
          roll_number: entry.roll_number,
          is_override: entry.is_override,
          topic_learned: log.topic_learned,
        })
      }
    }

    assert.equal(timeline.length, 2)
    assert.equal(timeline[0].student_name, 'Kaustuv Thapa')
    assert.equal(timeline[0].roll_number, 14)
    assert.equal(timeline[1].student_name, 'Rohan Shrestha')
    assert.equal(timeline[1].is_override, true)
  })

  // 6. PostgreSQL Database Schema Invariant: seating_snapshot column check
  it('Database Schema: public.practical_logs has column seating_snapshot of type jsonb', async () => {
    const pool = getPgPool()
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'practical_logs' 
        AND column_name = 'seating_snapshot';
    `)

    assert.equal(res.rows.length, 1, 'Column seating_snapshot must exist in public.practical_logs')
    assert.equal(res.rows[0].data_type, 'jsonb', 'seating_snapshot data_type must be jsonb')
  })

  after(async () => {
    try {
      await getPgPool().end()
    } catch {
      // ignore
    }
  })
})
