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
  const res = await client.query(`
    SELECT id, target_role, is_read, title, created_at 
    FROM public.lab_notifications 
    ORDER BY created_at DESC;
  `);
  console.log('Total notifications:', res.rows.length);
  const byRole = {};
  for (const r of res.rows) {
    if (!byRole[r.target_role]) byRole[r.target_role] = { total: 0, unread: 0, read: 0 };
    byRole[r.target_role].total++;
    if (r.is_read) byRole[r.target_role].read++;
    else byRole[r.target_role].unread++;
  }
  console.log('Summary by target_role:', byRole);
  console.table(res.rows.map(r => ({
    id: r.id,
    target_role: r.target_role,
    is_read: r.is_read,
    title: r.title.substring(0, 40)
  })));
  await client.end();
}
run();
