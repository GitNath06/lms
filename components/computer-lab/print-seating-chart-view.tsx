'use client'

import React, { useMemo } from 'react'
import { LayoutGrid, Printer, Users, CheckCircle2 } from 'lucide-react'
import { INSTITUTION_CONFIG } from '@/lib/institution'
import PrintLayout from '@/components/print/print-layout'
import type { CohortSeatPlanData } from '@/lib/types/seat-plans'

interface PrintSeatingChartViewProps {
  data: CohortSeatPlanData
  classNameDisplay?: string
  academicYearDisplay?: string
  labDisplayName?: string
}

export default function PrintSeatingChartView({
  data,
  classNameDisplay = 'Class 12 Science (Computer)',
  academicYearDisplay = '2083 BS',
  labDisplayName = 'Computer Engineering Lab 01',
}: PrintSeatingChartViewProps) {
  // Group workstations by row_label (e.g. "Row A", "Row B", "Row C", "Row D", "Teacher")
  const { rowGroups, unassignedStudents } = useMemo(() => {
    const groups: Record<string, typeof data.workstations> = {}

    data.workstations.forEach((ws) => {
      const row = ws.row_label || 'Other Stations'
      if (!groups[row]) groups[row] = []
      groups[row].push(ws)
    })

    // Sort workstations within each row by label
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
    })

    return {
      rowGroups: groups,
      unassignedStudents: data.unassigned_students || [],
    }
  }, [data])

  return (
    <PrintLayout
      icon={LayoutGrid}
      title="Official Laboratory Seating Wall Chart"
      subtitle="High-density scaled blueprint and seating matrix for entrance door and laboratory technician desk."
      backHref="/computer-lab"
      backLabel="Back to Computer Lab"
      printButtonLabel="Print Seating Chart (A4 Landscape)"
      printButtonColorClass="bg-indigo-600 hover:bg-indigo-700"
      documentTitleBadge="OFFICIAL LABORATORY SEATING WALL CHART"
      headerSubtitle="NEPAL GOVERNMENT RECOGNIZED • VOCATIONAL & TECHNICAL EDUCATION"
      nepaliName={INSTITUTION_CONFIG.nameNepali}
      headerFacilityName={labDisplayName}
      headerAcademicYear={academicYearDisplay}
      signatureTier="3-tier"
      footerNote="Official Laboratory Seating Wall Chart • Certified Academic Allocation"
      subHeaderBanner={
        <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2 border-b border-zinc-300 pb-3 font-sans">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-900">
              {classNameDisplay} &bull; Workstation Allocation Plan
            </h2>
            <p className="text-[11px] text-zinc-600">
              Prescribed seating assignments for Class 11/12 academic practical sessions. Students must occupy their designated terminal.
            </p>
          </div>

          <div className="text-right text-[11px] text-zinc-700">
            <div>
              Total Enrolled Students: <strong className="text-black">{data.total_students}</strong>
            </div>
            <div>
              Assigned Workstations: <strong className="text-black">{data.assigned_count}</strong> &bull; Unassigned:{' '}
              <strong className="text-black">{data.unassigned_count}</strong>
            </div>
          </div>
        </div>
      }
    >
      <div className="space-y-4 font-sans text-black">
        {/* Physical Layout Blueprint Visual representation */}
        <div className="border border-zinc-400 rounded p-3 bg-zinc-50/50">
          <div className="text-center font-bold text-xs uppercase tracking-widest text-zinc-700 pb-2 border-b border-dashed border-zinc-300 mb-3">
            FRONT OF LABORATORY &bull; TEACHER PODIUM &amp; WHITEBOARD
          </div>

          {/* Rows Grid */}
          <div className="space-y-3">
            {Object.entries(rowGroups).map(([rowLabel, stations]) => (
              <div key={rowLabel} className="space-y-1">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-600">
                  {rowLabel} ({stations.length} Terminals)
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                  {stations.map((ws) => {
                    const student = ws.assignment
                    return (
                      <div
                        key={ws.id}
                        className={`border rounded p-1.5 flex flex-col justify-between text-center min-h-[58px] ${
                          student
                            ? 'border-zinc-400 bg-white'
                            : 'border-dashed border-zinc-300 bg-zinc-100/60'
                        }`}
                      >
                        <div className="flex items-center justify-between border-b border-zinc-200 pb-0.5 text-[9px]">
                          <span className="font-mono font-bold text-zinc-900">{ws.label}</span>
                          {student && (
                            <span className="font-mono font-extrabold text-zinc-900 tabular-nums">
                              R-{student.roll_number}
                            </span>
                          )}
                        </div>

                        <div className="py-1">
                          {student ? (
                            <span className="text-[9px] font-semibold text-zinc-900 line-clamp-1">
                              {student.student_name}
                            </span>
                          ) : (
                            <span className="text-[8px] text-zinc-400 uppercase tracking-wider font-medium">
                              Vacant
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detailed Tabular Roster Mapping */}
        <div className="space-y-1 pt-2">
          <div className="text-xs font-bold uppercase tracking-wider text-zinc-800">
            Workstation Roster Index
          </div>
          <table className="w-full border-collapse border border-zinc-300 text-[10px]">
            <thead>
              <tr className="bg-zinc-100 text-zinc-800 font-bold uppercase">
                <th className="border border-zinc-300 px-2 py-1 text-left w-16">Terminal</th>
                <th className="border border-zinc-300 px-2 py-1 text-left w-16">Row</th>
                <th className="border border-zinc-300 px-2 py-1 text-left w-16">Roll No</th>
                <th className="border border-zinc-300 px-2 py-1 text-left">Student Full Name</th>
                <th className="border border-zinc-300 px-2 py-1 text-left w-28">Status</th>
                <th className="border border-zinc-300 px-2 py-1 text-center w-24">Sign / Tally</th>
              </tr>
            </thead>
            <tbody>
              {data.workstations.map((ws, i) => {
                const s = ws.assignment
                return (
                  <tr key={ws.id} className={i % 2 === 0 ? 'bg-white' : 'bg-zinc-50/70'}>
                    <td className="border border-zinc-300 px-2 py-1 font-mono font-bold">{ws.label}</td>
                    <td className="border border-zinc-300 px-2 py-1 text-zinc-600">{ws.row_label || '—'}</td>
                    <td className="border border-zinc-300 px-2 py-1 font-mono font-bold tabular-nums">
                      {s ? `Roll ${s.roll_number}` : '—'}
                    </td>
                    <td className="border border-zinc-300 px-2 py-1 font-medium">
                      {s ? s.student_name : <span className="text-zinc-400 italic">Available</span>}
                    </td>
                    <td className="border border-zinc-300 px-2 py-1">
                      {s ? (
                        <span className="text-zinc-900 font-semibold">Designated Seating</span>
                      ) : (
                        <span className="text-zinc-400">Open Station</span>
                      )}
                    </td>
                    <td className="border border-zinc-300 px-2 py-1 text-center">
                      <span className="inline-block w-12 border-b border-zinc-400" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Unassigned / Buffer Students Table (if any) */}
        {unassignedStudents.length > 0 && (
          <div className="space-y-1 pt-2 page-break-inside-avoid">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-800">
              Unassigned / Buffer Roster ({unassignedStudents.length} Students)
            </div>
            <table className="w-full border-collapse border border-zinc-300 text-[10px]">
              <thead>
                <tr className="bg-zinc-100 text-zinc-800 font-bold uppercase">
                  <th className="border border-zinc-300 px-2 py-1 text-left w-16">Roll No</th>
                  <th className="border border-zinc-300 px-2 py-1 text-left">Student Full Name</th>
                  <th className="border border-zinc-300 px-2 py-1 text-left">Admitted Class</th>
                  <th className="border border-zinc-300 px-2 py-1 text-left w-36">Assigned Station</th>
                </tr>
              </thead>
              <tbody>
                {unassignedStudents.map((s, idx) => (
                  <tr key={s.student_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-zinc-50'}>
                    <td className="border border-zinc-300 px-2 py-1 font-mono font-bold tabular-nums">
                      Roll {s.roll_number}
                    </td>
                    <td className="border border-zinc-300 px-2 py-1 font-medium">{s.full_name}</td>
                    <td className="border border-zinc-300 px-2 py-1">{classNameDisplay}</td>
                    <td className="border border-zinc-300 px-2 py-1 text-zinc-500 italic">
                      Rotational / Buffer
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PrintLayout>
  )
}
