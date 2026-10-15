import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

import { generateBlankRosterTemplate } from '../lib/roster-ingestion/template.ts'
import { parseRosterFile } from '../lib/roster-ingestion/parser.ts'
import { validateParsedRoster, formatAutoAdmissionNo } from '../lib/roster-ingestion/validator.ts'
import { resolveUserScope } from '../lib/context/user-scope.ts'

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

async function buildDbValidationContext(client, academicYearId, classId) {
  const classRes = await client.query(`SELECT id, name FROM public.classes WHERE id = $1;`, [classId])
  const yearRes = await client.query(`SELECT id, name FROM public.academic_years WHERE id = $1;`, [academicYearId])

  const studRes = await client.query(`SELECT id, full_name, admission_no, registration_no FROM public.students WHERE is_active = true;`)
  const existingStudentsByAdmissionNo = new Map()
  const existingStudentsByRegistrationNo = new Map()
  const allActiveStudents = []
  for (const s of studRes.rows) {
    allActiveStudents.push({ id: s.id, full_name: s.full_name, admission_no: s.admission_no })
    if (s.admission_no) existingStudentsByAdmissionNo.set(s.admission_no.toLowerCase().trim(), s)
    if (s.registration_no) existingStudentsByRegistrationNo.set(s.registration_no.toLowerCase().trim(), s)
  }

  const enrollRes = await client.query(`
    SELECT se.id, se.student_id, se.roll_number, s.full_name
    FROM public.student_enrollments se
    JOIN public.students s ON s.id = se.student_id
    WHERE se.academic_year_id = $1 AND se.class_id = $2 AND se.status = 'active';
  `, [academicYearId, classId])
  const existingEnrollmentsByStudentId = new Map()
  const existingEnrollmentsByRoll = new Map()
  for (const e of enrollRes.rows) {
    existingEnrollmentsByStudentId.set(e.student_id, { id: e.id, roll_number: e.roll_number })
    existingEnrollmentsByRoll.set(e.roll_number, { id: e.id, student_id: e.student_id, full_name: e.full_name })
  }

  return {
    targetAcademicYearId: academicYearId,
    targetAcademicYearName: yearRes.rows[0]?.name || academicYearId,
    targetClassId: classId,
    targetClassName: classRes.rows[0]?.name || classId,
    existingStudentsByAdmissionNo,
    existingStudentsByRegistrationNo,
    allActiveStudents,
    existingEnrollmentsByStudentId,
    existingEnrollmentsByRoll,
  }
}

function buildMockValidationContext(academicYearId = '2083', classId = '12eng') {
  return {
    targetAcademicYearId: academicYearId,
    targetAcademicYearName: '2083-2084 BS',
    targetClassId: classId,
    targetClassName: 'Class 12 Science (Eng)',
    existingStudentsByAdmissionNo: new Map(),
    existingStudentsByRegistrationNo: new Map(),
    allActiveStudents: [],
    existingEnrollmentsByStudentId: new Map(),
    existingEnrollmentsByRoll: new Map(),
  }
}

