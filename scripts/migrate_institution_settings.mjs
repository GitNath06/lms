import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function runMigration() {
  try {
    console.log('Connecting to PostgreSQL database...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.institution_settings (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
        updated_by UUID REFERENCES public.profiles(id)
      );

      ALTER TABLE public.institution_settings ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "Anyone can view institution settings" ON public.institution_settings;
      CREATE POLICY "Anyone can view institution settings" 
        ON public.institution_settings FOR SELECT 
        USING (true);

      DROP POLICY IF EXISTS "Admins can manage institution settings" ON public.institution_settings;
      CREATE POLICY "Admins can manage institution settings" 
        ON public.institution_settings FOR ALL 
        USING (
          auth.jwt() ->> 'role' = 'service_role' OR
          EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'lab_incharge', 'hod')
          )
        );

      INSERT INTO public.institution_settings (key, value)
      VALUES (
        'calendar_settings',
        '{"startDay": "sun", "sundayWeekend": false, "saturdayWeekend": true}'::jsonb
      )
      ON CONFLICT (key) DO NOTHING;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_publication_tables 
          WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'institution_settings'
        ) THEN
          ALTER PUBLICATION supabase_realtime ADD TABLE public.institution_settings;
        END IF;
      END $$;
    `);

    console.log('✅ Migration succeeded: public.institution_settings created, RLS policies applied, and added to supabase_realtime publication.');

    const res = await pool.query('SELECT key, value, updated_at FROM public.institution_settings;');
    console.log('📊 Current institution settings rows:', res.rows);
  } catch (err) {
    console.error('❌ Migration error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
