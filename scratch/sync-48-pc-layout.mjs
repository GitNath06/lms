import { getPgPool } from '../lib/db.ts'
import { generateRoomGridSlots, calculateCustomRoomLayout } from '../lib/workstations/layout-engine.ts'

async function syncCompLab() {
  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const labId = 'comp'

    const config = {
      sides: 2,
      rows: 6,
      columns: 4,
      rowNaming: 'letters',
      terminalNaming: 'alphanumeric',
    }
    const snapGrid = 2

    const { rows: existingRows } = await client.query(
      `SELECT id, label, row_label FROM public.workstations WHERE lab_id = $1 AND is_active = true ORDER BY label ASC`,
      [labId]
    )

    const slots = generateRoomGridSlots(config, snapGrid)
    console.log(`Generated ${slots.length} slots for 2 sides x 6 rows x 4 cols (48 PCs)`)

    const teacherStations = existingRows.filter((r) => {
      const lbl = r.label.toLowerCase()
      return lbl.includes('teacher') || lbl.includes('podium') || lbl.includes('instructor')
    })
    let studentStations = existingRows.filter((r) => {
      const lbl = r.label.toLowerCase()
      return !lbl.includes('teacher') && !lbl.includes('podium') && !lbl.includes('instructor')
    })

    const allStations = [...teacherStations, ...studentStations.slice(0, slots.length)]
    const calculatedUpdates = calculateCustomRoomLayout(allStations, config, snapGrid, true)

    // Two-pass update to eliminate any label collisions
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
    console.log(`Successfully synced comp lab! Updated ${calculatedUpdates.length} workstations.`)

    // Verification
    const { rows: verifyRows } = await client.query(
      `SELECT id, label, is_active, pos_x, pos_y, row_label FROM public.workstations WHERE lab_id = 'comp' AND is_active = true ORDER BY label ASC;`
    )
    console.log(`Verified active count: ${verifyRows.length}`)
    console.log('Row A Left:', verifyRows.filter(r => ['A1', 'A2', 'A3', 'A4'].includes(r.label)).map(r => `${r.label}: ${r.pos_x}%, ${r.pos_y}%`))
    console.log('Row A Right:', verifyRows.filter(r => ['A5', 'A6', 'A7', 'A8'].includes(r.label)).map(r => `${r.label}: ${r.pos_x}%, ${r.pos_y}%`))
    console.log('Row F Left:', verifyRows.filter(r => ['F1', 'F2', 'F3', 'F4'].includes(r.label)).map(r => `${r.label}: ${r.pos_x}%, ${r.pos_y}%`))
    console.log('Row F Right:', verifyRows.filter(r => ['F5', 'F6', 'F7', 'F8'].includes(r.label)).map(r => `${r.label}: ${r.pos_x}%, ${r.pos_y}%`))
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Error syncing comp lab:', err)
  } finally {
    client.release()
    await pool.end()
  }
}

syncCompLab()
