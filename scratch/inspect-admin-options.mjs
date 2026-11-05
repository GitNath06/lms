import { getPgPool } from '../lib/db.ts'

async function check() {
  const pool = getPgPool()
  const res = await pool.query("SELECT * FROM issue_categories ORDER BY sort_order ASC;")
  console.log(JSON.stringify(res.rows, null, 2))
  process.exit(0)
}

check().catch((e) => {
  console.error(e)
  process.exit(1)
})
