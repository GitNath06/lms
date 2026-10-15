

import ExcelJS from 'exceljs'
import type {
  PracticalGroupedSection,
  IncidentRecordItem,
  IncidentSummaryMetrics,
  MaintenanceRecordItem,
  MaintenanceSummaryMetrics,
} from '@/types/records'
import type { StudentComplianceReport } from '@/lib/types/institutional-reports'
import { INSTITUTION_CONFIG } from '../institution'
import { formatClassCode, sanitizeSubjectTitle } from '@/lib/report-spec/practical-spec'

interface PracticalMeta {
  labName?: string
  dateRange?: string
  groupByLabel?: string
  academicYear?: string
  traceabilityNote?: string
  visibleColumns?: string[]
}

interface IncidentMeta {
  labName?: string
  dateRange?: string
  traceabilityNote?: string
  visibleColumns?: string[]
}

function getColumnLetter(colIndex: number): string {
  let letter = ''
  let temp = colIndex
  while (temp > 0) {
    const rem = (temp - 1) % 26
    letter = String.fromCharCode(65 + rem) + letter
    temp = Math.floor((temp - 1) / 26)
  }
  return letter || 'A'
}

interface PracticalXlsxCol {
  id: string
  header: string
  width: number
  align: 'left' | 'center' | 'right'
  numFmt?: string
  isStatus?: boolean
  isAttendance?: boolean
  getValue: (r: any) => any
}

const ALL_PRACTICAL_XLSX_COLS: PracticalXlsxCol[] = [
  { id: 'date', header: 'Date', width: 13, align: 'center', getValue: (r) => r.date },
  { id: 'period', header: 'Period / Slot', width: 16, align: 'center', getValue: (r) => r.period_label || '—' },
  { id: 'facility', header: 'Laboratory Facility', width: 22, align: 'left', getValue: (r) => r.labs?.name || r.lab_id || '—' },
  { id: 'class_batch', header: 'Class', width: 14, align: 'left', getValue: (r) => formatClassCode(r.batch_group) },
  {
    id: 'subject',
    header: 'Subject',
    width: 28,
    align: 'left',
    getValue: (r) => sanitizeSubjectTitle(r.subject_name) + (r.subject_code ? ` (${r.subject_code})` : ''),
  },
  { id: 'experiment', header: 'Practical Experiment Title', width: 36, align: 'left', getValue: (r) => r.practical_title || '—' },
  { id: 'teacher', header: 'Subject Teacher', width: 24, align: 'left', getValue: (r) => r.profiles?.full_name || 'Assigned Subject Teacher' },
  {
    id: 'attendance',
    header: 'Attendance',
    width: 16,
    align: 'center',
    isAttendance: true,
    getValue: (r) => {
      const attPct = r.total_students > 0 ? (r.present_students / r.total_students) * 100 : 0
      return r.status === 'skipped' ? 'N/A' : `${r.present_students}/${r.total_students} (${attPct.toFixed(1)}%)`
    },
  },
  {
    id: 'status',
    header: 'Status',
    width: 14,
    align: 'center',
    isStatus: true,
    getValue: (r) => (r.status === 'skipped' ? 'SKIPPED' : 'CONDUCTED'),
  },
  {
    id: 'remarks',
    header: 'Teacher Remarks / Verification Notes',
    width: 40,
    align: 'left',
    getValue: (r) => (r.status === 'skipped' ? r.skip_reason || 'Postponed / Holiday' : r.remarks || 'Standard practical routine executed.'),
  },
]

/**
 * Generate high-fidelity Excel (.xlsx) workbook for Practical Records with WYSIWYG visible columns
 */
