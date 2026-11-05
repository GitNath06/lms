import { getPgPool } from '../lib/db.ts'

async function fixTriggerAndResetOtp() {
  const pool = getPgPool()
  const client = await pool.connect()
  try {
    console.log('1. Updating public.protect_profile_escalation() function...')
    await client.query(`
      CREATE OR REPLACE FUNCTION public.protect_profile_escalation()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Bypass check for direct database pool / superuser / service_role connections (server actions)
        IF current_user IN ('postgres', 'supabase_admin') 
           OR (current_setting('request.jwt.claim.role', true) = 'service_role') 
           OR auth.uid() IS NULL THEN
          RETURN NEW;
        END IF;

        -- For authenticated client sessions (e.g. Supabase REST API), verify Super Admin role
        IF (OLD.role IS DISTINCT FROM NEW.role OR OLD.approval_status IS DISTINCT FROM NEW.approval_status) THEN
          IF NOT EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'super_admin' AND is_active = true
          ) THEN
            RAISE EXCEPTION 'Access Denied: Only Super Administrators can alter user roles or approval statuses.';
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `)
    console.log('✓ protect_profile_escalation updated.')

    console.log('\n2. Updating public.handle_new_user() trigger function...')
    await client.query(`
      CREATE OR REPLACE FUNCTION public.handle_new_user()
      RETURNS TRIGGER AS $$
      BEGIN
        INSERT INTO public.profiles (
          id,
          email,
          phone,
          full_name,
          role,
          department,
          approval_status,
          is_active,
          permissions
        ) VALUES (
          new.id,
          new.email,
          new.raw_user_meta_data->>'phone',
          coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
          coalesce(new.raw_user_meta_data->>'role', 'teacher'),
          coalesce(new.raw_user_meta_data->>'department', 'Science Department'),
          coalesce(new.raw_user_meta_data->>'approval_status', 'pending'),
          true,
          '{}'::jsonb
        )
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          phone = coalesce(EXCLUDED.phone, public.profiles.phone),
          full_name = EXCLUDED.full_name,
          role = coalesce(public.profiles.role, EXCLUDED.role),
          department = coalesce(public.profiles.department, EXCLUDED.department),
          approval_status = coalesce(public.profiles.approval_status, EXCLUDED.approval_status);
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `)
    console.log('✓ handle_new_user updated.')

    console.log('\n3. Resetting OTP for dnathshah11@gmail.com so code 946287 can be submitted immediately...')
    const otpRes = await client.query(`
      UPDATE public.email_otps
      SET is_verified = FALSE,
          attempts = 0,
          expires_at = now() + INTERVAL '30 minutes'
      WHERE email = 'dnathshah11@gmail.com'
      RETURNING id, email, otp_code, is_verified, expires_at;
    `)
    console.log('✓ Reset OTP result:', otpRes.rows)
  } catch (err) {
    console.error('Error fixing triggers:', err)
  } finally {
    client.release()
    await pool.end()
  }
}

fixTriggerAndResetOtp()
