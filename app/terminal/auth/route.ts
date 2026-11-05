import { NextRequest } from 'next/server'
import { handleTerminalLaunch } from '@/app/api/terminal/launch/route'

/**
 * Authentication exchange route (backward compatible alias for /api/terminal/launch).
 * Converts a 60-second single-use handshake ticket into an HttpOnly session cookie,
 * then 302-redirects to clean station URL /terminal/[code].
 */
export async function GET(req: NextRequest) {
  return handleTerminalLaunch(req)
}
