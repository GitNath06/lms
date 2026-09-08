import pg from 'pg'
const { Pool } = pg

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.xysdrtbomtqgqtiojcev:labmanagement%40123@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres'

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
})

async function run() {
  console.log('Migrating email_dispatch_logs table...')
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.email_dispatch_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        dispatch_type text NOT NULL,
        recipient_email text NOT NULL,
        reference_date date NOT NULL DEFAULT CURRENT_DATE,
        metadata jsonb DEFAULT '{}'::jsonb,
        created_at timestamptz DEFAULT now(),
        CONSTRAINT email_dispatch_unique_per_day UNIQUE (dispatch_type, recipient_email, reference_date)
      );

      CREATE INDEX IF NOT EXISTS idx_email_dispatch_logs_type_date 
      ON public.email_dispatch_logs(dispatch_type, reference_date);

      CREATE INDEX IF NOT EXISTS idx_email_dispatch_logs_recipient 
      ON public.email_dispatch_logs(recipient_email);
    `)
    console.log('✅ email_dispatch_logs table migrated successfully!')
  } catch (err) {
    console.error('❌ Migration failed:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
