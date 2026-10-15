import ExcelJS from 'exceljs'

/**
 * Generates an institutional blank roster Excel template.
 * Columns: Full Name * | RFID / Admission No | Roll Number / S.N. | Gender | Contact Phone | Registration No
 */
export async function generateBlankRosterTemplate(params?: {
  academicYearName?: string
  className?: string
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'LabSync LIMS'
  workbook.lastModifiedBy = 'LabSync LIMS'
  workbook.created = new Date()
  workbook.modified = new Date()

  const sheet = workbook.addWorksheet('Class Roster', {
    pageSetup: { orientation: 'portrait', fitToPage: true },
    views: [{ showGridLines: true }],
  })

  // Define Columns
  sheet.columns = [
    { key: 'full_name', width: 32 },
    { key: 'admission_no', width: 22 },
    { key: 'roll_number', width: 16 },
    { key: 'gender', width: 14 },
    { key: 'contact', width: 18 },
    { key: 'registration_no', width: 22 },
  ]

  // Header Title Row (Row 1)
  const titleText = params?.className
    ? `Student Class Roster — ${params.className} (${params.academicYearName || 'Current Academic Year'})`
    : 'Institutional Student Class Roster Template'

  sheet.mergeCells('A1:F1')
  const titleCell = sheet.getCell('A1')
  titleCell.value = titleText
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' }, // Slate 800
  }
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.getRow(1).height = 32

  // Instruction Row (Row 2)
  sheet.mergeCells('A2:F2')
  const instructionCell = sheet.getCell('A2')
  instructionCell.value =
    'Instructions: Student Full Name is required. RFID / Admission No, Roll Number, Gender, and Contact are optional. Official rolls will be finalized alphabetically (A–Z) in the system.'
  instructionCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } }
  instructionCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF8FAFC' }, // Slate 50
  }
  instructionCell.alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.getRow(2).height = 24

  // Column Header Row (Row 3)
  const headers = [
    { col: 1, text: 'Full Name *', bg: 'FF059669' },       // Emerald 600 (Required)
    { col: 2, text: 'RFID / Admission No', bg: 'FF334155' },// Slate 700
    { col: 3, text: 'Roll No / S.N.', bg: 'FF334155' },    // Slate 700
    { col: 4, text: 'Gender', bg: 'FF334155' },            // Slate 700
    { col: 5, text: 'Contact Phone', bg: 'FF334155' },     // Slate 700
    { col: 6, text: 'Registration No', bg: 'FF334155' },   // Slate 700
  ]

  const headerRow = sheet.getRow(3)
  headerRow.height = 28
  headers.forEach((h) => {
    const cell = headerRow.getCell(h.col)
    cell.value = h.text
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: h.bg },
    }
    cell.alignment = { vertical: 'middle', horizontal: h.col === 3 || h.col === 4 ? 'center' : 'left' }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    }
  })

  // Sample Rows (Rows 4-8) with guidance examples matching real school data
  const sampleData = [
    { name: 'AAROGYA SHRESTHA', adm: '1641052469', roll: 1, gender: 'Male', contact: '9847033504', reg: '' },
    { name: 'Alex Khadka', adm: '1641042229', roll: 2, gender: 'Male', contact: '9800745356', reg: '' },
    { name: 'Ankita Chapagain', adm: '1641037109', roll: 3, gender: 'Female', contact: '9807540713', reg: '' },
    { name: 'Arpana Poudel', adm: '1641212211', roll: 4, gender: 'Female', contact: '9808281935', reg: '' },
    { name: 'Bipul Lamichhhane', adm: '3384362168', roll: 5, gender: 'Male', contact: '9842700097', reg: '' },
  ]

  sampleData.forEach((sample, idx) => {
    const rowNum = 4 + idx
    const row = sheet.getRow(rowNum)
    row.height = 20

    row.getCell(1).value = sample.name
    row.getCell(2).value = sample.adm
    row.getCell(3).value = sample.roll
    row.getCell(4).value = sample.gender
    row.getCell(5).value = sample.contact
    row.getCell(6).value = sample.reg

    for (let c = 1; c <= 6; c++) {
      const cell = row.getCell(c)
      cell.font = { name: 'Calibri', size: 11 }
      cell.alignment = { vertical: 'middle', horizontal: c === 3 || c === 4 ? 'center' : 'left' }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }
    }
  })

  // Rows 9 to 40 - Empty clean rows ready for input
  for (let r = 9; r <= 40; r++) {
    const row = sheet.getRow(r)
    row.height = 20

    for (let c = 1; c <= 6; c++) {
      const cell = row.getCell(c)
      cell.font = { name: 'Calibri', size: 11 }
      cell.alignment = { vertical: 'middle', horizontal: c === 3 || c === 4 ? 'center' : 'left' }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
