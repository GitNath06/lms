import { getPgPool } from '../lib/db.ts'

async function check() {
  const pool = getPgPool()
  try {
    const res = await pool.query(
      "SELECT id, label, is_active, pos_x, pos_y, row_label FROM public.workstations WHERE lab_id = 'comp' ORDER BY label ASC;"
    )
    const active = res.rows.filter(r => r.is_active)
    console.log('Active count:', active.length)
    console.log(
      'Active workstations:',
      active.map(r => `${r.label} (${r.pos_x}%, ${r.pos_y}%) [${r.row_label}]`)
    )
  } catch (err) {
    console.error('Error:', err)
  } finally {
    await pool.end()
  }
}
check()
