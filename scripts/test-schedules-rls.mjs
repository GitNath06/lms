import pg from 'pg';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const dbUrl = env.split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=')[1].trim().replace(/^['"]|['"]$/g, '');
const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await client.connect();

console.log('Connected to database. Applying RLS migration for public.schedules...');

await client.query(`
  -- Ensure RLS is enabled on public.schedules
  ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

  -- Drop existing teacher-scoped policies to ensure clean idempotent creation
  DROP POLICY IF EXISTS "Teacher request slot booking" ON public.schedules;
  DROP POLICY IF EXISTS "Teacher cancel pending slot request" ON public.schedules;
  DROP POLICY IF EXISTS "Teacher update own pending slot request" ON public.schedules;

  -- 1. INSERT: Approved teachers can submit slot booking requests for themselves
  CREATE POLICY "Teacher request slot booking" ON public.schedules
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_privileged()
    OR (
      public.is_approved_staff()
      AND teacher_id = auth.uid()
      AND (
        metadata->>'status' = 'requested'
        OR (metadata IS NOT NULL AND metadata->>'status' = 'requested')
      )
    )
  );

  -- 2. DELETE: Approved teachers can cancel their own pending requests
  CREATE POLICY "Teacher cancel pending slot request" ON public.schedules
  FOR DELETE TO authenticated
  USING (
    public.is_privileged()
    OR (
      public.is_approved_staff()
      AND teacher_id = auth.uid()
      AND metadata->>'status' = 'requested'
    )
  );

  -- 3. UPDATE: Approved teachers can edit details of their own pending requests, but cannot self-confirm
  CREATE POLICY "Teacher update own pending slot request" ON public.schedules
  FOR UPDATE TO authenticated
  USING (
    public.is_privileged()
    OR (
      public.is_approved_staff()
      AND teacher_id = auth.uid()
      AND metadata->>'status' = 'requested'
    )
  )
  WITH CHECK (
    public.is_privileged()
    OR (
      public.is_approved_staff()
      AND teacher_id = auth.uid()
      AND metadata->>'status' = 'requested'
    )
  );
`);

console.log('RLS migration applied successfully.');

// Now let us verify under authenticated session simulation
console.log('\n--- Simulating Authenticated Teacher Session ---');
const teacherId = '998f185f-995d-4afa-84fa-3646cb6e709e'; // testteacher

const csRes = await client.query(`SELECT id FROM public.class_subjects LIMIT 1`);
const validCsId = csRes.rows[0]?.id;
console.log('Using valid class_subject_id for tests:', validCsId);

// Test 1: Valid Teacher Request INSERT should SUCCEED
try {
  await client.query('BEGIN');
  await client.query(`SET LOCAL ROLE authenticated;`);
  await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true);`, [teacherId]);

  const testSlotId = 'test-rls-req-' + Date.now();
  await client.query(`
    INSERT INTO public.schedules (
      id, lab_id, teacher_id, class_subject_id, subject_name, batch_name, day_key, slot_id, span, start_time, end_time, status, metadata
    ) VALUES (
      $1, 'chem', $2, $3, 'CHEM-11 - Physical & Inorganic Chemistry', '11 C Eng', 'mon', 't4', 1, '12:15', '13:00', 'scheduled',
      '{"status": "requested", "is_adhoc": true, "teacher": "testteacher"}'::jsonb
    );
  `, [testSlotId, teacherId, validCsId]);

  console.log('✅ TEST 1 PASSED: Valid teacher slot booking request was permitted by RLS!');
  await client.query('ROLLBACK');
} catch (err) {
  await client.query('ROLLBACK');
  console.error('❌ TEST 1 FAILED:', err.message);
}

// Test 2: Teacher attempting to insert a CONFIRMED session directly should FAIL with RLS violation
try {
  await client.query('BEGIN');
  await client.query(`SET LOCAL ROLE authenticated;`);
  await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true);`, [teacherId]);

  const testSlotId = 'test-rls-conf-' + Date.now();
  await client.query(`
    INSERT INTO public.schedules (
      id, lab_id, teacher_id, class_subject_id, subject_name, batch_name, day_key, slot_id, span, start_time, end_time, status, metadata
    ) VALUES (
      $1, 'chem', $2, $3, 'CHEM-11 - Physical & Inorganic Chemistry', '11 C Eng', 'mon', 't4', 1, '12:15', '13:00', 'scheduled',
      '{"status": "confirmed", "is_adhoc": false, "teacher": "testteacher"}'::jsonb
    );
  `, [testSlotId, teacherId, validCsId]);

  console.error('❌ TEST 2 FAILED: Teacher was able to insert a confirmed session directly (RLS bypass)!');
  await client.query('ROLLBACK');
} catch (err) {
  await client.query('ROLLBACK');
  if (err.message.includes('row-level security')) {
    console.log('✅ TEST 2 PASSED: Direct confirmed session insertion was correctly BLOCKED by RLS:', err.message);
  } else {
    console.error('❌ TEST 2 Unexpected error:', err.message);
  }
}

