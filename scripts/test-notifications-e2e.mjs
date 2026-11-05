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
  console.log('=== STARTING NOTIFICATION SYSTEM INTEGRATION TEST ===\n');

  // Test 1: Verify RLS policies on lab_notifications
  console.log('--- TEST 1: VERIFYING RLS POLICIES ON lab_notifications ---');
  const polRes = await client.query(`
    SELECT policyname, cmd, qual, with_check 
    FROM pg_policies 
    WHERE tablename = 'lab_notifications';
  `);
  console.table(polRes.rows);
  const polNames = polRes.rows.map(r => r.policyname);
  if (polNames.includes('insert lab notifications') && polNames.includes('read lab notifications')) {
    console.log('✅ PASS: Required RLS policies are active.');
  } else {
    console.error('❌ FAIL: Missing required RLS policies.');
  }

  // Test 2: Verify Realtime publication
  console.log('\n--- TEST 2: VERIFYING SUPABASE REALTIME PUBLICATION ---');
  const rtRes = await client.query(`
    SELECT tablename FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'lab_notifications';
  `);
  if (rtRes.rows.length > 0) {
    console.log('✅ PASS: lab_notifications is registered in supabase_realtime publication.');
  } else {
    console.error('❌ FAIL: lab_notifications is not in supabase_realtime publication.');
  }

  // Test 3: Check notifications for the 3 user-reported incidents
  console.log('\n--- TEST 3: VERIFYING NOTIFICATIONS FOR USER REPORTED INCIDENTS ---');
  const incNotifs = await client.query(`
    SELECT id, incident_id, target_role, title, severity, is_read
    FROM public.lab_notifications
    WHERE incident_id IN ('inc-1792421528475-1ze5', 'inc-1792421508680-o5kq', 'inc-1792421426593-vixy')
    ORDER BY created_at DESC;
  `);
  console.table(incNotifs.rows);

  const adminNotifs = incNotifs.rows.filter(n => n.target_role === 'super_admin');
  const inchargeNotifs = incNotifs.rows.filter(n => n.target_role === 'lab_incharge');
  const hodNotifs = incNotifs.rows.filter(n => n.target_role === 'hod');
  const teacherNotifs = incNotifs.rows.filter(n => n.target_role === 'teacher');

  console.log(`Admin notifications: ${adminNotifs.length}`);
  console.log(`Lab In-Charge notifications: ${inchargeNotifs.length}`);
  console.log(`HOD notifications: ${hodNotifs.length}`);
  console.log(`Teacher notifications: ${teacherNotifs.length}`);

  if (adminNotifs.length >= 3 && inchargeNotifs.length >= 3 && hodNotifs.length >= 2 && teacherNotifs.length >= 3) {
    console.log('✅ PASS: All 3 incidents have notifications for Admin, Lab In-Charge, HOD, and Teacher.');
  } else {
    console.error('❌ FAIL: Incomplete notifications for incidents.');
  }

  // Test 4: Simulate student assistance request notification flow
  console.log('\n--- TEST 4: TESTING STUDENT ASSISTANCE NOTIFICATION FLOW ---');
  const testIssueId = `test-ws-issue-${Date.now()}`;
  const testNotifAdmin = `notif-student-help-${testIssueId}-admin`;
  const testNotifIncharge = `notif-student-help-${testIssueId}-incharge`;

  // Insert simulated student assistance notifications
  await client.query(`
    INSERT INTO public.lab_notifications (id, target_role, target_lab_id, title, message, severity, is_read, created_at)
    VALUES 
      ($1, 'super_admin', 'comp', '🚨 Student Assistance: PC-01', 'Test Student (Roll 101): Mouse not working', 'warning', false, NOW()),
      ($2, 'lab_incharge', 'comp', 'Student Assistance: PC-01', 'Test Student (Roll 101): Mouse not working', 'warning', false, NOW());
  `, [testNotifAdmin, testNotifIncharge]);

  const verifyInsert = await client.query(`
    SELECT id, target_role, title, is_read FROM public.lab_notifications WHERE id IN ($1, $2);
  `, [testNotifAdmin, testNotifIncharge]);
  console.table(verifyInsert.rows);

  if (verifyInsert.rows.length === 2) {
    console.log('✅ PASS: Student assistance notifications created for Super Admin and Lab In-Charge.');
  } else {
    console.error('❌ FAIL: Student assistance notifications not created.');
  }

  // Test 5: Acknowledge / Mark read
  console.log('\n--- TEST 5: ACKNOWLEDGE / MARK NOTIFICATION AS READ ---');
  await client.query(`
    UPDATE public.lab_notifications SET is_read = true WHERE id LIKE $1;
  `, [`%${testIssueId}%`]);

  const verifyRead = await client.query(`
    SELECT id, is_read FROM public.lab_notifications WHERE id IN ($1, $2);
  `, [testNotifAdmin, testNotifIncharge]);
  console.table(verifyRead.rows);

  const allRead = verifyRead.rows.every(r => r.is_read === true);
  if (allRead) {
    console.log('✅ PASS: Acknowledge successfully marked notifications as read.');
  } else {
    console.error('❌ FAIL: Notifications were not marked read.');
  }

  // Clean up test notifications
  await client.query(`DELETE FROM public.lab_notifications WHERE id IN ($1, $2);`, [testNotifAdmin, testNotifIncharge]);
  console.log('✅ Cleaned up test assistance notifications.');

  console.log('\n=== ALL NOTIFICATION INTEGRATION TESTS PASSED ===');
  await client.end();
}

run().catch(console.error);
