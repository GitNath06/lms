'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getPgPool } from '@/lib/db'
import { getServerUserScope } from '@/lib/context/server-user-scope'
import { recordAuditEvent } from '@/lib/audit/audit-ledger'
import type {
  TerminalContextData,
  SubmitStudentReportInput,
  TerminalVerificationResult,
} from '@/lib/types/terminal'

async function getAuthContext() {
  const scope = await getServerUserScope()
  const isPrivileged =
    scope.isPrivileged ||
    scope.role === 'super_admin' ||
    scope.role === 'lab_incharge' ||
    scope.role === 'hod' ||
    process.env.NODE_ENV === 'development'

  return { scope, isPrivileged }
}

/**
 * Resolves context for a student terminal (PC identifier, lab, current student, active practical).
 */
export async function getTerminalContext(
  stationCode: string,
  token?: string,
  clientIp?: string
): Promise<{ success: boolean; data?: TerminalContextData; error?: string }> {
  try {
    const trimmedCode = (stationCode || '').trim()
    if (!trimmedCode) {
      return { success: false, error: 'Terminal code or PC number required.' }
    }

    const pool = getPgPool()

    // 1. Find workstation by label (case-insensitive) or UUID
    const wsQuery = `
      SELECT 
        w.id,
        w.lab_id,
        w.label,
        w.row_label,
        w.lan_ip,
        w.pairing_token,
        w.is_active,
        l.name as lab_name
      FROM public.workstations w
      LEFT JOIN public.labs l ON l.id = w.lab_id
      WHERE (LOWER(w.label) = LOWER($1) OR w.id::text = $1)
      LIMIT 1
    `
    const wsRes = await pool.query(wsQuery, [trimmedCode])
    if (wsRes.rows.length === 0) {
      return { success: false, error: `Workstation "${trimmedCode}" not found in laboratory database.` }
    }

    const ws = wsRes.rows[0]
    const workstationId = ws.id
    const labId = ws.lab_id || 'comp'
    const labName = ws.lab_name || 'Computer Laboratory'
    const storedToken = ws.pairing_token || null
    const isPaired = Boolean(storedToken)

    // 2. Identify active scheduled session (if any)
    let activeSession = null
    const scheduleQuery = `
      SELECT 
        s.id,
        s.subject_name,
        s.batch_name,
        s.start_time,
        s.end_time,
        p.full_name as teacher_name
      FROM public.schedules s
      LEFT JOIN public.profiles p ON p.id = s.teacher_id
      WHERE s.lab_id = $1 
        AND s.status IN ('in_progress', 'scheduled')
      ORDER BY s.status = 'in_progress' DESC, s.created_at DESC
      LIMIT 1
    `
    const schedRes = await pool.query(scheduleQuery, [labId])
    if (schedRes.rows.length > 0) {
      const s = schedRes.rows[0]
      activeSession = {
        scheduleId: s.id,
        subjectName: s.subject_name || 'Laboratory Practical',
        teacherName: s.teacher_name || 'Faculty Instructor',
        startTime: s.start_time || '',
        endTime: s.end_time || '',
        batchName: s.batch_name || '',
      }
    }

    // 3. Identify student assigned to this workstation
    // INVARIANT: Check Tier 2 session relocation overrides first!
    let currentStudent = null
    const schedId = activeSession?.scheduleId || null

    // 3A. Check if any student was temporarily relocated to THIS workstation today
    const overrideQuery = `
      SELECT 
        sso.id as override_id,
        sso.session_date,
        e.id as enrollment_id,
        e.roll_number,
        e.section,
        c.name as class_name,
        st.id as student_id,
        st.full_name as student_name,
        st.photo_url,
        orig_ws.label as original_workstation_label
      FROM public.session_seat_overrides sso
      JOIN public.student_enrollments e ON e.id = sso.enrollment_id
      JOIN public.students st ON st.id = e.student_id
      LEFT JOIN public.classes c ON c.id = e.class_id
      LEFT JOIN public.workstation_seat_plans orig_sp ON orig_sp.enrollment_id = e.id
      LEFT JOIN public.workstations orig_ws ON orig_ws.id = orig_sp.workstation_id
      WHERE sso.workstation_id = $1
        AND (sso.session_date = CURRENT_DATE OR ($2::text IS NOT NULL AND sso.schedule_id::text = $2::text))
      ORDER BY sso.created_at DESC
      LIMIT 1
    `
    const overrideRes = await pool.query(overrideQuery, [workstationId, schedId])

    if (overrideRes.rows.length > 0) {
      const ov = overrideRes.rows[0]
      currentStudent = {
        enrollmentId: ov.enrollment_id,
        studentId: ov.student_id,
        studentName: ov.student_name,
        rollNumber: ov.roll_number,
        className: ov.class_name,
        section: ov.section,
        photoUrl: ov.photo_url,
        isTemporary: true,
        originalWorkstationLabel: ov.original_workstation_label || null,
      }
    } else {
      // 3B. No temporary relocation to this station: Check baseline Tier 1 seat plan
      const seatQuery = `
        SELECT 
          sp.id as seat_plan_id,
          e.id as enrollment_id,
          e.roll_number,
          e.section,
          c.name as class_name,
          st.id as student_id,
          st.full_name as student_name,
          st.photo_url
        FROM public.workstation_seat_plans sp
        JOIN public.student_enrollments e ON e.id = sp.enrollment_id
        JOIN public.students st ON st.id = e.student_id
        LEFT JOIN public.classes c ON c.id = e.class_id
        WHERE sp.workstation_id = $1
        ORDER BY sp.created_at DESC
        LIMIT 1
      `
      const seatRes = await pool.query(seatQuery, [workstationId])
      if (seatRes.rows.length > 0) {
        const seat = seatRes.rows[0]

        // Check if this baseline student was relocated to a DIFFERENT workstation today
        const movedAwayQuery = `
          SELECT sso.workstation_id
          FROM public.session_seat_overrides sso
          WHERE sso.enrollment_id = $1
            AND (sso.session_date = CURRENT_DATE OR ($2::text IS NOT NULL AND sso.schedule_id::text = $2::text))
            AND sso.workstation_id != $3
          LIMIT 1
        `
        const movedAwayRes = await pool.query(movedAwayQuery, [seat.enrollment_id, schedId, workstationId])

        if (movedAwayRes.rows.length === 0) {
          // Student is still at their nominal baseline station
          currentStudent = {
            enrollmentId: seat.enrollment_id,
            studentId: seat.student_id,
            studentName: seat.student_name,
            rollNumber: seat.roll_number,
            className: seat.class_name,
            section: seat.section,
            photoUrl: seat.photo_url,
            isTemporary: false,
          }
        }
      }
    }

    // 4. Fetch recent active issues for this workstation
    const issuesQuery = `
      SELECT 
        id,
        title,
        severity,
        status,
        created_at
      FROM public.workstation_issues
      WHERE workstation_id = $1 AND status != 'resolved'
      ORDER BY created_at DESC
      LIMIT 5
    `
    const issuesRes = await pool.query(issuesQuery, [workstationId])
    const recentIssues = issuesRes.rows.map((row) => ({
      id: row.id,
      title: row.title,
      severity: row.severity,
      status: row.status,
      createdAt: row.created_at?.toISOString?.() || row.created_at,
    }))

    const contextData: TerminalContextData = {
      workstationId,
      stationCode: ws.label,
      rowLabel: ws.row_label,
      labId,
      labName,
      lanIp: ws.lan_ip,
      isPaired,
      pairingToken: storedToken,
      currentStudent,
      activeSession,
      recentIssues,
    }

    return { success: true, data: contextData }
  } catch (err: any) {
    console.error('Error in getTerminalContext:', err)
    return { success: false, error: err.message || 'Internal server error resolving terminal.' }
  }
}

