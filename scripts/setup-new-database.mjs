import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'

// 1. Load Environment Variables (.env.local, fallback to .env)
function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    const fullPath = path.resolve(process.cwd(), file)
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8')
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const idx = trimmed.indexOf('=')
          const key = trimmed.substring(0, idx).trim()
          let val = trimmed.substring(idx + 1).trim()
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1)
          }
          if (!process.env[key]) {
            process.env[key] = val
          }
        }
      }
    }
  }
}

loadEnv()

const DATABASE_URL = process.env.DATABASE_URL
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

console.log('='.repeat(70))
console.log('   LabSync LIMS — Automated Supabase Database Setup & Initialization')
console.log('='.repeat(70))

if (!DATABASE_URL) {
  console.error('\n❌ ERROR: DATABASE_URL is missing in your .env or .env.local file!')
  console.log('\nTo get your DATABASE_URL from your new Supabase project:')
  console.log('1. Go to https://supabase.com/dashboard/project/_/settings/database')
  console.log('2. Scroll to "Connection parameters" or "Connection string".')
  console.log('3. Select "URI" mode (Transaction or Session pooler, port 6543 or 5432).')
  console.log('4. Replace [YOUR-PASSWORD] with your actual Supabase database password.')
  console.log('5. Paste it as DATABASE_URL=postgresql://... in .env and .env.local.\n')
  process.exit(1)
}

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('\n❌ ERROR: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing!')
  console.log('\nTo get these keys from your new Supabase project:')
  console.log('1. Go to https://supabase.com/dashboard/project/_/settings/api')
  console.log('2. Copy "Project URL" into NEXT_PUBLIC_SUPABASE_URL')
  console.log('3. Copy "anon / public key" into NEXT_PUBLIC_SUPABASE_ANON_KEY and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY\n')
  process.exit(1)
}

console.log('\n📡 Supabase Project URL:', SUPABASE_URL)
console.log('🔗 Database Host Target :', DATABASE_URL.split('@')[1] || '(Hidden for security)')

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
}

const SEED_ACCOUNTS = [
  {
    email: 'admin@rrl.edu.np',
    password: 'Admin@12345',
    full_name: 'System Administrator',
    role: 'super_admin',
    department: 'Central Administration',
    is_active: true,
    approval_status: 'approved',
    permissions: ROLE_PERMISSIONS.super_admin,
  },
  {
    email: 'incharge@rrl.edu.np',
    password: 'Incharge@12345',
    full_name: 'Dr. Rajesh Sharma',
    role: 'lab_incharge',
    department: 'Science & Technology Laboratories',
    is_active: true,
    approval_status: 'approved',
    permissions: ROLE_PERMISSIONS.lab_incharge,
  },
  {
    email: 'hod@rrl.edu.np',
    password: 'Hod@12345',
    full_name: 'Head of Department',
    role: 'hod',
    department: 'Department of Science & Tech',
    is_active: true,
    approval_status: 'approved',
    permissions: ROLE_PERMISSIONS.hod,
  },
  {
    email: 'p.adhikari@rrl.edu.np',
    password: 'Teacher@12345',
    full_name: 'Dr. Prakash Adhikari',
    role: 'teacher',
    department: 'Physics Department',
    is_active: true,
    approval_status: 'approved',
    permissions: ROLE_PERMISSIONS.teacher,
  },
  {
    email: 'a.karki@rrl.edu.np',
    password: 'Teacher@12345',
    full_name: 'Er. Anish Karki',
    role: 'teacher',
    department: 'Electronics & Computer',
    is_active: true,
    approval_status: 'approved',
    permissions: ROLE_PERMISSIONS.teacher,
  },
  {
    email: 'n.poudel@rrl.edu.np',
    password: 'Biology@12345',
    full_name: 'Dr. Nirmala Poudel',
    role: 'teacher',
    department: 'Biology & Life Sciences',
    is_active: true,
    approval_status: 'approved',
    permissions: ROLE_PERMISSIONS.teacher,
  },
  {
    email: 'teacher@rrl.edu.np',
    password: 'Teacher@12345',
    full_name: 'Class Teacher',
    role: 'teacher',
    department: 'Science Department',
    is_active: true,
    approval_status: 'approved',
    permissions: ROLE_PERMISSIONS.teacher,
  },
]

