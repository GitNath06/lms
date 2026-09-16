import nodemailer from 'nodemailer'
import { INSTITUTION_NAME } from '@/lib/institution'

interface SendEmailParams {
  to: string
  subject: string
  html: string
  text?: string
}

type Transporter = ReturnType<typeof nodemailer.createTransport>
let cachedTransporter: Transporter | null = null
let lastConfigKey = ''

function getTransporter() {
  const user = process.env.GMAIL_USER?.trim()
  const pass = process.env.GMAIL_APP_PASSWORD?.trim().replace(/\s+/g, '')

  if (user && pass) {
    const configKey = `${user}:${pass}`
    if (!cachedTransporter || lastConfigKey !== configKey) {
      cachedTransporter = nodemailer.createTransport({
        service: 'gmail',
        pool: true,
        maxConnections: 2,
        maxMessages: 50,
        rateDelta: 1000,
        rateLimit: 3, // Max 3 emails per second to prevent Gmail 421/454 throttles
        auth: {
          user,
          pass,
        },
      })
      lastConfigKey = configKey
    }
    return cachedTransporter
  }

  return null
}

export async function sendMail({ to, subject, html, text }: SendEmailParams) {
  const transporter = getTransporter()
  const senderEmail = process.env.GMAIL_USER || 'no-reply@rrl.edu.np'

  if (!transporter) {
    console.log('\n======================================================')
    console.log('📧 [DEV EMAIL PREVIEW - GMAIL CREDENTIALS NOT SET]')
    console.log(`To: ${to}`)
    console.log(`Subject: ${subject}`)
    console.log(`Content:\n${text || 'See HTML body'}`)
    console.log('======================================================\n')
    return { success: true, mode: 'dev-preview' }
  }

  try {
    const info = await transporter.sendMail({
      from: `"LabSync Institutional Portal" <${senderEmail}>`,
      to,
      subject,
      text: text || '',
      html,
    })
    console.log(`✅ Email sent to ${to} (Message ID: ${info.messageId})`)
    return { success: true, messageId: info.messageId }
  } catch (error: any) {
    console.error('❌ Failed to send email via Gmail SMTP:', error)
    return { success: false, error: error.message || 'Failed to dispatch email' }
  }
}

/**
 * 1. Send 6-Digit Email Verification OTP
 */
export async function sendVerificationOtpEmail(to: string, fullName: string, otpCode: string) {
  const subject = `[LabSync] ${otpCode} is your email verification code`
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e4e4e7; border-radius: 16px; overflow: hidden; padding: 32px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; background: #4f46e5; color: #ffffff; padding: 10px 18px; border-radius: 12px; font-weight: bold; font-size: 16px; letter-spacing: 0.5px;">
          ⚗️ LabSync LIMS
        </div>
        <p style="color: #71717a; font-size: 13px; margin-top: 8px;">Laboratory Management & Research Portal</p>
      </div>

      <div style="background: #f8fafc; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px; border: 1px solid #f1f5f9;">
        <h2 style="color: #0f172a; margin: 0 0 10px 0; font-size: 20px;">Verify Your Email Address</h2>
        <p style="color: #475569; font-size: 14px; margin: 0 0 20px 0;">
          Hello <strong>${fullName}</strong>, use the one-time code below to complete your institutional account registration:
        </p>

        <div style="background: #ffffff; border: 2px dashed #4f46e5; border-radius: 12px; padding: 16px; display: inline-block; margin: 0 auto;">
          <span style="font-family: monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #4f46e5;">
            ${otpCode}
          </span>
        </div>

        <p style="color: #dc2626; font-size: 12px; margin: 16px 0 0 0; font-weight: 600;">
          ⏱️ This code expires in 10 minutes.
        </p>
      </div>

      <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 0 0 16px 0;">
        After verifying your email, your profile will be placed in the Super Admin verification queue. You will receive an activation notice once your account permissions are authorized.
      </p>

      <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />

      <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
        If you did not request this registration, you can safely disregard this message.<br/>
        ${INSTITUTION_NAME} • Laboratory Administration
      </p>
    </div>
  `

  return sendMail({
    to,
    subject,
    html,
    text: `Your LabSync verification code is: ${otpCode}. It expires in 10 minutes.`,
  })
}

/**
 * 2. Send 6-Digit Password Reset OTP
 */
export async function sendPasswordResetOtpEmail(to: string, fullName: string, otpCode: string) {
  const subject = `[LabSync] ${otpCode} is your password reset code`
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e4e4e7; border-radius: 16px; overflow: hidden; padding: 32px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; background: #dc2626; color: #ffffff; padding: 10px 18px; border-radius: 12px; font-weight: bold; font-size: 16px; letter-spacing: 0.5px;">
          🔐 Password Recovery
        </div>
        <p style="color: #71717a; font-size: 13px; margin-top: 8px;">LabSync Laboratory Access Credentials</p>
      </div>

      <div style="background: #fef2f2; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px; border: 1px solid #fee2e2;">
        <h2 style="color: #991b1b; margin: 0 0 10px 0; font-size: 20px;">Reset Your Password</h2>
        <p style="color: #475569; font-size: 14px; margin: 0 0 20px 0;">
          Hello <strong>${fullName}</strong>, enter the one-time verification code below to set a new password:
        </p>

        <div style="background: #ffffff; border: 2px dashed #dc2626; border-radius: 12px; padding: 16px; display: inline-block; margin: 0 auto;">
          <span style="font-family: monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #dc2626;">
            ${otpCode}
          </span>
        </div>

        <p style="color: #b91c1c; font-size: 12px; margin: 16px 0 0 0; font-weight: 600;">
          ⏱️ This code expires in 10 minutes.
        </p>
      </div>

      <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 0 0 16px 0;">
        If you did not request a password reset, please contact the Super Admin immediately as your email may be compromised.
      </p>

      <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />

      <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
        Radha Raman Secondary School • Laboratory Administration
      </p>
    </div>
  `

  return sendMail({
    to,
    subject,
    html,
    text: `Your LabSync password reset code is: ${otpCode}. It expires in 10 minutes.`,
  })
}

