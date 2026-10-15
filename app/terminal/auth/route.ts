import { NextRequest, NextResponse } from 'next/server'
import {
  verifyHandshakeTicket,
  createTerminalSessionToken,
} from '@/lib/security/terminal-token'

/**
 * Authentication exchange route.
 * Converts a 60-second single-use handshake ticket into an HttpOnly session cookie,
 * then 302-redirects to clean URL /terminal (zero parameters or tokens in address bar).
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const ticket = searchParams.get('ticket')

  const origin = req.nextUrl.origin

  if (!ticket) {
    return NextResponse.redirect(
      new URL('/terminal?auth_error=missing_ticket', origin),
      { status: 302 }
    )
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

  // CRITICAL USER GUARDRAIL:
  // Only set secure: true when running in production AND over HTTPS.
  // In school lab deployments running over local LAN HTTP (http://192.168.1.x:3000),
  // hardcoding secure: true causes modern browsers to drop the cookie!
  const isHttps = req.nextUrl.protocol === 'https:'
  const isProd = process.env.NODE_ENV === 'production'
  const isSecure = isProd && isHttps

  // Redirect to clean /terminal URL
  const response = NextResponse.redirect(new URL('/terminal', origin), {
    status: 302,
  })

  response.cookies.set('labsync_terminal_session', sessionToken, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    secure: isSecure,
    maxAge: 60 * 60 * 12, // 12-hour school lab operational session
  })

  return response
}
