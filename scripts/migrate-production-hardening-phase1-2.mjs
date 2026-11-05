import pg from 'pg';
import fs from 'fs';

// Load connection string from .env.local
const envContent = fs.readFileSync('.env.local', 'utf-8');
let dbUrl = '';
for (const line of envContent.split('\n')) {
  if (line.trim().startsWith('DATABASE_URL=')) {
    dbUrl = line.trim().substring('DATABASE_URL='.length).replace(/^["']|["']$/g, '');
  }
}

if (!dbUrl) {
  console.error('FATAL: DATABASE_URL not found in .env.local');
  process.exit(1);
}

// Convert port 5432 session pooler to 6543 transaction pooler if needed
if (dbUrl.includes('.pooler.supabase.com:5432')) {
  dbUrl = dbUrl.replace('.pooler.supabase.com:5432', '.pooler.supabase.com:6543');
}

const { Pool } = pg;
const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

async function runMigration() {
  console.log('================================================================');
  console.log('LabSync LIMS — Production Hardening Migration (Phase 1 & Phase 2)');
  console.log('================================================================');

  const client = await pool.connect();
  try {
    // -----------------------------------------------------------------
    // 1. PHASE 1: SECURITY HARDENING
    // -----------------------------------------------------------------
    console.log('\n[Phase 1.1] Hardening public.profiles against self-role escalation...');
    await client.query(`
      REVOKE UPDATE (role, approval_status, permissions, is_active) ON public.profiles FROM authenticated;
    `);

    await client.query(`
      CREATE OR REPLACE FUNCTION public.protect_profile_escalation()
      RETURNS TRIGGER AS $$
      BEGIN
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

      DROP TRIGGER IF EXISTS trg_protect_profile_escalation ON public.profiles;
      CREATE TRIGGER trg_protect_profile_escalation
        BEFORE UPDATE ON public.profiles
        FOR EACH ROW
        EXECUTE FUNCTION public.protect_profile_escalation();
    `);
    console.log('✓ Profile escalation guard trigger installed and column grants revoked.');

    console.log('\n[Phase 1.5] Hardening RLS policies on labs, schedules, and settings...');
    await client.query(`
      -- Labs
      DROP POLICY IF EXISTS "Allow insert/update labs" ON public.labs;
      DROP POLICY IF EXISTS "Allow manage labs" ON public.labs;
      DROP POLICY IF EXISTS "Privileged manage labs" ON public.labs;
      CREATE POLICY "Privileged manage labs" ON public.labs
        FOR ALL TO authenticated
        USING (public.is_privileged())
        WITH CHECK (public.is_privileged());

      -- Schedules
      DROP POLICY IF EXISTS "Allow manage schedules" ON public.schedules;
      DROP POLICY IF EXISTS "Privileged manage schedules" ON public.schedules;
      CREATE POLICY "Privileged manage schedules" ON public.schedules
        FOR ALL TO authenticated
        USING (public.is_privileged())
        WITH CHECK (public.is_privileged());

      -- Calendar settings
      DROP POLICY IF EXISTS "Allow update calendar settings" ON public.calendar_settings;
      DROP POLICY IF EXISTS "Privileged manage calendar settings" ON public.calendar_settings;
      CREATE POLICY "Privileged manage calendar settings" ON public.calendar_settings
        FOR ALL TO authenticated
        USING (public.is_privileged())
        WITH CHECK (public.is_privileged());

      -- Audit logs
      DROP POLICY IF EXISTS "Allow authenticated users to insert audit logs" ON public.audit_logs;
      REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM anon, authenticated;

      -- Teacher substitutions
      DROP POLICY IF EXISTS "Allow manage teacher_substitutions" ON public.teacher_substitutions;
      CREATE POLICY "Teacher own or privileged manage substitutions" ON public.teacher_substitutions
        FOR ALL TO authenticated
        USING (original_teacher_id = auth.uid() OR substitute_teacher_id = auth.uid() OR public.is_privileged())
        WITH CHECK (original_teacher_id = auth.uid() OR substitute_teacher_id = auth.uid() OR public.is_privileged());
    `);
    console.log('✓ RLS write access restricted to privileged administrators and authorized teachers.');

    // -----------------------------------------------------------------
    // 2. PHASE 2: DATABASE INDEXING & QUERY PERFORMANCE
    // -----------------------------------------------------------------
    console.log('\n[Phase 2.2] Applying B-Tree and Composite Indexes...');

    console.log('  -> Creating idx_practical_logs_lookup...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_practical_logs_lookup 
        ON public.practical_logs (lab_id, academic_year_id, date DESC);
    `);

    console.log('  -> Creating idx_practical_logs_schedule_date...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_practical_logs_schedule_date 
        ON public.practical_logs (schedule_id, date);
    `);

    console.log('  -> Creating idx_practical_logs_teacher...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_practical_logs_teacher 
        ON public.practical_logs (teacher_id, date DESC);
    `);

    console.log('  -> Creating idx_log_attendance_log_roll...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_log_attendance_log_roll 
        ON public.log_attendance (log_id, roll_number);
    `);

    console.log('  -> Creating idx_log_attendance_enrollment...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_log_attendance_enrollment 
        ON public.log_attendance (enrollment_id);
    `);

    console.log('  -> Creating idx_student_enrollments_year_class_status (Pre-flight adjustment)...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_student_enrollments_year_class_status
        ON public.student_enrollments (academic_year_id, class_id, status, roll_number);
    `);

    console.log('  -> Creating idx_lab_incidents_lookup...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_lab_incidents_lookup 
        ON public.lab_incidents (lab_id, status, date DESC);
    `);

    console.log('  -> Creating idx_schedules_lab_day with day_key (Pre-flight adjustment)...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_schedules_lab_day 
        ON public.schedules (lab_id, day_key);
    `);

    console.log('  -> Creating idx_maintenance_logs_lab with service_date (Pre-flight adjustment)...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_maintenance_logs_lab 
        ON public.maintenance_logs (lab_id, service_date DESC);
    `);

    console.log('✓ All database indexes created successfully.');

    console.log('\n================================================================');
    console.log('MIGRATION COMPLETE: All Phase 1 & 2 Database Upgrades Applied!');
    console.log('================================================================');
  } catch (error) {
    console.error('\nMIGRATION FAILED:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
