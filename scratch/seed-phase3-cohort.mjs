import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const envPath = path.resolve(process.cwd(), '.env.local')
const content = fs.readFileSync(envPath, 'utf8')
const dbUrl = content.split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=')[1].trim().replace(/^['"]|['"]$/g, '')

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

const STUDENT_NAMES = [
  'Aarav Sharma', 'Bibek Thapa', 'Chirag Shrestha', 'Deepika KC', 'Elina Adhikari',
  'Gaurav Bista', 'Hemant Poudel', 'Ishani Karki', 'Janak Rimal', 'Kritika Joshi',
  'Laxman Subedi', 'Manish Rai', 'Nabin Giri', 'Ojaswi Bhattarai', 'Prashant Tamang',
  'Pooja Maharjan', 'Rajan Shrestha', 'Rohan Dangol', 'Sajan Khadka', 'Samikshya Gautam',
  'Sandesh Acharya', 'Sarita Basnet', 'Sujan Gurung', 'Sunil Magar', 'Suraj Dahal',
  'Sushant Regmi', 'Trishala Thapa', 'Umesh Bhandari', 'Upendra Yadav', 'Varsha Pandey',
  'Bikash Shrestha', 'Rina Maharjan', 'Suman Pokharel', 'Anil Khatri', 'Kabita Neupane'
]

async function seedCohort() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    console.log('Seeding 35 realistic students for Class 12 Eng (Academic Year 2083)...')

    for (let i = 0; i < STUDENT_NAMES.length; i++) {
      const name = STUDENT_NAMES[i]
      const roll = i + 1
      const adm = `ADM-2083-${String(roll).padStart(4, '0')}`
      const gender = i % 2 === 0 ? 'male' : 'female'

      // Upsert student
      const studentRes = await client.query(`
        INSERT INTO public.students (admission_no, full_name, gender, is_active)
        VALUES ($1, $2, $3, true)
        ON CONFLICT (admission_no) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          gender = EXCLUDED.gender,
          is_active = true
        RETURNING id;
      `, [adm, name, gender])

      const studentId = studentRes.rows[0].id

      // Upsert enrollment in Class 12 Eng (12eng) for 2083
      await client.query(`
        INSERT INTO public.student_enrollments (
          academic_year_id, class_id, student_id, roll_number, status
        )
        VALUES ('2083', '12eng', $1, $2, 'active')
        ON CONFLICT (academic_year_id, class_id, roll_number) DO UPDATE SET
          student_id = EXCLUDED.student_id,
          status = 'active';
      `, [studentId, roll])
    }

    await client.query('COMMIT')
    console.log('Successfully seeded 35 students and enrollments in Class 12 Eng!')

    const countRes = await client.query(`
      SELECT count(*) FROM public.student_enrollments
      WHERE academic_year_id = '2083' AND class_id = '12eng';
    `)
    console.log('Class 12 Eng active enrolled count:', countRes.rows[0].count)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Seeding failed:', err)
  } finally {
    client.release()
    await pool.end()
  }
}

seedCohort()
