-- ==============================================================================
-- Migration: Create Rate Limit Events Table with Row Level Security
-- Date: 2026-09-21
-- Description: Establishes public.rate_limit_events for Postgres-native sliding-window
--              rate limiting of OTP generation and verification requests.
--              RLS is enabled with zero client grants (server-only via trusted pool).
-- ==============================================================================

create table if not exists public.rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  action text not null,
  created_at timestamptz not null default now()
);

-- Index for sliding-window lookup: (key, created_at desc)
create index if not exists idx_rate_limit_events_key_created 
  on public.rate_limit_events(key, created_at desc);

-- Enable RLS (zero client policies = strict default deny-all to PostgREST)
alter table public.rate_limit_events enable row level security;

-- Revoke all permissions from anon and authenticated roles
revoke all on public.rate_limit_events from anon, authenticated;
