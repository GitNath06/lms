import type { PracticalGroupedSection, IncidentRecordItem, MaintenanceRecordItem } from '@/types/records'
import { INSTITUTION_CONFIG } from '../institution'
import { formatClassCode, sanitizeSubjectTitle } from '@/lib/report-spec/practical-spec'

function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '""'
  const str = String(val).replace(/"/g, '""')
  return `"${str}"`
}

interface CsvColDef<T> {
  id: string
  header: string
  getValue: (r: T) => any
}

const ALL_PRACTICAL_CSV_COLS: CsvColDef<any>[] = [
  { id: 'date', header: 'Date', getValue: (r) => r.date },
  { id: 'period', header: 'Period / Slot', getValue: (r) => r.period_label || '—' },
  { id: 'facility', header: 'Laboratory', getValue: (r) => r.labs?.name || r.lab_id || '—' },
  { id: 'class_batch', header: 'Class', getValue: (r) => formatClassCode(r.batch_group) },
  {
    id: 'subject',
    header: 'Subject',
    getValue: (r) => sanitizeSubjectTitle(r.subject_name) + (r.subject_code ? ` (${r.subject_code})` : ''),
  },
  { id: 'experiment', header: 'Practical Title', getValue: (r) => r.practical_title || '—' },
  { id: 'teacher', header: 'Subject Teacher', getValue: (r) => r.profiles?.full_name || 'Assigned Subject Teacher' },
  {
    id: 'attendance',
    header: 'Attendance',
    getValue: (r) => {
      const attPct = r.total_students > 0 ? (r.present_students / r.total_students) * 100 : 0
      return r.status === 'skipped' ? 'N/A' : `${r.present_students}/${r.total_students} (${attPct.toFixed(1)}%)`
    },
  },
  { id: 'status', header: 'Status', getValue: (r) => (r.status === 'skipped' ? 'SKIPPED' : 'CONDUCTED') },
  {
    id: 'remarks',
    header: 'Remarks / Skip Reason',
    getValue: (r) => (r.status === 'skipped' ? r.skip_reason || 'Skipped' : r.remarks || ''),
  },
]

/**
 * Generate RFC 4180 compliant CSV for Practical Records (with optional grouping subtotals and WYSIWYG columns)
 */
export function generatePracticalRecordsCsv(
  sections: PracticalGroupedSection[],
  filtersMeta?: {
    labName?: string
    dateRange?: string
    academicYear?: string
    traceabilityNote?: string
    visibleColumns?: string[]
  }
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

  // Audit Traceability metadata
  if (filtersMeta?.traceabilityNote) {
    lines.push(escapeCsvCell(`Audit Traceability: ${filtersMeta.traceabilityNote}`))
  }
  lines.push('') // Empty row

  // Resolve active columns based on WYSIWYG selection
  const visibleSet =
    filtersMeta?.visibleColumns && filtersMeta.visibleColumns.length > 0
      ? new Set(filtersMeta.visibleColumns)
      : null
  const activeCols = visibleSet
    ? ALL_PRACTICAL_CSV_COLS.filter((c) => visibleSet.has(c.id))
    : ALL_PRACTICAL_CSV_COLS
  const resolvedCols = activeCols.length > 0 ? activeCols : ALL_PRACTICAL_CSV_COLS

  // Table Column Headers
  lines.push(resolvedCols.map((c) => escapeCsvCell(c.header)).join(','))

  for (const sec of sections) {
    if (sec.groupKey !== 'all') {
      // Group Header Row
      const groupRow = [
        escapeCsvCell(`--- GROUP: ${sec.groupTitle} ---`),
        ...Array(Math.max(0, resolvedCols.length - 1)).fill('""'),
      ]
      lines.push(groupRow.join(','))
    }

    for (const row of sec.records) {
      lines.push(resolvedCols.map((c) => escapeCsvCell(c.getValue(row))).join(','))
    }

    if (sec.groupKey !== 'all') {
      // Subtotal Summary Row
      const subtotalLabel = `Subtotal [${sec.groupTitle}]: ${sec.subtotal.totalSessions} Sessions (${sec.subtotal.conductedSessions} Conducted, ${sec.subtotal.skippedSessions} Skipped)`
      const subtotalAttendance = `${sec.subtotal.totalPresent}/${sec.subtotal.totalEnrolled} (${sec.subtotal.averageAttendancePct.toFixed(1)}%)`

      const subRow: string[] = resolvedCols.map((col, idx) => {
        if (idx === 0) return escapeCsvCell(subtotalLabel)
        if (col.id === 'attendance') return escapeCsvCell(subtotalAttendance)
        return '""'
      })
      lines.push(subRow.join(','))
      lines.push('') // Empty row between groups
    }
  }

  // Footer Signature Notice
  lines.push('')
  lines.push(escapeCsvCell(`Generated via ${INSTITUTION_CONFIG.systemTitle} on ${new Date().toISOString()}`))
  lines.push(escapeCsvCell('Certified Verification: Lab In-Charge & Head of Department'))

  return BOM + lines.join('\r\n')
}

