import pg from 'pg';
import * as fs from 'fs';
import * as path from 'path';

function loadEnv(file) {
  const envPath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (let line of lines) {
    let trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const k = trimmed.slice(0, eqIdx).trim();
    let v = trimmed.slice(eqIdx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    process.env[k] = v;
  }
}
loadEnv('.env.local');
loadEnv('.env');

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  console.log('Connected to PostgreSQL.');

  const accounts = [
    { email: 'p.adhikari@rrl.edu.np', pass: 'Teacher@12345' },
    { email: 'a.karki@rrl.edu.np', pass: 'Teacher@12345' },
    { email: 'teacher@rrl.edu.np', pass: 'Teacher@12345' },
    { email: 'n.poudel@rrl.edu.np', pass: 'Teacher@12345' },
    { email: 'admin@rrl.edu.np', pass: 'Admin@12345' },
    { email: 'incharge@rrl.edu.np', pass: 'Incharge@12345' },
    { email: 'hod@rrl.edu.np', pass: 'Hod@12345' },
  ];

  for (const acc of accounts) {
    await client.query(`
      UPDATE auth.users
      SET encrypted_password = crypt($1, gen_salt('bf', 10)),
          email_confirmed_at = COALESCE(email_confirmed_at, now())
      WHERE email = $2
    `, [acc.pass, acc.email]);

    await client.query(`
      UPDATE public.profiles
      SET approval_status = 'approved',
          is_active = true
      WHERE email = $1
    `, [acc.email]);

    console.log(`✓ Synchronized password and approval for: ${acc.email} -> ${acc.pass}`);
  }

  await client.end();
  console.log('Done.');
}
run().catch(console.error);
