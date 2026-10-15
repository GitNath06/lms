/**
 * Unified Record Report Specification Architecture
 * Single source of truth for UI Tables, Print Registers, XLSX Workbooks, and CSV Exports.
 */

export type DataClassification = 'structured' | 'narrative' | 'metric' | 'badge'
export type TextAlignment = 'left' | 'center' | 'right'
export type PrintDensityMode = 'detailed' | 'compact'

export interface ColumnSpec<T> {
  id: string
  key: keyof T | string
  label: string
  classification: DataClassification
  align: TextAlignment

  // Content length expectations
  typicalLength: number
  maxLength: number

  // Database mapping & Sorting metadata
  sortable?: boolean
  dbColumn?: string
  foreignTable?: string

  // Column-level filter configuration
  filterType?: 'text' | 'select' | 'none'
  filterOptions?: Array<{ label: string; value: string }>

  // Surface 1: Interactive On-Screen UI Table
  ui: {
    widthClass: string
    truncateChars?: number
  }

  // Surface 2: Certified Print Register
  print: {
    detailed: {
      widthPercent: number
      maxChars: number
    }
    compact: {
      widthPercent: number
      maxChars: number
    }
  }

  // Surfaces 3 & 4: Spreadsheet Exports
  export: {
    xlsxWidth: number
    csvHeader: string
    alwaysFullText: true
  }

  // Canonical Formatter & Accessor
  accessor: (record: T) => {
    raw: any
    displayText: string
    subText?: string | null
    footnoteText?: string | null
  }
}

export interface RecordReportSpec<T> {
  reportId: 'practical_logs' | 'lab_incidents' | 'maintenance_logs'
  title: string
  subtitle: string
  badgeCode: string
  columns: ColumnSpec<T>[]
}

/**
 * Unified Filter Interface consumed across UI, Print, and Exports
 */
export interface UnifiedReportFilters {
  // Coarse scope filters
  academic_year_id?: string
  lab_id?: string
  date_from?: string
  date_to?: string
  date?: string
  status?: string
  search?: string

  // Server-side Pagination
  page?: number
  pageSize?: number

  // Server-side Sorting
  sortKey?: string
  sortDirection?: 'asc' | 'desc'

  // Practical-specific
  batch_group?: string
  subject_name?: string
  teacher_id?: string
  teacher_name?: string
  period_label?: string
  remarks?: string
  groupBy?: string

  // Incident-specific
  severity?: string
  incident_type?: string
  equipment_name?: string
  title?: string

  // Maintenance-specific
  asset_identifier?: string
  plan_category?: string
  technician_id?: string
  maintenance_status?: string

  // Print density preference
  density?: PrintDensityMode

  // WYSIWYG selection and column projection
  cols?: string
  selected?: string
  selKey?: string
  selectedAll?: boolean
}

/**
 * Footnote entry for printed audit register annex
 */
export interface FootnoteEntry {
  index: number
  rowIdentifier: string
  fieldName: string
  fullText: string
}
