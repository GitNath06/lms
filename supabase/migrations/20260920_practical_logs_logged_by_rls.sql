-- ==============================================================================
-- Migration: Extend practical_logs RLS to include logged_by
-- Date: 2026-09-20
-- Description: Updates practical_logs RLS policies (SELECT, INSERT, UPDATE) to
--              allow access when public.is_privileged(), teacher_id = auth.uid(),
--              or logged_by = auth.uid().
-- ==============================================================================

-- 1. Drop existing policies
drop policy if exists "read practical logs" on public.practical_logs;
drop policy if exists "insert practical logs" on public.practical_logs;
drop policy if exists "update practical logs" on public.practical_logs;

-- 2. Re-create policies with logged_by inclusion
create policy "read practical logs" on public.practical_logs
  for select 
  to authenticated
  using ( public.is_privileged() or teacher_id = auth.uid() or logged_by = auth.uid() );

create policy "insert practical logs" on public.practical_logs
  for insert 
  to authenticated
  with check ( public.is_privileged() or teacher_id = auth.uid() or logged_by = auth.uid() );

create policy "update practical logs" on public.practical_logs
  for update 
  to authenticated
  using ( public.is_privileged() or teacher_id = auth.uid() or logged_by = auth.uid() )
  with check ( public.is_privileged() or teacher_id = auth.uid() or logged_by = auth.uid() );
