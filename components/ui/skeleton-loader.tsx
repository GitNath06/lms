import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export function DashboardOverviewSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300 select-none">
      {/* Top Banner Skeleton */}
      <div className="p-6 rounded-xl bg-gradient-to-r from-zinc-100 to-zinc-200/70 dark:from-zinc-900/80 dark:to-zinc-800/50 border border-zinc-200/80 dark:border-zinc-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-36 rounded-md" />
          <Skeleton className="h-8 w-64 rounded-xl" />
          <Skeleton className="h-4 w-96 rounded-md" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-32 rounded-xl" />
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
      </div>

      {/* KPI Stats Row (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-5 rounded-xl bg-white dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800 space-y-3 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28 rounded-md" />
              <Skeleton className="h-9 w-9 rounded-xl" />
            </div>
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-3 w-40 rounded-md" />
          </div>
        ))}
      </div>

      {/* Main Grid: Sessions & Syllabus */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-4">
          <div className="p-5 rounded-xl bg-white dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-48 rounded-lg" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-20 rounded-lg" />
                <Skeleton className="h-8 w-20 rounded-lg" />
              </div>
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className="p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3.5">
                    <Skeleton className="h-12 w-12 rounded-xl" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-44 rounded-md" />
                      <Skeleton className="h-3 w-32 rounded-md" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-28 rounded-xl" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <div className="p-5 rounded-xl bg-white dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800 space-y-4">
            <Skeleton className="h-6 w-36 rounded-lg" />
            <div className="space-y-3">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="space-y-1.5">
                  <div className="flex justify-between">
                    <Skeleton className="h-3.5 w-24 rounded-md" />
                    <Skeleton className="h-3.5 w-12 rounded-md" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ScheduleMatrixSkeleton() {
  return (
    <div className="flex flex-col h-[calc(100vh-100px)] space-y-3 animate-in fade-in duration-300 select-none">
      {/* Top Segmented Toolbar */}
      <div className="flex items-center justify-between p-3 px-4 rounded-xl bg-white dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <Skeleton className="h-5 w-48 rounded-md" />
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-lg" />
          ))}
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
      </div>

      {/* Grid Canvas */}
      <div className="flex-1 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-3 space-y-3 overflow-hidden">
        <div className="grid grid-cols-11 gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
          <Skeleton className="h-8 rounded-lg col-span-1" />
          {Array.from({ length: 10 }).map((_, idx) => (
            <Skeleton key={idx} className="h-8 rounded-lg col-span-1" />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, rIdx) => (
            <div key={rIdx} className="grid grid-cols-11 gap-2 h-20">
              <Skeleton className="h-full rounded-xl col-span-1" />
              <Skeleton className="h-full rounded-xl col-span-3" />
              <Skeleton className="h-full rounded-xl col-span-2" />
              <Skeleton className="h-full rounded-xl col-span-1" />
              <Skeleton className="h-full rounded-xl col-span-4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function AdminCommandCenterSkeleton() {
  return (
    <div className="space-y-5 w-full select-none animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900/80 p-5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
        <div className="flex items-center gap-3.5">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-64 rounded-md" />
            <Skeleton className="h-3.5 w-48 rounded-md" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-36 rounded-xl" />
          <Skeleton className="h-9 w-32 rounded-xl" />
        </div>
      </div>

      {/* 4 Categorized Executive Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {[1, 2, 3, 4].map((t) => (
          <Skeleton key={t} className="h-12 rounded-xl" />
        ))}
      </div>

      {/* Main Table / Directory Card */}
      <div className="p-6 rounded-xl bg-white dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-5 w-48 rounded-md" />
            <Skeleton className="h-3 w-64 rounded-md" />
          </div>
          <Skeleton className="h-9 w-36 rounded-xl" />
        </div>

        <div className="space-y-2.5 pt-2">
          {Array.from({ length: 6 }).map((_, row) => (
            <div
              key={row}
              className="p-4 rounded-xl border border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-36 rounded-md" />
                  <Skeleton className="h-3 w-48 rounded-md" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-28 rounded-full" />
                <Skeleton className="h-8 w-20 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
