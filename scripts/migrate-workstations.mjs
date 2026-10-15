import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const envPath = path.resolve(process.cwd(), '.env.local')
const content = fs.readFileSync(envPath, 'utf8')
let dbUrl = ''
for (const line of content.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) {
    dbUrl = line.split('=')[1].trim().replace(/^["']|["']$/g, '')
    break
  }
}

const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
})

const MIGRATION_SQL = `
-- ==============================================================================
-- Workstation Floor Management & Issue Tracking Schema
-- ==============================================================================

-- 1. ISSUE CATEGORIES (Granular PC Hardware, Software, Network taxonomy)
CREATE TABLE IF NOT EXISTS public.issue_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('hardware', 'software', 'network', 'peripheral', 'other')),
  color text NOT NULL DEFAULT '#6366F1',
  icon text NOT NULL DEFAULT 'AlertTriangle',
  default_severity text NOT NULL DEFAULT 'medium' CHECK (default_severity IN ('low', 'medium', 'high', 'critical')),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issue_categories_active ON public.issue_categories(is_active, sort_order);

-- 2. WORKSTATIONS (Normalized 2D Floor Plan Nodes)
CREATE TABLE IF NOT EXISTS public.workstations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id text REFERENCES public.labs(id) ON DELETE CASCADE NOT NULL,
  label text NOT NULL,                                          -- e.g. 'PC-01'
  pos_x double precision NOT NULL DEFAULT 50.0,                 -- 0.0 to 100.0 percentage
  pos_y double precision NOT NULL DEFAULT 50.0,                 -- 0.0 to 100.0 percentage
  device_type text NOT NULL DEFAULT 'desktop' 
    CHECK (device_type IN ('desktop', 'aio', 'laptop', 'server')),
  row_label text,                                               -- e.g. 'Row A', 'Teacher Station'
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_workstation_lab_label UNIQUE (lab_id, label)
);

CREATE INDEX IF NOT EXISTS idx_workstations_lab ON public.workstations(lab_id) WHERE is_active = true;

-- 3. WORKSTATION ISSUES (Problem Reports & Lifecycle)
CREATE TABLE IF NOT EXISTS public.workstation_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workstation_id uuid NOT NULL REFERENCES public.workstations(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.issue_categories(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'in_progress', 'resolved')),
  reported_by_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_by_name text NOT NULL,
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  resolved_by_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_by_name text,
  resolution_notes text,
  resolved_at timestamptz,
  linked_maintenance_log_id uuid REFERENCES public.maintenance_logs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workstation_issues_ws ON public.workstation_issues(workstation_id);
CREATE INDEX IF NOT EXISTS idx_workstation_issues_status ON public.workstation_issues(status);

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.issue_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read categories" ON public.issue_categories;
CREATE POLICY "Allow read categories" ON public.issue_categories FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow manage categories" ON public.issue_categories;
CREATE POLICY "Allow manage categories" ON public.issue_categories FOR ALL TO authenticated USING (public.is_privileged());

ALTER TABLE public.workstations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read workstations" ON public.workstations;
CREATE POLICY "Allow read workstations" ON public.workstations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow manage workstations" ON public.workstations;
CREATE POLICY "Allow manage workstations" ON public.workstations FOR ALL TO authenticated USING (public.is_privileged());

ALTER TABLE public.workstation_issues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read issues" ON public.workstation_issues;
CREATE POLICY "Allow read issues" ON public.workstation_issues FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow report issues" ON public.workstation_issues;
CREATE POLICY "Allow report issues" ON public.workstation_issues FOR INSERT TO authenticated WITH CHECK (auth.uid() = reported_by_id OR public.is_privileged());
DROP POLICY IF EXISTS "Allow resolve issues" ON public.workstation_issues;
CREATE POLICY "Allow resolve issues" ON public.workstation_issues FOR UPDATE TO authenticated USING (public.is_privileged());
DROP POLICY IF EXISTS "Allow delete issues" ON public.workstation_issues;
CREATE POLICY "Allow delete issues" ON public.workstation_issues FOR DELETE TO authenticated USING (public.is_privileged());

-- 5. REALTIME PUBLICATION
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.workstations; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.workstation_issues; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.issue_categories; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;
`;

