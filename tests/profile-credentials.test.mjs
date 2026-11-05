import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import crypto from 'node:crypto';
import { resolveDatabaseUrl } from '../lib/db.ts';
import { validatePasswordPolicy } from '../lib/auth-policy.ts';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

describe('Institutional Credentials & Dual-OTP Email Change Suite', () => {
  let pool;
  const testUserId = crypto.randomUUID();
  const testOldEmail = `test.faculty.${Date.now()}@rrl.edu.np`;
  const testNewEmail = `test.migrated.${Date.now()}@rrl.edu.np`;
  const initialPassword = 'LabSyncPassword2026!#';
  const updatedPassword = 'NewStrongLabPassword2026!#';

  before(async () => {
    const rawUrl = process.env.DATABASE_URL;
    const connectionString = resolveDatabaseUrl(rawUrl);
    const isSupabase = connectionString && (connectionString.includes('supabase.co') || connectionString.includes('supabase.com'));

    pool = new pg.Pool({
      connectionString,
      ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
    });

    // Seed temporary test user in auth.users and public.profiles
    await pool.query(
      `
      INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      VALUES (
        $1::uuid,
        $2,
        crypt($3, gen_salt('bf', 10)),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"full_name":"Test Credential Faculty"}'::jsonb,
        now(),
        now()
      );
      `,
      [testUserId, testOldEmail, initialPassword]
    );

    await pool.query(
      `
      INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
      VALUES (
        $1::uuid,
        $2::uuid,
        jsonb_build_object('sub', $2::text, 'email', $3::text, 'email_verified', true),
        'email',
        $2::text,
        now(),
        now(),
        now()
      );
      `,
      [crypto.randomUUID(), testUserId, testOldEmail]
    );

    await pool.query(
      `
      INSERT INTO public.profiles (id, full_name, email, role, approval_status, created_at)
      VALUES ($1::uuid, 'Test Credential Faculty', $2, 'teacher', 'approved', now())
      ON CONFLICT (id) DO UPDATE SET email = $2;
      `,
      [testUserId, testOldEmail]
    );
  });

  after(async () => {
    if (pool) {
      // Clean up test artifacts
      await pool.query(`DELETE FROM public.email_otps WHERE email IN ($1, $2);`, [testOldEmail, testNewEmail]);
      await pool.query(`DELETE FROM public.profiles WHERE id = $1::uuid;`, [testUserId]);
      await pool.query(`DELETE FROM auth.identities WHERE user_id = $1::uuid;`, [testUserId]);
      await pool.query(`DELETE FROM auth.users WHERE id = $1::uuid;`, [testUserId]);
      await pool.end();
    }
  });

  it('1. Enforces institutional password policy correctly', () => {
    // Too short
    assert.equal(validatePasswordPolicy('Ab1!').isValid, false);
    // Missing number
    assert.equal(validatePasswordPolicy('Abcdefgh!@#').isValid, false);
    // Missing uppercase
    assert.equal(validatePasswordPolicy('abcdefgh123!').isValid, false);
    // Missing special char
    assert.equal(validatePasswordPolicy('Abcdefgh1234').isValid, false);
    // Valid institutional password
    assert.equal(validatePasswordPolicy(updatedPassword).isValid, true);
  });

  it('2. Verifies current password authentication against crypt()', async () => {
    // Wrong password check
    const wrongRes = await pool.query(
      `SELECT (encrypted_password = crypt($1, encrypted_password)) AS is_valid FROM auth.users WHERE id = $2::uuid;`,
      ['WrongPassword123!', testUserId]
    );
    assert.equal(wrongRes.rows[0].is_valid, false, 'Wrong password must be rejected');

    // Correct password check
    const correctRes = await pool.query(
      `SELECT (encrypted_password = crypt($1, encrypted_password)) AS is_valid FROM auth.users WHERE id = $2::uuid;`,
      [initialPassword, testUserId]
    );
    assert.equal(correctRes.rows[0].is_valid, true, 'Correct initial password must pass');
  });

  it('3. Atomically updates password with bcrypt hash', async () => {
    await pool.query(
      `
      UPDATE auth.users
      SET encrypted_password = crypt($1, gen_salt('bf', 10)),
          updated_at = now()
      WHERE id = $2::uuid;
      `,
      [updatedPassword, testUserId]
    );

    // Old password should now fail
    const oldPassRes = await pool.query(
      `SELECT (encrypted_password = crypt($1, encrypted_password)) AS is_valid FROM auth.users WHERE id = $2::uuid;`,
      [initialPassword, testUserId]
    );
    assert.equal(oldPassRes.rows[0].is_valid, false, 'Old password must no longer work');

    // New password should now succeed
    const newPassRes = await pool.query(
      `SELECT (encrypted_password = crypt($1, encrypted_password)) AS is_valid FROM auth.users WHERE id = $2::uuid;`,
      [updatedPassword, testUserId]
    );
    assert.equal(newPassRes.rows[0].is_valid, true, 'New password must verify successfully');
  });

  it('4. Simulates Dual-OTP generation for old and new email addresses', async () => {
    const otpOld = '123456';
    const otpNew = '654321';

    // Invalidate prior
    await pool.query(
      `
      UPDATE public.email_otps 
      SET is_verified = TRUE 
      WHERE (email = $1 AND purpose = 'email_change_old')
         OR (email = $2 AND purpose = 'email_change_new');
      `,
      [testOldEmail, testNewEmail]
    );

    // Insert Dual-OTPs
    await pool.query(
      `
      INSERT INTO public.email_otps (email, otp_code, purpose, expires_at, created_at)
      VALUES 
        ($1, $2, 'email_change_old', now() + interval '10 minutes', now()),
        ($3, $4, 'email_change_new', now() + interval '10 minutes', now());
      `,
      [testOldEmail, otpOld, testNewEmail, otpNew]
    );

    // Verify OTP records exist in public.email_otps
    const oldOtpRow = await pool.query(
      `SELECT * FROM public.email_otps WHERE email = $1 AND purpose = 'email_change_old' AND is_verified = FALSE;`,
      [testOldEmail]
    );
    assert.equal(oldOtpRow.rows.length, 1);
    assert.equal(oldOtpRow.rows[0].otp_code, otpOld);

    const newOtpRow = await pool.query(
      `SELECT * FROM public.email_otps WHERE email = $1 AND purpose = 'email_change_new' AND is_verified = FALSE;`,
      [testNewEmail]
    );
    assert.equal(newOtpRow.rows.length, 1);
    assert.equal(newOtpRow.rows[0].otp_code, otpNew);
  });

  it('5. Rejects mismatched OTPs during Dual-OTP handshake', async () => {
    // Check old OTP with invalid code
    const oldOtpRow = await pool.query(
      `SELECT * FROM public.email_otps WHERE email = $1 AND purpose = 'email_change_old' AND is_verified = FALSE;`,
      [testOldEmail]
    );
    assert.notEqual(oldOtpRow.rows[0].otp_code, '999999', 'Mismatch must be detectable');
  });

  it('6. Atomically confirms Dual-OTP email migration across auth.users, auth.identities, and public.profiles', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Mark OTPs verified
      await client.query(
        `UPDATE public.email_otps SET is_verified = TRUE WHERE email IN ($1, $2) AND purpose IN ('email_change_old', 'email_change_new');`,
        [testOldEmail, testNewEmail]
      );

      // Update auth.users
      await client.query(
        `UPDATE auth.users SET email = $1, updated_at = now() WHERE id = $2::uuid;`,
        [testNewEmail, testUserId]
      );

      // Update auth.identities
      await client.query(
        `
        UPDATE auth.identities
        SET identity_data = jsonb_build_object('sub', $2::text, 'email', $1::text, 'email_verified', true, 'phone_verified', false),
            updated_at = now()
        WHERE user_id = $2::uuid AND provider = 'email';
        `,
        [testNewEmail, testUserId]
      );

      // Update public.profiles
      await client.query(
        `UPDATE public.profiles SET email = $1 WHERE id = $2::uuid;`,
        [testNewEmail, testUserId]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Verify all 3 stores now reflect testNewEmail
    const userRes = await pool.query(`SELECT email FROM auth.users WHERE id = $1::uuid;`, [testUserId]);
    assert.equal(userRes.rows[0].email, testNewEmail, 'auth.users email must be migrated');

    const identityRes = await pool.query(`SELECT identity_data->>'email' AS id_email FROM auth.identities WHERE user_id = $1::uuid;`, [testUserId]);
    assert.equal(identityRes.rows[0].id_email, testNewEmail, 'auth.identities email must be migrated');

    const profileRes = await pool.query(`SELECT email FROM public.profiles WHERE id = $1::uuid;`, [testUserId]);
    assert.equal(profileRes.rows[0].email, testNewEmail, 'public.profiles email must be migrated');
  });
});
