'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Monitor,
  CheckCircle2,
  ShieldAlert,
  Wrench,
  AlertTriangle,
  RefreshCw,
  Layers,
  Map,
  Tag,
  Loader2,
  Users,
  GraduationCap,
} from 'lucide-react'
import { WorkstationFloorPlan } from './workstation-floor-plan'
import { WorkstationMobileView } from './workstation-mobile-view'
import { WorkstationIssueDrawer } from './workstation-issue-drawer'
import { CategoryAdminModal } from './category-admin-modal'
import { getWorkstationBoardData } from '@/app/actions/workstations'
import { createClient } from '@/lib/supabase/client'
import type {
  WorkstationBoardData,
  WorkstationWithIssues,
} from '@/types/workstations'

interface WorkstationBoardProps {
  initialData: WorkstationBoardData
}

export function WorkstationBoard({ initialData }: WorkstationBoardProps) {
  const [boardData, setBoardData] = useState<WorkstationBoardData>(initialData)
  const [loading, setLoading] = useState(false)
  const [selectedLabId, setSelectedLabId] = useState<string>(initialData.lab_id || 'comp')

  // Selected workstation for drawer
  const [selectedWorkstation, setSelectedWorkstation] = useState<WorkstationWithIssues | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Taxonomy Modal (Admin)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)

  // View Mode: 'canvas' (2D Floor Plan) vs 'matrix' (Mobile Grid)
  const [mobileCanvasActive, setMobileCanvasActive] = useState(false)

  // Refresh Board Data
  const refreshData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getWorkstationBoardData(selectedLabId)
      setBoardData(data)

      // If drawer is open, keep selected workstation up to date
      if (selectedWorkstation) {
        const updated = data.workstations.find((w) => w.id === selectedWorkstation.id)
        if (updated) setSelectedWorkstation(updated)
      }
    } catch (err) {
      console.error('Failed to refresh workstation telemetry:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedLabId, selectedWorkstation])

  // Workstation Select
  const handleSelectWorkstation = (ws: WorkstationWithIssues) => {
    setSelectedWorkstation(ws)
    setIsDrawerOpen(true)
  }

  // Workstation Select by ID (from Seat Planning modal)
  const handleSelectWorkstationById = (wsId: string) => {
    const ws = boardData.workstations.find((w) => w.id === wsId)
    if (ws) {
      setSelectedWorkstation(ws)
      setIsDrawerOpen(true)
    }
  }

  // Realtime Supabase Subscription
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('workstations-realtime-telemetry')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workstation_issues' },
        () => {
          refreshData()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workstations' },
        () => {
          refreshData()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lab_floor_elements' },
        () => {
          refreshData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [refreshData])

  const { metrics, is_privileged, user_id, user_name } = boardData

  return (
    <div className="space-y-4">
      {/* Top Header & Telemetry KPI Cards */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/[0.08] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-heading font-extrabold text-xl text-white tracking-tight">
              Computer Lab Management
            </h2>
            <span className="rounded-full bg-indigo-500/10 border border-indigo-500/30 px-2.5 py-0.5 text-xs font-semibold text-indigo-400">
              {boardData.lab_name}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Physical room floor map, student seat planning, hardware health diagnostics, and certified service history
          </p>
        </div>

        {/* Action Controls & Sub-Tab Switcher */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Sub-tab Pill Switcher */}
          <div className="flex items-center gap-1 rounded-xl border border-white/[0.08] bg-[#151E32] p-1">
            <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold bg-indigo-600 text-white shadow-xs">
              <Monitor className="h-3.5 w-3.5" />
              <span>Floor Map</span>
            </div>
          </div>

          {is_privileged && (
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-[#151E32] px-3 py-2 text-xs font-semibold text-slate-200 hover:border-indigo-500/40 hover:text-indigo-300 transition-colors cursor-pointer"
            >
              <Tag className="h-3.5 w-3.5" />
              <span>Issue Taxonomy</span>
            </button>
          )}

          <button
            type="button"
            disabled={loading}
            onClick={refreshData}
            className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-[#151E32] px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row (High-Density, Zero Nested Containers) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Total Workstations */}
        <div className="rounded-xl border border-white/[0.08] bg-[#101726] p-3 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                <Monitor className="h-3.5 w-3.5" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Total Stations
              </span>
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-heading text-xl sm:text-2xl font-extrabold text-white tabular-nums">
              {metrics.total}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              In {boardData.lab_name}
            </span>
          </div>
        </div>

        {/* Operational Ready */}
        <div className="rounded-xl border border-white/[0.08] bg-[#101726] p-3 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Operational
              </span>
            </div>
            <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
              Ready
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-heading text-xl sm:text-2xl font-extrabold text-emerald-400 tabular-nums">
              {metrics.operational}
            </span>
            <span className="text-[10px] text-slate-500">
              {metrics.total > 0 ? `${Math.round((metrics.operational / metrics.total) * 100)}% Health` : '0%'}
            </span>
          </div>
        </div>

        {/* Flagged / Open Issues */}
        <div className="rounded-xl border border-white/[0.08] bg-[#101726] p-3 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400">
                <ShieldAlert className="h-3.5 w-3.5" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Flagged Faults
              </span>
            </div>
            {metrics.flagged > 0 && (
              <span className="rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold text-rose-400 animate-pulse">
                Action Req.
              </span>
            )}
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-heading text-xl sm:text-2xl font-extrabold text-rose-400 tabular-nums">
              {metrics.flagged}
            </span>
            <span className="text-[10px] text-slate-500">
              {metrics.open_issues_count} Ticket{metrics.open_issues_count !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Under Repair */}
        <div className="rounded-xl border border-white/[0.08] bg-[#101726] p-3 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                <Wrench className="h-3.5 w-3.5" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Under Repair
              </span>
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-heading text-xl sm:text-2xl font-extrabold text-blue-400 tabular-nums">
              {metrics.under_repair}
            </span>
            <span className="text-[10px] text-slate-500">
              In Service
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Area: Visual Floor Map */}
      <div>
        {/* Desktop View (Hidden on sm, shown on md and larger) */}
        <div className="hidden md:block">
          <WorkstationFloorPlan
            workstations={boardData.workstations}
            categories={boardData.categories}
            floorElements={boardData.floor_elements || []}
            labId={boardData.lab_id}
            labName={boardData.lab_name}
            isPrivileged={is_privileged}
            onSelectWorkstation={handleSelectWorkstation}
            onRefreshData={refreshData}
          />
        </div>

          {/* Mobile View (Shown on small screens, with optional toggle to floor map) */}
          <div className="block md:hidden">
            {mobileCanvasActive ? (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setMobileCanvasActive(false)}
                    className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-[#151E32] px-3 py-1.5 text-xs font-semibold text-slate-300"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    <span>Switch to Compact Grid</span>
                  </button>
                </div>
                <WorkstationFloorPlan
                  workstations={boardData.workstations}
                  categories={boardData.categories}
                  floorElements={boardData.floor_elements || []}
                  labId={boardData.lab_id}
                  labName={boardData.lab_name}
                  isPrivileged={is_privileged}
                  onSelectWorkstation={handleSelectWorkstation}
                  onRefreshData={refreshData}
                />
              </div>
            ) : (
              <WorkstationMobileView
                workstations={boardData.workstations}
                onSelectWorkstation={handleSelectWorkstation}
                onToggleCanvasMode={() => setMobileCanvasActive(true)}
                isCanvasModeActive={mobileCanvasActive}
              />
            )}
          </div>
        </div>

      {/* Slide-over Inspection & Problem Reporting Drawer */}
      <WorkstationIssueDrawer
        workstation={selectedWorkstation}
        categories={boardData.categories}
        isPrivileged={is_privileged}
        currentUserId={user_id}
        currentUserName={user_name}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSuccess={refreshData}
      />

      {/* Admin Taxonomy Modal */}
      {is_privileged && (
        <CategoryAdminModal
          categories={boardData.categories}
          isOpen={isCategoryModalOpen}
          onClose={() => setIsCategoryModalOpen(false)}
          onSuccess={refreshData}
        />
      )}
    </div>
  )
}
