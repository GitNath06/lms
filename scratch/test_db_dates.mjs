import { getPgPool } from '../lib/db.ts';

async function test() {
  const pool = getPgPool();
  const res = await pool.query(
    "SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = 'practical_logs' AND column_name IN ('date', 'created_at')"
  );
  console.log('Columns:');
  console.table(res.rows);

  const raw = await pool.query('SELECT id, date::text as date_text, date FROM practical_logs ORDER BY date DESC LIMIT 5');
  console.log('Sample rows:');
  console.table(raw.rows);
  await pool.end();
}

test().catch(console.error);
