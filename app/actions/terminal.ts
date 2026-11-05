'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getPgPool } from '@/lib/db'
import { getServerUserScope } from '@/lib/context/server-user-scope'
import { recordAuditEvent } from '@/lib/audit/audit-ledger'
import { verifyTerminalSessionToken } from '@/lib/security/terminal-token'
import { getServerEffectiveTime, parseScheduleTimeToMinutes } from '@/lib/server-effective-time'
import type {
  TerminalContextData,
  SubmitStudentReportInput,
  TerminalVerificationResult,
} from '@/lib/types/terminal'

async function getAuthContext() {
  try {
    const scope = await getServerUserScope()
    const isPrivileged =
      !scope.isPending &&
      scope.approvalStatus === 'approved' &&
      (scope.isPrivileged ||
        scope.role === 'super_admin' ||
        scope.role === 'lab_incharge' ||
        scope.role === 'hod')

    return { scope, isPrivileged }
  } catch {
    return {
      scope: {
        role: 'teacher',
        userId: '',
        fullName: 'Guest User',
        isPending: true,
        approvalStatus: 'pending',
        isPrivileged: false,
        assignedLabs: [],
        assignedClasses: [],
        assignedSubjects: [],
      } as any,
      isPrivileged: false,
    }
  }
}

/**
 * Resolves verified terminal session from the HttpOnly session cookie.
 */
export async function getActiveTerminalSession(): Promise<{
  authenticated: boolean
  stationId?: string
  stationCode?: string
  machineGuid?: string
  error?: string
}> {
  try {
    const cookieStore = await cookies()
    const sessionCookie =
      cookieStore.get('labsync_terminal_session')?.value ||
      cookieStore.get('labsync_terminal_auth')?.value
    if (!sessionCookie) {
      return { authenticated: false, error: 'No active terminal session cookie.' }
    }

    const verified = verifyTerminalSessionToken(sessionCookie)
    if (!verified.valid || !verified.payload) {
      return { authenticated: false, error: verified.reason || 'Session cookie expired or invalid.' }
    }

    return {
      authenticated: true,
      stationId: verified.payload.stationId,
      stationCode: verified.payload.stationCode,
      machineGuid: verified.payload.machineGuid,
    }
  } catch (err: any) {
    return { authenticated: false, error: err.message }
  }
}

/**
 * Resolves context for a student terminal (PC identifier, lab, current student, active practical).
 */
