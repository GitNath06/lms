'use client'

import React, { useMemo } from 'react'
import { TrendingUp, BookOpen } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useInfrastructureState } from '@/hooks/use-infrastructure-state'
import { useLogsState } from '@/hooks/use-logs-state'

import { SlidingSegmentedTabs } from '@/components/ui/sliding-segmented-tabs'

export default function SyllabusProgress() {
  const { subjects } = useInfrastructureState()
  const { logs } = useLogsState()

  const syllabusTracks = useMemo(() => {
    // If no subjects registered yet, provide default fallback
    const targetSubjects = subjects.length > 0 ? subjects.slice(0, 5) : []

    return targetSubjects.map((sub, index) => {
      // Count conducted logs for this subject
      const conductedCount = logs.filter(
        (l) =>
          l.status === 'conducted' &&
          (l.subjectCode?.toUpperCase() === sub.code?.toUpperCase() ||
            l.subjectTitle?.toLowerCase().includes(sub.title?.toLowerCase()))
      ).length

      const quota = sub.quota || 15
      // If no logs yet for seed demo display, provide a simulated base + conducted count capped at quota
      const completed = Math.min(quota, conductedCount > 0 ? conductedCount : Math.min(quota, 4 + (index % 5)))
      const percentage = Math.min(100, Math.round((completed / quota) * 100))

      return {
        code: sub.code,
        subject: sub.title,
        grade: sub.grade,
        quota,
        completed,
        percentage,
      }
    })
  }, [subjects, logs])

  const [activeTab, setActiveTab] = React.useState<'pace' | 'recent'>('pace')

  const recentLogs = useMemo(() => {
    return logs
      .filter((l) => l.status === 'conducted')
      .slice(0, 5)
  }, [logs])

  // Automatically default to 'recent' if no curriculum subjects are seeded
  const hasQuotas = syllabusTracks.length > 0 && syllabusTracks.some((t) => t.quota > 0)
  const currentView = hasQuotas ? activeTab : 'recent'

  return (
    <Card className="glass-card border border-zinc-200/80 dark:border-white/[0.08] shadow-2xs relative overflow-hidden">
      {/* Milled Top Specular Sheen */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

      <CardHeader className="p-4 pb-3 border-b border-zinc-100 dark:border-white/[0.06] flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-xs sm:text-[13px] font-bold font-sans text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
            Academic Progress
          </CardTitle>
          <CardDescription className="text-xs text-zinc-500 dark:text-slate-400 font-sans mt-0.5">
            {currentView === 'pace' ? 'Term Syllabus Progress & Quotas' : 'Recent Practical Session Activity'}
          </CardDescription>
        </div>

        {hasQuotas && (
          <SlidingSegmentedTabs
            size="sm"
            tabs={[
              { id: 'pace', label: 'Pace' },
              { id: 'recent', label: `Recent (${recentLogs.length})` },
            ]}
            activeTab={activeTab}
            onChange={(id) => setActiveTab(id)}
          />
        )}
      </CardHeader>

      <CardContent className="p-3.5 space-y-2.5">
        {currentView === 'pace' ? (
          syllabusTracks.length === 0 ? (
            <div className="text-center py-4 text-xs text-zinc-500 dark:text-slate-400 font-sans">
              No active curriculum subjects configured.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {syllabusTracks.map((track, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-xl border border-zinc-200/60 dark:border-white/[0.06] bg-zinc-50/40 dark:bg-surface-2/40 hover:-translate-y-0.5 transition-all duration-150 ease-out motion-reduce:hover:translate-y-0 hover:shadow-2xs space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border bg-zinc-100 dark:bg-slate-800/80 text-zinc-800 dark:text-slate-300 border-zinc-200 dark:border-slate-700/60">
                        {track.code}
                      </span>
                      <span className="font-semibold text-zinc-900 dark:text-white text-xs sm:text-[13px] font-sans truncate">
                        {track.subject}
                      </span>
                    </div>
                    <div className="text-right font-sans text-xs text-zinc-600 dark:text-slate-300 shrink-0">
                      <span className="font-bold text-zinc-900 dark:text-white tabular-nums font-mono">
                        {track.completed}/{track.quota}
                      </span>
                      <span className="text-zinc-500 dark:text-slate-400 ml-1">({track.percentage}%)</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-1.5 w-full bg-zinc-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-700 ease-out"
                      style={{ width: `${track.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* Recent Verified Logs Fallback */
          recentLogs.length === 0 ? (
            <div className="text-center py-5 text-xs text-zinc-500 dark:text-slate-400 font-sans">
              No practical session records logged yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {recentLogs.map((log) => {
                const attPct = log.totalStudents > 0 ? (log.presentStudents / log.totalStudents) * 100 : 0
                const attColor =
                  attPct >= 85
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : attPct < 75
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-zinc-900 dark:text-slate-100'

                return (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-xl border border-zinc-200/60 dark:border-white/[0.06] bg-zinc-50/40 dark:bg-surface-2/40 space-y-1 text-xs font-sans"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border bg-zinc-100 dark:bg-slate-800/80 text-zinc-800 dark:text-slate-300 border-zinc-200 dark:border-slate-700/60">
                          {log.grade}
                        </span>
                        <span className="font-semibold text-zinc-900 dark:text-white truncate font-sans text-xs sm:text-[13px]">
                          {log.topicLearned || log.subjectTitle}
                        </span>
                      </div>
                      <span className={`${attColor} text-xs font-bold font-mono shrink-0 tabular-nums`}>
                        {log.presentStudents}/{log.totalStudents}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-slate-400 font-sans">
                      <span>{log.lab} • {log.teacher}</span>
                      <span className="font-mono text-[11px]">{log.date}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}
      </CardContent>
    </Card>
  )
}
