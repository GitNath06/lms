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

  console.log('--- LATEST 10 INCIDENTS ---');
  const incidents = await client.query(`
    SELECT id, title, severity, status, reported_by, reported_by_id, created_at
    FROM public.lab_incidents
    ORDER BY created_at DESC
    LIMIT 10;
  `);
  console.table(incidents.rows);

  console.log('\n--- LATEST 10 NOTIFICATIONS ---');
  const notifs = await client.query(`
    SELECT id, incident_id, title, severity, target_role, is_read, created_at
    FROM public.lab_notifications
    ORDER BY created_at DESC
    LIMIT 10;
  `);
  console.table(notifs.rows);

  console.log('\n--- WORKSTATION ISSUES (LAST 10) ---');
  const wsIssues = await client.query(`
    SELECT id, workstation_id, title, severity, status, reported_by_id, created_at
    FROM public.workstation_issues
    ORDER BY created_at DESC
    LIMIT 10;
  `);
  console.table(wsIssues.rows);

  console.log('\n--- RLS POLICIES ON lab_notifications ---');
  const policies = await client.query(`
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE tablename = 'lab_notifications';
  `);
  console.table(policies.rows);

  console.log('\n--- COLUMNS OF lab_notifications ---');
  const cols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lab_notifications'
    ORDER BY ordinal_position;
  `);
  console.table(cols.rows);

  console.log('\n--- COLUMNS OF workstation_issues ---');
  const wsCols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workstation_issues'
    ORDER BY ordinal_position;
  `);
  console.table(wsCols.rows);

  await client.end();
}

run().catch(console.error);
