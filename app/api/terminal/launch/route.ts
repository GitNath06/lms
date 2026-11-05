import { NextRequest, NextResponse } from 'next/server'
import {
  verifyHandshakeTicket,
  createTerminalSessionToken,
  isHandshakeSignatureRedeemedInDb,
} from '@/lib/security/terminal-token'

/**
 * Terminal Launch & Ticket Redemption Route.
 * Validates the single-use 60-second HMAC handshake ticket from the local agent,
 * sets the persistent 12-hour HttpOnly session cookie (labsync_terminal_session),
 * and 302-redirects cleanly to /terminal/[code] with zero tokens in the browser URL bar.
 */
export async function handleTerminalLaunch(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const ticket = searchParams.get('ticket') || searchParams.get('token')
  const requestedCode = searchParams.get('code')
  const origin = req.nextUrl.origin

  if (!ticket) {
    return NextResponse.redirect(
      new URL('/terminal?auth_error=missing_ticket', origin),
      { status: 302 }
    )
  }

  // Cross-serverless database replay check
  const [, ticketSig] = ticket.split('.')
  if (ticketSig) {
    const isRedeemedInDb = await isHandshakeSignatureRedeemedInDb(ticketSig)
    if (isRedeemedInDb) {
      return NextResponse.redirect(
        new URL('/terminal?auth_error=Single-use%20handshake%20ticket%20has%20already%20been%20redeemed', origin),
        { status: 302 }
      )
    }
  }

  const verification = verifyHandshakeTicket(ticket)
  if (!verification.valid || !verification.payload) {
    const errorReason = encodeURIComponent(verification.reason || 'Ticket invalid or expired')
    return NextResponse.redirect(
      new URL(`/terminal?auth_error=${errorReason}`, origin),
      { status: 302 }
    )
  }

  const { stationId, stationCode, machineGuid } = verification.payload

  // Create persistent HttpOnly session token
  const sessionToken = createTerminalSessionToken({
    id: stationId,
    label: stationCode,
    machine_guid: machineGuid,
  })

  const isHttps = req.nextUrl.protocol === 'https:'
  const isProd = process.env.NODE_ENV === 'production'
  const isSecure = isProd && isHttps

  // Target canonical station URL: /terminal/[stationCode] (strictly prioritize cryptographically verified stationCode)
  const targetStation = stationCode || (requestedCode && requestedCode.trim() ? requestedCode.trim() : '')
  const redirectUrl = new URL(`/terminal/${encodeURIComponent(targetStation)}`, origin)

  const response = NextResponse.redirect(redirectUrl, {
    status: 302,
  })

  // Set 12-hour operational school lab session cookie
  response.cookies.set('labsync_terminal_session', sessionToken, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    secure: isSecure,
    maxAge: 60 * 60 * 12, // 12-hour session
  })

  // Also set alias cookie labsync_terminal_auth for dual compatibility
  response.cookies.set('labsync_terminal_auth', sessionToken, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    secure: isSecure,
    maxAge: 60 * 60 * 12,
  })

  return response
}

export async function GET(req: NextRequest) {
  return handleTerminalLaunch(req)
}

