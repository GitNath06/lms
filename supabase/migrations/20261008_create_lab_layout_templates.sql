-- Migration: Create public.lab_layout_templates for saving named custom room grid layouts
CREATE TABLE IF NOT EXISTS public.lab_layout_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lab_id text NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  config jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT uq_lab_layout_template_name UNIQUE (lab_id, name)
);

CREATE INDEX IF NOT EXISTS idx_lab_layout_templates_lab_id ON public.lab_layout_templates (lab_id);

-- RLS: Allow authenticated users to view layout templates; lab_incharge / super_admin to insert/update/delete
ALTER TABLE public.lab_layout_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'lab_layout_templates' AND policyname = 'Allow read for all authenticated users'
  ) THEN
    CREATE POLICY "Allow read for all authenticated users"
      ON public.lab_layout_templates
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'lab_layout_templates' AND policyname = 'Allow write for privileged users'
  ) THEN
    CREATE POLICY "Allow write for privileged users"
      ON public.lab_layout_templates
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role IN ('super_admin', 'lab_incharge', 'hod')
        )
      );
  END IF;
END $$;