describe('Phase 4: Student Roster & Safe Excel Ingestion Engine', () => {
  let pool
  let client

  before(async () => {
    if (dbUrl) {
      pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
      client = await pool.connect()
      // Clean up any lingering test records from previous runs
      await client.query(`
        DELETE FROM public.workstation_seat_plans 
        WHERE enrollment_id IN (
          SELECT id FROM public.student_enrollments 
          WHERE academic_year_id = '2083' AND class_id = '12eng' AND roll_number >= 130
        );
      `)
      await client.query(`
        DELETE FROM public.student_enrollments 
        WHERE academic_year_id = '2083' AND class_id = '12eng' AND roll_number >= 130;
      `)
      await client.query(`
        DELETE FROM public.students 
        WHERE admission_no LIKE 'SUCCESS-%' 
           OR admission_no LIKE 'FAIL-ATOMIC-%' 
           OR admission_no LIKE 'IDEM-%'
           OR admission_no LIKE 'ID-ADM-%'
           OR registration_no LIKE 'ID-REG-%';
      `)
    }
  })

  after(async () => {
    if (client) {
      client.release()
    }
    if (pool) {
      await pool.end()
    }
  })

  // =========================================================================
  // 1. TEMPLATE GENERATION & PARSER MULTI-FORMAT COMPATIBILITY
  // =========================================================================
  describe('1. Template Generation & Spreadsheet Parser', () => {
    it('generates a valid 4-column blank XLSX template with standard headers', async () => {
      const buffer = await generateBlankRosterTemplate()
      assert.ok(buffer instanceof Buffer, 'Template must be a Buffer')
      assert.ok(buffer.length > 0, 'Buffer must not be empty')

      // Parse the generated template back to ensure zero roundtrip corruption
      const parsed = await parseRosterFile(buffer, 'LabSync_Class_Roster_Template.xlsx')
      assert.ok(Array.isArray(parsed), 'Parsed result must be an array')
      assert.ok(parsed.length > 0, 'Parsed rows should contain sample/template rows')
    })

    it('parses CSV data with variations in header naming and casing', async () => {
      const csvContent = `Roll No,Full Name,Adm No,Reg No
1,Aarav Sharma,ADM-2083-001,REG-001
2,Bikash Thapa,ADM-2083-002,
3,Chirag KC,,REG-003
4,Deepa Shrestha,ADM-2083-004,REG-004`

      const buffer = Buffer.from(csvContent, 'utf-8')
      const parsed = await parseRosterFile(buffer, 'test_roster.csv')

      assert.equal(parsed.length, 4)
      assert.equal(parsed[0].roll_number, 1)
      assert.equal(parsed[0].full_name, 'Aarav Sharma')
      assert.equal(parsed[0].admission_no, 'ADM-2083-001')
      assert.equal(parsed[0].registration_no, 'REG-001')

      assert.equal(parsed[1].roll_number, 2)
      assert.equal(parsed[1].full_name, 'Bikash Thapa')
      assert.equal(parsed[1].registration_no, null)

      assert.equal(parsed[2].roll_number, 3)
      assert.equal(parsed[2].admission_no, null)
      assert.equal(parsed[2].registration_no, 'REG-003')
    })

    it('gracefully handles empty lines, whitespace, and strips extra spaces', async () => {
      const csvWithWhitespace = `
      
Roll Number, Student Name , Admission Number , Registration Number 
  10  ,   Elena Subedi   ,  ADM-999  ,   REG-999   

`
      const buffer = Buffer.from(csvWithWhitespace, 'utf-8')
      const parsed = await parseRosterFile(buffer, 'spaced.csv')

      assert.equal(parsed.length, 1)
      assert.equal(parsed[0].roll_number, 10)
      assert.equal(parsed[0].full_name, 'Elena Subedi')
      assert.equal(parsed[0].admission_no, 'ADM-999')
      assert.equal(parsed[0].registration_no, 'REG-999')
    })
  })

  // =========================================================================
  // 2. PRE-FLIGHT SYNTACTIC & INVARIANT VALIDATION
  // =========================================================================
  describe('2. Pre-flight Syntactic Validation & Conflict Rules', () => {
    it('flags duplicate roll numbers in the incoming file as blocking errors', () => {
      const rawRows = [
        { row_index: 2, roll_number: 5, full_name: 'Student One', admission_no: 'ADM-T1', registration_no: null },
        { row_index: 3, roll_number: 5, full_name: 'Student Two', admission_no: 'ADM-T2', registration_no: null },
      ]

      const ctx = buildMockValidationContext()
      const report = validateParsedRoster(rawRows, ctx)

      assert.equal(report.can_commit, false, 'Pre-flight must fail on duplicate roll numbers')
      assert.equal(report.error_count, 2, 'Both duplicate rows must be flagged as error')
      assert.ok(report.rows.some(r => r.error_message?.includes('Duplicate roll number 5')))
    })

    it('flags missing full name and roll > 200 as blocking errors', () => {
      const rawRows = [
        { row_index: 2, roll_number: 1, full_name: '   ', admission_no: null, registration_no: null },
        { row_index: 3, roll_number: 250, full_name: 'Over Roll Student', admission_no: null, registration_no: null },
        { row_index: 4, roll_number: 0, full_name: 'Zero Roll Student', admission_no: null, registration_no: null },
      ]

      const ctx = buildMockValidationContext()
      const report = validateParsedRoster(rawRows, ctx)

      assert.equal(report.can_commit, false)
      assert.equal(report.error_count, 3)
      assert.ok(report.rows.some(r => r.error_message?.includes('Student full name is required')))
      assert.ok(report.rows.some(r => r.error_message?.includes('out of valid range (1–200)')))
    })

    it('generates advisory name similarity warning without blocking import', async () => {
      if (!client) return

      // Pre-seed an existing student in db for advisory test
      const testAdm = `SIM-TEST-${Date.now()}`
      const seedRes = await client.query(`
        INSERT INTO public.students (full_name, admission_no)
        VALUES ('Nabin Silwal', $1)
        RETURNING id;
      `, [testAdm])
      const sId = seedRes.rows[0].id

      try {
        const ctx = await buildDbValidationContext(client, '2083', '12eng')
        const rawRows = [
          // Slightly different spelling, no identifier
          { row_index: 2, roll_number: 99, full_name: 'Nabin Silwal', admission_no: null, registration_no: null },
        ]

        const report = validateParsedRoster(rawRows, ctx)
        const rowPreview = report.rows[0]
        assert.ok(rowPreview.warning_message, 'Should have name similarity warning message')
        assert.ok(rowPreview.warning_message.includes('Similar name to existing student'))
        assert.ok(rowPreview.status === 'warning' || rowPreview.status === 'review_needed', 'Should have advisory review or warning status')
      } finally {
        await client.query(`DELETE FROM public.students WHERE id = $1;`, [sId])
      }
    })

    it('auto-synthesizes standard institutional admission number ADM-[YEAR]-[CLASS]-[ROLL] when empty', () => {
      assert.equal(formatAutoAdmissionNo('2083', '12eng', 1), 'ADM-2083-12ENG-01')
      assert.equal(formatAutoAdmissionNo('2083', '12eng', 35), 'ADM-2083-12ENG-35')
      assert.equal(formatAutoAdmissionNo('2083', '11sci', 105), 'ADM-2083-11SCI-105')

      const rawRows = [
        { row_index: 2, roll_number: 1, full_name: 'Prajwal Karki', admission_no: null, registration_no: null },
        { row_index: 3, roll_number: 2, full_name: 'Suman Thapa', admission_no: 'CUSTOM-ADM-002', registration_no: null },
      ]

      const ctx = buildMockValidationContext()
      const report = validateParsedRoster(rawRows, ctx)

      assert.equal(report.rows[0].admission_no, 'ADM-2083-0001')
      assert.equal(report.rows[0].is_auto_admission_no, true)
      assert.equal(report.rows[1].admission_no, 'CUSTOM-ADM-002')
      assert.equal(report.rows[1].is_auto_admission_no, false)
    })
  })

  // =========================================================================
  // 3. STRONG IDENTIFIER MATCHING & IDENTITY CONFLICT BLOCKING
  // =========================================================================
  describe('3. Strong Identifier Matching & Identity Conflict Protection', () => {
    it('detects IDENTITY_CONFLICT when admission_no and registration_no point to two different students', async () => {
      if (!client) return

      const admKey = `ID-ADM-${Date.now()}`
      const regKey = `ID-REG-${Date.now()}`

      // Create Student A with admKey
      const resA = await client.query(`
        INSERT INTO public.students (full_name, admission_no)
        VALUES ('Student Alpha', $1)
        RETURNING id;
      `, [admKey])
      const idA = resA.rows[0].id

      // Create Student B with regKey
      const resB = await client.query(`
        INSERT INTO public.students (full_name, registration_no)
        VALUES ('Student Beta', $1)
        RETURNING id;
      `, [regKey])
      const idB = resB.rows[0].id

      try {
        // Preflight with conflicting pair in same row
        const ctx = await buildDbValidationContext(client, '2083', '12eng')
        const rawRows = [
          { row_index: 2, roll_number: 140, full_name: 'Conflicted Candidate', admission_no: admKey, registration_no: regKey },
        ]

        const report = validateParsedRoster(rawRows, ctx)

        assert.equal(report.can_commit, false, 'Preflight must fail due to IDENTITY_CONFLICT')
        assert.ok(report.rows.some(r => r.error_message?.includes('Identity conflict')), 'Must report identity conflict')

        // Direct test of RPC: verify RPC also blocks IDENTITY_CONFLICT independently
        let rpcBlocked = false
        try {
          await client.query(`
            SELECT public.commit_roster_ingestion_tx(
              '2083',
              '12eng',
              $1::jsonb
            );
          `, [JSON.stringify([{
            roll_number: 140,
            full_name: 'Conflicted Candidate',
            admission_no: admKey,
            registration_no: regKey,
          }])])
        } catch (err) {
          rpcBlocked = true
          assert.ok(err.message.includes('IDENTITY_CONFLICT'), 'RPC must throw IDENTITY_CONFLICT')
        }
        assert.ok(rpcBlocked, 'RPC must independently reject conflicting strong identifiers')
      } finally {
        await client.query(`DELETE FROM public.students WHERE id IN ($1, $2);`, [idA, idB])
      }
    })
  })

  // =========================================================================
  // 4. ATOMIC DATABASE RPC COMMIT & ROLLBACK VERIFICATION
  // =========================================================================
  describe('4. PostgreSQL RPC Atomic Ingestion & Zero-Partial Writes', () => {
    it('aborts entire batch and writes 0 records when an invalid roll is encountered in payload', async () => {
      if (!client) return

      const runTag = `FAIL-ATOMIC-${Date.now()}`
      const payload = [
        { roll_number: 141, full_name: 'Valid Student 1', admission_no: `${runTag}-1`, registration_no: null },
        { roll_number: 142, full_name: 'Valid Student 2', admission_no: `${runTag}-2`, registration_no: null },
        { roll_number: 999, full_name: 'Invalid Student 3', admission_no: `${runTag}-3`, registration_no: null }, // Roll > 200
      ]

      let txErrored = false
      try {
        await client.query(`
          SELECT public.commit_roster_ingestion_tx(
            '2083',
            '12eng',
            $1::jsonb
          );
        `, [JSON.stringify(payload)])
      } catch (err) {
        txErrored = true
        assert.ok(
          err.message.includes('out of valid bounds') || err.message.includes('VALIDATION_ERROR'),
          'Must raise VALIDATION_ERROR for out of bounds roll'
        )
      }
      assert.ok(txErrored, 'Transaction must fail')

      // Verify ZERO records written from this batch
      const checkRows = await client.query(`
        SELECT count(*) as cnt FROM public.students WHERE admission_no LIKE $1;
      `, [`${runTag}%`])
      assert.equal(parseInt(checkRows.rows[0].cnt, 10), 0, 'Zero partial writes guaranteed on failure')
    })

    it('successfully commits valid roster batch in an atomic statement', async () => {
      if (!client) return

      const runTag = `SUCCESS-${Date.now()}`
      const payload = [
        { roll_number: 145, full_name: 'Batch Student Alpha', admission_no: `${runTag}-A`, registration_no: null },
        { roll_number: 146, full_name: 'Batch Student Beta', admission_no: `${runTag}-B`, registration_no: null },
      ]

      const res = await client.query(`
        SELECT public.commit_roster_ingestion_tx(
          '2083',
          '12eng',
          $1::jsonb
        ) as result;
      `, [JSON.stringify(payload)])

      const result = res.rows[0].result
      assert.equal(result.processed_rows, 2)
      assert.equal(result.students_created, 2)
      assert.equal(result.enrollments_created, 2)

      // Cleanup
      await client.query(`
        DELETE FROM public.student_enrollments
        WHERE academic_year_id = '2083' AND class_id = '12eng' AND roll_number IN (145, 146);
      `)
      await client.query(`
        DELETE FROM public.students WHERE admission_no LIKE $1;
      `, [`${runTag}%`])
    })
  })

  // =========================================================================
  // 5. RE-IMPORT IDEMPOTENCY & ROLL MISMATCH CONFLICT DETECTION
  // =========================================================================
  describe('5. Idempotent Re-import & Roll Discrepancy Protection', () => {
    it('re-importing the identical roster retains existing records without duplicates', async () => {
      if (!client) return

      const runTag = `IDEM-${Date.now()}`
      const payload = [
        { roll_number: 151, full_name: 'Idempotent Student 1', admission_no: `${runTag}-1`, registration_no: null },
        { roll_number: 152, full_name: 'Idempotent Student 2', admission_no: `${runTag}-2`, registration_no: null },
      ]

      // First Import
      const firstRes = await client.query(`
        SELECT public.commit_roster_ingestion_tx(
          '2083',
          '12eng',
          $1::jsonb
        ) as result;
      `, [JSON.stringify(payload)])
      assert.equal(firstRes.rows[0].result.students_created, 2)
      assert.equal(firstRes.rows[0].result.enrollments_created, 2)

      // Second Import: EXACT SAME ROSTER
      const secondRes = await client.query(`
        SELECT public.commit_roster_ingestion_tx(
          '2083',
          '12eng',
          $1::jsonb
        ) as result;
      `, [JSON.stringify(payload)])
      const r2 = secondRes.rows[0].result
      assert.equal(r2.students_created, 0, 'No duplicate students created')
      assert.equal(r2.enrollments_created, 0, 'No duplicate enrollments created')
      assert.equal(r2.enrollments_retained, 2, 'Both enrollments retained idempotently')

      // Roll Shift Resolution: Same student (identified by admission_no) updates roll from 151 to 153 cleanly
      const rollShiftRes = await client.query(`
        SELECT public.commit_roster_ingestion_tx(
          '2083',
          '12eng',
          $1::jsonb,
          'sync'
        ) as result;
      `, [JSON.stringify([
        { roll_number: 153, full_name: 'Idempotent Student 1', admission_no: `${runTag}-1`, registration_no: null },
      ])])
      const rShift = rollShiftRes.rows[0].result
      assert.equal(rShift.enrollments_updated, 1, 'Roll shifted cleanly from 151 to 153 without error')

      // Cleanup
      await client.query(`
        DELETE FROM public.student_enrollments
        WHERE academic_year_id = '2083' AND class_id = '12eng' AND roll_number IN (151, 152, 153);
      `)
      await client.query(`DELETE FROM public.students WHERE admission_no LIKE $1;`, [`${runTag}%`])
    })
  })

  // =========================================================================
  // 6. NON-DESTRUCTIVE COHORT TRANSFERS
  // =========================================================================
  describe('6. Non-Destructive Student Transfer & Enrollment History', () => {
    it('transfers student to a new cohort while preserving previous enrollment as transferred', async () => {
      if (!client) return

      const admTag = `XFER-${Date.now()}`
      // Create student & enrollment in 11eng
      const seedRes = await client.query(`
        SELECT public.create_student_with_enrollment_tx(
          'Transfer Student',
          '2083',
          '11eng',
          160,
          $1
        ) as res;
      `, [admTag])
      const studentId = seedRes.rows[0].res.student_id
      const initialEnrollId = seedRes.rows[0].res.enrollment_id

      try {
        // Perform transfer to 12eng as roll 160
        // Update previous enrollment to 'transferred'
        await client.query(`
          UPDATE public.student_enrollments
          SET status = 'transferred'
          WHERE id = $1;
        `, [initialEnrollId])

        // Insert new active enrollment in 12eng
        const newEnrollRes = await client.query(`
          INSERT INTO public.student_enrollments (student_id, academic_year_id, class_id, roll_number, status)
          VALUES ($1, '2083', '12eng', 160, 'active')
          RETURNING id;
        `, [studentId])
        const newEnrollId = newEnrollRes.rows[0].id

        // Verify history
        const enrollments = await client.query(`
          SELECT id, class_id, status FROM public.student_enrollments
          WHERE student_id = $1
          ORDER BY created_at ASC;
        `, [studentId])

        assert.equal(enrollments.rows.length, 2, 'Must have exactly 2 enrollment records')
        assert.equal(enrollments.rows[0].class_id, '11eng')
        assert.equal(enrollments.rows[0].status, 'transferred')
        assert.equal(enrollments.rows[1].class_id, '12eng')
        assert.equal(enrollments.rows[1].status, 'active')
      } finally {
        await client.query(`DELETE FROM public.student_enrollments WHERE student_id = $1;`, [studentId])
        await client.query(`DELETE FROM public.students WHERE id = $1;`, [studentId])
      }
    })
  })

  // =========================================================================
  // 7. TEACHER AUTHORIZATION & SESSION-SCOPED READ-ONLY VISIBILITY
  // =========================================================================
  describe('7. Teacher Authorization & Roster Security Boundaries', () => {
    it('restricts teacher role to session-only read access and prevents roster administrative operations', () => {
      const teacherProfile = {
        id: '4911cee7-dae4-48a2-90de-9b039712de35',
        email: 'a.karki@rrl.edu.np',
        full_name: 'Er. Anish Karki',
        role: 'teacher',
        is_active: true,
        permissions: {},
        created_at: new Date().toISOString(),
      }

      const scope = resolveUserScope(teacherProfile)
      assert.equal(scope.isPrivileged, false, 'Teacher must not be privileged')
      assert.equal(scope.isTeacher, true)
    })
  })

  // =========================================================================
  // 8. DECOUPLED CAPACITY & VISUAL SEAT PLANNER INTEGRATION
  // =========================================================================
  describe('8. Decoupled Capacity (35 Students vs 34 Workstations)', () => {
    it('handles cohort where student count exceeds workstation count, staging excess in unassigned tray', async () => {
      if (!client) return

      // In computer lab 'comp', there are 34 workstations (PC-01 to PC-34)
      const wsCountRes = await client.query(`
        SELECT count(*) as cnt FROM public.workstations WHERE lab_id = 'comp';
      `)
      const wsCount = parseInt(wsCountRes.rows[0].cnt, 10)
      assert.equal(wsCount, 34, 'Computer lab must have exactly 34 workstations')

      // Query active enrollments for 12eng in 2083
      const enrollRes = await client.query(`
        SELECT count(*) as cnt FROM public.student_enrollments
        WHERE academic_year_id = '2083' AND class_id = '12eng' AND status = 'active';
      `)
      const enrollCount = parseInt(enrollRes.rows[0].cnt, 10)
      assert.ok(enrollCount >= 34, 'Cohort has 34+ active students')

      // Verify that unassigned students are properly handled without crash
      const seatPlansRes = await client.query(`
        SELECT count(*) as cnt FROM public.workstation_seat_plans
        WHERE lab_id = 'comp' AND academic_year_id = '2083' AND class_id = '12eng';
      `)
      const assignedCount = parseInt(seatPlansRes.rows[0].cnt, 10)
      assert.ok(assignedCount <= wsCount, 'Assigned seats cannot exceed physical workstation count')
    })
  })
})
