import { getPgPool } from '../lib/db.ts'

async function setupTable() {
  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.lab_layout_templates (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        lab_id text NOT NULL,
        name text NOT NULL,
        description text,
        config jsonb NOT NULL,
        created_at timestamp with time zone DEFAULT now(),
        updated_at timestamp with time zone DEFAULT now(),
        CONSTRAINT uq_lab_layout_template_name UNIQUE (lab_id, name)
      );
    `)
    console.log('Successfully created public.lab_layout_templates table!')

    // Seed default template for comp lab if not exists
    const seedConfig = {
      sides: 2,
      rows: 6,
      columns: 4,
      rowNaming: 'letters',
      terminalNaming: 'alphanumeric',
      customRowNames: {
        0: 'Row A',
        1: 'Row B',
        2: 'Row C',
        3: 'Row D',
        4: 'Row E',
        5: 'Row F'
      }
    }

    await client.query(`
      INSERT INTO public.lab_layout_templates (lab_id, name, description, config)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (lab_id, name) DO UPDATE SET config = EXCLUDED.config, updated_at = NOW();
    `, [
      'comp',
      'Dual Island Pods (48 PCs - 2 Sides)',
      'Standard institutional lab layout: 2 sides (Left & Right), 6 rows per side, 4 terminals per row, 24% central aisle.',
      seedConfig
    ])

    const { rows } = await client.query(`SELECT id, lab_id, name, config FROM public.lab_layout_templates;`)
    console.log('Templates in DB:', rows)
  } catch (err) {
    console.error('Error creating table:', err)
  } finally {
    client.release()
    await pool.end()
  }
}

setupTable()
