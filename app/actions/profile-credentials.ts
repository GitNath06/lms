'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getPgPool } from '@/lib/db'
import { validatePasswordPolicy } from '@/lib/auth-policy'
import { invalidateUserProfileCache } from '@/app/actions/auth'
import {
  sendOldEmailChangeSecurityOtp,
  sendNewEmailChangeVerificationOtp,
} from '@/lib/mailer'
import { recordAuditEvent } from '@/lib/audit/audit-ledger'

function generateNumericOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * 1. Self-Service Change Password Action
 * Requires current password verification, institutional policy compliance, and audit tracking.
 */
export async function changeCurrentPassword(payload: {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized: Session not found. Please sign in.' }
    }

    const { currentPassword, newPassword, confirmPassword } = payload

    if (!currentPassword || !newPassword || !confirmPassword) {
      return { success: false, error: 'All password fields are required.' }
    }

    if (newPassword !== confirmPassword) {
      return { success: false, error: 'New password and confirmation password do not match.' }
    }

    if (currentPassword === newPassword) {
      return { success: false, error: 'New password must be different from your current password.' }
    }

    // Validate institutional password policy
    const policyResult = validatePasswordPolicy(newPassword)
    if (!policyResult.isValid) {
      return {
        success: false,
        error: `Password requirement not met: ${policyResult.errors.join(', ')}.`,
      }
    }

    const pool = getPgPool()

    // Verify current password against encrypted_password in auth.users
    const checkRes = await pool.query<{ is_valid: boolean }>(
      `
      SELECT (encrypted_password = crypt($1, encrypted_password)) AS is_valid
      FROM auth.users
      WHERE id = $2::uuid;
      `,
      [currentPassword, user.id]
    )

    if (checkRes.rows.length === 0 || !checkRes.rows[0].is_valid) {
      return { success: false, error: 'Incorrect current password. Verification failed.' }
    }

    // Atomically update password in auth.users
    await pool.query(
      `
      UPDATE auth.users
      SET encrypted_password = crypt($1, gen_salt('bf', 10)),
          updated_at = now()
      WHERE id = $2::uuid;
      `,
      [newPassword, user.id]
    )

    // Record forensic audit event
    await recordAuditEvent({
      action: 'UPDATE',
      entityType: 'policy',
      entityId: user.id,
      entityLabel: `Account Password Update: ${user.email}`,
      metadata: {
        operation: 'self_service_password_change',
        account_email: user.email,
        timestamp: new Date().toISOString(),
      },
    }).catch((e) => console.warn('Audit ledger logging non-fatal fallback:', e))

    invalidateUserProfileCache(user.id)
    revalidatePath('/profile')

    return {
      success: true,
      message: 'Your institutional password has been updated successfully.',
    }
  } catch (err: any) {
    console.error('Error changing password:', err)
    return { success: false, error: err.message || 'Failed to update password.' }
  }
}

/**
 * 2. Step 1: Initiate Dual-OTP Email Change Handshake
 * - Re-authenticates with current password
 * - Validates new email format & checks for duplicate accounts
 * - Dispatches OTP to OLD email (Security Authorization) AND NEW email (Ownership Verification)
 */
