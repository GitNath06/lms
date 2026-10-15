-- ==============================================================================
-- Migration: Create Print Selection Tokens Table with Row Level Security
-- Date: 2026-09-21
-- Description: Establishes public.print_selection_tokens for serverless/multi-instance
--              ephemeral transport of selected record IDs for Print/Export.
--              RLS is enabled with zero client grants (server-only via trusted service role/client).
-- ==============================================================================

create table if not exists public.print_selection_tokens (
  token text primary key,
  ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes')
);

-- Index for expiration cleanup lookup
create index if not exists idx_print_selection_tokens_expires 
  on public.print_selection_tokens(expires_at);

-- Enable RLS (zero client policies = strict default deny-all to PostgREST)
alter table public.print_selection_tokens enable row level security;

-- Revoke all permissions from anon and authenticated roles
revoke all on public.print_selection_tokens from anon, authenticated;
