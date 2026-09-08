'use client'

import React, { useEffect, useState, use } from 'react'
import { Printer, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { INSTITUTION_CONFIG } from '@/lib/institution'
import { getPracticalRecords } from '@/app/actions/records'
import { PracticalGroupedSection, PracticalSummaryMetrics } from '@/types/records'

interface PrintRecordsPageProps {
  searchParams: Promise<{
    lab_id?: string
    date_from?: string
    date_to?: string
    batch_group?: string
    subject_name?: string
    teacher_id?: string
    groupBy?: string
  }>
}

export default function PrintRecordsPage({ searchParams }: PrintRecordsPageProps) {
  const params = use(searchParams)
  const [sections, setSections] = useState<PracticalGroupedSection[]>([])
  const [metrics, setMetrics] = useState<PracticalSummaryMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  const labId = params.lab_id || 'all'
  const dateFrom = params.date_from || ''
  const dateTo = params.date_to || ''
  const groupBy = (params.groupBy as any) || 'none'

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const res = await getPracticalRecords(
          {
            lab_id: labId,
            date_from: dateFrom,
            date_to: dateTo,
            batch_group: params.batch_group,
            subject_name: params.subject_name,
            teacher_id: params.teacher_id,
          },
          groupBy
        )
        if (res.success) {
          setSections(res.sections)
          setMetrics(res.metrics)
        }
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [labId, dateFrom, dateTo, groupBy, params.batch_group, params.subject_name, params.teacher_id])

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

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16 font-sans print:p-0 print:m-0 print:max-w-none print:w-full print:space-y-0">
      {/* Embedded Print CSS for Landscape A4 & Excel Register Density */}
      <style jsx global>{`
        @page {
          size: A4 landscape;
          margin: 8mm 10mm;
        }
        @media print {
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: white !important;
            color: black !important;
          }
          thead {
            display: table-header-group !important;
          }
          tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Interactive Controls Bar (Hidden during window.print()) */}
      <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden backdrop-blur-md">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-zinc-950 dark:text-white flex items-center gap-2 font-mono">
            <Printer className="h-5 w-5 text-indigo-500" />
            Official Practical Records Register
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Audit-ready dense landscape report for institutional inspections, verified signatures & accreditation.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link href="/records">
            <Button variant="outline" size="sm" className="h-9 px-3 text-xs gap-1.5 rounded-xl">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Records</span>
            </Button>
          </Link>

          <Button
            onClick={() => window.print()}
            className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-mono font-bold shadow-xs gap-2"
          >
            <Printer className="h-4 w-4" />
            <span>Print Register (A4 Landscape)</span>
          </Button>
        </div>
      </div>

      {/* Formal Printable Document Body */}
      <div className="bg-white text-zinc-950 p-6 sm:p-10 rounded-2xl border border-zinc-200/90 shadow-xs print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none print:w-full font-sans">
        
        {/* On-Screen Formal Header (Hidden in print to save space) */}
        <div className="text-center border-b-2 border-zinc-900 pb-5 mb-5 print:hidden">
          <div className="text-[11px] uppercase tracking-widest font-bold text-zinc-600 mb-1">
            {INSTITUTION_CONFIG.systemSubtitle}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-wide text-zinc-950 font-serif">
            {INSTITUTION_CONFIG.name}
          </h1>
          <p className="text-xs text-zinc-600 mt-1">
            {INSTITUTION_CONFIG.department} • {INSTITUTION_CONFIG.location}
          </p>
          <div className="inline-block mt-3 px-4 py-1 border border-zinc-900 rounded-md text-xs font-bold uppercase tracking-wider bg-zinc-50 font-mono">
            OFFICIAL PRACTICAL EXPERIMENT & ATTENDANCE AUDIT REGISTER (ACADEMIC YEAR {INSTITUTION_CONFIG.academicYear})
          </div>
        </div>

        {/* On-Screen Metadata Box (Hidden in print) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg bg-zinc-50 border border-zinc-200 mb-5 text-xs print:hidden">
          <div>
            <span className="text-zinc-500 block font-mono text-[10px] uppercase">Facility</span>
            <strong className="text-zinc-900 text-sm">{labDisplayName}</strong>
          </div>
          <div>
            <span className="text-zinc-500 block font-mono text-[10px] uppercase">Audit Period</span>
            <strong className="text-zinc-900 font-mono">{dateRangeLabel}</strong>
          </div>
          <div>
            <span className="text-zinc-500 block font-mono text-[10px] uppercase">Conducted Sessions</span>
            <strong className="text-zinc-900 font-mono">
              {metrics ? `${metrics.conductedSessions} / ${metrics.totalSessions} Slots` : '...'}
            </strong>
          </div>
          <div>
            <span className="text-zinc-500 block font-mono text-[10px] uppercase">Student Attendance</span>
            <strong className="text-zinc-900 font-mono">
              {metrics
                ? `${metrics.totalPresent} / ${metrics.totalEnrolled} (${metrics.averageAttendancePct.toFixed(1)}%)`
                : '...'}
            </strong>
          </div>
        </div>

        {/* 🖨️ ULTRA-COMPACT 2-LINE PRINT-ONLY HEADER BAND (Maximized vertical space for data rows) */}
        <div className="hidden print:block border-b-2 border-zinc-900 pb-1.5 mb-2 text-zinc-950">
          <div className="flex items-baseline justify-between gap-2">
            <h1 className="text-[13px] font-black uppercase tracking-tight text-zinc-950 font-serif">
              {INSTITUTION_CONFIG.name}
            </h1>
            <span className="text-[9px] font-mono font-bold uppercase text-zinc-700">
              {INSTITUTION_CONFIG.department} • OFFICIAL PRACTICAL AUDIT REGISTER (A.Y. {INSTITUTION_CONFIG.academicYear})
            </span>
          </div>
          <div className="flex items-center justify-between text-[8.5px] font-mono font-semibold text-zinc-700 pt-0.5 mt-0.5 border-t border-zinc-300">
            <span>
              Facility: <strong className="text-zinc-950">{labDisplayName}</strong> | Audit Period: <strong className="text-zinc-950">{dateRangeLabel}</strong>
            </span>
            <span>
              Sessions: <strong className="text-zinc-950">{metrics ? `${metrics.conductedSessions}/${metrics.totalSessions}` : '...'}</strong> | Attendance: <strong className="text-zinc-950">{metrics ? `${metrics.totalPresent}/${metrics.totalEnrolled} (${metrics.averageAttendancePct.toFixed(1)}%)` : '...'}</strong>
            </span>
          </div>
        </div>

        {/* Main Practical Records Table (Dense Excel-Like Register) */}
        <div className="border border-zinc-900 rounded-md overflow-hidden mb-6 print:border print:border-zinc-800 print:rounded-none">
          <table className="w-full text-left border-collapse text-xs print:text-[9.5px]">
            <thead className="print:table-header-group">
              <tr className="bg-zinc-100 border-b border-zinc-900 text-zinc-900 uppercase font-mono font-bold text-[11px] print:text-[9px] print:bg-zinc-200/90 print:border-b print:border-zinc-800">
                <th className="py-2 px-2.5 print:py-1 print:px-1.5 border-r border-zinc-300 print:border-zinc-400 whitespace-nowrap w-20">Date</th>
                <th className="py-2 px-2.5 print:py-1 print:px-1.5 border-r border-zinc-300 print:border-zinc-400 whitespace-nowrap w-24">Slot</th>
                <th className="py-2 px-2.5 print:py-1 print:px-1.5 border-r border-zinc-300 print:border-zinc-400 whitespace-nowrap w-24">Class/Batch</th>
                <th className="py-2 px-2.5 print:py-1 print:px-1.5 border-r border-zinc-300 print:border-zinc-400">Subject & Practical Experiment</th>
                <th className="py-2 px-2.5 print:py-1 print:px-1.5 border-r border-zinc-300 print:border-zinc-400 w-44">Topic Learned</th>
                <th className="py-2 px-2.5 print:py-1 print:px-1.5 border-r border-zinc-300 print:border-zinc-400 whitespace-nowrap w-32">Subject Teacher</th>
                <th className="py-2 px-2.5 print:py-1 print:px-1.5 border-r border-zinc-300 print:border-zinc-400 text-center whitespace-nowrap w-20 font-mono">Attendance</th>
                <th className="py-2 px-2.5 print:py-1 print:px-1.5 border-r border-zinc-300 print:border-zinc-400 text-center whitespace-nowrap w-20">Status</th>
                <th className="py-2 px-2.5 print:py-1 print:px-1.5 w-36">Remarks / Skip Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-300 print:divide-zinc-400">
              {sections.length === 0 || loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-zinc-500 font-mono italic">
                    {loading ? 'Loading certified records...' : 'No practical records recorded for this filter selection.'}
                  </td>
                </tr>
              ) : (
                sections.map((sec) => (
                  <React.Fragment key={sec.groupKey}>
                    {sec.groupKey !== 'all' && (
                      <tr className="bg-zinc-100/90 print:bg-zinc-200/80 font-mono text-[10.5px] print:text-[8.5px] font-bold border-y border-zinc-400 print:border-zinc-600 break-inside-avoid">
                        <td colSpan={6} className="py-1.5 px-2.5 print:py-0.8 print:px-1.5 text-zinc-900">
                          📂 GROUP: {sec.groupTitle.toUpperCase()} ({sec.subtotal.totalSessions} Sessions)
                        </td>
                        <td className="py-1.5 px-2.5 print:py-0.8 print:px-1.5 text-center text-zinc-900 font-mono whitespace-nowrap">
                          {sec.subtotal.totalPresent}/{sec.subtotal.totalEnrolled} ({sec.subtotal.averageAttendancePct.toFixed(1)}%)
                        </td>
                        <td colSpan={2} className="py-1.5 px-2.5 print:py-0.8 print:px-1.5 text-zinc-700 text-[10px] print:text-[8px]">
                          {sec.subtotal.conductedSessions} Conducted, {sec.subtotal.skippedSessions} Skipped
                        </td>
                      </tr>
                    )}

                    {sec.records.map((log, idx) => {
                      const isSkipped = log.status === 'skipped'
                      const turnout =
                        log.total_students > 0
                          ? Math.round((log.present_students / log.total_students) * 100)
                          : 0

                      return (
                        <tr
                          key={log.id || idx}
                          className="hover:bg-zinc-50/60 break-inside-avoid print:break-inside-avoid print:leading-tight"
                        >
                          {/* 1. Date */}
                          <td className="py-2 px-2.5 print:py-1 print:px-1.5 border-r border-zinc-300 print:border-zinc-300 font-mono font-medium align-top whitespace-nowrap">
                            {log.date}
                          </td>

                          {/* 2. Slot */}
                          <td className="py-2 px-2.5 print:py-1 print:px-1.5 border-r border-zinc-300 print:border-zinc-300 font-mono text-[11px] print:text-[8.5px] align-top whitespace-nowrap">
                            {log.period_label}
                          </td>

                          {/* 3. Class / Batch */}
                          <td className="py-2 px-2.5 print:py-1 print:px-1.5 border-r border-zinc-300 print:border-zinc-300 align-top font-semibold text-zinc-900 whitespace-nowrap">
                            {log.batch_group}
                          </td>

                          {/* 4. Subject & Practical Experiment */}
                          <td className="py-2 px-2.5 print:py-1 print:px-1.5 border-r border-zinc-300 print:border-zinc-300 align-top">
                            <div className="font-bold text-zinc-950">{log.subject_name}</div>
                            <div className="text-[11px] print:text-[8.5px] text-zinc-700 mt-0.5 font-medium">
                              {log.practical_title}
                            </div>
                          </td>

                          {/* 5. Topic Learned (Surfaced across print face) */}
                          <td className="py-2 px-2.5 print:py-1 print:px-1.5 border-r border-zinc-300 print:border-zinc-300 align-top text-[11px] print:text-[8.5px] text-zinc-800">
                            {log.topic_learned ? (
                              <span className="italic">{log.topic_learned}</span>
                            ) : (
                              <span className="text-zinc-400 font-mono">—</span>
                            )}
                          </td>

                          {/* 6. Subject Teacher */}
                          <td className="py-2 px-2.5 print:py-1 print:px-1.5 border-r border-zinc-300 print:border-zinc-300 align-top font-medium whitespace-nowrap">
                            {log.profiles?.full_name || 'Assigned Subject Teacher'}
                          </td>

                          {/* 7. Turnout */}
                          <td className="py-2 px-2.5 print:py-1 print:px-1.5 border-r border-zinc-300 print:border-zinc-300 text-center font-mono align-top whitespace-nowrap">
                            {isSkipped ? (
                              <span className="text-zinc-400 font-mono text-[10px] print:text-[8px]">N/A</span>
                            ) : (
                              <div>
                                <span className="font-bold">{log.present_students}</span>
                                <span className="text-zinc-500">/{log.total_students}</span>
                                <div className="text-[10px] print:text-[8px] text-zinc-600 font-mono font-bold">
                                  {turnout}%
                                </div>
                              </div>
                            )}
                          </td>

                          {/* 8. Status */}
                          <td className="py-2 px-2.5 print:py-1 print:px-1.5 border-r border-zinc-300 print:border-zinc-300 text-center align-top whitespace-nowrap">
                            {isSkipped ? (
                              <span className="text-amber-800 font-bold uppercase text-[9.5px] print:text-[8px] bg-amber-50 px-1 py-0.2 rounded border border-amber-300">
                                Skipped
                              </span>
                            ) : (
                              <span className="text-emerald-800 font-bold uppercase text-[9.5px] print:text-[8px] bg-emerald-50 px-1 py-0.2 rounded border border-emerald-300">
                                Done
                              </span>
                            )}
                          </td>

                          {/* 9. Remarks / Skip Reason */}
                          <td className="py-2 px-2.5 print:py-1 print:px-1.5 align-top text-[11px] print:text-[8.5px] text-zinc-700">
                            {isSkipped ? (
                              <span className="text-amber-900 italic font-medium">
                                {log.skip_reason || 'Class postponed / holiday'}
                              </span>
                            ) : (
                              log.remarks || 'Standard practical routine executed.'
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Dual Institutional Signature Blocks (Dense & Compact for Print) */}
        <div className="grid grid-cols-2 gap-8 pt-8 px-6 mt-6 font-sans break-inside-avoid print:pt-4 print:mt-4 print:px-4">
          <div className="text-center">
            <div className="border-t-2 border-zinc-900 pt-1.5 mx-auto w-56 print:w-48">
              <p className="text-xs print:text-[10px] font-bold uppercase tracking-wider text-zinc-900">
                {INSTITUTION_CONFIG.signatures.left.title}
              </p>
              <p className="text-[10px] print:text-[8px] text-zinc-500 mt-0.5">
                {INSTITUTION_CONFIG.signatures.left.subtitle}
              </p>
            </div>
          </div>

          <div className="text-center">
            <div className="border-t-2 border-zinc-900 pt-1.5 mx-auto w-56 print:w-48">
              <p className="text-xs print:text-[10px] font-bold uppercase tracking-wider text-zinc-900">
                {INSTITUTION_CONFIG.signatures.right.title}
              </p>
              <p className="text-[10px] print:text-[8px] text-zinc-500 mt-0.5">
                {INSTITUTION_CONFIG.signatures.right.subtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Verification Footer */}
        <div
          suppressHydrationWarning
          className="text-center mt-8 pt-3 border-t border-zinc-200 text-[10px] print:text-[8px] text-zinc-400 font-mono print:mt-3 print:pt-1"
        >
          {INSTITUTION_CONFIG.systemTitle} • Certified Institutional Audit Copy • Generated: {new Date().toISOString().split('T')[0]}
        </div>
      </div>
    </div>
  )
}