export async function initiateDualOtpEmailChange(payload: {
  currentPassword: string
  newEmail: string
}): Promise<{
  success: boolean
  error?: string
  currentEmail?: string
  newEmail?: string
  devOtpOld?: string
  devOtpNew?: string
}> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || !user.email) {
      return { success: false, error: 'Unauthorized: Session not found.' }
    }

    const { currentPassword, newEmail: rawNewEmail } = payload
    const newEmail = rawNewEmail?.trim().toLowerCase()
    const currentEmail = user.email.toLowerCase()

    if (!currentPassword) {
      return { success: false, error: 'Current password is required to request an email change.' }
    }

    if (!newEmail) {
      return { success: false, error: 'Please enter a valid new institutional email address.' }
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail)) {
      return { success: false, error: 'Please provide a valid email address format.' }
    }

    if (newEmail === currentEmail) {
      return { success: false, error: 'The new email address cannot be the same as your current email.' }
    }

    const pool = getPgPool()

    // 1. Verify current password
    const checkRes = await pool.query<{ is_valid: boolean; full_name: string }>(
      `
      SELECT 
        (u.encrypted_password = crypt($1, u.encrypted_password)) AS is_valid,
        COALESCE(p.full_name, 'Faculty Member') AS full_name
      FROM auth.users u
      LEFT JOIN public.profiles p ON p.id = u.id
      WHERE u.id = $2::uuid;
      `,
      [currentPassword, user.id]
    )

    if (checkRes.rows.length === 0 || !checkRes.rows[0].is_valid) {
      return { success: false, error: 'Incorrect current password. Verification failed.' }
    }

    const fullName = checkRes.rows[0].full_name

    // 2. Check if new email is already registered
    const dupCheck = await pool.query(`SELECT id FROM auth.users WHERE email = $1;`, [newEmail])
    if (dupCheck.rows.length > 0) {
      return { success: false, error: 'An account with this email address already exists in the institution.' }
    }

    // 3. Invalidate prior unverified email_change OTPs for both addresses
    await pool.query(
      `
      UPDATE public.email_otps 
      SET is_verified = TRUE 
      WHERE (email = $1 AND purpose = 'email_change_old')
         OR (email = $2 AND purpose = 'email_change_new');
      `,
      [currentEmail, newEmail]
    )

    // 4. Generate two separate 6-digit codes
    const otpOld = generateNumericOtp()
    const otpNew = generateNumericOtp()

    // 5. Store in public.email_otps with 10-minute validity
    await pool.query(
      `
      INSERT INTO public.email_otps (email, otp_code, purpose, expires_at, created_at)
      VALUES 
        ($1, $2, 'email_change_old', now() + interval '10 minutes', now()),
        ($3, $4, 'email_change_new', now() + interval '10 minutes', now());
      `,
      [currentEmail, otpOld, newEmail, otpNew]
    )

    // 6. Dispatch emails to BOTH inboxes
    await Promise.all([
      sendOldEmailChangeSecurityOtp(currentEmail, fullName, otpOld, newEmail),
      sendNewEmailChangeVerificationOtp(newEmail, fullName, otpNew),
    ])

    return {
      success: true,
      currentEmail,
      newEmail,
      devOtpOld: process.env.NODE_ENV !== 'production' ? otpOld : undefined,
      devOtpNew: process.env.NODE_ENV !== 'production' ? otpNew : undefined,
    }
  } catch (err: any) {
    console.error('Error initiating email change:', err)
    return { success: false, error: err.message || 'Failed to initiate email change.' }
  }
}

/**
 * 3. Step 2: Confirm Dual-OTP Email Change Handshake
 * - Validates BOTH OTP codes simultaneously
 * - Atomically migrates auth.users, auth.identities, and public.profiles in a single transaction
 * - Records forensic audit event
 */
