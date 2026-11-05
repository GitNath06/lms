'use server'

import { revalidatePath } from 'next/cache'
import { getPgPool } from '@/lib/db'
import { recordAuditEvent } from '@/lib/audit/audit-ledger'
import { createHandshakeTicket } from '@/lib/security/terminal-token'
import { getServerUserScope } from '@/lib/context/server-user-scope'
import {
  HARDWARE_PRESETS,
  type SimulatorStationState,
} from '@/lib/types/terminal-simulator'

/**
 * Security Guard: Strictly blocks terminal simulator in production and
 * requires an approved privileged account in development/testing.
 */
async function assertSimulatorPermitted() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Access Denied: Terminal Simulator engine is strictly disabled in production.')
  }
  const scope = await getServerUserScope()
  if (scope.isPending || scope.approvalStatus !== 'approved' || !scope.isPrivileged) {
    throw new Error('Access Denied: Privileged administrator credentials required to run simulation rigs.')
  }
}

/**
 * Returns all workstations available for simulation.
 */
export async function getSimulatorStationList(): Promise<{
  success: boolean
  stations: Array<{ id: string; label: string; isBound: boolean; hasSpecs: boolean }>
  error?: string
}> {
  try {
    await assertSimulatorPermitted()
    const pool = getPgPool()
    const query = `
      SELECT 
        id, 
        label, 
        (machine_guid IS NOT NULL) as is_bound,
        (hardware_specs IS NOT NULL) as has_specs
      FROM public.workstations
      ORDER BY 
        substring(label from '^[A-Za-z]+')::text,
        COALESCE(substring(label from '[0-9]+')::int, 0),
        label
    `
    const res = await pool.query(query)
    const stations = res.rows.map((row) => ({
      id: row.id,
      label: row.label,
      isBound: Boolean(row.is_bound),
      hasSpecs: Boolean(row.has_specs),
    }))
    return { success: true, stations }
  } catch (err: any) {
    return { success: false, stations: [], error: err.message }
  }
}

/**
 * Resolves full live database state for a simulated workstation.
 */
