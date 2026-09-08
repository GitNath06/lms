import pg from 'pg'
const { Pool } = pg

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.xysdrtbomtqgqtiojcev:labmanagement%40123@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres'

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
})

const migrationSql = `
-- 1. Enums
do $$ begin
  if not exists (select 1 from pg_type where typname = 'rm_severity') then
    create type rm_severity as enum ('low', 'routine', 'high', 'critical');
  end if;
  if not exists (select 1 from pg_type where typname = 'rm_reminder_status') then
    create type rm_reminder_status as enum ('pending', 'snoozed', 'in_progress', 'completed', 'overdue');
  end if;
end $$;

-- 2. Recurring Maintenance Plans
create table if not exists public.maintenance_plans (
  id uuid primary key default gen_random_uuid(),
  lab_id text references public.labs(id) on delete cascade not null,
  title text not null,
  category text not null,
  interval_days int not null check (interval_days > 0),
  severity rm_severity not null default 'routine',
  target_role text not null default 'lab_incharge',
  assigned_user_id uuid references public.profiles(id) on delete set null,
  checklist jsonb default '[]'::jsonb,
  is_active boolean not null default true,
  description text,
  created_at timestamptz default now()
);

-- 3. Persistent Maintenance Reminders
create table if not exists public.maintenance_reminders (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.maintenance_plans(id) on delete cascade not null,
  lab_id text references public.labs(id) on delete cascade not null,
  title text not null,
  due_date date not null,
  status rm_reminder_status not null default 'pending',
  snoozed_until date,
  snooze_reason text,
  snooze_count int not null default 0,
  created_at timestamptz default now()
);

-- 4. Completed Maintenance Service Ledger
create table if not exists public.maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.maintenance_plans(id) on delete set null,
  reminder_id uuid references public.maintenance_reminders(id) on delete set null,
  lab_id text references public.labs(id) on delete restrict not null,
  asset_identifier text not null,
  work_performed text not null,
  checklist_completed jsonb default '[]'::jsonb,
  parts_replaced text,
  cost_incurred numeric(10, 2) not null default 0.00,
  service_date date not null default current_date,
  performed_by_id uuid references public.profiles(id) on delete restrict not null,
  next_service_due date,
  remarks text,
  created_at timestamptz default now()
);

-- 5. Trigger: Day-Zero Initial Reminder on Plan Creation
create or replace function public.handle_new_maintenance_plan()
returns trigger as $$
begin
  if new.is_active then
    insert into public.maintenance_reminders (
      plan_id,
      lab_id,
      title,
      due_date,
      status
    ) values (
      new.id,
      new.lab_id,
      new.title,
      current_date + new.interval_days,
      'pending'
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_new_maintenance_plan on public.maintenance_plans;
create trigger trg_new_maintenance_plan
after insert on public.maintenance_plans
for each row execute function public.handle_new_maintenance_plan();

-- 6. Trigger: Service Completion & Next Cycle Recurrence
create or replace function public.handle_maintenance_log_completion()
returns trigger as $$
declare
  v_plan public.maintenance_plans%rowtype;
begin
  -- 1. Mark active reminder completed
  if new.reminder_id is not null then
    update public.maintenance_reminders 
    set status = 'completed' 
    where id = new.reminder_id;
  -- Close any open/snoozed reminder if logged directly
  elsif new.plan_id is not null then
    update public.maintenance_reminders
    set status = 'completed'
    where plan_id = new.plan_id and status in ('pending', 'snoozed', 'in_progress', 'overdue');
  end if;

  -- 2. Spawn next cycle reminder if tied to an active plan
  if new.plan_id is not null then
    select * into v_plan from public.maintenance_plans where id = new.plan_id;
    if found and v_plan.is_active then
      insert into public.maintenance_reminders (
        plan_id, 
        lab_id, 
        title, 
        due_date, 
        status
      ) values (
        v_plan.id,
        v_plan.lab_id,
        v_plan.title,
        coalesce(new.next_service_due, new.service_date + v_plan.interval_days),
        'pending'
      );
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_maintenance_log_completion on public.maintenance_logs;
create trigger trg_maintenance_log_completion
after insert on public.maintenance_logs
for each row execute function public.handle_maintenance_log_completion();

-- 7. Role-Based RLS Policies
alter table public.maintenance_plans enable row level security;
alter table public.maintenance_reminders enable row level security;
alter table public.maintenance_logs enable row level security;

-- Drop old policies if existing to ensure clean recreation
drop policy if exists "Read Maintenance Plans" on public.maintenance_plans;
drop policy if exists "Read Maintenance Reminders" on public.maintenance_reminders;
drop policy if exists "Read Maintenance Logs" on public.maintenance_logs;
drop policy if exists "Manage Plans" on public.maintenance_plans;
drop policy if exists "Update Reminders" on public.maintenance_reminders;
drop policy if exists "Insert Maintenance Logs" on public.maintenance_logs;
drop policy if exists "Update Maintenance Logs" on public.maintenance_logs;

-- Read policies: Open to authenticated staff
create policy "Read Maintenance Plans" on public.maintenance_plans for select using (auth.uid() is not null);
create policy "Read Maintenance Reminders" on public.maintenance_reminders for select using (auth.uid() is not null);
create policy "Read Maintenance Logs" on public.maintenance_logs for select using (auth.uid() is not null);

-- Management policies: Strictly privileged roles
create policy "Manage Plans" on public.maintenance_plans for all using (
  exists (
    select 1 from public.profiles 
    where id = auth.uid() and role in ('super_admin', 'coordinator', 'lab_incharge')
  )
);

create policy "Update Reminders" on public.maintenance_reminders for update using (
  exists (
    select 1 from public.profiles 
    where id = auth.uid() and role in ('super_admin', 'coordinator', 'lab_incharge')
  )
);

create policy "Insert Maintenance Logs" on public.maintenance_logs for insert with check (
  exists (
    select 1 from public.profiles 
    where id = auth.uid() and role in ('super_admin', 'coordinator', 'lab_incharge')
  )
);

create policy "Update Maintenance Logs" on public.maintenance_logs for update using (
  exists (
    select 1 from public.profiles 
    where id = auth.uid() and role in ('super_admin', 'coordinator', 'lab_incharge')
  )
);

-- 8. Add to realtime publication safely
do $$ begin
  begin
    alter publication supabase_realtime add table public.maintenance_reminders;
  exception when duplicate_object then
    null;
  end;
  begin
    alter publication supabase_realtime add table public.maintenance_logs;
  exception when duplicate_object then
    null;
  end;
end $$;
`

async function run() {
  console.log('Connecting to PostgreSQL...')
  const client = await pool.connect()
  try {
    console.log('Executing Maintenance Engine migration...')
    await client.query(migrationSql)
    console.log('Migration executed successfully!')

    // Verify tables exist
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('maintenance_plans', 'maintenance_reminders', 'maintenance_logs');
    `)
    console.log('Verified tables:', res.rows.map(r => r.table_name))
  } catch (err) {
    console.error('Migration failed:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
