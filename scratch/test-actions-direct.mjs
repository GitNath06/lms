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

  console.log('--- TEST 1: public.classes query ---');
  const query = `
    SELECT id, name, grade, section, stream_id, capacity, is_active, created_at
    FROM public.classes
    WHERE is_active = true
    ORDER BY grade DESC NULLS LAST, name ASC;
  `;
  const classRes = await pool.query(query);
  console.log('public.classes row count:', classRes.rows.length);

  console.log('\n--- TEST 2: getClassEnrollmentStats query with 2083 ---');
  const statsQuery = `
    SELECT 
      class_id, 
      count(*)::int AS enrolled_count
    FROM public.student_enrollments
    WHERE academic_year_id = $1 
      AND status = 'active'
    GROUP BY class_id;
  `;
  const statsRes = await pool.query(statsQuery, ['2083']);
  console.log('Stats for 2083:', statsRes.rows);

  const statsMap = {};
  for (const row of statsRes.rows) {
    statsMap[row.class_id] = row.enrolled_count;
    const norm = row.class_id.toLowerCase().replace(/[\s-_]/g, '');
    statsMap[norm] = row.enrolled_count;
  }
  console.log('Stats map:', statsMap);

  console.log('\n--- TEST 3: Matching classes to statsMap ---');
  for (const c of classRes.rows) {
    const enrolled = statsMap[c.id] ?? statsMap[c.id.toLowerCase().replace(/[\s-_]/g, '')] ?? 0;
    console.log(`Class ID: "${c.id}" (${c.name}) => Enrolled: ${enrolled}`);
  }

  console.log('\n--- TEST 4: public.academic_years ---');
  const yearRes = await pool.query(`SELECT id, name, is_current, start_date FROM public.academic_years ORDER BY start_date DESC`);
  console.log('Academic years:', yearRes.rows);

  console.log('\n--- TEST 5: Inspect student_enrollments breakdown ---');
  const breakdownRes = await pool.query(`
    SELECT academic_year_id, class_id, status, count(*)::int
    FROM public.student_enrollments
    GROUP BY academic_year_id, class_id, status
    ORDER BY academic_year_id, class_id, status;
  `);
  console.log('\n--- TEST 6: Inspect audit_logs ---');
  const auditRes = await pool.query(`SELECT action, entity_type, entity_label, created_at FROM public.audit_logs ORDER BY created_at DESC LIMIT 10`);
  console.log('Audit logs:', auditRes.rows);

  await pool.end();
}

test().catch(console.error);
