'use client'

import React, { useEffect, useState, use, useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { INSTITUTION_CONFIG } from '@/lib/institution'
import { getIncidentRecords, getPrintSelectionSessionAction } from '@/app/actions/records'
import { IncidentRecordItem, IncidentSummaryMetrics } from '@/types/records'
import PrintLayout from '@/components/print/print-layout'
import { incidentReportSpec } from '@/lib/report-spec/incident-spec'
import { formatClassCode } from '@/lib/report-spec/practical-spec'
import { searchParamsToFilters, truncateAtWordBoundary, resolveExportPrintScope } from '@/lib/report-spec/filter-codec'
import { FootnoteEntry, PrintDensityMode } from '@/types/report-spec'

interface PrintIncidentsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default function PrintIncidentsPage({ searchParams }: PrintIncidentsPageProps) {
  const rawParams = use(searchParams)
  const filters = useMemo(() => searchParamsToFilters(rawParams), [rawParams])

  const [incidents, setIncidents] = useState<IncidentRecordItem[]>([])
  const [metrics, setMetrics] = useState<IncidentSummaryMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [resolvedSelectedIds, setResolvedSelectedIds] = useState<string[] | undefined>(undefined)

  // Density mode state: honors URL param > localStorage > default 'detailed'
  const [densityMode, setDensityMode] = useState<PrintDensityMode>(() => {
    if (filters.density) return filters.density
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('lmr_print_density_mode') as PrintDensityMode | null
        if (saved === 'compact' || saved === 'detailed') return saved
      } catch {}
    }
    return 'detailed'
  })

  const labId = filters.lab_id || 'all'
  const severity = filters.severity || 'all'
  const status = filters.status || 'all'
  const dateFrom = filters.date_from || ''
  const dateTo = filters.date_to || ''

  // Resolve active visible columns
  const visibleColSet = useMemo(() => {
    if (filters.cols && filters.cols.trim()) {
      return new Set(filters.cols.split(',').map((s) => s.trim()).filter(Boolean))
    }
    return new Set(['date_case', 'facility', 'equipment', 'title_circ', 'severity', 'teacher_batch', 'status', 'resolution'])
  }, [filters.cols])

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        let activeSelectedIds: string[] | undefined = undefined
        if (filters.selected) {
          activeSelectedIds = filters.selected.split(',').map((s) => s.trim()).filter(Boolean)
        } else if (filters.selKey) {
          const tokenRes = await getPrintSelectionSessionAction(filters.selKey)
          if (tokenRes.success && tokenRes.ids.length > 0) {
            activeSelectedIds = tokenRes.ids
          }
        }
        setResolvedSelectedIds(activeSelectedIds)

        const res = await getIncidentRecords({
          lab_id: labId,
          severity: severity as any,
          status: status as any,
          incident_type: filters.incident_type,
          search: filters.search,
          date_from: dateFrom,
          date_to: dateTo,
          sortKey: filters.sortKey,
          sortDirection: filters.sortDirection,
          selected_ids: activeSelectedIds,
        })
        if (res.success) {
          setIncidents(res.incidents)
          setMetrics(res.metrics)
        }
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [
    labId,
    severity,
    status,
    filters.incident_type,
    filters.search,
    dateFrom,
    dateTo,
    filters.selected,
    filters.selKey,
    filters.sortKey,
    filters.sortDirection,
  ])

  const scope = useMemo(() => {
    return resolveExportPrintScope({
      selectedIds: resolvedSelectedIds,
      isAllMatchingSelected: Boolean(filters.selectedAll),
      totalCount: metrics?.totalIncidents || 0,
      filters,
      sortKey: filters.sortKey,
      sortDirection: filters.sortDirection,
    })
  }, [resolvedSelectedIds, filters, metrics])

  const labDisplayName =
    labId === 'comp'
      ? 'Computer Engineering Lab 01'
      : labId === 'phys'
      ? 'Physics Laboratory'
      : labId === 'chem'
      ? 'Chemistry Laboratory'
      : labId === 'bio'
      ? 'Biology & Life Sciences Lab'
      : labId === 'elec'
      ? 'Electronics & Hardware Lab'
      : 'All Laboratories (Consolidated)'

  const dateRangeLabel =
    dateFrom && dateTo
      ? `${dateFrom} to ${dateTo}`
      : dateFrom
      ? `From ${dateFrom}`
      : dateTo
      ? `Up to ${dateTo}`
      : 'All Incident History'

  // Extract column specs
  const colDate = incidentReportSpec.columns.find((c) => c.id === 'date_case')!
  const colFacility = incidentReportSpec.columns.find((c) => c.id === 'facility')!
  const colEquipment = incidentReportSpec.columns.find((c) => c.id === 'equipment')!
  const colCirc = incidentReportSpec.columns.find((c) => c.id === 'title_circ')!
  const colSeverity = incidentReportSpec.columns.find((c) => c.id === 'severity')!
  const colTeacher = incidentReportSpec.columns.find((c) => c.id === 'teacher_batch')!
  const colStatus = incidentReportSpec.columns.find((c) => c.id === 'status')!
  const colResolution = incidentReportSpec.columns.find((c) => c.id === 'resolution')!

  // Dynamic footnote generation & word-boundary truncation
  const { computedIncidents, footnotes } = useMemo(() => {
    const notes: FootnoteEntry[] = []

    const processed = incidents.map((inc, idx) => {
      const rowId = `Row #${idx + 1} (${inc.date || inc.created_at?.split('T')[0]} | ${inc.labs?.name || 'Lab'})`

      // 1. Circumstances / Description Truncation
      let circDisplay = inc.title || '—'
      let circFootnoteIdx: number | null = null
      if (inc.title && inc.title.trim().length > 0) {
        const maxCirc = colCirc.print[densityMode].maxChars
        const res = truncateAtWordBoundary(inc.title, maxCirc)
        if (res.truncated) {
          const fnIdx = notes.length + 1
          circFootnoteIdx = fnIdx
          notes.push({
            index: fnIdx,
            rowIdentifier: rowId,
            fieldName: 'Circumstances',
            fullText: inc.title.trim(),
          })
          circDisplay = res.text
        }
      }

      // 2. Resolution Notes Truncation
      let resDisplay = inc.resolution_notes || ''
      let resFootnoteIdx: number | null = null
      if (inc.resolution_notes && inc.resolution_notes.trim().length > 0) {
        const maxRes = colResolution.print[densityMode].maxChars
        const resNotes = truncateAtWordBoundary(inc.resolution_notes, maxRes)
        if (resNotes.truncated) {
          const fnIdx = notes.length + 1
          resFootnoteIdx = fnIdx
          notes.push({
            index: fnIdx,
            rowIdentifier: rowId,
            fieldName: 'Resolution Notes',
            fullText: inc.resolution_notes.trim(),
          })
          resDisplay = resNotes.text
        }
      }

      return {
        ...inc,
        _circDisplay: circDisplay,
        _circFootnoteIdx: circFootnoteIdx,
        _resDisplay: resDisplay,
        _resFootnoteIdx: resFootnoteIdx,
      }
    })

    return { computedIncidents: processed, footnotes: notes }
  }, [incidents, densityMode, colCirc, colResolution])

  return (
    <PrintLayout
      icon={AlertTriangle}
      title="Official Incident & Damage Register Sheet"
      subtitle="A4 landscape register for equipment breakages and repair history."
      backHref="/records/incidents"
      backLabel="Back to Register"
      printButtonLabel="Print / Save to PDF"
      printButtonColorClass="bg-rose-600 hover:bg-rose-700"
      densityMode={densityMode}
      onDensityModeChange={setDensityMode}
      documentTitleBadge="OFFICIAL LABORATORY EQUIPMENT DAMAGE & SAFETY INCIDENT REGISTER"
      fontSerif={true}
      signatureTier="2-tier"
      footerNote={scope.traceabilityNote}
      footnotes={footnotes}
      metadataGrid={
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg bg-zinc-50 border border-zinc-200 mb-6 text-xs font-sans print:grid-cols-4 print:gap-2 print:p-1.5 print:mb-2 print:bg-transparent print:border-y print:border-zinc-800 print:rounded-none print:text-[7.5pt]">
          <div>
            <span className="text-zinc-500 block font-mono text-[10px] uppercase print:text-[6.5pt] print:text-zinc-600">Target Facility</span>
            <strong className="text-zinc-900 text-sm print:text-[8pt]">{labDisplayName}</strong>
          </div>
          <div>
            <span className="text-zinc-500 block font-mono text-[10px] uppercase print:text-[6.5pt] print:text-zinc-600">Audit Window</span>
            <strong className="text-zinc-900 font-mono print:text-[8pt]">{dateRangeLabel}</strong>
          </div>
          <div>
            <span className="text-zinc-500 block font-mono text-[10px] uppercase print:text-[6.5pt] print:text-zinc-600">Recorded Incidents</span>
            <strong className="text-zinc-900 font-mono print:text-[8pt]">
              {metrics ? `${metrics.totalIncidents} Case(s)` : '...'}
            </strong>
          </div>
          <div>
            <span className="text-zinc-500 block font-mono text-[10px] uppercase print:text-[6.5pt] print:text-zinc-600">Status Breakdown</span>
            <strong className="text-zinc-900 font-mono print:text-[8pt]">
              {metrics
                ? `${metrics.resolvedCount} Resolved | ${metrics.openCount} Open`
                : '...'}
            </strong>
          </div>
          <div className="col-span-2 sm:col-span-4 pt-2 border-t border-zinc-200 text-zinc-600 font-mono text-[11px] flex items-center justify-between print:col-span-4 print:pt-0.5 print:mt-0.5 print:border-t print:border-zinc-300 print:text-[7pt]">
            <span>{scope.traceabilityNote}</span>
          </div>
        </div>
      }
    >
      {/* Table */}
      <div className="border border-zinc-900 rounded-md overflow-x-auto mb-6 print:border print:border-zinc-800 print:rounded-none print:mb-4 print:overflow-visible print-dense-table">
        <table className="w-full text-left border-collapse text-xs font-sans print:text-[8.5pt]">
          <thead className="print:table-header-group">
            <tr className="bg-zinc-100 border-b border-zinc-900 text-zinc-900 uppercase font-mono font-bold text-[10px] print:text-[8pt] print:h-6">
              {visibleColSet.has('date_case') && (
                <th
                  style={{ width: `${colDate.print[densityMode].widthPercent}%` }}
                  className="py-2.5 px-3 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-400"
                >
                  {colDate.label}
                </th>
              )}
              {visibleColSet.has('facility') && (
                <th
                  style={{ width: `${colFacility.print[densityMode].widthPercent}%` }}
                  className="py-2.5 px-3 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-400"
                >
                  {colFacility.label}
                </th>
              )}
              {visibleColSet.has('equipment') && (
                <th
                  style={{ width: `${colEquipment.print[densityMode].widthPercent}%` }}
                  className="py-2.5 px-3 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-400"
                >
                  {colEquipment.label}
                </th>
              )}
              {visibleColSet.has('title_circ') && (
                <th
                  style={{ width: `${colCirc.print[densityMode].widthPercent}%` }}
                  className="py-2.5 px-3 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-400"
                >
                  {colCirc.label}
                </th>
              )}
              {visibleColSet.has('severity') && (
                <th
                  style={{ width: `${colSeverity.print[densityMode].widthPercent}%` }}
                  className="py-2.5 px-3 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-400 text-center"
                >
                  {colSeverity.label}
                </th>
              )}
              {visibleColSet.has('teacher_batch') && (
                <th
                  style={{ width: `${colTeacher.print[densityMode].widthPercent}%` }}
                  className="py-2.5 px-3 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-400"
                >
                  {colTeacher.label}
                </th>
              )}
              {visibleColSet.has('status') && (
                <th
                  style={{ width: `${colStatus.print[densityMode].widthPercent}%` }}
                  className="py-2.5 px-3 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-400 text-center"
                >
                  {colStatus.label}
                </th>
              )}
              {visibleColSet.has('resolution') && (
                <th
                  style={{ width: `${colResolution.print[densityMode].widthPercent}%` }}
                  className="py-2.5 px-3 print:py-0.5 print:px-1.5"
                >
                  {colResolution.label}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-300 print:divide-zinc-400">
            {computedIncidents.length === 0 || loading ? (
              <tr>
                <td colSpan={visibleColSet.size || 8} className="py-10 text-center text-zinc-500 font-mono italic">
                  {loading ? 'Loading incident records...' : 'No incident logs recorded for this selected criteria.'}
                </td>
              </tr>
            ) : (
              computedIncidents.map((inc: any) => (
                <tr key={inc.id} className="hover:bg-zinc-50/60 break-inside-avoid print:break-inside-avoid print:leading-[1.15]">
                  {visibleColSet.has('date_case') && (
                    <td className="py-2.5 px-3 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-300 font-mono align-top text-[11px] print:text-[8pt]">
                      <div className="font-bold">{inc.date || inc.created_at?.split('T')[0]}</div>
                      <div className="text-[10px] print:text-[7.5pt] text-zinc-500 font-mono">#{inc.id.slice(0, 8)}</div>
                    </td>
                  )}
                  {visibleColSet.has('facility') && (
                    <td className="py-2.5 px-3 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-300 font-medium align-top print:text-[8pt]">
                      {inc.labs?.name?.split(' ')[0] || inc.lab_id?.toUpperCase()} Lab
                    </td>
                  )}
                  {visibleColSet.has('equipment') && (
                    <td className="py-2.5 px-3 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-300 align-top">
                      <div className="font-bold text-zinc-950 print:text-[8.5pt]">
                        {inc.equipment_name} {inc.quantity ? `(x${inc.quantity})` : ''}
                      </div>
                      {inc.student_rolls && (
                        <div className="text-[10px] print:text-[7.5pt] text-zinc-500 font-mono mt-0.5">
                          Student Roll: {inc.student_rolls}
                        </div>
                      )}
                    </td>
                  )}
                  {visibleColSet.has('title_circ') && (
                    <td className="py-2.5 px-3 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-300 align-top text-[11px] print:text-[8pt] text-zinc-800">
                      <div>
                        {inc._circDisplay}
                        {inc._circFootnoteIdx && (
                          <sup className="font-mono font-bold text-indigo-700 print:text-zinc-950 ml-0.5">
                            [{inc._circFootnoteIdx}]
                          </sup>
                        )}
                      </div>
                    </td>
                  )}
                  {visibleColSet.has('severity') && (
                    <td className="py-2.5 px-3 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-300 text-center font-mono align-top uppercase text-[10px] print:text-[7.5pt] font-bold">
                      <span
                        className={
                          inc.severity === 'major_critical' || inc.severity === 'critical'
                            ? 'text-rose-700 font-extrabold'
                            : inc.severity === 'moderate' || inc.severity === 'high'
                            ? 'text-amber-700 font-bold'
                            : 'text-sky-700'
                        }
                      >
                        {String(inc.severity).replace(/_/g, ' ')}
                      </span>
                    </td>
                  )}
                  {visibleColSet.has('teacher_batch') && (
                    <td className="py-2.5 px-3 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-300 align-top text-[11px] print:text-[8pt]">
                      <div className="font-medium text-zinc-900">{inc.subject_teacher_name || inc.reporter_profile?.full_name || 'Staff'}</div>
                      <div className="text-zinc-500 text-[10px] print:text-[7.5pt]">{formatClassCode(inc.batch_name) || inc.batch_name || 'General Class'}</div>
                    </td>
                  )}
                  {visibleColSet.has('status') && (
                    <td className="py-2.5 px-3 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-300 text-center align-top font-mono text-[10px] print:text-[7.5pt] font-bold uppercase">
                      <div className={inc.status === 'resolved' ? 'text-emerald-700' : 'text-amber-700'}>
                        {String(inc.status).replace(/_/g, ' ')}
                      </div>
                      {inc.escalated_to_hod && (
                        <div className="text-[9px] print:text-[7pt] text-rose-600 font-sans mt-0.5 font-bold">HOD Escalated</div>
                      )}
                    </td>
                  )}
                  {visibleColSet.has('resolution') && (
                    <td className="py-2.5 px-3 print:py-0.5 print:px-1.5 align-top text-[11px] print:text-[8pt] text-zinc-700">
                      {inc.resolution_notes ? (
                        <div>
                          <div className="italic">
                            "{inc._resDisplay}"
                            {inc._resFootnoteIdx && (
                              <sup className="font-mono font-bold text-indigo-700 print:text-zinc-950 ml-0.5">
                                [{inc._resFootnoteIdx}]
                              </sup>
                            )}
                          </div>
                          {inc.resolved_by && (
                            <div className="text-[10px] print:text-[7.5pt] text-zinc-500 font-mono mt-0.5">
                              Certified: {inc.resolved_by}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-400 italic">Under inspection</span>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </PrintLayout>
  )
}
