'use client'

import React, { useState, useEffect } from 'react'
import {
  Search,
  RotateCcw,
  Building2,
  AlertTriangle,
  Activity,
  Calendar,
  Wrench,
  Filter,
} from 'lucide-react'
import { IncidentRecordFilters } from '@/types/records'
import { Button } from '@/components/ui/button'
import { NepaliDatePicker } from '@/components/ui/nepali-date-picker'

interface IncidentFilterBarProps {
  filters: IncidentRecordFilters
  onFiltersChange: (newFilters: IncidentRecordFilters) => void
  onReset: () => void
  labs: Array<{ id: string; name: string }>
  academicYears?: Array<{ id: string; name: string; isCurrent: boolean }>
}

export default function IncidentFilterBar({
  filters,
  onFiltersChange,
  onReset,
  labs,
  academicYears,
}: IncidentFilterBarProps) {
  // Local draft state for coarse scope filtering — commits on search or select change
  const [draftFilters, setDraftFilters] = useState<IncidentRecordFilters>(filters)

  useEffect(() => {
    setDraftFilters(filters)
  }, [filters])

  const handleDraftChange = (field: keyof IncidentRecordFilters, val: any, autoApply = false) => {
    const updated = {
      ...draftFilters,
      [field]: val,
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
    const clean: IncidentRecordFilters = {
      academic_year_id: 'all',
      lab_id: 'all',
      severity: 'all',
      status: 'all',
      incident_type: 'all',
      date_from: '',
      date_to: '',
      equipment_name: '',
      title: '',
      search: '',
      page: 1,
    }
    setDraftFilters(clean)
    onReset()
  }

  return (
    <form
      onSubmit={handleApplySearch}
      className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 p-4 space-y-3.5 shadow-xs font-sans"
    >
      {/* Top Row: Scope Filter Title + Action Buttons */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-zinc-100 dark:border-zinc-800/80">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <Filter className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 font-heading">
              Incident Scope Filters
            </h3>
            <p className="text-[11px] text-subtext text-zinc-500 dark:text-slate-300 font-sans">
              Filter by lab, severity, status, or date.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
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
            className="h-8 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-sans text-xs font-semibold gap-1.5 shadow-xs border border-indigo-500/30 cursor-pointer"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search</span>
          </Button>
        </div>
      </div>

      {/* Filter Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-xs">
        {/* 1. Academic Year */}
        <div className="space-y-1">
          <label className="text-[11px] font-mono uppercase text-zinc-600 dark:text-slate-300 font-bold flex items-center gap-1">
            <Calendar className="h-3 w-3 text-indigo-500" /> Academic Year
          </label>
          <select
            value={draftFilters.academic_year_id || 'all'}
            onChange={(e) => handleDraftChange('academic_year_id', e.target.value, true)}
            className="w-full h-8 px-2 bg-zinc-50/80 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-medium text-zinc-900 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer"
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

        {/* 2. Facility */}
        <div className="space-y-1">
          <label className="text-[11px] font-mono uppercase text-zinc-600 dark:text-slate-300 font-bold flex items-center gap-1">
            <Building2 className="h-3 w-3" /> Facility
          </label>
          <select
            value={draftFilters.lab_id || 'all'}
            onChange={(e) => handleDraftChange('lab_id', e.target.value, true)}
            className="w-full h-8 px-2 bg-zinc-50/80 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-medium text-zinc-900 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="all">All Laboratories</option>
            {labs.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        {/* 3. Severity */}
        <div className="space-y-1">
          <label className="text-[11px] font-mono uppercase text-zinc-600 dark:text-slate-300 font-bold flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Severity
          </label>
          <select
            value={draftFilters.severity || 'all'}
            onChange={(e) => handleDraftChange('severity', e.target.value, true)}
            className="w-full h-8 px-2 bg-zinc-50/80 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-medium text-zinc-900 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="all">All Severities</option>
            <option value="minor">Minor</option>
            <option value="moderate">Moderate</option>
            <option value="major_critical">Major / Critical</option>
          </select>
        </div>

        {/* 4. Status */}
        <div className="space-y-1">
          <label className="text-[11px] font-mono uppercase text-zinc-600 dark:text-slate-300 font-bold flex items-center gap-1">
            <Activity className="h-3 w-3" /> Status
          </label>
          <select
            value={draftFilters.status || 'all'}
            onChange={(e) => handleDraftChange('status', e.target.value, true)}
            className="w-full h-8 px-2 bg-zinc-50/80 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-medium text-zinc-900 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="reported">Reported</option>
            <option value="escalated_to_hod">Escalated to HOD</option>
            <option value="under_repair">Under Repair</option>
            <option value="replaced">Replaced</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        {/* 5. Date From */}
        <div className="space-y-1">
          <label className="text-[11px] font-mono uppercase text-zinc-600 dark:text-slate-300 font-bold flex items-center gap-1">
            <Calendar className="h-3 w-3" /> मिति देखि (Date From)
          </label>
          <NepaliDatePicker
            value={draftFilters.date_from || ''}
            onChange={(d) => handleDraftChange('date_from', d)}
            placeholder="सुरु मिति / From"
          />
        </div>

        {/* 6. Date To */}
        <div className="space-y-1">
          <label className="text-[11px] font-mono uppercase text-zinc-600 dark:text-slate-300 font-bold flex items-center gap-1">
            <Calendar className="h-3 w-3" /> मिति सम्म (Date To)
          </label>
          <NepaliDatePicker
            value={draftFilters.date_to || ''}
            onChange={(d) => handleDraftChange('date_to', d)}
            placeholder="अन्त्य मिति / To"
            align="right"
          />
        </div>
      </div>
    </form>
  )
}
