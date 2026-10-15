import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { resolveDatabaseUrl } from '../lib/db.ts';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

async function migrate() {
  const rawUrl = process.env.DATABASE_URL;
  const connectionString = resolveDatabaseUrl(rawUrl);
  const isSupabase = connectionString && connectionString.includes('supabase.co') || connectionString.includes('supabase.com');
  
  const pool = new pg.Pool({
    connectionString,
    ssl: isSupabase ? { rejectUnauthorized: false } : false,
  });

  console.log('Adding photo_url and avatar_url columns to public.profiles...');
  
  await pool.query(`
    ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS photo_url TEXT,
    ADD COLUMN IF NOT EXISTS avatar_url TEXT;

    COMMENT ON COLUMN public.profiles.photo_url IS 'Base64 data URL or storage URI for user profile avatar';
    COMMENT ON COLUMN public.profiles.avatar_url IS 'Alias/fallback storage URI for user profile avatar';
  `);

  console.log('Migration complete. Verifying schema...');
  const res = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name IN ('photo_url', 'avatar_url');
  `);
  console.log('Verified columns in public.profiles:', res.rows);
  await pool.end();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
