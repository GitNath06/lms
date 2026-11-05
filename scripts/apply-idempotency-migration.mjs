import { getPgPool } from '../lib/db.ts'
import fs from 'node:fs'
import path from 'node:path'

async function run() {
  const pool = getPgPool()
  const sql = fs.readFileSync(path.resolve('./scripts/migrations/20261104_offline_idempotency_keys.sql'), 'utf-8')
  console.log('Applying offline idempotency key migration to PostgreSQL...')
  try {
    await pool.query(sql)
    console.log('✅ Offline idempotency key migration applied successfully!')
  } catch (err) {
    console.error('Failed to apply migration:', err.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

run()