/**
 * 3. Send Account Approval Notification
 */
export async function sendAccountApprovedEmail(to: string, fullName: string) {
  const subject = `[LabSync] Your account has been approved and activated!`
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e4e4e7; border-radius: 16px; overflow: hidden; padding: 32px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; background: #16a34a; color: #ffffff; padding: 10px 18px; border-radius: 12px; font-weight: bold; font-size: 16px; letter-spacing: 0.5px;">
          🎉 Account Activated
        </div>
      </div>

      <div style="background: #f0fdf4; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px; border: 1px solid #dcfce7;">
        <h2 style="color: #166534; margin: 0 0 10px 0; font-size: 20px;">Welcome to LabSync!</h2>
        <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">
          Dear <strong>${fullName}</strong>, your institutional account has been verified and granted access by the Super Admin.
        </p>

        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login" 
           style="display: inline-block; background: #16a34a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 600; font-size: 14px; margin-top: 8px;">
          Sign In to Portal
        </a>
      </div>

      <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />

      <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
        Radha Raman Secondary School • Laboratory Administration
      </p>
    </div>
  `

  return sendMail({
    to,
    subject,
    html,
    text: `Hello ${fullName}, your LabSync account has been approved and activated! You may now sign in.`,
  })
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/**
 * 4. Send Daily Schedule Digest & Reminders to Teacher
 */
export async function sendTeacherDailyScheduleEmail(params: {
  to: string
  teacherName: string
  dateStr: string
  nepaliDateStr?: string
  sessions: Array<{
    timeSlot: string
    labName: string
    subjectCode: string
    subjectTitle: string
    gradeBatch: string
    defaultStudents?: number
  }>
}) {
  const { to, teacherName, dateStr, nepaliDateStr, sessions } = params
  const subject = `[LabSync] Daily Practical Schedule (${sessions.length} sessions) — ${dateStr}`

  const sessionRows = sessions
    .map(
      (s) => `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 12px 8px; font-size: 13px; font-weight: 600; color: #1e293b; font-family: monospace;">${s.timeSlot}</td>
        <td style="padding: 12px 8px; font-size: 13px; color: #0f172a;">
          <strong>${s.subjectCode}</strong>: ${s.subjectTitle}<br/>
          <span style="font-size: 11px; color: #64748b;">${s.gradeBatch} • ${s.labName}</span>
        </td>
        <td style="padding: 12px 8px; font-size: 12px; color: #475569; text-align: right; font-family: monospace;">
          ${s.defaultStudents ? `${s.defaultStudents} students` : '—'}
        </td>
      </tr>`
    )
    .join('')

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; padding: 32px;">
      <div style="margin-bottom: 24px;">
        <div style="display: inline-block; background: #4f46e5; color: #ffffff; padding: 6px 14px; border-radius: 8px; font-weight: 700; font-size: 13px; letter-spacing: 0.5px;">
          ⚗️ Daily Practical Routine
        </div>
        <h2 style="color: #0f172a; margin: 12px 0 4px 0; font-size: 20px;">Good Morning, ${teacherName}</h2>
        <p style="color: #64748b; font-size: 13px; margin: 0;">
          Today's Schedule: <strong>${dateStr}</strong> ${nepaliDateStr ? `(${nepaliDateStr})` : ''} • You have <strong>${sessions.length} practical session${sessions.length === 1 ? '' : 's'}</strong>.
        </p>
      </div>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 1px solid #e2e8f0;">
              <th style="padding: 10px 8px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">Time Slot</th>
              <th style="padding: 10px 8px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">Subject & Lab</th>
              <th style="padding: 10px 8px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; text-align: right;">Strength</th>
            </tr>
          </thead>
          <tbody>
            ${sessionRows}
          </tbody>
        </table>
      </div>

      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${APP_URL}" 
           style="display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 600; font-size: 14px;">
          Open Live Session Cockpit
        </a>
      </div>

      <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
        Prompt attendance logging ensures synchronized institutional records.<br/>
        Radha Raman Secondary School • Laboratory Administration
      </p>
    </div>
  `

  return sendMail({
    to,
    subject,
    html,
    text: `Good Morning ${teacherName}, you have ${sessions.length} practical sessions scheduled for today (${dateStr}). Log in to the portal to record attendance: ${APP_URL}`,
  })
}

