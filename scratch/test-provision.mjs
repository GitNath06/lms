import { getPgPool } from '../lib/db.ts'
import { provisionCustomGridWorkstations } from '../app/actions/workstations.ts'

async function run() {
  const pool = getPgPool()
  try {
    const config = {
      sides: 3,
      rows: 6,
      columns: 3,
      rowNaming: 'letters',
      terminalNaming: 'alphanumeric',
    }

    // Call provisionCustomGridWorkstations
    const res = await provisionCustomGridWorkstations('comp', config, 2)
    console.log('Provision result:', res)

    const wsRes = await pool.query(
      "SELECT id, label, is_active, pos_x, pos_y, row_label FROM public.workstations WHERE lab_id = 'comp' AND is_active = true ORDER BY label ASC;"
    )
    console.log('Active workstations count:', wsRes.rows.length)
    console.log('Sample labels:', wsRes.rows.slice(0, 10).map(r => `${r.label} (${r.pos_x}%, ${r.pos_y}%)`))
    console.log('Last labels:', wsRes.rows.slice(-10).map(r => `${r.label} (${r.pos_x}%, ${r.pos_y}%)`))

    const reserveCount = wsRes.rows.filter(r => r.row_label === 'Reserve Stations' || r.pos_y === 94).length
    console.log('Reserve stations on floor:', reserveCount)
  } catch (err) {
    console.error('Error:', err)
  } finally {
    await pool.end()
  }
}

run()
