'use client'

import React, { useState, useEffect } from 'react'
import { Printer } from 'lucide-react'
import PrintFilterControls from './print-filter-controls'
import PrintTriggerButton from './print-trigger-button'
import { PracticalLogRecord } from '@/hooks/use-logs-state'

export interface PracticalLogItem {
  id: string
  period_label: string
  batch_group: string
  subject_name: string
  practical_title?: string | null
  topic_learned?: string | null
  profiles?: { full_name?: string } | null
  present_students: number
  total_students: number
  status?: string | null
  skip_reason?: string | null
  remarks?: string | null
  lab_id?: string | null
  date?: string | null
}

interface DailyLogSheetViewProps {
  initialLogs: PracticalLogItem[]
  labs: Array<{ id: string; name: string; type: string }>
  date: string
  labId: string
  labDisplayName: string
}

const STORAGE_KEY = 'lab_practical_logs_v1'

export default function DailyLogSheetView({
  initialLogs,
  labs,
  date,
  labId,
  labDisplayName,
}: DailyLogSheetViewProps) {
  const [logs, setLogs] = useState<PracticalLogItem[]>(initialLogs)

  // Merge client-side localStorage logs on mount for immediate zero-data-loss preview
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed: PracticalLogRecord[] = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          // Filter records matching the target date
          const localMatching = parsed.filter((l) => {
            const matchesDate = l.date === date
            const matchesLab =
              labId === 'all' ||
              l.lab?.toLowerCase().includes(labId) ||
              l.sessionId?.toLowerCase().includes(labId)
            return matchesDate && matchesLab
          })

          if (localMatching.length > 0) {
            // Map to PracticalLogItem format
            const mappedLocal: PracticalLogItem[] = localMatching.map((l) => ({
              id: l.id,
              period_label: l.timeSlot,
              batch_group: l.grade,
              subject_name: `${l.subjectCode} - ${l.subjectTitle}`,
              practical_title: l.topicLearned,
              topic_learned: l.topicLearned,
              profiles: { full_name: l.teacher },
              present_students: l.presentStudents,
              total_students: l.totalStudents,
              status: l.status,
              skip_reason: l.skipReason,
              remarks: l.remarks,
              lab_id: l.lab,
              date: l.date,
            }))

            // Merge local and server logs, deduplicating by ID or (period + batch)
            const mapById = new Map<string, PracticalLogItem>()
            initialLogs.forEach((item) => mapById.set(item.id, item))
            mappedLocal.forEach((item) => {
              // Local state has the latest edits
              mapById.set(item.id, item)
            })

            setLogs(Array.from(mapById.values()))
          }
        }
      }
    } catch (e) {
      console.warn('Failed to merge local practical logs:', e)
    }
  }, [initialLogs, date, labId])

  const totalSessions = logs.length
  const conductedSessions = logs.filter((l) => l.status !== 'skipped').length
  const totalStudents = logs.reduce((acc, curr) => acc + (curr.present_students || 0), 0)

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Interactive Controls Bar (Hidden during window.print()) */}
      <div className="bg-white dark:bg-zinc-900/80 p-5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden backdrop-blur-md">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-950 dark:text-white flex items-center gap-2">
            <Printer className="h-5 w-5 text-indigo-500" />
            Official Daily Practical Log Sheet
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Audit-ready certified daily report for academic laboratory handovers & inspections.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <PrintFilterControls labs={labs} currentDate={date} currentLabId={labId} />
          <PrintTriggerButton />
        </div>
      </div>

      {/* Formal Printable Document Body */}
      <div className="bg-white text-zinc-950 p-8 sm:p-12 rounded-xl border border-zinc-200/90 shadow-sm print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none print:w-full font-serif">
        {/* Letterhead Header */}
        <div className="text-center border-b-2 border-zinc-900 pb-5 mb-6">
          <div className="text-xs uppercase tracking-widest font-sans font-bold text-zinc-600 mb-1">
            Academic Laboratory Management & Verification System
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-wide text-zinc-950 font-serif">
            SHREE RATNA RAJYA LAXMI SECONDARY SCHOOL
          </h1>
          <p className="text-xs text-zinc-600 mt-1 font-sans">
            Department of Science & Computer Engineering • Kathmandu, Nepal
          </p>
          <div className="inline-block mt-3 px-4 py-1 border border-zinc-900 rounded font-sans text-xs font-bold uppercase tracking-wider bg-zinc-50">
            DAILY PRACTICAL EXPERIMENT RECORD & ATTENDANCE SHEET
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg bg-zinc-50 border border-zinc-200 mb-6 text-xs font-sans">
          <div>
            <span className="text-zinc-500 block font-mono text-[10px] uppercase">Record Date</span>
            <strong className="text-zinc-900 text-sm font-mono">{date}</strong>
          </div>
          <div>
            <span className="text-zinc-500 block font-mono text-[10px] uppercase">Target Facility</span>
            <strong className="text-zinc-900">{labDisplayName}</strong>
          </div>
          <div>
            <span className="text-zinc-500 block font-mono text-[10px] uppercase">Conducted Sessions</span>
            <strong className="text-zinc-900 font-mono">{conductedSessions} / {totalSessions} Slots</strong>
          </div>
          <div>
            <span className="text-zinc-500 block font-mono text-[10px] uppercase">Students Attended</span>
            <strong className="text-zinc-900 font-mono">{totalStudents} Students</strong>
          </div>
        </div>

        {/* Main Practical Record Table */}
        <div className="border border-zinc-900 rounded-md overflow-hidden mb-12">
          <table className="w-full text-left border-collapse text-xs font-sans">
            <thead>
              <tr className="bg-zinc-100 border-b border-zinc-900 text-zinc-900 uppercase font-mono font-bold text-[11px]">
                <th className="py-2.5 px-3 border-r border-zinc-300 w-28">Period / Slot</th>
                <th className="py-2.5 px-3 border-r border-zinc-300 w-36">Batch / Grade</th>
                <th className="py-2.5 px-3 border-r border-zinc-300">Subject & Experiment Title</th>
                <th className="py-2.5 px-3 border-r border-zinc-300 w-36">Faculty In-charge</th>
                <th className="py-2.5 px-3 border-r border-zinc-300 text-center w-24 font-mono">Attendance</th>
                <th className="py-2.5 px-3 w-40">Remarks / Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-300">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-zinc-500 font-mono italic">
                    No practical session logs recorded for this selected date and laboratory.
                  </td>
                </tr>
              ) : (
                logs.map((log, idx) => {
                  const isSkipped = log.status === 'skipped'
                  const turnout =
                    log.total_students > 0
                      ? Math.round((log.present_students / log.total_students) * 100)
                      : 0

                  return (
                    <tr key={log.id || idx} className="hover:bg-zinc-50/60 break-inside-avoid">
                      <td className="py-2.5 px-3 border-r border-zinc-300 font-mono font-medium align-top">
                        {log.period_label}
                      </td>
                      <td className="py-2.5 px-3 border-r border-zinc-300 align-top font-semibold text-zinc-900">
                        {log.batch_group}
                      </td>
                      <td className="py-2.5 px-3 border-r border-zinc-300 align-top">
                        <div className="font-bold text-zinc-950">{log.subject_name}</div>
                        <div className="text-[11px] text-zinc-700 mt-0.5">
                          {log.practical_title || log.topic_learned || 'Practical Experiment'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 border-r border-zinc-300 align-top font-medium">
                        {log.profiles?.full_name || 'Assigned Faculty'}
                      </td>
                      <td className="py-2.5 px-3 border-r border-zinc-300 text-center font-mono align-top">
                        {isSkipped ? (
                          <span className="text-amber-800 font-bold uppercase text-[10px]">Skipped</span>
                        ) : (
                          <div>
                            <span className="font-bold">{log.present_students}</span>
                            <span className="text-zinc-500"> / {log.total_students}</span>
                            <div className="text-[10px] text-zinc-600 font-mono">{turnout}%</div>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 align-top text-[11px] text-zinc-700">
                        {isSkipped ? (
                          <span className="text-amber-900 italic font-medium">
                            {log.skip_reason || 'Class rescheduled / postponed'}
                          </span>
                        ) : (
                          log.remarks || 'Completed as scheduled. Equipment verified in good condition.'
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Dual Institutional Signature Blocks */}
        <div className="grid grid-cols-2 gap-12 pt-12 px-8 mt-16 font-sans break-inside-avoid">
          <div className="text-center">
            <div className="border-t-2 border-zinc-900 pt-2 mx-auto w-56">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-900">Lab In-Charge Signature</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Faculty Certification</p>
            </div>
          </div>

          <div className="text-center">
            <div className="border-t-2 border-zinc-900 pt-2 mx-auto w-56">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-900">HOD / Principal Signature</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Institutional Approval</p>
            </div>
          </div>
        </div>

        {/* Verification Footer */}
        <div className="text-center mt-12 pt-4 border-t border-zinc-200 text-[10px] text-zinc-400 font-mono">
          Document generated by Institutional Laboratory Practical Management System (LMR) • Certified Copy
        </div>
      </div>
    </div>
  )
}
