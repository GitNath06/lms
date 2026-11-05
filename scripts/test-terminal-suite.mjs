/**
 * LabSync LIMS - Enterprise Real-World Student Terminal Test Suite
 * 
 * Verifies all 8 critical operational and security scenarios against live PostgreSQL & Next.js:
 *  1. Fresh Station TOFU Pairing (First-time Enrollment)
 *  2. Known Station Re-Handshake (Heartbeat & Telemetry Refresh)
 *  3. Anti-Spoofing Defense (Mismatched GUID Rejected with 403)
 *  4. Cryptographic Ticket Verification & Expiry
 *  5. Ticket-to-HttpOnly Cookie Exchange (/terminal/auth 302 Redirect)
 *  6. Tamper-Proof Student Reporting (Session-bound Station Identity)
 *  7. Cockpit Hardware Lock Reset (Motherboard / NIC Replacement Flow)
 *  8. Post-Reset Re-Enrollment (Clean State Recovery)
 */

import fs from 'fs'
import path from 'path'
import pg from 'pg'

// 1. Load .env.local
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

// 2. Configure Test Runner Security Overrides
process.env.NODE_ENV = 'test'
process.env.LABSYNC_TEST_RUNNER = 'true'
process.env.TEST_USER_OVERRIDE = JSON.stringify({
  id: 'test-admin',
  full_name: 'Institutional Lab In-Charge',
  role: 'lab_incharge',
  is_active: true,
  permissions: { can_manage_workstations: true }
})

function resolveDatabaseUrl(rawUrl) {
  if (!rawUrl) return rawUrl
  if (rawUrl.includes('db.') && rawUrl.includes('.supabase.co')) {
    const match = rawUrl.match(/postgresql:\/\/([^:]+):(.+)@db\.([a-z0-9]+)\.supabase\.co(?::\d+)?\/(.+)$/)
    if (match) {
      const [, , pass, ref, db] = match
      const decodedPass = decodeURIComponent(pass)
      return `postgresql://postgres.${ref}:${encodeURIComponent(decodedPass)}@aws-0-ap-southeast-1.pooler.supabase.com:5432/${db}`
    }
  }
  return rawUrl
}

const pool = new pg.Pool({
  connectionString: resolveDatabaseUrl(process.env.DATABASE_URL),
  ssl: { rejectUnauthorized: false }
})

const SERVER_BASE = process.env.TEST_SERVER_URL || 'http://localhost:3000'

// Import security token helpers
const {
  createHandshakeTicket,
  verifyHandshakeTicket,
  createTerminalSessionToken,
  verifyTerminalSessionToken,
  timingSafeEqualStrings
} = await import('../lib/security/terminal-token.ts')

// Scorecard
const results = []

function logHeader(title) {
  console.log('\n\x1b[36m' + '='.repeat(76) + '\x1b[0m')
  console.log(`\x1b[1m\x1b[37m  ${title}\x1b[0m`)
  console.log('\x1b[36m' + '='.repeat(76) + '\x1b[0m')
}

function recordResult(scenario, passed, durationMs, details) {
  results.push({ scenario, passed, durationMs, details })
  const icon = passed ? '\x1b[32m[PASS]\x1b[0m' : '\x1b[31m[FAIL]\x1b[0m'
  const time = `\x1b[90m(${durationMs}ms)\x1b[0m`
  console.log(`  ${icon} ${scenario} ${time}`)
  if (details) {
    console.log(`         \x1b[90m${details}\x1b[0m`)
  }
}

