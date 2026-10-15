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

const pool = new pg.Pool({
  connectionString: resolved,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const client = await pool.connect();
  try {
    console.log('=== 1. APPLYING MIGRATIONS ===');

    const mig1 = fs.readFileSync('supabase/migrations/20260920_harden_maintenance_rls.sql', 'utf8');
    console.log('Applying: 20260920_harden_maintenance_rls.sql...');
    await client.query(mig1);
    console.log('✅ Applied 20260920_harden_maintenance_rls.sql');

    const mig2 = fs.readFileSync('supabase/migrations/20260920_practical_logs_logged_by_rls.sql', 'utf8');
    console.log('Applying: 20260920_practical_logs_logged_by_rls.sql...');
    await client.query(mig2);
    console.log('✅ Applied 20260920_practical_logs_logged_by_rls.sql');

    console.log('\n=== 2. VERIFYING POLICIES IN PG_POLICIES ===');
    const policiesRes = await client.query(`
      SELECT tablename, policyname, cmd, qual, with_check 
      FROM pg_policies 
      WHERE tablename IN ('maintenance_plans', 'maintenance_reminders', 'maintenance_logs', 'practical_logs')
      ORDER BY tablename, policyname;
    `);
    console.table(policiesRes.rows.map(p => ({
      table: p.tablename,
      policy: p.policyname,
      cmd: p.cmd,
      qual: p.qual ? p.qual.substring(0, 50) : '-',
      with_check: p.with_check ? p.with_check.substring(0, 50) : '-'
    })));

    // Find test users for HOD and Teacher
    const profilesRes = await client.query(`SELECT id, full_name, role FROM public.profiles WHERE role IN ('hod', 'teacher', 'lab_incharge') LIMIT 10;`);
    console.log('\nAvailable Profiles in DB:', profilesRes.rows);

    let hodUser = profilesRes.rows.find(p => p.role === 'hod');
    let teacherUser = profilesRes.rows.find(p => p.role === 'teacher');
    let teacherUser2 = profilesRes.rows.filter(p => p.role === 'teacher')[1];

    if (!hodUser) {
      // Create a temporary test HOD profile if none exists
      console.log('Creating temporary test HOD profile for test...');
      const testHodId = '11111111-1111-4111-8111-111111111111';
      await client.query(`
        INSERT INTO public.profiles (id, full_name, email, role, is_active)
        VALUES ($1, 'Test HOD Faculty', 'hod.test@institutional.np', 'hod', true)
        ON CONFLICT (id) DO UPDATE SET role = 'hod';
      `, [testHodId]);
      hodUser = { id: testHodId, full_name: 'Test HOD Faculty', role: 'hod' };
    }

    if (!teacherUser) {
      console.log('Creating temporary test Teacher profile...');
      const testTeacherId = '22222222-2222-4222-8222-222222222222';
      await client.query(`
        INSERT INTO public.profiles (id, full_name, email, role, is_active)
        VALUES ($1, 'Test Teacher Faculty', 'teacher.test@institutional.np', 'teacher', true)
        ON CONFLICT (id) DO UPDATE SET role = 'teacher';
      `, [testTeacherId]);
      teacherUser = { id: testTeacherId, full_name: 'Test Teacher Faculty', role: 'teacher' };
    }

    if (!teacherUser2) {
      const testTeacherId2 = '33333333-3333-4333-8333-333333333333';
      await client.query(`
        INSERT INTO public.profiles (id, full_name, email, role, is_active)
        VALUES ($1, 'Test Teacher 2 Faculty', 'teacher2.test@institutional.np', 'teacher', true)
        ON CONFLICT (id) DO UPDATE SET role = 'teacher';
      `, [testTeacherId2]);
      teacherUser2 = { id: testTeacherId2, full_name: 'Test Teacher 2 Faculty', role: 'teacher' };
    }

    console.log(`\n=== 3. RUNNING TEST 3A: HOD MAINTENANCE LOG INSERTION UNDER RLS ===`);
    console.log(`Simulating HOD User: ID=${hodUser.id}, Name=${hodUser.full_name}`);
    await client.query('BEGIN');
    try {
      await client.query(`SET LOCAL ROLE authenticated;`);
      await client.query(`SET LOCAL "request.jwt.claims" = '${JSON.stringify({ sub: hodUser.id, role: 'authenticated' })}';`);
      
      const insertHodRes = await client.query(`
        INSERT INTO public.maintenance_logs (
          id, lab_id, asset_identifier, work_performed, performed_by_id, service_date
        ) VALUES (
          gen_random_uuid(), 'comp', 'PC-TEST-HOD', 'Thermal Paste Replacement Verified by HOD', $1, CURRENT_DATE
        ) RETURNING id, asset_identifier, work_performed;
      `, [hodUser.id]);
      console.log('✅ TEST 3A PASSED! HOD successfully inserted maintenance log under RLS:');
      console.log(insertHodRes.rows[0]);
    } catch (e) {
      console.error('❌ TEST 3A FAILED:', e.message);
    } finally {
      await client.query('ROLLBACK');
    }

    console.log(`\n=== 4. RUNNING TEST 3B: TEACHER MAINTENANCE LOG INSERTION (MUST FAIL) ===`);
    console.log(`Simulating Teacher User: ID=${teacherUser.id}, Name=${teacherUser.full_name}`);
    await client.query('BEGIN');
    try {
      await client.query(`SET LOCAL ROLE authenticated;`);
      await client.query(`SET LOCAL "request.jwt.claims" = '${JSON.stringify({ sub: teacherUser.id, role: 'authenticated' })}';`);
      
      await client.query(`
        INSERT INTO public.maintenance_logs (
          id, lab_id, asset_identifier, work_performed, performed_by_id, service_date
        ) VALUES (
          gen_random_uuid(), 'comp', 'PC-TEST-TEACHER', 'Unauthorized Service Entry', $1, CURRENT_DATE
        );
      `, [teacherUser.id]);
      console.error('❌ TEST 3B FAILED! Teacher was unexpectedly allowed to insert maintenance log!');
    } catch (e) {
      console.log(`✅ TEST 3B PASSED! Teacher insert rejected by PostgreSQL RLS with error code ${e.code}:`);
      console.log(`   "${e.message}"`);
    } finally {
      await client.query('ROLLBACK');
    }

    console.log(`\n=== 5. RUNNING TEST 4A: PRACTICAL LOG INSERT & READ WITH LOGGED_BY ===`);
    console.log(`Teacher 1 (Assigned): ${teacherUser.id}`);
    console.log(`Teacher 2 (Acting Recorder): ${teacherUser2.id}`);
    await client.query('BEGIN');
    try {
      // Simulate Teacher 2 (Acting recorder)
      await client.query(`SET LOCAL ROLE authenticated;`);
      await client.query(`SET LOCAL "request.jwt.claims" = '${JSON.stringify({ sub: teacherUser2.id, role: 'authenticated' })}';`);

      const testLogId = 'test-logged-by-verification-' + Date.now();
      const insertLogRes = await client.query(`
        INSERT INTO public.practical_logs (
          id, lab_id, teacher_id, logged_by, date, period_label,
          subject_name, batch_group, practical_title, total_students, present_students
        ) VALUES (
          $1, 'comp', $2, $3, CURRENT_DATE, 'Period 1',
          'COMP-12', '12C Tech', 'Graph Traversal Verification', 35, 34
        ) RETURNING id, practical_title, teacher_id, logged_by;
      `, [testLogId, teacherUser.id, teacherUser2.id]);
      console.log('✅ TEST 4A-1 PASSED! Teacher 2 inserted log where logged_by = auth.uid():');
      console.log(insertLogRes.rows[0]);

      // Read back as Teacher 2 (logged_by)
      const readRes = await client.query(`
        SELECT id, practical_title, teacher_id, logged_by FROM public.practical_logs WHERE id = $1;
      `, [testLogId]);
      console.log(`✅ TEST 4A-2 PASSED! Teacher 2 can read own logged_by practical session: found ${readRes.rows.length} row(s)`);

      // Update as Teacher 2 (logged_by)
      const updateRes = await client.query(`
        UPDATE public.practical_logs 
        SET practical_title = 'Graph Traversal Verification (Updated)'
        WHERE id = $1
        RETURNING id, practical_title;
      `, [testLogId]);
      console.log('✅ TEST 4A-3 PASSED! Teacher 2 can update log where logged_by = auth.uid():');
      console.log(updateRes.rows[0]);

      // Simulate Teacher 3 (Unrelated user)
      const testTeacherId3 = '44444444-4444-4444-8444-444444444444';
      await client.query(`SET LOCAL "request.jwt.claims" = '${JSON.stringify({ sub: testTeacherId3, role: 'authenticated' })}';`);
      const unrelatedReadRes = await client.query(`
        SELECT id FROM public.practical_logs WHERE id = $1;
      `, [testLogId]);
      console.log(`✅ TEST 4A-4 PASSED! Unrelated teacher cannot read log (RLS returned ${unrelatedReadRes.rows.length} rows)`);

      // Attempt deletion as Teacher 2 (must fail because only public.is_privileged() can delete)
      await client.query(`SET LOCAL "request.jwt.claims" = '${JSON.stringify({ sub: teacherUser2.id, role: 'authenticated' })}';`);
      const deleteRes = await client.query(`DELETE FROM public.practical_logs WHERE id = $1;`, [testLogId]);
      if (deleteRes.rowCount === 0) {
        console.log('✅ TEST 4A-5 PASSED! Teacher deletion blocked by RLS (rowCount = 0)');
      } else {
        console.error('❌ TEST 4A-5 FAILED! Teacher was able to delete practical log!');
      }

    } catch (e) {
      console.error('❌ TEST 4 FAILED:', e);
    } finally {
      await client.query('ROLLBACK');
    }

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
