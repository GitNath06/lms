import pg from 'pg';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
let dbUrl = '';
for (const line of env.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) {
    dbUrl = line.substring('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
  }
}

if (!dbUrl) {
  console.error('DATABASE_URL not found in .env.local');
  process.exit(1);
}

const { Pool } = pg;
const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    console.log('--- Applying Lab Status Migration ---');

    // 1. Add status column with CHECK constraint if not exists
    await pool.query(`
      ALTER TABLE public.labs 
      ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Operational';
    `);
    console.log('Column status added or verified.');

    // 2. Add CHECK constraint if not exists
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'labs_status_check'
        ) THEN
          ALTER TABLE public.labs 
          ADD CONSTRAINT labs_status_check 
          CHECK (status IN ('Operational', 'Under Maintenance', 'Inactive'));
        END IF;
      END $$;
    `);
    console.log('CHECK constraint labs_status_check created or verified.');

    // 3. Sync existing data: inactive labs get 'Inactive', active labs get 'Operational'
    const updateInactiveRes = await pool.query(`
      UPDATE public.labs 
      SET status = 'Inactive' 
      WHERE is_active = false AND status != 'Inactive';
    `);
    console.log(`Updated ${updateInactiveRes.rowCount} inactive lab(s) to 'Inactive'.`);

    const updateActiveRes = await pool.query(`
      UPDATE public.labs 
      SET status = 'Operational' 
      WHERE is_active = true AND status IS NULL;
    `);
    console.log(`Updated ${updateActiveRes.rowCount} active lab(s) to 'Operational'.`);

    // 4. Verify the updated rows
    const verifyRes = await pool.query(`
      SELECT id, name, code, status, is_active FROM public.labs ORDER BY id;
    `);
    console.log('Current labs in DB after migration:');
    console.table(verifyRes.rows);

  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
