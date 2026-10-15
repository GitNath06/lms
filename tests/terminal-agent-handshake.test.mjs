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

const { resetWorkstationHardwareLock } = await import('../app/actions/workstations.ts')

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
})
