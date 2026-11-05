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

  console.log('--- REALTIME PUBLICATION STATUS ---');
  const pubRes = await client.query(`
    SELECT pubname, tablename 
    FROM pg_publication_tables 
    WHERE tablename IN ('lab_notifications', 'lab_incidents', 'workstation_issues');
  `);
  console.table(pubRes.rows);

  console.log('\n--- EXISTING INCIDENTS WITHOUT NOTIFICATIONS ---');
  const orphanIncidents = await client.query(`
    SELECT i.id, i.title, i.severity, i.status, i.reported_by, i.lab_id, i.session_label, i.batch_name, i.created_at
    FROM public.lab_incidents i
    LEFT JOIN public.lab_notifications n ON n.incident_id = i.id
    WHERE n.id IS NULL
    ORDER BY i.created_at DESC;
  `);
  console.table(orphanIncidents.rows);

  console.log('\n--- STUDENT TERMINAL WORKSTATION ISSUES ---');
  const studentIssues = await client.query(`
    SELECT id, workstation_id, title, severity, status, reported_by_name, source, student_name, student_roll, created_at
    FROM public.workstation_issues
    WHERE source = 'student_terminal'
    ORDER BY created_at DESC
    LIMIT 5;
  `);
  console.table(studentIssues.rows);

  await client.end();
}

run().catch(console.error);