export async function generatePracticalRecordsXlsxBuffer(
  sections: PracticalGroupedSection[],
  meta?: PracticalMeta
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = INSTITUTION_CONFIG.name
  workbook.lastModifiedBy = 'LabSync LIMS'
  workbook.created = new Date()
  workbook.modified = new Date()

  const sheet = workbook.addWorksheet('Practical Records', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ state: 'frozen', ySplit: meta?.traceabilityNote ? 7 : 6 }],
  })

  // Resolve active visible columns
  const visibleSet = meta?.visibleColumns && meta.visibleColumns.length > 0 ? new Set(meta.visibleColumns) : null
  const activeCols = visibleSet ? ALL_PRACTICAL_XLSX_COLS.filter((c) => visibleSet.has(c.id)) : ALL_PRACTICAL_XLSX_COLS
  const resolvedCols = activeCols.length > 0 ? activeCols : ALL_PRACTICAL_XLSX_COLS
  const lastCol = getColumnLetter(resolvedCols.length)

  // 1. INSTITUTIONAL TITLE BANNER (Rows 1 - 5)
  // Row 1: School Title
  sheet.mergeCells(`A1:${lastCol}1`)
  const r1 = sheet.getCell('A1')
  r1.value = INSTITUTION_CONFIG.name
  r1.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
  r1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } } // Slate-900
  r1.alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.getRow(1).height = 28

  // Row 2: Department & Academic Year
  sheet.mergeCells(`A2:${lastCol}2`)
  const r2 = sheet.getCell('A2')
  r2.value = `${INSTITUTION_CONFIG.department} • Academic Year: ${meta?.academicYear || INSTITUTION_CONFIG.academicYear}`
  r2.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFE2E8F0' } }
  r2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } } // Slate-800
  r2.alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.getRow(2).height = 20

  // Row 3: Document Title & Metadata
  sheet.mergeCells(`A3:${lastCol}3`)
  const r3 = sheet.getCell('A3')
  r3.value = `OFFICIAL PRACTICAL EXPERIMENT RECORD & ATTENDANCE AUDIT SHEET`
  r3.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } }
  r3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } } // Slate-100
  r3.alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.getRow(3).height = 20

  // Row 4: Filter Metadata
  sheet.mergeCells(`A4:${lastCol}4`)
  const r4 = sheet.getCell('A4')
  r4.value = `Facility: ${meta?.labName || 'All Laboratories'}  |  Date Range: ${meta?.dateRange || 'All Time'}  |  Grouping: ${meta?.groupByLabel || 'None'}  |  Exported: ${new Date().toISOString().split('T')[0]}`
  r4.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF475569' } }
  r4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
  r4.alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.getRow(4).height = 18

  let currentRowIndex = 5

  // Row 5: Audit Traceability metadata (if available)
  if (meta?.traceabilityNote) {
    sheet.mergeCells(`A${currentRowIndex}:${lastCol}${currentRowIndex}`)
    const rTrace = sheet.getCell(`A${currentRowIndex}`)
    rTrace.value = `Audit Traceability: ${meta.traceabilityNote}`
    rTrace.font = { name: 'Arial', size: 8.5, italic: true, color: { argb: 'FF4338CA' } } // Indigo-700
    rTrace.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } } // Indigo-50
    rTrace.alignment = { vertical: 'middle', horizontal: 'center' }
    sheet.getRow(currentRowIndex).height = 18
    currentRowIndex++
  }

  // 2. TABLE HEADERS
  const headerRow = sheet.getRow(currentRowIndex)
  headerRow.values = resolvedCols.map((c) => c.header)
  headerRow.height = 26
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } } // Blue-900 Navy
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF0F172A' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FF334155' } },
    }
  })
  currentRowIndex++

  // Set column widths
  resolvedCols.forEach((col, idx) => {
    sheet.getColumn(idx + 1).width = col.width
  })

  // 3. DATA ROWS & GROUPING SECTIONS
  for (const section of sections) {
    if (section.groupKey !== 'all') {
      sheet.mergeCells(`A${currentRowIndex}:${lastCol}${currentRowIndex}`)
      const groupCell = sheet.getCell(`A${currentRowIndex}`)
      groupCell.value = `📂 SECTION: ${section.groupTitle.toUpperCase()}`
      groupCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E293B' } }
      groupCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }
      groupCell.alignment = { vertical: 'middle', indent: 1 }
      sheet.getRow(currentRowIndex).height = 22
      currentRowIndex++
    }

    for (const record of section.records) {
      const row = sheet.getRow(currentRowIndex)
      const isSkipped = record.status === 'skipped'
      row.values = resolvedCols.map((col) => col.getValue(record))
      row.height = 20

      row.eachCell((cell, colNumber) => {
        const colDef = resolvedCols[colNumber - 1]
        cell.font = { name: 'Arial', size: 9, color: { argb: 'FF0F172A' } }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        }

        cell.alignment = { vertical: 'middle', horizontal: colDef.align }
        if (colDef.isStatus) {
          if (isSkipped) {
            cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFB45309' } } // Amber-700
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
          } else {
            cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF047857' } } // Emerald-700
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }
          }
        }
      })
      currentRowIndex++
    }

    if (section.groupKey !== 'all') {
      const subtotalRow = sheet.getRow(currentRowIndex)
      sheet.mergeCells(`A${currentRowIndex}:${lastCol}${currentRowIndex}`)
      const subLabel = sheet.getCell(`A${currentRowIndex}`)
      subLabel.value = `SUBTOTAL [${section.groupTitle}]: ${section.subtotal.totalSessions} Sessions (${section.subtotal.conductedSessions} Conducted, ${section.subtotal.skippedSessions} Skipped) | Attendance: ${section.subtotal.totalPresent}/${section.subtotal.totalEnrolled} (${section.subtotal.averageAttendancePct.toFixed(1)}%)`
      subLabel.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E293B' } }
      subLabel.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
      subtotalRow.height = 22
      currentRowIndex++
    }
  }

  // 4. SIGNATURE NOTICE
  currentRowIndex += 2
  const sigColLeft = 'A'
  const sigColRight = lastCol
  const sigLeft = sheet.getCell(`${sigColLeft}${currentRowIndex}`)
  sigLeft.value = INSTITUTION_CONFIG.signatures.left.title.toUpperCase()
  sigLeft.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } }
  sigLeft.alignment = { horizontal: 'left' }
  sigLeft.border = { top: { style: 'medium', color: { argb: 'FF0F172A' } } }

  const sigRight = sheet.getCell(`${sigColRight}${currentRowIndex}`)
  sigRight.value = INSTITUTION_CONFIG.signatures.right.title.toUpperCase()
  sigRight.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } }
  sigRight.alignment = { horizontal: 'right' }
  sigRight.border = { top: { style: 'medium', color: { argb: 'FF0F172A' } } }

  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer
}

