import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  console.log('🚀 Starting Phase 0: Staff Access Hardening & Database Security Migration...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Structural Schema Updates on public.profiles
    console.log('1. Adding honorific, bio, and teaching_preferences to public.profiles...');
    await client.query(`
      ALTER TABLE public.profiles 
        ADD COLUMN IF NOT EXISTS honorific TEXT,
        ADD COLUMN IF NOT EXISTS bio TEXT,
        ADD COLUMN IF NOT EXISTS teaching_preferences JSONB DEFAULT '{}'::jsonb;
    `);

    // 2. Update lifecycle check constraint
    console.log('2. Updating approval_status check constraint to include suspended...');
    await client.query(`
      ALTER TABLE public.profiles 
        DROP CONSTRAINT IF EXISTS profiles_approval_status_check;

      ALTER TABLE public.profiles 
        ADD CONSTRAINT profiles_approval_status_check 
        CHECK (approval_status IN ('pending', 'approved', 'rejected', 'suspended'));
    `);

    // 3. Create BEFORE UPDATE trigger on public.profiles to block self-update privilege escalation
    console.log('3. Installing prevent_profile_privilege_escalation() trigger...');
    await client.query(`
      CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $$
      BEGIN
        -- If caller is not a super_admin, prevent changes to privileged columns
        IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'super_admin' THEN
          IF NEW.role IS DISTINCT FROM OLD.role OR
             NEW.approval_status IS DISTINCT FROM OLD.approval_status OR
             NEW.is_active IS DISTINCT FROM OLD.is_active OR
             NEW.permissions IS DISTINCT FROM OLD.permissions THEN
            RAISE EXCEPTION 'Privilege escalation violation: Only Super Administrators can alter roles, permissions, approval status, or active states.';
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$;

      DROP TRIGGER IF EXISTS trg_prevent_profile_privilege_escalation ON public.profiles;
      CREATE TRIGGER trg_prevent_profile_privilege_escalation
        BEFORE UPDATE ON public.profiles
        FOR EACH ROW
        EXECUTE FUNCTION public.prevent_profile_privilege_escalation();
    `);

    // 4. Create Security Definer helper functions
    console.log('4. Creating is_approved_staff, owns_practical_log, and is_assigned_to_class_subject functions...');
    await client.query(`
      CREATE OR REPLACE FUNCTION public.is_approved_staff()
      RETURNS boolean
      LANGUAGE sql
      SECURITY DEFINER
      STABLE
      SET search_path = public
      AS $$
        SELECT EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
            AND approval_status = 'approved'
            AND is_active = true
        );
      $$;

      CREATE OR REPLACE FUNCTION public.owns_practical_log(p_log_id text)
      RETURNS boolean
      LANGUAGE sql
      SECURITY DEFINER
      STABLE
      SET search_path = public
      AS $$
        SELECT EXISTS (
          SELECT 1 FROM public.practical_logs
          WHERE id = p_log_id
            AND (teacher_id = auth.uid() OR logged_by = auth.uid())
        );
      $$;

      CREATE OR REPLACE FUNCTION public.is_assigned_to_class_subject(p_class_subject_id text)
      RETURNS boolean
      LANGUAGE sql
      SECURITY DEFINER
      STABLE
      SET search_path = public
      AS $$
        SELECT EXISTS (
          SELECT 1 FROM public.class_subjects
          WHERE id = p_class_subject_id
            AND teacher_id = auth.uid()
        );
      $$;
    `);

    // 5. Update RLS policies on practical_logs
    console.log('5. Hardening RLS policies on practical_logs...');
    await client.query(`
      DROP POLICY IF EXISTS "insert practical logs" ON public.practical_logs;
      CREATE POLICY "insert practical logs"
      ON public.practical_logs
      FOR INSERT
      TO authenticated
      WITH CHECK (
        is_privileged() OR (
          is_approved_staff() AND 
          (teacher_id = auth.uid() OR logged_by = auth.uid()) AND
          (class_subject_id IS NULL OR is_assigned_to_class_subject(class_subject_id))
        )
      );

      DROP POLICY IF EXISTS "update practical logs" ON public.practical_logs;
      CREATE POLICY "update practical logs"
      ON public.practical_logs
      FOR UPDATE
      TO authenticated
      USING (
        is_privileged() OR (
          is_approved_staff() AND 
          (teacher_id = auth.uid() OR logged_by = auth.uid()) AND
          (created_at > (now() - interval '24 hours'))
        )
      )
      WITH CHECK (
        is_privileged() OR (
          is_approved_staff() AND 
          (teacher_id = auth.uid() OR logged_by = auth.uid()) AND
          (class_subject_id IS NULL OR is_assigned_to_class_subject(class_subject_id)) AND
          (created_at > (now() - interval '24 hours'))
        )
      );

      DROP POLICY IF EXISTS "delete practical logs" ON public.practical_logs;
      CREATE POLICY "delete practical logs"
      ON public.practical_logs
      FOR DELETE
      TO authenticated
      USING (is_privileged());
    `);

    // 6. Hardening RLS on schedules, workstations, and lab_incidents
    console.log('6. Hardening RLS on schedules, workstations, and lab_incidents...');
    await client.query(`
      DROP POLICY IF EXISTS "Allow manage schedules authenticated" ON public.schedules;
      DROP POLICY IF EXISTS "Privileged manage schedules" ON public.schedules;
      CREATE POLICY "Privileged manage schedules"
      ON public.schedules
      FOR ALL
      TO authenticated
      USING (is_privileged())
      WITH CHECK (is_privileged());

      DROP POLICY IF EXISTS "Allow manage workstations" ON public.workstations;
      DROP POLICY IF EXISTS "Privileged manage workstations" ON public.workstations;
      CREATE POLICY "Privileged manage workstations"
      ON public.workstations
      FOR ALL
      TO authenticated
      USING (is_privileged())
      WITH CHECK (is_privileged());

      DROP POLICY IF EXISTS "insert lab incidents" ON public.lab_incidents;
      CREATE POLICY "insert lab incidents"
      ON public.lab_incidents
      FOR INSERT
      TO authenticated
      WITH CHECK (
        is_privileged() OR (
          is_approved_staff() AND reported_by_id = auth.uid()
        )
      );
    `);

    // 7. Storage RLS on avatars bucket
    console.log('7. Verifying storage bucket policies for avatars...');
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
          DROP POLICY IF EXISTS "Allow user avatar upload" ON storage.objects;
          CREATE POLICY "Allow user avatar upload"
          ON storage.objects
          FOR INSERT
          TO authenticated
          WITH CHECK (
            bucket_id = 'avatars' AND
            (storage.foldername(name))[1] = 'profiles' AND
            name LIKE 'profiles/' || auth.uid()::text || '%'
          );

          DROP POLICY IF EXISTS "Allow user avatar update" ON storage.objects;
          CREATE POLICY "Allow user avatar update"
          ON storage.objects
          FOR UPDATE
          TO authenticated
          USING (
            bucket_id = 'avatars' AND
            (storage.foldername(name))[1] = 'profiles' AND
            name LIKE 'profiles/' || auth.uid()::text || '%'
          );
        END IF;
      END $$;
    `);

    await client.query('COMMIT');
    console.log('✅ Phase 0 Migration completed successfully and committed atomically!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Phase 0 Migration failed. Rolled back.', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
