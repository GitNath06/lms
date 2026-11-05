import type { RecordReportSpec } from '../../types/report-spec'
import type { PracticalRecordItem } from '../../types/records'

/**
 * Sanitizes subject names to defensively strip repeating course code prefixes.
 * E.g. "COMP-12 - COMP-12 — Data Structures & Algorithms Lab" -> "COMP-12 — Data Structures & Algorithms Lab"
 * E.g. "COMP-12 - Data Structures & Algorithms Lab" -> "Data Structures & Algorithms Lab"
 */
export function sanitizeSubjectTitle(subject: string | null | undefined): string {
  if (!subject || !subject.trim()) return '—'
  let s = subject.trim()
  // Clean repeating code prefix: "COMP-12 - COMP-12 — ..." -> "COMP-12 — ..."
  s = s.replace(/^([A-Z0-9-]+)\s*[-–—]\s*\1\s*[-–—]\s*/i, '$1 — ')
  return s
}

/**
 * Canonical Class Alias Map
 * Maps canonical institutional classes from the Admin Panel to known historical/legacy variations.
 */
export const CLASS_ALIAS_MAP: Record<string, string[]> = {
  '12 Eng': ['12 Eng', '12C', '12C - Tech Stream Sec A', '12C - Tech Stream', '12-Eng', 'Class 12', '12C-A'],
  '11 Eng': ['11 Eng', '11 Sc', '11 Sc - Science Stream Sec B', '11 Sc - Science Sec B', '11-Eng', 'Class 11', '11Sc-B', '11Sc'],
  '12 Mgt': ['12 Mgt', '12 Mgt - Mgmt Stream Sec A', '12-Mgt'],
  '11 Mgt': ['11 Mgt', '11C - Computer Tech Sec A', '11C', '11-Mgt'],
  '10 Eng': ['10 Eng', 'Class 10', 'Grade 10'],
  '9 Eng': ['9 Eng', 'Class 9', 'Grade 9'],
  '8A': ['8A', 'Grade 8A'],
  '7B': ['7B', 'Grade 7B'],
  '6A': ['6A', 'Grade 6A'],
}

/**
 * Resolves a class name into all known query aliases for backward compatibility.
 */
export function getClassAliases(className: string | null | undefined): string[] {
  if (!className || className === 'all') return []
  return CLASS_ALIAS_MAP[className] || [className]
}

/**
 * Shortens institutional class strings to clean codes.
 * E.g. "12 Eng - Computer Engineering" -> "12 Eng", "12C - Tech Stream Sec A" -> "12C-A".
 * Explicit Fallback: Returns raw original string verbatim if unrecognized.
 */
