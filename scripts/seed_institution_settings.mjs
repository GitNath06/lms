import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const MASTER_TIME_SLOTS = [
  { id: 't1', name: 'Period 1', label: '10:00 - 10:45 AM' },
  { id: 't2', name: 'Period 2', label: '10:45 - 11:30 AM' },
  { id: 't3', name: 'Period 3', label: '11:30 - 12:15 PM' },
  { id: 't4', name: 'Period 4', label: '12:15 - 01:00 PM' },
  { id: 'break', name: 'Recess Break', label: '01:00 - 01:40 PM' },
  { id: 't5', name: 'Period 5', label: '01:40 - 02:25 PM' },
  { id: 't6', name: 'Period 6', label: '02:25 - 03:10 PM' },
  { id: 't7', name: 'Period 7', label: '03:10 - 03:55 PM' },
  { id: 't8', name: 'Period 8', label: '03:55 - 04:30 PM' },
];

const DEFAULT_INCIDENT_CATEGORIES = [
  {
    id: 'cat-1',
    code: 'breakage',
    name: 'Apparatus Breakage / Glassware',
    description: 'Glassware fracture, burette/pipette crack, beaker collapse, optical lens drop',
    severity: 'moderate',
    targetLab: 'all',
  },
  {
    id: 'cat-2',
    code: 'malfunction',
    name: 'Equipment Fault / System Crash',
    description: 'PC system fault, monitor blackout, multimeter no-response, power pack fuse issue',
    severity: 'minor',
    targetLab: 'all',
  },
  {
    id: 'cat-3',
    code: 'burnt_apparatus',
    name: 'Burnt Component / Circuit Short',
    description: 'Resistor overheat, capacitor burst, IC circuit short, burning odor from PSU',
    severity: 'moderate',
    targetLab: 'all',
  },
  {
    id: 'cat-4',
    code: 'chemical_hazard',
    name: 'Chemical Spill / Acid Hazard',
    description: 'Corrosive reagent spillage, hazardous acid leak, fume hood failure, mercury vapor leak',
    severity: 'major_critical',
    targetLab: 'chem',
  },
  {
    id: 'cat-5',
    code: 'missing',
    name: 'Missing / Unreturned Equipment',
    description: 'Unaccounted station tool, missing patch cord, missing micro-pipette, unreturned specimen slide',
    severity: 'minor',
    targetLab: 'all',
  },
  {
    id: 'cat-6',
    code: 'other',
    name: 'Other Practical Incident',
    description: 'Any miscellaneous station damage or safety hazard during scheduled practical session',
    severity: 'minor',
    targetLab: 'all',
  },
];

const DEFAULT_INCIDENT_SETTINGS = {
  autoEscalateMajorToHOD: true,
  notifyLabInCharge: true,
  emergencyContacts: {
    physEmail: 'physics.incharge@rrl.edu.np',
    chemEmail: 'chemistry.incharge@rrl.edu.np',
    compEmail: 'computer.incharge@rrl.edu.np',
    hodEmail: 'hod.science@rrl.edu.np',
  },
};

async function seed() {
  try {
    console.log('Seeding initial institution settings into PostgreSQL...');

    await pool.query(`
      INSERT INTO public.institution_settings (key, value)
      VALUES 
        ('infrastructure_periods', $1::jsonb),
        ('infrastructure_incident_categories', $2::jsonb),
        ('infrastructure_incident_settings', $3::jsonb)
      ON CONFLICT (key) DO NOTHING;
    `, [
      JSON.stringify(MASTER_TIME_SLOTS),
      JSON.stringify(DEFAULT_INCIDENT_CATEGORIES),
      JSON.stringify(DEFAULT_INCIDENT_SETTINGS),
    ]);

    console.log('✅ Successfully seeded institution_settings!');

    const res = await pool.query(`SELECT key, jsonb_typeof(value) as type, updated_at FROM public.institution_settings;`);
    console.table(res.rows);
  } catch (err) {
    console.error('Seed error:', err);
  } finally {
    await pool.end();
  }
}

seed();