const SEED_CATEGORIES = [
  { name: 'OS Boot Failure', type: 'software', color: '#EF4444', icon: 'MonitorX', default_severity: 'high', sort_order: 1 },
  { name: 'Blue Screen / Kernel Panic', type: 'software', color: '#3B82F6', icon: 'AlertOctagon', default_severity: 'high', sort_order: 2 },
  { name: 'No Display / Black Screen', type: 'hardware', color: '#F59E0B', icon: 'Tv2', default_severity: 'medium', sort_order: 3 },
  { name: 'LAN / Internet Disconnected', type: 'network', color: '#6366F1', icon: 'WifiOff', default_severity: 'medium', sort_order: 4 },
  { name: 'Keyboard / Mouse Fault', type: 'peripheral', color: '#10B981', icon: 'Mouse', default_severity: 'low', sort_order: 5 },
  { name: 'Power Supply / Won\'t Turn On', type: 'hardware', color: '#DC2626', icon: 'ZapOff', default_severity: 'critical', sort_order: 6 },
  { name: 'Overheating / Fan Noise', type: 'hardware', color: '#EA580C', icon: 'Flame', default_severity: 'medium', sort_order: 7 },
  { name: 'Software Missing / Expired License', type: 'software', color: '#8B5CF6', icon: 'FileCode2', default_severity: 'low', sort_order: 8 },
  { name: 'Audio / Headphone Jack Defect', type: 'peripheral', color: '#06B6D4', icon: 'Headphones', default_severity: 'low', sort_order: 9 },
  { name: 'Other Workstation Issue', type: 'other', color: '#64748B', icon: 'HelpCircle', default_severity: 'medium', sort_order: 10 },
]

async function run() {
  const client = await pool.connect()
  try {
    console.log('--- Applying Workstation Migration Schema ---')
    await client.query(MIGRATION_SQL)
    console.log('✓ Tables, indexes, RLS policies, and realtime publications created!')

    console.log('--- Seeding Default Issue Categories ---')
    for (const cat of SEED_CATEGORIES) {
      await client.query(`
        INSERT INTO public.issue_categories (name, type, color, icon, default_severity, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT DO NOTHING;
      `, [cat.name, cat.type, cat.color, cat.icon, cat.default_severity, cat.sort_order])
    }
    console.log(`✓ Seeded ${SEED_CATEGORIES.length} default issue categories.`)

    console.log('--- Seeding Workstations for Computer Lab (comp) ---')
    // Check if comp already has workstations
    const existingWs = await client.query(`SELECT COUNT(*) FROM public.workstations WHERE lab_id = 'comp';`)
    const count = parseInt(existingWs.rows[0].count, 10)
    if (count === 0) {
      // Teacher Desk: top center
      await client.query(`
        INSERT INTO public.workstations (lab_id, label, pos_x, pos_y, device_type, row_label)
        VALUES ('comp', 'Teacher-01', 50.0, 14.0, 'desktop', 'Teacher Station');
      `)

      // Rows A, B, C, D (8 computers each across X: 12% to 88%)
      const rows = [
        { label: 'Row A', y: 32.0, startNum: 1 },
        { label: 'Row B', y: 50.0, startNum: 9 },
        { label: 'Row C', y: 68.0, startNum: 17 },
        { label: 'Row D', y: 86.0, startNum: 25 },
      ]

      const xPositions = [12.0, 22.8, 33.6, 44.4, 55.6, 66.4, 77.2, 88.0]

      let seededCount = 1
      for (const row of rows) {
        for (let i = 0; i < 8; i++) {
          const num = row.startNum + i
          const label = `PC-${String(num).padStart(2, '0')}`
          const posX = xPositions[i]
          const posY = row.y
          await client.query(`
            INSERT INTO public.workstations (lab_id, label, pos_x, pos_y, device_type, row_label)
            VALUES ('comp', $1, $2, $3, 'desktop', $4);
          `, [label, posX, posY, row.label])
          seededCount++
        }
      }
      console.log(`✓ Seeded ${seededCount} workstations for lab 'comp' in 4 rows + teacher podium!`)
    } else {
      console.log(`✓ Workstations for lab 'comp' already exist (${count} stations). Skipping seed.`)
    }

    console.log('--- Verifying Created Data ---')
    const catRes = await client.query(`SELECT id, name, type, color, default_severity FROM public.issue_categories ORDER BY sort_order;`)
    console.log(`Active categories (${catRes.rows.length}):`, catRes.rows.map(r => `${r.name} (${r.type})`))

    const wsRes = await client.query(`SELECT id, label, row_label, pos_x, pos_y FROM public.workstations WHERE lab_id = 'comp' ORDER BY label LIMIT 5;`)
    console.log('Sample workstations in comp:', wsRes.rows)

  } catch (err) {
    console.error('Migration error:', err)
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(() => process.exit(1))
