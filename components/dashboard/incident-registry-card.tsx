'use client'

import React, { useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  ChevronRight,
} from 'lucide-react'
import { useIncidentState, LabIncidentRecord } from '@/hooks/use-incident-state'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import IncidentDrawer from './incident-drawer'
import ReportIncidentModal from './report-incident-modal'

export default function IncidentRegistryCard() {
  const { incidents } = useIncidentState()
  const [selectedIncident, setSelectedIncident] = useState<LabIncidentRecord | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)

  const openDrawer = (inc: LabIncidentRecord) => {
    setSelectedIncident(inc)
    setIsDrawerOpen(true)
  }

  const activeIncidents = incidents.filter((i) => i.status !== 'resolved')
  const pendingCoordinator = incidents.filter((i) => i.status === 'escalated_to_hod' || i.escalated_to_hod)

  return (
    <>
      <Card className="glass-card border border-zinc-200/80 dark:border-white/[0.08] shadow-2xs overflow-hidden relative">
        {/* Milled Top Specular Sheen */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

        <CardHeader className="p-3 sm:p-3.5 pb-2 border-b border-zinc-100 dark:border-white/[0.06] flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xs sm:text-[13px] font-bold font-sans text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${activeIncidents.length > 0 ? 'bg-rose-500' : 'bg-slate-400 dark:bg-slate-500'}`} />
              Equipment Breakages & Repairs
              {activeIncidents.length > 0 && (
                <span className="text-xs font-mono font-semibold text-zinc-500 dark:text-slate-400">
                  ({activeIncidents.length})
                </span>
              )}
            </CardTitle>
            <p className="text-[11px] text-zinc-500 dark:text-slate-400 font-sans mt-0.5">
              Active equipment faults and repair tracking
            </p>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsReportModalOpen(true)}
            className="h-7 px-2.5 text-xs font-sans gap-1 text-zinc-700 dark:text-slate-300 border-zinc-200 dark:border-slate-700 hover:bg-zinc-100 dark:hover:bg-surface-2 shadow-2xs font-semibold cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Report Damage</span>
          </Button>
        </CardHeader>

        <CardContent className="p-2.5 sm:p-3">
          {activeIncidents.length === 0 ? (
            <div className="p-4 text-center rounded-xl border border-dashed border-zinc-200 dark:border-slate-800 bg-zinc-50/50 dark:bg-surface-2/40">
              <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400 mx-auto mb-1 opacity-90" />
              <p className="text-xs font-bold text-zinc-900 dark:text-slate-100 font-sans">
                All Laboratories Operating at 100% Health
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-slate-400 font-sans mt-0.5">
                No active equipment breakages or pending repairs logged.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-white/[0.06] -my-1">
              {activeIncidents.map((inc) => {
                const isCritical = inc.severity === 'major_critical'
                const isEscalated = inc.status === 'escalated_to_hod'
                const formattedEquipment = inc.equipment_name
                  ? inc.equipment_name.replace(/Apparatus\s*\/\s*Station\s*Equipment/gi, 'Lab Equipment / Workstation').replace(/Apparatus/gi, 'Equipment')
                  : 'Lab Equipment / Workstation'

                return (
                  <div
                    key={inc.id}
                    onClick={() => openDrawer(inc)}
                    className="py-2 px-1.5 rounded-lg flex items-center justify-between gap-3 group hover:bg-zinc-50 dark:hover:bg-surface-2/60 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <AlertTriangle
                        className={`h-3.5 w-3.5 shrink-0 ${
                          isCritical
                            ? 'text-rose-500 dark:text-rose-400'
                            : 'text-amber-500 dark:text-amber-400'
                        }`}
                      />

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-zinc-950 dark:text-white truncate font-sans">
                            {formattedEquipment}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-slate-800 text-zinc-600 dark:text-slate-300 font-bold uppercase">
                            {inc.lab_id}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-slate-400 truncate font-sans mt-0.5">
                          {inc.batch_name || inc.session_label} • By {inc.subject_teacher_name}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded-md border ${
                          isEscalated
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                            : inc.status === 'under_repair'
                            ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                            : 'bg-zinc-100 dark:bg-surface-2 text-zinc-700 dark:text-slate-300 border-zinc-200 dark:border-white/[0.06]'
                        }`}
                      >
                        {inc.status.replace('_', ' ')}
                      </span>

                      <ChevronRight className="h-3.5 w-3.5 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Direct link to dedicated /records/incidents page & printout */}
          <div className="pt-2 mt-1.5 border-t border-zinc-100 dark:border-white/[0.06] flex items-center justify-between text-xs font-sans">
            <a
              href="/print/incidents"
              className="text-zinc-500 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white hover:underline flex items-center gap-1"
            >
              <span>Incident Register Sheet ↗</span>
            </a>
            <a
              href="/records/incidents"
              className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold flex items-center gap-1"
            >
              <span>Full Incident Logbook</span>
              <ChevronRight className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Incident Resolution Drawer */}
      <IncidentDrawer
        incident={selectedIncident}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false)
          setSelectedIncident(null)
        }}
      />

      {/* Standalone Report Incident Modal */}
      <ReportIncidentModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
      />
    </>
  )
}
