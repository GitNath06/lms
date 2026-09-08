'use client'

import React from 'react'
import {
  Filter,
  RotateCcw,
  Search,
  Layers,
  Building2,
  BookOpen,
  Users,
  Clock,
  Calendar,
  GraduationCap,
} from 'lucide-react'
import { PracticalRecordFilters, PracticalGroupingKey } from '@/types/records'
import { getCascadingOptions } from '@/lib/context/cascading-filters'
import { UserScopeContext } from '@/lib/context/user-scope'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface PracticalFilterBarProps {
  filters: PracticalRecordFilters
  groupBy: PracticalGroupingKey
  onFiltersChange: (newFilters: PracticalRecordFilters) => void
  onGroupByChange: (newGroupBy: PracticalGroupingKey) => void
  onReset: () => void
  labs: Array<{ id: string; name: string }>
  teachers: Array<{ id: string; full_name: string }>
  userRole: string
  userName?: string
  userScope?: UserScopeContext
}

export default function PracticalFilterBar({
  filters,
  groupBy,
  onFiltersChange,
  onGroupByChange,
  onReset,
  labs,
  teachers,
  userRole,
  userName,
  userScope,
}: PracticalFilterBarProps) {
  const isPrivileged = ['super_admin', 'lab_incharge', 'hod', 'admin'].includes(userRole)

  // Dynamic context-first cascading options
  const cascading = React.useMemo(() => {
    const scope: UserScopeContext = userScope || {
      userId: '',
      fullName: userName || 'Faculty',
      email: '',
      role: (userRole as any) || 'teacher',
      department: '',
      isPrivileged,
      isTeacher: !isPrivileged,
      assignedLabIds: labs.map((l) => l.id),
      assignedClasses: [],
      assignedSubjects: [],
      defaultViewMode: isPrivileged ? 'institutional' : 'my_data',
      teacherProfile: null,
    }
    return getCascadingOptions(scope, {
      labId: filters.lab_id,
      classBatch: filters.batch_group,
      subjectCode: filters.subject_name,
      teacherId: filters.teacher_id,
    })
  }, [userScope, userName, userRole, isPrivileged, filters.lab_id, filters.batch_group, filters.subject_name, filters.teacher_id, labs])

  const handleFieldChange = (field: keyof PracticalRecordFilters, value: any) => {
    onFiltersChange({
      ...filters,
      [field]: value,
    })
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 p-4 space-y-4 shadow-xs font-sans">
      {/* Top Bar: Search + Group By Selector + Reset Button */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            placeholder="Search experiments, topics, batches or remarks..."
            value={filters.search || ''}
            onChange={(e) => handleFieldChange('search', e.target.value)}
            className="pl-9 bg-zinc-50/70 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 rounded-xl text-xs h-9"
          />
        </div>

        {/* Group By Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 text-xs font-medium text-indigo-900 dark:text-indigo-200">
            <Layers className="h-3.5 w-3.5 text-indigo-500" />
            <span className="font-mono text-[11px] uppercase font-bold">Group By:</span>
            <select
              value={groupBy}
              onChange={(e) => onGroupByChange(e.target.value as PracticalGroupingKey)}
              className="bg-transparent font-bold text-indigo-700 dark:text-indigo-300 focus:outline-hidden cursor-pointer text-xs"
            >
              <option value="none" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">None (Flat List)</option>
              <option value="batch_group" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">Class / Batch</option>
              <option value="subject_name" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">Subject</option>
              <option value="teacher" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">Subject Teacher</option>
              <option value="period_label" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">Period / Slot</option>
            </select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            className="h-9 px-3 rounded-xl text-xs font-mono border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset</span>
          </Button>
        </div>
      </div>

      {/* Multi-Dimensional Filter Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-xs">
        {/* 1. Facility / Laboratory */}
        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase text-zinc-400 font-medium flex items-center gap-1">
            <Building2 className="h-3 w-3" /> Facility
          </label>
          <select
            value={filters.lab_id || 'all'}
            onChange={(e) => handleFieldChange('lab_id', e.target.value)}
            className="w-full h-8 px-2.5 bg-zinc-50/80 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-medium text-zinc-900 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="all">All Facilities ({cascading.validLabs.length})</option>
            {cascading.validLabs.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        {/* 2. Class / Batch */}
        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase text-zinc-400 font-medium flex items-center gap-1">
            <GraduationCap className="h-3 w-3" /> Class / Batch
          </label>
          <select
            value={filters.batch_group || 'all'}
            onChange={(e) => handleFieldChange('batch_group', e.target.value)}
            className="w-full h-8 px-2.5 bg-zinc-50/80 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-medium text-zinc-900 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="all">All Classes ({cascading.validClasses.length})</option>
            {cascading.validClasses.map((c) => (
              <option key={c.name} value={c.name}>{c.name} — {c.fullName || c.name}</option>
            ))}
          </select>
        </div>

        {/* 3. Subject */}
        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase text-zinc-400 font-medium flex items-center gap-1">
            <BookOpen className="h-3 w-3" /> Subject
          </label>
          <select
            value={filters.subject_name || 'all'}
            onChange={(e) => handleFieldChange('subject_name', e.target.value)}
            className="w-full h-8 px-2.5 bg-zinc-50/80 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-medium text-zinc-900 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="all">All Subjects ({cascading.validSubjects.length})</option>
            {cascading.validSubjects.map((s) => (
              <option key={s.code} value={s.code}>{s.code} — {s.title} ({s.labName || s.labId})</option>
            ))}
          </select>
        </div>

        {/* 4. Supervising Subject Teacher (Role Restricted) */}
        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase text-zinc-400 font-medium flex items-center gap-1">
            <Users className="h-3 w-3" /> Subject Teacher
          </label>
          {isPrivileged ? (
            <select
              value={filters.teacher_id || 'all'}
              onChange={(e) => handleFieldChange('teacher_id', e.target.value)}
              className="w-full h-8 px-2.5 bg-zinc-50/80 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-medium text-zinc-900 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">All Subject Teachers ({cascading.validTeachers.length})</option>
              {cascading.validTeachers.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          ) : (
            <div className="w-full h-8 px-2.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-300 flex items-center justify-between">
              <span className="truncate">{userName || 'My Certified Records'}</span>
              <Badge className="text-[9px] px-1 py-0 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20">
                Self
              </Badge>
            </div>
          )}
        </div>

        {/* 5. Date From */}
        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase text-zinc-400 font-medium flex items-center gap-1">
            <Calendar className="h-3 w-3" /> From Date
          </label>
          <input
            type="date"
            value={filters.date_from || ''}
            onChange={(e) => handleFieldChange('date_from', e.target.value)}
            className="w-full h-8 px-2 bg-zinc-50/80 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-mono text-zinc-900 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* 6. Date To */}
        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase text-zinc-400 font-medium flex items-center gap-1">
            <Calendar className="h-3 w-3" /> To Date
          </label>
          <input
            type="date"
            value={filters.date_to || ''}
            onChange={(e) => handleFieldChange('date_to', e.target.value)}
            className="w-full h-8 px-2 bg-zinc-50/80 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-mono text-zinc-900 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>
    </div>
  )
}
