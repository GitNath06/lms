import pg from 'pg';
const DEFAULT_CLASSES = [
  { id: '12eng', name: '12 Eng', fullName: '12 Eng - Computer Engineering', stream: 'Computer Engineering', strength: 38 },
  { id: '12mgt', name: '12 Mgt', fullName: '12 Mgt - Management Stream', stream: 'Management', strength: 36 },
  { id: '11eng', name: '11 Eng', fullName: '11 Eng - Computer Engineering', stream: 'Computer Engineering', strength: 42 },
  { id: '11mgt', name: '11 Mgt', fullName: '11 Mgt - General Science Stream', stream: 'General Science', strength: 38 },
  { id: '10eng', name: '10 Eng', fullName: '10 Eng - Computer Engineering', stream: 'Computer Engineering', strength: 35 },
  { id: '9eng', name: '9 Eng', fullName: '9 Eng - Computer Engineering', stream: 'Computer Engineering', strength: 36 },
  { id: '8a', name: '8A', fullName: '8A - General Science', stream: 'Basic Level', strength: 32 },
  { id: '7b', name: '7B', fullName: '7B - General Science', stream: 'Basic Level', strength: 30 },
  { id: '6a', name: '6A', fullName: '6A - Basic Science & Computing', stream: 'Basic Level', strength: 28 },
];

const DEFAULT_SUBJECTS = [
  { code: 'COMP-12', title: 'Data Structures & Algorithms', fullName: 'COMP-12 — Data Structures & Algorithms Lab', grade: '12C', lab: 'Computer Engineering Lab 01', labId: 'comp', teacherId: 't1', quota: 12 },
  { code: 'ELEC-12', title: 'Digital Electronics & Logic Gates', fullName: 'ELEC-12 — Digital Electronics & Logic Gates', grade: '12C', lab: 'Electronics & Hardware Lab', labId: 'elec', teacherId: 't4', quota: 10 },
  { code: 'CHEM-12', title: 'Analytical Chemistry Practicals', fullName: 'CHEM-12 — Analytical Chemistry Practicals', grade: '12 Sc', lab: 'Chemistry Laboratory', labId: 'chem', teacherId: 't3', quota: 10 },
  { code: 'PHY-12', title: 'Modern Physics & Optics Lab', fullName: 'PHY-12 — Modern Physics & Optics Lab', grade: '12 Sc', lab: 'Physics Laboratory', labId: 'phys', teacherId: 't2', quota: 10 },
  { code: 'BIO-12', title: 'Plant Physiology & Genetics Lab', fullName: 'BIO-12 — Plant Physiology & Genetics Lab', grade: '12 Sc', lab: 'Biology & Life Sciences Lab', labId: 'bio', teacherId: 't5', quota: 8 },
  { code: 'COMP-11', title: 'C Programming & Logic Development', fullName: 'COMP-11 — C Programming & Logic Development Lab', grade: '11C', lab: 'Computer Engineering Lab 01', labId: 'comp', teacherId: 't1', quota: 12 },
  { code: 'ELEC-11', title: 'Basic Electrical & Circuit Simulation', fullName: 'ELEC-11 — Basic Electrical & Circuit Simulation', grade: '11C', lab: 'Electronics & Hardware Lab', labId: 'elec', teacherId: 't4', quota: 10 },
  { code: 'CHEM-11', title: 'Inorganic & General Chemistry Lab', fullName: 'CHEM-11 — Inorganic & General Chemistry Lab', grade: '11 Sc', lab: 'Chemistry Laboratory', labId: 'chem', teacherId: 't3', quota: 10 },
  { code: 'PHY-11', title: 'Optics & Wave Mechanics Lab', fullName: 'PHY-11 — Optics & Wave Mechanics Lab', grade: '11 Sc', lab: 'Physics Laboratory', labId: 'phys', teacherId: 't2', quota: 10 },
  { code: 'BIO-11', title: 'Cell Biology & Microbiology Lab', fullName: 'BIO-11 — Cell Biology & Microbiology Lab', grade: '11 Sc', lab: 'Biology & Life Sciences Lab', labId: 'bio', teacherId: 't5', quota: 8 },
  { code: 'DBMS-10', title: 'Database Management Systems Lab', fullName: 'DBMS-10 — Database Management Systems Lab', grade: '10A', lab: 'Computer Engineering Lab 01', labId: 'comp', teacherId: 't1', quota: 8 },
  { code: 'WPD-9', title: 'Web Page Design & Development Lab', fullName: 'WPD-9 — Web Page Design & Development Lab', grade: '9B', lab: 'Computer Engineering Lab 01', labId: 'comp', teacherId: 't1', quota: 8 },
  { code: 'ICT-8', title: 'Information Technology Basics', fullName: 'ICT-8 — Information Technology Basics', grade: '8A', lab: 'Computer Engineering Lab 01', labId: 'comp', teacherId: 't4', quota: 6 },
  { code: 'ICT-7', title: 'Computer Applications Lab', fullName: 'ICT-7 — Computer Applications Lab', grade: '7B', lab: 'Computer Engineering Lab 01', labId: 'comp', teacherId: 't4', quota: 6 },
  { code: 'SCI-6', title: 'Basic Science & Computing Lab', fullName: 'SCI-6 — Basic Science & Computing Lab', grade: '6A', lab: 'Computer Engineering Lab 01', labId: 'comp', teacherId: 't4', quota: 6 },
];

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
