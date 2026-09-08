'use client'

import React, { useEffect, useState, use } from 'react'
import { Printer, ArrowLeft, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { INSTITUTION_CONFIG } from '@/lib/institution'
import { getIncidentRecords } from '@/app/actions/records'
import { IncidentRecordItem, IncidentSummaryMetrics } from '@/types/records'

interface PrintIncidentsPageProps {
  searchParams: Promise<{
    lab_id?: string
    severity?: string
    status?: string
    date_from?: string
    date_to?: string
  }>
}

export default function PrintIncidentsPage({ searchParams }: PrintIncidentsPageProps) {
  const params = use(searchParams)
  const [incidents, setIncidents] = useState<IncidentRecordItem[]>([])
  const [metrics, setMetrics] = useState<IncidentSummaryMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  const labId = params.lab_id || 'all'
  const severity = params.severity || 'all'
  const status = params.status || 'all'
  const dateFrom = params.date_from || ''
  const dateTo = params.date_to || ''

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const res = await getIncidentRecords({
          lab_id: labId,
          severity: severity as any,
          status: status as any,
          date_from: dateFrom,
          date_to: dateTo,
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
  }, [labId, severity, status, dateFrom, dateTo])

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

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16 font-sans">
      {/* Print Controls Bar */}
      <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden backdrop-blur-md">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-zinc-950 dark:text-white flex items-center gap-2 font-mono">
            <AlertTriangle className="h-5 w-5 text-rose-500" />
            Official Incident & Damage Register Sheet
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Certified apparatus damage report, HOD escalations & repair verification audit for institutional records.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link href="/records/incidents">
            <Button variant="outline" size="sm" className="h-9 px-3 text-xs gap-1.5 rounded-xl">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Register</span>
            </Button>
          </Link>

          <Button
            onClick={() => window.print()}
            className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-mono font-bold shadow-xs gap-2"
          >
            <Printer className="h-4 w-4" />
            <span>Print / Save to PDF</span>
          </Button>
        </div>
      </div>

      {/* Printable Sheet */}
      <div className="bg-white text-zinc-950 p-8 sm:p-12 rounded-2xl border border-zinc-200/90 shadow-xs print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none print:w-full font-serif">
        {/* Letterhead Header */}
        <div className="text-center border-b-2 border-zinc-900 pb-5 mb-6">
          <div className="text-[11px] uppercase tracking-widest font-sans font-bold text-zinc-600 mb-1">
            {INSTITUTION_CONFIG.systemSubtitle}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-wide text-zinc-950 font-serif">
            {INSTITUTION_CONFIG.name}
          </h1>
          <p className="text-xs text-zinc-600 mt-1 font-sans">
            {INSTITUTION_CONFIG.department} • {INSTITUTION_CONFIG.location}
          </p>
          <div className="inline-block mt-3 px-4 py-1 border border-zinc-900 rounded-md font-sans text-xs font-bold uppercase tracking-wider bg-zinc-50">
            OFFICIAL LABORATORY APPARATUS DAMAGE & SAFETY INCIDENT REGISTER
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg bg-zinc-50 border border-zinc-200 mb-6 text-xs font-sans">
          <div>
            <span className="text-zinc-500 block font-mono text-[10px] uppercase">Target Facility</span>
            <strong className="text-zinc-900 text-sm">{labDisplayName}</strong>
          </div>
          <div>
            <span className="text-zinc-500 block font-mono text-[10px] uppercase">Audit Window</span>
            <strong className="text-zinc-900 font-mono">{dateRangeLabel}</strong>
          </div>
          <div>
            <span className="text-zinc-500 block font-mono text-[10px] uppercase">Recorded Incidents</span>
            <strong className="text-zinc-900 font-mono">
              {metrics ? `${metrics.totalIncidents} Case(s)` : '...'}
            </strong>
          </div>
          <div>
            <span className="text-zinc-500 block font-mono text-[10px] uppercase">Status Breakdown</span>
            <strong className="text-zinc-900 font-mono">
              {metrics
                ? `${metrics.resolvedCount} Resolved | ${metrics.openCount} Open`
                : '...'}
            </strong>
          </div>
        </div>

        {/* Table */}
        <div className="border border-zinc-900 rounded-md overflow-hidden mb-12">
          <table className="w-full text-left border-collapse text-xs font-sans">
            <thead>
              <tr className="bg-zinc-100 border-b border-zinc-900 text-zinc-900 uppercase font-mono font-bold text-[10px]">
                <th className="py-2.5 px-3 border-r border-zinc-300 w-24">Date & Case</th>
                <th className="py-2.5 px-3 border-r border-zinc-300 w-24">Facility</th>
                <th className="py-2.5 px-3 border-r border-zinc-300">Apparatus & Circumstances</th>
                <th className="py-2.5 px-3 border-r border-zinc-300 w-20 text-center">Severity</th>
                <th className="py-2.5 px-3 border-r border-zinc-300 w-28">Subject Teacher</th>
                <th className="py-2.5 px-3 border-r border-zinc-300 w-28 text-center">Status</th>
                <th className="py-2.5 px-3 w-44">Resolution / Triage Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-300">
              {incidents.length === 0 || loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-zinc-500 font-mono italic">
                    {loading ? 'Loading incident records...' : 'No incident logs recorded for this selected criteria.'}
                  </td>
                </tr>
              ) : (
                incidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-zinc-50/60 break-inside-avoid">
                    <td className="py-2.5 px-3 border-r border-zinc-300 font-mono align-top text-[11px]">
                      <div className="font-bold">{inc.date}</div>
                      <div className="text-[10px] text-zinc-500">#{inc.id}</div>
                    </td>
                    <td className="py-2.5 px-3 border-r border-zinc-300 font-medium align-top">
                      {inc.labs?.name?.split(' ')[0] || inc.lab_id.toUpperCase()} Lab
                    </td>
                    <td className="py-2.5 px-3 border-r border-zinc-300 align-top">
                      <div className="font-bold text-zinc-950">
                        {inc.equipment_name} (x{inc.quantity})
                      </div>
                      <div className="text-[11px] text-zinc-700 mt-0.5">{inc.title}</div>
                      {inc.student_rolls && (
                        <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                          Student Roll: {inc.student_rolls}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 border-r border-zinc-300 text-center font-mono align-top uppercase text-[10px] font-bold">
                      <span
                        className={
                          inc.severity === 'major_critical'
                            ? 'text-rose-700 font-extrabold'
                            : inc.severity === 'moderate'
                            ? 'text-amber-700 font-bold'
                            : 'text-sky-700'
                        }
                      >
                        {inc.severity.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 border-r border-zinc-300 align-top text-[11px]">
                      <div className="font-medium text-zinc-900">{inc.subject_teacher_name}</div>
                      <div className="text-zinc-500 text-[10px]">{inc.batch_name}</div>
                    </td>
                    <td className="py-2.5 px-3 border-r border-zinc-300 text-center align-top font-mono text-[10px] font-bold uppercase">
                      <div className={inc.status === 'resolved' ? 'text-emerald-700' : 'text-amber-700'}>
                        {inc.status.replace('_', ' ')}
                      </div>
                      {inc.escalated_to_hod && (
                        <div className="text-[9px] text-rose-600 font-sans mt-0.5">HOD Escalated</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 align-top text-[11px] text-zinc-700">
                      {inc.resolution_notes ? (
                        <div>
                          <div className="italic">"{inc.resolution_notes}"</div>
                          {inc.resolved_by && (
                            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                              Certified by: {inc.resolved_by}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-400 italic">Under inspection</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Dual Signatures */}
        <div className="grid grid-cols-2 gap-12 pt-12 px-8 mt-16 font-sans break-inside-avoid">
          <div className="text-center">
            <div className="border-t-2 border-zinc-900 pt-2 mx-auto w-64">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-900">
                {INSTITUTION_CONFIG.signatures.left.title}
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                {INSTITUTION_CONFIG.signatures.left.subtitle}
              </p>
            </div>
          </div>

          <div className="text-center">
            <div className="border-t-2 border-zinc-900 pt-2 mx-auto w-64">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-900">
                {INSTITUTION_CONFIG.signatures.right.title}
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                {INSTITUTION_CONFIG.signatures.right.subtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Verification Footer */}
        <div suppressHydrationWarning className="text-center mt-12 pt-4 border-t border-zinc-200 text-[10px] text-zinc-400 font-mono">
          {INSTITUTION_CONFIG.systemTitle} • Certified Apparatus Damage Register
        </div>
      </div>
    </div>
  )
}
