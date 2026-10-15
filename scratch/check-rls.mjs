import fs from 'fs';
import path from 'path';
import pg from 'pg';

const envPath = path.resolve(process.cwd(), '.env.local');
const content = fs.readFileSync(envPath, 'utf8');
let rawUrl = null;

for (const line of content.split('\n')) {
  const trimmed = line.trim();
  if (trimmed.startsWith('DATABASE_URL=')) {
    rawUrl = trimmed.slice('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '');
    break;
  }
}

function resolveDatabaseUrl(url) {
  if (!url) return url;
  if (url.includes('db.') && url.includes('.supabase.co')) {
    const match = url.match(/postgresql:\/\/([^:]+):(.+)@db\.([a-z0-9]+)\.supabase\.co(?::\d+)?\/(.+)$/);
    if (match) {
      const [, , pass, ref, db] = match;
      const decodedPass = decodeURIComponent(pass);
      return `postgresql://postgres.${ref}:${encodeURIComponent(decodedPass)}@aws-0-ap-southeast-1.pooler.supabase.com:5432/${db}`;
    }
  }
  return url;
}

const connectionString = resolveDatabaseUrl(rawUrl);

async function testRLS() {
  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  // Check RLS on academic_years and classes
  const rlsRes = await pool.query(`
    SELECT tablename, rowsecurity 
    FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename IN ('academic_years', 'classes', 'students', 'student_enrollments', 'institution_settings');
  `);
  console.log('RLS Status:', rlsRes.rows);

  // Check policies on academic_years
  const policiesRes = await pool.query(`
    SELECT tablename, policyname, permissive, roles, cmd, qual
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('academic_years', 'classes');
  `);
  console.log('Policies:', policiesRes.rows);

  await pool.end();
}

testRLS().catch(console.error);
