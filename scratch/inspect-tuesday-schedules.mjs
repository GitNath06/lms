import pg from 'pg';
import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf8');
for (const line of env.split('\n')) {
  const [k, ...v] = line.trim().split('=');
  if (k && v.length) process.env[k] = v.join('=').replace(/^['"]|['"]$/g, '');
}
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const res = await pool.query('SELECT DISTINCT lab_id FROM schedules');
console.log('Schedule lab_ids:', res.rows);
const labs = await pool.query('SELECT id, name, code, type FROM labs');
console.log('Labs:', labs.rows);
const tuesdayScheds = await pool.query("SELECT id, lab_id, start_time, end_time, slot_id, subject_name FROM schedules WHERE day_key = 'tue' ORDER BY start_time");
console.log('Tuesday schedules:', tuesdayScheds.rows);
await pool.end();
