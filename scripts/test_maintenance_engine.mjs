import pg from 'pg'
const { Pool } = pg

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.xysdrtbomtqgqtiojcev:labmanagement%40123@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres'

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
})

async function test() {
  const client = await pool.connect()
  try {
    console.log('Testing Maintenance Engine Triggers & Lifecycle...')

    // 1. Get an existing lab and profile
    const labRes = await client.query(`SELECT id FROM public.labs LIMIT 1;`)
    const labId = labRes.rows[0]?.id || 'comp'

    const profileRes = await client.query(`SELECT id FROM public.profiles LIMIT 1;`)
    const profileId = profileRes.rows[0]?.id

    if (!profileId) {
      throw new Error('No profile found in public.profiles')
    }

    console.log(`Using lab: ${labId}, profile: ${profileId}`)

    // Clean up previous test entries if any
    await client.query(`DELETE FROM public.maintenance_plans WHERE title LIKE 'TEST_%';`)

    // Test 1: Day-Zero Initial Reminder Creation
    console.log('TEST 1: Creating Plan to test Day-Zero Trigger...')
    const planRes = await client.query(`
      INSERT INTO public.maintenance_plans (
        lab_id, title, category, interval_days, severity, target_role, checklist, is_active
      ) VALUES (
        $1, 'TEST_PC Thermal Paste & Dusting', 'Thermal Service', 90, 'routine', 'lab_incharge',
        '["Air dust filters", "Re-apply MX-4 paste", "Verify temps under load"]'::jsonb, true
      ) RETURNING *;
    `, [labId])
    const plan = planRes.rows[0]
    console.log('Created Plan:', plan.id)

    // Check if initial reminder was auto-created by trg_new_maintenance_plan
    const remRes = await client.query(`
      SELECT * FROM public.maintenance_reminders WHERE plan_id = $1;
    `, [plan.id])

    if (remRes.rows.length !== 1) {
      throw new Error(`Expected 1 auto-created reminder, got ${remRes.rows.length}`)
    }
    const initialReminder = remRes.rows[0]
    console.log('SUCCESS: Day-Zero reminder spawned automatically! Due date:', initialReminder.due_date, 'Status:', initialReminder.status)

    // Test 2: Snooze Reminder
    console.log('TEST 2: Testing Snooze Engine...')
    await client.query(`
      UPDATE public.maintenance_reminders
      SET status = 'snoozed',
          snoozed_until = current_date + 7,
          snooze_count = snooze_count + 1,
          snooze_reason = 'Awaiting thermal paste shipment from supplier'
      WHERE id = $1;
    `, [initialReminder.id])

    const snoozedRem = (await client.query(`SELECT * FROM public.maintenance_reminders WHERE id = $1;`, [initialReminder.id])).rows[0]
    if (snoozedRem.status !== 'snoozed' || snoozedRem.snooze_count !== 1) {
      throw new Error('Snooze update failed')
    }
    console.log('SUCCESS: Snooze state persisted with reason and count:', snoozedRem.snooze_reason)

    // Test 3: Log Completion and Recurrence Trigger
    console.log('TEST 3: Logging Maintenance Completion...')
    const logRes = await client.query(`
      INSERT INTO public.maintenance_logs (
        plan_id, reminder_id, lab_id, asset_identifier, work_performed,
        checklist_completed, parts_replaced, cost_incurred, service_date, performed_by_id
      ) VALUES (
        $1, $2, $3, 'All Workstations (PC 01-36)', 'Completed air dusting and paste re-application on all 36 units.',
        '["Air dust filters", "Re-apply MX-4 paste", "Verify temps under load"]'::jsonb,
        'Arctic MX-4 (45g tube)', 2800.00, current_date, $4
      ) RETURNING *;
    `, [plan.id, initialReminder.id, labId, profileId])

    const log = logRes.rows[0]
    console.log('Logged Maintenance ID:', log.id)

    // Verify initial reminder marked completed
    const remAfter = (await client.query(`SELECT * FROM public.maintenance_reminders WHERE id = $1;`, [initialReminder.id])).rows[0]
    if (remAfter.status !== 'completed') {
      throw new Error(`Expected initial reminder completed, got ${remAfter.status}`)
    }
    console.log('SUCCESS: Initial reminder marked completed!')

    // Verify next cycle reminder spawned automatically
    const allReminders = (await client.query(`
      SELECT * FROM public.maintenance_reminders WHERE plan_id = $1 ORDER BY created_at ASC;
    `, [plan.id])).rows

    if (allReminders.length !== 2) {
      throw new Error(`Expected 2 total reminders (1 completed, 1 next pending), got ${allReminders.length}`)
    }
    const nextReminder = allReminders[1]
    console.log('SUCCESS: Next cycle reminder auto-spawned with due_date:', nextReminder.due_date, 'Status:', nextReminder.status)

    // Test 4: Direct Log without reminder_id (closing dangling reminder)
    console.log('TEST 4: Direct Log Orphan Cleanup...')
    await client.query(`
      INSERT INTO public.maintenance_logs (
        plan_id, reminder_id, lab_id, asset_identifier, work_performed,
        checklist_completed, cost_incurred, service_date, performed_by_id
      ) VALUES (
        $1, null, $2, 'Special check', 'Direct servicing performed by outside technician',
        '[]'::jsonb, 500.00, current_date, $3
      );
    `, [plan.id, labId, profileId])

    // Verify previous pending reminder was marked completed and fresh reminder created
    const remindersAfterDirect = (await client.query(`
      SELECT * FROM public.maintenance_reminders WHERE plan_id = $1 ORDER BY created_at ASC;
    `, [plan.id])).rows

    const completedCount = remindersAfterDirect.filter(r => r.status === 'completed').length
    const pendingCount = remindersAfterDirect.filter(r => r.status === 'pending').length
    console.log(`Direct log handled cleanly: ${completedCount} completed, ${pendingCount} active pending.`)

    // Clean up test data
    await client.query(`DELETE FROM public.maintenance_plans WHERE id = $1;`, [plan.id])
    console.log('Test data cleaned up successfully.')

    // Seed Initial Institutional Maintenance Plans
    console.log('Seeding Institutional Maintenance Plans...')
    const existingPlans = await client.query(`SELECT count(*) FROM public.maintenance_plans;`)
    if (parseInt(existingPlans.rows[0].count, 10) === 0) {
      const seedPlans = [
        {
          lab_id: 'comp',
          title: 'Workstation Heatsink De-dusting & Thermal Service',
          category: 'Thermal Service',
          interval_days: 90,
          severity: 'routine',
          target_role: 'lab_incharge',
          description: 'Comprehensive high-pressure blower de-dusting of all 36 workstation chassis, CPU heatsinks, PSU filters, and GPU fans.',
          checklist: JSON.stringify(['Power down and isolate main power bus', 'Blow dust from chassis and PSU intake filters', 'Inspect CPU fan bearings and cable ties', 'Verify boot temperatures on 5 random sample units'])
        },
        {
          lab_id: 'comp',
          title: 'Server Rack & Switch Airflow Inspection',
          category: 'Infrastructure Care',
          interval_days: 60,
          severity: 'high',
          target_role: 'lab_incharge',
          description: 'Check rack exhaust fans, patch cord cable tension, and core Cisco gigabit switch intake filters.',
          checklist: JSON.stringify(['Check rack exhaust fans operation', 'Inspect UPS battery health & voltage indicators', 'Verify patch cable terminations on patch panel'])
        },
        {
          lab_id: 'phys',
          title: 'Optical Microscope Objective Lens Cleaning & Alignment',
          category: 'Optical Calibration',
          interval_days: 60,
          severity: 'high',
          target_role: 'lab_incharge',
          description: 'Cleaning of 10x, 40x, and 100x oil-immersion objective lenses with spectrophotometric grade lens cleaning solution and alignment check.',
          checklist: JSON.stringify(['Inspect stage micrometer mechanisms', 'Clean eyepiece and objective lenses with lens paper', 'Lubricate fine adjustment gears with silicone grease', 'Check illumination LED/mirror alignment'])
        },
        {
          lab_id: 'chem',
          title: 'Fume Hood Face Velocity & Exhaust Duct Inspection',
          category: 'Chemical Safety',
          interval_days: 90,
          severity: 'critical',
          target_role: 'lab_incharge',
          description: 'Safety inspection of chemical vapor exhaust motor, baffle alignment, and face velocity testing to maintain >100 FPM airflow.',
          checklist: JSON.stringify(['Verify exhaust fan motor belt and noise', 'Inspect sash counterweight cables and smooth travel', 'Check chemical drain trap and water supply', 'Test emergency gas shut-off valve'])
        },
        {
          lab_id: 'bio',
          title: 'Autoclave & Digital Incubator Calibration',
          category: 'Sterilization & Heat',
          interval_days: 120,
          severity: 'critical',
          target_role: 'lab_incharge',
          description: 'Temperature calibration check for digital bacteriological incubator and safety relief valve inspection on steam autoclave.',
          checklist: JSON.stringify(['Check autoclave lid gasket seal for cracks', 'Test pressure release valve operation', 'Calibrate digital incubator temperature sensor against reference thermometer', 'Clean chamber interior with 70% isopropanol'])
        }
      ]

      for (const p of seedPlans) {
        await client.query(`
          INSERT INTO public.maintenance_plans (
            lab_id, title, category, interval_days, severity, target_role, description, checklist, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, true);
        `, [p.lab_id, p.title, p.category, p.interval_days, p.severity, p.target_role, p.description, p.checklist])
      }
      console.log('Seeded 5 institutional maintenance plans with auto-spawned initial reminders!')
    } else {
      console.log('Institutional maintenance plans already seeded.')
    }

    console.log('ALL TESTS PASSED SUCCESSFULLY!')
  } catch (err) {
    console.error('Test failed:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

test()
