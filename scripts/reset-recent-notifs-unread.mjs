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
          if (!process.env[key]) process.env[key] = val;
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
  const recentIncidentIds = [
    'inc-1792427467475-2k81', // xxxxxxxx1
    'inc-1792421528475-1ze5', // hhhhhh4
    'inc-1792421508680-o5kq', // hhhhhh2
    'inc-1792421426593-vixy', // hhhhhh
  ];

  const updateRes = await client.query(`
    UPDATE public.lab_notifications
    SET is_read = false
    WHERE incident_id = ANY($1::text[])
    RETURNING id, target_role, title, is_read;
  `, [recentIncidentIds]);

  console.log(`Reset ${updateRes.rowCount} notifications to is_read = false:`);
  console.table(updateRes.rows);

  await client.end();
}
run();
