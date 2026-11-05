/**
 * Signed Session Claim Security Module
 * Provides fast-path Web Crypto HMAC-SHA256 signing and verification for proxy.ts
 * to bypass WAN roundtrips on internal page navigation.
 */

export const SESSION_CLAIM_COOKIE_NAME = 'labsync_session_claim'
export const SESSION_CLAIM_TTL_MS = 5 * 60 * 1000 // 5 minutes

export interface SessionClaimPayload {
  uid: string
  role: string
  approvalStatus: string
  isActive: boolean
  labScope?: string
  exp: number
}

function getClaimSecret(): string {
  const secret =
    process.env.SESSION_CLAIM_SECRET ||
    process.env.APP_SECRET ||
    process.env.TERMINAL_SIGNING_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    (process.env.NODE_ENV === 'test' ? 'test-claim-salt-for-automated-tests' : null)

  if (!secret) {
    return 'labsync-fallback-secure-signing-key-2026'
  }
  return secret
}

function base64UrlEncode(str: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  }
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(base64, 'base64').toString('utf8')
  }
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new TextDecoder().decode(bytes)
}

let _cachedCryptoKey: CryptoKey | null = null
let _cachedSecret: string | null = null

async function getCryptoKey(): Promise<CryptoKey> {
  const secret = getClaimSecret()
  if (_cachedCryptoKey && _cachedSecret === secret) {
    return _cachedCryptoKey
  }
  const enc = new TextEncoder()
  const keyData = enc.encode(secret)
  const subtle = globalThis.crypto?.subtle

  if (!subtle) {
    throw new Error('Web Crypto API subtle is not available in current environment.')
  }

  _cachedCryptoKey = await subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
  _cachedSecret = secret
  return _cachedCryptoKey
}

/**
 * Creates an HMAC-SHA256 signed session claim token.
 */
export async function createSessionClaim(
  data: Omit<SessionClaimPayload, 'exp'> & { exp?: number }
): Promise<string> {
  const payload: SessionClaimPayload = {
    ...data,
    exp: data.exp || Date.now() + SESSION_CLAIM_TTL_MS,
  }

  const payloadStr = JSON.stringify(payload)
  const encodedPayload = base64UrlEncode(payloadStr)

  const key = await getCryptoKey()
  const enc = new TextEncoder()
  const signatureBytes = await globalThis.crypto.subtle.sign(
    'HMAC',
    key,
    enc.encode(encodedPayload)
  )

  let binary = ''
  const bytes = new Uint8Array(signatureBytes)
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  const encodedSignature = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  return `${encodedPayload}.${encodedSignature}`
}

/**
 * Verifies an HMAC-SHA256 signed session claim token and checks expiration.
 */
export async function verifySessionClaim(
  token: string
): Promise<SessionClaimPayload | null> {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 2) return null

  const [encodedPayload, encodedSignature] = parts

  try {
    const key = await getCryptoKey()
    const enc = new TextEncoder()

    // Decode signature
    let sigBase64 = encodedSignature.replace(/-/g, '+').replace(/_/g, '/')
    while (sigBase64.length % 4) {
      sigBase64 += '='
    }
    const sigBinary = atob(sigBase64)
    const sigBytes = new Uint8Array(sigBinary.length)
    for (let i = 0; i < sigBinary.length; i++) {
      sigBytes[i] = sigBinary.charCodeAt(i)
    }

    const isValid = await globalThis.crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      enc.encode(encodedPayload)
    )

    if (!isValid) return null

    const payloadStr = base64UrlDecode(encodedPayload)
    const payload = JSON.parse(payloadStr) as SessionClaimPayload

    // Expiration check
    if (!payload.exp || Date.now() > payload.exp) {
      return null
    }

    // Required fields check
    if (!payload.uid || !payload.role || !payload.approvalStatus) {
      return null
    }

    return payload
  } catch (err) {
    return null
  }
}

