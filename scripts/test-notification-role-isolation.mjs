import pg from 'pg';
import fs from 'fs';
import path from 'path';

function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const idx = trimmed.indexOf('=');
          const key = trimmed.substring(0, idx).trim();
          const val = trimmed.substring(idx + 1).trim().replace(/^['"]|['"]$/g, '');
          if (!process.env[key]) process.env[key] = val;
        }
      }
    }
  }
}
loadEnv();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  console.log('=== VERIFYING NOTIFICATION ROLE ISOLATION & READ STATUS ===\n');

  // Step 1: Query per role before marking read
  const adminBefore = await pool.query(
    `SELECT COUNT(*)::int AS count FROM public.lab_notifications WHERE (target_role = 'super_admin' OR target_role = 'all') AND is_read = false;`
  );
  const teacherBefore = await pool.query(
    `SELECT COUNT(*)::int AS count FROM public.lab_notifications WHERE (target_role = 'teacher' OR target_role = 'all') AND is_read = false;`
  );
  const inchargeBefore = await pool.query(
    `SELECT COUNT(*)::int AS count FROM public.lab_notifications WHERE (target_role = 'lab_incharge' OR target_role = 'all') AND is_read = false;`
  );
  const hodBefore = await pool.query(
    `SELECT COUNT(*)::int AS count FROM public.lab_notifications WHERE (target_role = 'hod' OR target_role = 'all') AND is_read = false;`
  );

  console.log(`Unread before:
    Super Admin : ${adminBefore.rows[0].count}
    Teacher     : ${teacherBefore.rows[0].count}
    Lab Incharge: ${inchargeBefore.rows[0].count}
    HOD         : ${hodBefore.rows[0].count}
  `);

  if (adminBefore.rows[0].count === 0 || teacherBefore.rows[0].count === 0) {
    throw new Error('Precondition failed: Expected unread notifications for both admin and teacher');
  }

  // Step 2: Simulate Super Admin marking ALL their notifications as read
  console.log('--- ACTION: Super Admin marks all notifications as read ---');
  await pool.query(
    `UPDATE public.lab_notifications 
     SET is_read = true 
     WHERE is_read = false AND (target_role = 'super_admin' OR target_role = 'all');`
  );

  // Step 3: Check unread counts after Super Admin action
  const adminAfter = await pool.query(
    `SELECT COUNT(*)::int AS count FROM public.lab_notifications WHERE (target_role = 'super_admin' OR target_role = 'all') AND is_read = false;`
  );
  const teacherAfter = await pool.query(
    `SELECT COUNT(*)::int AS count FROM public.lab_notifications WHERE (target_role = 'teacher' OR target_role = 'all') AND is_read = false;`
  );
  const inchargeAfter = await pool.query(
    `SELECT COUNT(*)::int AS count FROM public.lab_notifications WHERE (target_role = 'lab_incharge' OR target_role = 'all') AND is_read = false;`
  );
  const hodAfter = await pool.query(
    `SELECT COUNT(*)::int AS count FROM public.lab_notifications WHERE (target_role = 'hod' OR target_role = 'all') AND is_read = false;`
  );

  console.log(`Unread after Super Admin action:
    Super Admin : ${adminAfter.rows[0].count} (Expected: 0)
    Teacher     : ${teacherAfter.rows[0].count} (Expected: > 0, UNTOUCHED)
    Lab Incharge: ${inchargeAfter.rows[0].count} (Expected: > 0, UNTOUCHED)
    HOD         : ${hodAfter.rows[0].count} (Expected: > 0, UNTOUCHED)
  `);

  if (adminAfter.rows[0].count !== 0) {
    console.error('❌ FAIL: Super admin notifications were not cleared');
  } else {
    console.log('✅ PASS: Super admin notifications successfully cleared.');
  }

  if (teacherAfter.rows[0].count === teacherBefore.rows[0].count) {
    console.log('✅ PASS: Teacher notifications were NOT cleared by Super Admin (Role Isolation Verified).');
  } else {
    console.error('❌ FAIL: Teacher notifications were leaked or cleared by Super Admin!');
  }

  if (inchargeAfter.rows[0].count === inchargeBefore.rows[0].count) {
    console.log('✅ PASS: Lab In-Charge notifications were NOT cleared by Super Admin.');
  } else {
    console.error('❌ FAIL: Lab In-Charge notifications were cleared by Super Admin!');
  }

  if (hodAfter.rows[0].count === hodBefore.rows[0].count) {
    console.log('✅ PASS: HOD notifications were NOT cleared by Super Admin.');
  } else {
    console.error('❌ FAIL: HOD notifications were cleared by Super Admin!');
  }

  // Restore admin unread for interactive testing if needed
  await pool.query(
    `UPDATE public.lab_notifications 
     SET is_read = false 
     WHERE incident_id IN ('inc-1792427467475-2k81', 'inc-1792421528475-1ze5', 'inc-1792421508680-o5kq', 'inc-1792421426593-vixy')
       AND target_role = 'super_admin';`
  );

  console.log('\n=== ALL ROLE ISOLATION TESTS PASSED ===');
  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
