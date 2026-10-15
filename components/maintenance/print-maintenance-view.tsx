'use client'

import React, { useState, useMemo } from 'react'
import { Wrench } from 'lucide-react'
import { INSTITUTION_CONFIG } from '@/lib/institution'
import { MaintenanceOverviewData } from '@/app/actions/maintenance'
import PrintLayout from '@/components/print/print-layout'
import { maintenanceReportSpec } from '@/lib/report-spec/maintenance-spec'
import { truncateAtWordBoundary } from '@/lib/report-spec/filter-codec'
import { FootnoteEntry, PrintDensityMode } from '@/types/report-spec'

interface PrintMaintenanceViewProps {
  data: MaintenanceOverviewData
  labId: string
}

export default function PrintMaintenanceView({ data, labId }: PrintMaintenanceViewProps) {
  const [densityMode, setDensityMode] = useState<PrintDensityMode>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('lmr_print_density_mode') as PrintDensityMode | null
        if (saved === 'compact' || saved === 'detailed') return saved
      } catch {}
    }
    return 'detailed'
  })

  const labDisplayName =
    labId === 'comp'
      ? 'Computer Engineering Lab 01'
      : labId === 'phys'
      ? 'Physics Laboratory'
      : labId === 'chem'
      ? 'Chemistry Laboratory'
      : labId === 'bio'
      ? 'Biology Laboratory'
      : labId === 'elec'
      ? 'Electronics Laboratory'
      : 'All Institutional Laboratories (Consolidated)'

  const logs = data?.logs || []

  // Extract column specs
  const colDate = maintenanceReportSpec.columns.find((c) => c.id === 'service_date')!
  const colFacility = maintenanceReportSpec.columns.find((c) => c.id === 'facility')!
  const colAsset = maintenanceReportSpec.columns.find((c) => c.id === 'asset')!
  const colWork = maintenanceReportSpec.columns.find((c) => c.id === 'routine_work')!
  const colChecklist = maintenanceReportSpec.columns.find((c) => c.id === 'checklist')!
  const colStaff = maintenanceReportSpec.columns.find((c) => c.id === 'staff')!
  const colNextDue = maintenanceReportSpec.columns.find((c) => c.id === 'next_due')!

  // Dynamic footnote generation & word-boundary truncation
  const { computedLogs, footnotes } = useMemo(() => {
    const notes: FootnoteEntry[] = []

    const processed = logs.map((log: any, idx: number) => {
      const rowId = `Row #${idx + 1} (${log.service_date} | ${log.lab_name || log.lab_id})`

      const rawWork = log.work_performed || log.remarks || 'Routine check completed'
      let workDisplay = rawWork
      let workFootnoteIdx: number | null = null

      if (rawWork && rawWork.trim().length > 0) {
        const maxWork = colWork.print[densityMode].maxChars
        const res = truncateAtWordBoundary(rawWork, maxWork)
        if (res.truncated) {
          const fnIdx = notes.length + 1
          workFootnoteIdx = fnIdx
          notes.push({
            index: fnIdx,
            rowIdentifier: rowId,
            fieldName: 'Work Performed',
            fullText: rawWork.trim(),
          })
          workDisplay = res.text
        }
      }

      return {
        ...log,
        _workDisplay: workDisplay,
        _workFootnoteIdx: workFootnoteIdx,
      }
    })

    return { computedLogs: processed, footnotes: notes }
  }, [logs, densityMode, colWork])

  return (
    <PrintLayout
      icon={Wrench}
      title="Official Lab Maintenance & Servicing Logbook"
      subtitle="A4 landscape sheet for maintenance routines and service history."
      backHref="/maintenance"
      backLabel="Back to Maintenance"
      printButtonLabel="Print Logbook (A4 Landscape)"
      printButtonColorClass="bg-indigo-600 hover:bg-indigo-700"
      densityMode={densityMode}
      onDensityModeChange={setDensityMode}
      headerSubtitle="NEPAL GOVERNMENT RECOGNIZED • VOCATIONAL & TECHNICAL EDUCATION"
      nepaliName={INSTITUTION_CONFIG.nameNepali}
      headerFacilityName={labDisplayName}
      headerAcademicYear={INSTITUTION_CONFIG.academicYear}
      documentTitleBadge="OFFICIAL LAB MAINTENANCE & COMPUTER SERVICING LOGBOOK"
      signatureTier="3-tier"
      footerNote="Certified Lab Maintenance & Computer Servicing Logbook"
      footnotes={footnotes}
      subHeaderBanner={
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 font-sans">
          <div>
            <h2 className="text-base font-bold uppercase tracking-wider text-zinc-900">
              Lab Maintenance & Computer Servicing Logbook
            </h2>
            <p className="text-xs text-zinc-600">
              Audit log of scheduled PC servicing, BIOS/software updates, thermal care, and routine checklist verifications.
            </p>
          </div>

          <div className="text-right text-xs">
            <div>
              Total Completed Servicing Records: <strong>{logs.length}</strong>
            </div>
          </div>
        </div>
      }
    >
      {/* Ledger Table */}
      <div className="border border-zinc-300 rounded-lg overflow-hidden print:border print:border-zinc-800 print:rounded-none print-dense-table">
        <table className="w-full text-left text-xs border-collapse print:text-[8.5pt]">
          <thead className="print:table-header-group">
            <tr className="bg-zinc-100 border-b border-zinc-300 text-[10px] text-zinc-800 uppercase font-bold print:text-[8pt] print:h-6">
              <th
                style={{ width: `${colDate.print[densityMode].widthPercent}%` }}
                className="py-2.5 px-3 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-400 whitespace-nowrap"
              >
                {colDate.label}
              </th>
              <th
                style={{ width: `${colFacility.print[densityMode].widthPercent}%` }}
                className="py-2.5 px-3 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-400 whitespace-nowrap"
              >
                {colFacility.label}
              </th>
              <th
                style={{ width: `${colAsset.print[densityMode].widthPercent}%` }}
                className="py-2.5 px-3 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-400"
              >
                {colAsset.label}
              </th>
              <th
                style={{ width: `${colWork.print[densityMode].widthPercent}%` }}
                className="py-2.5 px-3 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-400"
              >
                {colWork.label}
              </th>
              <th
                style={{ width: `${colChecklist.print[densityMode].widthPercent}%` }}
                className="py-2.5 px-3 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-400 text-center whitespace-nowrap"
              >
                {colChecklist.label}
              </th>
              <th
                style={{ width: `${colStaff.print[densityMode].widthPercent}%` }}
                className="py-2.5 px-3 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-400 whitespace-nowrap"
              >
                {colStaff.label}
              </th>
              <th
                style={{ width: `${colNextDue.print[densityMode].widthPercent}%` }}
                className="py-2.5 px-3 print:py-0.5 print:px-1.5 text-center whitespace-nowrap"
              >
                {colNextDue.label}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 font-sans text-[11px] print:divide-zinc-400">
            {computedLogs.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-zinc-500 italic">
                  Zero maintenance records found for the selected scope.
                </td>
              </tr>
            ) : (
              computedLogs.map((log: any) => {
                const completedArr = Array.isArray(log.checklist_completed)
                  ? log.checklist_completed
                  : []
                const doneCount = completedArr.length

                return (
                  <tr key={log.id} className="break-inside-avoid print:break-inside-avoid print:leading-[1.15]">
                    <td className="py-2.5 px-3 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-300 font-medium text-zinc-900 whitespace-nowrap align-top print:text-[8pt]">
                      {log.service_date}
                    </td>
                    <td className="py-2.5 px-3 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-300 align-top text-[10px] print:text-[7.5pt] font-bold uppercase text-zinc-700">
                      {log.lab_name || log.lab_id}
                    </td>
                    <td className="py-2.5 px-3 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-300 align-top">
                      <div className="font-bold text-zinc-950 print:text-[8.5pt]">{log.asset_identifier}</div>
                      {log.parts_replaced && (
                        <div className="text-[10px] print:text-[7.5pt] text-zinc-600 mt-0.5">
                          Parts: {log.parts_replaced}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-300 align-top">
                      <div className="font-bold text-zinc-900 print:text-[8.5pt]">
                        {log.plan_title || 'General Maintenance'}
                      </div>
                      <div className="text-zinc-600 text-[10px] print:text-[7.5pt] mt-0.5">
                        {log._workDisplay}
                        {log._workFootnoteIdx && (
                          <sup className="font-mono font-bold text-indigo-700 print:text-zinc-950 ml-0.5">
                            [{log._workFootnoteIdx}]
                          </sup>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-300 align-top text-[10px] print:text-[7.5pt] text-center">
                      {doneCount > 0 ? (
                        <span className="text-emerald-700 font-bold">
                          ✓ {doneCount} Steps Verified
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-300 align-top font-medium text-zinc-900 whitespace-nowrap print:text-[8pt]">
                      {log.performed_by_name || 'Lab In-Charge'}
                    </td>
                    <td className="py-2.5 px-3 print:py-0.5 print:px-1.5 text-center align-top text-[10px] print:text-[7.5pt] text-zinc-600 whitespace-nowrap">
                      {log.next_service_due || '—'}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </PrintLayout>
  )
}
