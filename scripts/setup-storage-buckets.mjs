import pg from 'pg'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const match = env.match(/DATABASE_URL=["']?([^"'\r\n]+)/)
if (!match) {
  throw new Error('DATABASE_URL not found in .env.local')
}

const pool = new pg.Pool({
  connectionString: match[1],
  ssl: { rejectUnauthorized: false },
})

async function runStorageMigration() {
  const client = await pool.connect()
  try {
    console.log('--- Phase 1: Creating Supabase Storage Buckets & Policies ---')

    await client.query('BEGIN')

    // 1. Create buckets in storage.buckets
    const createBucketsSql = `
      INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      VALUES 
        ('avatars', 'avatars', true, 5242880, ARRAY['image/webp', 'image/jpeg', 'image/png']::text[]),
        ('incident-photos', 'incident-photos', true, 5242880, ARRAY['image/webp', 'image/jpeg', 'image/png']::text[])
      ON CONFLICT (id) DO UPDATE SET 
        public = true,
        file_size_limit = 5242880,
        allowed_mime_types = ARRAY['image/webp', 'image/jpeg', 'image/png']::text[];
    `
    await client.query(createBucketsSql)
    console.log('✅ Storage buckets "avatars" and "incident-photos" created/verified.')

    // 2. Storage RLS Policies on storage.objects
    // Public Read policy for avatars and incident-photos
    const policiesSql = `
      DO $$
      BEGIN
        -- Public read access for avatars
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies 
          WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Public read avatars'
        ) THEN
          CREATE POLICY "Public read avatars"
            ON storage.objects FOR SELECT
            USING (bucket_id = 'avatars');
        END IF;

        -- Public read access for incident photos
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies 
          WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Public read incident photos'
        ) THEN
          CREATE POLICY "Public read incident photos"
            ON storage.objects FOR SELECT
            USING (bucket_id = 'incident-photos');
        END IF;

        -- Authenticated insert access
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies 
          WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Authenticated insert photos'
        ) THEN
          CREATE POLICY "Authenticated insert photos"
            ON storage.objects FOR INSERT
            TO authenticated
            WITH CHECK (bucket_id IN ('avatars', 'incident-photos'));
        END IF;

        -- Authenticated update access
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies 
          WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Authenticated update photos'
        ) THEN
          CREATE POLICY "Authenticated update photos"
            ON storage.objects FOR UPDATE
            TO authenticated
            USING (bucket_id IN ('avatars', 'incident-photos'));
        END IF;

        -- Privileged delete access
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies 
          WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Privileged delete photos'
        ) THEN
          CREATE POLICY "Privileged delete photos"
            ON storage.objects FOR DELETE
            TO authenticated
            USING (
              bucket_id IN ('avatars', 'incident-photos') AND
              EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'lab_incharge')
              )
            );
        END IF;
      END $$;
    `
    await client.query(policiesSql)
    console.log('✅ Storage RLS security policies successfully applied to storage.objects.')

    await client.query('COMMIT')

    // Verify buckets
    const res = await client.query('SELECT id, name, public, file_size_limit FROM storage.buckets;')
    console.log('\n--- Active Buckets Telemetry ---')
    console.table(res.rows)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌ Error applying storage migration:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

runStorageMigration()
