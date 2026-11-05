import pg from 'pg';
import fs from 'fs';
import path from 'path';

function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const idx = trimmed.indexOf('=');
          const key = trimmed.substring(0, idx).trim();
          const val = trimmed.substring(idx + 1).trim().replace(/^['"]|['"]$/g, '');
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await client.connect();
  console.log('--- APPLYING LAB NOTIFICATIONS RLS POLICY MIGRATION ---');

  await client.query(`
    -- Ensure RLS is enabled
    ALTER TABLE public.lab_notifications ENABLE ROW LEVEL SECURITY;

    -- Drop legacy policies
    DROP POLICY IF EXISTS "read lab notifications" ON public.lab_notifications;
    DROP POLICY IF EXISTS "write lab notifications" ON public.lab_notifications;
    DROP POLICY IF EXISTS "allow_public_read_notifications" ON public.lab_notifications;
    DROP POLICY IF EXISTS "allow_public_write_notifications" ON public.lab_notifications;
    DROP POLICY IF EXISTS "Allow manage lab notifications" ON public.lab_notifications;

    -- 1. Permissive SELECT for privileged roles and role-scoped users
    CREATE POLICY "read lab notifications" ON public.lab_notifications
    FOR SELECT TO public
    USING (
      public.is_privileged() 
      OR target_role = public.current_role() 
      OR target_role = 'all' 
      OR target_role = 'teacher'
    );

    -- 2. Permissive INSERT for authenticated users and system workflows
    CREATE POLICY "insert lab notifications" ON public.lab_notifications
    FOR INSERT TO public
    WITH CHECK (true);

    -- 3. Permissive UPDATE so users can mark read
    CREATE POLICY "update lab notifications" ON public.lab_notifications
    FOR UPDATE TO public
    USING (
      public.is_privileged() 
      OR target_role = public.current_role() 
      OR target_role = 'teacher'
      OR target_role = 'all'
    )
    WITH CHECK (
      public.is_privileged() 
      OR target_role = public.current_role() 
      OR target_role = 'teacher'
      OR target_role = 'all'
    );

    -- 4. DELETE restricted to privileged roles
    CREATE POLICY "delete lab notifications" ON public.lab_notifications
    FOR DELETE TO public
    USING (public.is_privileged());

    -- Ensure table is part of supabase_realtime publication
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'lab_notifications'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.lab_notifications;
      END IF;
    END $$;
  `);

  console.log('✅ RLS policies and Realtime publication updated successfully.');

  // Notify PostgREST
  await client.query(`NOTIFY pgrst, 'reload schema';`);
  console.log('✅ Notified PostgREST schema reloader.');

  console.log('\n--- BACKFILLING NOTIFICATIONS FOR EXISTING INCIDENTS ---');
  const orphanIncidents = await client.query(`
    SELECT i.id, i.title, i.severity, i.status, i.reported_by, i.lab_id, i.session_label, i.batch_name, i.equipment_name, i.circumstances, i.created_at
    FROM public.lab_incidents i
    LEFT JOIN public.lab_notifications n ON n.incident_id = i.id
    WHERE n.id IS NULL
    ORDER BY i.created_at ASC;
  `);

  console.log(`Found ${orphanIncidents.rows.length} orphan incidents to backfill.`);

  for (const inc of orphanIncidents.rows) {
    const isCritical = inc.severity === 'major_critical';
    const isModerate = inc.severity === 'moderate';
    const labName =
      inc.lab_id === 'chem'
        ? 'Chemistry Laboratory'
        : inc.lab_id === 'phys'
        ? 'Physics Laboratory'
        : inc.lab_id === 'comp'
        ? 'Computer Laboratory'
        : `${(inc.lab_id || '').toUpperCase()} Lab`;

    const notifs = [
      {
        id: `notif-${inc.id}-admin`,
        incident_id: inc.id,
        target_role: 'super_admin',
        target_lab_id: inc.lab_id,
        title: `${isCritical ? '🚨 CRITICAL: ' : ''}${inc.title}`,
        message: `${labName}: Reported by ${inc.reported_by} during ${inc.session_label || 'Scheduled Slot'} (${inc.batch_name || 'Class'}).`,
        severity: isCritical ? 'critical' : isModerate ? 'warning' : 'info',
        is_read: false,
        created_at: inc.created_at,
      },
      {
        id: `notif-${inc.id}-incharge`,
        incident_id: inc.id,
        target_role: 'lab_incharge',
        target_lab_id: inc.lab_id,
        title: `Damage Reported in ${labName}`,
        message: `${inc.title} (${inc.batch_name || 'Class'} • ${inc.session_label || 'Slot'}). Assigned to Lab In-Charge for triage.`,
        severity: isCritical ? 'critical' : isModerate ? 'warning' : 'info',
        is_read: false,
        created_at: inc.created_at,
      },
      {
        id: `notif-${inc.id}-teacher`,
        incident_id: inc.id,
        target_role: 'teacher',
        target_lab_id: inc.lab_id,
        title: `Incident Report Submitted: ${inc.title}`,
        message: `Your report for ${inc.equipment_name || inc.title} in ${labName} has been logged and queued for Lab In-Charge triage.`,
        severity: 'info',
        is_read: false,
        created_at: inc.created_at,
      },
    ];

    if (isCritical || isModerate) {
      notifs.push({
        id: `notif-${inc.id}-hod`,
        incident_id: inc.id,
        target_role: 'hod',
        target_lab_id: inc.lab_id,
        title: `${isCritical ? '🚨 HOD ESCALATION: ' : 'HOD Notice: '}${inc.title}`,
        message: `${labName}: Practical damage reported for ${inc.batch_name || 'Class'}. ${isCritical ? 'Immediate Head review and directive required.' : 'Logged in institutional register.'}`,
        severity: isCritical ? 'critical' : 'warning',
        is_read: false,
        created_at: inc.created_at,
      });
    }

    for (const n of notifs) {
      await client.query(`
        INSERT INTO public.lab_notifications (id, incident_id, target_role, target_lab_id, title, message, severity, is_read, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO NOTHING;
      `, [n.id, n.incident_id, n.target_role, n.target_lab_id, n.title, n.message, n.severity, n.is_read, n.created_at]);
    }

    console.log(`Backfilled ${notifs.length} notifications for incident ${inc.id} (${inc.title}).`);
  }

  console.log('\n--- VERIFYING LATEST 15 NOTIFICATIONS IN DATABASE ---');
  const checkRes = await client.query(`
    SELECT id, incident_id, title, target_role, severity, is_read, created_at
    FROM public.lab_notifications
    ORDER BY created_at DESC
    LIMIT 15;
  `);
  console.table(checkRes.rows);

  await client.end();
}

run().catch(console.error);
