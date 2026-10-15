import { getPgPool } from '../lib/db.ts'
import { generateRoomGridSlots, calculateCustomRoomLayout } from '../lib/workstations/layout-engine.ts'

async function run() {
  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const labId = 'comp'

    const config = {
      sides: 3,
      rows: 6,
      columns: 3,
      rowNaming: 'letters',
      terminalNaming: 'alphanumeric',
    }
    const snapGrid = 2

    const { rows: existingRows } = await client.query(
      `SELECT id, label, row_label FROM public.workstations WHERE lab_id = $1 AND is_active = true ORDER BY label ASC`,
      [labId]
    )

    const slots = generateRoomGridSlots(config, snapGrid)
    console.log(`Generated ${slots.length} slots for 3 sections x 6 rows x 3 cols`)

    const teacherStations = existingRows.filter((r) => {
      const lbl = r.label.toLowerCase()
      return lbl.includes('teacher') || lbl.includes('podium') || lbl.includes('instructor')
    })
    let studentStations = existingRows.filter((r) => {
      const lbl = r.label.toLowerCase()
      return !lbl.includes('teacher') && !lbl.includes('podium') && !lbl.includes('instructor')
    })

    // Keep stations with active issues
    const { rows: issueWsRows } = await client.query(
      `SELECT DISTINCT workstation_id FROM public.workstation_issues WHERE status != 'resolved'`
    )
    const activeIssueIds = new Set(issueWsRows.map((r) => r.workstation_id))
    studentStations.sort((a, b) => {
      const aHas = activeIssueIds.has(a.id) ? 0 : 1
      const bHas = activeIssueIds.has(b.id) ? 0 : 1
      return aHas - bHas
    })

    console.log(`Current active student stations: ${studentStations.length}`)
    if (studentStations.length > slots.length) {
      const surplus = studentStations.slice(slots.length)
      const surplusIds = surplus.map((s) => s.id)
      console.log(`Deactivating ${surplusIds.length} surplus workstations...`)
      await client.query(
        `UPDATE public.workstations SET is_active = false, updated_at = NOW() WHERE id = ANY($1) AND lab_id = $2`,
        [surplusIds, labId]
      )
      studentStations = studentStations.slice(0, slots.length)
    }

    const allStations = [...teacherStations, ...studentStations]
    const calculatedUpdates = calculateCustomRoomLayout(allStations, config, snapGrid, true)

    // Two-pass update to eliminate unique constraint collisions
    await client.query(
      `UPDATE public.workstations SET label = '__tmp_' || id::text WHERE lab_id = $1`,
      [labId]
    )

    for (const item of calculatedUpdates) {
      await client.query(
        `UPDATE public.workstations
         SET pos_x = $1, pos_y = $2, row_label = COALESCE($3, row_label), label = COALESCE($4, label), updated_at = NOW()
         WHERE id = $5 AND lab_id = $6`,
        [item.pos_x, item.pos_y, item.row_label || null, item.label || null, item.id, labId]
      )
    }

    await client.query(
      `UPDATE public.labs SET capacity = $1 WHERE id = $2`,
      [slots.length, labId]
    )

    await client.query('COMMIT')
    console.log(`Successfully committed! Active workstations: ${calculatedUpdates.length}`)

    // Verification
    const { rows: verifyRows } = await client.query(
      `SELECT id, label, is_active, pos_x, pos_y, row_label FROM public.workstations WHERE lab_id = 'comp' AND is_active = true ORDER BY label ASC;`
    )
    console.log(`Verified active count in DB: ${verifyRows.length}`)
    console.log('Row A:', verifyRows.filter(r => r.label.startsWith('A')).map(r => `${r.label}: ${r.pos_x}%`))
    console.log('Reserve stations:', verifyRows.filter(r => r.row_label === 'Reserve Stations').length)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Error applying clean grid:', err)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
