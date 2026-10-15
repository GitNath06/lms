import { getPgPool } from '../lib/db.ts';

const pool = getPgPool();

async function run() {
  const tablesRes = await pool.query(`
    SELECT tablename, rowsecurity 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    ORDER BY tablename ASC;
  `);
  console.log('--- Public Tables and Row Security ---');
  console.table(tablesRes.rows);

  const policiesRes = await pool.query(`
    SELECT tablename, policyname, permissive, roles, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname;
  `);
  console.log('--- Total RLS Policies: ' + policiesRes.rows.length + ' ---');
  console.table(policiesRes.rows);

  const missingRLS = tablesRes.rows.filter(t => !t.rowsecurity);
  console.log('--- TABLES WITHOUT RLS ENABLED (' + missingRLS.length + ') ---');
  console.table(missingRLS);

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