const ALL_INCIDENT_CSV_COLS: CsvColDef<IncidentRecordItem>[] = [
  { id: 'date_case', header: 'Date & Case #', getValue: (inc) => `${inc.date || inc.created_at?.split('T')[0]} (${inc.id})` },
  { id: 'facility', header: 'Laboratory Facility', getValue: (inc) => inc.labs?.name || inc.lab_id || '—' },
  {
    id: 'equipment',
    header: 'Lab Equipment / Workstation',
    getValue: (inc) => `${inc.equipment_name || '—'}${inc.quantity && inc.quantity > 1 ? ` (${inc.quantity} units)` : ''}`,
  },
  { id: 'title_circ', header: 'Circumstances & Description', getValue: (inc) => inc.title || '—' },
  { id: 'severity', header: 'Severity', getValue: (inc) => (inc.severity || '').toUpperCase() },
  {
    id: 'teacher_batch',
    header: 'Faculty & Class',
    getValue: (inc) => `${inc.subject_teacher_name || inc.reported_by || '—'} [${formatClassCode(inc.batch_name)}]`,
  },
  { id: 'status', header: 'Current Status', getValue: (inc) => (inc.status || '').toUpperCase() },
  {
    id: 'resolution',
    header: 'Action / Resolution Notes',
    getValue: (inc) => inc.resolution_notes || 'Pending Triage / Inspection',
  },
]

/**
 * Generate RFC 4180 compliant CSV for Laboratory Incidents & Damage Register (with WYSIWYG columns and traceability)
 */
export function generateIncidentRecordsCsv(
  incidents: IncidentRecordItem[],
  filtersMeta?: {
    labName?: string
    dateRange?: string
    traceabilityNote?: string
    visibleColumns?: string[]
  }
): string {
  const lines: string[] = []
  const BOM = '\uFEFF'

  // Header Banner
  lines.push(escapeCsvCell(INSTITUTION_CONFIG.name))
  lines.push(escapeCsvCell('OFFICIAL LABORATORY INCIDENT & EQUIPMENT DAMAGE REGISTER'))
  lines.push(
    escapeCsvCell(
      `Facility: ${filtersMeta?.labName || 'All Facilities'} | Period: ${
        filtersMeta?.dateRange || 'All Time'
      } | Generated: ${new Date().toISOString().split('T')[0]}`
    )
  )

  // Audit Traceability metadata
  if (filtersMeta?.traceabilityNote) {
    lines.push(escapeCsvCell(`Audit Traceability: ${filtersMeta.traceabilityNote}`))
  }
  lines.push('')

  // Resolve active columns based on WYSIWYG selection
  const visibleSet =
    filtersMeta?.visibleColumns && filtersMeta.visibleColumns.length > 0
      ? new Set(filtersMeta.visibleColumns)
      : null
  const activeCols = visibleSet
    ? ALL_INCIDENT_CSV_COLS.filter((c) => visibleSet.has(c.id))
    : ALL_INCIDENT_CSV_COLS
  const resolvedCols = activeCols.length > 0 ? activeCols : ALL_INCIDENT_CSV_COLS

  lines.push(resolvedCols.map((c) => escapeCsvCell(c.header)).join(','))

  for (const inc of incidents) {
    lines.push(resolvedCols.map((c) => escapeCsvCell(c.getValue(inc))).join(','))
  }

  // Footer Signature Notice
  lines.push('')
  lines.push(escapeCsvCell(`Generated via ${INSTITUTION_CONFIG.systemTitle} on ${new Date().toISOString()}`))
  lines.push(escapeCsvCell('Certified Verification: Lab In-Charge & Head of Department'))

  return BOM + lines.join('\r\n')
}