export async function confirmDualOtpEmailChange(payload: {
  currentPassword: string
  newEmail: string
  oldEmailOtp: string
  newEmailOtp: string
}): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || !user.email) {
      return { success: false, error: 'Unauthorized: Session not found.' }
    }

    const { currentPassword, newEmail: rawNewEmail, oldEmailOtp: rawOldOtp, newEmailOtp: rawNewOtp } = payload
    const newEmail = rawNewEmail?.trim().toLowerCase()
    const currentEmail = user.email.toLowerCase()
    const oldOtp = rawOldOtp?.trim()
    const newOtp = rawNewOtp?.trim()

    if (!oldOtp || !newOtp) {
      return { success: false, error: 'Both verification codes (from current and new emails) are required.' }
    }

    const pool = getPgPool()
    const client = await pool.connect()

    try {
      // 1. Re-verify password
      const passCheck = await client.query<{ is_valid: boolean }>(
        `
        SELECT (encrypted_password = crypt($1, encrypted_password)) AS is_valid
        FROM auth.users
        WHERE id = $2::uuid;
        `,
        [currentPassword, user.id]
      )

      if (passCheck.rows.length === 0 || !passCheck.rows[0].is_valid) {
        return { success: false, error: 'Session authentication failed. Please re-enter your password.' }
      }

      // 2. Validate Old Email OTP (Security Authorization)
      const oldOtpRes = await client.query<{ id: string; otp_code: string; attempts: number }>(
        `
        SELECT id, otp_code, attempts
        FROM public.email_otps
        WHERE email = $1 
          AND purpose = 'email_change_old' 
          AND is_verified = FALSE 
          AND expires_at > now()
        ORDER BY created_at DESC
        LIMIT 1;
        `,
        [currentEmail]
      )

      if (oldOtpRes.rows.length === 0) {
        return { success: false, error: 'The code for your current email has expired or is invalid. Please request fresh codes.' }
      }

      const oldRec = oldOtpRes.rows[0]
      if (oldRec.attempts >= 5) {
        return { success: false, error: 'Too many incorrect attempts on current email code. Please request fresh codes.' }
      }

      if (oldRec.otp_code !== oldOtp) {
        await client.query(`UPDATE public.email_otps SET attempts = attempts + 1 WHERE id = $1;`, [oldRec.id])
        return { success: false, error: 'Invalid authorization code for your current email address.' }
      }

      // 3. Validate New Email OTP (Destination Verification)
      const newOtpRes = await client.query<{ id: string; otp_code: string; attempts: number }>(
        `
        SELECT id, otp_code, attempts
        FROM public.email_otps
        WHERE email = $1 
          AND purpose = 'email_change_new' 
          AND is_verified = FALSE 
          AND expires_at > now()
        ORDER BY created_at DESC
        LIMIT 1;
        `,
        [newEmail]
      )

      if (newOtpRes.rows.length === 0) {
        return { success: false, error: 'The verification code for your new email has expired or is invalid. Please request fresh codes.' }
      }

      const newRec = newOtpRes.rows[0]
      if (newRec.attempts >= 5) {
        return { success: false, error: 'Too many incorrect attempts on new email code. Please request fresh codes.' }
      }

      if (newRec.otp_code !== newOtp) {
        await client.query(`UPDATE public.email_otps SET attempts = attempts + 1 WHERE id = $1;`, [newRec.id])
        return { success: false, error: 'Invalid verification code for your new email address.' }
      }

      // 4. Atomic Execution Transaction
      await client.query('BEGIN')

      // Mark both OTPs verified
      await client.query(`UPDATE public.email_otps SET is_verified = TRUE WHERE id IN ($1, $2);`, [oldRec.id, newRec.id])

      // Update auth.users
      await client.query(
        `
        UPDATE auth.users
        SET email = $1,
            updated_at = now()
        WHERE id = $2::uuid;
        `,
        [newEmail, user.id]
      )

      // Update auth.identities
      await client.query(
        `
        UPDATE auth.identities
        SET identity_data = jsonb_build_object('sub', $2::text, 'email', $1::text, 'email_verified', true, 'phone_verified', false),
            updated_at = now()
        WHERE user_id = $2::uuid AND provider = 'email';
        `,
        [newEmail, user.id]
      )

      // Update public.profiles
      await client.query(
        `
        UPDATE public.profiles
        SET email = $1
        WHERE id = $2::uuid;
        `,
        [newEmail, user.id]
      )

      await client.query('COMMIT')

      // Record forensic audit event
      await recordAuditEvent({
        action: 'UPDATE',
        entityType: 'policy',
        entityId: user.id,
        entityLabel: `Dual-OTP Email Transfer: ${currentEmail} -> ${newEmail}`,
        metadata: {
          operation: 'self_service_dual_otp_email_change',
          old_email: currentEmail,
          new_email: newEmail,
          timestamp: new Date().toISOString(),
        },
      }).catch((e) => console.warn('Audit ledger logging non-fatal fallback:', e))

      invalidateUserProfileCache(user.id)
      revalidatePath('/profile')
      revalidatePath('/', 'layout')

      return {
        success: true,
        message: `Institutional email successfully updated to ${newEmail}.`,
      }
    } catch (txErr: any) {
      await client.query('ROLLBACK')
      throw txErr
    } finally {
      client.release()
    }
  } catch (err: any) {
    console.error('Error confirming email change:', err)
    return { success: false, error: err.message || 'Failed to confirm email change.' }
  }
}
