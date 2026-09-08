import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    const classCols = await pool.query(`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_name = 'classes' ORDER BY ordinal_position;
    `);
    console.log('--- CLASSES COLS ---', classCols.rows);

    const classRows = await pool.query(`SELECT * FROM public.classes LIMIT 2;`);
    console.log('--- CLASS SAMPLE ---', classRows.rows);

    const subjectCols = await pool.query(`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_name = 'subjects' ORDER BY ordinal_position;
    `);
    console.log('--- SUBJECTS COLS ---', subjectCols.rows);

    const subjectRows = await pool.query(`SELECT * FROM public.subjects LIMIT 2;`);
    console.log('--- SUBJECT SAMPLE ---', subjectRows.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
