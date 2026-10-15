import ExcelJS from 'exceljs'
import type { RawRosterRow, ParsedRosterRow } from './types'

/**
 * Normalizes header strings for flexible column matching
 */
function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function matchColumnType(
  header: string
): 'roll' | 'name' | 'adm' | 'reg' | 'gender' | 'contact' | null {
  const norm = normalizeHeader(header)
  if (['roll', 'rollno', 'rollnumber', 'sn', 'snno', 'symbolno'].includes(norm)) {
    return 'roll'
  }
  if (['name', 'studentname', 'fullname', 'nameofstudent'].includes(norm)) {
    return 'name'
  }
  // Matches RFID No., Card No., Student ID, or Admission No.
  if (
    [
      'rfid',
      'rfidno',
      'rfidnumber',
      'cardno',
      'smartcardno',
      'admissionno',
      'admissionnumber',
      'admno',
      'admnumber',
      'studentid',
      'admid',
      'idno',
    ].includes(norm)
  ) {
    return 'adm'
  }
  if (['registrationno', 'registrationnumber', 'regno', 'regnumber', 'boardreg', 'boardregno'].includes(norm)) {
    return 'reg'
  }
  if (['gender', 'sex'].includes(norm)) {
    return 'gender'
  }
  if (['contact', 'phone', 'phoneno', 'mobile', 'guardianphone', 'contactno'].includes(norm)) {
    return 'contact'
  }
  return null
}

/**
 * Parses CSV text into raw key-value rows
 */
function parseCsvContent(csvText: string): RawRosterRow[] {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0)
  if (lines.length < 2) return []

  // Split lines accounting for quotes
  const parseLine = (line: string): string[] => {
    const result: string[] = []
    let cur = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') {
        inQuotes = !inQuotes
      } else if (c === ',' && !inQuotes) {
        result.push(cur.trim())
        cur = ''
      } else {
        cur += c
      }
    }
    result.push(cur.trim())
    return result
  }

  // Find header line
  let headerIndex = -1
  let colMap: {
    roll?: number
    name?: number
    adm?: number
    reg?: number
    gender?: number
    contact?: number
  } = {}

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const cols = parseLine(lines[i])
    const found: typeof colMap = {}
    cols.forEach((col, idx) => {
      const match = matchColumnType(col)
      if (match === 'roll') found.roll = idx
      if (match === 'name') found.name = idx
      if (match === 'adm') found.adm = idx
      if (match === 'reg') found.reg = idx
      if (match === 'gender') found.gender = idx
      if (match === 'contact') found.contact = idx
    })

    // Student Name is the ONLY required column to identify a valid roster header
    if (found.name !== undefined) {
      headerIndex = i
      colMap = found
      break
    }
  }

  if (headerIndex === -1) {
    throw new Error("Could not find required header ('Full Name' or 'Student Name') in CSV file.")
  }

  const rows: RawRosterRow[] = []
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const cols = parseLine(lines[i])
    if (cols.length === 0 || cols.every((c) => c === '')) continue

    const rollVal = colMap.roll !== undefined ? cols[colMap.roll] : null
    const nameVal = colMap.name !== undefined ? cols[colMap.name] : null
    const admVal = colMap.adm !== undefined ? cols[colMap.adm] : null
    const regVal = colMap.reg !== undefined ? cols[colMap.reg] : null
    const genderVal = colMap.gender !== undefined ? cols[colMap.gender] : null
    const contactVal = colMap.contact !== undefined ? cols[colMap.contact] : null

    rows.push({
      roll_number: rollVal,
      full_name: nameVal,
      admission_no: admVal,
      registration_no: regVal,
      gender: genderVal,
      contact: contactVal,
    })
  }

  return rows
}

/**
 * Parses Excel workbook (.xlsx / .xls) buffer into raw key-value rows
 */
