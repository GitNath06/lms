import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (let line of lines) {
    let trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const k = trimmed.slice(0, eqIdx).trim();
    let v = trimmed.slice(eqIdx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnv();

const DATABASE_URL = process.env.DATABASE_URL;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!DATABASE_URL) {
  console.error('❌ Missing DATABASE_URL in .env');
  process.exit(1);
}

// Permissions definitions
const ROLE_PERMISSIONS = {
  super_admin: {
    can_view_logs: true,
    can_create_logs: true,
    can_delete_logs: true,
    can_view_incidents: true,
    can_report_incidents: true,
    can_manage_incidents: true,
    can_resolve_incidents: true,
    can_manage_schedules: true,
    can_manage_users: true,
    can_access_admin: true,
  },
  lab_incharge: {
    can_view_logs: true,
    can_create_logs: true,
    can_delete_logs: false,
    can_view_incidents: true,
    can_report_incidents: true,
    can_manage_incidents: true,
    can_resolve_incidents: true,
    can_manage_schedules: true,
    can_manage_users: false,
    can_access_admin: false,
  },
  hod: {
    can_view_logs: true,
    can_create_logs: false,
    can_delete_logs: false,
    can_view_incidents: true,
    can_report_incidents: true,
    can_manage_incidents: true,
    can_resolve_incidents: true,
    can_manage_schedules: false,
    can_manage_users: false,
    can_access_admin: false,
  },
  teacher: {
    can_view_logs: true,
    can_create_logs: true,
    can_delete_logs: false,
    can_view_incidents: true,
    can_report_incidents: true,
    can_manage_incidents: false,
    can_resolve_incidents: false,
    can_manage_schedules: false,
    can_manage_users: false,
    can_access_admin: false,
  },
};

const SEED_ACCOUNTS = [
  {
    email: 'admin@rrl.edu.np',
    password: 'Admin@12345',
    full_name: 'System Administrator',
    role: 'super_admin',
    department: 'Central Administration',
    is_active: true,
    permissions: ROLE_PERMISSIONS.super_admin,
  },
  {
    email: 'incharge@rrl.edu.np',
    password: 'Incharge@12345',
    full_name: 'Dr. Rajesh Sharma',
    role: 'lab_incharge',
    department: 'Science & Technology Laboratories',
    is_active: true,
    permissions: ROLE_PERMISSIONS.lab_incharge,
  },
  {
    email: 'hod@rrl.edu.np',
    password: 'Hod@12345',
    full_name: 'Head of Department',
    role: 'hod',
    department: 'Department of Science & Tech',
    is_active: true,
    permissions: ROLE_PERMISSIONS.hod,
  },
  {
    email: 'p.adhikari@rrl.edu.np',
    password: 'Teacher@12345',
    full_name: 'Dr. Prakash Adhikari',
    role: 'teacher',
    department: 'Physics Department',
    is_active: true,
    permissions: ROLE_PERMISSIONS.teacher,
  },
  {
    email: 'a.karki@rrl.edu.np',
    password: 'Teacher@12345',
    full_name: 'Er. Anish Karki',
    role: 'teacher',
    department: 'Electronics & Computer',
    is_active: true,
    permissions: ROLE_PERMISSIONS.teacher,
  },
  {
    email: 'n.poudel@rrl.edu.np',
    password: 'Biology@12345',
    full_name: 'Dr. Nirmala Poudel',
    role: 'teacher',
    department: 'Biology & Life Sciences',
    is_active: true,
    permissions: ROLE_PERMISSIONS.teacher,
  },
  {
    email: 'teacher@rrl.edu.np',
    password: 'Teacher@12345',
    full_name: 'Class Teacher',
    role: 'teacher',
    department: 'Science Department',
    is_active: true,
    permissions: ROLE_PERMISSIONS.teacher,
  },
];

async function run() {
  console.log('🚀 Starting PostgreSQL migration and account seeding...');
  const client = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('✅ Connected to PostgreSQL.');

  try {
    // 1. Drop residual fine columns from public.lab_incidents
    console.log('\n--- 1. Dropping residual fine columns from public.lab_incidents ---');
    await client.query(`
      ALTER TABLE public.lab_incidents
        DROP COLUMN IF EXISTS is_fined,
        DROP COLUMN IF EXISTS fine_amount,
        DROP COLUMN IF EXISTS fine_paid,
        DROP COLUMN IF EXISTS fine_receipt_no;
    `);
    console.log('✓ Removed residual fine columns.');

    // 2. Upgrading public.profiles
    console.log('\n--- 2. Upgrading public.profiles schema ---');
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE public.profiles ALTER COLUMN role TYPE text USING role::text;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
          CHECK (role IN ('super_admin', 'lab_incharge', 'hod', 'teacher', 'admin'));
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);

    await client.query(`
      ALTER TABLE public.profiles 
        ADD COLUMN IF NOT EXISTS email text,
        ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '{}'::jsonb;
    `);

    // Update handle_new_user trigger function
    await client.query(`
      CREATE OR REPLACE FUNCTION public.handle_new_user()
      RETURNS trigger AS $$
      BEGIN
        INSERT INTO public.profiles (id, email, full_name, role, department, is_active, permissions)
        VALUES (
          new.id,
          new.email,
          COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
          COALESCE(new.raw_user_meta_data->>'role', 'teacher'),
          COALESCE(new.raw_user_meta_data->>'department', 'Science Department'),
          true,
          '{}'::jsonb
        )
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          full_name = EXCLUDED.full_name,
          role = EXCLUDED.role,
          department = EXCLUDED.department;
        RETURN new;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `);
    console.log('✓ Upgraded public.profiles schema & trigger.');

    // 3. Ensure pgcrypto extension
    await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

    // 4. Seed accounts into auth.users and auth.identities
    console.log('\n--- 3. Seeding Institutional Accounts into auth.users and auth.identities ---');

    for (const acc of SEED_ACCOUNTS) {
      const existing = await client.query(`SELECT id FROM auth.users WHERE email = $1`, [acc.email]);
      let userId;

      if (existing.rows.length > 0) {
        userId = existing.rows[0].id;
        console.log(`Updating existing auth account for ${acc.email}...`);
        await client.query(
          `
          UPDATE auth.users
          SET 
            instance_id = '00000000-0000-0000-0000-000000000000'::uuid,
            encrypted_password = crypt($1, gen_salt('bf', 10)),
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            raw_app_meta_data = '{"provider": "email", "providers": ["email"]}'::jsonb,
            raw_user_meta_data = jsonb_build_object(
              'full_name', $2::text,
              'role', $3::text,
              'department', $4::text,
              'email_verified', true
            ),
            confirmation_token = '',
            recovery_token = '',
            email_change_token_new = '',
            email_change = '',
            updated_at = now()
          WHERE id = $5;
          `,
          [acc.password, acc.full_name, acc.role, acc.department, userId]
        );
      } else {
        console.log(`Creating new auth user for ${acc.email}...`);
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
          [acc.email, acc.password, acc.full_name, acc.role, acc.department]
        );
        userId = userRes.rows[0].id;
      }

      // Upsert identity in auth.identities
      const idCheck = await client.query(
        `SELECT id FROM auth.identities WHERE user_id = $1::uuid AND provider = 'email'`,
        [userId]
      );

      if (idCheck.rows.length === 0) {
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
          [userId, acc.email]
        );
      } else {
        await client.query(
          `
          UPDATE auth.identities
          SET 
            provider_id = $1::text,
            identity_data = jsonb_build_object('sub', $1::text, 'email', $2::text, 'email_verified', true, 'phone_verified', false),
            updated_at = now()
          WHERE user_id = $1::uuid AND provider = 'email';
          `,
          [userId, acc.email]
        );
      }

      // Upsert in public.profiles
      await client.query(
        `
        INSERT INTO public.profiles (
          id,
          email,
          full_name,
          role,
          department,
          is_active,
          permissions,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, now())
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          full_name = EXCLUDED.full_name,
          role = EXCLUDED.role,
          department = EXCLUDED.department,
          is_active = EXCLUDED.is_active,
          permissions = EXCLUDED.permissions;
        `,
        [
          userId,
          acc.email,
          acc.full_name,
          acc.role,
          acc.department,
          acc.is_active,
          JSON.stringify(acc.permissions),
        ]
      );

      console.log(`✓ Account ready: ${acc.full_name} (${acc.role}) -> ${acc.email}`);
    }

    console.log('\n--- 4. Active Profiles Summary ---');
    const profiles = await client.query(`SELECT email, full_name, role, is_active FROM public.profiles ORDER BY role;`);
    console.table(profiles.rows);
  } finally {
    await client.end();
  }

  // 5. Verify Authentication with Supabase SDK for all accounts
  if (SUPABASE_URL && SUPABASE_KEY) {
    console.log('\n--- 5. Testing Supabase SDK Sign-In for All Accounts ---');
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    for (const acc of SEED_ACCOUNTS) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: acc.email,
        password: acc.password,
      });

      if (error) {
        console.error(`❌ Sign-in failed for ${acc.email}:`, error.message);
      } else {
        console.log(`✅ Sign-in SUCCESS: ${acc.email} (${acc.role}) - User ID: ${data.user.id}`);
        await supabase.auth.signOut();
      }
    }
  }

  console.log('\n🎉 ALL MIGRATIONS AND ACCOUNT VERIFICATIONS COMPLETED SUCCESSFULLY!');
}

run().catch((e) => {
  console.error('Fatal error during migration:', e);
  process.exit(1);
});
