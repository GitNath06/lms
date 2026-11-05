import crypto from 'node:crypto'

/**
 * Institutional Terminal Token & Session Security Engine.
 * Provides HMAC-SHA256 stateless signing for 1-time handshake tickets
 * and HttpOnly workstation session cookies.
 */

function getTerminalSecret(): string {
  const secret = process.env.TERMINAL_SIGNING_SECRET || process.env.SUPABASE_JWT_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'test' || Boolean(process.env.LABSYNC_TEST_RUNNER)) {
      return 'test-terminal-signing-salt-only-for-automated-tests'
    }
    throw new Error('FATAL: TERMINAL_SIGNING_SECRET environment variable is not configured.')
  }
  return secret
}

export interface HandshakeTicketPayload {
  stationId: string
  stationCode: string
  machineGuid: string
  iat: number // issued-at timestamp in milliseconds
  exp: number // expiration timestamp in milliseconds
}

export interface TerminalSessionPayload {
  stationId: string
  stationCode: string
  machineGuid: string
  issuedAt: number
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  return Buffer.from(base64, 'base64').toString('utf8')
}

function sign(payloadStr: string): string {
  return crypto
    .createHmac('sha256', getTerminalSecret())
    .update(payloadStr)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * Creates a stateless 60-second single-use handshake ticket.
 */
export function createHandshakeTicket(
  workstation: {
    id: string
    label: string
    machine_guid: string
  },
  ttlSeconds: number = 60
): string {
  const now = Date.now()
  const payload: HandshakeTicketPayload = {
    stationId: workstation.id,
    stationCode: workstation.label,
    machineGuid: workstation.machine_guid,
    iat: now,
    exp: now + ttlSeconds * 1000, // configurable single-use window (default 60s)
  }

  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signature = sign(encodedPayload)
  return `${encodedPayload}.${signature}`
}

// Anti-replay cache: tracks redeemed ticket signatures for their 60s window
const REDEEMED_TICKETS = new Map<string, number>()

function pruneExpiredRedeemedTickets() {
  const now = Date.now()
  for (const [sig, exp] of REDEEMED_TICKETS.entries()) {
    if (now > exp) {
      REDEEMED_TICKETS.delete(sig)
    }
  }
}

/**
 * Verifies a 60-second handshake ticket.
 * Enforces HMAC timing-safe validation, expiration check, and anti-replay defense.
 */
export function verifyHandshakeTicket(ticket: string): {
  valid: boolean
  payload?: HandshakeTicketPayload
  reason?: string
} {
  if (!ticket || !ticket.includes('.')) {
    return { valid: false, reason: 'Malformed ticket format' }
  }

  const [encodedPayload, receivedSignature] = ticket.split('.')
  if (!encodedPayload || !receivedSignature) {
    return { valid: false, reason: 'Missing payload or signature' }
  }

  const expectedSignature = sign(encodedPayload)

  // Timing-safe signature comparison
  const receivedBuf = Buffer.from(receivedSignature)
  const expectedBuf = Buffer.from(expectedSignature)

  if (
    receivedBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(receivedBuf, expectedBuf)
  ) {
    return { valid: false, reason: 'Invalid cryptographic signature' }
  }

  // Anti-replay check: ensure ticket has not already been redeemed
  pruneExpiredRedeemedTickets()
  if (REDEEMED_TICKETS.has(receivedSignature)) {
    return { valid: false, reason: 'Single-use handshake ticket has already been redeemed' }
  }

  try {
    const jsonStr = base64UrlDecode(encodedPayload)
    const payload: HandshakeTicketPayload = JSON.parse(jsonStr)

    // Check expiration
    if (Date.now() > payload.exp) {
      return { valid: false, reason: 'Handshake ticket has expired (valid for 60s)' }
    }

    // Mark ticket as redeemed
    REDEEMED_TICKETS.set(receivedSignature, payload.exp)

    // Store in public.rate_limit_events so replay protection works across serverless instances
    try {
      const { getPgPool } = require('@/lib/db')
      const pool = getPgPool()
      pool
        .query(
          `INSERT INTO public.rate_limit_events (key, action, created_at)
           VALUES ($1, 'handshake_redeemed', NOW())`,
          [`ticket:${receivedSignature}`]
        )
        .catch(() => {})
    } catch {
      // Graceful fallback for unit tests or offline DB
    }

    return { valid: true, payload }
  } catch (err: any) {
    return { valid: false, reason: `Failed to decode payload: ${err.message}` }
  }
}

/**
 * Checks whether a ticket signature has already been redeemed in PostgreSQL (cross-serverless protection).
 */
export async function isHandshakeSignatureRedeemedInDb(signature: string): Promise<boolean> {
  try {
    const { getPgPool } = await import('@/lib/db')
    const pool = getPgPool()
    const res = await pool.query(
      `SELECT id FROM public.rate_limit_events 
       WHERE key = $1 AND action = 'handshake_redeemed' 
         AND created_at > NOW() - INTERVAL '2 minutes' 
       LIMIT 1;`,
      [`ticket:${signature}`]
    )
    return res.rows.length > 0
  } catch {
    return false
  }
}

/**
 * Creates a signed HttpOnly session token representing the physical workstation.
 */
export function createTerminalSessionToken(workstation: {
  id: string
  label: string
  machine_guid: string
}): string {
  const payload: TerminalSessionPayload = {
    stationId: workstation.id,
    stationCode: workstation.label,
    machineGuid: workstation.machine_guid,
    issuedAt: Date.now(),
  }

  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signature = sign(encodedPayload)
  return `${encodedPayload}.${signature}`
}

/**
 * Verifies a workstation session token extracted from HttpOnly cookie.
 */
export function verifyTerminalSessionToken(token: string): {
  valid: boolean
  payload?: TerminalSessionPayload
  reason?: string
} {
  if (!token || !token.includes('.')) {
    return { valid: false, reason: 'Malformed session token' }
  }

  const [encodedPayload, receivedSignature] = token.split('.')
  if (!encodedPayload || !receivedSignature) {
    return { valid: false, reason: 'Missing payload or signature' }
  }

  const expectedSignature = sign(encodedPayload)
  const receivedBuf = Buffer.from(receivedSignature)
  const expectedBuf = Buffer.from(expectedSignature)

  if (
    receivedBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(receivedBuf, expectedBuf)
  ) {
    return { valid: false, reason: 'Invalid session signature' }
  }

  try {
    const jsonStr = base64UrlDecode(encodedPayload)
    const payload: TerminalSessionPayload = JSON.parse(jsonStr)
    return { valid: true, payload }
  } catch (err: any) {
    return { valid: false, reason: `Failed to decode session payload: ${err.message}` }
  }
}

/**
 * Timing-safe string comparison for composite hardware GUIDs.
 */
export function safeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}