/**
 * 5. Send Skipped Practical Session Alert & Follow-Up
 */
export async function sendSkippedSessionAlertEmail(params: {
  to: string
  teacherName: string
  subjectCode: string
  subjectTitle: string
  timeSlot: string
  labName: string
  gradeBatch: string
  skipReason: string
  loggedBy?: string
}) {
  const { to, teacherName, subjectCode, subjectTitle, timeSlot, labName, gradeBatch, skipReason, loggedBy } = params
  const subject = `[LabSync Notice] Practical Session Marked Skipped: ${subjectCode} (${timeSlot})`

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; padding: 32px;">
      <div style="margin-bottom: 20px;">
        <div style="display: inline-block; background: #f59e0b; color: #ffffff; padding: 6px 14px; border-radius: 8px; font-weight: 700; font-size: 12px; letter-spacing: 0.5px;">
          ⚠️ Practical Session Notice
        </div>
        <h2 style="color: #0f172a; margin: 12px 0 4px 0; font-size: 18px;">Session Skipped / Non-Conducted</h2>
        <p style="color: #64748b; font-size: 13px; margin: 0;">
          A scheduled practical period was marked as skipped in the institutional logbook.
        </p>
      </div>

      <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table style="width: 100%; font-size: 13px; line-height: 1.6;">
          <tr>
            <td style="color: #92400e; font-weight: 600; width: 120px;">Subject:</td>
            <td style="color: #1e293b;"><strong>${subjectCode}</strong> — ${subjectTitle}</td>
          </tr>
          <tr>
            <td style="color: #92400e; font-weight: 600;">Time Slot:</td>
            <td style="color: #1e293b; font-family: monospace;">${timeSlot}</td>
          </tr>
          <tr>
            <td style="color: #92400e; font-weight: 600;">Laboratory:</td>
            <td style="color: #1e293b;">${labName}</td>
          </tr>
          <tr>
            <td style="color: #92400e; font-weight: 600;">Class / Batch:</td>
            <td style="color: #1e293b;">${gradeBatch}</td>
          </tr>
          <tr>
            <td style="color: #92400e; font-weight: 600;">Recorded Reason:</td>
            <td style="color: #b45309; font-weight: 700;">${skipReason}</td>
          </tr>
          ${loggedBy ? `<tr><td style="color: #92400e; font-weight: 600;">Logged By:</td><td style="color: #64748b;">${loggedBy}</td></tr>` : ''}
        </table>
      </div>

      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${APP_URL}/records" 
           style="display: inline-block; background: #d97706; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 10px; font-weight: 600; font-size: 13px;">
          Review Logbook Record
        </a>
      </div>

      <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
        If this session was conducted or rescheduled, you can modify the record from your portal.<br/>
        Radha Raman Secondary School • Academic Operations
      </p>
    </div>
  `

  return sendMail({
    to,
    subject,
    html,
    text: `Hello ${teacherName}, your practical session ${subjectCode} (${timeSlot}, ${labName}) was marked skipped with reason: "${skipReason}". Review in portal: ${APP_URL}/records`,
  })
}

/**
 * 6. Send Equipment Damage & Incident Alert
 */
export async function sendIncidentAlertEmail(params: {
  to: string
  recipientName: string
  incident: {
    id: string
    title: string
    labName: string
    equipmentName: string
    severity: string
    incidentType: string
    sessionLabel: string
    batchName: string
    reportedBy: string
    circumstances?: string | null
    studentRolls?: string | null
  }
  isEscalated?: boolean
  escalationReason?: string
}) {
  const { to, recipientName, incident, isEscalated, escalationReason } = params
  const isCritical = incident.severity === 'major_critical' || isEscalated
  const badgeColor = isCritical ? '#dc2626' : incident.severity === 'moderate' ? '#f59e0b' : '#3b82f6'

  const subject = `${isCritical ? '🚨 [CRITICAL ALERT]' : '⚠️ [Incident Report]'} Breakage in ${incident.labName}: ${incident.equipmentName}`

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; padding: 32px;">
      <div style="margin-bottom: 20px;">
        <div style="display: inline-block; background: ${badgeColor}; color: #ffffff; padding: 6px 14px; border-radius: 8px; font-weight: 700; font-size: 12px; letter-spacing: 0.5px;">
          ${isCritical ? '🚨 CRITICAL BREAKAGE / HAZARD' : 'EQUIPMENT BREAKAGE REPORT'}
        </div>
        <h2 style="color: #0f172a; margin: 12px 0 4px 0; font-size: 18px;">
          ${incident.title}
        </h2>
        <p style="color: #64748b; font-size: 13px; margin: 0;">
          Reported by <strong>${incident.reportedBy}</strong> • Facility: <strong>${incident.labName}</strong>
        </p>
      </div>

      ${
        isEscalated && escalationReason
          ? `<div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 14px; margin-bottom: 20px;">
               <strong style="color: #991b1b; font-size: 13px;">⚡ Coordinator / HOD Escalation Directive:</strong>
               <p style="color: #b91c1c; font-size: 12px; margin: 4px 0 0 0;">${escalationReason}</p>
             </div>`
          : ''
      }

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table style="width: 100%; font-size: 13px; line-height: 1.6;">
          <tr>
            <td style="color: #64748b; font-weight: 600; width: 140px;">Equipment / Item:</td>
            <td style="color: #0f172a; font-weight: 700;">${incident.equipmentName}</td>
          </tr>
          <tr>
            <td style="color: #64748b; font-weight: 600;">Incident Type:</td>
            <td style="color: #0f172a; text-transform: capitalize;">${incident.incidentType}</td>
          </tr>
          <tr>
            <td style="color: #64748b; font-weight: 600;">Severity Level:</td>
            <td style="color: ${badgeColor}; font-weight: 700; text-transform: uppercase; font-family: monospace;">${incident.severity}</td>
          </tr>
          <tr>
            <td style="color: #64748b; font-weight: 600;">Session & Batch:</td>
            <td style="color: #0f172a;">${incident.sessionLabel} (${incident.batchName})</td>
          </tr>
          ${
            incident.studentRolls
              ? `<tr><td style="color: #64748b; font-weight: 600;">Student Rolls:</td><td style="color: #0f172a; font-family: monospace;">${incident.studentRolls}</td></tr>`
              : ''
          }
          ${
            incident.circumstances
              ? `<tr><td style="color: #64748b; font-weight: 600;">Circumstances:</td><td style="color: #475569; font-style: italic;">"${incident.circumstances}"</td></tr>`
              : ''
          }
        </table>
      </div>

      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${APP_URL}/records/incidents" 
           style="display: inline-block; background: ${badgeColor}; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 600; font-size: 14px;">
          Open Incident Register & Triage
        </a>
      </div>

      <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
        Institutional Damage & Hazard Logbook • Prompt inspection required.<br/>
        Radha Raman Secondary School • Laboratory Administration
      </p>
    </div>
  `

  return sendMail({
    to,
    subject,
    html,
    text: `ALERT: Equipment breakage reported in ${incident.labName}. Item: ${incident.equipmentName}. Severity: ${incident.severity}. Reported by: ${incident.reportedBy}. View details: ${APP_URL}/records/incidents`,
  })
}