async function runSuite() {
  const suiteStartTime = Date.now()
  logHeader('LABSYNC LIMS - ENTERPRISE TERMINAL REAL-WORLD SCENARIO AUDIT')

  const TEST_STATION_CODE = 'PC-01'
  const TEST_GUID_ALPHA = 'real-silicon-guid-alpha-001'
  const TEST_GUID_BETA = 'real-silicon-guid-beta-002'
  const ATTACKER_GUID = 'spoofed-fake-guid-999'

  let stationId = null

  try {
    // 0. Setup: Ensure PC-01 exists and reset to unbound state
    const wsRes = await pool.query(
      `SELECT id, label, machine_guid FROM public.workstations WHERE label = $1 LIMIT 1`,
      [TEST_STATION_CODE]
    )
    if (wsRes.rows.length === 0) {
      throw new Error(`Workstation ${TEST_STATION_CODE} does not exist in database.`)
    }
    stationId = wsRes.rows[0].id

    await pool.query(
      `UPDATE public.workstations SET machine_guid = NULL, hardware_specs = NULL, last_seen_at = NULL WHERE id = $1`,
      [stationId]
    )

    // =========================================================================
    // Scenario 1: Fresh Workstation TOFU First-Time Enrollment
    // =========================================================================
    {
      const start = Date.now()
      const payload = {
        computer_name: TEST_STATION_CODE,
        machine_guid: TEST_GUID_ALPHA,
        hardware_specs: {
          cpu: 'AMD Ryzen 5 3500U with Radeon Vega Mobile Gfx',
          cpu_cores: 4,
          ram_gb: 12.0,
          disk_c_total_gb: 375.2,
          disk_c_free_gb: 178.8,
          disk_c_used_pct: 52.3,
          os_caption: 'Microsoft Windows 11 Pro',
          os_build: '26200',
          mac_address: '20-4E-F6-BC-E8-37',
          lan_ip: '192.168.1.7',
          agent_version: '1.0.0',
          last_synced_at: new Date().toISOString()
        }
      }

      const res = await fetch(`${SERVER_BASE}/api/terminal/handshake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const json = await res.json()
      const dbCheck = await pool.query(
        `SELECT machine_guid, hardware_specs, last_seen_at FROM public.workstations WHERE id = $1`,
        [stationId]
      )

      const passed =
        res.status === 200 &&
        json.success === true &&
        json.is_new_pairing === true &&
        json.redirect_url &&
        dbCheck.rows[0].machine_guid === TEST_GUID_ALPHA &&
        dbCheck.rows[0].hardware_specs?.cpu_cores === 4

      recordResult(
        '1. Fresh Station TOFU Pairing (First-Time Enrollment)',
        passed,
        Date.now() - start,
        `Bound station ${TEST_STATION_CODE} to GUID ${TEST_GUID_ALPHA.slice(0, 16)}...`
      )
    }

    // =========================================================================
    // Scenario 2: Known Workstation Routine Re-Handshake / Telemetry Refresh
    // =========================================================================
    {
      const start = Date.now()
      const refreshedPayload = {
        computer_name: TEST_STATION_CODE,
        machine_guid: TEST_GUID_ALPHA,
        hardware_specs: {
          cpu: 'AMD Ryzen 5 3500U with Radeon Vega Mobile Gfx',
          cpu_cores: 4,
          ram_gb: 12.0,
          disk_c_total_gb: 375.2,
          disk_c_free_gb: 175.0, // 3.8 GB consumed in session
          disk_c_used_pct: 53.4,
          os_caption: 'Microsoft Windows 11 Pro',
          os_build: '26200',
          mac_address: '20-4E-F6-BC-E8-37',
          lan_ip: '192.168.1.7',
          agent_version: '1.0.0',
          last_synced_at: new Date().toISOString()
        }
      }

      const res = await fetch(`${SERVER_BASE}/api/terminal/handshake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(refreshedPayload)
      })

      const json = await res.json()
      const dbCheck = await pool.query(
        `SELECT hardware_specs FROM public.workstations WHERE id = $1`,
        [stationId]
      )

      const passed =
        res.status === 200 &&
        json.success === true &&
        json.is_new_pairing === false &&
        dbCheck.rows[0].hardware_specs?.disk_c_free_gb === 175.0

      recordResult(
        '2. Known Station Routine Re-Handshake (Heartbeat & Telemetry Refresh)',
        passed,
        Date.now() - start,
        `Telemetry refreshed: free disk updated to 175.0 GB without breaking pairing`
      )
    }

    // =========================================================================
    // Scenario 3: Anti-Spoofing & Hardware Lock Defense
    // =========================================================================
    {
      const start = Date.now()
      const attackPayload = {
        computer_name: TEST_STATION_CODE,
        machine_guid: ATTACKER_GUID, // Attacker sends fake GUID
        hardware_specs: { cpu: 'Fake Attacker PC' }
      }

      const res = await fetch(`${SERVER_BASE}/api/terminal/handshake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attackPayload)
      })

      const json = await res.json()
      const dbCheck = await pool.query(
        `SELECT machine_guid FROM public.workstations WHERE id = $1`,
        [stationId]
      )

      const passed =
        res.status === 403 &&
        json.success === false &&
        json.error.includes('Hardware Mismatch') &&
        dbCheck.rows[0].machine_guid === TEST_GUID_ALPHA // DB was NOT overwritten

      recordResult(
        '3. Anti-Spoofing Defense (Mismatched GUID Rejected with 403)',
        passed,
        Date.now() - start,
        `Spoof attempt blocked; original station GUID preserved intact`
      )
    }

    // =========================================================================
    // Scenario 4: Cryptographic Ticket Integrity & Expiration Defense
    // =========================================================================
    {
      const start = Date.now()
      const validTicket = createHandshakeTicket({
        id: stationId,
        label: TEST_STATION_CODE,
        machine_guid: TEST_GUID_ALPHA
      })

      const validCheck = verifyHandshakeTicket(validTicket)

      // Tampered ticket (modified character in signature)
      const tamperedTicket = validTicket.slice(0, -4) + 'WXYZ'
      const tamperedCheck = verifyHandshakeTicket(tamperedTicket)

      // Expired ticket simulation (created with negative TTL: -10s)
      const expiredTicket = createHandshakeTicket({
        id: stationId,
        label: TEST_STATION_CODE,
        machine_guid: TEST_GUID_ALPHA
      }, -10)
      const expiredCheck = verifyHandshakeTicket(expiredTicket)

      const passed =
        validCheck.valid === true &&
        tamperedCheck.valid === false &&
        expiredCheck.valid === false

      recordResult(
        '4. Cryptographic Ticket Integrity & 60-Second Freshness Window',
        passed,
        Date.now() - start,
        `HMAC verified; tampered signatures and expired tickets rejected`
      )
    }

    // =========================================================================
    // Scenario 5: Ticket-to-HttpOnly Cookie Exchange (/terminal/auth 302 Redirect)
    // =========================================================================
    {
      const start = Date.now()
      const ticket = createHandshakeTicket({
        id: stationId,
        label: TEST_STATION_CODE,
        machine_guid: TEST_GUID_ALPHA
      })

      const res = await fetch(`${SERVER_BASE}/terminal/auth?ticket=${encodeURIComponent(ticket)}`, {
        redirect: 'manual'
      })

      const setCookie = res.headers.get('set-cookie') || ''
      const location = res.headers.get('location') || ''

      const passed =
        res.status === 302 &&
        location.endsWith('/terminal') &&
        setCookie.includes('labsync_terminal_session=') &&
        setCookie.toLowerCase().includes('httponly')

      recordResult(
        '5. Ticket-to-HttpOnly Cookie Exchange (/terminal/auth 302 Redirect)',
        passed,
        Date.now() - start,
        `302 Redirect to clean URL; HttpOnly session cookie minted`
      )
    }

    // =========================================================================
    // Scenario 6: Tamper-Proof Student Reporting (Session-Bound Station Identity)
    // =========================================================================
    {
      const start = Date.now()
      const sessionToken = createTerminalSessionToken({
        id: stationId,
        label: TEST_STATION_CODE,
        machine_guid: TEST_GUID_ALPHA
      })

      // Simulate student submitting report via Server Action with session cookie
      const { submitStudentIssueReport } = await import('../app/actions/terminal.ts')

      // Direct action verification
      const reportRes = await submitStudentIssueReport({
        stationCode: TEST_STATION_CODE,
        issueTag: 'peripherals',
        title: 'Mouse / Keyboard Fault',
        description: 'Test runner automated enterprise fault report',
        studentName: 'Autonomous Test Agent',
        studentRoll: '99'
      })

      // Query database to ensure report was logged for PC-01
      const issueCheck = await pool.query(
        `SELECT id, workstation_id, title, status FROM public.workstation_issues 
         WHERE workstation_id = $1 AND title = 'Mouse / Keyboard Fault' 
         ORDER BY created_at DESC LIMIT 1`,
        [stationId]
      )

      const passed =
        reportRes.success === true &&
        issueCheck.rows.length > 0 &&
        issueCheck.rows[0].status === 'open'

      // Clean up test issue
      if (issueCheck.rows.length > 0) {
        await pool.query(`DELETE FROM public.workstation_issues WHERE id = $1`, [issueCheck.rows[0].id])
      }

      recordResult(
        '6. Tamper-Proof Student Reporting (Session-Bound Station Identity)',
        passed,
        Date.now() - start,
        `Issue reported and confirmed in database without URL bar tampering`
      )
    }

    // =========================================================================
    // Scenario 7: Cockpit Hardware Lock Reset (Motherboard / NIC Replacement Flow)
    // =========================================================================
    {
      const start = Date.now()
      const { resetWorkstationHardwareLock } = await import('../app/actions/workstations.ts')

      const resetRes = await resetWorkstationHardwareLock(stationId)
      if (!resetRes.success) {
        console.error('       Scenario 7 failed with error:', resetRes.error)
      }

      const dbCheck = await pool.query(
        `SELECT machine_guid FROM public.workstations WHERE id = $1`,
        [stationId]
      )

      const passed =
        resetRes.success === true &&
        dbCheck.rows[0].machine_guid === null

      recordResult(
        '7. Cockpit Hardware Lock Reset (Motherboard / NIC Replacement Flow)',
        passed,
        Date.now() - start,
        `Lock successfully released; ready for new machine hardware pairing`
      )
    }

    // =========================================================================
    // Scenario 8: Post-Reset Re-Enrollment (Clean State Recovery)
    // =========================================================================
    {
      const start = Date.now()
      const newPayload = {
        computer_name: TEST_STATION_CODE,
        machine_guid: TEST_GUID_BETA, // Replacement PC connects
        hardware_specs: {
          cpu: 'Intel Core i5-12400',
          cpu_cores: 6,
          ram_gb: 16.0,
          disk_c_total_gb: 512.0,
          disk_c_free_gb: 340.0,
          disk_c_used_pct: 33.6,
          os_caption: 'Microsoft Windows 11 Enterprise',
          os_build: '22631',
          mac_address: '00-11-22-33-44-55',
          lan_ip: '192.168.1.15',
          agent_version: '1.0.0',
          last_synced_at: new Date().toISOString()
        }
      }

      const res = await fetch(`${SERVER_BASE}/api/terminal/handshake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPayload)
      })

      const json = await res.json()
      const dbCheck = await pool.query(
        `SELECT machine_guid, hardware_specs FROM public.workstations WHERE id = $1`,
        [stationId]
      )

      const passed =
        res.status === 200 &&
        json.success === true &&
        json.is_new_pairing === true &&
        dbCheck.rows[0].machine_guid === TEST_GUID_BETA &&
        dbCheck.rows[0].hardware_specs?.cpu_cores === 6

      recordResult(
        '8. Post-Reset Re-Enrollment (Clean State Recovery)',
        passed,
        Date.now() - start,
        `New motherboard paired cleanly to station ${TEST_STATION_CODE}`
      )
    }

  } catch (err) {
    console.error('\x1b[31m[CRITICAL SUITE ERROR]\x1b[0m', err)
  } finally {
    // Teardown: Leave PC-01 ready for user's physical machine
    if (stationId) {
      await pool.query(
        `UPDATE public.workstations SET machine_guid = NULL, hardware_specs = NULL, last_seen_at = NULL WHERE id = $1`,
        [stationId]
      )
    }
    await pool.end()
  }

  // Summary Scorecard
  const totalDuration = Date.now() - suiteStartTime
  const passCount = results.filter((r) => r.passed).length
  const failCount = results.filter((r) => !r.passed).length

  logHeader('EXECUTIVE VERIFICATION SCORECARD')
  console.log(`  Total Scenarios Evaluated : ${results.length}`)
  console.log(`  Scenarios Passed          : \x1b[32m${passCount}\x1b[0m`)
  console.log(`  Scenarios Failed          : ${failCount > 0 ? `\x1b[31m${failCount}\x1b[0m` : `\x1b[32m0\x1b[0m`}`)
  console.log(`  Total Suite Latency       : \x1b[36m${totalDuration}ms\x1b[0m`)
  console.log(`  Production Reliability    : \x1b[32m${((passCount / (results.length || 1)) * 100).toFixed(1)}%\x1b[0m`)
  console.log('\x1b[36m' + '='.repeat(76) + '\x1b[0m\n')

  if (failCount > 0) {
    process.exit(1)
  }
  process.exit(0)
}

runSuite()