interface IncidentXlsxCol {
  id: string
  header: string
  width: number
  align: 'left' | 'center' | 'right'
  isSeverity?: boolean
  isStatus?: boolean
  getValue: (r: IncidentRecordItem) => any
}

const ALL_INCIDENT_XLSX_COLS: IncidentXlsxCol[] = [
  { id: 'date_case', header: 'Date & Case #', width: 18, align: 'center', getValue: (inc) => `${inc.date || inc.created_at?.split('T')[0]} (${inc.id})` },
  { id: 'facility', header: 'Facility Room', width: 22, align: 'left', getValue: (inc) => inc.labs?.name || inc.lab_id || '—' },
  {
    id: 'equipment',
    header: 'Lab Equipment / Workstation',
    width: 28,
    align: 'left',
    getValue: (inc) => `${inc.equipment_name || '—'}${inc.quantity && inc.quantity > 1 ? ` (${inc.quantity} units)` : ''}`,
  },
  { id: 'title_circ', header: 'Circumstances & Description', width: 36, align: 'left', getValue: (inc) => inc.title || '—' },
  { id: 'severity', header: 'Severity', width: 14, align: 'center', isSeverity: true, getValue: (inc) => (inc.severity || '').toUpperCase() },
  {
    id: 'teacher_batch',
    header: 'Faculty & Class',
    width: 24,
    align: 'left',
    getValue: (inc) => `${inc.subject_teacher_name || inc.reported_by || '—'} [${formatClassCode(inc.batch_name)}]`,
  },
  { id: 'status', header: 'Status', width: 16, align: 'center', isStatus: true, getValue: (inc) => (inc.status || '').toUpperCase() },
  {
    id: 'resolution',
    header: 'Action / Resolution Notes',
    width: 38,
    align: 'left',
    getValue: (inc) => inc.resolution_notes || 'Pending Triage / Inspection',
  },
]

/**
 * Generate high-fidelity Excel (.xlsx) workbook for Laboratory Incidents & Damage Register with WYSIWYG visible columns
 */
