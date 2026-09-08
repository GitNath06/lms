'use client'

import React, { useState } from 'react'
import {
  AlertTriangle,
  Wrench,
  CheckCircle2,
  Plus,
  Building2,
  ChevronRight,
  ShieldAlert,
  Send,
} from 'lucide-react'
import { useIncidentState, LabIncidentRecord } from '@/hooks/use-incident-state'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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

        <CardHeader className="p-4 pb-3 border-b border-zinc-100 dark:border-white/[0.06] flex flex-row items-center justify-between bg-zinc-50/50 dark:bg-surface-1/60">
          <div>
            <CardTitle className="text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              Equipment Breakage & Incident Register
            </CardTitle>
            <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
              Laboratory equipment health & damage settlements
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsReportModalOpen(true)}
              className="h-7 px-2.5 text-[11px] font-mono gap-1 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 shadow-2xs font-bold cursor-pointer"
            >
              <Plus className="h-3 w-3" />
              <span>Report Damage</span>
            </Button>
            {pendingCoordinator.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-1">
                <Send className="h-2.5 w-2.5" />
                {pendingCoordinator.length} Coordinator
              </span>
            )}
            <Badge variant="outline" className="font-mono text-[10px]">
              {activeIncidents.length} Active
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-3.5 space-y-2.5">
          {activeIncidents.length === 0 ? (
            <div className="p-6 text-center rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
              <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1.5 opacity-80" />
              <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                All Laboratories Operating at 100% Health
              </p>
              <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                No active equipment breakages or pending repairs logged.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {activeIncidents.map((inc) => {
                const isCritical = inc.severity === 'major_critical'
                const isEscalated = inc.status === 'escalated_to_hod'

                return (
                  <div
                    key={inc.id}
                    onClick={() => openDrawer(inc)}
                    className={`p-3 rounded-xl border transition-all duration-150 ease-out hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 active:scale-[0.99] cursor-pointer flex items-center justify-between gap-3 group ${
                      isEscalated
                        ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20 hover:border-rose-400'
                        : 'border-zinc-200/80 dark:border-white/[0.06] bg-white dark:bg-surface-2/70 hover:border-zinc-300 dark:hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`p-2 rounded-lg shrink-0 ${
                          isCritical
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {isCritical ? <ShieldAlert className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-zinc-950 dark:text-white truncate">
                            {inc.equipment_name}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 uppercase font-bold">
                            {inc.lab_id}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-500 truncate font-sans">
                          {inc.batch_name} • {inc.session_label} • By {inc.subject_teacher_name}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant={
                          isEscalated
                            ? 'destructive'
                            : inc.status === 'under_repair'
                            ? 'info'
                            : inc.status === 'replaced'
                            ? 'indigo'
                            : 'warning'
                        }
                        className="text-[10px] uppercase font-bold"
                      >
                        {inc.status.replace('_', ' ')}
                      </Badge>

                      <ChevronRight className="h-3.5 w-3.5 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Direct link to dedicated /records/incidents page & printout */}
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px] font-mono">
            <a
              href="/print/incidents"
              className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:underline flex items-center gap-1"
            >
              <span>Certified Printout ↗</span>
            </a>
            <a
              href="/records/incidents"
              className="text-rose-600 dark:text-rose-400 hover:underline font-bold flex items-center gap-1"
            >
              <span>Full Incident Register</span>
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
