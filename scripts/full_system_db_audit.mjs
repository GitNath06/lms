import pg from 'pg';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
let dbUrl = '';
for (const line of env.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) {
    dbUrl = line.substring('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
  }
}

if (dbUrl.includes('db.') && dbUrl.includes('.supabase.co')) {
  const match = dbUrl.match(/postgresql:\/\/([^:]+):(.+)@db\.([a-z0-9]+)\.supabase\.co(?::\d+)?\/(.+)$/);
  if (match) {
    const [, , pass, ref, db] = match;
    dbUrl = `postgresql://postgres.${ref}:${encodeURIComponent(pass)}@aws-0-ap-southeast-1.pooler.supabase.com:5432/${db}`;
  }
}

const { Pool } = pg;
const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    console.log('=== FORENSIC DATABASE AUDIT ===');
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log('All Public Tables (' + tables.rows.length + '):');
    console.log(tables.rows.map(r => r.table_name).join(', '));

    console.log('\n--- 1. ISSUE / INCIDENT CATEGORIES ---');
    const hasIssueCats = tables.rows.some(r => r.table_name === 'issue_categories');
    console.log('issue_categories table exists:', hasIssueCats);
    if (hasIssueCats) {
      const cols = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'issue_categories'`);
      console.log('columns:', cols.rows.map(c => c.column_name + ' (' + c.data_type + ')'));
      const count = await pool.query(`SELECT count(*) FROM issue_categories`);
      console.log('row count:', count.rows[0].count);
      const rows = await pool.query(`SELECT * FROM issue_categories LIMIT 5`);
      console.log('sample rows:', rows.rows);
    }

    console.log('\n--- 2. MAINTENANCE PLANS & LOGS ---');
    const maintPlans = await pool.query(`SELECT count(*) FROM maintenance_plans`).catch(e => ({ rows: [{ count: e.message }] }));
    console.log('maintenance_plans count:', maintPlans.rows[0].count);
    const maintLogs = await pool.query(`SELECT count(*) FROM maintenance_logs`).catch(e => ({ rows: [{ count: e.message }] }));
    console.log('maintenance_logs count:', maintLogs.rows[0].count);

    console.log('\n--- 3. ACADEMIC YEARS ---');
    const ay = await pool.query(`SELECT * FROM academic_years`);
    console.log('academic_years:', ay.rows);

    console.log('\n--- 4. INSTITUTION SETTINGS ---');
    const inst = await pool.query(`SELECT key, jsonb_typeof(value) as val_type FROM institution_settings`).catch(e => ({ rows: [{ key: e.message }] }));
    console.log('institution_settings keys:', inst.rows);

    console.log('\n--- 5. PROFILES & ROLES ---');
    const profs = await pool.query(`SELECT id, full_name, email, role, approval_status, is_active FROM profiles`);
    console.log('profiles count:', profs.rows.length);
    console.log('profiles breakdown:');
    profs.rows.forEach(p => {
      console.log(` - ${p.full_name} (${p.email}): role=${p.role}, approval=${p.approval_status}, active=${p.is_active}`);
    });

    console.log('\n--- 6. CLASSES, SUBJECTS & CLASS_SUBJECTS ---');
    const clsCount = await pool.query(`SELECT count(*) FROM classes`);
    const subCount = await pool.query(`SELECT count(*) FROM subjects`);
    const csCount = await pool.query(`SELECT count(*) FROM class_subjects`);
    console.log(`classes: ${clsCount.rows[0].count}, subjects: ${subCount.rows[0].count}, class_subjects: ${csCount.rows[0].count}`);

    console.log('\n--- 7. SCHEDULES & TEACHERS ---');
    const schedCount = await pool.query(`SELECT count(*) FROM schedules`);
    console.log(`schedules total: ${schedCount.rows[0].count}`);
    const schedTeachers = await pool.query(`SELECT DISTINCT teacher_id FROM schedules`);
    console.log('distinct teacher_id in schedules:', schedTeachers.rows.map(r => r.teacher_id));

  } catch (err) {
    console.error('Audit query error:', err);
  } finally {
    await pool.end();
  }
}

main();