export function formatClassCode(batchGroup: string | null | undefined): string {
  if (!batchGroup || !batchGroup.trim()) return '—'
  const clean = batchGroup.trim()

  // 1. Canonical Admin Panel Classes: e.g. "12 Eng - Computer Engineering" -> "12 Eng", "8A - General Science" -> "8A"
  const matchCanonical = clean.match(/^(\d+\s*(?:Eng|Mgt)|[6789][A-Z]|\d+)\s*-\s*[A-Za-z\s&-]+$/i)
  if (matchCanonical) {
    return matchCanonical[1].trim()
  }

  // Exact match for already-canonical class names: "12 Eng", "11 Eng", "12 Mgt", "8A", "7B", "6A"
  if (/^(\d+\s*(?:Eng|Mgt)|[6789][A-Z])$/i.test(clean)) {
    return clean
  }

  // 2. Grade + Stream + Section: "12C - Tech Stream Sec A" -> "12C-A", "11 Sc - Science Stream Sec B" -> "11Sc-B"
  const matchSec = clean.match(/^(\d+[A-Za-z\s]+?)(?:\s*-\s*[A-Za-z\s-]+)?(?:\s+(?:Sec|Section)\s+([A-Za-z0-9]+))$/i)
  if (matchSec) {
    const base = matchSec[1].replace(/\s+/g, '').trim()
    const sec = matchSec[2].trim()
    return `${base}-${sec}`
  }

  // 3. Grade format: "Grade 11 - Sci A" -> "11-SciA", "Grade 12 - Sci B" -> "12-SciB"
  const matchGrade = clean.match(/^Grade\s+(\d+)\s*-\s*([A-Za-z0-9\s-]+)$/i)
  if (matchGrade) {
    return `${matchGrade[1]}-${matchGrade[2].replace(/\s+/g, '')}`
  }

  // 4. Simple class format: "Class 10", "Class 11", "Class 6" -> "Class 10", "Class 11"
  if (/^Class\s+\d+$/i.test(clean)) {
    return clean
  }

  // 5. Grade + Stream without section: "12B - Bio-Science Stream" -> "12B", "11 Sc - Science Stream" -> "11Sc"
  const matchStream = clean.match(/^(\d+[A-Za-z\s]*?)\s*-\s*[A-Za-z\s-]+(?:Stream)?$/i)
  if (matchStream) {
    return matchStream[1].replace(/\s+/g, '').trim()
  }

  // 6. Short code already: "12C", "11A" -> return as-is
  if (/^\d+[A-Za-z]{1,2}$/.test(clean)) {
    return clean
  }

  // EXPLICIT FALLBACK: Return raw original string verbatim, never mangled!
  return clean
}

/**
 * Formats subject code to strictly isolate the subject code without the class suffix.
 * E.g. "WMAD-11" -> "WMAD", "COMP-12" -> "COMP", "CHEM-11" -> "CHEM", "CP-9" -> "CP".
 */
export function cleanSubjectCode(code?: string | null, name?: string | null): string {
  if (code && code.trim()) {
    return code.trim().replace(/[-_\s]+(?:Class\s*)?\d+[A-Za-z]?$/i, '').trim()
  }
  if (name && name.trim()) {
    const codeMatch = name.match(/\b([A-Z]{2,6})(?:[-_\s]*\d+)?\b/)
    if (codeMatch) return codeMatch[1]
    return name.slice(0, 6).toUpperCase()
  }
  return '—'
}

/**
 * Strips course code and class prefixes from the practical title.
 * E.g. "WMAD-11 Practical Session" -> "Practical Session"
 * E.g. "CHEM-11 - Chemistry Lab" -> "Chemistry Lab"
 * E.g. "COMP-12 Practical Session" -> "Practical Session"
 * E.g. "PHY-12 - Physics Lab" -> "Physics Lab"
 * E.g. "CP-9 - Computer Prog" -> "Computer Prog"
 */
export function cleanPracticalTitle(title: string | null | undefined): string {
  if (!title || !title.trim()) return '—'
  let clean = title.trim()
  clean = clean.replace(/^[A-Z]{2,6}[-_ ]?\d*[A-Za-z]?\s*[-:–—]\s*/i, '')
  clean = clean.replace(/^[A-Z]{2,6}[-_ ]?\d*[A-Za-z]?\s+/i, '')
  return clean || title
}

/**
 * Converts long facility names to short institutional facility codes.
 * E.g. "Chemistry Laboratory" -> "Chem-Lab", "Physics Laboratory" -> "Phys-Lab", "Computer Lab" -> "Com-Lab"
 */
export function formatFacilityShortCode(facility?: string | null): string {
  if (!facility || !facility.trim()) return '—'
  const lower = facility.toLowerCase()
  if (lower.includes('comp') || lower.includes('computer')) return 'Com-Lab'
  if (lower.includes('chem') || lower.includes('chemistry')) return 'Chem-Lab'
  if (lower.includes('phys') || lower.includes('physics')) return 'Phys-Lab'
  if (lower.includes('bio') || lower.includes('biology')) return 'Bio-Lab'
  if (lower.includes('elec') || lower.includes('electronics')) return 'Elec-Lab'
  return facility.replace(/\s+(Laboratory|Lab).*$/i, '-Lab')
}

