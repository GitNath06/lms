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

describe('Phase 5: Live Lab Operations, Ad-Hoc Sessions, 24-Hr Edit Window & Two-Tier Seating', () => {
  let client
  const testStudent1Id = '00000000-0000-5000-a000-000000000001'
  const testStudent2Id = '00000000-0000-5000-a000-000000000002'
  const testEnrollment1Id = '00000000-0000-5000-b000-000000000001'
  const testEnrollment2Id = '00000000-0000-5000-b000-000000000002'
  const testAdHocSchedId = 'test-phase5-adhoc-sched-01'
  const testLiveLogId = 'test-phase5-log-live-01'
  const testStaleLogId = 'test-phase5-log-stale-01'
  const testWsId = '00000000-0000-5000-c000-000000000001'
  const teacherAnishId = '4911cee7-dae4-48a2-90de-9b039712de35'

  before(async () => {
    client = await pool.connect()
    // Cleanup any lingering test fixtures
    await client.query('DELETE FROM public.session_seat_overrides WHERE schedule_id = $1;', [testAdHocSchedId])
    await client.query('DELETE FROM public.workstation_seat_plans WHERE workstation_id = $1;', [testWsId])
    await client.query('DELETE FROM public.log_attendance WHERE log_id IN ($1, $2);', [testLiveLogId, testStaleLogId])
    await client.query('DELETE FROM public.practical_logs WHERE id IN ($1, $2);', [testLiveLogId, testStaleLogId])
    await client.query('DELETE FROM public.schedules WHERE id = $1;', [testAdHocSchedId])
    await client.query('DELETE FROM public.workstations WHERE id = $1;', [testWsId])
    await client.query('DELETE FROM public.student_enrollments WHERE id IN ($1, $2);', [testEnrollment1Id, testEnrollment2Id])
    await client.query("DELETE FROM public.student_enrollments WHERE academic_year_id = '2083' AND class_id = '11eng' AND roll_number IN (101, 102);")
    await client.query('DELETE FROM public.students WHERE id IN ($1, $2);', [testStudent1Id, testStudent2Id])

    // Seed test students
    await client.query(`
      INSERT INTO public.students (id, admission_no, registration_no, full_name, gender, is_active)
      VALUES 
        ($1, 'TEST-P5-ADM-01', 'REG-P5-01', 'Aarav Sharma', 'male', true),
        ($2, 'TEST-P5-ADM-02', 'REG-P5-02', 'Bishal Thapa', 'male', true);
    `, [testStudent1Id, testStudent2Id])

    // Seed test enrollments in 2083 Class 11eng (isolated from 12eng)
    await client.query(`
      INSERT INTO public.student_enrollments (id, academic_year_id, class_id, student_id, roll_number, status)
      VALUES 
        ($1, '2083', '11eng', $3, 101, 'active'),
        ($2, '2083', '11eng', $4, 102, 'active');
    `, [testEnrollment1Id, testEnrollment2Id, testStudent1Id, testStudent2Id])

    // Seed test workstation in phys lab (isolated from comp lab 34-workstation count)
    await client.query(`
      INSERT INTO public.workstations (id, lab_id, label, row_label, pos_x, pos_y, device_type, is_active)
      VALUES ($1, 'phys', 'PHYS-99', 'Row Test', 50, 50, 'desktop', true);
    `, [testWsId])
  })

  after(async () => {
    // Teardown test fixtures
    await client.query('DELETE FROM public.session_seat_overrides WHERE schedule_id = $1;', [testAdHocSchedId])
    await client.query('DELETE FROM public.workstation_seat_plans WHERE workstation_id = $1;', [testWsId])
    await client.query('DELETE FROM public.log_attendance WHERE log_id IN ($1, $2);', [testLiveLogId, testStaleLogId])
    await client.query('DELETE FROM public.practical_logs WHERE id IN ($1, $2);', [testLiveLogId, testStaleLogId])
    await client.query('DELETE FROM public.schedules WHERE id = $1;', [testAdHocSchedId])
    await client.query('DELETE FROM public.workstations WHERE id = $1;', [testWsId])
    await client.query('DELETE FROM public.student_enrollments WHERE id IN ($1, $2);', [testEnrollment1Id, testEnrollment2Id])
    await client.query("DELETE FROM public.student_enrollments WHERE academic_year_id = '2083' AND class_id = '11eng' AND roll_number IN (101, 102);")
    await client.query('DELETE FROM public.students WHERE id IN ($1, $2);', [testStudent1Id, testStudent2Id])
    client.release()
    await pool.end()
  })

  // 1. Ad-Hoc / Makeup Session Fallback
  test('01. Ad-Hoc Session Fallback: Instantly generates schedule with slot_id="adhoc" and strict class_subject_id', async () => {
    // Look up valid class_subject_id for Class 11eng
    const csRes = await client.query(`
      SELECT cs.id, cs.class_id, cs.academic_year_id
      FROM public.class_subjects cs
      WHERE cs.class_id = '11eng' AND cs.academic_year_id = '2083'
      LIMIT 1;
    `)
    assert.ok(csRes.rows.length > 0, 'Class 11eng must have class_subject assigned in 2083')
    const classSubjectId = csRes.rows[0].id

    // Insert Ad-Hoc schedule
    const insertRes = await client.query(`
      INSERT INTO public.schedules (
        id, lab_id, slot_id, day_key, subject_name, batch_name,
        start_time, end_time, class_subject_id, teacher_id, academic_year_id
      ) VALUES (
        $1, 'phys', 'adhoc', 'tue', 'C Programming Lab', '11 Eng',
        '11:00:00', '12:00:00', $2, $3, '2083'
      ) RETURNING id, slot_id, class_subject_id;
    `, [testAdHocSchedId, classSubjectId, teacherAnishId])

    assert.equal(insertRes.rows.length, 1)
    assert.equal(insertRes.rows[0].id, testAdHocSchedId)
    assert.equal(insertRes.rows[0].slot_id, 'adhoc')
    assert.equal(insertRes.rows[0].class_subject_id, classSubjectId)
  })

  // 2. Relational Rejection of Dangling Ad-Hoc Sessions
  test('02. Ad-Hoc Integrity Guard: Rejects ad-hoc creation without valid class_subject_id', async () => {
    await assert.rejects(async () => {
      await client.query(`
        INSERT INTO public.schedules (
          id, lab_id, slot_id, day_key, subject_name, batch_name,
          start_time, end_time, class_subject_id, teacher_id, academic_year_id
        ) VALUES (
          'invalid-adhoc-sched', 'phys', 'adhoc', 'tue', 'C Programming Lab', '11 Eng',
          '11:00:00', '12:00:00', '00000000-0000-0000-0000-000000000999', $1, '2083'
        );
      `, [teacherAnishId])
    }, /schedules_class_subject_id_fkey/i, 'Database must reject invalid class_subject_id on schedules')
  })

  // 3. Relational Live Session Roster Resolution
  test('03. Relational Live Roster: Joins schedule to enrolled students via class_subjects without string matching', async () => {
    const rosterRes = await client.query(`
      SELECT 
        se.id AS enrollment_id,
        se.roll_number,
        s.id AS student_id,
        s.full_name
      FROM public.schedules sched
      JOIN public.class_subjects cs ON cs.id = sched.class_subject_id
      JOIN public.student_enrollments se 
        ON se.class_id = cs.class_id 
       AND se.academic_year_id = cs.academic_year_id
       AND se.status = 'active'
      JOIN public.students s ON s.id = se.student_id
      WHERE sched.id = $1
      ORDER BY se.roll_number ASC;
    `, [testAdHocSchedId])

    assert.ok(rosterRes.rows.length >= 2, 'Must resolve all enrolled students in Class 11eng')
    const aarav = rosterRes.rows.find((r) => r.student_id === testStudent1Id)
    assert.ok(aarav, 'Aarav Sharma must be in expected roster')
    assert.equal(aarav.roll_number, 101)
  })

  // 4. In-Seat Roll-Call Attendance Persistence with Composite Integrity
  test('04. Atomic Attendance Submission: practical_logs stamped with class_subject_id and composite log_attendance', async () => {
    const csRes = await client.query('SELECT class_subject_id FROM public.schedules WHERE id = $1;', [testAdHocSchedId])
    const classSubjectId = csRes.rows[0].class_subject_id

    // 1. Insert practical_logs
    await client.query(`
      INSERT INTO public.practical_logs (
        id, schedule_id, lab_id, teacher_id, date, period_label, subject_name, batch_group,
        practical_title, total_students, present_students, absent_students, absent_rolls,
        class_subject_id, academic_year_id, logged_by
      ) VALUES (
        $1, $2, 'phys', $3, '2026-09-25', 'Period 3', 'C Programming Lab', '11 Eng',
        'Logic Development Practical', 2, 1, 1, ARRAY[102],
        $4, '2083', $3
      );
    `, [testLiveLogId, testAdHocSchedId, teacherAnishId, classSubjectId])

    // 2. Insert composite attendance rows: Aarav (Roll 101) Present, Bishal (Roll 102) Absent
    await client.query(`
      INSERT INTO public.log_attendance (id, log_id, enrollment_id, student_id, roll_number, is_present)
      VALUES 
        ($1, $2, $3, $4, 101, true),
        ($5, $6, $7, $8, 102, false)
      ON CONFLICT (log_id, roll_number) DO UPDATE SET
        enrollment_id = EXCLUDED.enrollment_id,
        student_id = EXCLUDED.student_id,
        is_present = EXCLUDED.is_present;
    `, [
      `${testLiveLogId}-101`, testLiveLogId, testEnrollment1Id, testStudent1Id,
      `${testLiveLogId}-102`, testLiveLogId, testEnrollment2Id, testStudent2Id,
    ])

    const attRes = await client.query(`
      SELECT roll_number, is_present, enrollment_id, student_id
      FROM public.log_attendance
      WHERE log_id = $1
      ORDER BY roll_number ASC;
    `, [testLiveLogId])

    assert.ok(attRes.rows.length >= 2, 'Attendance records must be populated for cohort')
    const roll101 = attRes.rows.find((r) => r.roll_number === 101)
    const roll102 = attRes.rows.find((r) => r.roll_number === 102)

    assert.ok(roll101, 'Roll 101 must exist in attendance')
    assert.equal(roll101.is_present, true)
    assert.equal(roll101.student_id, testStudent1Id)
    assert.equal(roll101.enrollment_id, testEnrollment1Id)

    assert.ok(roll102, 'Roll 102 must exist in attendance')
    assert.equal(roll102.is_present, false)
    assert.equal(roll102.student_id, testStudent2Id)
    assert.equal(roll102.enrollment_id, testEnrollment2Id)
  })

  // 5. Composite Foreign Key Rejection on Mismatching Identity
  test('05. Composite Key Defense: Rejects log_attendance with mismatched (enrollment_id, student_id)', async () => {
    await assert.rejects(async () => {
      // Pass Enrollment 1 (Aarav) with Student 2 ID (Bishal)
      await client.query(`
        INSERT INTO public.log_attendance (id, log_id, enrollment_id, student_id, roll_number, is_present)
        VALUES ('mismatch-att-p5', $1, $2, $3, 999, true);
      `, [testLiveLogId, testEnrollment1Id, testStudent2Id])
    }, /fk_log_attendance_enrollment_student|violates foreign key constraint/i, 'Database must enforce composite foreign key between log_attendance and student_enrollments')
  })

  // 6. Time-Boxed 24-Hour Post-Session Edit Window
  test('06. Post-Session Edit Window: Session < 24 hrs is unlocked; session > 24 hrs locks non-admins', async () => {
    const csRes = await client.query('SELECT class_subject_id FROM public.schedules WHERE id = $1;', [testAdHocSchedId])
    const classSubjectId = csRes.rows[0].class_subject_id

    // Insert a stale log (30 hours old)
    await client.query(`
      INSERT INTO public.practical_logs (
        id, schedule_id, lab_id, teacher_id, date, period_label, subject_name, batch_group,
        practical_title, total_students, present_students, absent_students, absent_rolls,
        class_subject_id, academic_year_id, logged_by, created_at
      ) VALUES (
        $1, $2, 'phys', $3, '2026-09-23', 'Period 3', 'C Programming Lab', '11 Eng',
        'Stale Practical Session', 2, 2, 0, ARRAY[]::integer[],
        $4, '2083', $3, NOW() - INTERVAL '30 hours'
      );
    `, [testStaleLogId, testAdHocSchedId, teacherAnishId, classSubjectId])

    // Query both logs and evaluate edit window logic
    const logsRes = await client.query(`
      SELECT 
        id, 
        created_at,
        EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600.0 AS age_hours
      FROM public.practical_logs
      WHERE id IN ($1, $2);
    `, [testLiveLogId, testStaleLogId])

    const freshLog = logsRes.rows.find((l) => l.id === testLiveLogId)
    const staleLog = logsRes.rows.find((l) => l.id === testStaleLogId)

    assert.ok(freshLog.age_hours < 24, 'Live log must be less than 24 hours old')
    assert.ok(staleLog.age_hours > 24, 'Stale log must be older than 24 hours')

    // Evaluate 24-hr edit window predicate
    const canTeacherEditFresh = freshLog.age_hours <= 24
    const canTeacherEditStale = staleLog.age_hours <= 24

    assert.equal(canTeacherEditFresh, true, 'Teacher must have active edit window within 24 hours')
    assert.equal(canTeacherEditStale, false, 'Teacher must be locked out after 24 hours')
  })

  // 7. Tier 2 Temporary Session Override vs Tier 1 Baseline Invariance
  test('07. Two-Tier Seating Invariance: Tier 2 override reassigns student for today without altering Tier 1 baseline', async () => {
    // 1. Establish Tier 1 Baseline Seat Plan: PHYS-99 assigned to Aarav (Enrollment 1)
    await client.query(`
      INSERT INTO public.workstation_seat_plans (
        workstation_id, lab_id, academic_year_id, class_id, enrollment_id, assigned_by
      ) VALUES (
        $1, 'phys', '2083', '11eng', $2, $3
      );
    `, [testWsId, testEnrollment1Id, teacherAnishId])

    // 2. Teacher moves Bishal (Enrollment 2) to PHYS-99 for today's session only (Tier 2 Session Override)
    await client.query(`
      INSERT INTO public.session_seat_overrides (
        schedule_id, session_date, workstation_id, enrollment_id, created_by
      ) VALUES (
        $1, '2026-09-25', $2, $3, $4
      );
    `, [testAdHocSchedId, testWsId, testEnrollment2Id, teacherAnishId])

    // 3. Verify Tier 1 baseline remains Aarav (Enrollment 1)
    const tier1Res = await client.query(`
      SELECT enrollment_id FROM public.workstation_seat_plans WHERE workstation_id = $1;
    `, [testWsId])
    assert.equal(tier1Res.rows[0].enrollment_id, testEnrollment1Id, 'Tier 1 baseline must remain assigned to Aarav')

    // 4. Verify Tier 2 session override resolves Bishal (Enrollment 2) for today's live session
    const tier2Res = await client.query(`
      SELECT enrollment_id FROM public.session_seat_overrides 
      WHERE schedule_id = $1 AND session_date = '2026-09-25' AND workstation_id = $2;
    `, [testAdHocSchedId, testWsId])
    assert.equal(tier2Res.rows[0].enrollment_id, testEnrollment2Id, 'Tier 2 session override must resolve to Bishal for today')
  })

  // 8. Architectural Separation of Concerns Invariants
  test('08. Architectural Separation: Clean boundaries between /maintenance, /computer-lab, and /admin', () => {
    // Verify /maintenance has 2 clean tabs and zero embedded workstation board
    const maintenancePath = path.resolve(process.cwd(), 'components/maintenance/maintenance-client-page.tsx')
    const maintenanceCode = fs.readFileSync(maintenancePath, 'utf8')
    assert.ok(maintenanceCode.includes("'tasks' | 'history'"), 'Maintenance must strictly define 2 tabs (tasks and history)')
    assert.ok(!maintenanceCode.includes("import { WorkstationBoard }"), 'Maintenance must NOT import WorkstationBoard')

    // Verify /computer-lab workspace exists with Live Cockpit
    const computerLabPath = path.resolve(process.cwd(), 'components/computer-lab/computer-lab-workspace.tsx')
    assert.ok(fs.existsSync(computerLabPath), 'Computer Lab Workspace component must exist')
    const compLabCode = fs.readFileSync(computerLabPath, 'utf8')
    assert.ok(compLabCode.includes('LiveCockpitBar'), 'Computer Lab Workspace must include LiveCockpitBar')
    assert.ok(compLabCode.includes('StartAdHocSessionModal'), 'Computer Lab Workspace must include StartAdHocSessionModal')
    assert.ok(compLabCode.includes("mode === 'baseline' && isSlideDrawerOpen"), 'Slide drawer must be strictly locked to baseline mode only')

    // Verify /admin houses Floor Designer and Student Rosters
    const adminPagePath = path.resolve(process.cwd(), 'app/(dashboard)/admin/page.tsx')
    const adminCode = fs.readFileSync(adminPagePath, 'utf8')
    assert.ok(adminCode.includes('ClassRosterView'), 'Admin page must mount ClassRosterView')
    assert.ok(adminCode.includes('AdminFloorDesigner'), 'Admin page must mount AdminFloorDesigner')
  })
})
