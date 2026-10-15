import crypto from 'node:crypto'

/**
 * Institutional Terminal Token & Session Security Engine.
 * Provides HMAC-SHA256 stateless signing for 1-time handshake tickets
 * and HttpOnly workstation session cookies.
 */

const SECRET_KEY =
  process.env.TERMINAL_SIGNING_SECRET ||
  process.env.SUPABASE_JWT_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  'labsync-lims-default-terminal-signing-salt-2083'

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
    .createHmac('sha256', SECRET_KEY)
    .update(payloadStr)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * Creates a stateless 60-second single-use handshake ticket.
 */
export function createHandshakeTicket(workstation: {
  id: string
  label: string
  machine_guid: string
}): string {
  const now = Date.now()
  const payload: HandshakeTicketPayload = {
    stationId: workstation.id,
    stationCode: workstation.label,
    machineGuid: workstation.machine_guid,
    iat: now,
    exp: now + 60 * 1000, // 60 seconds single-use window
  }

  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signature = sign(encodedPayload)
  return `${encodedPayload}.${signature}`
}

/**
 * Verifies a 60-second handshake ticket.
 * Enforces HMAC timing-safe validation and expiration check.
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

  try {
    const jsonStr = base64UrlDecode(encodedPayload)
    const payload: HandshakeTicketPayload = JSON.parse(jsonStr)

    // Check expiration
    if (Date.now() > payload.exp) {
      return { valid: false, reason: 'Handshake ticket has expired (valid for 60s)' }
    }

    return { valid: true, payload }
  } catch (err: any) {
    return { valid: false, reason: `Failed to decode payload: ${err.message}` }
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
