import { getPgPool } from '../lib/db.ts'

async function check() {
  const pool = getPgPool()
  const tables = ['academic_years', 'labs', 'classes', 'subjects', 'class_subjects', 'period_slots', 'profiles', 'holidays', 'issue_categories']
  for (const t of tables) {
    const res = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position",
      [t]
    )
    console.log(t, ':', res.rows.map((r) => r.column_name).join(', '))
  }
  await pool.end()
}

check()
