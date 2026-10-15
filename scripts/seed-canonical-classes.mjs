import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const envPath = path.resolve(process.cwd(), '.env.local')
const content = fs.readFileSync(envPath, 'utf8')
const dbUrl = content.split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=')[1].trim().replace(/^['"]|['"]$/g, '')

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

const CANONICAL_CLASSES = [
  { id: '12eng', name: '12 Eng', grade: 12, section: 'Computer Engineering', capacity: 38 },
  { id: '12mgt', name: '12 Mgt', grade: 12, section: 'Management', capacity: 36 },
  { id: '11eng', name: '11 Eng', grade: 11, section: 'Computer Engineering', capacity: 42 },
  { id: '11mgt', name: '11 Mgt', grade: 11, section: 'General Science', capacity: 38 },
  { id: '10eng', name: '10 Eng', grade: 10, section: 'Computer Engineering', capacity: 35 },
  { id: '9eng', name: '9 Eng', grade: 9, section: 'Computer Engineering', capacity: 36 },
  { id: '8a', name: '8A', grade: 8, section: 'General Science', capacity: 32 },
  { id: '7b', name: '7B', grade: 7, section: 'General Science', capacity: 30 },
  { id: '6a', name: '6A', grade: 6, section: 'Basic Science & Computing', capacity: 28 },
]

const CANONICAL_SUBJECTS = [
  { id: 'comp-12', code: 'COMP-12', name: 'Data Structures & Algorithms', default_lab_id: 'comp', credit_hours: 4.0 },
  { id: 'elec-12', code: 'ELEC-12', name: 'Digital Electronics & Logic Gates', default_lab_id: 'comp', credit_hours: 4.0 },
  { id: 'comp-11', code: 'COMP-11', name: 'C Programming & Logic Development Lab', default_lab_id: 'comp', credit_hours: 4.0 },
  { id: 'elec-11', code: 'ELEC-11', name: 'Basic Electrical & Circuit Simulation', default_lab_id: 'comp', credit_hours: 4.0 },
  { id: 'phy-12', code: 'PHY-12', name: 'Modern Physics & Wave Optics Lab', default_lab_id: 'phys', credit_hours: 4.0 },
  { id: 'phy-11', code: 'PHY-11', name: 'Optics & Wave Mechanics Lab', default_lab_id: 'phys', credit_hours: 4.0 },
  { id: 'chem-12', code: 'CHEM-12', name: 'Organic & Analytical Chemistry Lab', default_lab_id: 'chem', credit_hours: 4.0 },
  { id: 'chem-11', code: 'CHEM-11', name: 'Physical & Inorganic Chemistry Lab', default_lab_id: 'chem', credit_hours: 4.0 },
  { id: 'bio-12', code: 'BIO-12', name: 'Cell Biology & Genetics Lab', default_lab_id: null, credit_hours: 4.0 },
  { id: 'bio-11', code: 'BIO-11', name: 'Plant Physiology & Morphology Lab', default_lab_id: null, credit_hours: 4.0 },
  { id: 'dbms-10', code: 'DBMS-10', name: 'Database Management Systems Lab', default_lab_id: 'comp', credit_hours: 3.0 },
  { id: 'wpd-9', code: 'WPD-9', name: 'Web Page Design & Development Lab', default_lab_id: 'comp', credit_hours: 3.0 },
  { id: 'ict-8', code: 'ICT-8', name: 'Information Technology Basics', default_lab_id: 'comp', credit_hours: 3.0 },
  { id: 'ict-7', code: 'ICT-7', name: 'Computer Applications Lab', default_lab_id: 'comp', credit_hours: 3.0 },
  { id: 'sci-6', code: 'SCI-6', name: 'Basic Science & Computing Lab', default_lab_id: 'comp', credit_hours: 3.0 },
]

async function seed() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    for (const c of CANONICAL_CLASSES) {
      await client.query(`
        INSERT INTO public.classes (id, name, grade, section, capacity, is_active)
        VALUES ($1, $2, $3, $4, $5, true)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          grade = EXCLUDED.grade,
          section = EXCLUDED.section,
          capacity = EXCLUDED.capacity,
          is_active = true;
      `, [c.id, c.name, c.grade, c.section, c.capacity])
    }
    console.log(`✓ Seeded ${CANONICAL_CLASSES.length} classes into public.classes`)

    for (const s of CANONICAL_SUBJECTS) {
      await client.query(`
        INSERT INTO public.subjects (id, code, name, default_lab_id, credit_hours, is_active)
        VALUES ($1, $2, $3, $4, $5, true)
        ON CONFLICT (id) DO UPDATE SET
          code = EXCLUDED.code,
          name = EXCLUDED.name,
          default_lab_id = EXCLUDED.default_lab_id,
          credit_hours = EXCLUDED.credit_hours,
          is_active = true;
      `, [s.id, s.code, s.name, s.default_lab_id, s.credit_hours])
    }
    console.log(`✓ Seeded ${CANONICAL_SUBJECTS.length} subjects into public.subjects`)

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Failed to seed classes and subjects:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

seed()
