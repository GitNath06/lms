import ExcelJS from 'exceljs'
import { PracticalGroupedSection, IncidentRecordItem, IncidentSummaryMetrics } from '@/types/records'
import { INSTITUTION_CONFIG } from '@/lib/institution'

interface PracticalMeta {
  labName?: string
  dateRange?: string
  groupByLabel?: string
  academicYear?: string
}

/**
 * Generate high-fidelity Excel (.xlsx) workbook for Practical Records
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
    views: [{ state: 'frozen', ySplit: 6 }],
  })

  // 1. INSTITUTIONAL TITLE BANNER (Rows 1 - 4)
  // Row 1: School Title
  sheet.mergeCells('A1:M1')
  const r1 = sheet.getCell('A1')
  r1.value = INSTITUTION_CONFIG.name
  r1.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
  r1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } } // Slate-900
  r1.alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.getRow(1).height = 28

  // Row 2: Department & Academic Year
  sheet.mergeCells('A2:M2')
  const r2 = sheet.getCell('A2')
  r2.value = `${INSTITUTION_CONFIG.department} • Academic Year: ${meta?.academicYear || INSTITUTION_CONFIG.academicYear}`
  r2.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFE2E8F0' } }
  r2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } } // Slate-800
  r2.alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.getRow(2).height = 20

  // Row 3: Document Title & Metadata
  sheet.mergeCells('A3:M3')
  const r3 = sheet.getCell('A3')
  r3.value = `OFFICIAL PRACTICAL EXPERIMENT RECORD & ATTENDANCE AUDIT SHEET`
  r3.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } }
  r3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } } // Slate-100
  r3.alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.getRow(3).height = 20

  // Row 4: Filter Metadata
  sheet.mergeCells('A4:M4')
  const r4 = sheet.getCell('A4')
  r4.value = `Facility: ${meta?.labName || 'All Laboratories'}  |  Date Range: ${meta?.dateRange || 'All Time'}  |  Grouping: ${meta?.groupByLabel || 'None'}  |  Exported: ${new Date().toISOString().split('T')[0]}`
  r4.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF475569' } }
  r4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
  r4.alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.getRow(4).height = 18

  // Row 5: Empty spacer
  sheet.getRow(5).height = 6

  // 2. TABLE HEADERS (Row 6)
  const headers = [
    'Date',
    'Period / Slot',
    'Laboratory Facility',
    'Subject & Code',
    'Class / Batch',
    'Practical Experiment Title',
    'Topic Learned',
    'Subject Teacher',
    'Present',
    'Total',
    'Attendance %',
    'Status',
    'Teacher Remarks / Verification Notes',
  ]
  const headerRow = sheet.getRow(6)
  headerRow.values = headers
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

  // 3. DATA ROWS & GROUPING SECTIONS
  let currentRowIndex = 7

  for (const section of sections) {
    // If grouped, render Group Header Banner
    if (section.groupKey !== 'all') {
      sheet.mergeCells(`A${currentRowIndex}:M${currentRowIndex}`)
      const groupCell = sheet.getCell(`A${currentRowIndex}`)
      groupCell.value = `📂 SECTION: ${section.groupTitle.toUpperCase()}`
      groupCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E293B' } }
      groupCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }
      groupCell.alignment = { vertical: 'middle', indent: 1 }
      sheet.getRow(currentRowIndex).height = 22
      currentRowIndex++
    }

    // Records
    for (const record of section.records) {
      const row = sheet.getRow(currentRowIndex)
      const isSkipped = record.status === 'skipped'
      const attDecimal = record.total_students > 0 ? record.present_students / record.total_students : 0

      row.values = [
        record.date,
        record.period_label,
        record.labs?.name || record.lab_id,
        record.subject_name,
        record.batch_group,
        record.practical_title,
        record.topic_learned || '—',
        record.profiles?.full_name || 'Assigned Subject Teacher',
        record.present_students,
        record.total_students,
        attDecimal,
        isSkipped ? 'SKIPPED' : 'CONDUCTED',
        isSkipped ? record.skip_reason || 'Postponed / Holiday' : record.remarks || 'Apparatus verified in good condition',
      ]

      row.height = 20
      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Arial', size: 9, color: { argb: 'FF0F172A' } }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        }

        // Alignments & formats
        if (colNumber === 1 || colNumber === 2) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' }
        } else if (colNumber === 9 || colNumber === 10) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' }
          cell.numFmt = '#,##0'
        } else if (colNumber === 11) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' }
          cell.numFmt = '0.0%'
        } else if (colNumber === 12) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' }
          if (isSkipped) {
            cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFB45309' } } // Amber-700
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
          } else {
            cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF047857' } } // Emerald-700
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }
          }
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' }
        }
      })

      currentRowIndex++
    }

    // Subtotal Row if grouped
    if (section.groupKey !== 'all') {
      const subtotalRow = sheet.getRow(currentRowIndex)
      const avgAttDecimal = section.subtotal.totalEnrolled > 0
        ? section.subtotal.totalPresent / section.subtotal.totalEnrolled
        : 0

      sheet.mergeCells(`A${currentRowIndex}:H${currentRowIndex}`)
      const subtotalLabel = sheet.getCell(`A${currentRowIndex}`)
      subtotalLabel.value = `SUBTOTAL [${section.groupTitle}]: ${section.subtotal.totalSessions} Sessions (${section.subtotal.conductedSessions} Conducted, ${section.subtotal.skippedSessions} Skipped)`
      subtotalLabel.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E293B' } }
      subtotalLabel.alignment = { vertical: 'middle', horizontal: 'right' }

      const cPresent = sheet.getCell(`I${currentRowIndex}`)
      cPresent.value = section.subtotal.totalPresent
      cPresent.numFmt = '#,##0'
      cPresent.font = { name: 'Arial', size: 9, bold: true }
      cPresent.alignment = { vertical: 'middle', horizontal: 'right' }

      const cTotal = sheet.getCell(`J${currentRowIndex}`)
      cTotal.value = section.subtotal.totalEnrolled
      cTotal.numFmt = '#,##0'
      cTotal.font = { name: 'Arial', size: 9, bold: true }
      cTotal.alignment = { vertical: 'middle', horizontal: 'right' }

      const cPct = sheet.getCell(`K${currentRowIndex}`)
      cPct.value = avgAttDecimal
      cPct.numFmt = '0.0%'
      cPct.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E3A8A' } }
      cPct.alignment = { vertical: 'middle', horizontal: 'right' }

      subtotalRow.height = 22
      subtotalRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF94A3B8' } },
          bottom: { style: 'medium', color: { argb: 'FF64748B' } },
        }
      })

      currentRowIndex++
    }
  }

  // 4. DUAL SIGNATURE BLOCKS AT BOTTOM
  currentRowIndex += 2
  const sigTitleRow = sheet.getRow(currentRowIndex)
  sheet.mergeCells(`B${currentRowIndex}:E${currentRowIndex}`)
  sheet.mergeCells(`J${currentRowIndex}:L${currentRowIndex}`)

  const sigLeft = sheet.getCell(`B${currentRowIndex}`)
  sigLeft.value = INSTITUTION_CONFIG.signatures.left.title.toUpperCase()
  sigLeft.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } }
  sigLeft.alignment = { horizontal: 'center' }
  sigLeft.border = { top: { style: 'medium', color: { argb: 'FF0F172A' } } }

  const sigRight = sheet.getCell(`J${currentRowIndex}`)
  sigRight.value = INSTITUTION_CONFIG.signatures.right.title.toUpperCase()
  sigRight.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } }
  sigRight.alignment = { horizontal: 'center' }
  sigRight.border = { top: { style: 'medium', color: { argb: 'FF0F172A' } } }

  currentRowIndex++
  const sigSubRow = sheet.getRow(currentRowIndex)
  sheet.mergeCells(`B${currentRowIndex}:E${currentRowIndex}`)
  sheet.mergeCells(`J${currentRowIndex}:L${currentRowIndex}`)

  const subLeft = sheet.getCell(`B${currentRowIndex}`)
  subLeft.value = INSTITUTION_CONFIG.signatures.left.subtitle
  subLeft.font = { name: 'Arial', size: 8, italic: true, color: { argb: 'FF64748B' } }
  subLeft.alignment = { horizontal: 'center' }

  const subRight = sheet.getCell(`J${currentRowIndex}`)
  subRight.value = INSTITUTION_CONFIG.signatures.right.subtitle
  subRight.font = { name: 'Arial', size: 8, italic: true, color: { argb: 'FF64748B' } }
  subRight.alignment = { horizontal: 'center' }

  // 5. COLUMN AUTO-WIDTHS (13 columns)
  const colWidths = [12, 18, 24, 28, 16, 32, 28, 24, 10, 10, 12, 14, 38]
  sheet.columns.forEach((col, idx) => {
    col.width = colWidths[idx] || 15
  })

  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer
}

/**
 * Generate high-fidelity Excel (.xlsx) workbook for Laboratory Incidents & Damage Register
 */
