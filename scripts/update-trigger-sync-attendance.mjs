import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const envPath = path.resolve(process.cwd(), '.env.local')
const content = fs.readFileSync(envPath, 'utf8')
let dbUrl = null

for (const line of content.split('\n')) {
  const trimmed = line.trim()
  if (trimmed.startsWith('DATABASE_URL=')) {
    dbUrl = trimmed.slice('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '')
    break
  }
}

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

async function updateTrigger() {
  const client = await pool.connect()
  try {
    console.log('🔄 Updating sync_practical_log_attendance trigger to use canonical student_enrollments...')

    const updateSql = `
      CREATE OR REPLACE FUNCTION public.sync_practical_log_attendance()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $function$
      declare
        cs_row record;
        enr_row record;
        is_absent boolean;
      begin
        delete from public.log_attendance where log_id = new.id;

        if new.class_subject_id is not null then
          select academic_year_id, class_id into cs_row
          from public.class_subjects
          where id = new.class_subject_id;

          if found and cs_row.academic_year_id is not null and cs_row.class_id is not null then
            for enr_row in 
              select id as enrollment_id, student_id, roll_number
              from public.student_enrollments
              where academic_year_id = cs_row.academic_year_id
                and class_id = cs_row.class_id
                and status = 'active'
              order by roll_number asc
            loop
              is_absent := (new.absent_rolls is not null and enr_row.roll_number = any(new.absent_rolls));
              insert into public.log_attendance (id, log_id, roll_number, is_present, student_id, enrollment_id, created_at)
              values (
                gen_random_uuid()::text,
                new.id,
                enr_row.roll_number,
                not is_absent,
                enr_row.student_id,
                enr_row.enrollment_id,
                now()
              )
              on conflict (log_id, roll_number) do update set
                is_present = excluded.is_present,
                student_id = excluded.student_id,
                enrollment_id = excluded.enrollment_id;
            end loop;
          end if;
        end if;

        return new;
      end;
      $function$;
    `

    await client.query(updateSql)
    console.log('✅ Trigger function sync_practical_log_attendance updated successfully!')
  } finally {
    client.release()
    await pool.end()
  }
}

updateTrigger().catch(err => {
  console.error('Trigger update failed:', err)
  process.exit(1)
})
