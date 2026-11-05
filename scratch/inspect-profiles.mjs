import pg from 'pg';


const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const cols = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'profiles' AND table_schema = 'public'
    ORDER BY ordinal_position;
  `);
  const profiles = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'profiles' AND table_schema = 'public'
    ORDER BY ordinal_position;
  `);
  console.log('--- UPDATED PROFILES COLUMNS ---');
  console.table(profiles.rows);

  await pool.end();
}

run().catch(console.error);
