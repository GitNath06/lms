import type { RecordReportSpec } from '../../types/report-spec'
import type { MaintenanceRecordItem } from '../../types/records'

export const maintenanceReportSpec: RecordReportSpec<MaintenanceRecordItem> = {
  reportId: 'maintenance_logs',
  title: 'Official Laboratory Maintenance & Computer Servicing Logbook',
  subtitle: 'Certified logbook of preventive maintenance routines, workstation servicing, and technician checklist sign-offs.',
  badgeCode: 'DOC-MT-2026',
  columns: [
    {
      id: 'service_date',
      key: 'service_date',
      label: 'Service Date',
      classification: 'structured',
      align: 'left',
      typicalLength: 10,
      maxLength: 10,
      ui: {
        widthClass: 'w-24',
      },
      print: {
        detailed: { widthPercent: 9, maxChars: 12 },
        compact: { widthPercent: 8, maxChars: 10 },
      },
      export: {
        xlsxWidth: 14,
        csvHeader: 'Service Date',
        alwaysFullText: true,
      },
      accessor: (r) => ({
        raw: r.service_date,
        displayText: r.service_date || '—',
      }),
    },
    {
      id: 'facility',
      key: 'lab_name',
      label: 'Facility Room',
      classification: 'structured',
      align: 'left',
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
        raw: r.lab_name || r.lab_id,
        displayText: r.lab_name || r.lab_id,
      }),
    },
    {
      id: 'asset',
      key: 'asset_identifier',
      label: 'Target Workstations',
      classification: 'structured',
      align: 'left',
      typicalLength: 14,
      maxLength: 28,
      ui: {
        widthClass: 'w-32',
      },
      print: {
        detailed: { widthPercent: 13, maxChars: 25 },
        compact: { widthPercent: 12, maxChars: 16 },
      },
      export: {
        xlsxWidth: 20,
        csvHeader: 'Serviced Workstations',
        alwaysFullText: true,
      },
      accessor: (r) => ({
        raw: r.asset_identifier,
        displayText: r.asset_identifier || 'General Facility',
        subText: r.plan?.category ? r.plan.category.toUpperCase() : undefined,
      }),
    },
    {
      id: 'routine_work',
      key: 'work_performed',
      label: 'Routine & Work Performed',
      classification: 'narrative',
      align: 'left',
      typicalLength: 80,
      maxLength: 300,
      ui: {
        widthClass: 'min-w-[200px]',
        truncateChars: 65,
      },
      print: {
        detailed: { widthPercent: 28, maxChars: 100 },
        compact: { widthPercent: 25, maxChars: 45 },
      },
      export: {
        xlsxWidth: 42,
        csvHeader: 'Routine & Work Performed',
        alwaysFullText: true,
      },
      accessor: (r) => {
        const text = r.work_performed || r.remarks || 'Routine check completed'
        return {
          raw: text,
          displayText: text,
          subText: r.plan_title || r.plan?.title || undefined,
          footnoteText: text.length > 0 ? text : null,
        }
      },
    },
    {
      id: 'checklist',
      key: 'checklist_completed',
      label: 'Verified Checklist',
      classification: 'metric',
      align: 'center',
      typicalLength: 15,
      maxLength: 25,
      ui: {
        widthClass: 'w-28',
      },
      print: {
        detailed: { widthPercent: 12, maxChars: 18 },
        compact: { widthPercent: 11, maxChars: 14 },
      },
      export: {
        xlsxWidth: 18,
        csvHeader: 'Checklist Verification',
        alwaysFullText: true,
      },
      accessor: (r) => {
        const completedArr = Array.isArray(r.checklist_completed)
          ? (r.checklist_completed as string[])
          : []
        const done = completedArr.length
        const total = r.checklist_count || (r.plan?.checklist ? r.plan.checklist.length : done)
        const pct = r.checklist_completed_pct ?? (total > 0 ? Math.round((done / total) * 100) : 100)
        return {
          raw: done,
          displayText: `${done}/${total} Verified`,
          subText: `${pct}% SOP met`,
        }
      },
    },
    {
      id: 'staff',
      key: 'performed_by_name',
      label: 'Staff Technician',
      classification: 'structured',
      align: 'left',
      typicalLength: 18,
      maxLength: 28,
      ui: {
        widthClass: 'w-32',
      },
      print: {
        detailed: { widthPercent: 13, maxChars: 24 },
        compact: { widthPercent: 12, maxChars: 18 },
      },
      export: {
        xlsxWidth: 22,
        csvHeader: 'Service Technician',
        alwaysFullText: true,
      },
      accessor: (r) => ({
        raw: r.performed_by_name,
        displayText: r.performed_by_name || 'Lab In-Charge',
      }),
    },
    {
      id: 'next_due',
      key: 'next_service_due',
      label: 'Next Service Due',
      classification: 'structured',
      align: 'left',
      typicalLength: 10,
      maxLength: 10,
      ui: {
        widthClass: 'w-24',
      },
      print: {
        detailed: { widthPercent: 10, maxChars: 12 },
        compact: { widthPercent: 9, maxChars: 10 },
      },
      export: {
        xlsxWidth: 14,
        csvHeader: 'Next Service Due Date',
        alwaysFullText: true,
      },
      accessor: (r) => {
        const nextDate = r.next_service_due ? r.next_service_due.split('T')[0] : '—'
        return {
          raw: nextDate,
          displayText: nextDate,
        }
      },
    },
  ],
}
