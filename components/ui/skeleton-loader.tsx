import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * 1:1 Layout-True Skeletons for LabSync LIMS (Zero Cumulative Layout Shift)
 * Shared between Next.js loading.tsx route boundaries AND client workspace initial mount.
 */

// ============================================================================
// 1. DASHBOARD OVERVIEW SKELETON (Exact 8/4 Continuous Command Center)
// ============================================================================
export function DashboardSkeleton() {
  return (
    <div className="space-y-3.5 sm:space-y-4 w-full select-none pb-12 animate-in fade-in duration-150">
      {/* 1. Greeting Line Placeholder */}
      <div className="pt-1 pb-0.5">
        <Skeleton className="h-9 sm:h-10 w-64 sm:w-80 rounded-xl" />
      </div>

      {/* 2. Main 2-Column Command Center (lg:grid-cols-12) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 items-start">
        {/* LEFT COLUMN (8 Cols): Operations, Cockpit & Session Feed */}
        <div className="lg:col-span-8 space-y-3.5 sm:space-y-4">
          {/* A. 3 Standalone KPI Cards (Exact 76px Height) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl sm:rounded-2xl border border-zinc-200/80 dark:border-white/[0.08] bg-white dark:bg-[#151E32]/80 p-2.5 sm:p-3 flex flex-col justify-between h-[76px]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-6 rounded-md" />
                    <Skeleton className="h-3 w-16 rounded" />
                  </div>
                  <Skeleton className="h-4 w-12 rounded" />
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <Skeleton className="h-6 w-14 rounded" />
                  <Skeleton className="h-3 w-20 rounded" />
                </div>
              </div>
            ))}
          </div>

          {/* B. Live Practical Cockpit Card (~148px Height) */}
          <div className="rounded-2xl border border-zinc-200/80 dark:border-white/[0.08] bg-white dark:bg-[#101726]/90 p-4 sm:p-5 flex flex-col justify-between space-y-3 min-h-[148px]">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-44 rounded-md" />
                <Skeleton className="h-5 w-24 rounded-md" />
              </div>
              <Skeleton className="h-5 w-28 rounded-md" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-6 w-72 rounded-lg" />
              <Skeleton className="h-3.5 w-40 rounded" />
            </div>
            <div className="pt-1 flex items-center justify-between gap-4 border-t border-zinc-100 dark:border-white/[0.05]">
              <div className="flex-1 max-w-xs space-y-1">
                <Skeleton className="h-2 w-full rounded-full" />
                <Skeleton className="h-3 w-24 rounded" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-24 rounded-xl" />
                <Skeleton className="h-8 w-28 rounded-xl" />
              </div>
            </div>
          </div>

          {/* C. Sliding Segmented Tabs Header */}
          <div className="flex items-center justify-between p-1.5 rounded-2xl border border-zinc-200/80 dark:border-white/[0.08] bg-white dark:bg-[#101726]/90">
            <div className="flex gap-1.5 flex-1 max-w-md">
              {[1, 2, 3, 4].map((t) => (
                <Skeleton key={t} className="h-8 flex-1 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-8 w-28 rounded-xl hidden sm:block" />
          </div>

          {/* D. Session Feed Rows (3 Cards) */}
          <div className="space-y-2.5">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className="p-3.5 rounded-2xl border border-zinc-200/80 dark:border-white/[0.08] bg-white dark:bg-[#101726]/90 flex items-center justify-between gap-4 h-[76px]"
              >
                <div className="flex items-center gap-3.5">
                  <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-48 rounded" />
                    <Skeleton className="h-3 w-32 rounded" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-8 w-24 rounded-xl hidden sm:block" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN (4 Cols): Quick Ops, Facility Telemetry, Incidents */}
        <div className="lg:col-span-4 space-y-3.5 sm:space-y-4">
          {/* Quick Operations Card (Matches Left KPI Height: 76px) */}
          <div className="rounded-xl sm:rounded-2xl border border-zinc-200/80 dark:border-white/[0.08] bg-white dark:bg-[#151E32]/80 p-2.5 sm:p-3 grid grid-cols-2 gap-2 h-[76px]">
            <Skeleton className="h-full rounded-lg" />
            <Skeleton className="h-full rounded-lg" />
          </div>

          {/* Facility Telemetry Card */}
          <div className="rounded-2xl border border-zinc-200/80 dark:border-white/[0.08] bg-white dark:bg-[#101726]/90 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-4 w-12 rounded" />
            </div>
            <div className="space-y-2 pt-1">
              {[1, 2, 3, 4].map((r) => (
                <div
                  key={r}
                  className="p-2.5 rounded-xl border border-zinc-100 dark:border-white/[0.04] bg-zinc-50/50 dark:bg-white/[0.02] flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="h-6 w-6 rounded-md" />
                    <Skeleton className="h-3.5 w-28 rounded" />
                  </div>
                  <Skeleton className="h-4 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </div>

          {/* Incident Damage Registry Card */}
          <div className="rounded-2xl border border-zinc-200/80 dark:border-white/[0.08] bg-white dark:bg-[#101726]/90 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-36 rounded" />
              <Skeleton className="h-4 w-10 rounded" />
            </div>
            <div className="space-y-2 pt-1">
              {[1, 2].map((inc) => (
                <div
                  key={inc}
                  className="p-3 rounded-xl border border-zinc-100 dark:border-white/[0.04] bg-zinc-50/50 dark:bg-white/[0.02] space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3.5 w-32 rounded" />
                    <Skeleton className="h-3.5 w-14 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-44 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Backwards-compatibility alias
export const DashboardOverviewSkeleton = DashboardSkeleton

// ============================================================================
// 2. TIMETABLE CANVAS SKELETON (Exact 8-Period Horizontal Schedule Grid)
// ============================================================================
export function TimetableSkeleton() {
  return (
    <div className="space-y-3.5 w-full select-none pb-12 animate-in fade-in duration-150">
      {/* Top Segmented Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 px-4 rounded-2xl border border-zinc-200/80 dark:border-white/[0.08] bg-white dark:bg-[#101726]/90">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-44 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl hidden md:block" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-28 rounded-xl" />
          <Skeleton className="h-8 w-28 rounded-xl" />
          <Skeleton className="h-8 w-32 rounded-xl" />
        </div>
      </div>

      {/* Academic 8-Period Timetable Grid */}
      <div className="rounded-2xl border border-zinc-200/80 dark:border-white/[0.08] bg-white dark:bg-[#101726]/90 p-3.5 space-y-2.5 overflow-hidden">
        {/* Header Row: Day Column + 8 Periods */}
        <div className="grid grid-cols-9 gap-2 pb-2.5 border-b border-zinc-100 dark:border-white/[0.06]">
          <Skeleton className="h-8 rounded-lg col-span-1" />
          {Array.from({ length: 8 }).map((_, idx) => (
            <Skeleton key={idx} className="h-8 rounded-lg col-span-1" />
          ))}
        </div>

        {/* 6 Day Rows (Sunday to Friday) */}
        <div className="space-y-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day) => (
            <div key={day} className="grid grid-cols-9 gap-2 h-20 sm:h-22">
              {/* Day Label Cell */}
              <div className="col-span-1 rounded-xl border border-zinc-100 dark:border-white/[0.04] bg-zinc-50/50 dark:bg-white/[0.02] p-2 flex flex-col justify-between">
                <Skeleton className="h-3.5 w-10 rounded" />
                <Skeleton className="h-2.5 w-14 rounded" />
              </div>

              {/* 8 Period Slot Wireframe Cells */}
              {Array.from({ length: 8 }).map((_, pIdx) => (
                <div
                  key={pIdx}
                  className={`col-span-1 rounded-xl border p-2 flex flex-col justify-between ${
                    pIdx === 3
                      ? 'border-dashed border-zinc-200 dark:border-white/10 bg-zinc-50/30 dark:bg-white/[0.01]'
                      : 'border-zinc-100 dark:border-white/[0.04] bg-zinc-50/60 dark:bg-white/[0.02]'
                  }`}
                >
                  <Skeleton className="h-3 w-16 rounded" />
                  <Skeleton className="h-4 w-20 rounded" />
                  <Skeleton className="h-2.5 w-12 rounded" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Backwards-compatibility alias
export const ScheduleMatrixSkeleton = TimetableSkeleton

// ============================================================================
// 3. COMPUTER LAB CAD FLOOR & COCKPIT SKELETON (Production Dual-Wing Layout)
// ============================================================================
export function ComputerLabSkeleton() {
  return (
    <div className="space-y-3.5 w-full select-none pb-12 animate-in fade-in duration-150">
      {/* 1. Header Row: Title & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 px-4 rounded-2xl border border-zinc-200/80 dark:border-white/[0.08] bg-white dark:bg-[#101726]/90">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <div className="space-y-1">
            <Skeleton className="h-5 w-48 rounded" />
            <Skeleton className="h-3 w-64 rounded hidden sm:block" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-52 rounded-xl" />
          <Skeleton className="h-9 w-32 rounded-xl hidden md:block" />
        </div>
      </div>

      {/* 2. 4-Column Top KPI Row (~76px High) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {[1, 2, 3, 4].map((kpi) => (
          <div
            key={kpi}
            className="rounded-xl border border-zinc-200/80 dark:border-white/[0.08] bg-white dark:bg-[#151E32]/80 p-2.5 sm:p-3 flex flex-col justify-between h-[76px]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-5 w-5 rounded-md" />
                <Skeleton className="h-3 w-20 rounded" />
              </div>
              <Skeleton className="h-3.5 w-12 rounded" />
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <Skeleton className="h-6 w-12 rounded" />
              <Skeleton className="h-3 w-20 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* 3. Full-Width Live Cockpit Ribbon (~110px Height) */}
      <div className="rounded-2xl border border-zinc-200/80 dark:border-white/[0.08] bg-white dark:bg-[#101726]/90 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-h-[110px]">
        <div className="flex items-center gap-3.5">
          <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-56 rounded-md" />
            <Skeleton className="h-3.5 w-44 rounded" />
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-9 w-32 rounded-xl" />
          <Skeleton className="h-9 w-36 rounded-xl" />
        </div>
      </div>

      {/* 4. Full-Width Dual-Wing CAD Canvas Viewport (Zero Right Sidebar!) */}
      <div className="rounded-2xl border border-zinc-200/80 dark:border-white/[0.08] bg-white/60 dark:bg-[#0E1526]/80 p-6 min-h-[500px] relative overflow-hidden flex flex-col justify-between">
        {/* Front Teacher Podium Anchor */}
        <div className="self-start">
          <Skeleton className="h-12 w-28 rounded-xl border border-zinc-200 dark:border-white/10" />
        </div>

        {/* Dual-Wing 4x4 + 4x4 Workstation Monitor Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-14 w-full max-w-5xl mx-auto my-auto py-6">
          {/* Left Wing: 4 cols x 4 rows */}
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 16 }).map((_, idx) => (
              <div
                key={`left-${idx}`}
                className="aspect-[4/3] rounded-xl border border-zinc-200/70 dark:border-white/[0.06] bg-zinc-100 dark:bg-[#151E32] p-1.5 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <Skeleton className="h-2 w-6 rounded" />
                  <Skeleton className="h-2 w-2 rounded-full" />
                </div>
                <div className="my-auto text-center">
                  <Skeleton className="h-3 w-8 mx-auto rounded" />
                </div>
                <div className="h-1.5 w-full rounded bg-zinc-200 dark:bg-white/10" />
              </div>
            ))}
          </div>

          {/* Right Wing: 4 cols x 4 rows */}
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 16 }).map((_, idx) => (
              <div
                key={`right-${idx}`}
                className="aspect-[4/3] rounded-xl border border-zinc-200/70 dark:border-white/[0.06] bg-zinc-100 dark:bg-[#151E32] p-1.5 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <Skeleton className="h-2 w-6 rounded" />
                  <Skeleton className="h-2 w-2 rounded-full" />
                </div>
                <div className="my-auto text-center">
                  <Skeleton className="h-3 w-8 mx-auto rounded" />
                </div>
                <div className="h-1.5 w-full rounded bg-zinc-200 dark:bg-white/10" />
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Controls Row: Floating HUD (Left) & Radar Minimap (Right) */}
        <div className="flex items-end justify-between pt-4">
          <Skeleton className="h-9 w-44 rounded-xl border border-zinc-200 dark:border-white/10" />
          <Skeleton className="h-20 w-32 rounded-xl border border-zinc-200 dark:border-white/10" />
        </div>
      </div>
    </div>
  )
}

// Backwards-compatibility alias
export const ComputerLabFloorSkeleton = ComputerLabSkeleton

// ============================================================================
// 4. PRACTICAL LOGBOOK SKELETON (/records)
// ============================================================================
export function LogbookSkeleton() {
  return (
    <div className="space-y-4 w-full select-none pb-12 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-white/[0.08]">
        <div className="space-y-1">
          <Skeleton className="h-6 w-56 rounded-lg" />
          <Skeleton className="h-3.5 w-80 rounded" />
        </div>
        <Skeleton className="h-9 w-36 rounded-xl" />
      </div>

      {/* 3 Metric Cards (~76px High) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-zinc-200/80 dark:border-white/[0.08] bg-white dark:bg-[#151E32]/80 p-3 flex flex-col justify-between h-[76px]"
          >
            <div className="flex justify-between items-center">
              <Skeleton className="h-3.5 w-24 rounded" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </div>
            <Skeleton className="h-6 w-16 rounded" />
          </div>
        ))}
      </div>

      {/* Search & Filter Toolbar */}
      <div className="p-3 rounded-2xl border border-zinc-200/80 dark:border-white/[0.08] bg-white dark:bg-[#101726]/90 flex flex-col sm:flex-row gap-3">
        <Skeleton className="h-9 flex-1 rounded-xl" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
      </div>

      {/* 8-Row Production Table Skeleton */}
      <div className="rounded-2xl border border-zinc-200/80 dark:border-white/[0.08] bg-white dark:bg-[#101726]/90 overflow-hidden">
        {/* Table Header Row */}
        <div className="grid grid-cols-7 gap-4 p-3.5 border-b border-zinc-100 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.02]">
          <Skeleton className="h-4 col-span-1 rounded" />
          <Skeleton className="h-4 col-span-1 rounded" />
          <Skeleton className="h-4 col-span-1 rounded" />
          <Skeleton className="h-4 col-span-2 rounded" />
          <Skeleton className="h-4 col-span-1 rounded" />
          <Skeleton className="h-4 col-span-1 rounded" />
        </div>

        {/* 8 Table Rows */}
        <div className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
          {Array.from({ length: 8 }).map((_, r) => (
            <div key={r} className="grid grid-cols-7 gap-4 p-3.5 items-center">
              <Skeleton className="h-4 col-span-1 rounded" />
              <Skeleton className="h-4 col-span-1 rounded" />
              <Skeleton className="h-4 col-span-1 rounded" />
              <Skeleton className="h-4 col-span-2 rounded" />
              <Skeleton className="h-4 col-span-1 rounded" />
              <Skeleton className="h-4 col-span-1 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Backwards-compatibility alias
export const PracticalRecordsSkeleton = LogbookSkeleton

// ============================================================================
// 5. MAINTENANCE & DIAGNOSTICS SKELETON (/maintenance & /records/incidents)
// ============================================================================
export function MaintenanceSkeleton() {
  return (
    <div className="space-y-4 w-full select-none pb-12 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-white/[0.08]">
        <div className="space-y-1">
          <Skeleton className="h-6 w-60 rounded-lg" />
          <Skeleton className="h-3.5 w-72 rounded" />
        </div>
        <Skeleton className="h-9 w-36 rounded-xl" />
      </div>

      {/* 2-Tab Workbench Bar */}
      <div className="flex gap-2 border-b border-zinc-200 dark:border-white/[0.08] pb-2">
        <Skeleton className="h-9 w-40 rounded-xl" />
        <Skeleton className="h-9 w-48 rounded-xl" />
      </div>

      {/* 4 Health KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((k) => (
          <div
            key={k}
            className="rounded-xl border border-zinc-200/80 dark:border-white/[0.08] bg-white dark:bg-[#151E32]/80 p-3 h-[76px] flex flex-col justify-between"
          >
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="h-6 w-12 rounded" />
          </div>
        ))}
      </div>

      {/* Cards List */}
      <div className="space-y-3 pt-1">
        {[1, 2, 3].map((card) => (
          <div
            key={card}
            className="p-4 rounded-2xl border border-zinc-200/80 dark:border-white/[0.08] bg-white dark:bg-[#101726]/90 space-y-2"
          >
            <div className="flex justify-between items-center">
              <Skeleton className="h-5 w-48 rounded" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-3.5 w-72 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// 6. ADMIN CONTROL CENTER SKELETON (/admin)
// ============================================================================
export function AdminSkeleton() {
  return (
    <div className="space-y-4 w-full select-none pb-12 animate-in fade-in duration-150">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-zinc-200/80 dark:border-white/[0.08] bg-white dark:bg-[#101726]/90">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-1">
            <Skeleton className="h-5 w-52 rounded" />
            <Skeleton className="h-3 w-40 rounded" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-28 rounded-xl" />
          <Skeleton className="h-8 w-28 rounded-xl" />
        </div>
      </div>

      {/* 4 Administrative Module Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {[1, 2, 3, 4].map((tab) => (
          <Skeleton key={tab} className="h-11 rounded-xl" />
        ))}
      </div>

      {/* Directory Card */}
      <div className="p-5 rounded-2xl border border-zinc-200/80 dark:border-white/[0.08] bg-white dark:bg-[#101726]/90 space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-5 w-44 rounded" />
          <Skeleton className="h-8 w-32 rounded-xl" />
        </div>
        <div className="space-y-2.5 pt-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="p-3.5 rounded-xl border border-zinc-100 dark:border-white/[0.04] flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-36 rounded" />
                  <Skeleton className="h-3 w-24 rounded" />
                </div>
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Backwards-compatibility alias
export const AdminCommandCenterSkeleton = AdminSkeleton

// ============================================================================
// 7. USER PROFILE SKELETON (/profile)
// ============================================================================
export function ProfileSkeleton() {
  return (
    <div className="space-y-4 w-full max-w-4xl mx-auto select-none pb-12 animate-in fade-in duration-150">
      <div className="p-6 rounded-3xl border border-zinc-200/80 dark:border-white/[0.08] bg-white dark:bg-[#101726]/90 space-y-5">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-2xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-48 rounded" />
            <Skeleton className="h-3.5 w-32 rounded" />
            <Skeleton className="h-4 w-24 rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      </div>
    </div>
  )
}
