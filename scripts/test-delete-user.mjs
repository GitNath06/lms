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
  const client = await pool.connect();
  try {
    const users = (await client.query('SELECT id, email, full_name, role FROM public.profiles')).rows;
    for (const u of users) {
      try {
        await client.query('BEGIN');
        const d1 = await client.query('DELETE FROM public.profiles WHERE id = $1', [u.id]);
        const d2 = await client.query('DELETE FROM auth.identities WHERE user_id = $1', [u.id]);
        const d3 = await client.query('DELETE FROM auth.users WHERE id = $1', [u.id]);
        await client.query('ROLLBACK');
        console.log(`✓ Can delete user: ${u.email} (${u.full_name}) - rows affected: profiles=${d1.rowCount}, identities=${d2.rowCount}, users=${d3.rowCount}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`✗ CANNOT delete user: ${u.email} (${u.full_name}) - REASON:`, err.message);
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main();
