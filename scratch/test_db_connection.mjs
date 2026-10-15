import fs from 'fs';
import pg from 'pg';

function resolveDatabaseUrl(rawUrl) {
  if (!rawUrl) return rawUrl;
  if (rawUrl.includes('db.') && rawUrl.includes('.supabase.co')) {
    const match = rawUrl.match(/postgresql:\/\/([^:]+):(.+)@db\.([a-z0-9]+)\.supabase\.co(?::\d+)?\/(.+)$/);
    if (match) {
      const [, , pass, ref, db] = match;
      return `postgresql://postgres.${ref}:${encodeURIComponent(pass)}@aws-0-ap-southeast-1.pooler.supabase.com:5432/${db}`;
    }
  }
  return rawUrl;
}

const env = fs.readFileSync('.env.local', 'utf8');
const rawUrl = env.match(/DATABASE_URL=(.*)/)?.[1]?.trim().replace(/^['"]|['"]$/g, '');
const resolved = resolveDatabaseUrl(rawUrl);

console.log('Testing connection to pooler...');
const pool = new pg.Pool({
  connectionString: resolved,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

async function main() {
  try {
    const res = await pool.query('SELECT current_database(), current_user, version();');
    console.log('✅ CONNECTED TO POSTGRESQL SUCCESSFULLY!');
    console.log(res.rows[0]);
  } catch (err) {
    console.error('❌ Connection error:', err);
  } finally {
    await pool.end();
  }
}

main();