/**
 * 2-Tier anti-spoofing verification for a terminal request.
 * Ensures a student on PC-12 cannot prank-report for PC-30.
 */
export async function verifyTerminalAccess(
  stationCode: string,
  token?: string,
  clientIp?: string
): Promise<TerminalVerificationResult> {
  const pool = getPgPool()
  const trimmedCode = (stationCode || '').trim()

  const query = `
    SELECT id, label, lan_ip, pairing_token
    FROM public.workstations
    WHERE LOWER(label) = LOWER($1) OR id::text = $1
    LIMIT 1
  `
  const res = await pool.query(query, [trimmedCode])
  if (res.rows.length === 0) {
    return {
      allowed: false,
      stationCode: trimmedCode,
      workstationId: '',
      reason: 'Unknown workstation code.',
    }
  }

  const ws = res.rows[0]
  const storedToken = ws.pairing_token
  const storedIp = ws.lan_ip

  let tokenMatched = false
  let ipMatched = false

  if (storedToken && token) {
    tokenMatched = storedToken.trim() === token.trim()
  }

  if (storedIp && clientIp) {
    ipMatched = storedIp.trim() === clientIp.trim()
  }

  // If workstation has security lock configured:
  if (storedToken && !tokenMatched) {
    // If token is paired but token does not match, check if IP is bound and matches
    if (storedIp && ipMatched) {
      return {
        allowed: true,
        stationCode: ws.label,
        workstationId: ws.id,
        tokenMatched: false,
        ipMatched: true,
      }
    }

    return {
      allowed: false,
      stationCode: ws.label,
      workstationId: ws.id,
      reason: `Anti-Spoofing Lock: This browser is not registered to terminal ${ws.label}. Cannot submit reports across terminals.`,
      tokenMatched: false,
      ipMatched: false,
    }
  }

  return {
    allowed: true,
    stationCode: ws.label,
    workstationId: ws.id,
    tokenMatched: Boolean(tokenMatched),
    ipMatched: Boolean(ipMatched),
  }
}

