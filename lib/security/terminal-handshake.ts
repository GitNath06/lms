import { getPgPool } from '@/lib/db'
import { createHandshakeTicket, safeEqual } from '@/lib/security/terminal-token'
import { recordAuditEvent } from '@/lib/audit/audit-ledger'
import type { WorkstationHardwareSpecs } from '@/types/workstations'

export interface TerminalHandshakePayload {
  labId?: string
  workstationCode?: string
  computer_name?: string
  machineGuid?: string
  machine_guid?: string
  pairingToken?: string
  pairing_token?: string
  hardwareSpecs?: WorkstationHardwareSpecs | any
  hardware_specs?: WorkstationHardwareSpecs | any
}

export interface TerminalHandshakeResult {
  success: boolean
  status: number
  error?: string
  data?: {
    station_code: string
    workstation_id: string
    machine_guid: string
    redirect_url: string
    is_new_pairing: boolean
  }
}

/**
 * Resolves the institutional agent signing/pairing secret.
 */
export function getInstitutionalAgentSecret(): string {
  const secret =
    process.env.LABSYNC_AGENT_KEY ||
    process.env.TERMINAL_SIGNING_SECRET ||
    (process.env.NODE_ENV === 'test' ? 'test-terminal-signing-salt-only-for-automated-tests' : '')
  if (!secret) {
    throw new Error('FATAL: Institutional agent secret is not configured.')
  }
  return secret
}

/**
 * Core cryptographic handshake and hardware discovery processor.
 * 
 * Invariants:
 * 1. Initial TOFU pairing (machine_guid IS NULL) strictly requires valid pairingToken or x-labsync-agent-key.
 * 2. Subsequent boots validate via machine_guid match + valid pairingToken.
 * 3. Scopes workstation lookup by (lab_id, label) to prevent multi-room label collisions.
 * 4. Refreshes hardware specs, LAN IP, and last_seen_at once per boot.
 * 5. Returns single-use 60-second HMAC handshake ticket.
 */
export async function processTerminalHandshake(
  payload: TerminalHandshakePayload,
  clientIp?: string | null,
  agentKeyHeader?: string | null,
  origin: string = 'http://localhost:3000'
): Promise<TerminalHandshakeResult> {
  try {
    const labId = (payload.labId || 'comp').trim()
    const trimmedCode = (payload.workstationCode || payload.computer_name || '').trim()
    const trimmedGuid = (payload.machineGuid || payload.machine_guid || '').trim()
    const suppliedToken = (payload.pairingToken || payload.pairing_token || '').trim()
    const hardwareSpecs = payload.hardwareSpecs || payload.hardware_specs || null

    if (!trimmedCode) {
      return {
        success: false,
        status: 400,
        error: 'Workstation computer_name / label required.',
      }
    }

    if (!trimmedGuid) {
      return {
        success: false,
        status: 400,
        error: 'Composite machine_guid required.',
      }
    }

    const pool = getPgPool()
    const institutionalSecret = getInstitutionalAgentSecret()

    // 1. Lookup Workstation scoped by lab_id and label/id
    const findQuery = `
      SELECT 
        id, 
        label, 
        machine_guid, 
        lan_ip,
        lab_id,
        pairing_token,
        is_active
      FROM public.workstations
      WHERE lab_id = $1 AND (LOWER(label) = LOWER($2) OR id::text = $2)
      LIMIT 1
    `
    const findRes = await pool.query(findQuery, [labId, trimmedCode])

    if (findRes.rows.length === 0) {
      return {
        success: false,
        status: 404,
        error: `Workstation "${trimmedCode}" not found in laboratory "${labId}" floor plan inventory.`,
      }
    }

    const ws = findRes.rows[0]
    const workstationId = ws.id
    const stationLabel = ws.label
    const existingGuid = ws.machine_guid
    const isFirstTimePairing = !existingGuid

    // 2. Token Security Verification
    // Station custom token takes precedence if set, otherwise institutionalSecret is validated
    const tokenMatched =
      (ws.pairing_token && suppliedToken && safeEqual(suppliedToken, ws.pairing_token)) ||
      (suppliedToken && safeEqual(suppliedToken, institutionalSecret)) ||
      (agentKeyHeader && safeEqual(agentKeyHeader, institutionalSecret))

    if (!tokenMatched) {
      return {
        success: false,
        status: 401,
        error: 'Unauthorized: Invalid institutional pairing token or agent key.',
      }
    }

    // 3. TOFU (Trust-On-First-Use) Hardware Lock Enforcement
    if (!isFirstTimePairing) {
      if (!safeEqual(existingGuid, trimmedGuid)) {
        return {
          success: false,
          status: 403,
          error: `Hardware Mismatch: Workstation ${stationLabel} is already locked to a different physical machine. Please request the Lab In-Charge to Reset Hardware Lock from /admin.`,
        }
      }
    }

    // 4. Update Hardware Specs, LAN IP, and Last Seen Timestamp
    const reportedLanIp = hardwareSpecs?.lan_ip || clientIp || ws.lan_ip
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
      hardwareSpecs ? JSON.stringify(hardwareSpecs) : null,
      reportedLanIp,
      workstationId,
    ])

    const updatedWs = updateRes.rows[0]

    // 5. Record Audit Event on First-Time Hardware Lock
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
          cpu: hardwareSpecs?.cpu,
          ram_gb: hardwareSpecs?.ram_gb,
        },
        metadata: {
          event: 'TOFU_HARDWARE_LOCK_ENROLLED',
          client_ip: clientIp,
        },
      })
    }

    // 6. Generate 60-Second Single-Use Handshake Ticket
    const ticket = createHandshakeTicket({
      id: updatedWs.id,
      label: updatedWs.label,
      machine_guid: updatedWs.machine_guid,
    })

    const cleanOrigin = origin.replace(/\/+$/, '')
    const redirectUrl = `${cleanOrigin}/api/terminal/launch?code=${encodeURIComponent(updatedWs.label)}&ticket=${encodeURIComponent(ticket)}`

    return {
      success: true,
      status: 200,
      data: {
        station_code: updatedWs.label,
        workstation_id: updatedWs.id,
        machine_guid: updatedWs.machine_guid,
        redirect_url: redirectUrl,
        is_new_pairing: isFirstTimePairing,
      },
    }
  } catch (err: any) {
    console.error('Error in processTerminalHandshake:', err)
    return {
      success: false,
      status: 500,
      error: err.message || 'Internal server error during handshake.',
    }
  }
}

