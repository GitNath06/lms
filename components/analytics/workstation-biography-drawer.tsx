'use client'

import React, { useEffect, useState } from 'react'
import {
  X,
  Monitor,
  Wrench,
  AlertTriangle,
  History,
  Users,
  ShieldCheck,
  Clock,
  CheckCircle2,
  Calendar,
  Loader2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getWorkstationTechnicalBiography } from '@/app/actions/institutional-reports'
import type { WorkstationBiography } from '@/lib/types/institutional-reports'

interface WorkstationBiographyDrawerProps {
  workstationId: string | null
  onClose: () => void
}

export function WorkstationBiographyDrawer({
  workstationId,
  onClose,
}: WorkstationBiographyDrawerProps) {
  const [data, setData] = useState<WorkstationBiography | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeSubTab, setActiveSubTab] = useState<'issues' | 'maintenance' | 'seating' | 'forensics'>('issues')

  useEffect(() => {
    if (!workstationId) return
    setLoading(true)
    getWorkstationTechnicalBiography(workstationId)
      .then((res) => {
        if (res.success && res.data) {
          setData(res.data)
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [workstationId])

  if (!workstationId) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs select-none">
      <div className="relative w-full max-w-lg bg-[#101726] border-l border-white/[0.08] shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 font-sans text-white">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
              <Monitor className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-extrabold text-base text-white">
                  {data?.label || 'Workstation Biography'}
                </h3>
                <Badge
                  className={`text-[9px] font-bold ${
                    data?.status === 'operational'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : data?.status === 'under_repair'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  }`}
                >
                  {data?.status || 'loading'}
                </Badge>
              </div>
              <p className="text-xs text-slate-400">
                {data?.row_label || 'Workstation'} &bull; {data?.device_type?.toUpperCase() || 'DESKTOP'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex items-center gap-1 p-2 border-b border-white/5 bg-[#151E32] text-xs font-semibold overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab('issues')}
            className={`px-3 py-1.5 rounded-lg text-center whitespace-nowrap transition-all ${
              activeSubTab === 'issues'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Faults ({data?.issues.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('maintenance')}
            className={`px-3 py-1.5 rounded-lg text-center whitespace-nowrap transition-all ${
              activeSubTab === 'maintenance'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Servicing ({data?.maintenance_history.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('seating')}
            className={`px-3 py-1.5 rounded-lg text-center whitespace-nowrap transition-all ${
              activeSubTab === 'seating'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Baseline ({data?.student_seating_history.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('forensics')}
            className={`px-3 py-1.5 rounded-lg text-center whitespace-nowrap transition-all ${
              activeSubTab === 'forensics'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Usage Timeline ({data?.practical_usage_timeline?.length || 0})
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
              <span className="text-xs">Loading technical biography...</span>
            </div>
          ) : (
            <>
              {/* Tab 1: Issues History */}
              {activeSubTab === 'issues' && (
                <div className="space-y-2.5">
                  {data?.issues.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs">
                      <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                      <span>Zero faults reported for this workstation. Operating nominally!</span>
                    </div>
                  ) : (
                    data?.issues.map((issue) => (
                      <div
                        key={issue.id}
                        className="rounded-xl border border-white/[0.08] bg-[#151E32] p-3 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-heading font-bold text-xs text-white">
                            {issue.title}
                          </span>
                          <Badge
                            className={`text-[9px] ${
                              issue.status === 'resolved'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}
                          >
                            {issue.status}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-slate-400">
                          <span>Reported by: <strong className="text-slate-200">{issue.reported_by_name}</strong></span>
                          {issue.duration_hours !== null && (
                            <span>&bull; MTTR: <strong className="text-amber-300 tabular-nums">{issue.duration_hours}h</strong></span>
                          )}
                        </div>

                        {issue.resolution_notes && (
                          <p className="text-[11px] text-slate-300 bg-white/5 p-2 rounded-lg border border-white/5">
                            Resolution: {issue.resolution_notes}
                          </p>
                        )}

                        <div className="text-[10px] text-slate-500">
                          {new Date(issue.created_at).toLocaleDateString()} &bull; Severity: {issue.severity}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tab 2: Servicing History */}
              {activeSubTab === 'maintenance' && (
                <div className="space-y-2.5">
                  {data?.maintenance_history.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs">
                      <Wrench className="h-8 w-8 text-slate-500 mx-auto mb-2 opacity-50" />
                      <span>No certified individual servicing logs on record.</span>
                    </div>
                  ) : (
                    data?.maintenance_history.map((m) => (
                      <div
                        key={m.log_id}
                        className="rounded-xl border border-white/[0.08] bg-[#151E32] p-3 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-heading font-bold text-xs text-white">
                            {m.plan_title || 'Routine Maintenance'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(m.performed_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300">
                          Technician: <strong className="text-white">{m.performed_by}</strong>
                        </p>
                        {m.observations && (
                          <p className="text-[11px] text-slate-400 italic">
                            &ldquo;{m.observations}&rdquo;
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tab 3: Seating Occupants History */}
              {activeSubTab === 'seating' && (
                <div className="space-y-2.5">
                  {data?.student_seating_history.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs">
                      <Users className="h-8 w-8 text-slate-500 mx-auto mb-2 opacity-50" />
                      <span>No student assigned to this workstation yet.</span>
                    </div>
                  ) : (
                    data?.student_seating_history.map((s, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-white/[0.08] bg-[#151E32] p-3 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-heading font-bold text-xs text-white">
                            {s.student_name}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {s.class_name} &bull; {s.academic_year}
                          </div>
                        </div>
                        <Badge className="bg-indigo-500/10 text-indigo-300 font-mono text-[10px] tabular-nums">
                          Roll {s.roll_number}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tab 4: Practical Session Forensic Usage Timeline */}
              {activeSubTab === 'forensics' && (
                <div className="space-y-2.5">
                  {(!data?.practical_usage_timeline || data.practical_usage_timeline.length === 0) ? (
                    <div className="text-center py-12 text-slate-400 text-xs">
                      <History className="h-8 w-8 text-slate-500 mx-auto mb-2 opacity-50" />
                      <span>No recorded practical session logs for this workstation yet.</span>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Seating snapshots are captured automatically whenever session logs are submitted.
                      </p>
                    </div>
                  ) : (
                    data.practical_usage_timeline.map((u, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-white/[0.08] bg-[#151E32] p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-heading font-bold text-xs text-white">
                              {u.student_name}
                            </span>
                            {u.roll_number != null && (
                              <Badge className="bg-indigo-500/10 text-indigo-300 font-mono text-[9px] tabular-nums">
                                Roll {u.roll_number}
                              </Badge>
                            )}
                            {u.is_override && (
                              <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                                Temp Relocation
                              </span>
                            )}
                          </div>
                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                            u.is_present
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          }`}>
                            {u.is_present ? 'Present' : 'Absent'}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-300 flex items-center justify-between">
                          <span>
                            {u.batch_group} &bull; <strong className="text-white">{u.subject_name}</strong>
                          </span>
                          <span className="text-slate-400 font-mono text-[10px]">
                            {u.date} ({u.period_label})
                          </span>
                        </div>

                        {(u.practical_title || u.topic_learned) && (
                          <div className="text-[10px] text-slate-400 pt-1 border-t border-white/5 truncate">
                            <span className="text-slate-500 font-mono uppercase mr-1">Topic:</span>
                            {u.topic_learned || u.practical_title}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