export async function generateIncidentRecordsXlsxBuffer(
  incidents: IncidentRecordItem[],
  metrics?: IncidentSummaryMetrics,
  filtersMeta?: {
    labName?: string
    dateRange?: string
    traceabilityNote?: string
    visibleColumns?: string[]
  }
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = INSTITUTION_CONFIG.name
  workbook.lastModifiedBy = 'LabSync LIMS'

  // Resolve active visible columns
  const visibleSet = filtersMeta?.visibleColumns && filtersMeta.visibleColumns.length > 0 ? new Set(filtersMeta.visibleColumns) : null
  const activeCols = visibleSet ? ALL_INCIDENT_XLSX_COLS.filter((c) => visibleSet.has(c.id)) : ALL_INCIDENT_XLSX_COLS
  const resolvedCols = activeCols.length > 0 ? activeCols : ALL_INCIDENT_XLSX_COLS
  const lastCol = getColumnLetter(resolvedCols.length)

  const sheet = workbook.addWorksheet('Incident Register', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ state: 'frozen', ySplit: filtersMeta?.traceabilityNote ? 6 : 5 }],
  })

  // 1. Institutional Banner (Rows 1 - 4)
  sheet.mergeCells(`A1:${lastCol}1`)
  const r1 = sheet.getCell('A1')
  r1.value = INSTITUTION_CONFIG.name
  r1.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
  r1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF991B1B' } } // Red-800
  r1.alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.getRow(1).height = 28

  sheet.mergeCells(`A2:${lastCol}2`)
  const r2 = sheet.getCell('A2')
  r2.value = `OFFICIAL LABORATORY EQUIPMENT DAMAGE & SAFETY INCIDENT REGISTER`
  r2.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
  r2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7F1D1D' } } // Red-900
  r2.alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.getRow(2).height = 22

  sheet.mergeCells(`A3:${lastCol}3`)
  const r3 = sheet.getCell('A3')
  r3.value = `Facility: ${filtersMeta?.labName || 'All Facilities'}  |  Date Range: ${filtersMeta?.dateRange || 'All Time'}  |  Exported: ${new Date().toISOString().split('T')[0]}`
  r3.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF475569' } }
  r3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
  r3.alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.getRow(3).height = 18

  let currentRow = 4

  // Traceability metadata row (if available)
  if (filtersMeta?.traceabilityNote) {
    sheet.mergeCells(`A${currentRow}:${lastCol}${currentRow}`)
    const rTrace = sheet.getCell(`A${currentRow}`)
    rTrace.value = `Audit Traceability: ${filtersMeta.traceabilityNote}`
    rTrace.font = { name: 'Arial', size: 8.5, italic: true, color: { argb: 'FF991B1B' } }
    rTrace.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }
    rTrace.alignment = { vertical: 'middle', horizontal: 'center' }
    sheet.getRow(currentRow).height = 18
    currentRow++
  }

  // Summary metrics row (if available)
  if (metrics) {
    sheet.mergeCells(`A${currentRow}:${lastCol}${currentRow}`)
    const rMetrics = sheet.getCell(`A${currentRow}`)
    rMetrics.value = `Total: ${metrics.totalIncidents} | Open: ${metrics.openCount} | Resolved: ${metrics.resolvedCount} | Critical: ${metrics.criticalCount} | Moderate: ${metrics.moderateCount} | Minor: ${metrics.minorCount} | Avg Resolution: ${metrics.averageTimeToResolveLabel}`
    rMetrics.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E293B' } }
    rMetrics.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
    rMetrics.alignment = { vertical: 'middle', horizontal: 'center' }
    sheet.getRow(currentRow).height = 20
    currentRow++
  }

  // TABLE HEADERS
  const headerRow = sheet.getRow(currentRow)
  headerRow.values = resolvedCols.map((c) => c.header)
  headerRow.height = 26
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7F1D1D' } } // Red-900
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF0F172A' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FF475569' } },
      right: { style: 'thin', color: { argb: 'FF475569' } },
    }
  })
  currentRow++

  // Set column widths
  resolvedCols.forEach((col, idx) => {
    sheet.getColumn(idx + 1).width = col.width
  })

  // DATA ROWS
  for (const inc of incidents) {
    const row = sheet.getRow(currentRow)
    row.values = resolvedCols.map((col) => col.getValue(inc))
    row.height = 20

    row.eachCell((cell, colNumber) => {
      const colDef = resolvedCols[colNumber - 1]
      cell.font = { name: 'Arial', size: 9, color: { argb: 'FF0F172A' } }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }

      cell.alignment = { vertical: 'middle', horizontal: colDef.align }

      // Severity highlight
      if (colDef.isSeverity) {
        if (inc.severity === 'major_critical') {
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF991B1B' } }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }
        } else if (inc.severity === 'moderate') {
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFB45309' } }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
        } else {
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0369A1' } }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } }
        }
      } else if (colDef.isStatus) {
        if (inc.status === 'resolved') {
          cell.font = { bold: true, color: { argb: 'FF047857' } }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }
        } else if (inc.status === 'escalated_to_hod') {
          cell.font = { bold: true, color: { argb: 'FF991B1B' } }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }
        }
      }
    })
    currentRow++
  }

  // SIGNATURE NOTICE
  currentRow += 2
  const sigColLeft = 'A'
  const sigColRight = lastCol
  const sigLeft = sheet.getCell(`${sigColLeft}${currentRow}`)
  sigLeft.value = INSTITUTION_CONFIG.signatures.left.title.toUpperCase()
  sigLeft.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } }
  sigLeft.alignment = { horizontal: 'left' }
  sigLeft.border = { top: { style: 'medium', color: { argb: 'FF0F172A' } } }

  const sigRight = sheet.getCell(`${sigColRight}${currentRow}`)
  sigRight.value = INSTITUTION_CONFIG.signatures.right.title.toUpperCase()
  sigRight.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } }
  sigRight.alignment = { horizontal: 'right' }
  sigRight.border = { top: { style: 'medium', color: { argb: 'FF0F172A' } } }

  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer
}

