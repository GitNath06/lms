-- Migration: Add machine_guid, hardware_specs and last_seen_at to public.workstations
-- Supports zero-login student terminal agent, hardware telemetry & anti-spoofing TOFU lock

ALTER TABLE public.workstations
  ADD COLUMN IF NOT EXISTS machine_guid TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS hardware_specs JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NULL;

-- Fast index for agent handshake lookup by composite GUID
CREATE INDEX IF NOT EXISTS idx_workstations_machine_guid ON public.workstations(machine_guid);

-- Fast case-insensitive index for matching by computer name / workstation label
CREATE INDEX IF NOT EXISTS idx_workstations_label_lower ON public.workstations(LOWER(label));
