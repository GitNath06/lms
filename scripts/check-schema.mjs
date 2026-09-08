import pg from 'pg';
import fs from 'fs';
import path from 'path';

function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const idx = trimmed.indexOf('=');
          const key = trimmed.substring(0, idx).trim();
          const val = trimmed.substring(idx + 1).trim().replace(/^['"]|['"]$/g, '');
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await client.connect();

  const cols = await client.query(`
    SELECT column_name, column_default, is_nullable, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
    ORDER BY ordinal_position;
  `);
  console.log('--- PROFILES COLUMNS ---');
  console.table(cols.rows);

  const trig = await client.query(`
    SELECT proname, prosrc FROM pg_proc WHERE proname = 'handle_new_user';
  `);
  console.log('\n--- HANDLE NEW USER TRIGGER CODE ---');
  console.log(trig.rows[0]?.prosrc);

  const notifCols = await client.query(`
    SELECT column_name, column_default, is_nullable, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lab_notifications'
    ORDER BY ordinal_position;
  `);
  console.log('\n--- LAB NOTIFICATIONS COLUMNS ---');
  console.table(notifCols.rows);

  await client.end();
}

run().catch(console.error);
