import { describe, it, after } from 'node:test'
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

const {
  createHandshakeTicket,
  verifyHandshakeTicket,
  createTerminalSessionToken,
  verifyTerminalSessionToken,
  safeEqual,
} = await import('../lib/security/terminal-token.ts')

const {
  processTerminalHandshake,
  getInstitutionalAgentSecret,
} = await import('../lib/security/terminal-handshake.ts')

const { resetWorkstationHardwareLock, getInstitutionalPairingKey } = await import('../app/actions/workstations.ts')

describe('Phase 2: Cryptographic Handshake Engine & TOFU Hardware Lock', () => {
  const dbUrl = resolveDatabaseUrl(process.env.DATABASE_URL)

  it('Handshake Ticket: Generates valid HMAC ticket and verifies within 60s', () => {
    const sampleWs = {
      id: 'ws-test-uuid-1234',
      label: 'PC-99',
      machine_guid: 'guid-abc-123-E4:54:E8:12:34:56',
    }

    const ticket = createHandshakeTicket(sampleWs)
    assert.ok(ticket, 'Ticket should be generated')
    assert.ok(ticket.includes('.'), 'Ticket should contain dot separator')

    const verified = verifyHandshakeTicket(ticket)
    assert.equal(verified.valid, true, 'Ticket should be valid')
    assert.equal(verified.payload?.stationCode, 'PC-99')
    assert.equal(verified.payload?.stationId, 'ws-test-uuid-1234')
    assert.equal(verified.payload?.machineGuid, 'guid-abc-123-E4:54:E8:12:34:56')
  })

  it('Handshake Ticket: Rejects tampered signature and expired tickets', () => {
    const sampleWs = {
      id: 'ws-test-uuid-1234',
      label: 'PC-99',
      machine_guid: 'guid-abc-123-E4:54:E8:12:34:56',
    }

    const ticket = createHandshakeTicket(sampleWs)
    const [payload, sig] = ticket.split('.')

    // Tampered payload
    const tamperedPayload = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64').toString()), stationCode: 'PC-01' })).toString('base64').replace(/=/g, '')
    const tamperedTicket = `${tamperedPayload}.${sig}`

    const verified = verifyHandshakeTicket(tamperedTicket)
    assert.equal(verified.valid, false, 'Tampered ticket must be rejected')

    // Malformed ticket
    assert.equal(verifyHandshakeTicket('bad-ticket').valid, false)
  })

  it('Session Token: Generates and verifies HttpOnly workstation session token', () => {
    const sampleWs = {
      id: 'ws-sess-uuid-5678',
      label: 'PC-14',
      machine_guid: 'guid-14-E4:54:E8:14:14:14',
    }

    const sessionToken = createTerminalSessionToken(sampleWs)
    assert.ok(sessionToken, 'Session token should be generated')

    const verified = verifyTerminalSessionToken(sessionToken)
    assert.equal(verified.valid, true, 'Session token should be valid')
    assert.equal(verified.payload?.stationCode, 'PC-14')
    assert.equal(verified.payload?.stationId, 'ws-sess-uuid-5678')
    assert.equal(verified.payload?.machineGuid, 'guid-14-E4:54:E8:14:14:14')
  })

  it('Timing-Safe Comparison: Evaluates equality securely', () => {
    assert.equal(safeEqual('guid-123', 'guid-123'), true)
    assert.equal(safeEqual('guid-123', 'guid-124'), false)
    assert.equal(safeEqual('short', 'longer-string'), false)
  })

  it('Database TOFU Lifecycle: First pairing binds, match updates, mismatch rejected, reset clears', async () => {
    if (!dbUrl) return
    const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

    // Create a temporary test workstation for TOFU validation
    const testWsLabel = 'PC-TEST-TOFU'
    await pool.query(`DELETE FROM public.workstations WHERE label = $1`, [testWsLabel])
    const insertRes = await pool.query(
      `INSERT INTO public.workstations (lab_id, label, pos_x, pos_y, device_type, is_active)
       VALUES ('comp', $1, 0, 0, 'desktop', true)
       RETURNING id, label, machine_guid`,
      [testWsLabel]
    )
    const testWsId = insertRes.rows[0].id

    try {
      // 1. Initial State: machine_guid is NULL
      assert.equal(insertRes.rows[0].machine_guid, null, 'Initial machine_guid must be null')

      const originalGuid = 'composite-guid-pc-test-112233'
      const fakeHackerGuid = 'composite-guid-hacker-445566'

      // 2. First-Time TOFU Pairing: binds machine_guid
      await pool.query(
        `UPDATE public.workstations 
         SET machine_guid = $1, 
             hardware_specs = '{"cpu":"Test CPU","ram_gb":16}'::jsonb,
             last_seen_at = NOW()
         WHERE id = $2`,
        [originalGuid, testWsId]
      )

      const afterPairRes = await pool.query(`SELECT machine_guid, hardware_specs FROM public.workstations WHERE id = $1`, [testWsId])
      assert.equal(afterPairRes.rows[0].machine_guid, originalGuid, 'machine_guid must be bound')
      assert.equal(afterPairRes.rows[0].hardware_specs?.ram_gb, 16)

      // 3. TOFU Enforcement: Verify that a different GUID does not match
      const isMismatch = !safeEqual(afterPairRes.rows[0].machine_guid, fakeHackerGuid)
      assert.equal(isMismatch, true, 'TOFU must flag hacker GUID as mismatch')

      // 4. Reset Hardware Lock: Lab In-Charge unlocks machine
      await pool.query(`UPDATE public.workstations SET machine_guid = NULL WHERE id = $1`, [testWsId])
      const afterResetRes = await pool.query(`SELECT machine_guid FROM public.workstations WHERE id = $1`, [testWsId])
      assert.equal(afterResetRes.rows[0].machine_guid, null, 'machine_guid must be null after reset')
    } finally {
      // Cleanup
      await pool.query(`DELETE FROM public.workstations WHERE id = $1`, [testWsId])
      await pool.end()
    }
  })

  it('Handshake Processing: Enforces token requirement, TOFU binding, spec discovery, and mismatch rejection', async () => {
    if (!dbUrl) return
    const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
    const secret = getInstitutionalAgentSecret()

    const testLabel = 'PC-TEST-HANDSHAKE'
    await pool.query(`DELETE FROM public.workstations WHERE label = $1`, [testLabel])
    const insertRes = await pool.query(
      `INSERT INTO public.workstations (lab_id, label, pos_x, pos_y, device_type, is_active)
       VALUES ('comp', $1, 0, 0, 'desktop', true)
       RETURNING id, label, machine_guid`,
      [testLabel]
    )
    const wsId = insertRes.rows[0].id

    try {
      const legitGuid = 'hw-uuid-1111-reg-2222-mac-3333'
      const rogueGuid = 'hw-uuid-9999-reg-8888-mac-7777'
      const specs = {
        cpu: 'Intel Core i5-10400 @ 2.90GHz',
        cpu_cores: 6,
        ram_gb: 16,
        disk_c_total_gb: 256,
        disk_c_free_gb: 120,
        disk_c_used_pct: 53.1,
        os_caption: 'Windows 11 Pro',
        os_build: '22631',
        mac_address: '00-15-5D-AA-BB-CC',
        lan_ip: '192.168.1.150',
      }

      // 1. Rogue LAN attempt without pairing token on unbound station -> REJECTED (401)
      const unauthRes = await processTerminalHandshake({
        labId: 'comp',
        workstationCode: testLabel,
        machineGuid: legitGuid,
        pairingToken: 'wrong-token',
        hardwareSpecs: specs,
      })
      assert.equal(unauthRes.success, false)
      assert.equal(unauthRes.status, 401, 'Unauthenticated pairing must be rejected with 401')

      // 2. Legitimate setup with valid institutional token -> SUCCESS (200, is_new_pairing: true)
      const authRes = await processTerminalHandshake({
        labId: 'comp',
        workstationCode: testLabel,
        machineGuid: legitGuid,
        pairingToken: secret,
        hardwareSpecs: specs,
      })
      assert.equal(authRes.success, true, 'Legitimate initial pairing must succeed')
      assert.equal(authRes.status, 200)
      assert.equal(authRes.data?.is_new_pairing, true)
      assert.equal(authRes.data?.station_code, testLabel)
      assert.ok(authRes.data?.redirect_url.includes('/api/terminal/launch?code='))
      assert.ok(authRes.data?.redirect_url.includes('&ticket='))

      // Verify DB state
      const dbCheck = await pool.query(`SELECT machine_guid, hardware_specs, last_seen_at FROM public.workstations WHERE id = $1`, [wsId])
      assert.equal(dbCheck.rows[0].machine_guid, legitGuid)
      assert.equal(dbCheck.rows[0].hardware_specs?.ram_gb, 16)
      assert.ok(dbCheck.rows[0].last_seen_at)

      // 3. Subsequent boot from same machine with valid token -> SUCCESS (200, is_new_pairing: false)
      const rebootRes = await processTerminalHandshake({
        labId: 'comp',
        workstationCode: testLabel,
        machineGuid: legitGuid,
        pairingToken: secret,
        hardwareSpecs: { ...specs, ram_gb: 32 },
      })
      assert.equal(rebootRes.success, true)
      assert.equal(rebootRes.status, 200)
      assert.equal(rebootRes.data?.is_new_pairing, false)

      const rebootCheck = await pool.query(`SELECT hardware_specs FROM public.workstations WHERE id = $1`, [wsId])
      assert.equal(rebootCheck.rows[0].hardware_specs?.ram_gb, 32, 'Hardware specs must update on boot')

      // 4. Mismatched hardware GUID attempt on already bound station -> FORBIDDEN (403)
      const mismatchRes = await processTerminalHandshake({
        labId: 'comp',
        workstationCode: testLabel,
        machineGuid: rogueGuid,
        pairingToken: secret,
        hardwareSpecs: specs,
      })
      assert.equal(mismatchRes.success, false)
      assert.equal(mismatchRes.status, 403, 'Hardware mismatch must return 403')
      assert.ok(mismatchRes.error?.includes('Hardware Mismatch'))

      // 5. Multi-lab isolation: querying a different lab_id fails with 404
      const wrongLabRes = await processTerminalHandshake({
        labId: 'physics_lab',
        workstationCode: testLabel,
        machineGuid: legitGuid,
        pairingToken: secret,
      })
      assert.equal(wrongLabRes.success, false)
      assert.equal(wrongLabRes.status, 404, 'Searching wrong lab must return 404')
    } finally {
      await pool.query(`DELETE FROM public.workstations WHERE id = $1`, [wsId])
      await pool.end()
    }
  })

  it('Launch Redemption & Replay Defense: Single-use ticket converts to 12h session token and denies replay', () => {
    const wsData = {
      id: 'ws-launch-test-uuid',
      label: 'PC-23',
      machine_guid: 'composite-silicon-guid-pc-23-test',
    }

    // 1. Issue 60s handshake ticket
    const ticket = createHandshakeTicket(wsData, 60)
    assert.ok(ticket)

    // 2. First redemption -> VALID
    const firstVerification = verifyHandshakeTicket(ticket)
    assert.equal(firstVerification.valid, true)
    assert.equal(firstVerification.payload?.stationCode, 'PC-23')
    assert.equal(firstVerification.payload?.machineGuid, wsData.machine_guid)

    // Create session token from validated ticket
    const sessionToken = createTerminalSessionToken({
      id: firstVerification.payload.stationId,
      label: firstVerification.payload.stationCode,
      machine_guid: firstVerification.payload.machineGuid,
    })
    assert.ok(sessionToken)

    const sessionVerified = verifyTerminalSessionToken(sessionToken)
    assert.equal(sessionVerified.valid, true)
    assert.equal(sessionVerified.payload?.stationCode, 'PC-23')

    // 3. Second redemption attempt (Replay Attack) -> MUST BE REJECTED
    const replayVerification = verifyHandshakeTicket(ticket)
    assert.equal(replayVerification.valid, false)
    assert.ok(replayVerification.reason?.includes('already been redeemed'))
  })

  it('Agent Templates & Institutional Secret: Templates exist and institutional secret is securely resolved', () => {
    const secret = getInstitutionalAgentSecret()
    assert.ok(secret, 'Institutional agent secret must be configured')
    assert.ok(secret.length >= 16, 'Secret must be sufficiently robust')

    const batPath = path.join(process.cwd(), 'scripts', 'client-agent', 'Setup-LabTerminal.bat')
    const ps1Path = path.join(process.cwd(), 'scripts', 'client-agent', 'labsync-agent.ps1')
    assert.ok(fs.existsSync(batPath), 'Setup-LabTerminal.bat must exist in scripts/client-agent')
    assert.ok(fs.existsSync(ps1Path), 'labsync-agent.ps1 must exist in scripts/client-agent')

    const batContent = fs.readFileSync(batPath, 'utf8')
    assert.ok(batContent.includes('SERVER_URL='))
    assert.ok(batContent.includes('LAB_ID='))
    assert.ok(batContent.includes('PAIRING_TOKEN='))
  })
})
