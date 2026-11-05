import fs from 'node:fs'
import { getPgPool } from '../lib/db.ts'

try {
  const envContent = fs.readFileSync('.env.local', 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=')
      const key = trimmed.slice(0, idx).trim()
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
      if (!process.env[key]) {
        process.env[key] = val
      }
    }
  }
} catch (e) {}

async function run() {
  const pool = getPgPool()
  try {
    const colRes = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'issue_categories' 
      ORDER BY ordinal_position;
    `)
    console.log('Columns in issue_categories:', JSON.stringify(colRes.rows, null, 2))

    const dataRes = await pool.query(`SELECT id, name, type, default_severity, is_active, sort_order FROM public.issue_categories ORDER BY sort_order;`)
    console.table(dataRes.rows)
  } catch (err) {
    console.error('Error querying issue_categories:', err)
  } finally {
    process.exit(0)
  }
}

run()