/**
 * Generate high-fidelity Excel (.xlsx) workbook for Lab Maintenance & Servicing Records
 */
export async function generateMaintenanceRecordsXlsxBuffer(
  records: MaintenanceRecordItem[],
  metrics?: MaintenanceSummaryMetrics,
  filtersMeta?: { labName?: string; dateRange?: string }
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = INSTITUTION_CONFIG.name
  workbook.lastModifiedBy = 'LabSync LIMS'

  const sheet = workbook.addWorksheet('Maintenance Records', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ state: 'frozen', ySplit: 8 }],
  })

  // 1. Institutional Banner (Rows 1 - 3)
  sheet.mergeCells('A1:N1')
  const r1 = sheet.getCell('A1')
  r1.value = INSTITUTION_CONFIG.name
  r1.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
  r1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } } // Slate-800
  r1.alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.getRow(1).height = 28

  sheet.mergeCells('A2:N2')
  const r2 = sheet.getCell('A2')
  r2.value = `OFFICIAL LABORATORY PREVENTIVE MAINTENANCE & SERVICING AUDIT REGISTER`
  r2.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
  r2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF312E81' } } // Indigo-900
  r2.alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.getRow(2).height = 22

  sheet.mergeCells('A3:N3')
  const r3 = sheet.getCell('A3')
  r3.value = `Facility: ${filtersMeta?.labName || 'All Facilities'}  |  Scope: ${filtersMeta?.dateRange || 'All Time'}  |  Exported: ${new Date().toISOString().split('T')[0]}`
  r3.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF475569' } }
  r3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
  r3.alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.getRow(3).height = 18

  // 2. SUMMARY METRICS BLOCK (Row 4)
  if (metrics) {
    sheet.mergeCells('A4:C4')
    sheet.getCell('A4').value = `Total Servicing Logs: ${metrics.totalLogs}`
    sheet.getCell('A4').font = { bold: true, size: 9 }

    sheet.mergeCells('D4:F4')
    sheet.getCell('D4').value = `Overdue Reminders: ${metrics.overdueCount}`
    sheet.getCell('D4').font = { bold: true, size: 9, color: { argb: 'FFB45309' } }

    sheet.mergeCells('G4:J4')
    sheet.getCell('G4').value = `Servicing Cycles Completed: ${metrics.completedThisPeriodCount}`
    sheet.getCell('G4').font = { bold: true, size: 9, color: { argb: 'FF047857' } }

    sheet.mergeCells('K4:N4')
    sheet.getCell('K4').value = `Assets Maintained: ${metrics.uniqueAssetsCount ?? records.length}`
    sheet.getCell('K4').font = { bold: true, size: 9, color: { argb: 'FF4338CA' } }

    sheet.getRow(4).height = 20
    sheet.getRow(4).eachCell((c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
      c.alignment = { vertical: 'middle', horizontal: 'center' }
    })
  }

  // Row 5: Empty spacer
  sheet.getRow(5).height = 6

  // 3. PHASE HEADERS (Row 6: Section 1 vs Section 2)
  sheet.mergeCells('A6:G6')
  const rPhase1 = sheet.getCell('A6')
  rPhase1.value = 'SECTION 1: PLAN & PREVENTIVE SCHEDULE SPECIFICATION'
  rPhase1.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
  rPhase1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } } // Slate-800
  rPhase1.alignment = { vertical: 'middle', horizontal: 'center' }

  sheet.mergeCells('H6:N6')
  const rPhase2 = sheet.getCell('H6')
  rPhase2.value = 'SECTION 2: SERVICE EXECUTION & TECHNICAL CERTIFICATION'
  rPhase2.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
  rPhase2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } } // Emerald-800
  rPhase2.alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.getRow(6).height = 22

  // Row 7: Empty spacer
  sheet.getRow(7).height = 4

  // 4. COLUMN HEADERS (Row 8)
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
  const headerRow = sheet.getRow(8)
  headerRow.values = headers
  headerRow.height = 26
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: colNumber <= 7 ? 'FF0F172A' : 'FF064E3B' },
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF0F172A' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FF334155' } },
    }
  })

  // 5. DATA ROWS
  let currentRow = 9
  for (const record of records) {
    const planChecklist = Array.isArray(record.plan?.checklist) ? record.plan.checklist : []
    const completedChecklist = Array.isArray(record.checklist_completed) ? (record.checklist_completed as string[]) : []
    const totalSteps = planChecklist.length > 0 ? planChecklist.length : completedChecklist.length
    const checklistSummary = totalSteps > 0
      ? `${completedChecklist.length}/${totalSteps} (${record.checklist_completed_pct}%)`
      : '—'

    const intervalLabel = record.plan?.interval_days
      ? `Every ${record.plan.interval_days} Days`
      : 'As Needed'

    const checklistItemsStr = planChecklist.length > 0
      ? planChecklist.map((step, idx) => `${idx + 1}. ${step}`).join('; ')
      : (completedChecklist.length > 0 ? completedChecklist.join('; ') : 'Routine Technical Checklist')

    const row = sheet.getRow(currentRow)
    row.values = [
      record.asset_identifier,
      (record.plan?.category || 'general').toUpperCase(),
      record.plan_title || record.plan?.title || 'Preventive Maintenance',
      intervalLabel,
      (record.plan?.target_role || 'lab_incharge').replace('_', ' ').toUpperCase(),
      record.service_date,
      checklistItemsStr,
      record.work_performed,
      checklistSummary,
      record.parts_replaced || 'None (Serviced / Cleaned)',
      record.service_date,
      record.performed_by_name || 'Laboratory Staff',
      record.next_service_due || '—',
      record.remarks || 'Routine maintenance verified.',
    ]

    row.height = 22
    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Arial', size: 9 }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }

      if (colNumber === 9) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
        cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF047857' } }
      } else if (colNumber === 2 || colNumber === 4 || colNumber === 5 || colNumber === 6 || colNumber === 11 || colNumber === 13) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' }
      }
    })

    currentRow++
  }

  // 6. 3-TIER SIGNATURE BLOCKS AT BOTTOM
  currentRow += 2
  sheet.mergeCells(`B${currentRow}:D${currentRow}`)
  sheet.mergeCells(`F${currentRow}:H${currentRow}`)
  sheet.mergeCells(`K${currentRow}:M${currentRow}`)

  const sig1 = sheet.getCell(`B${currentRow}`)
  sig1.value = 'LABORATORY IN-CHARGE'
  sig1.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } }
  sig1.alignment = { horizontal: 'center' }
  sig1.border = { top: { style: 'medium', color: { argb: 'FF0F172A' } } }

  const sig2 = sheet.getCell(`F${currentRow}`)
  sig2.value = 'ACADEMIC COORDINATOR'
  sig2.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } }
  sig2.alignment = { horizontal: 'center' }
  sig2.border = { top: { style: 'medium', color: { argb: 'FF0F172A' } } }

  const sig3 = sheet.getCell(`K${currentRow}`)
  sig3.value = 'CAMPUS CHIEF / PRINCIPAL'
  sig3.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } }
  sig3.alignment = { horizontal: 'center' }
  sig3.border = { top: { style: 'medium', color: { argb: 'FF0F172A' } } }

  currentRow++
  sheet.mergeCells(`B${currentRow}:D${currentRow}`)
  sheet.mergeCells(`F${currentRow}:H${currentRow}`)
  sheet.mergeCells(`K${currentRow}:M${currentRow}`)

  const sub1 = sheet.getCell(`B${currentRow}`)
  sub1.value = 'Technical Verification & Servicing Audit'
  sub1.font = { name: 'Arial', size: 8, italic: true, color: { argb: 'FF64748B' } }
  sub1.alignment = { horizontal: 'center' }

  const sub2 = sheet.getCell(`F${currentRow}`)
  sub2.value = 'Curricular Oversight & Schedule Verification'
  sub2.font = { name: 'Arial', size: 8, italic: true, color: { argb: 'FF64748B' } }
  sub2.alignment = { horizontal: 'center' }

  const sub3 = sheet.getCell(`K${currentRow}`)
  sub3.value = 'Institutional Endorsement & Certification'
  sub3.font = { name: 'Arial', size: 8, italic: true, color: { argb: 'FF64748B' } }
  sub3.alignment = { horizontal: 'center' }

  // 7. Column Auto-Widths (14 columns)
  const colWidths = [18, 14, 28, 16, 18, 16, 32, 34, 18, 22, 14, 22, 18, 30]
  sheet.columns.forEach((col, idx) => {
    col.width = colWidths[idx] || 18
  })

  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer
}

