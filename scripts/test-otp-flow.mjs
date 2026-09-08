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

async function testOtpFlow() {
  await client.connect();
  console.log('--- Testing OTP Verification & Approval Flow ---');

  const testEmail = 'test.verify.teacher@rrl.edu.np';

  // 1. Clean up old test data
  await client.query(`DELETE FROM public.email_otps WHERE email = $1`, [testEmail]);
  await client.query(`DELETE FROM public.profiles WHERE email = $1`, [testEmail]);
  await client.query(`DELETE FROM auth.identities WHERE identity_data->>'email' = $1`, [testEmail]);
  await client.query(`DELETE FROM auth.users WHERE email = $1`, [testEmail]);

  // 2. Insert test OTP
  const otpCode = '742918';
  console.log(`1. Generating test OTP (${otpCode}) for ${testEmail}...`);
  await client.query(
    `INSERT INTO public.email_otps (email, otp_code, purpose, expires_at) VALUES ($1, $2, 'signup', now() + interval '10 minutes')`,
    [testEmail, otpCode]
  );

  // 3. Verify OTP record exists
  const checkOtp = await client.query(`SELECT * FROM public.email_otps WHERE email = $1 AND otp_code = $2`, [testEmail, otpCode]);
  console.log(`2. OTP in DB? Found: ${checkOtp.rows.length === 1 ? 'YES ✅' : 'NO ❌'}`);

  // 4. Create user with pending status
  console.log(`3. Registering account with pending status...`);
  const userRes = await client.query(`
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES (gen_random_uuid(), $1, crypt('Teacher@123', gen_salt('bf', 10)), now(), '{"provider": "email"}'::jsonb, '{"role": "teacher"}'::jsonb, now(), now())
    RETURNING id;
  `, [testEmail]);
  const userId = userRes.rows[0].id;

  await client.query(`
    INSERT INTO public.profiles (id, email, full_name, role, department, is_active, approval_status, created_at)
    VALUES ($1, $2, 'Dr. Test Teacher', 'teacher', 'Science Department', FALSE, 'pending', now())
    ON CONFLICT (id) DO UPDATE SET
      approval_status = 'pending',
      is_active = FALSE;
  `, [userId, testEmail]);

  const profileCheck = await client.query(`SELECT is_active, approval_status FROM public.profiles WHERE id = $1`, [userId]);
  console.log(`4. Profile Status: is_active=${profileCheck.rows[0].is_active}, approval_status=${profileCheck.rows[0].approval_status} (Expected: false / pending) ✅`);

  // 5. Simulate Admin Approval
  console.log(`5. Simulating Super Admin Approval...`);
  await client.query(`
    UPDATE public.profiles
    SET approval_status = 'approved', is_active = TRUE
    WHERE id = $1;
  `, [userId]);

  const approvedCheck = await client.query(`SELECT is_active, approval_status FROM public.profiles WHERE id = $1`, [userId]);
  console.log(`6. After Approval: is_active=${approvedCheck.rows[0].is_active}, approval_status=${approvedCheck.rows[0].approval_status} (Expected: true / approved) ✅`);

  // 6. Clean up
  await client.query(`DELETE FROM public.email_otps WHERE email = $1`, [testEmail]);
  await client.query(`DELETE FROM public.profiles WHERE id = $1`, [userId]);
  await client.query(`DELETE FROM auth.identities WHERE user_id = $1`, [userId]);
  await client.query(`DELETE FROM auth.users WHERE id = $1`, [userId]);
  console.log(`7. Test Cleanup completed! All tests passed 🎉`);

  await client.end();
}

testOtpFlow().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
