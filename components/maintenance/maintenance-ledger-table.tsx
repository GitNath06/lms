'use client'

import React, { useState, useMemo } from 'react'
import {
  Search,
  Filter,
  Calendar,
  Wrench,
  Printer,
  ChevronRight,
  UserCheck,
  CheckCircle2,
  FileText,
  Clock,
  Monitor,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MaintenanceLogRecord } from '@/app/actions/maintenance'

interface MaintenanceLedgerTableProps {
  logs: MaintenanceLogRecord[]
  selectedLab: string
  onSelectLab: (labId: string) => void
  onSelectLog: (log: MaintenanceLogRecord) => void
}

export default function MaintenanceLedgerTable({
  logs,
  selectedLab,
  onSelectLab,
  onSelectLog,
}: MaintenanceLedgerTableProps) {
  const [searchTerm, setSearchTerm] = useState('')

  // Filter logs by selected lab and search term
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (selectedLab !== 'all' && log.lab_id !== selectedLab) {
        return false
      }
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase()
        const matchAsset = log.asset_identifier?.toLowerCase().includes(query)
        const matchWork = log.work_performed?.toLowerCase().includes(query)
        const matchTech = log.performed_by_name?.toLowerCase().includes(query)
        const matchPlan = log.plan_title?.toLowerCase().includes(query)
        return matchAsset || matchWork || matchTech || matchPlan
      }
      return true
    })
  }, [logs, selectedLab, searchTerm])

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden font-sans">
      {/* Table Toolbar */}
      <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-zinc-50/50 dark:bg-zinc-800/30">
        <div>
          <h3 className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-2">
            <FileText className="h-4 w-4 text-indigo-500" />
            Lab Maintenance & Servicing Records
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Audit history of completed computer servicing, BIOS/software updates, cleaning, and routine checks.
          </p>
        </div>

        {/* Search & Print */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search machines, staff, or notes..."
              className="h-8 pl-8 text-xs bg-white dark:bg-zinc-900"
            />
          </div>

          <Link
            href={`/print/maintenance${
              selectedLab !== 'all' ? `?lab_id=${selectedLab}` : ''
            }`}
          >
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs gap-1.5 shrink-0 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <Printer className="h-3.5 w-3.5 text-zinc-500" />
              <span>Official Print</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Lab Filter Tabs */}
      <div className="px-4 py-2.5 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between gap-2 overflow-x-auto bg-white dark:bg-zinc-900 text-xs">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] text-zinc-400 font-medium flex items-center gap-1 mr-1">
            <Filter className="h-3 w-3" /> Facility:
          </span>
          {[
            { id: 'all', label: 'All Facilities' },
            { id: 'comp', label: 'Computer Lab' },
            { id: 'phys', label: 'Physics Lab' },
            { id: 'chem', label: 'Chemistry Lab' },
            { id: 'bio', label: 'Biology Lab' },
            { id: 'elec', label: 'Electronics' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectLab(tab.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                selectedLab === tab.id
                  ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">
          Showing <span className="font-bold text-zinc-900 dark:text-white">{filteredLogs.length}</span> records
        </div>
      </div>

      {/* Table Body */}
      {filteredLogs.length === 0 ? (
        <div className="py-12 text-center">
          <Wrench className="h-8 w-8 mx-auto text-zinc-300 dark:text-zinc-700 mb-2" />
          <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
            No Maintenance Records Found
          </h4>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-0.5">
            {searchTerm || selectedLab !== 'all'
              ? 'Try clearing your laboratory filter or search query.'
              : 'Complete a scheduled maintenance routine to log your first verified service.'}
          </p>
          {(searchTerm || selectedLab !== 'all') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm('')
                onSelectLab('all')
              }}
              className="mt-3 h-7 text-xs px-3"
            >
              Reset Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                <th className="py-3 px-4">Service Date</th>
                <th className="py-3 px-3">Laboratory</th>
                <th className="py-3 px-4">Routine & Target Machine(s)</th>
                <th className="py-3 px-3">Performed By</th>
                <th className="py-3 px-3 text-center">Checklist Verified</th>
                <th className="py-3 px-3 text-center">Next Target</th>
                <th className="py-3 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-sans">
              {filteredLogs.map((log) => (
                <tr
                  key={log.id}
                  onClick={() => onSelectLog(log)}
                  className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors group"
                >
                  {/* Service Date */}
                  <td className="py-3.5 px-4 text-xs font-semibold text-zinc-900 dark:text-white whitespace-nowrap">
                    {log.service_date}
                  </td>

                  {/* Lab */}
                  <td className="py-3.5 px-3 whitespace-nowrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                      {log.lab_name || log.lab_id}
                    </span>
                  </td>

                  {/* Plan & Target Machine */}
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-zinc-900 dark:text-white text-xs group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {log.plan_title || 'General Maintenance'}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 mt-0.5">
                      <span className="text-zinc-400">Target:</span>
                      <span className="text-zinc-800 dark:text-zinc-200 font-medium">
                        {log.asset_identifier}
                      </span>
                      {log.parts_replaced && (
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate max-w-[160px]">
                          • {log.parts_replaced}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Staff / Technician */}
                  <td className="py-3.5 px-3 whitespace-nowrap">
                    <div className="text-xs font-medium text-zinc-900 dark:text-white flex items-center gap-1.5">
                      <UserCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span>{log.performed_by_name || 'Lab In-Charge'}</span>
                    </div>
                  </td>

                  {/* Checklist */}
                  <td className="py-3.5 px-3 text-center whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="h-3 w-3" />
                      {log.checklist_completed?.length || 0} Steps
                    </span>
                  </td>

                  {/* Next Due */}
                  <td className="py-3.5 px-3 text-center text-xs text-sky-600 dark:text-sky-400 font-medium whitespace-nowrap">
                    {log.next_service_due || '—'}
                  </td>

                  {/* Action */}
                  <td className="py-3.5 px-3 text-center whitespace-nowrap">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/40 rounded-lg"
                    >
                      Audit Details <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
