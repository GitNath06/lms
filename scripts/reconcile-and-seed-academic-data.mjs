import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

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

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

const TARGET_ASSIGNMENTS = [
  // Class 12 Computer Engineering
  { academic_year_id: '2083', class_id: '12eng', subject_id: 'comp-12', teacher_id: '4911cee7-dae4-48a2-90de-9b039712de35', default_lab_id: 'comp', weekly_periods: 4 },
  { academic_year_id: '2083', class_id: '12eng', subject_id: 'elec-12', teacher_id: '4911cee7-dae4-48a2-90de-9b039712de35', default_lab_id: 'comp', weekly_periods: 4 },
  { academic_year_id: '2083', class_id: '12eng', subject_id: 'phy-12',  teacher_id: 'e5e3628a-2a76-4db1-8fe1-b6d1fb58037e', default_lab_id: 'phys', weekly_periods: 4 },
  { academic_year_id: '2083', class_id: '12eng', subject_id: 'chem-12', teacher_id: 'dc417f53-dfbf-4ad3-9973-52ad5988e2f6', default_lab_id: 'chem', weekly_periods: 4 },
  { academic_year_id: '2083', class_id: '12eng', subject_id: 'bio-12',  teacher_id: '24b3a681-d07b-4785-b26d-4fd506ed8bb5', default_lab_id: 'comp', weekly_periods: 4 },
  // Class 12 Management
  { academic_year_id: '2083', class_id: '12mgt', subject_id: 'comp-12', teacher_id: 'b7c832c9-4616-4eac-8402-2936caa1b948', default_lab_id: 'comp', weekly_periods: 3 },
  // Class 11 Computer Engineering
  { academic_year_id: '2083', class_id: '11eng', subject_id: 'comp-11', teacher_id: '4911cee7-dae4-48a2-90de-9b039712de35', default_lab_id: 'comp', weekly_periods: 4 },
  { academic_year_id: '2083', class_id: '11eng', subject_id: 'elec-11', teacher_id: '4911cee7-dae4-48a2-90de-9b039712de35', default_lab_id: 'comp', weekly_periods: 4 },
  { academic_year_id: '2083', class_id: '11eng', subject_id: 'phy-11',  teacher_id: 'e5e3628a-2a76-4db1-8fe1-b6d1fb58037e', default_lab_id: 'phys', weekly_periods: 4 },
  { academic_year_id: '2083', class_id: '11eng', subject_id: 'chem-11', teacher_id: 'dc417f53-dfbf-4ad3-9973-52ad5988e2f6', default_lab_id: 'chem', weekly_periods: 4 },
  { academic_year_id: '2083', class_id: '11eng', subject_id: 'bio-11',  teacher_id: '24b3a681-d07b-4785-b26d-4fd506ed8bb5', default_lab_id: 'comp', weekly_periods: 4 },
  // Class 11 Management / General Science
  { academic_year_id: '2083', class_id: '11mgt', subject_id: 'comp-11', teacher_id: 'b7c832c9-4616-4eac-8402-2936caa1b948', default_lab_id: 'comp', weekly_periods: 3 },
  // Junior Secondary Classes
  { academic_year_id: '2083', class_id: '10eng', subject_id: 'dbms-10', teacher_id: '4911cee7-dae4-48a2-90de-9b039712de35', default_lab_id: 'comp', weekly_periods: 3 },
  { academic_year_id: '2083', class_id: '9eng',  subject_id: 'wpd-9',   teacher_id: '4911cee7-dae4-48a2-90de-9b039712de35', default_lab_id: 'comp', weekly_periods: 3 },
  { academic_year_id: '2083', class_id: '8a',    subject_id: 'ict-8',   teacher_id: '4911cee7-dae4-48a2-90de-9b039712de35', default_lab_id: 'comp', weekly_periods: 2 },
  { academic_year_id: '2083', class_id: '7b',    subject_id: 'ict-7',   teacher_id: '4911cee7-dae4-48a2-90de-9b039712de35', default_lab_id: 'comp', weekly_periods: 2 },
  { academic_year_id: '2083', class_id: '6a',    subject_id: 'sci-6',   teacher_id: '4911cee7-dae4-48a2-90de-9b039712de35', default_lab_id: 'comp', weekly_periods: 2 }
]

