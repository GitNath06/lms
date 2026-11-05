import { getPgPool } from '../lib/db.ts'
import fs from 'node:fs'
import path from 'node:path'

async function run() {
  const pool = getPgPool()
  const sql = fs.readFileSync(path.resolve('./scripts/migrations/20261103_performance_composite_indexes.sql'), 'utf-8')
  console.log('Applying composite performance indexes to PostgreSQL...')
  try {
    await pool.query(sql)
    console.log('✅ Composite performance indexes applied successfully!')
  } catch (err) {
    console.error('Failed to apply indexes:', err.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

run()

