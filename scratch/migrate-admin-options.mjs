import { getPgPool } from '../lib/db.ts'

async function migrate() {
  const pool = getPgPool()
  console.log('--- Starting Migration: maintenance_routine_templates ---')

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.maintenance_routine_templates (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL,
      lab_id text NOT NULL DEFAULT 'comp',
      cadence text NOT NULL DEFAULT 'quarterly',
      interval_days integer NOT NULL DEFAULT 90,
      severity text NOT NULL DEFAULT 'routine',
      category text NOT NULL DEFAULT 'Hardware Care',
      checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
      is_active boolean NOT NULL DEFAULT true,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    ALTER TABLE public.maintenance_routine_templates ENABLE ROW LEVEL SECURITY;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'maintenance_routine_templates' 
        AND policyname = 'read_maintenance_routine_templates'
      ) THEN
        CREATE POLICY read_maintenance_routine_templates 
        ON public.maintenance_routine_templates 
        FOR SELECT 
        TO authenticated 
        USING (true);
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'maintenance_routine_templates' 
        AND policyname = 'write_maintenance_routine_templates'
      ) THEN
        CREATE POLICY write_maintenance_routine_templates 
        ON public.maintenance_routine_templates 
        FOR ALL 
        TO authenticated 
        USING (
          auth.uid() IN (
            SELECT id FROM public.profiles 
            WHERE role IN ('super_admin', 'lab_incharge')
          )
        );
      END IF;
    END $$;
  `)
  console.log('Table & RLS policies ensured.')

  // Check existing count
  const checkCount = await pool.query('SELECT COUNT(*) FROM public.maintenance_routine_templates;')
  const currentCount = parseInt(checkCount.rows[0].count, 10)
  console.log('Current template count:', currentCount)

  if (currentCount === 0) {
    console.log('Seeding initial canonical maintenance routine templates...')
    await pool.query(`
      INSERT INTO public.maintenance_routine_templates 
        (title, lab_id, cadence, interval_days, severity, category, checklist, sort_order)
      VALUES 
        (
          'PC Thermal Paste & Heatsink Servicing',
          'comp',
          'semi_annual',
          180,
          'routine',
          'Thermal & Hardware',
          '["Clean CPU heatsink and remove old thermal grease", "Apply fresh Arctic MX-4 compound onto processor", "Vacuum intake and exhaust dust filters", "Verify idle and stress temperatures remain < 70°C"]'::jsonb,
          1
        ),
        (
          'BIOS Firmware & Driver Patching',
          'comp',
          'tri_annual',
          120,
          'high',
          'Firmware & OS',
          '["Flash motherboards with latest stable OEM BIOS release", "Update chipset and network adapter drivers", "Verify Secure Boot and TPM 2.0 status across machines"]'::jsonb,
          2
        ),
        (
          'PC Deep Dusting & Power Supply Inspection',
          'comp',
          'quarterly',
          90,
          'routine',
          'Hardware Maintenance',
          '["Blow out internal dust from case, GPU, and RAM slots", "Check power supply fan spin and exhaust temperature", "Inspect SATA/NVMe drive cables and cable ties"]'::jsonb,
          3
        ),
        (
          'Lab Software Image & Compiler Rollout',
          'comp',
          'bi_monthly',
          60,
          'routine',
          'Software & Security',
          '["Deploy latest Windows updates and IDE compilers (VSCode, GCC, Python)", "Update student freeze/restore software (DeepFreeze/RebootRestore)", "Verify network drive mounting and offline cache permissions"]'::jsonb,
          4
        ),
        (
          'Fume Hood & Chemical Storage Airflow Check',
          'chem',
          'monthly',
          30,
          'high',
          'Chemical Safety',
          '["Inspect fume hood face velocity and airflow baffles", "Check acid and organic storage cabinet seals", "Test emergency eye-wash station flow rate"]'::jsonb,
          5
        ),
        (
          'Optical Bench & Laser Calibration',
          'phys',
          'quarterly',
          90,
          'routine',
          'Precision Calibration',
          '["Clean optics with spectrophotometric grade lens paper", "Level precision optical bench rails and micrometers", "Calibrate spectrometer diffraction grating zero-point"]'::jsonb,
          6
        );
    `)
    console.log('Seeded 6 canonical templates.')
  }

  const finalCheck = await pool.query('SELECT id, title, interval_days, category FROM public.maintenance_routine_templates ORDER BY sort_order ASC;')
  console.log('All templates in DB:', finalCheck.rows)

  process.exit(0)
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
