'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import pg from 'pg'

import {
  UserRole,
  UserPermissions,
  UserProfile,
  DEFAULT_ROLE_PERMISSIONS,
} from '@/lib/permissions'
import { sendAccountApprovedEmail } from '@/lib/mailer'
import { getPgPool } from '@/lib/db'
import { recordAuditEvent } from '@/lib/audit'

function getPgClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured.')
  }
  return new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })
}

export type { UserRole, UserPermissions, UserProfile }

// Server-side in-memory profile cache with TTL
const userProfileCache = new Map<string, { profile: UserProfile; timestamp: number }>()

export async function invalidateUserProfileCache(userId?: string) {
  if (userId) {
    userProfileCache.delete(userId)
  } else {
    userProfileCache.clear()
  }
}

// 1. Sign In Action
export async function signIn(formData: FormData) {
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email and password are required.' }
  }

  if (!isSupabaseConfigured()) {
    revalidatePath('/', 'layout')
    redirect('/')
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  // Check if account is active and approved in profiles via direct DB query (bypasses RLS)
  if (data.user) {
    let profile: any = null
    try {
      const pool = getPgPool()
      const res = await pool.query(
        `SELECT is_active, role, full_name, approval_status FROM public.profiles WHERE id = $1`,
        [data.user.id]
      )
      profile = res.rows[0]
    } catch (e) {
      console.error('Error fetching profile during signIn:', e)
    }

    if (profile) {
      if (profile.approval_status === 'pending') {
        await supabase.auth.signOut()
        return {
          error:
            'Your account is pending Super Admin approval. Please await administrator verification.',
        }
      }

      if (profile.approval_status === 'rejected') {
        await supabase.auth.signOut()
        return {
          error:
            'Your account registration was not approved by the Administrator. Please contact the IT office.',
        }
      }

      if (profile.is_active === false) {
        await supabase.auth.signOut()
        return {
          error:
            'Your account has been deactivated by the Administrator. Please contact the IT/Super Admin office.',
        }
      }
    } else {
      await supabase.auth.signOut()
      return {
        error:
          'Your account is pending Super Admin approval. Please await administrator verification.',
      }
    }
  }

  // Determine post-login destination
  const rawRedirect = (formData.get('redirect') as string) || (formData.get('next') as string) || '/'
  const targetUrl = rawRedirect.startsWith('/') && !rawRedirect.startsWith('/login') ? rawRedirect : '/'

  revalidatePath('/', 'layout')
  redirect(targetUrl)
}

