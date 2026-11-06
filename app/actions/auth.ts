'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import pg from 'pg'

import {
  type UserRole,
  type UserPermissions,
  type UserProfile,
  DEFAULT_ROLE_PERMISSIONS,
  PENDING_ROLE_PERMISSIONS,
} from '@/lib/permissions'
import { sendAccountApprovedEmail } from '@/lib/mailer'
import { getPgPool, resolveDatabaseUrl } from '@/lib/db'
import { recordAuditEvent } from '@/lib/audit'
import { getServerUserScope } from '@/lib/context/server-user-scope'
import { uploadProfilePhotoToStorage } from '@/lib/storage/supabase-storage'
import {
  SESSION_CLAIM_COOKIE_NAME,
  SESSION_CLAIM_TTL_MS,
  createSessionClaim,
  verifySessionClaim,
} from '@/lib/security/session-claim'

async function getPooledClient() {
  const pool = getPgPool()
  return await pool.connect()
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

/**
 * Resolves demo account passwords strictly during local development.
 * In production, strictly returns null to guarantee zero credential leakage.
 */
export async function getDemoAccountPassword(email: string): Promise<string | null> {
  if (process.env.NODE_ENV !== 'development') {
    return null
  }
  const normalized = (email || '').trim().toLowerCase()
  const demoPasswords: Record<string, string> = {
    'admin@rrl.edu.np': process.env.DEMO_ADMIN_PASSWORD || 'Admin@12345',
    'incharge@rrl.edu.np': process.env.DEMO_INCHARGE_PASSWORD || 'Incharge@12345',
    'hod@rrl.edu.np': process.env.DEMO_HOD_PASSWORD || 'Hod@12345',
    'p.adhikari@rrl.edu.np': process.env.DEMO_TEACHER_PASSWORD || 'Teacher@12345',
    'a.karki@rrl.edu.np': process.env.DEMO_TEACHER_PASSWORD || 'Teacher@12345',
    'teacher@rrl.edu.np': process.env.DEMO_TEACHER_PASSWORD || 'Teacher@12345',
  }
  return demoPasswords[normalized] || null
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

  let userProfile: any = null
  // Check if account is active and approved in profiles via direct DB query (bypasses RLS)
  if (data.user) {
    try {
      const pool = getPgPool()
      const res = await pool.query(
        `SELECT is_active, role, full_name, approval_status FROM public.profiles WHERE id = $1`,
        [data.user.id]
      )
      userProfile = res.rows[0]
    } catch (e) {
      console.error('Error fetching profile during signIn via pg pool:', e)
    }

    if (!userProfile) {
      try {
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('is_active, role, full_name, approval_status')
          .eq('id', data.user.id)
          .single()
        if (profileRow) {
          userProfile = profileRow
        }
      } catch (sdkErr) {
        console.error('Error fetching profile during signIn via supabase sdk:', sdkErr)
      }
    }

    if (userProfile) {
      if (userProfile.approval_status === 'rejected') {
        await supabase.auth.signOut()
        return {
          error:
            'Your account registration was not approved by the Administrator. Please contact the IT office.',
        }
      }

      if (userProfile.is_active === false && userProfile.approval_status !== 'pending') {
        await supabase.auth.signOut()
        return {
          error:
            'Your account has been deactivated by the Administrator. Please contact the IT/Super Admin office.',
        }
      }
      // Note: If userProfile.approval_status === 'pending', user is allowed to sign in,
      // but they are strictly redirected to /profile until verified by an administrator.
    }
  }

  // Issue fast-path session claim cookie
  if (data?.user && userProfile) {
    try {
      let assignedClasses: string[] = []
      let assignedSubjects: Array<{
        code: string
        title: string
        grade: string
        labId: string
        labName: string
        defaultTopic?: string
      }> = []
      let assignedLabIds: string[] = []

      if (userProfile.role === 'teacher') {
        try {
          const pool = getPgPool()
          const csRes = await pool.query(
            `SELECT cs.class_id, cs.subject_id, cs.default_lab_id, c.name AS class_name, s.code AS subject_code, s.name AS subject_name, l.name AS lab_name
             FROM public.class_subjects cs
             LEFT JOIN public.classes c ON c.id = cs.class_id
             LEFT JOIN public.subjects s ON s.id = cs.subject_id
             LEFT JOIN public.labs l ON l.id = cs.default_lab_id
             WHERE cs.teacher_id = $1`,
            [data.user.id]
          )
          assignedClasses = Array.from(new Set(csRes.rows.map((r: any) => r.class_name || r.class_id).filter(Boolean)))
          assignedLabIds = Array.from(new Set(csRes.rows.map((r: any) => r.default_lab_id).filter(Boolean)))
          assignedSubjects = csRes.rows.map((r: any) => ({
            code: r.subject_code || r.subject_id || '',
            title: r.subject_name || r.subject_code || 'Subject',
            grade: r.class_name || r.class_id || '',
            labId: r.default_lab_id || 'comp',
            labName: r.lab_name || 'Laboratory',
          })).filter((s: any) => Boolean(s.code))
        } catch (csErr) {
          console.warn('Failed to pre-resolve teacher scope for session claim:', csErr)
        }
      }

      const claim = await createSessionClaim({
        uid: data.user.id,
        role: userProfile.role || 'teacher',
        approvalStatus: userProfile.approval_status || 'approved',
        isActive: userProfile.is_active !== false,
        teacherId: data.user.id,
        assignedClasses,
        assignedSubjects,
        assignedLabIds,
      })
      const cookieStore = await cookies()
      cookieStore.set({
        name: SESSION_CLAIM_COOKIE_NAME,
        value: claim,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: Math.floor(SESSION_CLAIM_TTL_MS / 1000),
        path: '/',
      })
    } catch (claimErr) {
      console.warn('Failed to issue session claim on signIn:', claimErr)
    }
  }

  // Determine post-login destination
  let targetUrl = '/'
  if (userProfile && userProfile.approval_status === 'pending') {
    targetUrl = '/profile'
  } else {
    const rawRedirect = (formData.get('redirect') as string) || (formData.get('next') as string) || '/'
    targetUrl = rawRedirect.startsWith('/') && !rawRedirect.startsWith('/login') ? rawRedirect : '/'
  }

  revalidatePath('/', 'layout')
  redirect(targetUrl)
}

// 2. Teacher / Staff Self-Registration
export async function signUp(formData: FormData) {
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const password = formData.get('password') as string
  const fullName = (formData.get('full_name') as string)?.trim()
  const department = (formData.get('department') as string)?.trim() || null
  const role: UserRole = 'teacher'

  if (!email || !password || !fullName) {
    return { error: 'Please provide full name, institutional email, and password.' }
  }

  if (!isSupabaseConfigured()) {
    revalidatePath('/', 'layout')
    redirect('/')
  }

  const client = await getPooledClient()
  try {
    // Check if user already exists
    const existing = await client.query(`SELECT id FROM auth.users WHERE email = $1`, [email])
    if (existing.rows.length > 0) {
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
      ($1, 'super_admin', $2, $3, 'info', false, now()),
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

    return {
      success: true,
      pendingApproval: true,
      message: 'Your account is pending Super Admin approval. Please await administrator verification.',
    }
  } catch (err: any) {
    return { error: err.message || 'Failed to complete registration.' }
  } finally {
    client.release()
  }
}

// 3. Sign Out Action
export async function signOut() {
  invalidateUserProfileCache()
  try {
    const cookieStore = await cookies()
    cookieStore.delete(SESSION_CLAIM_COOKIE_NAME)
  } catch (e) {}

  if (isSupabaseConfigured()) {
    const supabase = await createClient()
    await supabase.auth.signOut()
  }
  revalidatePath('/', 'layout')
  redirect('/login')
}

// 4. Get Current User Profile with Permissions (Memoized per-request to avoid redundant network round-trips)
const getCachedUserProfile = cache(async (): Promise<UserProfile | null> => {
  if (process.env.TEST_USER_OVERRIDE) {
    try {
      return JSON.parse(process.env.TEST_USER_OVERRIDE)
    } catch {
      // ignore
    }
  }

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
    let cookieStore: any = null
    try {
      cookieStore = await cookies()
    } catch {
      // Outside request context
    }

    let userId: string | null = null
    let fallbackEmail: string | null = null
    let userCreatedAt: string = new Date().toISOString()
    let userMeta: any = null

    // 1. Fast-Path: Verified Session Claim Cookie (0ms HTTPS bypass)
    if (cookieStore) {
      const claimToken = cookieStore.get?.(SESSION_CLAIM_COOKIE_NAME)?.value
      if (claimToken) {
        const verified = await verifySessionClaim(claimToken)
        if (verified && verified.uid) {
          userId = verified.uid
        }
      }
    }

    // Check in-memory cache if userId already resolved from claim
    if (userId) {
      const cached = userProfileCache.get(userId)
      if (cached && Date.now() - cached.timestamp < 30000) {
        return cached.profile
      }
    }

    // 2. Fallback to Supabase Auth if claim token absent or expired
    if (!userId) {
      if (cookieStore) {
        const allCookies = cookieStore.getAll?.() || []
        const hasAuthCookie = allCookies.some((c: any) =>
          typeof c.name === 'string' && c.name.startsWith('sb-') && c.name.includes('auth-token')
        )
        if (!hasAuthCookie) {
          return null
        }
      }

      const supabase = await createClient()
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser()

      if (userErr || !user) return null
      userId = user.id
      fallbackEmail = user.email || null
      userCreatedAt = user.created_at
      userMeta = user.user_metadata

      // Check in-memory cache
      const cached = userProfileCache.get(userId)
      if (cached && Date.now() - cached.timestamp < 30000) {
        return cached.profile
      }
    }

    // 3. Ultra-Fast PostgreSQL Pool Lookup (< 3ms) instead of Supabase REST
    const pool = getPgPool()
    const pRes = await pool.query(
      `SELECT id, email, phone, full_name, role, department, photo_url, avatar_url,
              is_active, approval_status, permissions, created_at, honorific, bio, teaching_preferences
       FROM public.profiles
       WHERE id = $1
       LIMIT 1`,
      [userId]
    )
    const profile = pRes.rows[0]

    let result: UserProfile

    if (!profile) {
      const metaRole = (userMeta?.role as UserRole) || 'teacher'
      const metaApproval = (userMeta?.approval_status as 'pending' | 'approved' | 'rejected') || 'approved'
      result = {
        id: userId,
        email: fallbackEmail,
        full_name: userMeta?.full_name || fallbackEmail?.split('@')[0] || 'Teacher',
        role: metaRole,
        department: userMeta?.department || null,
        photo_url: userMeta?.avatar_url || userMeta?.photo_url || null,
        avatar_url: userMeta?.avatar_url || userMeta?.photo_url || null,
        is_active: true,
        approval_status: metaApproval,
        permissions: metaApproval === 'pending'
          ? PENDING_ROLE_PERMISSIONS
          : (DEFAULT_ROLE_PERMISSIONS[metaRole] || DEFAULT_ROLE_PERMISSIONS.teacher),
        created_at: userCreatedAt,
      }
    } else {
      const typedProfile = profile as any
      const finalRole: UserRole =
        typedProfile.role === 'admin' ? 'super_admin' : typedProfile.role || 'teacher'
      const isPending = typedProfile.approval_status === 'pending'

      result = {
        id: typedProfile.id,
        email: typedProfile.email || fallbackEmail,
        phone: typedProfile.phone || null,
        full_name: typedProfile.full_name,
        role: finalRole,
        department: typedProfile.department,
        photo_url: typedProfile.photo_url || typedProfile.avatar_url || null,
        avatar_url: typedProfile.avatar_url || typedProfile.photo_url || null,
        honorific: typedProfile.honorific || null,
        bio: typedProfile.bio || null,
        teaching_preferences: typedProfile.teaching_preferences || {},
        is_active: typedProfile.is_active ?? true,
        approval_status: typedProfile.approval_status || 'approved',
        permissions: isPending
          ? PENDING_ROLE_PERMISSIONS
          : (typedProfile.permissions || DEFAULT_ROLE_PERMISSIONS[finalRole]),
        created_at: typedProfile.created_at,
      }
    }

    userProfileCache.set(userId, { profile: result, timestamp: Date.now() })
    return result
  } catch (e) {
    return {
      id: 'local-user',
      email: 'teacher@rrl.edu.np',
      full_name: 'Class Teacher',
      role: 'teacher',
      department: null,
      photo_url: null,
      avatar_url: null,
      honorific: null,
      bio: null,
      teaching_preferences: {},
      is_active: true,
      permissions: DEFAULT_ROLE_PERMISSIONS.teacher,
      created_at: new Date().toISOString(),
    }
  }
})

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  return getCachedUserProfile()
}

