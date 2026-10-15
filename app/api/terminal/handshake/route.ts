import { NextRequest, NextResponse } from 'next/server'
import { getPgPool } from '@/lib/db'
import {
  createHandshakeTicket,
  safeEqual,
} from '@/lib/security/terminal-token'
import { recordAuditEvent } from '@/lib/audit/audit-ledger'

/**
 * Handshake endpoint for the physical Windows client agent (labsync-agent.ps1).
 * Authenticates machine identity via composite MachineGuid, enforces TOFU hardware lock,
 * saves live hardware telemetry, and issues a 60-second single-use login ticket.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Optional Institutional Key Verification
    const agentSecret = process.env.LABSYNC_AGENT_KEY
    if (agentSecret) {
      const clientKey = req.headers.get('x-labsync-agent-key')
      if (!clientKey || !safeEqual(clientKey, agentSecret)) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized: Invalid institutional agent key.' },
          { status: 401 }
        )
      }
    }

    // 2. Parse Payload
    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json(
        { success: false, error: 'Malformed JSON payload.' },
        { status: 400 }
      )
    }

    const { computer_name, machine_guid, hardware_specs } = body

    const trimmedCode = (computer_name || '').trim()
    const trimmedGuid = (machine_guid || '').trim()

    if (!trimmedCode) {
      return NextResponse.json(
        { success: false, error: 'Workstation computer_name / label required.' },
        { status: 400 }
      )
    }

    if (!trimmedGuid) {
      return NextResponse.json(
        { success: false, error: 'Composite machine_guid required.' },
        { status: 400 }
      )
    }

    // Determine client IP
    const forwardedFor = req.headers.get('x-forwarded-for')
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : req.headers.get('x-real-ip') || null

    const pool = getPgPool()

    // 3. Lookup Workstation by label (e.g. PC-14) or UUID
    const findQuery = `
      SELECT 
        id, 
        label, 
        machine_guid, 
        lan_ip,
        lab_id,
        is_active
      FROM public.workstations
      WHERE LOWER(label) = LOWER($1) OR id::text = $1
      LIMIT 1
    `
    const findRes = await pool.query(findQuery, [trimmedCode])

    if (findRes.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Workstation "${trimmedCode}" not found in laboratory floor plan inventory.`,
        },
        { status: 404 }
      )
    }

    const ws = findRes.rows[0]
    const workstationId = ws.id
    const stationLabel = ws.label
    const existingGuid = ws.machine_guid

    // 4. TOFU (Trust-On-First-Use) Hardware Lock Enforcement
    const isFirstTimePairing = !existingGuid

    if (!isFirstTimePairing) {
      // Station already has a registered hardware GUID: verify match
      if (!safeEqual(existingGuid, trimmedGuid)) {
        return NextResponse.json(
          {
            success: false,
            error: `Hardware Mismatch: Workstation ${stationLabel} is already locked to a different physical machine. Please request the Lab In-Charge to Reset Hardware Lock from the Live Cockpit.`,
          },
          { status: 403 }
        )
      }
    }

    // 5. Update Hardware Specs, LAN IP, and Last Seen Timestamp
    const reportedLanIp = hardware_specs?.lan_ip || clientIp || ws.lan_ip
    const boundGuid = isFirstTimePairing ? trimmedGuid : existingGuid

    const updateQuery = `
      UPDATE public.workstations
      SET 
        machine_guid = $1,
        hardware_specs = $2,
        lan_ip = COALESCE($3, lan_ip),
        last_seen_at = NOW(),
        updated_at = NOW()
      WHERE id = $4
      RETURNING id, label, machine_guid, lan_ip, last_seen_at
    `
    const updateRes = await pool.query(updateQuery, [
      boundGuid,
      hardware_specs ? JSON.stringify(hardware_specs) : null,
      reportedLanIp,
      workstationId,
    ])

    const updatedWs = updateRes.rows[0]

    // 6. Record Audit Event on First-Time Hardware Lock
    if (isFirstTimePairing) {
      await recordAuditEvent({
        action: 'UPDATE',
        entityType: 'workstation',
        entityId: workstationId,
        entityLabel: `Hardware Bound: ${stationLabel}`,
        before: { machine_guid: null },
        after: {
          machine_guid: boundGuid,
          lan_ip: reportedLanIp,
          cpu: hardware_specs?.cpu,
          ram_gb: hardware_specs?.ram_gb,
        },
        metadata: {
          event: 'TOFU_HARDWARE_LOCK_ENROLLED',
          client_ip: clientIp,
        },
      })
    }

    // 7. Generate 60-Second Single-Use Handshake Ticket
    const ticket = createHandshakeTicket({
      id: updatedWs.id,
      label: updatedWs.label,
      machine_guid: updatedWs.machine_guid,
    })

    // Construct origin-aware redirect URL
    const origin = req.nextUrl.origin
    const redirectUrl = `${origin}/terminal/auth?ticket=${encodeURIComponent(ticket)}`

    return NextResponse.json({
      success: true,
      station_code: updatedWs.label,
      workstation_id: updatedWs.id,
      machine_guid: updatedWs.machine_guid,
      redirect_url: redirectUrl,
      is_new_pairing: isFirstTimePairing,
    })
  } catch (err: any) {
    console.error('Error in terminal handshake route:', err)
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error during handshake.' },
      { status: 500 }
    )
  }
}