// 2. Teacher / Staff Self-Registration
export async function signUp(formData: FormData) {
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const password = formData.get('password') as string
  const fullName = (formData.get('full_name') as string)?.trim()
  const department = (formData.get('department') as string)?.trim() || 'Science Department'
  const role: UserRole = 'teacher'

  if (!email || !password || !fullName) {
    return { error: 'Please provide full name, institutional email, and password.' }
  }

  if (!isSupabaseConfigured()) {
    revalidatePath('/', 'layout')
    redirect('/')
  }

  try {
    const client = getPgClient()
    await client.connect()

    // Check if user already exists
    const existing = await client.query(`SELECT id FROM auth.users WHERE email = $1`, [email])
    if (existing.rows.length > 0) {
      await client.end()
      return { error: 'An account with this institutional email already exists. Please sign in.' }
    }

    const defaultPerms = DEFAULT_ROLE_PERMISSIONS.teacher

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

    // Insert identity
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
        full_name,
        role,
        department,
        is_active,
        approval_status,
        permissions,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, FALSE, 'pending', $6, now())
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        department = EXCLUDED.department,
        is_active = FALSE,
        approval_status = 'pending';
      `,
      [userId, email, fullName, role, department, JSON.stringify(defaultPerms)]
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
        `${fullName} (${email}, Department: ${department}) has registered and requires Super Admin approval.`,
        notifInchargeId,
        `New Teacher Registration: ${fullName}`,
        `${fullName} (${email}, Department: ${department}) has registered for laboratory practical access.`,
      ]
    )

    await client.end()

    return {
      success: true,
      pendingApproval: true,
      message: 'Your account is pending Super Admin approval. Please await administrator verification.',
    }
  } catch (err: any) {
    return { error: err.message || 'Failed to complete registration.' }
  }
}

// 3. Sign Out Action
export async function signOut() {
  invalidateUserProfileCache()
  if (isSupabaseConfigured()) {
    const supabase = await createClient()
    await supabase.auth.signOut()
  }
  revalidatePath('/', 'layout')
  redirect('/login')
}

// 4. Get Current User Profile with Permissions
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  if (!isSupabaseConfigured()) {
    return {
      id: 'local-admin',
      email: 'admin@rrl.edu.np',
      full_name: 'System Administrator',
      role: 'super_admin',
      department: 'Central Administration',
      is_active: true,
      permissions: DEFAULT_ROLE_PERMISSIONS.super_admin,
      created_at: new Date().toISOString(),
    }
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return null

    // Check in-memory cache
    const cached = userProfileCache.get(user.id)
    if (cached && Date.now() - cached.timestamp < 30000) {
      return cached.profile
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    let result: UserProfile

    if (error || !profile) {
      const metaRole = (user.user_metadata?.role as UserRole) || 'teacher'
      result = {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Teacher',
        role: metaRole,
        department: user.user_metadata?.department || 'Science Department',
        is_active: true,
        permissions: DEFAULT_ROLE_PERMISSIONS[metaRole] || DEFAULT_ROLE_PERMISSIONS.teacher,
        created_at: user.created_at,
      }
    } else {
      const typedProfile = profile as any
      const finalRole: UserRole =
        typedProfile.role === 'admin' ? 'super_admin' : typedProfile.role || 'teacher'

      result = {
        id: typedProfile.id,
        email: typedProfile.email || user.email,
        phone: typedProfile.phone || null,
        full_name: typedProfile.full_name,
        role: finalRole,
        department: typedProfile.department,
        is_active: typedProfile.is_active ?? true,
        permissions: typedProfile.permissions || DEFAULT_ROLE_PERMISSIONS[finalRole],
        created_at: typedProfile.created_at,
      }
    }

    userProfileCache.set(user.id, { profile: result, timestamp: Date.now() })
    return result
  } catch (e) {
    return {
      id: 'local-user',
      email: 'teacher@rrl.edu.np',
      full_name: 'Class Teacher',
      role: 'teacher',
      department: 'Science Department',
      is_active: true,
      permissions: DEFAULT_ROLE_PERMISSIONS.teacher,
      created_at: new Date().toISOString(),
    }
  }
}

// 5. SUPER ADMIN: Get All Users
export async function getAllUsers(): Promise<UserProfile[]> {
  try {
    const pool = getPgPool()

    const res = await pool.query(`
      SELECT id, email, phone, full_name, role, department, is_active, approval_status, permissions, created_at
      FROM public.profiles
      ORDER BY created_at DESC;
    `)

    return res.rows.map((row) => ({
      id: row.id,
      email: row.email,
      phone: row.phone || null,
      full_name: row.full_name,
      role: row.role === 'admin' ? 'super_admin' : row.role,
      department: row.department,
      is_active: row.is_active ?? true,
      approval_status: row.approval_status || 'approved',
      permissions: row.permissions || DEFAULT_ROLE_PERMISSIONS[row.role as UserRole],
      created_at: row.created_at,
    }))
  } catch (err) {
    console.error('Failed to get users:', err)
    return []
  }
}

// 6. SUPER ADMIN: Create New User Account (Teacher, Incharge, HOD, Admin)
export async function createUserAccount(data: {
  full_name: string
  email: string
  phone?: string
  password: string
  role: UserRole
  department?: string
  permissions?: UserPermissions
}) {
  const email = data.email.trim().toLowerCase()
  const phone = data.phone?.trim() || null
  const password = data.password
  const fullName = data.full_name.trim()
  const role = data.role
  const department = data.department?.trim() || 'Science Department'
  const permissions = data.permissions || DEFAULT_ROLE_PERMISSIONS[role]

  try {
    const client = getPgClient()
    await client.connect()

    // 🛡️ Double User Added Protection: check email duplicate
    const checkEmail = await client.query(`SELECT id FROM auth.users WHERE email = $1`, [email])
    if (checkEmail.rows.length > 0) {
      await client.end()
      return { success: false, error: `An account with email "${email}" already exists. Duplicate accounts are prohibited.` }
    }

    // 🛡️ Double User Added Protection: check phone duplicate if provided
    if (phone) {
      const checkPhone = await client.query(`SELECT id FROM public.profiles WHERE phone = $1`, [phone])
      if (checkPhone.rows.length > 0) {
        await client.end()
        return { success: false, error: `An account with phone number "${phone}" is already registered in the system.` }
      }
    }

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

    // Insert identity
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

    // Insert profile with phone number
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
        permissions,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, true, $7, now());
      `,
      [userId, email, phone, fullName, role, department, JSON.stringify(permissions)]
    )

    await client.end()

    await recordAuditEvent({
      action: 'CREATE',
      entityType: 'user_role',
      entityId: userId,
      entityLabel: `${fullName} (${role.toUpperCase()})`,
      after: {
        email,
        phone,
        full_name: fullName,
        role,
        department,
        permissions,
        password, // Redacted automatically by lib/audit.ts
      },
      metadata: { operation: 'create_user_account' },
    })

    revalidatePath('/admin')
    return { success: true, userId }
  } catch (err: any) {
    console.error('Error creating user account:', err)
    return { success: false, error: err.message || 'Failed to create user account.' }
  }
}

