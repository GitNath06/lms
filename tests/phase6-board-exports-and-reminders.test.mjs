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
import { generateStudentBoardComplianceXlsxBuffer } from '../lib/exports/xlsx.ts'
import {
  exportStudentBoardComplianceAction,
  getInstitutionalReminders,
} from '../app/actions/institutional-reports.ts'

test('Phase 6: Sprint 4 — Official Board Exports & Institutional Reminders Suite', async (t) => {
  const pool = getPgPool()

  await t.after(async () => {
    await pool.end()
  })

  await t.test('1. Official NEB Board Excel (.xlsx) Register Generation', async () => {
    const mockReport = {
      class_id: '12eng',
      class_name: 'Class 12 Science (Engineering)',
      academic_year_id: '2083',
      academic_year_name: '2083 BS',
      total_students: 4,
      eligible_students: 3,
      barred_students: 1,
      cohort_avg_rate_pct: 82,
      records: [
        {
          student_id: 's-1',
          enrollment_id: 'e-1',
          roll_number: 101,
          full_name: 'Aayush Adhikari',
          registration_no: 'NEB-83-101',
          sessions_held: 20,
          sessions_attended: 18,
          absent_count: 2,
          attendance_rate_pct: 90,
          is_eligible: true,
        },
        {
          student_id: 's-2',
          enrollment_id: 'e-2',
          roll_number: 102,
          full_name: 'Bishal Shrestha',
          registration_no: 'NEB-83-102',
          sessions_held: 20,
          sessions_attended: 16,
          absent_count: 4,
          attendance_rate_pct: 80,
          is_eligible: true,
        },
        {
          student_id: 's-3',
          enrollment_id: 'e-3',
          roll_number: 103,
          full_name: 'Chirag Thapa',
          registration_no: 'NEB-83-103',
          sessions_held: 20,
          sessions_attended: 15,
          absent_count: 5,
          attendance_rate_pct: 75,
          is_eligible: true,
        },
        {
          student_id: 's-4',
          enrollment_id: 'e-4',
          roll_number: 104,
          full_name: 'Deepak Sharma',
          registration_no: 'NEB-83-104',
          sessions_held: 20,
          sessions_attended: 10,
          absent_count: 10,
          attendance_rate_pct: 50,
          is_eligible: false,
        },
      ],
    }

    const buffer = await generateStudentBoardComplianceXlsxBuffer(mockReport)
    assert.ok(Buffer.isBuffer(buffer), 'Buffer returned')
    assert.ok(buffer.length > 2000, `Buffer size (${buffer.length} bytes) is healthy for Excel file`)

    // Verify PK zip header signature for .xlsx (0x50 0x4B 0x03 0x04)
    assert.equal(buffer[0], 0x50, 'PK header signature byte 0')
    assert.equal(buffer[1], 0x4b, 'PK header signature byte 1')
  })

  await t.test('2. Server Action: exportStudentBoardComplianceAction', async () => {
    const res = await exportStudentBoardComplianceAction({
      academicYearId: '2083',
      classId: '12eng',
    })

    assert.equal(res.success, true, 'Export server action succeeded')
    assert.ok(res.base64, 'Base64 payload present')
    assert.ok(res.filename?.endsWith('.xlsx'), 'Filename ends in .xlsx')
    assert.equal(
      res.contentType,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Valid Excel MIME type'
    )
  })

  await t.test('3. Real-time Derived Institutional Reminders Engine', async () => {
    const res = await getInstitutionalReminders()

    assert.equal(res.success, true, 'Reminders fetched successfully')
    assert.ok(Array.isArray(res.data), 'Reminders returned as array')

    const allowedTypes = [
      'critical_workstation',
      'overdue_maintenance',
      'pending_verification',
      'low_attendance_cohort',
    ]

    for (const item of res.data) {
      assert.ok(item.id, 'Reminder has ID')
      assert.ok(allowedTypes.includes(item.type), `Valid reminder type: ${item.type}`)
      assert.ok(['low', 'medium', 'high', 'critical'].includes(item.severity), 'Valid severity')
      assert.ok(item.title, 'Reminder has title')
      assert.ok(item.message, 'Reminder has message')
      assert.ok(item.linkUrl, 'Reminder has deep link')
      assert.ok(item.timestamp, 'Reminder has timestamp')
    }
  })
})
