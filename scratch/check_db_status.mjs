import pg from 'pg';
import fs from 'fs';
if (fs.existsSync('.env.local')) {
  const content = fs.readFileSync('.env.local', 'utf8');
  for (const line of content.split('\n')) {
    const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2]?.trim().replace(/^['"](.*)['"]$/, '$1');
    }
  }
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    const tables = await pool.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename;
    `);
    console.log('TABLES & RLS STATUS:');
    console.table(tables.rows);

    const policies = await pool.query(`
      SELECT tablename, policyname, permissive, roles, cmd, qual, with_check 
      FROM pg_policies 
      WHERE schemaname = 'public' 
      ORDER BY tablename, policyname;
    `);
    console.log('POLICIES:');
    console.table(policies.rows.map(p => ({
      table: p.tablename,
      policy: p.policyname,
      cmd: p.cmd,
      roles: p.roles,
      qual: p.qual ? p.qual.substring(0, 50) : null
    })));

    // Counts
    const checkTables = [
      'practical_logs',
      'lab_incidents',
      'maintenance_plans',
      'maintenance_reminders',
      'maintenance_logs',
      'audit_logs',
      'log_attendance',
      'labs',
      'profiles',
      'institution_settings'
    ];
    const counts = {};
    for (const t of checkTables) {
      try {
        const res = await pool.query(`SELECT count(*) FROM public.${t}`);
        counts[t] = res.rows[0].count;
      } catch (e) {
        counts[t] = 'ERROR: ' + e.message;
      }
    }
    console.log('RECORD COUNTS:', counts);

  } catch(e) {
    console.error('Check failed:', e);
  } finally {
    await pool.end();
  }
}

check();
