import { getPgPool } from '../lib/db.ts';

async function check() {
  const pool = getPgPool();
  const res = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'lab_incidents' ORDER BY ordinal_position;`);
  console.log('Lab Incidents columns:', res.rows.map(r => `${r.column_name}: ${r.data_type}`));
  await pool.end();
}
check().catch(console.error);
