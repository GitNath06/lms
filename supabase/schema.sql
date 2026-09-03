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
  full_name text not null,
  role user_role default 'teacher',
  department text,
  created_at timestamptz default now()
);

-- Trigger to auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role, department)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Faculty Member'),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'teacher'),
    new.raw_user_meta_data->>'department'
  );
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
  status text not null default 'assigned', -- 'assigned', 'completed', 'cancelled'
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
  incident_type text not null default 'breakage', -- 'breakage', 'malfunction', 'chemical_hazard', 'burnt_apparatus', 'missing', 'other'
  severity text not null default 'minor', -- 'minor', 'moderate', 'major_critical'
  equipment_name text not null,
  quantity int not null default 1,
  student_rolls text, -- e.g. "Roll 14, 28"
  is_fined boolean not null default false,
  fine_amount numeric not null default 0,
  fine_paid boolean not null default false,
  fine_receipt_no text,
  status text not null default 'reported', -- 'reported', 'escalated_to_hod', 'under_repair', 'replaced', 'resolved'
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
  target_role text not null, -- 'super_admin', 'lab_incharge', 'hod'
  target_lab_id text references public.labs(id) on delete set null,
  title text not null,
  message text not null,
  severity text not null default 'info', -- 'info', 'warning', 'critical'
  is_read boolean not null default false,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.faculty_substitutions enable row level security;
alter table public.lab_incidents enable row level security;
alter table public.lab_notifications enable row level security;

create policy "Allow manage faculty substitutions" on public.faculty_substitutions for all using (true);
create policy "Allow manage lab incidents" on public.lab_incidents for all using (true);
create policy "Allow manage lab notifications" on public.lab_notifications for all using (true);

-- Add to Realtime
alter publication supabase_realtime add table public.faculty_substitutions;
alter publication supabase_realtime add table public.lab_incidents;
alter publication supabase_realtime add table public.lab_notifications;
