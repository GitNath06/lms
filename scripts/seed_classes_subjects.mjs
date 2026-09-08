import pg from 'pg';
import { DEFAULT_CLASSES, DEFAULT_SUBJECTS } from '../lib/master-data.js';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const INITIAL_FACULTY = [
  { id: 't1', name: 'Dr. Rajesh Sharma', dept: 'Computer Science & Engineering', role: 'Lab In-Charge', email: 'r.sharma@rrl.edu.np', assignedSubjectCodes: ['COMP-12C', 'DBMS-10A', 'WPD-9B'] },
  { id: 't2', name: 'Dr. Prakash Adhikari', dept: 'Physics Department', role: 'Senior Faculty', email: 'p.adhikari@rrl.edu.np', assignedSubjectCodes: ['PHY-11SC', 'PHY-12SC'] },
  { id: 't3', name: 'Ms. Sunita Thapa', dept: 'Chemistry Department', role: 'Lab In-Charge', email: 's.thapa@rrl.edu.np', assignedSubjectCodes: ['CHEM-12SC'] },
  { id: 't4', name: 'Er. Anish Karki', dept: 'Electronics & Hardware', role: 'Faculty Member', email: 'a.karki@rrl.edu.np', assignedSubjectCodes: ['ELEC-12C'] },
  { id: 't5', name: 'Dr. Nirmala Poudel', dept: 'Biology & Life Sciences', role: 'Senior Faculty', email: 'n.poudel@rrl.edu.np', assignedSubjectCodes: ['BIO-11SC'] },
];

const INITIAL_CLASSES = DEFAULT_CLASSES.map((c) => ({
  id: c.id,
  name: c.name,
  section: c.fullName.split(' - ')[1] || c.name,
  capacity: c.strength,
  stream: c.stream,
}));

const INITIAL_SUBJECTS = DEFAULT_SUBJECTS.map((s) => {
  const teacher = INITIAL_FACULTY.find((f) => f.id === s.teacherId);
  return {
    code: s.code,
    title: s.title,
    grade: s.grade,
    quota: s.quota,
    lab: s.lab,
    labId: s.labId,
    teacherId: s.teacherId,
    teacherName: teacher ? teacher.name : 'Assigned Faculty',
  };
});

async function main() {
  try {
    console.log('Seeding classes and subjects into institution_settings...');
    await pool.query(`
      INSERT INTO public.institution_settings (key, value)
      VALUES 
        ('infrastructure_classes', $1::jsonb),
        ('infrastructure_subjects', $2::jsonb)
      ON CONFLICT (key) DO NOTHING;
    `, [
      JSON.stringify(INITIAL_CLASSES),
      JSON.stringify(INITIAL_SUBJECTS),
    ]);

    console.log('✅ Seeded classes and subjects into institution_settings!');
    const res = await pool.query('SELECT key FROM public.institution_settings ORDER BY key;');
    console.log('All keys in institution_settings:', res.rows.map(r => r.key));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
