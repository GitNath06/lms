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
  console.log('--- ALL USERS IN public.profiles ---');
  const profiles = await client.query(`
    SELECT id, email, full_name, role, is_active, approval_status, created_at
    FROM public.profiles
    ORDER BY created_at DESC;
  `);
  console.table(profiles.rows);

  console.log('\n--- LATEST 10 EMAIL OTPS ---');
  const otps = await client.query(`
    SELECT id, email, otp_code, purpose, is_verified, attempts, expires_at, created_at
    FROM public.email_otps
    ORDER BY created_at DESC
    LIMIT 10;
  `);
  console.table(otps.rows);

  console.log('\n--- LATEST 10 LAB NOTIFICATIONS ---');
  const notifs = await client.query(`
    SELECT id, title, severity, target_role, is_read, created_at
    FROM public.lab_notifications
    ORDER BY created_at DESC
    LIMIT 10;
  `);
  console.table(notifs.rows);

  await client.end();
}

run().catch(console.error);
