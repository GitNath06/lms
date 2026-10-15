import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

import {
  validateParsedRoster,
  formatAutoAdmissionNo,
  isExactNormalizedNameMatch,
} from '../lib/roster-ingestion/validator.ts'

function loadDbUrl() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return null
  const content = fs.readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) {
      return line.split('=')[1].trim().replace(/^["']|["']$/g, '')
    }
  }
  return null
}

const dbUrl = loadDbUrl()

describe('Phase 6: Unified Roster Ingestion & Cohort Lifecycle Suite', () => {
  let pool
  let client

  before(async () => {
    if (dbUrl) {
      pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
      client = await pool.connect()
    }
  })

  after(async () => {
    if (client) client.release()
    if (pool) await pool.end()
  })

  // =========================================================================
  // 1. DETERMINISTIC MATCHING LADDER & ZERO SILENT FUZZY MERGES
  // =========================================================================
  describe('1. Deterministic Matching Ladder & Pre-Flight 4-Bucket Grouping', () => {
    it('Rule 1: Exact Roll + Exact Name auto-confirms into Bucket 1 without prompts', () => {
      const mockContext = {
        targetAcademicYearId: '2083',
        targetAcademicYearName: '2083-2084 BS',
        targetClassId: '12eng',
        targetClassName: 'Class 12 Science (Eng)',
        existingStudentsByAdmissionNo: new Map(),
        existingStudentsByRegistrationNo: new Map(),
        allActiveStudents: [],
        existingEnrollmentsByStudentId: new Map([
          ['student-1', { id: 'enr-1', roll_number: 1 }],
        ]),
        existingEnrollmentsByRoll: new Map([
          [1, { id: 'enr-1', student_id: 'student-1', full_name: 'Aarav Sharma', admission_no: 'ADM-2083-12ENG-01', registration_no: null }],
        ]),
        existingCohortStudents: [
          { id: 'enr-1', student_id: 'student-1', roll_number: 1, full_name: 'Aarav Sharma', admission_no: 'ADM-2083-12ENG-01', registration_no: null },
        ],
        mode: 'sync',
      }

      const rows = [
        { row_index: 2, roll_number: 1, full_name: 'Aarav Sharma', admission_no: null, registration_no: null },
      ]

      const report = validateParsedRoster(rows, mockContext)
      assert.equal(report.valid_count, 1)
      assert.equal(report.buckets.bucket1_auto_confirmed.length, 1)
      assert.equal(report.buckets.bucket2_review_needed.length, 0)
      assert.equal(report.buckets.bucket1_auto_confirmed[0].status, 'valid_retained')
      assert.equal(report.buckets.bucket1_auto_confirmed[0].diff_badge, 'matched_exact')
    })

    it('Rule 2: Unique in-class name match detects roll shift and auto-confirms into Bucket 1', () => {
      const mockContext = {
        targetAcademicYearId: '2083',
        targetAcademicYearName: '2083-2084 BS',
        targetClassId: '12eng',
        targetClassName: 'Class 12 Science (Eng)',
        existingStudentsByAdmissionNo: new Map(),
        existingStudentsByRegistrationNo: new Map(),
        allActiveStudents: [],
        existingEnrollmentsByStudentId: new Map([
          ['student-12', { id: 'enr-12', roll_number: 12 }],
        ]),
        existingEnrollmentsByRoll: new Map([
          [12, { id: 'enr-12', student_id: 'student-12', full_name: 'Sujan Shrestha', admission_no: 'ADM-2083-12ENG-12', registration_no: null }],
        ]),
        existingCohortStudents: [
          { id: 'enr-12', student_id: 'student-12', roll_number: 12, full_name: 'Sujan Shrestha', admission_no: 'ADM-2083-12ENG-12', registration_no: null },
        ],
        mode: 'sync',
      }

      // Sujan Shrestha is shifting from Roll 12 to Roll 14
      const rows = [
        { row_index: 2, roll_number: 14, full_name: 'Sujan Shrestha', admission_no: null, registration_no: null },
      ]

      const report = validateParsedRoster(rows, mockContext)
      assert.equal(report.valid_count, 1)
      assert.equal(report.buckets.bucket1_auto_confirmed.length, 1)
      assert.equal(report.buckets.bucket2_review_needed.length, 0)
      const shifted = report.buckets.bucket1_auto_confirmed[0]
      assert.equal(shifted.status, 'valid_roll_update')
      assert.equal(shifted.diff_badge, 'roll_changed')
      assert.equal(shifted.old_roll_number, 12)
      assert.ok(shifted.warning_message?.includes('Roll number shifted from 12 → 14'))
    })

    it('Rule 3: Same roll with different spelling refuses silent merge and flags Bucket 2 for review', () => {
      const mockContext = {
        targetAcademicYearId: '2083',
        targetAcademicYearName: '2083-2084 BS',
        targetClassId: '12eng',
        targetClassName: 'Class 12 Science (Eng)',
        existingStudentsByAdmissionNo: new Map(),
        existingStudentsByRegistrationNo: new Map(),
        allActiveStudents: [],
        existingEnrollmentsByStudentId: new Map([
          ['student-2', { id: 'enr-2', roll_number: 2 }],
        ]),
        existingEnrollmentsByRoll: new Map([
          [2, { id: 'enr-2', student_id: 'student-2', full_name: 'Bivek Thapa', admission_no: 'ADM-2083-12ENG-02', registration_no: null }],
        ]),
        existingCohortStudents: [
          { id: 'enr-2', student_id: 'student-2', roll_number: 2, full_name: 'Bivek Thapa', admission_no: 'ADM-2083-12ENG-02', registration_no: null },
        ],
        mode: 'sync',
      }

      // Roll 2: Spreadsheet says "Bibek Thapa", DB says "Bivek Thapa" (fuzzy similarity ~89%)
      // System MUST NOT silently auto-merge!
      const rows = [
        { row_index: 2, roll_number: 2, full_name: 'Bibek Thapa', admission_no: null, registration_no: null },
      ]

      const report = validateParsedRoster(rows, mockContext)
      assert.equal(report.buckets.bucket1_auto_confirmed.length, 0, 'Must NOT auto-confirm spelling ambiguity')
      assert.equal(report.buckets.bucket2_review_needed.length, 1, 'Must place into Bucket 2 for manual human review')
      const flagged = report.buckets.bucket2_review_needed[0]
      assert.equal(flagged.status, 'review_needed')
      assert.equal(flagged.diff_badge, 'name_typo')
      assert.ok(flagged.warning_message?.includes('Manual review required'))
    })

    it('Rule 4 & Auto ADM ID: New roll & unrecognized student assigned Bucket 3 with standard format', () => {
      const mockContext = {
        targetAcademicYearId: '2083',
        targetAcademicYearName: '2083-2084 BS',
        targetClassId: '12eng',
        targetClassName: 'Class 12 Science (Eng)',
        existingStudentsByAdmissionNo: new Map(),
        existingStudentsByRegistrationNo: new Map(),
        allActiveStudents: [],
        existingEnrollmentsByStudentId: new Map(),
        existingEnrollmentsByRoll: new Map(),
        existingCohortStudents: [],
        mode: 'sync',
      }

      const rows = [
        { row_index: 2, roll_number: 36, full_name: 'Pooja Gurung', admission_no: null, registration_no: null },
      ]

      const report = validateParsedRoster(rows, mockContext)
      assert.equal(report.buckets.bucket3_clean_new.length, 1)
      const newStudent = report.buckets.bucket3_clean_new[0]
      assert.equal(newStudent.status, 'valid_new')
      assert.equal(newStudent.diff_badge, 'brand_new')
      assert.equal(newStudent.admission_no, 'ADM-2083-0001')
      assert.equal(newStudent.is_auto_admission_no, true)
    })

    it('Rule 5: Orphaned existing students missing from upload populate Bucket 4', () => {
      const mockContext = {
        targetAcademicYearId: '2083',
        targetAcademicYearName: '2083-2084 BS',
        targetClassId: '12eng',
        targetClassName: 'Class 12 Science (Eng)',
        existingStudentsByAdmissionNo: new Map(),
        existingStudentsByRegistrationNo: new Map(),
        allActiveStudents: [],
        existingEnrollmentsByStudentId: new Map(),
        existingEnrollmentsByRoll: new Map(),
        existingCohortStudents: [
          { id: 'enr-99', student_id: 'student-99', roll_number: 99, full_name: 'Orphaned Student', admission_no: 'ADM-99', registration_no: null },
        ],
        mode: 'sync',
      }

      const rows = [
        { row_index: 2, roll_number: 1, full_name: 'Aarav Sharma', admission_no: 'ADM-01', registration_no: null },
      ]

      const report = validateParsedRoster(rows, mockContext)
      assert.equal(report.buckets.bucket4_unmatched_existing.length, 1)
      assert.equal(report.buckets.bucket4_unmatched_existing[0].roll_number, 99)
      assert.equal(report.buckets.bucket4_unmatched_existing[0].full_name, 'Orphaned Student')
    })
  })

  // =========================================================================
  // 2. ATOMIC CLEAN SLATE OBLITERATION & ZERO-HISTORY SAFETY GUARD
  // =========================================================================
  describe('2. PostgreSQL RPC Clean Slate & Active History Protection', () => {
    it('Safety Guard: Rejects Clean Slate replacement when cohort has active practical attendance history', async () => {
      if (!client) return

      // In 2083, Class 12eng has practical attendance logs
      let rejected = false
      let errorMessage = ''
      try {
        await client.query(`
          SELECT public.commit_roster_ingestion_tx(
            '2083',
            '12eng',
            $1::jsonb,
            'clean_slate'
          );
        `, [JSON.stringify([
          { roll_number: 1, full_name: 'Replacement Student 1', admission_no: null, registration_no: null },
        ])])
      } catch (err) {
        rejected = true
        errorMessage = err.message
      }

      assert.ok(rejected, 'Clean slate wipe must be strictly rejected when practical attendance history exists')
      assert.ok(
        errorMessage.includes('CANNOT_WIPE_ACTIVE_HISTORY'),
        `Error must identify CANNOT_WIPE_ACTIVE_HISTORY. Received: ${errorMessage}`
      )
    })

    it('Clean Slate Execution: Atomically obliterates zero-history dummy cohort and installs fresh roster', async () => {
      if (!client) return

      const testYear = '2083'
      const testClass = '11mgt'
      const tag = `CS-TEST-${Date.now()}`

      // Pre-cleanup in case a previous run terminated prematurely
      await client.query(`
        DELETE FROM public.workstation_seat_plans 
        WHERE academic_year_id = $1 AND class_id = $2;
      `, [testYear, testClass])
      await client.query(`
        DELETE FROM public.student_enrollments 
        WHERE academic_year_id = $1 AND class_id = $2;
      `, [testYear, testClass])
      await client.query(`
        DELETE FROM public.students 
        WHERE admission_no LIKE 'CS-TEST-%' OR admission_no LIKE 'ADM-2083-11MGT-19%';
      `)

      // 1. Seed dummy students and enrollments with ZERO practical logs
      const s1 = await client.query(`
        INSERT INTO public.students (full_name, admission_no) VALUES ('Dummy One', '${tag}-D1') RETURNING id;
      `)
      const s2 = await client.query(`
        INSERT INTO public.students (full_name, admission_no) VALUES ('Dummy Two', '${tag}-D2') RETURNING id;
      `)
      const s1Id = s1.rows[0].id
      const s2Id = s2.rows[0].id

      const enr1 = await client.query(`
        INSERT INTO public.student_enrollments (academic_year_id, class_id, student_id, roll_number, status)
        VALUES ('${testYear}', '${testClass}', '${s1Id}', 191, 'active')
        RETURNING id;
      `)
      const enr2 = await client.query(`
        INSERT INTO public.student_enrollments (academic_year_id, class_id, student_id, roll_number, status)
        VALUES ('${testYear}', '${testClass}', '${s2Id}', 192, 'active')
        RETURNING id;
      `)
      const enr1Id = enr1.rows[0].id
      const enr2Id = enr2.rows[0].id

      // Seed dummy CAD seat plan on workstation ws-01 if available
      const wsCheck = await client.query(`SELECT id FROM public.workstations WHERE is_active = true LIMIT 1;`)
      if (wsCheck.rows.length > 0) {
        const wsId = wsCheck.rows[0].id
        await client.query(`
          INSERT INTO public.workstation_seat_plans (academic_year_id, class_id, enrollment_id, workstation_id, lab_id)
          VALUES ('${testYear}', '${testClass}', '${enr1Id}', '${wsId}', 'comp');
        `)
      }

      // 2. Perform Clean Slate Ingestion with fresh real students (Rolls 191..193)
      const cleanSlatePayload = [
        { roll_number: 191, full_name: 'Real Student Alpha', admission_no: null, registration_no: null },
        { roll_number: 192, full_name: 'Real Student Beta', admission_no: null, registration_no: null },
        { roll_number: 193, full_name: 'Real Student Gamma', admission_no: null, registration_no: null },
      ]

      const commitRes = await client.query(`
        SELECT public.commit_roster_ingestion_tx(
          $1,
          $2,
          $3::jsonb,
          'clean_slate'
        ) as result;
      `, [testYear, testClass, JSON.stringify(cleanSlatePayload)])

      const result = commitRes.rows[0].result
      assert.equal(result.success, true)
      assert.equal(result.mode, 'clean_slate')
      assert.equal(result.processed_rows, 3)
      assert.equal(result.enrollments_created, 3)

      // 3. Verify old dummy seat plans are wiped
      const seatCheck = await client.query(`
        SELECT count(*) as count FROM public.workstation_seat_plans
        WHERE academic_year_id = $1 AND class_id = $2;
      `, [testYear, testClass])
      assert.equal(Number(seatCheck.rows[0].count), 0, 'Clean slate must wipe old seat plans')

      // 4. Verify orphaned dummy students were cleanly deleted
      const dummyCheck = await client.query(`
        SELECT count(*) as count FROM public.students
        WHERE id IN ($1, $2);
      `, [s1Id, s2Id])
      assert.equal(Number(dummyCheck.rows[0].count), 0, 'Clean slate must delete orphaned dummy students')

      // 5. Verify incoming students have standard auto-generated admission numbers
      const newEnrolls = await client.query(`
        SELECT se.roll_number, s.full_name, s.admission_no
        FROM public.student_enrollments se
        JOIN public.students s ON s.id = se.student_id
        WHERE se.academic_year_id = $1 AND se.class_id = $2
        ORDER BY se.roll_number ASC;
      `, [testYear, testClass])

      assert.equal(newEnrolls.rows.length, 3)
      assert.equal(newEnrolls.rows[0].full_name, 'Real Student Alpha')
      assert.equal(newEnrolls.rows[0].admission_no, 'ADM-2083-11MGT-191')
      assert.equal(newEnrolls.rows[1].admission_no, 'ADM-2083-11MGT-192')
      assert.equal(newEnrolls.rows[2].admission_no, 'ADM-2083-11MGT-193')

      // 6. Cleanup test records
      await client.query(`
        DELETE FROM public.student_enrollments
        WHERE academic_year_id = $1 AND class_id = $2 AND roll_number IN (191, 192, 193);
      `, [testYear, testClass])
      await client.query(`
        DELETE FROM public.students
        WHERE admission_no LIKE 'ADM-2083-11MGT-19%';
      `)
    })

    it('Contextual Roll Shift Resolution: Student shifts from Roll 12 to Roll 14 without roll collision', async () => {
      if (!client) return

      const testYear = '2083'
      const testClass = '11mgt'
      const shiftTag = `SHIFT-${Date.now()}`

      // Create student enrolled at Roll 181
      const studentRes = await client.query(`
        INSERT INTO public.students (full_name, admission_no) VALUES ('Shifting Student', '${shiftTag}') RETURNING id;
      `)
      const studentId = studentRes.rows[0].id

      await client.query(`
        INSERT INTO public.student_enrollments (academic_year_id, class_id, student_id, roll_number, status)
        VALUES ('${testYear}', '${testClass}', '${studentId}', 181, 'active');
      `)

      // Sync import with roll updated to 182
      const shiftPayload = [
        { roll_number: 182, full_name: 'Shifting Student', admission_no: shiftTag, registration_no: null },
      ]

      const shiftRes = await client.query(`
        SELECT public.commit_roster_ingestion_tx(
          $1,
          $2,
          $3::jsonb,
          'sync'
        ) as result;
      `, [testYear, testClass, JSON.stringify(shiftPayload)])

      const res = shiftRes.rows[0].result
      assert.equal(res.success, true)
      assert.equal(res.enrollments_updated, 1, 'Roll shifted cleanly from 181 to 182')

      const verifyRoll = await client.query(`
        SELECT roll_number FROM public.student_enrollments
        WHERE student_id = $1 AND academic_year_id = $2 AND class_id = $3;
      `, [studentId, testYear, testClass])

      assert.equal(verifyRoll.rows[0].roll_number, 182)

      // Cleanup
      await client.query(`DELETE FROM public.student_enrollments WHERE student_id = $1;`, [studentId])
      await client.query(`DELETE FROM public.students WHERE id = $1;`, [studentId])
    })
  })
})

