'use server'

import { after } from 'next/server'
import pg from 'pg'
import { sendVerificationOtpEmail, sendPasswordResetOtpEmail } from '@/lib/mailer'
import { DEFAULT_ROLE_PERMISSIONS, UserRole } from '@/lib/permissions'
import { dispatchNewUserRegistrationAlert } from '@/app/actions/notifications'

function getPgClient() {
  return new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
}

function generateNumericOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * 1. Generate & Send OTP for Signup Verification
 */
export async function generateAndSendSignupOtp(emailRaw: string, fullNameRaw: string) {
  const email = emailRaw?.trim().toLowerCase()
  const fullName = fullNameRaw?.trim()

  if (!email || !fullName) {
    return { error: 'Please provide both your full name and institutional email.' }
  }

  // Basic email pattern check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { error: 'Please provide a valid email address.' }
  }

  const client = getPgClient()
  try {
    await client.connect()

    // Check if account already exists
    const existing = await client.query(`SELECT id FROM auth.users WHERE email = $1`, [email])
    if (existing.rows.length > 0) {
      await client.end()
      return { error: 'An account with this email address already exists. Please sign in instead.' }
    }

    const otpCode = generateNumericOtp()

    // Invalidate any existing unused signup OTPs for this email
    await client.query(
      `UPDATE public.email_otps SET is_verified = TRUE WHERE email = $1 AND purpose = 'signup'`,
      [email]
    )

    // Insert new OTP with 10-minute validity
    await client.query(
      `
      INSERT INTO public.email_otps (email, otp_code, purpose, expires_at, created_at)
      VALUES ($1, $2, 'signup', now() + interval '10 minutes', now());
      `,
      [email, otpCode]
    )

    await client.end()

    // Send email via mailer
    const mailRes = await sendVerificationOtpEmail(email, fullName, otpCode)

    return {
      success: true,
      message: `A 6-digit verification code has been sent to ${email}.`,
      devOtp: mailRes.mode === 'dev-preview' ? otpCode : undefined,
    }
  } catch (err: any) {
    console.error('Error generating signup OTP:', err)
    try { await client.end() } catch {}
    return { error: err.message || 'Failed to dispatch verification code. Please try again.' }
  }
}

/**
 * 2. Verify Signup OTP & Create Pending Account
 */