/**
 * Generate RFC 4180 compliant CSV for Lab Maintenance & Servicing Records
 */
export function generateMaintenanceRecordsCsv(
  records: MaintenanceRecordItem[],
  filtersMeta?: { labName?: string; dateRange?: string }
): string {
  const lines: string[] = []
  const BOM = '\uFEFF'

  // Header Banner
  lines.push(escapeCsvCell(INSTITUTION_CONFIG.name))
  lines.push(escapeCsvCell('OFFICIAL LABORATORY PREVENTIVE MAINTENANCE & SERVICING AUDIT REGISTER'))
  lines.push(
    escapeCsvCell(
      `Facility: ${filtersMeta?.labName || 'All Facilities'} | Period: ${
        filtersMeta?.dateRange || 'All Time'
      } | Generated: ${new Date().toISOString().split('T')[0]}`
    )
  )
  lines.push('')

  // Two-phase Flattened Headers matching XLSX
  const headers = [
    'Target Asset / Hardware',
    'Category',
    'Routine Plan Title',
    'Cadence',
    'Target Role',
    'Scheduled Due Date',
    'SOP Checklist Items',
    'Work Performed / Action Taken',
    'Checklist Completed %',
    'Parts Replaced',
    'Service Date',
    'Certified Technician',
    'Next Recommended Due',
    'Remarks / Observations',
  ]
  lines.push(headers.map(escapeCsvCell).join(','))

  for (const rec of records) {
    const planChecklist = Array.isArray(rec.plan?.checklist) ? rec.plan.checklist : []
    const completedChecklist = Array.isArray(rec.checklist_completed) ? (rec.checklist_completed as string[]) : []
    const totalSteps = planChecklist.length > 0 ? planChecklist.length : completedChecklist.length
    const checklistSummary = totalSteps > 0
      ? `${completedChecklist.length}/${totalSteps} (${rec.checklist_completed_pct}%)`
      : '—'

    const intervalLabel = rec.plan?.interval_days
      ? `Every ${rec.plan.interval_days} Days`
      : 'As Needed'

    const checklistItemsStr = planChecklist.length > 0
      ? planChecklist.map((step, idx) => `${idx + 1}. ${step}`).join('; ')
      : (completedChecklist.length > 0 ? completedChecklist.join('; ') : 'Routine Technical Checklist')

    lines.push(
      [
        escapeCsvCell(rec.asset_identifier),
        escapeCsvCell((rec.plan?.category || 'general').toUpperCase()),
        escapeCsvCell(rec.plan_title || rec.plan?.title || 'Preventive Maintenance'),
        escapeCsvCell(intervalLabel),
        escapeCsvCell((rec.plan?.target_role || 'lab_incharge').replace('_', ' ').toUpperCase()),
        escapeCsvCell(rec.service_date),
        escapeCsvCell(checklistItemsStr),
        escapeCsvCell(rec.work_performed),
        escapeCsvCell(checklistSummary),
        escapeCsvCell(rec.parts_replaced || 'None (Serviced / Cleaned)'),
        escapeCsvCell(rec.service_date),
        escapeCsvCell(rec.performed_by_name || 'Laboratory Staff'),
        escapeCsvCell(rec.next_service_due || '—'),
        escapeCsvCell(rec.remarks || 'Routine maintenance verified.'),
      ].join(',')
    )
  }

  // Footer Certification
  lines.push('')
  lines.push(escapeCsvCell(`Generated via ${INSTITUTION_CONFIG.systemTitle} on ${new Date().toISOString()}`))
  lines.push(escapeCsvCell('Certified Verification: Laboratory In-Charge, Academic Coordinator & Campus Chief'))

  return BOM + lines.join('\r\n')
}