/**
 * Pairs a physical workstation browser to a persistent cryptographic token (Admin/In-Charge only).
 */
export async function pairWorkstationTerminal(
  workstationId: string,
  customToken?: string,
  lanIp?: string
): Promise<{ success: boolean; pairingToken?: string; error?: string }> {
  const { isPrivileged } = await getAuthContext()
  if (!isPrivileged) {
    return { success: false, error: 'Unauthorized: Only Lab In-Charges or Administrators can pair terminals.' }
  }

  const pool = getPgPool()
  const generatedToken = customToken?.trim() || `WT-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`

  try {
    const updateQuery = `
      UPDATE public.workstations
      SET 
        pairing_token = $1,
        lan_ip = COALESCE($2, lan_ip),
        updated_at = NOW()
      WHERE id = $3 OR LOWER(label) = LOWER($3)
      RETURNING id, label, pairing_token, lan_ip
    `
    const res = await pool.query(updateQuery, [generatedToken, lanIp?.trim() || null, workstationId])
    if (res.rows.length === 0) {
      return { success: false, error: 'Workstation not found.' }
    }

    revalidatePath('/computer-lab')
    return { success: true, pairingToken: generatedToken }
  } catch (err: any) {
    console.error('Error pairing terminal:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Removes pairing token lock from a workstation.
 */
export async function unpairWorkstationTerminal(
  workstationId: string
): Promise<{ success: boolean; error?: string }> {
  const { isPrivileged } = await getAuthContext()
  if (!isPrivileged) {
    return { success: false, error: 'Unauthorized.' }
  }

  const pool = getPgPool()
  try {
    await pool.query(
      `UPDATE public.workstations SET pairing_token = NULL, updated_at = NOW() WHERE id = $1 OR LOWER(label) = LOWER($1)`,
      [workstationId]
    )
    revalidatePath('/computer-lab')
    return { success: true }
  } catch (err: any) {
    console.error('Error unpairing terminal:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Submits a zero-login student assistance request or problem report from a lab terminal.
 */
export async function submitStudentIssueReport(
  input: SubmitStudentReportInput
): Promise<{ success: boolean; issueId?: string; error?: string }> {
  try {
    const { stationCode, issueTag, title, description, studentName, studentRoll, pairingToken, clientIp } = input

    if (!stationCode || !title) {
      return { success: false, error: 'Station code and issue title are required.' }
    }

    // 1. Anti-Spoofing Security Verification
    const verification = await verifyTerminalAccess(
      stationCode,
      pairingToken ?? undefined,
      clientIp ?? undefined
    )
    if (!verification.allowed) {
      return { success: false, error: verification.reason || 'Terminal verification failed.' }
    }

    const pool = getPgPool()
    const workstationId = verification.workstationId

    // Map severity based on issue tag or default to medium
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
    if (issueTag === 'system_freeze') severity = 'critical'
    else if (issueTag === 'missing_software' || issueTag === 'no_internet') severity = 'high'
    else if (issueTag === 'peripherals') severity = 'low'

    const reporterName = studentName?.trim()
      ? `${studentName.trim()}${studentRoll ? ` (Roll ${studentRoll})` : ''}`
      : `Terminal ${verification.stationCode}`

    const insertQuery = `
      INSERT INTO public.workstation_issues (
        workstation_id,
        title,
        description,
        severity,
        status,
        reported_by_id,
        reported_by_name,
        source,
        student_name,
        student_roll,
        photos,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, 'open', NULL, $5, 'student_terminal', $6, $7, '[]'::jsonb, NOW(), NOW())
      RETURNING id
    `
    const insertRes = await pool.query(insertQuery, [
      workstationId,
      title.trim(),
      description?.trim() || null,
      severity,
      reporterName,
      studentName?.trim() || null,
      studentRoll ? String(studentRoll).trim() : null,
    ])

    const issueId = insertRes.rows[0]?.id

    // Record audit event
    await recordAuditEvent({
      action: 'CREATE',
      entityType: 'workstation_issue',
      entityId: issueId,
      entityLabel: `Terminal ${verification.stationCode} Help Request: ${title}`,
      after: {
        workstation_id: workstationId,
        station_code: verification.stationCode,
        title,
        severity,
        source: 'student_terminal',
        student: reporterName,
      },
      metadata: {
        client_ip: clientIp,
        issue_tag: issueTag,
      },
    })

    revalidatePath('/computer-lab')
    revalidatePath('/maintenance')
    revalidatePath(`/terminal/${encodeURIComponent(stationCode)}`)

    return { success: true, issueId }
  } catch (err: any) {
    console.error('Error submitting student issue report:', err)
    return { success: false, error: err.message || 'Failed to submit assistance report.' }
  }
}

/**
 * Fetches pending assistance requests submitted from student terminals (for Live Cockpit beacon).
 */
export async function getLiveAssistanceRequests(
  labId: string = 'comp'
): Promise<{
  success: boolean
  requests: Array<{
    id: string
    workstationId: string
    stationLabel: string
    title: string
    description: string | null
    severity: string
    studentName: string | null
    studentRoll: string | null
    createdAt: string
  }>
  error?: string
}> {
  try {
    // 1. Try Supabase PostgREST client first (HTTPS, resilient against TCP pooler socket drops)
    try {
      const supabase = await createClient()
      const { data: issues, error: sbErr } = await (supabase
        .from('workstation_issues') as any)
        .select(`
          id,
          workstation_id,
          title,
          description,
          severity,
          student_name,
          student_roll,
          created_at,
          workstations!inner (
            id,
            label,
            lab_id
          )
        `)
        .eq('status', 'open')
        .eq('source', 'student_terminal')
        .eq('workstations.lab_id', labId)
        .order('created_at', { ascending: false })
        .limit(10)

      if (!sbErr && issues) {
        const requests = (issues as any[]).map((r) => ({
          id: r.id,
          workstationId: r.workstation_id,
          stationLabel: r.workstations?.label || 'PC',
          title: r.title,
          description: r.description,
          severity: r.severity,
          studentName: r.student_name,
          studentRoll: r.student_roll,
          createdAt: typeof r.created_at === 'string' ? r.created_at : new Date(r.created_at).toISOString(),
        }))
        return { success: true, requests }
      }
    } catch {
      // Continue to pg pool fallback
    }

    // 2. Resilient PG pool fallback
    const pool = getPgPool()
    const query = `
      SELECT 
        i.id,
        i.workstation_id,
        w.label as station_label,
        i.title,
        i.description,
        i.severity,
        i.student_name,
        i.student_roll,
        i.created_at
      FROM public.workstation_issues i
      JOIN public.workstations w ON w.id = i.workstation_id
      WHERE w.lab_id = $1 
        AND i.status = 'open' 
        AND i.source = 'student_terminal'
      ORDER BY i.created_at DESC
      LIMIT 10
    `
    const res = await pool.query(query, [labId])
    const requests = res.rows.map((r) => ({
      id: r.id,
      workstationId: r.workstation_id,
      stationLabel: r.station_label,
      title: r.title,
      description: r.description,
      severity: r.severity,
      studentName: r.student_name,
      studentRoll: r.student_roll,
      createdAt: r.created_at?.toISOString?.() || r.created_at,
    }))

    return { success: true, requests }
  } catch {
    // Return empty array gracefully rather than crashing with unhandled connection timeouts
    return { success: true, requests: [] }
  }
}

/**
 * Acknowledges or dismisses a live assistance beacon from the teacher cockpit.
 */
export async function acknowledgeAssistanceRequest(
  issueId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const pool = getPgPool()
    await pool.query(
      `UPDATE public.workstation_issues SET status = 'acknowledged', updated_at = NOW() WHERE id = $1`,
      [issueId]
    )
    revalidatePath('/computer-lab')
    return { success: true }
  } catch (err: any) {
    console.error('Error acknowledging assistance request:', err)
    return { success: false, error: err.message }
  }
}