export async function verifySignupAndCreateAccount(formData: FormData, otpCodeRaw: string) {
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const password = formData.get('password') as string
  const fullName = (formData.get('full_name') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim() || null
  const department = (formData.get('department') as string)?.trim() || 'Science Department'
  const otpCode = otpCodeRaw?.trim()

  if (!email || !password || !fullName || !otpCode) {
    return { error: 'All fields including the 6-digit verification code are required.' }
  }

  if (password.length < 6) {
    return { error: 'Password must be at least 6 characters long.' }
  }

  const client = getPgClient()
  try {
    await client.connect()

    // Verify OTP
    const otpRes = await client.query(
      `
      SELECT id, otp_code, attempts, expires_at
      FROM public.email_otps
      WHERE email = $1 AND purpose = 'signup' AND is_verified = FALSE
      ORDER BY created_at DESC
      LIMIT 1;
      `,
      [email]
    )

    if (otpRes.rows.length === 0) {
      await client.end()
      return { error: 'No active verification code found. Please request a new code.' }
    }

    const record = otpRes.rows[0]

    // Check expiration
    if (new Date(record.expires_at) < new Date()) {
      await client.end()
      return { error: 'Verification code has expired. Please request a fresh code.' }
    }

    // Check attempts (max 5)
    if (record.attempts >= 5) {
      await client.end()
      return { error: 'Too many incorrect attempts. Please request a new verification code.' }
    }

    // Check match
    if (record.otp_code !== otpCode) {
      await client.query(`UPDATE public.email_otps SET attempts = attempts + 1 WHERE id = $1`, [record.id])
      await client.end()
      return { error: 'Invalid verification code. Please check your email and enter the 6-digit code.' }
    }

    // Mark OTP as verified
    await client.query(`UPDATE public.email_otps SET is_verified = TRUE WHERE id = $1`, [record.id])

    // Double check email uniqueness
    const userCheck = await client.query(`SELECT id FROM auth.users WHERE email = $1`, [email])
    if (userCheck.rows.length > 0) {
      await client.end()
      return { error: 'This email is already registered. Please sign in.' }
    }

    const defaultPerms = DEFAULT_ROLE_PERMISSIONS.teacher
    const role: UserRole = 'teacher'

    await client.query('BEGIN')

    // Create user in auth.users
    const userRes = await client.query(
      `
      INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change,
        is_sso_user,
        is_anonymous,
        created_at,
        updated_at
      ) VALUES (
        '00000000-0000-0000-0000-000000000000'::uuid,
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        $1,
        crypt($2, gen_salt('bf', 10)),
        now(),
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        jsonb_build_object('full_name', $3::text, 'role', $4::text, 'department', $5::text, 'email_verified', true),
        '',
        '',
        '',
        '',
        false,
        false,
        now(),
        now()
      ) RETURNING id;
      `,
      [email, password, fullName, role, department]
    )

    const userId = userRes.rows[0].id

    // Insert identity (explicit $1::uuid to prevent PostgreSQL parameter deduction type mismatch)
    await client.query(
      `
      INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        $1::uuid,
        jsonb_build_object('sub', $1::text, 'email', $2::text, 'email_verified', true, 'phone_verified', false),
        'email',
        $1::text,
        now(),
        now(),
        now()
      );
      `,
      [userId, email]
    )

    // Insert profile with approval_status = 'pending' and is_active = FALSE
    await client.query(
      `
      INSERT INTO public.profiles (
        id,
        email,
        phone,
        full_name,
        role,
        department,
        is_active,
        approval_status,
        permissions,
        created_at
      ) VALUES (
        $1::uuid,
        $2,
        $3,
        $4,
        $5,
        $6,
        FALSE,
        'pending',
        $7::jsonb,
        now()
      )
      ON CONFLICT (id) DO UPDATE SET
        phone = EXCLUDED.phone,
        approval_status = 'pending',
        is_active = FALSE;
      `,
      [userId, email, phone, fullName, role, department, JSON.stringify(defaultPerms)]
    )

    // Insert notification for super_admin and lab_incharge
    const notifAdminId = `notif-reg-admin-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
    const notifInchargeId = `notif-reg-incharge-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`

    await client.query(
      `
      INSERT INTO public.lab_notifications (id, target_role, title, message, severity, is_read, created_at)
      VALUES 
      ($1, 'super_admin', $2, $3, 'warning', false, now()),
      ($4, 'lab_incharge', $5, $6, 'info', false, now());
      `,
      [
        notifAdminId,
        `New Teacher Registration: ${fullName}`,
        `${fullName} (${email}, Department: ${department}) has verified their email and is awaiting Super Admin approval.`,
        notifInchargeId,
        `New Teacher Registration: ${fullName}`,
        `${fullName} (${email}, Department: ${department}) has registered for laboratory practical access.`,
      ]
    )

    await client.query('COMMIT')
    await client.end()

    // Non-blocking background notification to Super Admins & Lab In-Charges
    after(async () => {
      await dispatchNewUserRegistrationAlert({
        fullName,
        email,
        role,
        registeredAt: new Date().toLocaleString(),
      }).catch((err) =>
        console.error('[Mailer] Background new user admin notification failed:', err)
      )
    })

    return {
      success: true,
      pendingApproval: true,
      message: 'Email Verified! Your application is pending Super Admin review. You will receive access once approved.',
    }
  } catch (err: any) {
    console.error('Error verifying signup OTP:', err)
    try {
      await client.query('ROLLBACK')
      await client.end()
    } catch {}
    return { error: err.message || 'Failed to complete registration.' }
  }
}

/**
 * 3. Generate & Send OTP for Password Reset
 */
export async function generateAndSendPasswordResetOtp(emailRaw: string) {
  const email = emailRaw?.trim().toLowerCase()

  if (!email) {
    return { error: 'Please enter your institutional email.' }
  }

  const client = getPgClient()
  try {
    await client.connect()

    // Verify account exists
    const userRes = await client.query(
      `
      SELECT u.id, p.full_name
      FROM auth.users u
      LEFT JOIN public.profiles p ON p.id = u.id
      WHERE u.email = $1
      `,
      [email]
    )

    if (userRes.rows.length === 0) {
      await client.end()
      return { error: 'No institutional account registered with this email address.' }
    }

    const fullName = userRes.rows[0].full_name || 'Faculty Member'
    const otpCode = generateNumericOtp()

    // Invalidate old reset OTPs
    await client.query(
      `UPDATE public.email_otps SET is_verified = TRUE WHERE email = $1 AND purpose = 'reset_password'`,
      [email]
    )

    // Insert new OTP
    await client.query(
      `
      INSERT INTO public.email_otps (email, otp_code, purpose, expires_at, created_at)
      VALUES ($1, $2, 'reset_password', now() + interval '10 minutes', now());
      `,
      [email, otpCode]
    )

    await client.end()

    const mailRes = await sendPasswordResetOtpEmail(email, fullName, otpCode)

    return {
      success: true,
      message: `Password reset code sent to ${email}.`,
      devOtp: mailRes.mode === 'dev-preview' ? otpCode : undefined,
    }
  } catch (err: any) {
    console.error('Error in sendPasswordResetOtp:', err)
    try { await client.end() } catch {}
    return { error: err.message || 'Failed to send reset code.' }
  }
}

/**
 * 4. Verify Password Reset OTP & Set New Password
 */
export async function verifyAndResetPassword(emailRaw: string, otpCodeRaw: string, newPasswordRaw: string) {
  const email = emailRaw?.trim().toLowerCase()
  const otpCode = otpCodeRaw?.trim()
  const newPassword = newPasswordRaw

  if (!email || !otpCode || !newPassword) {
    return { error: 'Email, verification code, and new password are required.' }
  }

  if (newPassword.length < 6) {
    return { error: 'New password must be at least 6 characters long.' }
  }

  const client = getPgClient()
  try {
    await client.connect()

    const otpRes = await client.query(
      `
      SELECT id, otp_code, attempts, expires_at
      FROM public.email_otps
      WHERE email = $1 AND purpose = 'reset_password' AND is_verified = FALSE
      ORDER BY created_at DESC
      LIMIT 1;
      `,
      [email]
    )

    if (otpRes.rows.length === 0) {
      await client.end()
      return { error: 'No active password recovery request found. Please request a new code.' }
    }

    const record = otpRes.rows[0]

    if (new Date(record.expires_at) < new Date()) {
      await client.end()
      return { error: 'Recovery code has expired. Please request a new one.' }
    }

    if (record.attempts >= 5) {
      await client.end()
      return { error: 'Too many incorrect attempts. Please request a new code.' }
    }

    if (record.otp_code !== otpCode) {
      await client.query(`UPDATE public.email_otps SET attempts = attempts + 1 WHERE id = $1`, [record.id])
      await client.end()
      return { error: 'Invalid verification code.' }
    }

    // Mark OTP as verified
    await client.query(`UPDATE public.email_otps SET is_verified = TRUE WHERE id = $1`, [record.id])

    // Update password in auth.users
    await client.query(
      `
      UPDATE auth.users
      SET encrypted_password = crypt($1, gen_salt('bf', 10)),
          updated_at = now()
      WHERE email = $2;
      `,
      [newPassword, email]
    )

    await client.end()

    return {
      success: true,
      message: 'Password successfully updated! You can now sign in with your new credentials.',
    }
  } catch (err: any) {
    console.error('Error in verifyAndResetPassword:', err)
    try { await client.end() } catch {}
    return { error: err.message || 'Failed to reset password.' }
  }
}