// 5. SUPER ADMIN: Get All Users
export async function getAllUsers(): Promise<UserProfile[]> {
  try {
    const scope = await getServerUserScope()
    if (!scope.isPrivileged) {
      return []
    }

    const pool = getPgPool()

    const res = await pool.query(`
      SELECT id, email, phone, full_name, role, department, photo_url, avatar_url, is_active, approval_status, permissions, created_at, honorific, bio, teaching_preferences
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
      photo_url: row.photo_url || row.avatar_url || null,
      avatar_url: row.avatar_url || row.photo_url || null,
      honorific: row.honorific || null,
      bio: row.bio || null,
      teaching_preferences: row.teaching_preferences || {},
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
  photo_url?: string
  permissions?: UserPermissions
}) {
  const scope = await getServerUserScope()
  if (scope.role !== 'super_admin') {
    return {
      success: false,
      error: 'Access Denied: Only Super Administrators can create user accounts with assigned institutional roles.',
    }
  }

  const email = data.email.trim().toLowerCase()
  const phone = data.phone?.trim() || null
  const password = data.password
  const fullName = data.full_name.trim()
  const role = data.role
  const department = data.department?.trim() || null
  const permissions = data.permissions || DEFAULT_ROLE_PERMISSIONS[role]

  const client = await getPooledClient()
  try {
    // 🛡️ Double User Added Protection: check email duplicate
    const checkEmail = await client.query(`SELECT id FROM auth.users WHERE email = $1`, [email])
    if (checkEmail.rows.length > 0) {
      return { success: false, error: `An account with email "${email}" already exists. Duplicate accounts are prohibited.` }
    }

    // 🛡️ Double User Added Protection: check phone duplicate if provided
    if (phone) {
      const checkPhone = await client.query(`SELECT id FROM public.profiles WHERE phone = $1`, [phone])
      if (checkPhone.rows.length > 0) {
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

    // Insert profile with phone number and optional photo
    await client.query(
      `
      INSERT INTO public.profiles (
        id,
        email,
        phone,
        full_name,
        role,
        department,
        photo_url,
        avatar_url,
        is_active,
        permissions,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, true, $8, now());
      `,
      [userId, email, phone, fullName, role, department, data.photo_url || null, JSON.stringify(permissions)]
    )

    revalidatePath('/admin')
    return { success: true, userId }
  } catch (err: any) {
    console.error('Error creating user account:', err)
    return { success: false, error: err.message || 'Failed to create user account.' }
  } finally {
    client.release()
  }
}

// 7. SUPER ADMIN: Update User Credentials (Password, Email, Phone, Name, Role, Dept, Photo)
export async function updateUserCredentials(
  userId: string,
  data: {
    full_name?: string
    email?: string
    phone?: string
    new_password?: string
    role?: UserRole
    department?: string
    photo_url?: string | null
    avatar_url?: string | null
  }
) {
  const scope = await getServerUserScope()
  if (scope.role !== 'super_admin') {
    return {
      success: false,
      error: 'Access Denied: Only Super Administrators can modify credentials and user roles.',
    }
  }

  const client = await getPooledClient()
  try {
    // 🛡️ Pre-query profile state for audit diff
    const prevProfileRes = await client.query(
      `SELECT id, full_name, email, phone, role, department, photo_url FROM public.profiles WHERE id = $1::uuid`,
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
    if (data.photo_url !== undefined) {
      let finalPhotoUrl = data.photo_url
      if (finalPhotoUrl && (finalPhotoUrl.startsWith('data:image/') || !finalPhotoUrl.startsWith('http'))) {
        finalPhotoUrl = await uploadProfilePhotoToStorage(userId, finalPhotoUrl)
      }
      updates.push(`photo_url = $${paramIdx++}`)
      params.push(finalPhotoUrl || null)
      updates.push(`avatar_url = $${paramIdx++}`)
      params.push(finalPhotoUrl || null)
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

    userProfileCache.delete(userId)

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
  } finally {
    client.release()
  }
}

// 7b. Self-Service: Update Current Logged-in User's Profile Photo
export async function updateCurrentUserPhoto(photoUrl: string | null) {
  const scope = await getServerUserScope()
  if (!scope.userId) {
    return { success: false, error: 'Unauthorized: No active user session found.' }
  }

  try {
    const pool = getPgPool()
    let finalPhotoUrl = photoUrl
    if (finalPhotoUrl && (finalPhotoUrl.startsWith('data:image/') || !finalPhotoUrl.startsWith('http'))) {
      finalPhotoUrl = await uploadProfilePhotoToStorage(scope.userId, finalPhotoUrl)
    }

    await pool.query(
      `
      UPDATE public.profiles
      SET photo_url = $1,
          avatar_url = $1
      WHERE id = $2::uuid;
      `,
      [finalPhotoUrl || null, scope.userId]
    )

    userProfileCache.delete(scope.userId)

    revalidatePath('/', 'layout')
    revalidatePath('/admin')
    return { success: true }
  } catch (err: any) {
    console.error('Error updating current user photo:', err)
    return { success: false, error: err.message || 'Failed to update profile photo.' }
  }
}

// 7c. Super Admin: Update Any Staff Member's Profile Photo
export async function updateUserProfilePhoto(userId: string, photoUrl: string | null) {
  const scope = await getServerUserScope()
  if (scope.role !== 'super_admin' && scope.userId !== userId) {
    return {
      success: false,
      error: 'Access Denied: Only Super Administrators can modify staff profile photos.',
    }
  }

  try {
    const pool = getPgPool()
    let finalPhotoUrl = photoUrl
    if (finalPhotoUrl && (finalPhotoUrl.startsWith('data:image/') || !finalPhotoUrl.startsWith('http'))) {
      finalPhotoUrl = await uploadProfilePhotoToStorage(userId, finalPhotoUrl)
    }

    await pool.query(
      `
      UPDATE public.profiles
      SET photo_url = $1,
          avatar_url = $1
      WHERE id = $2::uuid;
      `,
      [finalPhotoUrl || null, userId]
    )

    userProfileCache.delete(userId)

    await recordAuditEvent({
      action: 'UPDATE',
      entityType: 'user_role',
      entityId: userId,
      entityLabel: `Staff Profile Photo (${userId})`,
      before: {},
      after: { photo_url: photoUrl ? '[PHOTO_SET]' : '[PHOTO_CLEARED]' },
      metadata: { operation: 'update_staff_photo' },
    })

    revalidatePath('/', 'layout')
    revalidatePath('/admin')
    return { success: true }
  } catch (err: any) {
    console.error('Error updating staff photo:', err)
    return { success: false, error: err.message || 'Failed to update staff photo.' }
  }
}

// 8. SUPER ADMIN: 1-Click Toggle Active / Deactivate
export async function toggleUserActiveStatus(userId: string, is_active: boolean) {
  const scope = await getServerUserScope()
  if (scope.role !== 'super_admin') {
    return { success: false, error: 'Access Denied: Only Super Administrators can toggle user status.' }
  }

  const client = await getPooledClient()
  try {
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
  } finally {
    client.release()
  }
}

// 9. SUPER ADMIN: Update Granular Permissions
export async function updateUserPermissions(userId: string, permissions: UserPermissions) {
  const scope = await getServerUserScope()
  if (scope.role !== 'super_admin') {
    return { success: false, error: 'Access Denied: Only Super Administrators can update user permissions.' }
  }

  const client = await getPooledClient()
  try {
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
  } finally {
    client.release()
  }
}

// 10. SUPER ADMIN: Delete User Account
export async function deleteUserAccount(userId: string) {
  const scope = await getServerUserScope()
  if (scope.role !== 'super_admin') {
    return { success: false, error: 'Access Denied: Only Super Administrators can delete user accounts.' }
  }

  const client = await getPooledClient()
  try {
    const prevRes = await client.query(
      `SELECT id, full_name, email, role FROM public.profiles WHERE id = $1`,
      [userId]
    )
    const beforeProfile = prevRes.rows[0] || null

    if (!beforeProfile) {
      return { success: false, error: 'User account not found.' }
    }

    // Safety guard: Protect root super administrator
    if (beforeProfile.role === 'super_admin' && beforeProfile.email === 'admin@rrl.edu.np') {
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
  } finally {
    client.release()
  }
}

// 11. SUPER ADMIN: Approve User Account
export async function approveUserAccount(userId: string) {
  const scope = await getServerUserScope()
  if (scope.role !== 'super_admin') {
    return { success: false, error: 'Access Denied: Only Super Administrators can approve user accounts.' }
  }

  const client = await getPooledClient()
  try {
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
  } finally {
    client.release()
  }
}

// 12. SUPER ADMIN: Reject User Account
export async function rejectUserAccount(userId: string) {
  const scope = await getServerUserScope()
  if (scope.role !== 'super_admin') {
    return { success: false, error: 'Access Denied: Only Super Administrators can reject user accounts.' }
  }

  const client = await getPooledClient()
  try {
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
  } finally {
    client.release()
  }
}


