'use client'

import React, { useEffect, useState, use, useMemo } from 'react'
import { Printer } from 'lucide-react'
import { INSTITUTION_CONFIG } from '@/lib/institution'
import { getPracticalRecords, getPrintSelectionSessionAction } from '@/app/actions/records'
import { PracticalGroupedSection, PracticalSummaryMetrics } from '@/types/records'
import PrintLayout from '@/components/print/print-layout'
import { practicalReportSpec, formatClassCode, sanitizeSubjectTitle } from '@/lib/report-spec/practical-spec'
import { searchParamsToFilters, truncateAtWordBoundary, resolveExportPrintScope } from '@/lib/report-spec/filter-codec'
import { FootnoteEntry, PrintDensityMode } from '@/types/report-spec'

interface PrintRecordsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default function PrintRecordsPage({ searchParams }: PrintRecordsPageProps) {
  const rawParams = use(searchParams)
  const filters = useMemo(() => searchParamsToFilters(rawParams), [rawParams])

  const [sections, setSections] = useState<PracticalGroupedSection[]>([])
  const [metrics, setMetrics] = useState<PracticalSummaryMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [resolvedSelectedIds, setResolvedSelectedIds] = useState<string[] | undefined>(undefined)
  const [academicYears, setAcademicYears] = useState<Array<{ id: string; name: string; isCurrent: boolean }>>([])
  const [activeAcademicYearId, setActiveAcademicYearId] = useState<string | null>(null)

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

  const academicYearId = filters.academic_year_id || (filters as any).year || 'all'
  const labId = filters.lab_id || 'all'
  const dateFrom = filters.date_from || ''
  const dateTo = filters.date_to || ''
  const groupBy = (filters.groupBy as any) || 'none'