async function run() {
  let pool
  let client
  try {
    pool = new pg.Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 4000,
    })
    client = await pool.connect()
  } catch (err) {
    if (DATABASE_URL.includes('db.') && DATABASE_URL.includes('.supabase.co')) {
      const match = DATABASE_URL.match(/postgresql:\/\/([^:]+):(.+)@db\.([a-z0-9]+)\.supabase\.co(?::\d+)?\/(.+)$/)
      if (match) {
        const [, user, pass, ref, db] = match
        const poolerUrl = `postgresql://postgres.${ref}:${encodeURIComponent(pass)}@aws-0-ap-southeast-1.pooler.supabase.com:5432/${db}`
        console.log('📡 Direct connection not reachable on this network, connecting via Supabase IPv4 Pooler...')
        pool = new pg.Pool({
          connectionString: poolerUrl,
          ssl: { rejectUnauthorized: false },
        })
        client = await pool.connect()
      } else {
        throw err
      }
    } else {
      throw err
    }
  }
  console.log('\n✅ Successfully connected to PostgreSQL database!')

  try {
    // ---------------------------------------------------------
    // STEP 1: Execute Complete Schema
    // ---------------------------------------------------------
    console.log('\n--- Step 1: Applying Complete PostgreSQL Schema (supabase/schema.sql) ---')
    const schemaSql = fs.readFileSync(path.resolve(process.cwd(), 'supabase/schema.sql'), 'utf8')
    await client.query(schemaSql)
    console.log('✓ Tables, Enums, Constraints, Triggers, RLS, and Realtime Publications created successfully!')

    // ---------------------------------------------------------
    // STEP 2: Seed Institutional Accounts into auth.users & public.profiles
    // ---------------------------------------------------------
    console.log('\n--- Step 2: Seeding Institutional Accounts into auth.users & profiles ---')
    await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`)

    for (const acc of SEED_ACCOUNTS) {
      const existing = await client.query(`SELECT id FROM auth.users WHERE email = $1`, [acc.email])
      let userId

      if (existing.rows.length > 0) {
        userId = existing.rows[0].id
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
            updated_at = now()
          WHERE id = $5;
          `,
          [acc.password, acc.full_name, acc.role, acc.department, userId]
        )
      } else {
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
        )
        userId = userRes.rows[0].id
      }

      // Upsert identity in auth.identities
      const idCheck = await client.query(
        `SELECT id FROM auth.identities WHERE user_id = $1::uuid AND provider = 'email'`,
        [userId]
      )

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
        )
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
          approval_status,
          is_active,
          permissions,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, 'approved', $6, $7, now())
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          full_name = EXCLUDED.full_name,
          role = EXCLUDED.role,
          department = EXCLUDED.department,
          approval_status = 'approved',
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
      )

      console.log(`✓ Account ready: ${acc.full_name} (${acc.role}) -> ${acc.email}`)
    }

    // ---------------------------------------------------------
    // STEP 3: Seed Classes, Subjects & Master Routine Timetable
    // ---------------------------------------------------------
    console.log('\n--- Step 3: Seeding Classes, Curriculum & Master Timetable ---')
    const masterDataContent = fs.readFileSync(path.resolve(process.cwd(), 'lib/master-data.ts'), 'utf8')

    // Extract MASTER_ROUTINE
    const routineStart = masterDataContent.indexOf('export const MASTER_ROUTINE: MasterRoutineItem[] = [')
    if (routineStart !== -1) {
      const routineCode = masterDataContent.substring(routineStart + 'export const MASTER_ROUTINE: MasterRoutineItem[] = ['.length - 1)
      const nextExport = routineCode.indexOf('export const DEFAULT_CLASSES')
      const arrayCode = nextExport !== -1 ? routineCode.substring(0, nextExport).trim().replace(/;$/, '') : routineCode
      const evalFn = new Function(`return ${arrayCode};`)
      const masterRoutine = evalFn()

      let insertedCount = 0
      for (const item of masterRoutine) {
        let startTime = '10:10'
        let endTime = '11:00'
        if (item.timeSlot) {
          const parenMatch = item.timeSlot.match(/\(([^)]+)\)/)
          const timeSegment = parenMatch ? parenMatch[1] : item.timeSlot
          const parts = timeSegment.split('-').map((s) => s.trim())
          if (parts.length >= 2) {
            startTime = parts[0]
            endTime = parts[1]
          }
        }

        const labId = item.labKey || 'comp'
        const subjectName = `${item.subjectCode} - ${item.subjectTitle}`
        const batchName = item.grade || 'Class 12'
        const span = item.span || 1
        const isMerged = Boolean(item.mergedParts && item.mergedParts.length > 0)
        const status = item.status || 'scheduled'
        const metadata = {
          teacher: item.teacher,
          labName: item.lab,
          studentsCount: item.defaultStudents,
          category: item.category,
          dotColor: item.dotColor,
          badgeColor: item.badgeColor,
          accentColor: item.accentColor,
        }

        await client.query(
          `
          INSERT INTO public.schedules (
            id, lab_id, subject_name, batch_name, start_time, end_time, slot_id, day_key, span, is_merged, status, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO UPDATE SET
            lab_id = EXCLUDED.lab_id,
            subject_name = EXCLUDED.subject_name,
            batch_name = EXCLUDED.batch_name,
            start_time = EXCLUDED.start_time,
            end_time = EXCLUDED.end_time,
            slot_id = EXCLUDED.slot_id,
            day_key = EXCLUDED.day_key,
            span = EXCLUDED.span,
            is_merged = EXCLUDED.is_merged,
            status = EXCLUDED.status,
            metadata = EXCLUDED.metadata;
          `,
          [
            item.id,
            labId,
            subjectName,
            batchName,
            startTime,
            endTime,
            item.slotId || 't2',
            item.dayKey || 'sun',
            span,
            isMerged,
            status,
            JSON.stringify(metadata),
          ]
        )
        insertedCount++
      }
      console.log(`✓ Seeded ${insertedCount} timetable sessions into public.schedules.`)
    }

    // Extract DEFAULT_CLASSES & DEFAULT_SUBJECTS
    const classesStart = masterDataContent.indexOf('export const DEFAULT_CLASSES: ClassCohort[] = [')
    const subjectsStart = masterDataContent.indexOf('export const DEFAULT_SUBJECTS: SubjectItem[] = [')
    if (classesStart !== -1 && subjectsStart !== -1) {
      const classesCode = masterDataContent.substring(
        classesStart + 'export const DEFAULT_CLASSES: ClassCohort[] = ['.length - 1,
        subjectsStart
      ).trim().replace(/;$/, '')
      const subjectsCode = masterDataContent.substring(
        subjectsStart + 'export const DEFAULT_SUBJECTS: SubjectItem[] = ['.length - 1
      ).trim().replace(/;$/, '')

      const evalClasses = new Function(`return ${classesCode};`)
      const evalSubjects = new Function(`return ${subjectsCode};`)
      const classesData = evalClasses()
      const subjectsData = evalSubjects()

      await client.query(
        `
        INSERT INTO public.institution_settings (key, value)
        VALUES 
          ('infrastructure_classes', $1::jsonb),
          ('infrastructure_subjects', $2::jsonb)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
        `,
        [JSON.stringify(classesData), JSON.stringify(subjectsData)]
      )
      console.log(`✓ Seeded ${classesData.length} classes and ${subjectsData.length} curriculum subjects into institution_settings.`)
    }

    console.log('\n--- Step 4: Verifying Table Integrity ---')
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `)
    console.log(`✓ Database contains ${tablesRes.rows.length} public tables:`)
    console.log(tablesRes.rows.map((r) => r.table_name).join(', '))

  } finally {
    client.release()
    await pool.end()
  }

  // ---------------------------------------------------------
  // STEP 5: Verify Supabase Client Login
  // ---------------------------------------------------------
  console.log('\n--- Step 5: Testing Supabase SDK Sign-in for Admin ---')
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@rrl.edu.np',
    password: 'Admin@12345',
  })

  if (authErr) {
    console.warn('⚠️ Supabase SDK sign-in test warning:', authErr.message)
  } else {
    console.log('✅ Supabase SDK Sign-in SUCCESSFUL for Super Admin!')
    console.log('   User ID:', authData.user?.id)
    await supabase.auth.signOut()
  }

  console.log('\n' + '='.repeat(70))
  console.log('🎉 SETUP COMPLETE! YOUR NEW SUPABASE PROJECT IS FULLY CONFIGURED!')
  console.log('='.repeat(70))
  console.log('\nYou can now run `npm run dev` and log in with:')
  console.log('  • Super Admin:  admin@rrl.edu.np     / Password: Admin@12345')
  console.log('  • Lab Incharge: incharge@rrl.edu.np  / Password: Incharge@12345')
  console.log('  • HOD:          hod@rrl.edu.np       / Password: Hod@12345')
  console.log('  • Teacher:      teacher@rrl.edu.np   / Password: Teacher@12345\n')
}

run().catch((err) => {
  console.error('\n❌ Fatal error during setup:', err)
  process.exit(1)
})
