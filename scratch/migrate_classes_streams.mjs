import pg from 'pg'
const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function run() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    console.log('1. Populating public.streams reference table...')
    await client.query(`
      INSERT INTO public.streams (id, name, code) VALUES
        ('Computer Engineering', 'Computer Engineering', 'ENG'),
        ('Management', 'Management', 'MGT'),
        ('General Science', 'General Science', 'SCI'),
        ('Basic Science & Computing', 'Basic Science & Computing', 'BSC'),
        ('tech', 'Computer Engineering', 'TECH'),
        ('science', 'General Science', 'SCIN'),
        ('school', 'General School', 'SCH')
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code;
    `)

    console.log('2. Normalizing public.classes records...')
    // For classes that have null stream_id, populate stream_id from section if section has stream description
    await client.query(`
      UPDATE public.classes
      SET stream_id = 'Computer Engineering', section = 'Eng'
      WHERE id = '12eng';
    `)

    await client.query(`
      UPDATE public.classes
      SET stream_id = 'Management', section = 'Mgt'
      WHERE id = '12mgt';
    `)

    await client.query(`
      UPDATE public.classes
      SET stream_id = 'Computer Engineering', section = 'Eng'
      WHERE id = '11eng';
    `)

    await client.query(`
      UPDATE public.classes
      SET stream_id = 'Management', section = 'Mgt'
      WHERE id = '11mgt';
    `)

    await client.query(`
      UPDATE public.classes
      SET stream_id = 'Computer Engineering', section = 'Eng'
      WHERE id = '10eng';
    `)

    await client.query(`
      UPDATE public.classes
      SET stream_id = 'Computer Engineering', section = 'Eng'
      WHERE id = '9eng';
    `)

    await client.query(`
      UPDATE public.classes
      SET stream_id = 'General Science', section = 'A'
      WHERE id = '8a';
    `)

    await client.query(`
      UPDATE public.classes
      SET stream_id = 'General Science', section = 'B'
      WHERE id = '7b';
    `)

    await client.query(`
      UPDATE public.classes
      SET stream_id = 'Basic Science & Computing', section = 'A'
      WHERE id = '6a';
    `)

    await client.query('COMMIT')
    console.log('✅ Migration committed successfully!')

    const res = await client.query('SELECT id, name, grade, section, stream_id, capacity FROM public.classes ORDER BY grade DESC, name ASC;')
    console.log('UPDATED CLASSES IN DB:\n', res.rows)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Migration failed:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
