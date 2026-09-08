'use client'

import React from 'react'
import {
  Search,
  RotateCcw,
  Building2,
  AlertTriangle,
  Activity,
  Calendar,
  Wrench,
  Shield,
} from 'lucide-react'
import { IncidentRecordFilters } from '@/types/records'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface IncidentFilterBarProps {
  filters: IncidentRecordFilters
  onFiltersChange: (newFilters: IncidentRecordFilters) => void
  onReset: () => void
  labs: Array<{ id: string; name: string }>
}

export default function IncidentFilterBar({
  filters,
  onFiltersChange,
  onReset,
  labs,
}: IncidentFilterBarProps) {
  const handleChange = (field: keyof IncidentRecordFilters, val: any) => {
    onFiltersChange({
      ...filters,
      [field]: val,
    })
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 p-4 space-y-3 shadow-xs font-sans">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            placeholder="Search incident title, apparatus name, student roll or notes..."
            value={filters.search || ''}
            onChange={(e) => handleChange('search', e.target.value)}
            className="pl-9 bg-zinc-50/70 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 rounded-xl text-xs h-9"
          />
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

      {/* Filter Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-xs">
        {/* 1. Facility */}
        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase text-zinc-400 font-medium flex items-center gap-1">
            <Building2 className="h-3 w-3" /> Facility
          </label>
          <select
            value={filters.lab_id || 'all'}
            onChange={(e) => handleChange('lab_id', e.target.value)}
            className="w-full h-8 px-2 bg-zinc-50/80 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-medium text-zinc-900 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-rose-500"
          >
            <option value="all">All Laboratories</option>
            {labs.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        {/* 2. Severity */}
        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase text-zinc-400 font-medium flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Severity
          </label>
          <select
            value={filters.severity || 'all'}
            onChange={(e) => handleChange('severity', e.target.value)}
            className="w-full h-8 px-2 bg-zinc-50/80 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-medium text-zinc-900 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-rose-500"
          >
            <option value="all">All Severities</option>
            <option value="minor">Minor (Low impact)</option>
            <option value="moderate">Moderate (Broken glassware)</option>
            <option value="major_critical">Major Critical (Surge / Hazard)</option>
          </select>
        </div>

        {/* 3. Status */}
        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase text-zinc-400 font-medium flex items-center gap-1">
            <Activity className="h-3 w-3" /> Lifecycle Status
          </label>
          <select
            value={filters.status || 'all'}
            onChange={(e) => handleChange('status', e.target.value)}
            className="w-full h-8 px-2 bg-zinc-50/80 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-medium text-zinc-900 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-rose-500"
          >
            <option value="all">All Statuses</option>
            <option value="reported">Reported (Pending)</option>
            <option value="escalated_to_hod">Escalated to HOD</option>
            <option value="under_repair">Under Repair</option>
            <option value="replaced">Replaced</option>
            <option value="resolved">Certified Resolved</option>
          </select>
        </div>

        {/* 4. Incident Type */}
        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase text-zinc-400 font-medium flex items-center gap-1">
            <Wrench className="h-3 w-3" /> Incident Type
          </label>
          <select
            value={filters.incident_type || 'all'}
            onChange={(e) => handleChange('incident_type', e.target.value)}
            className="w-full h-8 px-2 bg-zinc-50/80 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-medium text-zinc-900 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-rose-500"
          >
            <option value="all">All Types</option>
            <option value="breakage">Apparatus Breakage</option>
            <option value="burnt_apparatus">Burnt / Short Circuit</option>
            <option value="malfunction">Technical Malfunction</option>
            <option value="chemical_hazard">Chemical Hazard</option>
            <option value="missing">Missing Equipment</option>
            <option value="other">Other Incident</option>
          </select>
        </div>

        {/* 5. Date From */}
        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase text-zinc-400 font-medium flex items-center gap-1">
            <Calendar className="h-3 w-3" /> Date From
          </label>
          <input
            type="date"
            value={filters.date_from || ''}
            onChange={(e) => handleChange('date_from', e.target.value)}
            className="w-full h-8 px-2 bg-zinc-50/80 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-mono text-zinc-900 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-rose-500"
          />
        </div>

        {/* 6. Date To */}
        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase text-zinc-400 font-medium flex items-center gap-1">
            <Calendar className="h-3 w-3" /> Date To
          </label>
          <input
            type="date"
            value={filters.date_to || ''}
            onChange={(e) => handleChange('date_to', e.target.value)}
            className="w-full h-8 px-2 bg-zinc-50/80 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-mono text-zinc-900 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-rose-500"
          />
        </div>
      </div>
    </div>
  )
}
