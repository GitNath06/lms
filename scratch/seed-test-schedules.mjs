import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const envPath = path.resolve(process.cwd(), '.env.local')
const content = fs.readFileSync(envPath, 'utf8')
const dbUrl = content.split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=')[1].trim().replace(/^['"]|['"]$/g, '')

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

async function checkAndSeed() {
  const client = await pool.connect()
  try {
    // Teacher profiles:
    // Er. Anish Karki: 4911cee7-dae4-48a2-90de-9b039712de35
    // Dr. Prakash Adhikari: e5e3628a-2a76-4db1-8fe1-b6d1fb58037e
    // Dr. Rajesh Sharma: b7c832c9-4616-4eac-8402-2936caa1b948 (lab_incharge)

    // Check schedules for 9eng and 10eng
    const existing = await client.query(`
      SELECT id, batch_name, teacher_id, metadata->>'teacher' as teacher_name
      FROM public.schedules
      WHERE batch_name IN ('9eng', '9 Eng', '10eng', '10 Eng');
    `)
    console.log('Existing 9/10 schedules:', existing.rows)

    // If missing, insert test schedules
    await client.query(`
      INSERT INTO public.schedules (
        id, lab_id, teacher_id, subject_name, batch_name, start_time, end_time, slot_id, day_key, span, is_merged, status, metadata, academic_year_id
      ) VALUES
      (
        'sched-9c-anish', 'comp', '4911cee7-dae4-48a2-90de-9b039712de35', 'COMP-09 - Foundations of Computing', '9 Eng', '09:00', '10:00', 't1', 'mon', 1, false, 'scheduled',
        '{"teacher": "Er. Anish Karki", "category": "Computer", "studentsCount": 30}'::jsonb, '2083'
      ),
      (
        'sched-10c-anish', 'comp', '4911cee7-dae4-48a2-90de-9b039712de35', 'COMP-10 - Web Fundamentals', '10 Eng', '10:00', '11:00', 't2', 'mon', 1, false, 'scheduled',
        '{"teacher": "Er. Anish Karki", "category": "Computer", "studentsCount": 32}'::jsonb, '2083'
      ),
      (
        'sched-12c-prakash', 'comp', 'e5e3628a-2a76-4db1-8fe1-b6d1fb58037e', 'COMP-12 - Applied Computing', '12 Eng', '11:00', '12:00', 't3', 'mon', 1, false, 'scheduled',
        '{"teacher": "Dr. Prakash Adhikari", "category": "Computer", "studentsCount": 35}'::jsonb, '2083'
      )
      ON CONFLICT (id) DO UPDATE SET
        teacher_id = EXCLUDED.teacher_id,
        metadata = EXCLUDED.metadata,
        batch_name = EXCLUDED.batch_name;
    `)
    console.log('Seeded / Verified test schedules: sched-9c-anish, sched-10c-anish, sched-12c-prakash')
  } finally {
    client.release()
    await pool.end()
  }
}

checkAndSeed()
