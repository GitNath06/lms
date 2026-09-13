'use server'

import { getPgPool } from '@/lib/db'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getNepalDateStr, getNepaliDate } from '@/lib/nepali-date'
import { MASTER_ROUTINE, MasterRoutineItem } from '@/lib/master-data'
import { getAcademicHolidays } from '@/app/actions/holidays'
import {
  sendTeacherDailyScheduleEmail,
  sendSkippedSessionAlertEmail,
  sendIncidentAlertEmail,
  sendOverdueMaintenanceEmail,
  sendUpcomingHolidayLabNoticeEmail,
  sendNewUserRegistrationAdminAlertEmail,
} from '@/lib/mailer'

// In-memory fallback for local dev when PostgreSQL is offline
const IN_MEMORY_DISPATCH_LOGS = new Set<string>()

/**
 * Idempotency Check & Record
 * Returns TRUE if dispatch should proceed (not yet sent today).
 * Returns FALSE if duplicate already exists.
 */
export async function checkAndRecordDispatch(
  dispatchType: string,
  recipientEmail: string,
  referenceDate: string,
  metadata: Record<string, any> = {}
): Promise<boolean> {
  const normalizedEmail = recipientEmail.trim().toLowerCase()
  const cacheKey = `${dispatchType}:${normalizedEmail}:${referenceDate}`

  // Check PostgreSQL if pool is available
  try {
    const pool = getPgPool()
    const res = await pool.query(
      `
      INSERT INTO public.email_dispatch_logs (dispatch_type, recipient_email, reference_date, metadata)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (dispatch_type, recipient_email, reference_date) DO NOTHING
      RETURNING id;
      `,
      [dispatchType, normalizedEmail, referenceDate, JSON.stringify(metadata)]
    )

    // If a row was returned, this is the first dispatch
    if (res.rows.length > 0) {
      IN_MEMORY_DISPATCH_LOGS.add(cacheKey)
      return true
    }
    // Duplicate detected in DB
    return false
  } catch (err) {
    // Graceful in-memory fallback
    if (IN_MEMORY_DISPATCH_LOGS.has(cacheKey)) {
      return false
    }
    IN_MEMORY_DISPATCH_LOGS.add(cacheKey)
    return true
  }
}

/**
 * 1. Dispatch Daily Practical Reminders to Teachers (7:00 AM NPT)
 */
