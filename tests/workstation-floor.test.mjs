import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

function loadDbUrl() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return null
  const content = fs.readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) {
      return line.split('=')[1].trim().replace(/^["']|["']$/g, '')
    }
  }
  return null
}

describe('Workstation Floor Management & Issue Resolution Suite', () => {
  const dbUrl = loadDbUrl()

  it('Schema Integrity: public.workstations, public.issue_categories, public.workstation_issues exist', async () => {
    if (!dbUrl) return
    const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
    const client = await pool.connect()
    try {
      const res = await client.query(`
        SELECT to_regclass('public.workstations') as ws,
               to_regclass('public.issue_categories') as ic,
               to_regclass('public.workstation_issues') as wi;
      `)
      assert.ok(res.rows[0].ws, 'public.workstations must exist')
      assert.ok(res.rows[0].ic, 'public.issue_categories must exist')
      assert.ok(res.rows[0].wi, 'public.workstation_issues must exist')
    } finally {
      client.release()
      await pool.end()
    }
  })

  it('Seeded Workstations: Computer Lab (comp) contains seeded workstations in rows A-D and teacher station', async () => {
    if (!dbUrl) return
    const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
    const client = await pool.connect()
    try {
      const res = await client.query(`
        SELECT COUNT(*) as count FROM public.workstations WHERE lab_id = 'comp' AND is_active = true;
      `)
      const count = parseInt(res.rows[0].count, 10)
      assert.ok(count >= 32, `Expected at least 32 workstations in comp, found ${count}`)

      const teacherRes = await client.query(`
        SELECT id, label, pos_x, pos_y FROM public.workstations WHERE lab_id = 'comp' AND label = 'Teacher-01';
      `)
      assert.equal(teacherRes.rows.length, 1, 'Teacher-01 station must exist')
    } finally {
      client.release()
      await pool.end()
    }
  })

  it('Taxonomy: Active issue categories contain standard hardware and software categories', async () => {
    if (!dbUrl) return
    const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
    const client = await pool.connect()
    try {
      const res = await client.query(`
        SELECT name, type, default_severity FROM public.issue_categories WHERE is_active = true;
      `)
      const names = res.rows.map(r => r.name)
      assert.ok(names.some(n => n.includes('Display')), 'Must contain display category')
      assert.ok(names.some(n => n.includes('OS') || n.includes('Blue Screen')), 'Must contain OS/BSOD category')
      assert.ok(names.some(n => n.includes('LAN') || n.includes('Network')), 'Must contain network category')
    } finally {
      client.release()
      await pool.end()
    }
  })
})
