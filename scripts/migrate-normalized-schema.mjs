import pg from 'pg'

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function run() {
  console.log('🚀 Starting Database Normalization & Relational Migration...')
  await client.connect()

  try {
    await client.query('BEGIN')

    // 1. EXTENSIONS
    await client.query(`create extension if not exists "uuid-ossp";`)
    await client.query(`create extension if not exists "pgcrypto";`)

    // 2. STREAMS TABLE
    console.log('📦 Ensuring public.streams table exists...')
    await client.query(`
      create table if not exists public.streams (
        id text primary key,
        name text not null,
        code text unique,
        created_at timestamptz default now()
      );
    `)

    // 3. CLASSES TABLE (Flexible human-readable name as unique key, grade & section auxiliary)
    console.log('📦 Ensuring public.classes table exists...')
    await client.query(`
      create table if not exists public.classes (
        id text primary key,
        name text not null unique,
        grade int,
        section text,
        stream_id text references public.streams(id) on delete set null,
        capacity int not null default 40,
        is_active boolean not null default true,
        created_at timestamptz default now()
      );
    `)

    // 4. SUBJECTS TABLE
    console.log('📦 Ensuring public.subjects table exists...')
    await client.query(`
      create table if not exists public.subjects (
        id text primary key,
        code text not null unique,
        name text not null,
        default_lab_id text references public.labs(id) on delete set null,
        credit_hours numeric default 4.0,
        is_active boolean not null default true,
        created_at timestamptz default now()
      );
    `)

    // 5. CLASS_SUBJECTS (Curriculum Junction: Class ↔ Subject ↔ Assigned Teacher)
    console.log('📦 Ensuring public.class_subjects table exists...')
    await client.query(`
      create table if not exists public.class_subjects (
        id text primary key default gen_random_uuid()::text,
        class_id text references public.classes(id) on delete cascade not null,
        subject_id text references public.subjects(id) on delete cascade not null,
        teacher_id uuid references public.profiles(id) on delete set null,
        default_lab_id text references public.labs(id) on delete set null,
        created_at timestamptz default now(),
        unique(class_id, subject_id, teacher_id)
      );
    `)

    // 6. LOG_ATTENDANCE (1NF Atomic Student Attendance)
    console.log('📦 Ensuring public.log_attendance table exists...')
    await client.query(`
      create table if not exists public.log_attendance (
        id text primary key default gen_random_uuid()::text,
        log_id text references public.practical_logs(id) on delete cascade not null,
        roll_number int not null,
        is_present boolean not null default true,
        created_at timestamptz default now(),
        unique(log_id, roll_number)
      );
    `)

    // 7. TEACHER_SUBSTITUTIONS (Standardized Naming with UUID Foreign Keys)
    console.log('📦 Ensuring public.teacher_substitutions table exists...')
    await client.query(`
      create table if not exists public.teacher_substitutions (
        id text primary key,
        schedule_id text references public.schedules(id) on delete cascade,
        date date not null default current_date,
        slot_id text not null default 't2',
        lab_id text references public.labs(id) on delete cascade not null,
        original_teacher_id uuid references public.profiles(id) on delete cascade not null,
        original_teacher_name text not null,
        substitute_teacher_id uuid references public.profiles(id) on delete cascade not null,
        substitute_teacher_name text not null,
        reason text,
        status text not null default 'assigned',
        created_at timestamptz default now()
      );
    `)

    // 8. ALTER EXISTING TABLES FOR RELATIONAL INTEGRITY
    console.log('🔗 Adding foreign key columns to existing tables...')
    await client.query(`
      alter table public.labs 
        add column if not exists incharge_id uuid references public.profiles(id) on delete set null;

      alter table public.schedules 
        add column if not exists class_subject_id text references public.class_subjects(id) on delete set null;

      alter table public.practical_logs 
        add column if not exists class_subject_id text references public.class_subjects(id) on delete set null;
    `)

    // Link Dr. Rajesh Sharma as Lab In-Charge for Computer & Electronics Lab if available
    const inchargeRes = await client.query(`select id from public.profiles where role = 'lab_incharge' limit 1;`)
    if (inchargeRes.rows.length > 0) {
      await client.query(`update public.labs set incharge_id = $1 where incharge_id is null;`, [inchargeRes.rows[0].id])
    }

    // 9. DATABASE TRIGGER FOR ATOMIC 1NF ATTENDANCE SYNC
    console.log('⚡ Creating database trigger for atomic log_attendance synchronization...')
    await client.query(`
      create or replace function public.sync_practical_log_attendance()
      returns trigger as $$
      declare
        effective_headcount int;
        r int;
        is_absent boolean;
      begin
        -- 1. Determine safe, non-zero headcount
        effective_headcount := coalesce(
          nullif(new.total_students, 0),
          nullif(new.present_students + new.absent_students, 0),
          (select coalesce(max(val), 0) from unnest(new.absent_rolls) as val),
          40
        );

        -- 2. Clean existing records for this log entry to handle updates
        delete from public.log_attendance where log_id = new.id;

        -- 3. Atomically populate 1NF attendance rows
        if effective_headcount > 0 then
          for r in 1..effective_headcount loop
            is_absent := (new.absent_rolls is not null and r = any(new.absent_rolls));
            insert into public.log_attendance (id, log_id, roll_number, is_present, created_at)
            values (
              gen_random_uuid()::text,
              new.id,
              r,
              not is_absent,
              now()
            )
            on conflict (log_id, roll_number) do update set
              is_present = excluded.is_present;
          end loop;
        end if;

        return new;
      end;
      $$ language plpgsql security definer;

      drop trigger if exists trg_sync_practical_log_attendance on public.practical_logs;
      create trigger trg_sync_practical_log_attendance
        after insert or update of total_students, absent_rolls, present_students, absent_students
        on public.practical_logs
        for each row execute function public.sync_practical_log_attendance();
    `)

    // 10. SEED REFERENCE DATA (STREAMS, CLASSES, SUBJECTS, CLASS_SUBJECTS)
    console.log('🌱 Seeding streams...')
    await client.query(`
      insert into public.streams (id, name, code) values
        ('tech', 'Computer & Electronics Engineering', 'TECH'),
        ('science', 'General Science Stream (+2)', 'SCI'),
        ('school', 'Secondary Core Curriculum', 'SEC')
      on conflict (id) do update set name = excluded.name, code = excluded.code;
    `)

    console.log('🌱 Seeding classes...')
    const classes = [
      { id: '12c', name: '12C - Tech Stream Sec A', grade: 12, section: 'C', stream_id: 'tech', capacity: 40 },
      { id: '12c-short', name: '12C', grade: 12, section: 'C', stream_id: 'tech', capacity: 40 },
      { id: '11c', name: '11C - Tech Stream Sec A', grade: 11, section: 'C', stream_id: 'tech', capacity: 40 },
      { id: '12sc', name: '12 Sc - Science Stream Sec B', grade: 12, section: 'Sc', stream_id: 'science', capacity: 40 },
      { id: '11sc', name: '11 Sc - Science Stream Sec B', grade: 11, section: 'Sc', stream_id: 'science', capacity: 40 },
      { id: '11sc-short', name: '11 Sc', grade: 11, section: 'Sc', stream_id: 'science', capacity: 40 },
      { id: 'class12', name: 'Class 12', grade: 12, section: 'General', stream_id: 'tech', capacity: 40 },
      { id: 'class11', name: 'Class 11', grade: 11, section: 'General', stream_id: 'science', capacity: 40 },
      { id: 'class10', name: 'Class 10', grade: 10, section: 'A', stream_id: 'school', capacity: 40 },
      { id: '10a', name: '10A - Secondary Sec A', grade: 10, section: 'A', stream_id: 'school', capacity: 40 },
      { id: 'class9', name: 'Class 9', grade: 9, section: 'B', stream_id: 'school', capacity: 40 },
      { id: '9b', name: '9B - Secondary Sec B', grade: 9, section: 'B', stream_id: 'school', capacity: 40 },
      { id: '8a', name: '8A - Lower Secondary Sec A', grade: 8, section: 'A', stream_id: 'school', capacity: 40 },
      { id: '7b', name: '7B - Lower Secondary Sec B', grade: 7, section: 'B', stream_id: 'school', capacity: 40 },
      { id: '6a', name: '6A - Lower Secondary Sec A', grade: 6, section: 'A', stream_id: 'school', capacity: 40 },
    ]

    for (const cls of classes) {
      await client.query(`
        insert into public.classes (id, name, grade, section, stream_id, capacity)
        values ($1, $2, $3, $4, $5, $6)
        on conflict (name) do update set
          grade = excluded.grade,
          section = excluded.section,
          stream_id = excluded.stream_id,
          capacity = excluded.capacity;
      `, [cls.id, cls.name, cls.grade, cls.section, cls.stream_id, cls.capacity])
    }

    console.log('🌱 Seeding subjects...')
    const subjects = [
      { id: 'comp12', code: 'COMP-12', name: 'Data Structures & Algorithms Lab', default_lab_id: 'comp', credit_hours: 4 },
      { id: 'comp11', code: 'COMP-11', name: 'Computer Fundamentals & C Programming', default_lab_id: 'comp', credit_hours: 4 },
      { id: 'crm10', code: 'CRM-10', name: 'Computer Repair & Maintenance Lab', default_lab_id: 'comp', credit_hours: 3 },
      { id: 'wpd9', code: 'WPD-9', name: 'Web Page Design Lab', default_lab_id: 'comp', credit_hours: 3 },
      { id: 'sep12', code: 'SEP-12', name: 'Software Eng & Proj', default_lab_id: 'comp', credit_hours: 4 },
      { id: 'ict8', code: 'ICT-8', name: 'Digital Literacy & Scratch Programming', default_lab_id: 'comp', credit_hours: 2 },
      { id: 'ict7', code: 'ICT-7', name: 'Keyboarding & Office Applications', default_lab_id: 'comp', credit_hours: 2 },
      { id: 'ict6', code: 'ICT-6', name: 'Introduction to Computers & Paint', default_lab_id: 'comp', credit_hours: 2 },
      { id: 'phy12', code: 'PHY-12', name: 'Modern Physics & Electromagnetism', default_lab_id: 'phys', credit_hours: 4 },
      { id: 'phy11', code: 'PHY-11', name: 'Optics & Wave Mechanics', default_lab_id: 'phys', credit_hours: 4 },
      { id: 'chem12', code: 'CHEM-12', name: 'Organic Synthesis & Qualitative Analysis', default_lab_id: 'chem', credit_hours: 4 },
      { id: 'chem11', code: 'CHEM-11', name: 'General Chemistry & Titration Lab', default_lab_id: 'chem', credit_hours: 4 },
      { id: 'bio12', code: 'BIO-12', name: 'Plant Physiology & Genetics Lab', default_lab_id: 'bio', credit_hours: 4 },
      { id: 'bio11', code: 'BIO-11', name: 'Cell Biology & Microscopy Lab', default_lab_id: 'bio', credit_hours: 4 },
      { id: 'elec12', code: 'ELEC-12', name: 'Microprocessors & Embedded Systems Lab', default_lab_id: 'elec', credit_hours: 4 },
      { id: 'elec11', code: 'ELEC-11', name: 'Basic Electronics & Circuit Theory Lab', default_lab_id: 'elec', credit_hours: 4 },
    ]

    for (const sub of subjects) {
      await client.query(`
        insert into public.subjects (id, code, name, default_lab_id, credit_hours)
        values ($1, $2, $3, $4, $5)
        on conflict (code) do update set
          name = excluded.name,
          default_lab_id = excluded.default_lab_id,
          credit_hours = excluded.credit_hours;
      `, [sub.id, sub.code, sub.name, sub.default_lab_id, sub.credit_hours])
    }

    console.log('🌱 Seeding class_subjects curriculum assignments...')
    // Map teachers by UUID
    const anishRes = await client.query(`select id from public.profiles where full_name ilike '%Anish Karki%' limit 1;`)
    const prakashRes = await client.query(`select id from public.profiles where full_name ilike '%Prakash Adhikari%' limit 1;`)
    const anishId = anishRes.rows[0]?.id || null
    const prakashId = prakashRes.rows[0]?.id || null

    const curriculum = [
      { class_name: '12C - Tech Stream Sec A', subject_code: 'COMP-12', teacher_id: anishId, lab_id: 'comp' },
      { class_name: '12C', subject_code: 'COMP-12', teacher_id: anishId, lab_id: 'comp' },
      { class_name: 'Class 12', subject_code: 'SEP-12', teacher_id: anishId, lab_id: 'comp' },
      { class_name: 'Class 10', subject_code: 'CRM-10', teacher_id: anishId, lab_id: 'comp' },
      { class_name: 'Class 9', subject_code: 'WPD-9', teacher_id: anishId, lab_id: 'comp' },
      { class_name: '11 Sc - Science Stream Sec B', subject_code: 'PHY-11', teacher_id: prakashId, lab_id: 'phys' },
      { class_name: '11 Sc', subject_code: 'PHY-11', teacher_id: prakashId, lab_id: 'phys' },
      { class_name: 'Class 11', subject_code: 'CHEM-11', teacher_id: null, lab_id: 'chem' },
      { class_name: '11C - Tech Stream Sec A', subject_code: 'COMP-11', teacher_id: anishId, lab_id: 'comp' },
      { class_name: '10A - Secondary Sec A', subject_code: 'CRM-10', teacher_id: anishId, lab_id: 'comp' },
      { class_name: '9B - Secondary Sec B', subject_code: 'WPD-9', teacher_id: anishId, lab_id: 'comp' },
    ]

    for (const cur of curriculum) {
      const clsRow = (await client.query(`select id from public.classes where name = $1 limit 1;`, [cur.class_name])).rows[0]
      const subRow = (await client.query(`select id from public.subjects where code = $1 limit 1;`, [cur.subject_code])).rows[0]
      if (clsRow && subRow) {
        await client.query(`
          insert into public.class_subjects (id, class_id, subject_id, teacher_id, default_lab_id)
          values (gen_random_uuid()::text, $1, $2, $3, $4)
          on conflict (class_id, subject_id, teacher_id) do update set
            default_lab_id = excluded.default_lab_id;
        `, [clsRow.id, subRow.id, cur.teacher_id, cur.lab_id])
      }
    }

    // 11. BACKFILL LOG_ATTENDANCE FOR EXISTING PRACTICAL LOGS VIA THE TRIGGER
    console.log('🔄 Backfilling log_attendance for historical practical_logs...')
    const logsRes = await client.query(`
      select id, total_students, absent_rolls, present_students, absent_students 
      from public.practical_logs;
    `)
    for (const log of logsRes.rows) {
      // Touch each log so the trigger executes
      await client.query(`
        update public.practical_logs
        set total_students = total_students
        where id = $1;
      `, [log.id])
    }
    const attCount = await client.query(`select count(*) as cnt from public.log_attendance;`)
    console.log(`✅ log_attendance backfill complete! Total atomic records created: ${attCount.rows[0].cnt}`)

    // 12. ROW LEVEL SECURITY (RLS) POLICIES
    console.log('🔒 Configuring Row Level Security (RLS) policies...')
    const tables = ['streams', 'classes', 'subjects', 'class_subjects', 'log_attendance', 'teacher_substitutions']
    for (const tbl of tables) {
      await client.query(`alter table public.${tbl} enable row level security;`)
      await client.query(`drop policy if exists "Allow read ${tbl}" on public.${tbl};`)
      await client.query(`create policy "Allow read ${tbl}" on public.${tbl} for select to authenticated using (true);`)
      await client.query(`drop policy if exists "Allow manage ${tbl}" on public.${tbl};`)
      await client.query(`create policy "Allow manage ${tbl}" on public.${tbl} for all to authenticated using (true);`)
    }

    // 13. REALTIME PUBLICATION
    console.log('📡 Updating supabase_realtime publication...')
    for (const tbl of ['classes', 'subjects', 'class_subjects', 'log_attendance', 'teacher_substitutions']) {
      try {
        await client.query(`alter publication supabase_realtime add table public.${tbl};`)
      } catch (pubErr) {
        // Already in publication or publication ignore
      }
    }

    await client.query('COMMIT')
    console.log('🎉 Database migration completed successfully!')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌ Migration failed, rolled back:', err)
    throw err
  } finally {
    await client.end()
  }
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
