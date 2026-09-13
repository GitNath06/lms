import fs from 'fs';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env.local', 'utf8');
let dbUrl = '', supabaseUrl = '', supabaseKey = '';
env.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed.startsWith('DATABASE_URL=')) dbUrl = trimmed.slice('DATABASE_URL='.length).replace(/^["']|["']$/g, '');
  if (trimmed.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = trimmed.slice('NEXT_PUBLIC_SUPABASE_URL='.length).replace(/^["']|["']$/g, '');
  if (trimmed.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) supabaseKey = trimmed.slice('NEXT_PUBLIC_SUPABASE_ANON_KEY='.length).replace(/^["']|["']$/g, '');
});

async function runMigration() {
  console.log('--- Step 1: Connecting to PostgreSQL via pool ---');
  const pool = new pg.Pool({ connectionString: dbUrl });

  try {
    // 1. Alter table to ensure all fields exist
    console.log('Applying ALTER TABLE additions...');
    await pool.query(`
      ALTER TABLE public.lab_incidents 
      ADD COLUMN IF NOT EXISTS circumstances text,
      ADD COLUMN IF NOT EXISTS is_fined boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS fine_amount numeric DEFAULT 0,
      ADD COLUMN IF NOT EXISTS fine_paid boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS fine_receipt_no text;
    `);

    // 2. Ensure RLS policies on lab_incidents allow institutional logging
    console.log('Ensuring RLS policies allow authenticated and anon operations...');
    await pool.query(`
      DO $$
      BEGIN
        -- lab_incidents select policy
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE tablename = 'lab_incidents' AND policyname = 'allow_public_read_lab_incidents'
        ) THEN
          CREATE POLICY allow_public_read_lab_incidents ON public.lab_incidents FOR SELECT USING (true);
        END IF;

        -- lab_incidents insert policy
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE tablename = 'lab_incidents' AND policyname = 'allow_public_insert_lab_incidents'
        ) THEN
          CREATE POLICY allow_public_insert_lab_incidents ON public.lab_incidents FOR INSERT WITH CHECK (true);
        END IF;

        -- lab_incidents update policy
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE tablename = 'lab_incidents' AND policyname = 'allow_public_update_lab_incidents'
        ) THEN
          CREATE POLICY allow_public_update_lab_incidents ON public.lab_incidents FOR UPDATE USING (true);
        END IF;

        -- lab_notifications policies
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE tablename = 'lab_notifications' AND policyname = 'allow_public_read_notifications'
        ) THEN
          CREATE POLICY allow_public_read_notifications ON public.lab_notifications FOR SELECT USING (true);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE tablename = 'lab_notifications' AND policyname = 'allow_public_write_notifications'
        ) THEN
          CREATE POLICY allow_public_write_notifications ON public.lab_notifications FOR ALL USING (true) WITH CHECK (true);
        END IF;
      END $$;
    `);

    // Notify PostgREST to reload schema cache
    await pool.query(`NOTIFY pgrst, 'reload schema';`);
    console.log('Notified PostgREST to reload schema cache.');

    // Verify columns
    const colsRes = await pool.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'lab_incidents' ORDER BY ordinal_position;
    `);
    console.log('Columns in lab_incidents:', colsRes.rows.map(r => r.column_name));

    console.log('--- Step 2: Testing Supabase client insert with anon key ---');
    const supabase = createClient(supabaseUrl, supabaseKey);
    const testId = `test-verify-${Date.now()}`;
    const { data, error } = await supabase.from('lab_incidents').insert({
      id: testId,
      lab_id: 'phys',
      date: new Date().toISOString().split('T')[0],
      session_label: 'Period 1 (10:10 - 11:00)',
      subject_name: 'Physics Lab',
      subject_teacher_name: 'Test Verification',
      batch_name: 'Class 11A',
      title: 'RLS & Column Test Verification',
      incident_type: 'breakage',
      severity: 'minor',
      equipment_name: 'Test Apparatus',
      quantity: 1,
      circumstances: 'Verifying fail-proof schema and RLS',
      status: 'reported',
      reported_by: 'Test Verifier'
    }).select();

    if (error) {
      console.error('Supabase test insert failed:', error);
    } else {
      console.log('Supabase test insert succeeded!', data);
      await pool.query('DELETE FROM public.lab_incidents WHERE id = $1', [testId]);
      console.log('Cleaned up test record.');
    }

    console.log('Migration completed successfully.');
  } finally {
    await pool.end();
  }
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
