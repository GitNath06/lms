'use client'

import React from 'react'
import {
  Terminal,
  Atom,
  FlaskRound,
  Users,
  ArrowUpRight,
  CalendarPlus,
  Wrench,
  Dna,
  Cpu,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { MasterRoutineItem } from '@/lib/master-data'
import { useInfrastructureState, LabFacilityItem } from '@/hooks/use-infrastructure-state'

interface FacilityTelemetryCardProps {
  ongoingSessions: MasterRoutineItem[]
  onOpenSession: (session: MasterRoutineItem) => void
  onQuickBook: (labName: string) => void
}

const FALLBACK_LABS: LabFacilityItem[] = [
  {
    id: 'comp',
    code: 'LAB-COMP-01',
    name: 'Computer Engineering Lab 01',
    type: 'computer_lab',
    capacity: 40,
    status: 'Operational',
  },
  {
    id: 'phys',
    code: 'LAB-PHYS-01',
    name: 'Physics Laboratory',
    type: 'physics_lab',
    capacity: 38,
    status: 'Operational',
  },
  {
    id: 'chem',
    code: 'LAB-CHEM-01',
    name: 'Chemistry Laboratory',
    type: 'chemistry_lab',
    capacity: 40,
    status: 'Operational',
  },
]

function getLabIcon(type?: string, name?: string) {
  const t = (type || '').toLowerCase()
  const n = (name || '').toLowerCase()
  if (t === 'physics_lab' || n.includes('phys')) return Atom
  if (t === 'chemistry_lab' || n.includes('chem')) return FlaskRound
  if (t === 'biology_lab' || n.includes('bio') || n.includes('life')) return Dna
  if (t === 'electronics_lab' || n.includes('elec') || n.includes('hardware')) return Cpu
  return Terminal
}

export default function FacilityTelemetryCard({
  ongoingSessions,
  onOpenSession,
  onQuickBook,
}: FacilityTelemetryCardProps) {
  const { labs: infraLabs } = useInfrastructureState()

  // Filter to active/operational facilities, keeping under-maintenance visible with explicit badge
  const displayLabs = (infraLabs && infraLabs.length > 0)
    ? infraLabs.filter((l: any) => l.is_active !== false && l.status !== 'Inactive')
    : FALLBACK_LABS

  const occupiedCount = displayLabs.filter((lab) => {
    if (lab.status === 'Under Maintenance') return false
    return ongoingSessions.some(
      (s) =>
        s.labKey === lab.id ||
        s.lab?.toLowerCase() === lab.name.toLowerCase() ||
        s.lab?.toLowerCase().includes(lab.id.toLowerCase())
    )
  }).length

  const maintenanceCount = displayLabs.filter((l) => l.status === 'Under Maintenance').length

  return (
    <Card className="glass-card border-zinc-200/80 dark:border-border-card shadow-2xs overflow-hidden">
      <CardHeader className="p-3 sm:p-3.5 pb-2 border-b border-zinc-100 dark:border-border-subtle flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-xs sm:text-[13px] font-bold font-sans text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-500" />
            Laboratory Rooms & Availability
          </CardTitle>
          <p className="text-[11px] text-zinc-500 dark:text-slate-400 font-sans mt-0.5">
            Current room status and workstation capacity
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {maintenanceCount > 0 && (
            <span className="text-[10.5px] font-semibold font-sans px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
              <Wrench className="h-2.5 w-2.5" />
              <span>{maintenanceCount} Maint</span>
            </span>
          )}
          <span className="text-[11px] font-semibold font-sans px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-surface-2 text-zinc-700 dark:text-slate-300 border border-zinc-200 dark:border-border-subtle">
            {occupiedCount} / {displayLabs.length} In Use
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-2.5 sm:p-3 space-y-2">
        {displayLabs.map((lab) => {
          const Icon = getLabIcon(lab.type, lab.name)
          const isMaintenance = lab.status === 'Under Maintenance'

          const activeSession = !isMaintenance
            ? ongoingSessions.find(
                (s) =>
                  s.labKey === lab.id ||
                  s.lab?.toLowerCase() === lab.name.toLowerCase() ||
                  s.lab?.toLowerCase().includes(lab.id.toLowerCase())
              )
            : null
          const isOccupied = !!activeSession

          return (
            <div
              key={lab.id}
              className={`p-2.5 rounded-xl border transition-all ${
                isMaintenance
                  ? 'border-amber-500/30 bg-amber-50/15 dark:bg-amber-950/15 shadow-2xs'
                  : isOccupied
                  ? 'border-emerald-500/30 dark:border-emerald-500/30 bg-emerald-50/10 dark:bg-emerald-950/15 shadow-2xs'
                  : 'border-zinc-200/80 dark:border-white/[0.06] bg-zinc-50/40 dark:bg-surface-2/40'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Icon
                    className={`h-3.5 w-3.5 shrink-0 ${
                      isMaintenance
                        ? 'text-amber-500'
                        : isOccupied
                        ? 'text-emerald-500'
                        : 'text-zinc-500 dark:text-slate-400'
                    }`}
                  />
                  <div>
                    <h4 className="text-xs sm:text-[13px] font-bold font-heading text-zinc-950 dark:text-white">
                      {lab.name}
                    </h4>
                    <span className="text-[11px] text-zinc-500 dark:text-slate-400 font-mono">
                      {lab.code || lab.id.toUpperCase()}
                    </span>
                  </div>
                </div>

                {isMaintenance ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-bold font-sans bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                    <Wrench className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                    Under Maintenance
                  </span>
                ) : isOccupied ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold font-sans bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    In Session
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold font-sans text-zinc-600 dark:text-slate-400 border border-zinc-200 dark:border-slate-700/60 bg-zinc-50/50 dark:bg-surface-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-slate-500" />
                    Available
                  </span>
                )}
              </div>

              {isMaintenance ? (
                <div className="mt-1.5 pt-1.5 border-t border-amber-500/20 dark:border-amber-500/20 flex items-center justify-between text-xs font-sans text-amber-700 dark:text-amber-300">
                  <span className="flex items-center gap-1.5">
                    <Wrench className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span>Servicing & Maintenance In Progress</span>
                  </span>
                  <span className="text-[10.5px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                    Booking Suspended
                  </span>
                </div>
              ) : isOccupied && activeSession ? (
                <div className="mt-1.5 pt-1.5 border-t border-emerald-500/20 dark:border-emerald-500/20 text-xs">
                  <div className="flex items-center justify-between font-sans text-xs">
                    <span className="font-bold text-zinc-900 dark:text-white truncate">
                      {activeSession.subjectCode} ({activeSession.grade})
                    </span>
                    <span className="text-zinc-500 dark:text-slate-400 text-xs font-mono shrink-0">
                      {activeSession.timeSlot}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-slate-300 mt-0.5 font-sans">
                    <span>
                      Supervisor:{' '}
                      <strong className="text-zinc-800 dark:text-slate-200 font-semibold">
                        {activeSession.teacher}
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenSession(activeSession)}
                      className="text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <span>Record Log</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-1.5 pt-1.5 border-t border-zinc-200/60 dark:border-border-subtle flex items-center justify-between text-xs font-sans text-zinc-600 dark:text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-zinc-500 dark:text-slate-400" />
                    Capacity: {lab.capacity} Workstations
                  </span>
                  <button
                    type="button"
                    onClick={() => onQuickBook(lab.name)}
                    className="text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <CalendarPlus className="h-3.5 w-3.5" />
                    <span>Book Lab Slot</span>
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