export const practicalReportSpec: RecordReportSpec<PracticalRecordItem> = {
  reportId: 'practical_logs',
  title: 'Practical Experiment Records & Attendance Logbook',
  subtitle: 'Official record of conducted academic laboratory experiments, roll-call attendance, and faculty verification remarks.',
  badgeCode: 'DOC-PL-2026',
  columns: [
    {
      id: 'date',
      key: 'date',
      label: 'Date',
      classification: 'structured',
      align: 'left',
      sortable: true,
      dbColumn: 'date',
      filterType: 'text',
      typicalLength: 10,
      maxLength: 10,
      ui: {
        widthClass: 'w-24',
      },
      print: {
        detailed: { widthPercent: 8, maxChars: 12 },
        compact: { widthPercent: 7, maxChars: 10 },
      },
      export: {
        xlsxWidth: 12,
        csvHeader: 'Date',
        alwaysFullText: true,
      },
      accessor: (r) => ({
        raw: r.date,
        displayText: r.date,
      }),
    },
    {
      id: 'period_label',
      key: 'period_label',
      label: 'Period',
      classification: 'structured',
      align: 'left',
      sortable: true,
      dbColumn: 'period_label',
      filterType: 'text',
      typicalLength: 18,
      maxLength: 28,
      ui: {
        widthClass: 'w-16',
      },
      print: {
        detailed: { widthPercent: 5, maxChars: 18 },
        compact: { widthPercent: 5, maxChars: 12 },
      },
      export: {
        xlsxWidth: 14,
        csvHeader: 'Period',
        alwaysFullText: true,
      },
      accessor: (r) => ({
        raw: r.period_label,
        displayText: r.period_label ? r.period_label.replace(/\s*\([^)]*\)/, '') : '—',
      }),
    },
    {
      id: 'batch_group',
      key: 'batch_group',
      label: 'Class',
      classification: 'structured',
      align: 'left',
      sortable: true,
      dbColumn: 'batch_group',
      filterType: 'text',
      typicalLength: 16,
      maxLength: 25,
      ui: {
        widthClass: 'w-16',
      },
      print: {
        detailed: { widthPercent: 5, maxChars: 14 },
        compact: { widthPercent: 5, maxChars: 10 },
      },
      export: {
        xlsxWidth: 14,
        csvHeader: 'Class',
        alwaysFullText: true,
      },
      accessor: (r) => ({
        raw: r.batch_group,
        displayText: formatClassCode(r.batch_group),
        subText: r.batch_group,
      }),
    },
    {
      id: 'subject_name',
      key: 'subject_name',
      label: 'Subject',
      classification: 'structured',
      align: 'left',
      sortable: true,
      dbColumn: 'subject_name',
      filterType: 'text',
      typicalLength: 10,
      maxLength: 20,
      ui: {
        widthClass: 'w-20',
      },
      print: {
        detailed: { widthPercent: 7, maxChars: 15 },
        compact: { widthPercent: 6, maxChars: 12 },
      },
      export: {
        xlsxWidth: 16,
        csvHeader: 'Subject Code',
        alwaysFullText: true,
      },
      accessor: (r) => ({
        raw: r.subject_code || r.subject_name,
        displayText: cleanSubjectCode(r.subject_code, r.subject_name),
      }),
    },
    {
      id: 'practical_title',
      key: 'practical_title',
      label: 'Practicals',
      classification: 'structured',
      align: 'left',
      sortable: true,
      dbColumn: 'practical_title',
      filterType: 'text',
      typicalLength: 35,
      maxLength: 80,
      ui: {
        widthClass: 'min-w-[240px]',
      },
      print: {
        detailed: { widthPercent: 30, maxChars: 80 },
        compact: { widthPercent: 28, maxChars: 60 },
      },
      export: {
        xlsxWidth: 42,
        csvHeader: 'Practicals',
        alwaysFullText: true,
      },
      accessor: (r) => ({
        raw: r.practical_title,
        displayText: cleanPracticalTitle(r.practical_title),
      }),
    },
    {
      id: 'teacher_name',
      key: 'profiles.full_name',
      label: 'Subject Teacher',
      classification: 'structured',
      align: 'left',
      sortable: true,
      dbColumn: 'full_name',
      foreignTable: 'profiles',
      filterType: 'text',
      typicalLength: 18,
      maxLength: 28,
      ui: {
        widthClass: 'w-32',
      },
      print: {
        detailed: { widthPercent: 12, maxChars: 24 },
        compact: { widthPercent: 12, maxChars: 18 },
      },
      export: {
        xlsxWidth: 22,
        csvHeader: 'Subject Teacher',
        alwaysFullText: true,
      },
      accessor: (r) => ({
        raw: r.profiles?.full_name,
        displayText: r.profiles?.full_name || 'Assigned Teacher',
      }),
    },
    {
      id: 'attendance',
      key: 'attendance_pct',
      label: 'Attendance',
      classification: 'metric',
      align: 'center',
      sortable: true,
      dbColumn: 'present_students',
      filterType: 'none',
      typicalLength: 10,
      maxLength: 12,
      ui: {
        widthClass: 'w-24',
      },
      print: {
        detailed: { widthPercent: 7, maxChars: 10 },
        compact: { widthPercent: 7, maxChars: 10 },
      },
      export: {
        xlsxWidth: 12,
        csvHeader: 'Attendance %',
        alwaysFullText: true,
      },
      accessor: (r) => {
        const pct = r.total_students > 0 ? (r.present_students / r.total_students) * 100 : 0
        return {
          raw: pct,
          displayText: `${r.present_students}/${r.total_students}`,
          subText: `${pct.toFixed(0)}%`,
        }
      },
    },
    {
      id: 'status',
      key: 'status',
      label: 'Status',
      classification: 'badge',
      align: 'center',
      sortable: true,
      dbColumn: 'status',
      filterType: 'select',
      filterOptions: [
        { label: 'All Statuses', value: 'all' },
        { label: 'Conducted', value: 'conducted' },
        { label: 'Skipped', value: 'skipped' },
      ],
      typicalLength: 7,
      maxLength: 9,
      ui: {
        widthClass: 'w-20',
      },
      print: {
        detailed: { widthPercent: 5, maxChars: 8 },
        compact: { widthPercent: 5, maxChars: 8 },
      },
      export: {
        xlsxWidth: 12,
        csvHeader: 'Status',
        alwaysFullText: true,
      },
      accessor: (r) => ({
        raw: r.status,
        displayText: r.status === 'skipped' ? 'SKIPPED' : 'CONDUCTED',
      }),
    },
    {
      id: 'remarks',
      key: 'remarks',
      label: 'Remark',
      classification: 'narrative',
      align: 'left',
      sortable: false,
      dbColumn: 'remarks',
      filterType: 'text',
      typicalLength: 65,
      maxLength: 240,
      ui: {
        widthClass: 'w-44',
        truncateChars: 60,
      },
      print: {
        detailed: { widthPercent: 20, maxChars: 95 },
        compact: { widthPercent: 18, maxChars: 50 },
      },
      export: {
        xlsxWidth: 40,
        csvHeader: 'Teacher Remarks / Verification Notes',
        alwaysFullText: true,
      },
      accessor: (r) => {
        const text =
          r.status === 'skipped'
            ? r.skip_reason
              ? `Skipped: ${r.skip_reason}`
              : 'Session Skipped'
            : r.remarks || '—'
        return {
          raw: text,
          displayText: text,
          footnoteText: text !== '—' ? text : null,
        }
      },
    },
  ],
}
