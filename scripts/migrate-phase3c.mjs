import pkg from 'pg';
const { Client } = pkg;
import * as fs from 'fs';

const lines = fs.readFileSync('.env', 'utf8').split(/\r?\n/);
let dbUrl = '';
for (let l of lines) {
  let [k, ...v] = l.trim().split('=');
  if (k === 'DATABASE_URL') dbUrl = v.join('=');
}

if (!dbUrl) {
  console.error('DATABASE_URL not found in .env');
  process.exit(1);
}

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  try {
    await client.connect();
    console.log('✓ Connected to Supabase PostgreSQL');

    const sql = `
      -- 11. FACULTY SUBSTITUTIONS (Proxy Teacher Assignments)
      create table if not exists public.faculty_substitutions (
        id text primary key,
        schedule_id text references public.schedules(id) on delete cascade,
        date date not null default current_date,
        slot_id text not null default 't2',
        lab_id text references public.labs(id) on delete cascade not null,
        original_teacher_id text not null,
        original_teacher_name text not null,
        substitute_teacher_id text not null,
        substitute_teacher_name text not null,
        reason text,
        status text not null default 'assigned',
        created_at timestamptz default now()
      );

      -- 12. LABORATORY INCIDENT & APPARATUS DAMAGE LOGS
      create table if not exists public.lab_incidents (
        id text primary key,
        lab_id text references public.labs(id) on delete cascade not null,
        schedule_id text references public.schedules(id) on delete set null,
        date date not null default current_date,
        session_label text not null,
        subject_name text not null,
        subject_teacher_name text not null,
        batch_name text not null,
        title text not null,
        incident_type text not null default 'breakage',
        severity text not null default 'minor',
        equipment_name text not null,
        quantity int not null default 1,
        student_rolls text,
        is_fined boolean not null default false,
        fine_amount numeric not null default 0,
        fine_paid boolean not null default false,
        fine_receipt_no text,
        status text not null default 'reported',
        escalated_to_hod boolean not null default false,
        escalation_reason text,
        escalated_at timestamptz,
        resolution_notes text,
        resolved_by text,
        resolved_at timestamptz,
        reported_by text not null default 'Faculty In-Charge',
        created_at timestamptz default now()
      );

      -- 13. ROLE-TARGETED LAB NOTIFICATIONS (Super Admin, Lab In-Charge, HOD)
      create table if not exists public.lab_notifications (
        id text primary key,
        incident_id text references public.lab_incidents(id) on delete cascade,
        target_role text not null,
        target_lab_id text references public.labs(id) on delete set null,
        title text not null,
        message text not null,
        severity text not null default 'info',
        is_read boolean not null default false,
        created_at timestamptz default now()
      );

      -- Enable RLS
      alter table public.faculty_substitutions enable row level security;
      alter table public.lab_incidents enable row level security;
      alter table public.lab_notifications enable row level security;

      -- Create RLS policies safely
      do $$
      begin
        if not exists (select 1 from pg_policies where tablename = 'faculty_substitutions' and policyname = 'Allow manage faculty substitutions') then
          create policy "Allow manage faculty substitutions" on public.faculty_substitutions for all using (true);
        end if;
        if not exists (select 1 from pg_policies where tablename = 'lab_incidents' and policyname = 'Allow manage lab incidents') then
          create policy "Allow manage lab incidents" on public.lab_incidents for all using (true);
        end if;
        if not exists (select 1 from pg_policies where tablename = 'lab_notifications' and policyname = 'Allow manage lab notifications') then
          create policy "Allow manage lab notifications" on public.lab_notifications for all using (true);
        end if;
      end $$;

      -- Add tables to realtime publication if not already added
      do $$
      begin
        begin
          alter publication supabase_realtime add table public.faculty_substitutions;
        exception when others then null;
        end;
        begin
          alter publication supabase_realtime add table public.lab_incidents;
        exception when others then null;
        end;
        begin
          alter publication supabase_realtime add table public.lab_notifications;
        exception when others then null;
        end;
      end $$;
    `;

    await client.query(sql);
    console.log('✓ Successfully created Phase 3C tables & policies in Supabase!');
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