export async function dispatchTeacherDailyReminders(force = false) {
  const todayDateStr = getNepalDateStr(new Date())
  const nepaliObj = getNepaliDate(new Date())
  const dayOfWeek = new Date().getDay() // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat

  // Saturday is academic recess in Nepal
  if (dayOfWeek === 6) {
    return {
      success: true,
      message: 'Saturday is academic recess in Nepal. No schedule reminders dispatched.',
      dispatchedCount: 0,
    }
  }

  const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri']
  const todayKey = DAY_KEYS[dayOfWeek] || 'sun'

  // Fetch active routines for today
  const todaysSessions = MASTER_ROUTINE.filter(
    (r: MasterRoutineItem) => r.dayKey === todayKey && (r.category as string) !== 'Recess'
  )

  if (todaysSessions.length === 0) {
    return {
      success: true,
      message: 'No practical sessions scheduled for today.',
      dispatchedCount: 0,
    }
  }

  // Group by Teacher
  const teacherSessionsMap = new Map<string, MasterRoutineItem[]>()
  todaysSessions.forEach((s: MasterRoutineItem) => {
    const teacherKey = s.teacher || 'Unassigned'
    if (!teacherSessionsMap.has(teacherKey)) {
      teacherSessionsMap.set(teacherKey, [])
    }
    teacherSessionsMap.get(teacherKey)!.push(s)
  })

  // Lookup teacher emails from database profiles
  let teacherProfiles: Array<{ full_name: string; email: string }> = []
  try {
    const pool = getPgPool()
    const res = await pool.query(
      `SELECT full_name, email FROM public.profiles WHERE is_active = TRUE AND email IS NOT NULL;`
    )
    teacherProfiles = res.rows
  } catch (err) {
    console.warn('[Mailer] Could not query teacher profiles from DB:', err)
  }

  let dispatchedCount = 0
  let skippedDuplicates = 0
  const results: any[] = []

  for (const [teacherName, sessions] of teacherSessionsMap.entries()) {
    // Find matching email or generate clean fallback
    const matchedProfile = teacherProfiles.find(
      (p) =>
        p.full_name?.toLowerCase().includes(teacherName.toLowerCase()) ||
        teacherName.toLowerCase().includes(p.full_name?.toLowerCase())
    )

    const recipientEmail =
      matchedProfile?.email ||
      `${teacherName.toLowerCase().replace(/[^a-z0-9]/g, '')}@rrl.edu.np`

    // Idempotency check
    if (!force) {
      const isAllowed = await checkAndRecordDispatch(
        'daily_digest',
        recipientEmail,
        todayDateStr,
        { teacherName, sessionCount: sessions.length }
      )
      if (!isAllowed) {
        skippedDuplicates++
        results.push({ teacher: teacherName, status: 'skipped_duplicate' })
        continue
      }
    }

    const emailRes = await sendTeacherDailyScheduleEmail({
      to: recipientEmail,
      teacherName,
      dateStr: todayDateStr,
      nepaliDateStr: `${nepaliObj.dayName}, ${nepaliObj.bsMonthName} ${nepaliObj.bsDay}, ${nepaliObj.bsYear}`,
      sessions: sessions.map((s: MasterRoutineItem) => ({
        timeSlot: s.timeSlot,
        labName: s.lab || 'Laboratory',
        subjectCode: s.subjectCode,
        subjectTitle: s.subjectTitle,
        gradeBatch: `${s.grade} (${s.gradeKey || ''})`,
        defaultStudents: s.defaultStudents,
      })),
    })

    dispatchedCount++
    results.push({ teacher: teacherName, recipient: recipientEmail, status: 'dispatched', emailRes })
  }

  return {
    success: true,
    today: todayDateStr,
    dispatchedCount,
    skippedDuplicates,
    results,
  }
}

/**
 * 2. Dispatch Skipped Session Alert to Teacher
 */
export async function dispatchSkippedSessionNotification(logRecord: any) {
  try {
    const teacherName = logRecord.teacher_name || logRecord.teacher || 'Instructor'
    let recipientEmail = logRecord.teacher_email || ''

    if (!recipientEmail) {
      try {
        const pool = getPgPool()
        const res = await pool.query(
          `SELECT email FROM public.profiles WHERE full_name ILIKE $1 AND is_active = TRUE LIMIT 1;`,
          [`%${teacherName}%`]
        )
        if (res.rows.length > 0) {
          recipientEmail = res.rows[0].email
        }
      } catch (e) {}
    }

    if (!recipientEmail) {
      recipientEmail = `${teacherName.toLowerCase().replace(/[^a-z0-9]/g, '')}@rrl.edu.np`
    }

    await sendSkippedSessionAlertEmail({
      to: recipientEmail,
      teacherName,
      subjectCode: logRecord.subject_code || logRecord.subjectCode || 'PRACTICAL',
      subjectTitle: logRecord.subject_title || logRecord.subjectTitle || logRecord.subject_name || 'Lab Session',
      timeSlot: logRecord.time_slot || logRecord.timeSlot || logRecord.period_label || 'Scheduled Slot',
      labName: logRecord.lab_name || logRecord.lab || 'Laboratory',
      gradeBatch: logRecord.class_grade || logRecord.grade || logRecord.batch_group || 'Class 12',
      skipReason: logRecord.skip_reason || logRecord.skipReason || 'Class conducted in regular classroom / Lecture',
      loggedBy: logRecord.logged_by_name || logRecord.logged_by,
    })

    return { success: true }
  } catch (err: any) {
    console.error('[Mailer] Failed to dispatch skipped session alert:', err)
    return { success: false, error: err.message }
  }
}

