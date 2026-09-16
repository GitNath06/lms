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
    const res = await pool.query(`
      SELECT id, created_at, actor_id, actor_name, actor_role, action, entity_type, entity_id, entity_label, changes 
      FROM public.audit_logs 
      ORDER BY created_at DESC;
    `);
    console.log('--- ALL AUDIT LOGS IN POSTGRES ---');
    console.log(JSON.stringify(res.rows, null, 2));

    const prof = await pool.query(`SELECT id, email, full_name, role, is_active FROM public.profiles;`);
    console.log('--- ALL PROFILES IN POSTGRES ---', prof.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