async function run() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN;')

    console.log('=== STEP 03: SEEDING CLASS_SUBJECTS WITH CONFLICT DETECTION ===')
    const conflicts = []
    const toInsert = []
    let matchesCount = 0

    for (const item of TARGET_ASSIGNMENTS) {
      const res = await client.query(`
        SELECT id, default_lab_id 
        FROM public.class_subjects
        WHERE academic_year_id = $1 
          AND class_id = $2 
          AND subject_id = $3 
          AND teacher_id = $4;
      `, [item.academic_year_id, item.class_id, item.subject_id, item.teacher_id])

      if (res.rows.length === 0) {
        toInsert.push(item)
      } else {
        const row = res.rows[0]
        if (row.default_lab_id === item.default_lab_id) {
          matchesCount++
        } else {
          conflicts.push({ target: item, existing: row })
        }
      }
    }

    if (conflicts.length > 0) {
      fs.writeFileSync('scratch/seed-conflicts.json', JSON.stringify(conflicts, null, 2))
      throw new Error(`❌ SEED STOP-GATE: Found ${conflicts.length} conflicting class_subjects rows. See scratch/seed-conflicts.json.`)
    }

    console.log(`- Existing Identical Matches: ${matchesCount}`)
    console.log(`- New Rows to Insert: ${toInsert.length}`)

    for (const item of toInsert) {
      await client.query(`
        INSERT INTO public.class_subjects (
          academic_year_id, class_id, subject_id, teacher_id, default_lab_id
        ) VALUES ($1, $2, $3, $4, $5);
      `, [item.academic_year_id, item.class_id, item.subject_id, item.teacher_id, item.default_lab_id])
    }
    console.log('✅ class_subjects seeding complete!')

    // Fetch all live class_subjects for matching
    const allCS = await client.query(`
      SELECT cs.id, cs.academic_year_id, cs.class_id, cs.subject_id, cs.teacher_id, cs.default_lab_id,
             c.name as class_name, c.grade as class_grade,
             s.code as subject_code, s.name as subject_name
      FROM public.class_subjects cs
      JOIN public.classes c ON c.id = cs.class_id
      JOIN public.subjects s ON s.id = cs.subject_id;
    `)
    const csList = allCS.rows

    console.log('\n=== STEP 04 & 05: AMBIGUITY-SAFE SCHEDULES RECONCILIATION ===')
    const schedRes = await client.query(`
      SELECT id, lab_id, teacher_id, subject_name, batch_name, academic_year_id, class_subject_id
      FROM public.schedules
      ORDER BY id;
    `)

    const reconciliationReport = {
      totalSchedules: schedRes.rows.length,
      alreadyReconciled: 0,
      safeToUpdate: [],
      ambiguous: [],
      unresolved: []
    }

    for (const sched of schedRes.rows) {
      if (sched.class_subject_id) {
        reconciliationReport.alreadyReconciled++
        continue
      }

      const norm = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '')
      const sSubject = sched.subject_name || ''
      const sBatch = sched.batch_name || ''

      // Candidate matching logic
      const candidates = csList.filter(cs => {
        // 1. Year matching (schedules academic_year_id or '2083')
        const schedYear = sched.academic_year_id || '2083'
        if (cs.academic_year_id !== schedYear) return false

        // 2. Subject matching
        // Match code (e.g. COMP-12, PHY-12, DBMS-10, JAVA-12 -> comp-12)
        const codeNorm = cs.subject_code.toLowerCase().replace(/[^a-z0-9]/g, '')
        const subjectMatch = sSubject.toLowerCase().includes(cs.subject_code.toLowerCase()) ||
                             (cs.subject_code === 'COMP-12' && sSubject.toLowerCase().includes('java-12')) ||
                             (cs.subject_code === 'COMP-12' && sSubject.toLowerCase().includes('comp-12')) ||
                             (cs.subject_code === 'ICT-7' && sSubject.toLowerCase().includes('comp-7c'))

        if (!subjectMatch) return false

        // 3. Class matching
        // e.g. "Class 12" -> matches 12eng or 12mgt
        // If subject is comp-12 and lab is 'comp' with Data Structures, 12eng is target
        // If batch says "Class 10" -> matches 10eng
        // If batch says "Class 11" -> matches 11eng
        // If batch says "Class 7" -> matches 7b
        const gradeMatch = sBatch.includes(String(cs.class_grade))
        if (!gradeMatch) return false

        // Disambiguate Grade 12 & 11 streams by lab and subject
        if (cs.class_grade === 12) {
          if (cs.class_id === '12eng' && (sSubject.toLowerCase().includes('data structures') || sSubject.toLowerCase().includes('computer science') || sSubject.toLowerCase().includes('java') || sSubject.toLowerCase().includes('physics') || sSubject.toLowerCase().includes('titration') || sSubject.toLowerCase().includes('organic'))) {
            return true
          }
          if (cs.class_id === '12mgt' && sSubject.toLowerCase().includes('business')) {
            return true
          }
          // Default science/engineering lab sessions in physics, chem, comp
          return cs.class_id === '12eng'
        }

        if (cs.class_grade === 11) {
          if (cs.class_id === '11eng' && (sSubject.toLowerCase().includes('optics') || sSubject.toLowerCase().includes('c programming') || sSubject.toLowerCase().includes('simulation') || sSubject.toLowerCase().includes('chemistry'))) {
            return true
          }
          if (cs.class_id === '11mgt' && sSubject.toLowerCase().includes('business')) {
            return true
          }
          return cs.class_id === '11eng'
        }

        return true
      })

      if (candidates.length === 1) {
        reconciliationReport.safeToUpdate.push({
          scheduleId: sched.id,
          subjectName: sched.subject_name,
          batchName: sched.batch_name,
          matchedClassSubject: candidates[0]
        })
      } else if (candidates.length > 1) {
        reconciliationReport.ambiguous.push({
          scheduleId: sched.id,
          subjectName: sched.subject_name,
          batchName: sched.batch_name,
          candidates: candidates.map(c => ({ id: c.id, class_id: c.class_id, subject_code: c.subject_code }))
        })
      } else {
        reconciliationReport.unresolved.push({
          scheduleId: sched.id,
          subjectName: sched.subject_name,
          batchName: sched.batch_name,
          labId: sched.lab_id
        })
      }
    }

    fs.writeFileSync('scratch/schedule-reconciliation-report.json', JSON.stringify(reconciliationReport, null, 2))
    console.log(`- Total Schedules: ${reconciliationReport.totalSchedules}`)
    console.log(`- Safe to Update: ${reconciliationReport.safeToUpdate.length}`)
    console.log(`- Ambiguous: ${reconciliationReport.ambiguous.length}`)
    console.log(`- Unresolved: ${reconciliationReport.unresolved.length}`)

    if (reconciliationReport.ambiguous.length > 0 || reconciliationReport.unresolved.length > 0) {
      console.warn('⚠️ Some schedules were ambiguous or unresolved. Inspect scratch/schedule-reconciliation-report.json.')
    }

    // Apply updates strictly for safeToUpdate rows, PRESERVING teacher_id if already set
    console.log('🔄 Applying deterministic backfill for safe schedules...')
    for (const item of reconciliationReport.safeToUpdate) {
      await client.query(`
        UPDATE public.schedules
        SET class_subject_id = $1,
            teacher_id = COALESCE(teacher_id, $2)
        WHERE id = $3;
      `, [item.matchedClassSubject.id, item.matchedClassSubject.teacher_id, item.scheduleId])
    }
    console.log('✅ Schedule backfill applied successfully!')

    // Check Practical Logs
    console.log('\n=== PRACTICAL LOGS BACKFILL CHECK ===')
    const logCnt = await client.query('SELECT count(*) as count FROM public.practical_logs;')
    console.log(`- Total Practical Logs: ${logCnt.rows[0].count}`)

    // Check Attendance
    console.log('\n=== ATTENDANCE RECORDS CHECK ===')
    const attCnt = await client.query('SELECT count(*) as count FROM public.log_attendance;')
    console.log(`- Total Attendance Rows: ${attCnt.rows[0].count}`)

    await client.query('COMMIT;')
    console.log('\n🎉 Step 03, 04, 05 completed and transaction committed!')
  } catch (err) {
    await client.query('ROLLBACK;')
    console.error('❌ Reconciliation failed, transaction rolled back:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
