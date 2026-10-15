import type { RecordReportSpec } from '../../types/report-spec'
import type { IncidentRecordItem } from '../../types/records'

export function formatIncidentCaseNumber(id?: string | null, incidentNumber?: string | null): string {
  if (incidentNumber && incidentNumber.trim()) {
    const trimmed = incidentNumber.trim()
    return trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  }
  if (!id) return '#INC-—'
  const parts = id.split('-')
  if (parts.length >= 3) {
    const suffix = parts[parts.length - 1].toUpperCase()
    return `#INC-${suffix}`
  } else if (parts.length === 2 && parts[0].toLowerCase() === 'inc') {
    return `#INC-${parts[1].toUpperCase()}`
  }
  return `#INC-${id.slice(-4).toUpperCase()}`
}

export const incidentReportSpec: RecordReportSpec<IncidentRecordItem> = {
  reportId: 'lab_incidents',
  title: 'Official Laboratory Incident & Breakage Logbook',
  subtitle: 'Certified logbook of equipment breakages, malfunction incidents, investigations, and verified resolutions.',
  badgeCode: 'DOC-INC-2026',
  columns: [
    {
      id: 'date_case',
      key: 'created_at',
      label: 'Date & Case #',
      classification: 'structured',
      align: 'left',
      sortable: true,
      dbColumn: 'date',
      filterType: 'text',
      typicalLength: 15,
      maxLength: 18,
      ui: {
        widthClass: 'w-24',
      },
      print: {
        detailed: { widthPercent: 9, maxChars: 18 },
        compact: { widthPercent: 8, maxChars: 14 },
      },
      export: {
        xlsxWidth: 14,
        csvHeader: 'Date & Case Number',
        alwaysFullText: true,
      },
      accessor: (r) => {
        const dateStr = r.created_at ? r.created_at.split('T')[0] : '—'
        const caseNum = formatIncidentCaseNumber(r.id, (r as any).incident_number)
        return {
          raw: dateStr,
          displayText: dateStr,
          subText: caseNum,
        }
      },
    },
    {
      id: 'facility',
      key: 'labs.name',
      label: 'Facility Room',
      classification: 'structured',
      align: 'left',
      sortable: true,
      dbColumn: 'name',
      foreignTable: 'labs',
      filterType: 'select',
      typicalLength: 12,
      maxLength: 24,
      ui: {
        widthClass: 'w-28',
      },
      print: {
        detailed: { widthPercent: 10, maxChars: 24 },
        compact: { widthPercent: 9, maxChars: 18 },
      },
      export: {
        xlsxWidth: 18,
        csvHeader: 'Laboratory Facility',
        alwaysFullText: true,
      },
      accessor: (r) => ({
        raw: r.labs?.name || r.lab_id,
        displayText: r.labs?.name || r.lab_id,
      }),
    },
    {
      id: 'equipment',
      key: 'equipment_name',
      label: 'Lab Equipment / Workstation',
      classification: 'structured',
      align: 'left',
      sortable: true,
      dbColumn: 'equipment_name',
      filterType: 'text',
      typicalLength: 28,
      maxLength: 55,
      ui: {
        widthClass: 'w-36',
      },
      print: {
        detailed: { widthPercent: 15, maxChars: 45 },
        compact: { widthPercent: 13, maxChars: 25 },
      },
      export: {
        xlsxWidth: 28,
        csvHeader: 'Lab Equipment / Workstation',
        alwaysFullText: true,
      },
      accessor: (r) => ({
        raw: r.equipment_name,
        displayText: r.equipment_name || 'Equipment Unspecified',
        subText: (r as any).incident_type ? String((r as any).incident_type).toUpperCase() : undefined,
      }),
    },
    {
      id: 'title_circ',
      key: 'title',
      label: 'Circumstances & Description',
      classification: 'narrative',
      align: 'left',
      sortable: true,
      dbColumn: 'title',
      filterType: 'text',
      typicalLength: 55,
      maxLength: 180,
      ui: {
        widthClass: 'min-w-[180px]',
        truncateChars: 60,
      },
      print: {
        detailed: { widthPercent: 20, maxChars: 80 },
        compact: { widthPercent: 17, maxChars: 35 },
      },
      export: {
        xlsxWidth: 36,
        csvHeader: 'Circumstances & Description',
        alwaysFullText: true,
      },
      accessor: (r) => ({
        raw: r.title,
        displayText: r.title,
        footnoteText: r.title && r.title.trim().length > 0 ? r.title.trim() : null,
      }),
    },
    {
      id: 'severity',
      key: 'severity',
      label: 'Severity',
      classification: 'badge',
      align: 'center',
      sortable: true,
      dbColumn: 'severity',
      filterType: 'select',
      filterOptions: [
        { label: 'All Severities', value: 'all' },
        { label: 'Minor', value: 'minor' },
        { label: 'Moderate', value: 'moderate' },
        { label: 'Major / Critical', value: 'major_critical' },
      ],
      typicalLength: 8,
      maxLength: 14,
      ui: {
        widthClass: 'w-20',
      },
      print: {
        detailed: { widthPercent: 7, maxChars: 12 },
        compact: { widthPercent: 6, maxChars: 10 },
      },
      export: {
        xlsxWidth: 12,
        csvHeader: 'Severity',
        alwaysFullText: true,
      },
      accessor: (r) => ({
        raw: r.severity,
        displayText: String(r.severity).toUpperCase(),
      }),
    },
    {
      id: 'teacher_batch',
      key: 'reporter_profile.full_name',
      label: 'Faculty & Class',
      classification: 'structured',
      align: 'left',
      sortable: true,
      dbColumn: 'subject_teacher_name',
      filterType: 'text',
      typicalLength: 24,
      maxLength: 45,
      ui: {
        widthClass: 'w-32',
      },
      print: {
        detailed: { widthPercent: 12, maxChars: 30 },
        compact: { widthPercent: 11, maxChars: 20 },
      },
      export: {
        xlsxWidth: 22,
        csvHeader: 'Reporting Faculty & Class',
        alwaysFullText: true,
      },
      accessor: (r) => ({
        raw: r.reporter_profile?.full_name,
        displayText: r.reporter_profile?.full_name || 'Staff Member',
        subText: (r as any).batch_name || undefined,
      }),
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
        { label: 'Reported', value: 'reported' },
        { label: 'Under Repair', value: 'under_repair' },
        { label: 'Replaced', value: 'replaced' },
        { label: 'Escalated to HOD', value: 'escalated_to_hod' },
        { label: 'Resolved', value: 'resolved' },
      ],
      typicalLength: 8,
      maxLength: 16,
      ui: {
        widthClass: 'w-24',
      },
      print: {
        detailed: { widthPercent: 8, maxChars: 14 },
        compact: { widthPercent: 8, maxChars: 10 },
      },
      export: {
        xlsxWidth: 14,
        csvHeader: 'Status',
        alwaysFullText: true,
      },
      accessor: (r) => ({
        raw: r.status,
        displayText: String(r.status).replace(/_/g, ' ').toUpperCase(),
      }),
    },
    {
      id: 'resolution',
      key: 'resolution_notes',
      label: 'Resolution Notes',
      classification: 'narrative',
      align: 'left',
      sortable: false,
      dbColumn: 'resolution_notes',
      filterType: 'text',
      typicalLength: 80,
      maxLength: 320,
      ui: {
        widthClass: 'w-48',
        truncateChars: 70,
      },
      print: {
        detailed: { widthPercent: 19, maxChars: 90 },
        compact: { widthPercent: 18, maxChars: 40 },
      },
      export: {
        xlsxWidth: 40,
        csvHeader: 'Resolution Notes & Corrective Actions',
        alwaysFullText: true,
      },
      accessor: (r) => {
        const text = r.resolution_notes || '—'
        return {
          raw: text,
          displayText: text,
          subText: r.time_to_resolve_label ? `Resolved in: ${r.time_to_resolve_label}` : undefined,
          footnoteText: text !== '—' ? text : null,
        }
      },
    },
  ],
}
