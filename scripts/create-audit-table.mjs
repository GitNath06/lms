import pg from 'pg';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
let dbUrl = '';
for (const line of env.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) {
    dbUrl = line.substring('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
  }
}

const { Pool } = pg;
const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    console.log('🚀 Creating public.audit_logs table and indices...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
          actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
          actor_name TEXT NOT NULL,
          actor_role TEXT NOT NULL,
          action TEXT NOT NULL,          -- 'CREATE' | 'UPDATE' | 'DELETE' | 'RESET' | 'OVERRIDE'
          entity_type TEXT NOT NULL,     -- 'lab' | 'schedule' | 'user_role' | 'incident_category' | 'curriculum' | 'policy'
          entity_id TEXT,                -- Target record ID or code
          entity_label TEXT NOT NULL,    -- Human-readable target (e.g., 'Computer Lab 01', 'Class 9 FCA')
          changes JSONB,                 -- Structured diff: { "before": {...}, "after": {...} }
          metadata JSONB DEFAULT '{}'::jsonb
      );

      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON public.audit_logs (entity_type);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON public.audit_logs (actor_id);
    `);

    console.log('🔒 Applying Tamper-Resistance: Revoking UPDATE, DELETE, TRUNCATE...');
    // Revoke destructive operations from anon and authenticated roles
    await pool.query(`
      DO $$
      BEGIN
        REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM public;
        REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM authenticated;
        REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM anon;
      EXCEPTION
        WHEN undefined_object THEN NULL;
      END $$;
    `);

    console.log('🛡️ Configuring Row Level Security for audit_logs...');
    await pool.query(`
      ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "Allow super admins to view audit logs" ON public.audit_logs;
      CREATE POLICY "Allow super admins to view audit logs" 
      ON public.audit_logs FOR SELECT 
      USING (
        (auth.jwt() ->> 'role' = 'super_admin') 
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
      );

      -- Allow inserts from authenticated and service role (for audit event recording)
      DROP POLICY IF EXISTS "Allow authenticated users to insert audit logs" ON public.audit_logs;
      CREATE POLICY "Allow authenticated users to insert audit logs" 
      ON public.audit_logs FOR INSERT 
      WITH CHECK (true);
    `);

    console.log('✅ Audit log table successfully created and secured.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
