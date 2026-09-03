'use client'

import React from 'react'
import { TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

const SYLLABUS_TRACKS = [
  {
    code: 'CN-12',
    subject: 'Computer Networks',
    grade: 'Class 12',
    completed: 8,
    total: 12,
    gradient: 'from-indigo-500 to-blue-500',
    badge: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
  },
  {
    code: 'DBMS-10',
    subject: 'Database Management',
    grade: 'Class 10',
    completed: 7,
    total: 10,
    gradient: 'from-sky-500 to-cyan-500',
    badge: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
  },
  {
    code: 'CHEM-12',
    subject: 'Analytical Chemistry',
    grade: 'Class 12',
    completed: 8,
    total: 10,
    gradient: 'from-rose-500 to-pink-500',
    badge: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
  },
  {
    code: 'PHY-11',
    subject: 'Optics & Mechanics',
    grade: 'Class 11',
    completed: 6,
    total: 10,
    gradient: 'from-cyan-500 to-teal-500',
    badge: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
  },
]

export default function SyllabusProgress() {
  return (
    <Card className="border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
      <CardHeader className="p-4 pb-3 border-b border-zinc-100 dark:border-zinc-800/80 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
            Curriculum Progress
          </CardTitle>
          <CardDescription className="text-[11px] text-zinc-500">
            2083 Academic Term Quota
          </CardDescription>
        </div>
        <TrendingUp className="h-3.5 w-3.5 text-indigo-500" />
      </CardHeader>

      <CardContent className="p-3.5 space-y-2.5">
        {SYLLABUS_TRACKS.map((track, i) => {
          const percentage = Math.round((track.completed / track.total) * 100)

          return (
            <div
              key={i}
              className="p-2.5 rounded-lg border border-zinc-200/60 dark:border-zinc-800/80 bg-zinc-50/40 dark:bg-zinc-900/30 space-y-1.5"
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 truncate">
                  <span className={`px-1 py-0.2 rounded text-[9px] font-mono font-bold border ${track.badge}`}>
                    {track.code}
                  </span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-[11px] truncate">
                    {track.subject}
                  </span>
                </div>
                <div className="text-right font-mono text-[10px] text-zinc-500 shrink-0">
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">{track.completed}/{track.total}</span>
                  <span className="text-zinc-400 ml-1">({percentage}%)</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${track.gradient} transition-all duration-500`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
