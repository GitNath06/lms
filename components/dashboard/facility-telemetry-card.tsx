'use client'

import React from 'react'
import {
  Terminal,
  Atom,
  FlaskRound,
  Users,
  Clock,
  ArrowUpRight,
  Plus,
  ShieldCheck,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { MasterRoutineItem } from '@/lib/master-data'

interface FacilityTelemetryCardProps {
  ongoingSessions: MasterRoutineItem[]
  onOpenSession: (session: MasterRoutineItem) => void
  onQuickBook: (labName: string) => void
}

const LABS = [
  {
    key: 'comp',
    matchName: 'Computer Lab',
    code: 'LAB-COMP-01',
    name: 'Computer Engineering Lab',
    icon: Terminal,
    capacity: 40,
  },
  {
    key: 'phys',
    matchName: 'Physics Lab',
    code: 'LAB-PHYS-01',
    name: 'Physics Laboratory',
    icon: Atom,
    capacity: 38,
  },
  {
    key: 'chem',
    matchName: 'Chemistry Lab',
    code: 'LAB-CHEM-01',
    name: 'Chemistry Laboratory',
    icon: FlaskRound,
    capacity: 40,
  },
]

export default function FacilityTelemetryCard({
  ongoingSessions,
  onOpenSession,
  onQuickBook,
}: FacilityTelemetryCardProps) {
  const occupiedCount = LABS.filter((lab) =>
    ongoingSessions.some((s) => s.lab === lab.matchName)
  ).length

  return (
    <Card className="glass-card border-zinc-200/80 dark:border-border-card shadow-2xs overflow-hidden">
      <CardHeader className="p-4 pb-3 border-b border-zinc-100 dark:border-border-subtle flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-xs font-mono font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Facility Telemetry
          </CardTitle>
          <p className="text-[11px] text-zinc-500 dark:text-slate-400 font-mono mt-0.5">
            Real-time Room Occupancy & Capacity
          </p>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-surface-2 text-zinc-600 dark:text-slate-300 border border-zinc-200 dark:border-border-subtle">
          {occupiedCount} / {LABS.length} In-Use
        </span>
      </CardHeader>

      <CardContent className="p-3.5 space-y-3">
        {LABS.map((lab) => {
          const Icon = lab.icon
          const activeSession = ongoingSessions.find((s) => s.lab === lab.matchName)
          const isOccupied = !!activeSession

          return (
            <div
              key={lab.key}
              className={`p-3 rounded-xl border transition-all ${
                isOccupied
                  ? 'border-emerald-500/30 dark:border-emerald-500/40 bg-emerald-50/15 dark:bg-emerald-950/20 shadow-2xs'
                  : 'border-zinc-200/80 dark:border-border-subtle bg-zinc-50/40 dark:bg-surface-2/60'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-zinc-100 dark:bg-surface-2 flex items-center justify-center text-zinc-700 dark:text-slate-200 border border-zinc-200/60 dark:border-border-subtle">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold font-heading text-zinc-950 dark:text-white">
                      {lab.name}
                    </h4>
                    <span className="text-[10px] text-zinc-400 dark:text-slate-400 font-mono">{lab.code}</span>
                  </div>
                </div>

                {isOccupied ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 glow-pip-emerald">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                    IN USE
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono text-zinc-500 dark:text-slate-400 border border-zinc-200 dark:border-border-subtle bg-white dark:bg-surface-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                    AVAILABLE
                  </span>
                )}
              </div>

              {isOccupied && activeSession ? (
                <div className="mt-2 pt-2 border-t border-emerald-500/20 dark:border-emerald-500/20 text-xs">
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="font-bold text-zinc-900 dark:text-white truncate">
                      {activeSession.subjectCode} ({activeSession.grade})
                    </span>
                    <span className="text-zinc-500 dark:text-slate-400 text-[10px] shrink-0">{activeSession.timeSlot}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-slate-400 mt-1">
                    <span>Supervisor: <strong className="text-zinc-700 dark:text-slate-300">{activeSession.teacher}</strong></span>
                    <button
                      type="button"
                      onClick={() => onOpenSession(activeSession)}
                      className="text-emerald-600 dark:text-emerald-400 text-[11px] font-bold flex items-center gap-0.5 hover:underline cursor-pointer"
                    >
                      <span>Record Log</span>
                      <ArrowUpRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 pt-2 border-t border-zinc-200/60 dark:border-border-subtle flex items-center justify-between text-[11px] font-mono text-zinc-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3 text-zinc-400 dark:text-slate-400" />
                    Capacity: {lab.capacity} Seats
                  </span>
                  <button
                    type="button"
                    onClick={() => onQuickBook(lab.matchName)}
                    className="text-indigo-600 dark:text-indigo-400 text-[11px] font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Quick Book</span>
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
