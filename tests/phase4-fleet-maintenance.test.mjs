import test, { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import {
  calculateFleetProgressSummary,
  sortWorkstationLabels,
  groupWorkstationLabelsByRow,
} from '../lib/types/maintenance-fleet.ts'
import * as maintenanceFleetActions from '../app/actions/maintenance-fleet.ts'

// Load environment variables for remote PostgreSQL verification
const envPath = path.resolve(process.cwd(), '.env.local')
let dbUrl = process.env.DATABASE_URL || ''
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) {
      dbUrl = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '')
    }
  }
}

const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
})

after(async () => {
  await pool.end()
})

describe('Phase 4: Multi-PC Maintenance Routine Checklists & Fleet Operations', () => {
  it('Summary Calculation: computes exact completion, pending, blocked metrics and percentage', () => {
    const stations = [
      'PC-01', 'PC-02', 'PC-03', 'PC-04', 'PC-05',
      'PC-06', 'PC-07', 'PC-08', 'PC-09', 'PC-10',
    ]

    const progress = {
      'PC-01': { status: 'completed', updated_at: '2026-10-06T10:00:00Z' },
      'PC-02': { status: 'completed', updated_at: '2026-10-06T10:00:00Z' },
      'PC-03': { status: 'completed', updated_at: '2026-10-06T10:00:00Z' },
      'PC-04': { status: 'blocked', updated_at: '2026-10-06T10:00:00Z', notes: 'Bad RAM' },
      'PC-05': { status: 'blocked', updated_at: '2026-10-06T10:00:00Z', notes: 'No network link' },
    }

    const summary = calculateFleetProgressSummary(stations, progress)

    assert.equal(summary.total, 10)
    assert.equal(summary.completed, 3)
    assert.equal(summary.blocked, 2)
    assert.equal(summary.pending, 5)
    assert.equal(summary.percentage, 30)
  })

  it('Summary Calculation: edge case with 0 target machines returns zeroed metrics', () => {
    const summary = calculateFleetProgressSummary([], {})
    assert.deepEqual(summary, {
      total: 0,
      completed: 0,
      pending: 0,
      blocked: 0,
      percentage: 0,
    })
  })

  it('Workstation Natural Alphanumeric Sort: orders PC-01 to PC-50 and positions teacher podium', () => {
    const unorganized = [
      'PC-10',
      'TEACHER-PODIUM',
      'PC-02',
      'PC-01',
      'PC-20',
      'PC-09',
      'PC-05',
    ]

    const sorted = sortWorkstationLabels(unorganized)

    assert.equal(sorted[0], 'PC-01')
    assert.equal(sorted[1], 'PC-02')
    assert.equal(sorted[2], 'PC-05')
    assert.equal(sorted[3], 'PC-09')
    assert.equal(sorted[4], 'PC-10')
    assert.equal(sorted[5], 'PC-20')
    assert.equal(sorted[6], 'TEACHER-PODIUM')
  })

  it('Row Grouping: organizes terminal fleet into logical rows and podium', () => {
    const stations = [
      'PC-01', 'PC-05', 'PC-10',
      'PC-11', 'PC-15', 'PC-20',
      'PC-25', 'PC-30',
      'PC-35', 'PC-40',
      'TEACHER-01',
    ]

    const groups = groupWorkstationLabelsByRow(stations)

    assert.ok(groups.length >= 4)
    const rowA = groups.find((g) => g.rowLabel.includes('Row A'))
    assert.ok(rowA)
    assert.deepEqual(rowA.items, ['PC-01', 'PC-05', 'PC-10'])

    const teacherGroup = groups.find((g) => g.rowLabel.includes('Teacher Pod'))
    assert.ok(teacherGroup)
    assert.deepEqual(teacherGroup.items, ['TEACHER-01'])
  })

  it('Database Schema Verification: public.maintenance_plans has affected_machines and fleet_progress columns', async () => {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'maintenance_plans' 
        AND column_name IN ('affected_machines', 'fleet_progress');
    `)

    assert.equal(res.rows.length, 2, 'Both affected_machines and fleet_progress must exist in maintenance_plans')

    const cols = Object.fromEntries(res.rows.map((r) => [r.column_name, r.data_type]))
    assert.equal(cols.affected_machines, 'ARRAY')
    assert.equal(cols.fleet_progress, 'jsonb')
  })

  it('Server Action Pure RPC Exports: app/actions/maintenance-fleet.ts only exports async functions (Rule #13)', () => {
    const exportedKeys = Object.keys(maintenanceFleetActions)
    assert.ok(exportedKeys.includes('getFleetRoutineProgress'))
    assert.ok(exportedKeys.includes('updateFleetTerminalStatus'))
    assert.ok(exportedKeys.includes('batchUpdateFleetTerminalStatus'))
    assert.ok(exportedKeys.includes('resetFleetRoutineProgress'))
    assert.ok(exportedKeys.includes('archiveFleetRoutineToLog'))

    for (const key of exportedKeys) {
      const fn = maintenanceFleetActions[key]
      assert.equal(typeof fn, 'function', `Export ${key} must be a function`)
      assert.equal(
        fn.constructor.name,
        'AsyncFunction',
        `Export ${key} must be an AsyncFunction per Rule #13`
      )
    }
  })
})
