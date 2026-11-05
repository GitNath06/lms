import { getPgPool } from '../lib/db.ts'

async function main() {
  const pool = getPgPool()
  const res = await pool.query(
    `SELECT slot_id, count(*) FROM public.schedules GROUP BY slot_id ORDER BY slot_id`
  )
  console.log('--- SCHEDULE SLOT_IDS ---')
  console.table(res.rows)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
