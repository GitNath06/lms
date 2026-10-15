import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

// Load .env.local into process.env before any DB clients load
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=')
      const key = trimmed.slice(0, idx).trim()
      const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
      if (!process.env[key]) {
        process.env[key] = val
      }
    }
  }
}

// Now dynamically import terminal action functions with populated environment
const {
  verifyTerminalAccess,
  submitStudentIssueReport,
  getLiveAssistanceRequests,
  acknowledgeAssistanceRequest,
} = await import('../app/actions/terminal.ts')

const { TERMINAL_QUICK_ISSUES } = await import('../lib/types/terminal.ts')

describe('Phase 1: Zero-Login Student Terminal Self-Reporting & Live Help Beacon', () => {
  const dbUrl = process.env.DATABASE_URL

  it('Schema Integrity: public.workstations has lan_ip and pairing_token columns', async () => {
    if (!dbUrl) return
    const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'workstations' AND column_name IN ('lan_ip', 'pairing_token');
    `)
    await pool.end()

    const cols = res.rows.map((r) => r.column_name)
    assert.ok(cols.includes('lan_ip'), 'workstations must have lan_ip')
    assert.ok(cols.includes('pairing_token'), 'workstations must have pairing_token')
  })

  it('Schema Integrity: public.workstation_issues supports student self-reporting (nullable reported_by_id, source, student fields)', async () => {
    if (!dbUrl) return
    const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
    const res = await pool.query(`
      SELECT column_name, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'workstation_issues' AND column_name IN ('reported_by_id', 'source', 'student_name', 'student_roll');
    `)
    await pool.end()

    const colMap = Object.fromEntries(res.rows.map((r) => [r.column_name, r.is_nullable]))
    assert.equal(colMap.reported_by_id, 'YES', 'reported_by_id must be nullable for student reports')
    assert.ok('source' in colMap, 'workstation_issues must have source column')
    assert.ok('student_name' in colMap, 'workstation_issues must have student_name column')
    assert.ok('student_roll' in colMap, 'workstation_issues must have student_roll column')
  })

  it('Domain Models: TERMINAL_QUICK_ISSUES contains standard 7 laboratory issue chips', () => {
    assert.equal(TERMINAL_QUICK_ISSUES.length, 7)
    const ids = TERMINAL_QUICK_ISSUES.map((c) => c.id)
    assert.ok(ids.includes('windows_activation'))
    assert.ok(ids.includes('office_license'))
    assert.ok(ids.includes('missing_software'))
    assert.ok(ids.includes('system_freeze'))
    assert.ok(ids.includes('peripherals'))
    assert.ok(ids.includes('no_internet'))
    assert.ok(ids.includes('other'))
  })

  it('Server Action Pure RPC Exports: app/actions/terminal.ts only exports async functions (Rule #13)', () => {
    const filePath = path.resolve(process.cwd(), 'app/actions/terminal.ts')
    const content = fs.readFileSync(filePath, 'utf8')

    // Find all export statements
    const exportMatches = content.match(/export\s+(?:async\s+function|const|let|var|function|type|interface)\s+([a-zA-Z0-9_]+)/g) || []
    for (const exp of exportMatches) {
      assert.ok(
        exp.startsWith('export async function'),
        `Forbidden non-async export found in 'use server' file: "${exp}". Adhere to Rule #13.`
      )
    }
  })

  it('Anti-Spoofing Engine: verifyTerminalAccess validates workstation and blocks mismatched pairing tokens', async () => {
    if (!dbUrl) return

    // 1. Unknown workstation should be rejected
    const unknownRes = await verifyTerminalAccess('NON_EXISTENT_STATION_9999')
    assert.equal(unknownRes.allowed, false)

    // 2. Query a seeded workstation from DB
    const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
    const wsRes = await pool.query(`SELECT id, label, pairing_token FROM public.workstations WHERE is_active = true LIMIT 1`)
    if (wsRes.rows.length === 0) {
      await pool.end()
      return
    }

    const testWs = wsRes.rows[0]

    // Set a known pairing token on test workstation
    await pool.query(`UPDATE public.workstations SET pairing_token = 'TEST-SECRET-123' WHERE id = $1`, [testWs.id])

    // Case A: Matching token should be allowed
    const validRes = await verifyTerminalAccess(testWs.label, 'TEST-SECRET-123')
    assert.equal(validRes.allowed, true)
    assert.equal(validRes.tokenMatched, true)

    // Case B: Mismatched token should be blocked by anti-spoofing lock
    const spoofedRes = await verifyTerminalAccess(testWs.label, 'WRONG-SPOOFED-TOKEN')
    assert.equal(spoofedRes.allowed, false)
    assert.ok(spoofedRes.reason?.includes('Anti-Spoofing Lock'))

    // Cleanup token
    await pool.query(`UPDATE public.workstations SET pairing_token = $1 WHERE id = $2`, [testWs.pairing_token, testWs.id])
    await pool.end()
  })

  it('Student Reporting & Cockpit Beacon: submitStudentIssueReport inserts student report and beacon alerts', async () => {
    if (!dbUrl) return

    const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
    const wsRes = await pool.query(`SELECT id, label, lab_id FROM public.workstations WHERE is_active = true LIMIT 1`)
    if (wsRes.rows.length === 0) {
      await pool.end()
      return
    }

    const testWs = wsRes.rows[0]
    const labId = testWs.lab_id || 'comp'

    // Submit report as student
    const submitRes = await submitStudentIssueReport({
      stationCode: testWs.label,
      issueTag: 'missing_software',
      title: 'VS Code Missing Python Extension',
      description: 'Cannot run practical script in laboratory session',
      studentName: 'Test Student',
      studentRoll: '99',
    })

    assert.equal(submitRes.success, true, `Report submission failed: ${submitRes.error}`)
    assert.ok(submitRes.issueId, 'Must return issueId')

    // Verify it appears in live assistance requests
    const beaconRes = await getLiveAssistanceRequests(labId)
    assert.equal(beaconRes.success, true)
    const matchingReq = beaconRes.requests.find((r) => r.id === submitRes.issueId)
    assert.ok(matchingReq, 'Student report must appear in Live Assistance Requests queue')
    assert.equal(matchingReq.studentName, 'Test Student')
    assert.equal(matchingReq.studentRoll, '99')

    // Acknowledge the request
    const ackRes = await acknowledgeAssistanceRequest(submitRes.issueId)
    assert.equal(ackRes.success, true)

    // Clean up test issue from database
    await pool.query(`DELETE FROM public.workstation_issues WHERE id = $1`, [submitRes.issueId])
    await pool.end()
  })

  it('UI Architecture: Student terminal views and cockpit alert components exist', () => {
    const studentViewPath = path.resolve(process.cwd(), 'components/terminal/student-terminal-view.tsx')
    const queueViewPath = path.resolve(process.cwd(), 'components/computer-lab/terminal-assistance-queue.tsx')
    const routePath = path.resolve(process.cwd(), 'app/terminal/[code]/page.tsx')
    const pairRoutePath = path.resolve(process.cwd(), 'app/terminal/pair/page.tsx')

    assert.ok(fs.existsSync(studentViewPath), 'StudentTerminalView component must exist')
    assert.ok(fs.existsSync(queueViewPath), 'TerminalAssistanceQueue component must exist')
    assert.ok(fs.existsSync(routePath), '/terminal/[code] route must exist')
    assert.ok(fs.existsSync(pairRoutePath), '/terminal/pair route must exist')

    const studentViewContent = fs.readFileSync(studentViewPath, 'utf8')
    assert.ok(studentViewContent.includes('TERMINAL_QUICK_ISSUES'), 'Must render quick issue chips')
    assert.ok(studentViewContent.includes('submitStudentIssueReport'), 'Must wire report submission action')
  })
})
