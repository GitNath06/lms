import { NextRequest, NextResponse } from 'next/server'
import { processTerminalHandshake } from '@/lib/security/terminal-handshake'

/**
 * Handshake endpoint for the physical Windows client agent (labsync-agent.ps1).
 * Authenticates machine identity via composite silicon GUID, enforces TOFU hardware lock with
 * institutional pairing token, updates boot-once hardware specs, and returns a single-use login ticket.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json(
        { success: false, error: 'Malformed JSON payload.' },
        { status: 400 }
      )
    }

    // Determine client IP
    const forwardedFor = req.headers.get('x-forwarded-for')
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : req.headers.get('x-real-ip') || null
    const agentKeyHeader = req.headers.get('x-labsync-agent-key')
    const origin = req.nextUrl.origin

    const result = await processTerminalHandshake(body, clientIp, agentKeyHeader, origin)

    if (!result.success || !result.data) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status }
      )
    }

    return NextResponse.json({
      success: true,
      ...result.data,
    })
  } catch (err: any) {
    console.error('Error in terminal handshake POST handler:', err)
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error during handshake.' },
      { status: 500 }
    )
  }
}