export async function generateIncidentRecordsXlsxBuffer(
  incidents: IncidentRecordItem[],
  metrics?: IncidentSummaryMetrics,
  filtersMeta?: { labName?: string; dateRange?: string }
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = INSTITUTION_CONFIG.name
  workbook.lastModifiedBy = 'LabSync LIMS'

  const sheet = workbook.addWorksheet('Incident Register', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ state: 'frozen', ySplit: 8 }],
  })

  // 1. Institutional Banner (Rows 1 - 3)
  sheet.mergeCells('A1:U1')
  const r1 = sheet.getCell('A1')
  r1.value = INSTITUTION_CONFIG.name
  r1.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
  r1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF991B1B' } } // Red-800
  r1.alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.getRow(1).height = 28

  sheet.mergeCells('A2:U2')
  const r2 = sheet.getCell('A2')
  r2.value = `OFFICIAL LABORATORY APPARATUS DAMAGE & SAFETY INCIDENT REGISTER`
  r2.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
  r2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7F1D1D' } } // Red-900
  r2.alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.getRow(2).height = 22

  sheet.mergeCells('A3:U3')
  const r3 = sheet.getCell('A3')
  r3.value = `Facility: ${filtersMeta?.labName || 'All Facilities'}  |  Date Range: ${filtersMeta?.dateRange || 'All Time'}  |  Exported: ${new Date().toISOString().split('T')[0]}`
  r3.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF475569' } }
  r3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
  r3.alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.getRow(3).height = 18

  // 2. SUMMARY METRICS BLOCK (Rows 4 - 5)
  if (metrics) {
    sheet.mergeCells('A4:D4')
    sheet.getCell('A4').value = `Total Incidents: ${metrics.totalIncidents}`
    sheet.getCell('A4').font = { bold: true, size: 9 }

    sheet.mergeCells('E4:H4')
    sheet.getCell('E4').value = `Active / Open: ${metrics.openCount} | Resolved: ${metrics.resolvedCount}`
    sheet.getCell('E4').font = { bold: true, size: 9, color: { argb: 'FFB45309' } }

    sheet.mergeCells('I4:M4')
    sheet.getCell('I4').value = `Severity: Critical (${metrics.criticalCount}) | Moderate (${metrics.moderateCount}) | Minor (${metrics.minorCount})`
    sheet.getCell('I4').font = { bold: true, size: 9, color: { argb: 'FF991B1B' } }

    sheet.mergeCells('N4:U4')
    sheet.getCell('N4').value = `Avg Time-to-Resolve: ${metrics.averageTimeToResolveLabel} (${metrics.underRepairCount} Under Repair, ${metrics.replacedCount} Replaced)`
    sheet.getCell('N4').font = { bold: true, size: 9, color: { argb: 'FF047857' } }

    sheet.getRow(4).height = 20
    sheet.getRow(4).eachCell((c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
      c.alignment = { vertical: 'middle', horizontal: 'center' }
    })
  }

  // Row 6: Empty
  sheet.getRow(6).height = 6

  // 3. PHASE HEADERS (Row 7: Reported Details vs Action Taken & Resolution)
  sheet.mergeCells('A7:M7')
  const rPhase1 = sheet.getCell('A7')
  rPhase1.value = 'SECTION 1: REPORTED INCIDENT & EQUIPMENT DAMAGE DETAILS'
  rPhase1.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
  rPhase1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } } // Slate-800
  rPhase1.alignment = { vertical: 'middle', horizontal: 'center' }

  sheet.mergeCells('N7:U7')
  const rPhase2 = sheet.getCell('N7')
  rPhase2.value = 'SECTION 2: ACTION TAKEN, ESCALATION & RESOLUTION LIFECYCLE'
  rPhase2.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
  rPhase2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } } // Emerald-800
  rPhase2.alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.getRow(7).height = 22

  // 4. COLUMN HEADERS (Row 8)
  const headers = [
    'Case ID',
    'Date',
    'Period / Slot',
    'Laboratory',
    'Class / Batch',
    'Subject Teacher',
    'Incident Title',
    'Type',
    'Severity',
    'Apparatus / Equipment Name',
    'Qty',
    'Student Roll(s)',
    'Reported By',
    'Status',
    'HOD Escalated',
    'Escalation Reason',
    'Escalated At',
    'Action / Resolution Audit Notes',
    'Resolved By',
    'Resolved At',
    'Time to Resolve',
  ]
  const headerRow = sheet.getRow(8)
  headerRow.values = headers
  headerRow.height = 26
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: colNumber <= 13 ? 'FF334155' : 'FF047857' },
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF0F172A' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FF475569' } },
      right: { style: 'thin', color: { argb: 'FF475569' } },
    }
  })

  // 5. DATA ROWS
  let currentRow = 9
  for (const inc of incidents) {
    const row = sheet.getRow(currentRow)
    row.values = [
      inc.id,
      inc.date,
      inc.session_label,
      inc.labs?.name || inc.lab_id,
      inc.batch_name,
      inc.subject_teacher_name,
      inc.title,
      inc.incident_type,
      inc.severity.toUpperCase(),
      inc.equipment_name,
      inc.quantity,
      inc.student_rolls || 'N/A',
      inc.reporter_profile?.full_name || inc.reported_by,
      inc.status.toUpperCase(),
      inc.escalated_to_hod ? 'YES' : 'NO',
      inc.escalation_reason || '—',
      inc.escalated_at ? inc.escalated_at.split('T')[0] : '—',
      inc.resolution_notes || 'Pending resolution triage',
      inc.resolver_profile?.full_name || inc.resolved_by || 'Unassigned',
      inc.resolved_at ? inc.resolved_at.split('T')[0] : 'Open',
      inc.time_to_resolve_label,
    ]

    row.height = 20
    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Arial', size: 9, color: { argb: 'FF0F172A' } }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }

      // Severity styling
      if (colNumber === 9) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
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
      } else if (colNumber === 14) {
        // Status styling
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
        if (inc.status === 'resolved') {
          cell.font = { bold: true, color: { argb: 'FF047857' } }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }
        } else if (inc.status === 'escalated_to_hod') {
          cell.font = { bold: true, color: { argb: 'FF991B1B' } }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }
        }
      } else if (colNumber === 11) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' }
        cell.numFmt = '#,##0'
      } else {
        cell.alignment = { vertical: 'middle', horizontal: colNumber <= 3 ? 'center' : 'left' }
      }
    })

    currentRow++
  }

  // 6. DUAL SIGNATURE BLOCKS AT BOTTOM
  currentRow += 2
  sheet.mergeCells(`C${currentRow}:F${currentRow}`)
  sheet.mergeCells(`O${currentRow}:R${currentRow}`)

  const sigLeft = sheet.getCell(`C${currentRow}`)
  sigLeft.value = INSTITUTION_CONFIG.signatures.left.title.toUpperCase()
  sigLeft.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } }
  sigLeft.alignment = { horizontal: 'center' }
  sigLeft.border = { top: { style: 'medium', color: { argb: 'FF0F172A' } } }

  const sigRight = sheet.getCell(`O${currentRow}`)
  sigRight.value = INSTITUTION_CONFIG.signatures.right.title.toUpperCase()
  sigRight.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } }
  sigRight.alignment = { horizontal: 'center' }
  sigRight.border = { top: { style: 'medium', color: { argb: 'FF0F172A' } } }

  const colWidths = [12, 12, 16, 20, 14, 20, 32, 14, 14, 24, 8, 16, 20, 16, 12, 24, 14, 36, 18, 14, 16]
  sheet.columns.forEach((col, idx) => {
    col.width = colWidths[idx] || 15
  })

  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer
}
