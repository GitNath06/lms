-- ==============================================================================
-- Migration: Harden Email OTPs & Email Dispatch Logs Row Level Security (RLS)
-- Date: 2026-09-21
-- Description: Remediates Supabase Advisor CRITICAL findings on public.email_otps
--              and public.email_dispatch_logs by enabling RLS, revoking unnecessary
--              client grants, and establishing strict deny-all / privileged-only policies.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Table: public.email_otps
-- ------------------------------------------------------------------------------
-- Rationale:
-- - All OTP generation (signup & password reset) and verification occurs strictly
--   server-side via direct trusted PostgreSQL connections (lib/db.ts) in app/actions/otp.ts.
-- - Neither anon nor authenticated clients have any legitimate need to read or write
--   this table directly via PostgREST / Supabase JS client.
-- - Enabling RLS with ZERO client policies enforces default deny-all on the PostgREST API,
--   completely preventing client-side enumeration, leakage, or tampering of verification codes.
-- - Superuser server actions (lib/db.ts) bypass RLS and continue functioning unhindered.

ALTER TABLE public.email_otps ENABLE ROW LEVEL SECURITY;

-- Revoke all table privileges from anon and authenticated roles
REVOKE ALL ON public.email_otps FROM anon, authenticated;

-- Ensure any legacy policies are dropped (zero policies = deny-all for client roles)
DROP POLICY IF EXISTS "Deny all client access to email_otps" ON public.email_otps;


-- ------------------------------------------------------------------------------
-- 2. Table: public.email_dispatch_logs
-- ------------------------------------------------------------------------------
-- Rationale:
-- - Write operations (recording dispatched daily summary notifications and anti-spam idempotency)
--   occur strictly server-side via trusted PostgreSQL connections (lib/db.ts) in app/actions/notifications.ts.
-- - No client role (anon or authenticated) should ever insert, update, delete, or truncate dispatch logs.
-- - Read access for auditing delivery events in the Admin Console is restricted exclusively to
--   authenticated staff holding privileged roles (super_admin, lab_incharge, hod) via public.is_privileged().

ALTER TABLE public.email_dispatch_logs ENABLE ROW LEVEL SECURITY;

-- Revoke all table privileges from anon and authenticated roles
REVOKE ALL ON public.email_dispatch_logs FROM anon, authenticated;

-- Grant selective read-only permission to authenticated users (subject to RLS policy below)
GRANT SELECT ON public.email_dispatch_logs TO authenticated;

-- Policy: Only privileged institutional staff can view email dispatch logs
DROP POLICY IF EXISTS "Allow privileged view email_dispatch_logs" ON public.email_dispatch_logs;
CREATE POLICY "Allow privileged view email_dispatch_logs"
  ON public.email_dispatch_logs
  FOR SELECT
  TO authenticated
  USING (public.is_privileged());
