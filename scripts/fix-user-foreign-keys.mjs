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
    console.log('1. Updating maintenance_logs foreign key to ON DELETE SET NULL...');
    await client.query(`
      ALTER TABLE public.maintenance_logs
      DROP CONSTRAINT IF EXISTS maintenance_logs_performed_by_id_fkey;

      ALTER TABLE public.maintenance_logs
      ADD CONSTRAINT maintenance_logs_performed_by_id_fkey
      FOREIGN KEY (performed_by_id) REFERENCES public.profiles(id)
      ON DELETE SET NULL;
    `);
    console.log('✓ maintenance_logs constraint updated.');

    console.log('2. Updating institution_settings foreign key to ON DELETE SET NULL...');
    await client.query(`
      ALTER TABLE public.institution_settings
      DROP CONSTRAINT IF EXISTS institution_settings_updated_by_fkey;

      ALTER TABLE public.institution_settings
      ADD CONSTRAINT institution_settings_updated_by_fkey
      FOREIGN KEY (updated_by) REFERENCES public.profiles(id)
      ON DELETE SET NULL;
    `);
    console.log('✓ institution_settings constraint updated.');

    // Also check if any other table has RESTRICT or NO ACTION pointing to profiles
    const checkQuery = `
      SELECT tc.table_name, kcu.column_name, rc.delete_rule, tc.constraint_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.referential_constraints AS rc ON tc.constraint_name = rc.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = rc.constraint_name
      WHERE ccu.table_name = 'profiles' AND rc.delete_rule IN ('RESTRICT', 'NO ACTION');
    `;
    const checkRes = await client.query(checkQuery);
    console.log('Remaining RESTRICT or NO ACTION foreign keys pointing to profiles:', checkRes.rows);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
