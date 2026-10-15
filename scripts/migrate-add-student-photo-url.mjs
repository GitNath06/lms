import { getPgPool } from '../lib/db.ts';

async function migrate() {
  const pool = getPgPool();
  console.log('Adding photo_url column to public.students...');
  
  await pool.query(`
    ALTER TABLE public.students 
    ADD COLUMN IF NOT EXISTS photo_url TEXT;

    COMMENT ON COLUMN public.students.photo_url IS 'Base64 data URL or storage URI for student face avatar';
  `);

  console.log('Migration complete. Verifying schema...');
  const res = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'photo_url';
  `);
  console.log('Verified column:', res.rows);
  await pool.end();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
