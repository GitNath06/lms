import { PracticalGroupedSection, IncidentRecordItem } from '@/types/records'
import { INSTITUTION_CONFIG } from '@/lib/institution'

function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '""'
  const str = String(val).replace(/"/g, '""')
  return `"${str}"`
}

/**
 * Generate RFC 4180 compliant CSV for Practical Records (with optional grouping subtotals)
 */
export function generatePracticalRecordsCsv(
  sections: PracticalGroupedSection[],
  filtersMeta?: { labName?: string; dateRange?: string; academicYear?: string }
): string {
  const lines: string[] = []

  // UTF-8 Byte Order Mark for Excel compatibility
  const BOM = '\uFEFF'

  // Institutional Header Banner
  lines.push(escapeCsvCell(INSTITUTION_CONFIG.name))
  lines.push(escapeCsvCell(INSTITUTION_CONFIG.department))
  lines.push(
    escapeCsvCell(
      `Academic Year: ${filtersMeta?.academicYear || INSTITUTION_CONFIG.academicYear} | Facility: ${
        filtersMeta?.labName || 'All Laboratories'
      } | Date Range: ${filtersMeta?.dateRange || 'All Time'}`
    )
  )
  lines.push('') // Empty row

  // Table Column Headers
  const headers = [
    'Date',
    'Period / Slot',
    'Laboratory',
    'Subject & Code',
    'Class / Batch',
    'Practical Title',
    'Topic Learned',
    'Subject Teacher',
    'Present Students',
    'Total Students',
    'Attendance %',
    'Status',
    'Remarks / Skip Reason',
  ]
  lines.push(headers.map(escapeCsvCell).join(','))

  for (const sec of sections) {
    if (sec.groupKey !== 'all') {
      // Group Header Row
      lines.push(
        [
          escapeCsvCell(`--- GROUP: ${sec.groupTitle} ---`),
          '""',
          '""',
          '""',
          '""',
          '""',
          '""',
          '""',
          '""',
          '""',
          '""',
          '""',
          '""',
        ].join(',')
      )
    }

    for (const row of sec.records) {
      const isSkipped = row.status === 'skipped'
      const attPct = row.total_students > 0 ? (row.present_students / row.total_students) * 100 : 0

      lines.push(
        [
          escapeCsvCell(row.date),
          escapeCsvCell(row.period_label),
          escapeCsvCell(row.labs?.name || row.lab_id),
          escapeCsvCell(row.subject_name),
          escapeCsvCell(row.batch_group),
          escapeCsvCell(row.practical_title),
          escapeCsvCell(row.topic_learned || '—'),
          escapeCsvCell(row.profiles?.full_name || 'Assigned Subject Teacher'),
          escapeCsvCell(row.present_students),
          escapeCsvCell(row.total_students),
          escapeCsvCell(`${attPct.toFixed(1)}%`),
          escapeCsvCell(isSkipped ? 'SKIPPED' : 'CONDUCTED'),
          escapeCsvCell(isSkipped ? row.skip_reason || 'Skipped' : row.remarks || ''),
        ].join(',')
      )
    }

    if (sec.groupKey !== 'all') {
      // Subtotal Summary Row (13 columns aligned)
      lines.push(
        [
          escapeCsvCell(`Subtotal [${sec.groupTitle}]`),
          escapeCsvCell(`${sec.subtotal.totalSessions} Sessions (${sec.subtotal.conductedSessions} Conducted, ${sec.subtotal.skippedSessions} Skipped)`),
          '""',
          '""',
          '""',
          '""',
          '""',
          '""',
          escapeCsvCell(sec.subtotal.totalPresent),
          escapeCsvCell(sec.subtotal.totalEnrolled),
          escapeCsvCell(`${sec.subtotal.averageAttendancePct.toFixed(1)}%`),
          '""',
          '""',
        ].join(',')
      )
      lines.push('') // Empty row between groups
    }
  }

  // Footer Signature Notice
  lines.push('')
  lines.push(escapeCsvCell(`Generated via ${INSTITUTION_CONFIG.systemTitle} on ${new Date().toISOString()}`))
  lines.push(escapeCsvCell('Certified Verification: Lab In-Charge & Head of Department'))

  return BOM + lines.join('\r\n')
}

/**
 * Generate RFC 4180 compliant CSV for Laboratory Incidents & Damage Register
 */
export function generateIncidentRecordsCsv(
  incidents: IncidentRecordItem[],
  filtersMeta?: { labName?: string; dateRange?: string }
): string {
  const lines: string[] = []
  const BOM = '\uFEFF'

  // Header Banner
  lines.push(escapeCsvCell(INSTITUTION_CONFIG.name))
  lines.push(escapeCsvCell('OFFICIAL LABORATORY INCIDENT & APPARATUS DAMAGE REGISTER'))
  lines.push(
    escapeCsvCell(
      `Facility: ${filtersMeta?.labName || 'All Facilities'} | Period: ${
        filtersMeta?.dateRange || 'All Time'
      } | Generated: ${new Date().toISOString().split('T')[0]}`
    )
  )
  lines.push('')

  // Two-phase Headers: Reported vs Action Taken
  const headers = [
    'Case ID',
    'Date',
    'Period / Slot',
    'Laboratory',
    'Class / Batch',
    'Subject & Teacher',
    'Incident Title',
    'Type',
    'Severity',
    'Equipment Name',
    'Quantity',
    'Student Roll(s)',
    'Reported By',
    'Reported At',
    'Current Status',
    'Escalated to HOD',
    'Escalation Reason',
    'Escalated At',
    'Action / Resolution Notes',
    'Resolved By',
    'Resolved At',
    'Time to Resolve (Hours)',
  ]
  lines.push(headers.map(escapeCsvCell).join(','))

  for (const inc of incidents) {
    lines.push(
      [
        escapeCsvCell(inc.id),
        escapeCsvCell(inc.date),
        escapeCsvCell(inc.session_label),
        escapeCsvCell(inc.labs?.name || inc.lab_id),
        escapeCsvCell(inc.batch_name),
        escapeCsvCell(`${inc.subject_name} (${inc.subject_teacher_name})`),
        escapeCsvCell(inc.title),
        escapeCsvCell(inc.incident_type),
        escapeCsvCell(inc.severity.toUpperCase()),
        escapeCsvCell(inc.equipment_name),
        escapeCsvCell(inc.quantity),
        escapeCsvCell(inc.student_rolls || 'N/A'),
        escapeCsvCell(inc.reporter_profile?.full_name || inc.reported_by),
        escapeCsvCell(inc.created_at),
        escapeCsvCell(inc.status.toUpperCase()),
        escapeCsvCell(inc.escalated_to_hod ? 'YES' : 'NO'),
        escapeCsvCell(inc.escalation_reason || ''),
        escapeCsvCell(inc.escalated_at || ''),
        escapeCsvCell(inc.resolution_notes || ''),
        escapeCsvCell(inc.resolver_profile?.full_name || inc.resolved_by || ''),
        escapeCsvCell(inc.resolved_at || ''),
        escapeCsvCell(inc.time_to_resolve_hours !== null ? inc.time_to_resolve_hours.toFixed(1) : 'Open'),
      ].join(',')
    )
  }

  return BOM + lines.join('\r\n')
}
