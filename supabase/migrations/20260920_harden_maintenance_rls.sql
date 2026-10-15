-- ==============================================================================
-- Migration: Harden Maintenance Engine Row Level Security (RLS)
-- Date: 2026-09-20
-- Description: Replaces legacy role check role in ('super_admin', 'coordinator', 'lab_incharge', 'admin')
--              with public.is_privileged() so super_admin, lab_incharge, hod, and admin
--              share proper authorization to manage maintenance plans, reminders, and logs.
-- ==============================================================================

-- 1. Drop existing legacy policies on maintenance_plans
drop policy if exists "Manage Plans" on public.maintenance_plans;
drop policy if exists "Read Maintenance Plans" on public.maintenance_plans;

-- 2. Re-create maintenance_plans policies
create policy "Read Maintenance Plans" 
  on public.maintenance_plans 
  for select 
  to authenticated 
  using (auth.uid() is not null);

create policy "Manage Plans" 
  on public.maintenance_plans 
  for all 
  to authenticated 
  using (public.is_privileged())
  with check (public.is_privileged());

-- 3. Drop existing legacy policies on maintenance_reminders
drop policy if exists "Update Reminders" on public.maintenance_reminders;
drop policy if exists "Read Maintenance Reminders" on public.maintenance_reminders;
drop policy if exists "Manage Reminders" on public.maintenance_reminders;

-- 4. Re-create maintenance_reminders policies
create policy "Read Maintenance Reminders" 
  on public.maintenance_reminders 
  for select 
  to authenticated 
  using (auth.uid() is not null);

-- Allow privileged roles to manage, update, snooze, or advance reminders
create policy "Manage Reminders" 
  on public.maintenance_reminders 
  for all 
  to authenticated 
  using (public.is_privileged())
  with check (public.is_privileged());

-- 5. Drop existing legacy policies on maintenance_logs
drop policy if exists "Read Maintenance Logs" on public.maintenance_logs;
drop policy if exists "Insert Maintenance Logs" on public.maintenance_logs;
drop policy if exists "Update Maintenance Logs" on public.maintenance_logs;
drop policy if exists "Delete Maintenance Logs" on public.maintenance_logs;

-- 6. Re-create maintenance_logs policies
create policy "Read Maintenance Logs" 
  on public.maintenance_logs 
  for select 
  to authenticated 
  using (auth.uid() is not null);

create policy "Insert Maintenance Logs" 
  on public.maintenance_logs 
  for insert 
  to authenticated 
  with check (public.is_privileged());

create policy "Update Maintenance Logs" 
  on public.maintenance_logs 
  for update 
  to authenticated 
  using (public.is_privileged())
  with check (public.is_privileged());

create policy "Delete Maintenance Logs" 
  on public.maintenance_logs 
  for delete 
  to authenticated 
  using (public.is_privileged());
