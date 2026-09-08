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

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is missing.');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  console.log('🚀 Connecting to PostgreSQL database...');
  await client.connect();

  console.log('📦 Applying Upgrade 1: Adding reported_by_id and resolved_by_id to lab_incidents...');
  await client.query(`
    -- Add verified reporter identity to lab_incidents
    ALTER TABLE public.lab_incidents
      ADD COLUMN IF NOT EXISTS reported_by_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

    -- Add verified resolver identity
    ALTER TABLE public.lab_incidents
      ADD COLUMN IF NOT EXISTS resolved_by_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

    -- Backfill: match existing rows by full_name where possible
    UPDATE public.lab_incidents li
    SET reported_by_id = p.id
    FROM public.profiles p
    WHERE li.reported_by_id IS NULL
      AND lower(trim(li.reported_by)) = lower(trim(p.full_name));
  `);
  console.log('✅ Upgrade 1 applied successfully.');

  console.log('🔒 Applying Upgrade 2: Creating security definer role helpers...');
  await client.query(`
    CREATE OR REPLACE FUNCTION public.current_role()
    RETURNS text
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $$
      SELECT role FROM public.profiles WHERE id = auth.uid();
    $$;

    CREATE OR REPLACE FUNCTION public.is_privileged()
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $$
      SELECT public.current_role() IN ('super_admin', 'lab_incharge', 'hod', 'admin');
    $$;
  `);
  console.log('✅ Helper functions current_role() and is_privileged() created.');

  console.log('🛡️ Applying Upgrade 2: Tightening RLS policies on practical_logs, lab_incidents, and lab_notifications...');
  await client.query(`
    -- Ensure RLS is active
    ALTER TABLE public.practical_logs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.lab_incidents ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.lab_notifications ENABLE ROW LEVEL SECURITY;

    -- PRACTICAL LOGS POLICIES
    DROP POLICY IF EXISTS "Allow read practical logs" ON public.practical_logs;
    DROP POLICY IF EXISTS "Allow insert practical logs" ON public.practical_logs;
    DROP POLICY IF EXISTS "Allow update practical logs" ON public.practical_logs;
    DROP POLICY IF EXISTS "Allow delete practical logs" ON public.practical_logs;
    DROP POLICY IF EXISTS "read practical logs" ON public.practical_logs;
    DROP POLICY IF EXISTS "insert practical logs" ON public.practical_logs;
    DROP POLICY IF EXISTS "update practical logs" ON public.practical_logs;
    DROP POLICY IF EXISTS "delete practical logs" ON public.practical_logs;

    CREATE POLICY "read practical logs" ON public.practical_logs
      FOR SELECT TO authenticated
      USING ( public.is_privileged() OR teacher_id = auth.uid() );

    CREATE POLICY "insert practical logs" ON public.practical_logs
      FOR INSERT TO authenticated
      WITH CHECK ( public.is_privileged() OR teacher_id = auth.uid() );

    CREATE POLICY "update practical logs" ON public.practical_logs
      FOR UPDATE TO authenticated
      USING ( public.is_privileged() OR teacher_id = auth.uid() );

    CREATE POLICY "delete practical logs" ON public.practical_logs
      FOR DELETE TO authenticated
      USING ( public.is_privileged() );

    -- LAB INCIDENTS POLICIES
    DROP POLICY IF EXISTS "Allow manage lab incidents" ON public.lab_incidents;
    DROP POLICY IF EXISTS "read lab incidents" ON public.lab_incidents;
    DROP POLICY IF EXISTS "insert lab incidents" ON public.lab_incidents;
    DROP POLICY IF EXISTS "update lab incidents" ON public.lab_incidents;
    DROP POLICY IF EXISTS "delete lab incidents" ON public.lab_incidents;

    CREATE POLICY "read lab incidents" ON public.lab_incidents
      FOR SELECT TO authenticated
      USING ( public.is_privileged() OR reported_by_id = auth.uid() );

    CREATE POLICY "insert lab incidents" ON public.lab_incidents
      FOR INSERT TO authenticated
      WITH CHECK ( reported_by_id = auth.uid() OR public.is_privileged() );

    CREATE POLICY "update lab incidents" ON public.lab_incidents
      FOR UPDATE TO authenticated
      USING ( public.is_privileged() );

    CREATE POLICY "delete lab incidents" ON public.lab_incidents
      FOR DELETE TO authenticated
      USING ( public.is_privileged() );

    -- LAB NOTIFICATIONS POLICIES
    DROP POLICY IF EXISTS "Allow manage lab notifications" ON public.lab_notifications;
    DROP POLICY IF EXISTS "read lab notifications" ON public.lab_notifications;
    DROP POLICY IF EXISTS "write lab notifications" ON public.lab_notifications;

    CREATE POLICY "read lab notifications" ON public.lab_notifications
      FOR SELECT TO authenticated
      USING ( public.is_privileged() OR target_role = public.current_role() );

    CREATE POLICY "write lab notifications" ON public.lab_notifications
      FOR ALL TO authenticated
      USING ( public.is_privileged() )
      WITH CHECK ( public.is_privileged() );
  `);
  console.log('✅ Tightened RLS policies installed successfully.');

  // Verification inspection
  const columns = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lab_incidents'
      AND column_name IN ('reported_by_id', 'resolved_by_id')
  `);
  console.log('--- LAB_INCIDENTS NEW COLUMNS ---');
  console.table(columns.rows);

  await client.end();
  console.log('🎉 Migration finished successfully.');
}

run().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
