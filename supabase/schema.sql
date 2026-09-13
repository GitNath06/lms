-- ==============================================================================
-- Institutional Laboratory Practical & Timetable Management System (LMR)
-- Complete PostgreSQL Schema for Supabase
-- Academic Year: 2083 B.S. / 2026 A.D.
-- ==============================================================================

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 2. CUSTOM ENUM TYPES
do $$ begin
  create type user_role as enum ('admin', 'teacher');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type lab_type as enum ('computer_lab', 'physics_lab', 'chemistry_lab', 'biology_lab', 'electronics_lab');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type session_status as enum ('scheduled', 'in_progress', 'completed', 'cancelled');
exception when duplicate_object then null;
end $$;

-- 3. PROFILES TABLE (Linked with Supabase Auth)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text not null,
  role text not null default 'teacher' check (role in ('super_admin', 'lab_incharge', 'hod', 'teacher', 'admin')),
  department text,
  is_active boolean not null default true,
  permissions jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Trigger to auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role, department, is_active, permissions)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'teacher'),
    coalesce(new.raw_user_meta_data->>'department', 'Science Department'),
    true,
    '{}'::jsonb
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    role = excluded.role,
    department = excluded.department;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. LAB ROOMS TABLE
create table if not exists public.labs (
  id text primary key,
  name text not null,
  code text,
  type lab_type not null default 'computer_lab',
  capacity int not null default 40,
  status text not null default 'Operational' check (status in ('Operational', 'Under Maintenance', 'Inactive')),
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 5. SCHEDULES & MASTER ROUTINE
create table if not exists public.schedules (
  id text primary key,
  lab_id text references public.labs(id) on delete cascade not null,
  teacher_id uuid references public.profiles(id) on delete set null,
  subject_name text not null,
  batch_name text not null,
  start_time text not null,
  end_time text not null,
  slot_id text default 't2',
  day_key text default 'sun',
  span int default 1,
  is_merged boolean default false,
  status session_status default 'scheduled',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- 6. PRACTICAL LOG ENTRIES (Attendance, Turnout & Verification)
create table if not exists public.practical_logs (
  id text primary key,
  schedule_id text,
  lab_id text references public.labs(id) on delete cascade not null,
  teacher_id uuid references public.profiles(id) on delete set null,
  date date not null default current_date,
  period_label text not null,
  subject_name text not null,
  batch_group text not null,
  practical_title text not null,
  total_students int not null default 0,
  present_students int not null default 0,
  absent_students int not null default 0,
  absent_rolls int[] default array[]::int[],
  remarks text,
  status text default 'conducted', -- 'conducted' or 'skipped'
  skip_reason text,
  topic_learned text,
  logged_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- 7. CALENDAR & WEEKEND SETTINGS
create table if not exists public.calendar_settings (
  id text primary key default 'default',
  start_day text not null default 'sun', -- 'sun' or 'mon'
  sunday_weekend boolean not null default false, -- false: active working day; true: weekend recess
  saturday_weekend boolean not null default true, -- true: national standard off
  academic_year text not null default '2083',
  updated_at timestamptz default now()
);

-- 8. ROW LEVEL SECURITY (RLS)
alter table public.profiles enable row level security;
alter table public.labs enable row level security;
alter table public.schedules enable row level security;
alter table public.practical_logs enable row level security;
alter table public.calendar_settings enable row level security;

-- Profiles policies
create policy "Allow read profiles" on public.profiles for select using (true);
create policy "Allow users update own profile" on public.profiles for update using (auth.uid() = id);

-- Labs policies
create policy "Allow read labs" on public.labs for select using (true);
create policy "Allow insert/update labs" on public.labs for all using (true);

-- Schedules policies
create policy "Allow read schedules" on public.schedules for select using (true);
create policy "Allow manage schedules" on public.schedules for all using (true);

-- Practical Logs policies
create policy "Allow read practical logs" on public.practical_logs for select using (true);
create policy "Allow insert practical logs" on public.practical_logs for insert with check (true);
create policy "Allow update practical logs" on public.practical_logs for update using (true);
create policy "Allow delete practical logs" on public.practical_logs for delete using (true);

-- Calendar settings policies
create policy "Allow read calendar settings" on public.calendar_settings for select using (true);
create policy "Allow update calendar settings" on public.calendar_settings for all using (true);

-- 9. REALTIME REPLICATION (Instant multi-device live synchronization)
alter publication supabase_realtime add table public.practical_logs;
alter publication supabase_realtime add table public.schedules;
alter publication supabase_realtime add table public.labs;
alter publication supabase_realtime add table public.calendar_settings;

-- 10. DEFAULT SEED DATA
insert into public.labs (id, name, code, type, capacity) values
  ('comp', 'Computer Engineering Lab 01', 'LAB-COMP-01', 'computer_lab', 40),
  ('phys', 'Physics Laboratory', 'LAB-PHYS-01', 'physics_lab', 38),
  ('chem', 'Chemistry Laboratory', 'LAB-CHEM-01', 'chemistry_lab', 40),
  ('bio', 'Biology & Life Sciences Lab', 'LAB-BIO-01', 'biology_lab', 35),
  ('elec', 'Electronics & Hardware Lab', 'LAB-ELEC-01', 'electronics_lab', 30)
on conflict (id) do nothing;

insert into public.calendar_settings (id, start_day, sunday_weekend, saturday_weekend, academic_year) values
  ('default', 'sun', false, true, '2083')
on conflict (id) do nothing;

-- 11. ACADEMIC STREAMS & COHORTS
create table if not exists public.streams (
  id text primary key,
  name text not null,
  code text unique,
  created_at timestamptz default now()
);

-- 12. ACADEMIC CLASSES / COHORTS (Flexible naming)
create table if not exists public.classes (
  id text primary key,
  name text not null unique,        -- e.g. '12C - Tech Stream Sec A', '11 Sc', 'Class 10A'
  grade int,                        -- auxiliary grade number
  section text,                     -- auxiliary section label
  stream_id text references public.streams(id) on delete set null,
  capacity int not null default 40,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

-- 13. CURRICULUM SUBJECTS CATALOG
create table if not exists public.subjects (
  id text primary key,
  code text not null unique,        -- e.g. 'COMP-12', 'PHY-11'
  name text not null,
  default_lab_id text references public.labs(id) on delete set null,
  credit_hours numeric default 4.0,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

-- 14. CLASS_SUBJECTS JUNCTION (Cohort ↔ Subject ↔ Assigned Teacher)
create table if not exists public.class_subjects (
  id text primary key default gen_random_uuid()::text,
  class_id text references public.classes(id) on delete cascade not null,
  subject_id text references public.subjects(id) on delete cascade not null,
  teacher_id uuid references public.profiles(id) on delete set null,
  default_lab_id text references public.labs(id) on delete set null,
  created_at timestamptz default now(),
  unique(class_id, subject_id, teacher_id)
);

-- 15. ATOMIC 1NF STUDENT ATTENDANCE RECORDS
create table if not exists public.log_attendance (
  id text primary key default gen_random_uuid()::text,
  log_id text references public.practical_logs(id) on delete cascade not null,
  roll_number int not null,
  is_present boolean not null default true,
  created_at timestamptz default now(),
  unique(log_id, roll_number)
);

-- 16. TEACHER SUBSTITUTIONS (Standardized Naming with UUID Foreign Keys)
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
  status text not null default 'assigned', -- 'assigned', 'completed', 'cancelled'
  created_at timestamptz default now()
);

-- Compatibility alias for legacy queries
create or replace view public.faculty_substitutions as
  select * from public.teacher_substitutions;

-- 17. LABORATORY INCIDENT & APPARATUS DAMAGE LOGS
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
  incident_type text not null default 'breakage', -- 'breakage', 'malfunction', 'chemical_hazard', 'burnt_apparatus', 'missing', 'other'
  severity text not null default 'minor', -- 'minor', 'moderate', 'major_critical'
  equipment_name text not null,
  quantity int not null default 1,
  student_rolls text, -- e.g. "Roll 14, 28"
  status text not null default 'reported', -- 'reported', 'escalated_to_hod', 'under_repair', 'replaced', 'resolved'
  escalated_to_hod boolean not null default false,
  escalation_reason text,
  escalated_at timestamptz,
  resolution_notes text,
  resolved_by text,
  resolved_at timestamptz,
  reported_by text not null default 'Faculty In-Charge',
  reported_by_id uuid references public.profiles(id) on delete set null,
  circumstances text,
  photo_url text,
  is_fined boolean not null default false,
  fine_amount numeric default 0,
  fine_paid boolean not null default false,
  fine_receipt_no text,
  resolved_by_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- 18. ROLE-TARGETED LAB NOTIFICATIONS (Super Admin, Lab In-Charge, HOD)
create table if not exists public.lab_notifications (
  id text primary key,
  incident_id text references public.lab_incidents(id) on delete cascade,
  target_role text not null, -- 'super_admin', 'lab_incharge', 'hod'
  target_lab_id text references public.labs(id) on delete set null,
  title text not null,
  message text not null,
  severity text not null default 'info', -- 'info', 'warning', 'critical'
  is_read boolean not null default false,
  created_at timestamptz default now()
);

-- 19. ATOMIC ATTENDANCE SYNCHRONIZATION TRIGGER
create or replace function public.sync_practical_log_attendance()
returns trigger as $$
declare
  effective_headcount int;
  r int;
  is_absent boolean;
begin
  effective_headcount := coalesce(
    nullif(new.total_students, 0),
    nullif(new.present_students + new.absent_students, 0),
    (select coalesce(max(val), 0) from unnest(new.absent_rolls) as val),
    40
  );

  delete from public.log_attendance where log_id = new.id;

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

-- 14. SECURITY DEFINER ROLE & PRIVILEGE HELPERS
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_privileged()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() in ('super_admin', 'lab_incharge', 'hod', 'admin');
$$;

-- Enable RLS
alter table public.faculty_substitutions enable row level security;
alter table public.lab_incidents enable row level security;
alter table public.lab_notifications enable row level security;

create policy "Allow manage faculty substitutions" on public.faculty_substitutions for all using (true);

-- Hardened RLS: Practical Logs
drop policy if exists "Allow read practical logs" on public.practical_logs;
drop policy if exists "Allow insert practical logs" on public.practical_logs;
drop policy if exists "Allow update practical logs" on public.practical_logs;
drop policy if exists "Allow delete practical logs" on public.practical_logs;

create policy "read practical logs" on public.practical_logs
  for select to authenticated
  using ( public.is_privileged() or teacher_id = auth.uid() );

create policy "insert practical logs" on public.practical_logs
  for insert to authenticated
  with check ( public.is_privileged() or teacher_id = auth.uid() );

create policy "update practical logs" on public.practical_logs
  for update to authenticated
  using ( public.is_privileged() or teacher_id = auth.uid() );

create policy "delete practical logs" on public.practical_logs
  for delete to authenticated
  using ( public.is_privileged() );

-- Hardened RLS: Lab Incidents
drop policy if exists "Allow manage lab incidents" on public.lab_incidents;

create policy "read lab incidents" on public.lab_incidents
  for select to authenticated
  using ( public.is_privileged() or reported_by_id = auth.uid() );

create policy "insert lab incidents" on public.lab_incidents
  for insert to authenticated
  with check ( reported_by_id = auth.uid() or public.is_privileged() );

create policy "update lab incidents" on public.lab_incidents
  for update to authenticated
  using ( public.is_privileged() );

create policy "delete lab incidents" on public.lab_incidents
  for delete to authenticated
  using ( public.is_privileged() );

-- Hardened RLS: Lab Notifications
drop policy if exists "Allow manage lab notifications" on public.lab_notifications;

create policy "read lab notifications" on public.lab_notifications
  for select to authenticated
  using ( public.is_privileged() or target_role = public.current_role() );

create policy "write lab notifications" on public.lab_notifications
  for all to authenticated
  using ( public.is_privileged() )
  with check ( public.is_privileged() );

-- Hardened RLS: Master Academic & Relational Tables
alter table public.streams enable row level security;
alter table public.classes enable row level security;
alter table public.subjects enable row level security;
alter table public.class_subjects enable row level security;
alter table public.log_attendance enable row level security;
alter table public.teacher_substitutions enable row level security;

create policy "Allow read streams" on public.streams for select to authenticated using (true);
create policy "Allow manage streams" on public.streams for all to authenticated using (public.is_privileged());

create policy "Allow read classes" on public.classes for select to authenticated using (true);
create policy "Allow manage classes" on public.classes for all to authenticated using (public.is_privileged());

create policy "Allow read subjects" on public.subjects for select to authenticated using (true);
create policy "Allow manage subjects" on public.subjects for all to authenticated using (public.is_privileged());

create policy "Allow read class_subjects" on public.class_subjects for select to authenticated using (true);
create policy "Allow manage class_subjects" on public.class_subjects for all to authenticated using (public.is_privileged());

create policy "Allow read log_attendance" on public.log_attendance for select to authenticated using (true);
create policy "Allow manage log_attendance" on public.log_attendance for all to authenticated using (true);

create policy "Allow read teacher_substitutions" on public.teacher_substitutions for select to authenticated using (true);
create policy "Allow manage teacher_substitutions" on public.teacher_substitutions for all to authenticated using (true);

-- Add to Realtime
alter publication supabase_realtime add table public.teacher_substitutions;
alter publication supabase_realtime add table public.classes;
alter publication supabase_realtime add table public.subjects;
alter publication supabase_realtime add table public.class_subjects;
alter publication supabase_realtime add table public.log_attendance;
alter publication supabase_realtime add table public.lab_incidents;
alter publication supabase_realtime add table public.lab_notifications;

-- 11. INSTITUTION SETTINGS (Single Source of Truth for Calendar, Working Days, Timings)
create table if not exists public.institution_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default timezone('utc'::text, now()),
  updated_by uuid references public.profiles(id)
);

alter table public.institution_settings enable row level security;

create policy "Anyone can view institution settings" 
  on public.institution_settings for select 
  using (true);

create policy "Admins can manage institution settings" 
  on public.institution_settings for all 
  using (
    auth.jwt() ->> 'role' = 'service_role' or
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'super_admin', 'lab_incharge', 'hod')
    )
  );

alter publication supabase_realtime add table public.institution_settings;