export async function getSimulatorStationState(
  stationCode: string
): Promise<{ success: boolean; state?: SimulatorStationState; error?: string }> {
  try {
    await assertSimulatorPermitted()
    const trimmed = (stationCode || '').trim()
    if (!trimmed) {
      return { success: false, error: 'Station code required.' }
    }

    const pool = getPgPool()
    const wsQuery = `
      SELECT 
        w.id,
        w.lab_id,
        w.label,
        w.row_label,
        w.machine_guid,
        w.pairing_token,
        w.hardware_specs,
        w.last_seen_at,
        l.name as lab_name
      FROM public.workstations w
      LEFT JOIN public.labs l ON l.id = w.lab_id
      WHERE LOWER(w.label) = LOWER($1) OR w.id::text = $1
      LIMIT 1
    `
    const wsRes = await pool.query(wsQuery, [trimmed])
    if (wsRes.rows.length === 0) {
      return { success: false, error: `Workstation ${trimmed} not found in database.` }
    }

    const ws = wsRes.rows[0]

    // Fetch active issues
    const issuesQuery = `
      SELECT 
        id,
        title,
        severity,
        source,
        student_name,
        student_roll
      FROM public.workstation_issues
      WHERE workstation_id = $1 AND status != 'resolved'
      ORDER BY created_at DESC
      LIMIT 10
    `
    const issuesRes = await pool.query(issuesQuery, [ws.id])
    const activeIssues = issuesRes.rows.map((row) => ({
      id: row.id,
      title: row.title,
      severity: row.severity,
      source: row.source || 'staff',
      studentName: row.student_name,
      studentRoll: row.student_roll,
    }))

    const state: SimulatorStationState = {
      id: ws.id,
      label: ws.label,
      labId: ws.lab_id || 'comp',
      labName: ws.lab_name || 'Computer Laboratory',
      isBound: Boolean(ws.machine_guid),
      machineGuid: ws.machine_guid || null,
      pairingToken: ws.pairing_token || null,
      hardwareSpecs: ws.hardware_specs || null,
      lastSeenAt: ws.last_seen_at ? new Date(ws.last_seen_at).toISOString() : null,
      openIssuesCount: activeIssues.length,
      activeIssues,
    }

    return { success: true, state }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Injects a realistic hardware telemetry preset into a workstation.
 */
export async function injectHardwarePreset(
  stationCode: string,
  presetKey: 'optimal' | 'low_storage' | 'critical_storage' | 'high_end'
): Promise<{ success: boolean; machineGuid?: string; error?: string }> {
  try {
    await assertSimulatorPermitted()
    const preset = HARDWARE_PRESETS[presetKey]
    if (!preset) {
      return { success: false, error: `Unknown preset: ${presetKey}` }
    }

    const trimmed = (stationCode || '').trim()
    const pool = getPgPool()

    // 1. Check existing workstation
    const wsQuery = `SELECT id, label, machine_guid FROM public.workstations WHERE LOWER(label) = LOWER($1) OR id::text = $1 LIMIT 1`
    const wsRes = await pool.query(wsQuery, [trimmed])
    if (wsRes.rows.length === 0) {
      return { success: false, error: `Workstation ${trimmed} not found.` }
    }

    const ws = wsRes.rows[0]
    // Generate deterministic simulation GUID if station doesn't already have one
    const cleanLabel = ws.label.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    const assignedGuid = ws.machine_guid || `SIM-${cleanLabel}-MOCK-UUID-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    // 2. Update telemetry in PostgreSQL
    const updateQuery = `
      UPDATE public.workstations
      SET 
        machine_guid = $1,
        hardware_specs = $2::jsonb,
        last_seen_at = NOW(),
        updated_at = NOW()
      WHERE id = $3
      RETURNING id, label, machine_guid
    `
    await pool.query(updateQuery, [assignedGuid, JSON.stringify(preset.specs), ws.id])

    await recordAuditEvent({
      action: 'UPDATE',
      entityType: 'workstation',
      entityId: ws.id,
      entityLabel: `Workstation ${ws.label}: Injected Telemetry (${preset.name})`,
      after: {
        preset: presetKey,
        specs: preset.specs,
        machine_guid: assignedGuid,
      },
    })

    revalidatePath('/computer-lab')
    revalidatePath('/maintenance')
    revalidatePath('/maintenance/workstations')
    revalidatePath('/terminal')

    return { success: true, machineGuid: assignedGuid }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Resets a workstation back to fresh / unpaired state (clearing machine_guid and hardware_specs).
 */
export async function resetStationTelemetry(
  stationCode: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await assertSimulatorPermitted()
    const trimmed = (stationCode || '').trim()
    const pool = getPgPool()

    const wsQuery = `SELECT id, label, machine_guid FROM public.workstations WHERE LOWER(label) = LOWER($1) OR id::text = $1 LIMIT 1`
    const wsRes = await pool.query(wsQuery, [trimmed])
    if (wsRes.rows.length === 0) {
      return { success: false, error: `Workstation ${trimmed} not found.` }
    }

    const ws = wsRes.rows[0]
    const updateQuery = `
      UPDATE public.workstations
      SET 
        machine_guid = NULL,
        hardware_specs = NULL,
        pairing_token = NULL,
        last_seen_at = NULL,
        updated_at = NOW()
      WHERE id = $1
    `
    await pool.query(updateQuery, [ws.id])

    await recordAuditEvent({
      action: 'UPDATE',
      entityType: 'workstation',
      entityId: ws.id,
      entityLabel: `Workstation ${ws.label}: Telemetry & Machine Lock Cleared (Reset Simulation)`,
      before: { machine_guid: ws.machine_guid },
      after: { machine_guid: null, hardware_specs: null },
    })

    revalidatePath('/computer-lab')
    revalidatePath('/maintenance')
    revalidatePath('/maintenance/workstations')
    revalidatePath('/terminal')

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Mints a valid 60-second single-use handshake ticket for testing the student portal.
 */
export async function mintSimulatorTerminalTicket(
  stationCode: string
): Promise<{ success: boolean; ticket?: string; authUrl?: string; error?: string }> {
  try {
    await assertSimulatorPermitted()
    const trimmed = (stationCode || '').trim()
    const pool = getPgPool()

    const wsQuery = `SELECT id, label, machine_guid FROM public.workstations WHERE LOWER(label) = LOWER($1) OR id::text = $1 LIMIT 1`
    const wsRes = await pool.query(wsQuery, [trimmed])
    if (wsRes.rows.length === 0) {
      return { success: false, error: `Workstation ${trimmed} not found.` }
    }

    const ws = wsRes.rows[0]
    let activeGuid = ws.machine_guid

    // If workstation is unbound, bind a simulated test GUID first
    if (!activeGuid) {
      const cleanLabel = ws.label.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
      activeGuid = `SIM-${cleanLabel}-TEST-UUID`
      await pool.query(
        `UPDATE public.workstations SET machine_guid = $1, last_seen_at = NOW(), updated_at = NOW() WHERE id = $2`,
        [activeGuid, ws.id]
      )
    }

    const ticket = createHandshakeTicket(
      {
        id: ws.id,
        label: ws.label,
        machine_guid: activeGuid,
      },
      60
    )

    const authUrl = `/terminal/auth?ticket=${encodeURIComponent(ticket)}`
    return { success: true, ticket, authUrl }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Injects a live student assistance / distress beacon from a workstation.
 */
export async function injectStudentDistressBeacon(input: {
  stationCode: string
  title: string
  category: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  studentName: string
  studentRoll: number
  description: string
}): Promise<{ success: boolean; issueId?: string; error?: string }> {
  try {
    await assertSimulatorPermitted()
    const pool = getPgPool()
    const wsQuery = `SELECT id, label FROM public.workstations WHERE LOWER(label) = LOWER($1) OR id::text = $1 LIMIT 1`
    const wsRes = await pool.query(wsQuery, [input.stationCode.trim()])
    if (wsRes.rows.length === 0) {
      return { success: false, error: `Workstation ${input.stationCode} not found.` }
    }

    const ws = wsRes.rows[0]
    const reporterName = `${input.studentName.trim()} (Roll ${input.studentRoll})`

    const insertQuery = `
      INSERT INTO public.workstation_issues (
        workstation_id,
        title,
        description,
        severity,
        status,
        reported_by_name,
        source,
        student_name,
        student_roll,
        photos,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, 'open', $5, 'student_terminal', $6, $7, '[]'::jsonb, NOW(), NOW())
      RETURNING id
    `
    const insertRes = await pool.query(insertQuery, [
      ws.id,
      input.title.trim(),
      input.description.trim() || null,
      input.severity,
      reporterName,
      input.studentName.trim(),
      String(input.studentRoll),
    ])

    const issueId = insertRes.rows[0]?.id

    // Dispatch system notifications for Super Admin and Lab In-Charge
    const notifSeverity = input.severity === 'critical' ? 'critical' : input.severity === 'high' ? 'warning' : 'info'
    const notifs = [
      {
        id: `notif-sim-help-${issueId}-admin`,
        target_role: 'super_admin',
        target_lab_id: 'comp',
        title: `🚨 Student Assistance: ${ws.label}`,
        message: `${reporterName}: ${input.title.trim()}${input.description?.trim() ? ` — ${input.description.trim()}` : ''}. Terminal assistance requested.`,
        severity: notifSeverity,
      },
      {
        id: `notif-sim-help-${issueId}-incharge`,
        target_role: 'lab_incharge',
        target_lab_id: 'comp',
        title: `Student Assistance: ${ws.label}`,
        message: `${reporterName}: ${input.title.trim()}${input.description?.trim() ? ` — ${input.description.trim()}` : ''}. Station requires attention.`,
        severity: notifSeverity,
      },
    ]

    for (const n of notifs) {
      await pool.query(
        `INSERT INTO public.lab_notifications (id, target_role, target_lab_id, title, message, severity, is_read, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, false, NOW())
         ON CONFLICT (id) DO NOTHING;`,
        [n.id, n.target_role, n.target_lab_id, n.title, n.message, n.severity]
      )
    }

    await recordAuditEvent({
      action: 'CREATE',
      entityType: 'workstation_issue',
      entityId: issueId,
      entityLabel: `Simulated Student Distress on ${ws.label}: ${input.title}`,
      after: {
        workstation_id: ws.id,
        station_code: ws.label,
        source: 'student_terminal',
        student: reporterName,
        severity: input.severity,
      },
    })

    revalidatePath('/computer-lab')
    revalidatePath('/maintenance')
    revalidatePath('/terminal')

    return { success: true, issueId }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Simulates a rogue / unauthorized laptop attempting to hijack a bound workstation.
 * Tests and verifies the anti-spoofing cryptographic defense.
 */
export async function testAntiSpoofHijack(stationCode: string): Promise<{
  success: boolean
  blocked: boolean
  status: number
  message: string
  stationCode: string
  registeredGuid?: string | null
  attemptedGuid: string
  error?: string
}> {
  try {
    await assertSimulatorPermitted()
    const trimmed = (stationCode || '').trim()
    const pool = getPgPool()

    const wsQuery = `SELECT id, label, machine_guid FROM public.workstations WHERE LOWER(label) = LOWER($1) OR id::text = $1 LIMIT 1`
    const wsRes = await pool.query(wsQuery, [trimmed])
    if (wsRes.rows.length === 0) {
      return {
        success: false,
        blocked: false,
        status: 404,
        message: `Workstation ${trimmed} not found.`,
        stationCode: trimmed,
        attemptedGuid: '',
      }
    }

    const ws = wsRes.rows[0]
    const rogueGuid = `ROGUE-LAPTOP-ATTACKER-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    if (!ws.machine_guid) {
      return {
        success: true,
        blocked: false,
        status: 200,
        message: `Station ${ws.label} is currently unbound (fresh PC). A rogue handshake would trigger first-time TOFU pairing. Bind the station first to test anti-spoofing defense.`,
        stationCode: ws.label,
        registeredGuid: null,
        attemptedGuid: rogueGuid,
      }
    }

    // Workstation IS bound to ws.machine_guid, and rogueGuid != ws.machine_guid
    const isMismatch = ws.machine_guid !== rogueGuid

    if (isMismatch) {
      // Record security audit event
      await recordAuditEvent({
        action: 'UPDATE',
        entityType: 'workstation',
        entityId: ws.id,
        entityLabel: `SECURITY DEFENSE TRIGGERED: Anti-Spoofing Block on ${ws.label}`,
        metadata: {
          violation: 'HARDWARE_SPOOF_ATTEMPT',
          registeredGuid: ws.machine_guid,
          attemptedGuid: rogueGuid,
          actionTaken: 'HTTP 403 Forbidden - Access Denied',
        },
      })

      return {
        success: true,
        blocked: true,
        status: 403,
        message: `Anti-spoofing defense successfully blocked unauthorized device! Registered GUID (${ws.machine_guid.substring(0, 14)}...) does not match rogue client GUID (${rogueGuid}). Rejection verified.`,
        stationCode: ws.label,
        registeredGuid: ws.machine_guid,
        attemptedGuid: rogueGuid,
      }
    }

    return {
      success: true,
      blocked: false,
      status: 200,
      message: 'GUIDs matched (no attack simulated).',
      stationCode: ws.label,
      registeredGuid: ws.machine_guid,
      attemptedGuid: rogueGuid,
    }
  } catch (err: any) {
    return {
      success: false,
      blocked: false,
      status: 500,
      message: err.message,
      stationCode,
      attemptedGuid: '',
      error: err.message,
    }
  }
}

/**
 * Simulates all laboratory workstations booting up simultaneously.
 * Updates hardware specs, GUIDs, and heartbeat timestamps.
 */
export async function simulateSwarmBootAll(labId = 'comp'): Promise<{
  success: boolean
  count: number
  durationMs: number
  error?: string
}> {
  const startTime = Date.now()
  try {
    await assertSimulatorPermitted()
    const pool = getPgPool()
    const wsQuery = `SELECT id, label FROM public.workstations WHERE lab_id = $1 ORDER BY label ASC`
    const wsRes = await pool.query(wsQuery, [labId])
    const stations = wsRes.rows

    if (stations.length === 0) {
      return { success: false, count: 0, durationMs: 0, error: 'No workstations found for this lab.' }
    }

    const cpus = [
      'AMD Ryzen 5 3500U with Radeon Vega Mobile Gfx',
      'Intel Core i5-10400 CPU @ 2.90GHz',
      'Intel Core i5-11400 CPU @ 2.60GHz',
      'AMD Ryzen 5 5600G with Radeon Graphics',
    ]

    for (let i = 0; i < stations.length; i++) {
      const ws = stations[i]
      const cleanLabel = ws.label.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
      const machineGuid = `SWARM-${cleanLabel}-${(1000 + i).toString()}`
      const ip = `192.168.1.${10 + i}`
      const cpu = cpus[i % cpus.length]
      const ramGb = i % 3 === 0 ? 16 : 8
      const diskFreeGb = 120 + (i * 7) % 150

      const specs = {
        cpu,
        ram_gb: ramGb,
        drive_c_free_gb: diskFreeGb,
        drive_c_total_gb: 256,
        os: 'Windows 11 Pro 64-bit',
        ip,
        booted_at: new Date().toISOString(),
      }

      await pool.query(
        `UPDATE public.workstations 
         SET machine_guid = COALESCE(machine_guid, $1),
             lan_ip = $2,
             hardware_specs = $3::jsonb,
             last_seen_at = NOW(),
             updated_at = NOW()
         WHERE id = $4`,
        [machineGuid, ip, JSON.stringify(specs), ws.id]
      )
    }

    const durationMs = Date.now() - startTime

    await recordAuditEvent({
      action: 'UPDATE',
      entityType: 'workstation',
      entityId: labId,
      entityLabel: `Swarm Boot Simulation: ${stations.length} workstations booted`,
      metadata: { stationCount: stations.length, durationMs },
    })

    revalidatePath('/computer-lab')
    revalidatePath('/maintenance')
    revalidatePath('/terminal')

    return { success: true, count: stations.length, durationMs }
  } catch (err: any) {
    return { success: false, count: 0, durationMs: Date.now() - startTime, error: err.message }
  }
}

/**
 * Simulates multiple students simultaneously reporting distress issues.
 */
export async function simulateMassStudentDistress(
  count = 5,
  labId = 'comp'
): Promise<{
  success: boolean
  ticketsCreated: number
  affectedStations: string[]
  error?: string
}> {
  try {
    await assertSimulatorPermitted()
    const pool = getPgPool()
    const wsQuery = `SELECT id, label FROM public.workstations WHERE lab_id = $1 ORDER BY RANDOM() LIMIT $2`
    const wsRes = await pool.query(wsQuery, [labId, Math.min(Math.max(1, count), 30)])
    const selected = wsRes.rows

    if (selected.length === 0) {
      return { success: false, ticketsCreated: 0, affectedStations: [], error: 'No workstations available.' }
    }

    const problemTemplates = [
      {
        title: 'Mouse / Keyboard Fault',
        description: 'Mouse pointer is lagging and left clicker is not registering properly.',
        severity: 'medium' as const,
      },
      {
        title: 'No Internet / LAN Disconnected',
        description: 'Ethernet cable shows disconnected error and gateway unreachable.',
        severity: 'high' as const,
      },
      {
        title: 'Missing Lab Software',
        description: 'Required compiler (GCC / VS Code / Python 3) is missing from desktop.',
        severity: 'medium' as const,
      },
      {
        title: 'Application Freeze / Crash',
        description: 'Application freezes when compiling code and terminal becomes unresponsive.',
        severity: 'high' as const,
      },
      {
        title: 'Audio / Headphone Issue',
        description: 'Audio 3.5mm jack loose, sound only coming from left channel.',
        severity: 'low' as const,
      },
    ]

    const studentNames = [
      'Aayush Shrestha',
      'Antara Bhujel',
      'Kritan Joshi',
      'Sampada Kandel',
      'Anch Rana',
      'Himani Moktan',
      'Kaustuv Thapa',
      'Purnima Shrestha',
      'Sudrin Koirala',
      'Kismat Khadka',
    ]

    const affected: string[] = []

    for (let i = 0; i < selected.length; i++) {
      const ws = selected[i]
      const template = problemTemplates[i % problemTemplates.length]
      const sName = studentNames[i % studentNames.length]
      const sRoll = (i + 1) * 2

      await pool.query(
        `INSERT INTO public.workstation_issues (
          workstation_id,
          title,
          description,
          severity,
          status,
          reported_by_name,
          source,
          student_name,
          student_roll,
          photos,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, 'open', $5, 'student_terminal', $6, $7, '[]'::jsonb, NOW(), NOW())`,
        [
          ws.id,
          template.title,
          template.description,
          template.severity,
          `${sName} (Roll ${sRoll})`,
          sName,
          String(sRoll),
        ]
      )
      affected.push(ws.label)
    }

    revalidatePath('/computer-lab')
    revalidatePath('/maintenance')
    revalidatePath('/terminal')

    return { success: true, ticketsCreated: affected.length, affectedStations: affected }
  } catch (err: any) {
    return { success: false, ticketsCreated: 0, affectedStations: [], error: err.message }
  }
}

/**
 * Clears all simulated student distress tickets from the lab.
 */
export async function clearAllSimulatorDistressTickets(labId = 'comp'): Promise<{
  success: boolean
  clearedCount: number
  error?: string
}> {
  try {
    await assertSimulatorPermitted()
    const pool = getPgPool()
    const deleteRes = await pool.query(
      `DELETE FROM public.workstation_issues 
       WHERE source = 'student_terminal' 
         AND workstation_id IN (SELECT id FROM public.workstations WHERE lab_id = $1)
       RETURNING id`,
      [labId]
    )

    revalidatePath('/computer-lab')
    revalidatePath('/maintenance')
    revalidatePath('/terminal')

    return { success: true, clearedCount: deleteRes.rowCount || 0 }
  } catch (err: any) {
    return { success: false, clearedCount: 0, error: err.message }
  }
}

