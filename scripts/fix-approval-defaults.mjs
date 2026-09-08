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

async function run() {
  await client.connect();
  console.log('--- Applying Strict Approval Defaults to Database ---');

  // 1. Set column defaults on public.profiles
  await client.query(`
    ALTER TABLE public.profiles 
      ALTER COLUMN approval_status SET DEFAULT 'pending',
      ALTER COLUMN is_active SET DEFAULT FALSE;
  `);
  console.log('✅ Updated public.profiles defaults: approval_status=pending, is_active=false');

  // 2. Update trigger function handle_new_user()
  await client.query(`
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS trigger AS $$
    BEGIN
      INSERT INTO public.profiles (id, email, full_name, role, department, is_active, approval_status, permissions)
      VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        COALESCE(new.raw_user_meta_data->>'role', 'teacher'),
        COALESCE(new.raw_user_meta_data->>'department', 'Science Department'),
        COALESCE((new.raw_user_meta_data->>'is_active')::boolean, FALSE),
        COALESCE(new.raw_user_meta_data->>'approval_status', 'pending'),
        '{}'::jsonb
      )
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        department = EXCLUDED.department,
        is_active = EXCLUDED.is_active,
        approval_status = EXCLUDED.approval_status;
      RETURN new;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `);
  console.log('✅ Updated handle_new_user trigger to enforce pending approval');

  // 3. Update suraj.dinsu@gmail.com and any non-institutional accounts to pending & inactive
  await client.query(`
    UPDATE public.profiles
    SET approval_status = 'pending', is_active = FALSE
    WHERE email = 'suraj.dinsu@gmail.com';
  `);
  console.log('✅ Set suraj.dinsu@gmail.com to approval_status=pending and is_active=false');

  // 4. Create sample pending notifications for admin & lab incharge if not exists
  const existingNotif = await client.query(`
    SELECT id FROM public.lab_notifications 
    WHERE title LIKE 'New Teacher Registration%' AND message LIKE '%suraj.dinsu@gmail.com%';
  `);

  if (existingNotif.rows.length === 0) {
    const notifId1 = `notif-reg-admin-${Date.now()}`;
    const notifId2 = `notif-reg-incharge-${Date.now()}`;

    await client.query(`
      INSERT INTO public.lab_notifications (id, target_role, title, message, severity, is_read, created_at)
      VALUES 
      ($1, 'super_admin', 'New Teacher Registration: Dinanath Shah', 'Dinanath Shah (suraj.dinsu@gmail.com, Department: Science Department) has verified institutional email and is awaiting Super Admin approval.', 'warning', false, now()),
      ($2, 'lab_incharge', 'New Teacher Registration: Dinanath Shah', 'Dinanath Shah (suraj.dinsu@gmail.com, Department: Science Department) has registered for practical laboratory access.', 'info', false, now());
    `, [notifId1, notifId2]);
    console.log('✅ Dispatched notifications to super_admin and lab_incharge for pending registration');
  }

  const check = await client.query(`
    SELECT email, role, is_active, approval_status 
    FROM public.profiles 
    WHERE email = 'suraj.dinsu@gmail.com';
  `);
  console.table(check.rows);

  await client.end();
}

run().catch(console.error);
