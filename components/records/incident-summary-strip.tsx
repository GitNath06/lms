'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { IncidentSummaryMetrics } from '@/types/records'
import { AlertTriangle, Clock, ShieldAlert, CheckCircle2, ClipboardList } from 'lucide-react'

interface IncidentSummaryStripProps {
  metrics: IncidentSummaryMetrics
  isLoading?: boolean
}

export default function IncidentSummaryStrip({ metrics, isLoading = false }: IncidentSummaryStripProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-sans">
      {/* 1. Total Incidents */}
      <Card className="hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Total Incidents
            </p>
            <div className="flex items-baseline gap-2">
              {isLoading ? (
                <span className="inline-block h-7 w-12 rounded-md bg-zinc-200 dark:bg-zinc-800 animate-pulse my-0.5" />
              ) : (
                <span className="text-2xl font-bold font-mono text-zinc-950 dark:text-white">
                  {metrics.totalIncidents}
                </span>
              )}
              <span className="text-[11px] text-zinc-500 font-sans">
                {isLoading ? '...' : `(${metrics.openCount} unresolved)`}
              </span>
            </div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <ClipboardList className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      {/* 2. Critical & Escalated */}
      <Card className="hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Critical & Escalated
            </p>
            <div className="flex items-baseline gap-2">
              {isLoading ? (
                <span className="inline-block h-7 w-12 rounded-md bg-zinc-200 dark:bg-zinc-800 animate-pulse my-0.5" />
              ) : (
                <span
                  className={`text-2xl font-bold font-mono ${
                    metrics.criticalCount > 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-zinc-950 dark:text-white'
                  }`}
                >
                  {metrics.criticalCount}
                </span>
              )}
              <span
                className={`text-[11px] font-mono font-medium ${
                  metrics.escalatedCount > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                {isLoading ? '...' : `(${metrics.escalatedCount} to HOD)`}
              </span>
            </div>
          </div>
          <div
            className={`h-10 w-10 rounded-xl flex items-center justify-center ${
              metrics.criticalCount > 0
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
            }`}
          >
            <ShieldAlert className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      {/* 3. Certified Resolved */}
      <Card className="hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Resolved & Replaced
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {metrics.resolvedCount}
              </span>
              <span className="text-[11px] text-zinc-500 font-sans">
                ({metrics.underRepairCount} in repair)
              </span>
            </div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      {/* 4. Average Time-to-Resolve */}
      <Card className="hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Avg Time-to-Resolve
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400">
                {metrics.averageTimeToResolveLabel}
              </span>
              <span className="text-[11px] text-zinc-500 font-sans">response speed</span>
            </div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Clock className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
