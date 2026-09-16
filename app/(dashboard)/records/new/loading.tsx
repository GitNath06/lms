import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export default function NewLogLoading() {
  return (
    <div className="max-w-6xl mx-auto space-y-4 select-none animate-in fade-in duration-200">
      {/* 1. Header Toolbar Skeleton */}
      <div className="flex items-center justify-between bg-white/80 dark:bg-zinc-900/80 p-3.5 px-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-xl" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
        <Skeleton className="h-7 w-28 rounded-lg" />
      </div>

      {/* 2. 2-Column Bento Form Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-4.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 space-y-4 shadow-xs">
            <Skeleton className="h-4 w-44" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-10 rounded-lg" />
              <Skeleton className="h-10 rounded-lg" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-10 rounded-lg" />
              <Skeleton className="h-10 rounded-lg" />
            </div>
            <Skeleton className="h-12 rounded-lg" />
          </div>

          <div className="p-4.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 space-y-3 shadow-xs">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
        </div>

        {/* Right Column: Attendance Register (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-4.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-7 w-20 rounded-md" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Skeleton className="h-14 rounded-lg" />
              <Skeleton className="h-14 rounded-lg" />
              <Skeleton className="h-14 rounded-lg" />
            </div>
            {/* Roll grid 38 chips */}
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5">
              {Array.from({ length: 38 }).map((_, i) => (
                <Skeleton key={i} className="h-9 rounded-md" />
              ))}
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <Skeleton className="h-10 w-24 rounded-xl" />
              <Skeleton className="h-10 w-36 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
