import type { UnifiedReportFilters, PrintDensityMode } from '../../types/report-spec'

/**
 * Sanitizes input before interpolating into PostgREST .or() filter strings.
 * Strips special PostgREST syntax characters (commas, parentheses, %, *, ")
 * and normalizes whitespace so parenthetical and comma-containing queries do not break syntax.
 */
export function sanitizePostgrestSearch(raw: string | null | undefined): string {
  if (!raw) return ''
  return raw.replace(/[,()%"*]/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Encodes UnifiedReportFilters into standard URLSearchParams.
 * Omits empty, undefined, or 'all' values for clean URLs.
 */
export function filtersToSearchParams(filters: UnifiedReportFilters): URLSearchParams {
  const params = new URLSearchParams()

  if (filters.academic_year_id && filters.academic_year_id !== 'all') {
    params.set('academic_year_id', filters.academic_year_id)
  }
  if (filters.lab_id && filters.lab_id !== 'all') {
    params.set('lab_id', filters.lab_id)
  }
  if (filters.date_from) {
    params.set('date_from', filters.date_from)
  }
  if (filters.date_to) {
    params.set('date_to', filters.date_to)
  }
  if (filters.date) {
    params.set('date', filters.date)
  }
  if (filters.status && filters.status !== 'all') {
    params.set('status', filters.status)
  }
  if (filters.search && filters.search.trim()) {
    params.set('search', filters.search.trim())
  }

  // Pagination
  if (filters.page && filters.page > 1) {
    params.set('page', String(filters.page))
  }
  if (filters.pageSize && filters.pageSize !== 10) {
    params.set('pageSize', String(filters.pageSize))
  }

  // Sorting
  if (filters.sortKey) {
    params.set('sortKey', filters.sortKey)
  }
  if (filters.sortDirection) {
    params.set('sortDirection', filters.sortDirection)
  }

  // Practical-specific
  if (filters.batch_group && filters.batch_group !== 'all') {
    params.set('batch_group', filters.batch_group)
  }
  if (filters.subject_name && filters.subject_name !== 'all') {
    params.set('subject_name', filters.subject_name)
  }
  if (filters.teacher_id && filters.teacher_id !== 'all') {
    params.set('teacher_id', filters.teacher_id)
  }
  if (filters.teacher_name && filters.teacher_name.trim()) {
    params.set('teacher_name', filters.teacher_name.trim())
  }
  if (filters.period_label && filters.period_label !== 'all') {
    params.set('period_label', filters.period_label)
  }
  if (filters.remarks && filters.remarks.trim()) {
    params.set('remarks', filters.remarks.trim())
  }
  if (filters.groupBy && filters.groupBy !== 'none') {
    params.set('groupBy', filters.groupBy)
  }

  // Incident-specific
  if (filters.severity && filters.severity !== 'all') {
    params.set('severity', filters.severity)
  }
  if (filters.incident_type && filters.incident_type !== 'all') {
    params.set('incident_type', filters.incident_type)
  }
  if (filters.equipment_name && filters.equipment_name.trim()) {
    params.set('equipment_name', filters.equipment_name.trim())
  }
  if (filters.title && filters.title.trim()) {
    params.set('title', filters.title.trim())
  }

  // Maintenance-specific
  if (filters.asset_identifier && filters.asset_identifier !== 'all') {
    params.set('asset_identifier', filters.asset_identifier)
  }
  if (filters.plan_category && filters.plan_category !== 'all') {
    params.set('plan_category', filters.plan_category)
  }
  if (filters.technician_id && filters.technician_id !== 'all') {
    params.set('technician_id', filters.technician_id)
  }
  if (filters.maintenance_status && filters.maintenance_status !== 'all') {
    params.set('maintenance_status', filters.maintenance_status)
  }

  // Print density preference
  if (filters.density) {
    params.set('density', filters.density)
  }

  // WYSIWYG selection and column projection
  if (filters.cols && filters.cols.trim()) {
    params.set('cols', filters.cols.trim())
  }
  if (filters.selected && filters.selected.trim()) {
    params.set('selected', filters.selected.trim())
  }
  if (filters.selKey && filters.selKey.trim()) {
    params.set('selKey', filters.selKey.trim())
  }
  if (filters.selectedAll) {
    params.set('selectedAll', 'true')
  }

  return params
}

/**
 * Deserializes search parameters into a typed UnifiedReportFilters object.
 * Supports URLSearchParams, plain objects, and Next.js Page searchParams.
 */
export function searchParamsToFilters(
  input?: URLSearchParams | Record<string, string | string[] | undefined> | null
): UnifiedReportFilters {
  const filters: UnifiedReportFilters = {}
  if (!input) return filters

  const getParam = (key: string): string | undefined => {
    if (input instanceof URLSearchParams) {
      const val = input.get(key)
      return val !== null && val !== '' ? val : undefined
    }
    const raw = input[key]
    if (Array.isArray(raw)) return raw[0]
    return raw !== '' ? raw : undefined
  }

  const academic_year_id = getParam('academic_year_id') || getParam('year')
  if (academic_year_id) filters.academic_year_id = academic_year_id

  const lab_id = getParam('lab_id')
  if (lab_id) filters.lab_id = lab_id

  const date_from = getParam('date_from')
  if (date_from) filters.date_from = date_from

  const date_to = getParam('date_to')
  if (date_to) filters.date_to = date_to

  const date = getParam('date')
  if (date) filters.date = date

  const status = getParam('status')
  if (status) filters.status = status

  const search = getParam('search')
  if (search) filters.search = search

  // Pagination
  const pageStr = getParam('page')
  if (pageStr) {
    const p = parseInt(pageStr, 10)
    if (!isNaN(p) && p > 0) filters.page = p
  }

  const pageSizeStr = getParam('pageSize')
  if (pageSizeStr) {
    const ps = parseInt(pageSizeStr, 10)
    if (!isNaN(ps) && ps > 0) filters.pageSize = ps
  }

  // Sorting
  const sortKey = getParam('sortKey')
  if (sortKey) filters.sortKey = sortKey

  const sortDirection = getParam('sortDirection')
  if (sortDirection === 'asc' || sortDirection === 'desc') {
    filters.sortDirection = sortDirection
  }

  // Practical-specific
  const batch_group = getParam('batch_group')
  if (batch_group) filters.batch_group = batch_group

  const subject_name = getParam('subject_name')
  if (subject_name) filters.subject_name = subject_name

  const teacher_id = getParam('teacher_id')
  if (teacher_id) filters.teacher_id = teacher_id

  const teacher_name = getParam('teacher_name')
  if (teacher_name) filters.teacher_name = teacher_name

  const period_label = getParam('period_label')
  if (period_label) filters.period_label = period_label

  const remarks = getParam('remarks')
  if (remarks) filters.remarks = remarks

  const groupBy = getParam('groupBy')
  if (groupBy) filters.groupBy = groupBy

  // Incident-specific
  const severity = getParam('severity')
  if (severity) filters.severity = severity

  const incident_type = getParam('incident_type')
  if (incident_type) filters.incident_type = incident_type

  const equipment_name = getParam('equipment_name')
  if (equipment_name) filters.equipment_name = equipment_name

  const title = getParam('title')
  if (title) filters.title = title

  // Maintenance-specific
  const asset_identifier = getParam('asset_identifier')
  if (asset_identifier) filters.asset_identifier = asset_identifier

  const plan_category = getParam('plan_category')
  if (plan_category) filters.plan_category = plan_category

  const technician_id = getParam('technician_id')
  if (technician_id) filters.technician_id = technician_id

  const maintenance_status = getParam('maintenance_status')
  if (maintenance_status) filters.maintenance_status = maintenance_status

  // Density
  const density = getParam('density') as PrintDensityMode | undefined
  if (density === 'compact' || density === 'detailed') {
    filters.density = density
  }

  // WYSIWYG selection and column projection
  const cols = getParam('cols')
  if (cols) filters.cols = cols

  const selected = getParam('selected')
  if (selected) filters.selected = selected

  const selKey = getParam('selKey')
  if (selKey) filters.selKey = selKey

  const selectedAll = getParam('selectedAll')
  if (selectedAll === 'true' || selectedAll === '1') {
    filters.selectedAll = true
  }

  return filters
}

/**
 * Truncates text at a natural word boundary rather than slicing mid-word.
 * E.g. avoids "...capacit[1]" by slicing to the last space and cleaning trailing punctuation.
 */
export function truncateAtWordBoundary(
  text: string | null | undefined,
  maxChars: number
): { text: string; truncated: boolean } {
  if (!text) return { text: '', truncated: false }
  const clean = text.trim()
  if (clean.length <= maxChars) {
    return { text: clean, truncated: false }
  }

  let sliced = clean.slice(0, maxChars)
  const lastSpace = sliced.lastIndexOf(' ')
  // Only back up to word boundary if it doesn't discard more than half the allocated space
  if (lastSpace > maxChars * 0.4) {
    sliced = sliced.slice(0, lastSpace)
  }

  // Remove trailing punctuation before appending ellipsis
  sliced = sliced.replace(/[,;:. \-_]+$/, '')

  return {
    text: sliced,
    truncated: true,
  }
}

export interface ExportScopeDecision {
  mode: 'SELECTED_EXPLICIT' | 'ALL_MATCHING_EXPLICIT' | 'FILTERED_DEFAULT'
  selectedIds?: string[]
  filterSummary: string
  traceabilityNote: string
}

/**
 * Single pure decision function for export/print scope precedence and audit traceability.
 * Precedence:
 * 1. If selectedIds is non-empty and not isAllMatchingSelected: overrides all filters; mode is SELECTED_EXPLICIT.
 * 2. If isAllMatchingSelected is true: executes current filters across all pages, flagged as ALL_MATCHING_EXPLICIT.
 * 3. Default: executes current filters, mode is FILTERED_DEFAULT.
 */
export function resolveExportPrintScope(params: {
  selectedIds?: string[]
  isAllMatchingSelected?: boolean
  totalCount: number
  filters: Record<string, any>
  sortKey?: string
  sortDirection?: string
}): ExportScopeDecision {
  const { selectedIds = [], isAllMatchingSelected = false, totalCount, filters, sortKey, sortDirection } = params

  const parts: string[] = []
  if (filters.lab_id && filters.lab_id !== 'all') parts.push(`Facility: ${filters.lab_id.toUpperCase()}`)
  if (filters.batch_group && filters.batch_group !== 'all') parts.push(`Class: ${filters.batch_group}`)
  if (filters.subject_name && filters.subject_name !== 'all') parts.push(`Subject: ${filters.subject_name}`)
  if (filters.status && filters.status !== 'all') parts.push(`Status: ${filters.status}`)
  if (filters.severity && filters.severity !== 'all') parts.push(`Severity: ${filters.severity}`)
  if (filters.date_from || filters.date_to) {
    parts.push(`Date: ${filters.date_from || 'Earliest'} to ${filters.date_to || 'Latest'}`)
  }
  if (filters.search && filters.search.trim()) parts.push(`Search: "${filters.search.trim()}"`)

  const filterSummary = parts.length > 0 ? parts.join(' | ') : 'All Records (No filter)'
  const sortSummary = sortKey ? `${sortKey} (${sortDirection || 'asc'})` : 'Default'

  if (selectedIds.length > 0 && !isAllMatchingSelected) {
    return {
      mode: 'SELECTED_EXPLICIT',
      selectedIds,
      filterSummary: `Explicit Selection (${selectedIds.length} records)`,
      traceabilityNote: `Generated from: ${selectedIds.length} selected records · Scope: Explicit Selection · Sorted by: ${sortSummary}`,
    }
  }

  if (isAllMatchingSelected) {
    return {
      mode: 'ALL_MATCHING_EXPLICIT',
      filterSummary,
      traceabilityNote: `Generated from: ${totalCount} records (All Matching Selected) · Filters: ${filterSummary} · Sorted by: ${sortSummary}`,
    }
  }

  return {
    mode: 'FILTERED_DEFAULT',
    filterSummary,
    traceabilityNote: `Generated from: ${totalCount} records · Filters: ${filterSummary} · Sorted by: ${sortSummary}`,
  }
}
