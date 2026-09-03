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
} from 'lucide-react'
import { MasterRoutineItem } from '@/lib/master-data'

interface LiveLabPodsProps {
  activeSessions: MasterRoutineItem[]
  onOpenSession: (session: MasterRoutineItem) => void
  onQuickBook: (labName: string) => void
}

const LABS_INFO = [
  {
    key: 'comp',
    code: 'LAB-COMP-01',
    name: 'Computer Engineering Lab',
    dept: 'DEPT // COMPUTER ENG',
    icon: Terminal,
    capacity: 40,
  },
  {
    key: 'phys',
    code: 'LAB-PHYS-01',
    name: 'Physics Laboratory',
    dept: 'DEPT // SCIENCE',
    icon: Atom,
    capacity: 38,
  },
  {
    key: 'chem',
    code: 'LAB-CHEM-01',
    name: 'Chemistry Laboratory',
    dept: 'DEPT // SCIENCE',
    icon: FlaskRound,
    capacity: 40,
  },
]

export default function LiveLabPods({
  activeSessions,
  onOpenSession,
  onQuickBook,
}: LiveLabPodsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="text-xs font-mono font-bold tracking-wider text-zinc-900 dark:text-zinc-100 uppercase">
            Facility Telemetry // Live Room Occupancy
          </h3>
        </div>
        <span className="text-[11px] text-zinc-400 font-mono">Real-time status</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {LABS_INFO.map((lab) => {
          const Icon = lab.icon
          const activeSessionInLab = activeSessions.find(
            (s) =>
              (lab.key === 'comp' && s.lab === 'Computer Lab') ||
              (lab.key === 'phys' && s.lab === 'Physics Lab') ||
              (lab.key === 'chem' && s.lab === 'Chemistry Lab')
          )

          const isOccupied = !!activeSessionInLab

          return (
            <div
              key={lab.key}
              className={`rounded-xl border p-4 transition-all duration-200 backdrop-blur-md flex flex-col justify-between bg-white dark:bg-zinc-900/60 ${
                isOccupied
                  ? 'border-emerald-500/40 dark:border-emerald-500/30 shadow-xs'
                  : 'border-zinc-200/80 dark:border-zinc-800 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-400 font-mono font-bold">
                        {lab.code}
                      </div>
                      <h4 className="text-xs font-bold text-zinc-950 dark:text-white tracking-tight">
                        {lab.name}
                      </h4>
                    </div>
                  </div>

                  {/* Hardware Status LED */}
                  {isOccupied ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                      OCCUPIED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                      <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                      AVAILABLE
                    </span>
                  )}
                </div>

                {/* Session Details or Free State */}
                {isOccupied && activeSessionInLab ? (
                  <div className="my-2 p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-700/60 space-y-1 font-mono text-xs">
                    <div className="flex items-center justify-between text-[10px] text-zinc-500">
                      <span>{activeSessionInLab.timeSlot}</span>
                      <span className="font-bold text-zinc-800 dark:text-zinc-200">
                        {activeSessionInLab.grade}
                      </span>
                    </div>
                    <div className="font-bold text-zinc-950 dark:text-white truncate font-sans">
                      {activeSessionInLab.subjectCode} — {activeSessionInLab.subjectTitle}
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Faculty: <strong>{activeSessionInLab.teacher}</strong>
                    </div>
                  </div>
                ) : (
                  <div className="my-2 p-2.5 rounded-lg bg-zinc-50/50 dark:bg-zinc-900/30 border border-dashed border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-400 font-mono flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    <span>Facility open for practical sessions.</span>
                  </div>
                )}
              </div>

              {/* Footer Specs & Quick Actions */}
              <div className="pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mt-1">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3 text-zinc-400" />
                  Capacity: {lab.capacity}
                </span>

                {isOccupied && activeSessionInLab ? (
                  <button
                    onClick={() => onOpenSession(activeSessionInLab)}
                    className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5 hover:underline"
                  >
                    <span>Record Log</span>
                    <ArrowUpRight className="h-3 w-3" />
                  </button>
                ) : (
                  <button
                    onClick={() => onQuickBook(lab.name)}
                    className="text-zinc-700 dark:text-zinc-300 font-bold flex items-center gap-0.5 hover:underline"
                  >
                    <span>+ Quick Book</span>
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