/**
 * 3. Dispatch Incident & Breakage Alert to Lab In-Charge, Coordinator & HOD
 */
export async function dispatchIncidentEmailAlert(incident: any, isEscalated = false) {
  try {
    let leadershipEmails: Array<{ full_name: string; email: string; role: string }> = []
    try {
      const pool = getPgPool()
      const res = await pool.query(
        `
        SELECT full_name, email, role 
        FROM public.profiles 
        WHERE role IN ('lab_incharge', 'coordinator', 'hod', 'super_admin') 
          AND is_active = TRUE 
          AND email IS NOT NULL;
        `
      )
      leadershipEmails = res.rows
    } catch (err) {
      console.warn('[Mailer] Could not query leadership profiles for incident alert:', err)
    }

    if (leadershipEmails.length === 0) {
      leadershipEmails = [
        { full_name: 'Lab In-Charge', email: process.env.GMAIL_USER || 'admin@rrl.edu.np', role: 'lab_incharge' },
      ]
    }

    const labName =
      incident.lab_id === 'comp'
        ? 'Computer Engineering Lab'
        : incident.lab_id === 'phys'
        ? 'Physics Laboratory'
        : incident.lab_id === 'chem'
        ? 'Chemistry Laboratory'
        : incident.lab_id === 'bio'
        ? 'Biology Laboratory'
        : `${incident.lab_id?.toUpperCase() || 'Academic'} Lab`

    const incidentPayload = {
      id: incident.id || `inc-${Date.now()}`,
      title: incident.title || 'Equipment Breakage Incident',
      labName,
      equipmentName: incident.equipment_name || 'Lab Equipment',
      severity: incident.severity || 'moderate',
      incidentType: incident.incident_type || 'breakage',
      sessionLabel: incident.session_label || 'Scheduled Slot',
      batchName: incident.batch_name || 'Practical Group',
      reportedBy: incident.reported_by || 'Faculty Member',
      circumstances: incident.circumstances,
      studentRolls: incident.student_rolls,
    }

    // Dispatch to relevant roles
    for (const recipient of leadershipEmails) {
      // Teachers don't receive this; only incharge, coordinator, hod, super_admin
      await sendIncidentAlertEmail({
        to: recipient.email,
        recipientName: recipient.full_name,
        incident: incidentPayload,
        isEscalated,
        escalationReason: incident.escalation_reason,
      })
    }

    return { success: true, count: leadershipEmails.length }
  } catch (err: any) {
    console.error('[Mailer] Failed to dispatch incident email alert:', err)
    return { success: false, error: err.message }
  }
}

/**
 * 4. Dispatch Overdue Maintenance Alerts to Lab In-Charges (Daily Cron)
 */
