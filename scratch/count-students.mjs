import pg from 'pg';
import fs from 'fs';
import path from 'path';

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

async function test() {
  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  const studentsCount = await pool.query('SELECT count(*)::int FROM public.students');
  console.log('Total students:', studentsCount.rows[0].count);

  const enrollmentsCount = await pool.query('SELECT count(*)::int FROM public.student_enrollments');
  console.log('Total enrollments:', enrollmentsCount.rows[0].count);

  const enrollmentsByYear = await pool.query(`
    SELECT academic_year_id, class_id, status, count(*)::int
    FROM public.student_enrollments
    GROUP BY academic_year_id, class_id, status
  `);
  console.log('Enrollments summary:', enrollmentsByYear.rows);

  await pool.end();
}

test().catch(console.error);
