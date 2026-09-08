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

async function runMigration() {
  await client.connect();
  console.log('Connected to PostgreSQL database...');

  // 1. Add approval_status to profiles if not exists
  console.log('Adding approval_status to public.profiles...');
  await client.query(`
    ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'approved';
  `);

  // Ensure all existing profiles have approval_status = 'approved'
  await client.query(`
    UPDATE public.profiles
    SET approval_status = 'approved'
    WHERE approval_status IS NULL;
  `);

  // 2. Create public.email_otps table
  console.log('Creating public.email_otps table...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.email_otps (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL,
      otp_code TEXT NOT NULL,
      purpose TEXT NOT NULL, -- 'signup' | 'reset_password'
      expires_at TIMESTAMPTZ NOT NULL,
      attempts INT DEFAULT 0,
      is_verified BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_email_otps_lookup ON public.email_otps (email, purpose, is_verified);
  `);

  console.log('Migration complete successfully!');
  await client.end();
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
