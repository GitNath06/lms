'use client'

import React from 'react'
import { Printer, ArrowLeft, Wrench, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { INSTITUTION_CONFIG } from '@/lib/institution'
import { MaintenanceOverviewData } from '@/app/actions/maintenance'

interface PrintMaintenanceViewProps {
  data: MaintenanceOverviewData
  labId: string
}

export default function PrintMaintenanceView({ data, labId }: PrintMaintenanceViewProps) {
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

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16 font-sans">
      {/* Print Controls Bar */}
      <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden backdrop-blur-md">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-zinc-950 dark:text-white flex items-center gap-2">
            <Wrench className="h-5 w-5 text-indigo-500" />
            Official Lab Maintenance & Servicing Logbook
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Certified maintenance sheet, checklist verification audit & recurring routine report for institutional records.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link href="/maintenance">
            <Button variant="outline" size="sm" className="h-9 px-3 text-xs gap-1.5 rounded-xl">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Maintenance</span>
            </Button>
          </Link>

          <Button
            onClick={() => window.print()}
            size="sm"
            className="h-9 px-4 text-xs font-bold gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print Logbook (A4 Landscape)</span>
          </Button>
        </div>
      </div>

      {/* Printable Sheet (Formal Institutional Letterhead) */}
      <div className="bg-white text-zinc-900 p-8 sm:p-12 border border-zinc-200 rounded-2xl shadow-sm print:p-0 print:border-none print:shadow-none print:m-0">
        {/* Letterhead */}
        <div className="text-center border-b-2 border-zinc-900 pb-5 mb-6">
          <div className="text-xs tracking-widest text-zinc-500 uppercase font-semibold">
            NEPAL GOVERNMENT RECOGNIZED • VOCATIONAL & TECHNICAL EDUCATION
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-zinc-950 mt-1 uppercase font-serif">
            {INSTITUTION_CONFIG.name}
          </h1>
          <div className="text-sm font-serif text-zinc-800 font-bold mt-0.5">
            {INSTITUTION_CONFIG.nameNepali}
          </div>
          <div className="text-xs font-serif text-zinc-600 mt-1">
            {INSTITUTION_CONFIG.department} • {INSTITUTION_CONFIG.location}
          </div>

          <div className="mt-4 pt-2 border-t border-zinc-300 flex flex-wrap justify-between items-center text-xs font-medium text-zinc-700">
            <span>
              FACILITY: <strong className="text-zinc-950 uppercase">{labDisplayName}</strong>
            </span>
            <span>
              ACADEMIC YEAR: <strong>{INSTITUTION_CONFIG.academicYear}</strong>
            </span>
            <span suppressHydrationWarning>
              GENERATED: {new Date().toISOString().split('T')[0]}
            </span>
          </div>
        </div>

        {/* Report Title & Scope */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
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

        {/* Ledger Table */}
        <div className="border border-zinc-300 rounded-lg overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-100 border-b border-zinc-300 text-[10px] text-zinc-800 uppercase font-bold">
                <th className="py-2.5 px-3 border-r border-zinc-300 w-24">Date</th>
                <th className="py-2.5 px-3 border-r border-zinc-300 w-32">Facility</th>
                <th className="py-2.5 px-3 border-r border-zinc-300">Target Machine(s) / Hardware</th>
                <th className="py-2.5 px-3 border-r border-zinc-300">Routine & Work Completed</th>
                <th className="py-2.5 px-3 border-r border-zinc-300 w-28">Checklist</th>
                <th className="py-2.5 px-3 border-r border-zinc-300 w-28">Staff</th>
                <th className="py-2.5 px-3 w-24 text-center">Next Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 font-sans text-[11px]">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-500 italic">
                    Zero maintenance records found for the selected scope.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="break-inside-avoid">
                    <td className="py-2.5 px-3 border-r border-zinc-300 font-medium text-zinc-900 whitespace-nowrap align-top">
                      {log.service_date}
                    </td>
                    <td className="py-2.5 px-3 border-r border-zinc-300 align-top text-[10px] font-bold uppercase text-zinc-700">
                      {log.lab_name || log.lab_id}
                    </td>
                    <td className="py-2.5 px-3 border-r border-zinc-300 align-top">
                      <div className="font-bold text-zinc-950">{log.asset_identifier}</div>
                      {log.parts_replaced && (
                        <div className="text-[10px] text-zinc-600 mt-0.5">
                          Parts: {log.parts_replaced}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 border-r border-zinc-300 align-top">
                      <div className="font-bold text-zinc-900">
                        {log.plan_title || 'General Maintenance'}
                      </div>
                      <div className="text-zinc-600 text-[10px] mt-0.5 line-clamp-2">
                        {log.work_performed}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 border-r border-zinc-300 align-top text-[10px]">
                      {log.checklist_completed && log.checklist_completed.length > 0 ? (
                        <span className="text-emerald-700 font-bold">
                          ✓ {log.checklist_completed.length} Steps Verified
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 border-r border-zinc-300 align-top font-medium text-zinc-900 whitespace-nowrap">
                      {log.performed_by_name || 'Lab In-Charge'}
                    </td>
                    <td className="py-2.5 px-3 text-center align-top text-[10px] text-zinc-600 whitespace-nowrap">
                      {log.next_service_due || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 3-Tier Signature Block */}
        <div className="grid grid-cols-3 gap-8 pt-16 px-4 mt-12 font-sans break-inside-avoid">
          {/* Signatory 1: Lab In-Charge */}
          <div className="text-center">
            <div className="border-t-2 border-zinc-900 pt-2 mx-auto w-48 sm:w-56">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-900">
                Laboratory In-Charge
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                Technical Verification & Servicing Audit
              </p>
            </div>
          </div>

          {/* Signatory 2: Academic Coordinator */}
          <div className="text-center">
            <div className="border-t-2 border-zinc-900 pt-2 mx-auto w-48 sm:w-56">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-900">
                Academic Coordinator
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                Curricular Oversight & Schedule Verification
              </p>
            </div>
          </div>

          {/* Signatory 3: Campus Chief / Principal */}
          <div className="text-center">
            <div className="border-t-2 border-zinc-900 pt-2 mx-auto w-48 sm:w-56">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-900">
                Campus Chief / Principal
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                Institutional Endorsement & Certification
              </p>
            </div>
          </div>
        </div>

        {/* Verification Footer */}
        <div
          suppressHydrationWarning
          className="text-center mt-12 pt-4 border-t border-zinc-200 text-[10px] text-zinc-400 font-mono"
        >
          {INSTITUTION_CONFIG.systemTitle} • Certified Lab Maintenance & Computer Servicing Logbook
        </div>
      </div>
    </div>
  )
}