export async function dispatchOverdueMaintenanceAlerts(force = false) {
  const todayDateStr = getNepalDateStr(new Date())

  try {
    const pool = getPgPool()
    // Query overdue maintenance reminders
    const res = await pool.query(`
      SELECT 
        r.id as reminder_id,
        r.due_date,
        r.snoozed_until,
        r.status,
        p.title as plan_title,
        p.interval_days,
        p.category,
        p.lab_id,
        l.name as lab_name,
        CURRENT_DATE - COALESCE(r.snoozed_until::date, r.due_date::date) as overdue_days
      FROM public.maintenance_reminders r
      JOIN public.maintenance_plans p ON r.plan_id = p.id
      JOIN public.labs l ON p.lab_id = l.id
      WHERE r.status IN ('pending', 'overdue')
        AND COALESCE(r.snoozed_until::date, r.due_date::date) < CURRENT_DATE
      ORDER BY overdue_days DESC;
    `)

    if (res.rows.length === 0) {
      return { success: true, message: 'Zero overdue maintenance reminders.', dispatchedCount: 0 }
    }

    // Group overdue tasks by lab
    const labTasksMap = new Map<string, { labName: string; tasks: any[] }>()
    res.rows.forEach((row) => {
      if (!labTasksMap.has(row.lab_id)) {
        labTasksMap.set(row.lab_id, { labName: row.lab_name, tasks: [] })
      }
      const interval = row.interval_days || 30
      const cadenceText =
        interval <= 1 ? 'daily' : interval <= 7 ? 'weekly' : interval <= 30 ? 'monthly' : 'quarterly'

      labTasksMap.get(row.lab_id)!.tasks.push({
        title: row.plan_title,
        overdueDays: Math.max(1, row.overdue_days),
        cadence: cadenceText,
        category: row.category,
      })
    })

    // Query lab in-charges and super admins
    const profileRes = await pool.query(`
      SELECT full_name, email, role 
      FROM public.profiles 
      WHERE role IN ('lab_incharge', 'super_admin') 
        AND is_active = TRUE 
        AND email IS NOT NULL;
    `)
    const inchargeProfiles = profileRes.rows

    let dispatchedCount = 0
    let skippedCount = 0

    for (const [labId, { labName, tasks }] of labTasksMap.entries()) {
      for (const incharge of inchargeProfiles) {
        if (!force) {
          const isAllowed = await checkAndRecordDispatch(
            'overdue_maintenance',
            incharge.email,
            todayDateStr,
            { labId, taskCount: tasks.length }
          )
          if (!isAllowed) {
            skippedCount++
            continue
          }
        }

        await sendOverdueMaintenanceEmail({
          to: incharge.email,
          recipientName: incharge.full_name,
          labName,
          overdueTasks: tasks,
        })
        dispatchedCount++
      }
    }

    return { success: true, dispatchedCount, skippedCount, overdueLabCount: labTasksMap.size }
  } catch (err: any) {
    console.error('[Mailer] Error scanning overdue maintenance:', err)
    return { success: false, error: err.message }
  }
}

/**
 * 5. Dispatch Upcoming Holiday Lab Shutdown Notice (48h Notice)
 */
