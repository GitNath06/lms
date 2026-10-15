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
  CheckCircle2,
} from 'lucide-react'
import { PracticalRecordFilters, PracticalGroupingKey } from '@/types/records'
import { getCascadingOptions } from '@/lib/context/cascading-filters'
import { UserScopeContext } from '@/lib/context/user-scope'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useInfrastructureState } from '@/hooks/use-infrastructure-state'
import { NepaliDatePicker } from '@/components/ui/nepali-date-picker'

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
  academicYears?: Array<{ id: string; name: string; isCurrent: boolean }>
  activeAcademicYearId?: string | null
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
  academicYears = [],
  activeAcademicYearId,
}: PracticalFilterBarProps) {
  const isPrivileged = ['super_admin', 'lab_incharge', 'hod', 'admin'].includes(userRole)
  const { classes: infraClasses, subjects: infraSubjects, faculty: infraFaculty, labs: infraLabs } = useInfrastructureState()

  // Dynamic context-first cascading options using live infrastructure state
  const cascading = React.useMemo(() => {
    const activeLabs = (infraLabs && infraLabs.length > 0) ? infraLabs : labs
    const scope: UserScopeContext = userScope || {
      userId: '',
      fullName: userName || 'Faculty',
      email: '',
      role: (userRole as any) || 'teacher',
      department: '',
      isPrivileged,
      isTeacher: !isPrivileged,
      assignedLabIds: activeLabs.map((l) => l.id),
      assignedClasses: [],
      assignedSubjects: [],
      defaultViewMode: isPrivileged ? 'institutional' : 'my_data',
      teacherProfile: null,
    }
    return getCascadingOptions(
      scope,
      {
        labId: filters.lab_id,
        classBatch: filters.batch_group,
        subjectCode: filters.subject_name,
        teacherId: filters.teacher_id,
      },
      {
        classes: infraClasses,
        subjects: infraSubjects,
        labs: activeLabs,
        teachers: (infraFaculty && infraFaculty.length > 0)
          ? infraFaculty.map((f) => ({ id: f.id, name: f.name, email: f.email }))
          : teachers.map((t) => ({ id: t.id, name: t.full_name })),
      }
    )
  }, [
    userScope,
    userName,
    userRole,
    isPrivileged,
    filters.lab_id,
    filters.batch_group,
    filters.subject_name,
    filters.teacher_id,
    labs,
    teachers,
    infraClasses,
    infraSubjects,
    infraFaculty,
    infraLabs,
  ])

  // Local draft state for coarse scope filtering — only commits when SEARCH is clicked
  const [draftFilters, setDraftFilters] = React.useState<PracticalRecordFilters>(filters)

  // Keep draft in sync if external filters change (e.g. on reset or URL popstate)
  React.useEffect(() => {
    setDraftFilters(filters)
  }, [filters])

  const handleDraftChange = (field: keyof PracticalRecordFilters, value: any, autoApply = false) => {
    const updated = {
      ...draftFilters,
      [field]: value,
    }
    setDraftFilters(updated)
    if (autoApply) {
      onFiltersChange({
        ...updated,
        page: 1,
      })
    }
  }

  const handleApplySearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    onFiltersChange({
      ...draftFilters,
      page: 1, // Reset to page 1 on search commit
    })
  }

  const handleReset = () => {
    setDraftFilters({
      academic_year_id: 'all',
      lab_id: 'all',
      batch_group: 'all',
      subject_name: 'all',
      teacher_id: 'all',
      status: 'all',
      search: '',
      date_from: '',
      date_to: '',
      page: 1,
    })
    onReset()
  }

  return (
    <form
      onSubmit={handleApplySearch}
      className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-3.5 shadow-[0_1px_3px_0_rgba(0,0,0,0.06),0_1px_2px_-1px_rgba(0,0,0,0.06)] font-sans"
    >
      {/* Top Row: Scope Filter Title + Group By + Action Buttons */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-zinc-100 dark:border-zinc-800/80">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Filter className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 font-heading">
              Institutional Scope Filters
            </h3>
            <p className="text-[11px] text-subtext text-zinc-500 dark:text-slate-300 font-sans">
              Filter by lab, class, subject, or date.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Group By Selector */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-800 dark:text-zinc-200">
            <Layers className="h-3.5 w-3.5 text-zinc-500 dark:text-slate-400" />
            <span className="font-mono text-[11px] uppercase font-bold text-zinc-600 dark:text-slate-300">Group:</span>
            <select
              value={groupBy}
              onChange={(e) => onGroupByChange(e.target.value as PracticalGroupingKey)}
              className="bg-transparent font-medium text-zinc-900 dark:text-white focus:outline-hidden cursor-pointer text-xs"
            >
              <option value="none" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">None (Flat)</option>
              <option value="batch_group" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">Class</option>
              <option value="subject_name" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">Subject</option>
              <option value="teacher" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">Teacher</option>
              <option value="period_label" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">Period</option>
            </select>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="h-8 px-2.5 rounded-xl text-xs font-mono border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 gap-1.5"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset</span>
          </Button>

          <Button
            type="submit"
            size="sm"
            className="h-8 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-sans text-xs font-semibold gap-1.5 shadow-xs border border-emerald-500/30 cursor-pointer"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search</span>
          </Button>
        </div>
      </div>

      {/* Multi-Dimensional Filter Grid (8-Slot Unified Scope Grid) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-xs">
        {/* 1. Academic Year */}
        <div className="space-y-1">
          <label className="text-[11px] font-mono uppercase text-zinc-600 dark:text-slate-300 font-bold flex items-center gap-1">
            <Calendar className="h-3 w-3 text-indigo-500" /> Academic Year
          </label>
          <select
            value={draftFilters.academic_year_id || 'all'}
            onChange={(e) => handleDraftChange('academic_year_id', e.target.value, true)}
            className="w-full h-8 px-2 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-300/80 dark:border-zinc-800 rounded-lg text-xs font-medium text-zinc-900 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer truncate"
          >
            <option value="all">All Academic Cycles</option>
            {academicYears && academicYears.length > 0 ? (
              academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>
                  {ay.name} {ay.isCurrent ? '• Active' : '• Archived'}
                </option>
              ))
            ) : (
              <>
                <option value="2084">2084/85 • Active</option>
                <option value="2083">2083/84 • Archived</option>
              </>
            )}
          </select>
        </div>

        {/* 2. Facility / Laboratory */}
        <div className="space-y-1">
          <label className="text-[11px] font-mono uppercase text-zinc-600 dark:text-slate-300 font-bold flex items-center gap-1">
            <Building2 className="h-3 w-3" /> Facility
          </label>
          <select
            value={draftFilters.lab_id || 'all'}
            onChange={(e) => handleDraftChange('lab_id', e.target.value, true)}
            className="w-full h-8 px-2 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-300/80 dark:border-zinc-800 rounded-lg text-xs font-medium text-zinc-900 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 cursor-pointer truncate"
          >
            <option value="all">All Facilities ({cascading.validLabs.length})</option>
            {cascading.validLabs.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        {/* 3. Class */}
        <div className="space-y-1">
          <label className="text-[11px] font-mono uppercase text-zinc-600 dark:text-slate-300 font-bold flex items-center gap-1">
            <GraduationCap className="h-3 w-3" /> Class
          </label>
          <select
            value={draftFilters.batch_group || 'all'}
            onChange={(e) => handleDraftChange('batch_group', e.target.value, true)}
            className="w-full h-8 px-2 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-300/80 dark:border-zinc-800 rounded-lg text-xs font-medium text-zinc-900 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 cursor-pointer truncate"
          >
            <option value="all">All Classes ({cascading.validClasses.length})</option>
            {cascading.validClasses.map((c) => (
              <option key={c.name} value={c.name}>{c.name} — {c.fullName || c.name}</option>
            ))}
          </select>
        </div>

        {/* 4. Subject */}
        <div className="space-y-1">
          <label className="text-[11px] font-mono uppercase text-zinc-600 dark:text-slate-300 font-bold flex items-center gap-1">
            <BookOpen className="h-3 w-3" /> Subject
          </label>
          <select
            value={draftFilters.subject_name || 'all'}
            onChange={(e) => handleDraftChange('subject_name', e.target.value, true)}
            className="w-full h-8 px-2 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-300/80 dark:border-zinc-800 rounded-lg text-xs font-medium text-zinc-900 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 cursor-pointer truncate"
          >
            <option value="all">All Subjects ({cascading.validSubjects.length})</option>
            {cascading.validSubjects.map((s) => (
              <option key={s.code} value={s.code}>{s.code} — {s.title}</option>
            ))}
          </select>
        </div>

        {/* 5. Teacher */}
        <div className="space-y-1">
          <label className="text-[11px] font-mono uppercase text-zinc-600 dark:text-slate-300 font-bold flex items-center gap-1">
            <Users className="h-3 w-3" /> Teacher
          </label>
          <select
            value={draftFilters.teacher_id || 'all'}
            onChange={(e) => handleDraftChange('teacher_id', e.target.value, true)}
            className="w-full h-8 px-2 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-300/80 dark:border-zinc-800 rounded-lg text-xs font-medium text-zinc-900 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 cursor-pointer truncate"
          >
            <option value="all">All Teachers ({cascading.validTeachers.length})</option>
            {cascading.validTeachers.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {/* 6. Status */}
        <div className="space-y-1">
          <label className="text-[11px] font-mono uppercase text-zinc-600 dark:text-slate-300 font-bold flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Status
          </label>
          <select
            value={draftFilters.status || 'all'}
            onChange={(e) => handleDraftChange('status', e.target.value, true)}
            className="w-full h-8 px-2 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-300/80 dark:border-zinc-800 rounded-lg text-xs font-medium text-zinc-900 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 cursor-pointer truncate"
          >
            <option value="all">All Statuses</option>
            <option value="conducted">Conducted</option>
            <option value="skipped">Skipped</option>
          </select>
        </div>

        {/* 7. Date From */}
        <div className="space-y-1">
          <label className="text-[11px] font-mono uppercase text-zinc-600 dark:text-slate-300 font-bold flex items-center gap-1">
            <Calendar className="h-3 w-3" /> मिति देखि (From Date)
          </label>
          <NepaliDatePicker
            value={draftFilters.date_from || ''}
            onChange={(d) => handleDraftChange('date_from', d)}
            placeholder="सुरु मिति / From Date"
          />
        </div>

        {/* 8. Date To */}
        <div className="space-y-1">
          <label className="text-[11px] font-mono uppercase text-zinc-600 dark:text-slate-300 font-bold flex items-center gap-1">
            <Calendar className="h-3 w-3" /> मिति सम्म (To Date)
          </label>
          <NepaliDatePicker
            value={draftFilters.date_to || ''}
            onChange={(d) => handleDraftChange('date_to', d)}
            placeholder="अन्त्य मिति / To Date"
            align="right"
          />
        </div>
      </div>
    </form>
  )
}
