-- Migration: Add position_id to public.workstations
-- Separates physical hardware asset label (e.g. PC-01, PC-02) from room location/desk slot (e.g. A1, C4, G3)

ALTER TABLE public.workstations
ADD COLUMN IF NOT EXISTS position_id VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_workstations_lab_position
ON public.workstations(lab_id, position_id);

-- Backfill existing stations if position_id is empty
UPDATE public.workstations
SET position_id = label
WHERE position_id IS NULL AND label != 'Teacher-01';
