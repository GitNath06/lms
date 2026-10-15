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

async function activate12Eng() {
  const pool = new pg.Pool({
    connectionString: resolveDatabaseUrl(rawUrl),
    ssl: { rejectUnauthorized: false }
  });

  const res = await pool.query(`
    UPDATE public.student_enrollments
    SET status = 'active'
    WHERE academic_year_id = '2083' AND class_id = '12eng'
    RETURNING id;
  `);
  console.log(`Activated ${res.rows.length} student enrollments for 12eng in 2083.`);

  const stats = await pool.query(`
    SELECT academic_year_id, class_id, status, count(*)::int
    FROM public.student_enrollments
    GROUP BY academic_year_id, class_id, status
    ORDER BY academic_year_id, class_id, status;
  `);
  console.log('Updated enrollments breakdown:', stats.rows);

  await pool.end();
}

activate12Eng().catch(console.error);
