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

// Complete Computer Engineering Curriculum Subjects
const CURRICULUM_SUBJECTS = [
  // Class 12 Computer Engineering
  { id: 'sep-12',  code: 'SEP-12',  name: 'Software Engineering & Project Lab', default_lab_id: 'comp', credit_hours: 4, class_id: '12eng' },
  { id: 'cn-12',   code: 'CN-12',   name: 'Computer Networks & Security Lab',   default_lab_id: 'comp', credit_hours: 4, class_id: '12eng' },
  { id: 'ct-12',   code: 'CT-12',   name: 'Computer Technology & Hardware Lab',  default_lab_id: 'comp', credit_hours: 4, class_id: '12eng' },
  { id: 'vp-12',   code: 'VP-12',   name: 'Visual Programming Lab',             default_lab_id: 'comp', credit_hours: 4, class_id: '12eng' },
  { id: 'java-12', code: 'JAVA-12', name: 'Java Programming Lab',               default_lab_id: 'comp', credit_hours: 4, class_id: '12eng' },

  // Class 11 Computer Engineering
  { id: 'coa-11',  code: 'COA-11',  name: 'Computer Organization & Architecture Lab', default_lab_id: 'comp', credit_hours: 4, class_id: '11eng' },
  { id: 'os-11',   code: 'OS-11',   name: 'Operating Systems & Linux Lab',            default_lab_id: 'comp', credit_hours: 4, class_id: '11eng' },
  { id: 'wmad-11', code: 'WMAD-11', name: 'Web & Mobile Application Development Lab', default_lab_id: 'comp', credit_hours: 4, class_id: '11eng' },

  // Class 10 Computer Engineering
  { id: 'ddmp-10', code: 'DDMP-10', name: 'Digital Design & Microprocessor Lab', default_lab_id: 'comp', credit_hours: 3, class_id: '10eng' },
  { id: 'crm-10',  code: 'CRM-10',  name: 'Computer Repair & Maintenance Lab',   default_lab_id: 'comp', credit_hours: 3, class_id: '10eng' },
  { id: 'oop-10',  code: 'OOP-10',  name: 'Object-Oriented Programming (C++) Lab', default_lab_id: 'comp', credit_hours: 3, class_id: '10eng' },

  // Class 9 Computer Engineering
  { id: 'fca-9',   code: 'FCA-9',   name: 'Fundamental Computer Applications Lab', default_lab_id: 'comp', credit_hours: 3, class_id: '9eng' },
  { id: 'cp-9',    code: 'CP-9',    name: 'Computer Programming Lab',              default_lab_id: 'comp', credit_hours: 3, class_id: '9eng' },
  { id: 'fes-9',   code: 'FES-9',   name: 'Fundamental Electrical Systems Lab',    default_lab_id: 'phys', credit_hours: 3, class_id: '9eng' }
]