// Test 3: Teacher attempting to insert a request for ANOTHER teacher should FAIL with RLS violation
try {
  await client.query('BEGIN');
  await client.query(`SET LOCAL ROLE authenticated;`);
  await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true);`, [teacherId]);

  const otherTeacherId = '00000000-0000-0000-0000-000000000001';
  const testSlotId = 'test-rls-spoof-' + Date.now();
  await client.query(`
    INSERT INTO public.schedules (
      id, lab_id, teacher_id, class_subject_id, subject_name, batch_name, day_key, slot_id, span, start_time, end_time, status, metadata
    ) VALUES (
      $1, 'chem', $2, $3, 'CHEM-11 - Physical & Inorganic Chemistry', '11 C Eng', 'mon', 't4', 1, '12:15', '13:00', 'scheduled',
      '{"status": "requested", "is_adhoc": true, "teacher": "Other Teacher"}'::jsonb
    );
  `, [testSlotId, otherTeacherId, validCsId]);

  console.error('❌ TEST 3 FAILED: Teacher was able to spoof another teacher ID (RLS bypass)!');
  await client.query('ROLLBACK');
} catch (err) {
  await client.query('ROLLBACK');
  if (err.message.includes('row-level security')) {
    console.log('✅ TEST 3 PASSED: Spoofed teacher ID was correctly BLOCKED by RLS:', err.message);
  } else {
    console.error('❌ TEST 3 Unexpected error:', err.message);
  }
}

// Test 4: Teacher attempting to update status from 'requested' to 'confirmed' should FAIL with RLS violation
try {
  await client.query('BEGIN');
  await client.query(`SET LOCAL ROLE postgres;`);
  const testSlotId = 'test-rls-upd-' + Date.now();
  await client.query(`
    INSERT INTO public.schedules (
      id, lab_id, teacher_id, class_subject_id, subject_name, batch_name, day_key, slot_id, span, start_time, end_time, status, metadata
    ) VALUES (
      $1, 'chem', $2, $3, 'CHEM-11 - Physical & Inorganic Chemistry', '11 C Eng', 'mon', 't4', 1, '12:15', '13:00', 'scheduled',
      '{"status": "requested", "is_adhoc": true, "teacher": "testteacher"}'::jsonb
    );
  `, [testSlotId, teacherId, validCsId]);

  // Switch to teacher
  await client.query(`SET LOCAL ROLE authenticated;`);
  await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true);`, [teacherId]);

  // Try to approve own request
  await client.query(`
    UPDATE public.schedules 
    SET metadata = '{"status": "confirmed"}'::jsonb
    WHERE id = $1;
  `, [testSlotId]);

  console.error('❌ TEST 4 FAILED: Teacher was able to self-approve request (RLS bypass)!');
  await client.query('ROLLBACK');
} catch (err) {
  await client.query('ROLLBACK');
  if (err.message.includes('row-level security')) {
    console.log('✅ TEST 4 PASSED: Self-approval via UPDATE was correctly BLOCKED by RLS:', err.message);
  } else {
    console.error('❌ TEST 4 Unexpected error:', err.message);
  }
}

await client.end();
console.log('\nAll RLS verification tests finished.');
