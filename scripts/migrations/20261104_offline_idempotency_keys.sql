-- Migration: Offline Outbox & Mutation Idempotency Guard
-- Allows client PWA to generate client-side UUIDv4 idempotency keys
-- preventing duplicate practical log creation on network retries.

ALTER TABLE public.practical_logs
ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_practical_logs_idempotency_key
ON public.practical_logs (idempotency_key)
WHERE idempotency_key IS NOT NULL;

