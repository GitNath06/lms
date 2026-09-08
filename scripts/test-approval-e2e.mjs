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
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await client.connect();
  console.log('=== 1. VERIFYING PENDING APPLICANT IN DB ===');
  const applicant = await client.query(`
    SELECT id, email, full_name, role, is_active, approval_status 
    FROM public.profiles 
    WHERE email = 'suraj.dinsu@gmail.com';
  `);
  console.log('Applicant status:', applicant.rows[0]);

  if (applicant.rows[0].approval_status !== 'pending' || applicant.rows[0].is_active !== false) {
    console.error('FAIL: Applicant is not pending/inactive!');
  } else {
    console.log('PASS: Applicant is strictly pending and inactive.');
  }

  console.log('\n=== 2. VERIFYING NOTIFICATIONS FOR ADMIN & INCHARGE ===');
  const notifs = await client.query(`
    SELECT id, title, target_role, severity, is_read, message 
    FROM public.lab_notifications 
    WHERE title LIKE 'New Teacher Registration%'
    ORDER BY created_at DESC 
    LIMIT 5;
  `);
  console.table(notifs.rows);

  const hasAdminNotif = notifs.rows.some(r => r.target_role === 'super_admin');
  const hasInchargeNotif = notifs.rows.some(r => r.target_role === 'lab_incharge');

  if (hasAdminNotif && hasInchargeNotif) {
    console.log('PASS: Dual notification present for Super Admin and Lab Incharge.');
  } else {
    console.error('FAIL: Missing notification for admin or incharge.');
  }

  console.log('\n=== 3. SIMULATING SUPER ADMIN APPROVAL ===');
  const userId = applicant.rows[0].id;
  await client.query(`
    UPDATE public.profiles 
    SET approval_status = 'approved', is_active = TRUE 
    WHERE id = $1;
  `, [userId]);

  const approved = await client.query(`
    SELECT id, email, is_active, approval_status 
    FROM public.profiles 
    WHERE id = $1;
  `, [userId]);
  console.log('Post-Approval Profile:', approved.rows[0]);
  if (approved.rows[0].approval_status === 'approved' && approved.rows[0].is_active === true) {
    console.log('PASS: Account successfully approved and activated.');
  }

  // Reset back to pending for testing
  await client.query(`
    UPDATE public.profiles 
    SET approval_status = 'pending', is_active = FALSE 
    WHERE id = $1;
  `, [userId]);
  console.log('\nReset applicant back to pending & inactive for production safety.');

  await client.end();
}

run().catch(console.error);
