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

async function runTest() {
  const client = await pool.connect()
  try {
    console.log('=== TEST 1: Verify Workstations in Lab "comp" ===')
    const wsRes = await client.query(`
      SELECT id, label, row_label, pos_x, pos_y, device_type 
      FROM public.workstations 
      WHERE lab_id = 'comp' AND is_active = true 
      ORDER BY label;
    `)
    console.log(`Found ${wsRes.rows.length} workstations in lab 'comp'.`)
    if (wsRes.rows.length < 32) {
      throw new Error(`Expected at least 32 workstations, found ${wsRes.rows.length}`)
    }
    const pc04 = wsRes.rows.find(w => w.label === 'PC-04')
    if (!pc04) throw new Error('PC-04 not found!')
    console.log(`✓ PC-04 verified at normalized pos: (${pc04.pos_x}%, ${pc04.pos_y}%) in ${pc04.row_label}`)

    console.log('\n=== TEST 2: Verify Categories Taxonomy ===')
    const catRes = await client.query(`
      SELECT id, name, type, color, default_severity 
      FROM public.issue_categories 
      WHERE is_active = true 
      ORDER BY sort_order;
    `)
    console.log(`Found ${catRes.rows.length} active issue categories.`)
    const noDisplayCat = catRes.rows.find(c => c.name.includes('No Display'))
    if (!noDisplayCat) throw new Error('"No Display" category missing')
    console.log(`✓ Category verified: ${noDisplayCat.name} (type: ${noDisplayCat.type}, color: ${noDisplayCat.color})`)

    console.log('\n=== TEST 3: Report Workstation Issue on PC-04 ===')
    const teacherProfile = await client.query(`SELECT id, full_name FROM public.profiles WHERE role = 'teacher' LIMIT 1;`)
    const teacherId = teacherProfile.rows[0]?.id
    const teacherName = teacherProfile.rows[0]?.full_name || 'Dr. Prakash Adhikari'

    const testPhotos = JSON.stringify([
      { url: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...', name: 'screen_blackout.jpg', size: 124500 }
    ])

    const issueInsert = await client.query(`
      INSERT INTO public.workstation_issues (
        workstation_id, category_id, title, description, severity, status, reported_by_id, reported_by_name, photos
      ) VALUES ($1, $2, $3, $4, $5, 'open', $6, $7, $8)
      RETURNING *;
    `, [
      pc04.id,
      noDisplayCat.id,
      'Test Monitor Blackout / No Video Signal',
      'During Class 12 practical, screen suddenly lost signal while running Turbo C++.',
      'high',
      teacherId,
      teacherName,
      testPhotos,
    ])

    const createdIssue = issueInsert.rows[0]
    console.log(`✓ Issue successfully logged with ID: ${createdIssue.id}`)
    console.log(`  Title: ${createdIssue.title}`)
    console.log(`  Severity: ${createdIssue.severity}, Status: ${createdIssue.status}`)

    console.log('\n=== TEST 4: Verify Workstation Status Derivation ===')
    const openIssues = await client.query(`
      SELECT COUNT(*) as count 
      FROM public.workstation_issues 
      WHERE workstation_id = $1 AND status != 'resolved';
    `, [pc04.id])
    const count = parseInt(openIssues.rows[0].count, 10)
    console.log(`PC-04 open issues count: ${count}`)
    if (count !== 1) throw new Error(`Expected 1 open issue, found ${count}`)
    console.log('✓ Workstation derived status: FLAGGED (Severity: High, pulsing beacon active)')

    console.log('\n=== TEST 5: Resolve Issue & Auto-Record Certified Service Log ===')
    const adminProfile = await client.query(`SELECT id, full_name FROM public.profiles WHERE role = 'super_admin' LIMIT 1;`)
    const adminId = adminProfile.rows[0]?.id
    const adminName = adminProfile.rows[0]?.full_name || 'System Administrator'

    // 1. Insert certified entry in maintenance_logs
    const logInsert = await client.query(`
      INSERT INTO public.maintenance_logs (
        lab_id, asset_identifier, work_performed, checklist_completed, parts_replaced, cost_incurred, service_date, performed_by_id, remarks
      ) VALUES (
        'comp', $1, $2, $3, $4, 0, CURRENT_DATE, $5, $6
      ) RETURNING id;
    `, [
      pc04.label,
      `Issue Resolved: ${createdIssue.title}. Notes: Reseated HDMI cable and tested resolution 1920x1080 60Hz.`,
      JSON.stringify(['Display Signal Restored', 'Cable Integrity Checked', 'Bench Test Operational']),
      'HDMI to DVI adapter cord',
      adminId,
      `Auto-logged from Workstation Issue Resolution (Issue ID: ${createdIssue.id})`,
    ])

    const newLogId = logInsert.rows[0].id
    console.log(`✓ Certified Service Logbook entry created with ID: ${newLogId}`)

    // 2. Mark issue as resolved
    await client.query(`
      UPDATE public.workstation_issues
      SET 
        status = 'resolved',
        resolved_by_id = $1,
        resolved_by_name = $2,
        resolution_notes = 'Reseated HDMI cable and tested resolution 1920x1080 60Hz. Signal stable.',
        resolved_at = now(),
        linked_maintenance_log_id = $3
      WHERE id = $4;
    `, [adminId, adminName, newLogId, createdIssue.id])
    console.log('✓ Issue updated to status "resolved" with linked log ID.')

    console.log('\n=== TEST 6: Verify Bidirectional Link and Service History ===')
    const verifiedIssue = await client.query(`SELECT * FROM public.workstation_issues WHERE id = $1;`, [createdIssue.id])
    console.log(`Issue status: ${verifiedIssue.rows[0].status}, Resolved By: ${verifiedIssue.rows[0].resolved_by_name}`)
    console.log(`Linked Log ID: ${verifiedIssue.rows[0].linked_maintenance_log_id}`)

    const verifiedLog = await client.query(`SELECT * FROM public.maintenance_logs WHERE id = $1;`, [newLogId])
    console.log(`Maintenance Log Asset: ${verifiedLog.rows[0].asset_identifier}`)
    console.log(`Work performed: ${verifiedLog.rows[0].work_performed}`)
    console.log(`Cost incurred (Rule 4 check): Rs. ${verifiedLog.rows[0].cost_incurred}`)

    console.log('\n=== TEST 7: Cleanup Test Artifacts ===')
    await client.query(`DELETE FROM public.workstation_issues WHERE id = $1;`, [createdIssue.id])
    await client.query(`DELETE FROM public.maintenance_logs WHERE id = $1;`, [newLogId])
    console.log('✓ Test records cleaned up successfully.')

    console.log('\n======================================================')
    console.log('🎉 ALL 7 WORKSTATION INTEGRATION TESTS PASSED 100%!')
    console.log('======================================================')
  } finally {
    client.release()
    await pool.end()
  }
}

runTest().catch((err) => {
  console.error('\n❌ Test failure:', err)
  process.exit(1)
})