async function run() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN;')

    console.log('📦 Reconciling full secondary Computer Engineering subjects in public.subjects...')
    for (const sub of CURRICULUM_SUBJECTS) {
      await client.query(`
        INSERT INTO public.subjects (id, code, name, default_lab_id, credit_hours)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (code) DO UPDATE SET
          name = EXCLUDED.name,
          default_lab_id = EXCLUDED.default_lab_id,
          credit_hours = EXCLUDED.credit_hours;
      `, [sub.id, sub.code, sub.name, sub.default_lab_id, sub.credit_hours])
    }

    console.log('📦 Reconciling class_subjects teaching assignments for Er. Anish Karki...')
    const anishId = '4911cee7-dae4-48a2-90de-9b039712de35'
    for (const sub of CURRICULUM_SUBJECTS) {
      await client.query(`
        INSERT INTO public.class_subjects (academic_year_id, class_id, subject_id, teacher_id, default_lab_id)
        VALUES ('2083', $1, $2, $3, $4)
        ON CONFLICT (academic_year_id, class_id, subject_id, teacher_id) DO UPDATE SET
          default_lab_id = EXCLUDED.default_lab_id;
      `, [sub.class_id, sub.id, anishId, sub.default_lab_id])
    }

    // Also link special junior subjects mapping
    // COMP-6AB -> sci-6 on 6a
    // COMP-7AB / COMP-7C -> ict-7 on 7b
    // COMP-8AB -> ict-8 on 8a

    console.log('🔄 Re-running schedules candidate matching with complete curriculum...')

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

    const schedRes = await client.query(`
      SELECT id, lab_id, teacher_id, subject_name, batch_name, academic_year_id, class_subject_id
      FROM public.schedules
      ORDER BY id;
    `)

    let safeCount = 0
    let ambiguousCount = 0
    let unresolvedCount = 0
    const resolvedItems = []

    for (const sched of schedRes.rows) {
      if (sched.class_subject_id) {
        safeCount++
        continue
      }

      const sSubject = (sched.subject_name || '').toUpperCase()
      const sBatch = (sched.batch_name || '').toUpperCase()

      // Candidate matching logic
      const candidates = csList.filter(cs => {
        const cCode = cs.subject_code.toUpperCase()

        // Match subject code prefix (e.g. SEP-12, CN-12, CT-12, VP-12, FCA-9, CP-9, FES-9, OOP-10, CRM-10, DDMP-10, COA-11, OS-11, WMAD-11)
        let subjectMatch = false
        if (sched.id === 'mon-6' || sSubject.includes('WMAD/OS')) {
          subjectMatch = (cCode === 'WMAD-11')
        } else if (sSubject.includes(cCode)) {
          subjectMatch = true
        } else if (cCode === 'WMAD-11' && sSubject.includes('WMAD')) {
          subjectMatch = true
        } else if (cCode === 'SCI-6' && sSubject.includes('COMP-6')) {
          subjectMatch = true
        } else if (cCode === 'ICT-7' && sSubject.includes('COMP-7')) {
          subjectMatch = true
        } else if (cCode === 'ICT-8' && sSubject.includes('COMP-8')) {
          subjectMatch = true
        } else if (cCode === 'COMP-11' && sSubject.includes('COMP-11')) {
          subjectMatch = true
        } else if (cCode === 'COMP-12' && (sSubject.includes('COMP-12') || sSubject.includes('JAVA-12'))) {
          subjectMatch = true
        } else if (cCode === 'WPD-9' && sSubject.includes('COMP-09')) {
          subjectMatch = true
        } else if (cCode === 'DBMS-10' && sSubject.includes('COMP-10')) {
          subjectMatch = true
        }

        if (!subjectMatch) return false

        // Match class grade
        const gradeMatch = sBatch.includes(String(cs.class_grade))
        if (!gradeMatch) return false

        // Stream disambiguation
        if (cs.class_grade === 12) {
          if (cs.class_id === '12mgt' && sSubject.includes('BUSINESS')) return true
          if (cs.class_id === '12eng' && !sSubject.includes('BUSINESS')) return true
          return false
        }
        if (cs.class_grade === 11) {
          if (cs.class_id === '11mgt' && sSubject.includes('BUSINESS')) return true
          if (cs.class_id === '11eng' && !sSubject.includes('BUSINESS')) return true
          return false
        }

        return true
      })

      if (candidates.length === 1) {
        safeCount++
        resolvedItems.push({
          scheduleId: sched.id,
          matchedCS: candidates[0]
        })
      } else if (candidates.length > 1) {
        ambiguousCount++
        console.warn(`Ambiguous: ${sched.id} (${sched.subject_name}, ${sched.batch_name}) -> ${candidates.map(c => c.subject_code).join(', ')}`)
      } else {
        unresolvedCount++
        console.warn(`Unresolved: ${sched.id} (${sched.subject_name}, ${sched.batch_name})`)
      }
    }

    console.log(`\nReconciliation Results:`)
    console.log(`- Total Schedules: ${schedRes.rows.length}`)
    console.log(`- Safe to Update: ${safeCount}`)
    console.log(`- Ambiguous: ${ambiguousCount}`)
    console.log(`- Unresolved: ${unresolvedCount}`)

    if (ambiguousCount === 0 && unresolvedCount === 0) {
      console.log('🎯 100% OF SCHEDULES DETERMINISTICALLY MATCHED! Applying backfill...')
      for (const item of resolvedItems) {
        await client.query(`
          UPDATE public.schedules
          SET class_subject_id = $1,
              teacher_id = COALESCE(teacher_id, $2)
          WHERE id = $3;
        `, [item.matchedCS.id, item.matchedCS.teacher_id, item.scheduleId])
      }
      console.log('✅ Backfill committed for all schedules!')
    } else {
      console.warn('⚠️ Halting backfill because ambiguous or unresolved items remain.')
    }

    await client.query('COMMIT;')
    console.log('🎉 Database transaction committed successfully!')
  } catch (err) {
    await client.query('ROLLBACK;')
    console.error('❌ Error during reconciliation:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