export async function dispatchUpcomingHolidayNotices(force = false) {
  try {
    const holidays = await getAcademicHolidays()
    const now = new Date()
    const todayStr = getNepalDateStr(now)

    // Find holidays starting within next 48 hours (0 to 2 days)
    const upcomingHolidays = holidays.filter((h) => {
      const hDate = new Date(h.dateStr)
      const diffMs = hDate.getTime() - now.getTime()
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
      return diffDays >= 0 && diffDays <= 2
    })

    if (upcomingHolidays.length === 0) {
      return { success: true, message: 'No holidays starting within 48h.', dispatchedCount: 0 }
    }

    let inchargeProfiles: Array<{ full_name: string; email: string }> = []
    try {
      const pool = getPgPool()
      const res = await pool.query(`
        SELECT full_name, email 
        FROM public.profiles 
        WHERE role IN ('lab_incharge', 'super_admin') 
          AND is_active = TRUE 
          AND email IS NOT NULL;
      `)
      inchargeProfiles = res.rows
    } catch (e) {}

    if (inchargeProfiles.length === 0) {
      inchargeProfiles = [{ full_name: 'Lab In-Charge', email: process.env.GMAIL_USER || 'admin@rrl.edu.np' }]
    }

    let dispatchedCount = 0

    for (const h of upcomingHolidays) {
      const hDate = new Date(h.dateStr)
      const diffDays = Math.max(0, Math.ceil((hDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))

      for (const incharge of inchargeProfiles) {
        if (!force) {
          const isAllowed = await checkAndRecordDispatch(
            'holiday_notice',
            incharge.email,
            h.dateStr,
            { holidayTitle: h.title }
          )
          if (!isAllowed) continue
        }

        await sendUpcomingHolidayLabNoticeEmail({
          to: incharge.email,
          recipientName: incharge.full_name,
          holidayName: h.name || h.title,
          dateSpanStr: h.dateStr === h.endDateStr ? h.dateStr : `${h.dateStr} to ${h.endDateStr}`,
          nepaliDateStr: h.bsDateStr,
          upcomingInDays: diffDays,
        })
        dispatchedCount++
      }
    }

    return { success: true, dispatchedCount, holidaysFound: upcomingHolidays.length }
  } catch (err: any) {
    console.error('[Mailer] Error in upcoming holiday dispatch:', err)
    return { success: false, error: err.message }
  }
}

/**
 * 6. Dispatch New User Registration Notice to Admins
 */
export async function dispatchNewUserRegistrationAlert(newUser: {
  fullName: string
  email: string
  role: string
  registeredAt?: string
}) {
  try {
    let adminProfiles: Array<{ full_name: string; email: string }> = []
    try {
      const pool = getPgPool()
      const res = await pool.query(`
        SELECT full_name, email 
        FROM public.profiles 
        WHERE role IN ('super_admin', 'lab_incharge') 
          AND is_active = TRUE 
          AND email IS NOT NULL;
      `)
      adminProfiles = res.rows
    } catch (e) {}

    if (adminProfiles.length === 0) {
      adminProfiles = [{ full_name: 'Super Admin', email: process.env.GMAIL_USER || 'admin@rrl.edu.np' }]
    }

    for (const admin of adminProfiles) {
      await sendNewUserRegistrationAdminAlertEmail({
        to: admin.email,
        adminName: admin.full_name,
        newUser,
      })
    }

    return { success: true, notifiedCount: adminProfiles.length }
  } catch (err: any) {
    console.error('[Mailer] Failed to notify admins of new registration:', err)
    return { success: false, error: err.message }
  }
}

/**
 * 7. Query Email Dispatch Logs for Admin Audit View
 */
export async function getEmailDispatchLogs(limit = 25) {
  try {
    const pool = getPgPool()
    const res = await pool.query(
      `
      SELECT id, dispatch_type, recipient_email, reference_date, metadata, dispatched_at
      FROM public.email_dispatch_logs
      ORDER BY dispatched_at DESC
      LIMIT $1;
      `,
      [limit]
    )
    return { success: true, logs: res.rows }
  } catch (err: any) {
    console.warn('[Mailer] Could not query email dispatch logs:', err)
    return { success: false, logs: [], error: err.message }
  }
}

/**
 * 8. Query Email Notification Engine Health Status
 */
export async function getEmailEngineStatus() {
  const isGmailConfigured = Boolean(
    process.env.GMAIL_USER?.trim() && process.env.GMAIL_APP_PASSWORD?.trim()
  )
  const isCronSecretConfigured = Boolean(process.env.CRON_SECRET?.trim())

  let totalLogs = 0
  let todaysLogs = 0
  const todayStr = getNepalDateStr(new Date())

  try {
    const pool = getPgPool()
    const totalRes = await pool.query(`SELECT COUNT(*) as count FROM public.email_dispatch_logs;`)
    totalLogs = parseInt(totalRes.rows[0]?.count || '0', 10)

    const todayRes = await pool.query(
      `SELECT COUNT(*) as count FROM public.email_dispatch_logs WHERE reference_date = $1;`,
      [todayStr]
    )
    todaysLogs = parseInt(todayRes.rows[0]?.count || '0', 10)
  } catch (e) {}

  return {
    success: true,
    isGmailConfigured,
    senderEmail: process.env.GMAIL_USER || 'no-reply@rrl.edu.np',
    isCronSecretConfigured,
    totalLogs,
    todaysLogs,
    todayStr,
  }
}