export async function getTerminalContext(
  stationCode: string,
  token?: string,
  clientIp?: string,
  clientSimulatedTimeMs?: number
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
        w.machine_guid,
        w.hardware_specs,
        w.last_seen_at,
        w.is_active,
        l.name as lab_name
      FROM public.workstations w
      LEFT JOIN public.labs l ON l.id = w.lab_id
      WHERE (LOWER(w.label) = LOWER($1) OR w.id::text = $1)
      LIMIT 1
    `
    let wsRes
    try {
      wsRes = await pool.query(wsQuery, [trimmedCode])
    } catch (queryErr: any) {
      if (queryErr.message?.includes('Connection terminated') || queryErr.code === 'ECONNRESET') {
        // Immediate 1-time retry on transient PgBouncer socket recycle
        wsRes = await pool.query(wsQuery, [trimmedCode])
      } else {
        throw queryErr
      }
    }
    if (wsRes.rows.length === 0) {
      return { success: false, error: `Workstation "${trimmedCode}" not found in laboratory database.` }
    }

    const ws = wsRes.rows[0]
    const workstationId = ws.id
    const labId = ws.lab_id || 'comp'
    const labName = ws.lab_name || 'Computer Laboratory'
    const storedToken = ws.pairing_token || null
    const isPaired = Boolean(storedToken)

    // 2. Identify active scheduled session (if any) respecting real or simulated time
    const timeInfo = await getServerEffectiveTime(clientSimulatedTimeMs)
    const { effectiveDateStr, dayKey, currentMinutes } = timeInfo

    const scheduleQuery = `
      SELECT 
        s.id,
        s.subject_name,
        s.batch_name,
        s.start_time,
        s.end_time,
        s.status,
        s.class_subject_id,
        cs.class_id,
        cs.academic_year_id,
        p.full_name as teacher_name
      FROM public.schedules s
      LEFT JOIN public.class_subjects cs ON cs.id = s.class_subject_id
      LEFT JOIN public.profiles p ON p.id = s.teacher_id
      WHERE s.lab_id = $1 
        AND LOWER(s.day_key) = LOWER($2)
      ORDER BY s.start_time ASC
    `
    const schedRes = await pool.query(scheduleQuery, [labId, dayKey])
    const todaySchedules = schedRes.rows

    let activeSessionRow = null
    let upcomingSessionRow = null

    for (const row of todaySchedules) {
      const startMin = parseScheduleTimeToMinutes(row.start_time)
      const endMin = parseScheduleTimeToMinutes(row.end_time)
      if (currentMinutes >= startMin && currentMinutes < endMin) {
        activeSessionRow = row
        break
      }
      if (currentMinutes < startMin && !upcomingSessionRow) {
        upcomingSessionRow = row
      }
    }

    const selectedSchedule =
      activeSessionRow ||
      todaySchedules.find((s) => s.status === 'in_progress') ||
      upcomingSessionRow ||
      todaySchedules[0] ||
      null

    let activeSession = null
    let activeClassId: string | null = null
    let activeYearId: string = '2083'

    if (selectedSchedule) {
      let remainingMinutes: number | undefined
      if (selectedSchedule.end_time) {
        const endMin = parseScheduleTimeToMinutes(selectedSchedule.end_time)
        const startMin = parseScheduleTimeToMinutes(selectedSchedule.start_time)
        if (currentMinutes >= startMin && currentMinutes < endMin) {
          remainingMinutes = Math.max(0, endMin - currentMinutes)
        }
      }

      let practicalTitle: string | undefined
      let topicLearned: string | undefined

      try {
        const logQuery = `
          SELECT practical_title, topic_learned
          FROM public.practical_logs
          WHERE (schedule_id::text = $1 OR (lab_id = $2 AND date = $3))
            AND practical_title IS NOT NULL
          ORDER BY created_at DESC
          LIMIT 1
        `
        const logRes = await pool.query(logQuery, [selectedSchedule.id, labId, effectiveDateStr])
        if (logRes.rows.length > 0 && logRes.rows[0].practical_title) {
          practicalTitle = logRes.rows[0].practical_title
          topicLearned = logRes.rows[0].topic_learned || undefined
        }
      } catch {
        // Graceful fallback
      }

      activeSession = {
        scheduleId: selectedSchedule.id,
        subjectName: selectedSchedule.subject_name || 'Laboratory Practical',
        teacherName: selectedSchedule.teacher_name || 'Faculty Instructor',
        startTime: selectedSchedule.start_time || '',
        endTime: selectedSchedule.end_time || '',
        batchName: selectedSchedule.batch_name || '',
        practicalTitle: practicalTitle || 'Standard Laboratory Practical Session',
        topicLearned,
        remainingMinutes,
      }
      activeClassId = selectedSchedule.class_id || null
      activeYearId = selectedSchedule.academic_year_id || '2083'
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
        AND (sso.session_date = $2 OR ($3::text IS NOT NULL AND sso.schedule_id::text = $3::text))
      ORDER BY sso.created_at DESC
      LIMIT 1
    `
    const overrideRes = await pool.query(overrideQuery, [workstationId, effectiveDateStr, schedId])

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
    } else if (activeClassId) {
      // 3B. No temporary relocation to this station: Check baseline Tier 1 seat plan FOR ACTIVE CLASS
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
          AND sp.class_id = $2
          AND sp.academic_year_id = $3
        ORDER BY sp.created_at DESC
        LIMIT 1
      `
      const seatRes = await pool.query(seatQuery, [workstationId, activeClassId, activeYearId])
      if (seatRes.rows.length > 0) {
        const seat = seatRes.rows[0]

        // Check if this baseline student was relocated to a DIFFERENT workstation today
        const movedAwayQuery = `
          SELECT sso.workstation_id
          FROM public.session_seat_overrides sso
          WHERE sso.enrollment_id = $1
            AND (sso.session_date = $2 OR ($3::text IS NOT NULL AND sso.schedule_id::text = $3::text))
            AND sso.workstation_id != $4
          LIMIT 1
        `
        const movedAwayRes = await pool.query(movedAwayQuery, [
          seat.enrollment_id,
          effectiveDateStr,
          schedId,
          workstationId,
        ])

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
      machineGuid: ws.machine_guid,
      hardwareSpecs: ws.hardware_specs,
      lastSeenAt: ws.last_seen_at?.toISOString?.() || ws.last_seen_at,
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

    // 1. Anti-Spoofing Security Verification (HttpOnly Session Cookie prioritized)
    let workstationId: string
    let effectiveStationCode = stationCode

    const activeSession = await getActiveTerminalSession()
    if (activeSession.authenticated && activeSession.stationId && activeSession.stationCode) {
      workstationId = activeSession.stationId
      effectiveStationCode = activeSession.stationCode
    } else {
      // Fallback verification for paired browsers or admin tests
      const verification = await verifyTerminalAccess(
        stationCode,
        pairingToken ?? undefined,
        clientIp ?? undefined
      )
      if (!verification.allowed) {
        return { success: false, error: verification.reason || 'Terminal verification failed.' }
      }
      workstationId = verification.workstationId
      effectiveStationCode = verification.stationCode
    }

    const pool = getPgPool()

    // 2A. Anti-Spam Repetitive Blocker: Check if an open ticket for this exact issue already exists on this workstation
    const duplicateCheck = await pool.query(
      `SELECT id, title, created_at 
       FROM public.workstation_issues
       WHERE workstation_id = $1 
         AND source = 'student_terminal'
         AND status = 'open'
         AND (LOWER(title) = LOWER($2) OR description ILIKE $3)
       LIMIT 1;`,
      [workstationId, title.trim(), `%${title.trim()}%`]
    )

    if (duplicateCheck.rows.length > 0) {
      return {
        success: false,
        error: `A ticket for "${title.trim()}" is already active on workstation ${effectiveStationCode}. Please wait for the instructor to address it.`,
      }
    }

    // 2B. Maximum Open Tickets Ceiling: Max 3 concurrent open tickets per workstation
    const openCountCheck = await pool.query(
      `SELECT count(*)::int as active_open
       FROM public.workstation_issues
       WHERE workstation_id = $1 
         AND source = 'student_terminal'
         AND status = 'open';`,
      [workstationId]
    )

    const activeOpen = openCountCheck.rows[0]?.active_open || 0
    if (activeOpen >= 3) {
      return {
        success: false,
        error: `Workstation ${effectiveStationCode} already has 3 active tickets awaiting instructor assistance. Please wait for an existing ticket to be acknowledged.`,
      }
    }

    // 2C. Sliding Window Rate Limiter: Max 3 requests every 10 minutes per workstation
    const windowRateCheck = await pool.query(
      `SELECT count(*)::int as recent_count
       FROM public.workstation_issues
       WHERE workstation_id = $1 
         AND source = 'student_terminal'
         AND created_at > NOW() - INTERVAL '10 minutes';`,
      [workstationId]
    )

    const recentCount = windowRateCheck.rows[0]?.recent_count || 0
    if (recentCount >= 3) {
      return {
        success: false,
        error: `Assistance request limit reached (maximum 3 requests every 10 minutes). Anti-spam cooldown active: Please wait before submitting another request.`,
      }
    }

    // Map severity based on issue tag or default to medium
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
    if (issueTag === 'app_freeze' || issueTag === 'system_freeze') severity = 'critical'
    else if (issueTag === 'missing_software' || issueTag === 'no_internet') severity = 'high'
    else if (issueTag === 'display_issue') severity = 'medium'
    else if (issueTag === 'peripherals' || issueTag === 'audio_issue') severity = 'low'

    const reporterName = studentName?.trim()
      ? `${studentName.trim()}${studentRoll ? ` (Roll ${studentRoll})` : ''}`
      : `Terminal ${effectiveStationCode}`

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

    // Dispatch system notifications for Super Admin and Lab In-Charge
    const notifSeverity = severity === 'critical' ? 'critical' : severity === 'high' ? 'warning' : 'info'
    const notifs = [
      {
        id: `notif-student-help-${issueId}-admin`,
        target_role: 'super_admin',
        target_lab_id: 'comp',
        title: `🚨 Student Assistance: ${effectiveStationCode}`,
        message: `${reporterName}: ${title.trim()}${description?.trim() ? ` — ${description.trim()}` : ''}. Terminal assistance requested.`,
        severity: notifSeverity,
      },
      {
        id: `notif-student-help-${issueId}-incharge`,
        target_role: 'lab_incharge',
        target_lab_id: 'comp',
        title: `Student Assistance: ${effectiveStationCode}`,
        message: `${reporterName}: ${title.trim()}${description?.trim() ? ` — ${description.trim()}` : ''}. Station requires attention.`,
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

    // Record audit event
    await recordAuditEvent({
      action: 'CREATE',
      entityType: 'workstation_issue',
      entityId: issueId,
      entityLabel: `Terminal ${effectiveStationCode} Help Request: ${title}`,
      after: {
        workstation_id: workstationId,
        station_code: effectiveStationCode,
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

      if (!sbErr && issues && issues.length > 0) {
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
    await pool.query(
      `UPDATE public.lab_notifications SET is_read = true WHERE id LIKE $1;`,
      [`%${issueId}%`]
    )
    revalidatePath('/computer-lab')
    return { success: true }
  } catch (err: any) {
    console.error('Error acknowledging assistance request:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Allows a student to withdraw/cancel their own active assistance request.
 */
export async function cancelStudentAssistanceRequest(
  stationCode: string,
  issueId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const activeSession = await getActiveTerminalSession()
    const pool = getPgPool()

    let workstationId: string
    if (activeSession.authenticated && activeSession.stationId) {
      workstationId = activeSession.stationId
    } else {
      const wsRes = await pool.query(`SELECT id FROM public.workstations WHERE LOWER(label) = LOWER($1)`, [stationCode])
      if (wsRes.rows.length === 0) return { success: false, error: 'Workstation not found.' }
      workstationId = wsRes.rows[0].id
    }

    const res = await pool.query(
      `UPDATE public.workstation_issues
       SET status = 'resolved',
           resolved_at = NOW(),
           resolution_notes = 'Cancelled by student from terminal',
           updated_at = NOW()
       WHERE id = $1 AND workstation_id = $2 AND status = 'open'
       RETURNING id, title;`,
      [issueId, workstationId]
    )

    if (res.rows.length === 0) {
      return { success: false, error: 'Active issue not found or already resolved.' }
    }

    try {
      revalidatePath('/computer-lab')
      revalidatePath(`/terminal/${stationCode}`)
    } catch {}

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to cancel request.' }
  }
}

