'use client'

import React from 'react'
import {
  X,
  Wrench,
  CheckCircle2,
  Calendar,
  UserCheck,
  FileText,
  Clock,
  Package,
  Layers,
  ShieldCheck,
  Monitor,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MaintenanceLogRecord } from '@/app/actions/maintenance'

interface MaintenanceDetailDrawerProps {
  isOpen: boolean
  onClose: () => void
  log: MaintenanceLogRecord | null
}

export default function MaintenanceDetailDrawer({
  isOpen,
  onClose,
  log,
}: MaintenanceDetailDrawerProps) {
  if (!isOpen || !log) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 h-full shadow-2xl border-l border-zinc-200 dark:border-zinc-800 flex flex-col justify-between animate-in slide-in-from-right duration-200 font-sans">
        {/* Header */}
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200">
                  {log.lab_name || log.lab_id}
                </span>
                <span className="text-[10px] text-zinc-400">
                  Ref: {log.id.slice(0, 8)}
                </span>
              </div>
              <h3 className="text-sm font-bold text-zinc-950 dark:text-white mt-0.5">
                {log.plan_title || 'General Maintenance Record'}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Key Metrics Strip */}
          <div className="grid grid-cols-2 gap-3.5 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
            <div>
              <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                Service Date
              </div>
              <div className="text-xs font-bold text-zinc-900 dark:text-white mt-0.5 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                {log.service_date}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                Performed By
              </div>
              <div className="text-xs font-bold text-zinc-900 dark:text-white mt-0.5 flex items-center gap-1.5 truncate">
                <UserCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                {log.performed_by_name || 'Lab In-Charge'}
              </div>
            </div>

            <div className="col-span-2 pt-2 border-t border-zinc-200/70 dark:border-zinc-700/60">
              <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                Target Hardware / Machines
              </div>
              <div className="text-xs font-bold text-zinc-900 dark:text-white mt-0.5 flex items-center gap-1.5">
                <Monitor className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                {log.asset_identifier}
              </div>
            </div>
          </div>

          {/* Next Cycle Target */}
          {log.next_service_due && (
            <div className="p-3.5 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Clock className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                <div>
                  <div className="text-xs font-bold text-sky-950 dark:text-sky-200">
                    Next Automated Recurrence Target
                  </div>
                  <div className="text-[11px] text-sky-700 dark:text-sky-400">
                    Scheduled automatically based on routine cycle
                  </div>
                </div>
              </div>
              <span className="text-xs font-bold text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-900/60 px-2.5 py-1 rounded-lg">
                {log.next_service_due}
              </span>
            </div>
          )}

          {/* Work Performed */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
              Work Completed Summary
            </h4>
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 whitespace-pre-line leading-relaxed">
              {log.work_performed}
            </div>
          </div>

          {/* Checklist Completed */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                Checklist Verification
              </h4>
              <span className="text-[11px] text-zinc-400 font-medium">
                {log.checklist_completed?.length || 0} items confirmed
              </span>
            </div>

            {log.checklist_completed && log.checklist_completed.length > 0 ? (
              <div className="space-y-1.5">
                {log.checklist_completed.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-zinc-400 italic">No checklist items specified for this log.</div>
            )}
          </div>

          {/* Replaced Parts */}
          {log.parts_replaced && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-zinc-400" />
                Hardware / Parts Used
              </h4>
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-200">
                {log.parts_replaced}
              </div>
            </div>
          )}

          {/* Remarks */}
          {log.remarks && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                Notes & Future Recommendations
              </h4>
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-300 italic leading-relaxed">
                "{log.remarks}"
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end bg-zinc-50/50 dark:bg-zinc-800/30">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 text-xs px-4"
          >
            Close Details
          </Button>
        </div>
      </div>
    </div>
  )
}
