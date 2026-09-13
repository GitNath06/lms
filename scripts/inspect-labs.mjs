import pg from 'pg';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
let dbUrl = '';
for (const line of env.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) {
    dbUrl = line.substring('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
  }
}

const { Pool } = pg;
const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    const labCols = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'labs' 
      ORDER BY ordinal_position;
    `);
    console.log('--- LABS COLS ---', labCols.rows);

    const labRows = await pool.query(`SELECT * FROM public.labs;`);
    console.log('--- LAB ROWS ---', labRows.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