async function parseExcelBuffer(buffer: Buffer): Promise<RawRosterRow[]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as any)

  const worksheet = workbook.worksheets[0]
  if (!worksheet) {
    throw new Error('Spreadsheet contains no worksheets.')
  }

  let headerRowIndex = -1
  let colMap: {
    roll?: number
    name?: number
    adm?: number
    reg?: number
    gender?: number
    contact?: number
  } = {}

  // Scan first 15 rows for header row
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (headerRowIndex !== -1 || rowNumber > 15) return

    const found: typeof colMap = {}
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const text = cell.text?.toString() || ''
      const match = matchColumnType(text)
      if (match === 'roll') found.roll = colNumber
      if (match === 'name') found.name = colNumber
      if (match === 'adm') found.adm = colNumber
      if (match === 'reg') found.reg = colNumber
      if (match === 'gender') found.gender = colNumber
      if (match === 'contact') found.contact = colNumber
    })

    // Student Name is the ONLY mandatory column
    if (found.name !== undefined) {
      headerRowIndex = rowNumber
      colMap = found
    }
  })

  if (headerRowIndex === -1) {
    throw new Error("Could not find required column header ('Student Name' or 'Full Name') in worksheet.")
  }

  const rows: RawRosterRow[] = []
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= headerRowIndex) return

    const rollCell = colMap.roll ? row.getCell(colMap.roll) : null
    const nameCell = colMap.name ? row.getCell(colMap.name) : null
    const admCell = colMap.adm ? row.getCell(colMap.adm) : null
    const regCell = colMap.reg ? row.getCell(colMap.reg) : null
    const genderCell = colMap.gender ? row.getCell(colMap.gender) : null
    const contactCell = colMap.contact ? row.getCell(colMap.contact) : null

    const rollText = rollCell?.text?.trim() || ''
    const nameText = nameCell?.text?.trim() || ''
    const admText = admCell?.text?.trim() || ''
    const regText = regCell?.text?.trim() || ''
    const genderText = genderCell?.text?.trim() || ''
    const contactText = contactCell?.text?.trim() || ''

    // Skip entirely blank rows
    if (!rollText && !nameText && !admText && !regText && !genderText && !contactText) return

    rows.push({
      roll_number: rollText,
      full_name: nameText,
      admission_no: admText,
      registration_no: regText,
      gender: genderText,
      contact: contactText,
    })
  })

  return rows
}

/**
 * Universal multi-format spreadsheet parser (.xlsx, .xls, .csv)
 */
export async function parseRosterFile(
  fileBuffer: Buffer,
  fileName: string
): Promise<ParsedRosterRow[]> {
  const isCsv = fileName.toLowerCase().endsWith('.csv')
  const rawRows: RawRosterRow[] = isCsv
    ? parseCsvContent(fileBuffer.toString('utf8'))
    : await parseExcelBuffer(fileBuffer)

  if (rawRows.length === 0) {
    throw new Error('The uploaded spreadsheet does not contain any student rows.')
  }

  // Convert raw rows to clean structured ParsedRosterRows
  const parsedRows: ParsedRosterRow[] = []

  rawRows.forEach((row, idx) => {
    const rowIndex = idx + 1

    // Extract roll number as integer (defaults to null if absent/not provided)
    let rollNum: number | null = null
    if (typeof row.roll_number === 'number') {
      rollNum = Math.floor(row.roll_number)
    } else if (typeof row.roll_number === 'string' && row.roll_number.trim() !== '') {
      const match = row.roll_number.match(/\d+/)
      rollNum = match ? parseInt(match[0], 10) : null
    }

    const cleanName = (row.full_name || '').trim()
    const cleanAdm = (row.admission_no || '').trim() || null
    const cleanReg = (row.registration_no || '').trim() || null

    // Normalize optional gender
    let cleanGender: 'male' | 'female' | 'other' | null = null
    if (row.gender) {
      const gNorm = row.gender.toString().toLowerCase().trim()
      if (gNorm.startsWith('m')) cleanGender = 'male'
      else if (gNorm.startsWith('f')) cleanGender = 'female'
      else if (gNorm.startsWith('o')) cleanGender = 'other'
    }

    const cleanContact = (row.contact || '').toString().trim() || null

    parsedRows.push({
      row_index: rowIndex,
      roll_number: rollNum,
      full_name: cleanName,
      admission_no: cleanAdm,
      registration_no: cleanReg,
      gender: cleanGender,
      contact: cleanContact,
    })
  })

  return parsedRows
}
