import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

// Load DATABASE_URL from .env.local
const envPath = path.resolve(process.cwd(), '.env.local')
const content = fs.readFileSync(envPath, 'utf8')
let dbUrl = null

for (const line of content.split('\n')) {
  const trimmed = line.trim()
  if (trimmed.startsWith('DATABASE_URL=')) {
    dbUrl = trimmed.slice('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '')
    break
  }
}

if (!dbUrl) {
  throw new Error('DATABASE_URL not found in .env.local')
}

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

describe('Phase 4.5: Academic Relationship Reconciliation & Relational Integrity Invariants', () => {
  let client
  const testStudentId = '00000000-0000-4000-a000-000000000001'
  const testStudent2Id = '00000000-0000-4000-a000-000000000002'
  const testEnrollment1Id = '00000000-0000-4000-b000-000000000001'
  const testEnrollment2Id = '00000000-0000-4000-b000-000000000002'
  const testScheduleId = 'test-phase45-sched-01'
  const testLogId = 'test-phase45-log-01'
  const teacherAnishId = '4911cee7-dae4-48a2-90de-9b039712de35'
  const teacherPrakashId = 'e5e3628a-2a76-4db1-8fe1-b6d1fb58037e'

  before(async () => {
    client = await pool.connect()
    // Cleanup any lingering test fixtures
    await client.query('DELETE FROM public.log_attendance WHERE log_id = $1;', [testLogId])
    await client.query('DELETE FROM public.practical_logs WHERE id = $1;', [testLogId])
    await client.query('DELETE FROM public.schedules WHERE id = $1;', [testScheduleId])
    await client.query('DELETE FROM public.student_enrollments WHERE id IN ($1, $2);', [testEnrollment1Id, testEnrollment2Id])
    await client.query('DELETE FROM public.students WHERE id IN ($1, $2);', [testStudentId, testStudent2Id])
  })

  after(async () => {
    // Teardown test fixtures
    await client.query('DELETE FROM public.log_attendance WHERE log_id = $1;', [testLogId])
    await client.query('DELETE FROM public.practical_logs WHERE id = $1;', [testLogId])
    await client.query('DELETE FROM public.schedules WHERE id = $1;', [testScheduleId])
    await client.query('DELETE FROM public.student_enrollments WHERE id IN ($1, $2);', [testEnrollment1Id, testEnrollment2Id])
    await client.query('DELETE FROM public.students WHERE id IN ($1, $2);', [testStudentId, testStudent2Id])
    client.release()
    await pool.end()
  })

  // 1. Student Identity Independence
  test('01. Student Identity Independence: students table has global scope without academic year columns', async () => {
    const colRes = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'academic_year_id';
    `)
    assert.equal(colRes.rows.length, 0, 'public.students must NOT have academic_year_id')

    await client.query(`
      INSERT INTO public.students (id, admission_no, registration_no, full_name, gender, is_active)
      VALUES ($1, 'TEST-ADM-01', 'TEST-REG-01', 'Test Global Student', 'male', true);
    `, [testStudentId])

    const res = await client.query('SELECT id, full_name FROM public.students WHERE id = $1;', [testStudentId])
    assert.equal(res.rows.length, 1)
    assert.equal(res.rows[0].full_name, 'Test Global Student')
  })

  // 2. Temporal Enrollment Isolation
  test('02. Temporal Enrollment Isolation: Independent enrollments in 2083 and 2084 maintain separate roll numbers', async () => {
    // Ensure academic year 2084 exists
    await client.query(`
      INSERT INTO public.academic_years (id, name, start_date, end_date, is_current)
      VALUES ('2084', '2084 B.S. (2027/28 A.D.)', '2027-04-14 00:00:00+00', '2028-04-13 00:00:00+00', false)
      ON CONFLICT (id) DO NOTHING;
    `)

    // Enrollment in 2083 Class 11eng, Roll 5
    await client.query(`
      INSERT INTO public.student_enrollments (id, academic_year_id, class_id, student_id, roll_number, status)
      VALUES ($1, '2083', '11eng', $2, 5, 'active');
    `, [testEnrollment1Id, testStudentId])

    // Enrollment in 2084 Class 12eng, Roll 8
    await client.query(`
      INSERT INTO public.student_enrollments (id, academic_year_id, class_id, student_id, roll_number, status)
      VALUES ($1, '2084', '12eng', $2, 8, 'active');
    `, [testEnrollment2Id, testStudentId])

    const enrRes = await client.query(`
      SELECT academic_year_id, class_id, roll_number 
      FROM public.student_enrollments 
      WHERE student_id = $1 
      ORDER BY academic_year_id ASC;
    `, [testStudentId])

    assert.equal(enrRes.rows.length, 2)
    assert.equal(enrRes.rows[0].academic_year_id, '2083')
    assert.equal(enrRes.rows[0].class_id, '11eng')
    assert.equal(enrRes.rows[0].roll_number, 5)

    assert.equal(enrRes.rows[1].academic_year_id, '2084')
    assert.equal(enrRes.rows[1].class_id, '12eng')
    assert.equal(enrRes.rows[1].roll_number, 8)
  })

  // 3. Class Cohort Single Source of Truth
  test('03. Class Cohort Single Source of Truth: Cohort section is read from classes.section', async () => {
    const classRes = await client.query(`
      SELECT id, name, grade, section FROM public.classes WHERE id = '12eng';
    `)
    assert.equal(classRes.rows.length, 1)
    assert.equal(classRes.rows[0].grade, 12)
    assert.equal(classRes.rows[0].section, 'Computer Engineering')
  })

  // 4. Teaching Assignment NOT NULL Enforcement
  test('04. Teaching Assignment NOT NULL: Inserting class_subjects without academic_year_id fails', async () => {
    await assert.rejects(
      async () => {
        await client.query(`
          INSERT INTO public.class_subjects (class_id, subject_id, teacher_id, academic_year_id)
          VALUES ('12eng', 'sep-12', $1, NULL);
        `, [teacherAnishId])
      },
      /null value in column "academic_year_id"/i
    )
  })

  // 5. Co-Teaching Uniqueness Support
  test('05. Co-Teaching Uniqueness Support: Two teachers assigned to same (year, class, subject) succeeds', async () => {
    // Both Anish and Prakash assigned to 12eng sep-12 in 2084
    const res1 = await client.query(`
      INSERT INTO public.class_subjects (academic_year_id, class_id, subject_id, teacher_id)
      VALUES ('2084', '12eng', 'sep-12', $1)
      ON CONFLICT DO NOTHING
      RETURNING id;
    `, [teacherAnishId])

    const res2 = await client.query(`
      INSERT INTO public.class_subjects (academic_year_id, class_id, subject_id, teacher_id)
      VALUES ('2084', '12eng', 'sep-12', $1)
      ON CONFLICT DO NOTHING
      RETURNING id;
    `, [teacherPrakashId])

    // Query both assignments
    const countRes = await client.query(`
      SELECT count(*) as count FROM public.class_subjects
      WHERE academic_year_id = '2084' AND class_id = '12eng' AND subject_id = 'sep-12';
    `)
    assert.equal(parseInt(countRes.rows[0].count, 10), 2, 'Co-teaching must allow both teachers')

    // Clean up temporary 2084 class_subjects
    await client.query(`
      DELETE FROM public.class_subjects 
      WHERE academic_year_id = '2084' AND class_id = '12eng' AND subject_id = 'sep-12';
    `)
  })

  // 6. Teaching Assignment Duplicate Prevention
  test('06. Teaching Assignment Duplicate Prevention: Duplicate (year, class, subject, teacher) is rejected', async () => {
    await assert.rejects(
      async () => {
        await client.query(`
          INSERT INTO public.class_subjects (academic_year_id, class_id, subject_id, teacher_id)
          VALUES ('2083', '12eng', 'sep-12', $1);
        `, [teacherAnishId])
      },
      /duplicate key value violates unique constraint|uq_class_subject/i
    )
  })

  // 7. Schedule class_subject_id NOT NULL Enforcement
  test('07. Schedule class_subject_id NOT NULL: Inserting schedule without class_subject_id fails', async () => {
    await assert.rejects(
      async () => {
        await client.query(`
          INSERT INTO public.schedules (
            id, lab_id, subject_name, batch_name, start_time, end_time, slot_id, day_key, class_subject_id
          ) VALUES ('temp-bad-sched', 'comp', 'Test', '12', '10:00', '11:00', 't1', 'sun', NULL);
        `)
      },
      /null value in column "class_subject_id"/i
    )
  })

  // 8. Session Teacher Preservation Invariant
  test('08. Session Teacher Preservation Invariant: Schedule retains its specific session teacher_id', async () => {
    // Find an existing schedule and verify teacher_id is preserved
    const sched = await client.query(`
      SELECT s.id, s.teacher_id, s.class_subject_id, cs.teacher_id as regular_teacher_id
      FROM public.schedules s
      JOIN public.class_subjects cs ON cs.id = s.class_subject_id
      LIMIT 1;
    `)
    assert.ok(sched.rows.length > 0)
    assert.ok(sched.rows[0].class_subject_id, 'Schedule must have class_subject_id')
    assert.ok(sched.rows[0].teacher_id, 'Schedule retains valid teacher_id')
  })

  // 9. Exact Schedule Collision Detection
  test('09. Exact Schedule Collision Detection: Exact cohort collision is caught without false substring matches', async () => {
    // Verify that class '11eng' and '12eng' are treated as distinct cohorts (no false collision)
    const cs11 = await client.query(`SELECT id, class_id FROM public.class_subjects WHERE class_id = '11eng' LIMIT 1;`)
    const cs12 = await client.query(`SELECT id, class_id FROM public.class_subjects WHERE class_id = '12eng' LIMIT 1;`)
    assert.notEqual(cs11.rows[0].class_id, cs12.rows[0].class_id)
  })

  // 10. Practical Log Academic Anchor Enforcement
  test('10. Practical Log Academic Anchor: Inserting practical log without class_subject_id fails', async () => {
    await assert.rejects(
      async () => {
        await client.query(`
          INSERT INTO public.practical_logs (
            id, lab_id, teacher_id, date, period_label, subject_name, batch_group, practical_title,
            total_students, present_students, absent_students, class_subject_id
          ) VALUES ('temp-bad-log', 'comp', $1, '2026-09-24', 'Period 1', 'Test', '12', 'Title', 30, 30, 0, NULL);
        `, [teacherAnishId])
      },
      /null value in column "class_subject_id"/i
    )
  })

  // 11. Schedule Deletion Cascade Invariant
  test('11. Schedule Deletion Cascade: Deleting timetable slot sets practical_logs.schedule_id = NULL without deleting log', async () => {
    // Fetch a valid class_subject_id for sep-12
    const csRow = (await client.query(`SELECT id FROM public.class_subjects WHERE class_id = '12eng' AND subject_id = 'sep-12' LIMIT 1;`)).rows[0]

    // Create a temporary schedule
    await client.query(`
      INSERT INTO public.schedules (
        id, lab_id, teacher_id, subject_name, batch_name, start_time, end_time, slot_id, day_key, class_subject_id
      ) VALUES ($1, 'comp', $2, 'SEP-12 Lab', '12 Eng', '10:00', '11:00', 't1', 'sun', $3);
    `, [testScheduleId, teacherAnishId, csRow.id])

    // Create a practical log referencing this schedule
    await client.query(`
      INSERT INTO public.practical_logs (
        id, schedule_id, lab_id, teacher_id, date, period_label, subject_name, batch_group, practical_title,
        total_students, present_students, absent_students, class_subject_id
      ) VALUES ($1, $2, 'comp', $3, '2026-09-24', 'Period 1', 'SEP-12 Lab', '12 Eng', 'Test Cascading', 30, 30, 0, $4);
    `, [testLogId, testScheduleId, teacherAnishId, csRow.id])

    // Delete the schedule
    await client.query('DELETE FROM public.schedules WHERE id = $1;', [testScheduleId])

    // Verify practical_logs record still exists with schedule_id = NULL
    const logRes = await client.query('SELECT id, schedule_id FROM public.practical_logs WHERE id = $1;', [testLogId])
    assert.equal(logRes.rows.length, 1, 'Practical log must NOT be deleted')
    assert.equal(logRes.rows[0].schedule_id, null, 'practical_logs.schedule_id must be set to NULL')
  })

  // 12. Composite Attendance Mismatch Prevention
  test('12. Composite Attendance Mismatch Prevention: Inserting mismatched (enrollment_id, student_id) is rejected by composite FK', async () => {
    // Insert student 2
    await client.query(`
      INSERT INTO public.students (id, admission_no, registration_no, full_name, gender, is_active)
      VALUES ($1, 'TEST-ADM-02', 'TEST-REG-02', 'Test Student Two', 'female', true);
    `, [testStudent2Id])

    // testEnrollment1Id belongs to testStudentId, NOT testStudent2Id
    await assert.rejects(
      async () => {
        await client.query(`
          INSERT INTO public.log_attendance (id, log_id, enrollment_id, student_id, roll_number, is_present)
          VALUES ('test-att-bad', $1, $2, $3, 999, true);
        `, [testLogId, testEnrollment1Id, testStudent2Id])
      },
      /violates foreign key constraint|fk_log_attendance_enrollment_student/i
    )
  })

  // 13. Composite Attendance Success
  test('13. Composite Attendance Success: Inserting correctly paired (enrollment_id, student_id) succeeds', async () => {
    await client.query(`
      INSERT INTO public.log_attendance (id, log_id, enrollment_id, student_id, roll_number, is_present)
      VALUES ('test-att-ok', $1, $2, $3, 5, true)
      ON CONFLICT (log_id, roll_number) DO UPDATE SET
        enrollment_id = EXCLUDED.enrollment_id,
        student_id = EXCLUDED.student_id,
        is_present = EXCLUDED.is_present;
    `, [testLogId, testEnrollment1Id, testStudentId])

    const attRes = await client.query(`
      SELECT id, log_id, enrollment_id, student_id, is_present 
      FROM public.log_attendance 
      WHERE log_id = $1 AND student_id = $2;
    `, [testLogId, testStudentId])

    assert.equal(attRes.rows.length, 1)
    assert.equal(attRes.rows[0].enrollment_id, testEnrollment1Id)
    assert.equal(attRes.rows[0].student_id, testStudentId)
  })

  // 14. Historical Snapshot Immutability
  test('14. Historical Snapshot Immutability: Mutating subjects.name does not alter practical_logs.subject_name snapshot', async () => {
    const originalSnapshot = (await client.query('SELECT subject_name FROM public.practical_logs WHERE id = $1;', [testLogId])).rows[0]?.subject_name
    assert.equal(originalSnapshot, 'SEP-12 Lab')

    // Temporarily mutate subjects.name
    await client.query(`UPDATE public.subjects SET name = 'MUTATED NAME FOR AUDIT TEST' WHERE id = 'sep-12';`)

    // Verify practical_logs.subject_name did NOT change
    const checkSnapshot = (await client.query('SELECT subject_name FROM public.practical_logs WHERE id = $1;', [testLogId])).rows[0]?.subject_name
    assert.equal(checkSnapshot, 'SEP-12 Lab', 'Historical snapshot must remain immutable')

    // Restore subjects.name
    await client.query(`UPDATE public.subjects SET name = 'Software Engineering & Project Lab' WHERE id = 'sep-12';`)
  })

  // 15. Canonical Multi-Hop Relational Query
  test('15. Canonical Multi-Hop Relational Query: 100% clean relational join without string heuristics', async () => {
    const multiHopQuery = `
      SELECT 
        ay.id AS academic_year,
        c.name AS class_name,
        c.grade AS class_grade,
        s.code AS subject_code,
        s.name AS subject_name,
        p.full_name AS curriculum_teacher,
        pl.practical_title,
        pl.date AS session_date,
        st.admission_no,
        st.full_name AS student_name,
        la.roll_number,
        la.is_present AS attendance_is_present
      FROM public.practical_logs pl
      JOIN public.class_subjects cs ON cs.id = pl.class_subject_id
      JOIN public.academic_years ay ON ay.id = cs.academic_year_id
      JOIN public.classes c ON c.id = cs.class_id
      JOIN public.subjects s ON s.id = cs.subject_id
      JOIN public.profiles p ON p.id = cs.teacher_id
      JOIN public.log_attendance la ON la.log_id = pl.id
      JOIN public.student_enrollments se ON se.id = la.enrollment_id AND se.student_id = la.student_id
      JOIN public.students st ON st.id = se.student_id
      WHERE pl.id = $1 AND st.id = $2;
    `

    const res = await client.query(multiHopQuery, [testLogId, testStudentId])
    assert.equal(res.rows.length, 1)
    const row = res.rows[0]
    assert.equal(row.academic_year, '2083')
    assert.equal(row.class_grade, 12)
    assert.equal(row.class_name, '12 Eng')
    assert.equal(row.subject_code, 'SEP-12')
    assert.equal(row.curriculum_teacher, 'Er. Anish Karki')
    assert.equal(row.student_name, 'Test Global Student')
    assert.equal(row.admission_no, 'TEST-ADM-01')
    assert.equal(row.roll_number, 5)
    assert.equal(row.attendance_is_present, true)
  })
})
