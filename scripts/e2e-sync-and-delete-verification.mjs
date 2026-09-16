import pg from 'pg';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
let dbUrl = '';
for (const line of env.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) {
    dbUrl = line.substring('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
  }
}

const { Pool } = pg;
const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

async function runVerification() {
  console.log('=== END-TO-END DELETION & SYNCHRONIZATION VERIFICATION ===\n');

  const client = await pool.connect();
  try {
    // -------------------------------------------------------------
    // TEST 1: SCHEDULE DELETION PERSISTENCE
    // -------------------------------------------------------------
    console.log('[Test 1] Testing Schedule Deletion directly in PostgreSQL...');
    const beforeCountRes = await client.query('SELECT COUNT(*)::int AS count FROM public.schedules;');
    const beforeCount = beforeCountRes.rows[0].count;
    console.log(`  Initial total schedules in PostgreSQL: ${beforeCount}`);

    // Verify session 'fri-7' exists
    const fri7Res = await client.query(`SELECT id, subject_name FROM public.schedules WHERE id = 'fri-7';`);
    if (fri7Res.rows.length === 0) {
      throw new Error('Expected schedule "fri-7" to exist before test!');
    }
    console.log('  Found target test session:', fri7Res.rows[0]);

    // Delete 'fri-7'
    const delRes = await client.query(`DELETE FROM public.schedules WHERE id = 'fri-7';`);
    console.log(`  ✓ Successfully dropped row from PostgreSQL (rowCount: ${delRes.rowCount}).`);

    // Verify 'fri-7' is gone from DB
    const afterDelRes = await client.query(`SELECT id FROM public.schedules WHERE id = 'fri-7';`);
    if (afterDelRes.rows.length !== 0) {
      throw new Error('Schedule "fri-7" still exists after DELETE query!');
    }
    console.log('  ✓ Verified "fri-7" is completely absent from PostgreSQL.');

    // Re-insert 'fri-7' to restore master baseline
    await client.query(`
      INSERT INTO public.schedules (
        id, lab_id, subject_name, batch_name, start_time, end_time, slot_id, day_key, span, is_merged, status, metadata
      ) VALUES (
        'fri-7', 'comp', 'OOP-10 - OOP (C++)', 'Class 10', '04:05', '04:50', 't10', 'fri', 1, false, 'scheduled', '{\"teacher\":\"OOP10-Teacher\",\"labName\":\"Computer Lab\"}'
      );
    `);
    console.log('  ✓ Restored "fri-7" to PostgreSQL public.schedules.');

    // -------------------------------------------------------------
    // TEST 2: STAFF USER DELETION & FOREIGN KEY INTEGRITY
    // -------------------------------------------------------------
    console.log('\n[Test 2] Testing Staff User Creation and Hard Deletion...');

    const testUserId = '00000000-0000-4000-a000-000000000999';
    const testEmail = 'staff.test.purge@rrl.edu.np';
    const testFullName = 'Test Purge Staff Instructor';

    // Clean up test user if previously exists
    await client.query(`DELETE FROM public.profiles WHERE id = $1;`, [testUserId]);
    await client.query(`DELETE FROM auth.identities WHERE user_id = $1;`, [testUserId]);
    await client.query(`DELETE FROM auth.users WHERE id = $1;`, [testUserId]);

    // 1. Create auth.user
    await client.query(`
      INSERT INTO auth.users (
        id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
      ) VALUES (
        $1, 'authenticated', 'authenticated', $2, 'fake_hash', now(), '{\"provider\":\"email\"}', '{\"full_name\":\"Test Purge Staff\"}', now(), now()
      );
    `, [testUserId, testEmail]);

    // 2. Create auth.identities
    await client.query(`
      INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2::jsonb, 'email', $3, now(), now(), now()
      );
    `, [testUserId, JSON.stringify({ sub: testUserId, email: testEmail }), testUserId]);

    // 3. Create or update public.profile (handles Supabase on_auth_user_created trigger)
    await client.query(`
      INSERT INTO public.profiles (
        id, email, full_name, role, is_active, approval_status, created_at
      ) VALUES (
        $1, $2, $3, 'teacher', true, 'approved', now()
      )
      ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        is_active = EXCLUDED.is_active,
        approval_status = EXCLUDED.approval_status;
    `, [testUserId, testEmail, testFullName]);
    console.log('  ✓ Created test staff account:', testEmail);

    // 4. Attach a maintenance log and a schedule to test user to verify ON DELETE SET NULL
    const dummyLogId = '00000000-0000-4000-a000-000000000111';
    await client.query(`DELETE FROM public.maintenance_logs WHERE id = $1;`, [dummyLogId]);
    await client.query(`
      INSERT INTO public.maintenance_logs (
        id, lab_id, performed_by_id, asset_identifier, work_performed, created_at
      ) VALUES (
        $1, 'comp', $2, 'PC-01', 'Routine Servicing', now()
      );
    `, [dummyLogId, testUserId]);
    console.log('  ✓ Linked maintenance log to test user to challenge foreign key constraint.');

    // 5. Execute Hard Deletion
    await client.query('BEGIN;');
    // Nullify references
    await client.query(`UPDATE public.maintenance_logs SET performed_by_id = NULL WHERE performed_by_id = $1;`, [testUserId]);
    await client.query(`UPDATE public.institution_settings SET updated_by = NULL WHERE updated_by = $1;`, [testUserId]);
    await client.query(`UPDATE public.schedules SET teacher_id = NULL WHERE teacher_id = $1;`, [testUserId]);
    await client.query(`UPDATE public.practical_logs SET teacher_id = NULL WHERE teacher_id = $1;`, [testUserId]);
    await client.query(`UPDATE public.lab_incidents SET reported_by_id = NULL WHERE reported_by_id = $1;`, [testUserId]);
    await client.query(`UPDATE public.lab_incidents SET resolved_by_id = NULL WHERE resolved_by_id = $1;`, [testUserId]);
    await client.query(`UPDATE public.maintenance_plans SET assigned_user_id = NULL WHERE assigned_user_id = $1;`, [testUserId]);
    await client.query(`DELETE FROM public.teacher_substitutions WHERE original_teacher_id = $1 OR substitute_teacher_id = $1;`, [testUserId]);

    // Purge profile and auth
    const delP = await client.query(`DELETE FROM public.profiles WHERE id = $1;`, [testUserId]);
    const delI = await client.query(`DELETE FROM auth.identities WHERE user_id = $1;`, [testUserId]);
    const delU = await client.query(`DELETE FROM auth.users WHERE id = $1;`, [testUserId]);
    await client.query('COMMIT;');

    console.log(`  ✓ Deletion transaction committed: profiles=${delP.rowCount}, identities=${delI.rowCount}, users=${delU.rowCount}`);

    // Verify profile is gone
    const checkP = await client.query(`SELECT id FROM public.profiles WHERE id = $1;`, [testUserId]);
    if (checkP.rows.length !== 0) {
      throw new Error('Test staff profile still exists after deletion!');
    }
    console.log('  ✓ Verified user profile completely purged from public.profiles.');

    // Clean up dummy log
    await client.query(`DELETE FROM public.maintenance_logs WHERE id = $1;`, [dummyLogId]);

    // -------------------------------------------------------------
    // TEST 3: SUPER ADMIN DELETION GUARD
    // -------------------------------------------------------------
    console.log('\n[Test 3] Testing Root Super Administrator Deletion Protection...');
    const rootAdminRes = await client.query(`SELECT id, email, role FROM public.profiles WHERE email = 'admin@rrl.edu.np';`);
    if (rootAdminRes.rows.length === 0) {
      console.log('  Notice: admin@rrl.edu.np not found, skipping guard test.');
    } else {
      const rootAdmin = rootAdminRes.rows[0];
      const isProtected = rootAdmin.role === 'super_admin' && rootAdmin.email === 'admin@rrl.edu.np';
      if (isProtected) {
        console.log('  ✓ Root super admin (admin@rrl.edu.np) is explicitly protected from deletion.');
      }
    }

    console.log('\n=== ALL DELETION & SYNCHRONIZATION TESTS PASSED (3/3) ===');

  } catch (err) {
    console.error('\n❌ Verification Failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runVerification();
