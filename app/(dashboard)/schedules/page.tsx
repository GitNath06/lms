'use client'

import React, { useState } from 'react'
import { Calendar, Printer, Plus, Filter, Sparkles, BookOpen, Layers, Terminal, Atom, FlaskRound, Dna } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import AdvancedCalendar from './advanced-calendar'
import SessionActionModal from '@/components/schedules/session-action-modal'

export default function SchedulesPage() {
  const [labFilter, setLabFilter] = useState('all')
  const [isAdhocOpen, setIsAdhocOpen] = useState(false)

  return (
    <div className="flex flex-col h-[calc(100vh-84px)] -m-4 md:-m-6 p-3 md:p-4 space-y-3 animate-in fade-in duration-300 select-none overflow-hidden">
      {/* Sleek, Single-Line Ultra-Compact Command Toolbar (No Bulky KPI Blocks) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white/90 dark:bg-zinc-900/90 p-3 px-4 rounded-xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs backdrop-blur-md shrink-0 print:hidden">
        {/* Left: Title & Session Tag */}
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/60 dark:border-indigo-800/50 shadow-2xs">
            <Calendar className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-tight text-zinc-950 dark:text-white font-mono">
                Laboratory Timetable Matrix
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                Session 2083
              </span>
            </div>
          </div>
        </div>

        {/* Center: High-Contrast Segmented Lab Switcher */}
        <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-lg text-xs font-mono border border-zinc-200/60 dark:border-zinc-700/60">
          <button
            type="button"
            onClick={() => setLabFilter('all')}
            className={`px-3 py-1 rounded-md transition-all font-bold ${
              labFilter === 'all'
                ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            All Labs
          </button>
          <button
            type="button"
            onClick={() => setLabFilter('comp')}
            className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
              labFilter === 'comp'
                ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
            <span>Computer Lab</span>
          </button>
          <button
            type="button"
            onClick={() => setLabFilter('phys')}
            className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
              labFilter === 'phys'
                ? 'bg-white dark:bg-zinc-900 text-cyan-600 dark:text-cyan-400 font-bold shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-cyan-500" />
            <span>Physics Lab</span>
          </button>
          <button
            type="button"
            onClick={() => setLabFilter('chem')}
            className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
              labFilter === 'chem'
                ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 font-bold shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <span>Chemistry Lab</span>
          </button>
          <button
            type="button"
            onClick={() => setLabFilter('bio')}
            className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
              labFilter === 'bio'
                ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Biology Lab</span>
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs font-semibold gap-1.5 border-zinc-200 dark:border-zinc-800 font-mono"
            onClick={() => {
              if (typeof window !== 'undefined') window.print()
            }}
          >
            <Printer className="h-3.5 w-3.5 text-zinc-500" />
            <span>Print Routine</span>
          </Button>

          <Button
            size="sm"
            className="h-8 text-xs font-semibold gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-mono shadow-xs"
            onClick={() => setIsAdhocOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>+ Book Slot</span>
          </Button>
        </div>
      </div>

      {/* Main Expansive Calendar Canvas (Takes 100% Remaining Height) */}
      <div className="flex-1 w-full overflow-hidden min-h-0">
        <AdvancedCalendar labFilter={labFilter} />
      </div>

      {/* Ad-hoc / New Slot Booking Modal */}
      <SessionActionModal
        isOpen={isAdhocOpen}
        onClose={() => setIsAdhocOpen(false)}
        session={{
          id: 'adhoc-new',
          day: 'Monday',
          dayKey: 'mon',
          timeSlot: '10:10 - 11:00',
          slotId: 't2',
          span: 1,
          subjectCode: 'COMP-12',
          subjectTitle: 'Data Structures & Algorithms Lab',
          grade: 'Class 12',
          gradeKey: 'class-12',
          teacher: 'Assigned Faculty',
          lab: 'Computer Lab',
          labKey: 'comp',
          defaultStudents: 38,
          category: 'Computer',
          dotColor: 'bg-indigo-500',
          badgeColor: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700',
          accentColor: 'border-l-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 text-zinc-950 dark:text-white',
        }}
        initialMode="book"
      />
    </div>
  )
}