/**
 * 7. Send Overdue Maintenance Routine Alert
 */
export async function sendOverdueMaintenanceEmail(params: {
  to: string
  recipientName: string
  labName: string
  overdueTasks: Array<{
    title: string
    overdueDays: number
    cadence: string
    category?: string
  }>
}) {
  const { to, recipientName, labName, overdueTasks } = params
  const subject = `[LabSync Maintenance] ${overdueTasks.length} Overdue Preventive Tasks in ${labName}`

  const taskRows = overdueTasks
    .map(
      (t) => `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 10px 8px; font-size: 13px; font-weight: 600; color: #0f172a;">${t.title}</td>
        <td style="padding: 10px 8px; font-size: 12px; color: #64748b; text-transform: capitalize;">${t.cadence}</td>
        <td style="padding: 10px 8px; font-size: 12px; font-weight: 700; color: #dc2626; text-align: right; font-family: monospace;">
          +${t.overdueDays} day${t.overdueDays === 1 ? '' : 's'} overdue
        </td>
      </tr>`
    )
    .join('')

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; padding: 32px;">
      <div style="margin-bottom: 20px;">
        <div style="display: inline-block; background: #ef4444; color: #ffffff; padding: 6px 14px; border-radius: 8px; font-weight: 700; font-size: 12px; letter-spacing: 0.5px;">
          🛠️ MAINTENANCE ACTION REQUIRED
        </div>
        <h2 style="color: #0f172a; margin: 12px 0 4px 0; font-size: 18px;">Overdue Preventive Routines</h2>
        <p style="color: #64748b; font-size: 13px; margin: 0;">
          Target Facility: <strong>${labName}</strong> • Attn: <strong>${recipientName}</strong>
        </p>
      </div>

      <div style="background: #fef2f2; border: 1px solid #fee2e2; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="background: #fee2e2; border-bottom: 1px solid #fecaca;">
              <th style="padding: 8px; font-size: 11px; font-weight: 700; color: #991b1b; text-transform: uppercase;">Routine Task</th>
              <th style="padding: 8px; font-size: 11px; font-weight: 700; color: #991b1b; text-transform: uppercase;">Cadence</th>
              <th style="padding: 8px; font-size: 11px; font-weight: 700; color: #991b1b; text-transform: uppercase; text-align: right;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${taskRows}
          </tbody>
        </table>
      </div>

      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${APP_URL}/maintenance" 
           style="display: inline-block; background: #dc2626; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 600; font-size: 14px;">
          Open Maintenance Workbench
        </a>
      </div>

      <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
        Regular preventive servicing prevents lab downtime during examinations.<br/>
        Radha Raman Secondary School • Laboratory Administration
      </p>
    </div>
  `

  return sendMail({
    to,
    subject,
    html,
    text: `Attention ${recipientName}: ${overdueTasks.length} preventive maintenance tasks are overdue in ${labName}. Review in workbench: ${APP_URL}/maintenance`,
  })
}

/**
 * 8. Send Upcoming Holiday Notice & Laboratory Shutdown SOP
 */
export async function sendUpcomingHolidayLabNoticeEmail(params: {
  to: string
  recipientName: string
  holidayName: string
  dateSpanStr: string
  nepaliDateStr?: string
  upcomingInDays: number
}) {
  const { to, recipientName, holidayName, dateSpanStr, nepaliDateStr, upcomingInDays } = params
  const subject = `[LabSync Notice] Upcoming Holiday & Laboratory Shutdown Protocol: ${holidayName}`

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; padding: 32px;">
      <div style="margin-bottom: 20px;">
        <div style="display: inline-block; background: #0284c7; color: #ffffff; padding: 6px 14px; border-radius: 8px; font-weight: 700; font-size: 12px; letter-spacing: 0.5px;">
          🏖️ ACADEMIC RECESS & LAB SHUTDOWN
        </div>
        <h2 style="color: #0f172a; margin: 12px 0 4px 0; font-size: 18px;">${holidayName}</h2>
        <p style="color: #64748b; font-size: 13px; margin: 0;">
          Schedule: <strong>${dateSpanStr}</strong> ${nepaliDateStr ? `(${nepaliDateStr})` : ''} • Starting in ${upcomingInDays === 0 ? 'Today' : `${upcomingInDays} day(s)`}.
        </p>
      </div>

      <div style="background: #f0f9ff; border: 1px solid #e0f2fe; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <h3 style="color: #0369a1; font-size: 14px; margin: 0 0 10px 0;">Standard Laboratory Shutdown Checklist:</h3>
        <ul style="margin: 0; padding-left: 20px; color: #334155; font-size: 13px; line-height: 1.6;">
          <li><strong>Power Breakers:</strong> Turn off main electrical switches for PC terminals and instruments.</li>
          <li><strong>Gas & Water:</strong> Ensure LP gas cylinders and water supply faucets are securely closed.</li>
          <li><strong>Security:</strong> Lock delicate microscopes, spectrophotometers, and chemical storage lockers.</li>
          <li><strong>Servicing Opportunity:</strong> Ideal window for offline thermal paste replacement and dust cleaning.</li>
        </ul>
      </div>

      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${APP_URL}/maintenance" 
           style="display: inline-block; background: #0284c7; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 600; font-size: 14px;">
          Plan Maintenance During Recess
        </a>
      </div>

      <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
        Institutional Laboratory Safety & Compliance Standard.<br/>
        Radha Raman Secondary School • Laboratory Administration
      </p>
    </div>
  `

  return sendMail({
    to,
    subject,
    html,
    text: `Attention ${recipientName}: Upcoming holiday "${holidayName}" (${dateSpanStr}). Please ensure standard lab shutdown protocols are completed before recess.`,
  })
}

