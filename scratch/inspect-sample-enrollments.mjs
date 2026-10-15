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

async function inspectEnrollments() {
  const pool = new pg.Pool({
    connectionString: resolveDatabaseUrl(rawUrl),
    ssl: { rejectUnauthorized: false }
  });

  const res = await pool.query(`
    SELECT id, student_id, academic_year_id, class_id, roll_number, status, created_at
    FROM public.student_enrollments
    WHERE class_id = '12eng'
    LIMIT 5;
  `);
  console.log('12eng sample enrollments:', res.rows);

  const res2084 = await pool.query(`
    SELECT id, student_id, academic_year_id, class_id, roll_number, status, created_at
    FROM public.student_enrollments
    WHERE academic_year_id = '2084'
    LIMIT 5;
  `);
  console.log('2084 sample enrollments:', res2084.rows);

  const students12eng = await pool.query(`
    SELECT se.roll_number, s.full_name, se.status, se.academic_year_id, se.class_id
    FROM public.student_enrollments se
    JOIN public.students s ON s.id = se.student_id
    WHERE se.class_id = '12eng'
    ORDER BY se.roll_number ASC
    LIMIT 10;
  `);
  console.log('12eng students:', students12eng.rows);

  await pool.end();
}

inspectEnrollments().catch(console.error);
