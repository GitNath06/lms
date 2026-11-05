import { Pool } from 'pg'


const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

async function run() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    console.log('1. Cleaning test practical_logs...')
    const delLogs = await client.query('DELETE FROM public.practical_logs;')
    console.log(`Deleted ${delLogs.rowCount} practical_logs rows.`)

    console.log('2. Cleaning prototype schedules...')
    const delSchedules = await client.query('DELETE FROM public.schedules;')
    console.log(`Deleted ${delSchedules.rowCount} schedules rows.`)

    console.log('3. Updating foreign key constraint on schedules.class_subject_id to ON DELETE CASCADE...')
    await client.query(`
      ALTER TABLE public.schedules 
      DROP CONSTRAINT IF EXISTS schedules_class_subject_id_fkey;

      ALTER TABLE public.schedules 
      ADD CONSTRAINT schedules_class_subject_id_fkey 
      FOREIGN KEY (class_subject_id) 
      REFERENCES public.class_subjects(id) 
      ON DELETE CASCADE;
    `)
    console.log('-> schedules_class_subject_id_fkey is now ON DELETE CASCADE')

    console.log('4. Updating foreign key constraint on schedules.teacher_id to ON DELETE SET NULL...')
    await client.query(`
      ALTER TABLE public.schedules 
      DROP CONSTRAINT IF EXISTS schedules_teacher_id_fkey;

      ALTER TABLE public.schedules 
      ADD CONSTRAINT schedules_teacher_id_fkey 
      FOREIGN KEY (teacher_id) 
      REFERENCES public.profiles(id) 
      ON DELETE SET NULL;
    `)
    console.log('-> schedules_teacher_id_fkey is now ON DELETE SET NULL')

    console.log('5. Updating foreign key constraint on class_subjects.teacher_id to ON DELETE SET NULL...')
    await client.query(`
      ALTER TABLE public.class_subjects 
      DROP CONSTRAINT IF EXISTS class_subjects_teacher_id_fkey;

      ALTER TABLE public.class_subjects 
      ADD CONSTRAINT class_subjects_teacher_id_fkey 
      FOREIGN KEY (teacher_id) 
      REFERENCES public.profiles(id) 
      ON DELETE SET NULL;
    `)
    console.log('-> class_subjects_teacher_id_fkey is now ON DELETE SET NULL')

    await client.query('COMMIT')
    console.log('\nSUCCESS: Database clean slate and foreign key cascade rules applied successfully.')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('ERROR during clean slate execution:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