/**
 * 9. Send New Teacher / User Registration Notice to Admins
 */
export async function sendNewUserRegistrationAdminAlertEmail(params: {
  to: string
  adminName: string
  newUser: {
    fullName: string
    email: string
    role: string
    registeredAt?: string
  }
}) {
  const { to, adminName, newUser } = params
  const subject = `[LabSync Action Required] New Teacher Registration: ${newUser.fullName} awaiting approval`

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; padding: 32px;">
      <div style="margin-bottom: 20px;">
        <div style="display: inline-block; background: #4f46e5; color: #ffffff; padding: 6px 14px; border-radius: 8px; font-weight: 700; font-size: 12px; letter-spacing: 0.5px;">
          👤 NEW USER REGISTRATION
        </div>
        <h2 style="color: #0f172a; margin: 12px 0 4px 0; font-size: 18px;">Account Pending Verification</h2>
        <p style="color: #64748b; font-size: 13px; margin: 0;">
          A new faculty member has verified their email address and is awaiting authorization.
        </p>
      </div>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table style="width: 100%; font-size: 13px; line-height: 1.6;">
          <tr>
            <td style="color: #64748b; font-weight: 600; width: 120px;">Full Name:</td>
            <td style="color: #0f172a; font-weight: 700;">${newUser.fullName}</td>
          </tr>
          <tr>
            <td style="color: #64748b; font-weight: 600;">Email Address:</td>
            <td style="color: #4f46e5; font-family: monospace;">${newUser.email}</td>
          </tr>
          <tr>
            <td style="color: #64748b; font-weight: 600;">Requested Role:</td>
            <td style="color: #0f172a; text-transform: capitalize;">${newUser.role.replace('_', ' ')}</td>
          </tr>
          <tr>
            <td style="color: #64748b; font-weight: 600;">Registration Time:</td>
            <td style="color: #64748b;">${newUser.registeredAt || 'Just now'}</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${APP_URL}/admin?tab=users" 
           style="display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 600; font-size: 14px;">
          Authorize in Admin Console
        </a>
      </div>

      <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
        Access permissions must be approved by Super Admin before login is granted.<br/>
        ${INSTITUTION_NAME} • User Access Governance
      </p>
    </div>
  `

  return sendMail({
    to,
    subject,
    html,
    text: `New registration awaiting approval: ${newUser.fullName} (${newUser.email}). Authorize in admin console: ${APP_URL}/admin?tab=users`,
  })
}

