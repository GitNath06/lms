import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    // 1. Query public.subjects if table exists
    try {
      const res = await pool.query('SELECT * FROM public.subjects;');
      console.log('--- public.subjects ---');
      console.log(res.rows);
    } catch (e) {
      console.log('public.subjects error:', e.message);
    }

    // 2. Query public.institution_settings
    try {
      const res = await pool.query("SELECT * FROM public.institution_settings WHERE key = 'infrastructure_subjects';");
      console.log('--- institution_settings infrastructure_subjects ---');
      if (res.rows[0]) {
        console.log(JSON.stringify(res.rows[0].value, null, 2));
      }
    } catch (e) {
      console.log('institution_settings error:', e.message);
    }

    // 3. Query distinct subject_name in practical_logs
    try {
      const res = await pool.query('SELECT DISTINCT subject_name, subject_code FROM public.practical_logs;');
      console.log('--- practical_logs distinct subject_name ---');
      console.log(res.rows);
    } catch (e) {
      console.log('practical_logs error:', e.message);
    }
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
