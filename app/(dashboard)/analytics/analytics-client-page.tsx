'use client'

import React, { useState } from 'react'
import {
  BarChart3,
  Users,
  BookOpen,
  ShieldCheck,
  Building2,
  Monitor,
  Sparkles,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { StudentComplianceTab } from '@/components/analytics/student-compliance-tab'
import { SyllabusProgressTab } from '@/components/analytics/syllabus-progress-tab'
import { FacultyActivityTab } from '@/components/analytics/faculty-activity-tab'
import { LabOccupancyTab } from '@/components/analytics/lab-occupancy-tab'
import { WorkstationReliabilityTab } from '@/components/analytics/workstation-reliability-tab'

interface AnalyticsClientPageProps {
  classes: Array<{ id: string; name: string }>
  academicYears: Array<{ id: string; name: string }>
}

export type AnalyticsTabKey =
  | 'compliance'
  | 'syllabus'
  | 'faculty'
  | 'occupancy'
  | 'reliability'

export function AnalyticsClientPage({
  classes,
  academicYears,
}: AnalyticsClientPageProps) {
  const [activeTab, setActiveTab] = useState<AnalyticsTabKey>('compliance')

  const tabs = [
    {
      id: 'compliance' as const,
      label: 'NEB Board Compliance',
      icon: Users,
    },
    {
      id: 'syllabus' as const,
      label: 'Syllabus Progress',
      icon: BookOpen,
    },
    {
      id: 'faculty' as const,
      label: 'Faculty Operations',
      icon: ShieldCheck,
    },
    {
      id: 'occupancy' as const,
      label: 'Lab Occupancy',
      icon: Building2,
    },
    {
      id: 'reliability' as const,
      label: 'Workstation MTTR',
      icon: Monitor,
    },
  ]

  return (
    <div className="space-y-5 font-sans text-zinc-900 dark:text-zinc-100">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
              <BarChart3 className="h-4 w-4" />
            </span>
            <h1 className="font-heading font-extrabold text-xl sm:text-2xl text-zinc-950 dark:text-white tracking-tight">
              Institutional Intelligence &amp; Canonical Reports
            </h1>
            <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[10px] font-bold">
              Canonical Engine
            </Badge>
          </div>
          <p className="text-xs text-zinc-500 dark:text-slate-400 mt-1">
            Database-backed practical compliance, curriculum completion, dual sign-off audits, lab occupancy, and hardware MTTR
          </p>
        </div>
      </div>

      {/* Primary Tab Navigation Strip */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-[#151E32] border border-zinc-200 dark:border-white/[0.08] overflow-x-auto select-none">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-zinc-600 dark:text-slate-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200/60 dark:hover:bg-white/5'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'compliance' && (
          <StudentComplianceTab
            classes={classes}
            academicYears={academicYears}
          />
        )}
        {activeTab === 'syllabus' && (
          <SyllabusProgressTab classes={classes} />
        )}
        {activeTab === 'faculty' && <FacultyActivityTab />}
        {activeTab === 'occupancy' && <LabOccupancyTab />}
        {activeTab === 'reliability' && <WorkstationReliabilityTab />}
      </div>
    </div>
  )
}