// 7. SUPER ADMIN: Update User Credentials (Password, Email, Phone, Name, Role, Dept)
export async function updateUserCredentials(
  userId: string,
  data: {
    full_name?: string
    email?: string
    phone?: string
    new_password?: string
    role?: UserRole
    department?: string
  }
) {
  try {
    const client = getPgClient()
    await client.connect()

    // 🛡️ Pre-query profile state for audit diff
    const prevProfileRes = await client.query(
      `SELECT id, full_name, email, phone, role, department FROM public.profiles WHERE id = $1::uuid`,
      [userId]
    )
    const beforeProfile = prevProfileRes.rows[0] || null

    if (data.new_password && data.new_password.trim().length >= 6) {
      await client.query(
        `
        UPDATE auth.users 
        SET encrypted_password = crypt($1, gen_salt('bf', 10)),
            updated_at = now()
        WHERE id = $2::uuid;
        `,
        [data.new_password.trim(), userId]
      )
    }

    if (data.email) {
      const cleanEmail = data.email.trim().toLowerCase()
      await client.query(
        `
        UPDATE auth.users 
        SET email = $1,
            updated_at = now()
        WHERE id = $2::uuid;
        `,
        [cleanEmail, userId]
      )

      await client.query(
        `
        UPDATE auth.identities
        SET identity_data = jsonb_build_object('sub', $1::text, 'email', $2::text, 'email_verified', true, 'phone_verified', false),
            updated_at = now()
        WHERE user_id = $1::uuid AND provider = 'email';
        `,
        [userId, cleanEmail]
      )
    }

    // 🛡️ Double User Added Protection: check phone duplicate if provided
    if (data.phone !== undefined) {
      const phone = data.phone.trim()
      if (phone) {
        const checkPhone = await client.query(`SELECT id FROM public.profiles WHERE phone = $1 AND id != $2::uuid`, [phone, userId])
        if (checkPhone.rows.length > 0) {
          await client.end()
          throw new Error(`An account with phone number "${phone}" is already registered in the system.`)
        }
      }
    }

    // Update profile
    const updates: string[] = []
    const params: any[] = [userId]
    let paramIdx = 2

    if (data.full_name) {
      updates.push(`full_name = $${paramIdx++}`)
      params.push(data.full_name.trim())
    }
    if (data.email) {
      updates.push(`email = $${paramIdx++}`)
      params.push(data.email.trim().toLowerCase())
    }
    if (data.phone !== undefined) {
      updates.push(`phone = $${paramIdx++}`)
      params.push(data.phone?.trim() || null)
    }
    if (data.role) {
      updates.push(`role = $${paramIdx++}`)
      params.push(data.role)
    }
    if (data.department) {
      updates.push(`department = $${paramIdx++}`)
      params.push(data.department.trim())
    }

    if (updates.length > 0) {
      await client.query(
        `
        UPDATE public.profiles
        SET ${updates.join(', ')}
        WHERE id = $1::uuid;
        `,
        params
      )
    }

    await client.end()

    await recordAuditEvent({
      action: 'UPDATE',
      entityType: 'user_role',
      entityId: userId,
      entityLabel: beforeProfile?.full_name ? `${beforeProfile.full_name} (${(data.role || beforeProfile.role).toUpperCase()})` : userId,
      before: beforeProfile,
      after: {
        ...beforeProfile,
        ...data,
        ...(data.new_password ? { new_password: data.new_password } : {}), // redacted automatically
      },
      metadata: { operation: 'update_user_credentials' },
    })

    revalidatePath('/admin')
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (err: any) {
    console.error('Error updating user credentials:', err)
    return { success: false, error: err.message || 'Failed to update credentials.' }
  }
}

// 8. SUPER ADMIN: 1-Click Toggle Active / Deactivate
export async function toggleUserActiveStatus(userId: string, is_active: boolean) {
  try {
    const client = getPgClient()
    await client.connect()

    const prevRes = await client.query(
      `SELECT id, full_name, role, is_active FROM public.profiles WHERE id = $1::uuid`,
      [userId]
    )
    const beforeProfile = prevRes.rows[0] || null

    await client.query(
      `
      UPDATE public.profiles
      SET is_active = $1
      WHERE id = $2::uuid;
      `,
      [is_active, userId]
    )

    await client.end()

    await recordAuditEvent({
      action: 'UPDATE',
      entityType: 'user_role',
      entityId: userId,
      entityLabel: beforeProfile?.full_name ? `${beforeProfile.full_name} (${beforeProfile.role.toUpperCase()})` : userId,
      before: { is_active: beforeProfile?.is_active ?? !is_active },
      after: { is_active },
      metadata: { operation: 'toggle_user_active_status' },
    })

    revalidatePath('/admin')
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (err: any) {
    console.error('Error toggling user status:', err)
    return { success: false, error: err.message || 'Failed to toggle status.' }
  }
}

// 9. SUPER ADMIN: Update Granular Permissions
export async function updateUserPermissions(userId: string, permissions: UserPermissions) {
  try {
    const client = getPgClient()
    await client.connect()

    const prevRes = await client.query(
      `SELECT id, full_name, role, permissions FROM public.profiles WHERE id = $1::uuid`,
      [userId]
    )
    const beforeProfile = prevRes.rows[0] || null

    await client.query(
      `
      UPDATE public.profiles
      SET permissions = $1
      WHERE id = $2::uuid;
      `,
      [JSON.stringify(permissions), userId]
    )

    await client.end()

    await recordAuditEvent({
      action: 'UPDATE',
      entityType: 'user_role',
      entityId: userId,
      entityLabel: beforeProfile?.full_name ? `${beforeProfile.full_name} (${beforeProfile.role.toUpperCase()})` : userId,
      before: { permissions: beforeProfile?.permissions },
      after: { permissions },
      metadata: { operation: 'update_user_permissions' },
    })

    revalidatePath('/admin')
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (err: any) {
    console.error('Error updating permissions:', err)
    return { success: false, error: err.message || 'Failed to update permissions.' }
  }
}

// 10. SUPER ADMIN: Delete User Account
export async function deleteUserAccount(userId: string) {
  try {
    const client = getPgClient()
    await client.connect()

    const prevRes = await client.query(
      `SELECT id, full_name, email, role FROM public.profiles WHERE id = $1`,
      [userId]
    )
    const beforeProfile = prevRes.rows[0] || null

    if (!beforeProfile) {
      await client.end()
      return { success: false, error: 'User account not found.' }
    }

    // Safety guard: Protect root super administrator
    if (beforeProfile.role === 'super_admin' && beforeProfile.email === 'admin@rrl.edu.np') {
      await client.end()
      return { success: false, error: 'The primary Super Administrator account cannot be deleted.' }
    }

    try {
      await client.query('BEGIN')

      // Pre-nullify references to prevent foreign key constraint violations
      await client.query(`UPDATE public.maintenance_logs SET performed_by_id = NULL WHERE performed_by_id = $1`, [userId])
      await client.query(`UPDATE public.institution_settings SET updated_by = NULL WHERE updated_by = $1`, [userId])
      await client.query(`UPDATE public.schedules SET teacher_id = NULL WHERE teacher_id = $1`, [userId])
      await client.query(`UPDATE public.practical_logs SET teacher_id = NULL WHERE teacher_id = $1`, [userId])
      await client.query(`UPDATE public.lab_incidents SET reported_by_id = NULL WHERE reported_by_id = $1`, [userId])
      await client.query(`UPDATE public.lab_incidents SET resolved_by_id = NULL WHERE resolved_by_id = $1`, [userId])
      await client.query(`UPDATE public.maintenance_plans SET assigned_user_id = NULL WHERE assigned_user_id = $1`, [userId])
      await client.query(`DELETE FROM public.teacher_substitutions WHERE original_teacher_id = $1 OR substitute_teacher_id = $1`, [userId])

      // Delete from public.profiles
      await client.query(`DELETE FROM public.profiles WHERE id = $1`, [userId])

      // Cascade deletes in auth identities, sessions, and users
      await client.query(`DELETE FROM auth.identities WHERE user_id = $1`, [userId])
      await client.query(`DELETE FROM auth.sessions WHERE user_id = $1`, [userId])
      await client.query(`DELETE FROM auth.users WHERE id = $1`, [userId])

      await client.query('COMMIT')
    } catch (dbErr) {
      await client.query('ROLLBACK')
      throw dbErr
    } finally {
      await client.end()
    }

    await invalidateUserProfileCache(userId)

    await recordAuditEvent({
      action: 'DELETE',
      entityType: 'user_role',
      entityId: userId,
      entityLabel: beforeProfile?.full_name ? `${beforeProfile.full_name} (${beforeProfile.role.toUpperCase()})` : userId,
      before: beforeProfile,
      metadata: { operation: 'delete_user_account' },
    })

    revalidatePath('/admin')
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (err: any) {
    console.error('[DATABASE ERROR] Error deleting user account:', err)
    return { success: false, error: err.message || 'Failed to delete user account.' }
  }
}

// 11. SUPER ADMIN: Approve User Account
export async function approveUserAccount(userId: string) {
  try {
    const client = getPgClient()
    await client.connect()

    const res = await client.query(
      `
      UPDATE public.profiles
      SET approval_status = 'approved',
          is_active = TRUE
      WHERE id = $1
      RETURNING email, full_name, role;
      `,
      [userId]
    )

    await client.end()

    if (res.rows.length > 0) {
      const user = res.rows[0]
      if (user.email) {
        sendAccountApprovedEmail(user.email, user.full_name).catch(() => {})
      }

      await recordAuditEvent({
        action: 'UPDATE',
        entityType: 'user_role',
        entityId: userId,
        entityLabel: `${user.full_name} (${user.role?.toUpperCase() || 'STAFF'})`,
        before: { approval_status: 'pending', is_active: false },
        after: { approval_status: 'approved', is_active: true },
        metadata: { operation: 'approve_user_account' },
      })
    }

    revalidatePath('/admin')
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to approve user:', err)
    return { success: false, error: err.message || 'Failed to approve account.' }
  }
}

// 12. SUPER ADMIN: Reject User Account
export async function rejectUserAccount(userId: string) {
  try {
    const client = getPgClient()
    await client.connect()

    const prevRes = await client.query(
      `SELECT id, full_name, email, role, approval_status FROM public.profiles WHERE id = $1`,
      [userId]
    )
    const beforeUser = prevRes.rows[0] || null

    await client.query(
      `
      UPDATE public.profiles
      SET approval_status = 'rejected',
          is_active = FALSE
      WHERE id = $1;
      `,
      [userId]
    )

    await client.end()

    await recordAuditEvent({
      action: 'UPDATE',
      entityType: 'user_role',
      entityId: userId,
      entityLabel: beforeUser?.full_name ? `${beforeUser.full_name} (${beforeUser.role?.toUpperCase() || 'STAFF'})` : userId,
      before: { approval_status: beforeUser?.approval_status || 'pending', is_active: true },
      after: { approval_status: 'rejected', is_active: false },
      metadata: { operation: 'reject_user_account' },
    })

    revalidatePath('/admin')
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to reject user:', err)
    return { success: false, error: err.message || 'Failed to reject account.' }
  }
}