  // Resolve active visible columns
  const visibleColSet = useMemo(() => {
    if (filters.cols && filters.cols.trim()) {
      return new Set(filters.cols.split(',').map((s) => s.trim()).filter(Boolean))
    }
    return new Set(['date', 'period', 'facility', 'class_batch', 'subject', 'experiment', 'teacher', 'attendance', 'status', 'remarks'])
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

        const res = await getPracticalRecords(
          {
            academic_year_id: academicYearId !== 'all' ? academicYearId : undefined,
            lab_id: labId,
            date_from: dateFrom,
            date_to: dateTo,
            status: filters.status as any,
            search: filters.search,
            batch_group: filters.batch_group,
            subject_name: filters.subject_name,
            teacher_id: filters.teacher_id,
            sortKey: filters.sortKey,
            sortDirection: filters.sortDirection,
            selected_ids: activeSelectedIds,
          },
          groupBy
        )
        if (res.success) {
          setSections(res.sections)
          setMetrics(res.metrics)
          if (res.academicYears) setAcademicYears(res.academicYears)
          if (res.activeAcademicYearId) setActiveAcademicYearId(res.activeAcademicYearId)
        }
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [
    academicYearId,
    labId,
    dateFrom,
    dateTo,
    groupBy,
    filters.status,
    filters.search,
    filters.batch_group,
    filters.subject_name,
    filters.teacher_id,
    filters.selected,
    filters.selKey,
    filters.sortKey,
    filters.sortDirection,
  ])

  const scope = useMemo(() => {
    return resolveExportPrintScope({
      selectedIds: resolvedSelectedIds,
      isAllMatchingSelected: Boolean(filters.selectedAll),
      totalCount: metrics?.totalSessions || 0,
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
      : 'All Academic Sessions'

  // Extract column specs
  const colDate = practicalReportSpec.columns.find((c) => c.id === 'date')!
  const colPeriod = practicalReportSpec.columns.find((c) => c.id === 'period_label')!
  const colBatch = practicalReportSpec.columns.find((c) => c.id === 'batch_group')!
  const colSubject = practicalReportSpec.columns.find((c) => c.id === 'subject_name')!
  const colExperiment = practicalReportSpec.columns.find((c) => c.id === 'practical_title')!
  const colTeacher = practicalReportSpec.columns.find((c) => c.id === 'teacher_name')!
  const colAttendance = practicalReportSpec.columns.find((c) => c.id === 'attendance')!
  const colStatus = practicalReportSpec.columns.find((c) => c.id === 'status')!
  const colRemarks = practicalReportSpec.columns.find((c) => c.id === 'remarks')!

  // Dynamic footnote generation & word-boundary truncation
  const { computedSections, footnotes } = useMemo(() => {
    const notes: FootnoteEntry[] = []
    let rowCounter = 0

    const processed = sections.map((sec) => {
      const records = sec.records.map((log) => {
        rowCounter++
        const rowId = `Row #${rowCounter} (${log.date} | ${log.labs?.name || 'Lab'})`

        // Remarks / Skip Reason Truncation
        const rawRemarks =
          log.status === 'skipped'
            ? log.skip_reason
              ? `Skipped: ${log.skip_reason}`
              : 'Class postponed / holiday'
            : log.remarks || 'Standard practical routine executed.'

        let remarksDisplay = rawRemarks
        let remarksFootnoteIdx: number | null = null
        const maxRemarks = colRemarks.print[densityMode].maxChars
        const resRemarks = truncateAtWordBoundary(rawRemarks, maxRemarks)
        if (resRemarks.truncated) {
          const idx = notes.length + 1
          remarksFootnoteIdx = idx
          notes.push({
            index: idx,
            rowIdentifier: rowId,
            fieldName: log.status === 'skipped' ? 'Skip Reason' : 'Remarks',
            fullText: rawRemarks.trim(),
          })
          remarksDisplay = resRemarks.text
        }

        return {
          ...log,
          _remarksDisplay: remarksDisplay,
          _remarksFootnoteIdx: remarksFootnoteIdx,
        }
      })
      return {
        ...sec,
        records,
      }
    })

    return { computedSections: processed, footnotes: notes }
  }, [sections, densityMode, colRemarks])

  const headerAcademicYear = useMemo(() => {
    if (academicYearId && academicYearId !== 'all') {
      const matched = academicYears.find((ay) => ay.id === academicYearId)
      return matched ? `${matched.name} (B.S.)` : `${academicYearId} (B.S.)`
    }
    if (activeAcademicYearId) {
      const active = academicYears.find((ay) => ay.id === activeAcademicYearId)
      if (active) return `All Cycles (Active: ${active.name} B.S.)`
    }
    return `Academic Year: ${INSTITUTION_CONFIG.academicYear}`
  }, [academicYearId, academicYears, activeAcademicYearId])

  return (
    <PrintLayout
      icon={Printer}
      title="Official Practical Records Register"
      subtitle="A4 landscape report for practical logs, attendance, and signatures."
      backHref="/records"
      backLabel="Back to Records"
      printButtonLabel="Print Register (A4 Landscape)"
      printButtonColorClass="bg-indigo-600 hover:bg-indigo-700"
      densityMode={densityMode}
      onDensityModeChange={setDensityMode}
      headerFacilityName={labDisplayName}
      headerAcademicYear={headerAcademicYear}
      documentTitleBadge={
        academicYearId && academicYearId !== 'all'
          ? `OFFICIAL PRACTICAL EXPERIMENT & ATTENDANCE AUDIT REGISTER (ACADEMIC YEAR ${headerAcademicYear})`
          : `OFFICIAL PRACTICAL EXPERIMENT & ATTENDANCE AUDIT REGISTER (CONSOLIDATED AUDIT)`
      }
      signatureTier="2-tier"
      footerNote={scope.traceabilityNote}
      footnotes={footnotes}
      metadataGrid={
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg bg-zinc-50 border border-zinc-200 mb-5 text-xs font-sans print:grid-cols-4 print:gap-2 print:p-1.5 print:mb-2 print:bg-transparent print:border-y print:border-zinc-800 print:rounded-none print:text-[7.5pt]">
          <div>
            <span className="text-zinc-500 block font-mono text-[10px] uppercase print:text-[6.5pt] print:text-zinc-600">Facility</span>
            <strong className="text-zinc-900 text-sm print:text-[8pt]">{labDisplayName}</strong>
          </div>
          <div>
            <span className="text-zinc-500 block font-mono text-[10px] uppercase print:text-[6.5pt] print:text-zinc-600">Audit Period</span>
            <strong className="text-zinc-900 font-mono print:text-[8pt]">{dateRangeLabel}</strong>
          </div>
          <div>
            <span className="text-zinc-500 block font-mono text-[10px] uppercase print:text-[6.5pt] print:text-zinc-600">Conducted Sessions</span>
            <strong className="text-zinc-900 font-mono print:text-[8pt]">
              {metrics ? `${metrics.conductedSessions} / ${metrics.totalSessions} Slots` : '...'}
            </strong>
          </div>
          <div>
            <span className="text-zinc-500 block font-mono text-[10px] uppercase print:text-[6.5pt] print:text-zinc-600">Student Attendance</span>
            <strong className="text-zinc-900 font-mono print:text-[8pt]">
              {metrics
                ? `${metrics.totalPresent} / ${metrics.totalEnrolled} (${metrics.averageAttendancePct.toFixed(1)}%)`
                : '...'}
            </strong>
          </div>
          <div className="col-span-2 sm:col-span-4 pt-2 border-t border-zinc-200 text-zinc-600 font-mono text-[11px] flex items-center justify-between print:col-span-4 print:pt-0.5 print:mt-0.5 print:border-t print:border-zinc-300 print:text-[7pt]">
            <span>{scope.traceabilityNote}</span>
          </div>
        </div>
      }
    >
      {/* Main Practical Records Table */}
      <div className="border border-zinc-900 rounded-md overflow-x-auto mb-6 print:border print:border-zinc-800 print:rounded-none print:overflow-visible print-dense-table">
        <table className="w-full text-left border-collapse text-xs print:text-[8.5pt]">
          <thead className="print:table-header-group">
            <tr className="bg-zinc-100 border-b border-zinc-900 text-zinc-900 uppercase font-mono font-bold text-[11px] print:text-[8pt] print:bg-zinc-200/90 print:border-b print:border-zinc-800 print:h-6">
              {visibleColSet.has('date') && (
                <th
                  style={{ width: `${colDate.print[densityMode].widthPercent}%` }}
                  className="py-2 px-2.5 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-400 whitespace-nowrap"
                >
                  {colDate.label}
                </th>
              )}
              {visibleColSet.has('period') && (
                <th
                  style={{ width: `${colPeriod.print[densityMode].widthPercent}%` }}
                  className="py-2 px-2.5 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-400 whitespace-nowrap"
                >
                  {colPeriod.label}
                </th>
              )}
              {visibleColSet.has('facility') && (
                <th
                  style={{ width: '10%' }}
                  className="py-2 px-2.5 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-400 whitespace-nowrap"
                >
                  Facility
                </th>
              )}
              {visibleColSet.has('class_batch') && (
                <th
                  style={{ width: `${colBatch.print[densityMode].widthPercent}%` }}
                  className="py-2 px-2.5 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-400 whitespace-nowrap"
                >
                  {colBatch.label}
                </th>
              )}
              {visibleColSet.has('subject') && (
                <th
                  style={{ width: `${colSubject.print[densityMode].widthPercent}%` }}
                  className="py-2 px-2.5 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-400"
                >
                  {colSubject.label}
                </th>
              )}
              {visibleColSet.has('experiment') && (
                <th
                  style={{ width: `${colExperiment.print[densityMode].widthPercent}%` }}
                  className="py-2 px-2.5 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-400"
                >
                  {colExperiment.label}
                </th>
              )}
              {visibleColSet.has('teacher') && (
                <th
                  style={{ width: `${colTeacher.print[densityMode].widthPercent}%` }}
                  className="py-2 px-2.5 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-400 whitespace-nowrap"
                >
                  {colTeacher.label}
                </th>
              )}
              {visibleColSet.has('attendance') && (
                <th
                  style={{ width: `${colAttendance.print[densityMode].widthPercent}%` }}
                  className="py-2 px-2.5 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-400 text-center whitespace-nowrap font-mono"
                >
                  {colAttendance.label}
                </th>
              )}
              {visibleColSet.has('status') && (
                <th
                  style={{ width: `${colStatus.print[densityMode].widthPercent}%` }}
                  className="py-2 px-2.5 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-400 text-center whitespace-nowrap"
                >
                  {colStatus.label}
                </th>
              )}
              {visibleColSet.has('remarks') && (
                <th
                  style={{ width: `${colRemarks.print[densityMode].widthPercent}%` }}
                  className="py-2 px-2.5 print:py-0.5 print:px-1.5"
                >
                  {colRemarks.label}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-300 print:divide-zinc-400">
            {computedSections.length === 0 || loading ? (
              <tr>
                <td colSpan={Math.max(1, [
                  visibleColSet.has('date'),
                  visibleColSet.has('period'),
                  visibleColSet.has('facility'),
                  visibleColSet.has('class_batch'),
                  visibleColSet.has('subject'),
                  visibleColSet.has('experiment'),
                  visibleColSet.has('teacher'),
                  visibleColSet.has('attendance'),
                  visibleColSet.has('status'),
                  visibleColSet.has('remarks'),
                ].filter(Boolean).length)} className="py-8 text-center text-zinc-500 font-mono italic">
                  {loading ? 'Loading certified records...' : 'No practical records recorded for this filter selection.'}
                </td>
              </tr>
            ) : (
              computedSections.map((sec) => {
                const totalCols = Math.max(1, [
                  visibleColSet.has('date'),
                  visibleColSet.has('period'),
                  visibleColSet.has('facility'),
                  visibleColSet.has('class_batch'),
                  visibleColSet.has('subject'),
                  visibleColSet.has('experiment'),
                  visibleColSet.has('teacher'),
                  visibleColSet.has('attendance'),
                  visibleColSet.has('status'),
                  visibleColSet.has('remarks'),
                ].filter(Boolean).length)

                return (
                  <React.Fragment key={sec.groupKey}>
                    {sec.groupKey !== 'all' && (
                      <tr className="bg-zinc-100/90 print:bg-zinc-200/80 font-mono text-[10.5px] print:text-[8pt] font-bold border-y border-zinc-400 print:border-zinc-600 break-inside-avoid print:break-inside-avoid">
                        <td colSpan={totalCols} className="py-1.5 px-2.5 print:py-0.5 print:px-1.5 text-zinc-900">
                          📂 GROUP: {sec.groupTitle.toUpperCase()} ({sec.subtotal.totalSessions} Sessions) — Attendance: {sec.subtotal.totalPresent}/{sec.subtotal.totalEnrolled} ({sec.subtotal.averageAttendancePct.toFixed(1)}%) | {sec.subtotal.conductedSessions} Conducted, {sec.subtotal.skippedSessions} Skipped
                        </td>
                      </tr>
                    )}

                    {sec.records.map((log: any, idx: number) => {
                      const isSkipped = log.status === 'skipped'
                      const turnout =
                        log.total_students > 0
                          ? Math.round((log.present_students / log.total_students) * 100)
                          : 0

                      return (
                        <tr
                          key={log.id || idx}
                          className="hover:bg-zinc-50/60 break-inside-avoid print:break-inside-avoid print:leading-[1.15]"
                        >
                          {/* 1. Date */}
                          {visibleColSet.has('date') && (
                            <td className="py-2 px-2.5 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-300 font-mono font-medium align-top whitespace-nowrap">
                              {log.date}
                            </td>
                          )}

                          {/* 2. Slot */}
                          {visibleColSet.has('period') && (
                            <td className="py-2 px-2.5 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-300 font-mono text-[11px] print:text-[7.5pt] align-top">
                              <div className="font-semibold text-zinc-900 leading-tight">
                                {log.period_label ? log.period_label.replace(/\s*\([^)]*\)/, '') : '—'}
                              </div>
                              {log.period_label && log.period_label.includes('(') && (
                                <div className="text-[10px] print:text-[6.5pt] text-zinc-500 font-mono mt-0.5 leading-tight">
                                  {log.period_label.match(/\(([^)]+)\)/)?.[1]}
                                </div>
                              )}
                            </td>
                          )}

                          {/* 3. Facility */}
                          {visibleColSet.has('facility') && (
                            <td className="py-2 px-2.5 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-300 align-top font-medium text-zinc-900 whitespace-nowrap">
                              {log.labs?.name || log.lab_id || '—'}
                            </td>
                          )}

                          {/* 4. Class / Batch */}
                          {visibleColSet.has('class_batch') && (
                            <td
                              className="py-2 px-2.5 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-300 align-top font-semibold text-zinc-900 whitespace-nowrap font-mono"
                              title={log.batch_group || undefined}
                            >
                              {formatClassCode(log.batch_group)}
                            </td>
                          )}

                          {/* 5. Subject */}
                          {visibleColSet.has('subject') && (
                            <td className="py-2 px-2.5 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-300 align-top text-zinc-950 text-[11px] print:text-[8pt]">
                              <div className="font-bold leading-tight">
                                {sanitizeSubjectTitle(log.subject_name)}
                              </div>
                              {log.subject_code && (
                                <div className="font-mono text-[9.5px] print:text-[6.5pt] text-zinc-600 mt-0.5 font-semibold">
                                  {log.subject_code}
                                </div>
                              )}
                            </td>
                          )}

                          {/* 6. Practical Experiment */}
                          {visibleColSet.has('experiment') && (
                            <td className="py-2 px-2.5 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-300 align-top text-zinc-900 font-medium text-[11px] print:text-[8pt]">
                              {log.practical_title}
                            </td>
                          )}

                          {/* 7. Subject Teacher */}
                          {visibleColSet.has('teacher') && (
                            <td className="py-2 px-2.5 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-300 align-top font-medium whitespace-nowrap">
                              {log.profiles?.full_name || 'Assigned Subject Teacher'}
                            </td>
                          )}

                          {/* 8. Attendance */}
                          {visibleColSet.has('attendance') && (
                            <td className="py-2 px-2.5 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-300 text-center font-mono align-top whitespace-nowrap">
                              {isSkipped ? (
                                <span className="text-zinc-400 font-mono text-[10px] print:text-[7.5pt]">N/A</span>
                              ) : (
                                <div>
                                  <span className="font-bold">{log.present_students}</span>
                                  <span className="text-zinc-500">/{log.total_students}</span>
                                  <div className="text-[10px] print:text-[7.5pt] text-zinc-600 font-mono font-bold">
                                    {turnout}%
                                  </div>
                                </div>
                              )}
                            </td>
                          )}

                          {/* 9. Status */}
                          {visibleColSet.has('status') && (
                            <td className="py-2 px-2.5 print:py-0.5 print:px-1.5 border-r border-zinc-300 print:border-zinc-300 text-center align-top whitespace-nowrap">
                              {isSkipped ? (
                                <span className="text-amber-800 font-bold uppercase text-[9.5px] print:text-[7.5pt] bg-amber-50 px-1 py-0.2 rounded border border-amber-300">
                                  Skipped
                                </span>
                              ) : (
                                <span className="text-emerald-800 font-bold uppercase text-[9.5px] print:text-[7.5pt] bg-emerald-50 px-1 py-0.2 rounded border border-emerald-300">
                                  Done
                                </span>
                              )}
                            </td>
                          )}

                          {/* 10. Remarks */}
                          {visibleColSet.has('remarks') && (
                            <td className="py-2 px-2.5 print:py-0.5 print:px-1.5 align-top text-[11px] print:text-[8pt] text-zinc-700">
                              {isSkipped ? (
                                <span className="text-amber-900 italic font-medium">
                                  {log._remarksDisplay}
                                  {log._remarksFootnoteIdx && (
                                    <sup className="font-mono font-bold text-indigo-700 print:text-zinc-950 ml-0.5">
                                      [{log._remarksFootnoteIdx}]
                                    </sup>
                                  )}
                                </span>
                              ) : (
                                <span>
                                  {log._remarksDisplay}
                                  {log._remarksFootnoteIdx && (
                                    <sup className="font-mono font-bold text-indigo-700 print:text-zinc-950 ml-0.5">
                                      [{log._remarksFootnoteIdx}]
                                    </sup>
                                  )}
                                </span>
                              )}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </React.Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </PrintLayout>
  )
}