/**
 * 4. Generate Official NEB Student Practical Attendance & Board Exam Compliance Register (.xlsx)
 */
export async function generateStudentBoardComplianceXlsxBuffer(
  report: StudentComplianceReport
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = INSTITUTION_CONFIG.name
  workbook.lastModifiedBy = 'LabSync LIMS'
  workbook.created = new Date()
  workbook.modified = new Date()

  const sheet = workbook.addWorksheet('NEB Board Compliance', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ state: 'frozen', ySplit: 7 }],
  })

  const lastCol = 'I'

  // 1. INSTITUTIONAL TITLE BANNER
  sheet.mergeCells(`A1:${lastCol}1`)
  const r1 = sheet.getCell('A1')
  r1.value = INSTITUTION_CONFIG.name.toUpperCase()
  r1.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
  r1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
  r1.alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.getRow(1).height = 28

  sheet.mergeCells(`A2:${lastCol}2`)
  const r2 = sheet.getCell('A2')
  r2.value = 'NEB PRACTICAL ATTENDANCE & BOARD EXAM COMPLIANCE REGISTER (75% MANDATORY THRESHOLD)'
  r2.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1E293B' } }
  r2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
  r2.alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.getRow(2).height = 24

  sheet.mergeCells(`A3:${lastCol}3`)
  const r3 = sheet.getCell('A3')
  r3.value = `CLASS / COHORT: ${report.class_name.toUpperCase()}  |  ACADEMIC YEAR: ${report.academic_year_name}  |  GENERATED: ${new Date().toLocaleDateString('en-GB')}`
  r3.font = { name: 'Arial', size: 9, bold: false, color: { argb: 'FF475569' } }
  r3.alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.getRow(3).height = 20

  // 2. SUMMARY KPI ROW
  sheet.getRow(4).height = 8

  sheet.mergeCells(`A5:B5`)
  sheet.getCell('A5').value = `Total Enrolled: ${report.total_students}`
  sheet.getCell('A5').font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } }
  sheet.getCell('A5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
  sheet.getCell('A5').alignment = { vertical: 'middle', horizontal: 'center' }

  sheet.mergeCells(`C5:D5`)
  sheet.getCell('C5').value = `Board Eligible (≥75%): ${report.eligible_students}`
  sheet.getCell('C5').font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF047857' } }
  sheet.getCell('C5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } }
  sheet.getCell('C5').alignment = { vertical: 'middle', horizontal: 'center' }

  sheet.mergeCells(`E5:F5`)
  sheet.getCell('E5').value = `Barred (<75%): ${report.barred_students}`
  sheet.getCell('E5').font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFB91C1C' } }
  sheet.getCell('E5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } }
  sheet.getCell('E5').alignment = { vertical: 'middle', horizontal: 'center' }

  sheet.mergeCells(`G5:${lastCol}5`)
  sheet.getCell('G5').value = `Cohort Average: ${report.cohort_avg_rate_pct}%`
  sheet.getCell('G5').font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF4338CA' } }
  sheet.getCell('G5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } }
  sheet.getCell('G5').alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.getRow(5).height = 24

  sheet.getRow(6).height = 8

  // 3. TABLE HEADERS (Row 7)
  const headers = [
    { label: 'S.N.', width: 6, align: 'center' },
    { label: 'Roll No', width: 10, align: 'center' },
    { label: 'Student Full Name', width: 28, align: 'left' },
    { label: 'Registration No', width: 18, align: 'center' },
    { label: 'Practicals Held', width: 16, align: 'center' },
    { label: 'Practicals Attended', width: 18, align: 'center' },
    { label: 'Absences', width: 12, align: 'center' },
    { label: 'Attendance Rate', width: 18, align: 'center' },
    { label: 'NEB Board Status', width: 18, align: 'center' },
  ]

  const headerRow = sheet.getRow(7)
  headerRow.height = 26
  headers.forEach((h, idx) => {
    const colLetter = getColumnLetter(idx + 1)
    const cell = sheet.getCell(`${colLetter}7`)
    cell.value = h.label.toUpperCase()
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
    cell.alignment = { vertical: 'middle', horizontal: h.align as any }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    }
  })

  // 4. DATA ROWS
  let currentRow = 8
  report.records.forEach((rec, idx) => {
    const dataRow = sheet.getRow(currentRow)
    dataRow.height = 20
    const isEven = idx % 2 === 0
    const rowBg = isEven ? 'FFFFFFFF' : 'FFF8FAFC'

    const values = [
      idx + 1,
      rec.roll_number,
      rec.full_name,
      rec.registration_no || '—',
      rec.sessions_held,
      rec.sessions_attended,
      rec.absent_count,
      `${rec.attendance_rate_pct}%`,
      rec.is_eligible ? 'ELIGIBLE' : 'BARRED (<75%)',
    ]

    values.forEach((val, colIdx) => {
      const colLetter = getColumnLetter(colIdx + 1)
      const cell = sheet.getCell(`${colLetter}${currentRow}`)
      cell.value = val
      cell.font = { name: 'Arial', size: 9, color: { argb: 'FF0F172A' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } }
      cell.alignment = { vertical: 'middle', horizontal: headers[colIdx].align as any }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }

      if (colIdx === 8) {
        if (rec.is_eligible) {
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF047857' } }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } }
        } else {
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFB91C1C' } }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } }
        }
      }

      if (colIdx === 7 && !rec.is_eligible) {
        cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFB91C1C' } }
      }
    })

    currentRow++
  })

  // 5. SIGNATURE NOTICE AT BOTTOM
  currentRow += 2
  sheet.mergeCells(`A${currentRow}:C${currentRow}`)
  sheet.mergeCells(`D${currentRow}:F${currentRow}`)
  sheet.mergeCells(`G${currentRow}:I${currentRow}`)

  const sig1 = sheet.getCell(`A${currentRow}`)
  sig1.value = 'SUBJECT INSTRUCTOR / FACULTY'
  sig1.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } }
  sig1.alignment = { horizontal: 'center' }
  sig1.border = { top: { style: 'medium', color: { argb: 'FF0F172A' } } }

  const sig2 = sheet.getCell(`D${currentRow}`)
  sig2.value = 'LABORATORY IN-CHARGE'
  sig2.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } }
  sig2.alignment = { horizontal: 'center' }
  sig2.border = { top: { style: 'medium', color: { argb: 'FF0F172A' } } }

  const sig3 = sheet.getCell(`G${currentRow}`)
  sig3.value = 'CAMPUS CHIEF / PRINCIPAL'
  sig3.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } }
  sig3.alignment = { horizontal: 'center' }
  sig3.border = { top: { style: 'medium', color: { argb: 'FF0F172A' } } }

  currentRow++
  sheet.mergeCells(`A${currentRow}:C${currentRow}`)
  sheet.mergeCells(`D${currentRow}:F${currentRow}`)
  sheet.mergeCells(`G${currentRow}:I${currentRow}`)

  const sub1 = sheet.getCell(`A${currentRow}`)
  sub1.value = 'Practical Conduct & Tally Verification'
  sub1.font = { name: 'Arial', size: 8, italic: true, color: { argb: 'FF64748B' } }
  sub1.alignment = { horizontal: 'center' }

  const sub2 = sheet.getCell(`D${currentRow}`)
  sub2.value = 'Lab Operations & Attendance Audit'
  sub2.font = { name: 'Arial', size: 8, italic: true, color: { argb: 'FF64748B' } }
  sub2.alignment = { horizontal: 'center' }

  const sub3 = sheet.getCell(`G${currentRow}`)
  sub3.value = 'Institutional NEB Board Endorsement'
  sub3.font = { name: 'Arial', size: 8, italic: true, color: { argb: 'FF64748B' } }
  sub3.alignment = { horizontal: 'center' }

  // Set column widths
  headers.forEach((h, idx) => {
    sheet.getColumn(idx + 1).width = h.width
  })

  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer
}
